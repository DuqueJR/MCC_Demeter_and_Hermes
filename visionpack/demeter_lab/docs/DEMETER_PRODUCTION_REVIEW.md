# Demeter: revisión de arquitectura de producción

**Fase:** Producción 0 (revisión, no implementación)  
**Fecha:** 2026-10-09  
**Alcance:** `capture_pisp_stats.cpp`, `controller_replay.cpp`, `demeter_isp.py`, `frf4.sh`, `praw2rgb.cpp` y scripts de captura relacionados.

> **Estado a 2026-10-10:** la recomendación de crear `demeter_rec.cpp` ya se
> implementó en `/home/admin/eyes_of_demeter/src/demeter_rec.cpp`. Hay captura
> dual experimental por chunks, metadata JSONL por frame y sincronización
> software `rpi.sync`; el RAW/stats se almacena en
> `/home/admin/demeter_recording/scientific_rec/raw/` y se revela a JPEG95/PNG
> RGB888 de 8 bits. Las pruebas citadas más abajo son smoke tests cortos, no
> benchmark sostenido ni cualificación para vuelo. El resto de esta revisión
> documenta el análisis original del 9 de octubre y sus riesgos aún abiertos.

## Dictamen ejecutivo

El camino de imagen y estadísticas funciona como prototipo offline de un frame. `capture_pisp_stats` ya demuestra que libcamera permite reutilizar `Request` y `FrameBuffer` mediante `reuse(Request::ReuseBuffers)` y `queueRequest()`, pero el binario solo reencola para estabilizar y después escribe un frame y sale. No hay evidencia de throughput sostenido de este ejecutable, ni de captura simultánea de ambas cámaras con él.

**Recomendación: B, crear `demeter_rec.cpp` como recorder continuo.** Mantener `capture_pisp_stats` como herramienta de diagnóstico de un frame. Compartir la inicialización y serialización cuando convenga, pero no convertir el camino experimental en el recorder de vuelo mediante una expansión grande.

**Actualización de fase 1 (2026-10-10):** ya existe [demeter_rec.cpp](../../eyes_of_demeter/src/demeter_rec.cpp), integrado en `build.sh`. Compila y pasó smoke real dual RAW-only con SIGINT, stats por frame, chunks y JSONL indexado. Una ejecución de ~3 s observó skew máximo ~18.9 ms. Esto confirma funcionamiento básico, no rendimiento sostenido ni sincronización de exposición de grado fotogramétrico; las brechas de cualificación de esta revisión siguen abiertas.

## Pregunta 1: ¿Puede reutilizar la cola actual?

**Sí, técnicamente.** La prueba local de concepto está en [capture_pisp_stats.cpp](../../eyes_of_demeter/src/capture_pisp_stats.cpp#L454): después de cada frame de estabilización hace `request->reuse(Request::ReuseBuffers)`, reaplica controles y llama `camera->queueRequest(request)`. Cada request conserva sus buffers de vídeo y RAW; el bucle vuelve a ponerlos en la cola. El código conecta `requestCompleted` y espera en una cola acotada por timeout.

**Lo que no demuestra:** escritura continua segura, doble cámara, sincronización entre cámaras, FPS sostenido, backpressure de SD ni recuperación tras un request fallido. El camino actual encuentra un request final y luego escribe solo ese RAW, sus stats y su JSON en [capture_pisp_stats.cpp](../../eyes_of_demeter/src/capture_pisp_stats.cpp#L466). Para convertirlo habría que reencolar también el frame final y todo frame que se persista, administrar la vida de requests/buffers, manejar requests cancelados y fallidos explícitamente, y desacoplar el callback de cámara de I/O lento. El escritor no debe bloquear el callback ni dejar que se reutilice un buffer mientras aún se escribe.

## Pregunta 2: rendimiento máximo esperable

No existe un benchmark del recorder continuo propuesto. Las cifras de abajo son referencias y estimaciones para dimensionar pruebas, no garantías de vuelo.

| Métrica | Evidencia disponible | Implicación |
|---|---|---|
| FPS | Modo completo de IMX708 se ha operado hasta ~14.35 fps por cámara en `rpicam-hello`; scripts previos usaron objetivo de 10 fps y registraron ~9.4 fps en una misión dual. No son mediciones de `capture_pisp_stats`. | Usar 10 fps/cámara como primer objetivo de aceptación del recorder, no como promesa. El techo real depende de modo configurado, dos cámaras, controles, colas y almacenamiento. Medir 1 y 2 cámaras por separado. |
| RAM | Un frame COMP1 observado es del orden de 6.1 MB; Bayer16 es ~23.9 MB y RGB888 ~35.8 MB a 4608x2592. Stats son 23,200 B/frame. El número de buffers de la configuración actual lo decide libcamera; no se ha medido el RSS/uso DMA total. | En 10 fps, guardar COMP1+stats requiere aproximadamente 61.2 MB/s por cámara y 122.4 MB/s para dos, usando 6.1 MB como tamaño representativo. Un chunk de 8 s representa ~488 MB/cámara o ~976 MB para dos. Dos chunks simultáneos en A/B duplican esa reserva: ~1.95 GB, antes de buffers DMA y proceso. Tamaño COMP1 varía con la escena. |
| CPU | Sin perfil de CPU/temperatura de una grabación continua propia. PiSP FE hace adquisición/stats y el BE es hardware; la copia, checksum, conversión y Controller tienen coste CPU. El replay del Controller itera 64 veces un mismo bloque de stats, pero es postproceso de un frame. | No asignar capacidad CPU por estimación visual. Medir carga por núcleo, throttling, temperatura y pérdida de requests con conversión apagada/encendida y SHA-256 activado/desactivado. |
| I/O | Referencia de flujo COMP1 anterior ~6.1 MB/frame; BAYER16 y RGB888 intermedios son mucho mayores. `frf4.sh` registra tiempo y bytes de rsync, pero el productor actual es `sleep`, así que no mide el caudal de cámara. | A 10 fps: ~61 MB/s por cámara y ~122 MB/s dual hacia el almacenamiento, más metadatos y sobrecarga. Verificar la velocidad sostenida real de la SD bajo temperatura y sistema de archivos; usar margen y reserva de espacio. |

**Dimensionamiento:** para tasa real `S` bytes/frame, FPS `F`, cámaras `C`, duración de chunk `T`, el flujo es `S × F × C` y el RAM de dos buffers completos es aproximadamente `2 × S × F × C × T`, más pools DMA, vídeo, metadata y margen. La muestra ~6.1 MB COMP1 no es un máximo: probar escenas con textura y ruido, pues cambian la compresión.

No guardar Bayer16 ni RGB888 durante adquisición salvo necesidad científica: ambos elevan drásticamente RAM e I/O; producirlos offline desde COMP1 es el diseño actual.

## Pregunta 3: estructura de almacenamiento

| Opción | Ventajas | Riesgos/coste | Evaluación |
|---|---|---|---|
| Un archivo por frame | Fácil inspección, recuperación por frame, metadatos junto al dato y reintento localizado. | Muchos `open/close`, directorios con miles de entradas, journaling y metadatos por archivo, rsync/checksum por fichero; escritura fragmentada. | Útil para calibración y pruebas cortas; no es mi formato de misión preferido. |
| JSONL | Append sencillo para índice/eventos; una línea dañada no suele impedir leer las posteriores. | JSONL es texto de metadatos, no contenedor eficiente para RAW; no debe codificar cada imagen como texto/base64. Un único log no basta para asociar con seguridad payload parcial tras corte. | Usarlo como índice/telemetría por frame, no como almacenamiento de imágenes. Rotar por chunk y validar cada registro. |
| Chunk packing | Escritura secuencial, pocos archivos, transferencia y checksum por unidad; permite agrupar frame, stats y metadatos. | Sin índice/framing, un frame parcial puede desalinear el resto; chunks grandes amplían la pérdida potencial y el tiempo de reintento. | Recomendado: chunk binario por cámara y segmento corto con cabecera/versionado, offsets/tamaños, secuencia, timestamp, stats, metadatos y checksum; índice JSONL legible por chunk. |

**Diseño sugerido:** chunks de 1–2 s inicialmente (validar velocidad y pérdida tolerable), cada uno escrito como `.part`; al cerrar, comprobar tamaños y checksum, sincronizar el fichero, renombrar atómicamente a nombre final y sincronizar el directorio. `mission.json` debe ser manifiesto versionado con configuración/perfil hash, cámaras, formato/modo, secuencias esperadas/observadas, huecos, estado final y hashes. El consumidor solo ingesta chunks `complete`; mantiene fuente en RAM hasta verificar el destino. El archivo individual por frame puede seguir existiendo como modo laboratorio.

El actual [frf4.sh](../scripts/flight/frf4.sh#L85) copia carpetas de chunks con rsync, hace `sync` global y verifica tamaño o SHA opcional. Es una primera estructura A/B útil, no un contenedor atómico ni una transacción reanudable.

## Pregunta 4: modificar el capturador o crear recorder nuevo

**Elegir B: `demeter_rec.cpp`.**

- `capture_pisp_stats` es un ejecutable de validación: configuración, settle, selección de una cámara, captura final, tres ficheros y salida. Preservarlo mantiene un test conocido y reproducible.
- El recorder requiere ciclo de vida continuo, pool de buffers, cola productor-consumidor, gestión explícita de caídas, segmentación, backpressure, control de señal y política de apagado. Es otro contrato operacional.
- El nuevo binario debe aceptar configuración de misión y cámara(s), emitir chunks completos y contabilidad, y fallar con código/manifestado explícito. Reutilizar `Settings`, lectura del perfil y serialización solo tras extraer una interfaz pequeña común, sin mezclar la política de captura de prueba.
- Integrar primero una cámara, después demostrar simultaneidad dual. No asumir que dos procesos `CameraManager` o dos ejecuciones concurrentes son válidos hasta probarlos en el sistema real.

## Pregunta 5: fallos, recuperación y prevención

Estados: **Implementado** significa visible en el código revisado; **Parcial** significa que hay detección o mitigación limitada; **Ausente/no demostrado** significa que no hay mecanismo suficiente en las fuentes inspeccionadas.

| Fallo | Estado actual y evidencia | Riesgo / requisito de producción |
|---|---|---|
| Power loss | **Parcial.** `frf4.sh` ejecuta `sync` tras copiar (línea 97) y verifica el destino antes de borrar cada fuente. La fuente está en RAMDisk y se pierde al cortar alimentación. `mission.json` se escribe directamente al final. | Puede perderse el chunk en curso, la RAM pendiente y el manifiesto; no hay `fsync` por archivo/directorio, rename transaccional ni recuperación/reindexado al arrancar. Usar chunks `.part`/commit, sincronizar y reconstruir el manifiesto desde chunks válidos. Un UPS/supervisor y apagado ordenado son defensa adicional, no sustituyen el formato recuperable. |
| SD llena / errores de escritura | **Parcial.** Preflight exige 4 GiB libres y confirma que `/mnt/ramcam` es mountpoint ([frf4.sh](../scripts/flight/frf4.sh#L29), [frf4.sh](../scripts/flight/frf4.sh#L37)). Verifica tamaño/hash después de rsync. | No vuelve a reservar espacio durante el vuelo ni detiene el productor al alcanzar umbral; no reserva margen para manifest/log/journal. `rsync` no se valida inmediatamente y el script no tiene `set -e`; podría avanzar hasta el chequeo posterior. Definir watermark de parada, comprobar retorno/capacidad por chunk, conservar fuente y reportar misión incompleta. |
| UART/LoRa perdido | **Parcial/no demostrado.** El consumidor de misión termina al encontrar `/tmp/touchdown_event.flag`; la existencia de la bandera permite un evento de touchdown ([frf4.sh](../scripts/flight/frf4.sh#L19)). No se encontró receptor UART ni implementación LilyGO en los ficheros auditados. | El flag no demuestra heartbeat, detección de enlace perdido, secuencia/CRC, edad del dato, autenticidad ni acción segura ante silencio. Implementar monitor con contador/secuencia y timeout; definir si la pérdida significa continuar hasta `MAX_TIME`, entrar en modo seguro o detener captura. Probar cortes y eventos duplicados. |
| Kernel/app restart | **Ausente/no demostrado.** No hay watchdog, supervisor, persistencia del estado del productor/consumidor ni reanudación en el script revisado. `failed_chunks.count`, flags y RAMDisk son temporales. | Tras reinicio se pierden flags/estado; `frf4.sh` borra contenido de A/B al iniciar. Incorporar servicio supervisado, boot recovery que nunca borre chunks no confirmados, ID de misión persistente y reconciliación por índice. |
| Cámara/request timeout o fallo de captura | **Parcial en capturador.** Espera hasta 10 s por frame, excepciones y `CameraCleanup` paran/liberan cámara. En `RequestWaiter`, requests no completos no se agregan al buffer de listos; el principal acabará en timeout. | No hay política de reintento/reinicio de cámara, conteo de secuencia perdida ni reporte durable; un error puede terminar la captura. Recorder nuevo necesita timeout, estado fatal por cámara, watchdog de progreso y cierre de chunk parcial. |
| Consumidor lento / espera de buffer | **Parcial.** A/B, flag `.free`, flag `.ready`, polling y timeout de 30 s; se cuenta fallo. | Si el productor agota timeout, avanza el número del chunk sin emitir `.ready`; el consumidor espera estrictamente el número esperado y puede dejar chunks posteriores sin ingestar. Nunca saltar secuencia silenciosamente: escribir evento `gap`, permitir búsqueda del siguiente chunk completo y finalizar como incompleta. |
| Copia corrupta o interrumpida | **Parcial.** Hash SHA-256 es opcional (`CHECK_MODE=sha256`); por defecto compara solo tamaños y exige >0. Fuente se elimina por archivo después de verificar. | Igual tamaño no demuestra integridad. `rsync` no escribe a un destino temporal/rename en este script; un fallo tardío puede dejar destino parcial. Verificar checksums siempre para chunks comprometidos y borrar fuente solo tras commit persistente del chunk entero. |
| Touchdown / fin de misión | **Parcial.** Se comprueba la bandera y se drena consumidor al tocar `mision_finalizada.flag`; hay límite temporal. | Sin protocolo que valide origen/latencia, cualquier fichero con ese nombre detiene misión. Falta timeout de drenaje/resultado si consumidor queda bloqueado. Registrar causa de cierre y estado completo/incompleto. |
| Fallo de `praw2rgb`/BE o falta de espacio offline | **Parcial en host de desarrollo.** `demeter_isp.py` llama `subprocess.run(check=True)` y fallará ante código de salida distinto de cero; no borra los insumos de captura. | No es recuperación de vuelo ni cola reanudable por lote. Añadir estado por frame, reintentos idempotentes y conservar COMP1/stats hasta verificar artefactos. |

### Requisitos mínimos antes de declarar listo para vuelo

1. El recorder informa secuencia, timestamp monotónico, cámara, modo/configuración, bytes escritos, frames perdidos y estado de cada chunk; buffers tienen límites y política de backpressure explícita.
2. Commit atómico de chunk + índice/checksum; al boot se recuperan `.part` y chunks válidos sin borrar datos previos.
3. SD con reserva comprobada continuamente; si el consumidor no alcanza el productor o la SD se acerca al límite, el sistema marca `mission_incomplete` y ejecuta la política acordada, nunca finge éxito.
4. Pruebas de corte de energía, `ENOSPC`, rsync/escritura fallida, proceso terminado, reinicio kernel, UART desconectado y pérdida de cámara, tanto con una cámara como con dos.
5. Benchmark sostenido con sensores reales, almacenamiento final, perfil de vuelo, temperatura y escena de alta compresión/ruido; registrar FPS efectivo, huecos, RSS, CPU por núcleo, temperatura, bytes/s y latencia de chunk.

## Evidencia y límites

- La captura guarda `PISP_FE_STATS` de 23,200 bytes y sidecar, y la ruta de Controller/BE ya produjo RGB888 con señal; es un hito offline validado, no una calificación de imagen científica ni una misión continua.
- `controller_replay` lee tamaños exactos, valida estados y configura BE. Repite la misma estadística 64 veces, no una secuencia temporal; no modela TDN.
- `demeter_isp.py` calibra/fija WB, congela perfil y orquesta captura/comparación de un frame; no es grabador de vuelo.
- `frf4.sh` es el más avanzado de los scripts de ingestión revisados, pero su productor está sustituido explícitamente por `taskset -c 1 sleep $CHUNK_TIME_S` ([frf4.sh](../scripts/flight/frf4.sh#L199)). Las tasas de captura/ingesta de ese script aún no son mediciones.
- Las protecciones listadas describen únicamente el código local inspeccionado; no se atribuye comportamiento a firmware, receptor LoRa, systemd ni hardware no presente aquí.
