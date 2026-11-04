#!/usr/bin/env python3
"""Orquestador del pipeline Demeter: calibración en tierra, bloqueo de misión, captura y comparación.

Subcomandos:
  calibrate  mide el balance de blancos con la cámara en tierra y lo guarda en calibration/
  freeze     congela perfil + calibración por cámara en missions/ y emite los flags de rpicam-raw
  capture    1 frame: captura (RAW COMP1 + PISP_FE_STATS) -> Bayer16 -> Controller -> BE -> JPEG
  compare    rpicam-still oficial vs pipeline propio con los mismos parámetros, lado a lado
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import statistics
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent
BUILD = Path(os.environ.get("DEMETER_BUILD_DIR", str(ROOT / ".build")))
BIN = BUILD / "bin"
PRAW2RGB = Path(os.environ.get("PRAW2RGB", str(BUILD / "libpisp-build/src/examples/praw2rgb")))
TUNE = Path(os.environ.get("DEMETER_TUNE", "/usr/share/libcamera/ipa/rpi/pisp/imx708.json"))

# Mapeo de nombres libcamera (perfil) a los de rpicam-apps.
RPICAM_EXPOSURE = {"normal": "normal", "short": "short", "long": "long"}
RPICAM_METERING = {"centre-weighted": "centre", "spot": "spot", "matrix": "average"}


def now():
    return dt.datetime.now().strftime("%Y%m%d_%H%M%S")


def run(cmd, **kwargs):
    env = dict(os.environ, LIBCAMERA_LOG_LEVELS="*:ERROR", LIBPISP_LOG_LEVELS="*:ERROR")
    cmd = [str(c) for c in cmd]
    print("  $", " ".join(cmd), flush=True)
    return subprocess.run(cmd, check=True, env=env, **kwargs)


def load_profile(name):
    path = Path(name)
    if not path.is_file():
        path = ROOT / "profiles" / f"{name}.json"
    if not path.is_file():
        sys.exit(f"Perfil no encontrado: {name}")
    profile = json.loads(path.read_text())
    profile.setdefault("name", path.stem)
    return profile


def calibration_path(profile, camera):
    return ROOT / "calibration" / f"{profile['name']}_cam{camera}.json"


def resolve(profile, camera, force_auto_wb=False):
    """Devuelve el perfil con el balance de blancos 'calibrated' sustituido por ganancias fijas."""
    resolved = json.loads(json.dumps(profile))
    resolved["camera"] = camera
    wb = resolved.setdefault("white_balance", {"mode": "auto"})
    if force_auto_wb:
        resolved["white_balance"] = {"mode": "auto"}
    elif wb.get("mode") == "calibrated":
        cal = calibration_path(profile, camera)
        if not cal.is_file():
            sys.exit(f"Falta la calibración {cal.name}. Ejecuta: demeter_isp.py calibrate "
                     f"--profile {profile['name']} --camera {camera}")
        data = json.loads(cal.read_text())
        resolved["white_balance"] = {"mode": "fixed", "gains": data["white_balance"]["gains"],
                                     "colour_temperature": data["white_balance"].get("colour_temperature"),
                                     "calibration": str(cal.relative_to(ROOT))}
    return resolved


def rpicam_args(resolved):
    """Flags de rpicam-still / rpicam-raw equivalentes al perfil resuelto."""
    args = []
    exposure = resolved.get("exposure", {})
    if exposure.get("mode") == "manual":
        args += ["--shutter", exposure["shutter_us"], "--gain", exposure["gain"]]
    else:
        args += ["--exposure", RPICAM_EXPOSURE[exposure.get("exposure_mode", "normal")],
                 "--metering", RPICAM_METERING[exposure.get("metering", "centre-weighted")],
                 "--ev", exposure.get("ev", 0.0)]
    wb = resolved.get("white_balance", {})
    if wb.get("mode") == "fixed":
        args += ["--awbgains", f"{wb['gains'][0]:.6f},{wb['gains'][1]:.6f}"]
    focus = resolved.get("focus", {})
    mode = focus.get("mode", "infinity")
    if mode == "infinity":
        args += ["--autofocus-mode", "manual", "--lens-position", 0.0]
    elif mode == "manual":
        args += ["--autofocus-mode", "manual", "--lens-position", focus["lens_position"]]
    elif mode in ("auto", "continuous"):
        args += ["--autofocus-mode", mode, "--autofocus-range", focus.get("range", "full")]
    return [str(a) for a in args]


def capture_custom(config_path, camera, prefix, exposure=None, settle=None):
    cmd = [BIN / "capture_pisp_stats", "--camera", camera, "--out", prefix, "--config", config_path]
    if settle is not None:
        cmd += ["--settle-frames", settle]
    if exposure:
        cmd += ["--exposure-us", exposure[0], "--gain", exposure[1]]
    run(cmd)


def develop(prefix, config_path, overrides):
    sidecar = json.loads(Path(f"{prefix}.json").read_text())
    width, height, stride = sidecar["width"], sidecar["height"], sidecar["stride"]
    bayer16 = f"{prefix}_bayer16.raw"
    run([PRAW2RGB, "--input-format", f"{width}:{height}:{stride}:PISP_COMP1",
         "--output-format", f"{width}:{height}:{width * 2}:BAYER16", f"{prefix}.raw", bayer16],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cmd = [BIN / "controller_replay", f"{prefix}.pisp_stats.bin", f"{prefix}.json", TUNE, bayer16, prefix,
           "--config", config_path]
    if overrides.get("black_level") is not None:
        cmd += ["--black-level", overrides["black_level"]]
    if overrides.get("white_level") is not None:
        cmd += ["--white-level", overrides["white_level"]]
    run(cmd, stdout=subprocess.DEVNULL)
    rgb = np.fromfile(f"{prefix}.rgb888.raw", np.uint8).reshape(height, width, 3)
    # El BE entrega R,G,B en memoria; OpenCV escribe BGR.
    cv2.imwrite(f"{prefix}.jpg", rgb[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 95])
    return rgb[..., ::-1]


def results_dir(camera, profile, kind, tag):
    name = f"{now()}_cam{camera}_{profile['name']}_{kind}" + (f"_{tag}" if tag else "")
    path = ROOT / "results" / name
    path.mkdir(parents=True)
    return path


def write_resolved(path, resolved):
    path.write_text(json.dumps(resolved, indent=2) + "\n")
    return path


def cmd_calibrate(args):
    profile = load_profile(args.profile)
    resolved = resolve(profile, args.camera, force_auto_wb=True)
    out = ROOT / "calibration" / f"{profile['name']}_cam{args.camera}_{now()}"
    out.mkdir(parents=True)
    config = write_resolved(out / "resolved_config.json", resolved)
    print(f"Calibrando cámara {args.camera} con perfil {profile['name']} (apunta a un blanco neutro)...")
    runs = []
    for i in range(args.runs):
        prefix = out / f"run{i}"
        capture_custom(config, args.camera, prefix, settle=args.settle_frames)
        sidecar = json.loads(Path(f"{prefix}.json").read_text())
        runs.append({"colour_gains": sidecar["colour_gains"], "colour_temperature": sidecar["colour_temperature"],
                     "exposure_time_us": sidecar["exposure_time_us"], "analogue_gain": sidecar["analogue_gain"],
                     "lux": sidecar.get("lux"), "lens_position": sidecar.get("lens_position")})
    gains = [statistics.median(r["colour_gains"][k] for r in runs) for k in (0, 1)]
    spread = max(max(r["colour_gains"][k] for r in runs) / min(r["colour_gains"][k] for r in runs) - 1
                 for k in (0, 1))
    if spread > 0.05:
        print(f"AVISO: las ganancias varían {spread:.1%} entre repeticiones; la escena puede no ser estable.")
    data = {"profile": profile["name"], "camera": args.camera, "created_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "white_balance": {"gains": [round(g, 6) for g in gains],
                              "colour_temperature": round(statistics.median(r["colour_temperature"] for r in runs)),
                              "gain_spread": round(spread, 4)},
            "reference": {"exposure_time_us": runs[-1]["exposure_time_us"], "analogue_gain": runs[-1]["analogue_gain"],
                          "lux": runs[-1]["lux"]},
            "runs": runs, "source_dir": str(out.relative_to(ROOT))}
    text = json.dumps(data, indent=2) + "\n"
    (out / "calibration.json").write_text(text)
    calibration_path(profile, args.camera).write_text(text)
    print(f"Calibración guardada: {calibration_path(profile, args.camera).relative_to(ROOT)}")
    print(f"  ganancias R/B = {gains[0]:.4f} / {gains[1]:.4f}  CT = {data['white_balance']['colour_temperature']} K")


def cmd_freeze(args):
    profile = load_profile(args.profile)
    cameras = profile.get("cameras", [0, 1])
    out = ROOT / "missions" / f"{now()}_{profile['name']}"
    out.mkdir(parents=True)
    mission = {"profile": profile["name"], "created_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "profile_sha256": hashlib.sha256(json.dumps(profile, sort_keys=True).encode()).hexdigest(),
               "cameras": {}}
    for camera in cameras:
        resolved = resolve(profile, camera)
        flags = rpicam_args(resolved)
        mission["cameras"][str(camera)] = {"resolved": resolved, "rpicam_args": flags}
        (out / f"rpicam_args_cam{camera}.txt").write_text(" ".join(flags) + "\n")
        print(f"cam{camera}: {' '.join(flags)}")
    (out / "mission_config.json").write_text(json.dumps(mission, indent=2) + "\n")
    print(f"Misión congelada en {out.relative_to(ROOT)}")


def cmd_capture(args):
    profile = load_profile(args.profile)
    resolved = resolve(profile, args.camera)
    out = results_dir(args.camera, profile, "custom", args.tag)
    config = write_resolved(out / "resolved_config.json", resolved)
    prefix = out / "custom"
    capture_custom(config, args.camera, prefix, settle=args.settle_frames)
    develop(prefix, config, vars(args))
    print(f"Resultado: {out.relative_to(ROOT)}")


def cmd_compare(args):
    profile = load_profile(args.profile)
    resolved = resolve(profile, args.camera)
    out = results_dir(args.camera, profile, "compare", args.tag)
    config = write_resolved(out / "resolved_config.json", resolved)

    still_jpg, still_meta = out / "rpicam_still.jpg", out / "rpicam_still.meta.json"
    width = profile.get("capture", {}).get("width", 4608)
    height = profile.get("capture", {}).get("height", 2592)
    run(["rpicam-still", "--camera", args.camera, "-n", "-t", args.still_timeout_ms, "--width", width,
         "--height", height, "-q", 95, "--metadata", still_meta, "--metadata-format", "json",
         "-o", still_jpg, *rpicam_args(resolved)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    meta = json.loads(still_meta.read_text())

    exposure = None
    if resolved.get("exposure", {}).get("mode") != "manual" and not args.no_match_exposure:
        exposure = (int(meta["ExposureTime"]), float(meta["AnalogueGain"]))
        print(f"  exposición oficial: {exposure[0]} us, ganancia {exposure[1]:.4f} (se replica en el pipeline propio)")
    prefix = out / "custom"
    capture_custom(config, args.camera, prefix, exposure=exposure, settle=args.settle_frames)
    custom = develop(prefix, config, vars(args))

    official = cv2.imread(str(still_jpg))
    half = (1152, 648)

    def label(img, text):
        return cv2.putText(img, text, (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 255, 255), 3)

    def centre(img):
        h, w = img.shape[:2]
        y, x = (h - half[1]) // 2, (w - half[0]) // 2
        return img[y:y + half[1], x:x + half[0]].copy()

    top = np.hstack([label(cv2.resize(official, half, interpolation=cv2.INTER_AREA), "rpicam-still"),
                     label(cv2.resize(custom, half, interpolation=cv2.INTER_AREA), "pipeline propio")])
    bottom = np.hstack([label(centre(official), "100% centro"), label(centre(custom), "100% centro")])
    cv2.imwrite(str(out / "lado_a_lado.jpg"), np.vstack([top, bottom]), [cv2.IMWRITE_JPEG_QUALITY, 92])

    def stats(img):
        return [round(float(v), 1) for v in img.reshape(-1, 3).mean(0)[::-1]]

    summary = {"official_rgb_mean": stats(official), "custom_rgb_mean": stats(custom),
               "official_meta": {k: meta.get(k) for k in ("ExposureTime", "AnalogueGain", "ColourGains",
                                                         "ColourTemperature", "LensPosition", "Lux")}}
    (out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary["official_rgb_mean"]), "vs", json.dumps(summary["custom_rgb_mean"]), "(media RGB)")
    print(f"Resultado: {out.relative_to(ROOT)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    def common(p, camera=True):
        p.add_argument("--profile", default="vuelo_infinito")
        if camera:
            p.add_argument("--camera", type=int, default=0)

    p = sub.add_parser("calibrate")
    common(p)
    p.add_argument("--runs", type=int, default=3)
    p.add_argument("--settle-frames", type=int, default=45)
    p.set_defaults(func=cmd_calibrate)

    p = sub.add_parser("freeze")
    common(p, camera=False)
    p.set_defaults(func=cmd_freeze)

    for name, func in (("capture", cmd_capture), ("compare", cmd_compare)):
        p = sub.add_parser(name)
        common(p)
        p.add_argument("--settle-frames", type=int, default=None)
        p.add_argument("--black-level", type=int, default=None, help="dominio 16 bit del tune (IMX708: 4096)")
        p.add_argument("--white-level", type=int, default=None, help="dominio 16 bit del tune (máx. 65535)")
        p.add_argument("--tag", default="")
        if name == "compare":
            p.add_argument("--still-timeout-ms", type=int, default=3000)
            p.add_argument("--no-match-exposure", action="store_true")
        p.set_defaults(func=func)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
