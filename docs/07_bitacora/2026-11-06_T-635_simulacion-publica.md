---
fecha: 2026-11-06
tipo: tarea
ids: [T-635, D-W18, PEN-07, PEN-W04]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-635-simulacion-publica
---
# T-635: simulación para el público antes del vuelo

## Contexto
Quien entra a `/demeter/` mientras no hay vuelo ve "Sin transmisión todavía" ([03 §4](../08_gui/03_experiencia_y_pantallas.md)). T-635 le da algo que ver: el botón "Ver la simulación del vuelo" reproduce en su navegador el escenario `nominal` de Deméter (OpenRocket, apogeo ~670 m), con el banner fijo "Simulación: así será el vuelo" y la marca SIM. Todo del lado del cliente: sin servidor nuevo y sin tocar el relay, para que funcione en Cloudflare Pages (estático).

La rama sale de `origin/feature/web-contenido-final` (PR #81), no de `develop`: ese PR toca los mismos archivos de `gui/web/src/mision/` y el contenido, y aún no está integrado. **El PR de T-635 depende de #81.**

## Qué se hizo
- **Guion liviano** (`gui/web/scripts/generar-simulacion.mjs`, `npm run simulacion:generar`): recorta y decima `dev/datos/demeter_nominal.jsonl` a `gui/web/src/assets/demeter/simulacion_nominal.json`. Estados de vuelo a ~3 Hz (en tierra, todos, que ya van a 1 Hz y siempre el primero de cada fase); `salud` uno de cada 10 o cuando cambia el Go/No-Go, la calibración o las fallas; todos los `meta`, `evento` y `estacion`; solo 10 s de cola tras el aterrizaje. Los mensajes siguen siendo de `web-1`. Determinista; `--comprobar` verifica. Se versiona solo el resultado.
- **Carga diferida:** `entradas/demeter.tsx` lo importa con `?url`. Vite lo saca como `dist/assets/simulacion_nominal-<hash>.json` y solo se descarga al pulsar el botón. No está en el paquete inicial ni lo referencia la página de Hermes.
- **Compuerta** (`src/datos/compuerta.ts`) y 3 `if` en `src/datos/cliente.ts`: mientras corre la simulación, el cliente real sigue conectado pero **no escribe en las signals** (su `meta` en modo vivo, sus latidos o el "reconectando" pisarían la simulación). Solo vigila si llega el primer dato real del cohete (`estado`, `salud`, `evento`, `backfill`, o un `estacion` con `ultimo_paquete_hace_ms` distinto de null; o un snapshot que traiga alguno). Con la compuerta cerrada, el cliente no cambia.
- **Reproductor** (`src/simulacion/reproductor.ts`): reloj local monotónico inyectable; aplica de una vez lo vencido si la pestaña estuvo en segundo plano; el primer estado y el primer latido se ponen de golpe (sin un parpadeo de "sin transmisión"); al terminar se queda en LANDED y repite el latido a 1 Hz (sin eso la edad del dato crecería y la simulación acabaría en "Sin señal").
- **Control** (`src/simulacion/control.ts`): inactiva, cargando, error, corriendo. Solo arranca si la página sigue en `sin_transmision` cuando termina la descarga. Salir o un dato real: detiene el reproductor, devuelve las signals a lo que había antes, cierra la compuerta y el cliente rehace su sesión (snapshot nuevo).
- **Interfaz:** `BotonSimulacion` en la sección Estado (solo si la misión pasa una `simulacion`; Hermes no la pasa), con la nota "No son datos reales", estado de carga y mensaje de error con reintento. "Salir de la simulación" va dentro del banner fijo (solo si la simulación es la local, no el modo demo de un servidor). El banner y la marca SIM ya salían de `meta.modo`; el guion trae `modo = "simulacion"` y `esGuion` rechaza cualquier `meta` que no lo sea.
- **No se tocó** web-1, ni el relay, ni `constantes.md`. No hay colores literales (`npm run colores` en verde); los estilos van en `src/simulacion/simulacion.css` con tokens.
- `biome.json` excluye el JSON generado (si no, `biome check --write` lo expande de 356 KB a 567 KB y la prueba de reproducibilidad falla).
- Se actualizó una e2e existente (`estado_telemetria.spec.ts`, "sin botón muerto"): ahora exige el botón en Deméter y su ausencia en Hermes.

## Evidencia
- Guion: **356 016 B** sin comprimir (presupuesto de la prueba: 400 KB), **30,4 KB con gzip** (informe de Vite) y ~16 KB con brotli. 285 `estado`, 113 `estacion`, 18 `salud`, 12 `evento`, 2 `meta`; dura 112,8 s (vuelo completo: apogeo 669,3 m a T+11,51 s, aterrizaje a T+85,05 s). No contiene la cadena "hermes".
- `tsc --noEmit`: sin errores. `biome check .`: sin errores (11 avisos que ya estaban: `!important` en `src/tema/comun.css` y similares).
- `vitest run`: **21 archivos, 460 pruebas en verde** y 1 omitida (32 son de `pruebas/simulacion.test.ts`).
- `npm run build` (con `colores.mjs` y `aislamiento.mjs`): "Aislamiento OK: /demeter/ y /hermes/ no se referencian entre sí". `grep` en `dist/`: `simulacion_nominal` aparece solo en `assets/demeter-*.js`.
- Playwright, suite completa: 195 en verde, 18 omitidas (relay) y 1 en rojo: la e2e "sin botón muerto" que T-635 vuelve obsoleta. Corregida; `estado_telemetria` + `simulacion` volvieron a correr: 31 en verde. No se volvió a correr la suite completa después de la corrección.
- e2e nuevas (`e2e/simulacion.spec.ts`, 6): Deméter a 390 y 1440 px (botón, banner, SIM, "Salir" fijos al bajar por la página, vuelo con el reloj adelantado, aterrizado sin pasar a "Sin señal", salir), Hermes sin botón; y contra el `dist/` con el repetidor como relay (en :8791, `/api/**` redirigido): el guion **no se pide al cargar**, se pide al pulsar, y el primer dato real (a los 8 s) corta la simulación y vuelve "EN VIVO" con la fase real. Salir con el botón vuelve a "Sin transmisión".
- Capturas en `docs/07_bitacora/capturas/T-635/` (botón, vuelo, aterrizado, y dist con corte por dato real).

## Decisiones tomadas o propuestas
Ninguna toca un contrato. Para el documentador:
1. **La barra dice "EN VIVO" en verde junto a SIM** durante la simulación: así lo pide 03 §4 (la simulación es un aviso sobre el estado principal) y lo exigen `mision.spec.ts` y `en_vivo.spec.ts`, que no se cambiaron. El banner y SIM están siempre, pero "EN VIVO" verde puede confundir. Propuesta: con `simulacion = true` y `principal = en_vivo`, mostrar "SIMULACIÓN" con el color de información en el indicador. Es un cambio de 03 §4, no se hizo.
2. **El botón solo sale en `sin_transmision`.** Si el relay no está desplegado o no responde (hoy, sin T-642), el estado es `cargando` o `sin_servidor` y el botón no aparece. Eso respeta la letra de 03 §4, pero antes del lanzamiento el público podría ver "Reconectando…" sin simulación. Decidir si el botón también debe salir en `sin_servidor` cuando nunca hubo un dato.
3. Documentar en 03 §4 el botón "Salir de la simulación" dentro del banner (pedido en esta tarea, no estaba en el texto) y en 04 §7 que el guion es una versión decimada del JSONL `nominal`.
4. Una simulación de Hermes exige su perfil (PEN-07, PEN-W04): `dev/datos/hermes_nominal.jsonl` es sintético (`modo = "sintetico"`) y no se usó, como se pidió.

## Problemas y cómo se resolvieron
- `biome check --write .` reformateaba el JSON generado y rompía la prueba de reproducibilidad: se excluyó en `biome.json`.
- `page.clock.runFor(120 s)` hacía que la e2e tardara más de 30 s (miles de temporizadores de la página con el mapa): se usó `fastForward`, que además prueba el caso de lo vencido en segundo plano en un navegador real.
- La suite completa de Playwright sobrescribe las capturas de otras tareas (T-621, T-622, T-624, T-625, T-632, T-633): se restauraron con `git checkout` y no están en este PR.
- En este entorno `npm run lint` y `npx biome` pasaban por un envoltorio que no es Biome: se corrió `./node_modules/.bin/biome check .` directamente (es lo que hace el script `lint`).

## Pendiente / siguiente paso
- Verificar en un celular real (Android e iPhone), con la página en segundo plano un rato, que al volver la simulación sigue donde debe.
- No se probó contra el relay real de `gui/relay/` (Python), solo contra el repetidor con un JSONL de relay vacío; el relay manda el mismo contrato.
- Cuando exista el PMTiles real, la simulación se verá sobre el mapa de la zona (hoy el área por defecto alrededor de `meta.sitio`).
- Si se cambia `dev/datos/demeter_nominal.jsonl` o el script, correr `npm run simulacion:generar` y subir el resultado.

## Documentos afectados
`docs/08_gui/03_experiencia_y_pantallas.md` §4 y `04_arquitectura_web.md` §7 (propuesta 3); backlog T-635 (estado). Código: `gui/web/` (ver el PR).
