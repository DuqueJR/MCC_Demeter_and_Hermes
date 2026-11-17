#!/usr/bin/env python3
"""Campaña 04b: respuesta dinámica del AE a pasos de luz, ambas cámaras a la vez, como en vuelo (10 fps).

Uso: run_dynamic.py <nombre> [--exposure short|normal|long] [--duration 75] [--cues 15,30,45,60]
Imprime avisos (con campana) en los instantes indicados para que se alterne la luz; el análisis detecta
los pasos reales a partir del Lux de los frames.
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "dynamic"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("--exposure", default="short", choices=["short", "normal", "long"])
    ap.add_argument("--duration", type=int, default=75)
    ap.add_argument("--cues", default="15,30,45,60")
    ap.add_argument("--fps", type=int, default=10)
    ap.add_argument("--countdown", type=int, default=8)
    args = ap.parse_args()
    cues = [int(c) for c in args.cues.split(",") if c]
    OUT.mkdir(exist_ok=True)

    for s in range(args.countdown, 0, -1):
        print(f"\a[{args.name}] empieza en {s} s: deja la LUZ ALTA", flush=True)
        time.sleep(1)

    procs = []
    t0 = time.time()
    for cam in (0, 1):
        cmd = ["rpicam-raw", "--camera", str(cam), "--width", "4608", "--height", "2592", "--framerate", str(args.fps),
               "--exposure", args.exposure, "--metering", "centre", "-t", str(args.duration * 1000),
               "--metadata", str(OUT / f"{args.name}_cam{cam}.json"), "--metadata-format", "json", "-o", "/dev/null"]
        procs.append(subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    print(f"[{args.name}] GRABANDO {args.duration} s (t=0)  luz ALTA", flush=True)

    events = []
    state = "ALTA"
    for c in cues:
        time.sleep(max(0, t0 + c - time.time()))
        state = "BAJA" if state == "ALTA" else "ALTA"
        events.append({"cue_s": c, "state": state, "wall_ns": time.time_ns()})
        print(f"\a\a[{args.name}] t={c:>3}s  >>> LUZ {state} <<<", flush=True)
    for p in procs:
        p.wait()
    (OUT / f"{args.name}_events.json").write_text(json.dumps(
        {"name": args.name, "exposure_mode": args.exposure, "duration_s": args.duration, "fps": args.fps,
         "start_wall_ns": int(t0 * 1e9), "events": events}, indent=1))
    print(f"[{args.name}] terminado. rc={[p.returncode for p in procs]}")


if __name__ == "__main__":
    sys.exit(main())
