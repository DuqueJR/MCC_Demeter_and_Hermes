#!/usr/bin/env python3
"""Comprueba si libcamera acepta lens positions negativas y si la nitidez mejora más allá de 0.0 dpt."""
import json, os, subprocess, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
import run_lens as rl
rl.OUT = Path(__file__).parent / "sweep_neg"
rl.OUT.mkdir(exist_ok=True)
for cam in (0, 1):
    for pos in (-0.3, -0.15, -0.05, 0.0, 0.05):
        name = f"cam{cam}_p{pos}"
        try:
            a, meta = rl.capture(cam, pos, name)
        except subprocess.CalledProcessError as e:
            print(f"cam{cam} pos={pos}: captura falló ({e})"); continue
        g = rl.green_plane(a)
        e, m, clip = rl.focus_grid(g)
        sel = (clip.max() == 0) & (m > 30)
        print(f"cam{cam} pedida={pos:+.2f} informada={meta.get('lens_position')} energía mediana top-30%={np.percentile(e[m>30], 70):.1f} media={e[m>30].mean():.1f}")
