---
id: buses_y_pines
estado: D-022 REABIERTA (2026-10-24). Se cierra con la prueba de la SD en SDMMC (PEN-18). Pines de los headers confirmados con docs/fuentes/pines_headers_tbeam_supreme.csv. D-031 vigente.
actualizado: 2026-10-24
depende_de: [tbeam_supreme, esp32_s3, lsm6dso32, bmp581, mmc5983ma, qmi8658, drv5032, axp2101]
---
# Buses y pines de la T-Beam Supreme (CanSat)

Las fuentes son las fichas [tbeam_supreme](componentes/tbeam_supreme.md) y [esp32_s3](componentes/esp32_s3.md), y los esquemáticos [V3.1](datasheets/tbeam_supreme_schematic.pdf) y [V3.0](datasheets/tbeam_supreme_schematic_v3.0.pdf). Las copias renderizadas se describen en la bitácora del 2026-10-24.
- ✅ = confirmado en el repo de LilyGO o en el esquemático.
- 🔎 = falta verificar en la placa física.

## 0. Corrección importante (2026-10-24)

**El conector M.2 B-key NO es un conector externo.**
- En el esquemático V3.0 aparecen dos conectores iguales: **"Expansion board Interface"** y **"Mother board Interface"**. Además, ninguna hoja publicada dibuja el ESP32-S3.
- O sea: la T-Beam Supreme es **una placa madre (con el ESP32-S3) unida a una placa de periféricos por ese conector**.
- Lo que el usuario puede cablear son los **headers PN1 y PM1** (13 pines en la V3.1, 16 en la V3.0) y el conector **QWIIC**.

**Consecuencias:**
- **El bus SPI3 (35/36/37) de la SD y la IMU no sale a ningún header.** La versión anterior de este documento suponía que el "SPI externo" era ese bus. Era un error.
- **`PWR_KEY` no está en ningún header:** solo llega al botón PWR (SW3).

## 1. Lo que ya ocupa la placa ✅

| Función | GPIO | Bus o host |
| --- | --- | --- |
| I2C0: OLED SH1106, QMC6310 y BME280 | SDA 17, SCL 18 | `Wire`. **Pull-ups de 4,7 kΩ (R26/R27) hacia A_LDO1.** |
| I2C1: AXP2101 (0x34) y PCF8563 (0x51) | SDA 42, SCL 41 | `Wire1` |
| IRQ del PMU / interrupción del RTC | 40 / 14 | El RTC_INT tiene un pull-up de 100 kΩ (R2) |
| SPI2 de la radio: SX1262 | SCK 12, MOSI 11, MISO 13, CS 10, RST 5, BUSY 4, DIO1 1 | Solo la radio |
| SPI3 de periféricos: SD y QMI8658 | SCK 36, MOSI 35, MISO 37, CS de la SD 47, CS de la IMU 34, INT de la IMU 33 | El CS de la SD con pull-up de 10 kΩ (R13); las líneas de la SD con 22 Ω en serie; puentes de 0 Ω (R32–R34) entre la SD y el SPI. **En la V3.0** hay además MOSFETs BSS123 de cambio de nivel en las líneas de la SD. |
| GNSS | TX 8, RX 9, **PPS 6** (en el header, con un LED y 1 kΩ como carga), EN o wake 7 | UART |
| USB CDC / BOOT | 19, 20 / 0 | |

## 2. Lo que se puede cablear ✅

Confirmado con el esquemático V3.1 y con la lista de pines de los headers que entregó el usuario el 2026-10-24 ([`docs/fuentes/pines_headers_tbeam_supreme.csv`](../fuentes/pines_headers_tbeam_supreme.csv)).

| Header | Señales |
| --- | --- |
| **PN1** | IO48 · IO21 · IO6 (= GPS_PPS, **ocupado**) · IO3 · **IO2** · IO38 · IO39 · IO45 · IO46 · SCL (GPIO18) · SDA (GPIO17) · GND |
| **PM1** | RST (= CHIP_PU) · RXD (GPIO44) · TXD (GPIO43) · **VBAT** · **DC1 (3,3 V)** · VBUS · **A-LDO2** · VSYS · B-LDO2 · DC4 · DC5 · GND |
| **QWIIC** | RX (GPIO44) · TX (GPIO43) · 3V3 (DC1) · GND |

**Los GPIO libres que se pueden cablear son 8:** 48, 21, 3, **2**, 38, 39, 45 y 46. Más la UART0 (43/44) e I2C0 (SCL/SDA).
- **El IO6 no está libre:** es la línea del PPS del GNSS, que usamos para el TDMA.
- 🔎 **El IO2** ocupa en el header el lugar de la red `RADIO_RETAIN` del esquemático. Hay que verificar con el multímetro que en la variante SX1262 no lo maneja nada más. No es pin de strapping; en el reset queda flotante y tiene un pequeño pulso bajo de unos 60 µs al encender, según el datasheet.

**Rieles de alimentación en el header** (para los breakouts):
- **DC1 (3,3 V):** el mismo riel del ESP32. Está encendido siempre que la placa lo está. **Aquí se alimentan los breakouts externos (LSM6DSO32, BMP581, MMC5983MA) y sus pull-ups de los CS.**
  - Así tienen voltaje desde el primer instante: el CS ya está en alto al encender, lo que evita la trampa del BMP581.
  - Y no los alcanza el ciclo de apagado y encendido que el código de LilyGO le hace a ALDO1/ALDO2 en el arranque. **El firmware debe mandarles un reset por software al iniciar.**
  - Y el MMC nunca queda sin alimentación mientras los pull-ups de I2C0 (que van a A_LDO1) están encendidos, así que no hay alimentación inversa por el bus.
- **A-LDO2:** es un LDO que el firmware enciende y apaga. No se usa para los breakouts.
- **VBAT:** el DRV5032 (D-031), porque es el único riel presente con el PMIC apagado.

## 3. Pull-ups y pull-downs (la pregunta de Pablo)

| Línea | En la placa (esquemático) | Interno del ESP32-S3 en el reset (datasheet) | Implicación |
| --- | --- | --- | --- |
| GPIO 38, 39, 48, 21, 3, 2 | **No se ve ninguna resistencia** en la hoja de periféricos. La placa madre no está publicada, así que hay que **medir** (PEN-18). | **Ninguna**: entrada flotante (IE) | **Un CS flota en el arranque** hasta que el firmware lo configure. Por eso hace falta **un pull-up externo de 10 kΩ en cada CS**, sobre todo en el del BMP581, que pasa a SPI de forma irreversible si su CS baja. |
| GPIO 45, 46 | Ídem | **Pull-down débil (WPD)**, porque son pines de strapping | **Nunca ponerles un pull-up.** El 45 en alto en el arranque fija la flash a 1,8 V y la placa no arranca. El 46 en alto junto con el GPIO0 en bajo invalida el modo de descarga. Solo se usan como salida o como entrada que esté en bajo en el arranque. |
| GPIO 43, 44 (UART0) | — | Pull-up débil (WPU) | Correcto para la UART hacia la Pi |
| SCL/SDA (I2C0) | 4,7 kΩ hacia **A_LDO1** | — | El MMC5983MA va a **DC1**, que está encendido siempre que lo está ALDO1, así que nunca queda sin alimentación con el bus en alto. **El firmware enciende ALDO1 antes de usar I2C0.** Los pull-ups propios del breakout quedan en paralelo, y no es grave. |
| GPS_PPS | LED con 1 kΩ hacia GND | — | Leve carga en el PPS; no afecta la marca de tiempo |
| IMU_INT (QMI8658) | 10 kΩ hacia 3V3 con diodos (OR cableado) | — | — |

**Los pull internos del ESP32 (~45 kΩ) se pueden programar en cualquier GPIO.** Pero solo actúan **después** de que el firmware los configura, así que **no sirven para fijar el estado de un CS en el arranque**.

## 4. D-022: dónde van los sensores externos (REABIERTA)

Como los pines 35/36/37 no son accesibles, hay dos caminos. **Se decide en la sesión de verificación (PEN-18)** con una prueba concreta: ¿funciona la microSD en modo SDMMC de 1 bit?

### Opción B′ (recomendada si la SD funciona en SDMMC): un bus SPI propio para los sensores, por el header

- **La SD pasa al periférico SDMMC de 1 bit**, por sus mismos pines: CLK 36, CMD 35, D0 37, y D3 = CS 47 en alto, que ya tiene un pull-up de 10 kΩ.
- **El QMI8658 queda deshabilitado**, con su CS 34 en alto. Era el respaldo; la IMU principal es el LSM6DSO32.
- **El host SPI3 queda libre** y se enruta por la GPIO matrix a los pines del header. Es un **bus de sensores dedicado**, que cumple la regla de *Objetivos* de un "SPI externo aislado".
  - Los sensores usan relojes de ≤ 10–12 MHz, que la GPIO matrix soporta de sobra.
- **Riesgos que hay que probar:**
  - el CMD y el D0 de la SD necesitan pull-ups; la placa no las tiene, así que se usan las internas y se valida la velocidad;
  - en la V3.0 están los MOSFETs de cambio de nivel en las líneas de la SD.

| Señal | GPIO (PN1) | Por qué ese pin |
| --- | --- | --- |
| SCK del SPI de sensores | **46** | Salida, en reposo en bajo (modo 0). Su WPD en el arranque la mantiene en bajo. |
| MOSI | **45** | Salida. Su WPD en el arranque da el strapping correcto (flash a 3,3 V). |
| MISO | **3** | Entrada. Los sensores solo la manejan con el CS en bajo. |
| CS del LSM6DSO32 | **38** | **Pull-up externo de 10 kΩ** |
| CS del BMP581 | **48** | **Pull-up externo de 10 kΩ (obligatorio)** |
| INT1 del LSM6DSO32 (watermark) | **39** | Entrada |
| INT del BMP581 | — | **No se cablea:** el FIFO se lee por timer cada 50 ms (32 frames a 240 Hz dan unos 133 ms de margen) |
| MMC5983MA | I2C0 (SCL/SDA del PN1), 0x30 | Se alimenta de **DC1 (3,3 V)** |
| Buzzer | **21** | Salida PWM por un transistor |
| Pulso a la Pi (solo Demeter) | **2** | Salida a masa por un transistor u optoacoplador, con **pull-down de 10 kΩ**. En Hermes queda libre. |
| UART a la Pi (solo Demeter) | 43/44 (PM1 o QWIIC) | |

### Opción A′ (si SDMMC no funciona): soldar al bus SPI3 interno

- Sacar cables desde los puentes de 0 Ω R32, R33 y R34 (SPI_MOSI, SCK y MISO) de la placa de periféricos (V3.1), y compartir el bus con la SD y el QMI8658 con un solo dueño, como decía la versión anterior.
- **Desventajas:**
  - soldar sobre componentes SMD diminutos, con vibración de hasta 20 g, es frágil mecánicamente;
  - en la V3.0 la topología es distinta;
  - el bus se comparte con la SD, que puede tardar 100–250 ms, frente a un margen del FIFO de 66 ms.
- Necesita 3 CS (38, 48 y uno más) y las INT, en el header.

## 5. D-031 (vigente, con un cambio): encendido con el DRV5032

- **La lógica no cambia:** la salida del DRV5032 va a `PWR_KEY` por un diodo Schottky, con el ánodo en `PWR_KEY` y el cátodo en el DRV.
- **El DRV5032 se alimenta de VBAT**, que **está en el PM1** ✅.
- **Cambio:** como `PWR_KEY` no está en los headers, **el cable se suelda al pad del botón PWR (SW3) del lado de `PWR_KEY`** 🔎. Es un pad grande, más robusto que un SMD.
- **Comportamiento:**
  - imán ~1 s: enciende;
  - imán sostenido 10 s: apaga (solo en tierra);
  - **el firmware bloquea el apagado por pulsación larga desde ARMED hasta LANDED.**

## 6. ~~Lo que quedaba abierto en la opción B′~~ (resuelto el 2026-10-24)

El IO2 del header (ver la lista de pines) le da pin al pulso de la Pi. Las alternativas de abajo quedan solo como historia:
1. **Mover el buzzer al LED de carga del AXP2101** (salida que el firmware puede controlar). Sirve si el buzzer es **activo**, es decir, con oscilador interno, así que **hay que saber qué tipo de buzzer compraron** (PEN-19). Así el GPIO 21 queda para el pulso de la Pi en Demeter.
2. Poner un expansor I2C de GPIO (por ejemplo, PCA9554) en I2C0 para las salidas lentas: el buzzer activo y el pulso de la Pi. Hay que comprarlo.
3. No usar el pulso: la Pi arranca sola cuando recibe alimentación (ver la ficha raspberry_pi_5). Se enciende con su propio interruptor o UPS antes de la integración, y la LilyGO solo verifica por UART que esté en READY. Es la opción más simple.

## 7. Verificación física (PEN-18): cierra D-022

1. **Versión de la placa:** V3.0 (LED PPS azul) o V3.1 (LED PPS rojo). Foto de las dos caras.
2. **Headers:** con el multímetro, la continuidad de cada pin del PN1 y el PM1 frente a la §2.
3. **Pull-ups y pull-downs de la placa madre:** con la placa **sin alimentación**, medir la resistencia de cada GPIO del header (48, 21, 3, 38, 39, 45 y 46) a VDD3V3 y a GND. Algo por debajo de ~200 kΩ es una resistencia externa.
4. **Firmware de prueba** (agente desarrollador, T-003):
   - escaneo de I2C0 e I2C1;
   - **la microSD en SDMMC de 1 bit**: montar, escribir 10 MB y medir la latencia;
   - tamaño y modo de la PSRAM;
   - UBX-MON-VER del GNSS;
   - el registro de la pulsación larga del AXP2101.
5. **El buzzer:** ¿activo o pasivo?
