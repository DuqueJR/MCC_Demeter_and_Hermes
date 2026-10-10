#!/usr/bin/env python3
"""Analiza sweep_results.json: nivel de recorte, rodilla de linealidad y margen por canal/cámara/ganancia."""
import json
import numpy as np

BLACK, CLIP = 2048, 61440
rows = json.load(open("sweep_results.json"))
CH = ["B", "Gb", "Gr", "R"]

print("== Nivel de recorte observado (máximo del frame sobre el negro) y píxeles planos en el máximo ==")
for cam in (0, 1):
    for g in sorted({r["gain_req"] for r in rows}):
        s = [r for r in rows if r["cam"] == cam and r["gain_req"] == g]
        mx = max(r["max_file"] for r in s) - BLACK
        print(f" cam{cam} g={g:<6} max={mx}  gain_real={s[0]['gain']:.4f}  dig_gain={s[0]['digital_gain']}")

print("\n== Rodilla de linealidad (ROI brillante): señal vs exposición ajustada con los puntos <=50 % del recorte ==")
print("   rodilla = señal en la que la desviación respecto a la recta supera 1 % / 2 %; margen = recorte - rodilla")
out = {}
for cam in (0, 1):
    out[cam] = {}
    for g in sorted({r["gain_req"] for r in rows}):
        s = sorted([r for r in rows if r["cam"] == cam and r["gain_req"] == g], key=lambda r: r["exposure_us"])
        e = np.array([r["exposure_us"] for r in s], float)
        line = []
        for k in CH:
            y = np.array([r["roi"][k]["mean"] - BLACK for r in s])
            lo = y < 0.5 * CLIP
            slope = (e[lo] @ y[lo]) / (e[lo] @ e[lo])           # recta por el origen en la zona baja
            dev = y / (slope * e) - 1                              # <0 por debajo de la recta
            usable = (y < CLIP - 1) & np.isfinite(dev)
            k1 = next((y[i] for i in range(len(y)) if usable[i] and abs(dev[i]) > 0.01), None)
            k2 = next((y[i] for i in range(len(y)) if usable[i] and abs(dev[i]) > 0.02), None)
            last_ok = max((y[i] for i in range(len(y)) if usable[i] and abs(dev[i]) <= 0.01), default=float("nan"))
            out[cam].setdefault(g, {})[k] = {"slope_dn_per_us": slope, "last_linear_1pct": float(last_ok),
                                              "knee_1pct": None if k1 is None else float(k1),
                                              "knee_2pct": None if k2 is None else float(k2)}
            line.append(f"{k}: pendiente={slope:6.3f} lineal<= {last_ok:6.0f} rod1%={'-' if k1 is None else int(k1):>5}")
        print(f" cam{cam} g={g:<6} " + " | ".join(line))

print("\n== Perfil de recorte del verde en el ROI al acercarse al techo (media / p99.9 / % píxeles recortados) ==")
for cam in (0, 1):
    for g in (1.1228, 4.0):
        for r in sorted([r for r in rows if r["cam"] == cam and r["gain_req"] == g and 0.8 <= r["fraction"] <= 1.1],
                        key=lambda r: r["exposure_us"]):
            d = r["roi"]["Gb"]
            print(f" cam{cam} g={g:<6} f={r['fraction']:<4} media={d['mean'] - BLACK:6.0f} p99.9={d['p999'] - BLACK:6.0f}"
                  f" std={d['std']:6.1f} recortado={100 * d['frac_clipped']:5.1f}%")

print("\n== Cociente entre canales en el techo (señal de cada canal cuando G llega al recorte), interpolado ==")
for cam in (0, 1):
    s = sorted([r for r in rows if r["cam"] == cam and r["gain_req"] == 1.1228], key=lambda r: r["exposure_us"])
    e = np.array([r["exposure_us"] for r in s], float)
    yg = np.array([(r["roi"]["Gb"]["mean"] + r["roi"]["Gr"]["mean"]) / 2 - BLACK for r in s])
    lo = yg < 0.5 * CLIP
    e_clip = CLIP / ((e[lo] @ yg[lo]) / (e[lo] @ e[lo]))
    sig = {}
    for k in ("B", "R"):
        y = np.array([r["roi"][k]["mean"] - BLACK for r in s]); l = y < 0.5 * CLIP
        sig[k] = ((e[l] @ y[l]) / (e[l] @ e[l])) * e_clip
    print(f" cam{cam}: exposición teórica de recorte del G = {e_clip:.0f} us ; B={sig['B']:.0f} R={sig['R']:.0f} DN en ese instante")

json.dump(out, open("white_level_results.json", "w"), indent=1)
