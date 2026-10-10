#!/bin/bash
# demeter_flight_computer.sh - Arquitectura Productor-Consumidor Doble Búfer A/B (V2)

echo "=================================================="
echo " INICIANDO SISTEMA DE VISIÓN DEMETER (PI 5)"
echo "=================================================="

# ==========================================
# CONFIGURACIÓN Y RUTAS
# ==========================================
SESSION_ID=$(date +%Y%m%d_%H%M%S)
BASE_SD_DIR="/home/admin/demeter_recording/normal_rec"
SD_DIR="$BASE_SD_DIR/$SESSION_ID"
RAM_DIR="/mnt/ramdisk"
MAX_TIME=120
CHUNK_TIME_S=8
TOUCHDOWN_FLAG="/tmp/touchdown_event.flag"

# ==========================================
# COMPROBACIÓN DE ESPACIO SD PRE-VUELO
# ==========================================
MIN_SPACE_BYTES=$(( 4 * 1024 * 1024 * 1024 )) # 4GB mínimos
AVAILABLE=$(df --output=avail -B1 "$BASE_SD_DIR" | tail -1 | tr -d ' ')

if [ -z "$AVAILABLE" ] || [ "$AVAILABLE" -lt "$MIN_SPACE_BYTES" ]; then
    echo "ERROR CRÍTICO: Espacio insuficiente en SD. Libres: $AVAILABLE bytes."
    exit 1
fi
echo "Verificación SD superada: $AVAILABLE bytes libres."

# ==========================================
# INICIALIZACIÓN
# ==========================================
mkdir -p "$SD_DIR"
mkdir -p "$RAM_DIR/A" "$RAM_DIR/B"
rm -f "$RAM_DIR/A"/* "$RAM_DIR/B"/*
rm -f "$TOUCHDOWN_FLAG" "$RAM_DIR"/*.flag "$RAM_DIR"/*.count

# Candados iniciales y contador de fallos
touch "$RAM_DIR/A/.free"
touch "$RAM_DIR/B/.free"
echo "0" > "$RAM_DIR/failed_chunks.count"

export SD_DIR RAM_DIR

# ==========================================
# HILO CONSUMIDOR (Anclado al CORE 0)
# ==========================================
ingest_daemon() {
    local chunk_esperado=0
    local buffer_lectura="A"
    local failed_chunks=0
    
    echo "[CORE 0] Consumidor DUAL-BUFFER iniciado."
    
    while true; do
        local dir_actual="$RAM_DIR/$buffer_lectura"
        local flag_ready="$dir_actual/chk_${chunk_esperado}.ready"

        if [ -f "$flag_ready" ]; then
            echo "[CORE 0] Ingestando Chunk $chunk_esperado desde Búfer $buffer_lectura..."
            local error_en_chunk=0
            
            # 1. Copia de todos los archivos del chunk (incluye futuros JSON/CSV)
            for file in "$dir_actual"/*; do
                [ -e "$file" ] || continue
                filename=$(basename "$file")
                
                # Ignorar flags en la copia
                if [[ "$filename" == *.ready || "$filename" == .free ]]; then continue; fi
                
                dest_file="$SD_DIR/$filename"
                rsync -a "$file" "$dest_file"
            done
            
            # 2. Único volcado físico a la SD por chunk
            sync
            
            # 3. Verificación de integridad y borrado
            for file in "$dir_actual"/*; do
                [ -e "$file" ] || continue
                filename=$(basename "$file")
                if [[ "$filename" == *.ready || "$filename" == .free ]]; then continue; fi
                
                dest_file="$SD_DIR/$filename"
                size_src=$(stat -c%s "$file")
                size_dst=$(stat -c%s "$dest_file")
                
                if [ "$size_src" -eq "$size_dst" ] && [ "$size_src" -gt 0 ]; then
                    rm "$file"
                else
                    echo "  -> ERROR CRÍTICO en $filename. Src: $size_src, Dst: $size_dst"
                    error_en_chunk=1
                fi
            done
            
            if [ "$error_en_chunk" -eq 1 ]; then
                ((failed_chunks++))
                echo "$failed_chunks" > "$RAM_DIR/failed_chunks.count"
            else
                echo "  -> OK: Chunk $chunk_esperado sincronizado y verificado."
            fi
            
            # Liberar búfer
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
    echo "[CORE 0] Ingesta finalizada."
}

# ==========================================
# FUNCIÓN PRODUCTOR (Anclada al CORE 1)
# ==========================================
capturar_chunk() {
    local chunk=$1
    local buffer_dir=$2
    local timeout_ms=$((CHUNK_TIME_S * 1000))
    
    # Timeout de 30s para evitar bloqueos infinitos
    local wait_start=$(date +%s)
    while [ ! -f "$buffer_dir/.free" ]; do
        local now=$(date +%s)
        if [ $((now - wait_start)) -gt 30 ]; then
            echo "[CORE 1] ERROR FATAL: Timeout esperando búfer $buffer_dir."
            # Marcamos un fallo manual si el búfer se atascó
            local current_fails=$(cat "$RAM_DIR/failed_chunks.count")
            echo "$((current_fails + 1))" > "$RAM_DIR/failed_chunks.count"
            return 1 
        fi
        sleep 0.05
    done
    
    rm -f "$buffer_dir/.free"
    
    echo "[MAIN->CORE 1] Capturando Chunk $chunk en $buffer_dir..."
    
    # REEMPLAZO FUTURO: Tu wrapper binario que genera el chunk_000_metadata.json
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
    # Si capturar_chunk devuelve 1 (timeout), decidimos saltar al siguiente búfer
    if [ $? -ne 0 ]; then
        echo "Saltando chunk $chunk_actual debido a timeout del búfer."
    fi
    
    chunk_actual=$((chunk_actual + 1))
    if [ "$buffer_escritura" == "A" ]; then buffer_escritura="B"; else buffer_escritura="A"; fi
done

# ==========================================
# CIERRE Y METADATA DE MISIÓN
# ==========================================
echo "=================================================="
echo " MISIÓN FINALIZADA - VACIANDO BÚFERES"
echo "=================================================="

touch "$RAM_DIR/mision_finalizada.flag"
wait $INGEST_PID
fecha_iso_fin=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

final_failed_chunks=$(cat "$RAM_DIR/failed_chunks.count")

cat <<EOF > "$SD_DIR/mission.json"
{
  "mission_start": "$fecha_iso_inicio",
  "mission_end": "$fecha_iso_fin",
  "total_chunks": $chunk_actual,
  "chunk_time_s": $CHUNK_TIME_S,
  "failed_chunks": $final_failed_chunks,
  "touchdown_detected": $touchdown_detectado,
  "camera_model": "IMX708",
  "resolution": "4608x2592",
  "fps": 10
}
EOF

echo "Sistema apagado con seguridad. Misión guardada en $SD_DIR"
