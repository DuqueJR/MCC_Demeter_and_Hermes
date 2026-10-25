---
id: neo_m8n
nombre: u-blox NEO-M8N (GNSS de la LilyGO T-Beam V1.2, estación terrena)
tipo: Receptor GNSS standard precision, plataforma u-blox M8 (firmware FW3, SPG 3.01)
ubicacion: Estación
fabricante: u-blox AG
fuentes:
  - https://www.u-blox.com/sites/default/files/NEO-M8-FW3_DataSheet_UBX-15031086.pdf (datasheet UBX-15031086 R14)
  - https://www.u-blox.com/sites/default/files/products/documents/u-blox8-M8_ReceiverDescrProtSpec_UBX-13003221.pdf (receiver description UBX-13003221 R28)
  - https://www.u-blox.com/en/product/neo-m8-series (página de producto)
  - https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/blob/master/docs/en/t_beam/t_beam_hw.md (pinout y alimentación de la T-Beam V1.x)
  - https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/blob/master/examples/GPS/UBlox_BasicNMEARead/utilities.h (pines GPS del header de la placa)
  - https://github.com/sparkfun/SparkFun_u-blox_GNSS_Arduino_Library (librería v2, referida desde el README de la v3)
datasheet_pdf: ../datasheets/neo_m8n_datasheet.pdf (datasheet R14); ../datasheets/m8_receiver_description.pdf (receiver description R28)
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# u-blox NEO-M8N

## Rol en el proyecto
GNSS de la estación terrena (T-Beam V1.2, ESP32). Su función es dar hora GNSS y PPS para sincronizar la estación con el TDMA del CanSat. Como la estación está en tierra, la dinámica es baja. Hace falta confirmar que el módulo de la placa es realmente NEO-M8N y no otra variante (M6, L76K u otra).

## Datos clave
| Parámetro | Valor | Fuente |
| --- | --- | --- |
| Tipo y firmware | NEO-M8N-0-12, firmware FW3 (flash, SPG 3.01) | Datasheet R14, sec. "Type number" |
| Constelaciones | GPS/SBAS/QZSS L1; GLONASS L1OF; BeiDou B1I; Galileo E1B/C | Datasheet R14, sec. 1.2 (tabla de señales) |
| Canales | 72 canales (motor M8) | Datasheet R14, tabla de rendimiento |
| Tasa máxima de navegación (NEO-M8N) | 5 Hz con GPS+GLO; 10 Hz con un solo GNSS (GPS, GLO, BDS, GAL) | Datasheet R14, tabla "Max navigation update rate" |
| Precisión del pulso de tiempo | RMS 30 ns; 99 % 60 ns | Datasheet R14, tabla de rendimiento |
| Frecuencia del TIMEPULSE | 0,25 Hz a 10 MHz (configurable); 1 PPS por defecto | Datasheet R14, sec. 1.15 y tabla |
| Límites operativos | Dinámica ≤ 4 g; altitud 50 000 m; velocidad 500 m/s | Datasheet R14, tabla de rendimiento |
| Precisión de velocidad / rumbo | 0,05 m/s / 0,3° | Datasheet R14, tabla de rendimiento |
| Precisión de posición | 2,5 m (GPS+GLO); 2,0 m con SBAS (GPS) | Datasheet R14, tabla de rendimiento |
| TTFF caliente | 1 s (todas las columnas) | Datasheet R14, tabla de rendimiento |
| TTFF en frío | 26 s a 45 s según constelación (asignación de columnas incierta) | Datasheet R14, tabla de rendimiento |
| Sensibilidad seguimiento | −159 a −167 dBm según constelación (asignación de columnas incierta) | Datasheet R14, tabla de rendimiento |
| Sensibilidad arranque en frío | −138 a −148 dBm según constelación (asignación de columnas incierta) | Datasheet R14, tabla de rendimiento |
| Tensión VCC | mín. 2,7 V, típ. 3,0 V (NEO-M8N/Q/J) | Datasheet R14, sec. de características eléctricas |
| Tensión V_BCKP | mín. 1,4 V | Datasheet R14, sec. de características eléctricas |
| Corriente | Hay valores de corriente de adquisición, seguimiento y power save en la datasheet, pero la extracción no permite asignarlos con certeza a cada modo | Datasheet R14 (pendiente de revisar tabla) |
| Modelo de dinámica (número CFG) | 0 portable, 2 estacionario, 3 peatón, 4 automóvil, 5 mar, 6 aéreo <1 g, 7 aéreo <2 g, 8 aéreo <4 g | Receiver description R28, UBX-CFG-NAV5 dynModel |
| Límites de dinámica aérea | Aéreo <4 g: altitud 50 000 m, velocidad horizontal 500 m/s, vertical 100 m/s; comprobación solo de altitud; desviación máxima grande | Receiver description R28, tabla "Dynamic Platform Model Details" |

## Interfaz y pines
Interfaces: UART (única), USB, DDC (I2C compatible) y SPI. SPI no está activa por defecto porque comparte pines con UART y DDC; se activa con D_SEL (datasheet R14, sec. 1.17).

Lista de pines según la tabla de pines de la datasheet R14 (los números no se extrajeron con certeza): SAFEBOOT_N, D_SEL, TIMEPULSE, EXTINT, USB_DM, USB_DP, VDD_USB, RESET_N, VCC_RF, GND, RF_IN, LNA_EN, SDA, SCL, SPI CS_N, SPI CLK, TXD, SPI MISO, RXD, SPI MOSI, V_BCKP, VCC.

Funciones relevantes:
- TXD/RXD: UART de datos, 9600 baudios por defecto, 8N1, sin autobaud (datasheet R14, sec. 1.17.1 y receiver description).
- TIMEPULSE: pulso configurable (sec. 1.15).
- LNA_EN: control de encendido de antena o LNA activo (sec. 1.21).
- VCC_RF: salida de alimentación de la sección RF.
- EXTINT: interrupción externa (sec. 1.x).
- V_BCKP: respaldo del RTC y de la RAM de respaldo (sec. 1.18.2).
- SAFEBOOT_N: el datasheet indica que el diseño debe permitir acceso a UART y SAFEBOOT_N para servicio.

**Pinout de la LilyGO T-Beam V1.x (estación):**
- GNSS TX (del ESP32 al módulo) = GPIO 12; GNSS RX (del módulo al ESP32) = GPIO 34. Velocidad por defecto en el header de ejemplo: 9600 baudios (`examples/GPS/UBlox_BasicNMEARead/utilities.h`, bloque T_BEAM_SX1262).
- La tabla de pines de la documentación t_beam_hw.md lista "GNSS (Ublox M6/M8)" en esos mismos GPIO.
- Alimentación: GPS en ALDO3 del PMU; respaldo VBACKUP etiquetado como "GNSS Backup" (t_beam_hw.md).
- Esquemático T-Beam V1.2 (`../datasheets/tbeam_v12_schematic.md`, extraído del PDF del repo): la red VBACKUP aparece junto al módulo marcado "NEO-6M/M8N" (U21) y la red GPS_VDD se alimenta desde ALDO3 del AXP2101. El texto extraído no muestra ninguna red PPS.
- PPS: la documentación indica que el LED del PPS está conectado al pin PPS del GPS. El header de la placa no define un GPIO para PPS, así que el GPIO de PPS del ESP32 queda sin confirmar.

## Configuración relevante para nuestro uso
Protocolo M8 (receiver description, UBX-CFG-*). En la M8 no existe CFG-VALSET; la configuración se hace con mensajes UBX-CFG-*.

| Mensaje / clave | Uso propuesto | Notas (fuente) |
| --- | --- | --- |
| UBX-CFG-NAV5 (dynModel) | 0 (portátil) o 2 (estacionario) en tierra | Receiver description R28. Para la estación no hay dinámica alta, por lo que no hace falta modo aéreo |
| UBX-CFG-RATE (measRate) | 1000 ms por defecto; 100 ms si se quiere 10 Hz | measRate mínimo 25 ms en versiones de protocolo ≥ 24, 50 ms en versiones anteriores (receiver description, UBX-CFG-RATE) |
| UBX-CFG-RATE (navRate) | 1 | Número de medidas por solución |
| UBX-CFG-RATE (timeRef) | 1 (GPS) o 0 (UTC) | Base temporal de las medidas |
| UBX-CFG-TP5 | Activar; 1 PPS | Parámetros del pulso y retardos (antCableDelay, rfGroupDelay) |
| UBX-CFG-NAV5 (utcStandard) | Según estándar elegido | Afecta a la conversión GPS-UTC |
| UBX-CFG-PRT | 115 200 o más | Cambio de baudios del UART |
| UBX-CFG-MSG (NAV-PVT, TIM-TP) | 1 por cada solución | Mensajes de posición y tiempo |

**Modelo dinámico en tierra:** para la estación, portátil (0) o estacionario (2). El modelo estacionario limita la velocidad horizontal a 10 m/s y la vertical a 6 m/s (receiver description, tabla de modelos dinámicos); puede servir para la referencia de tiempo de una antena fija.

**Tasa de 10 Hz:** en el NEO-M8N, 10 Hz solo se alcanza con un único GNSS. Con GPS+GLO la tasa máxima es 5 Hz. La estación no necesita 10 Hz para el TDMA si la hora la da el GNSS; 1 Hz es suficiente para la hora y el PPS.

**PPS:** el TIMEPULSE se configura con UBX-CFG-TP5. La datasheet y la receiver description indican que el pulso puede alinearse a GPS o UTC. El pulso sin fix no está bloqueado a GNSS (el receptor usa la configuración de TP5 sin lock, ver receiver description).

## Alimentación y tiempos
- VCC min 2,7 V / típ. 3,0 V; V_BCKP mín. 1,4 V (datasheet R14).
- Respaldo: el RTC funciona con un cristal de 32 kHz y, si hay batería en V_BCKP, mantiene el reloj y permite arranque en caliente y tibio (datasheet R14, sec. 1.18.2).
- Power save mode y ciclo de 1 Hz están soportados (datasheet R14, sec. 1.19.4).
- Tiempos de arranque: hot start 1 s; cold start desde 26 s (las asignaciones exactas de columna son inciertas).
- Para el arranque caliente en la T-Beam V1.x, la documentación de LilyGO indica que el módulo tiene un canal de respaldo "GNSS Backup" (VBACKUP). Confirmar si el respaldo está con batería en la estación.

## Librerías y ejemplos oficiales
- SparkFun u-blox GNSS Arduino Library (v2): es la que el README de la v3 recomienda para módulos M8 (https://github.com/sparkfun/SparkFun_u-blox_GNSS_Arduino_Library). La v3 (https://github.com/sparkfun/SparkFun_u-blox_GNSS_v3) es para M10 y ZED, y usa VALSET/VALGET, que el M8 no tiene.
- Ejemplos de LilyGO: `examples/GPS/UBlox_BasicNMEARead` y `UBlox_NMEAParsing`. Usan `Serial1` con los pines de la T-Beam V1.x.

## Trampas y notas
- Confundir la librería: la v3 no sirve para M8. Usar v2 si se programa la estación con SparkFun.
- La tasa de 10 Hz no está disponible con GPS+GLO (máximo 5 Hz). Con un único GNSS (GPS o GAL) sí se alcanza 10 Hz.
- measRate mínimo depende de la versión del protocolo (25 ms o 50 ms). Verificar la versión del firmware antes de configurar tasas altas.
- En modo estacionario, la solución se invalida si la velocidad supera 10 m/s, y en modo estacionario la antena no se debe mover.
- El dominio de tiempo del iTOW es GPS, no UTC, y no tiene segundos intercalares.
- La estación tiene el PPS en el LED de la placa; no confundir el parpadeo del LED con el flanco del pulso medido.
- Diseño: la datasheet pide dejar accesibles UART y SAFEBOOT_N para servicio.

## Incertidumbres
- Asignación de columnas en las tablas de TTFF y sensibilidad: el orden extraído no permite asignar con certeza cada valor a cada constelación. Verificar contra el PDF.
- Corrientes de consumo: la extracción no asigna valores claros a cada modo (adquisición, seguimiento, power save). Verificar en la tabla de corrientes del PDF.
- Número exacto de pin del PPS del módulo y GPIO del PPS en la placa T-Beam V1.2: no confirmados. El esquemático V1.2 en el repo, en la versión de texto extraída, no muestra la red PPS. Revisar el PDF del esquemático (`../datasheets/tbeam_v12_schematic.pdf`) a mano. La placa del proyecto puede ser V1.2 (SX1262) o V1.x (SX1276/78); la documentación de LilyGO describe la variante SX1276/78 en la tabla de pines.
- Modelo exacto del módulo instalado en la estación (NEO-M8N-0-12 o variante): hay que leer la etiqueta de la placa.
- Dimensiones y peso: no extraídos.
- Respaldo V_BCKP en la estación: depende de si hay batería de respaldo montada.
