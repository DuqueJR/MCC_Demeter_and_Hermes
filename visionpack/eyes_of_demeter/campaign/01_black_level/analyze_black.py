#!/usr/bin/env python3
"""Analiza los oscuros: black level por canal Bayer, ruido, uniformidad y dependencia de ganancia/exposición."""
import glob, json, re
import numpy as np

CH = {"B": (0, 0), "Gb": (0, 1), "Gr": (1, 0), "R": (1, 1)}  # BGGR
rows = []
for path in sorted(glob.glob("frames/*_b16.raw")):
    cam, e, g = re.search(r"cam(\d)_e(\d+)_g([\d.]+)_b16", path).groups()
    a = np.fromfile(path, np.uint16).reshape(2592, 4608)
    r = {"cam": int(cam), "exposure_us": int(e), "gain": float(g), "all_mean": float(a.mean())}
    for k, (y, x) in CH.items():
        p = a[y::2, x::2].astype(np.float64)
        r[k] = {"mean": float(p.mean()), "std": float(p.std()), "median": float(np.median(p)),
                "hot": int((p > np.median(p) + 8 * p.std()).sum()),
                "quad_means": [float(p[:648, :1152].mean()), float(p[:648, 1152:].mean()),
                               float(p[648:, :1152].mean()), float(p[648:, 1152:].mean())]}
    rows.append(r)
json.dump(rows, open("black_level_results.json", "w"), indent=1)

for cam in (0, 1):
    print(f"\n=== Cámara {cam} ===")
    sel = [r for r in rows if r["cam"] == cam]
    print("exp_us  gain   " + "  ".join(f"{k:>7}" for k in CH) + "   std(R)  hot")
    for r in sel:
        print(f"{r['exposure_us']:>6} {r['gain']:>6} " + "  ".join(f"{r[k]['mean']:7.2f}" for k in CH)
              + f"  {r['R']['std']:6.2f} {sum(r[k]['hot'] for k in CH):5d}")
    base = [r for r in sel if r["gain"] == 1.1228 and r["exposure_us"] == 10000][0]
    sp = max(max(q) - min(q) for r in sel for k in CH for q in [r[k]["quad_means"]])
    print("Gradiente máx entre cuadrantes (DN):", round(sp, 2))
    for k in CH:
        m = [r[k]["mean"] for r in sel]
        print(f"  {k}: media global {np.mean(m):.2f}  rango {min(m):.2f}..{max(m):.2f}")
