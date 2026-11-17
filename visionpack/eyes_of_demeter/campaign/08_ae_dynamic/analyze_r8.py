#!/usr/bin/env python3
"""Analyze R8 AE response using Pi server events as timing authority and video colors as verification."""
import argparse
import csv
import json
import math
from collections import Counter
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

ROI = {0: (730, 339, 1072, 723), 1: (624, 320, 1073, 728)}
MARKERS = {"START": "magenta", "A": "blue", "B": "red", "C": "green", "END": "yellow"}


def wall_seconds(meta):
    if all(m.get("FrameWallClock") is not None for m in meta):
        wall = np.asarray([float(m["FrameWallClock"]) * 1e-9 for m in meta])
    elif all(m.get("SensorTimestamp") is not None for m in meta):
        wall = np.asarray([float(m["SensorTimestamp"]) * 1e-9 for m in meta])
    else:
        raise RuntimeError("Metadata has neither FrameWallClock nor SensorTimestamp")
    return wall - wall[0], wall[0]


def event_seconds(event):
    return datetime.fromisoformat(event["server_wall_utc"]).timestamp()


def classify(bgr, camera):
    x, y, w, h = ROI[camera]
    frame_h, frame_w = bgr.shape[:2]
    sx, sy = frame_w / 2304.0, frame_h / 1296.0
    x, y, w, h = round(x*sx), round(y*sy), round(w*sx), round(h*sy)
    x = min(max(x, 0), frame_w-1); y = min(max(y, 0), frame_h-1)
    w = min(w, frame_w-x); h = min(h, frame_h-y)
    screen = bgr[y:y+h, x:x+w]
    crop = screen[round(.25*h):round(.75*h), round(.25*w):round(.75*w)]
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    valid = hsv[:, :, 1] > 65
    chroma_share = float(valid.mean())
    if chroma_share < .35:
        marker, hue = "gray", None
    else:
        hue = float(np.median(hsv[:, :, 0][valid]))
        if hue < 20 or hue >= 172:
            marker = "red"
        elif hue < 42:
            marker = "yellow"
        elif hue < 95:
            marker = "green"
        elif hue < 137:
            marker = "blue"
        else:
            marker = "magenta"
    mean_rgb = screen.reshape(-1, 3).mean(0)[::-1]
    mean_luma = float(cv2.cvtColor(screen, cv2.COLOR_BGR2GRAY).mean())
    return {"marker": marker, "hue": hue, "chroma_share": chroma_share,
            "screen_mean_rgb": mean_rgb.tolist(), "screen_mean_luma": mean_luma}


def read_capture(folder, camera):
    metadata = json.loads((folder / f"cam{camera}_metadata.json").read_text())
    if isinstance(metadata, dict):
        metadata = metadata.get("frames", metadata.get("metadata", []))
    cap = cv2.VideoCapture(str(folder / f"cam{camera}.h264"), cv2.CAP_FFMPEG)
    if not cap.isOpened():
        raise RuntimeError(f"OpenCV cannot decode cam{camera}.h264")
    visuals = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        visuals.append(classify(frame, camera))
    cap.release()
    video_count, metadata_count = len(visuals), len(metadata)
    if abs(video_count - metadata_count) > 2:
        raise RuntimeError(f"cam{camera}: video/metadata frame counts differ too much ({video_count}/{metadata_count})")
    count = min(video_count, metadata_count)
    visuals, metadata = visuals[:count], metadata[:count]
    t, first_wall = wall_seconds(metadata)
    exposure = np.asarray([float(m.get("ExposureTime", np.nan)) * float(m.get("AnalogueGain", np.nan)) *
                           float(m.get("DigitalGain", 1.0)) for m in metadata], dtype=np.float64)
    dt = float(np.median(np.diff(t))) if count > 1 else .1
    return visuals, metadata, t, exposure, dt, first_wall, video_count, metadata_count


def align_event(event, first_wall, timestamps):
    relative = event_seconds(event) - first_wall
    idx = int(np.searchsorted(timestamps, relative))
    idx = min(max(idx, 0), len(timestamps)-1)
    if idx > 0 and abs(timestamps[idx-1] - relative) <= abs(timestamps[idx] - relative):
        idx -= 1
    return idx, float(relative - timestamps[idx])


def settling_metrics(t, exposure, screen_luma, start_idx, end_idx, final_luminance, dt, previous_gray_target=None):
    idx = np.arange(start_idx, end_idx)
    if len(idx) < 10:
        return {"frames": int(len(idx)), "warning": "fewer than 10 frames in this display level"}
    segment_time = t[idx] - t[idx[0]]
    final_mask = segment_time >= max(segment_time[-1] - 2.0, 0.0)
    target = float(np.nanmedian(exposure[idx[final_mask]]))
    ev = np.log2(np.maximum(exposure[idx], 1e-9) / max(target, 1e-9))
    pre_idx = np.where((t >= t[start_idx] - 1.0) & (t < t[start_idx]))[0]
    before = float(np.nanmedian(exposure[pre_idx])) if len(pre_idx) else float(exposure[max(0, start_idx-1)])
    step_ev = float(math.log2(target / max(before, 1e-9)))
    settle_idx = None
    for j in range(max(0, len(ev)-4)):
        if np.all(np.abs(ev[j:j+5]) <= .25):
            settle_idx = j
            break
    early = ev[segment_time < 5.0]
    direction = 1.0 if step_ev >= 0 else -1.0
    overshoot = max(0.0, float(np.nanmax(direction * early))) if len(early) else 0.0
    tail = ev[final_mask]
    return {
        "frames": int(len(idx)), "exposure_product_final_us_gain": target,
        "exposure_product_before_step_us_gain": before, "step_ev": step_ev,
        "step_ev_from_previous_gray_stable": None if previous_gray_target is None else
            float(math.log2(target / max(previous_gray_target, 1e-9))),
        "settle_to_0_25ev_s": None if settle_idx is None else float(segment_time[settle_idx]),
        "settle_to_0_25ev_frames": None if settle_idx is None else int(settle_idx),
        "overshoot_in_step_direction_ev_first_5s": overshoot,
        "frames_above_target_by_0_5ev_first_5s": int(np.sum((segment_time < 5) & (ev > .5))),
        "frames_below_target_by_0_5ev_first_5s": int(np.sum((segment_time < 5) & (ev < -.5))),
        "residual_oscillation_std_ev_last_2s": float(np.nanstd(tail)),
        "final_exposure_mad_ev_last_2s": float(np.nanmedian(np.abs(tail-np.nanmedian(tail)))),
        "video_screen_mean_luma_first_second": float(np.nanmean(screen_luma[idx[segment_time < 1.0]])),
        "video_screen_mean_luma_last_2s": float(np.nanmean(screen_luma[idx[final_mask]])),
        "level_linear_luminance": final_luminance,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dir", type=Path)
    args = parser.parse_args()
    folder = args.run_dir.resolve()
    events = [json.loads(line) for line in (folder / "events.jsonl").read_text().splitlines() if line]
    steps = [e for e in events if e.get("kind") == "stimulus_step"]
    markers_expected = {e["name"]: e for e in steps if e.get("name") in MARKERS}
    levels = [e for e in steps if e.get("mode") == "linear"]
    missing = [name for name in (*MARKERS.keys(), "IDLE") if not any(e.get("name") == name for e in steps)]
    if missing:
        raise RuntimeError(f"Incomplete stimulus; missing browser events: {missing}")

    result = {"experiment": "DEMETER R8 dynamic official AE reference", "run_dir": str(folder),
              "timing_authority": "Pi server event log; video color classification is independent verification",
              "cameras": {}}
    for camera in (0, 1):
        visuals, metadata, t, exposure, dt, first_wall, video_count, metadata_count = read_capture(folder, camera)
        aligned_markers = {}
        for name, event in markers_expected.items():
            frame, offset = align_event(event, first_wall, t)
            lo, hi = max(0, frame-3), min(len(visuals), frame+17)
            counts = Counter(v["marker"] for v in visuals[lo:hi])
            observed, n = counts.most_common(1)[0]
            aligned_markers[name] = {"event_frame": frame, "video_class_dominant_next_2s": observed,
                                     "expected_class": MARKERS[name], "visual_match": observed == MARKERS[name],
                                     "verification_confidence": n/max(hi-lo, 1), "event_to_nearest_frame_ms": offset*1000}
        aligned_sequence = [(e, *align_event(e, first_wall, t)) for e in steps]
        level_results = {}
        previous_gray_target = None
        for event, frame, residual in aligned_sequence:
            if event.get("mode") != "linear":
                continue
            event_index = next(i for i, entry in enumerate(aligned_sequence) if entry[0] is event)
            end_frame = aligned_sequence[event_index+1][1] if event_index+1 < len(aligned_sequence) else frame
            name = event["name"]
            screen_luma = np.asarray([v["screen_mean_luma"] for v in visuals], dtype=np.float64)
            metrics = settling_metrics(t, exposure, screen_luma, frame, end_frame,
                                       event.get("linear_luminance"), dt, previous_gray_target)
            previous_gray_target = metrics.get("exposure_product_final_us_gain", previous_gray_target)
            level_results[name] = {**metrics,
                                   "start_frame": frame, "end_frame_exclusive": end_frame,
                                   "event_to_nearest_frame_ms": residual*1000}

        csv_path = folder / f"cam{camera}_frames.csv"
        with csv_path.open("w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["frame_id", "FrameWallClock_ns", "SensorTimestamp_ns", "relative_s",
                             "event_step", "video_color_class", "marker_hue", "saturated_roi_fraction",
                             "screen_mean_r", "screen_mean_g", "screen_mean_b", "screen_mean_luma",
                             "ExposureTime_us", "AnalogueGain", "DigitalGain", "Lux", "AeState", "LensPosition"])
            labels = [""] * len(metadata)
            for i, (event, frame, residual) in enumerate(aligned_sequence):
                end_frame = aligned_sequence[i+1][1] if i+1 < len(aligned_sequence) else len(metadata)
                for j in range(frame, end_frame): labels[j] = event["name"]
            for i, (v, m) in enumerate(zip(visuals, metadata)):
                writer.writerow([i, m.get("FrameWallClock"), m.get("SensorTimestamp"), float(t[i]), labels[i],
                                 v["marker"], v["hue"], v["chroma_share"], *v["screen_mean_rgb"],
                                 v["screen_mean_luma"], m.get("ExposureTime"), m.get("AnalogueGain"),
                                 m.get("DigitalGain"), m.get("Lux"), m.get("AeState"), m.get("LensPosition")])

        camera_result = {"video_frames": video_count, "metadata_frames": metadata_count, "aligned_frames": len(visuals),
                         "fps": 1/dt, "event_frames": {name: value["event_frame"] for name, value in aligned_markers.items()},
                         "frame_inicio_A": aligned_markers["A"]["event_frame"],
                         "frame_inicio_B": aligned_markers["B"]["event_frame"],
                         "frame_inicio_C": aligned_markers["C"]["event_frame"],
                         "frame_fin": aligned_markers["END"]["event_frame"],
                         "marker_video_verification": aligned_markers, "levels": level_results,
                         "frame_metrics_csv": csv_path.name}
        result["cameras"][str(camera)] = camera_result
        print(f"cam{camera}: {len(visuals)} frames, {1/dt:.2f} fps; event markers=" +
              ", ".join(f"{name}@{data['event_frame']} video={data['video_class_dominant_next_2s']}"
                        for name, data in aligned_markers.items()))
        for name, metrics in level_results.items():
            print(f"  {name:7s}: step={metrics['step_ev']:+.2f} EV settle={metrics['settle_to_0_25ev_s']}s "
                  f"overshoot={metrics['overshoot_in_step_direction_ev_first_5s']:.2f}EV "
                  f"residual={metrics['residual_oscillation_std_ev_last_2s']:.3f}EV")

    result["controller_events"] = events
    out = folder / "r8_analysis.json"
    out.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
