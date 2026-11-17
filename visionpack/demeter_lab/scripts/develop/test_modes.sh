#!/usr/bin/env bash
set -Eeuo pipefail

LAB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_ROOT="$(cd "$LAB_ROOT/../eyes_of_demeter" && pwd)"
BUILD_DIR="${DEMETER_BUILD_DIR:-$PROJECT_ROOT/.build}"
SOURCE="$BUILD_DIR/sources/libpisp/src/examples/praw2rgb.cpp"
MESON_BUILD="$BUILD_DIR/libpisp-build"
PRAW="$MESON_BUILD/src/examples/praw2rgb"
INPUT="$LAB_ROOT/data/raw/frame_prueba2.pisp"
OUTPUT="$LAB_ROOT/data/rendered"

[[ -f "$SOURCE" ]] || { echo "Falta el source generado; ejecuta $PROJECT_ROOT/build.sh" >&2; exit 1; }
[[ -f "$INPUT" ]] || { echo "No se encuentra $INPUT" >&2; exit 1; }

ORIGINAL="$(mktemp)"
cp "$SOURCE" "$ORIGINAL"
restore_source() {
	cp "$ORIGINAL" "$SOURCE"
	if ! meson compile -C "$MESON_BUILD" src/examples/praw2rgb >/dev/null; then
		echo "No se pudo restaurar el binario praw2rgb al modo fuente original" >&2
	fi
	rm -f "$ORIGINAL"
}
trap restore_source EXIT

mkdir -p "$OUTPUT"
for MODE in 1 2 3; do
	printf '\n===============================\nPROBANDO MODO %s\n===============================\n' "$MODE"
	sed -E "s/dc\.mode *= *[0-9]+;/dc.mode = $MODE;/" "$ORIGINAL" > "$SOURCE"
	meson compile -C "$MESON_BUILD" src/examples/praw2rgb
	"$PRAW" "$INPUT" "$OUTPUT/salida_mode${MODE}.raw" \
		--input-format 4608:2592:4608:PISP_COMP1 \
		--output-format 4608:2592:9216:BAYER16
	MODE="$MODE" OUTPUT="$OUTPUT" python3 - <<'PY'
import os

import cv2
import numpy as np

width, height = 4608, 2592
mode = os.environ["MODE"]
output = os.environ["OUTPUT"]
raw = np.fromfile(f"{output}/salida_mode{mode}.raw", dtype=np.uint16).reshape(height, width)
raw8 = cv2.normalize(raw, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
rgb = cv2.cvtColor(raw8, cv2.COLOR_BAYER_BG2BGR)
cv2.imwrite(f"{output}/preview_mode{mode}.png", rgb)
print(f"preview_mode{mode}.png creado; min={raw.min()} max={raw.max()} mean={raw.mean()} std={raw.std()}")
PY
done

echo "Terminado. La fuente y el binario del build vuelven a su modo original al salir."