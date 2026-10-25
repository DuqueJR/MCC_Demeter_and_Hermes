---
id: esp32_d0wdq6
nombre: ESP32-D0WDQ6 (SoC de la T-Beam V1.2 de la estación)
tipo: Microcontrolador SoC Wi-Fi + Bluetooth (Xtensa LX6)
ubicacion: Estación
fabricante: Espressif Systems
fuentes:
  - https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf
  - https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/esp_timer.html
  - https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/adc/index.html
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/docs/en/t_beam/t_beam_hw.md
  - https://raw.githubusercontent.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/master/schematic/LilyGo_TBeam_V1.2-lastest.pdf
datasheet_pdf: ../datasheets/esp32_d0wdq6.pdf
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# ESP32-D0WDQ6

## Rol en el proyecto

Chip principal de la T-Beam V1.2 de la estación terrena. Ejecuta el módem TDMA, controla el radio SX1262 por SPI, recibe el GNSS por UART, habla con el AXP2101 por I2C y reenvía los paquetes al portátil por USB-serial.

## Datos clave

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| Núcleos | 2 × Xtensa 32-bit LX6 (variante dual-core) | datasheet v5.3, §Features |
| Frecuencia máxima | 240 MHz | datasheet, nota de CPU (línea de D0WDQ6) |
| SRAM interna | 520 KB | datasheet v5.3, §Features |
| ROM | 448 KB | datasheet v5.3, §Features |
| SRAM en RTC | 16 KB | datasheet v5.3, §Features |
| Estado del chip | D0WDQ6 figura como "NRND" (no recomendado para diseños nuevos); el D0WDQ6-V3 también | datasheet v5.3, tabla de pedidos |
| Wi-Fi | 802.11 b/g/n, 2,4 GHz; 802.11n hasta 150 Mbps | datasheet v5.3, §Features |
| Bluetooth | Clásico y BLE | datasheet v5.3, §Features |
| Controladores SPI | 4 (SPI0 es el buffer de memoria externa; SPI1 maestro; SPI2 = HSPI y SPI3 = VSPI, maestro o esclavo) | datasheet v5.3, §4.8.2 |
| UART | 3 interfaces; hasta 5 Mbaud | datasheet v5.3, §4.8.3 |
| I2C | 2 interfaces | datasheet v5.3, §4.8.4 |
| ADC | SAR de 12 bits, hasta 18 canales; ADC1 en GPIO32–39, ADC2 en GPIO0, 2, 4, 12–15, 25–27 | datasheet v5.3, §4.10 y tabla de canales |
| Temporizadores | 2 grupos, cada uno con 2 temporizadores de 64 bits y un watchdog; 1 temporizador RTC | datasheet v5.3, §Features |
| Resolución de esp_timer | 1 µs, contador de 64 bits | ESP-IDF esp_timer (resumen de la página) |
| Mínimo de esp_timer a 240 MHz | Una vez ~20 µs; periódico ~50 µs (dispatch por tarea) | ESP-IDF esp_timer (resumen de la página) |
| Pines de entrada sólo | GPIO34, 35, 36, 37, 38, 39 (sin pull-up/pull-down) | datasheet v5.3, nota 2 de tabla de pines |

## Interfaz y pines

Pines de strapping (cinco) con sus valores por defecto (datasheet, Tabla 3-1):

| Pin | Función | Por defecto |
| --- | --- | --- |
| GPIO0 | Modo de arranque | Pull-up (1) |
| GPIO2 | Modo de arranque | Pull-down (0) |
| MTDI (GPIO12) | Voltaje del LDO de SDIO (1,8 V o 3,3 V) | Pull-down (0) |
| MTDO (GPIO15) | Impresión por U0TXD durante el arranque | Pull-up (1) |
| GPIO5 | Temporización de SDIO esclavo | Pull-up (1) |

Pines de flash (no usables como GPIO en un diseño con flash integrada): GPIO6 a GPIO11 (SD_CLK, SD_DATA0–3, SD_CMD). En la T-Beam la flash es externa (W25Q32 según el esquemático, hoja 4); GPIO6–11 van a ese chip.

Pines de la T-Beam V1.2 en este chip (de utilities.h y el esquemático):

| GPIO | Uso en la T-Beam | Observación |
| --- | --- | --- |
| 4 | LED usuario (activo en LOW) | |
| 5, 18, 19, 27, 23 | LoRa SX1262 (SCK, CS, MISO, MOSI, RST) | MOSI en GPIO27 no es el pin VSPI por defecto (23) |
| 12 | GNSS TX | Strapping MTDI |
| 21, 22 | I2C (AXP2101 y bus) | |
| 26 | LoRa DIO0 (definido, no usado por el ejemplo SX1262) | |
| 32, 33 | LoRa BUSY y DIO1 | |
| 34 | GNSS RX | Sólo entrada |
| 35 | IRQ del PMU | Sólo entrada |
| 37 | PPS del GNSS (según esquemático) | Sólo entrada |
| 38 | Botón usuario | Sólo entrada |
| 0 | Botón BOOT | |
| 16, 17 | SPI RAM (según esquemático) | |

Asignación de SPI (datasheet): HSPI en GPIO2, 4, 12–15; VSPI en GPIO5, 18–19, 21–23. La matriz de GPIO permite otros pines (el ejemplo asigna MOSI a 27).

## Configuración relevante para nuestro uso

- Radio SX1262 por SPI: el módulo usa VSPI por matriz de GPIO, con pines asignados explícitamente en la placa (ver tabla anterior).
- GNSS por UART: RX en GPIO34 (sólo entrada, sin pull), TX en GPIO12 (strapping). Hay que tener en cuenta el estado de GPIO12 en el arranque.
- PPS: si se usa para sincronizar el ciclo TDMA de 100 ms, GPIO37 es entrada sólo, sin interrupción de flanco problemática, pero no tiene pull-up interno.
- Temporización: `esp_timer` ofrece resolución de 1 µs. Para tramos más cortos (por debajo de decenas de µs) la documentación recomienda GPTimer o RMT. Con el dispatch por tarea hay latencia variable; con dispatch por interrupción el retardo es menor.
- Wi-Fi: no es necesario para el módem LoRa. Si se usa Wi-Fi, afecta a ADC2 (ver Trampas).

## Alimentación y tiempos

- Rango de alimentación del chip: 2,3 V a 3,6 V según datasheet v5.3 (rango de VDD3P3_RTC, verificar en §Electrical). En la T-Beam el rail DC1 del AXP2101 alimenta el ESP32 a 3,3 V (t_beam_hw.md).
- Mínimos de esp_timer (con dispatch por tarea): una vez ~20 µs, periódico ~50 µs, a 240 MHz. A menor frecuencia de CPU los mínimos suben (fuente ESP-IDF).
- Consumo y tiempos de arranque: no se han extraído de las fuentes consultadas.

## Librerías y ejemplos oficiales

- ESP-IDF (documentación Espressif): esp_timer, ADC, GPIO.
- Arduino-ESP32 (ver t_beam_hw.md, "Install Arduino ESP32"). Configuración de placa: ESP32 Dev Module, Flash 4 MB, PSRAM habilitada, Partition "Huge APP (3MB No OTA/1MB SPIFFS)".
- Ejemplos de la T-Beam que usan este chip: ver la ficha de la placa (`tbeam_v12_estacion.md`).

## Trampas y notas

- ADC2 y Wi-Fi: en ESP-IDF, ADC2 no está disponible mientras Wi-Fi está activo. Esta restricción **no se encontró en las páginas consultadas** (la página de ADC de ESP-IDF redirigió y no contenía la frase). Tratar como conocimiento previo no verificado.
- GPIO12 (MTDI) está en el bus de GNSS TX. Un nivel alto en el arranque cambia el voltaje del flash a 1,8 V. Verificar en hardware que el GNSS no fuerza este pin en el arranque.
- GPIO34–39 no tienen pull-up ni pull-down. Cualquier línea que los use necesita resistencia externa si no está definida (el IRQ del PMU ya tiene pull-up externo de 47 kΩ en el esquemático).
- GPIO6–11 son de flash: no reutilizar.
- GPIO16 y 17 usados por la SPI RAM (según esquemático). Confirmar si la placa lleva PSRAM.
- D0WDQ6 es NRND según Espressif. Para diseños nuevos el fabricante recomienda otra variante. La T-Beam ya lo usa, pero hay que tenerlo en cuenta si se reemplaza la placa.
- Interrupciones en núcleo de radio y timers: separar las tareas de temporización crítica del CPU de las de Wi-Fi y de la consola para evitar retrasos (ESP-IDF esp_timer advierte de la latencia del dispatch por tarea).

## Incertidumbres

1. **ADC2 y Wi-Fi.** La restricción no está confirmada en fuentes consultadas. Pendiente: comprobar la página `adc_oneshot` o el apartado de ADC de la versión de ESP-IDF que se use.
2. **RTC memory.** El datasheet confirma 16 KB de SRAM en RTC. No se ha verificado en esta sesión que el contenido se conserve en deep sleep (dato de ESP-IDF, no consultado).
3. **Estado de GPIO12 en el arranque** con el GNSS apagado o en alta impedancia. Pendiente: medir.
4. **Versión de silicio.** El datasheet menciona revisiones v1.x y v3.x del chip. No se ha confirmado la revisión de la placa física. Pendiente: leer el marcado del módulo.
5. **Frecuencia máxima para el D0WDQ6 frente a D0WDQ6-V3.** La nota de CPU indica 240 MHz para D0WDQ6 y para el V3; no se ha verificado la tabla eléctrica completa.
6. **Consumo y tiempos de arranque.** No se extrajeron de las fuentes consultadas.
7. **Mínimos de esp_timer.** Procedentes de un resumen automático de la página de ESP-IDF; verificar la cifra en la documentación de la versión de ESP-IDF que se use.
