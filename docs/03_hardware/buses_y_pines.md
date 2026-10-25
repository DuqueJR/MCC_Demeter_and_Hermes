---
id: buses_y_pines
estado: aprobado (D-022 y D-031). Asignación definida por el documentador el 2026-10-24 por delegación del usuario; el cableado todavía no está hecho.
actualizado: 2026-10-24
depende_de: [tbeam_supreme, esp32_s3, lsm6dso32, bmp581, mmc5983ma, qmi8658, drv5032, axp2101]
---
# Buses y pines de la T-Beam Supreme (CanSat): asignación definitiva v1

Las fuentes están en las fichas [tbeam_supreme](componentes/tbeam_supreme.md) y [esp32_s3](componentes/esp32_s3.md), y en el [esquemático V3.1](datasheets/tbeam_supreme_schematic.pdf).
- ✅ = confirmado en el repo oficial de LilyGO.
- 🔎 = leído en el esquemático: se verifica con el multímetro al cablear (T-004).
- **Esta tabla manda: el cableado se hace según ella.**

## 1. Lo que ya ocupa la placa ✅

| Función | GPIO | Bus o host |
| --- | --- | --- |
| I2C0: OLED SH1106, QMC6310 y BME280 | SDA 17, SCL 18 | `Wire` (I2C0). **Se alimenta por ALDO1, que debe encenderse antes de tocar el bus.** |
| I2C1: AXP2101 (0x34) y PCF8563 (0x51) | SDA 42, SCL 41 | `Wire1` |
| IRQ del PMU / interrupción del RTC | 40 / 14 | |
| SPI de la radio: SX1262 | SCK 12, MOSI 11, MISO 13, CS 10, RST 5, BUSY 4, DIO1 1 | **SPI2 (FSPI)**, solo la radio |
| SPI de periféricos: SD y QMI8658 | SCK 36, MOSI 35, MISO 37 · CS de la SD 47 · CS de la IMU 34 · INT de la IMU 33 | **SPI3 (HSPI)** |
| GNSS | TX 8, RX 9, **PPS 6**, EN o wake 7 (las fuentes se contradicen; ver PEN-12) | UART |
| Botón BOOT / USB CDC | 0 / 19, 20 | |
| Flash / PSRAM (QSPI) | 26–32 (reservados) | SPI0/1 |

El ESP32-S3 solo tiene **2 hosts SPI de uso general, y los dos están ocupados**. Por eso no existe un tercer bus SPI "aislado".

## 2. Qué sale al conector de expansión 🔎

En el esquemático V3.1, el conector M.2 B-key ("Expansion board Interface") lleva estas señales:
- `SPI_SCK`, `SPI_MOSI`, `SPI_MISO`, `IMU_CS`, `IMU_INT` y `SD_CS`: es decir, **el bus de periféricos 35/36/37 está expuesto**. Es el "SPI externo" del que habla Pablo.
- `SCL` y `SDA` (I2C0);
- `GPIO21`, `GPIO38`, `GPIO39`, `GPIO45`, `GPIO46` y `GPIO48`;
- `U0TXD` y `U0RXD` (GPIO 43 y 44, también en el conector QWIIC);
- `PWR_KEY` (el botón del AXP2101) y `CHIP_PU`;
- USB y alimentación.

**Los GPIO 2, 15 y 16 no aparecen en el conector**, así que no se usan. El GPIO 3 tampoco está confirmado.

## 3. D-022 (cerrada): topología de sensores

| Sensor | Bus | Por qué |
| --- | --- | --- |
| **LSM6DSO32** | **SPI3** (el bus de periféricos), con su propio CS | Es lo que dijo Pablo ("todos los sensores en el mismo SPI"). Está expuesto en el conector y aguanta 3,33 kHz. |
| **BMP581** | **SPI3**, con su propio CS | Ídem. FIFO a 240 Hz. |
| **MMC5983MA** | **I2C0** (0x30), leído a 100 Hz sin INT | 1) *Objetivos* pone el magnetómetro en I2C0. 2) **No alcanzan los GPIO expuestos** para un tercer CS más las señales de Demeter. 3) A 100 Hz, una lectura de 7 B tarda unos 0,3 ms a 400 kHz. 4) Si no tiene FIFO, en I2C deja de competir con la SD. 0x30 no choca con 0x1C, 0x3C/0x3D ni 0x77. |
| QMI8658, SD | SPI3 (ya están) | Respaldo y almacenamiento |
| QMC6310, BME280, OLED | I2C0 (ya están) | El OLED **no se refresca en vuelo** |

**Reglas del bus SPI3 compartido.** Todas son obligatorias y se validan en P-02.
1. **Una sola tarea es dueña del bus** (`t_bus_spi3`, en el núcleo 1). Hace las lecturas de los FIFO y las escrituras de la SD **en bloques cortos e intercalados**.
   - Ninguna escritura a la SD puede tener el bus más de `SPI3_SD_MAX_MS` seguidos.
   - **Margen del FIFO del LSM6DSO32 a 3,33 kHz:** unos 66 ms si es de 3 KB (el peor caso) o unos 197 ms si es de 9 KB.
   - **Margen del BMP581:** unos 133 ms.
2. Si P-02 falla, el orden de recorte es: bajar la IMU a 1,66 kHz; después, la SD a SDMMC (plan B, ver la §6).
3. **Todos los CS con pull-up de 10 kΩ a 3V3**, sobre todo el del BMP581: si su CS baja en el arranque, cambia a SPI de forma irreversible.
4. **El LSM6DSO32 con `I2C_disable`.** Modo SPI y reloj **por dispositivo**: BMP581 ≤ 12 MHz, MMC no aplica (va por I2C), LSM6DSO32 según su ficha, y la SD puede ir más rápido.

## 4. D-031: encendido con el DRV5032 (Adafruit 6051, ScoutMakes, omnipolar)

- **Conexión:** la salida del DRV5032 va a **`PWR_KEY`** (el botón de encendido del AXP2101), **a través de un diodo Schottky**.
  - El ánodo va a `PWR_KEY` y el cátodo a la salida del DRV. Así el sensor **solo puede llevar la línea a masa**, haga lo que haga su salida (push-pull u open-drain).
  - El DRV5032 se alimenta de **VBAT**, que siempre está presente aunque el PMIC esté apagado (1,65–5,5 V; consumo de µA).
  - 🔎 Hay que verificar en el conector o en un pad dónde tomar VBAT y la masa.
- **Comportamiento:**
  - **Imán ~1 s cerca del fuselaje:** es como pulsar el botón; el PMIC enciende la placa y el firmware entra en BOOT.
  - **Antes de eso, la placa está apagada del todo:** con el PMIC apagado, el consumo es mínimo. Es el "reposo absoluto" de *Objetivos* 3.1, que permite sellar el cohete en rampa.
  - **Imán sostenido `PMIC_PWRON_APAGADO_S` (10 s):** apagado por hardware del PMIC. Solo debe funcionar en tierra. **El firmware desactiva el apagado por pulsación larga al entrar en ARMED, y lo reactiva en DISARM y en LANDED** (🔎: verificar el registro en la ficha [axp2101](componentes/axp2101.md) o en XPowersLib).
  - Las pulsaciones cortas llegan al firmware como una IRQ del PMU (GPIO 40). En v1 no tienen función.
- **Por qué no CHIP_PU:** con el imán, el ESP32 quedaría en reset pero el PMIC seguiría encendido y consumiendo, y la lógica quedaría invertida (imán puesto = apagado).
- **Por qué no un GPIO con *deep sleep*:** gasta un GPIO, de los que no sobra ninguno, y el PMIC queda encendido.

## 5. Asignación de GPIO (v1)

| Señal | GPIO | Conector | Notas |
| --- | --- | --- | --- |
| SPI3: SCK, MOSI, MISO | 36, 35, 37 | M.2 `SPI_*` 🔎 | Compartido con la SD y el QMI8658 |
| CS del LSM6DSO32 | **38** | M.2 🔎 | Pull-up de 10 kΩ |
| INT1 del LSM6DSO32 (watermark) | **39** | M.2 🔎 | Solo entrada |
| CS del BMP581 | **48** | M.2 🔎 | Pull-up de 10 kΩ, **obligatorio** |
| INT del BMP581 (FIFO) | **21** | M.2 🔎 | |
| MMC5983MA | I2C0: 17/18 | M.2 `SCL/SDA` 🔎 | 0x30; con pull-ups de I2C (ya están en la placa) |
| DRV5032 | **PWR_KEY** (sin GPIO) | M.2 `PWR_KEY` 🔎 | Diodo Schottky; alimentado por VBAT |
| PWM del buzzer | **46** | M.2 🔎 | Solo salida (LEDC), por un transistor NPN con **pull-down de 10 kΩ en la base**. El 46 es strapping y debe estar en bajo en el arranque: el pull-down lo garantiza. |
| Pulso de encendido de la Pi (solo Demeter) | **45** | M.2 🔎 | Solo salida, por un transistor u optoacoplador **a masa** hacia J2 de la Pi, con **pull-down de 10 kΩ**. El 45 es strapping (voltaje de la flash): en bajo en el arranque da 3,3 V, que es lo correcto. |
| `cam=1` (solo Demeter) | — | — | **No se cablea:** el estado de la Pi ya llega por la UART (`PAYLOAD_STATUS`), así que se publica como `act.CAM_OK` derivado del StatusCode. Se ahorra un GPIO. |
| UART a la Pi (solo Demeter) | TX 43, RX 44 | QWIIC / M.2 `U0*` | Es la UART0. En el arranque, la ROM imprime basura por el 43; la Pi la descarta porque no tiene la sincronía AA 55 ni el CRC correcto. La consola del firmware va por USB CDC. |
| Libres | Hermes: 45. Demeter: ninguno. | | |

## 6. Plan B (solo si P-02 falla después de bajar a 1,66 kHz)

- Llevar la SD al periférico **SDMMC** de 1 bit (CLK 36, CMD 35, D0 37, D3 = 47 en alto). Eso deja SPI3 solo para los sensores, en otros pines.
- **Costos:** se pierde el QMI8658, y hacen falta 3 GPIO más, que no existen en el conector de Demeter. Es una última opción y requiere rediseñar el cableado.

## 7. Verificación al cablear (T-004)

1. Mapear con el multímetro cada señal del conector M.2 contra la tabla 🔎.
2. P-01: WHO_AM_I del LSM6DSO32 (0x6C), CHIP_ID del BMP581 (0x50) y Product ID del MMC5983MA (0x30), en frío y en 100 reinicios.
3. Encendido con imán, y apagado por pulsación larga bloqueado en ARMED.
