---
id: C-04
estado: borrador v2 (refinado por B el 2026-10-25 con los formatos binarios exactos; lo revisa A; se congela en H0, T-S05). Adelanta T-202 (formato_log.md).
actualizado: 2026-10-25
depende_de: [firmware_vuelo, maquina_estados, protocolo_paquetes, perfiles_vuelo, constantes, C-02]
---
# C-04. Formato del log de la SD y de los archivos de replay

**Para qué:**
- que el escritor del log (B, T-201), el decodificador (A, T-203), el generador sintético (A, T-304) y el banco de replay (B, T-305) trabajen **contra el mismo formato desde el día 1**;
- que los vectores de prueba (§7) se puedan escribir **byte a byte**.

**Lo que conserva de [firmware_vuelo](../../../04_diseno/firmware_vuelo.md) §6:**
- la forma del registro, `[tipo u8][len u8][t_us u64][payload]`;
- los bloques de 16 KB;
- la preasignación del archivo;
- el buffer en PSRAM y el pretrigger;
- los nombres de los archivos.

**Lo que agrega:**
- **registros por lotes** (un registro lleva varias muestras);
- una **cabecera de bloque** con CRC, para poder recuperar el log si se corrompe;
- **el formato binario exacto de cada registro** (§3).

## 0. Reglas generales

- **Little-endian** en todo. Las estructuras van empaquetadas, sin relleno.
- **Tipos:** `u8/u16/u32/u64` sin signo; `i8/i16/i32` con signo (complemento a dos); `f32/f64` IEEE 754.
- **`version_formato` = 1.** Un cambio incompatible la sube y exige una decisión.
- **Lo que no se conoce** se escribe como NaN (`f32`/`f64`) o como el valor "sin dato" del [protocolo](../../../04_diseno/protocolo_paquetes.md) §0 (enteros).

## 1. Bloques

- El archivo es una secuencia de bloques de `LOG_BLOQUE_KB` (16 KB = 16384 B).
- **Cabecera del bloque (16 B):**

| Offset | Campo | Tipo | Contenido |
| --- | --- | --- | --- |
| 0 | `magic` | 4 B | `"EIAL"` (0x45 0x49 0x41 0x4C) |
| 4 | `version_formato` | u8 | 1 |
| 5 | `rocket_id` | u8 | 1 Demeter, 2 Hermes |
| 6 | `reservado` | u16 | 0 |
| 8 | `bloque_seq` | u32 | Contador de bloques de la sesión. **Sigue de un archivo al siguiente** cuando el log rota |
| 12 | `crc32` | u32 | **CRC-32 estándar** (polinomio 0x04C11DB7 reflejado, valor inicial y xorout 0xFFFFFFFF: el de `zlib.crc32` en Python y `esp_crc32_le` en el ESP32), calculado **sobre los bytes 16 a 16383** del bloque |

- **Ningún registro cruza el límite de un bloque.** El espacio que sobra se rellena con `0xFF`. Un byte de tipo `0xFF` significa "fin de los datos de este bloque".
- **El escritor solo escribe bloques completos.** Si se corta la energía, el último bloque queda sin escribir o con el CRC malo, y se descarta.
- **Recuperación de un log dañado:** el decodificador busca el `magic`, valida el `crc32` y salta los bloques malos, contándolos. Con `bloque_seq` informa los huecos.

## 2. Registros

```
[tipo u8][len u8][t_us u64][payload: len bytes]      tamaño total = 10 + len
```

- **`len`** es el largo del **payload** (de 0 a 255), sin contar los 10 B de la cabecera del registro.
- **`t_us`:** el instante del registro (`esp_timer`, D-019). En los lotes, es el de la **última** muestra. Las anteriores se reconstruyen hacia atrás con `periodo_ns` (firmware_vuelo §5).
- **El archivo no está ordenado por tiempo:** los registros del pretrigger (§5) se escriben después de detectar BOOST, con `t_us` anteriores. **El decodificador ordena por `t_us`** antes de exportar.
- Un decodificador **ignora los tipos que no conoce** (los salta con `len`) y los cuenta.

## 3. Tipos de registro y su payload

### 0x01 `SESION`: al abrir cada archivo (también al rotar). 197 B

| Offset | Campo | Tipo | Contenido |
| --- | --- | --- | --- |
| 0 | `version_formato` | u8 | 1 |
| 1 | `rocket_id` | u8 | `ROCKET_ID` |
| 2 | `modulo_visionpack` | u8 | `MODULO_VISIONPACK` |
| 3 | `proto_version` | u8 | `PROTO_VERSION` (2 o 3) |
| 4 | `fw_version` | u32 | Los 8 primeros dígitos hexadecimales del hash de git |
| 8 | `boot_count` | u32 | Contador de arranques (NVS) |
| 12 | `mission_id` | u32 | 0 antes de ARM |
| 16 | `archivo_idx` | u16 | 0, 1, 2… al rotar (`vuelo_000`, `vuelo_001`…) |
| 18 | `modo` | u8 | 0 = sesión de tierra (`tierra.bin`), 1 = vuelo (`vuelo_NNN.bin`), 2 = sintético (replay) |
| 19 | `opcion_buses` | u8 | 0 = B′, 1 = A′ (D-022) |
| 20 | `imu_odr_hz` | f32 | ODR configurada del LSM6DSO32 |
| 24 | `imu_escala_acc_g` | f32 | g por LSB |
| 28 | `imu_escala_gyro_dps` | f32 | °/s por LSB |
| 32 | `baro_odr_hz` | f32 | |
| 36 | `mag_odr_hz` | f32 | |
| 40 | `mag_escala_gauss` | f32 | gauss por LSB |
| 44 | `qmi_activo` | u8 | 0 en B′ (C-02 §2), 1 en A′ |
| 45 | `respaldo_hz` | f32 | La tasa de los respaldos (100 Hz) |
| 49 | `r_montaje_lsm6dso32` | 9 × f32 | Matriz 3×3, por filas, de los ejes del sensor al cuerpo (`R_MONTAJE_*`) |
| 85 | `r_montaje_mmc5983ma` | 9 × f32 | |
| 121 | `r_montaje_qmi8658` | 9 × f32 | |
| 157 | `r_montaje_mag_placa` | 9 × f32 | El magnetómetro de la placa (QMC6309 o QMC6310, DP-08) |
| 193 | `reservado` | u32 | 0 |

### 0x02 `IMU_LOTE`: n ≤ 20. Payload = 5 + 12·n

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `n` | u8 |
| 1 | `periodo_ns` | u32 (el periodo real, calibrado contra el PPS) |
| 5 + 12·i | `ax, ay, az, gx, gy, gz` | 6 × i16 **crudos, en los ejes del sensor** (la escala y `R_MONTAJE` van en `SESION`) |

### 0x03 `BARO_LOTE`: n ≤ 31. Payload = 5 + 8·n

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `n` | u8 |
| 1 | `periodo_ns` | u32 |
| 5 + 8·i | `presion_pa`, `temp_c` | 2 × f32 |

### 0x04 `MAG_LOTE` (MMC5983MA): n ≤ 20. Payload = 5 + 12·n

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `n` | u8 |
| 1 | `periodo_ns` | u32 |
| 5 + 12·i | `x, y, z` | 3 × i32 crudos, **con el offset de cero de 18 bits ya restado** (centrados en 0), en los ejes del sensor |

### 0x05 `GNSS_PVT`: 44 B. `t_us` = llegada del mensaje (copia los campos de UBX-NAV-PVT con sus mismas unidades)

| Offset | Campo | Tipo | Unidad |
| --- | --- | --- | --- |
| 0 | `itow_ms` | u32 | ms de la semana GPS |
| 4 | `fix` | u8 | 0, 2 o 3 |
| 5 | `sv` | u8 | Satélites usados |
| 6 | `flags` | u8 | bit 0 `valid_time`, bit 1 `fully_resolved`, bit 2 `gnss_fix_ok` |
| 7 | `reservado` | u8 | 0 |
| 8 | `lat_e7`, `lon_e7` | 2 × i32 | grados × 1e7 |
| 16 | `alt_msl_mm` | i32 | mm |
| 20 | `vel_n_mms`, `vel_e_mms`, `vel_d_mms` | 3 × i32 | mm/s (NED) |
| 32 | `hacc_mm`, `vacc_mm` | 2 × u32 | mm |
| 40 | `sacc_mms` | u32 | mm/s |

### 0x06 `PPS`: 12 B

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `t_us_flanco` | u64 |
| 8 | `utc_s` | u32 (segundos Unix del flanco, según el PVT) |

### 0x07 `ESTIMADOR`: 17 B, a `FSM_HZ`

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `h_agl_m`, `vz_ms`, `bias_acc`, `a_ax_g` | 4 × f32 |
| 16 | `flags` | u8: bit 0 `valido`, bit 1 baro bloqueado por la eyección (`EYECCION_BLOQUEO_BARO_MS`) |

### 0x08 `NAVEGACION`: 53 B, a 10 Hz

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `lat_deg`, `lon_deg` | 2 × f64 |
| 16 | `alt_agl_m` | f32 |
| 20 | `vel_e_ms`, `vel_n_ms`, `vel_u_ms` | 3 × f32 (ENU) |
| 32 | `q_w`, `q_x`, `q_y`, `q_z` | 4 × f32 (cuerpo → ENU) |
| 48 | `ekf_ok` | u8 |
| 49 | `innov_pos_m` | f32 |

### 0x09 `EVENTO`: 10 B (el evento de fase de [C-02](02_interfaces_firmware.md) §3)

| Offset | Campo | Tipo | Contenido |
| --- | --- | --- | --- |
| 0 | `tipo` | u8 | 0 TRANSICION · 1 EYECCION (E1) · 2 APOGEO_REGISTRADO · 3 REANUDADO · 4 COMANDO_EJECUTADO |
| 1 | `fase_anterior`, `fase_nueva` | 2 × u8 | Códigos de [maquina_estados](../../../04_diseno/maquina_estados.md) §1 |
| 3 | `transicion` | u8 | 0–13 (T0–T13); `0xFF` si no aplica |
| 4 | `causa` | u8 | 0 condición cumplida · 1 comando · 2 reanudación · 3 otra |
| 5 | `cmd_id` | u8 | Si la causa es un comando; si no, `0xFF` |
| 6 | `valor` | f32 | Apogeo en m, pico de la eyección en g, etc.; NaN si no aplica |

### 0x0A `NAV_EMITIDO` y 0x0B `STATUS_EMITIDO`

- **Payload:** los bytes exactos del paquete, tal como se transmitió o se intentó transmitir.
- **Tamaños:** NAV, 44 B; STATUS, 42 B (v2) o 46 B (v3, DP-07). `len` lo indica.

### 0x0C `PAQUETE_RX`: 3 + m B (m ≤ `PAQUETE_SLOT_MAX`)

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `rssi_dbm` | i16 |
| 2 | `snr_x4` | i8 (SNR × 4) |
| 3 | `bytes` | m B (BEACON o CMD recibidos) |

### 0x0D `PERDIDAS`: 1 + 5·k B, a 1 Hz

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `k` | u8 |
| 1 + 5·j | `id`, `valor` | u8, u32 (contador acumulado desde el arranque) |

**IDs:**

| ID | Contador |
| --- | --- |
| 0 | Muestras perdidas en la cola de fusión |
| 1 | Registros perdidos en la cola del log |
| 2 | Desbordes del FIFO de la IMU |
| 3 | Desbordes del FIFO del baro |
| 4 | Lecturas perdidas del magnetómetro |
| 5 | Veces que el buffer del log en PSRAM se llenó |
| 6 | Escrituras de la SD que tardaron más de 250 ms |
| 7 | Paquetes que no alcanzaron a salir en su slot |

Los IDs ≥ 8 se agregan sin cambiar `version_formato`.

### 0x0E `RESPALDO_LOTE`: 6 + s·n B

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `sensor` | u8: 1 QMI8658 (solo en A′), 2 BME280, 3 magnetómetro de la placa |
| 1 | `n` | u8 |
| 2 | `periodo_ns` | u32 |
| 6 + s·i | La muestra | QMI8658: 6 × i16 (s = 12, n ≤ 20) · BME280: `p_pa`, `t_c`, `hr_pct` 3 × f32 (s = 12, n ≤ 20) · magnetómetro de la placa: 3 × i16 (s = 6, n ≤ 41) |

### 0x0F `PI_UART`: 1 + m B

- `direccion` u8 (0 = recibida de la Pi, 1 = enviada a la Pi);
- la trama AA 55 completa (m B).

### 0x10 `CASA`: 8 B, a 1 Hz

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `bat_mv` | u16 |
| 2 | `bat_pct` | u8 (`0xFF` sin dato) |
| 3 | `temp_esp_c`, `temp_pi_c` | 2 × i8 (−128 si no hay dato o en Hermes) |
| 5 | `sd_libre_mb` | u16 |
| 7 | `fuente_sync` | u8 (0–3, [enlace_lora_tdma](../../../04_diseno/enlace_lora_tdma.md) §3) |

### 0x11 `CALIBRACION`: 61 B. Cada vez que cambia `calib` y en ARM (con el origen)

| Offset | Campo | Tipo |
| --- | --- | --- |
| 0 | `calib` | u8 (bitmap de [C-02](02_interfaces_firmware.md) §2) |
| 1 | `bias_giro_dps` | 3 × f32 |
| 13 | `mag_offset_gauss` | 3 × f32 |
| 25 | `mag_escala` | 3 × f32 (diagonal) |
| 37 | `ref_baro_pa` | f32 |
| 41 | `origen_lat_deg`, `origen_lon_deg` | 2 × f64 |
| 57 | `alt_origen_msl_m` | f32 |

### 0x20 `VERDAD_MUESTRA` y 0x21 `VERDAD_EVENTO`: solo en los archivos sintéticos (`modo` = 2)

- **0x20:** `h_agl_m` f32, `vz_ms` f32, `fase` u8 (9 B), a 100 Hz.
- **0x21:** `evento` u8 (0 t₀ despegue · 1 t_bo fin de la combustión · 2 t_ej eyección · 3 t_apo apogeo · 4 t_land aterrizaje), con su `t_us` en la cabecera (1 B).

### 0xFF: relleno (fin de los datos del bloque)

## 4. Tasa de escritura [inferencia, a validar en P-02]

**En vuelo** (opción B′, sin el QMI8658):

| Registro | B por registro | Registros/s | kB/s |
| --- | --- | --- | --- |
| IMU_LOTE (n = 20) | 255 | 166,5 | 42,5 |
| BARO_LOTE (n = 12, cada 50 ms) | 111 | 20 | 2,2 |
| MAG_LOTE (n = 10) | 135 | 10 | 1,4 |
| ESTIMADOR | 27 | 100 | 2,7 |
| GNSS_PVT | 54 | 10 | 0,5 |
| NAVEGACION | 63 | 10 | 0,6 |
| NAV y STATUS emitidos | 54 / 56 | 9 / 1 | 0,5 |
| RESPALDO_LOTE (BME280 y magnetómetro de la placa, n = 10) | 136 / 76 | 10 / 10 | 2,1 |
| Otros (PPS, CASA, PERDIDAS, EVENTO, PAQUETE_RX, PI_UART) | — | — | < 0,3 |
| **Total** | | | **≈ 53 kB/s** (en A′, con el QMI8658, ≈ 54,5) |

- 85 s de vuelo dan unos 4,5 MB.
- **El buffer de 512 KB** (`LOG_BUFFER_KB`) cubre unos 9,7 s de picos de la SD.

**Sesión de tierra (antes de ARM), a las tasas de tierra** (IMU a 1660 Hz; baro y magnetómetro a 50 Hz): **≈ 28 kB/s, unos 100 MB por hora** en la rampa. Cabe sin problema (`SD_MIN_LIBRE_MB` = 500).

## 5. Archivos, sesión de tierra y pretrigger

| Fase | Archivo | Qué se escribe |
| --- | --- | --- |
| BOOT, PREFLIGHT | `/S<boot_count>/tierra.bin` | **Todo, a las tasas de tierra** (DP-19): sirve para depurar las calibraciones y para P-02 |
| ARMED | `tierra.bin` | Solo lo lento: GNSS_PVT, PPS, ESTIMADOR, CASA, PERDIDAS, EVENTO, CALIBRACION, NAV y STATUS emitidos, PAQUETE_RX y PI_UART. **Lo de alta tasa** (IMU, baro, magnetómetro, respaldos), a tasa de vuelo, va solo al **anillo del pretrigger** en PSRAM (los últimos `PRETRIGGER_S`) |
| BOOST | Se abre `/M<mission_id>/vuelo_000.bin` | Primero `SESION` (`modo` = 1) y `CALIBRACION`; después **el contenido del anillo del pretrigger** (con `t_us` anteriores); luego todo en vivo |
| BOOST → LANDED | `vuelo_NNN.bin` | Todo a tasa de vuelo. **Rota** cada `LOG_ROTAR_MB`: el archivo nuevo empieza con `SESION` (`archivo_idx` + 1), y `bloque_seq` sigue |
| LANDED | Se cierra el de vuelo y se vuelve a `tierra.bin` | A tasa de tierra |

## 6. Archivos de replay

- **Formato:** los archivos de T-304 usan **este mismo formato**, con `SESION` (`modo` = 2), `CALIBRACION`, `IMU_LOTE`, `BARO_LOTE`, `MAG_LOTE`, `GNSS_PVT` y `PPS` generados desde OpenRocket más ruido, **y además** `VERDAD_MUESTRA` y `VERDAD_EVENTO`.
- **Consecuencia:** el banco de replay (T-305) lee **igual** un log real de la SD y un vuelo sintético. Con la verdad califica el resultado contra los criterios de P-03.
- **Nombres:** `datos/` no se edita ([datos/README](../../../../datos/README.md)). Los procesados van aparte, con el sufijo `_proc`, por ejemplo `tools/sintetico/salida/demeter_H135W-8_sim2_ruido1_eyeccion-antes_proc.bin`.
- **Exportación:** el decodificador (T-203) exporta a CSV y Parquet una tabla por tipo de registro, ordenada por `t_us`, con la columna `utc` calculada con los registros `PPS`.

## 7. Vectores de prueba

- **Dónde:** `tools/vectores/log/`.
- **Qué incluyen:**
  - un bloque con un registro de cada tipo, con su hex y los valores decodificados esperados;
  - un bloque con el CRC32 dañado (se salta y se cuenta);
  - un bloque con un tipo desconocido (se salta con `len`);
  - dos archivos consecutivos de una rotación (`bloque_seq` continuo y `SESION` repetida);
  - un pretrigger (registros con `t_us` anteriores después del EVENTO de BOOST, que el decodificador ordena).
- **Pasan los mismos vectores** en el codificador del firmware (Unity, `native`) y en el decodificador de Python.
