---
fecha: 2026-10-25
tipo: tarea
ids: [T-631, D-W07, D-W18, PEN-W06]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-631-cliente-datos
---
# T-631: Cliente de datos de la web

## Contexto
La web necesitaba el cliente que habla con el relay (hoy, el repetidor de T-630): pedir el snapshot, abrir el SSE con reconexión y retroceso, aplicar cada mensaje a las signals de `api.ts`, calcular la edad del dato y `estadoPagina`, e interpolar para dibujar. Todo en `gui/web/src/datos/`, sin cambiar `web-1` ni el lado de lectura de `api.ts` (H0, A2 opción b). Base: `origin/develop` en `fc8188f`. Sesión web. Búsqueda: el grafo de graphify de la carpeta principal estaba disponible y se consultó una vez; el resto se leyó directo de los archivos que la tarea nombra.

## Qué se hizo

**Código nuevo en `gui/web/src/datos/`:**

| Archivo | Qué hace |
| --- | --- |
| `cliente.ts` | `iniciarCliente({mision, base?, entorno?})`: la sesión (stream, snapshot, búfer, reproducción), la reconexión, el silencio, la resincronización y el reloj local. Devuelve `{detener, reiniciarSesion, estadisticas}` |
| `sse.ts` | Analizador de `text/event-stream` por trozos (`\n`, `\r`, `\r\n` partido, comentarios, BOM). El `id` queda como texto opaco |
| `costura.ts` | Qué es "posterior al snapshot", por tipo de mensaje; `claveEvento` |
| `serie.ts` | `SerieViva`: la trayectoria crece con cada `estado` y se recorta al pasar de `WEB_SERIE_MAX_PUNTOS` |
| `interpolacion.ts` | `Interpolador` (`muestrear(ahoraLocalMs)`), `slerp`, `lineal`. Instancia compartida: `interpolador` |
| `parametros.ts` | Parámetros del cliente que `constantes.md` no tiene, todos `(P)` |
| `visor_dev.ts` | Solo desarrollo: el visor de `dev/en_vivo.html`. Ningún archivo de producción lo importa |

**`api.ts` (solo el lado de escritura):** `alimentar` gana un método por mensaje: `meta`, `estado`, `salud`, `estacion(e, llegadaLocalMs)`, `evento` (devuelve `false` si ya estaba, y no duplica), `backfill`, `serie` y `reiniciar`. Las signals de lectura no cambian (hay una prueba que lo verifica). `serieVacia` pasó a `serie.ts`.

**Fuera de `src/datos/` y `pruebas/`** (lo aviso porque el encargo pedía detenerse si hacía falta; era lo mínimo para probar en un navegador):
- `gui/web/dev/en_vivo.html`, el visor en vivo, y su enlace en `gui/web/dev/index.html` (la excepción del encargo).
- `gui/web/e2e/en_vivo.spec.ts`: la prueba en Chromium. Levanta el repetidor en el puerto del proxy de Vite.

**Cómo funciona una sesión** (05 §4):
1. Abre el stream (`Last-Event-ID` solo si ya vio un `id`).
2. Cuando llegan sus encabezados pide el snapshot. Lo que llegue entre tanto va a un búfer.
3. Aplica el snapshot y reproduce del búfer **solo lo posterior** a él. Desde ahí, vivo.
4. Si el stream cae, se queda mudo (2 latidos, `SSE_SILENCIO_MS`) o algo falla: `conexion = "reconectando"` (los datos se mantienen) y reintenta con retroceso 1, 2, 4, 8 s hasta `WEB_RECONEXION_MAX_S`, con jitter (50 % a 100 %). `Retry-After` es el piso de la espera (con tope de 60 s). Una sesión que duró 10 s o más reinicia el retroceso.

**Cuándo vuelve a pedir el snapshot con el stream abierto:**
- `backfill.completo` (05 §2.6);
- el `t_ms` del `estado` retrocede (otra vuelta, o el cohete se reinició). Si el servidor insiste 3 veces seguidas, acepta el retroceso como nueva base;
- llega un `meta` con otro `mission_id` distinto de `null`. Pasar de `null` a un valor (el ARM) no pide nada.

**Otras decisiones:**
- **La edad usa solo el reloj local monotónico, inyectado.** El cliente avanza `alimentar.reloj(...)` cada `RELOJ_TICK_MS` (100 ms). Hay una prueba que cambia la fecha del sistema (1970, 2099) a mitad de la corrida y la edad no se mueve.
- **`fetch` y no `EventSource`:** este no deja ver el 503 ni su `Retry-After`, y reconecta a su ritmo.
- **Una respuesta 200 que no sea `text/event-stream`** (el HTML de un proxy mal puesto) es un error, no un stream mudo.
- **Al volver a la pestaña** (`visibilitychange`) rehace la sesión sin esperar y sin mostrar "reconectando". En celulares `performance.now()` puede no avanzar con la pantalla apagada, y el stream puede haber muerto sin avisar.
- **Latido ya mostrado:** si una resincronización trae el mismo latido `estacion` (mismo `utc_ms`), se conserva su hora de llegada local. Re-estamparlo con la hora del snapshot lo haría parecer más fresco.
- **La serie viva** pone `t_mas_s = null` antes del despegue (el contrato no dice otra cosa) y T+ con 2 decimales después. Los puntos de tierra (BOOT, PREFLIGHT, ARMED, LANDED, ERROR) se decima primero al recortar; el vuelo se conserva entero.
- **Interpolación** (03 §5): lineal para lat, lon y altitud; *slerp* por el camino corto para `q`; retraso de presentación de 1 paquete (100 ms). El reloj del cohete se ata al local con el desfase mínimo reciente `llegada − t_ms`, así el jitter no hace retroceder el dibujo. No extrapola y no interpola a través de un hueco de más de 2 periodos de tierra. **No es una signal** (esa interfaz está congelada): la UI llama a `interpolador.muestrear(performance.now())` en su ciclo de dibujo.

## La costura entre el snapshot y el stream

**Estrategia (sin cambiar `web-1` y sin el `seq_relay` de la propuesta 5):** stream primero, búfer, snapshot, reproducir lo posterior.

**Qué es "posterior"** (`costura.ts`), con los campos que el contrato ya tiene:

| Mensaje | Criterio | Por qué ese |
| --- | --- | --- |
| `estado` | `t_ms` mayor que el del `estado` del snapshot | Es el reloj del cohete: crece sin saltos dentro de un vuelo. **`seq` no sirve:** es u8 y da la vuelta en 255 (protocolo §1) |
| `salud` | `t_ms` mayor que el de la `salud` del snapshot | El mismo reloj |
| `estacion` | `utc_ms` mayor que el del latido del snapshot | Es la hora de la estación; el latido no tiene reloj del cohete |
| `evento` | Que su clave (tipo + `t_ms` + `fase` + `activa`) no esté en `snapshot.eventos` | No se compara el tiempo: así un evento que cayó en el hueco, pero que el búfer sí alcanzó, no se pierde. Es también lo que impide duplicarlo en las reconexiones |
| `backfill` | `(completo, recibidos)` estrictamente mayor | Es un contador que solo avanza |
| `meta` | Siempre; luego `aplicarVivo` decide si es novedad, o el inicio de otro vuelo | |

**Por qué stream primero.** El snapshot se pide cuando ya llegaron los encabezados del stream, o sea con el cliente ya registrado en el servidor. Un mensaje `m` solo se pierde si no está en el snapshot (salió después de que se generó, `G`) **y** tampoco en el búfer (salió antes de que el servidor registrara el stream, `R`). Eso exige `G < t(m) < R`. Con el snapshot generado a la petición, `G > R` y la ventana es cero, sin importar el RTT. (Con "snapshot primero" la ventana sería el tiempo de abrir el stream.)

**Ventana de error que queda.** Solo existe si el snapshot sale de una **caché** que se llenó antes de `R`:
- 04 §4 dice que el snapshot es "cacheable 1 s". Entonces `G` puede ser hasta 1 s anterior a `R` y los mensajes de ese segundo no están ni en el snapshot ni en el búfer.
- **Lo que se pierde:**
  - `estado`, `salud` y `estacion`: nada importante. Son "gana el último", y el siguiente llega en menos de 1 s (9 Hz en vuelo, 1 Hz en tierra). Sí faltan hasta ~9 puntos en la `serie` del vuelo.
  - **`evento`: sí es un hueco real.** Un `despegue` o `apogeo` emitido en esa franja no aparece en la línea de fases hasta el siguiente snapshot (que solo se pide con backfill completo, un retroceso o una reconexión).
- **Lo que se hace para reducirla:** el cliente manda `cache: "no-store"` (no usa la caché del navegador) y suma el encabezado `Age`, si el relay lo manda, a la edad del snapshot. **No hay un segundo snapshot de conciliación**: el `Age` solo sirve para la edad, y no sé si el relay de T-640 lo enviará.
- **Otro error pequeño: la edad en la primera carga.** El latido del snapshot (`estacion`) puede tener hasta un periodo (1 s) de antigüedad, pero se estampa con la hora de la petición menos el `Age`. Por eso, en la primera carga, la edad se subestima hasta 1 s, hasta que llega el siguiente latido (menos de 1 s). Está probado que las resincronizaciones no lo empeoran.

**Para H0, sobre el cursor (propuesta 5):** no hace falta para la corrección del estado, pero sí es la forma exacta de cerrar el hueco de los eventos. Las dos salidas que veo:
- **(a) `seq_relay` en el snapshot.** El cliente abriría el stream **después** con `Last-Event-ID = seq_relay`, sin búfer ni criterios por tipo. El `id` seguiría siendo opaco. Cierra la ventana del todo. Es un campo opcional compatible y el cliente actual seguiría funcionando sin él.
- **(b) Sin cambio de contrato:** que el relay de T-640 genere el snapshot **sin caché de tiempo**. La caché se invalidaría con cada mensaje nuevo. Con eso `G > R` siempre y la ventana desaparece. Cuesta más CPU con 500 clientes entrando al despegue, aunque el snapshot ya estaría armado en memoria.

## Evidencia

**Pruebas (Node v22.22.0, Windows 11):**
- `npm test`: **210 pasaron, 0 fallaron** (113 de antes y 97 nuevas). Por archivo:

| Archivo | Pruebas | Qué cubre |
| --- | --- | --- |
| `cliente.test.ts` | 46 | Costura con el snapshot demorado, cursor opaco, retroceso 1-2-4-8-15, `Retry-After`, silencio, búfer, resincronizaciones, umbrales de `estadoPagina` al milisegundo, `Age`, fecha del sistema, `detener`, visibilidad |
| `escenarios.test.ts` | 15 | Los **6 escenarios de cada misión** contra el repetidor real (HTTP por un puerto local), más 3 casos de la consolidación de T-630 |
| `interpolacion.test.ts` | 15 | 0, 22,5, 45 y 90 grados; norma 1; camino corto; jitter; hueco |
| `serie_y_costura.test.ts` | 14 | La serie viva, el recorte y el criterio de "posterior" |
| `sse.test.ts` | 7 | Trozos de 1 a 50 caracteres |

- `escenarios.test.ts` compara el cliente con un **oráculo** en cada paso (500 ms de reloj falso, 2 s en `espera_rampa`): el mismo JSONL leído aparte, sin HTTP ni costura. Se comparan `estado`, `salud`, el latido, los `eventos`, los puntos de la `serie`, la **edad** y `estadoPagina` completo. Que coincidan en todos los pasos es lo que prueba que los estados cambian en los tiempos de los umbrales `WEB_*` y que la reconexión no duplica.
- **Verificación de que las pruebas muerden:** cambié a mano `alimentar.estacion(..., llegadaMs - 1)` y fallaron 11 de 15; quité la resincronización del backfill y fallaron las 2 de backfill; quité el filtro de la costura y falló la de la costura; quité el chequeo de `resp.ok` del snapshot y falló la del 503 del snapshot. Todo restaurado.
- `relay_caido` (ambas misiones): "reconectando" y `sin_servidor` durante el hueco, datos conservados, primera espera 750 ms y las siguientes de al menos 5 s (el `Retry-After` del repetidor), vuelve a "conectado", sin eventos ni puntos repetidos.
- Vuelta del bucle: el cliente se resincroniza (`resincronizaciones ≥ 1`), sigue en una sola sesión y no mezcla vueltas (sin `aterrizaje` en la segunda).
- `npm run lint`: sin errores; 3 avisos que ya existían (`estado_pagina.ts` y 2 de `comun.css`).
- `tsc --noEmit` y `npm run build` (con la prueba de aislamiento): OK. El cliente no entra al `dist/` (nadie lo importa todavía).
- **`npm run e2e`: 54 pasaron** (51 de antes y 3 nuevas).

**En un navegador de verdad** (primera vez; Chromium de Playwright, Vite en `:5174`, proxy `/api` a `:8787`): `e2e/en_vivo.spec.ts`
- Deméter y Hermes, `nominal` a 20 veces la velocidad (~5 s): `conectado`, aviso `simulacion`, eventos en orden `despegue < apogeo < aterrizaje`, fase final `LANDED`, interpolación numérica y **cero errores** en la consola.
- `relay_caido` a 10 veces: el navegador pasa por `reconectando` y `sin_servidor`, mantiene los datos, espera el `Retry-After: 5` real, vuelve a `conectado` y termina con un solo `despegue` y un solo `aterrizaje`; `sesiones ≥ 2`.
- Aviso del proxy de Vite: `http proxy error: /api/v1/demeter/snapshot ECONNRESET` al cerrar el repetidor entre pruebas. Es el cierre de conexiones del repetidor con la página aún abierta; no afecta.

**Commits** (rama `feature/T-631-cliente-datos`, sobre `fc8188f`):
- `9e4efed` analizador de SSE y parámetros
- `2fbbf3c` interpolación
- `796eb24` serie viva, criterio de la costura y `alimentar` por mensaje
- `583d6ce` cliente de datos
- `07fb126` visor en vivo y prueba en un navegador

## Decisiones tomadas o propuestas
Ninguna cambia un contrato. Para que el documentador las consolide:

1. **Cursor del snapshot (propuesta 5 de T-630):** ver arriba. La recomendación mía es (a) si se quiere cerrar el hueco de los eventos sin condiciones sobre el relay, o (b) si T-640 puede generar el snapshot sin caché de tiempo. La web actual funciona con cualquiera de las dos.
2. **El `meta` de bienvenida sin `id`** (propuesta 4): el cliente ya lo trata así (no mueve el cursor). Falta escribir la excepción en 05 §1.
3. **CORS del relay real (T-640), si la web se sirve de otro origen que el API:** permitir el encabezado `Last-Event-ID` y **exponer `Retry-After` y `Age`** (`Access-Control-Expose-Headers`). Sin eso el navegador no deja leerlos y el cliente cae al retroceso base. El repetidor de T-630 permite `Last-Event-ID` pero no expone `Retry-After` ni `Age` (con el proxy de Vite es mismo origen y no importa). El relay debería responder con `Age` si cachea el snapshot.
4. **Latido de la estación que deja de llegar** (05 §2.4: "es problema del relay o del internet"): hoy la edad crece desde el último latido y la página pasa a `senal_debil` y `sin_senal`, como si fuera el cohete. Con el stream vivo (hay `: ping` cada 15 s) y sin latidos, la causa probable es el relay o la estación, no el cohete. Propongo que 03 §4 diga qué estado se muestra (por ejemplo `sin_servidor` si no llega un latido en N segundos). No lo implementé: sería un estado que 03 §4 no define.
5. **`serie.t_mas_s` antes del despegue** (propuesta 7): el cliente pone `null`; el snapshot del repetidor pone valores negativos después del despegue. Si el back hace lo mismo que el repetidor, la serie cambia de forma al recargar la página. Hay que fijarlo en 05 §3 (y T-633 lo necesita).
6. **Parámetros nuevos `(P)` en `src/datos/parametros.ts`** que conviene llevar a `constantes.md` §9 si se quieren como umbrales de producto: `RECONEXION_BASE_S` (1), `RECONEXION_FACTOR` (2), `RECONEXION_JITTER_MIN` (0,5), `RETRY_AFTER_MAX_S` (60), `SESION_ESTABLE_S` (10), `SSE_SILENCIO_LATIDOS` (2), `SNAPSHOT_TIMEOUT_S` (10), `BUFFER_MAX_MENSAJES` (10 000), `RESYNC_MAX_SEGUIDOS` (3), `RELOJ_TICK_MS` (100), `SERIE_RECORTE_FRACCION` (0,75), `INTERP_RETRASO_MS` (100, de 03 §5), `INTERP_HUECO_PERIODOS` (2), `INTERP_HISTORIAL` (8) y `SLERP_UMBRAL_LINEAL` (0,9995).
7. **`Retry-After` en forma de fecha HTTP** no se interpreta (se usa el retroceso base). Con segundos enteros, que es lo que manda el repetidor, funciona.

## Problemas y cómo se resolvieron
- **El analizador de SSE retrasaba un evento** si el trozo terminaba justo en un `\r`: esperaba el siguiente byte por si era `\r\n`. Lo encontró mi propia prueba. Ahora el `\r` cierra la línea y se recuerda que, si el trozo siguiente empieza con `\n`, se descarta.
- **La primera comparación con el oráculo falló en la edad** por 64 ms. El último paso de la vuelta caía fuera de los ticks de 100 ms del reloj del cliente, así que `edad` iba atrasada hasta el tick siguiente. No era un error del cliente: la edad se mueve en pasos de `RELOJ_TICK_MS`. Se alineó el último paso de la prueba.
- **Una secuencia de edición mía convirtió `api.ts` a CRLF** (Python en Windows). Lo revisé con `git diff --stat` y lo devolví a LF antes del primer commit. El `.gitattributes` fija `eol=lf`.
- **TypeScript no ve que `modo` cambia dentro de una función llamada** (estrechaba el tipo después de asignarlo). Se agregó `sincronizando()`.
- **`npm run e2e` regenera las capturas de `docs/07_bitacora/capturas/`** de T-620 y T-622 (cambian bytes aunque la imagen sea la misma). Las revertí con `git checkout`; no van en este PR.

## Pendiente / siguiente paso
- **Conectar el cliente a las páginas:** `gui/web/src/entradas/demeter.tsx` y `hermes.tsx` deben llamar a `iniciarCliente({ mision: "demeter" })` (o `"hermes"`). Es de T-622/E y no lo toqué. Ojo: `?ejemplo` (`ejemplo_dev.ts`) también escribe en las signals; con el cliente andando se pisarían, así que conviene que el ejemplo desactive el cliente (`iniciarCliente` solo si no hay `?ejemplo`).
- **T-624 a T-626, T-633 y T-634** ya pueden leer las signals. Para dibujar con fluidez usan `interpolador.muestrear(performance.now())`, no las signals.
- **A decidir en H0:** el cursor (punto 1), la excepción del `meta` sin `id`, el latido que deja de llegar (4), `t_mas_s` antes del despegue (5) y la propuesta 3 de T-630 (el backfill completo) antes de T-633.
- **Sin probar:**
  - macOS y Node anterior a 22.18;
  - Safari/iOS y Firefox (el e2e solo corre Chromium). El cliente usa `fetch` con `ReadableStream`, que ambos tienen;
  - un celular real o la red móvil. La pausa de `performance.now()` con la pantalla apagada es una suposición (por eso se rehace la sesión en `visibilitychange`);
  - el relay real (T-640): solo se ha probado contra el repetidor y contra servidores falsos;
  - 500 clientes a la vez y la carga (T-643);
  - la suavidad de la interpolación a la velocidad real en pantalla: se probó en pruebas unitarias, no a simple vista, y el visor a `--velocidad ≠ 1` no la representa (el reloj del cohete y el local van a ritmos distintos).

## Documentos afectados
- Ninguno editado en `docs/` aparte de esta bitácora.
- Para consolidar: backlog (T-631), `docs/08_gui/05` §1 y §3 (propuestas 2 y 5), `docs/08_gui/03` §4 (propuesta 4), `docs/08_gui/04` §4 (CORS y `Age`, propuesta 3) y `constantes.md` §9 (propuesta 6).
