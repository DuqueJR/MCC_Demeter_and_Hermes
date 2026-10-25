---
fecha: 2026-10-25
tipo: tarea
ids: [T-614, D-W19]
autor: agente desarrollador (Sonnet)
rama: feature/T-614-probar-web-local
---
# T-614: probar la web en local con un solo comando

## Contexto
Juan Pablo (macOS) y Jerónimo (Windows) quieren ver los avances de la web desde la raíz del repo, sin acordarse de carpetas ni de si Python se llama `python` o `python3` (06 §6: sin bash).

## Qué se hizo
- `package.json` en la raíz (`private`, sin dependencias) con `web`, `web:instalar`, `web:build`, `web:test`, `web:e2e`, `web:preview`, `datos` y `datos:validar`. Los de la web delegan con `npm --prefix gui/web run …`.
- `npm run web` = `vite --open /dev/` (bandera de la CLI, **sin tocar `vite.config.ts`**: un `server.open` abriría el navegador también en el servidor del e2e, puerto 5174).
- `scripts/python.mjs`: prueba `python3`, `python` y `py -3`, usa el primero que responda y sea Python 3 (así se descarta el atajo vacío de la Tienda de Windows), y corre el comando con `cwd` en la raíz. Si no hay ninguno, explica cómo instalarlo.
- `gui/web/dev/index.html` + `index.css`: enlaces a `/`, `/demeter/`, `/hermes/` y `/dev/tokens.html`; los 12 JSONL con la línea de cada escenario (de `tools/web_datos/README.md`); la nota de T-630 y T-631. Solo tokens de `src/tema/`. No es entrada de Rollup, así que no entra al `dist/`.
- `gui/web/e2e/dev.spec.ts`: abre `/dev/` (servidor de desarrollo, 5174), comprueba los 4 enlaces, los 12 JSONL y que **cada enlace responde 200**; y comprueba que `dist/dev` no existe. (No se pidió por HTTP al preview porque `vite preview` devuelve 200 con el `index.html` para cualquier ruta; el sistema de archivos es la prueba fiable.)
- README de la raíz: sección "Probar la web en local"; `gui/web/README.md` apunta al atajo y a `/dev/`.

## Evidencia
- `npm run web:instalar`: 165 paquetes, 0 vulnerabilidades, Chromium instalado.
- `npm run web:build`: tsc, regla de colores, vite build y aislamiento en verde.
- `npm run web:e2e`: **23 passed** (incluye 2 nuevas de `dev.spec.ts`).
- `npm run web:test`: **12 failed | 62 passed (74)**. Las 12 son `pruebas/contrato.test.ts > JSONL de ejemplo de dev/datos/ > valida <misión>_<escenario>.jsonl`: la errata del contrato D-W19, que corrige otra rama. No se tocó.
- `npm run datos:validar` corre (Python 3.14.7) y no cambia los JSONL versionados.
- `npm run web` arranca Vite con `--open /dev/` (verificado con `BROWSER=none`).
- Captura 1440×900: `gui/web/e2e/capturas/dev-1440x900.png` (ignorada por git, se regenera con `npm run web:e2e`).

## Decisiones tomadas o propuestas
Ninguna que cambie contratos.

## Problemas y cómo se resolvió
- `python` frente a `python3`: ver `scripts/python.mjs` (arriba).
- Si el puerto 5173 está ocupado, Vite usa el siguiente y `--open` abre el correcto.

## Pendiente / siguiente paso
- Cuando T-630 y T-631 existan, la página de desarrollo debe enlazar el visor en vivo.
- No se probó en Windows (solo macOS); el diseño evita bash y rutas con `/` manuales.

## Documentos afectados
`README.md`, `gui/web/README.md`.
