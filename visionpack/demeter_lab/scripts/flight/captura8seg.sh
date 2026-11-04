#!/bin/bash

###############################################################################
#
# CAPTURA DUAL RAW
# Raspberry Pi 5 + 2x Camera Module 3 (IMX708)
#
# Flujo:
#
#   1. Verificación sistema
#   2. Verificación RAMDisk montado
#   3. Limpieza RAMDisk
#   4. Verificación cámaras
#   5. Captura RAW sincronizada (libcamera sync)
#   6. Conteo real de frames desde logs
#   7. Ingesta mediante rsync
#   8. Verificación integridad
#   9. Conservación de logs
#   10. Liberación verificada de RAM
#   11. Generación de session.json
#   12. Inicialización telemetry.csv
#   13. Informe final
#
###############################################################################

set -euo pipefail

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

ANCHO=4608
ALTO=2592
FPS=10
DURACION_MS=10000

DIR_RAM="/mnt/ramcam"
DIR_SD="/home/admin/demeter_recording/normal_rec"

LOG_RECURSOS="/tmp/monitor_cam.log"

SESSION_ID=$(date +%Y%m%d_%H%M%S)
SESSION_DIR="$DIR_SD/$SESSION_ID"

RAW_CAM0="$DIR_RAM/cam0.raw"
RAW_CAM1="$DIR_RAM/cam1.raw"

LOG_CAM0="$DIR_RAM/cam0.log"
LOG_CAM1="$DIR_RAM/cam1.log"

OUT_CAM0="$SESSION_DIR/cam0.raw"
OUT_CAM1="$SESSION_DIR/cam1.raw"

OUT_LOG_CAM0="$SESSION_DIR/cam0.log"
OUT_LOG_CAM1="$SESSION_DIR/cam1.log"

SESSION_JSON="$SESSION_DIR/session.json"
TELEMETRY_CSV="$SESSION_DIR/telemetry.csv"

PID_CAM0=""
PID_CAM1=""
PID_MON=""

# ============================================================================
# LIMPIEZA DE EMERGENCIA
# ============================================================================

cleanup() {

    echo
    echo "=================================================="
    echo "LIMPIEZA DE EMERGENCIA"
    echo "=================================================="

    kill "$PID_CAM0" 2>/dev/null || true
    kill "$PID_CAM1" 2>/dev/null || true
    kill "$PID_MON" 2>/dev/null || true

    rm -f "$LOG_RECURSOS" 2>/dev/null || true

    echo "RAW conservados para diagnóstico."
    echo "Revisar carpeta de sesión."

    exit 1
}

trap cleanup INT TERM ERR

# ============================================================================
# PREPARACIÓN
# ============================================================================

echo "=================================================="
echo "PREPARANDO ENTORNO"
echo "=================================================="

if ! mountpoint -q "$DIR_RAM"; then
    echo "ERROR: $DIR_RAM no está montado."
    exit 1
fi

SCRIPT_START_UNIX=$(date +%s.%N)
SCRIPT_START_UTC=$(date -u +"%Y-%m-%dT%H:%M:%S.%NZ")

mkdir -p "$DIR_RAM"
mkdir -p "$SESSION_DIR"

find "$DIR_RAM" -mindepth 1 -delete 2>/dev/null || true

rm -f "$LOG_RECURSOS"

cat > "$TELEMETRY_CSV" <<EOF
timestamp,yaw,pitch,roll,lat,lon,alt
EOF

# ============================================================================
# DETECCIÓN DE CÁMARAS
# ============================================================================

echo
echo "Verificando cámaras..."

NUM_CAMS=$(rpicam-hello --list-cameras 2>/dev/null | grep -c imx708)

if [ "$NUM_CAMS" -lt 2 ]; then
    echo "ERROR: Se requieren dos IMX708."
    exit 1
fi

echo "OK: 2 cámaras detectadas"

# ============================================================================
# VERIFICACIÓN RAMDISK
# ============================================================================

RAMDISK_LIBRE=$(df --output=avail -B1 "$DIR_RAM" | tail -1)

ESPACIO_MINIMO=$((2500 * 1024 * 1024))

echo "RAM libre: $((RAMDISK_LIBRE / 1024 / 1024)) MB"

if [ "$RAMDISK_LIBRE" -lt "$ESPACIO_MINIMO" ]; then
    echo "ERROR: RAM insuficiente."
    exit 1
fi

# ============================================================================
# MONITORIZACIÓN
# ============================================================================

echo
echo "Iniciando monitorización..."

(
while true
do
    CPU=$(top -bn1 | awk '/Cpu/ {print 100-$8}')
    RAM=$(free -m | awk '/Mem:/ {print $3}')

    echo "$CPU $RAM" >> "$LOG_RECURSOS"

    sleep 1
done
) &

PID_MON=$!

# ============================================================================
# CAPTURA SINCRONIZADA
# ============================================================================

echo
echo "=================================================="
echo "CAPTURA INICIADA"
echo "=================================================="

CAPTURE_START_UNIX=$(date +%s.%N)
CAPTURE_START_UTC=$(date -u +"%Y-%m-%dT%H:%M:%S.%NZ")

nice -n -10 rpicam-raw \
    --camera 0 \
    --sync server \
    --width $ANCHO \
    --height $ALTO \
    --framerate $FPS \
    --verbose 2 \
    -t $DURACION_MS \
    -o "$RAW_CAM0" \
    > "$LOG_CAM0" 2>&1 &

PID_CAM0=$!

nice -n -10 rpicam-raw \
    --camera 1 \
    --sync client \
    --width $ANCHO \
    --height $ALTO \
    --framerate $FPS \
    --verbose 2 \
    -t $DURACION_MS \
    -o "$RAW_CAM1" \
    > "$LOG_CAM1" 2>&1 &

PID_CAM1=$!

wait "$PID_CAM0"
STATUS0=$?

wait "$PID_CAM1"
STATUS1=$?

CAPTURE_END_UNIX=$(date +%s.%N)
CAPTURE_END_UTC=$(date -u +"%Y-%m-%dT%H:%M:%S.%NZ")

kill "$PID_MON" 2>/dev/null || true

if [ "$STATUS0" -ne 0 ]; then
    echo "ERROR cámara 0"
    exit 1
fi

if [ "$STATUS1" -ne 0 ]; then
    echo "ERROR cámara 1"
    exit 1
fi

# ============================================================================
# TAMAÑOS Y FRAMES REALES
# ============================================================================

SIZE0=$(stat -c%s "$RAW_CAM0")
SIZE1=$(stat -c%s "$RAW_CAM1")

FRAMES_CAM0=$(grep -c "Viewfinder frame" "$LOG_CAM0" || true)
FRAMES_CAM1=$(grep -c "Viewfinder frame" "$LOG_CAM1" || true)

if [ "$FRAMES_CAM0" -eq 0 ] || [ "$FRAMES_CAM1" -eq 0 ]; then
    echo "ERROR: no se pudieron contar frames."
    exit 1
fi

BYTES_FRAME_CAM0=$((SIZE0 / FRAMES_CAM0))
BYTES_FRAME_CAM1=$((SIZE1 / FRAMES_CAM1))

SCRIPT_TO_CAPTURE_START=$(echo "$CAPTURE_START_UNIX - $SCRIPT_START_UNIX" | bc)

# ============================================================================
# SINCRONIZACIÓN
# ============================================================================

SYNC0=$(grep -m1 "Sync achieved" "$LOG_CAM0" || true)
SYNC1=$(grep -m1 "Sync achieved" "$LOG_CAM1" || true)

SYNC_DELTA_US=$(
grep -m1 "Sync achieved" "$LOG_CAM1" \
| grep -oE 'Difference [-0-9]+us' \
| awk '{print $2}' \
| sed 's/us//' \
|| echo "unknown"
)

# ============================================================================
# ESPACIO DESTINO
# ============================================================================

ESP_LIBRE=$(df --output=avail -B1 "$DIR_SD" | tail -1)

ESP_NECESARIO=$((SIZE0 + SIZE1))

if [ "$ESP_LIBRE" -lt "$ESP_NECESARIO" ]; then
    echo "ERROR: destino sin espacio."
    exit 1
fi

# ============================================================================
# INGESTA
# ============================================================================

echo
echo "=================================================="
echo "INGESTANDO RAW"
echo "=================================================="

rsync -a --info=progress2 "$RAW_CAM0" "$OUT_CAM0"
rsync -a --info=progress2 "$RAW_CAM1" "$OUT_CAM1"

sync

cp "$LOG_CAM0" "$OUT_LOG_CAM0"
cp "$LOG_CAM1" "$OUT_LOG_CAM1"

# ============================================================================
# VERIFICACIÓN INTEGRIDAD
# ============================================================================

DEST0=$(stat -c%s "$OUT_CAM0")
DEST1=$(stat -c%s "$OUT_CAM1")

if [ "$DEST0" -ne "$SIZE0" ] || [ "$DEST1" -ne "$SIZE1" ]; then

    echo "ERROR DE INTEGRIDAD"
    echo "RAW conservados en RAM"

    exit 1

fi

TRANSFER_OK=true

# ============================================================================
# LIBERACIÓN RAM
# ============================================================================

echo
echo "=================================================="
echo "LIBERANDO RAMDISK"
echo "=================================================="

find "$DIR_RAM" -mindepth 1 -delete

sync

REMAINING_FILES=$(find "$DIR_RAM" -mindepth 1 | wc -l)

if [ "$REMAINING_FILES" -ne 0 ]; then
    echo "ERROR: RAMDISK NO VACÍO"
    exit 1
fi

RAMDISK_CLEANUP_OK=true

# ============================================================================
# ESTADÍSTICAS
# ============================================================================

TIEMPO_TOTAL=$(echo "$CAPTURE_END_UNIX - $CAPTURE_START_UNIX" | bc)

FPS_REAL0=$(echo "scale=3; $FRAMES_CAM0 / $TIEMPO_TOTAL" | bc)
FPS_REAL1=$(echo "scale=3; $FRAMES_CAM1 / $TIEMPO_TOTAL" | bc)

MAX_CPU=$(awk '
{
if ($1 > max) max = $1
}
END {
print max+0
}
' "$LOG_RECURSOS")

MAX_RAM=$(awk '
{
if ($2 > max) max = $2
}
END {
print max+0
}
' "$LOG_RECURSOS")

rm -f "$LOG_RECURSOS"

# ============================================================================
# SESSION.JSON
# ============================================================================

cat > "$SESSION_JSON" <<EOF
{
  "session_id": "$SESSION_ID",

  "script_start_unix": "$SCRIPT_START_UNIX",
  "script_start_utc": "$SCRIPT_START_UTC",

  "capture_start_unix": "$CAPTURE_START_UNIX",
  "capture_end_unix": "$CAPTURE_END_UNIX",

  "capture_start_utc": "$CAPTURE_START_UTC",
  "capture_end_utc": "$CAPTURE_END_UTC",

  "time_script_to_capture_start_s": "$SCRIPT_TO_CAPTURE_START",

  "width": $ANCHO,
  "height": $ALTO,

  "fps_target": $FPS,
  "duration_ms": $DURACION_MS,

  "frames_cam0": $FRAMES_CAM0,
  "frames_cam1": $FRAMES_CAM1,

  "fps_real_cam0": $FPS_REAL0,
  "fps_real_cam1": $FPS_REAL1,

  "bytes_frame_cam0": $BYTES_FRAME_CAM0,
  "bytes_frame_cam1": $BYTES_FRAME_CAM1,

  "size_cam0": $SIZE0,
  "size_cam1": $SIZE1,

  "sync_delta_us": "$SYNC_DELTA_US",

  "sync_cam0": "$(echo "$SYNC0" | sed 's/"/\\"/g')",
  "sync_cam1": "$(echo "$SYNC1" | sed 's/"/\\"/g')",

  "transfer_verified": true,
  "ramdisk_cleanup_verified": true,

  "telemetry_file": "telemetry.csv"
}
EOF

# ============================================================================
# INFORME FINAL
# ============================================================================

echo
echo "=================================================="
echo "MISIÓN COMPLETADA"
echo "=================================================="

echo "Sesión                 : $SESSION_ID"
echo "Tiempo captura         : ${TIEMPO_TOTAL}s"
echo "Tiempo hasta captura   : ${SCRIPT_TO_CAPTURE_START}s"

echo
echo "CAMARA 0"
echo "Frames reales          : $FRAMES_CAM0"
echo "FPS real               : $FPS_REAL0"
echo "Bytes/frame            : $BYTES_FRAME_CAM0"
echo "RAW                    : $(numfmt --to=iec $SIZE0)"

echo
echo "CAMARA 1"
echo "Frames reales          : $FRAMES_CAM1"
echo "FPS real               : $FPS_REAL1"
echo "Bytes/frame            : $BYTES_FRAME_CAM1"
echo "RAW                    : $(numfmt --to=iec $SIZE1)"

echo
echo "RECURSOS"
echo "Pico CPU               : $MAX_CPU %"
echo "Pico RAM               : $MAX_RAM MB"

echo
echo "SINCRONIZACIÓN"
echo "Delta Sync             : ${SYNC_DELTA_US} us"

echo
echo "LOGS"
echo "$OUT_LOG_CAM0"
echo "$OUT_LOG_CAM1"

echo
echo "TELEMETRÍA"
echo "$TELEMETRY_CSV"

echo
echo "SESSION JSON"
echo "$SESSION_JSON"

echo
echo "RAW"
echo "$OUT_CAM0"
echo "$OUT_CAM1"

echo
echo "NO ERRORS FOUND AFTER TRANSFER TO SD"

echo
echo "RAMDISK CLEAN UP COMPLETED"

trap - INT TERM ERR

exit 0
