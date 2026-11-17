---
fecha: 2026-11-06
tipo: tarea
ids: [T-636, T-635, T-642, D-W18, D-061]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-636-simulacion-visible
---
# T-636: botón de la simulación siempre visible mientras el relay no esté desplegado

## Contexto
T-635 (PR #82, ya en `develop`) muestra "Ver la simulación del vuelo" solo en el estado de página `sin_transmision`. Como el relay (`gui/relay`, Fly.io, D-061, T-642) aún no está desplegado, el sitio publicado se queda en `cargando` o `sin_servidor` y el botón no aparece. El usuario pidió ponerlo ya y quitarlo después, con un solo interruptor fácil de revertir. De paso, que el indicador de la barra diga "SIMULACIÓN" y no "EN VIVO" en verde cuando los datos son simulados (propuesta 1 de la bitácora de T-635).

La tarea se agregó al backlog (`docs/05_plan/backlog.md`, debajo de T-635) por pedido explícito del usuario, en la misma rama.

## Qué se hizo
- **Interruptor único:** `SIMULACION_SIEMPRE_VISIBLE` en `gui/web/src/datos/parametros.ts`, con el comentario "TEMPORAL: quitar cuando el relay esté en Fly". Hoy `true`. No es un valor de `constantes.md`; va en `parametros.ts` junto a los demás parámetros provisionales de la web.
- **Regla** (`src/simulacion/disponible.ts`):
  - `simulacionDisponible({ principal, hayDatoReal }, siempreVisible)` es pura y recibe el interruptor por argumento (por defecto, la constante), para probar sus dos valores.
  - `sin_transmision`: siempre, como en T-635.
  - `cargando` y `sin_servidor`: solo con el interruptor en `true` **y** si nunca llegó un dato real del cohete.
  - `en_vivo`, `senal_debil` y `sin_senal`: nunca (y por tanto nunca desde ARMED, D-W18).
  - "Dato real" (`hayDatoReal`, señal calculada): `estado`, `salud`, algún `evento`, un `backfill`, o un latido de la estación con `ultimo_paquete_hace_ms` distinto de null. Es el mismo criterio que `snapshotTieneDatoReal` de la compuerta de T-635. Un latido vacío de un relay sin cohete no cuenta.
  - `simulacionOfrecida` (señal) combina la regla con el estado de la página.
- **Botón:** `EstadoMision` usa `simulacionOfrecida` en vez de `sinTransmision`. Sigue dentro de la sección Estado y no se superpone con nada de la barra: el spinner de "Cargando" es el ícono del indicador de la barra fija. Hermes no pasa `simulacion`, así que no tiene botón.
- **Control** (`control.ts`): al terminar la descarga comprueba `simulacionOfrecida` en vez de `principal === "sin_transmision"` (si mientras bajaba llegó un dato real, no simula). Un ajuste: al salir de una simulación que empezó sin `meta` (cargando o sin servidor) se conserva el estado de la conexión; antes `alimentar.reiniciar()` la dejaba en "cargando".
- **Indicador** (`BarraMision.tsx`, `mision.css`): `indicadorDe(principal, simulacion)` devuelve "SIMULACIÓN" con clase `info` (token `--estado-info`) e ícono Info cuando `principal = en_vivo` y `simulacion = true`. El banner fijo y la marca SIM no cambian. Los demás estados (señal débil, sin señal…) no cambian aunque haya simulación.
- **No se tocó** web-1, el relay, `constantes.md` ni el guion. La simulación sigue siendo la de T-635.

### Cómo revertirlo cuando el relay esté en Fly (T-642)
1. Mínimo: poner `SIMULACION_SIEMPRE_VISIBLE = false` y reconstruir/desplegar (es una constante de compilación). Vuelve exacto a T-635.
2. Limpieza (opcional): borrar la constante y el parámetro `siempreVisible` de `disponible.ts`, y dejar `simulacionDisponible` como `principal === "sin_transmision"`. Las pruebas con `skipIf(SIMULACION_SIEMPRE_VISIBLE)` y `skipIf(!SIMULACION_SIEMPRE_VISIBLE)` y la e2e `sin relay` (que importa la constante) se adaptan solas con el valor; con la limpieza hay que quitarles el `skipIf`.
3. El cambio del indicador ("SIMULACIÓN") **no** es temporal: queda.

## Evidencia
- `tsc --noEmit`: sin errores. `npm run build` (tsc, colores, vite, aislamiento): OK ("Aislamiento OK", "Sin datos de ejemplo en el dist/ de producción").
- `vitest run`: **22 archivos, 477 pruebas en verde y 2 omitidas** (antes 460 + 1 omitida: 17 nuevas). Con el interruptor en `false`: 475 en verde y 4 omitidas (se omiten las que dependen de `true` y corre la de "interruptor apagado").
  - Nuevas, en `pruebas/simulacion_visible.test.ts`: la regla pura con los dos valores del interruptor y todos los estados; el botón con las signals reales (cargando, sin servidor, sin transmisión, latido vacío, estado/salud solos, en vivo/débil/sin señal); arrancar y salir en "Sin servidor" y en "Cargando" (vuelve al mismo estado); un dato real durante la descarga cancela. En `pruebas/mision.test.ts`: el indicador.
- `biome check` sobre `src`, `pruebas` y `e2e` (con `./node_modules/.bin/biome check`): 0 errores, 11 avisos que ya estaban (`!important` en `src/tema/comun.css` y similares).
- Playwright, suite completa (`playwright test`): **205 en verde y 18 omitidas** (las de relay real), 0 en rojo. Con el interruptor en `false` (build aparte): `simulacion.spec.ts` + `estado_telemetria.spec.ts`, 39 en verde y 1 omitida (la de "Cargando", que no aplica).
- e2e nuevas en `simulacion.spec.ts` (con `/api/**` en 404 por `page.route`, como un hosting estático sin relay):
  - Deméter a 390 y 1440 px: la página queda en "Sin servidor", sale el botón, la simulación corre (el guion se pide al pulsar), el indicador dice "SIMULACIÓN" y no "EN VIVO", llega a "En tierra" y al salir vuelve "Sin servidor" con el botón.
  - "Cargando" (el servidor no contesta): el botón sale y su caja no se cruza con el ícono del indicador.
  - Hermes sin relay: nunca hay botón ni se pide el guion.
  - Con datos reales (`?ejemplo=reconectando`, `en_vivo`, `senal_debil`, `sin_senal`): sin botón. `sin_transmision`: con botón.
- **Verificación contra `dist/` estático sin relay:** se sirvió `gui/web/dist/` con `python3 -m http.server` (`/api/**` da 404, como Cloudflare Pages sin el relay) y se corrió una prueba temporal de Playwright (no se versionó) en tiempo real a 390 px: la página queda en `sin_servidor` (se vio un 404 de `/api/`), el botón aparece, al pulsar sale el banner con "SIMULACIÓN" y la marca SIM, en unos 20 s pasa a "Subiendo por inercia" (T+ 00:02, 171 m), "Salir" vuelve a "Sin servidor" con el botón y `/hermes/` no tiene botón.
- Capturas en `docs/07_bitacora/capturas/T-636/`: `cargando-boton-390.png`, `sin-servidor-boton-{390,1440}.png`, `sin-servidor-vuelo-{390,1440}.png`, `estatico-sin-relay-boton-390.png`, `estatico-sin-relay-vuelo-390.png`.

## Decisiones tomadas o propuestas
Ninguna toca un contrato (web-1). Para el documentador:
1. **03 §4:** el indicador con simulación dice "SIMULACIÓN" (color de información), no "EN VIVO" verde. Es el cambio que proponía la bitácora de T-635 (propuesta 1); 03 §4 todavía dice lo contrario. Con esta rama, `mision.spec.ts` y `en_vivo.spec.ts` ya no lo exigen.
2. **03 §4, mientras dure el interruptor:** el botón de simulación sale también en "Cargando" y "Sin servidor" si nunca llegó un dato real. Marcar el texto como temporal hasta T-642.
3. **Backlog:** T-635 sigue "pendiente" en `backlog.md` aunque su PR (#82) ya está en `develop`; lo dejo al documentador. T-636 va "hecha" con este PR.
4. **Ubicación del botón:** sigue dentro de "Estado de la misión", debajo de la portada. En un celular se llega con un scroll largo (en la captura de "Cargando" hay que bajar). Si el público debe verlo al entrar, habría que subirlo a la portada o enlazarlo desde la barra; no se hizo porque no se pidió.

## Problemas y cómo se resolvieron
- Las e2e "sin relay" fallaban al correr todo junto: el `vite preview` (:4173) tiene un proxy de `/api` hacia :8787, donde `en_vivo.spec.ts` levanta un repetidor, y la página recibía datos reales. Se aisló con `page.route("**/api/**")` en 404 (equivale a un hosting estático sin relay).
- `biome check --write .` reformateó archivos de `gui/web/dev/prueba_carga/` (T-643), que no son de esta tarea: se restauraron con `git checkout` y no van en el PR. La suite completa de Playwright también reescribe las capturas de otras tareas (T-621 a T-635): se restauraron igual; las capturas de T-635 que muestran "EN VIVO" sobre la simulación quedan como estaban.
- **Fuera de alcance, ya en `develop`:** `./node_modules/.bin/biome check .` sobre todo el proyecto da **1 error** en `gui/web/dev/prueba_carga/main.mjs:337` (`noAssignInExpressions`, de T-643). No afecta a esta tarea; hay que corregirlo en otra.

## Pendiente / siguiente paso
- No se corrió `e2e/relay.spec.ts` con `RELAY_E2E=vivo` (necesita el relay Python real). Se cambió su aserción a "SIMULACIÓN" porque ese vuelo nominal va con `modo = simulacion`; sin probar.
- No se probó en un celular real (ni con la página en segundo plano) ni en Cloudflare Pages: solo Chromium de Playwright y un servidor estático local.
- El interruptor es de compilación: para quitarlo hay que reconstruir y desplegar el sitio.
- Cuando T-642 despliegue el relay: revertir según la sección de arriba y confirmar en el sitio publicado que "Sin transmisión todavía" mantiene el botón.

## Documentos afectados
`docs/08_gui/03_experiencia_y_pantallas.md` §4 (propuestas 1 y 2); `docs/05_plan/backlog.md` (T-636 agregada; estado de T-635). Código: `gui/web/` (ver el PR).
