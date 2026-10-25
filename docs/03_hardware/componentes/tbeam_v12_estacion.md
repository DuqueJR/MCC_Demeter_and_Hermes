---
id: tbeam_v12_estacion
nombre: LilyGO T-Beam V1.2 (estación terrena, radio SX1262)
tipo: Placa de desarrollo ESP32 + LoRa + GNSS + PMIC
ubicacion: Estación
fabricante: LilyGO (Shenzhen Xinyuan Electronic Technology)
fuentes:
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/examples/LoRa/Transmit_Interrupt/utilities.h
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/examples/LoRa/Transmit_Interrupt/LoRaBoards.h
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/examples/LoRa/TBeam_AXP2101/SX1262_PingPong/SX1262_PingPong.ino
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/examples/GPS/UBlox_BasicNMEARead/LoRaBoards.cpp
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/docs/en/t_beam/t_beam_hw.md
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/schematic/LilyGo_TBeam_V1.2-lastest.pdf
  - https://lilygo.cc/products/t-beam
  - https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf
datasheet_pdf: ../datasheets/tbeam_v12_schematic.pdf (esquemático oficial V07, 5 hojas; el datasheet del chip está en ../datasheets/esp32_d0wdq6.pdf)
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# LilyGO T-Beam V1.2 (estación terrena)

## Rol en el proyecto

Módem de la estación terrena: ESP32 con radio LoRa SX1262 (915 MHz según el equipo), GNSS u-blox (NEO-6M/M8N según el esquemático) y PMIC AXP2101. Se conecta al portátil por USB-serial. El GNSS es necesario para la sincronización TDMA por PPS; ver "Interfaz y pines" y "Incertidumbres".

## Datos clave

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| SoC | ESP32-D0WDQ6 (dual-core, 4 MB flash) | t_beam_hw.md (tabla Product) |
| Radio LoRa (opción de firmware) | `T_BEAM_SX1262` (define de placa) | utilities.h, bloque de modelos |
| Radio LoRa (tienda) | "SX1278 [433] / SX1276 [868/915/923]" | lilygo.cc/products/t-beam |
| GNSS | Símbolo "NEO-6M/M8N" en el esquemático; "NE0-6M" en la web | esquemático hoja 3; lilygo.cc |
| PMIC | AXP2101 (I2C 0x34) | t_beam_hw.md; LoRaBoards.cpp (beginPower) |
| USB-serial | CP2104 en el esquemático V07; "CH9102" en la web y en t_beam_hw.md | esquemático hoja 2; lilygo.cc |
| Conector USB | MICRO_USB_SMT (J1) en el esquemático; "USB Micro" en la web; t_beam_hw.md dice USB-C | esquemático hoja 2; lilygo.cc |
| Alimentación USB | 3,9 V a 6 V | t_beam_hw.md (Electrical parameters) |
| Carga de batería | 0 a 1024 mA programable (la demo SX1262 fija 500 mA) | t_beam_hw.md; SX1262_PingPong.ino |
| Batería | Li-ion 3,7 V (18650) | t_beam_hw.md |
| PSRAM | 8 MB QSPI según t_beam_hw.md; el esquemático muestra un IPS6404 (SPI RAM) | t_beam_hw.md; esquemático hoja 4 |
| Antena LoRa | Conector "ANT_JACK" (ANT3), tipo no especificado | esquemático hoja 1 |
| Antena GNSS | Conector "ANT_JACK" (ANT4), tipo no especificado; ruta por 22 uH y 100 Ω | esquemático hoja 3 |
| Antena Wi-Fi | IPEX (J39), conmutable | t_beam_hw.md (WiFi-IPEX); esquemático hoja 4 |

## Interfaz y pines

Pines del modo `T_BEAM_SX1262` (bloque de placa de utilities.h). El ejemplo oficial SX1262_PingPong.ino usa los mismos valores.

| Función | GPIO | Notas | Fuente |
| --- | --- | --- | --- |
| LoRa SCK | 5 | | utilities.h |
| LoRa MISO | 19 | | utilities.h |
| LoRa MOSI | 27 | No es el pin por defecto de VSPI (23); se asigna por matriz de GPIO | utilities.h |
| LoRa CS (NSS) | 18 | | utilities.h |
| LoRa RST | 23 | | utilities.h |
| LoRa DIO1 | 33 | Interrupción de fin de TX/RX (en el ejemplo, `setDio1Action`) | utilities.h; SX1262_PingPong.ino |
| LoRa BUSY | 32 | Sólo SX1262; en SX1276 este pin es DIO2 | utilities.h |
| LoRa DIO0 | 26 | Definido, no usado por el ejemplo SX1262 | utilities.h |
| LoRa TCXO enable | no definido | Ningún pin TCXO en el bloque de placa | utilities.h |
| GNSS RX (desde el ESP32 hacia el GNSS, TX del GNSS hacia el ESP32) | 34 (GPS_RX_PIN) | GPIO34 es sólo entrada | utilities.h |
| GNSS TX (desde el ESP32 hacia el GNSS) | 12 (GPS_TX_PIN) | GPIO12 es strapping (MTDI) | utilities.h |
| GNSS PPS | no definido en firmware de V1.2; el esquemático lo enruta a GPIO37 | ver nota abajo | esquemático hoja 3 |
| I2C SDA (AXP2101 y bus) | 21 | | utilities.h; esquemático hoja 5 |
| I2C SCL (AXP2101 y bus) | 22 | | utilities.h; esquemático hoja 5 |
| PMU IRQ (AXP2101) | 35 | Pull-up de 47 kΩ a 3V3 en el esquemático; sólo entrada | utilities.h; esquemático hoja 5 |
| LED usuario | 4 | Activo en LOW (`LED_ON` = LOW) | utilities.h |
| LED de carga (CHG) | en AXP2101 | Controlable por software | t_beam_hw.md |
| Botón usuario | 38 | Sólo entrada | utilities.h |
| Botón PWR | en AXP2101 | 6 s para apagar | t_beam_hw.md |
| Botón RST | EN del ESP32 | | esquemático hoja 2 |
| Botón BOOT | GPIO0 | | esquemático hoja 4 |
| OLED | sin OLED en la definición de placa | `HAS_DISPLAY` comentado ("no OLED") en utilities.h; t_beam_hw.md lo lista como SSD1306 opcional | utilities.h; t_beam_hw.md |
| EEPROM 24AA32A (GNSS) | bus GSCL/GSDA separado del bus I2C del ESP32 | U20 en esquemático hoja 3 | esquemático hoja 3 |

Notas sobre PPS (derivadas del esquemático, no confirmadas por firmware oficial):
- El pin TIME_PULSE del GNSS (pin 3) va al LED rojo `LED_G2` a través de 2 kΩ (R34) y, en el mismo nodo, a GPIO37 vía 470 Ω (R41). La conexión a IO37 es la lectura del esquemático: el net "IO37" aparece en la hoja 3 y en la hoja 4.
- GPIO37 es entrada sólo (GPIO34 a 39), adecuada para PPS.
- t_beam_hw.md dice que el LED PPS "está conectado al pin PPS del GPS", sin dar el GPIO.

Mapa de cableado de radio (esquemático hoja 1): el módulo "TTGO LORA" (U22) tiene etiquetas tipo SX1276 (IO26=DIO0/IO0, IO23=IRQ/RESET, IO18=NSS, IO5=SCK, IO27=MOSI, IO19=MISO). Las etiquetas del esquemático no coinciden con la ruta SX1262 de utilities.h (BUSY 32 y DIO1 33): ver Incertidumbres.

## Configuración relevante para nuestro uso

- Modelo a compilar: `#define T_BEAM_SX1262` en utilities.h. Sólo puede estar activa una definición de placa.
- Inicialización de PMU: el código oficial intenta primero AXP2101 y luego AXP192 en la misma dirección I2C (0x34), antes de configurar canales (LoRaBoards.cpp, `beginPower()`).
- Canales AXP2101 para ESP32 (rama `CONFIG_IDF_TARGET_ESP32` de LoRaBoards.cpp):
  - DC1: alimenta el ESP32. Está protegido por el firmware; no configurar.
  - ALDO2: radio LoRa, 3,3 V, activado.
  - ALDO3: GNSS, 3,3 V, activado.
  - VBACKUP: respaldo RTC del GNSS, 3,3 V, activado.
  - Desactivados: DC2, DC3, DC4, DC5, ALDO1, ALDO4, BLDO1, BLDO2, DLDO1, DLDO2, CPUSLDO.
  - Coincide con la tabla oficial de t_beam_hw.md (DC1=ESP32, ALDO2=Radio, ALDO3=GPS, VBACKUP=GNSS backup).
- Arranque de radio del ejemplo: `radio.begin(868.0)` con `setOutputPower(22)` dBm, sin TCXO ni RF switch configurados. La frecuencia de Hermes (915 MHz) se debe ajustar al plan de frecuencias del concurso.
- Cargador: el ejemplo fija 500 mA con `XPOWERS_AXP2101_CHG_CUR_500MA`.

## Alimentación y tiempos

| Concepto | Dato | Fuente |
| --- | --- | --- |
| Entrada USB | 3,9 V a 6 V | t_beam_hw.md |
| Rail de radio | 3,3 V desde ALDO2 (se activa en `beginPower`) | LoRaBoards.cpp; utilities |
| Rail de GNSS | 3,3 V desde ALDO3; VBACKUP 3,3 V | LoRaBoards.cpp |
| Orden de arranque | El ESP32 arranca antes que el PMU. Los rails de radio y GNSS se activan sólo tras `beginPower()`. | Inferencia de LoRaBoards.cpp; no verificada en hardware |
| Carga | 0 a 1024 mA, 500 mA en la demo | t_beam_hw.md; SX1262_PingPong.ino |

No hay tiempos de transición de radio (TX/RX) ni de reinicio del GNSS en las fuentes consultadas. Hay que medirlos en hardware.

## Librerías y ejemplos oficiales

- Repositorio: https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series (ramas y carpetas citadas arriba).
- Ejemplo SX1262 con AXP2101: `examples/LoRa/TBeam_AXP2101/SX1262_PingPong/SX1262_PingPong.ino` (usa RadioLib y XPowersLib, con `XPOWERS_CHIP_AXP2101`).
- Ejemplo SX1262 de T-Beam 1W: `examples/LoRa/TBeam1W/SX1262_PingPong` (placa distinta).
- Ejemplo de GNSS: `examples/GPS/UBlox_BasicNMEARead` (usa `beginPower()` y `beginGPS()`).
- Librerías de radio: RadioLib (jgromes), XPowersLib (Lewis He / XPowers).
- Firmwares precompilados `tbeam-v1.x-all-band-sx1262-factory-20260817_0x0.bin` disponibles en el repo, para comprobar el modelo.

## Trampas y notas

- MOSI en GPIO27 no es el pin VSPI por defecto (23). Hay que pasar los pines a `SPI.begin` explícitamente.
- GPIO12 (GNSS TX) es MTDI, un strapping. Si está en alto en el arranque, el flash interno (3,3 V) puede fallar. Como el GNSS se alimenta después del arranque, su TX puede quedar en alta impedancia o en bajo al encender el ESP32. Esto es una inferencia no verificada.
- GPIO34, 35, 37 y 38 son sólo entrada y no tienen pull-up interno. El IRQ del PMU tiene pull-up externo; el PPS también necesita revisión en hardware.
- GPIO16 y 17 se usan para la SPI RAM del esquemático; no usar para otras funciones.
- Antena: la documentación oficial dice que hay que conectar la antena antes de transmitir para no dañar el módulo RF.
- Los documentos oficiales tienen versiones contradictorias (CP2104 frente a CH9102, USB Micro frente a USB-C). Verificar el marcado de la placa física antes de comprar cables o drivers.

## Incertidumbres

1. **Chip de radio (SX1262 frente a SX1276/SX1278).** El equipo confirma SX1262. La web de LilyGO dice "SX1278 [433] / SX1276 [868/915/923]". El esquemático V07 (2019) etiqueta el módulo como "TTGO LORA" con nombres de pin SX1276. No hay fuente oficial encontrada que indique cómo se marca el SX1262 en la placa. Pendiente: leer el marcado del módulo en la placa física y comparar con el build `T_BEAM_SX1262`.
2. **TCXO.** No hay pin TCXO en `T_BEAM_SX1262` y el ejemplo no lo configura. No se ha confirmado si la placa usa cristal o TCXO. Pendiente.
3. **PPS.** El esquemático lleva TIME_PULSE a IO37. Ningún firmware oficial de V1.2 define GPS_PPS_PIN, y la web no lo menciona. Pendiente: confirmar con un multímetro o un osciloscopio sobre IO37 con el GNSS con fix.
4. **Chip USB-serial.** Esquemático V07: CP2104 (U10). Web de LilyGO y t_beam_hw.md: CH9102 (driver WCH necesario en macOS y Windows según t_beam_hw.md). Pendiente: identificar el chip por el marcado o con `system_profiler SPUSBDataType` en el portátil.
5. **Velocidad máxima USB-serial.** CP2104: 2 Mbps según hojas de datos de terceros (Silicon Labs no revisada directamente; el propio fabricante recomienda CP2102N para diseños nuevos). CH9102: 4 Mbps según hoja WCH (fuente de búsqueda, no descargada). Para la velocidad real hay que medir con la placa; el valor de diseño debe quedar por debajo del máximo del chip que tenga la placa.
6. **Conector de antena LoRa.** Esquemático: "ANT_JACK" (ANT3), tipo no especificado. Web de LilyGO: no lo dice. Un anuncio de V1.2 dice "RG316" (es un tipo de cable, no de conector). La documentación de Meshtastic menciona SMA para la V1.1, no para la V1.2. **Hay que verificar visualmente el conector antes de comprar el pigtail.** Sin confirmación, no fijar SMA ni IPEX.
7. **Conector de antena GNSS.** Mismo símbolo "ANT_JACK" (ANT4), tipo no especificado. Hay una antena cerámica incluida según la web.
8. **Modelo GNSS.** El esquemático dice "NEO-6M/M8N"; el equipo indica NEO-M8N. La web de LilyGO dice NEO-6M. Confirmar por el marcado del módulo.
9. **Conector USB.** Esquemático y web: USB Micro. t_beam_hw.md menciona USB-C. Confirmar en la placa física.
10. **PSRAM.** t_beam_hw.md dice 8 MB; el esquemático muestra un IPS6404 (la capacidad no está en la hoja), y la hoja de flash es un W25Q32 (4 MB). Confirmar si la placa tiene PSRAM.
11. **Pines libres.** La tabla oficial marca todos sus pines como usados (columna "Free" con ❌). No se ha encontrado una lista oficial de GPIO libres.
12. **Tiempos de arranque.** No hay fuente sobre el orden exacto de encendido entre ESP32, AXP2101 y GNSS. Lo indicado en Alimentación es una inferencia de LoRaBoards.cpp.
