---
fecha: 2026-11-04
tipo: sesion
ids: [D-054, D-055, T-702]
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

## Validación en banco (Pablo, 2026-11-04, env `demeter`)

- Hubo que corregir antes el `printf` de `[boot]` en `main.cpp` de cohete y tierra, que venía roto desde la importación `69a75b8` (un `\n` convertido en salto de línea real).
- `[pi  ]`: estado BOOT, latido 0.5 s, `crc_mal=0`, `otras=0`, `omitidas=0`, banderas `0x0DC` (posición, altura, hora por GNSS+PPS, hora válida, GNSS 3D).
- En la Pi: `seq` seguido, `ofs_reloj_ms` entre -0.18 y +0.001 ms (casi siempre por debajo de 20 µs).
- chrony con `LILY` como fuente (`#*`, estrato 1): desfase RMS 1.5 µs, ±100 µs estimados, frecuencia 2.77 ppm. Las fuentes NTP quedan como respaldo, a 4-15 ms.
- Al detener `demeter-mission`: `estado=desconocido`, `perdidas=1`; al arrancarlo vuelve a BOOT.
- Faltó: ver el estado de la Pi en TELEM por LoRa (fila Raspberry Pi en Mando, con tierra conectada) y el `T_PI` en el log con `tblog`. El dashboard de control muestra ahora la línea `[pi  ]` en Diagnóstico.

## 9c: comandos de misión hacia la Pi (escrito sin compilar)

- `pi_plan.h` (C++ puro): fase objetivo de la Pi según la misión y siguiente comando según su latido (D-055). Simulado en Python contra las transiciones de `missiond`: vuelo normal, BOOST sin armar, desarme, reinicio de la Pi en ASCENT y aterrizaje sin apogeo dan las cadenas correctas.
- `ext_pi.cpp`: manda el comando cada 1 s mientras la Pi no cambie (3 intentos, 10 s de pausa; en ERROR, cada 30 s) y lo registra (`T_PI` kind 3). La línea `[pi  ]` agrega `meta`, `ult_cmd`, `cmds` y `agotados`.
- `mission.cpp`: ARM de Demeter exige la Pi en READY o ARMED (motivo 22, `RZ_PI_NO_LISTA`, se puede forzar). Hay que recompilar también tierra para que muestre el texto del motivo nuevo.
- `tblog.py` imprime los comandos; Diagnóstico muestra la fase y el último comando. `web1.py` (web pública) no se toca: tampoco conoce el motivo 21.
- Pruebas de PC (`test/host`): stub de `piStatus` y `RZ_COUNT = 23`. No se corrieron: no hay g++ en el PC.

## Prueba en banco de 9c (Pablo, 2026-11-04 23:04-23:21; sesión `20261104_230851_demeter`, journal de la Pi)

- Funcionó la cadena completa: PREFLIGHT automático en TIERRA (READY a los 3.7 s), ARM (23:10:17), desarme con ABORT y vuelta a READY, ARM, BOOST → ASCENT con `rpicam-vid` (23:12:54), APOGEO → RECORDING (23:13:08), ATERRIZAJE → TOUCHDOWN (23:13:40) → INGESTING → PROCESSING (23:14:12) → COMPLETE (23:17:13, 330 imágenes) → reinicio en BOOT.
- **Procesamiento en la Pi:** 3.5 min tras TOUCHDOWN para 32 s de captura a ~10 fps (ingesta 245 s; revelado 179 s), con alertas `sd_read/write_throughput_low`. En vuelo serían hasta 95 s de captura: ~10 min después de aterrizar. No afecta el vuelo, sí la batería en recuperación.
- **Espacio:** la prueba dejó 5.9 GB en la SD de la Pi (RAW 3.7, PNG 1.9, JPEG 0.3). Con 20.17 GB libres, PREFLIGHT falla su presupuesto (21.25 GB para 95 s): la Pi queda en ERROR.
- **Error de la LilyGo (corregido):** en ERROR, PREFLIGHT pasa por PREFLIGHT y vuelve a ERROR, y ese cambio de estado reiniciaba la espera de 30 s: la LilyGo mandaba PREFLIGHT cada ~3.4 s (y cada uno escribe una prueba en la SD de la Pi). Ahora la espera en ERROR se cuenta por tiempo.
- **Latido (corregido en la Pi):** PREFLIGHT (~3.5 s), TOUCHDOWN y la ingesta bloquean el bucle de `missiond`, y el latido se cortaba: "desconocido" de 1-2 s. El latido va ahora en un hilo propio.
- **QMI y SD al desarmar:** a las 23:11:05, al desarmar, 204 muestras perdidas de golpe con 2 timeouts y 1 FIFO llena, y luego `err` de SD de 0 a 47 (`reab` 19) hasta las 23:12:08: es la creación de la reserva nueva de 32 MB (ya documentado: no importa porque no se vuela sin armar). Durante el registro (23:12:40-23:17:36) el QMI pierde ~1 muestra/s, el 0.2 % ya conocido por compartir el bus con la SD. LSM: ~2.5 pérdidas por minuto en todo momento, también antes de la Pi (el salto de marca conocido). Nada apunta a `ext_pi`.
- Pruebas de `visionpack` corridas en la Pi (copia en `/tmp`): 30 OK.

## Pendiente

- 9c: validar de nuevo con la espera en ERROR y el latido en hilo; decidir el espacio de la SD de la Pi; comandos manuales a la Pi desde tierra (`OP_PI_CMD`), si hacen falta.
- 9d: encendido por IO45 con el latido; proponer `HandlePowerKey=ignore` en la Pi.
- Hardware: 1 kΩ también en la línea Pi TX → IO44.
