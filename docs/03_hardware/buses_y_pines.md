---
id: buses_y_pines
estado: aprobado-v2. Es el cableado real de Pablo (ptilanom/DEMETER @ 17139b2: su CLAUDE.md §Hardware, `utilities.h`, `ext_*.cpp`). Cierra D-022.
actualizado: 2026-11-03
depende_de: [componentes, tbeam_supreme, tbeam_v12_estacion]
decisiones: [D-042]
reemplaza: 99_archivo/diseno_v1/buses_y_pines.md (D-022 opciones A′/B′, D-031)
---
# Buses y pines (v2: el cableado real)

**Lo que cambia frente a la v1:**
- Ya no hay propuestas: **esto está cableado en los dos cohetes y medido** [Pablo].
- Los pines internos de la placa salen de `utilities.h` (LilyGO); los externos, del código de Pablo (`ext_lsm.cpp`, `ext_drv.h`) y de su CLAUDE.md.

## 1. Cohetes: T-Beam Supreme V3.1 (ESP32-S3)

### 1.1 Interno de la placa

| Función | Pines | Bus / nota |
| --- | --- | --- |
| SX1262 | SCK 12, MOSI 11, MISO 13, CS 10, RST 5, BUSY 4, DIO1 1 | SPI de la radio |
| microSD + QMI8658 (IMU interno, respaldo) | SCK 36, MOSI 35, MISO 37, **CS SD 47**, **CS QMI 34**, **INT QMI 33** | **SPI compartido**, con un solo semáforo binario `g_sdBusMx` (sin herencia de prioridad, a propósito). SD a **10 MHz**. El INT del QMI es un OR por diodos de INT1/INT2: `INPUT_PULLDOWN` |
| GNSS u-blox MAX-M10S | RX 9, TX 8, EN 7, **PPS 6** | UART1 a 115200 tras configurarlo (arranca a 9600) |
| BME280 + QMC6309 | **I2C0**: SDA 17, SCL 18 | A 400 kHz; ALDO1 y pull-ups de 4,7 kΩ. La tarea `in_i2c` es su dueña |
| AXP2101 (PMU) + PCF8563 (RTC) | **I2C1**: SDA 42, SCL 41 · IRQ de la PMU 40 · INT del RTC 14 | El bucle principal es el único dueño de la PMU |
| USB | CDC nativo (`ARDUINO_USB_CDC_ON_BOOT=1`) | `Serial` = USB, no UART0 |
| Libres | IO15, IO16, IO7 (EN del GNSS en `utilities.h`) | |

### 1.2 Externo (cableado de Pablo)

| Dispositivo | Pines | Detalle |
| --- | --- | --- |
| **LSM6DSO32** (Adafruit P4692), el **IMU principal** | **SPI por software:** SCK **48**, MOSI **3**, MISO **39**, CS **2** (10 kΩ a 3V3_SENS), INT1 **38** | Los dos controladores SPI ya están ocupados (radio y SD). FIFO continuo con marca de tiempo; watermark por INT1; acel. y giro a 1667 Hz nominales (1610 Hz reales en Demeter y 1560 en Hermes), ±32 g y ±2000 °/s. Cables SPI < 10 cm |
| **BMP581** (Adafruit P6407, 0x47) | Al **SCX/SDX del LSM** (sensor hub) y al 3Vo del P4692 | A propósito: sincroniza el barómetro con el INS. ≤ 104 Hz (100,7 reales); registros 0x1D–0x22 |
| **MMC5983MA** (XJX-127, 0x30) | **I2C0** (17/18) | 100 Hz continuo, SET/RESET, pull-ups propias de 2,2 kΩ |
| Alimentación de los externos | **ALDO2 de la PMU (3V3_SENS)** | |
| **DRV5032** (Scout Makes) | **IO21**, alimentado de DC1 | 0 V con el imán. **Despierta del sueño profundo** (`ext0`). No va a `PWR_KEY` (D-031 queda reemplazada) |
| **MOSFET de actuador** | **IO45**, con 100 kΩ a GND | **Demeter:** puente de lado bajo en paralelo al botón de encendido de la Pi (J2, GND–PWR_ON). **Hermes:** actuadores mecánicos. **Sin firmware todavía** |
| **MOSFET del buzzer** | **IO46** | Buzzer **activo** de 5 V en VSYS (PEN-19 resuelto: activo, por nivel). **Sin firmware todavía** |
| **UART con la Pi (Demeter)** | **RXD 44 ← TX de la Pi; TXD 43 → 1 kΩ → RX de la Pi** (UART0) | Las masas van unidas en el pad GND; el mismo conector sirve de depuración. **Siempre activa:** tierra le manda comandos a la Pi a través de la LilyGO. **Sin firmware todavía** |

**Montaje:**
- Cable 5e sólido, reforzado con silicona y asegurado en todo su recorrido.
- En Hermes, el SCL del SPI pasa detrás de la antena. Las palabras del hub se corrompen durante la TX (1,4 % a 10 dBm); se aceptan y las filtra la mediana. Falta medirlo a 22 dBm.

## 2. Estación: T-Beam V1.2 (ESP32)

| Función | Pines / nota |
| --- | --- |
| SX1262 | Pines de LilyGO para `T_BEAM_SX1262` |
| GNSS NEO-M8N | **PPS en GPIO 37**, TX → 34, RX → 12. UBX heredado: el M8N **no admite** CFG-VALSET |
| AXP2101 | Igual que en LilyGO |
| USB | 115200, con `monitor_rts=0` y `monitor_dtr=0` |

## 3. Qué se cerró con este cableado

- **D-022** (pines y buses): **cerrada**. La SD se queda en el SPI de la placa; el QMI no se deshabilita; los externos van por SPI de software y por el hub.
- **PEN-12, PEN-17 y PEN-18:** cerrados. El PPS de la V1.2 en el 37 funciona, y el M.2 ya no hace falta.
- **PEN-19:** el buzzer es activo de 5 V.
- **D-031** (DRV5032 a `PWR_KEY`): **reemplazada**. El imán despierta del sueño profundo; el bloqueo del apagado por pulsación larga ya no aplica.
