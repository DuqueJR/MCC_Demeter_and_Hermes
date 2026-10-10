#!/bin/bash
# Campaña 01: frames oscuros (objetivos tapados) en una matriz exposición x ganancia por cámara.
set -euo pipefail
cd "$(dirname "$0")"
B=/home/admin/.cache/demeter_build/bin
P=/home/admin/libpisp/build/src/examples/praw2rgb
mkdir -p frames
for c in 0 1; do
  for e in 1000 10000 100000; do
    for g in 1.1228 2.0 4.0 8.0 16.0; do
      out=frames/cam${c}_e${e}_g${g}
      LIBCAMERA_LOG_LEVELS='*:ERROR' $B/capture_pisp_stats --camera $c --out $out --exposure-us $e --gain $g --settle-frames 5 >/dev/null
      LIBPISP_LOG_LEVELS='*:ERROR' $P --input-format 4608:2592:4608:PISP_COMP1 --output-format 4608:2592:9216:BAYER16 $out.raw ${out}_b16.raw >/dev/null 2>&1
      rm -f $out.raw
      echo "ok $out"
    done
  done
done
