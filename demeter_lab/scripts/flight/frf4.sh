#!/bin/bash
# demeter_flight_computer.sh - Arquitectura V4 (Carpetas, Checksums, Stats, Post-proc)

echo "=================================================="
echo " INICIANDO SISTEMA DE VISIÓN DEMETER (PI 5)"
echo "=================================================="

# ==========================================
# CONFIGURACIÓN Y RUTAS
# ==========================================
SESSION_ID=$(date +%Y%m%d_%H%M%S)
BASE_SD_DIR="/home/admin/grabaciones_raw"
SD_DIR="$BASE_SD_DIR/$SESSION_ID"
RAM_DIR="/mnt/ramcam"

# 🚨 PARA ENSAYO INICIAL: CAMBIAR A MAX_TIME=16 PARA MEDIR 2 CHUNKS 🚨
MAX_TIME=120
CHUNK_TIME_S=8
TOUCHDOWN_FLAG="/tmp/touchdown_event.flag"

# Nuevas configuraciones V4
CHECK_MODE="size" # Opciones: "size" o "sha256" (usar sha256 solo en laboratorio)
PROCESS_SCRIPT="/home/admin/procesar_mision.sh"

# ==========================================
# VERIFICACIONES PRE-VUELO
# ==========================================
mkdir -p "$BASE_SD_DIR"
MIN_SPACE_BYTES=$(( 4 * 1024 * 1024 * 1024 ))
AVAILABLE=$(df --output=avail -B1 "$BASE_SD_DIR" | tail -1 | tr -d ' ')

if [ -z "$AVAILABLE" ] || [ "$AVAILABLE" -lt "$MIN_SPACE_BYTES" ]; then
    echo "ERROR CRÍTICO: Espacio insuficiente en SD. Libres: $AVAILABLE bytes."
    exit 1
fi

if ! mountpoint -q "$RAM_DIR"; then
    echo "ERROR CRÍTICO: RAMDisk no montado en $RAM_DIR. Abortando."
    exit 1
fi

# ==========================================
# INICIALIZACIÓN
# ==========================================
mkdir -p "$SD_DIR"
mkdir -p "$RAM_DIR/A" "$RAM_DIR/B"

find "$RAM_DIR/A" -mindepth 1 -delete
find "$RAM_DIR/B" -mindepth 1 -delete
rm -f "$TOUCHDOWN_FLAG" "$RAM_DIR"/*.flag "$RAM_DIR"/*.count "$RAM_DIR"/*.stats

touch "$RAM_DIR/A/.free"
touch "$RAM_DIR/B/.free"
echo "0" > "$RAM_DIR/failed_chunks.count"
echo "0 0" > "$RAM_DIR/transfer.stats" # bytes_totales tiempo_total

export SD_DIR RAM_DIR CHECK_MODE

# ==========================================
# HILO CONSUMIDOR (Anclado al CORE 0)
# ==========================================
ingest_daemon() {
    local chunk_esperado=0
    local buffer_lectura="A"
    local failed_chunks=0
    
    echo "[CORE 0] Consumidor DUAL-BUFFER iniciado (Modo: $CHECK_MODE)."
    
    while true; do
        local dir_actual="$RAM_DIR/$buffer_lectura"
        local flag_ready="$dir_actual/chk_${chunk_esperado}.ready"

        if [ -f "$flag_ready" ]; then
            local chunk_fmt=$(printf "%03d" $chunk_esperado)
            local chunk_src_dir="$dir_actual/chunk_$chunk_fmt"
            local chunk_dst_dir="$SD_DIR/chunk_$chunk_fmt"
            
            echo "[CORE 0] Ingestando $chunk_src_dir hacia la SD..."
            
            if [ ! -d "$chunk_src_dir" ]; then
                echo "[CORE 0] ERROR: No se encontró la carpeta $chunk_src_dir"
                ((failed_chunks++))
                echo "$failed_chunks" > "$RAM_DIR/failed_chunks.count"
                rm -f "$flag_ready"
                touch "$dir_actual/.free"
                chunk_esperado=$((chunk_esperado + 1))
                if [ "$buffer_lectura" == "A" ]; then buffer_lectura="B"; else buffer_lectura="A"; fi
                continue
            fi
            
            # 1. Copia de toda la subcarpeta
            mkdir -p "$chunk_dst_dir"
            local tx_start=$(date +%s.%N)
            rsync -a "$chunk_src_dir/" "$chunk_dst_dir/"
            
            # 2. Volcado físico a SD
            sync
            local tx_end=$(date +%s.%N)
            
            # 3. Verificación de integridad
            local error_en_chunk=0
            local bytes_transferidos=0
            
            for file in "$chunk_src_dir"/*; do
                [ -e "$file" ] || continue
                local filename=$(basename "$file")
                local dest_file="$chunk_dst_dir/$filename"
                local size_src=$(stat -c%s "$file")
                
                if [ "$CHECK_MODE" == "sha256" ]; then
                    local hash_src=$(sha256sum "$file" | awk '{print $1}')
                    local hash_dst=$(sha256sum "$dest_file" | awk '{print $1}')
                    if [ "$hash_src" == "$hash_dst" ]; then
                        bytes_transferidos=$((bytes_transferidos + size_src))
                        rm "$file"
                    else
                        echo "  -> ERROR SHA256 en $filename"
                        error_en_chunk=1
                    fi
                else
                    local size_dst=$(stat -c%s "$dest_file")
                    if [ "$size_src" -eq "$size_dst" ] && [ "$size_src" -gt 0 ]; then
                        bytes_transferidos=$((bytes_transferidos + size_src))
                        rm "$file"
                    else
                        echo "  -> ERROR SIZE en $filename. Src: $size_src, Dst: $size_dst"
                        error_en_chunk=1
                    fi
                fi
            done
            
            # 4. Estadísticas y limpieza
            if [ "$error_en_chunk" -eq 1 ]; then
                ((failed_chunks++))
                echo "$failed_chunks" > "$RAM_DIR/failed_chunks.count"
            else
                rmdir "$chunk_src_dir" # Solo borra si quedó vacía (sin errores)
                
                local tx_time=$(awk "BEGIN {print $tx_end - $tx_start}")
                local mb_s=$(awk "BEGIN {printf \"%.2f\", ($bytes_transferidos / 1048576) / $tx_time}")
                echo "  -> OK: chunk_$chunk_fmt | $mb_s MB/s | ${tx_time}s"
                
                # Acumular stats globales
                read total_b total_t < "$RAM_DIR/transfer.stats"
                local new_total_b=$((total_b + bytes_transferidos))
                local new_total_t=$(awk "BEGIN {print $total_t + $tx_time}")
                echo "$new_total_b $new_total_t" > "$RAM_DIR/transfer.stats"
            fi
            
            rm -f "$flag_ready"
            touch "$dir_actual/.free"
            
            chunk_esperado=$((chunk_esperado + 1))
            if [ "$buffer_lectura" == "A" ]; then buffer_lectura="B"; else buffer_lectura="A"; fi
            
        else
            if [ -f "$RAM_DIR/mision_finalizada.flag" ]; then
                if [ ! -f "$RAM_DIR/A/chk_${chunk_esperado}.ready" ] && [ ! -f "$RAM_DIR/B/chk_${chunk_esperado}.ready" ]; then
                    break
                fi
            fi
            sleep 0.05
        fi
    done
}

# ==========================================
# FUNCIÓN PRODUCTOR (Anclada al CORE 1)
# ==========================================
capturar_chunk() {
    local chunk=$1
    local buffer_dir=$2
    local chunk_fmt=$(printf "%03d" $chunk)
    local chunk_dir="$buffer_dir/chunk_$chunk_fmt"
    
    local wait_start=$(date +%s)
    while [ ! -f "$buffer_dir/.free" ]; do
        local now=$(date +%s)
        if [ $((now - wait_start)) -gt 30 ]; then
            echo "[CORE 1] ERROR FATAL: Timeout esperando búfer $buffer_dir."
            local current_fails=$(cat "$RAM_DIR/failed_chunks.count")
            echo "$((current_fails + 1))" > "$RAM_DIR/failed_chunks.count"
            return 1 
        fi
        sleep 0.05
    done
    
    rm -f "$buffer_dir/.free"
    mkdir -p "$chunk_dir"
    
    echo "[MAIN->CORE 1] Capturando Chunk $chunk en $chunk_dir..."
    
    # Registro de RAM Global para la misión
    echo "--- Chunk $chunk_fmt ---" >> "$SD_DIR/mission_resource.log"
    free -m >> "$SD_DIR/mission_resource.log"
    
    # --- EJECUCIÓN DE CAPTURA ---
    # taskset -c 1 ./rpicam-raw ... --cam0 "$chunk_dir/cam0.raw" --cam1 "$chunk_dir/cam1.raw"
    taskset -c 1 sleep $CHUNK_TIME_S
    
    touch "$buffer_dir/chk_${chunk}.ready"
}

# ==========================================
# ORQUESTADOR PRINCIPAL
# ==========================================
taskset -c 0 bash -c "$(declare -f ingest_daemon); ingest_daemon" &
INGEST_PID=$!

start_time=$(date +%s)
fecha_iso_inicio=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
chunk_actual=0
buffer_escritura="A"
touchdown_detectado="false"

echo "=================================================="
echo " CAPTURA INICIADA (Máx ${MAX_TIME}s o Touchdown)"
echo "=================================================="

while true; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))

    if [ $elapsed -ge $MAX_TIME ]; then
        echo "Límite de tiempo ($MAX_TIME s) alcanzado."
        break
    fi

    if [ -f "$TOUCHDOWN_FLAG" ]; then
        echo "¡EVENTO DE TOUCHDOWN DETECTADO (Lilygo)! Cortando captura."
        touchdown_detectado="true"
        break
    fi

    capturar_chunk "$chunk_actual" "$RAM_DIR/$buffer_escritura"
    if [ $? -ne 0 ]; then
        echo "Saltando chunk $chunk_actual debido a timeout."
    fi
    
    chunk_actual=$((chunk_actual + 1))
    if [ "$buffer_escritura" == "A" ]; then buffer_escritura="B"; else buffer_escritura="A"; fi
done

# ==========================================
# CIERRE, METADATA Y POST-PROCESADO
# ==========================================
touch "$RAM_DIR/mision_finalizada.flag"
wait $INGEST_PID
fecha_iso_fin=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

final_failed_chunks=$(cat "$RAM_DIR/failed_chunks.count")
read total_bytes total_time < "$RAM_DIR/transfer.stats"
avg_mb_s=$(awk "BEGIN {if ($total_time > 0) printf \"%.2f\", ($total_bytes / 1048576) / $total_time; else print \"0.00\"}")

cat <<EOF > "$SD_DIR/mission.json"
{
  "mission_start": "$fecha_iso_inicio",
  "mission_end": "$fecha_iso_fin",
  "total_chunks": $chunk_actual,
  "chunk_time_s": $CHUNK_TIME_S,
  "failed_chunks": $final_failed_chunks,
  "touchdown_detected": $touchdown_detectado,
  "transfer_stats": {
    "total_bytes": $total_bytes,
    "total_time_s": $total_time,
    "avg_mb_s": $avg_mb_s
  }
}
EOF

echo "=================================================="
echo " MISIÓN GUARDADA EN: $SD_DIR"
echo " Velocidad media SD: $avg_mb_s MB/s"
echo "=================================================="

# Lanzar procesado asíncrono si el script existe
if [ -x "$PROCESS_SCRIPT" ]; then
    echo "Lanzando procesado en segundo plano (baja prioridad)..."
    nice -n 19 ionice -c3 "$PROCESS_SCRIPT" "$SD_DIR" &
else
    echo "Script de procesado ($PROCESS_SCRIPT) no encontrado o sin permisos de ejecución. Saltando paso."
fi
