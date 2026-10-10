#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD="${DEMETER_BUILD_DIR:-$ROOT/.build}"
SD_ROOT="${DEMETER_RECORDINGS_DIR:-/home/admin/grabaciones_raw}"
SD_DIR="$SD_ROOT/$(date +%Y%m%d_%H%M%S)"
RAM_DIR="/mnt/ramcam"
RECORDER_BIN="$BUILD/bin/demeter_rec"
POSTPROCESS="$ROOT/demeter_postprocess.py"
RAW2RGB="${PRAW2RGB:-$BUILD/libpisp-build/src/examples/praw2rgb}"
CONTROLLER_REPLAY="$BUILD/bin/controller_replay"
TUNING="${DEMETER_TUNE:-/usr/share/libcamera/ipa/rpi/pisp/imx708.json}"
TOUCHDOWN_FLAG="/tmp/touchdown_event.flag"
MAX_TIME=160

REC_PID=""
RECORDER_STATUS=0
STOP_REQUESTED=0
FLIGHT_ACTIVE=0
POSTPROCESS_STARTED=0

log() {
	printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
	log "ERROR: $*"
	exit 1
}

ingest_chunks() {
	local src base stage dest
	shopt -s nullglob
	for src in "$RAM_DIR"/chunk_*; do
		[[ -d "$src" && ! -L "$src" ]] || continue
		base=${src##*/}
		[[ "$base" =~ ^chunk_[0-9]{4,}$ ]] || continue
		dest="$SD_DIR/$base"
		stage="$SD_DIR/.${base}.incoming.$$"

		if [[ -e "$dest" ]]; then
			log "ERROR: ya existe $dest; se conserva $src en RAM"
			continue
		fi
		if ! rm -rf -- "$stage" || ! mkdir -- "$stage"; then
			log "ERROR: no se pudo preparar la copia temporal de $base"
			continue
		fi
		if rsync -a -- "$src/" "$stage/"; then
			if mv -T -- "$stage" "$dest"; then
				if rm -rf -- "$src"; then
					log "Chunk ingerido: $base"
				else
					log "ERROR: $base está en SD, pero no se pudo liberar su copia RAM"
				fi
			else
				log "ERROR: no se pudo publicar $base en SD; se conserva en RAM"
				rm -rf -- "$stage" || true
			fi
		else
			log "ERROR: rsync falló para $base; se conserva en RAM"
			rm -rf -- "$stage" || true
		fi
	done
}

stop_recorder() {
	[[ -n "$REC_PID" ]] || return 0
	if kill -0 "$REC_PID" 2>/dev/null; then
		kill -INT "$REC_PID" 2>/dev/null || true
	fi
	if wait "$REC_PID"; then
		RECORDER_STATUS=0
	else
		RECORDER_STATUS=$?
	fi
	REC_PID=""
}

launch_postprocess() {
	DEMETER_BUILD_DIR="$BUILD" PRAW2RGB="$RAW2RGB" DEMETER_TUNE="$TUNING" \
		nohup python3 "$POSTPROCESS" "$SD_DIR" \
		9>&- >>"$SD_DIR/postprocess.log" 2>&1 </dev/null &
	local pid=$!
	POSTPROCESS_STARTED=1
	if ! printf '%s\n' "$pid" >"$SD_DIR/postprocess.pid"; then
		log "AVISO: no se pudo guardar postprocess.pid"
	fi
	log "Revelado iniciado en segundo plano (PID $pid)"
}

on_exit() {
	local status=$?
	trap - EXIT INT TERM
	if [[ -n "$REC_PID" ]]; then
		stop_recorder || true
	fi
	if (( FLIGHT_ACTIVE )); then
		ingest_chunks || true
		if (( !POSTPROCESS_STARTED )); then
			launch_postprocess || true
		fi
	fi
	exit "$status"
}

trap 'STOP_REQUESTED=1' INT TERM
trap on_exit EXIT

command -v findmnt >/dev/null 2>&1 || die "falta findmnt"
command -v mountpoint >/dev/null 2>&1 || die "falta mountpoint"
command -v rsync >/dev/null 2>&1 || die "falta rsync"
command -v flock >/dev/null 2>&1 || die "falta flock"
command -v pgrep >/dev/null 2>&1 || die "falta pgrep"
command -v nohup >/dev/null 2>&1 || die "falta nohup"
command -v python3 >/dev/null 2>&1 || die "falta python3"
[[ -x "$RECORDER_BIN" ]] || die "no se puede ejecutar $RECORDER_BIN"
[[ -f "$POSTPROCESS" ]] || die "no existe $POSTPROCESS"
[[ -x "$RAW2RGB" ]] || die "no se puede ejecutar $RAW2RGB"
[[ -x "$CONTROLLER_REPLAY" ]] || die "no se puede ejecutar $CONTROLLER_REPLAY"
[[ -r "$TUNING" ]] || die "no se puede leer $TUNING"
python3 -c 'import cv2, numpy' >/dev/null 2>&1 || die "python3 necesita numpy y opencv"
[[ ! -e "$TOUCHDOWN_FLAG" ]] || die "existe un flag de touchdown anterior; revísalo y retíralo antes del vuelo"
[[ -d "$RAM_DIR" ]] || die "no existe $RAM_DIR"
mountpoint -q "$RAM_DIR" || die "$RAM_DIR no es un punto de montaje; no se limpiará"
ram_fs=$(findmnt -n -o FSTYPE --target "$RAM_DIR")
[[ "$ram_fs" == "tmpfs" ]] || die "$RAM_DIR está en $ram_fs, se requiere tmpfs"
[[ -w "$RAM_DIR" ]] || die "$RAM_DIR no es escribible por $(id -un)"

exec 9>/tmp/demeter-flight.lock
flock -n 9 || die "ya hay otro demeter_flight.sh activo"
if pgrep -x demeter_rec >/dev/null 2>&1; then
	die "ya hay un proceso demeter_rec activo fuera de este orquestador"
fi

mkdir -p "$SD_ROOT"
[[ ! -e "$SD_DIR" ]] || die "ya existe el directorio de misión $SD_DIR"
mkdir -- "$SD_DIR" || die "no se pudo crear $SD_DIR"
[[ -w "$SD_DIR" ]] || die "$SD_DIR no es escribible por $(id -un)"

find "$RAM_DIR" -xdev -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
target_tmp="$RAM_DIR/.target_fps.$$"
printf '4\n' >"$target_tmp"
mv -f -- "$target_tmp" "$RAM_DIR/target_fps.txt"

"$RECORDER_BIN" \
	--out "$RAM_DIR" \
	--chunk-time 8 \
	--target-fps-file "$RAM_DIR/target_fps.txt" \
	9>&- >>"$SD_DIR/demeter_rec.log" 2>&1 &
REC_PID=$!
FLIGHT_ACTIVE=1
start_seconds=$SECONDS
log "Misión iniciada en $SD_DIR (recorder PID $REC_PID; máximo ${MAX_TIME}s)"

while (( !STOP_REQUESTED )); do
	if [[ -e "$TOUCHDOWN_FLAG" ]]; then
		log "Evento de touchdown detectado"
		break
	fi
	if (( SECONDS - start_seconds >= MAX_TIME )); then
		log "Límite de ${MAX_TIME}s alcanzado"
		break
	fi
	if ! kill -0 "$REC_PID" 2>/dev/null; then
		log "demeter_rec terminó antes de la condición de corte"
		break
	fi
	ingest_chunks
	sleep 1
done

stop_recorder
ingest_chunks
launch_postprocess

if (( RECORDER_STATUS != 0 )); then
	log "ERROR: demeter_rec terminó con estado $RECORDER_STATUS"
	exit "$RECORDER_STATUS"
fi
log "Captura cerrada; el revelado continúa en segundo plano"