---
fecha: 2026-11-05
tipo: tarea
ids: [T-644]
autor: desarrollador (Claude Sonnet)
rama: feature/T-644-pulido-celular
---
# T-644: pulido para el celular (Lighthouse móvil ≥ 90)

## Contexto
W3 pide Lighthouse móvil ≥ 90 en rendimiento y en accesibilidad en las 3 páginas (`/`, `/demeter/`, `/hermes/`) con el repetidor de desarrollo. Se midió el baseline, se corrigió lo que bajaba el score sin tocar `src/tema/` ni contratos, y se re-midió.

## Qué se hizo
- **Precarga de fuentes en las páginas de misión** (`gui/web/demeter/index.html` y `gui/web/hermes/index.html`): cada página precarga ahora `inter-latin-wght-normal.woff2` y su fuente de títulos (Marcellus en Deméter, Montserrat en Hermes) con `<link rel="preload" as="font" crossorigin>`, igual que ya hacía la portada desde T-621. Con `font-display: swap` (congelado en `src/tema/`), sin precarga el texto pinta con la fuente del sistema y se refluye al llegar la WOFF2; la precarga hace que la fuente esté lista para el primer pintado.
- **`<meta name="description">`** en las dos páginas de misión (la portada ya lo tenía).
- **Reserva de altura en la barra de misión** (`src/mision/mision.css`, `.barra-alt`): `min-height: calc(var(--t-num-sec) * 1.2)` para que "sin dato" ocupe lo mismo que "312 m"; sin esto la barra crecía ~5 px al llegar el primer dato y empujaba el contenido (un `main.panel` que se movía 35 px, incl. la aparición del banner "Simulación").
- **Capturas móviles** (390×844) de las 3 páginas en `docs/07_bitacora/capturas/T-644/`.

## Evidencia
- `npm run build`: OK (tsc, colores, vite, aislamiento: `/demeter/` y `/hermes/` sin referencias cruzadas; fuentes de 62,8 KB y 67,3 KB).
- `npm test`: 20 archivos, **428 pruebas OK** (1 omitida).
- `npm run e2e`: 189/190 OK con los puertos libres; el único fallo (`actitud.spec.ts:136`, "el horizonte sigue la muestra interpolada") es flaky y sensible al tiempo, pasa al repetir y no lo introduce esta tarea (se verificó con `git stash` y en aislamiento). El primer intento además falló por `EADDRINUSE` en `en_vivo.spec.ts` porque el repetidor de la sesión ocupaba `:8787`; se resolvió parándolo.
- Lighthouse móvil (Chromium de Playwright, `vite preview`, sin tocar `package.json`):

| Página | Rendimiento ANTES | Rendimiento DESPUÉS | Accesibilidad |
| --- | --- | --- | --- |
| Portada `/` | 99 | 99 (ver nota abajo) | 100 |
| Deméter `/demeter/` | 99 (1 corrida) | 100 / 69–73 (4 corridas) | 100 |
| Hermes `/hermes/` | 71 (1 corrida) | 100 / 68–71 (6 corridas) | 100 |

- La accesibilidad ya estaba en 100 en las tres y no bajó.
- **La varianza de rendimiento en las páginas de misión es el reordenamiento de Recuperación** (ver "Decisiones"): en las corridas sin ese evento el score es 100 (CLS 0, SI ~2 s); en las que lo capturan, CLS 0,536–0,677 y SI 5,5–11,8 s, con rendimiento 68–73.
- **Nota de la portada:** el baseline (T-621 y la primera medición de esta sesión) da 99. En re-mediciones posteriores de esta sesión salió 74–75 por un long task de ~1,4 s "Unattributable / Other" (decodificación AVIF, no JavaScript; la portada no tiene JS) que no aparecía en el baseline y que no toca ningún archivo de esta tarea: es estado de la máquina, no un cambio de código.

## Decisiones tomadas o propuestas
- **El score de la portada y de las misiones ya estaba en 99–100** en las corridas "limpias": los arreglos de arriba son mejoras reales (la precarga de fuentes replica T-621 y el primer pintado queda más rápido; la reserva de la barra quita un CLS de ~0,04) pero no mueven el número, que ya estaba en el tope.
- **Propuesta (03 §4, el reordenamiento de Recuperación):** el criterio "Aterrizado → la sección Recuperación sube al inicio" se implementa moviendo `<Recuperacion />` del final al principio de `<main>` (en el DOM, a propósito, para que el orden de lectura y del teclado coincida con lo visible). Ese movimiento es un CLS de ~0,5–0,7 (la sección mide ~500 px y empuja todo lo que está a la vista). **No lo cambié: quitar o suavizar el reordenamiento cambia el diseño (03 §4), que está fuera del alcance de esta tarea.** Además, en el día real el reordenamiento ocurre una sola vez, ~100 s después del despegue (fuera de la ventana de ~45 s que mide Lighthouse); la varianza se debe a que el repetidor hace un bucle y el aterrizaje cae a veces dentro de la ventana. Si se quiere un Lighthouse determinista ≥ 90 en las misiones, hay que decidir si (a) se acepta el CLS del reordenamiento como parte del diseño, o (b) se cambia a "Recuperación se resalta y se navega a ella" en vez de "sube al inicio".

## Problemas y cómo se resolvieron
- Lighthouse no tiene script `web:build` en este repo: el script es `npm run build` (el atajo `web:build` vive en el `package.json` de la raíz). Se usó `npm run build`.
- `npx lighthouse` escribe en `~/.npm`: se instaló Lighthouse 13.6.0 en un scratch `.lighthouse/` dentro del worktree (con su propio `package.json` para que npm no subiera al `package.json` de la raíz) y se usó su binario local con `CHROME_PATH` apuntando al Chromium de Playwright.
- El primer `npm install lighthouse` sin `package.json` en `.lighthouse/` subió y escribió `lighthouse` en el `package.json` de la raíz: se revirtió con `git checkout -- package.json` y se borró el `package-lock.json`/`node_modules` sobrantes.

## Pendiente / siguiente paso
- Decidir la propuesta del reordenamiento de Recuperación (arriba) si se quiere un Lighthouse determinista ≥ 90 en las misiones con el repetidor en bucle.
- T-645 (guía de operación) y el despliegue (T-642) no se tocaron.

## Documentos afectados
`08_gui/04` §6 (presupuestos: se confirma el método de Lighthouse y la precarga de fuentes en las misiones). Las capturas quedan en `docs/07_bitacora/capturas/T-644/`.
