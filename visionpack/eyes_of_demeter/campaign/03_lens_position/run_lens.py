#!/usr/bin/env python3
"""Campaña 03: barrido de posición de lente (dioptrías) con exposición fija, 3 repeticiones, ambas cámaras.

Guarda por captura una rejilla de métrica de foco 20x36 (tiles de 64 px del plano verde 2304x1296) y el desplazamiento
de imagen respecto a la primera captura de la cámara, para reanalizar zonas sin conservar los Bayer16.
"""
import json
import os
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BUILD = Path(os.environ.get("DEMETER_BUILD_DIR", ROOT / ".build"))
OUT = HERE / "sweep"
BIN = BUILD / "bin/capture_pisp_stats"
PRAW = BUILD / "libpisp-build/src/examples/praw2rgb"
POSITIONS = [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.25, 1.5, 2.0]
EXPOSURE_US = {0: 430, 1: 640}  # ~2x la exposición automática de la vista previa
GAIN = 1.1228
SETTLE = 15  # frames para que el lente termine de moverse
REPEATS = 3
TILE = 64
ENV = dict(os.environ, LIBCAMERA_LOG_LEVELS="*:ERROR", LIBPISP_LOG_LEVELS="*:ERROR")


def capture(cam, pos, name):
    cfg = OUT / f"{name}_cfg.json"
    cfg.write_text(json.dumps({"white_balance": {"mode": "auto"}, "focus": {"mode": "manual", "lens_position": pos}}))
    subprocess.run([BIN, "--camera", str(cam), "--out", str(OUT / name), "--config", str(cfg), "--exposure-us",
                    str(EXPOSURE_US[cam]), "--gain", str(GAIN), "--settle-frames", str(SETTLE)],
                   check=True, env=ENV, stdout=subprocess.DEVNULL)
    subprocess.run([PRAW, "--input-format", "4608:2592:4608:PISP_COMP1", "--output-format", "4608:2592:9216:BAYER16",
                    str(OUT / f"{name}.raw"), str(OUT / f"{name}_b16.raw")], check=True, env=ENV,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    a = np.fromfile(OUT / f"{name}_b16.raw", np.uint16).reshape(2592, 4608).astype(np.float32) - 2048
    for suffix in (".raw", "_b16.raw", "_cfg.json", ".pisp_stats.bin"):
        (OUT / f"{name}{suffix}").unlink()
    return a, json.loads((OUT / f"{name}.json").read_text())


def green_plane(a):
    # Bayer BGGR: media de los dos verdes = plano 2304x1296 con el mismo campo que la vista previa.
    return (a[0::2, 1::2] + a[1::2, 0::2]) / 2


def focus_grid(g):
    h, w = g.shape
    sx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    sy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    energy = sx * sx + sy * sy
    th, tw = h // TILE, w // TILE
    e = energy[:th * TILE, :tw * TILE].reshape(th, TILE, tw, TILE).mean((1, 3))
    m = g[:th * TILE, :tw * TILE].reshape(th, TILE, tw, TILE).mean((1, 3))
    clip = (g[:th * TILE, :tw * TILE] >= 60000).reshape(th, TILE, tw, TILE).mean((1, 3))
    return e, m, clip


def main():
    OUT.mkdir(exist_ok=True)
    records, ref = [], {}
    t0 = time.time()
    for rep in range(REPEATS):
        order = POSITIONS if rep % 2 == 0 else POSITIONS[::-1]  # alterna sentido para ver histéresis
        for cam in (0, 1):
            for pos in order:
                name = f"cam{cam}_r{rep}_p{pos}"
                a, meta = capture(cam, pos, name)
                g = green_plane(a)
                e, m, clip = focus_grid(g)
                small = cv2.resize(cv2.GaussianBlur(g, (0, 0), 2), (576, 324), interpolation=cv2.INTER_AREA)
                small = (small / max(small.max(), 1)).astype(np.float32)
                shift = (0.0, 0.0)
                if cam not in ref:
                    ref[cam] = small
                else:
                    (dx, dy), _ = cv2.phaseCorrelate(ref[cam], small)
                    shift = (dx * 4, dy * 4)  # en píxeles del plano verde
                np.savez_compressed(OUT / f"{name}.npz", energy=e, mean=m, clip=clip)
                records.append({"cam": cam, "rep": rep, "pos_req": pos, "lens_position": meta.get("lens_position"),
                                "af_state": meta.get("af_state"), "exposure_us": meta["exposure_time_us"],
                                "gain": meta["analogue_gain"], "shift_px": shift, "file": f"{name}.npz",
                                "t_s": round(time.time() - t0)})
                print(f"cam{cam} r{rep} p={pos:<5} lens={meta.get('lens_position')} exp={meta['exposure_time_us']} "
                      f"shift=({shift[0]:+.1f},{shift[1]:+.1f}) t={records[-1]['t_s']}s", flush=True)
    (HERE / "lens_records.json").write_text(json.dumps(records, indent=1))


if __name__ == "__main__":
    main()
