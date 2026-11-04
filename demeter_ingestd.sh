#!/usr/bin/env bash
# Supervisor de I/O y consumidor del "Leaky Bucket" de chunks en tmpfs.
# Ingiere chunks cerrados a SD mientras demeter_rec captura en segundo plano;
# al cerrar la captura, drena pendientes y lanza el postprocesamiento.
set -Eeuo pipefail
umask 027

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD="${DEMETER_BUILD_DIR:-$ROOT/.build}"
CAPTURE_PROFILE="${DEMETER_CAPTURE_PROFILE:-$ROOT/profiles/vuelo_infinito.json}"
SD_ROOT="${DEMETER_RECORDINGS_DIR:-/home/admin/demeter_recording/scientific_rec/raw}"
MISSION_ID="${DEMETER_MISSION_ID:-$(date +%Y%m%d_%H%M%S)}"
SD_DIR="$SD_ROOT/$MISSION_ID"
RAM_DIR="/mnt/ramcam"
RECORDER_BIN="$BUILD/bin/demeter_rec"
POSTPROCESS="$ROOT/demeter_postprocess.py"
RAW2RGB="${PRAW2RGB:-$BUILD/libpisp-build/src/examples/praw2rgb}"
CONTROLLER_REPLAY="$BUILD/bin/controller_replay"
TUNING="${DEMETER_TUNE:-/usr/share/libcamera/ipa/rpi/pisp/imx708.json}"
TOUCHDOWN_FLAG="/tmp/touchdown_event.flag"
MISSION_EVENT_SOCKET="${DEMETER_EVENT_SOCKET:-/tmp/demeter/mission.sock}"
MAX_TIME="${DEMETER_MAX_TIME:-95}"
CHUNK_TIME="${DEMETER_CHUNK_TIME:-8}"
MAX_TARGET_FPS="${DEMETER_MAX_TARGET_FPS:-2}"

REC_PID=""
POSTPROCESS_PID=""
RECORDER_STATUS=0
POSTPROCESS_STATUS=0
STOP_REQUESTED=0
FLIGHT_ACTIVE=0
POSTPROCESS_STARTED=0
INGEST_PID=""
INGEST_STOP_FILE=""
REC_START_SECONDS=0
RECORDER_FAILURE_REASON=""

log() {
	printf '[%s] demeter_ingestd pid=%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$$" "$*"
}

die() {
	log "ERROR: $*"
	exit 1
}

awk -v value="$MAX_TIME" 'BEGIN { exit !(value > 0 && value == value) }' || die "DEMETER_MAX_TIME debe ser positivo"
awk -v value="$CHUNK_TIME" 'BEGIN { exit !(value > 0 && value == value) }' || die "DEMETER_CHUNK_TIME debe ser positivo"
[[ "$MAX_TARGET_FPS" =~ ^([1-9]|10)$ ]] || die "DEMETER_MAX_TARGET_FPS debe estar entre 1 y 10"

emit_mission_event() {
	local payload="$1"
	if ! python3 -c 'import socket,sys; s=socket.socket(socket.AF_UNIX,socket.SOCK_DGRAM); s.sendto(sys.argv[2].encode(),sys.argv[1]); s.close()' \
		"$MISSION_EVENT_SOCKET" "$payload"; then
		log "ERROR: no se pudo enviar evento local a missiond socket=$MISSION_EVENT_SOCKET"
	fi
}

		emit_chunk_failure() {
			local chunk="$1" phase="$2" exit_code="$3" event
			printf -v event '{"kind":"chunk_transfer_failed","source":"demeter_ingestd","chunk":"%s","phase":"%s","exit_code":%s}' \
				"$chunk" "$phase" "$exit_code"
			emit_mission_event "$event"
		}

		ingest_chunks() {
			local src base stage dest command_status had_errors=0 source_bytes copy_started_ns transfer_elapsed_s write_rate source_removed cleanup_status event
			shopt -s nullglob
			for src in "$RAM_DIR"/chunk_*; do
				[[ -d "$src" && ! -L "$src" ]] || continue
				base=${src##*/}
				[[ "$base" =~ ^chunk_[0-9]{4,}$ ]] || continue
				dest="$SD_DIR/$base"
				stage="$SD_DIR/.${base}.incoming.$$"

				if [[ -e "$dest" ]]; then
					log "ERROR: ya existe $dest; se conserva $src en RAM"
					emit_chunk_failure "$base" "destination_exists" 17
					had_errors=1
					continue
				fi
				if rm -rf -- "$stage"; then
					:
				else
					command_status=$?
					log "ERROR: no se pudo limpiar stage para $base (rm exit=$command_status)"
					emit_chunk_failure "$base" "stage_cleanup" "$command_status"
					had_errors=1
					continue
				fi
				if mkdir -- "$stage"; then
					:
				else
					command_status=$?
					log "ERROR: no se pudo crear stage para $base (mkdir exit=$command_status)"
					emit_chunk_failure "$base" "stage_create" "$command_status"
					had_errors=1
					continue
				fi
				if source_bytes=$(du -sb -- "$src" | awk 'NR == 1 { print $1 }') && [[ "$source_bytes" =~ ^[0-9]+$ ]]; then
					:
				else
					command_status=$?
					log "ERROR: no se pudo medir chunk=$base antes de copiar (exit=$command_status)"
					emit_chunk_failure "$base" "measure_source" "$command_status"
					had_errors=1
					continue
				fi
				copy_started_ns=$(date +%s%N)
				if rsync -a -- "$src/" "$stage/" && sync -f -- "$stage"; then
					if mv -T -- "$stage" "$dest"; then
						transfer_elapsed_s=$(LC_ALL=C awk -v start="$copy_started_ns" -v end="$(date +%s%N)" \
							'BEGIN { elapsed = (end - start) / 1000000000; if (elapsed <= 0) elapsed = 0.000001; printf "%.6f", elapsed }')
						write_rate=$(LC_ALL=C awk -v bytes="$source_bytes" -v seconds="$transfer_elapsed_s" \
							'BEGIN { printf "%.3f", bytes / seconds / 1048576 }')
						source_removed=true
						cleanup_status=0
						if rm -rf -- "$src"; then
							log "Chunk ingerido: $base"
						else
							cleanup_status=$?
							source_removed=false
							log "ERROR: no se pudo liberar copia RAM de $base (rm exit=$cleanup_status)"
							had_errors=1
						fi
						printf -v event '{"kind":"chunk_ingested","source":"demeter_ingestd","chunk":"%s","source_removed":%s,"metrics":{"sd_ingest_write_bytes":%s,"sd_ingest_write_mib_s":%s,"transfer_elapsed_s":%s,"io_basis":"rsync desde tmpfs a SD; sync -f completado"}}' \
							"$base" "$source_removed" "$source_bytes" "$write_rate" "$transfer_elapsed_s"
						emit_mission_event "$event"
						if (( cleanup_status != 0 )); then
							emit_chunk_failure "$base" "source_cleanup" "$cleanup_status"
						fi
					else
						command_status=$?
						log "ERROR: no se pudo publicar $base en SD (mv exit=$command_status); se conserva en RAM"
						emit_chunk_failure "$base" "publish" "$command_status"
						had_errors=1
						if rm -rf -- "$stage"; then
							:
						else
							cleanup_status=$?
							log "ERROR: tampoco se pudo limpiar stage $stage (rm exit=$cleanup_status)"
							emit_chunk_failure "$base" "stage_cleanup" "$cleanup_status"
						fi
					fi
				else
					command_status=$?
					log "ERROR: rsync/sync falló para $base (exit=$command_status); se conserva en RAM"
					emit_chunk_failure "$base" "rsync_or_sync" "$command_status"
					had_errors=1
					if rm -rf -- "$stage"; then
						:
					else
						cleanup_status=$?
						log "ERROR: no se pudo limpiar stage $stage (rm exit=$cleanup_status)"
						emit_chunk_failure "$base" "stage_cleanup" "$cleanup_status"
					fi
				fi
			done
	return "$had_errors"
}

ingest_worker() {
	trap - EXIT INT TERM
	while [[ ! -e "$INGEST_STOP_FILE" ]]; do
		ingest_chunks || log "AVISO: ingesta con errores; se reintentará tras terminar la copia actual"
		sleep 0.25
	done
}

stop_ingest_worker() {
	[[ -n "$INGEST_PID" ]] || return 0
	: >"$INGEST_STOP_FILE"
	local status=0
	if wait "$INGEST_PID"; then
		status=0
	else
		status=$?
	fi
	INGEST_PID=""
	rm -f -- "$INGEST_STOP_FILE"
	return "$status"
}

stop_recorder() {
	local event command_status
	[[ -n "$REC_PID" ]] || return 0
	if kill -0 "$REC_PID" 2>/dev/null; then
		if kill -INT "$REC_PID" 2>/dev/null; then
			:
		else
			command_status=$?
			log "AVISO: no se pudo enviar SIGINT a demeter_rec PID $REC_PID (kill exit=$command_status)"
		fi
	fi
	if wait "$REC_PID"; then
		RECORDER_STATUS=0
	else
		RECORDER_STATUS=$?
	fi
	local duration_s=$((SECONDS - REC_START_SECONDS))
	if (( RECORDER_STATUS != 0 )); then
		if grep -Fq "No space left on device" "$SD_DIR/demeter_rec.log"; then
			RECORDER_FAILURE_REASON="tmpfs_enospc"
			log "AVISO: demeter_rec agotó el tmpfs (exit=$RECORDER_STATUS); se procesarán los chunks íntegros"
		else
			RECORDER_FAILURE_REASON="recorder_exit_${RECORDER_STATUS}"
			log "ERROR: demeter_rec PID $REC_PID terminó con exit=$RECORDER_STATUS; log=$SD_DIR/demeter_rec.log"
		fi
	fi
	printf -v event '{"kind":"process_complete","source":"demeter_ingestd","process":"demeter_rec","exit_code":%s,"elapsed_s":%s,"failure_reason":"%s"}' \
		"$RECORDER_STATUS" "$duration_s" "$RECORDER_FAILURE_REASON"
	emit_mission_event "$event"
	REC_PID=""
}

launch_postprocess() {
	DEMETER_BUILD_DIR="$BUILD" PRAW2RGB="$RAW2RGB" DEMETER_TUNE="$TUNING" \
		nohup python3 "$POSTPROCESS" "$SD_DIR" \
		9>&- >>"$SD_DIR/postprocess.log" 2>&1 </dev/null &
	local pid=$!
	POSTPROCESS_PID="$pid"
	POSTPROCESS_STARTED=1
	printf -v event '{"kind":"process_started","source":"demeter_ingestd","process":"demeter_postprocess","pid":%s}' "$pid"
	emit_mission_event "$event"
	if ! printf '%s\n' "$pid" >"$SD_DIR/postprocess.pid"; then
		log "AVISO: no se pudo guardar postprocess.pid"
	fi
	log "Revelado iniciado en segundo plano (PID $pid)"
}

wait_postprocess() {
	[[ -n "$POSTPROCESS_PID" ]] || return 0
	local status=0
	if wait "$POSTPROCESS_PID"; then
		status=0
	else
		status=$?
	fi
	POSTPROCESS_STATUS="$status"
	if (( status != 0 )); then
		log "ERROR: postproceso PID $POSTPROCESS_PID terminó con exit=$status; log=$SD_DIR/postprocess.log"
	fi
	POSTPROCESS_PID=""
	return "$status"
}

persist_telemetry() {
	local source="$RAM_DIR/telemetry.jsonl"
	local command_status
	[[ -f "$source" && -n "$SD_DIR" && -d "$SD_DIR" ]] || return 0
	local temporary="$SD_DIR/.telemetry.jsonl.$$"
	if cp -- "$source" "$temporary"; then
		:
	else
		command_status=$?
		log "ERROR: cp telemetry.jsonl falló (exit=$command_status; origen=$source destino=$temporary)"
		rm -f -- "$temporary"
		return 1
	fi
	if mv -f -- "$temporary" "$SD_DIR/telemetry.jsonl"; then
		log "Telemetría persistida en $SD_DIR/telemetry.jsonl"
	else
		command_status=$?
		log "ERROR: publicar telemetry.jsonl falló (exit=$command_status; destino=$SD_DIR/telemetry.jsonl)"
		rm -f -- "$temporary"
		return 1
	fi
}

on_exit() {
	local status=$?
	trap - EXIT INT TERM
	if (( status != 0 )); then
		log "ERROR: salida del supervisor exit=$status"
	fi
	if [[ -n "$REC_PID" ]]; then
		stop_recorder || true
	fi
	if (( FLIGHT_ACTIVE )); then
		stop_ingest_worker || true
		if ! ingest_chunks; then
			log "ERROR: una o más chunks no se pudieron ingerir durante limpieza"
			(( status != 0 )) || status=1
		fi
		rm -rf "$RAM_DIR"/.chunk_*_tmp 2>/dev/null || true
		if ! persist_telemetry; then
			log "ERROR: persistencia de telemetría falló durante limpieza"
			(( status != 0 )) || status=1
		fi
		if (( !POSTPROCESS_STARTED )); then
			if ! launch_postprocess; then
				log "ERROR: no se pudo iniciar postproceso durante limpieza"
				(( status != 0 )) || status=1
			fi
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
python3 -c 'import cv2, numpy' || die "python3 no pudo cargar numpy y opencv"
[[ -x "$RECORDER_BIN" ]] || die "no se puede ejecutar $RECORDER_BIN"
[[ -f "$POSTPROCESS" ]] || die "no existe $POSTPROCESS"
[[ -x "$RAW2RGB" ]] || die "no se puede ejecutar $RAW2RGB"
[[ -x "$CONTROLLER_REPLAY" ]] || die "no se puede ejecutar $CONTROLLER_REPLAY"
[[ -r "$TUNING" ]] || die "no se puede leer $TUNING"
[[ -r "$CAPTURE_PROFILE" ]] || die "no se puede leer el perfil de captura $CAPTURE_PROFILE"
"$RECORDER_BIN" --config "$CAPTURE_PROFILE" --check-config >/dev/null || die "perfil de captura inválido: $CAPTURE_PROFILE"
MIN_MEM_AVAILABLE_KB=1572864
if ! mem_available_kb=$(awk '$1 == "MemAvailable:" { print $2; exit }' /proc/meminfo); then
	die "no se pudo leer MemAvailable en /proc/meminfo"
fi
[[ "$mem_available_kb" =~ ^[0-9]+$ ]] || die "MemAvailable inválido en /proc/meminfo: ${mem_available_kb:-vacío}"
(( mem_available_kb > MIN_MEM_AVAILABLE_KB )) || \
	die "RAM física insuficiente: MemAvailable=${mem_available_kb} kB; se requieren > ${MIN_MEM_AVAILABLE_KB} kB (1.5 GiB)"
[[ ! -e "$TOUCHDOWN_FLAG" ]] || die "existe un flag de touchdown anterior; revísalo y retíralo antes del vuelo"
[[ -d "$RAM_DIR" ]] || die "no existe $RAM_DIR"
mountpoint -q "$RAM_DIR" || die "$RAM_DIR no es un punto de montaje; no se limpiará"
ram_fs=$(findmnt -n -o FSTYPE --target "$RAM_DIR")
[[ "$ram_fs" == "tmpfs" ]] || die "$RAM_DIR está en $ram_fs, se requiere tmpfs"
[[ -w "$RAM_DIR" ]] || die "$RAM_DIR no es escribible por $(id -un)"

exec 9>/tmp/demeter-flight.lock
flock -n 9 || die "ya hay otro demeter_ingestd.sh activo"
if pgrep -x demeter_rec >/dev/null 2>&1; then
	die "ya hay un proceso demeter_rec activo fuera de este orquestador"
fi

mkdir -p "$SD_ROOT"
[[ ! -e "$SD_DIR" ]] || die "ya existe el directorio de misión $SD_DIR"
mkdir -- "$SD_DIR" || die "no se pudo crear $SD_DIR"
[[ -w "$SD_DIR" ]] || die "$SD_DIR no es escribible por $(id -un)"
printf -v event '{"kind":"mission_started","source":"demeter_ingestd","mission_id":"%s","mission_dir":"%s"}' \
	"$MISSION_ID" "$SD_DIR"
emit_mission_event "$event"

INGEST_STOP_FILE="$RAM_DIR/.ingest_stop.$$"
rm -f -- "$INGEST_STOP_FILE"

rm -rf "$RAM_DIR"/* 2>/dev/null || true
target_fps=4
if [[ -r "$RAM_DIR/target_fps.txt" ]]; then
	read -r candidate_fps <"$RAM_DIR/target_fps.txt" || candidate_fps=""
	if [[ "$candidate_fps" =~ ^([1-9]|10)$ ]]; then
		target_fps="$candidate_fps"
	fi
fi
target_tmp="$RAM_DIR/.target_fps.$$"
printf '%s\n' "$target_fps" >"$target_tmp"
mv -f -- "$target_tmp" "$RAM_DIR/target_fps.txt"

"$RECORDER_BIN" \
	--config "$CAPTURE_PROFILE" \
	--out "$RAM_DIR" \
	--chunk-time "$CHUNK_TIME" \
	--max-target-fps "$MAX_TARGET_FPS" \
	--target-fps-file "$RAM_DIR/target_fps.txt" \
	9>&- >>"$SD_DIR/demeter_rec.log" 2>&1 &
REC_PID=$!
REC_START_SECONDS=$SECONDS
printf -v event '{"kind":"process_started","source":"demeter_ingestd","process":"demeter_rec","pid":%s,"max_target_fps":%s}' \
	"$REC_PID" "$MAX_TARGET_FPS"
emit_mission_event "$event"
FLIGHT_ACTIVE=1
start_seconds=$SECONDS
log "Misión iniciada en $SD_DIR (recorder PID $REC_PID; máximo ${MAX_TIME}s)"

(ingest_worker) &
INGEST_PID=$!

while (( !STOP_REQUESTED )); do
	if [[ -e "$TOUCHDOWN_FLAG" ]]; then
		log "Evento de touchdown detectado"
		break
	fi
	if awk -v elapsed="$((SECONDS - start_seconds))" -v maximum="$MAX_TIME" 'BEGIN { exit !(elapsed >= maximum) }'; then
		log "Límite de ${MAX_TIME}s alcanzado"
		break
	fi
	if ! kill -0 "$REC_PID" 2>/dev/null; then
		log "demeter_rec terminó antes de la condición de corte"
		break
	fi
	sleep 0.25
done

stop_recorder
stop_ingest_worker || log "AVISO: el worker de ingesta terminó con error; se hará drenaje final"
ingest_chunks || log "ERROR: quedaron chunks pendientes de ingestión"
persist_telemetry
launch_postprocess

if [[ "${DEMETER_WAIT_POSTPROCESS:-0}" == "1" ]]; then
	wait_postprocess || die "el postproceso terminó con error"
fi

if (( RECORDER_STATUS != 0 )); then
	if [[ "$RECORDER_FAILURE_REASON" == "tmpfs_enospc" && "${DEMETER_WAIT_POSTPROCESS:-0}" == "1" && "$POSTPROCESS_STATUS" == "0" ]]; then
		log "AVISO: misión degradada por tmpfs lleno; postprocesamiento completado correctamente"
	else
		log "ERROR: demeter_rec terminó con estado $RECORDER_STATUS"
		exit "$RECORDER_STATUS"
	fi
fi
log "Captura cerrada; el revelado continúa en segundo plano"