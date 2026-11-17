---
fecha: 2026-11-03
tipo: tarea
ids: [T-411, D-051, D-052, D-015, P-10]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-411-persistencia-vuelo
---
# T-411: persistencia en vuelo (RTC + NVS) y D-051

## Contexto
Si el ESP32 se reinicia en pleno vuelo (watchdog, brownout, un fallo de software), hoy vuelve a TIERRA y deja de registrar y de transmitir a 10 Hz justo cuando más hace falta. D-015 lo pedía como requisito y D-052 lo cerró: el estado se guarda en la RTC y en la NVS y, al arrancar, se retoma FLY o RECOVERY. De paso se implementa D-051: un comando que no aplica (`RZ_OP`) responde `CR_ERROR` y no se puede confirmar (hallazgo de T-413: confirmado, devolvía `CR_OK` sin hacer nada y levantaba `TF_FORZADO`).
La especificación es `maquina_estados.md` §8 (con §2, §6 y §7), `protocolo_paquetes.md` §2 (`TF_REANUDADO`) y `formato_log.md` (el `T_MISSION` con `arg = 3`), del PR #49 (rama `docs/contrato-t411`), leídos con `git show` sin copiarlos a esta rama. La base es `origin/develop` con T-410 y T-413.
No consulté el grafo de graphify: los archivos que tocaba ya los conocía por T-410 y T-413 (los leí enteros) y busqué solo con grep.

## Qué se hizo
- **`firmware/common/net_proto/net_proto.h`:** `TF_REANUDADO = 16` (bit 4 de `flags`). Los tamaños de los paquetes no cambian.
- **`firmware/cohete/src/mission.cpp`** (C++11, estilo de Pablo; solo este archivo del firmware):
  - **Registro persistente** `MisPersist`, 32 B sin relleno: `magic` ("MIS1"), versión 1, estado, momento, `s_boosted`, `flags` (solo `TF_BOOST_SIN_ARMAR` y `TF_FORZADO`; `TF_REANUDADO` no se guarda: lo pone la reanudación), `p0` de cada barómetro con su bit de validez, UTC del BOOST en ms (`-1` si no hubo BOOST o no había hora), el contador de arranques y un CRC-16 (`net::crc16`, el de los paquetes).
  - **Dónde:** `RTC_NOINIT_ATTR` (`#include <esp_attr.h>`) y NVS (`Preferences`, espacio `tbmis`, clave `vuelo`, el mismo espacio del contador de comandos). Primero se escribe la RTC (instantánea) y luego la NVS.
  - **Cuándo se escribe** (solo en transiciones, nunca periódicamente): `setState(ST_FLY)`, cada cambio de momento (`onBoost` y `OP_SET_MOMENT` en FLY) y `setState(ST_RECOVERY)`. Un BOOST desde ARMED o TIERRA escribe **una sola vez** (`setState(ST_FLY, false)` y luego el guardado con el momento BOOST).
  - **Invalidación:** en `setState(ST_TIERRA)` y `setState(ST_ARMED)` se escribe un registro **válido con un estado no reanudable**, en lugar de borrar. Así, si una de las dos memorias fallara al escribir, la otra no deja un vuelo viejo que gane. Solo se escribe si había algo que invalidar (`s_persistLive`): armar y desarmar en el banco no toca la NVS. Si `putBytes` falla, se hace `remove` de la clave.
  - **Reanudación** en `missionBegin`, con `persistRestore()` justo antes de crear la tarea (la RTC si es válida; si no, la NVS; un estado distinto de FLY/RECOVERY o un registro inválido es un arranque normal):
    - **FLY:** mismo momento, `s_boosted`, banderas y `p0`; `loggerAllowPrealloc(false)`, `loggerRecord(true)`, `netSetFlying(true)`.
    - **RECOVERY:** `extActBuzzer(true)` (T-413), `netSetFlying(false)`, **sin** `loggerRecord` y sin `t_post` (así lo dice la tabla de §8).
    - **Los dos:** `TF_REANUDADO`, la RTC vuelve a tener el registro (aunque solo la NVS lo conservara) y un `T_MISSION` automático con `op = 0`, `arg = 3` (`MIS_REANUDADO`), `from` y `to` = el estado guardado.
  - **`TF_REANUDADO`** se apaga en `setState(ST_TIERRA)`, junto con `TF_FORZADO`.
  - **UTC del BOOST:** `time_to_utc_us()` en `onBoost`, y en `OP_SET_MOMENT` solo la primera vez que `s_boosted` pasa a verdadero.
  - **D-051:** en `handleCmd`, si la máscara contiene `RZ_OP`: `CR_ERROR` con esos motivos, sin pendiente y sin ejecutar (antes de la lógica de confirmación, así que tampoco se puede forzar).
- **`estacion/dashboard.py`:** `TF_REANUDADO = 16`; la columna "Modo" suma "REANUDADO" y el paso de 0 a 1 deja un evento "REANUDADO tras un reinicio (retomo FLY|RECOVERY)". `estacion/web1.py`, `boost_detect.*` y `calib.py` no se tocaron.
- **Arnés del PC (`firmware/cohete/test/host/`):**
  - `stubs/esp_attr.h` (nuevo): `RTC_NOINIT_ATTR` = una sección propia (`rtc_noinit_host`) del ejecutable; `stubs/Preferences.h` con `putBytes`, `getBytes`, `remove`, `getUInt`, `end`.
  - `prueba_mision.cpp`: una NVS de mentira (espacio/clave → bytes) y una "reinicio" = **otro proceso**: la sección de la RTC y la NVS se vuelcan a un archivo al terminar y se recargan al empezar (`--rtc`, `--nvs`), con `--sin-rtc`, `--sin-nvs` y `--corromper=rtc|nvs|ambas` (cambia un byte del registro). Escenarios `a_*` (escriben) y `b_*` (arrancan con lo guardado), más `d051`. Reloj virtual de 20 ms por paso, como ya tenía.
  - `correr_pruebas.py`: encadena las fases y añade 15 casos de persistencia y el de D-051. `README.md` actualizado.
  - **Dos comprobaciones de T-413 cambian por D-051:** "buzzer con argumento 2" y "`pi encender` en Hermes" esperaban `NO_APTO` con `RZ_OP` y ahora esperan `CR_ERROR`; la de Hermes añade que confirmarlo también da `CR_ERROR` y no levanta `TF_FORZADO`.

## Evidencia
- Commits: `142bf0f` (TF_REANUDADO), `d8fa7ef` (dashboard), `a484c0c` (mission.cpp y arnés).
- `python3 firmware/cohete/test/host/correr_pruebas.py` (reposo de 30 min): **68 filas OK, 0 FALLA, 5 INFO** ("Todos los criterios se cumplen"). Todo el arnés de T-410 y T-413 sigue en verde.
- **Persistencia, 15 casos:**
  | Caso | Resultado |
  | --- | --- |
  | ARMED → BOOST → COAST → reinicio | vuelve a FLY/COAST, `s_boosted` (abortar = `NO_APTO` con `RZ_EN_VUELO`), `p0` (a 30 m reales marca 30,0 m), UTC del BOOST igual, `loggerRecord(true)` sin cerrar, sin reserva, 10 Hz, `TF_REANUDADO`, un `T_MISSION` con `arg 3`, `counter` = el arranque guardado, todo en el primer paso de la tarea |
  | BOOST sin armar y sin hora | conserva `TF_BOOST_SIN_ARMAR` y el UTC `-1` |
  | `launch` forzado desde TIERRA | vuelve a FLY/LAUNCH con `TF_FORZADO`, `s_boosted` falso (abortar es apto) y abortar invalida |
  | RECOVERY | vuelve a RECOVERY, buzzer sonando, no llama a `loggerRecord`, 62 s después sigue igual (`t_post` no se repite); `estado tierra` apaga el buzzer y deja las banderas en 0 |
  | ARMED o TIERRA (armar y desarmar) | arranque normal en TIERRA, sin `T_MISSION`, sin escrituras |
  | FLY → `estado tierra` → reinicio | arranque normal |
  | RTC inválida (corte de energía) y NVS válida | FLY y RECOVERY desde la NVS, y la RTC se rehace |
  | RTC válida y NVS vacía | FLY desde la RTC |
  | CRC corrupto en las dos | arranque normal |
  | CRC corrupto solo en la RTC o solo en la NVS | FLY desde la otra |
  | reanudar y salir con `estado tierra` confirmado | pide confirmación (`EN_VUELO`), pasa a TIERRA, `loggerRecord(false)`, banderas en 0, registro invalidado; el siguiente arranque es normal |
  | RTC con TIERRA válido y NVS con un FLY viejo | arranque normal y la NVS se invalida |
- **Escrituras de la NVS:** una al BOOST desde ARMED y una por cambio de momento; 10 s después, ninguna más.
- **D-051 (10 comprobaciones):** un `op` desconocido, `estado 9`, `momento 9` y `buzzer 2` dan `CR_ERROR` con `RZ_OP`; confirmarlos da `CR_ERROR`, no ejecuta ni levanta `TF_FORZADO`; `pi encender` en Demeter sigue siendo `NO_APTO`; un `RZ_OP` en medio borra el comando pendiente (la confirmación siguiente da `RZ_CONFIRM`).
- **Mutaciones** (para ver que las pruebas no son vacías): no restaurar `s_boosted`, no restaurar `p0`, no llamar a `loggerAllowPrealloc(false)`, no restaurar el UTC, no poner `TF_REANUDADO`, no invalidar nunca, no llamar a `persistRestore()`, no limpiar la NVS vieja y quitar D-051. **Las 9 las detecta el arnés.**
- `g++ -std=gnu++11 -fsyntax-only -Wall -Wextra` de `mission.cpp`, `net_radio.cpp`, `core_selftest.cpp`, `ext_act.cpp`, etc. con los stubs: sin errores ni avisos. El binario del arnés compila sin avisos.
- `python3 estacion/dashboard.py --demo --no-abrir --puerto 8797` responde (`/api/state` devuelve el JSON). **El puerto 8799 que pedía la tarea ya estaba ocupado por otro proceso** (el arranque falla con "El puerto 8799 esta ocupado"; no lo abrió esta tarea), por eso se probó en el 8797. `note_telem()` con `flags` 1 → 17 deja el evento de reanudación.
- **PlatformIO:** `pio run -d firmware/cohete -e demeter` se intentó una vez y falla al instalar la plataforma (`Platform Manager: Installing espressif32 @ 6.13.0` → `HTTPClientError`; el proxy bloquea `api.registry.platformio.org`). **No se compiló para el chip.** Nota: los environments reales de `platformio.ini` son `hermes`, `demeter`, `demeter_campo`, `hermes_sinhora` y `hermes_campo`, no `supreme_*` como dice `CLAUDE.md`.

## Decisiones tomadas o propuestas
Nada cambia los contratos. Lo que decidí donde §8 no dice, para que Pablo y el documentador lo revisen en el PR:
1. **Invalidar escribiendo un registro de estado TIERRA/ARMED en vez de borrar** (§8 dice "se invalida"). Es más robusto ante una escritura que falla en una sola memoria. Solo se escribe si había un registro reanudable.
2. **`TF_REANUDADO` se apaga solo al pasar a TIERRA** (literal de §8). En ARMED (por ejemplo, tras abortar un FLY sin BOOST reanudado) sigue encendido y el registro ya está invalidado. Si se prefiere apagarlo también en ARMED, es una línea.
3. **`T_MISSION` de la reanudación:** `counter` = el contador de arranques del arranque que guardó el registro. §8 no fija el `counter`; ayuda a ver cuántos reinicios hubo. Si se prefiere 0, es un cambio de una línea.
4. **El contador de arranques** (`boot_count`) lo cuenta el logger en la NVS (`tbfw`, clave `boot`) y no está expuesto. `mission.cpp` lo **lee** con otra instancia de `Preferences` solo lectura. Es un acoplamiento por el nombre de una clave: lo limpio sería que `logger.h` lo expusiera (`LoggerStats.bootCount`), pero eso toca otro módulo. Propuesta para una tarea aparte.
5. **RECOVERY reanudado no llama a `loggerRecord`**, como dice la tabla de §8 ("el registro de `t_post` no se repite"). La tarea decía en general "con `loggerRecord`"; lo apliqué solo a FLY.
6. **El aviso de `t_abort`** (LAUNCH sin BOOST) **no se rearma** tras reanudar un FLY en LAUNCH: no se sabe cuándo se armó. Solo avisaba.

## Problemas y cómo se resolvieron
- **El contador de comandos también sobrevive al reinicio** (`tbmis/ctr`): en mi primera prueba, tras el "reinicio" los comandos de la prueba empezaban en 1 y daban `RZ_CONTADOR`. Es el comportamiento real y correcto (tierra sigue desde `last_counter`); el arnés ahora continúa desde el contador guardado.
- El UTC del BOOST se pisaba con la hora de un `momento coast` posterior si el BOOST original no tenía hora. Corregido: solo se toma la primera vez que `s_boosted` pasa a verdadero.
- La primera versión de la prueba "RTC inválida y NVS válida" comparaba con la RTC vacía; el registro esperado ahora sale de la RTC o, si no es válida, de la NVS.

## Lo que no se pudo verificar en el chip (P-10, pendiente en el banco)
- **Que `RTC_NOINIT_ATTR` sobreviva a cada tipo de reinicio en el ESP32-S3.** Por lo que sé de la documentación de ESP-IDF (no pude consultarla aquí), se conserva en un reinicio por software (`ESP.restart()`) y por watchdog; para brownout y reset por el pin EN o por el USB hay que medirlo, y se pierde en un corte total de energía (para eso está la NVS). Prueba en el banco, una por tipo: `reiniciar` forzado en FLY, un watchdog provocado a propósito, brownout bajando la tensión, reset por EN y corte de energía. Con un CRC de 16 bits más el `magic` y la versión, una RTC con basura (arranque en frío) casi no tiene probabilidad de pasar por válida.
- **El tiempo hasta registrar de nuevo (P-10: < 3 s).** La reanudación ocurre en `missionBegin`, después del arranque de los buses, el GNSS, el logger, los IMU y el I2C (`core_selftest.cpp`), y el archivo se abre cuando el logger monta la SD: hay que medirlo en el chip.
- **El costo de la escritura a la NVS.** Una escritura a flash frena unos milisegundos el código que corre desde flash en los dos núcleos. Son 2 o 3 escrituras por vuelo (BOOST, algún momento y RECOVERY), pero la del BOOST ocurre con el FIFO del LSM lleno de datos: conviene medir en el banco que no se pierdan muestras (P-04).
- **Dormir en RECOVERY (forzado) y despertar con el imán:** la RTC puede conservar el registro de RECOVERY y al despertar se reanudaría. Habría que decidir si dormir lo invalida (no está en el contrato; hoy dormir en RECOVERY exige confirmación). Con `estado tierra` primero no hay problema.
- La estación de tierra y `gnd_cmd.cpp`: el arnés de tierra de T-413 sigue en verde, pero no revisé cómo muestra un `CR_ERROR` con `RZ_OP` (antes veían `NO_APTO` y pedían `si`).

## Pendiente / siguiente paso
- P-10 en el banco: un reinicio forzado en FLY vuelve a FLY y registra en < 3 s, uno por tipo de reinicio (arriba).
- Que Pablo revise los puntos 1 a 6 de "Decisiones" y las marcas (P) de §8.
- Una tarea aparte para exponer `bootCount` en `LoggerStats`.
- Que tierra (`gnd_cmd.cpp`, el dashboard) trate `CR_ERROR` + `RZ_OP` como un error sin confirmación.
- Los momentos COAST a ATERRIZAJE automáticos (T-412) llamarán a `persistSave()` en cada cambio de momento; hoy solo lo hacen los comandos y BOOST.

## Documentos afectados
`docs/04_diseno/maquina_estados.md` §8 (cumplida; el documentador puede pasar T-411 y D-051 a "hecha"), `docs/05_plan/backlog.md` (T-411), `docs/04_diseno/decisiones.md` (D-051, D-052), `docs/05_plan/plan_pruebas.md` (P-10, parcial en el PC). `firmware/cohete/test/host/README.md` (de código) ya está actualizado en esta rama.
