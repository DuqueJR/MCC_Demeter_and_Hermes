---
id: C-04
estado: borrador (lo redacta B y lo revisa A; se congela en H0, T-S05). Adelanta T-202 (formato_log.md).
actualizado: 2026-10-25
depende_de: [firmware_vuelo, maquina_estados, protocolo_paquetes, perfiles_vuelo, constantes]
---
# C-04. Formato del log de la SD y de los archivos de replay

**Para qué:**
- que el escritor del log (B, T-201), el decodificador (A, T-203), el generador sintético (A, T-304) y el banco de replay (B, T-305) trabajen **contra el mismo formato desde el día 1**;
- recalcular la tasa de escritura con tamaños reales (el punto de control vio unos 80 kB/s frente a los 55 kB/s del documento).

**Lo que conserva de [firmware_vuelo](../../../04_diseno/firmware_vuelo.md) §6:**
- la forma del registro, `[tipo u8][len u8][t_us u64][payload]`;
- los bloques de 16 KB;
- la preasignación del archivo;
- el buffer en PSRAM y el pretrigger;
- los nombres de los archivos.

**Lo que agrega:**
- **registros por lotes** (un registro lleva varias muestras);
- una **cabecera de bloque** para poder recuperar el log si se corrompe.

## 1. Bloques

- El archivo es una secuencia de bloques de `LOG_BLOQUE_KB` (16 KB).
- Cada bloque empieza con **16 B de cabecera:**
  - `magic` "EIAL" (4 B);
  - `version_formato` u8;
  - `rocket_id` u8;
  - reservado (2 B);
  - `bloque_seq` u32;
  - `crc32` u32 del resto del bloque.
- **Ningún registro cruza el límite de un bloque.** El espacio sobrante se rellena con `0xFF`; un tipo `0xFF` significa "fin de los datos del bloque".
- **Cómo se recupera un log dañado:** el decodificador busca el `magic`, valida el `crc32` y salta los bloques dañados, contándolos.

## 2. Tipos de registro

- `t_us`: el instante de la **última** muestra del lote (firmware_vuelo §5).
- Las muestras anteriores se reconstruyen hacia atrás con `periodo_ns`.
- Todo en little-endian.

| Tipo | Nombre | Payload | Tasa típica en vuelo |
| --- | --- | --- | --- |
| 0x01 | `SESION` | `version_formato`, `ROCKET_ID`, `MODULO_VISIONPACK`, versión (hash de git), `boot_count`, `mission_id`, rangos y escalas de cada sensor, ODR, `R_MONTAJE` de cada sensor, calibraciones (bias del giro, magnetómetro), referencia barométrica. Si no cabe en 255 B, se divide en partes con un índice | Al abrir el archivo |
| 0x02 | `IMU_LOTE` | `n` u8 · `periodo_ns` u32 · n × (ax, ay, az, gx, gy, gz) i16 **crudos**. Con 255 B de payload, **n ≤ 20** | 3330 / 20 ≈ 167 por segundo |
| 0x03 | `BARO_LOTE` | `n` u8 · `periodo_ns` u32 · n × (presión en Pa float32, temperatura en °C float32). **n ≤ 31** | 240 / 12 = 20 por segundo (n = 12, cada 50 ms) |
| 0x04 | `MAG_LOTE` | `n` u8 · `periodo_ns` u32 · n × (x, y, z) i32 crudos. **n ≤ 20** | 100 / 10 = 10 por segundo |
| 0x05 | `GNSS_PVT` | Los campos del PVT de [C-02](02_interfaces_firmware.md) §5 (unos 48 B) | 10 por segundo |
| 0x06 | `PPS` | `t_us_flanco` u64 · `utc_s` u32 | 1 por segundo |
| 0x07 | `ESTIMADOR` | `h_agl_m`, `vz_ms`, `bias`, `a_ax_g` float32 · `flags` u8 | 100 por segundo (`FSM_HZ`) |
| 0x08 | `NAVEGACION` | lat, lon (float64), alt, vel ENU (float32), q (4 × float32), `ekf_ok` | 10 por segundo |
| 0x09 | `EVENTO` | Los campos del evento de fase de [C-02](02_interfaces_firmware.md) §3 | Por evento |
| 0x0A | `NAV_EMITIDO` | Los 44 B del NAV transmitido (o el que se intentó transmitir) | ≈ 9 por segundo |
| 0x0B | `STATUS_EMITIDO` | Los 42 B del STATUS (o su nuevo tamaño con DP-07) | 1 por segundo |
| 0x0C | `PAQUETE_RX` | `rssi` i16 · `snr4` i8 · bytes LoRa recibidos | Por paquete |
| 0x0D | `PERDIDAS` | Contadores de cada cola y de los desbordes de cada FIFO | 1 por segundo |
| 0x0E | `RESPALDO_LOTE` | `sensor` u8 (QMI8658, BME280, QMC6309) · `n` · `periodo_ns` · muestras | 100 Hz por sensor, en lotes |
| 0x0F | `PI_UART` | La trama AA 55 recibida o enviada, más un byte de dirección | Por trama |
| 0x10 | `CASA` | `bat_mv`, `bat_pct`, `temp_esp_c`, `sd_libre_mb` | 1 por segundo |
| 0x20 | `VERDAD` | **Solo en los archivos sintéticos:** h, vz y los tiempos verdaderos de los eventos (t₀, t_bo, t_ej, t_apo, t_land) | 100 por segundo |
| 0xFF | Relleno | — | — |

**Nota:** firmware_vuelo §6 nombraba un tipo "acel+giro". Aquí se convierte en `IMU_LOTE`; el resto de los tipos de §6 tienen su equivalente.

## 3. Tasa de escritura recalculada [inferencia, a validar en P-02]

| Registro | B por registro | Registros/s | kB/s |
| --- | --- | --- | --- |
| IMU_LOTE (n = 20) | 10 + 5 + 240 = 255 | 167 | 42,6 |
| BARO_LOTE (n = 12) | 10 + 5 + 96 = 111 | 20 | 2,2 |
| MAG_LOTE (n = 10) | 10 + 5 + 120 = 135 | 10 | 1,4 |
| GNSS_PVT | unos 58 | 10 | 0,6 |
| ESTIMADOR | 27 | 100 | 2,7 |
| NAVEGACION | unos 55 | 10 | 0,6 |
| NAV y STATUS emitidos | 54 / 52 | 9 / 1 | 0,5 |
| RESPALDO_LOTE (3 sensores) | unos 135 | unos 15 | 2,0 |
| Otros | — | — | < 1 |
| **Total** | | | **≈ 53 kB/s** (más un 0,1 % de cabeceras de bloque) |

- **Coincide con los ~55 kB/s** de firmware_vuelo §6 **gracias a los lotes.** Con un registro por muestra serían unos 80 kB/s.
- **85 s de vuelo** dan unos 4,5 MB.
- **El buffer de 512 KB** cubre unos 9,7 s de picos de la SD.

## 4. Archivos de replay

- **Formato:** los archivos de T-304 usan **este mismo formato**, con `SESION`, `IMU_LOTE`, `BARO_LOTE`, `MAG_LOTE`, `GNSS_PVT` y `PPS` generados desde OpenRocket más ruido, **y además `VERDAD`**.
- **Consecuencia:** el banco de replay (T-305) lee **igual** un log real de la SD y un vuelo sintético. Con `VERDAD` califica el resultado contra los criterios de P-03.
- **Nombres:** `datos/` no se edita ([datos/README](../../../../datos/README.md)). Los procesados se guardan aparte con el sufijo `_proc`, por ejemplo `tools/sintetico/salida/demeter_H135W-8_sim2_ruido1_eyeccion-antes_proc.bin`.
- **Exportación:** el decodificador (T-203) exporta a CSV y Parquet una tabla por tipo de registro, con `t_us` y `utc` (usando los registros `PPS`).

## 5. Vectores de prueba

- **Dónde:** `tools/vectores/log/`.
- **Qué incluyen:**
  - un bloque con un registro de cada tipo, con su hex y los valores decodificados esperados;
  - un bloque con el CRC32 dañado (se salta);
  - un registro `SESION` dividido en partes.
- **Pasan los mismos vectores** en el codificador del firmware (Unity, `native`) y en el decodificador de Python.
