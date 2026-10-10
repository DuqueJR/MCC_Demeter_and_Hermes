#!/usr/bin/env python3
"""Develop all fixed-exposure R9 captures and quantify Bayer16 and RGB-replay response."""
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
PRAW = Path("/home/admin/libpisp/build/src/examples/praw2rgb")
REPLAY = Path("/home/admin/.cache/demeter_build/bin/controller_replay")
TUNE = Path("/usr/share/libcamera/ipa/rpi/pisp/imx708.json")
BLACK = 2048
ROI = {0: (730, 339, 1072, 723), 1: (624, 320, 1073, 728)}  # green-plane coordinates from R5


def fit(x, y):
    x = np.asarray(x, dtype=float); y = np.asarray(y, dtype=float)
    matrix = np.column_stack([x, np.ones_like(x)])
    slope, intercept = np.linalg.lstsq(matrix, y, rcond=None)[0]
    pred = slope*x + intercept
    ss_res = float(np.sum((y-pred)**2)); ss_tot = float(np.sum((y-y.mean())**2))
    residual_pct = 100 * float(np.max(np.abs(y-pred))) / max(float(np.ptp(y)), 1e-9)
    rho = float(np.corrcoef(x, y)[0,1]) if len(x) > 1 else float("nan")
    return {"slope_dn_per_linear_luminance": float(slope), "intercept_dn": float(intercept),
            "r_squared": 1-ss_res/ss_tot if ss_tot else 1.0, "pearson_r": rho,
            "max_abs_residual_pct_of_measured_range": residual_pct,
            "monotonic_increasing": bool(np.all(np.diff(y) >= 0))}


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: analyze_r9.py <run-directory>")
    run = Path(sys.argv[1]).resolve()
    events = [json.loads(line) for line in (run / "events.jsonl").read_text().splitlines() if line]
    captures = [e for e in events if e.get("kind") == "level_capture_complete"]
    if len(captures) != 14:
        raise RuntimeError(f"Expected 14 captured levels, found {len(captures)}")
    displays = {int(e["index"]): e for e in events if e.get("kind") == "gray_level_displayed"}
    if len(displays) != 14:
        raise RuntimeError(f"Expected 14 display events, found {len(displays)}")
    summary = {"experiment": "R9 fixed-exposure relative linearity", "run_dir": str(run),
               "fixed_controls": json.loads((run / "profile_cam0.json").read_text()), "cameras": {}}

    for camera in (0, 1):
        records = []
        for event in sorted(captures, key=lambda e: e["index"]):
            display_event = displays[int(event["index"])]
            data = next(x for x in event["captures"] if x["camera"] == camera)
            prefix = run / data["prefix"]
            sidecar = json.loads(Path(f"{prefix}.json").read_text())
            width, height, stride = sidecar["width"], sidecar["height"], sidecar["stride"]
            bayer_path = Path(f"{prefix}_bayer16.raw")
            if not bayer_path.exists():
                subprocess.run([str(PRAW), "--input-format", f"{width}:{height}:{stride}:PISP_COMP1",
                                "--output-format", f"{width}:{height}:{width*2}:BAYER16", f"{prefix}.raw", str(bayer_path)],
                               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            profile = run / f"profile_cam{camera}.json"
            rgb_path = Path(f"{prefix}_replay.rgb888.raw")
            status_path = Path(f"{prefix}_replay.status.json")
            if not rgb_path.exists() or not status_path.exists():
                subprocess.run([str(REPLAY), f"{prefix}.pisp_stats.bin", f"{prefix}.json", str(TUNE), str(bayer_path),
                                f"{prefix}_replay", "--config", str(profile)], check=True,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            raw = np.fromfile(bayer_path, np.uint16).reshape(height, width).astype(np.float32) - BLACK
            green = (raw[0::2, 1::2] + raw[1::2, 0::2]) / 2
            blue, green_b, green_r, red = raw[0::2,0::2], raw[0::2,1::2], raw[1::2,0::2], raw[1::2,1::2]
            x, y, w, h = ROI[camera]
            panel = np.s_[y:y+h, x:x+w]
            center = np.s_[y+round(.4*h):y+round(.6*h), x+round(.4*w):x+round(.6*w)]
            gpanel, gcenter = green[panel], green[center]
            rgb = np.fromfile(rgb_path, np.uint8).reshape(height, width, 3).astype(np.float32)
            # PiSP BE output memory order is R,G,B.
            luma = .2126*rgb[...,0] + .7152*rgb[...,1] + .0722*rgb[...,2]
            rgb_panel = np.s_[2*y:2*(y+h), 2*x:2*(x+w)]
            rgb_center = np.s_[2*y+round(.4*2*h):2*y+round(.6*2*h), 2*x+round(.4*2*w):2*x+round(.6*2*w)]
            target = float(display_event["linear_luminance"])
            maxima = {"B": float(blue[panel].max()), "Gb": float(green_b[panel].max()),
                      "Gr": float(green_r[panel].max()), "R": float(red[panel].max())}
            level_name = f"L{int(event['index'])+1:02d}_{int(round(target*100)):03d}pct"
            records.append({"index": event["index"], "name": level_name, "linear_luminance": target,
                            "srgb_code": display_event["srgb_code"], "exposure_us": sidecar.get("exposure_time_us"),
                            "analogue_gain": sidecar.get("analogue_gain"), "digital_gain": sidecar.get("digital_gain"),
                            "green_panel_mean_dn": float(gpanel.mean()), "green_center_mean_dn": float(gcenter.mean()),
                            "green_panel_std_dn": float(gpanel.std()), "green_max_dn_by_cfa": maxima,
                            "fraction_green_clipped": float((gpanel >= 61440).mean()),
                            "rgb_replay_panel_luma_mean": float(luma[rgb_panel].mean()),
                            "rgb_replay_center_luma_mean": float(luma[rgb_center].mean()),
                            "bayer16": bayer_path.name, "replay_status": f"{prefix.name}_replay.status.json"})
            print(f"cam{camera} {level_name:10s} target={target:>4.0%} G={gpanel.mean():8.1f} "
                  f"RGBY={luma[rgb_panel].mean():6.1f} clip={100*(gpanel>=61440).mean():.4f}%")

        targets = [r["linear_luminance"] for r in records]
        green_means = [r["green_panel_mean_dn"] for r in records]
        rgb_means = [r["rgb_replay_panel_luma_mean"] for r in records]
        mid = [r for r in records if .10 <= r["linear_luminance"] <= .90]
        summary["cameras"][str(camera)] = {
            "fixed_exposure_us": [r["exposure_us"] for r in records],
            "fixed_analogue_gain": [r["analogue_gain"] for r in records],
            "bayer_green_linearity_10_to_90_percent": fit(
                [r["linear_luminance"] for r in mid], [r["green_panel_mean_dn"] for r in mid]),
            "bayer_green_linearity_all_levels_diagnostic": fit(targets, green_means),
            "rgb_replay_transfer": {"pearson_r": float(np.corrcoef(targets, rgb_means)[0,1]),
                                     "monotonic_increasing": bool(np.all(np.diff(rgb_means) >= 0)),
                                     "note": "RGB output includes WB/CCM/gamma/denoise; not expected to be linear in scene luminance."},
            "all_levels_below_green_clip": all(r["fraction_green_clipped"] == 0 for r in records),
            "levels": records,
        }

    json_out = run / "r9_analysis.json"
    json_out.write_text(json.dumps(summary, indent=2) + "\n")
    report = ["# R9 - Linealidad relativa", "", f"Run: `{run.name}`", "",
              "Capturas de una trama por nivel en ambas camaras, con exposicion, ganancia analogica, AWB y foco fijos. "
              "Los valores X son luminancias lineales nominales de la pagina; no implican calibracion radiometrica absoluta del LCD.", "",
              "## Bayer16: ajuste principal 10-90%", "",
              "El ajuste usa solo 10, 20, 30, 40, 50, 60, 70, 80 y 90% (n=9). Se excluyen los extremos 1, 2, 5, 95 y 100% del ajuste principal.", "",
              "|Camara|n|Pendiente (DN/unidad lineal)|Intercepto DN|R2|r Pearson|Residual max (% rango medido)|Monotono|Clip verde|",
              "|---:|---:|---:|---:|---:|---:|---:|:---:|:---:|"]
    for camera, data in summary["cameras"].items():
          m = data["bayer_green_linearity_10_to_90_percent"]
          report.append(f"|{camera}|9|{m['slope_dn_per_linear_luminance']:.1f}|{m['intercept_dn']:.1f}|{m['r_squared']:.6f}|"
                      f"{m['pearson_r']:.6f}|{m['max_abs_residual_pct_of_measured_range']:.3f}|"
                      f"{'si' if m['monotonic_increasing'] else 'NO'}|{'no' if data['all_levels_below_green_clip'] else 'si'}|")
    report += ["", "## Por nivel", "", "|Nivel lineal|sRGB|G Cam0 DN|G Cam1 DN|RGB replay Cam0|RGB replay Cam1|",
               "|---:|---:|---:|---:|---:|---:|"]
    for i, a in enumerate(summary["cameras"]["0"]["levels"]):
        b = summary["cameras"]["1"]["levels"][i]
        report.append(f"|{a['linear_luminance']:.0%}|{a['srgb_code']}|{a['green_panel_mean_dn']:.1f}|{b['green_panel_mean_dn']:.1f}|"
                      f"{a['rgb_replay_panel_luma_mean']:.1f}|{b['rgb_replay_panel_luma_mean']:.1f}|")
    report += ["", "RGB replay is a developed/rendered output and includes WB, CCM and gamma; use Bayer16 for the linearity fit. "
               "Full measurements, clipping, spread and file references are in `r9_analysis.json`.", ""]
    (run / "linearity_report.md").write_text("\n".join(report))
    print(f"Saved {json_out} and {run / 'linearity_report.md'}")


if __name__ == "__main__":
    main()
