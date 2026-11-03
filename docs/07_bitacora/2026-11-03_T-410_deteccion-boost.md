---
fecha: 2026-11-03
tipo: tarea
ids: [T-410, C1, P-04, D-040]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-410-deteccion-boost
---
# T-410: detección de BOOST en el firmware de los cohetes

## Contexto
La revisión del firmware de Pablo marcó como crítico (C1) que no existe detección automática de BOOST: si LAUNCH no llega por radio el cohete no registra, y `s_boosted` nunca se activa, así que las protecciones "en vuelo" no actúan. La especificación es `docs/04_diseno/maquina_estados.md` §6; el formato del `T_MISSION` automático está en `formato_log.md`. La rama parte de `origin/develop` (`9f70138`, ya con el PR #36).

## Qué se hizo
- **Módulo puro nuevo** `firmware/cohete/src/boost_detect.h/.cpp` (C++11, sin dependencias de ESP32):
  - `BoostIntegrator`: `dv += (|a| − 1)·g0·dt` mientras `|a| > BOOST_ACC_MIN_G`, con el `dt` real entre las marcas de `t_us`; `dv = 0` tras más de `BOOST_RESET_MS` seguidos con `|a| ≤ 2 g`; dispara con `dv ≥ boost_dv_mps` y vuelve a 0.
  - `BoostBaroJump`: compara la altura con la de hace `jump_s` (busca por tiempo en un anillo de 64 muestras) y exige `BOOST_BARO_EVAL` evaluaciones seguidas con `salto ≥ jump_m`.
  - `BoostFlag`: una palabra atómica de 32 bits (tipo en 4 bits, valor en 28) para pasar el aviso de la tarea del IMU (núcleo 1) a la de misión (núcleo 0), sin bloqueos.
  - Ganchos `boostLsmSample`, `boostQmiSample`, `boostTakeLsm`, `boostTakeQmi`, `boostSetTarget`.
- **`mission_config.h`:** `BOOST_ACC_MIN_G` (2,0), `BOOST_RESET_MS` (50) y `BOOST_BARO_EVAL` (5), con los nombres de `constantes.md` §4. `boost_dv_mps`, `jump_m` y `jump_s` ya estaban en `MissionCfg`.
- **`ext_lsm.cpp`:** en el consumidor del FIFO, cada palabra de aceleración (`TAG_ACC`) llama a `boostLsmSample` con su instante `s_clk.timeOf(n)` (el mismo reloj que ya usa para el BMP).
- **`in_imu.cpp`:** cada muestra del lote del QMI8658 llama a `boostQmiSample`, después de soltar el mutex del bus.
- **`mission.cpp`:**
  - `boostStep()` cada 50 Hz: lee los avisos (siempre los dos, para no arrastrar uno viejo), usa el del QMI **solo si el LSM no tiene datos frescos** (`FRESH_US`) y, si no hay inercial, el salto barométrico.
  - `onBoost()` aplica la tabla de §6: ARMED o TIERRA pasan a FLY con `setState`; FLY con LAUNCH solo cambia el momento; BOOST o después y RECOVERY no hacen nada. Pone `s_moment = M_BOOST`, `s_boosted = true`, apaga `s_abortOn` y `TF_LAUNCH_VENCIDO`; desde TIERRA levanta `TF_BOOST_SIN_ARMAR` (no se borra hasta un reinicio).
  - `T_MISSION` automático: `op = 0`, `arg` = 1 (inercial) o 2 (barométrico), `counter` = `dv` en cm/s o salto en cm, `reasons = 0`.
  - `baroStep()` alimenta el detector barométrico con la altura **sin filtrar** y lo reinicia si cambia el sensor (BMP581 a BME280).
- **Pruebas en el PC** en `firmware/cohete/test/host/` (ver su README): `correr_pruebas.py` (genera entradas, compila y corre), `prueba_boost.cpp` (módulo puro), `prueba_mision.cpp` (el `mission.cpp` real con stubs y reloj virtual) y `stubs/`.
- No se tocó `net_proto.h`, ni persistencia (T-411), ni los demás momentos (T-412), ni actuadores o buzzer (T-413).
- Commits: `21d4a78` (módulo), `477073c` (misión), `8247f0c` (ganchos del LSM y el QMI), `3906e16` (arnés de pruebas).

## Evidencia
Salida de `python3 firmware/cohete/test/host/correr_pruebas.py` (g++ 13.3, numpy 2.5.3; semilla 1; 30 min de reposo). Salió con código 0.

**Positivas inerciales** (sims. de OpenRocket → fuerza específica, ruido σ = 0,01 g por eje, 2 s de reposo antes del despegue, 5 semillas de ruido; el tiempo es el peor de las 5):

| Cohete | Tasa | BOOST desde el despegue | Con la lectura de 20 ms de la tarea | dv al disparar |
| --- | --- | --- | --- | --- |
| Demeter (H135W-8) | 1600 Hz | 0,070 s | 0,090 s | 5,01 m/s |
| Demeter | 1666,67 Hz | 0,070 s | 0,090 s | 5,01 m/s |
| Hermes (G80-7T) | 1600 Hz | 0,081 s | 0,101 s | 5,03 m/s |
| Hermes | 1666,67 Hz | 0,081 s | 0,101 s | 5,04 m/s |

Criterio < 0,2 s: se cumple con margen. (La referencia de Pablo, dv = 5 m/s a 0,074 y 0,084 s, coincide.) Pasa por el gancho real con cuentas `int16` del LSM (0,976 mg/LSB).

**Negativas inerciales** (cero detecciones):

| Caso | Detecciones | dv máximo |
| --- | --- | --- |
| Golpe de 10 g, 20 ms (rectangular) | 0 | 1,76 m/s |
| Impacto de 20 g, 10 ms (rectangular) | 0 | 1,86 m/s |
| Sacudida de ±3 g a 5 Hz, 5 s, eje vertical | 0 | 1,77 m/s |
| 30 min de reposo con ruido (2,88 M muestras) | 0 | 0,00 m/s |

**Barométrico** (perfil de altura de la sim., ruido de 0,05 m, evaluado a 100 Hz y a 50 Hz, que es la tasa real de la tarea):

| Cohete | A 100 Hz | A 50 Hz (real) | Salto al disparar |
| --- | --- | --- | --- |
| Demeter | 0,540 s | 0,580 s | 12,2 / 14,1 m |
| Hermes | 0,580 s | 0,620 s | 11,8 / 13,3 m |

Negativas barométricas (cero detecciones): 30 min de reposo con deriva de clima de 0,5 m/min (salto máximo 0,33 m); un dato malo de un solo cuadro de +15 m; un portazo de +12 m durante 60 ms (3 evaluaciones).

**Misión** (`mission.cpp` real con stubs, reloj virtual de 20 ms, Demeter; 6 escenarios, todas las comprobaciones en OK):
- TIERRA: BOOST inercial lleva a FLY con momento BOOST, `TF_BOOST_SIN_ARMAR`, `loggerRecord(true)` y un `T_MISSION` (`op 0`, `arg 1`, `from TIERRA`, `counter` = 500 cm/s).
- ARMED: FLY con BOOST sin `TF_BOOST_SIN_ARMAR`; luego `desarmar` en vuelo responde `NO_APTO` con `RZ_EN_VUELO` (la protección de C1 ya actúa); un segundo BOOST no genera otro `T_MISSION` y el registro nunca se cierra.
- LAUNCH sin BOOST: registra, a los 120 s levanta `TF_LAUNCH_VENCIDO`, y el BOOST tardío lo apaga y deja el momento BOOST; `abortar` queda `NO_APTO`.
- Barométrico (sin aceleración): `arg 2`, `counter` = 1360 cm.
- QMI: se ignora con el LSM fresco; con el LSM sin datos, da el BOOST (`arg 1`).

**Compilación:**
- `g++ -std=gnu++11 -fsyntax-only -Wall -Wextra` con stubs de Arduino/FreeRTOS: `boost_detect.cpp`, `mission.cpp`, `ext_lsm.cpp` e `in_imu.cpp`, sin errores ni avisos (para `in_imu.cpp` se revisó desde una copia, para que el stub de `LoRaBoards.h` gane al de la placa).
- **PlatformIO: no se pudo.** `pio platform install espressif32@6.13.0` falla con `HTTPClientError` (el proxy del entorno bloquea `api.registry.platformio.org`, igual que en T-007). **No se ha compilado para el ESP32.** Falta que Pablo, Juan Pablo o Jerónimo corran `pio run -e demeter -e hermes` en una máquina con red.

## Decisiones tomadas o propuestas
Decisiones mínimas que tomé donde la especificación no llegaba (para revisión de Pablo). Ninguna cambia un contrato.

1. **Huecos entre muestras.** Un `dt` > 5 ms (`DT_MAX_US`, interno de `boost_detect.cpp`) no se integra, y un hueco > `BOOST_RESET_MS` reinicia `dv`. Razón: las pérdidas del FIFO hacen saltar `timeOf(n)`, y una muestra suelta de 20 g después de un hueco de 40 ms habría sumado 7,5 m/s de golpe. Un `dt ≤ 0` (el reloj de muestras se reajusta por lote) tampoco integra. Propuesta: anotarlo en §6.
2. **Cuál IMU cuenta.** El aviso del LSM manda; el del QMI vale solo si, al leerlo la tarea de misión, el LSM no tiene muestra fresca (`FRESH_US`). Cada IMU tiene su propio integrador. Si el LSM está fresco, el aviso del QMI se descarta.
3. **Altura del salto barométrico:** la altura **sin filtrar** que calcula `baroStep()`, no `s_alt`. El filtro de `ALT_TAU_S` = 0,2 s la atrasaría y le quitaría salto justo en el ascenso (en la sim., el salto de 10 m en 0,5 s se alcanza apenas hacia 0,25 s). El detector se reinicia al cambiar de sensor barométrico. Propuesta: aclararlo en §6 ("la barométrica sobre `p0`").
4. **Tras disparar, el integrador vuelve a 0** y puede volver a disparar; en FLY con BOOST el aviso se ignora. Así no hay estado que sincronizar entre núcleos.
5. **Constantes:** `BOOST_ACC_MIN_G`, `BOOST_RESET_MS` y `BOOST_BARO_EVAL` van en `mission_config.h` (el módulo puro las incluye); `G0_MPS2` y `DT_MAX_US` quedan privados del `.cpp`. `DT_MAX_US` (5 ms) debería entrar a `constantes.md` si se acepta la decisión 1.
6. **`TF_BOOST_SIN_ARMAR` desde TIERRA** usa `setState(ST_FLY)` tal cual, que ya en FLY desde TIERRA deja `loggerAllowPrealloc(true)`; la tabla dice "registra (sin reserva)", y no se creó ninguna reserva nueva. Sin cambios al logger.

### Hallazgo: falsos positivos del integrador con sacudidas (propuesta para Pablo)
La especificación pide cero detecciones con "sacudida de ±3 g a 5 Hz durante 5 s". Con el **eje vertical** (|a| = |1 + 3·sen|) el criterio se cumple (dv máximo 1,77 m/s). Pero con la sacudida en un **eje horizontal** (|a| = √(1 + 9·sen²)) **sí detecta**: el tiempo bajo 2 g por semiciclo es de solo 39 ms, menor que `BOOST_RESET_MS` = 50 ms, así que `dv` nunca se reinicia y llega a 52 m/s en 5 s (10 detecciones). El barrido informativo (3 g de amplitud, 5 s, `dv` máximo en m/s; "FP" = hay detecciones):

| Frecuencia | 1 Hz | 2 Hz | 3 Hz | 5 Hz | 8 Hz | 10 Hz | 15 Hz | 20 Hz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vertical | 8,8 FP | 4,4 | 3,0 | 1,8 | 20 FP | 16 FP | 45 FP | 44 FP |
| Horizontal | 5,3 FP | 2,6 | 1,8 | 52 FP | 52 FP | 53 FP | 52 FP | 53 FP |

(En 8 y 10 Hz vertical influye que el valle de la señal toca justo 2 g y el ruido de 0,01 g corta el tiempo bajo el umbral; el efecto es el mismo en un caso real.) Es una propiedad del criterio tal como lo definió Pablo (la norma con un reinicio por tiempo), no un error de la implementación. Cuánto importa depende de si existe una sacudida real de ±3 g sostenida a más de 5 Hz: en TIERRA el costo es registrar de más; en ARMED cuesta la protección de abortar (`s_boosted` activa `RZ_EN_VUELO`).

Opciones, modeladas **solo en Python** (no están en el firmware ni se probaron en la placa):
- `BOOST_RESET_MS` = 20 ms: arregla 5 y 8 Hz horizontal y 15 y 20 Hz vertical; no arregla 10 Hz o más horizontal.
- Que `dv` **decaiga** mientras `|a| ≤ 2 g` (por ejemplo 3 g = 29 m/s²): `dv` máximo ≤ 1,8 m/s de 5 a 20 Hz en los dos ejes; un BOOST real (|a| > 2 g sin interrupción durante 1,8 a 2,1 s) no lo nota.
- Integrar el vector (restando la gravedad con un pasa-bajas lento) en lugar de la norma: robusto a sacudidas, pero se aparta de la decisión de usar la norma.

No cambié nada: es una decisión de Pablo. El arnés ya tiene el barrido para validar cualquier cambio.

### Otros límites de las pruebas
- Un pulso barométrico de +12 m que dure 120 ms (6 evaluaciones a 50 Hz) **sí** dispara por diseño (`BOOST_BARO_EVAL` = 5). Un portazo de 60 ms no. Es la razón por la que el barométrico es solo un respaldo.
- Las sims. no incluyen el filtro pasa-bajas del LSM, la vibración del motor ni la inclinación del cohete; la norma no depende de la orientación.
- La sync entre núcleos (la bandera atómica) y los tiempos de CPU del gancho en el FIFO (un `sqrtf` y un `llround` por muestra, ~1700 por segundo en el núcleo 1) no se midieron en el chip.

## Problemas y cómo se resolvieron
- **PlatformIO sin red:** se intentó una vez, falló, y se sustituyó por `g++` con stubs (ver arriba).
- **Falso positivo inesperado con la sacudida horizontal:** apareció al generar el caso con un eje horizontal; se documentó y se dejó el barrido como informativo en lugar de cambiar el criterio sin acuerdo.
- **Bug de mi arnés:** la comprobación "sigue registrando" contaba el `loggerRecord(false)` de ARMAR; se corrigió contando solo desde el LAUNCH.

## Pendiente / siguiente paso
- Compilar en una máquina con red (`pio run -e demeter -e hermes`) y revisar el uso de CPU del núcleo 1.
- Banco (P-04): 30 min de manipulación de la placa real sin falsos positivos, y la mesa con el LSM leyendo.
- Decidir con Pablo el hallazgo de las sacudidas (reinicio más corto, decaimiento o vector).
- T-413: los actuadores por `TF_BOOST_SIN_ARMAR` (el pulso de la Pi en Demeter).
- T-411: persistir `s_boosted` y el instante de BOOST; hoy un reinicio en vuelo lo pierde.
- T-305: replay sobre logs `rec` reales (el arnés lee un formato propio de entrada, no `.BIN`).

## Documentos afectados
- `docs/04_diseno/maquina_estados.md` §6 (propuestas 1, 2 y 3 y el hallazgo) y §1 (BOOST pasa de ❌ a implementado, sin validar en hardware).
- `docs/02_requisitos/constantes.md` §4 (`DT_MAX_US` si se acepta la propuesta 1).
- `docs/05_plan/backlog.md`: T-410 pasa a "en revisión"; `docs/05_plan/riesgos.md`: riesgo de falsos positivos por sacudida.
- Quedan para el documentador: yo no los edité.
