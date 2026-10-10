#!/usr/bin/env python3
"""Campaña 02: barrida de exposición alrededor de la saturación, por cámara y ganancia.

Cada captura se descomprime, se mide y se descarta (se conservan solo los Bayer16 de fracción 0.8 y 1.0).
Fracción = exposición / exposición estimada de saturación del verde en el punto más brillante.
"""
import json
import os
import subprocess
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE / "sweep"
BIN = Path("/home/admin/.cache/demeter_build/bin/capture_pisp_stats")
PRAW = "/home/admin/libpisp/build/src/examples/praw2rgb"
BLACK = 2048
FILE_MAX = 63488  # 61440 DN sobre el negro, medido en probe/
CH = {"B": (0, 0), "Gb": (0, 1), "Gr": (1, 0), "R": (1, 1)}  # BGGR
GAINS = [1.1228, 2.0, 4.0, 8.0]
FRACTIONS = [0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0, 1.05, 1.1, 1.25, 1.5]
KEEP = {0.8, 1.0}
E_SAT_G112 = 17600  # us, del probe: G = 3.49 DN/us en el punto más brillante
ENV = dict(os.environ, LIBCAMERA_LOG_LEVELS="*:ERROR", LIBPISP_LOG_LEVELS="*:ERROR")


def capture(cam, exposure, gain, name):
    subprocess.run([BIN, "--camera", str(cam), "--out", str(OUT / name), "--exposure-us", str(exposure),
                    "--gain", str(gain), "--settle-frames", "5"], check=True, env=ENV, stdout=subprocess.DEVNULL)
    subprocess.run([PRAW, "--input-format", "4608:2592:4608:PISP_COMP1", "--output-format", "4608:2592:9216:BAYER16",
                    str(OUT / f"{name}.raw"), str(OUT / f"{name}_b16.raw")], check=True, env=ENV,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    (OUT / f"{name}.raw").unlink()
    return np.fromfile(OUT / f"{name}_b16.raw", np.uint16).reshape(2592, 4608), json.loads((OUT / f"{name}.json").read_text())


def planes(a):
    return {k: a[y::2, x::2] for k, (y, x) in CH.items()}


def main():
    OUT.mkdir(exist_ok=True)
    results = []
    for cam in (0, 1):
        # El punto más brillante se fija con un frame sin recorte y se reutiliza en toda la cámara.
        ref, _ = capture(cam, 8000, GAINS[0], f"cam{cam}_ref")
        p = planes(ref.astype(np.float32))
        g = (p["Gb"] + p["Gr"]) / 2
        y, x = np.unravel_index(cv2.GaussianBlur(g, (0, 0), 60).argmax(), g.shape)
        roi = (slice(max(0, y - 40), y + 40), slice(max(0, x - 40), x + 40))
        centre = (slice(648 - 130, 648 + 130), slice(1152 - 230, 1152 + 230))
        print(f"cam{cam}: ROI brillante en plano ({x},{y})", flush=True)
        for gain in GAINS:
            e_sat = E_SAT_G112 * GAINS[0] / gain
            for frac in FRACTIONS:
                exposure = int(round(e_sat * frac))
                name = f"cam{cam}_g{gain}_f{frac}"
                a, meta = capture(cam, exposure, gain, name)
                row = {"cam": cam, "gain_req": gain, "fraction": frac, "exposure_req": exposure,
                       "exposure_us": meta["exposure_time_us"], "gain": meta["analogue_gain"],
                       "digital_gain": meta.get("digital_gain"), "max_file": int(a.max()),
                       "frac_at_max": float((a == a.max()).mean()), "roi": {}, "centre": {}, "clipped_pct": {}}
                for k, pl in planes(a).items():
                    r = pl[roi].astype(np.float64)
                    row["roi"][k] = {"mean": float(r.mean()), "std": float(r.std()), "p999": float(np.percentile(r, 99.9)),
                                     "max": float(r.max()), "frac_clipped": float((r >= FILE_MAX).mean())}
                    row["centre"][k] = float(pl[centre].mean())
                    row["clipped_pct"][k] = 100 * float((pl >= FILE_MAX).mean())
                results.append(row)
                print(f"cam{cam} g={gain:<6} f={frac:<4} e={row['exposure_us']:>6} "
                      + " ".join(f"{k}={row['roi'][k]['mean'] - BLACK:6.0f}" for k in CH)
                      + f" max={row['max_file'] - BLACK} clip%G={row['clipped_pct']['Gb']:.2f}", flush=True)
                if frac not in KEEP:
                    (OUT / f"{name}_b16.raw").unlink()
        (OUT / f"cam{cam}_ref_b16.raw").unlink()
    (HERE / "sweep_results.json").write_text(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
