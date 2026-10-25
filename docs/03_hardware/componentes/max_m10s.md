---
id: max_m10s
nombre: u-blox MAX-M10S (GNSS integrado en LilyGO T-Beam Supreme)
tipo: Receptor GNSS standard precision, plataforma u-blox M10 (firmware ROM SPG 5.10)
ubicacion: CanSat (ambos cohetes)
fabricante: u-blox AG
fuentes:
  - https://www.u-blox.com/en/product/max-m10-series (página de producto; enlaza las datasheets)
  - https://www.u-blox.com/sites/default/files/MAX-M10S_DataSheet_UBX-20035208.pdf (datasheet UBX-20035208 R08)
  - https://www.u-blox.com/sites/default/files/MAX-M10S_IntegrationManual_UBX-20053088.pdf (integration manual UBX-20053088 R05)
  - https://www.u-blox.com/sites/default/files/u-blox-M10-SPG-5.10_InterfaceDescription_UBX-21035062.pdf (interface description M10 SPG 5.10, UBX-21035062 R03)
  - https://github.com/sparkfun/SparkFun_u-blox_GNSS_v3 (librería; README y ejemplos Example19_DynamicModel, Example23, Example25)
  - https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/blob/master/docs/en/t_beam_supreme/t_beam_supreme_hw.md (pinout de la T-Beam S3 Supreme, variante Ublox M10)
  - https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/blob/master/examples/GPS/UBlox_BasicNMEARead/utilities.h (definiciones de pines GPS)
datasheet_pdf: ../datasheets/max_m10s.pdf (datasheet R08); ../datasheets/max_m10s_integration_manual.pdf (integration manual R05); ../datasheets/m10_spg510_interface_description.pdf (interface description R03)
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# u-blox MAX-M10S

## Rol en el proyecto
Receptor GNSS del CanSat (dentro de la LilyGO T-Beam Supreme, variante Ublox). Entrega posición a 10 Hz en vuelo, la hora GNSS y el pulso PPS que se usan para sincronizar el TDMA de radio (ciclo 100 ms, slots 25 ms). Se comunica con el ESP32-S3 por UART.

## Datos clave
| Parámetro | Valor | Fuente |
| --- | --- | --- |
| Señales | GPS/QZSS L1C/A, Galileo E1-B/C, GLONASS L1OF, BeiDou B1I y B1C (solo L1) | Datasheet R08, tabla 4 |
| Constelaciones simultáneas | Hasta 4 (GPS, GLONASS, Galileo, BeiDou). BDS B1I no puede activarse a la vez con B1C ni con GLONASS | Datasheet R08, sec. 1.1 y nota 13 |
| Configuración por defecto | GPS+GAL+BDS B1I, con QZSS y SBAS activos | Datasheet R08, sec. 1.3 |
| Tasa de navegación por defecto (máx.) | GPS+GAL 10 Hz; GPS+GAL+GLO 6 Hz; GPS+GAL+BDS B1I 3 Hz; GPS+GAL+BDS B1C 8 Hz; GPS+GAL+BDS B1C+GLO 4 Hz; GPS, GLO, BDS o GAL solos 18 Hz | Datasheet R08, tablas 2 y 3 |
| Tasa de alto rendimiento (requiere configuración) | GPS+GAL 20 Hz; GPS+GAL+GLO 16 Hz; GPS+GAL+BDS B1I 12 Hz; GPS+GAL+BDS B1C 16 Hz; GPS+GAL+BDS B1C+GLO 10 Hz; un solo GNSS 25 Hz | Datasheet R08, tablas 2 y 3 |
| Precisión de posición (CEP 50%) | 1,5 m (GPS+GAL) | Datasheet R08, tabla 2 |
| Precisión del pulso de tiempo | RMS 30 ns; 99% 60 ns | Datasheet R08, tabla 1 |
| Frecuencia del TIMEPULSE | 1 PPS por defecto; configurable de 0,25 Hz a 10 MHz | Datasheet R08, tabla 1 |
| TTFF frío (GPS+GAL) | 28 s | Datasheet R08, tabla 2 |
| TTFF caliente | 1 s | Datasheet R08, tabla 2 |
| TTFF AssistNow Autonomous | 3 s (GPS+GAL) a 4 s según constelación | Datasheet R08, tabla 2 |
| Sensibilidad seguimiento y navegación | -167 dBm | Datasheet R08, tabla 2 |
| Sensibilidad arranque en frío / caliente | -148 dBm / -159 dBm | Datasheet R08, tabla 2 |
| Límites operativos | Dinámica ≤ 4 g; altitud 80 000 m; velocidad 500 m/s | Datasheet R08, tabla 1 |
| Precisión de velocidad | 0,05 m/s (50 % a 30 m/s en dinámica) | Datasheet R08, tabla 1 |
| Consumo en seguimiento continuo | 25 mW (según la datasheet) | Datasheet R08, sec. 1.1 |
| Corriente VCC (3,0 V) | Adquisición 8–13 mA; seguimiento continuo 7,5–10 mA; power save 4,5–5 mA (según constelación) | Datasheet R08, tabla 15 |
| Corriente V_IO (3,0 V) | ~2,1–2,3 mA | Datasheet R08, tabla 15 |
| Corriente en backup hardware (V_BCKP 3,3 V, VCC=V_IO=0) | 28 µA; en operación normal con V_BCKP ≈ 3 µA | Datasheet R08, tabla 15 y notas |
| Tensión VCC | 1,76–3,6 V (típ. 1,8 o 3,3 V) | Datasheet R08, sec. 4.2 |
| Tensión V_BCKP | 1,65–3,6 V | Datasheet R08, sec. 4.2 |
| Salida VCC_RF (para alimentar antena activa) | VCC − 0,1 V; hasta 50 mA | Datasheet R08, sec. 4.2 |
| Protocolos | UBX (in/out) y NMEA 2.1/2.3/4.0/4.10/4.11 (por defecto) | Datasheet R08, sec. 1.4 |
| Velocidad UART | 9600 por defecto; 9600–921 600 bit/s; tolerancia Tx ±1 %, Rx ±2,5 % | Datasheet R08, sec. 5.1 y 5.3 |
| Dimensiones y paquete | No extraídas de forma fiable en esta pasada | Datasheet R08, sec. 8 (pendiente) |

## Interfaz y pines
Pinout según datasheet R08, tabla 10 (pin 1 GND):

| Pin | Nombre | Función |
| --- | --- | --- |
| 2 | TXD (PIO1) | UART Tx a host; dejar abierto si no se usa |
| 3 | RXD (PIO0) | UART Rx desde host |
| 4 | TIMEPULSE (PIO4) | Salida PPS; compartida con SAFEBOOT_N a través de 1 kΩ |
| 5 | EXTINT (PIO5) | Interrupción externa |
| 6 | V_BCKP | Alimentación de respaldo (backup) |
| 7 | V_IO | Alimentación de E/S (con VIO_SEL) |
| 8 | VCC | Alimentación principal |
| 9 | RESET_N | Reset activo en bajo, mínimo 1 ms |
| 11 | RF_IN | Entrada GNSS |
| 13 | LNA_EN | Activa o desactiva LNA externo o antena activa |
| 14 | VCC_RF | Salida de tensión para la sección RF |
| 15 | VIO_SEL | GND para V_IO de 1,8 V; abierto para 2,7–3,6 V |
| 18 | SAFEBOOT_N | Modo safeboot si está en bajo al arrancar |

Pinout de la T-Beam S3 Supreme (variante Ublox M10), según documentación de LilyGO y su definición de pines en `utilities.h`:
- GNSS TX (del ESP32-S3 al módulo) = GPIO 8; GNSS RX (del módulo al ESP32-S3) = GPIO 9; PPS = GPIO 6; EN = GPIO 7 (en la documentación, GPIO 7 se marca como wake-up solo en la versión L76K).
- Velocidad por defecto en el header de ejemplo: 9600 baudios.

## Configuración relevante para nuestro uso
Acceso por UBX-CFG-VALSET / UBX-CFG-VALGET (claves CFG-*). Cada escritura va a capas: RAM (bit 0), BBR (bit 1) y Flash (bit 2) (UBX-CFG-VALSET, interface description).

| Clave | Uso propuesto | Notas (fuente) |
| --- | --- | --- |
| CFG-NAVSPG-DYNMODEL | Ver sección siguiente | Enumeración PORT=0, STAT=2, PED=3, AUTOMOT=4, SEA=5, AIR1=6, AIR2=7, AIR4=8, WRIST=9, BIKE=10, MOWER=11, ESCOOTER=12 (interface description, tabla 23) |
| CFG-RATE-MEAS | 100 ms (10 Hz) | Mínimo 25 ms (interface description, tabla 36). Ver nota sobre constelaciones |
| CFG-RATE-NAV | 1 | Medidas por solución de navegación |
| CFG-RATE-TIMEREF | UTC o GPS | Base temporal de las medidas |
| CFG-UART1-BAUDRATE | ≥ 115 200 | Ver cálculo de ancho de banda más abajo |
| CFG-UART1OUTPROT-UBX | 1 | Activa salida UBX en UART1 |
| CFG-UART1OUTPROT-NMEA | 0 (si no se usa NMEA) | Reduce carga en el enlace |
| CFG-MSGOUT-UBX_NAV_PVT_UART1 | 1 (por cada solución) | Mensaje principal de posición y hora |
| CFG-MSGOUT-UBX_TIM_TP_UART1 | 1 | Mensaje de tiempo del pulso PPS |
| CFG-TP-TP1_ENA | 1 | Habilita el TIMEPULSE |
| CFG-TP-PULSE_DEF | PERIOD o FREQ | Define si se da periodo o frecuencia (tabla 47) |
| CFG-TP-PERIOD_TP1 / CFG-TP-PERIOD_LOCK_TP1 | 1 000 000 µs | 1 Hz; el lock aplica cuando hay tiempo GNSS válido |
| CFG-TP-LEN_TP1 | Ancho del pulso en µs | Mínimo 50 ns de nivel alto y bajo (integration manual 3.9.2) |
| CFG-TP-SYNC_GNSS_TP1 | 1 | Sincroniza el pulso a tiempo GNSS; con 0 va con reloj local |
| CFG-TP-USE_LOCKED_TP1 | 1 | Usa los parámetros lock cuando el tiempo GNSS es válido |
| CFG-TP-ALIGN_TO_TOW_TP1 | 1 | Alinea el pulso al inicio de segundo (requiere SYNC_GNSS) |
| CFG-TP-TIMEGRID_TP1 | GPS o UTC | Base de tiempo del pulso |
| CFG-TP-POL_TP1 | 1 (flanco de subida) | 0 = flanco de bajada |
| CFG-TP-ANT_CABLEDELAY | Calibrar | Retardo de cable de antena en ns (integration manual 3.9.1) |
| CFG-NAVSPG-UTCSTANDARD | Según estándar elegido | Afecta a la conversión GPS a UTC |
| Capa de guardado | RAM+BBR (o Flash) | Un VALSET con capas RAM y BBR conserva la configuración si hay V_BCKP; RAM solo se pierde al cortar la energía |

**Modelo dinámico (CFG-NAVSPG-DYNMODEL):**
- Límites documentados del modelo (integration manual, tabla 10): AIR4 (<4 g) tiene altitud máxima 80 000 m, velocidad horizontal máxima 500 m/s, velocidad vertical máxima 20 000 (según la tabla); su única comprobación de coherencia es la altitud, y no admite fix 2D.
- AIR2 (<2 g): 250 m/s horizontal; AIR1 (<1 g): 100 m/s horizontal.
- STAT (estacionario): 10 m/s horizontal y 6 m/s vertical; si el cohete supera esos valores, la solución se invalida. No usar en vuelo.
- PORT (portátil): 310 m/s horizontal y 50 m/s vertical, comprobación de altitud y velocidad (tabla 10).
- Recomendación según la documentación (propuesta, no es una prescripción del fabricante): en vuelo usar AIR4 (el modelo de mayor dinámica disponible). Para la fase en rampa con antena inmóvil, STAT o PORT, pero cambiar a AIR4 antes del lanzamiento. Ver "Incertidumbres" sobre si AIR4 cubre 5–20 g.
- La documentación cita "AIR4 = <4 g". La aceleración de 5 a 20 g está por encima de ese rango (ver Incertidumbres).

**Tasa de navegación según constelaciones (para 10 Hz):** el valor por defecto (GPS+GAL+BDS B1I) da 3 Hz, así que hay que reconfigurar. GPS+GAL da 10 Hz por defecto. GPS+GAL+BDS B1C da 8 Hz. Para 10 Hz con más de dos constelaciones hace falta el modo alto rendimiento (OTP, ver Trampas).

**Modo alto rendimiento:** la configuración de reloj de CPU de alta velocidad se graba en OTP (memoria de una sola escritura, permanente e irreversible). La cadena de 18 bytes está en la integration manual, tabla 8. No recomendado hasta confirmar los requisitos.

## Alimentación y tiempos
- Tensiones: VCC 1,76–3,6 V; V_BCKP 1,65–3,6 V; V_IO 1,76–1,98 V (VIO_SEL=GND) o 2,7–3,6 V (VIO_SEL abierto) (datasheet R08, sec. 4.2).
- Inrush de arranque hasta 100 mA (datasheet R08, sec. 4.3).
- Corriente de adquisición VCC: 8–13 mA según constelación; seguimiento continuo 7,5–10 mA; modo power save 4,5–5 mA (tabla 15).
- Backup: en modo hardware backup (VCC=V_IO=0) consume 28 µA; con V_BCKP alimentado en operación normal, unos 3 µA. El RTC se mantiene en el dominio de respaldo y permite inicios más rápidos (integration manual, sec. 3.10.1).
- Hot start: 1 s (datasheet R08, tabla 2). Un arranque caliente depende de los datos del RTC y de las efemérides guardadas en BBR. Sin V_BCKP se prevé un arranque frío (28 s): es una inferencia de la documentación del RTC.
- Tiempo de arranque en frío: 28 s con GPS+GAL, según la documentación. Para tener fix antes de armar, planificar al menos ese tiempo, más margen.
- Respaldo de batería en la Supreme: la documentación de LilyGO (t_beam_supreme_hw.md) dice que el respaldo GPS sale de la batería 18650. Sin la batería no hay hot start. La tabla de pines de la Supreme marca "VBACKUP: Unused" en el PMU, así que la conexión exacta de V_BCKP del módulo no está documentada en lo que consulté.

**Ancho de banda UART (cálculo propio):** un NAV-PVT ocupa 100 bytes (6 de cabecera + 92 de carga + 2 de checksum); con 8N1 son unos 1000 bits. A 10 Hz son 10 kbit/s, así que 9600 no alcanza. Usar al menos 115 200 baudios. TIM-TP ocupa 24 bytes.

## Librerías y ejemplos oficiales
- SparkFun u-blox GNSS v3 (https://github.com/sparkfun/SparkFun_u-blox_GNSS_v3). Soporta M10 y configuración por VALSET/VALGET. Según su README, para módulos como M8 hay que usar la v2 (https://github.com/sparkfun/SparkFun_u-blox_GNSS_Arduino_Library).
- Ejemplos de la v3 que sirven de referencia: `Basics/Example19_DynamicModel` (setDynamicModel con DYN_MODEL_AIRBORNE4g y capas RAM/BBR), `Basics/Example23_TimePulseParameters` (Period, Frequency, BulletTime), `Basics/Example25_MeasurementAndNavigationRate`, `Basics/Example13_PVT` (lectura de NAV-PVT).
- LilyGO: `examples/GPS/UBlox_*` (usa `Serial1` con GPS_RX 34/TX 12 para T-Beam V1.x; GPS_RX 9/TX 8 para la Supreme).

## Trampas y notas
- Tasa por defecto 3 Hz con la configuración de fábrica (GPS+GAL+BDS B1I). Para 10 Hz hay que cambiar constelaciones (por ejemplo GPS+GAL) o usar el modo alto rendimiento.
- STAT tiene límite de velocidad de 10 m/s. Usarlo en vuelo invalida la solución.
- El modelo AIR4 hace comprobación de altitud, no de velocidad. Por eso no garantiza coherencia de la velocidad en vuelo.
- La hora de `iTOW` es GPS, no UTC, y no tiene segundos intercalares. Para UTC hay que restar la diferencia GPS-UTC (leap seconds).
- En NAV-PVT, `validTime` no significa que la hora sea correcta: solo que el receptor la considera válida. `fullyResolved` indica que no queda ambigüedad de segundos. Sin ella el error puede llegar a unos 20 s.
- Con `CFG-TP-SYNC_GNSS_TP1=0` el pulso va con reloj local, no con GNSS. Revisar esta clave antes de usar el PPS como referencia.
- El PPS no es fiable hasta que el receptor esté "locked". `TpNotLocked=1` en TIM-TP significa que el pulso se basa en reloj local.
- Si se usa antena activa, activar LNA_EN (pin 13). La alimentación de la antena por VCC_RF queda en incertidumbres.
- CFG-RATE-MEAS mínimo 25 ms, pero la tasa real queda limitada por constelaciones y por el modo de reloj de CPU (tabla de tasas).

## Incertidumbres
- Aceleraciones de 5 a 20 g: la datasheet fija dinámica ≤ 4 g y la integration manual solo define AIR4 como "<4 g". No hay en las fuentes consultadas cifras de adquisición o de seguimiento a 5–20 g. Queda por validar con prueba de vibración/centrífuga o datos de vuelo.
- Alimentación de la antena activa: VCC_RF da VCC − 0,1 V (unos 3,2 V con VCC de 3,3 V) y hasta 50 mA. La antena MAN1216Q50 (ver ficha de la antena) pide 3,0–16 V y consume 15–20 mA. Cumple el mínimo solo con margen mínimo; no está confirmado en la placa.
- Dinámica de la antena y del receptor a 5–20 g: la datasheet solo documenta hasta 4 g, así que el comportamiento por encima es desconocido.
- Asociación del PPS: el header de la Supreme da GPIO 6 como PPS; el módulo tiene el pin 4 como TIMEPULSE. Confirmar en el esquemático que TIMEPULSE va a GPIO 6.
- Conexión de V_BCKP del módulo en la Supreme: no documentada en las fuentes consultadas (ver sección Alimentación). Existe `../datasheets/tbeam_supreme_schematic.pdf` en el repo, todavía sin revisar en esta investigación; es el siguiente paso para cerrar la duda.
- Pertenencia del componente: el campo "ubicacion" asume que el CanSat es compartido por ambos cohetes, según la hipótesis del CLAUDE.md del proyecto (tabla de componentes). Pendiente de confirmar.
- Velocidad vertical del modelo AIR4: la tabla 10 (integration manual R05) da 20 000 (unidad indicada m/s), que parece inconsistente con el 500 m/s horizontal. El modelo AIR1/AIR2 tiene valores de 6400/10 000. Confirmar la unidad con u-blox.
- Velocidad y altitud esperadas del cohete: no hay cifras de diseño en el repo. Aún así, la altitud máxima de unos 2 km queda muy por debajo del límite de 80 000 m.
- Las tablas de tasa y TTFF llegaron con columnas desordenadas; la asignación de columnas se ha deducido del orden extraído. Verificar contra el PDF.
- Dimensiones y peso del módulo: no extraídos.
- La variante exacta de la Supreme del proyecto (Ublox M10 vs L76K): la documentación confirma M10, pero el cohete debe verificar la etiqueta física de la placa.
- Compatibilidad del firmware de la placa con SPG 5.10: se asume la versión de la datasheet R08 (ROM SPG 5.10), no verificada en hardware.
