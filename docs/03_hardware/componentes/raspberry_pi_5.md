---
id: raspberry_pi_5
nombre: Raspberry Pi 5 (4 GB)
tipo: Computadora de placa única (SBC), VisionPack de Demeter
ubicacion: Demeter (VisionPack)
fabricante: Raspberry Pi Ltd
fuentes:
  - https://www.raspberrypi.com/documentation/computers/raspberry-pi.html
  - https://www.raspberrypi.com/documentation/computers/raspberry-pi-5.html
  - https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-product-brief.pdf
datasheet_pdf: ../datasheets/raspberry_pi_5.pdf
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# Raspberry Pi 5 (4 GB)

## Rol en el proyecto

Computadora del VisionPack de Demeter. Gestiona las cámaras, graba el video de ascenso y el RAW de descenso, y se comunica con la LilyGO (ESP32-S3) por UART. Se enciende y apaga desde la LilyGO.

## Datos clave

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| SoC / CPU | Broadcom BCM2712, 4 núcleos Arm Cortex-A76 a 2,4 GHz | Product brief, p. 1 |
| RAM | Opciones 1, 2, 4, 8 y 16 GB (LPDDR4X-4267); nuestra unidad es de 4 GB | Product brief, p. 1 |
| Decodificador de vídeo | HEVC 4Kp60 | Product brief, p. 1 |
| Codificador H.264 por hardware | No aparece en la lista de especificaciones del product brief. Ver Incertidumbres | Product brief, p. 1 |
| Entrada de alimentación | 5 V DC, 5 A, USB-C con Power Delivery | Product brief, p. 1 |
| RTC | Reloj de tiempo real integrado, alimentado por batería externa (conector) | Product brief, p. 1 |
| Botón de encendido | Sí (la placa tiene botón; ver "Interfaz y pines") | Product brief, p. 1 |
| Temperatura de operación | 0 °C a 70 °C | Product brief, p. 1 |
| Lógica GPIO | 3,3 V, no tolerante a 5 V | Doc. oficial, sección "Inputs" |
| Ventilador oficial (referencia de consumo) | Aprox. 60 mA a 5 V (300 mW) | Doc. oficial, "Raspberry Pi 5 fans" |
| Consumo típico / máximo de la placa | No encontrado en las fuentes leídas | — |
| Precio de lista 4 GB | 110 USD | Product brief, p. 2 |

## Interfaz y pines

- **UART:** GP14 (pin 8, TXD) y GP15 (pin 10, RXD). Fuente: doc. oficial, tabla "Pin functions". Es la UART que usamos como `/dev/serial0`.
- **Pad J2 (botón de encendido):** la documentación indica que las dos almohadillas de J2, situadas entre el conector de la batería RTC y el borde de la placa, aceptan un **interruptor momentáneo normalmente abierto** que cierra las dos almohadillas. Fuente: doc. oficial, sección "Power button". La documentación leída no usa el nombre "PWR_BUT".
- **GLOBAL_EN** (señal de reset/habilitación de la PMIC según la documentación): el ajuste `POWER_OFF_ON_HALT` dice que GLOBAL_EN debe estar en cortocircuito a masa para arrancar. Fuente: doc. oficial, "Boot EEPROM".

## Configuración relevante para nuestro uso

- **Arranque automático al alimentar:** según la documentación, al conectar la alimentación la Pi arranca sola sin pulsar el botón. Esto puede ser un problema si la Pi debe permanecer apagada hasta el pulso de la LilyGO; ver "Alimentación y tiempos".
- **`POWER_OFF_ON_HALT`** (EEPROM):
  - Si vale `1` y `WAKE_ON_GPIO=0`, un `sudo halt` apaga todas las salidas de la PMIC.
  - Por defecto vale 0 en la Pi 5 (en CM5 y Keyboard, 1). Fuente: "Boot EEPROM".
- **`WAKE_ON_GPIO`** (EEPROM): si vale `1`, `sudo halt` entra en modo de bajo consumo hasta que GPIO3 o GLOBAL_EN se pongan a masa. Por defecto vale 1. La documentación dice que, en la Pi 5, el botón de encendido despierta de STANDBY o HALT en lugar de GPIO3.
- **`WAIT_FOR_POWER_BUTTON`:** la documentación dice que el bootloader espera a que se pulse el botón tras una pérdida de alimentación cuando este ajuste y `POWER_OFF_ON_HALT` están a 1.
- **UART (`enable_uart`, `dtparam=uart0`, `/dev/serial0`):** no verificado en las secciones que se extrajeron. Hay que comprobarlo en la documentación de configuración de la UART.

## Alimentación y tiempos

- **Pulso de encendido desde la LilyGO:** la documentación describe que la Pi se despierta cuando GLOBAL_EN o GPIO3 se ponen a masa (cortocircuito a GND), no cuando se aplican 3,3 V. Un pulso de 1,5 s de 3,3 V como el que planeamos puede no servir tal cual. Esto hay que confirmarlo con el esquema eléctrico y con una prueba en banco.
- **Tiempo de arranque:** no hay una cifra oficial de tiempo de arranque total en las fuentes leídas. Lo que sí documenta la doc oficial:
  - Detección de dispositivo USB en el arranque: timeout de 2 s (5 s con `program_usb_boot_timeout=1`).
  - Arranque desde USB mass storage: "cinco a diez segundos" antes de que la Pi empiece a arrancar.
  - La detección de la tecla de instalación en red añade aprox. 1 s.
  - Estas cifras no sirven como tiempo total. Hay que medirlo con la imagen real de Raspberry Pi OS Lite.
- **Consumo:** no hay cifras típicas ni máximas de la placa en las fuentes leídas. Solo consta el consumo del ventilador (60 mA a 5 V). Hay que medirlo.
- **Fuente de alimentación:** 5 V / 5 A por USB-C (product brief). La X1200 entrega 5,1 V (ver ficha de la X1200).

## Librerías y ejemplos oficiales

- No se han revisado en esta investigación. Pendiente: documentación de `rpicam-apps` / `libcamera` y de la configuración de UART y EEPROM.

## Trampas y notas

- El product brief del archivo local está fechado "Published October 2026". No se ha revisado si hay una revisión posterior.
- El archivo `raspberry_pi_5.pdf` es el product brief (7 páginas), no la hoja de datos completa. La documentación de configuración está en las páginas HTML citadas.
- La documentación oficial de la Pi 5 dice que los pines GPIO no son tolerantes a 5 V. Cualquier señal de la LilyGO o del transistor del buzzer debe respetar 3,3 V.

## Incertidumbres

- **Tiempo de arranque total** de Raspberry Pi OS Lite: no hay cifra oficial en las fuentes leídas.
- **Consumo típico y máximo** de la placa: no encontrado.
- **Codificador H.264 por hardware:** la lista de especificaciones solo menciona el decodificador HEVC. No consta que exista un codificador H.264. La afirmación de que no lo tiene se basa en la ausencia en el product brief y debe confirmarse en la documentación de multimedia.
- **Pulso de encendido:** la documentación habla de cortocircuito a masa, no de un pulso de 3,3 V. El nivel y la duración del pulso necesarios no se han confirmado.
- **Pad J2 con el nombre "PWR_BUT"** y el procedimiento exacto de encendido externo: no confirmados por el nombre.
- **UART y `/dev/serial0`:** la activación con `enable_uart` / `dtparam=uart0` no se ha verificado en el texto extraído.
- **RTC:** el product brief confirma el RTC con batería externa, pero no se ha revisado su comportamiento de arranque.
