#!/usr/bin/env python3
"""R6 analysis using the detected active 3:2 screen rectangle, excluding the dark room."""
import json
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent
LEVELS = sorted(p for p in ROOT.glob("level*") if p.name != "level25")
CHANNELS = {"B": (0, 0), "Gb": (0, 1), "Gr": (1, 0), "R": (1, 1)}  # BGGR
ZONES = {
    "center": (.40, .60, .40, .60), "top": (.02, .12, .40, .60),
    "bottom": (.88, .98, .40, .60), "left": (.40, .60, .02, .12),
    "right": (.40, .60, .88, .98), "top_left": (.02, .12, .02, .12),
    "top_right": (.02, .12, .88, .98), "bottom_left": (.88, .98, .02, .12),
    "bottom_right": (.88, .98, .88, .98),
}
rows = []
for folder in LEVELS:
    for cam in (0, 1):
        raw, side = folder / f"cam{cam}_b16.raw", folder / f"cam{cam}.json"
        if not raw.exists() or not side.exists():
            continue
        meta = json.loads(side.read_text())
        a = np.fromfile(raw, np.uint16).reshape(meta["height"], meta["width"]).astype(np.float32) - 2048
        planes = {k: a[y::2, x::2] for k, (y, x) in CHANNELS.items()}
        g = (planes["Gb"] + planes["Gr"]) / 2
        reference = float(np.median(g[g.shape[0]//3:2*g.shape[0]//3, g.shape[1]//3:2*g.shape[1]//3]))
        mask = (g > reference * .05).astype(np.uint8)
        count, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
        x, y, w, h, area = max(stats[1:count].tolist(), key=lambda r: r[4])
        # The laptop panel is 3:2; reject detections that are not a plausible display area.
        aspect = w / h
        if not .15 < area / g.size < .40 or not 1.35 < aspect < 1.65:
            raise RuntimeError(f"Cannot confidently segment the active display in {raw}: bbox {(x,y,w,h)}, area {area/g.size:.3f}, aspect {aspect:.3f}")
        panel = {}
        h2, w2 = h, w
        for name, (y0, y1, x0, x1) in ZONES.items():
            ys = slice(y + round(y0*h2), y + round(y1*h2))
            xs = slice(x + round(x0*w2), x + round(x1*w2))
            vals = {k: float(v[ys, xs].mean()) for k, v in planes.items()}
            green = (vals["Gb"] + vals["Gr"]) / 2
            panel[name] = {"green_dn": green, "green_norm_exp_gain": green / (meta["exposure_time_us"] * meta["analogue_gain"]), "channels_dn": vals}
        center = panel["center"]["green_dn"]
        for z in panel.values():
            z["relative_to_center_pct"] = 100 * z["green_dn"] / center
        rows.append({"level": folder.name, "camera": cam, "active_panel_bbox_green_px": [x,y,w,h],
                     "active_panel_coverage_of_frame_pct": 100*area/g.size,
                     "panel_aspect": aspect, "threshold_fraction_of_center": .05,
                     "exposure_us": meta["exposure_time_us"], "analogue_gain": meta["analogue_gain"],
                     "digital_gain": meta.get("digital_gain"), "zones": panel})
        print(f"{folder.name} cam{cam} bbox={x},{y} {w}x{h} aspect={aspect:.3f} coverage={100*area/g.size:.1f}% "
              f"exp={meta['exposure_time_us']} gain={meta['analogue_gain']:.3f}")
        for name, z in panel.items():
            print(f"  {name:12s} G={z['green_dn']:8.1f} norm={z['green_norm_exp_gain']:.5f} rel={z['relative_to_center_pct']:6.1f}%")

out = ROOT / "uniformity_active_panel_results.json"
out.write_text(json.dumps(rows, indent=2) + "\n")
