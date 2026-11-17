#!/usr/bin/env python3
"""Analiza la respuesta del AE a pasos de luz (dynamic/<nombre>_cam{0,1}.json + _events.json).

Exposición total E = tiempo * ganancia analógica * ganancia digital. Para cada paso de luz (detectado como un
salto >25 % del Lux de los frames) se mide: magnitud en stops, frames hasta quedar a +-0.5 EV y +-0.15 EV del
valor final, sobreimpulso máximo y cuántos frames estuvieron >0.5 EV sobreexpuestos (riesgo de recorte).
"""
import glob
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent / "dynamic"
names = sys.argv[1:] or sorted({Path(f).name.rsplit("_events", 1)[0] for f in glob.glob(str(HERE / "*_events.json"))})

summary = []
for name in names:
    ev = json.loads((HERE / f"{name}_events.json").read_text())
    for cam in (0, 1):
        frames = json.loads((HERE / f"{name}_cam{cam}.json").read_text())
        t = np.array([f["SensorTimestamp"] for f in frames], float) * 1e-9
        t -= t[0]
        e = np.array([f["ExposureTime"] * f["AnalogueGain"] * f["DigitalGain"] for f in frames])
        lux = np.array([f.get("Lux", np.nan) for f in frames])
        dt = float(np.median(np.diff(t)))
        # Pasos reales: primer frame tras cada aviso cuyo Lux difiere >25 % de la mediana previa.
        cue_t = [c["cue_s"] for c in ev["events"]]
        starts = []
        for i, c in enumerate(cue_t):
            base_mask = (t > c - 4) & (t < c - 0.3)
            if base_mask.sum() < 5:
                continue
            base = np.nanmedian(lux[base_mask])
            idx = np.where((t >= c - 0.5) & (t < c + 8) & (np.abs(lux / base - 1) > 0.25))[0]
            if len(idx):
                starts.append((i, int(idx[0])))
        print(f"\n=== {name} cam{cam}  modo={ev['exposure_mode']}  frames={len(t)}  dt={dt * 1000:.0f} ms ===")
        print(" paso   magnitud  frames_a_+-0.5EV  frames_a_+-0.15EV  sobreimpulso  frames_sobreexp>0.5EV  E_final(us*g)")
        for k, (i, s) in enumerate(starts):
            end_t = cue_t[i + 1] if i + 1 < len(cue_t) else t[-1]
            fin_mask = (t > end_t - 3) & (t <= end_t - 0.3)
            if fin_mask.sum() < 5:
                continue
            e_final = np.median(e[fin_mask])
            e_before = np.median(e[(t > t[s] - 3) & (t < t[s] - 0.3)])
            stops = np.log2(e_final / e_before)
            err = np.log2(e[s:int(np.searchsorted(t, end_t - 0.3))] / e_final)
            def settle(th):
                bad = np.where(np.abs(err) > th)[0]
                return int(bad[-1] + 1) if len(bad) else 0
            over = int((err > 0.5).sum())
            overshoot = float(np.max(np.abs(err[settle(0.5):])) if settle(0.5) < len(err) else 0)
            print(f" {k + 1:>3}   {stops:+6.2f} EV   {settle(0.5):>10}   {settle(0.15):>13}   {overshoot:9.2f} EV   {over:>12}   {e_final:12.0f}")
            summary.append({"name": name, "cam": cam, "mode": ev["exposure_mode"], "step_ev": float(stops),
                            "frames_05": settle(0.5), "frames_015": settle(0.15), "over_frames": over,
                            "overshoot_ev": overshoot, "dt_s": dt})
        if not starts:
            print(" (no se detectaron pasos de luz >25 %)")
        print(f" rango de E durante la grabación: {e.min():.0f} .. {e.max():.0f}  (x{e.max() / e.min():.1f})")

(HERE / "dynamic_summary.json").write_text(json.dumps(summary, indent=1))
