---
id: constantes
estado: vivo. Es la fuente única de los números del proyecto.
actualizado: 2026-10-24
---
# Constantes y límites

**Regla para agentes y humanos:** todo número del sistema sale de aquí.
- El firmware lo replica en `config.h` y el software de tierra en `constantes.py`, **con los mismos nombres**.
- Si un valor cambia, se cambia primero aquí, y en la columna "Origen" se anota por qué.
- `(P)` = provisional: se ajusta con la simulación o los perfiles sintéticos (prueba P-03). `(V)` = falta verificar contra el hardware.

## 1. Concurso y físicas (no las decidimos nosotros)

| Nombre | Valor | Origen |
| --- | --- | --- |
| `FECHA_LANZAMIENTO_CAT3` | 2026-11-08 | Cronograma del CCCD |
| `SITIO` | Santa Fe de Antioquia: 6,582° N, −75,823° E, **510 m s.n.m.** | Simulación de OpenRocket de Demeter ([perfiles_vuelo](perfiles_vuelo.md)) |
| `CANSAT_MASA_G` | 250–300 | Ficha de la Cat 3 |
| `ATERRIZAJE_V_MAX_MS` | 11 | DCP |
| `INTEGRACION_MAX_MIN` | 15 | DCP |
| `MOTORES` | **Demeter: H135W-8. Hermes: G80-7T.** | Usuario, 2026-10-24 (confirmado), y la simulación de Demeter |
| Recuperación | Solo por la eyección del motor. **Prohibido el despliegue electrónico.** | DCP |

## 2. Radio y TDMA ([enlace_lora_tdma.md](../04_diseno/enlace_lora_tdma.md))

| Nombre | Valor | Origen |
| --- | --- | --- |
| `LORA_FREQ_MHZ` | 919,0 (por defecto) | D-001 |
| `LORA_CANALES` | 916,0 · 919,0 · 922,0 · 925,0 MHz (V: regulación) | D-001. Se evita 905–915 por la reserva para IMT (ANE, por confirmar) y 915,0 por ser el canal más usado. |
| `LORA_SF` | 6 (plan B: 5) | D-001 |
| `LORA_BW_KHZ` | 500 | D-001 |
| `LORA_CR` | 5 (es decir, 4/5) | D-001 |
| `LORA_PREAMBULO` | 8 | D-001 |
| `LORA_SYNC_WORD` | 0xD3 (RadioLib lo escribe como 0xD434 en el SX126x) | Nota original + ficha sx1262 |
| `LORA_TX_DBM` | 22 (banco de pruebas: 0–10) | D-001 |
| `LORA_CRC` | Activado | |
| `TDMA_CICLO_MS` | 100 | D-002 |
| `TDMA_SLOT_MS` | 25 | D-002 |
| `TDMA_GUARD_INICIO_MS` | 2 | D-002 |
| `TDMA_TOA_MAX_MS` | 16 | D-002 |
| `TDMA_HOLDOVER_MAX_S` | 120 | D-003 |
| `ALOHA_TASA_HZ` | 2 | D-004 |
| `ALOHA_JITTER_MAX_MS` | 100 | D-004 |
| `NODO_TIERRA` / `NODO_DEMETER` / `NODO_HERMES` / `NODO_TODOS` | 0 / 1 / 2 / 0x0F | Nota original (Demeter 1, Hermes 2) |

## 3. Protocolo ([protocolo_paquetes.md](../04_diseno/protocolo_paquetes.md))

| Nombre | Valor |
| --- | --- |
| `PROTO_VERSION` | 2 |
| `LEN_NAV` / `LEN_STATUS` / `LEN_BEACON` / `LEN_ACK` / `LEN_BACKFILL` | 44 / 42 / 14 / 12 / 44 |
| `LEN_CMD` | 17 + `arg_len` (0–8) |
| `PAQUETE_SLOT_MAX` | 61 B (≤ 16 ms con SF6/BW500) |
| `STATUS_CADA_CICLOS` | 10 |
| `CMD_REINTENTOS_MAX` | 10 |
| `Q15_ESCALA` | 32767 |
| Valores de "sin dato" | i8 −128 · i16 −32768 · i32 −2³¹ · u8 0xFF · u16 0xFFFF |
| `ESTADO_SEC_NO_APLICA` / `ESTADO_SEC_SIN_RESPUESTA` | 0xFF / 0xFE |

## 4. Máquina de estados ([maquina_estados.md](../04_diseno/maquina_estados.md))

| Nombre | Valor | Notas |
| --- | --- | --- |
| `LAUNCH_ACC_G` | 3,0 (P) | El T/W mínimo es 5, así que la aceleración específica en el despegue es ≥ 5 g |
| `LAUNCH_VENTANA_MS` | 100 (P) | Filtra los golpes al manipular el cohete |
| `BURNOUT_ACC_G` | 0,5 (P) | |
| `BURNOUT_VENTANA_MS` | 100 (P) | |
| `APOGEO_VENTANA_MS` | 100 (P) | |
| `APOGEO_CAIDA_M` | 0,5 (P) | |
| `APOGEO_VZ_SALIDA_MS` | 2,0 (P) | |
| `DESCENSO_VENTANA_MS` | 1000 (P) | |
| `EYECCION_ACC_G` | 4,0 (P) | |
| `EYECCION_VENTANA_MS` | 20 (P) | |
| `EYECCION_BLOQUEO_BARO_MS` | 300 (P) | |
| `LANDED_VZ_MS` | 0,5 | |
| `LANDED_ACC_TOL_G` | 0,05 | |
| `LANDED_GIRO_MAX_DPS` | 5 | |
| `LANDED_VENTANA_S` | 5 (P) | |
| `ALARMA_DESCENSO_MS` | 10,0 | *Objetivos* 7.G. Se evalúa solo en DESCENT. ⚠️ El descenso nominal de Demeter es de 9,2 m/s, así que se propone subirla a 11 con una ventana de 2 s (PEN-20). |
| `PRETRIGGER_S` | 2 | |
| `ORIGEN_PROMEDIO_S` | 30 | Promedio GNSS y baro en PREFLIGHT |
| `GO_HACC_MAX_M` | 5 (P) | |
| `GO_SV_MIN` | 6 | |
| `GO_QUIETUD` | `\|a\|` 1 ± 0,05 g y giro < 2 °/s durante 2 s | |
| `BAT_MIN_ARM_PCT` | 60 (P) | |
| `SD_MIN_LIBRE_MB` | 500 | |

## 5. Adquisición y fusión ([firmware_vuelo.md](../04_diseno/firmware_vuelo.md))

| Nombre | Valor |
| --- | --- |
| `ACC_RANGO_G` / `GYRO_RANGO_DPS` | 32 / 2000 |
| `IMU_ODR_VUELO_HZ` / `IMU_ODR_TIERRA_HZ` | 3330 / 1660 (los valores nominales del LSM6DSO32 son 3,33 y 1,66 kHz) |
| `BARO_ODR_VUELO_HZ` / `BARO_ODR_TIERRA_HZ` | 240 / 50 (OSR según la ficha bmp581) |
| `MAG_ODR_VUELO_HZ` / `MAG_ODR_TIERRA_HZ` | 100 / 50 |
| `GNSS_TASA_HZ` | 10 |
| `GNSS_MODELO_DINAMICO` | AIR4, valor 8 (airborne <4 g). Es el modelo de más dinámica, pero el impulso llega a 5–20 g: se espera perder el seguimiento unos segundos, y eso lo cubren el holdover y el EKF (ficha max_m10s). **Nunca usar STAT ni PORT** en vuelo. |
| `GNSS_CONSTELACIONES` | **GPS + Galileo** (permite 10 Hz con la configuración por defecto, según el datasheet). La configuración de fábrica, GPS+GAL+BDS B1I, solo llega a 3 Hz. |
| `EST_VERTICAL_HZ` / `MADGWICK_HZ` / `EKF_PRED_HZ` / `FSM_HZ` | 500 / 500 / 100 / 100 (P) |
| `LOG_BUFFER_KB` / `LOG_BLOQUE_KB` / `LOG_ROTAR_MB` | 512 / 16 / 64 |

## 6. VisionPack y operación

| Nombre | Valor |
| --- | --- |
| `PI_UART_BAUD` | 115200 |
| `PI_PULSO_MS` | 1500 (el pulso es a masa por drenador abierto; ver visionpack_integracion) |
| `PI_CMD_REINTENTOS` / `PI_CMD_ESPERA_MS` | 3 / 200 |
| Watchdogs de la Pi (del lado de Demeter) | 15 s para el ascenso y 95 s para el descenso (en `demeter_missiond.py`) |
| `WIFI_AP_SSID` | `EIA-<ROCKET_ID>` (la clave va en la configuración, no en el repo) |
| `MODEM_USB_BAUD` | 921600 |

## 7. Buses, pines y encendido ([buses_y_pines.md](../03_hardware/buses_y_pines.md))

> ⚠️ **D-022 está reabierta.** Los pines de los sensores externos de abajo son los de la **opción B′, que es la recomendada y es provisional** hasta PEN-18. Ver [buses_y_pines](../03_hardware/buses_y_pines.md) §4.

| Nombre | Valor |
| --- | --- |
| `PIN_SD_CLK` / `PIN_SD_CMD` / `PIN_SD_D0` / `PIN_SD_D3` | 36 / 35 / 37 / 47 (la SD en SDMMC de 1 bit, B′) |
| `PIN_CS_QMI8658` | 34 (se mantiene en alto: QMI8658 deshabilitado en B′) |
| `PIN_SENS_SCK` / `PIN_SENS_MOSI` / `PIN_SENS_MISO` | 46 / 45 / 3 (host SPI3 por la GPIO matrix, B′) |
| `PIN_CS_LSM6DSO32` / `PIN_INT_LSM6DSO32` | 38 / 39 |
| `PIN_CS_BMP581` | 48 (el FIFO se lee por timer cada `BARO_FIFO_POLL_MS` = 50) |
| `I2C0_SDA` / `I2C0_SCL` · `I2C_ADDR_MMC5983MA` | 17 / 18 · 0x30 |
| Alimentación de los breakouts externos | **DC1 (3,3 V, PM1)**, con sus pull-ups de los CS en el mismo riel. El DRV5032 se alimenta de **VBAT**. |
| `I2C1_SDA` / `I2C1_SCL` · `PIN_PMU_IRQ` | 42 / 41 · 40 |
| `PIN_RADIO_SCK/MOSI/MISO/CS/RST/BUSY/DIO1` | 12 / 11 / 13 / 10 / 5 / 4 / 1 |
| `PIN_GNSS_TX` / `PIN_GNSS_RX` / `PIN_GNSS_PPS` | 8 / 9 / 6 |
| `PIN_BUZZER` | 21 (B′, provisional; ver buses_y_pines §6) |
| `PIN_PI_PULSO` (Demeter) | **2** (IO2 del header, a masa por transistor, con pull-down de 10 kΩ; 🔎 verificar que `RADIO_RETAIN` no lo use) |
| `PIN_PI_UART_TX` / `PIN_PI_UART_RX` (Demeter) | 43 / 44 |
| `SPI3_SD_MAX_MS` | 8 (P). Solo aplica en la opción A′ (el bus compartido con la SD). |
| `PMIC_PWRON_APAGADO_S` | 10. Pulsación larga para apagar, **desactivada desde ARMED hasta LANDED**. |

## 8. Montaje (pendiente)

| Nombre | Valor |
| --- | --- |
| `R_MONTAJE_LSM6DSO32`, `R_MONTAJE_MMC5983MA`, `R_MONTAJE_QMI8658`, `R_MONTAJE_QMC6310` | Matrices de rotación del eje del sensor al cuerpo del cohete. **Se miden en el CanSat real.** |

## 9. Web pública y dashboard de operación ([08_gui](../08_gui/00_README.md))

Las replica la web en un solo archivo de constantes (06_plan_web §6), con los mismos nombres. El relay las lee de `constantes.py`.

| Nombre | Valor | Origen |
| --- | --- | --- |
| `WEB_LATENCIA_MAX_S` | 2 (de punta a punta, de la estación al celular) | D-W09 |
| `WEB_DATO_VIEJO_S` | 2 (P): a partir de aquí, "señal débil" | 08_gui/03 §4 |
| `WEB_SIN_SENAL_S` | 5 (P): a partir de aquí, "sin señal" y LKP | 08_gui/03 §4 |
| `WEB_SIN_TRANSMISION_MIN` | 10 (P): sin nada de la estación, "la transmisión empieza el día del lanzamiento" | 08_gui/03 §4 |
| `WEB_RECONEXION_MAX_S` | 15: el retroceso máximo de la reconexión SSE | 08_gui/03 §4 |
| `WEB_TASA_TIERRA_HZ` | 1: la tasa del relay hacia el público en BOOT, PREFLIGHT, ARMED y LANDED. En vuelo pasa todo. | 08_gui/04 §4 |
| `WEB_SSE_LATIDO_S` | 15 | 08_gui/04 §4 |
| `WEB_SSE_MAX_POR_IP` | 10 | 08_gui/04 §8 |
| `WEB_SERIE_MAX_PUNTOS` | 2000 (P): el máximo de puntos de la `serie` del snapshot | 08_gui/05 §3 |
| `WEB_INGESTA_TOKEN` | **No va en el repo:** una variable de entorno en el relay y en el reenviador | 08_gui/04 §4 |
