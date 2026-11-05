---
fecha: 2026-11-04
tipo: sesion
ids: [D-054, T-702]
autor: Claude, con Pablo
rama: feature/pi-uart
---
# UART con la Pi de Demeter: bloque 9a y 9b

## Contexto

- Pablo cableó la LilyGO de Demeter a la Raspberry Pi: UART0 (TXD 43 → 1 kΩ → RX de la Pi, RXD 44 ← TX de la Pi) y GND. También instaló las cámaras y soldó los cables del encendido, que aún no conecta a IO45.
- Prueba del cableado sin firmware nuevo: con `demeter-telemetry` detenido, `cat /dev/ttyAMA0` a 115200 en la Pi mostró el arranque de la ROM de la ESP32-S3 (`ESP-ROM:esp32s3-20210327`). La dirección LilyGO → Pi funciona.

## Qué se hizo (escrito sin compilar ni validar: Pablo compila y carga)

- **Firmware:** `ext_pi.cpp/.h`, una tarea en el núcleo 0 con prioridad 2, solo en Demeter.
  - Decodifica `PAYLOAD_STATUS` (0x30): el latido de la Pi. Sin latido en 3 s, el estado queda desconocido (`0xFF`).
  - Envía la POSE 0x21 a 50 Hz, con la hora del primer byte. Sin EKF a bordo lleva GNSS, la altura del barómetro de la misión, cuaternión identidad y `F_EKF`/`F_ATT` en 0.
  - El estado de la Pi va en el byte alto de `TELEM.actuators` y en el log como `T_PI` (13). El monitor muestra la línea `[pi  ]`.
- **Pi:** `demeter_missiond.py` publica su estado cada 1 s; `demeter_telemetryd.py` solo anota los cambios.
- **Estación:** `tblog.py` lee `T_PI` (y `pi.csv` con `--csv`); el dashboard de control muestra el estado de la Pi en la tabla de Demeter y anota sus cambios en el historial.
- **Contrato:** D-054, `protocolo_paquetes.md` (`actuators`), `formato_log.md` (`T_PI`) y `visionpack_integracion.md`.

## Cómo validar en el banco

1. En la Pi: `cd ~/MCC && git pull` en la rama, y `sudo systemctl restart demeter-mission demeter-telemetry`.
2. Cargar `demeter` y mirar `[pi  ]` en el monitor: estado BOOT (la Pi espera `CMD_PREFLIGHT`), latido menor de 1.5 s, `crc_mal=0`, `pose` subiendo a 50/s y `omitidas=0`.
3. En la Pi: `tail -f` del `telemetry.jsonl` que escribe telemetryd: POSE con `seq` seguido y `ofs_reloj_ms` estable. `chronyc sources` debe mostrar `LILY` cuando hay hora (`F_TIME`).
4. Detener `demeter-mission`: a los 3 s el monitor debe pasar a "desconocido" y el log tener un `T_PI` con `kind=2`.

## Pendiente

- 9c: comandos de misión a la Pi (PREFLIGHT al verla en BOOT, ARM, ABORT, START_ASCENT en BOOST, START_REC, TOUCHDOWN) y `OP_PI_CMD` desde tierra.
- 9d: encendido por IO45 con el latido; proponer `HandlePowerKey=ignore` en la Pi.
- Hardware: 1 kΩ también en la línea Pi TX → IO44.
