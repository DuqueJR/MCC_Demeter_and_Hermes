---
id: visionpack_integracion
estado: propuesta (validar con Jerónimo). Los pines siguen el cableado de Pablo (D-042). **El firmware de Pablo todavía no implementa nada de esto** (A2 de la revisión): para el 8 de noviembre, la Pi vuela autónoma.
actualizado: 2026-11-03
depende_de: [maquina_estados, raspberry_pi_5, ups_x1200, revision_codigo_pi_demeter]
decisiones: [D-023]
---
# Integración LilyGO ↔ VisionPack (solo Demeter)

Solo se activa con `MODULO_VISIONPACK = 1`. El código de la Pi está en `visionpack/` (`demeter_*.py`) y su revisión en [revision_codigo_pi_demeter.md](../06_revisiones/revision_codigo_pi_demeter.md).
**Antes de integrar hay que corregir los bloqueantes 1–4 de esa revisión.**

> **Actualización del 2026-11-03 (D-037, D-042):**
> - El firmware es el de Pablo y **no tiene UART con la Pi, ni pulso de encendido**.
> - **Para el 8 de noviembre, la Pi funciona sola** con sus watchdogs, y se enciende a mano antes de cerrar el cohete (T-701 y checklist).
> - **Su propuesta para después:** la LilyGO le manda el estado (actitud, posición y momento) con marca UTC a 20–50 Hz, y la Pi interpola al instante de cada cuadro (hasta 10 fps). La integración por UART (T-702) se rediseña con él.
> - Las tablas de abajo quedan como la propuesta original.

> **Actualización del 2026-11-04 (D-054, bloque 9a y 9b, escrito sin validar):**
> - El cableado TX → 1k → RX de la Pi funciona: la Pi leyó el arranque de la ROM de la ESP32-S3 en `/dev/ttyAMA0` a 115200.
> - `firmware/cohete/src/ext_pi.cpp` (solo Demeter): recibe el latido `PAYLOAD_STATUS` y envía la POSE 0x21 a 50 Hz (≈3 kB/s, 26 % de la UART). Con el EKF a bordo (D-060), en cuanto arranca: cuaternión, giro, altura sobre el p0 y sus sigmas, con `F_EKF`, `F_ATT` y `F_ALT`; con origen GNSS además posición y velocidad del EKF (`F_POS`). Todo llevado al presente: el filtro va 300 ms atrasado y la salida integra el IMU guardado. Antes de arrancar: GNSS, altura del barómetro de la misión y cuaternión identidad. El suelo MSL se estima en tierra (GNSS menos barómetro) y queda fijo en FLY y RECOVERY.
> - `demeter_missiond.py` publica su estado cada 1 s (latido). Sin latido en 3 s, la LilyGo lo da por desconocido (`0xFF`).
> - El estado de la Pi va en el byte alto de `TELEM.actuators` y en el log (`T_PI`); el monitor muestra la línea `[pi  ]`.
> - **D-056:** `PAYLOAD_STATUS` lleva además el motivo del error (`ErrorCode`), que llega a tierra en los bits 3-7 de `TELEM.actuators`.
> - Pendiente: 9c (comandos de misión: PREFLIGHT, ARM, ABORT, START_ASCENT en BOOST, START_REC, TOUCHDOWN) y 9d (encendido por IO45, con `HandlePowerKey=ignore` en la Pi).
> - Ojo: la línea Pi TX → IO44 va sin resistencia; si la LilyGo queda sin alimentación con la Pi encendida, la alimenta por los diodos del pin. Propuesta: 1 kΩ también ahí.

## 1. Enlace UART (ya definido por Demeter, no cambia)

- 115200 baudios, 8N1, niveles de 3,3 V y **masa común**.
- En la Pi va por `/dev/serial0` (GPIO 14/15). En la LilyGO va por **UART0: TXD 43 → 1 kΩ → RX de la Pi y RXD 44 ← TX de la Pi**, con las masas unidas en el pad GND ([buses_y_pines.md](../03_hardware/buses_y_pines.md) §1.2).
- **El pulso de encendido sale del MOSFET de IO45** (100 kΩ a GND), en paralelo al botón J2 (GND–PWR_ON) de la Pi, de lado bajo (D-042). **Ojo:** una pulsación con la Pi encendida podría apagarla, así que el firmware solo debe pulsar si sabe que la Pi está apagada (Pablo).
- **No hay GPIO para `cam=1`:** el estado de la cámara se deriva del `PAYLOAD_STATUS` de la UART.
- **Trama:** `AA 55 | tipo u8 | len u8 | payload | CRC16-CCITT-FALSE` (CRC en big-endian, payload en little-endian). Ver `demeter_protocol.py`.

| Tipo | Dirección | Payload | Uso |
| --- | --- | --- | --- |
| 0x10 PREFLIGHT_SYNC | LilyGO → Pi | `<Q` UTC en ms | La Pi ajusta su reloj, una sola vez y dentro de una ventana de tiempo |
| 0x20 TELEMETRY | LilyGO → Pi | `<Qffff`: UTC en ms, alt (m AGL), roll, pitch, yaw (°) | A 10 Hz. **El firmware convierte el cuaternión a Euler**; falta acordar el orden de los ángulos (propuesta: ZYX aeroespacial) |
| 0x30 PAYLOAD_STATUS | Pi → LilyGO | `<B` StatusCode | Se publica como `estado_sec` en NAV |
| 0xA0, 0xA1, 0xA2, 0xB1, 0xC1, 0xF1 | LilyGO → Pi | — | Comandos (ver la sección 2) |

## 2. Qué transición de la LilyGO dispara cada comando (D-023)

> **Desde el 2026-11-04 (D-055, bloque 9c):** la LilyGo no dispara un comando por transición. Calcula la fase objetivo de la Pi y le manda el siguiente comando según el estado de su latido (`firmware/cohete/src/pi_plan.h`):
>
> | Misión de la LilyGo | Fase objetivo de la Pi |
> | --- | --- |
> | TIERRA, o FLY forzado sin BOOST | READY |
> | ARMED, o FLY sin BOOST (tras LAUNCH) | ARMED |
> | BOOST o COAST | ASCENT (video del ascenso) |
> | APOGEO, CAIDA o PARACAIDAS | RECORDING (captura del descenso) |
> | ATERRIZAJE o RECOVERY | fin (TOUCHDOWN e ingesta) |
>
> | Estado de la Pi | Comando según la fase objetivo |
> | --- | --- |
> | BOOT, ABORTED, ERROR | PREFLIGHT (salvo en fin; en ERROR, cada 30 s) |
> | READY | ARM si el objetivo es ARMED o más |
> | ARMED | START_ASCENT si es ASCENT o más; ABORT si es READY o fin |
> | ASCENT | START_REC si es REC o fin; ABORT si es READY |
> | RECORDING | TOUCHDOWN si es fin; ABORT si es READY |
> | PREFLIGHT, STARTING, INGESTING, PROCESSING, COMPLETE, desconocido | nada (esperar) |
>
> Se repite cada 1 s mientras la Pi no cambie de estado (3 intentos, luego 10 s de pausa). `PREFLIGHT_SYNC` no se usa: la hora llega por chrony. Los watchdogs de la Pi (15 s en ASCENT y 95 s en RECORDING) siguen activos por si la LilyGo no detecta un momento. La tabla de abajo es la propuesta original.

| Evento en la LilyGO ([maquina_estados.md](maquina_estados.md)) | A la Pi | Notas |
| --- | --- | --- |
| La Pi responde por primera vez en PREFLIGHT | `0xA0 CMD_PREFLIGHT` y luego `0x10 PREFLIGHT_SYNC` | Solo si la hora es válida |
| T4 ARMED | `0xA1 CMD_ARM` | El Go/No-Go de la LilyGO exige que la Pi esté en READY |
| T5 DISARM | `0xF1 CMD_ABORT` | La Pi vuelve a PREFLIGHT cuando la LilyGO se lo pide de nuevo |
| T6 BOOST | `0xA2 CMD_START_ASCENT` | Empieza el video del ascenso. Ojo con el **watchdog de 15 s** de la Pi: tiene que ser mayor que el tiempo hasta el apogeo simulado |
| T8 APOGEE | `0xB1 CMD_START_REC` | Captura RAW del descenso |
| T12 / T13 LANDED | `0xC1 CMD_TOUCHDOWN` | |
| Comando de tierra `PI_GRABAR 1` / `0` | `0xA2` / `0xF1` | Mando manual ([protocolo_paquetes.md](protocolo_paquetes.md)) |

Cada comando se reenvía hasta que el `PAYLOAD_STATUS` confirme el cambio de estado (máximo 3 intentos con 200 ms entre ellos).

## 3. Encendido de la Pi (decisión pendiente de hardware)

- Según la documentación oficial ([raspberry_pi_5](../03_hardware/componentes/raspberry_pi_5.md)), **la Pi 5 arranca sola cuando recibe alimentación**.
  - Para despertarla desde HALT hay que **llevar a masa** el pad J2 (PWR_BUT), GLOBAL_EN o el GPIO3.
  - Un "pulso de 3,3 V" directo **no sirve**: hace falta una salida de drenador abierto (un transistor o un optoacoplador) que ponga el pad a GND durante el pulso.
- **Propuesta:**
  - la Pi se enciende **en PREFLIGHT**, con el comando `PI_ENCENDER` o automáticamente al entrar a PREFLIGHT;
  - así arranca con tiempo de sobra, y el Go/No-Go la exige en READY antes de ARM.
  - El tiempo de arranque no está documentado oficialmente: hay que **medirlo** (prueba P-09). Aun así, es de decenas de segundos y **no puede ocurrir después del despegue**.
- **Energía:** con 2× Molicel P30B (≈ 21,6 Wh en total), la Pi en reposo aguanta horas. Medir el consumo real con las cámaras activas.
- **Pendiente para Demeter (hardware):**
  - el circuito real del pulso (J2, GLOBAL_EN o el EN del X1200), desde el IO2 de la LilyGO.

## 4. Riesgos propios de la integración

- El ascenso dura pocos segundos: el retardo de arranque de `rpicam-vid` (≈ 1 s) se come el despegue. Se puede considerar arrancar el video en ARMED, con un pre-roll en RAM.
- Las bases de tiempo deben alinearse: la LilyGO manda la UTC derivada del PPS, y la Pi debe guardar sus timestamps en UTC o registrar la diferencia con su reloj monotónico.
