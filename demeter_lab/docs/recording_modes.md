# Evolución de los formatos de grabación

Los ejemplos pequeños asociados a las sesiones antiguas están en
`demeter_lab/data/recording_examples/`. Los archivos RAW originales se retiraron
por espacio después de guardar los manifiestos y logs.

## 1. Captura nativa plana (`normal_rec`)

Los scripts históricos `captura8seg.sh` y `flightcapturev1/v2.sh` usaban
`rpicam-raw` para guardar un archivo por cámara, por ejemplo `cam0.raw` y
`cam1.raw`. La sesión se acompañaba con `session.json`, logs de cámara y, en la
versión más avanzada, `telemetry.csv`. El volcado se verificaba por tamaño antes
de limpiar RAM.

Ejemplos conservados:

- `native_rpicam/20261007_180336/session.json`: objetivo 10 fps, 195 frames por
  cámara, 9.397 fps reportados, 6,125,095 bytes/frame y 1,194,393,600 bytes por
  stream. El manifiesto no reporta sincronía entre las cámaras.
- `native_rpicam/20261007_181637/session.json`: 195 y 194 frames, 9.405 y
  9.357 fps, sync delta informado de 46 us, transferencia y limpieza de RAM
  reportadas como verificadas. Incluye logs de cámaras y `telemetry.csv`.

Este modo mantiene el flujo RAW que entrega rpicam y sus metadatos de sesión,
pero no guarda el bloque real `PISP_FE_STATS` indexado frame a frame para el
replay del Controller.

## 2. Prototipo de ingestión A/B y `mission_resource.log`

`flighcapturev1.sh`, `flightcapturev2.sh` y `frf4.sh` probaron buffers alternos
A/B, flags `.ready`/`.free`, `rsync`, verificación por tamaño y manifiestos
`mission.json`. `frf4.sh` añadía `mission_resource.log`, que anotaba `free -m`
y temperatura antes/después de cada chunk. Los archivos y protocolos están
conservados en `scripts/flight/`; ejemplos ligeros de metadatos están en
`ab_prototype/`.

- La sesión `20261007_190735` declara 15 chunks de 8 s, cero fallos y sin evento
de touchdown. Conserva `mission.json` y `sys_chk*.log`.
- La sesión `20261007_191406` conserva `mission.json` y `mission_resource.log`.
  El log registra RAM, swap y temperatura por chunk. El manifiesto indica
  `transfer_stats.total_bytes: 0` y `avg_mb_s: 0.00`; no debe interpretarse
  como benchmark de caudal.
- En las variantes históricas revisadas el productor real estaba comentado o
  sustituido por `sleep`. Por tanto, esos ensayos validan la mecánica del
  consumidor/telemetría, no throughput de captura ni sincronización de cámara.

## 3. Grabación científica actual (`scientific_rec`)

El recorder de producción experimental `eyes_of_demeter/src/demeter_rec.cpp`
registra simultáneamente dos streams `BGGR_PISP_COMP1` y `PISP_FE_STATS`,
metadata JSONL con offsets/timestamps y chunks cerrados. La sincronización usa
`rpi.sync` por multicast de loopback. `demeter_flight.sh` finaliza por touchdown
o timeout, hace ingesta de chunks y dispara el revelado offline.

Estructura de misión objetivo:

```text
demeter_recording/
|-- normal_rec/
|-- scientific_rec/
    |-- raw/<mission>/chunk_NNNN/
    |-- jpeg/<mission>/camX_frame_YYYYYY.jpg
    |-- png/<mission>/camX_frame_YYYYYY.png
```

`raw/<mission>` conserva los chunks, stats y metadata necesarios para auditoría
y reprocesado; no se debe borrar al limpiar previews. `jpeg/` y `png/` son
productos regenerables del revelador. El modo científico no sustituye la
captura nativa de `normal_rec`: son dos productos distintos y sus medios no se
deben mezclar.

Validaciones disponibles: tamaño COMP1 medido de 11,943,936 bytes/frame en la
captura de referencia; una prueba dual produjo 62 pares y offsets RAW/stats
continuos. Con la ruta loopback, los pares con `SyncReady` mostraron skew
mediano de 19 us y máximo de 23 us. Esta prueba mantuvo Wi-Fi activo y no es una
cualificación de vuelo sostenido ni una medición de sincronización eléctrica.

## Limpieza

Eliminación de grabaciones históricas: se preservan los manifiestos y logs
indicados arriba; los streams RAW originales eran reproducciones locales no
requeridas por el build. Los nuevos vuelos se guardan bajo `demeter_recording/`.
No borrar `scientific_rec/raw/<mission>` si se necesita conservar la fuente para
revelado científico.