# Revisión del código de la Pi de Demeter 

Fecha: 2026-10-24. Archivos revisados: `demeter_protocol.py`, `demeter_telemetryd.py` y `demeter_missiond.py`.
No tuve acceso a `demeter_flight.sh`, `demeter_rec.cpp`, `demeter_ingestd.sh`, `demeter_postprocess.py` ni a las unidades systemd. ¿Dónde están?

La revisión se hizo leyendo el código, sin ejecutarlo. Los números de línea corresponden a la versión de este repo.
Nota: los tres primeros hallazgos se ven solo con la secuencia normal de comandos, sin que tenga que fallar nada.

Contexto: la máquina de estados de la LilyGO es la de [maquina_estados.md](../04_diseno/maquina_estados.md). Ver también D-023 en [visionpack_integracion.md](../04_diseno/visionpack_integracion.md).

---

## Bloqueantes: con esto así, la Pi no completa una misión

### 1. El ARM siempre falla

- `missiond.arm()` envía `{"health_check": true}` y espera una respuesta `telemetry_health` (`demeter_missiond.py:524`).
- `telemetryd` no maneja `health_check`: el mensaje cae en `COMMANDS[command["command"]]` (`demeter_telemetryd.py:210`) y se produce un `KeyError`.
- Ese error se registra como "comando IPC inválido" (`:213`) y **no se responde nada**.
- `missiond` espera 5 s (`demeter_missiond.py:468`), lanza `RuntimeError` y, como está en READY, `fail()` lo manda a **ERROR** (`:694`).

Parece que los dos daemons quedaron en versiones distintas, porque `missiond` también espera el campo `serial_connected` (`:479`).
**Arreglo:** que `telemetryd` responda a `health_check` con `ok` y el estado real del UART, o quitar esa verificación del `arm()`.

### 2. `telemetryd` ignora PREFLIGHT y START_ASCENT que llegan de la LilyGO

- `COMMANDS` solo contiene ARM, START_REC, TOUCHDOWN y ABORT (`demeter_telemetryd.py:39`).
- Las tramas `0xA0` (CMD_PREFLIGHT) y `0xA2` (CMD_START_ASCENT), definidas en `demeter_protocol.py:16,18`, no aparecen en `COMMAND_NAMES`, así que `handle_frame` las **descarta sin dejar registro** (`:144`).

Resultado: si la LilyGO maneja la secuencia, la Pi se queda en BOOT para siempre.
**Arreglo:** agregar los dos comandos al mapa.

### 3. Si `telemetryd` no responde en el apogeo, no se graba RAW

`start_recording()` hace todo en este orden:
1. Detiene el video del ascenso (`demeter_missiond.py:607`).
2. Pasa a STARTING.
3. Pide `reset_telemetry`; si no llega respuesta en 5 s, lanza `RuntimeError` (`:616-617`).
4. Como está en STARTING, `handle_command` lo manda a **ERROR** (`:696`).

Para ese momento el video del ascenso ya se cortó y la captura RAW nunca arrancó. Un solo timeout de IPC en el apogeo hace perder **todo** el video del descenso.
**Arreglo:** lanzar la captura RAW aunque el reset falle, registrando la advertencia; o hacer el reset antes, por ejemplo en ARM.

### 4. El reset borra la telemetría del ascenso

- `reset_telemetry` sobrescribe el log con un archivo vacío y borra el snapshot (`demeter_telemetryd.py:187-190`).
- El log está en `/mnt/ramcam/telemetry.jsonl`, que es tmpfs (`:240`), y se llama en el apogeo (punto 3).

Si `ingestd` no lo copió antes, **se pierde la telemetría del ascenso**.
**Arreglo:** rotar el archivo (cerrarlo con otro nombre y abrir uno nuevo) en lugar de truncarlo.

---

## Riesgos altos

### 5. El video del ascenso en MP4 se corrompe si se corta la energía

- Se graba con `--codec libav --libav-format mp4` (`demeter_missiond.py:551-552`).
- Un MP4 escribe su índice (el átomo `moov`) **al cerrar**.
- Al detenerlo, solo se espera 1 s después del SIGINT y luego se manda SIGTERM o kill (`:577-591`).

Si el proceso no alcanza a cerrar, o se va la energía, el archivo queda ilegible.
**Sugerencia:** un contenedor que aguante un corte (H.264 crudo, MPEG-TS o MKV) y esperar más tiempo al detenerlo.

### 6. La codificación 1080p60 por software en la Pi 5

- La Pi 5 **no tiene codificador H.264 por hardware**, así que `libav` codifica en la CPU.
- El IMX708 no tiene un modo 1080p nativo a 60 fps. Lo más probable es que rpicam use el modo binned de 1536×864 a 120 fps y escale, perdiendo calidad y cambiando el campo de visión.
- Hay que verificarlo con `rpicam-vid --list-cameras` y medir si se sostienen los 60 fps junto con el resto de procesos.
- `--listen` (`:554`) solo tiene sentido con salida TCP; con un archivo no hace nada.

### 7. El watchdog del ascenso dispara a los 15 s del START_ASCENT

- `ASCENT_WATCHDOG_S = 15` (`demeter_missiond.py:31`) se cuenta desde START_ASCENT (`:569`).
- Si START_ASCENT llega antes del despegue, por ejemplo en ARMED, el watchdog dispara **antes del apogeo**.
- Hay que definir con qué evento se manda (D-023 en [visionpack_integracion.md](../04_diseno/visionpack_integracion.md)) y ajustar el valor con el tiempo al apogeo simulado.

### 8. Un PREFLIGHT repetido borra el tmpfs

`preflight()` hace `rm -rf` sobre todo el tmpfs (`demeter_missiond.py:126-129`). Si alguien manda PREFLIGHT después de un vuelo, antes de que `ingestd` vacíe los chunks, se pierden.
**Sugerencia:** negarse a purgar si quedan chunks sin copiar.

---

## Riesgos medios

- **Un ABORT puede bloquear hasta 10 minutos:** `--stop-timeout` vale 600 s por defecto (`demeter_missiond.py:916`) y `abort()` espera ese tiempo (`:650`).
- **No hay timeout en INGESTING ni en PROCESSING:** si el posproceso se cuelga, la misión nunca llega a COMPLETE.
- **La detección depende de un texto del log:** se busca `b"Revelado iniciado"` en la salida (`:780`). Si cambia el mensaje del script, se rompe sin avisar.
- **El flag de touchdown puede quedar obsoleto:** `/tmp/touchdown_event.flag` (`:29`) bloquea el preflight si existe (`:159`). ¿Quién lo borra entre vuelos? En Raspberry Pi OS, `/tmp` puede no ser tmpfs y sobrevivir al reinicio.
- **Se mezclan dos bases de tiempo:** `pi_ts` usa el reloj de pared (`time.time()`), mientras que los timestamps de la cámara son monotónicos. Hay que definir cómo se alinean el video y la telemetría.
- **No hay latido entre los daemons:** si `telemetryd` se cae, `missiond` solo lo nota cuando intenta enviarle un comando.

---

## Integración con el firmware compartido

- El UART de la Pi recibe la orientación como ángulos de Euler (`<Qffff>`: ts, alt, roll, pitch, yaw), mientras que el LoRa usa cuaterniones. Está bien, pero el firmware tiene que convertir, y conviene acordar la convención de ángulos.
- `mission_secondary_state` del paquete LoRa podría llevar el `StatusCode` de la Pi (D-007 en [protocolo_paquetes.md](../04_diseno/protocolo_paquetes.md), campo estado_sec).
- Falta acordar **cuándo enciende la LilyGO a la Pi** (el pulso de 1,5 s), sabiendo cuánto tarda en arrancar. Si se enciende al detectar el despegue, no hay video del ascenso.
