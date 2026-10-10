#!/bin/bash
# Verifica las condiciones de la caja blanca: auto + barrida de exposición en ambas cámaras.
set -euo pipefail
cd "$(dirname "$0")"
OUT=${1:-probe}
B=/home/admin/.cache/demeter_build/bin
P=/home/admin/libpisp/build/src/examples/praw2rgb
mkdir -p "$OUT" && cd "$OUT"
echo '{"exposure":{"mode":"auto"},"white_balance":{"mode":"auto"},"focus":{"mode":"infinity"}}' > auto.json
for c in 0 1; do
  LIBCAMERA_LOG_LEVELS='*:ERROR' $B/capture_pisp_stats --camera $c --out auto_cam$c --config auto.json --settle-frames 40 >/dev/null
  for e in 2000 5000 10000 20000 40000; do
    LIBCAMERA_LOG_LEVELS='*:ERROR' $B/capture_pisp_stats --camera $c --out cam${c}_e$e --exposure-us $e --gain 1.1228 --settle-frames 5 >/dev/null
  done
  for o in auto_cam$c cam${c}_e2000 cam${c}_e5000 cam${c}_e10000 cam${c}_e20000 cam${c}_e40000; do
    LIBPISP_LOG_LEVELS='*:ERROR' $P --input-format 4608:2592:4608:PISP_COMP1 --output-format 4608:2592:9216:BAYER16 $o.raw ${o}_b16.raw >/dev/null 2>&1
  done
done
python3 ../analyze_probe.py
