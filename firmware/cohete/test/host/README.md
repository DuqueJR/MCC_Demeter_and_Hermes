# test/host: pruebas en el PC de la detección de BOOST (T-410), los actuadores (T-413) y la persistencia en vuelo (T-411)

Corren con `g++` y Python. **No necesitan PlatformIO, ESP32 ni placa.** Compilan el código de vuelo tal cual (`boost_detect.cpp`, `mission.cpp`, `ext_act.cpp` y el `gnd_cmd.cpp` de tierra) y lo alimentan con las simulaciones de OpenRocket y con casos de manipulación.

## Cómo correrlas

```
python3 firmware/cohete/test/host/correr_pruebas.py            # todo, con 30 min de reposo
python3 firmware/cohete/test/host/correr_pruebas.py --reposo-min 2   # más rápido
```

Requisitos: `g++` (probado con 13.3 en Linux y con Apple clang 21 en macOS), `python3` y `numpy`. Sale con código 0 si se cumplen todos los criterios. Escribe en `entradas/` (los archivos generados, unos 35 MB con el reposo de 30 min) y en `build/`; los dos están ignorados por git.

Al final corre el **banco de replay** (T-305, [más abajo](#banco-de-replay-t-305)) sobre los 24 vuelos sintéticos de T-304. Si faltan, los genera con `estacion/vuelos_replay.py` (unos 4 min, necesita `numpy` y `scipy`); si ese Python no tiene `scipy`, la fila sale como `OMITIDO` (no cuenta como criterio, pero queda a la vista). Opciones: `--sin-replay` (no lo corre), `--replay-dir DIR` (otra carpeta de sintéticos) y `--logs-banco DIR` (ver [Logs reales sin vuelo](#logs-reales-sin-vuelo-de-banco)).

**Portabilidad (macOS y Linux):** la RTC de la persistencia (T-411) es una sección del ejecutable que el arnés vuelca y recarga. En Linux es `rtc_noinit_host` y se encuentra con `__start_`/`__stop_` de GNU ld; en macOS (Mach-O) es `__DATA,rtc_noinit` y se encuentra con `getsectiondata`. `stubs/esp_attr.h` elige el nombre y `stubs/rtc_host.h` da `rtcHostInicio()` y `rtcHostTam()` para las dos.

## Qué hay

| Archivo | Qué hace |
| --- | --- |
| `correr_pruebas.py` | Genera las entradas, compila y corre todo, e imprime una tabla con OK/FALLA/INFO |
| `prueba_boost.cpp` | Arnés del módulo puro `src/boost_detect.cpp`: lee un archivo binario y reporta las detecciones. Modos `inercial` (3 columnas, pasa por el gancho `boostLsmSample` con cuentas `int16` del LSM) y `baro` (1 columna, a 50 Hz) |
| `prueba_mision.cpp` | Compila el `src/mission.cpp` **real** contra los stubs (los de `stubs/arnes_mision.h`, compartidos con el banco de replay) y corre su tarea con un reloj virtual de 20 ms por paso. Un escenario por proceso: `tierra`, `armado`, `launch_sin_boost`, `baro`, `qmi_con_lsm`, `qmi_sin_lsm` (T-410); de T-413, `buzzer_patron`, `buzzer_aterrizaje`, `buzzer_recovery`, `pi_demeter`, `pi_vuelo`, `pi_hermes`, `sueno` y `protocolo`; y de T-411, `d051` y los de persistencia `a_*` (escriben) y `b_*` (arrancan con lo guardado), que `correr_pruebas.py` encadena (ver abajo). Registra cada `digitalWrite` de IO45 e IO46 con la hora virtual y cuenta los `gpio_hold_*` |
| `prueba_tierra.cpp` | Compila el `firmware/tierra/src/gnd_cmd.cpp` **real**, le escribe líneas por un `Serial` falso y mira el `Cmd` que sale: `<d\|h> buzzer on\|off`, `<d\|h> pi encender`, los errores de formato y el ciclo NO_APTO → `si` con el motivo 21 |
| `replay/` | **El banco de replay (T-305):** `prueba_replay.cpp` (el programa de PC), `enganches.h` (lo que el firmware le entrega a los detectores) y `replay.py` (compila, corre, compara con la verdad y escribe el reporte). Ver [Banco de replay](#banco-de-replay-t-305) |
| `stubs/` | Cabeceras mínimas de Arduino/FreeRTOS/ESP32 (también `driver/gpio.h`, `RadioLib.h`, `mbedtls/md.h`, `esp_sleep.h`, `secrets.h` de mentira), solo para compilar en el PC. También sirven para `g++ -fsyntax-only` de `ext_lsm.cpp`, `in_imu.cpp`, `ext_act.cpp`, `core_sleep.cpp`, `net_radio.cpp`, `core_selftest.cpp` y `gnd_cmd.cpp` |

Formato del archivo de entrada: `double fs_hz`, `int32 ncol`, `int32 nfilas` y luego `nfilas × ncol` `float32`.

## Qué prueba

- **Positivas inerciales:** las dos simulaciones de `datos/simulaciones/openrocket/`, convertidas a fuerza específica (`|a|` = aceleración cinemática vertical + 1 g), remuestreadas a 1600 Hz y a 1666,67 Hz (la del LSM real), con ruido σ = 0,01 g por eje, 2 s de reposo antes del despegue y 5 semillas de ruido. Criterio: BOOST en < 0,2 s desde el despegue (se suma el peor caso de 20 ms de la tarea de misión, que lee la bandera a 50 Hz).
- **Negativas inerciales (cero detecciones):** golpe de 10 g y 20 ms; impacto de 20 g y 10 ms (los dos rectangulares, el peor caso); 30 min de reposo con ruido; y el barrido de la sacudida de ±3 g durante 5 s, de 3 a 20 Hz, en el eje vertical (|a| = |1 + 3·sen|) y en uno horizontal (|a| = √(1 + 9·sen²)). Criterio con el decaimiento de dv (D-048).
- **Informativas:** la sacudida de ±3 g a 1 y 2 Hz solo reporta el dv máximo: mueve el cohete más de un metro, es movimiento real.
- **Barométricas:** el perfil de altura de las sims. a 100 Hz (y decimado a 50 Hz, la tasa de la tarea de misión) con ruido de 0,05 m; negativas: 30 min de reposo con deriva de clima, un dato malo de un solo cuadro (+15 m) y un portazo (+12 m, 60 ms).
- **Misión:** el gancho por estado (TIERRA, ARMED, LAUNCH sin BOOST), el `T_MISSION` automático, `s_boosted` (las protecciones en vuelo dejan de ser nulas), el QMI como respaldo y el BOOST barométrico.
- **Actuadores (T-413):** con el patrón de buzzer de 500/1500 ms y el pulso de la Pi de 1500 ms medidos con el reloj virtual (valores escritos a mano en la prueba, no tomados de las constantes); el buzzer automático en RECOVERY y en ATERRIZAJE (sin reiniciar el patrón) y apagado en TIERRA; `pi encender` → NO_APTO con el motivo 21 y, confirmado, el pulso; en FLY con BOOST, además `RZ_EN_VUELO`; en Hermes, `RZ_OP` y IO45 nunca sube; los bits de `actuators`; `extActSleep()` (pines en bajo, `gpio_hold`, nada los reactiva) y las órdenes de texto de tierra.
- **D-051 (T-411):** un op desconocido, un estado, un momento o un buzzer fuera de rango, y `pi encender` en Hermes dan `CR_ERROR` con `RZ_OP`; confirmarlos (con sus mismos motivos) también da `CR_ERROR`, no ejecuta y no levanta `TF_FORZADO`.
- **Persistencia en vuelo (T-411, `maquina_estados.md` §8):** un "reinicio" es otro proceso. La RTC es la sección `rtc_noinit_host` (el stub `stubs/esp_attr.h` define `RTC_NOINIT_ATTR` con ella), que el arnés vuelca a un archivo al terminar y recarga al empezar; la NVS es un mapa espacio/clave → bytes (`stubs/Preferences.h`) que también pasa por un archivo. `correr_pruebas.py` encadena las fases `a_*` → `b_*` con los mismos archivos y las opciones `--sin-rtc` (corte de energía), `--sin-nvs` y `--corromper=rtc|nvs|ambas` (cambia un byte del registro, y el CRC deja de cuadrar). Casos: FLY con BOOST (mismo momento, `p0`, `s_boosted` y UTC del BOOST; registra sin reserva a 10 Hz; `TF_REANUDADO` y el `T_MISSION` con `arg = 3`), FLY con BOOST sin armar y sin hora, FLY forzado, RECOVERY (buzzer, sin registrar, `t_post` no se repite), ARMED y TIERRA (arranque normal, nada escrito), RTC inválida con NVS válida, CRC corrupto, `estado tierra` tras reanudar (invalida) y una NVS con un FLY viejo frente a una RTC con TIERRA (se limpia). También cuenta las escrituras de la NVS (solo en las transiciones) y mantiene el contador de comandos (si no, tierra recibe `RZ_CONTADOR`).
- **Sintaxis:** `g++ -std=gnu++11 -fsyntax-only` de `boost_detect.cpp`, `mission.cpp`, `ext_lsm.cpp`, `in_imu.cpp`, `ext_act.cpp`, `core_sleep.cpp`, `net_radio.cpp`, `core_selftest.cpp` y `tierra/gnd_cmd.cpp` con los stubs.

## Banco de replay (T-305)

Corre la lógica **real** de detección del firmware (`boost_detect.cpp`, `mission.cpp` con su tarea a 50 Hz sobre el reloj virtual de 20 ms, `ext_act.cpp` y `ext_bmp.cpp` con su mediana del BMP581) sobre las muestras de uno o varios `.BIN` en el formato `rec` (`formato_log.md`, `rec_format.h`), y reporta cada evento con su `t_us`. Es la prueba P-03 y el banco con el que se validará T-412.

```
# los 24 sintéticos de T-304 (los genera si faltan) y el reporte
python3 firmware/cohete/test/host/replay/replay.py
# un registro real o de banco (un .BIN, o una carpeta), con el cohete armado en la rampa (por omisión)
python3 firmware/cohete/test/host/replay/replay.py logs/DEM_0095.BIN
# varios archivos consecutivos de UN registro (FILEHDR con FH_CONTINUA: el cambio de archivo al llenarse los 32 MB)
python3 firmware/cohete/test/host/replay/replay.py --consecutivos DEM_0095_00.BIN DEM_0095_01.BIN
# otro estado de partida: tierra (BOOST sin armar) o launch (ARMED y luego LAUNCH, como la cuenta regresiva)
python3 firmware/cohete/test/host/replay/replay.py --inicio tierra archivo.BIN
```

`replay.py` solo necesita `g++` y `python3` (sin `numpy`); los sintéticos sí necesitan `numpy` y `scipy` solo para generarse. También se puede compilar con PlatformIO, `pio run -e native` en `firmware/cohete/` (deja `.pio/build/native/program`, que se corre con `--json salida.json archivo.BIN`); el entorno no es de vuelo y no está en `default_envs`.

**Qué hace con cada `.BIN`:**
- Lee los registros igual que `estacion/tblog.py` (`records`): el flujo es autodelimitado, así que si un tramo se corrompe busca el siguiente `A5 5A` con CRC bueno y cuenta los bytes saltados; **la cola de ceros del final del archivo y el último registro cortado por el apagado no cuentan como corrupción** (los dos `.BIN` de abajo traen 489 y 1039 bytes de ceros al final y tblog da 0 saltados). Los ordena por `t_us` de la cabecera, que es el instante en que el registro estuvo disponible. Entrega a la misión los que hayan llegado en cada paso de 20 ms.
- `T_EXT_LSM`: repite lo que hace `lsmTask` de `ext_lsm.cpp`: cada palabra de aceleración va al detector de BOOST con su hora (`t_first_us + k · period_us`, la que estimó el firmware), el BMP581 por el hub pasa por `extBmpOnWord` (el real, con su mediana de 3) y se publica `g_ext_imu`. `T_IMU` hace lo de `in_imu.cpp` (el QMI y `g_imu`), `T_BAR` publica `g_bar` (el BME280) y `T_PVT` publica el fix de `g_gnss`. El resto de los registros no los usa la misión.
- El cohete sale del `rocket_id` del `FILEHDR` (o de `--cohete d|h`). Lee el `FILEHDR` de cualquier versión (`formato_log.md`): v1 trae lo básico (cohete, arranque, índice), v2 agrega entorno y commit y v3 agrega `flags` con `FH_CONTINUA`. Con varios archivos (`--consecutivos`), uno sigue al anterior si es del **mismo arranque** y, desde v3, además trae `FH_CONTINUA` (la regla de `tblog.continua`); si no, se niega y hay que pasarlo por separado. El estado de partida es **ARMED**: el programa manda `armar` a los 2 s del primer registro y luego el `si` con los mismos motivos, como la estación (si hubo motivos, lo avisa: el armado fue forzado). `--inicio launch` manda además `launch` a los 4 s; `--inicio tierra` no manda nada.
- Registra cada cambio de estado, de momento y de banderas, cada `T_MISSION` (con su `t_us`), cada respuesta a un comando, cada `loggerRecord` y cada flanco de los pines del buzzer y de la Pi. Si el `.BIN` ya trae `T_MISSION`, los lista aparte (`log_mision`).

**Reporte** (en `build/replay/`, ignorado por git; `--salida` lo cambia): `reporte.md`, `reporte.csv`, `reporte.json` y un `.json` por vuelo con todos los eventos. Por vuelo: el `t_us` de BOOST, su criterio (inercial o barométrico) y dv o salto, el retraso desde el despegue y el error frente a LIFTOFF; las columnas de COAST, APOGEO, CAIDA, PARACAIDAS, ATERRIZAJE y RECOVERY (`t_us` y error; **vacías hasta T-412**) con su verdad (BURNOUT, APOGEE, PARACAIDAS_ABRE y GROUND_HIT; CAIDA y RECOVERY no tienen); las transiciones falsas; y la secuencia detectada. Sin `.verdad.json` junto al `.BIN`, solo lista los eventos detectados.

**Criterios que ya comprueba `correr_pruebas.py`** (los demás de P-03 quedan como INFO hasta T-412):
- BOOST en < 0,2 s desde el despegue (`maquina_estados.md` §6) en los 24 vuelos. El despegue es el inicio de la fuerza (`IGNITION`, el t = 0 de la sim.), como en las pruebas inerciales de arriba; el retraso incluye el lote del FIFO y el paso de 20 ms de la tarea. El error de BOOST frente a `LIFTOFF` (el evento de OpenRocket, 0,03 s después) se reporta aparte.
- Cero transiciones falsas. **Falsa** = un `T_MISSION` automático de BOOST repetido, BOOST antes de `IGNITION`, un cambio de estado o de momento antes del despegue que no sea el del guion del operador (armar, y `launch` si se pidió), o una transición que retrocede en el orden TIERRA, ARMED, FLY (LAUNCH a ATERRIZAJE) y RECOVERY. Es una definición estructural: no usa umbrales de T-412.
- Control negativo: los 9 s de reposo en la rampa, armado, de un sintético de cada cohete (`--hasta 9`): ni BOOST ni ningún cambio.
- Que todo detector que `ext_lsm.cpp` o `in_imu.cpp` llamen por muestra (`boost*(`, `moment*(`) esté también en `replay/enganches.h`.

### Logs reales sin vuelo (de banco)

```
python3 firmware/cohete/test/host/correr_pruebas.py --logs-banco "/ruta/a/la/carpeta/con/los/.BIN"
```

Corre el banco sobre cada `.BIN` de la carpeta (cada uno por separado, armado en la rampa) y exige **0 BOOST, 0 `T_MISSION` automáticos, 0 transiciones falsas y 0 bytes saltados**. Sirve para manipulación, calibración o banco sin despegue: si el detector dispara con eso, un vuelo real se arruinaría o se declararía en falso. Los `.BIN` no se versionan: se pasan por su ruta. Ejemplo, las sesiones de calibración del 2026-11-03 (firmware del 2026-11-02, sin vuelo; `FILEHDR` v1):

| Archivo | Cohete | Duración | Registros | Bytes saltados | BOOST |
| --- | --- | --- | --- | --- | --- |
| `DEM_M00_20261103_131429_0092.BIN` | Demeter | 541 s (9 min) | 211 890 | 0 | 0 |
| `HER_M00_20261103_132752_0024.BIN` | Hermes | 311 s (5 min) | 121 316 | 0 | 0 |

Para un solo archivo con el reporte completo: `replay.py archivo.BIN`.

### Cómo sumar la detección de T-412

T-412 creará un módulo puro (por ejemplo `moment_detect.cpp`) igual de portátil que `boost_detect.cpp`. Para que el banco lo corra:

1. **Fuentes:** agregar su `.cpp` a `FUENTES_DETECTORES` en `replay/replay.py` (una línea) y a `build_src_filter` del entorno `native` en `platformio.ini`.
2. **Enganches:** si el firmware lo alimenta por muestra desde `ext_lsm.cpp` o `in_imu.cpp`, repetir esa llamada en `replay/enganches.h` (`engancheMuestraLsm` o `engancheMuestraQmi`, una línea). Esos dos `.cpp` no compilan en el PC (SPI, FreeRTOS), así que el banco los reemplaza por esa capa fina. `replay.py` falla si el firmware llama un `boost*(` o `moment*(` que `enganches.h` no repite, para que nadie pase el banco con un detector desconectado.
3. **Lo que el detector lea** de `g_ext_bar`, `g_bar`, `g_ext_imu`, `g_imu` o `g_gnss`, o desde `mission.cpp`, ya lo alimenta el banco. Si `mission.cpp` gana una dependencia nueva (otro módulo con su estado), hay que agregar su stub **una sola vez**, en `stubs/arnes_mision.h`, que comparten `prueba_mision.cpp` y `replay/prueba_replay.cpp` (reloj virtual, colas, NVS de mentira, logger, calibración, pines; lo que difiere entre los dos entra por ganchos `g_alTick`, `g_alRegistrar`, `g_alResp` y `g_alPin`).
4. **Reporte:** nada. Los momentos COAST a ATERRIZAJE y el paso a RECOVERY se leen de los cambios de estado y de momento de la misión: las columnas se llenan solas y `replay.py` ya calcula su error frente a la verdad. Agregar los criterios de T-412 (secuencia 100 %, apogeo < 0,3 s) a `para_pruebas()`, hoy como INFO.

## Qué NO prueba

- **Con el banco de replay:** la deriva del reloj de muestras del chip (usa `t_first_us` y `period_us` del registro, con muestras equiespaciadas dentro de cada lote), la concurrencia de los núcleos ni los tiempos de CPU. Los sintéticos son de OpenRocket con ruido de los sensores del banco: no son vuelos reales. Todavía no hay `.BIN` de vuelo en el repo.
- La sincronización entre núcleos en el chip, la tasa real del FIFO ni los tiempos de CPU. Eso va en el banco (P-04) y con el IMU en una mesa.
- La respuesta real del LSM (su filtro pasa-bajas) ni la vibración del motor.
- Los demás momentos (T-412).
- **Que `RTC_NOINIT_ATTR` sobreviva en el chip** a cada tipo de reinicio (`ESP.restart()`, watchdog, brownout, reset por el pin EN o por el USB), ni lo que tarda una escritura a la NVS (frena el flash). Eso va en el banco (P-10).
- **Los pines reales (T-413):** que IO45 e IO46 salgan en bajo, que `gpio_hold_en` los retenga en el sueño profundo y que `gpio_hold_dis` los libere al despertar solo se ve en el chip, con un multímetro u osciloscopio. El PC solo comprueba que el código los pide en el orden correcto. Tampoco corre `net_radio.cpp` (solo se revisa que asigne `p.actuators`).
