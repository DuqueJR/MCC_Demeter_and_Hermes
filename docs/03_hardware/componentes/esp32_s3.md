---
id: esp32_s3
nombre: ESP32-S3 (variante ESP32-S3FN8 en LilyGO T-Beam Supreme)
tipo: SoC MCU dual-core Xtensa LX7 con Wi-Fi 2.4 GHz y BLE 5
ubicacion: CanSat (ambos cohetes)
fabricante: Espressif Systems
fuentes:
  - https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf
  - https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf
  - https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/system/misc_system_api.html
  - https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/system/esp_timer.html
  - https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/storage/nvs_flash.html
  - https://developer.espressif.com/blog/2024/06/zephyr-max-wifi-throughput/
  - https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series (docs/en/t_beam_supreme/t_beam_supreme_hw.md; examples/OLED/SH1106GraphicsTest/utilities.h)
datasheet_pdf: ../datasheets/esp32_s3.pdf (datasheet v2.2; TRM v1.8 en ../datasheets/esp32_s3_trm.pdf)
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# ESP32-S3 (T-Beam Supreme)

## Rol en el proyecto
Computadora de vuelo del CanSat: adquisición de sensores, escritura en microSD, LoRa SX1262, GNSS por UART, RTC/PMIC por I2C, modo SoftAP para descarga post-vuelo.

## Datos clave
| Parámetro | Valor | Fuente |
|---|---|---|
| Núcleos | 2 × Xtensa LX7, CPU_CLK hasta 240 MHz | TRM 7.2.4.1 |
| SRAM interna | 512 KB | datasheet "Features" |
| ROM | 384 KB | datasheet "Features" |
| RTC SRAM | 16 KB (RTC_SLOW 8 KB + RTC_FAST 8 KB) | datasheet; TRM 11 |
| Flash en paquete (FN8) | 8 MB QSPI | datasheet Tabla 1-1 |
| PSRAM en paquete (FN8) | **ninguna** según datasheet ("—"). Las variantes R8/R8V tienen 8 MB Octal PSRAM | datasheet Tabla 1-1 |
| PSRAM según LilyGO | "8MB (Quad-SPI)" para la T-Beam Supreme; Arduino: "QSPI PSRAM" | t_beam_supreme_hw.md (tabla Product; tabla Arduino IDE) |
| GPIO programables | 45 | datasheet "Features" |
| SPI | SPI0/1 reservados (flash/PSRAM); 2 puertos de propósito general: GP-SPI2 (FSPI) y GP-SPI3 | datasheet "Features"; TRM 30.5.2 ("FSPI bus and SPI3 bus") |
| I2C | 2 | datasheet |
| UART | 3 | datasheet |
| I2S | 2 | datasheet |
| SD/MMC host (SDHOST) | Sí: 2 slots. Señales enrutables vía GPIO matrix (TRM tabla de señales: `sdhost_cclk_out_1` en índice 172) | datasheet; TRM cap. 34 y 6 |
| USB | Full-speed USB OTG (GPIO19 D-, GPIO20 D+) + USB Serial/JTAG | datasheet tabla de pines |
| ADC | 2 SAR de 12 bits, hasta 20 canales. ADC2_CH0–CH9 = GPIO11–GPIO20 | datasheet Tabla de pines |
| Sensor de temperatura | Rango −40 a 125 °C; mide la temperatura del chip, que suele ser mayor que la ambiente | datasheet 4.2.2.2 |
| Brownout (BOD) | Umbral por defecto 2.7 V sobre VDD3P3, VDD3P3_RTC y VDD3P3_CPU | TRM 10.3.4.4 |
| Timers | 4 timers generales de 54 bits; system timer de 52 bits; 3 watchdogs (MWDT0, MWDT1, RWDT) más Super WDT | datasheet; TRM 13 |
| esp_timer | Resolución 1 µs, rango 52 bits | ESP-IDF esp_timer |
| Captura de flanco | MCPWM tiene submódulo de captura (3 canales + timer de captura); PCNT disponible | TRM cap. 36; datasheet |
| Deep-sleep | 7 µA; la RTC memory se mantiene alimentada en deep-sleep | datasheet "Power Management" |

## Interfaz y pines

### Pines del mapa de la T-Beam Supreme (LilyGO, `utilities.h` bloque `T_BEAM_S3_SUPREME_SX1262`)
| Función | GPIO | Bus / notas |
|---|---|---|
| I2C0 SDA / SCL (`Wire`) | 17 / 18 | Pantalla SH1106, BME280 (0x77), magnetómetro QMC6310/QMC6309 |
| I2C1 SDA / SCL (`Wire1`) | 42 / 41 | PMU AXP2101 (0x34) y RTC PCF8563 (0x51) |
| PMU IRQ | 40 | AXP2101 |
| RTC INT | 14 | PCF8563 |
| GNSS UART (TX / RX) | 8 / 9 | Módulo GNSS (ublox M10 o L76K) |
| GNSS PPS | 6 | Pulso por segundo |
| GNSS EN / wake-up | 7 | EN en `utilities.h`; wake-up sólo en versión L76K |
| LoRa SX1262 SCLK / MISO / MOSI / CS | 12 / 13 / 11 / 10 | Bus de radio (en Arduino-ESP32 coincide con el SPI por defecto del S3 — verificar) |
| LoRa RST / BUSY / DIO1 | 5 / 4 / 1 | |
| SPI compartido MOSI / SCK / MISO | 35 / 36 / 37 | SD y IMU QMI8658 |
| SD CS | 47 | |
| IMU QMI8658 CS / INT | 34 / 33 | |
| Botón BOOT | 0 | Strapping |
| Botón PWR | (PMU) | Conectado al AXP2101 |
| UART1 libre (conector QWIIC) | 43 / 44 | En la tabla de LilyGO aparecen como "Free" |

Nota: en el bloque de pines de LilyGO, `DISPLAY_MODEL` es `U8G2_SH1106_128X64_NONAME_F_HW_I2C` y no hay `OLED_RST` definido.

### Strapping
GPIO0 (BOOT), GPIO3 (JTAG source), GPIO45 (VDD_SPI voltage), GPIO46 (ROM log). Valores por defecto: GPIO0 pull-up (1), GPIO3 flotante, GPIO45 y GPIO46 pull-down (0). Fuente: datasheet cap. 3, Tabla 3-1.

### Pines reservados por memoria
- GPIO26–GPIO32: SPI0/1 hacia flash y PSRAM (QSPI/Octal). No usar.
- GPIO33–GPIO37: sólo se usan para DQ4–DQ7 y DQS en memoria Octal (variantes R8). Con QSPI quedan libres (confirma que los pines 35/36/37 del bus compartido son utilizables si la memoria es QSPI).
- Datasheet: "No usar los pines conectados a flash/PSRAM en paquete para otro fin".

### Asignación de hosts SPI (cálculo sobre hardware)
- Hosts de propósito general: 2 (GP-SPI2/FSPI y GP-SPI3). SPI0/1 quedan reservados.
- Tres buses previstos (LoRa, SD+IMU, sensores externos) requieren 3 hosts. Con 2 hosts hay que compartir uno: por ejemplo, SD+IMU y sensores externos en el mismo host con CS separados, o LoRa solo en un host.

## Configuración relevante para nuestro uso
- **Verificar PSRAM al arrancar**: `psramFound()` y `ESP.getPsramSize()` (LilyGO usa ambos en el código de la placa). Si hay PSRAM Octal, GPIO33–37 quedan reservados y chocan con el bus SPI compartido.
- **Memoria de estado**: `RTC_NOINIT_ATTR` / `RTC_DATA_ATTR` para estado de vuelo; NVS para configuración y flags. Ver tabla de resets abajo.
- **NVS**: clave de hasta 15 caracteres, cadenas de hasta 4000 bytes, blobs hasta 508 000 bytes. Tiene nivelado de desgaste, pero no sirve para escrituras frecuentes o crecientes: para eso ESP-IDF recomienda un sistema de archivos. No usarlo para telemetría continua.
- **Brownout**: BOD configurable en modo 0 (interrupción y reset retardado) o modo 1 (reset directo del sistema).
- **ADC2 y Wi-Fi**: los canales ADC2 no pueden usarse simultáneamente con Wi-Fi. Usar ADC1 o un ADC externo si se usa SoftAP.
- **Sincronía para PPS**: capturar el flanco con MCPWM capture (hardware de timestamp) o PCNT; una ISR de GPIO tiene latencia variable (no documentada por Espressif en lo revisado).
- **Timestamp**: `esp_timer_get_time()` devuelve µs desde la inicialización de esp_timer; se reinicia a cero tras deep-sleep.

## Alimentación y tiempos
- Dominios de alimentación: DC1 alimenta el ESP32-S3 (hasta 2 A según LilyGO); los periféricos cuelgan de ALDO/BLDO del AXP2101 (ver ficha AXP2101).
- Deep-sleep: 7 µA típico (datasheet).
- Tiempo de brownout: no hay un número en el datasheet para el tiempo de reacción del BOD; ver TRM 10.3.4.4.

### Resets y memoria (TRM 7.1, Tabla 7.1-1)
Los cuatro niveles son CPU reset, Core reset, System reset y Chip reset. El TRM dice que **todos los niveles excepto Chip reset mantienen los datos de la memoria interna**.

| Causa (código) | Tipo de reset | Notas |
|---|---|---|
| Encendido (0x01) | Chip reset | Limpia la memoria |
| Brownout (0x0F) | System reset o chip reset | Depende de la configuración del BOD |
| Super WDT (0x12) | System reset (tabla) | La nota 1 de la tabla indica que la SWD también puede provocar chip reset |
| RWDT system (0x10), GLITCH (0x13) | System reset | |
| Software system (0x03) | Core reset | `RTC_CNTL_SW_SYS_RST` |
| Deep-sleep (0x05) | Core reset | |
| MWDT0 / MWDT1 / RWDT core (0x07, 0x08, 0x09) | Core reset | |
| eFuse CRC (0x14), USB (0x15, 0x16) | Core reset | |
| Software CPUx (0x0C), MWDT0 CPUx (0x0B), RWDT CPUx (0x0D), MWDT1 CPUx (0x11) | CPU reset | |

ESP-IDF `esp_reset_reason_t` (fuente: misc_system_api): `ESP_RST_POWERON`, `ESP_RST_SW`, `ESP_RST_PANIC`, `ESP_RST_INT_WDT`, `ESP_RST_TASK_WDT`, `ESP_RST_WDT`, `ESP_RST_DEEPSLEEP`, `ESP_RST_BROWNOUT`, `ESP_RST_SDIO`, `ESP_RST_USB`, `ESP_RST_JTAG`, `ESP_RST_EFUSE`, `ESP_RST_PWR_GLITCH`, `ESP_RST_CPU_LOCKUP`.

## Librerías y ejemplos oficiales
- Arduino-ESP32 (core) y ESP-IDF. Los ejemplos de LilyGO usan `Wire`, `Wire1`, `SPI`, `XPowersLib` y `U8g2`.
- LilyGO `examples/OLED/SH1106GraphicsTest`, `examples/SD/SD_Test`, `examples/GPS/UBlox_BasicNMEARead`, `examples/LoRaWAN/RadioLib_OTAA`.
- Configuración del IDE (Arduino): Flash 8 MB (64 Mb), PSRAM "QSPI PSRAM", CPU 240 MHz, USB CDC On Boot "Enable", USB Mode "CDC and JTAG" (fuente: t_beam_supreme_hw.md).

## Trampas y notas
- **Contradicción de PSRAM**: el datasheet dice que el FN8 no tiene PSRAM, mientras que LilyGO documenta 8 MB Quad-SPI PSRAM en la misma variante. No dar por cierto ninguno de los dos sin verificar en la placa real con `psramFound()`.
- **Pines 17/18 (I2C0)**: LilyGO indica que los sensores conectados a 17/18 necesitan que DC1 esté encendido o que su LDO se encienda antes de acceder al bus, porque si no el acceso falla o se congela. En la tabla de energía, la pantalla y los sensores I2C0 cuelgan de ALDO1. Encender ALDO1 **antes** de cualquier transacción I2C0.
- **Strapping**: GPIO0 está en el botón BOOT; GPIO45/46 tienen pull-down por defecto; no conectarlos a cargas que cambien el nivel en el arranque.
- **Pines SPI en PSRAM Octal**: si la memoria es Octal, GPIO33–37 se usan en memoria y no se pueden usar como bus SPI.
- **Reset en brownout**: un brownout con chip reset borra toda la memoria; sólo la memoria no volátil (NVS/SD) sobrevive.
- **Latencia de interrupciones GPIO**: no documentada; medir.
- **Concurrencia de hosts SPI**: un S3 tiene 2 hosts de propósito general. Pasar a 3 buses separados requiere compartir.

## Incertidumbres
- **Variante exacta (PSRAM)**: contradicción entre datasheet (FN8 sin PSRAM) y LilyGO (8 MB QSPI PSRAM). Verificar en la placa.
- **Frecuencia máxima por GPIO matrix frente a IO MUX**: el TRM dice que SPI/JTAG pueden saltar la GPIO matrix por IO MUX para alta frecuencia, pero no da un número en la sección revisada. Dato no confirmado.
- **Retención de RTC memory tras System reset**: el TRM dice que System reset resetea "todo el sistema digital, incluido RTC" y al mismo tiempo que todos los resets excepto Chip reset mantienen la memoria interna. Contradictorio; verificar con prueba de hardware (`RTC_NOINIT_ATTR` + magic + `esp_reset_reason()`).
- **Throughput SoftAP**: no hay cifra oficial de Espressif para SoftAP en S3. El blog oficial (Zephyr, S3 como station con router) da TCP download de 2.8 a 4.1 Mbps y UDP de unos 10 Mbps. Un foro reporta unos 200 KB/s. No usar como dato de diseño sin medir con iperf (SoftAP con PC como station).
- **Precisión del sensor de temperatura interno**: el datasheet no da precisión en lo revisado. Dato no confirmado.
- **Tiempo de respuesta del BOD**: sin número documentado.
- **Pines SPI por defecto de Arduino-ESP32 en S3**: se asume que LoRa usa el host FSPI con los pines 10–13; no confirmado en este análisis.
