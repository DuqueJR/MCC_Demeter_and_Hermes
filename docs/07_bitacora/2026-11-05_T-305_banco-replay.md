---
fecha: 2026-11-05
tipo: tarea
ids: [T-305, P-03, T-304, T-410, T-412, T-411, D-048]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-305-banco-replay
---
# T-305: banco de replay en el PC

## Contexto
P-03 pide correr la detección sobre las sims. de OpenRocket y sobre ≥ 20 variantes sintéticas (T-304), y T-412 (COAST, APOGEO, CAIDA, PARACAIDAS, ATERRIZAJE y RECOVERY) no tiene todavía contrato ni código. T-305 deja el banco listo: lee los `.BIN` en el formato `rec`, corre la lógica **real** del firmware y reporta los eventos con su `t_us`. Hoy solo hay BOOST (T-410); los demás momentos quedan como columnas vacías que T-412 llena sin tocar el reporte.

## Qué se hizo
- **Portabilidad a macOS del arnés que ya existía** (commit `9871db4`). `correr_pruebas.py` no compilaba en Apple clang: `stubs/esp_attr.h` definía `RTC_NOINIT_ATTR` con `section("rtc_noinit_host")`, que Mach-O rechaza (`mach-o section specifier requires a segment and section separated by a comma`), y el arnés encontraba la sección con `__start_`/`__stop_` de GNU ld, que no existen en macOS.
  - macOS: `section("__DATA,rtc_noinit")` y `getsectiondata(&_mh_execute_header, "__DATA", "rtc_noinit", ...)`. Linux: igual que antes.
  - Archivos: `stubs/esp_attr.h` (elige el nombre), `stubs/rtc_host.h` (nuevo: `rtcHostInicio()` y `rtcHostTam()`, iguales en las dos plataformas) y 5 líneas de `prueba_mision.cpp`. No se tocó `src/`.
- **El banco** (commit `fc6d367`), todo en archivos nuevos de `firmware/cohete/test/host/replay/`:
  - `prueba_replay.cpp`: compila `mission.cpp`, `boost_detect.cpp`, `ext_act.cpp` y `ext_bmp.cpp` reales con los stubs de `test/host/stubs` y el mismo reloj virtual de 20 ms de `prueba_mision.cpp`. Lee uno o varios `.BIN` (`FH_CONTINUA`), salta bytes corruptos hasta el siguiente `A5 5A` con CRC bueno, ordena los registros por `t_us` de la cabecera (el instante en que estuvieron disponibles) y a cada paso de 20 ms entrega a la misión los que ya llegaron:
    - `T_EXT_LSM`: como `lsmTask`: cada palabra `TAG_ACC` va al detector con su hora `t_first_us + k · period_us`, el BMP581 por el hub pasa por `extBmpOnWord` (el real, con su mediana de 3) y se publica `g_ext_imu`. La sensibilidad sale del `acc_fs_g` del registro.
    - `T_IMU`: como `imuTask` (el QMI y `g_imu`). `T_BAR`: `g_bar`, con la hora `t_trig + P_CENTER_US` de `in_bar.cpp`. `T_PVT`: el fix de `g_gnss`.
    - El guion del operador: ARMED por omisión (`armar` a los 2 s del primer registro y luego el `si` con los mismos motivos, como la estación; si hubo motivos, lo avisa). `--inicio launch` agrega `launch` a los 4 s; `--inicio tierra` no manda nada. El cohete sale del `rocket_id` del `FILEHDR`.
    - Registra cada cambio de estado, momento y banderas, cada `T_MISSION`, cada respuesta, cada `loggerRecord` y cada flanco de IO45 e IO46, con su `t_us`. Si el `.BIN` ya trae `T_MISSION` (un vuelo o banco real), los lista aparte.
  - `enganches.h`: lo que `ext_lsm.cpp` (línea 308) e `in_imu.cpp` (línea 197) le entregan a los detectores, más las constantes privadas de esos dos `.cpp` (tags del FIFO, `P_CENTER_US`, sensibilidades). Es **el punto de enganche para T-412** (ver abajo).
  - `replay.py`: compila (solo si algo cambió), corre, compara con `.verdad.json` y escribe `reporte.md`, `reporte.csv`, `reporte.json` y un `.json` por vuelo. Genera los 24 sintéticos si faltan.
  - `correr_pruebas.py`: dos opciones nuevas (`--sin-replay`, `--replay-dir`) y una llamada a `replay.para_pruebas(...)` antes de imprimir la tabla.
- **Entorno `native` de PlatformIO** (commit `41220b6`): `pio run -e native` compila el mismo programa. Era sencillo y no toca `default_envs` ni los entornos de vuelo.
- **README** de `test/host` (commit `ec7bf02`): cómo correr el banco sobre los sintéticos y sobre un `.BIN` real, qué alimenta, qué reporta, los criterios y los pasos para T-412.

### Criterios que comprueba el banco (los de P-03 que hoy se pueden)
- BOOST en < 0,2 s desde el despegue (`maquina_estados.md` §6) en los 24 vuelos, con el cohete armado en la rampa.
- Cero transiciones falsas, definidas de forma **estructural** (sin umbrales de T-412): un `T_MISSION` automático de BOOST repetido; BOOST antes de `IGNITION`; un cambio de estado o de momento antes del despegue que no sea el del guion (armar, y `launch` si se pidió); o una transición que retrocede en el orden TIERRA, ARMED, FLY (LAUNCH a ATERRIZAJE), RECOVERY.
- Control negativo: los 9 s de reposo armado antes del encendido de un sintético de cada cohete (`--hasta 9`) no dan BOOST ni cambios.
- Los `boost*(` y `moment*(` que llamen `ext_lsm.cpp` o `in_imu.cpp` también están en `enganches.h` (revisión de texto): si T-412 cablea un detector en el firmware y se olvida del banco, el banco falla en vez de pasar con el detector desconectado.
- INFO hasta T-412: secuencia completa (hoy 0 de 24) y error de apogeo (sin medir).

## Evidencia
Máquina: macOS, Apple clang 21.0.0 (`g++`), Python 3.14.7 con numpy y scipy (`.venv` de la carpeta principal).

**`correr_pruebas.py` completo en macOS**, antes del banco (solo el arreglo de portabilidad): 74 OK, 0 FALLA. Con el banco: `Todos los criterios se cumplen.`, 11 s en total. Las filas nuevas:

```
replay: los detectores que llaman ext_lsm.cpp e in_imu.cpp estan en enganches.h             OK    boost* y moment* de los dos consumidores repetidos en el banco
replay P-03: BOOST en < 0.2 s desde el despegue en los 24 vuelos (...)                     OK    retraso maximo 0.100 s (HER_SINT_G80-7T_antes_r1_s01), medio 0.085 s
replay P-03: cero transiciones falsas en los 24 vuelos                                     OK    0 transiciones falsas en 0 vuelos
replay P-03: control negativo, el reposo en la rampa armado (9 s antes del encendido) ...  OK    2 archivos
informativa P-03: secuencia COAST > APOGEO > PARACAIDAS > ATERRIZAJE                      INFO  0 de 24 vuelos (T-412 todavia no existe: solo se detecta BOOST)
informativa P-03: error de apogeo < 0.3 s                                                  INFO  sin medir: falta T-412
```

Los 15 casos de persistencia (T-411) y las 13 revisiones de sintaxis también pasan en macOS.

**BOOST en los 24 sintéticos de T-304** (`python3 firmware/cohete/test/host/replay/replay.py`, 1,2 s en total):

| Cohete | Ruido | Retraso desde IGNITION | Error frente a LIFTOFF | dv (counter, cm/s) | Falsas |
| --- | --- | --- | --- | --- | --- |
| Demeter (12 vuelos: antes, en, después de la eyección) | ×1 y ×3 | 0,080 s en los 12 | 0,051 s | 500 a 503 | 0 |
| Hermes, ruido ×1 (6 vuelos) | ×1 | 0,100 s | 0,062 s | 502 | 0 |
| Hermes, ruido ×3 (6 vuelos) | ×3 | 0,080 s | 0,042 s | 501 a 505 | 0 |

Máximo 0,100 s, medio 0,085 s, 24 de 24 con BOOST (siempre inercial), 0 transiciones falsas. Coincide con la referencia de Pablo (dv = 5 m/s a 0,074 y 0,084 s) más el paso de 20 ms de la tarea de misión; el retraso es múltiplo de 20 ms por la rejilla del reloj virtual.

**Comprobaciones de que el banco detecta fallos** (no se commitean; scripts en el directorio temporal de la sesión):
- Con una copia de `src/` con `boost_dv_mps = 40` m/s (un detector degradado), el criterio falla: `BOOST a 0.480 s del despegue (limite 0.2 s)`.
- Un sintético partido en dos archivos con `FH_CONTINUA` en el segundo da exactamente los mismos eventos que el entero.
- El mismo sintético con 3 bloques de bytes basura en medio (36 bytes saltados) da los mismos eventos y el aviso de resincronización.
- `--inicio tierra` y `--inicio launch` corren: ARMED (o FLY/LAUNCH) a 2 y 4 s, BOOST a 10,081 s.

**PlatformIO** (`uvx --from platformio pio run`, tras `git submodule update --init`, el parche `lilygo_local.patch` y `secrets.h` desde el `.ejemplo`; nada de eso se commitea):
- `pio run -e hermes -e demeter`: **SUCCESS** los dos (hermes 70,6 s, demeter 67,1 s). RAM 16,5 % (54 144 B), flash 19,4 % (608 941 B) en los dos. No se tocó `src/`, así que el binario de vuelo es el mismo.
- `pio run -e native`: **SUCCESS** en 9,6 s; `.pio/build/native/program` da los mismos eventos que el binario de g++.

Commits: `9871db4` (portabilidad), `fc6d367` (banco), `41220b6` (`native`), `ec7bf02` (README).

## Decisiones tomadas o propuestas
No se cambió ningún contrato. Propuestas para el documentador:

1. **Qué es "el despegue" en el criterio de BOOST < 0,2 s (§6).** El arnés inercial de T-410 lo mide desde el inicio de la fuerza (`IGNITION`, el t = 0 de la sim.). La verdad de T-304 también trae `LIFTOFF`, 0,03 s después. El banco aplica el criterio contra `IGNITION` (el más estricto: si cumple, cumple contra `LIFTOFF`) y reporta el error frente a `LIFTOFF` aparte. Conviene fijarlo en §6.
2. **Para T-412, que el contrato diga cada transición automática con su `T_MISSION`.** Hoy el banco lee los momentos del cambio de `missionStats()` (estado y momento) y el `T_MISSION` automático solo lo usa para el criterio y el valor de BOOST (`arg` 1 y 2, `formato_log.md`). Si T-412 define otros `arg` (qué criterio disparó cada momento), el banco los listaría sin cambios; falta que el contrato los nombre.
3. **Verdad que falta para el reporte de T-412:** CAIDA y RECOVERY no tienen evento en `.verdad.json`. Hay que decidir contra qué se mide cada una (por ejemplo, RECOVERY contra GROUND_HIT más el tiempo de quietud, y CAIDA cuando no hay paracaídas) y qué cuenta como **transición falsa** de cada momento nuevo (por ejemplo, COAST antes de BURNOUT). El banco hoy solo usa la definición estructural de arriba para no inventar umbrales.
4. **Criterio de apogeo:** el error de P-03 (< 0,3 s) se calcula contra `APOGEE.t_us` de la verdad. La verdad también trae `t_us_max_altura` (el máximo de altura real): hay que decir cuál vale. Con `antes` y `en` la sim. abre el paracaídas en el apogeo, así que el pulso de la eyección y el apogeo coinciden.

## Problemas y cómo se resolvieron
- **El arnés no compilaba en macOS** (ver arriba). Una vez portable, pasó entero a la primera, incluida la persistencia que vuelca y recarga la RTC.
- **Hay dos copias del bloque "resto de dependencias de `mission.cpp`"** (relojes, colas, NVS de mentira, stubs de la calibración y del logger): la de `prueba_mision.cpp` y la de `prueba_replay.cpp`. Se duplicó a propósito para no editar `prueba_mision.cpp` (900 líneas) con el PR #70 abierto sobre los mismos archivos. Si `mission.cpp` gana una dependencia (el EKF a bordo, D-060), hay que stubbearla en las dos. Anotado en el README; lo ideal sería unificarlas en un `.h` cuando se integre el #70.
- **`g++ -Wextra` de Apple clang avisó `-Wnontrivial-memcall`** por un `memset` sobre un struct con `std::string`; se cambió por inicialización por valor.
- **El BMP581 pasa por la mediana de 3 de `extBmpOnWord`**, que publica la muestra anterior: el banco enlaza el `ext_bmp.cpp` real para que esa lógica sea la del firmware y no una copia.
- **No hay `.BIN` reales en el repo.** El banco acepta cualquier `.BIN`, pero solo se validó con los sintéticos de T-304 y con las comprobaciones de la sección Evidencia (detector degradado, archivos consecutivos, bytes basura).

## Pendiente / siguiente paso
- **T-412:** sumar el detector a `FUENTES_DETECTORES` (`replay.py`) y a `build_src_filter` (`platformio.ini`), repetir en `enganches.h` lo que cablee en `ext_lsm.cpp` o `in_imu.cpp` y llevar los criterios de P-03 (secuencia 100 %, apogeo < 0,3 s) de INFO a criterio en `para_pruebas()`. Las columnas del reporte ya existen.
- **Correr el banco sobre un `.BIN` real** (un vuelo de banco con el imán o con una caída desde 1 m sobre espuma, P-04) apenas haya uno, y con varios archivos consecutivos de un registro de 12 min.
- **Qué no cubre el banco:** la deriva del reloj de muestras del chip (usa `t_first_us` y `period_us` con muestras equiespaciadas dentro de cada lote), la concurrencia de los dos núcleos, los tiempos de CPU y la respuesta real del filtro del LSM. Eso es P-04 y el IMU en una mesa.
- Generar los 24 sintéticos tarda unos 4 minutos (`scipy` hace falta solo para eso). Si CI no los tiene en caché, usar `--sin-replay` o dejar la carpeta `estacion/vuelos_replay/` como artefacto.

## Documentos afectados
- Nuevos: `firmware/cohete/test/host/replay/{prueba_replay.cpp,enganches.h,replay.py}`, `firmware/cohete/test/host/stubs/rtc_host.h`.
- Modificados: `firmware/cohete/test/host/{correr_pruebas.py,prueba_mision.cpp,README.md}` (los tres también los toca el PR #70, `correr_pruebas.py` con certeza; `prueba_mision.cpp` en 5 líneas del bloque de la RTC), `firmware/cohete/test/host/stubs/esp_attr.h`, `firmware/cohete/platformio.ini`.
- Sin cambios: `src/`, contratos, `constantes.md`, `gui/`.
- Para el documentador: `backlog.md` (T-305), `plan_pruebas.md` (P-03: ya hay banco y 24 sintéticos; falta T-412), `maquina_estados.md` §6 (propuesta 1).
- Búsqueda: `graphify query` devolvió solo nodos de la web (la consulta no ubicó el firmware); se siguió con lectura directa de `ext_lsm.cpp`, `in_imu.cpp`, `in_bar.cpp` y `mission.cpp`.

## Correcciones tras la revisión del PR #72 (2026-11-05)

El coordinador corrió el banco sobre dos logs reales de banco (sesiones de calibración del 2026-11-03, firmware del 2026-11-02, sin vuelo; `FILEHDR` v1) y encontró dos fallos y pidió dos arreglos más. Los `.BIN` no se copian al repo: se leen de `/Users/juanpa/Downloads/Calibraciones fallidas/`. Antes se fusionó `origin/develop` en la rama (merge `322a803`, el PR #70 del EKF a bordo; sin conflictos).

### Cifras de A y B, antes y después

| | DEM_M00_20261103_131429_0092 (535 s) | HER_M00_20261103_132752_0024 (308 s) |
| --- | --- | --- |
| **Antes** | `filehdr:false`, `rocket_id:0`, se usó Demeter; **474** bytes saltados; aviso de corrupción | `filehdr:false`, `rocket_id:0`, **se repitió con la configuración de Demeter**; **1024** bytes saltados; aviso de corrupción |
| **Después** | FILEHDR v1 reconocido, Demeter; **0** bytes saltados, 0 resync; 211 890 registros (igual que tblog); 0 BOOST, 0 transiciones falsas | FILEHDR v1 reconocido, **Hermes**; **0** bytes saltados, 0 resync; 121 316 registros (igual que tblog); 0 BOOST, 0 transiciones falsas |

El único aviso que queda en los dos es `armado FORZADO con los motivos 0x38`: el banco armó con confirmación porque en esos logs el cohete no estaba listo para armar. Es informativo, no es corrupción.

- **A, FILEHDR v1/v2.** `prueba_replay.cpp` exigía `sizeof(FileHdrRec)` (v3). Ahora copia `min(r.n, sizeof)` en una estructura en ceros y lee solo lo que cada versión trae: v1 (28 B) el cohete, el arranque y el índice; v2 agrega entorno y commit; v3 agrega `flags` (byte 73, `FH_CONTINUA`). Con varios archivos, uno sigue al anterior si es del mismo arranque y, desde v3, con `FH_CONTINUA` (la regla de `tblog.continua` y de `formato_log.md`); si no, se niega (código 3). Probado: DEM + HER juntos se rechazan ("arranque 39 contra 92"); el sintético partido en dos con v3 sigue funcionando.
- **B, bytes saltados.** La causa era la **cola de ceros** del final del archivo (489 y 1039 bytes de relleno tras el último registro): el banco avanzaba byte a byte contando cada uno como saltado, mientras `tblog.records` corta en cuanto ve 64 bytes en cero. El FILEHDR corto no influía. Ahora el recorrido es el mismo de `tblog.records` (cola de ceros, registro final cortado por el apagado informado aparte como `bytes_truncados`, y resincronización por el siguiente `A5 5A`). El JSON trae `bytes_saltados`, `resync` y `version`. Los bytes basura del sintético de prueba siguen dando los mismos eventos y el aviso.
- **C, `STILL_S` en `ekf_core.cpp`** (commit `1ad9969`; **para que Pablo lo revise**). Apple clang avisaba `unused variable 'STILL_S'` (`-Wunused-const-variable`) y la prueba de sintaxis cuenta cualquier aviso como FALLA. `STILL_S` (1,5 s) es la ventana quieta de `ekf.py`; en C++ esa ventana está fija como 6 bloques de `BLOQUE_US` (250 ms) dentro de `bloqueReposo` (`b >= 6`, `b - 6`, `% 7`), y ninguna expresión leía la constante. Se quitó y quedó un comentario con la equivalencia (6 × 0,25 s). No hay cambio de comportamiento y no se tocó nada más de `src/`. Se prefirió quitarla antes que derivar el 6 de `STILL_S / BLOQUE_US`, porque el 6 también dimensiona `bl6_[7]` y los índices del anillo, y derivarlo obligaba a tocar más código de Pablo.
- **D, stubs unificados** (commit `769bc6b`). El bloque de dependencias de `mission.cpp` (reloj virtual, colas, NVS de mentira, logger, calibración, Pi, pines) vive ahora una sola vez en `test/host/stubs/arnes_mision.h`, incluido por `prueba_mision.cpp` y `replay/prueba_replay.cpp`. Lo que difiere entra por ganchos (`g_alTick`: el paso de 20 ms; `g_alRegistrar`, `g_alResp`, `g_alPin`). `ARNES_EXT_BAR_REAL` evita definir `g_ext_bar` donde se enlaza el `ext_bmp.cpp` real. Comportamiento idéntico: los 15 casos de persistencia y los escenarios de misión siguen en verde, y los eventos del banco sobre los 24 sintéticos son **idénticos uno por uno** a los de antes (comparados en JSON). El #70 no agregó nada a ese bloque: solo `missionP0()` en `mission.cpp`, que no usa los stubs.
- **E, `--logs-banco DIR`** en `correr_pruebas.py`: corre el banco sobre cada `.BIN` de la carpeta y exige 0 BOOST, 0 `T_MISSION` automáticos, 0 transiciones falsas y 0 bytes saltados. Documentado en el README con estas dos sesiones como ejemplo.

### Evidencia de la segunda vuelta
- `correr_pruebas.py` completo en macOS, con develop fusionado: sin opciones 80 OK y 0 FALLA; con `--logs-banco "/Users/juanpa/Downloads/Calibraciones fallidas"` **82 OK, 0 FALLA, rc=0** ("Todos los criterios se cumplen"). Incluye las filas `-fsyntax-only` de `ekf_core.cpp` (antes FALLA) y `ekf_task.cpp`, los 15 casos de persistencia y las filas del banco.
- PlatformIO tras la fusión: `pio run -e hermes -e demeter -e native`, **SUCCESS** los tres (hermes 70,1 s, demeter 66,2 s, native 2,2 s). RAM 17,2 % (56 400 B), flash 20,4 % (642 801 B en demeter y 642 785 B en hermes).
- Commits nuevos: `322a803` (merge), `1ad9969` (C), `769bc6b` (D), `fa2573f` (A y B), `042e89d` (E) y `2f17384` (README).

### Lo que sigue pendiente
- `FH_CONTINUA` solo se probó con el sintético v3 partido; falta un registro real de v3 con varios archivos.
- Los dos logs de banco son de calibración: el cohete casi no se mueve. Siguen faltando manipulación con golpes (P-04) y un vuelo real.
