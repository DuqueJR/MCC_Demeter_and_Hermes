---
id: tbeam_supreme
nombre: LilyGO T-Beam Supreme
tipo: placa de desarrollo ESP32-S3 + LoRa + GNSS + PMIC (computadora de vuelo base)
ubicacion: CanSat (ambos cohetes)
fabricante: LilyGO (Shenzhen Xinyuan Electronic Technology)
fuentes:
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/docs/en/t_beam_supreme/t_beam_supreme_hw.md
  - https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series (commit 1991b1ed70915d4f246b841f99f6027166ea7330, 2026-10-12)
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/examples/PMU/utilities.h
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/examples/PMU/LoRaBoards.cpp
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/examples/Sensor/QMI8658_BlockExample/QMI8658_BlockExample.ino
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/examples/LoRaWAN/RadioLib_OTAA/RadioLib_OTAA.ino
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/schematic/T-Beam-S3-Supreme/T-Beam-S3-Supreme-V3.1.pdf
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/schematic/T-Beam-S3-Supreme/T-Beam-S3-Supreme-V3.0.pdf
  - https://wiki.lilygo.cc/get_started/en/LoRa_GPS/T-Beam-SUPREME/T-Beam-SUPREME.html (solo referencia, resumen no verificado)
  - https://raw.githubusercontent.com/espressif/arduino-esp32/master/cores/esp32/esp32-hal-spi.h
  - https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/spi_master.html
datasheet_pdf: ../datasheets/tbeam_supreme_schematic.pdf (esquemático V3.1; V3.0 en ../datasheets/tbeam_supreme_schematic_v3.0.pdf)
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# LilyGO T-Beam Supreme

## Rol en el proyecto

Placa base de la computadora de vuelo del CanSat (ambos cohetes, según la hipótesis de la tabla de componentes). Integra ESP32-S3, radio LoRa SX1262 (o LR1121 según variante), GNSS, PMIC AXP2101, RTC PCF8563, OLED SH1106, magnetómetro QMC, BME280 y microSD. Los sensores externos (LSM6DSO32, BMP581, MMC5983MA) NO vienen en la placa y deben conectarse por el bus SPI externo o los headers.

## Datos clave

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| SoC | ESP32-S3FN8, 8 MB flash (Quad-SPI), 8 MB PSRAM (Quad-SPI) | hw.md, sección Product |
| Radio (variante A) | SX1262, 868/915 MHz | hw.md, sección SX1262 RF parameters |
| Radio (variante B) | LR1121, 830-945 MHz y 2.4-2.5 GHz | hw.md, sección LR1121 RF parameters; utilities.h `T_BEAM_S3_SUPREME_LR1121` |
| GNSS | Dos variantes de producto: "L76K" y "Ublox M10" (modelo exacto no indicado en la página) | hw.md, Product y Pins Map |
| RTC | PCF8563, I2C 0x51 en bus PMU (I2C1) | hw.md, I2C Devices Address |
| PMIC | AXP2101, I2C 0x34 en I2C1 | hw.md, I2C Devices Address |
| Entrada USB-C | 3.9 V a 6 V | hw.md, Electrical parameters |
| Corriente de carga | 0-1024 mA programable | hw.md, Electrical parameters |
| Batería | 3.7 V (18650 con respaldo GNSS) | hw.md, Electrical parameters y notas GPS |
| Versiones de placa | V3.0 (LED PPS azul) y V3.1 (LED PPS rojo) | hw.md, LED Description |
| Notas de uso | Conectar antena antes de transmitir | hw.md, Notes on use |

## Interfaz y pines

### Tabla de pines oficial (hw.md, sección Pins Map, idéntica en utilities.h `T_BEAM_S3_SUPREME`)

| Función | GPIO | Bus / Notas | Fuente |
| --- | --- | --- | --- |
| I2C 0 SDA | 17 | OLED SH1106, QMC, BME280 | hw.md, utilities.h `I2C_SDA` |
| I2C 0 SCL | 18 | idem | hw.md, utilities.h `I2C_SCL` |
| I2C 1 SDA (PMU) | 42 | AXP2101 + PCF8563 | hw.md, utilities.h `I2C1_SDA` |
| I2C 1 SCL (PMU) | 41 | AXP2101 + PCF8563 | hw.md, utilities.h `I2C1_SCL` |
| PMU IRQ | 40 | AXP2101 | hw.md, utilities.h `PMU_IRQ` |
| RTC INT | 14 | PCF8563 | hw.md, utilities.h `RTC_INT` |
| IMU INT | 33 | QMI8658 (interrupción) | hw.md, utilities.h `IMU_INT` |
| IMU CS | 34 | QMI8658 en bus de periféricos | hw.md, utilities.h `IMU_CS` |
| SPI periféricos MOSI | 35 | IMU + SD | hw.md, utilities.h `SPI_MOSI` |
| SPI periféricos SCK | 36 | IMU + SD | hw.md, utilities.h `SPI_SCK` |
| SPI periféricos MISO | 37 | IMU + SD | hw.md, utilities.h `SPI_MISO` |
| SD CS | 47 | microSD | hw.md, utilities.h `SPI_CS` |
| GNSS TX (MCU->GNSS) | 8 | UART, `GPS_TX_PIN` | hw.md, utilities.h |
| GNSS RX (GNSS->MCU) | 9 | UART, `GPS_RX_PIN` | hw.md, utilities.h |
| GNSS PPS | 6 | Pulso por segundo; LED PPS en placa | hw.md, utilities.h `GPS_PPS_PIN`; esquemático (net GPS_PPS) |
| GNSS EN / wake-up | 7 | `GPS_EN_PIN` en utilities.h; hw.md lo llama "Wake-up, solo L76K" | hw.md, utilities.h (CONFLICTO, ver Incertidumbres) |
| LoRa SCK | 12 | bus SPI de radio | hw.md, utilities.h `RADIO_SCLK_PIN` |
| LoRa MISO | 13 | idem | hw.md, utilities.h `RADIO_MISO_PIN` |
| LoRa MOSI | 11 | idem | hw.md, utilities.h `RADIO_MOSI_PIN` |
| LoRa CS (NSS) | 10 | idem | hw.md, utilities.h `RADIO_CS_PIN` |
| LoRa RESET | 5 | idem | hw.md, utilities.h `RADIO_RST_PIN` |
| LoRa DIO1 (SX1262) / DIO9 (LR1121) | 1 | idem | hw.md, utilities.h `RADIO_DIO1_PIN` |
| LoRa BUSY | 4 | idem | hw.md, utilities.h `RADIO_BUSY_PIN` |
| LoRa DIO0 | no usado (-1) | SX1262 no tiene DIO0 en este diseño | utilities.h `RADIO_DIO0_PIN` = -1 |
| BOOT button | 0 | personalizable | hw.md |
| UART1 TX | 43 | socket QWIIC externo (marcado libre en la tabla) | hw.md, Pins Map |
| UART1 RX | 44 | socket QWIIC externo (marcado libre en la tabla) | hw.md, Pins Map |
| LED CHG | no GPIO documentado | controlable por programa, `setChargingLedMode` | hw.md, LED Description; LoRaBoards.cpp |

Dispositivos y direcciones I2C (hw.md, I2C Devices Address):

| Dispositivo | Dirección 7 bit | Bus | Nota |
| --- | --- | --- | --- |
| OLED SH1106 | 0x3C o 0x3D | I2C 0 (17/18) | Depende de versión de placa (ver Incertidumbres) |
| MAG QMC6310U | 0x1C | I2C 0 | |
| MAG QMC6310N | 0x3C | I2C 0 | |
| MAG QMC6309 | 0x7C | I2C 0 | Misma dirección que la OLED en 0x3C (hw.md) |
| BME280 | 0x77 (0x76 con puente a pad fijo) | I2C 0 | |
| PCF8563 (RTC) | 0x51 | I2C 1 (41/42) | |
| AXP2101 (PMU) | 0x34 | I2C 1 (41/42) | |

Bus SPI de periféricos (IMU + SD), pines compartidos: MOSI 35, MISO 37, SCK 36. La radio tiene su propio bus (11/12/13/10), según hw.md nota 2.

Pines expuestos en headers/pads (hw.md):
- Socket QWIIC externo: UART1 en GPIO 43 (TX) y 44 (RX), y alimentación de canal externo.
- Cabecera externa alimentada por BLDO2 (300 mA).
- Socket M.2 externo, alimentado por DC3 (2 A), DC4 (1.5 A) y DC5 (1 A).
- Pad fijo para cambiar la dirección del BME280 a 0x76.
- En el esquemático V3.1 aparece un conector "Expansion board Interface" (headers de 2x38/2x40 con pines numerados) y un conector M.2 B-key (P1, pines B-1..B-75). Los nombres de cada pin no son legibles en el render, así que el mapa GPIO-a-pin del conector NO está confirmado.

## Configuración relevante para nuestro uso

### Bus SPI y hosts (CRÍTICO)

- En el ESP32-S3 hay dos controladores SPI de propósito general: SPI2_HOST (FSPI, valor 0 en arduino-esp32) y SPI3_HOST (HSPI, valor 1). SPI0/SPI1 no son de uso general (advertencia de ESP-IDF).
- LoRa (radio): usa el bus SPI por defecto de Arduino, `SPI.begin(RADIO_SCLK_PIN, RADIO_MISO_PIN, RADIO_MOSI_PIN)`. Es decir, FSPI/SPI2. (LoRaBoards.cpp, `setupBoards`)
- SD y IMU QMI8658: comparten el bus de periféricos con `SPIClass SDCardSPI(HSPI)` (SPI3). El ejemplo oficial del QMI8658 hace `qmi.begin(SDCardSPI, IMU_CS)`. (LoRaBoards.cpp; QMI8658_BlockExample.ino)
- Conclusión oficial: los dos hosts de propósito general quedan ocupados (radio = SPI2, IMU+SD = SPI3). NO hay un host SPI libre en el diseño oficial para un tercer bus externo sin compartir. Opciones documentadas en el código: reutilizar el bus de periféricos (SPI3) para sensores externos con CS propio, o reutilizar el bus de la radio. Ninguna de estas opciones aparece en la fuente oficial como recomendada.
- La macro `SD_SHARE_SPI_BUS` (que comparte SD con la radio) aparece en utilities.h, pero está en el bloque del T-Beam 1W, NO en el bloque de la Supreme. En la Supreme la SD va en su propio `SDCardSPI`.

### Inicialización del AXP2101 (LoRaBoards.cpp, `beginPower()`, bloque `T_BEAM_S3_SUPREME`)

- `PMU_WIRE_PORT = Wire1` (I2C 1: GPIO 42/41).
- `setChargingLedMode(XPOWERS_CHG_LED_CTRL_CHG)`.
- `pinMode(PMU_IRQ, INPUT_PULLUP)` y `attachInterrupt(PMU_IRQ, ..., FALLING)`.
- Secuencia de canales en el código (ver tabla de canales en Alimentación).
- Antes de encender ALDO1, ALDO2 y BLDO1 se apagan 250 ms, pero solo si la causa de despertar NO es un sleep (`esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_UNDEFINED`), para liberar el bus.
- Nota: el ejemplo oficial deshabilita VBACKUP en la Supreme (aunque hw.md dice que el respaldo GNSS sale de la batería).

### GNSS

- Arranque en `setupBoards`: `pinMode(GPS_EN_PIN, OUTPUT); digitalWrite(GPS_EN_PIN, HIGH);` (GPIO 7 en alto), `pinMode(GPS_PPS_PIN, INPUT)`, y `SerialGPS.begin(9600, SERIAL_8N1, GPS_RX_PIN=9, GPS_TX_PIN=8)`.
- Velocidad GNSS: 9600 baudios en el bloque Supreme (`GPS_BAUD_RATE 9600`).
- Consumidor de energía del GNSS: canal ALDO4 (300 mA).

### Radio SX1262 (ejemplo RadioLib_OTAA)

- `radio.setDio2AsRfSwitch(true)` para SX1262.
- En el ejemplo, `setTCXO(3.0)` aparece solo para LR1121 (rama `USING_LR1121`). NO hay evidencia en las fuentes de TCXO en la rama SX1262 de esta placa.
- Pines de RadioLib usados: CS=10, DIO1=1, RST=5, BUSY=4.

### Pines de encendido

- PWR (botón): conectado al PMU. Apagado: pulsar para encender. Encendido: mantener 6 s para apagar (tiempo por defecto).
- Señal `PWR_KEY` aparece en la sección "Button" del esquemático V3.1 (ver Alimentación).

## Alimentación y tiempos

### Canales AXP2101 (hw.md, PowerManage Channel, confirmado por LoRaBoards.cpp)

| Canal | Alimenta | Máx. corriente | Nota |
| --- | --- | --- | --- |
| DC1 | ESP32-S3 | 2 A (800 mA operación ESP) | Protegido en el código |
| DC2 | sin uso | | Apagado en el código |
| DC3 | socket M.2 externo | 2 A | Encendido a 3.3 V en el código |
| DC4 | socket M.2 externo | 1.5 A | Encendido a `XPOWERS_AXP2101_DCDC4_VOL2_MAX` |
| DC5 | socket M.2 externo | 1 A | Encendido a 3.3 V en el código |
| LDO1 (VRTC) | sin uso | | |
| ALDO1 | BME280, pantalla OLED, magnetómetro QMC | 300 mA | Según hw.md. Power-cycle al arrancar |
| ALDO2 | sensores | 300 mA | Power-cycle al arrancar |
| ALDO3 | radio LoRa | 300 mA | Encendido en código |
| ALDO4 | GNSS | 300 mA | Encendido en código |
| BLDO1 | microSD | 300 mA | Power-cycle al arrancar |
| BLDO2 | cabecera externa | 300 mA | |
| DLDO1 / DLDO2 | sin uso | | Apagados en código |
| CPUSLDO | sin uso | | |
| VBACKUP | sin uso según hw.md | | Apagado en código (ver Incertidumbres) |

Tiempos y secuencias:
- Retardo de power-cycle de ALDO1, ALDO2 y BLDO1 al arrancar: 250 ms (código).
- Tiempos de estabilización de canales AXP2101: NO encontrados en las fuentes.
- Consumos de sensores I2C0 (ALDO1 y ALDO2): no medidos en las fuentes.

Restricción oficial (hw.md, nota de I2C): "si el dispositivo I2C está en pines 17/18, su alimentación debe conectarse a DC1. Si está en otro LDO, la alimentación debe activarse antes de acceder al bus, o el acceso falla o se bloquea." Ver Incertidumbres: el código alimenta los sensores de I2C0 desde LDOs, no desde DC1.

### Interruptor Hall y pin EN (pregunta 5)

- En las fuentes NO aparece ningún pin EN dedicado, ni pin de encendido por hardware del ESP32.
- El esquemático V3.1 (sección "Button") muestra las etiquetas `CHIP_PU`, `GPIO0` y `PWR_KEY`. `CHIP_PU` es el nombre de Espressif del pin de reset/habilitación del ESP32-S3 (esto es conocimiento de Espressif, no de LilyGO). Si el Hall lleva `CHIP_PU` a bajo, el ESP32 queda en reset, pero los rieles del AXP2101 no se cortan (INFERENCIA, no confirmada por LilyGO).
- No hay ninguna fuente que documente el comportamiento de un interruptor Hall DRV5032 en esta placa.

## Librerías y ejemplos oficiales

- Repositorio: https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series (commit 1991b1ed70915d4f246b841f99f6027166ea7330).
- Definiciones de pines por placa: `examples/PMU/utilities.h` (bloque `T_BEAM_S3_SUPREME_SX1262` o `T_BEAM_S3_SUPREME_LR1121`, líneas 480-530). El mismo bloque está en `examples/GPS/UBlox_BasicNMEARead/utilities.h`, `examples/SD/SD_Test/utilities.h`, `examples/Sensor/QMI8658_BlockExample/utilities.h`, entre otros.
- Inicialización de hardware: `examples/PMU/LoRaBoards.cpp` (`setupBoards`, `beginPower`).
- IMU con SD compartida: `examples/Sensor/QMI8658_BlockExample/QMI8658_BlockExample.ino`.
- Radio: `examples/LoRaWAN/RadioLib_OTAA/RadioLib_OTAA.ino` (RadioLib).
- Activar placa en Arduino: `#define T_BEAM_S3_SUPREME_SX1262` o `T_BEAM_S3_SUPREME_LR1121` en `utilities.h`.
- Ajustes Arduino: ESP32S3 Dev Module, PSRAM = QSPI, Flash 8 MB, USB CDC On Boot = Enable, USB Mode = CDC and JTAG (hw.md).
- Otras librerías referenciadas: XPowersLib (AXP2101), RadioLib (SX1262/LR1121), SensorLib (QMI8658), SH1106 U8g2, Adafruit_BME280.

## Trampas y notas

1. Radio con bus propio, pero IMU y SD comparten el bus de periféricos (HSPI). Dos dispositivos SPI con CS distinto en el mismo bus requieren cuidado al cambiar de modo SPI.
2. GNSS wake-up (GPIO 7) es L76K. En el código de la Supreme GPIO 7 se usa como `GPS_EN_PIN` y se pone en alto al arrancar. Revisar con la variante real.
3. Los pines I2C 17/18 deben alimentarse desde DC1 según hw.md. Los ejemplos los alimentan desde ALDO1/ALDO2. Si el sensor no responde, probar primero la alimentación.
4. Los sensores I2C0 pueden bloquear el bus si el LDO no está encendido antes del acceso (hw.md).
5. La SD y el magnetómetro se apagan y se encienden al arrancar (250 ms) para liberar el bus, salvo que la placa despierte de sleep.
6. Antena: conectarla antes de transmitir (daño del RF).
7. LR1121 en sub-GHz con potencia menor a 14 dBm presenta potencia anómala (hw.md, issue #254 del repo).
8. El consumo de la radio y del GNSS no está documentado en las fuentes.
9. El GNSS tiene backup por batería 18650 para hot start (hw.md); sin batería no hay hot start.

## Incertidumbres

Lo que NO se pudo confirmar con fuentes oficiales:

1. **Modelo exacto del GNSS**. La página dice "Ublox M10" y enlaza MAX-M10 (u-blox). El modelo MAX-M10S NO aparece en la documentación de LilyGO. El repo incluye `datasheets/max_m10s.md` (datasheet local, no revisado en esta ficha) y el wiki de LilyGO habla de MAX-M10S (el resumen del wiki no es fuente verificable). Confirmar con la placa o el número de pedido.
2. **Cómo distinguir L76K de Ublox M10** en la placa física. La documentación solo distingue por variante de producto (SKU del tienda), no por marcado. Se propone comprobar el módulo GNSS con la pieza en mano.
3. **PPS**: GPIO 6 está confirmado (hw.md, utilities.h, net GPS_PPS en esquemático). Falta confirmar si el PPS del MAX-M10S sale en el mismo pin en ambas variantes. Las fuentes lo sugieren pero no lo prueban por separado para cada módulo.
4. **Conflicto GPIO 7**: hw.md dice que es wake-up solo en L76K, pero utilities.h de la Supreme lo define como `GPS_EN_PIN` y lo activa. No se resolvió.
5. **Conflicto VBACKUP**: hw.md dice que el respaldo GNSS sale de la batería 18650, pero el código de la Supreme apaga VBACKUP. No se resolvió.
6. **Conflicto alimentación I2C0**: hw.md exige DC1 para los sensores en 17/18, y el código los alimenta desde ALDO1/ALDO2. Se desconoce el comportamiento real.
7. **Conflicto OLED / magnetómetro**: hw.md dice OLED 0x3C o 0x3D con QMC6310U/N. El esquemático V3.1 dice: VHF (R52=0R) OLED 0x3C; UHF (R52=NC) OLED 0x3D. Depende de la banda de la placa. Confirmar con la placa.
8. **IMU a bordo**: el esquemático V3.1 (sección IMU) dibuja un U5 "MPU-6886" con pines NC y, junto al mismo bus, un QMI8658A. No se sabe qué IMU está montada en la placa real. Los ejemplos (y hw.md) dicen QMI8658.
9. **Mapa GPIO de los conectores expansión y M.2**: el render del esquemático no permite leer los nombres de los pines. Por eso no se confirmaron los GPIO libres en headers.
10. **GPIO libres**: según la tabla oficial, no usados por el diseño son GPIO 2, 3, 15, 16, 21, 38, 39, 45, 46 y 48, además de 43 y 44 (libres en el socket QWIIC). De estos, solo 43/44 están confirmados como expuestos (QWIIC). Los demás están en el silicio y NO se confirma que estén en un header de la placa. El texto del esquemático menciona GPIO21, GPIO38, GPIO39, GPIO45, GPIO46 y GPIO48 en etiquetas, sin contexto claro. Confirmar en el esquemático en tamaño completo.
11. **Host SPI libre**: la conclusión de "no hay host libre" depende de que el diseño use la SD y la IMU en el HSPI (confirmado por el ejemplo oficial). Un tercer bus sería un bus compartido o un host reasignado. No se investigó si el ESP32-S3 permite un bus software (bit-banging).
12. **TCXO del SX1262**: no hay evidencia en las fuentes de un TCXO en la variante SX1262. El ejemplo lo configura solo para LR1121.
13. **Tiempos de estabilización** de canales AXP2101 y consumo de cada periférico: no encontrados.
14. **Hall DRV5032 y pin EN**: no hay ninguna fuente sobre el uso de un Hall como interruptor en esta placa. El pin `CHIP_PU` aparece en el esquemático, pero el comportamiento de encendido queda sin confirmar.
15. **Pines ADC de batería**: no se encontró en las fuentes el pin de medición de batería (la placa lo lee a través del AXP2101 según la documentación del PMU, no confirmado).
16. **Resumen del wiki LilyGO** (wiki.lilygo.cc): el resumen automático dio versiones de RTC (PCF85063ATL) y de frecuencia de LoRa (433/868/915/923 MHz) que contradicen hw.md. No se usó como fuente.
