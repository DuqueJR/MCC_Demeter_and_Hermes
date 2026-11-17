---
fecha: 2026-11-03
tipo: tarea
ids: [T-661, D-046, D-047, PEN-23, PEN-24]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-661-web1-dashboard
---
# T-661: módulo `estacion/web1.py` (líneas USB de la estación → mensajes `web-1`)

## Contexto
D-046 hace del dashboard de Pablo (ya en `estacion/`, T-660) la estación y el dashboard de operación, y le pide producir `web-1`. T-661 es la primera pieza: un traductor puro, sin E/S, que convierte lo que sale por USB de la estación de tierra (`@T`, `@L`, `@G`, `[cmd ]`, `[time]`) en los mensajes del contrato `web-1` (D-047: `proto_version: 4`). Lo integra con el servidor HTTP T-662.

## Qué se hizo
- **`estacion/web1.py`** (Python 3, solo biblioteca estándar, sin numpy). Clase `Traductor`:
  - `procesar(linea, t_local)` → lista de `{"tipo", "mision", "datos"}`; `tick(t_local)` (latidos a 1 Hz aunque no llegue nada); `comando(linea, t_local)` (enganche opcional: el comando que escribió el operador) y `snapshot(mision, t_local=None)`.
  - `meta`: al primer TELEM de cada misión y cuando cambia `mission_id` (esto reinicia la serie, los eventos y el LKP de esa misión). `mission_id = 0` (el valor de compilación de hoy) sale como `null`.
  - `estado`: por cada `@T` válido (largo, tipo 1 e ID 1 o 2; el CRC ya lo valida el módem y `--demo` de `dashboard.py` manda CRC en cero, por eso no se vuelve a verificar). Sigue protocolo §6 y maquina_estados §5.
  - `calc` (GS-02): distancia horizontal, azimut y elevación **en WGS84 exacto** (geodésicas → ECEF → ENU local en la estación), desde la última posición `[time] … pos(n)=` de la estación; `null` sin posición de la estación o del cohete.
  - Elipse (GS-10), **provisional (P)**, solo en DESCENT, con fix 3D y bajando más de 0,1 m/s: tiempo restante = `max(alt_agl, 0) / |vz|`; centro = posición + (`ve`, `vn`) × tiempo restante; semieje mayor (a lo largo de la deriva) = 30 % de la deriva, semieje menor = la mitad del mayor, ambos con mínimo de 20 m; rumbo = el de la deriva. Fuera de DESCENT, `null`.
  - `lkp`: la última `pos` con fix válido (`fix ≥ 2`). `alarmas.descenso_rapido`: solo en DESCENT con `vz < −ALARMA_DESCENSO_MS`; si se pierde el fix 3D en pleno descenso, la alarma **se mantiene** (no parpadea).
  - `enlace`: RSSI (entero) y SNR de la línea `@T`; `perdidos_pct_10s` = ranuras propias esperadas contra recibidas en una ventana de 10 s locales, copiando `gnd_rx.cpp:accept` (`abs = utc_ms/40`, `slotIsTx`, `MAX_GAP_SLOTS = 1500`, `TF_FLYING`). Con `utc_ms = 0` (baliza lenta) no cuenta ranura.
  - `salud` y `estacion` a 1 Hz. `salud` solo sale si hay algo nuevo del cohete desde la anterior; `estacion` sale **para las dos misiones** siempre (con `ultimo_paquete_hace_ms` propio de cada una), con la posición del texto `[time]` y `gnss_ok` de `@G`.
  - `go_nogo`: parsea `[cmd ] <Cohete>: NO APTO|APTO|EJECUTADO|ERROR …` y las líneas `  - <motivo>` (con los 21 textos de `reasonText`, comprobados contra `net_proto.h` en una prueba). Como la línea **no dice la orden**, la respuesta se atribuye a un ARM (a) con `comando()`, si el dashboard lo llama; (b) si no, por la respuesta: `APTO` solo lo produce el ARM, y un `NO APTO` en TIERRA con motivos del checklist de armar; (c) un `EJECUTADO` en ARMED tras un ARM pendiente. Sin ARM, `listo: false` con las condiciones que se ven en TELEM/LogInfo (fix 3D, batería ≥ 3700 mV, reserva al 100 %).
  - `evento`: cada cambio de `fase`, y por momento `despegue` (BOOST, fija T+ = 0), `fin_combustion` (COAST), `apogeo` (valor = altura máxima sobre el sitio), `eyeccion` (PARACAIDAS), `aterrizaje` (ATERRIZAJE o RECOVERY, una sola vez) y `alarma_descenso`. `t_mas_s` es `null` hasta el despegue. Un aborto o un reinicio (de BOOST…LANDED a BOOT/PREFLIGHT/ARMED) reinicia la referencia del despegue.
  - `snapshot`: `serie` en columnas; `t_mas_s` es `null` mientras no hay despegue y, después, relativo al despegue (negativo en la espera; regla D5 de la agenda H0). Se decima a `WEB_SERIE_MAX_PUNTOS`: todo el vuelo (BOOST…DESCENT) a plena resolución y la espera en tierra, parejo; si el vuelo solo ya no cabe, parejo en todo. `backfill` y `vuelo_completo_url` en `null`.
  - Las constantes van en un bloque al principio, con los nombres de `constantes.md`/`net_proto.h`; los parámetros propios (elipse, ventana de 10 s, etc.) están aparte y marcados (P).
- **CLI de reproceso:** `python estacion/web1.py <sesion_tierra.txt> [--salida web1.jsonl] [--snapshot snap.json] [--modo vivo|simulacion|sintetico]`. Lee las líneas tal como las guarda `dashboard.py` (`<epoch con 3 decimales> <línea>`) y escribe un JSONL de `{"tipo","mision","datos"}` (el formato del cuerpo de `POST /api/v1/ingesta`); imprime el conteo por misión y tipo.
- **Pruebas** en `estacion/pruebas/` (unittest): `generador.py` (líneas `@T/@L/@G/[time]` con `struct` desde la sim. de OpenRocket de Demeter, con el TDMA de `slotIsTx`, 2 Hz en tierra y 10 Hz en vuelo, y huecos o pérdida de fix a pedido), `esquema_minimo.py` (validador del subconjunto de JSON Schema que usa `esquema.json`), `contrato.py` y `test_web1.py`.
- **No se tocó** `firmware/`, `gui/`, `tools/`, ni los contratos. No se integró con el servidor HTTP de `dashboard.py`: el enganche es la API de `Traductor` (documentada en la cabecera de `web1.py`); T-662 lo llama desde `ground_line()`.

## Evidencia
- `python -m unittest discover -s estacion/pruebas` → **74 pruebas, OK, 3,2 s** (Python 3.13, solo biblioteca estándar).
- Sondeo de mutación: cambiar el umbral de alarma a 9,0 y una ranura del TDMA hace fallar 6 pruebas; con el original, vuelven a pasar las 74.
- Vuelo completo de la sim. de Demeter (30 s de espera + 85 s de vuelo + 15 s de aterrizada): 941 `estado`, 131 `salud`, 131 `estacion` por misión, 12 `evento`, 1 `meta`; todos validan contra `esquema.json` y contra `tools/web_datos/validacion.py` (con las normalizaciones de abajo). El snapshot valida y trae la serie de 941 puntos con las 8 columnas del mismo largo, `t_mas_s` negativo en la espera, 0,0 en el despegue y el apogeo de 669,3 m ± 3 m.
- Eventos de ese vuelo (T+): `despegue` 0,0 · `fin_combustion` 2,08 · `apogeo` 11,6 (sim.: 11,54) · `eyeccion` 12,0 · `aterrizaje` 85,48.
- CLI sobre una sesión generada (descenso acelerado ×1,5, un corte de 1 s del enlace en COAST y 10 s sin fix 3D en DESCENT): **1021 mensajes** (686 `estado`, 106 `salud`, 212 `estacion`, 16 `evento`, 1 `meta`), **0 con errores**, snapshots válidos. La alarma de descenso da exactamente `[activa, no activa]` aunque se pierda el fix.
- Distancia/azimut/elevación comparadas con una cuenta independiente (haversine; casos de 100 m N/E/S/O y 45°/90°): dentro de 0,25 m y 0,3°.
- `perdidos_pct_10s`: casos exactos (1 perdido de 3 esperados = 33,3 %; la ranura de otro cohete no cuenta; con `TF_FLYING` se esperan las 10 ranuras; un hueco de más de 1500 ranuras es reinicio; la pérdida sale de la ventana a los 10 s).

## Decisiones tomadas o propuestas
Decisiones de implementación (las propias de esta tarea; todas marcadas (P) donde son provisionales):
1. **Elipse GS-10:** provisional. Semieje mayor 30 % de la deriva, menor la mitad (`ELIPSE_TRANSV_FRAC = 0,5`, mi elección: la tarea fija el 30 % y el mínimo de 20 m, pero un círculo no tendría rumbo), mínimo 20 m. **Es una estimación lineal y debe sustituirse** cuando haya el modelo de viento/deriva; T-665 (GS-13) llenará `t_a_apogeo_s`, `t_restante_s`, `siguiente_fase` y `t_siguiente_fase_s`, que aquí quedan en `null`.
2. `pos.fuente` sigue la regla de 05 §2.2 (`"ekf"` si `flags.ekf_ok`, si no `"gnss"`); con el cuaternión en identidad (hoy) es siempre `"gnss"`, como pide protocolo §6.
3. `alt_agl_m = alt_msl − SITIO_ALT_MSL_M` (510 m), como dice protocolo §6. Si el lanzamiento fuera en otra altitud, la altura AGL saldría desplazada: `Traductor(sitio=(lat, lon, alt))` permite cambiarlo; propongo en el futuro tomar el origen de las primeras lecturas en ARMED.
4. `estado.rx_utc_ms` y `estacion.utc_ms` salen del reloj de la PC (`t_local`); `estado.t_ms` es `utc_ms` del paquete, o, con `utc_ms = 0`, el último `utc_ms` válido más el tiempo local transcurrido (o el reloj local si no hubo ninguno). `seq = utc_ms/40`; con `utc_ms = 0`, el contador local continúa desde el último `seq`.
5. `fin_combustion` (→ COAST) se emite aunque la lista de la tarea no lo nombraba: está en 05 §2.5 y cuesta nada.
6. `boot_count = 0`, `calib` todo en `false` y `fallas = []` con `fallas_bits = 0`: `net_proto` no trae esos datos, y el esquema no deja `null`. Ver propuesta 2.

**Propuestas de cambio a contratos (no aplicadas; las consolida el documentador):**
1. **`tools/web_datos/validacion.py` (T-612) es más estricto que `esquema.json` y que protocolo §6.** Las pruebas lo importan tal cual y le normalizan 5 puntos: `estado.relay_utc_ms` exige entero (05 §0: siempre `null` en el servicio local); `estado.seq` ≤ 255 (protocolo §6: `utc_ms/40`, ~4,4e10); `lkp` con `pos = null` es error (PA-22 existe justo para eso); `enlace.*` sin `null`; `salud.temp_esp_c`, `sd_libre_mb`, `apogeo_m` y `estacion.pos` sin `null`. **Propongo alinear `validacion.py` con el esquema** (tarea chica en `tools/`). Además, su cabecera dice que `esquema.json` "todavía no existe": desactualizada. Como `validacion.py` no lee `esquema.json`, las pruebas llevan su propio validador mínimo (`estacion/pruebas/esquema_minimo.py`, ~90 líneas, sin `jsonschema`); si el equipo prefiere agregar `jsonschema` como dependencia de pruebas, se sustituye.
2. **`web-1` `salud`: `boot_count` y `calib.*` obligatorios y sin `null`.** Con `net_proto` no hay dato: hoy salen `0` y `false`, que **mienten** (la web podría mostrar "sin calibrar"). Propongo hacerlos `null`-ables (campo opcional nuevo = compatible, 05 §0) o dejar `calib` como objeto `null`.
3. **TELEM trae `temp_c[0]` (BME280), pero protocolo §6 lo cita para `salud` sin dar el campo**: `temp_esp_c` es la temperatura del ESP y es `null`. No hay dónde ponerla; propongo `salud.temp_baro_c` (opcional) o ignorarla.
4. **El texto `[cmd ]` no trae la orden**, y `go_nogo` depende de saber que fue un ARM. Mientras tanto se atribuye como arriba (hay riesgo de falso positivo en un `NO APTO` desde TIERRA con motivos de armar que viniera de otra orden). **Pedirle a Pablo (PEN-23) el `@R <hex>` con el CmdResp crudo** (trae `op`, `result`, `reasons`) o que el texto incluya la orden. T-662 debe llamar `Traductor.comando()` con lo que escribe el operador.
5. `estacion.pos` hoy sale del texto `[time] … pos(n)=`; con `@E` de PEN-23 se cambia solo `_tiempo()`.
6. 05 §2.2 describe `seq` como el contador de la cabecera NAV; con `net_proto` es el índice de ranura (`utc_ms/40`, ~4,4e10, cabe en un `number` de JS). Propongo corregir esa fila de 05 (el esquema ya lo permite).

## Problemas y cómo se resolvieron
- `validacion.py` rechazaba mensajes válidos por el contrato (propuesta 1). Se compara con el esquema oficial y se normalizan esos puntos solo para correr sus comprobaciones de coherencia (decimales, fase/`fase_cod`, cuaternión unitario, `pos` frente a `gnss_fix`, campos de los eventos).
- Al cerrar la respuesta `[cmd ]` en el snapshot se perdían los motivos que llegaban después; ahora el snapshot lee la respuesta abierta sin cerrarla (hay prueba).
- Una pérdida del fix 3D en descenso apagaba y prendía la alarma; ahora se mantiene (hay prueba).
- La alarma y el LKP no tenían ningún dato de "señal perdida" que emitir (sin paquetes no hay `estado`): el LKP se conserva en el último `estado` y en el snapshot, y `estacion.ultimo_paquete_hace_ms` crece con `tick()` (hay prueba).
- Las estructuras `TELEM` y `LOGINFO` se repiten en `web1.py` en vez de importarlas de `dashboard.py`: T-662 hará que `dashboard.py` importe a `web1.py` y un import cruzado sería circular. Una prueba comprueba que son idénticas a las de `dashboard.py`.

## Pendiente / siguiente paso
- **T-662:** llamar a `Traductor.procesar()` desde `ground_line()` (con un candado: no es seguro entre hilos), `tick()` desde un temporizador, y `comando()` desde `/api/cmd`; servir `snapshot()` y el stream.
- No hay una sesión real de `sesiones/` en el repo: la prueba con datos reales de Pablo queda para cuando haya una (T-670). Las pruebas usan líneas generadas con el mismo formato.
- Sustituir la elipse y llenar los tiempos estimados (T-665); `@R`/`@E` de PEN-23; propuestas 1 a 6 de arriba.

## Documentos afectados
Ninguno de los contratos. `estacion/README.md` (fila de `web1.py` y cómo correr las pruebas).
