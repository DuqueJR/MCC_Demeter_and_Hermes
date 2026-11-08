---
fecha: 2026-11-07
tipo: tarea
ids: [T-657, D-064, D-065]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-657-datos-fieles-web1
---
# T-657: datos fieles al firmware en `web1.py` (altura, `act.*`, `reanudado`, `salud.pi`)

## Contexto
La víspera del lanzamiento, en la base de lanzamiento la web marcaba 40 m donde debía marcar 0 m. La revisión firmware → `web1.py` → web (`docs/08_gui/12_correcciones_web_vuelo.md`, hallazgos A1, A3, A5 y A6) mostró que `web1.py` restaba una constante del sitio (510 m) a la altura sobre el nivel del mar del TELEM y que ignoraba `actuators` y `TF_REANUDADO`. Esta tarea aplica D-064 (altura) y D-065 (`salud.pi`, `act.*`).

## Qué se hizo
- **Altura (D-064)** en `estacion/web1.py`, con la regla de `p0` de `firmware/cohete/src/mission.cpp` (`REF_TAU_S = 60`):
  - una referencia **por cohete**: mientras `state == TIERRA`, filtro exponencial de τ = 60 s sobre `alt_msl = alt_cm/100`, `ref += (alt − ref)·(1 − e^(−dt/τ))` con `dt` entre paquetes (la forma exacta, porque en tierra llega un TELEM cada ~0,5 s y no cada 20 ms como la tarea del firmware);
  - solo mueven la referencia las muestras con `ekf_ok`; si no hay EKF, las del GNSS con fix 3D. **No se mezclan las fuentes**: una referencia nacida del EKF ignora las muestras solo-GNSS (la altura de cada fuente se mide distinto); si aparece el EKF después de una referencia GNSS, se rehace con el EKF;
  - la primera muestra válida la inicializa (como `s_ref` en el firmware); se congela al pasar a ARMED, FLY o RECOVERY; si vuelve a TIERRA (desarme) sigue otra vez, **sin contar el tiempo que estuvo congelada** (no salta);
  - `pos.alt_agl_m = alt_msl − referencia`; `pos.alt_msl_m = alt_msl` (la del TELEM, sin tocar); `salud.alt_origen_msl_m = referencia`. El apogeo, la serie, `lkp`, la elipse y el tiempo restante usan esa `alt_agl`.
  - `SITIO_ALT_MSL_M` ya no entra en ningún cálculo; solo sigue en `meta.sitio` (campo obligatorio del contrato, informativo).
  - **Persistencia**: `Traductor(ruta_referencia=...)` / `persistir_en(ruta)` guarda la referencia por `"<rid>:<mission_id>"` en `estacion/web1_referencia.json` (ignorado por el repo; atómico con `os.replace`; cada 10 s en TIERRA y siempre al congelarse). Si el primer paquete que ve un cohete ya no es de TIERRA, la recupera del archivo si tiene menos de 12 h. `dashboard.py` la activa **solo en vivo** (no en `--demo` ni `--reproducir`: una reproducción no debe escribir una referencia que luego valga en un vuelo real). Un archivo roto o ilegible no tumba nada.
  - **Respaldo (P)** si no hay referencia ni archivo (el dashboard arrancó con el cohete ya en vuelo y sin archivo): la altitud de la estación (`pos(n)=` de `[time]`), o la primera muestra si tampoco hay. Un respaldo **no se persiste**. Es un límite conocido, no una solución: ver Pendiente.
  - Sin ninguna muestra válida en TIERRA (sin fix 3D y sin EKF) no hay referencia: `alt_agl_m = 0.0` (el cohete está en la rampa) y `alt_origen_msl_m = null`. Nunca se muestra la altitud MSL como si fuera AGL.
- **`act.*`** desde `TELEM.actuators`: `buzzer` = bit 0; `pi_pulso` = bit 1; `cam_ok` = el byte alto (bits 8 a 15) está en READY, ARMED, STARTING, ASCENT o RECORDING. En Hermes `cam_ok` y `pi_pulso` van en `false` siempre. `wifi_ap` y `backfill` siguen en `false`.
- **`flags.reanudado`** desde `TF_REANUDADO` (bit 4 de `flags`, valor 16 en `net_proto.h`).
- **`salud.temp_esp_c`** queda `null` **a propósito**: `TELEM.temp_c[0]` es la temperatura del barómetro, no la de la placa (hallazgo A6).
- **Contrato (D-065), `salud.pi` opcional**: Hermes `null`; Demeter `{estado, motivo, bat_pct}` con `estado` = nombre del `StatusCode` (`"DESCONOCIDO"` si el byte es 0xFF o no tiene nombre), `motivo` = nombre del `ErrorCode` o `null` si es 0 (un código sin nombre sale como `"OTRO"`) y `bat_pct` = `null`. Agregado a `gui/web/src/contrato/esquema.json` (**fuera de `required`**, con `anyOf [objeto, null]`), `tipos.ts` (`pi?:`) y `ejemplos.ts`. También a `tools/web_datos/validacion.py` (el validador de apoyo que usan las pruebas de la estación): `Campo.opcional` y `pi` opcional y anulable; sin eso rechazaba el campo nuevo.
- Los nombres de los estados y motivos de la Pi se replican en `web1.py` (`PI_ESTADOS`, `PI_MOTIVOS`) y una prueba los compara con `visionpack/demeter_protocol.py` y con `dashboard.py`.

## Evidencia
- Pruebas de la estación (`python -m unittest discover -s estacion/pruebas`, con el intérprete que tiene `numpy`): ver el resultado en el PR y abajo.
- Pruebas nuevas (`estacion/pruebas/test_web1.py`): `AlturaDeMision` (quieto en TIERRA ≈ 0 m tras 60 s con ruido; sigue al clima con τ = 60 s contra la fórmula; congelada al armar, en vuelo y en RECOVERY; desarme; una por cohete; EKF contra GNSS; apogeo de 669,3 m ± 3 m desde una rampa a 1500 m en el vuelo reproducido de la simulación de OpenRocket; tiempo restante sobre la rampa; la constante del sitio no cuenta), `ReferenciaPersistida` (sin ruta no escribe; guarda en TIERRA y al congelarse; reinicio con el cohete armado recupera; otra misión u otro cohete no la usan; vieja no se usa; respaldo; archivo roto), `Actuadores` (bits, todos los `StatusCode`, Hermes, `reanudado`, `temp_esp_c` nula) y `SaludPi` (Hermes, Demeter, el esquema con y sin `pi`, mal formado, nombres de visionpack).
- `test_fixture_web1.py`: el apogeo del fixture es 669,3 m ± 3 m, la referencia es 510,0 m en todo el vuelo y la Pi pasa por READY → ARMED → RECORDING → COMPLETE.
- `tools/web_datos/pruebas/test_validacion.py`: `salud.pi` opcional.
- Relay: `gui/relay/pruebas/test_salud_pi.py` (acepta con y sin `pi`, lo guarda en el snapshot, descarta uno mal formado) y `cd gui/relay && python -m pytest`: 128 pasan.
- Web: `npm ci && npm test && npm run build`: 552 pruebas pasan (1 omitida, preexistente); el build y la prueba de aislamiento pasan.
- **Fixtures regenerados** (`python estacion/fixtures/regenerar.py`): `web1.jsonl` y `web1_snapshot.json`. Cambia solo `salud` (campo `pi`) y `act.cam_ok` de `estado`. Para eso el generador de pruebas ganó `actuators` (un valor o una función) y `alt_base_m`; el fixture usa `actuators_demeter` (Pi sana). La altura del fixture no cambia (la rampa está a 510 m y la referencia sale 510,0 m).

## Decisiones tomadas o propuestas
- Elecciones dentro de D-064/D-065 que el documentador puede querer registrar (todas **(P)**): `REF_GUARDAR_S = 10 s`, `REF_VIGENCIA_S = 12 h`, el respaldo sin referencia, que las fuentes EKF y GNSS no se mezclan, y que `salud.pi.motivo` use `"OTRO"` para un código sin nombre.

### Propuestas de cambio a contratos
1. `docs/04_diseno/protocolo_paquetes.md` §6, fila `pos.alt_agl_m`: dice `alt_msl_m − SITIO_ALT_MSL`. Con D-064 pasa a ser `alt_msl_m − referencia` (la referencia por cohete que sigue al clima en TIERRA y se congela al armar). Y la fila `act.*` ("todo en `false` hasta que existan") ya no es cierta. No lo toqué: es del documentador.
2. `docs/08_gui/05_contrato_datos_web.md`: agregar `salud.pi` (opcional) con la forma de D-065.

## Problemas y cómo se resolvieron
- El validador de apoyo `tools/web_datos/validacion.py` exige **todos** los campos y rechazaba `pi`; no estaba en la lista de archivos de la tarea, pero las pruebas de la estación lo usan. Se le agregó un campo `opcional` (mínimo y con prueba).
- `test_elipse_en_descent` daba 122 m en vez de 120 m: mandaba un solo paquete en vuelo sin TIERRA antes y dependía de la constante del sitio (510). Ahora la prueba manda antes un paquete en la rampa, como pasa en la realidad. Es el único test existente que cambió su entrada.
- Los dos errores de `estacion/pruebas` (`test_calib`, `test_vuelos_replay`) con el Python del sistema son por falta de `numpy`; con el intérprete del repo principal que lo trae corren.

## Pendiente / siguiente paso
- **Orden de integración:** después del merge, **redesplegar el relay** (su imagen trae `esquema.json`) y solo después reiniciar el dashboard con el `web1.py` nuevo. Al revés, el relay viejo rechazaría `salud.pi` (`additionalProperties: false`).
- **Límite de la altura (D-064):** sigue siendo la altura del EKF (que fusiona el barómetro), no la `s_alt` de misión. Al armar, el firmware rehace el reposo (sesgos, `p0`, actitud, temperatura del suelo) y la altitud del EKF puede cambiar unos metros justo en la transición: la referencia se congela en el primer paquete ARMED, tal como pide D-064. Si en el ensayo se ve un escalón de unos metros al armar, es eso.
- **Reinicio del dashboard con el cohete ya en vuelo y sin archivo** (por ejemplo, si se borra `estacion/web1_referencia.json` o el reinicio pasa a más de 12 h): la altura sale del respaldo (altitud de la estación), con error de unos metros. Para evitarlo: no borrar el archivo y arrancar el dashboard en vivo antes de armar.
- La referencia por EKF y la del GNSS pueden diferir; si el EKF se cae en pleno vuelo, las muestras GNSS se miden contra una referencia del EKF (un escalón posible). Con el EKF funcionando, no ocurre.
- `salud.temp_esp_c` y `salud.pi.bat_pct`, `salud.temp_pi_c`: siguen `null` (no viajan en el TELEM).
- Después del vuelo: `alt_baro_m` en el TELEM (cambio de protocolo con Pablo), la batería y temperatura de la Pi por la UART.
- Falta verificar de punta a punta con un cohete en tierra (el redespliegue del relay lo hace el humano).

## Documentos afectados
- Código: `estacion/web1.py`, `estacion/dashboard.py` (una línea en `main`), `estacion/README.md`, `.gitignore`, `tools/web_datos/validacion.py`, `gui/web/src/contrato/{esquema.json,tipos.ts,ejemplos.ts}`.
- Pruebas: `estacion/pruebas/{test_web1.py,test_fixture_web1.py,generador.py}`, `tools/web_datos/pruebas/test_validacion.py`, `gui/relay/pruebas/test_salud_pi.py`, `gui/web/pruebas/contrato.test.ts`.
- Fixtures: `estacion/fixtures/{web1.jsonl,web1_snapshot.json,regenerar.py}`.
- Por actualizar por el documentador: `protocolo_paquetes.md` §6 y `05_contrato_datos_web.md` (propuestas de arriba), `backlog.md` (T-657) y la ficha de estado.
