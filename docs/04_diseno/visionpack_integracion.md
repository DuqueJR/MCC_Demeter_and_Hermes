---
id: visionpack_integracion
estado: propuesta (validar con Jerónimo)
actualizado: 2026-10-24
depende_de: [maquina_estados, raspberry_pi_5, ups_x1200, revision_codigo_pi_demeter]
decisiones: [D-023]
---
# Integración LilyGO ↔ VisionPack (solo Demeter)

Solo se activa con `MODULO_VISIONPACK = 1`. El código de la Pi está en `visionpack/` (`demeter_*.py`) y su revisión en [revision_codigo_pi_demeter.md](../06_revisiones/revision_codigo_pi_demeter.md).
**Antes de integrar hay que corregir los bloqueantes 1–4 de esa revisión.**

## 1. Enlace UART (ya definido por Demeter, no cambia)

- 115200 baudios, 8N1, niveles de 3,3 V y **masa común**.
- En la Pi va por `/dev/serial0` (GPIO 14/15). En la LilyGO va por **los GPIO 43 (TX) y 44 (RX)**, en el conector QWIIC o en el M.2 ([buses_y_pines.md](../03_hardware/buses_y_pines.md) §5).
- **El pulso de encendido sale del GPIO 45**, a masa por un transistor.
- **No hay GPIO para `cam=1`:** el estado de la cámara se deriva del `PAYLOAD_STATUS` de la UART.
- **Trama:** `AA 55 | tipo u8 | len u8 | payload | CRC16-CCITT-FALSE` (CRC en big-endian, payload en little-endian). Ver `demeter_protocol.py`.

| Tipo | Dirección | Payload | Uso |
| --- | --- | --- | --- |
| 0x10 PREFLIGHT_SYNC | LilyGO → Pi | `<Q` UTC en ms | La Pi ajusta su reloj, una sola vez y dentro de una ventana de tiempo |
| 0x20 TELEMETRY | LilyGO → Pi | `<Qffff`: UTC en ms, alt (m AGL), roll, pitch, yaw (°) | A 10 Hz. **El firmware convierte el cuaternión a Euler**; falta acordar el orden de los ángulos (propuesta: ZYX aeroespacial) |
| 0x30 PAYLOAD_STATUS | Pi → LilyGO | `<B` StatusCode | Se publica como `estado_sec` en NAV |
| 0xA0, 0xA1, 0xA2, 0xB1, 0xC1, 0xF1 | LilyGO → Pi | — | Comandos (ver la sección 2) |

## 2. Qué transición de la LilyGO dispara cada comando (D-023)

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
  - el circuito real del pulso (J2, GLOBAL_EN o el EN del X1200), desde el GPIO 45 de la LilyGO.

## 4. Riesgos propios de la integración

- El ascenso dura pocos segundos: el retardo de arranque de `rpicam-vid` (≈ 1 s) se come el despegue. Se puede considerar arrancar el video en ARMED, con un pre-roll en RAM.
- Las bases de tiempo deben alinearse: la LilyGO manda la UTC derivada del PPS, y la Pi debe guardar sus timestamps en UTC o registrar la diferencia con su reloj monotónico.
