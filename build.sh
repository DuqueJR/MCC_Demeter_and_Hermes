#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# This file contains shell-safe pins and is intentionally sourced by this build.
# shellcheck source=dependencies.lock
source "$ROOT/dependencies.lock"

B="${DEMETER_BUILD_DIR:-$ROOT/.build}"
SOURCES="$B/sources"
LIBCAMERA_SRC="$SOURCES/libcamera"
LIBCAMERA_BUILD="$B/libcamera-build"
LIBPISP_SRC="$SOURCES/libpisp"
LIBPISP_BUILD="$B/libpisp-build"
JSON_INC="$LIBPISP_SRC/subprojects/nlohmann_json-3.12.0/single_include"

die() {
	printf 'build.sh: ERROR: %s\n' "$*" >&2
	exit 1
}

for tool in git meson ninja c++ apt-get dpkg-deb python3; do
	command -v "$tool" >/dev/null 2>&1 || die "falta la herramienta requerida: $tool"
done
[[ "$(uname -m)" == "aarch64" ]] || die "este build requiere Raspberry Pi OS/Debian arm64"

ensure_checkout() {
	local url="$1" destination="$2" revision="$3" current_origin current_revision
	if [[ ! -d "$destination/.git" ]]; then
		mkdir -p "$(dirname "$destination")"
		git clone --filter=blob:none --no-checkout "$url" "$destination"
	fi
	current_origin=$(git -C "$destination" remote get-url origin)
	[[ "$current_origin" == "$url" ]] || die "origen inesperado en $destination: $current_origin"
	current_revision=$(git -C "$destination" rev-parse HEAD 2>/dev/null || true)
	if [[ ! -f "$destination/.git/index" || "$current_revision" != "$revision" ]]; then
		[[ ! -f "$destination/.git/index" || -z "$(git -C "$destination" status --porcelain)" ]] || \
			die "$destination tiene cambios locales; respáldalos y elimina ese checkout antes de reconstruir"
		git -C "$destination" fetch --depth 1 origin "$revision"
		git -C "$destination" checkout --detach FETCH_HEAD
	fi
	[[ "$(git -C "$destination" rev-parse HEAD)" == "$revision" ]] || \
		die "no se pudo fijar $destination en $revision"
}

mkdir -p "$B/bin" "$B/packages" "$SOURCES"
ensure_checkout "$LIBCAMERA_REPOSITORY" "$LIBCAMERA_SRC" "$LIBCAMERA_COMMIT"
ensure_checkout "$LIBPISP_REPOSITORY" "$LIBPISP_SRC" "$LIBPISP_COMMIT"

# Apply the small, version-controlled Demeter example on top of pinned libpisp.
cp "$ROOT/vendor/libpisp-patch/praw2rgb.cpp" "$LIBPISP_SRC/src/examples/praw2rgb.cpp"
cp "$ROOT/vendor/libpisp-patch/examples-meson.build" "$LIBPISP_SRC/src/examples/meson.build"

HEADER="$B/libcamera-dev/usr/include/libcamera/libcamera/control_ids.h"
if [[ ! -f "$HEADER" ]]; then
	(
		cd "$B/packages"
		apt-get download "libcamera-dev=$LIBCAMERA_DEV_PACKAGE_VERSION"
	)
	shopt -s nullglob
	deb_files=("$B"/packages/libcamera-dev_*.deb)
	[[ ${#deb_files[@]} -gt 0 ]] || die "apt no descargó libcamera-dev"
	dpkg-deb -x "${deb_files[-1]}" "$B/libcamera-dev"
fi
[[ -f "$HEADER" ]] || die "no se encontró control_ids.h en libcamera-dev"

if [[ ! -f "$B/libcamera-pydeps/ply/__init__.py" ]]; then
	python3 -m pip install --disable-pip-version-check --quiet --target "$B/libcamera-pydeps" \
		"ply==$PYTHON_PLY_VERSION"
fi
export PYTHONPATH="$B/libcamera-pydeps${PYTHONPATH:+:$PYTHONPATH}"

if [[ ! -f "$LIBCAMERA_BUILD/build.ninja" ]]; then
	meson setup "$LIBCAMERA_BUILD" "$LIBCAMERA_SRC" -Dpipelines=rpi/pisp -Dipas=rpi/pisp -Dtest=false \
		-Ddocumentation=disabled -Dcam=disabled -Dqcam=disabled -Dgstreamer=disabled -Dpycamera=disabled \
		-Dudev=disabled -Dtracing=disabled -Dlibdw=disabled -Dlibunwind=disabled -Drpi-awb-nn=disabled
fi
ninja -C "$LIBCAMERA_BUILD" src/ipa/rpi/controller/librpi_ipa_controller.a \
	src/ipa/libipa/libipa.a subprojects/yaml-0.2.5/libyaml-0.a

if [[ ! -f "$LIBPISP_BUILD/build.ninja" ]]; then
	meson setup "$LIBPISP_BUILD" "$LIBPISP_SRC" -Dexamples=true -Dgstreamer=disabled
else
	meson configure "$LIBPISP_BUILD" -Dexamples=true -Dgstreamer=disabled
fi
ninja -C "$LIBPISP_BUILD" src/examples/praw2rgb src/libpisp/backend/backend_default_config.json

MULTIARCH=$(c++ -dumpmachine)
LIBS=(-L"/lib/$MULTIARCH" -Wl,-l:libcamera.so.0.7 -Wl,-l:libcamera-base.so.0.7 -pthread)

c++ -std=c++20 -O1 -DLIBCAMERA_BASE_PRIVATE \
	-I"$B/libcamera-dev/usr/include" -I"$LIBCAMERA_SRC/include" -I"$LIBCAMERA_BUILD/include" \
	-I"$JSON_INC" "$ROOT/src/capture_pisp_stats.cpp" "${LIBS[@]}" -o "$B/bin/capture_pisp_stats"

c++ -std=c++20 -O1 -DLIBCAMERA_BASE_PRIVATE \
	-I"$B/libcamera-dev/usr/include" -I"$LIBCAMERA_SRC/include" -I"$LIBCAMERA_BUILD/include" \
	-I"$JSON_INC" "$ROOT/src/demeter_rec.cpp" "${LIBS[@]}" -o "$B/bin/demeter_rec"

c++ -std=c++20 -O1 -DLIBCAMERA_BASE_PRIVATE \
	-I"$LIBCAMERA_SRC/src" -I"$LIBCAMERA_SRC/src/ipa" -I"$LIBCAMERA_SRC/include" \
	-I"$LIBCAMERA_BUILD/include" -I"$LIBPISP_SRC/src" -I"$LIBPISP_SRC/src/libpisp" \
	-I"$LIBPISP_SRC/src/helpers" -I"$JSON_INC" "$ROOT/src/controller_replay.cpp" \
	-Wl,--whole-archive "$LIBCAMERA_BUILD/src/ipa/rpi/controller/librpi_ipa_controller.a" \
	-Wl,--no-whole-archive "$LIBCAMERA_BUILD/src/ipa/libipa/libipa.a" \
	"$LIBCAMERA_BUILD/subprojects/yaml-0.2.5/libyaml-0.a" "${LIBS[@]}" \
	-L"$LIBPISP_BUILD/src" -Wl,-rpath,"$LIBPISP_BUILD/src" -lpisp -ldl -latomic \
	-o "$B/bin/controller_replay"

printf 'OK: binarios Demeter en %s/bin\n' "$B"
printf 'OK: conversor COMP1 en %s/src/examples/praw2rgb\n' "$LIBPISP_BUILD"
