---
id: componentes
estado: vivo. Es el directorio del hardware y equivale a Tabla_componentes.xlsx.
actualizado: 2026-10-24
fuente: docs/fuentes/Tabla_componentes.xlsx + fichas investigadas el 2026-10-24
---
# Directorio de componentes

**Cómo usarlo:** busca el componente aquí y abre su **ficha**.
- Cada ficha tiene la misma estructura: rol, datos clave, interfaz y pines, registros, configuración para nuestro uso, alimentación, librerías, trampas e incertidumbres.
- **Verificación:** las fichas salen de una investigación automática de fuentes oficiales (agentes Haiku). Todas tienen una sección de *Incertidumbres*: **antes de basar un driver en un dato, revisa esa sección.**
- La asignación real de buses y pines está en [buses_y_pines.md](buses_y_pines.md). En las fichas aparece lo que dice el fabricante, no necesariamente cómo quedó cableado.

## CanSat (los dos cohetes)

| Componente | Dispositivo | Función en el proyecto | Interfaz y dirección | Ficha | Datasheet |
| --- | --- | --- | --- | --- | --- |
| Placa | LilyGO T-Beam Supreme | Computadora de vuelo | — | [tbeam_supreme](componentes/tbeam_supreme.md) | [esquemático V3.1](datasheets/tbeam_supreme_schematic.pdf), [V3.0](datasheets/tbeam_supreme_schematic_v3.0.pdf) |
| ESP32-S3FN8 | (en la placa) | MCU de 2 núcleos LX7; 2 hosts SPI de uso general; SDMMC | — | [esp32_s3](componentes/esp32_s3.md) | [datasheet](datasheets/esp32_s3.pdf), [TRM](datasheets/esp32_s3_trm.pdf) |
| **LSM6DSO32** | Adafruit P4692 | **IMU principal**: ±32 g, hasta 6,66 kHz, FIFO | SPI3 (CS 38, INT1 39), WHO_AM_I 0x6C | [lsm6dso32](componentes/lsm6dso32.md) | ver la ficha |
| **BMP581** | Adafruit P6407 | **Barómetro principal**: apogeo, Vz | SPI3 (CS 48, INT 21), CHIP_ID 0x50 | [bmp581](componentes/bmp581.md) | [datasheet](datasheets/bmp581.pdf) |
| **MMC5983MA** | Breakout genérico | **Magnetómetro principal** (yaw); sin FIFO | **I2C0, 0x30** (D-022) | [mmc5983ma](componentes/mmc5983ma.md) | [datasheet](datasheets/mmc5983ma.pdf) |
| QMI8658A | En la placa | IMU de respaldo | SPI3 con la SD (CS 34, INT 33), ID 0x05 | [qmi8658](componentes/qmi8658.md) | [datasheet](datasheets/qmi8658.pdf) |
| QMC6310 | En la placa | Magnetómetro de respaldo (10/50/100/200 Hz) | I2C0, 0x1C (U) o 0x3C (N) | [qmc6310](componentes/qmc6310.md) | no descargado |
| BME280 | En la placa | Barómetro de respaldo, temperatura y humedad | I2C0, 0x77 (0x76 con puente) | [bme280](componentes/bme280.md) | [datasheet](datasheets/bme280.pdf) |
| **MAX-M10S** | En la placa | **GNSS**, PPS para el TDMA; 10 Hz con GPS+GAL | UART 8/9, PPS 6 | [max_m10s](componentes/max_m10s.md) | [datasheet](datasheets/max_m10s.pdf), [integration manual](datasheets/max_m10s_integration_manual.pdf), [interface description](datasheets/m10_spg510_interface_description.pdf) |
| **SX1262** | En la placa | **Radio LoRa** | SPI2 (12/11/13, CS 10, BUSY 4, DIO1 1) | [sx1262](componentes/sx1262.md) | pendiente (PEN-05) |
| AXP2101 | En la placa | PMIC: canales, cargador, % de batería | I2C1, 0x34 | [axp2101](componentes/axp2101.md) | [datasheet](datasheets/axp2101.pdf) |
| PCF8563 | En la placa | RTC | I2C1, 0x51 | [pcf8563](componentes/pcf8563.md) | [datasheet](datasheets/pcf8563.pdf) |
| OLED SH1106 | En la placa | Pantalla (solo en tierra) | I2C0, 0x3C o 0x3D | [oled_tbeam_supreme](componentes/oled_tbeam_supreme.md) | no descargado |
| DRV5032 | Adafruit 6051 (ScoutMakes, omnipolar) | Interruptor Hall de encendido. **La salida baja con el imán.** | `PWR_KEY` del AXP2101 por un diodo Schottky (D-031) | [drv5032](componentes/drv5032.md) | [datasheet](datasheets/drv5032.pdf) |
| Buzzer | Piezo genérico | Búsqueda después del aterrizaje | PWM (LEDC) con transistor | [buzzer_piezo](componentes/buzzer_piezo.md) | — |
| Antena LoRa | EBYTE TX915-FPC-8521 | FPC 860–940 MHz, 4 dBi | IPEX-1 | [antena_lora_tx915_fpc_8521](componentes/antena_lora_tx915_fpc_8521.md) | — |
| Antena GNSS | TAN1216Q50A | Quadrifilar activa, RHCP | SMA, con bias | [antena_gnss_tan1216q50a](componentes/antena_gnss_tan1216q50a.md) | — (equivalencia con la MAN1216Q50 sin confirmar) |
| Batería | Molicel INR-18650-P30B | 3000 mAh, 47 g como máximo (V: ¿también en el CanSat?) | — | [molicel_p30b](componentes/molicel_p30b.md) | — |

## Estación terrena

| Componente | Dispositivo | Función | Interfaz | Ficha | Datasheet |
| --- | --- | --- | --- | --- | --- |
| Placa | LilyGO T-Beam V1.2 (SX1262) | Módem TDMA (maestro) | USB-serial (CP2104 o CH9102, PEN-11) | [tbeam_v12_estacion](componentes/tbeam_v12_estacion.md) | [esquemático V07](datasheets/tbeam_v12_schematic.pdf) |
| ESP32-D0WDQ6 | (en la placa) | MCU | — | [esp32_d0wdq6](componentes/esp32_d0wdq6.md) | [datasheet](datasheets/esp32_d0wdq6.pdf) |
| SX1262 | En la placa | Radio (SCK 5, MISO 19, MOSI 27, CS 18, RST 23, DIO1 33, BUSY 32) | SPI | [sx1262](componentes/sx1262.md) | pendiente |
| NEO-M8N | En la placa | GNSS de la estación; PPS en el GPIO 37 según el esquemático (PEN-12) | UART RX 34, TX 12 | [neo_m8n](componentes/neo_m8n.md) | [datasheet](datasheets/neo_m8n_datasheet.pdf), [receiver description](datasheets/m8_receiver_description.pdf) |
| AXP2101 | En la placa | PMIC (DC1 ESP32, ALDO2 LoRa, ALDO3 GNSS) | I2C 21/22 | [axp2101](componentes/axp2101.md) | [datasheet](datasheets/axp2101.pdf) |
| Antena LoRa | EBYTE TX915-BLG-40 | Omnidireccional exterior, 5,5 dBi, N macho, 145 g | N macho (falta el adaptador, PEN-11) | [antena_lora_tx915_blg_40](componentes/antena_lora_tx915_blg_40.md) | — |
| Antena GNSS | Patch cerámica activa genérica | L1 | Con bias | [antena_gnss_patch_estacion](componentes/antena_gnss_patch_estacion.md) | — |
| Portátil, Starlink, servidor | — | Servicio de tierra, internet y web pública | — | [estacion_terrena](../04_diseno/estacion_terrena.md) | — |

## VisionPack (solo Demeter)

| Componente | Dispositivo | Función | Interfaz | Ficha | Datasheet |
| --- | --- | --- | --- | --- | --- |
| Computadora | Raspberry Pi 5 (4 GB) | Visión y video | UART `/dev/serial0` (GPIO 14/15); encendido por J2 a masa | [raspberry_pi_5](componentes/raspberry_pi_5.md) | [product brief](datasheets/raspberry_pi_5.pdf) |
| Cámaras (2×) | Camera Module 3 (IMX708) | Modos: 2304×1296 a 56 fps, 1536×864 a 120 fps, HDR a 30 fps | CSI | [camara_imx708](componentes/camara_imx708.md) | [product brief](datasheets/camara_imx708.pdf) |
| UPS | Geekworm X1200 | Alimentación de la Pi, 2× 18650 | I2C (¿fuel gauge?) | [ups_x1200](componentes/ups_x1200.md) | — (wiki inaccesible) |
| Baterías | 2× Molicel P30B | | | [molicel_p30b](componentes/molicel_p30b.md) | — |

## Componentes sin datasheet oficial descargado

Los dominios del fabricante bloquearon la descarga automática o piden registro. Si hacen falta, hay que bajarlos a mano y dejarlos en `datasheets/<id>.pdf`:
- **SX1262**, el más importante: semtech.com (PEN-05);
- LSM6DSO32: st.com, salvo que la ficha diga que ya se obtuvo;
- QMC6310, SH1106 (OLED), las antenas EBYTE, el X1200 y el P30B.

## Datasheets en Markdown

- **Los PDF en `datasheets/` son la fuente original.**
- **Todos los PDF descargados tienen al lado su conversión en `.md`**, hecha con `tomd`. Son 19 archivos con el mismo nombre del PDF. En las tablas convertidas pueden quedar columnas mezcladas: ante la duda, manda el PDF.
- **Los PDF no están en git** (`.gitignore`; pesan 117 MB y no hay Git LFS). Cada quien los tiene en local, o los vuelve a bajar desde la URL que está en las `fuentes` de cada ficha. **Los `.md` sí están versionados.**
- **Regla para agentes:** **no leas un datasheet completo.** Primero la ficha. Si falta un dato, busca con `grep` dentro del `.md` del datasheet. Si no hay `.md`, conviértelo con `tomd convert datasheets/<archivo>.pdf` y busca ahí.
- Los `.md` más pesados (los manuales de u-blox, de 0,6 a 1,1 MB) son referencia de registros y mensajes: úsalos solo con búsquedas.
