# Demeter: contexto consolidado para handoff

**Corte del contexto:** 2026-10-09  
**Propósito:** permitir que otra IA retome desarrollo y validación sin asumir que los prototipos ya son grabadores de vuelo.

## Estado en una frase

Demeter ya demostró en Raspberry Pi 5 una ruta offline real `COMP1 + PISP_FE_STATS -> Bayer16 -> Controller RPi aislado -> PiSP BE -> RGB888` para un frame. El recorder continuo, la captura dual con este ejecutable y la recuperación automática de misión aún están pendientes. Ver [DEMETER_PRODUCTION_REVIEW.md](DEMETER_PRODUCTION_REVIEW.md) para el análisis de fallos y producción.

## 1. Glosario y mapa físico

| Término | Significado y papel |
|---|---|
| Demeter | Proyecto de adquisición de imagen para misión/vuelo: registrar RAW de cámara y estadísticas FE en Pi 5, luego desarrollar las imágenes offline con el Controller original de libcamera y el PiSP BE. |
| Raspberry Pi 5 / BCM2712 D0 | Computadora de vuelo usada para capturar. BE V4L2 disponible también para ejecutar replay y producir RGB888. |
| IMX708 x2 | Dos módulos de cámara conectados al Pi. Hay índices libcamera 0 y 1. El capturador actual acepta un índice, no prueba una misión simultánea dual. |
| PiSP FE | Front End del ISP conectado al sensor. En captura se habilita `StatsOutputEnable`; el request devuelve `PispStatsOutput` (`PISP_FE_STATS`, 23,200 bytes en el runtime local). |
| PiSP BE | Back End ISP de hardware; se puede programar desde libpisp y ejecutar por helper V4L2 como trabajo memory-to-memory. En el replay se da Bayer16 y se obtiene RGB888. |
| COMP1 / `PISP_COMP1` | RAW Bayer comprimido que captura el CFE. El archivo de entrada preserva el stride y tamaño reportados en sidecar. |
| `praw2rgb` | Ejemplo local modificado de libpisp que acepta COMP1 y usa el BE para convertir/descomprimir a Bayer16. El árbol contiene cambios del usuario; no sobrescribirlos con una copia upstream. |
| `/mnt/ramcam` | RAMDisk que los scripts de vuelo pretenden usar como staging, con dos slots A/B. El script verifica que sea mountpoint. Su contenido es volátil ante pérdida de alimentación/reinicio. |
| SD / `/home/admin/grabaciones_raw` | Destino persistente usado por scripts y sesiones locales. Debe validarse el throughput sostenido y margen libre con hardware/FS definitivos. |
| LilyGO LoRa | Se espera que un controlador externo reporte touchdown por radio/UART. En el script inspeccionado solo se observa el contrato indirecto de un archivo `/tmp/touchdown_event.flag`; no está presente aquí el firmware/receptor ni un protocolo verificable. |
| `Controller` | `RPiController::Controller` original interno de libcamera, compilado desde el mismo tag del runtime. Calcula estados de imagen desde `Statistics` derivadas de PISP FE stats. No equivale al pipeline handler/IPA completo. |

**Sistema conocido:** libcamera `0.7.2+rpt20260817`, source commit `6c1dd9d55573010f710c9e190a73e7e76f0d9432`; libpisp 1.7.0. El cache persistente de build es `/home/admin/.cache/demeter_build/`; no depender de `/tmp`, se borra en reboot.

## 2. Estructura crítica del repositorio

```text
/home/admin/
|-- frf4.sh                                      # ingestión A/B a SD; productor de captura aún es sleep
|-- flightcapturev2.sh                           # variante anterior A/B; captura placeholder
|-- grabaciones_raw/                              # sesiones locales y chunks históricos
|-- offline_isp_prototype/
|   |-- capture_pisp_stats.cpp                    # captura de prueba: un RAW + FE stats + JSON por ejecución
|   |-- demeter_rec.cpp                           # recorder dual experimental con chunks y requeue continuo
|   |-- controller_replay.cpp                     # FE stats -> Controller -> config BE -> RGB888
|   |-- demeter_isp.py                            # calibrate/freeze/capture/compare; no graba misión continua
|   |-- build.sh                                  # prepara libcamera exacto y compila los tres ejecutables
|   |-- README.md                                 # flujo y límites conocidos
|   |-- profiles/
|   |   |-- vuelo_infinito.json                   # preferido: WB calibrado, AE activo, foco a infinito
|   |   |-- vuelo_autofoco.json                   # autofoco continuo; no recomendado para vuelo
|   |   |-- prueba_todo_auto.json                  # perfil de pruebas automáticas
|   |-- calibration/                              # WB por perfil/cámara y fuente de calibración
|   |-- missions/                                 # perfiles congelados, config y flags rpicam
|   |-- results/                                  # capturas, estados Controller, BE, comparaciones
|   `-- campaign/01_* ... 09_linearity/            # campañas de caracterización R1-R9
`-- libpisp/
    |-- src/examples/praw2rgb.cpp                 # conversor COMP1/Bayer16 local modificado
    `-- build/src/examples/praw2rgb               # binario local del conversor

Binarios Controller/capture: /home/admin/.cache/demeter_build/bin/
Tuning IMX708: /usr/share/libcamera/ipa/rpi/pisp/imx708.json
```

Funciones más detalladas:

- [frf4.sh](../scripts/flight/frf4.sh#L1): preflight de SD/RAMDisk, buffers A/B, rsync, `sync`, verificación y manifiesto final; la captura real está comentada/reemplazada por `sleep`.
- [capture_pisp_stats.cpp](../../offline_isp_prototype/src/capture_pisp_stats.cpp#L370): configura cámara, video+RAW, stats y perfil; reencola buffers durante settle; finalmente persiste un único frame.
- [demeter_rec.cpp](../../offline_isp_prototype/src/demeter_rec.cpp): configura ambas cámaras RAW-only, captura stats, empareja por timestamp, decima y empaqueta chunks.
- [controller_replay.cpp](../../offline_isp_prototype/src/controller_replay.cpp#L539): carga tune filtrada, forma `Statistics`, itera Controller y aplica sus estados al BE.
- [demeter_isp.py](../../offline_isp_prototype/demeter_isp.py#L1): herramienta de laboratorio y orquestación offline; no es servicio de vuelo ni recorder continuo.
- [praw2rgb.cpp](../../libpisp/src/examples/praw2rgb.cpp#L40): adaptaciones locales de lectura COMP1/Bayer16 y configuración/descompresión PiSP.

## 3. Hito vital: black level y pedestal de 2048

No pasar el número `4096` del tune directamente al BLC cuando la entrada del BE ya es el Bayer16 producido por el conversor. Son dominios distintos:

- El black level IMX708 del tune está en dominio 16-bit de sensor; el valor típico es 4096.
- La captura sidecar declara `cfe_compression_offset = 2048`.
- El `praw2rgb` local usa offset de descompresión `0` (`dc.offset = 0`); por tanto la muestra negra que llega en el Bayer16 tiene una base aproximadamente de 2048, no 4096. La campaña de dark frames también observó modo 2048 en ambos Bayer16.
- El replay traduce el black tune al dominio de entrada del BE con `effective = tune + bayer16_offset - cfe_offset`. En el caso validado: `4096 + 0 - 2048 = 2048`.
- Aplicar 4096 como resta directa al Bayer16 producía una imagen completamente negra; con nivel efectivo 2048 volvió la señal.

El helper está en [controller_replay.cpp](../../offline_isp_prototype/src/controller_replay.cpp#L256); lee el offset del sidecar y aplica la traducción antes de `SetBlc` en [controller_replay.cpp](../../offline_isp_prototype/src/controller_replay.cpp#L308). La captura registra el campo en [capture_pisp_stats.cpp](../../offline_isp_prototype/src/capture_pisp_stats.cpp#L287).

**Regla de mantenimiento:** si cambia el firmware, pixel format, `praw2rgb`, modo de descompresión o sidecar, volver a capturar dark frames y validar el dominio. No tratar 2048 como constante universal para todos los formatos o futuras versiones.

## 4. Arquitectura offline ya demostrada

```text
IMX708 -> PiSP FE -> request libcamera
                     |-- RAW Bayer COMP1 -> <prefix>.raw
                     |-- PISP_FE_STATS   -> <prefix>.pisp_stats.bin (23,200 B)
                     `-- metadata         -> <prefix>.json

<prefix>.raw + width/height/stride
   -> praw2rgb (PiSP BE, COMP1 decompress offset 0)
   -> <prefix>_bayer16.raw

PISP_FE_STATS + capture metadata + IMX708 tune
   -> controller_replay: pisp_statistics -> RPiController::Statistics
   -> RPiController::Controller aislado (sin IPA/pipeline handler)
   -> camera mode + device status sintéticos desde sidecar
   -> process/prepare 64 iteraciones sobre LAS MISMAS stats
   -> validación y mapeo de AWB/CCM/ALSC/CAC/gamma/DPC/GEQ/denoise/sharpen/etc.
   -> libpisp BackEnd BCM2712_D0 -> tiles + V4L2 backend job
   -> <prefix>.rgb888.raw + status.json + be.json
   -> demeter_isp.py transforma RGB a JPEG para comparación
```

El replay filtra algoritmos AGC, AF y sync de una copia temporal del tuning antes de crear el Controller. Lee la tabla histogram, zonas AWB, AGC y focus desde `pisp_statistics`, crea `Statistics` y asigna `DeviceStatus`/`CameraMode` desde la metadata, porque no está ejecutando el IPA completo.

**Caveat de las 64 vueltas:** son una repetición sintética de una única estadística para permitir convergencia de algoritmos asíncronos como AWB/ALSC; no representan 64 frames capturados ni evolución temporal, y no incluyen una secuencia real/TNR. No afirmar por esto que el replay del Controller esté ya conectado en vuelo.

Formatos/tamaños de referencia a 4608x2592: stats 23.2 KB; COMP1 observado en torno a 6.1 MB/frame; Bayer16 ~23.9 MB/frame; RGB888 ~35.8 MB/frame. Los tamaños RAW comprimidos varían con escena.

## Perfiles y política operativa

- `vuelo_infinito`: perfil preferido por decisión actual: WB calibrado/fijo en tierra, AE activo (`short`, medición centro y restricción highlight) y lente a 0.0 para foco nominal infinito.
- `vuelo_autofoco`: continuo, no caracterizado para vuelo y desaconsejado porque podría enfocar estructura de cohete.
- `prueba_todo_auto`: perfil de banco, no implica configuración de vuelo.
- Las ganancias calibradas se guardan por cámara; congelar misión crea `mission_config.json`, perfiles resueltos y argumentos rpicam. Cambiar perfiles requiere volver a validar que flags y controles de `capture_pisp_stats` sean equivalentes.

## 5. Comandos de compilación

### Receta persistente actual

La fuente de verdad para recompilar es `cd /home/admin/offline_isp_prototype && ./build.sh`. El script compila con libcamera source/runtime del tag fijado y escribe los binarios en `/home/admin/offline_isp_prototype/.build/bin/`. Invocaciones `c++` literales del [build.sh](../../offline_isp_prototype/build.sh#L30):

```bash
c++ -std=c++20 -O1 -DLIBCAMERA_BASE_PRIVATE \
    -I"$B/libcamera-dev/usr/include" -I"$B/libcamera-src/include" -I"$B/libcamera-build/include" \
    -I"$JSON_INC" "$HERE/capture_pisp_stats.cpp" "${LIBS[@]}" -o bin/capture_pisp_stats
```

```bash
c++ -std=c++20 -O1 -DLIBCAMERA_BASE_PRIVATE \
    -I"$B/libcamera-src/src" -I"$B/libcamera-src/src/ipa" -I"$B/libcamera-src/include" \
    -I"$B/libcamera-build/include" -I"$LIBPISP/src" -I"$LIBPISP/src/libpisp" -I"$LIBPISP/src/helpers" \
    -I"$JSON_INC" "$HERE/controller_replay.cpp" \
    -Wl,--whole-archive libcamera-build/src/ipa/rpi/controller/librpi_ipa_controller.a -Wl,--no-whole-archive \
    libcamera-build/src/ipa/libipa/libipa.a libcamera-build/subprojects/yaml-0.2.5/libyaml-0.a \
    "${LIBS[@]}" -L/usr/local/lib/aarch64-linux-gnu -lpisp -ldl -latomic -o bin/controller_replay
```

`LIBS` se define en el mismo script como `(-L/lib/aarch64-linux-gnu -Wl,-l:libcamera.so.0.7 -Wl,-l:libcamera-base.so.0.7 -pthread)`. El target de Controller requiere `-DLIBCAMERA_BASE_PRIVATE`, headers internos, `librpi_ipa_controller.a` con `--whole-archive`, `libipa.a`, libyaml y `-lpisp`. No reemplazar estas rutas por headers/runtime de otra versión.

### Invocaciones históricas del terminal

El transcript local registra compilaciones tempranas en `/tmp`; son comandos literales usados entonces, pero sus árboles y binarios temporales no son la receta durable (tras reboot `/tmp` no está). Las invocaciones completas más recientes registradas fueron:

```bash
c++ -std=c++20 -O0 -DLIBCAMERA_BASE_PRIVATE -I/tmp/libcamera-dev/usr/include -I/tmp/libcamera-src/include -I/tmp/libcamera-build/include /home/admin/offline_isp_prototype/capture_pisp_stats.cpp -L/lib/aarch64-linux-gnu -Wl,-l:libcamera.so.0.7 -Wl,-l:libcamera-base.so.0.7 -pthread -o /tmp/capture_pisp_stats
```

```bash
c++ -std=c++20 -O0 -g -DLIBCAMERA_BASE_PRIVATE -I/tmp/libcamera-src/src -I/tmp/libcamera-src/src/ipa -I/tmp/libcamera-src/include -I/tmp/libcamera-build/include -I/home/admin/libpisp/src -I/home/admin/libpisp/src/libpisp -I/home/admin/libpisp/src/helpers -I/home/admin/libpisp/subprojects/nlohmann_json-3.12.0/single_include /home/admin/offline_isp_prototype/controller_replay.cpp -Wl,--whole-archive /tmp/libcamera-build/src/ipa/rpi/controller/librpi_ipa_controller.a -Wl,--no-whole-archive /tmp/libcamera-build/src/ipa/libipa/libipa.a /tmp/libcamera-build/subprojects/yaml-0.2.5/libyaml-0.a -L/lib/aarch64-linux-gnu -Wl,-l:libcamera.so.0.7 -Wl,-l:libcamera-base.so.0.7 -L/usr/local/lib/aarch64-linux-gnu -lpisp -pthread -ldl -latomic -o /tmp/controller_replay
```

Se documentan ambos para preservar historial exacto y las bibliotecas enlazadas; para continuar, usar `build.sh` como receta canónica (paths persistentes y flags actuales). El transcript de la sesión está en `/home/admin/.vscode-server/data/User/workspaceStorage/c3defed3e066990dc3e98b8f6ee55ea6/GitHub.copilot-chat/transcripts/1e417368-7c05-42fb-94fd-957122e81771.jsonl`.

## 6. Roadmap restante

1. **`demeter_rec.cpp`:** implementado como prototipo dual RAW-only; build reproducible y smoke de hardware SIGINT pasaron. Empareja nearest timestamp dentro de 50 ms cuando tiene lookahead, registra skew y huérfanos. Sigue pendiente la validación larga, controles/perfil de cámara, presión de escritura y política ante errores.
2. **Cualificación dual:** medir FPS sostenido, secuencias/timestamps, carga CPU/temperatura, buffers DMA, RAM y caudal SD bajo misión. El smoke de ~3 s observó ~18.9 ms de skew máximo y no certifica sincronización ni el objetivo temporal.
3. **Refactor de `frf4.sh`:** sustituir `sleep` por el recorder, comprobar códigos de salida, no saltar secuencias tras timeout, reconocer únicamente chunks comprometidos, detener por umbral de SD, preservar buffer no confirmado y cerrar misión como completa/incompleta.
4. **Batch command:** comando de postproceso reanudable que indexe misión, valide tamaños/checksums, convierta cada COMP1 a Bayer16, aplique Controller+BE, guarde resultados/estados por frame y permita reintentar sin destruir originales.
5. **`demeterd.py`:** servicio/orquestador durable para iniciar/detener misión, vigilar recorder, registrar heartbeat/telemetría, gestionar touchdown/UART y recuperación; evitar duplicar lógica de cámara del binario C++.
6. **Ensayos de robustez:** corte de energía, SD llena, transferencia lenta/corrupta, pérdida UART/LoRa, kernel/app restart, timeout request y cierre por touchdown; recuperar sesión y demostrar ausencia de falsos `mission complete`.
7. **Caracterización pendiente:** R10/R11 y validación de WB/foco/AE restante deben continuar como campaña separada.

## Reglas para quien retome

- No editar `/home/admin/libpisp/src/examples/meson.build` como parte de esta fase: tiene cambios previos del usuario.
- No reemplazar `praw2rgb.cpp` completo por upstream; revisar y conservar adaptaciones locales.
- No limpiar resultados, campañas, buffers persistentes ni grabaciones sin confirmar qué contienen.
- Tratar rendimiento, tolerancia a fallos y funcionamiento LoRa como desconocido hasta medir/ver el código correspondiente.
- Documentar comandos y tamaños medidos con equipo/fecha/modo; separar siempre medición de estimación.
