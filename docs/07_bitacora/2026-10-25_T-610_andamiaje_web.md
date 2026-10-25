---
fecha: 2026-10-25
tipo: tarea
ids: [T-610, D-W01, D-W05]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-610-andamiaje-web
---
# T-610: andamiaje de gui/web/

## Contexto
Primera tarea de W0 de la web. Deja el proyecto Vite listo para que E y D trabajen en paralelo, con `package.json` congelado y la prueba de aislamiento (D-W01) en su sitio.

## Qué se hizo
- `gui/web/` con Vite multipágina (`/`, `/demeter/`, `/hermes/`), TypeScript estricto, Preact y signals. Páginas placeholder mínimas: sin tokens, tema, contratos ni contenido.
- Todas las dependencias del stack de 04 §2 (versiones mínimas del `package.json`, fijadas por el lock):
  - ejecución: preact 11.0.2, @preact/signals 2.11.3, maplibre-gl 6.16.0, pmtiles 4.5.0, uplot 1.6.32, uqr 0.1.3, lucide-preact 1.61.0;
  - desarrollo: ajv 8.20.0, ajv-formats 3.0.1, vite 8.3.5, @preact/preset-vite 2.10.6, typescript 7.0.2, @biomejs/biome 2.6.3, vitest 5.0.5, @playwright/test 1.64.1, vite-imagetools 12.0.1, @types/node 26.6.5.
- Proxy `/api` → `http://localhost:8787` en `dev` y `preview`.
- `scripts/aislamiento.mjs`: parte de `dist/demeter/index.html` (o hermes), sigue referencias a JS, CSS y recursos, y falla si alcanza un archivo de la otra misión por nombre/ruta o si el contenido nombra `assets/<otra>/`, `<otra>.css`, `entradas/<otra>` o `<otra>-<hash>.<ext>`. Los enlaces `<a>` entre páginas no cuentan. Corre dentro de `npm run build` y en Vitest.
- Humo de Playwright: 3 páginas × 390×844 y 1440×900; verifica 200, título, h1 visible, sin errores de consola ni desborde horizontal; guarda capturas en `e2e/capturas/` (ignoradas).
- Scripts solo con npm y Node. `vite-imagetools` configurado.

## Evidencia
- `npm run build`: `tsc` limpio, 12 módulos, 3 HTML + 3 JS (demeter 0,24 kB, hermes 0,24 kB, runtime compartido 21,3 kB / 8,4 kB gz). "Aislamiento OK".
- `npm test`: 1 archivo, 7 pruebas en verde (6 con dist falso: limpio pasa; falla con imagen de `assets/hermes/` en Deméter, con `hermes.css`, con chunk de Deméter importado de forma transitiva desde Hermes, al revés con `assets/demeter/`, y si falta una página; más 1 sobre un build real).
- `npm run e2e`: 6 de 6 en verde (~1 s).
- Caso falso a mano: copia del `dist/` real con `<link href="/assets/hermes.css">` en `demeter/index.html` → `node scripts/aislamiento.mjs` imprime "AISLAMIENTO ROTO ... demeter/index.html: referencia a hermes" y sale con código 1.
- Proxy: servidor falso en :8787 y `vite` en :5199; `curl /api/v1/demeter/snapshot` devolvió la respuesta del falso.
- vite-imagetools: un PNG temporal (no commiteado) con `?format=avif;webp&w=256;512` generó 2 AVIF y 2 WebP en el build.
- Biome: `check` limpio y la regla `noDebugger` se activa (comprobado con un archivo temporal).

## Decisiones tomadas o propuestas
- Sin cambios a contratos.
- Propuestas / preguntas abiertas (no decididas aquí):
  1. **RESUELTA (ajuste del usuario):** `ajv` y `ajv-formats` quedan como devDependencies; el validador lo escribe T-611. Pregunta original, Ajv u otro validador JSON Schema: T-611 pide "un validador en las pruebas" y 04 §2 no lista ninguno. No lo instalé para no inventar; habría que añadirlo en un PR pequeño de `package.json` o aceptar que T-611 lo agregue.
  2. **Estilos de mapa / Protomaps:** 04 §2 nombra "Protomaps" pero no un paquete (p. ej. `protomaps-themes-base`). Tampoco se instaló; lo decide T-632.
  3. **RESUELTA (ajuste del usuario):** se usa `lucide-preact`. Pregunta original, íconos: 04 §2 dice `lucide`; instalé el paquete `lucide` (vanilla). Con Preact podría preferirse `lucide-preact`; confirmar.
  4. **QR:** el doc admite `uqr` o `qrcode-generator`; elegí `uqr`.
  5. **Versiones mayores recientes** (Preact 11, TypeScript 7, Vite 8, Vitest 5, Biome 2.6): instaladas tal como las resolvió npm hoy. Todo compila y prueba, pero los "4 KB" de Preact que cita el doc no se verificaron con v11 (el runtime compartido pesa 8,4 kB gz).
  6. **`base` de Vite = `/`:** supone despliegue en la raíz del dominio (CDN propio). Si PEN-W05 elige un subpath (p. ej. GitHub Pages de proyecto) habrá que fijarlo.
  7. **Chromium de Playwright** hay que bajarlo una vez por máquina (`npm run e2e:instalar`); no se hizo postinstall para no sorprender a CI.
  8. El hook/`SESION=web` no se evaluó aquí; no hubo bloqueo al escribir en `gui/`.
- Nota de proceso: la rama del worktree arrancó en un commit anterior a `docs/08_gui/`; la rama de la tarea se creó desde `origin/develop` (que sí lo tiene).

## Problemas y cómo se resolvieron
- `biome migrate` convirtió `recommended: true` en `preset: "none"` (desactiva reglas); lo corregí a `"recommended"` y verifiqué que lint detecta errores.
- La prueba importa un `.mjs` sin tipos: `@ts-expect-error` en el import.

## Pendiente / siguiente paso
- T-611 (contratos) y T-613 (tema) pueden empezar. Los presupuestos de peso (04 §6) se medirán cuando haya contenido.
- No se hizo la medición de capturas para la bitácora (la tarea no es visual).

## Documentos afectados
Ninguno editado. A consolidar por el documentador: estado de T-610 en el backlog y las preguntas abiertas de arriba.

## Ajustes posteriores (aprobados por el usuario)
- `lucide` cambiado por `lucide-preact`; agregados `ajv` y `ajv-formats` (devDependencies).
- `engines.node` >=22 y `.nvmrc` con `22` (misma versión mayor en macOS y Windows).
- README con la sección "Primeros pasos" (todo desde `gui/web/`).
- Reverificado: `npm run build` OK (aislamiento OK), `npm test` 7/7, `npm run e2e` 6/6.
