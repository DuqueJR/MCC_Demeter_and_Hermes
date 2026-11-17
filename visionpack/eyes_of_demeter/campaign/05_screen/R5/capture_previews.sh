#!/bin/bash
# Captura las previews R5 de ambas cámaras y metadata de AF/AE.
set -euo pipefail
cd "$(dirname "$0")"
for cam in 0 1; do
  rpicam-still --camera "$cam" -n -t 3000 --width 2304 --height 1296 -q 92 \
    --autofocus-mode auto --autofocus-on-capture \
    --metadata "cam${cam}_preview_latest.meta.json" --metadata-format json \
    -o "cam${cam}_preview_latest.jpg"
done
printf 'Previews: %s/cam{0,1}_preview_latest.jpg\n' "$PWD"
