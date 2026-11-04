#!/usr/bin/env python3
"""Analiza R6: nueve regiones Bayer por cámara/nivel, normalizadas por exposición y ganancia analógica."""
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
CHANNELS = {"B": (0, 0), "Gb": (0, 1), "Gr": (1, 0), "R": (1, 1)}  # BGGR
ZONES = {
    "center": (0.40, 0.60, 0.40, 0.60),
    "top": (0.05, 0.15, 0.40, 0.60),
    "bottom": (0.85, 0.95, 0.40, 0.60),
    "left": (0.40, 0.60, 0.05, 0.15),
    "right": (0.40, 0.60, 0.85, 0.95),
    "top_left": (0.05, 0.15, 0.05, 0.15),
    "top_right": (0.05, 0.15, 0.85, 0.95),
    "bottom_left": (0.85, 0.95, 0.05, 0.15),
    "bottom_right": (0.85, 0.95, 0.85, 0.95),
}

rows = []
for level_dir in sorted(HERE.glob("level*")):
    if not level_dir.is_dir():
        continue
    level = level_dir.name
    for cam in (0, 1):
        raw = level_dir / f"cam{cam}_b16.raw"
        side = level_dir / f"cam{cam}.json"
        if not raw.exists() or not side.exists():
            continue
        meta = json.loads(side.read_text())
        a = np.fromfile(raw, np.uint16).reshape(meta["height"], meta["width"]).astype(np.float64)
        black = int(meta.get("cfe_compression_offset", 2048))
        exposure_gain = float(meta["exposure_time_us"]) * float(meta["analogue_gain"])
        channels = {k: a[y::2, x::2] - black for k, (y, x) in CHANNELS.items()}
        h, w = next(iter(channels.values())).shape
        regions = {}
        for name, (y0, y1, x0, x1) in ZONES.items():
            ys, xs = slice(int(y0 * h), int(y1 * h)), slice(int(x0 * w), int(x1 * w))
            values = {k: float(v[ys, xs].mean()) for k, v in channels.items()}
            green = (values["Gb"] + values["Gr"]) / 2
            rgb_luma = 0.2126 * values["R"] + 0.7152 * green + 0.0722 * values["B"]
            regions[name] = {"green_dn": green, "luma_dn": rgb_luma,
                             "green_per_exposure_gain": green / exposure_gain,
                             "relative_to_center_pct": None,
                             "channels_dn": values}
        center = regions["center"]["green_dn"]
        for r in regions.values():
            r["relative_to_center_pct"] = 100 * r["green_dn"] / center
        rows.append({"level": level, "camera": cam, "exposure_us": meta["exposure_time_us"],
                     "analogue_gain": meta["analogue_gain"], "digital_gain": meta.get("digital_gain"),
                     "lens_position": meta.get("lens_position"), "regions": regions})

out = HERE / "uniformity_results.json"
out.write_text(json.dumps(rows, indent=2) + "\n")
for r in rows:
    print(f"{r['level']} cam{r['camera']} exp={r['exposure_us']}us gain={r['analogue_gain']:.3f}"
          f" lens={r['lens_position']}")
    for name, z in r["regions"].items():
        print(f"  {name:12s} G={z['green_dn']:8.1f} norm={z['green_per_exposure_gain']:.5f}"
              f" rel_centro={z['relative_to_center_pct']:6.1f}%")
