#!/usr/bin/env python3
"""Compare white-field green shading, decoded BE ALSC gain map, and full RGB replay."""
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent / "white_dead_pixel"
ROIS = {0: (730, 335, 1071, 723), 1: (624, 316, 1072, 728)}
ZONES = {
    "center": (.40, .60, .40, .60), "top": (.02, .12, .40, .60),
    "bottom": (.88, .98, .40, .60), "left": (.40, .60, .02, .12),
    "right": (.40, .60, .88, .98), "top_left": (.02, .12, .02, .12),
    "top_right": (.02, .12, .88, .98), "bottom_left": (.88, .98, .02, .12),
    "bottom_right": (.88, .98, .88, .98),
}
summary = {}
for cam in (0, 1):
    x, y, w, h = ROIS[cam]
    meta = json.loads((ROOT / f"cam{cam}.json").read_text())
    raw = np.fromfile(ROOT / f"cam{cam}_b16.raw", np.uint16).reshape(meta["height"], meta["width"]).astype(np.float32) - 2048
    green = (raw[0::2, 1::2] + raw[1::2, 0::2]) / 2
    status = json.loads((ROOT / f"cam{cam}_replay.status.json").read_text())
    lsc_green = np.asarray(status["alsc"]["green_gain"], dtype=np.float32).reshape(32, 32)
    lsc_full = cv2.resize(lsc_green, (green.shape[1], green.shape[0]), interpolation=cv2.INTER_LINEAR)
    predicted_green = green * lsc_full
    rgb = np.fromfile(ROOT / f"cam{cam}_replay.rgb888.raw", np.uint8).reshape(meta["height"], meta["width"], 3).astype(np.float32)
    out_luma = .2126 * rgb[..., 0] + .7152 * rgb[..., 1] + .0722 * rgb[..., 2]
    result = {"panel_roi_green_plane_xywh": [x, y, w, h], "exposure_us": meta["exposure_time_us"],
              "analogue_gain": meta["analogue_gain"], "lsc_gain_range": [float(lsc_green.min()), float(lsc_green.max())],
              "lsc_gain_center": float(lsc_green[16, 16]), "zones": {}}
    for name, (y0, y1, x0, x1) in ZONES.items():
        gx = slice(x + round(x0*w), x + round(x1*w)); gy = slice(y + round(y0*h), y + round(y1*h))
        px, py = gx.start * 2, gy.start * 2
        pw, ph = gx.stop * 2 - px, gy.stop * 2 - py
        oz = out_luma[py:py+ph, px:px+pw]
        result["zones"][name] = {
            "raw_green_dn": float(green[gy, gx].mean()),
            "lsc_green_gain": float(lsc_full[gy, gx].mean()),
            "predicted_green_after_lsc": float(predicted_green[gy, gx].mean()),
            "rgb_replay_luma": float(oz.mean()),
        }
    for metric in ("raw_green_dn", "predicted_green_after_lsc", "rgb_replay_luma"):
        center = result["zones"]["center"][metric]
        for zone in result["zones"].values():
            zone[metric + "_relative_to_center_pct"] = 100 * zone[metric] / center
    summary[str(cam)] = result
    print(f"cam{cam}: LSC green gain min/center/max={lsc_green.min():.3f}/{lsc_green[16,16]:.3f}/{lsc_green.max():.3f}")
    for name, z in result["zones"].items():
        print(f"  {name:12s} raw={z['raw_green_dn'] / result['zones']['center']['raw_green_dn'] * 100:5.1f}% "
              f"pred={z['predicted_green_after_lsc_relative_to_center_pct']:5.1f}% "
              f"replayY={z['rgb_replay_luma_relative_to_center_pct']:5.1f}% "
              f"LSCg={z['lsc_green_gain']:.3f}")
    raw_crop = green[y:y+h, x:x+w]
    pred_crop = predicted_green[y:y+h, x:x+w]
    lsc_crop = lsc_full[y:y+h, x:x+w]
    for name, array in (("raw", raw_crop), ("predicted", pred_crop), ("lsc_gain", lsc_crop)):
        lo, hi = np.percentile(array, [1, 99])
        norm = np.clip((array-lo) / max(hi-lo, 1e-6) * 255, 0, 255).astype(np.uint8)
        norm = cv2.resize(norm, (600, 400), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(ROOT / f"cam{cam}_{name}_map.jpg"), cv2.applyColorMap(norm, cv2.COLORMAP_TURBO))

(ROOT / "alsc_results.json").write_text(json.dumps(summary, indent=2) + "\n")
