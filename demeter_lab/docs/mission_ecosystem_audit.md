# Auditoría del ecosistema de misión

Fecha de inspección: 2026-10-10. Este documento separa lo que el pipeline de
imagen ya hace de las funciones del sistema de misión que aún deben construirse
fuera de `eyes_of_demeter`.

## Alcance real de `demeter_flight.sh`

El orquestador de `eyes_of_demeter` prepara un directorio de misión, valida
`/mnt/ramcam` como `tmpfs`, impide ejecuciones simultáneas, inicia `demeter_rec`,
ingiere chunks cerrados de RAM a SD, detiene el recorder por timeout, touchdown
o señal, y lanza el revelado JPEG/PNG en segundo plano.

No lee UART/USB/BLE/LoRa, no habla con LilyGO, no crea el evento de touchdown y
no transmite estado. Solo consulta cada segundo `/tmp/touchdown_event.flag`, un
contrato con un productor externo que no está instalado/documentado como
servicio en este host. Tampoco captura telemetría de vuelo ni registra
periódicamente CPU, memoria, temperatura, voltaje, throttling o espacio en SD.

`demeter_rec` sí registra por frame secuencia, timestamp de sensor, exposición,
ganancia, pairing/skew, estado de sincronización y offsets/tamaños RAW/stats.
Admite `--telemetry-file` y copia un objeto JSON a `chunk_telemetry.json` al
cerrar cada chunk. Pero `demeter_flight.sh` no pasa ese argumento ni crea el
archivo predeterminado `/mnt/ramcam/current_telemetry.json`. Los chunks de la
prueba `loopback_sync_20261010` contienen `flight_telemetry: null` y el error
`cannot open /mnt/ramcam/current_telemetry.json`. Esta interfaz es solo un
snapshot por chunk, no una captura temporal de telemetría.
Cuando VisionPack implemente el productor, debe publicar snapshots completos de
forma atómica (archivo temporal + rename), incluir `mission_id` y timestamps
UTC/monotónicos, y conservar el flujo íntegro por separado como CSV/JSONL. Así el
recorder no leerá un JSON parcial y el resumen por chunk seguirá siendo una
referencia de estado, no el archivo de telemetría original.

`demeter-sync.service` configura multicast en `lo` y la ruta
`239.255.255.250/32 dev lo` para el protocolo `rpi.sync` entre cámaras. No es un
servicio LilyGO ni un enlace de telemetría. La unidad inspeccionada está
habilitada en systemd. `/etc/fstab` monta `/mnt/ramcam` como `tmpfs` de 3 GiB;
la plantilla del unit y la configuración mínima se archivan en `host/`.

Los scripts antiguos aportan antecedentes, no servicios operativos actuales:
`captura8seg.sh` solo escribe el encabezado de `telemetry.csv`; monitorea CPU y
RAM cada segundo, pero elimina ese log al finalizar. `flightcapturev2.sh` y
`frf4.sh` registran RAM/temperatura por chunk, pero su productor de captura era
`sleep`. No demuestran telemetría física, throughput de cámara ni integración
LilyGO.

## Funciones pendientes fuera del pipeline

1. **Telemetría y enlace LilyGO:** protocolo y framing, identificación/CRC,
   parser serie, timestamps UTC/monotónicos, reconexión, watchdog, pérdidas y
   persistencia de paquetes recibidos. Definir explícitamente cómo se solicita
   touchdown y cómo se autentica/valida el evento.
2. **Coordinador de misión:** un único servicio externo administra estados
   `preflight/armed/recording/touchdown/finalizing/complete/error`, genera un
   evento atómico para `demeter_flight.sh`, inicia/paraliza captura y telemetría,
   y conserva manifiesto final incluso ante fallo o apagado.
3. **Estado transmitido desde la Raspberry Pi:** heartbeat con ID de misión,
   estado del recorder/SD, tiempo restante, temperatura, memoria, espacio,
   FPS/pérdidas y estado del enlace; definir cadencia, prioridad y comportamiento
   cuando la radio no está disponible.
4. **Monitor de recursos persistente:** CPU/RSS, memoria disponible, temperatura,
   throttling/undervoltage, espacio y errores de escritura. Guardar CSV/JSONL
   bajo la misión; establecer umbrales y acciones de degradación/aborto.
5. **Preflight y recuperación:** validar cámaras, sync loopback, montaje/espacio
   SD, permisos, alimentación, UART, recorder y versión de configuración. Tras
   reboot/corte, marcar la misión incompleta y recuperar chunks comprometidos sin
   borrar datos pendientes.
6. **Validación de vuelo:** pruebas de pérdida de UART/radio, touchscreen/false
   trigger, SD llena/lenta, chunk truncado, corte de energía, reinicio y carga
   térmica. `eyes_of_demeter` no está cualificado para vuelo sostenido.

El coordinador, el cliente LilyGO, los monitores, las unidades systemd, reglas de
dispositivo y herramientas de instalación pertenecen a `Demeter_VisionPack`.
`eyes_of_demeter` conserva la adquisición RAW/stats y el revelado/replay de
imagen. El contrato entre ambos debe ser pequeño y versionado: directorio de
misión, archivo de telemetría/snapshot, eventos de inicio/parada y manifiesto de
salida.