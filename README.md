# Eyes of Demeter

Pipeline de captura dual para Raspberry Pi 5 / BCM2712 D0 con dos IMX708. Registra `BGGR_PISP_COMP1` y `PISP_FE_STATS`, ejecuta el `RPiController::Controller` de libcamera fuera del pipeline de captura y revela JPEG/PNG usando el PiSP Back End.

Versiones fijadas: libcamera `0.7.2+rpt20260817` (`6c1dd9d55573010f710c9e190a73e7e76f0d9432`) y libpisp `1.7.0` (`f8a5eb2af4c5dea76442785ef42b2fb1aa9e62f9`). `dependencies.lock` contiene los pins; `build.sh` reconstruye las fuentes y binarios bajo `.build/`.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/capture_pisp_stats.cpp` | Captura de prueba de un RAW COMP1 y `PISP_FE_STATS` con perfil AE/AWB/AF |
| `src/demeter_rec.cpp` | Recorder dual: RAW + stats, pairing, sync y chunks |
| `src/controller_replay.cpp` | Reproduce stats en Controller, prepara BE y genera RGB888 |
| `demeter_isp.py` | Orquestador: `calibrate`, `freeze`, `capture`, `compare` |
| `demeter_flight.sh` | Captura de vuelo, ingestión de chunks RAM a SD y cierre seguro |
| `demeter_postprocess.py` | Revelado offline por frame a JPEG y PNG |
| `build.sh` | Obtiene fuentes fijadas y compila los binarios en `.build/` |
| `dependencies.lock` | Commits/versiones del software externo |
| `vendor/libpisp-patch/` | Ejemplo COMP1 mantenido por Demeter y licencia upstream |
| `profiles/` | Perfiles de operación (JSON) |
| `calibration/` | Calibración de WB por perfil y cámara (`<perfil>_camN.json`) y sus capturas de origen |
| `missions/` | Configuración congelada para vuelo (`mission_config.json` + flags de `rpicam-raw` por cámara) |
| `campaign/` | Scripts, protocolos y analisis experimentales |
| `results/` | Salidas locales de pruebas; los binarios generados se excluyen de Git |
| `DEMETER_PROYECTO.txt` | Arquitectura, dependencias, operacion, resultados y limitaciones |

## Qué se fija y qué queda automático

| Parámetro | Perfiles de vuelo | Dónde se decide |
|---|---|---|
| Balance de blancos | **Fijo**: ganancias R/B medidas en tierra (`white_balance.mode: "calibrated"`) | `calibrate` -> `calibration/` |
| Exposición y ganancia | **Automática** (AE): modo `short`, medición centro, restricción `highlight` | perfil `exposure` |
| Foco | `infinity` (lente en 0.0), `manual` (`lens_position`), `auto` o `continuous` | perfil `focus` |
| Black / white level | `tune` (4096) o valor fijo en dominio de 16 bit | perfil `develop`, o `--black-level` / `--white-level` |

Modos de `exposure.mode`: `auto` (con `exposure_mode` normal/short/long, `metering` centre-weighted/spot/matrix, `constraint` normal/highlight/shadows, `ev`) o `manual` (`shutter_us`, `gain`). Modos de `white_balance.mode`: `calibrated` (usa `calibration/`), `fixed` (con `gains: [R, B]`) o `auto`. El modo `short` limita el obturador máximo a 60 ms (tabla de la tune IMX708) y es el adecuado contra el desenfoque por movimiento.

Perfiles incluidos: `vuelo_infinito` (WB fijo + AE auto + foco infinito), `vuelo_autofoco` (igual, con autofoco continuo) y `prueba_todo_auto` (banco de pruebas, todo automático).

## Flujo operativo

```sh
./build.sh                                                     # obtiene pins y compila el pipeline
./demeter_isp.py calibrate --profile vuelo_infinito --camera 0   # en tierra, apuntando a un blanco neutro
./demeter_isp.py calibrate --profile vuelo_infinito --camera 1
./demeter_isp.py freeze    --profile vuelo_infinito              # escribe missions/<fecha>_<perfil>/
./demeter_isp.py capture   --profile vuelo_infinito --camera 0   # 1 frame de prueba con la config de vuelo
./demeter_isp.py compare   --profile vuelo_infinito --camera 0   # rpicam-still vs pipeline propio
```

`freeze` genera los flags equivalentes para `rpicam-raw`/`rpicam-still`, por ejemplo:

```
--exposure short --metering centre --ev 0.0 --awbgains 2.290968,1.519120 --autofocus-mode manual --lens-position 0.0
```

Estos flags se pueden añadir a las llamadas de `rpicam-raw` de los scripts de vuelo; los scripts existentes no se han modificado. Con `--awbgains` se desactiva el AWB y el AE sigue activo.

`compare` captura primero con `rpicam-still` y replica su exposición y ganancia en el pipeline propio para que la comparación sea justa (`--no-match-exposure` lo desactiva). Genera `lado_a_lado.jpg` (vista completa y recorte al 100 %) y `summary.json`.

## Recorder dual experimental

`demeter_rec` configura cámaras 0 y 1 con una sola `CameraManager`, cada una en `4608x2592 BGGR_PISP_COMP1` y `PISP_FE_STATS`, y solicita 10 fps. Solo reserva/persiste el stream RAW. Empareja los frames por orden de llegada y registra el skew de `SensorTimestamp` (solo descarta un frame si el skew supera medio periodo, es decir, hubo un frame perdido). Por defecto usa el sync por software de libcamera (`rpi.sync`): cam0 servidor, cam1 cliente; `--no-sync` lo desactiva. Cada JSONL incluye `sync_ready` y `sync_timer_us`. Medido (25 s, mismo montaje): sin sync el skew fue constante ~18.8 ms; con sync convergió en ~6 s a ~20 µs y `SyncReady` llegó tras ~12 s.

El sync de software usa multicast UDP `239.255.255.250:10000`; el host debe mantener una ruta multicast de loopback para que el cliente sincronice sin depender de WLAN. Comprueba que `ip route get 239.255.255.250` indique `dev lo`, y confirma `sync_ready` en el JSONL. La configuracion permanente de ruta/interfaz es especifica del host y no la instala este repositorio.

```sh
./.build/bin/demeter_rec \
	--out /mnt/ramcam \
	--chunk-time 8 \
	--target-fps-file /mnt/ramcam/target_fps.txt \
	--telemetry-file /mnt/ramcam/current_telemetry.json
```

El proceso termina al recibir `SIGTERM` o `SIGINT`. Cada `chunk_NNNN/` contiene streams RAW y stats concatenados por cámara, JSONL con `raw_offset`, `stats_offset`, longitudes y `pair_index`, y `chunk_telemetry.json`. Antes del commit se escribe en `.chunk_NNNN_tmp/`; la carpeta se renombra al cerrar. El JSONL se vacía en cada frame; RAW/stats se vacían al cerrar el chunk.

`target_fps.txt` acepta un entero de 1 a 10. Se sondea como máximo cada 500 ms; si falta, no se puede leer o su `mtime` supera 2 s, se aplica el fallback LOS de 4 fps a los pares. El sensor sigue solicitado a 10 fps.

**Estado:** captura dual RAW-only y cierre por señal se comprobaron en pruebas de hardware cortas. El skew máximo observado en esas pruebas fue ~19 ms; no es una especificación ni una garantía. Aún falta benchmark sostenido de FPS, CPU, memoria/DMABUF, temperaturas y caudal sobre el montaje definitivo, y pruebas de fallos antes de considerarlo apto para vuelo.

## Vuelo y revelado

Configura `/mnt/ramcam` como `tmpfs` en `fstab` (3 GiB probados) y verifica `findmnt -T /mnt/ramcam`. Ejecuta `./demeter_flight.sh`: valida el montaje antes de limpiarlo, captura durante un maximo de 160 s o hasta `/tmp/touchdown_event.flag`, copia chunks cerrados a `/home/admin/grabaciones_raw/<timestamp>` y lanza el revelado en segundo plano. Retira un flag de touchdown antiguo antes de iniciar otra mision.

Para revelar manualmente: `python3 ./demeter_postprocess.py /ruta/a/la/mision`. Las imagenes quedan bajo `PROCESADO/` como `camX_frame_YYYYYY.jpg` y `.png`. `build.sh` y ambos entrypoints aceptan `DEMETER_BUILD_DIR`; ver `DEMETER_PROYECTO.txt` para montaje, paquetes y diagnostico.

Los RAW, videos, imagenes de prueba y directorios de ejecucion son datos generados: `.gitignore` los conserva en el disco local, pero evita subirlos al repositorio. Los scripts, perfiles, configuraciones y reportes textuales permanecen versionables.

## Datos registrados por captura

`custom.json` guarda el perfil aplicado y lo observado en el frame final: exposición, ganancias analógica/digital, lux, ganancias y temperatura de color, posición del lente, `af_state`, `focus_fom` y `ae_state`. `custom.status.json` guarda los estados del Controller (AWB, CCM, ALSC, CAC, gamma, DPC, GEQ, SDN, CDN, sharpen) y los niveles black/white realmente usados. `custom.be.json` es la configuración serializada del BE.

Por defecto se descartan 30 frames (`capture.settle_frames`) para que AE/AWB/AF converjan antes del frame guardado.

## Black / white level

El Bayer16 de `praw2rgb` usa offset de descompresión 0 y la captura declara offset CFE 2048, por lo que el nivel negro del tune (4096) equivale a 2048 en ese fichero: `efectivo = tune + offset_bayer16 - offset_cfe`. Aplicar 4096 directamente satura toda la imagen a negro. `controller_replay` lo calcula y lo registra (`black_level_used`, `black_level_effective`).

El BLC del BE solo resta (libcamera ajusta antes el FE a un único nivel mínimo). `white_level` se implementa como una ganancia adicional `(65535 - negro) / (blanco - negro)` en el WBG: 65535 no cambia nada y valores menores aclaran la imagen. Es una aproximación para afinar; su efecto sobre el clipping debe validarse con escenas reales.

## Limitaciones conocidas

- `capture_pisp_stats` sigue capturando un solo frame por ejecución; las estadísticas se reutilizan 64 veces en el Controller para que converjan AWB/ALSC asíncronos. No modela una secuencia temporal (sin TDN). `demeter_rec` es un binario separado y aún experimental.
- Con `lens_position: 0.0` el foco "infinito" es el nominal del módulo; el óptimo físico de cada cámara no está caracterizado.
- Salida RGB888 y JPEG calidad 95; no hay PNG de 16 bit todavía.
- El Controller es una interfaz interna de libcamera: compilar siempre contra el mismo tag que el runtime (`build.sh` lo fija).
- La calibración de WB depende de la escena usada; en tierra debe hacerse frente a un blanco neutro con la iluminación esperada.
