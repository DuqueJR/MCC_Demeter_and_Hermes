#!/usr/bin/env python3
"""Analiza lens_records.json: posición óptima de lente por cámara, con estabilidad, histéresis y zonas."""
import json
from collections import defaultdict

import numpy as np

rec = json.load(open("lens_records.json"))
POS = sorted({r["pos_req"] for r in rec})
rng = np.random.default_rng(0)


def load(cam, rep, pos):
    r = next(r for r in rec if r["cam"] == cam and r["rep"] == rep and r["pos_req"] == pos)
    return np.load(f"sweep/{r['file']}")


def peak(pos, y):
    """Máximo con interpolación parabólica en log-energía alrededor del mejor punto."""
    i = int(np.argmax(y))
    if 0 < i < len(y) - 1:
        a, b, c = np.log(y[i - 1:i + 2])
        d = a - 2 * b + c
        off = 0.0 if d == 0 else 0.5 * (a - c) / d
        x = np.array(pos)
        return float(x[i] + off * (x[i + 1] - x[i] if off > 0 else x[i] - x[i - 1]))
    return float(pos[i])


print("== Deriva de imagen respecto a la primera captura de cada cámara (px en el plano verde 2304x1296) ==")
for cam in (0, 1):
    s = np.array([r["shift_px"] for r in rec if r["cam"] == cam])
    print(f" cam{cam}: |dx| máx={np.abs(s[:, 0]).max():.2f}  |dy| máx={np.abs(s[:, 1]).max():.2f}  "
          f"rms={np.sqrt((s ** 2).sum(1).mean()):.2f}  duración total={rec[-1]['t_s']} s")

print("\n== Posición real del lente informada por libcamera frente a la pedida ==")
err = max(abs(r["lens_position"] - r["pos_req"]) for r in rec if r["lens_position"] is not None)
print(f" error máximo |informada - pedida| = {err:.4f} dioptrías")

results = {}
for cam in (0, 1):
    E = np.array([[load(cam, rep, p)["energy"] for p in POS] for rep in range(3)])  # rep, pos, th, tw
    M = np.array([[load(cam, rep, p)["mean"] for p in POS] for rep in range(3)])
    C = np.array([[load(cam, rep, p)["clip"] for p in POS] for rep in range(3)])
    th, tw = E.shape[2:]
    Em = E.mean(0)                                           # pos, th, tw
    best_e = Em.max(0)
    clipped = (C.max((0, 1)) > 0.01) | (M.min((0, 1)) < 30)  # saturadas o casi negras
    rep_var = (E.max(0) - E.min(0)).max(0) / np.maximum(Em.max(0), 1e-9)  # variación entre repeticiones (ramas, viento)
    thr = np.percentile(best_e[~clipped], 60)
    keep = (best_e >= thr) & ~clipped & (rep_var < 0.5)
    print(f"\n=== Cámara {cam}: {keep.sum()} de {th * tw} zonas usadas "
          f"(descartadas: {clipped.sum()} saturadas/oscuras, {(rep_var >= 0.5).sum()} inestables) ===")

    rows = np.arange(th)
    zones = {"lejana (tercio sup.)": rows < th // 3, "media (tercio central)": (rows >= th // 3) & (rows < 2 * th // 3),
             "cercana (tercio inf.)": rows >= 2 * th // 3}
    curves = {}
    for name, mask in {"todas": np.ones(th, bool), **zones}.items():
        sel = keep & mask[:, None]
        if sel.sum() < 8:
            continue
        norm = Em[:, sel] / Em[:, sel].max(0)                # cada zona normalizada a su máximo
        curves[name] = (np.median(norm, 1), sel.sum())
    print(" pos     " + "  ".join(f"{p:>5}" for p in POS))
    for name, (y, n) in curves.items():
        print(f" {name:24s}(n={n:3d}) " + " ".join(f"{v:5.2f}" for v in y))
        print(f"   -> óptimo = {peak(POS, y):.3f} dpt")

    # Óptimo de cada zona individual y su histograma: indica si la escena es toda "infinito"
    sel = keep
    per_tile = np.array([peak(POS, Em[:, i, j]) for i, j in zip(*np.nonzero(sel))])
    counts = ", ".join(f"{p}:{(np.isclose(np.array([POS[int(np.argmax(Em[:, i, j]))] for i, j in zip(*np.nonzero(sel))]), p)).sum()}" for p in POS)
    print(f" Histograma del mejor punto por zona (pos:n) -> {counts}")
    print(f" Óptimo por zona: mediana={np.median(per_tile):.3f} P10={np.percentile(per_tile, 10):.3f} P90={np.percentile(per_tile, 90):.3f}")

    # Estabilidad por repetición y sentido del barrido
    opt_rep = []
    for rep in range(3):
        y = np.median(E[rep][:, keep] / E[rep][:, keep].max(0), 1)
        opt_rep.append(peak(POS, y))
    print(f" Óptimo por repetición (r0 asc, r1 desc, r2 asc): {[round(v, 3) for v in opt_rep]}")

    # Intervalo de confianza: remuestreo de zonas
    idx = np.nonzero(keep)
    boots = []
    for _ in range(400):
        pick = rng.integers(0, len(idx[0]), len(idx[0]))
        sel_b = (idx[0][pick], idx[1][pick])
        y = np.median(Em[:, sel_b[0], sel_b[1]] / Em[:, sel_b[0], sel_b[1]].max(0), 1)
        boots.append(peak(POS, y))
    lo, hi = np.percentile(boots, [2.5, 97.5])
    print(f" Óptimo global = {peak(POS, curves['todas'][0]):.3f} dpt  IC95% (zonas) = [{lo:.3f}, {hi:.3f}]")

    # Pérdida de nitidez frente a lens=0 y frente al óptimo
    y = curves["todas"][0]
    i0 = POS.index(0.0)
    print(f" Nitidez relativa en lens=0.0: {y[i0]:.3f} ; en el mejor muestreado ({POS[int(np.argmax(y))]}): {y.max():.3f}")
    # Ancho a media altura: tolerancia alrededor del óptimo
    half = [p for p, v in zip(POS, y) if v >= 0.9]
    print(f" Posiciones con >=90 % de la nitidez máxima: {half}")
    results[cam] = {"optimum_dpt": peak(POS, curves["todas"][0]), "ci95": [float(lo), float(hi)],
                    "per_rep": [float(v) for v in opt_rep], "curve": {str(p): float(v) for p, v in zip(POS, y)},
                    "sharp_at_0": float(y[i0]), "zones": {k: peak(POS, v[0]) for k, v in curves.items()}}

json.dump(results, open("lens_results.json", "w"), indent=1)
