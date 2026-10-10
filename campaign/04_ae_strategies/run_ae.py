#!/usr/bin/env python3
"""Campaña 04: estrategias AE sobre la escena fija (ventana, cielo nublado + tierra), ambas cámaras.

Por captura: exposición y ganancia elegidas por el AGC y métricas lineales del Bayer16 (plano verde):
- clip: % de píxeles >= 98 % del techo (61440 sobre el negro)
- q98/q50/mean: cuantiles y media como fracción del techo
- dark: % de píxeles bajo el 2 % del techo (ruido de lectura ~1.5 % a ganancia 1.12)
"""
import json
import os
import subprocess
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BUILD = Path(os.environ.get("DEMETER_BUILD_DIR", ROOT / ".build"))
OUT = HERE / "scene"
BIN = BUILD / "bin/capture_pisp_stats"
PRAW = BUILD / "libpisp-build/src/examples/praw2rgb"
CEIL = 61440.0
ENV = dict(os.environ, LIBCAMERA_LOG_LEVELS="*:ERROR", LIBPISP_LOG_LEVELS="*:ERROR")
REPEATS = 2
SETTLE = 40


def cfg(exposure_mode="short", metering="centre-weighted", constraint="highlight", ev=0.0):
    return {"exposure": {"mode": "auto", "exposure_mode": exposure_mode, "metering": metering,
                         "constraint": constraint, "ev": ev},
            "white_balance": {"mode": "auto"}, "focus": {"mode": "manual", "lens_position": 0.0}}


CONFIGS = {}
for constraint in ("normal", "highlight", "shadows"):
    for metering in ("centre-weighted", "matrix", "spot"):
        CONFIGS[f"short_{metering}_{constraint}_ev0"] = cfg("short", metering, constraint)
for mode in ("normal", "long"):
    CONFIGS[f"{mode}_centre-weighted_highlight_ev0"] = cfg(mode, "centre-weighted", "highlight")
for ev in (-1.0, -0.5, 0.5, 1.0):
    CONFIGS[f"short_centre-weighted_highlight_ev{ev:+.1f}"] = cfg("short", "centre-weighted", "highlight", ev)


def capture(cam, name, config):
    cfg_path = OUT / f"{name}_cfg.json"
    cfg_path.write_text(json.dumps(config))
    subprocess.run([BIN, "--camera", str(cam), "--out", str(OUT / name), "--config", str(cfg_path),
                    "--settle-frames", str(SETTLE)], check=True, env=ENV, stdout=subprocess.DEVNULL)
    subprocess.run([PRAW, "--input-format", "4608:2592:4608:PISP_COMP1", "--output-format", "4608:2592:9216:BAYER16",
                    str(OUT / f"{name}.raw"), str(OUT / f"{name}_b16.raw")], check=True, env=ENV,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    a = np.fromfile(OUT / f"{name}_b16.raw", np.uint16).reshape(2592, 4608).astype(np.float32) - 2048
    meta = json.loads((OUT / f"{name}.json").read_text())
    for suffix in (".raw", "_b16.raw", "_cfg.json", ".pisp_stats.bin"):
        (OUT / f"{name}{suffix}").unlink()
    return a, meta


def metrics(a):
    g = ((a[0::2, 1::2] + a[1::2, 0::2]) / 2).ravel() / CEIL
    r = a[1::2, 1::2].ravel() / CEIL
    b = a[0::2, 0::2].ravel() / CEIL
    hist, _ = np.histogram(np.clip(g, 0, 1), bins=64, range=(0, 1))
    return {"clip_g_pct": 100 * float((g >= 0.98).mean()), "clip_any_pct": 100 * float(((g >= 0.98) | (r >= 0.98) | (b >= 0.98)).mean()),
            "q50": float(np.percentile(g, 50)), "q98": float(np.percentile(g, 98)), "q999": float(np.percentile(g, 99.9)),
            "mean": float(g.mean()), "dark_pct": 100 * float((g < 0.02).mean()), "q02": float(np.percentile(g, 2)),
            "hist64": hist.tolist()}


def main():
    OUT.mkdir(exist_ok=True)
    results = []
    for rep in range(REPEATS):
        for cam in (0, 1):
            for name, config in CONFIGS.items():
                a, meta = capture(cam, f"cam{cam}_r{rep}_{name}", config)
                m = metrics(a)
                results.append({"cam": cam, "rep": rep, "config": name, "exposure_us": meta["exposure_time_us"],
                                "gain": meta["analogue_gain"], "lux": meta.get("lux"), **m})
                print(f"cam{cam} r{rep} {name:42s} exp={meta['exposure_time_us']:>6} g={meta['analogue_gain']:.2f} "
                      f"mean={m['mean']:.3f} q98={m['q98']:.3f} clip={m['clip_g_pct']:5.2f}% dark={m['dark_pct']:5.2f}%", flush=True)
    (HERE / "ae_results.json").write_text(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
