#!/usr/bin/env python3
"""Resumen de la caja blanca: señal por canal, color, uniformidad, linealidad y bandas por filas (cwd = carpeta de capturas)."""
import glob, json
import cv2
import numpy as np

BLACK = 2048
CH = {"B": (0, 0), "Gb": (0, 1), "Gr": (1, 0), "R": (1, 1)}  # BGGR
load = lambda f: np.fromfile(f, np.uint16).reshape(2592, 4608).astype(np.float32)

print("== Nivel, color y uniformidad (señal = valor - 2048) ==")
for f in sorted(glob.glob("*_b16.raw")):
    a = load(f)
    s = {k: a[y::2, x::2].mean() - BLACK for k, (y, x) in CH.items()}
    g = (s["Gb"] + s["Gr"]) / 2
    j = json.load(open(f.replace("_b16.raw", ".json")))
    cen = a[1000:1600, 1900:2700].mean() - BLACK
    cor = np.mean([a[:400, :400].mean(), a[:400, -400:].mean(), a[-400:, :400].mean(), a[-400:, -400:].mean()]) - BLACK
    print(f"{f[:-8]:16s} exp={j['exposure_time_us']:>6} R={s['R']:6.0f} G={g:6.0f} B={s['B']:6.0f} "
          f"R/G={s['R']/g:.2f} B/G={s['B']/g:.2f} max={int(a.max() - BLACK):6d} esq/centro={cor/cen:.2f}")

print("\n== AWB automático ==")
for c in (0, 1):
    j = json.load(open(f"auto_cam{c}.json"))
    print(f"cam{c}: ganancias R/B={[round(x, 3) for x in j['colour_gains']]} CT={j['colour_temperature']} K "
          f"exp={j['exposure_time_us']} us lux={j.get('lux'):.0f}")

print("\n== Linealidad en el punto más brillante (razón respecto a lineal desde 2 ms) ==")
for c in (0, 1):
    ref = load(f"cam{c}_e20000_b16.raw")
    g = (ref[0::2, 1::2] + ref[1::2, 0::2]) / 2
    y, x = np.unravel_index(cv2.GaussianBlur(g, (0, 0), 60).argmax(), g.shape)
    base = {}
    for e in (2000, 5000, 10000, 20000, 40000):
        a = load(f"cam{c}_e{e}_b16.raw")
        row = []
        for k, (yy, xx) in CH.items():
            v = a[yy::2, xx::2][max(0, y - 40):y + 40, max(0, x - 40):x + 40].mean() - BLACK
            base.setdefault(k, v / e)
            row.append(f"{k}={v:6.0f}({v / (base[k] * e):.3f})")
        print(f"cam{c} e={e:>5} " + " ".join(row) + f" max={int(a.max() - BLACK)}")

print("\n== Bandas por filas (parpadeo) ==")
for c in (0, 1):
    for e in (2000, 5000):
        a = load(f"cam{c}_e{e}_b16.raw")
        g = (a[0::2, 1::2] + a[1::2, 0::2]) / 2 - BLACK
        r = g[:, 900:1400].mean(1)
        hp = (r - cv2.GaussianBlur(r.reshape(-1, 1), (1, 0), sigmaX=0.1, sigmaY=80).ravel()) / r.mean()
        spec = np.abs(np.fft.rfft(hp * np.hanning(len(hp))))[3:200]
        print(f"cam{c} e={e}: std={hp.std() * 100:.2f}% pico espectral={int(spec.argmax()) + 3} ciclos/1296 filas "
              f"({spec.max() / spec.mean():.1f}x)")
