---
id: constantes
estado: vivo. Es la fuente única de los números del proyecto. Desde el 2026-11-03 (D-037), los números del firmware se **describen** aquí y su fuente de verdad es el código de Pablo.
actualizado: 2026-11-03
---
# Constantes y límites

**Reglas para agentes y humanos:**
- **Firmware (D-037, D-045):** los valores vienen del código de Pablo (`net_proto.h`, `mission_config.h`, `platformio.ini`…) y aquí van **con su nombre en el código** y su archivo.
  - Desde D-045, **un cambio se hace primero aquí** y después en el código.
  - La última importación (T-008), si cambia un valor, lo actualiza aquí en la misma tarea.
- **Estación, web y herramientas propias:** este documento sigue siendo la fuente. `constantes.py` y `constantes.ts` lo replican con los mismos nombres.
- `(P)` = provisional · `(V)` = falta verificar contra el hardware.
- **Los valores de la v1** (radio SF6 a 919 MHz, ciclo de 100 ms, protocolo v2, umbrales de las 10 fases, pines B′) están en [99_archivo/diseno_v1](../99_archivo/diseno_v1/). Solo los usa todavía el generador sintético de la web (`tools/web_datos/`), que produce `web-1` y no depende del protocolo de radio.

## 1. Concurso y físicas (no las decidimos nosotros)

| Nombre | Valor | Origen |
| --- | --- | --- |
| `FECHA_LANZAMIENTO_CAT3` | 2026-11-08 | Cronograma del CCCD (confirmado por el usuario el 2026-11-03) |
| `SITIO` | Santa Fe de Antioquia: 6,582° N, −75,823° E, **510 m s.n.m.** | Simulación de OpenRocket |
| `CANSAT_MASA_G` | 250–300 | Ficha de la Cat 3 |
| `ATERRIZAJE_V_MAX_MS` | 11 | DCP |
| `INTEGRACION_MAX_MIN` | 15 | DCP |
| `MOTORES` | **Demeter: H135W-8, 1,469 kg. Hermes: G80-7T, 1,157 kg.** | Usuario (2026-10-24) y las masas de la simulación (Pablo, `mission_config.h`) |
| Recuperación | Solo por la eyección del motor. **Prohibido el despliegue electrónico.** | DCP |

## 2. Radio y TDMA ([enlace_lora_tdma](../04_diseno/enlace_lora_tdma.md)), `net_proto.h`

| Nombre en el código | Valor | Nota |
| --- | --- | --- |
| `FREQ_MHZ` | 903,0 | (V) contra la ANE, PEN-13 |
| `SF` / `BW_KHZ` / `CR` | 7 / 500 / 5 (4/5) | |
| `SYNC` / `PREAMBLE` | 0xD3 / 8 | |
| `NET_TX_DBM` / `GND_TX_DBM` | 10 (banco) · **22 (envs `_campo`: alcance y vuelo)** | `platformio.ini` |
| `SLOT_US` / `SLOTS_PER_S` | 40 000 / 25 | Grupos T A B A B |
| `TX_OFFSET_US` | 2000 | La TX empieza a +2 ms de la ranura |
| `RX_OPEN_US` / `RX_CLOSE_US` | 6000 / 24 000 | La ventana del cohete en las ranuras de tierra |
| `BEACON_AIR_US` | 12 864 | El Beacon de 18 B |
| Ranuras base | Demeter 1 y 13 · Hermes 2 y 14 (2 Hz) | 10 Hz en vuelo, con las de extensión |
| `MAX_ERR_US` | 2000 | Con más error de hora, baliza lenta (`net_radio.cpp`) |
| `BEACON_MIN_MS` / `MAX_MS` | 1000 / 3000 | La baliza lenta sin hora |
| `CONFIRM_WINDOW_MS` | 10 000 | Confirmación de los comandos no aptos |
| `RESP_REPEATS` | 2 | Veces que sale una CmdResp |
| `LOG_INFO_MS` | 5000 | LogInfo en lugar de un TELEM |
| `RETRY_MS` / `MAX_TRIES` | 1500 / 4 | Reintentos de comandos en tierra (`gnd_cmd.cpp`) |
| `NODO`: tierra / Demeter / Hermes | 0 / 1 / 2 (`RocketId`) | |

## 3. Protocolo ([protocolo_paquetes](../04_diseno/protocolo_paquetes.md))

| Nombre | Valor |
| --- | --- |
| Largo de TELEM / BEACON / CMD / CMD_RESP / LOG_INFO | 64 / 18 / 20 / 28 / 54 B (`static_assert`) |
| `TAG_LEN` (HMAC-SHA256 truncado) | 8 B |
| `Q15_ESCALA` | 32767 |
| `NET_KEY` | **No va en el repo:** `firmware/common/net_proto/secrets.h`, la misma en las tres placas |
| `USB_TIERRA_BAUD` | 115200 (reemplaza a `MODEM_USB_BAUD` = 921600) |

## 4. Misión ([maquina_estados](../04_diseno/maquina_estados.md)), `mission.cpp` y `mission_config.h`

| Nombre en el código | Demeter | Hermes | Nota |
| --- | --- | --- | --- |
| `boost_dv_mps` | 5 | 5 | (P) |
| `jump_m` / `jump_s` | 10 / 0,5 | 10 / 0,5 | (P) |
| `t_burn_max` | 3,0 s | 2,7 s | (P) |
| `t_apogeo_min` / `t_apogeo_max` | 7,0 / 16,0 s | 5,5 / 13,0 s | (P) |
| `t_para_max` | 13,0 s | 12,0 s | (P) |
| `t_vuelo_max` | 210 s | 140 s | (P) |
| `t_abort` / `t_post` | 120 / 60 s | 120 / 60 s | |
| `vbat_arm_mv` | 3700 | 3700 | (P) |
| `ACC_REST_G` | 0,25 | | Tolerancia de quietud (acelerómetros sin calibrar) |
| `VZ_MOVING_MPS` | 2,0 | | "Subiendo" o "bajando" |
| `REF_TAU_S` / `ALT_TAU_S` | 60 / 0,2 s | | `p0` en TIERRA / el filtro de la altura |
| `FRESH_US` | 500 000 | | Una fuente sin datos en este tiempo cuenta como caída |
| `BOOST_ACC_MIN_G` | 2,0 | | Integrador de BOOST (T-410, maquina_estados §6) |
| `BOOST_RESET_MS` | 50 (P) | | El integrador se reinicia tras este tiempo con `\|a\|` ≤ 2 g |
| `BOOST_BARO_EVAL` | 5 (P) | | Evaluaciones seguidas del salto barométrico |

**Los que usa la estación y la web** (siguen siendo nuestros):

| Nombre | Valor | Notas |
| --- | --- | --- |
| `ALARMA_DESCENSO_MS` | 10,0 | Se evalúa en DESCENT (= momento PARACAIDAS). PEN-20 propone 11 m/s con una ventana de 2 s. El descenso de la sim. es de 9,3 m/s en Demeter y 8,9 m/s en Hermes |
| `BAT_PCT_VMIN_MV` / `BAT_PCT_VMAX_MV` | 3300 / 4200 (P) | Para pasar `vbat_mv` a `bat_pct` en `web-1` |

**Los que usa el generador sintético de la web** (`tools/web_datos/`, que simula la máquina v1; los verifica `test_escenarios.ConstantesReplicadas`):

| Nombre | Valor | Notas |
| --- | --- | --- |
| `APOGEO_VZ_SALIDA_MS` | 2,0 (P) | De la v1 ([99_archivo/diseno_v1](../99_archivo/diseno_v1/maquina_estados.md)): solo el generador |
| `BAT_MIN_ARM_PCT` | 60 (P) | De la v1: solo el generador. El firmware usa `vbat_arm_mv` |
| `GO_SV_MIN` | 6 | De la v1: solo el generador. El firmware exige fix 3D |

## 5. Adquisición ([firmware_vuelo](../04_diseno/firmware_vuelo.md))

| Sensor | Tasa real [Pablo] | Rango / nota |
| --- | --- | --- |
| LSM6DSO32 (principal) | 1667 Hz nominal: **1610 (Demeter) / 1560 (Hermes)** | ±32 g, ±2000 °/s |
| QMI8658 (respaldo) | 445 Hz | ±16 g, ±1024 °/s (`IMU_ACC_FS_G`, `IMU_GYR_FS_DPS`) |
| BMP581 (por el hub) | ≈ 100 Hz | Mediana de 3 a bordo (10 ms de retraso) |
| BME280 | ≈ 40 Hz (forzado) | P ×8, T ×1, H ×1, IIR off |
| MMC5983MA | ≈ 107 Hz | SET cada 100 mediciones |
| QMC6309 | 100 Hz | ±8 G |
| GNSS M10S | 10 Hz | DYNMODEL 8 (airborne < 4 g); GPS+GAL+BDS+QZSS+SBAS (por ahora, sin tocar) |
| SD | SPI a 10 MHz | Archivo de 32 MB; bloque de 4 KB; flush cada 16 bloques |
| Tarea de misión | 50 Hz (`TASK_MS` = 20) | |

## 6. VisionPack y operación

| Nombre | Valor |
| --- | --- |
| `PI_UART_BAUD` | 115200 (UART0, GPIO 43/44) |
| `PI_PULSO_MS` | 1500 (P). Lo da el MOSFET de IO45, en paralelo a J2. **Sin firmware** |
| Watchdogs de la Pi | 15 s para el ascenso y 95 s para el descenso (en `demeter_missiond.py`) |
| Puertos del dashboard de Pablo | Tierra `COM5`, Demeter `COM4`, Hermes `COM3`; web en `127.0.0.1:8765` |

## 7. Buses y pines ([buses_y_pines](../03_hardware/buses_y_pines.md))

| Nombre | Valor |
| --- | --- |
| LSM6DSO32 (SPI por software) | SCK 48 · MOSI 3 · MISO 39 · CS 2 · INT1 38 |
| BMP581 | Por el hub del LSM (0x47) |
| SD + QMI8658 (SPI de la placa) | SCK 36 · MOSI 35 · MISO 37 · CS SD 47 · CS QMI 34 · INT QMI 33 |
| I2C0 (BME280, QMC6309, MMC5983MA 0x30) | SDA 17 · SCL 18 |
| I2C1 (PMU, RTC) · IRQ PMU · INT RTC | 42 / 41 · 40 · 14 |
| Radio | SCK 12 · MOSI 11 · MISO 13 · CS 10 · RST 5 · BUSY 4 · DIO1 1 |
| GNSS | TX 8 · RX 9 · PPS 6 |
| `EXT_DRV_PIN` (DRV5032) | 21 (*wake* de sueño profundo, activo en bajo) |
| Actuador (Pi PWR_ON / Hermes) | 45 |
| Buzzer (activo, 5 V) | 46 |
| UART de la Pi | TXD 43 · RXD 44 |
| Alimentación de los externos | ALDO2 (3V3_SENS) |

## 8. Montaje y calibración

| Nombre | Valor |
| --- | --- |
| Rotación chip → cuerpo, sesgos y escalas | Por cohete, en `tools/tbeam/calib_<cohete>.json` (`calib.py`). **Repetirlas a cielo abierto con el cohete cerrado.** Pueden tener det = −1 (el MMC sale +x −y +z) |
| Retardo del QMI frente a su marca | 42 ms (los dos cohetes) [Pablo] |
| Declinación magnética | −8° (aprox., sin confirmar) |

## 9. Web pública y dashboard de operación ([08_gui](../08_gui/00_README.md))

Las replica la web en un solo archivo de constantes (06_plan_web §6), con los mismos nombres. El relay las lee de `constantes.py`.

| Nombre | Valor | Origen |
| --- | --- | --- |
| `WEB_LATENCIA_MAX_S` | 2 (de punta a punta, de la estación al celular) | D-W09 |
| `WEB_DATO_VIEJO_S` | 2 (P): a partir de aquí, "señal débil" | 08_gui/03 §4 |
| `WEB_SIN_SENAL_S` | 5 (P): a partir de aquí, "sin señal" y LKP | 08_gui/03 §4 |
| `WEB_SIN_TRANSMISION_MIN` | 10 (P): sin nada de la estación, "la transmisión empieza el día del lanzamiento" | 08_gui/03 §4 |
| `WEB_RECONEXION_MAX_S` | 15: el retroceso máximo de la reconexión SSE | 08_gui/03 §4 |
| `WEB_ALARMA_SOSTENER_S` | 10: el banner de alarma de descenso sigue estos segundos después de que la alarma se apaga | 08_gui/03 §4, D-W18 |
| `WEB_TASA_TIERRA_HZ` | 1: la tasa del relay hacia el público en BOOT, PREFLIGHT, ARMED y LANDED. En vuelo pasa todo. | 08_gui/04 §4 |
| `WEB_SSE_LATIDO_S` | 15 | 08_gui/04 §4 |
| `WEB_SSE_MAX_POR_IP` | 10 | 08_gui/04 §8 |
| `WEB_SERIE_MAX_PUNTOS` | 2000 (P): el máximo de puntos de la `serie` del snapshot | 08_gui/05 §3 |
| `WEB_INGESTA_TOKEN` | **No va en el repo:** una variable de entorno en el relay y en el reenviador | 08_gui/04 §4 |
