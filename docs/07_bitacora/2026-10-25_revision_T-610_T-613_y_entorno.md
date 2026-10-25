---
fecha: 2026-10-25
tipo: sesion
ids: [T-610, T-611, T-612, T-613, T-642, D-W01, D-W17, D-035]
autor: Claude (documentador) con Juan Pablo
rama: docs/T-610-revision
---
# Revisión de T-610 y T-613, y entorno de desarrollo

## Contexto
Juan Pablo pidió: *"Implementa T-610. El plan está en `docs/08_gui/06_plan_web.md`."*
El Claude principal no escribe código, así que delegó la tarea al agente `desarrollador`, en su propio worktree. El agente abrió el **PR #4** hacia `develop`, sin merge, y escribió su propia entrada: [2026-10-25_T-610_andamiaje_web](2026-10-25_T-610_andamiaje_web.md).

## Qué se hizo

**Revisión del PR #4** (lectura de `package.json`, `vite.config.ts`, `biome.json` y `scripts/aislamiento.mjs`; las pruebas no se volvieron a correr):
- Cumple la fila de T-610:
  - Vite con 3 entradas;
  - el stack de 04 §2 completo;
  - el proxy `/api` → `:8787` en `dev` y `preview`;
  - la prueba de aislamiento al final del `build`, con un caso falso que la hace fallar;
  - el humo de Playwright a 390×844 y 1440×900.
- **No se salió del alcance:** no hay tokens, contratos ni `operacion/`, y la portada no carga JS.
- Según el agente, `npm run build`, `npm test` (7/7) y `npm run e2e` (6/6) pasan. **Solo en macOS:** Windows sigue sin probarse.

**Observaciones que no bloquean:**
1. **La prueba de aislamiento detecta por nombre** (`assets/<otra>/`, `<otra>.css`, `entradas/<otra>`, chunks `<otra>-*`). Cumple el criterio de 04 §3, pero no ve dos casos:
   - un chunk compartido que lleve contenido de la otra misión sin su nombre;
   - las fuentes de títulos, que se llaman por familia (02: cada página carga solo la suya).

   → Reforzarla en **T-613**, cuando entren las fuentes.
2. `engines` pedía `>=20`, y `import.meta.dirname` necesita 20.11. Quedó resuelto al fijar Node 22.

**Decisiones del usuario** ("me parecen bien tus recomendaciones"):
- **D-W17:** Ajv + `ajv-formats` como dependencias de desarrollo, para el validador de T-611, y `lucide-preact` en vez de `lucide`.
- El agente las aplicó en el mismo PR (`c9e0119`, `df3c4fe`), junto con `.nvmrc` = 22, `engines >=22` y una sección "Primeros pasos" en `gui/web/README.md`. Las pruebas siguen en verde.

**Problema de Juan Pablo con `npm run`:**
- **Causa:** estaba en `develop`, donde todavía no existe `gui/web/` (el PR #4 no está integrado), y en la raíz del repo no hay `package.json`.
- **Solución:** mientras el PR no se integre, correr desde el worktree del agente (`.claude/worktrees/agent-…/gui/web`), siempre desde `gui/web/`, con este orden:
  1. `npm ci`;
  2. `npm run e2e:instalar`, una vez por máquina;
  3. `build`, `test`, `e2e` y `dev`.

**¿Dockerizar? No para desarrollar (D-035):**
- **Lo que Docker daría ya está cubierto:** el lockfile, Node 22 fijo y los scripts sin bash ya dan entornos iguales en Windows y macOS.
- **Lo que Docker estorbaría:**
  - en Windows exige WSL2 y degrada el recargado en vivo de Vite;
  - el firmware y la estación necesitan USB y puerto serie, que no pasan bien a un contenedor en macOS.
- **Docker queda solo para desplegar el relay** (T-642).

**Merge del PR #4** (Juan Pablo, merge `75676c8`). El worktree del agente y sus ramas locales se borraron.

**Reparto de lo que sigue:** Jerónimo toma T-612 (área D, `tools/web_datos/`). Para Juan Pablo, el Claude principal lanzó T-613, que es del área E, no choca con T-612 y destraba T-620, T-622 y T-660 (S+).

**Revisión del PR #6 (T-613)** (lectura de los tres `.css` del tema contra 02; las pruebas no se volvieron a correr):
- **Los tokens coinciden exactamente con 02:**
  - los 14 de cada misión (§6);
  - los 5 de estado (§4);
  - los 2 de la EIA (§2.3);
  - la escala `--e-1` a `--e-8` y `--toque-min`.
- **Fuentes** WOFF2 latinas con su licencia OFL:
  - `/demeter/`: Marcellus + Inter, unos 63 KB;
  - `/hermes/`: Montserrat 800 + Inter, unos 67 KB;
  - las dos por debajo de 80 KB.
- **La prueba de aislamiento ya identifica las fuentes por su familia real** (lee la tabla `name` del WOFF2), aunque se renombre el archivo. Esto cierra la observación 1 de la revisión de T-610.
- La regla contra colores sueltos corre en el `build` y falla con su caso falso. Según el agente: 18/18 en `test` y 12/12 en `e2e`.
- **Las dudas del agente, resueltas con la recomendación del documentador**, que el usuario aceptó al integrar:
  - **Montserrat solo en 800:** cumple "700–800" de 02 §5 y respeta el presupuesto.
  - **Títulos:** las mayúsculas, el espaciado y el peso quedan como regla CSS en el tema de cada misión, no como tokens nuevos.
  - **El nombre interno "Montserrat Thin"** del WOFF2 se maneja con una comparación por prefijo.
- **Merge del PR #6** (Juan Pablo, merge `a9d9d30`). Los tokens eran "preguntar": Jerónimo los revisa en H0 y, si pide cambios, van en un PR aparte.

**Se lanzó T-611** (`web-1` en código, el esquema, `api.ts` y el validador con Ajv), desde `a9d9d30`. El PR sale para aprobarse en H0 junto con C-05. La validación de los JSONL de T-612 queda como una prueba que se salta mientras la carpeta de fixtures esté vacía.

**`.gitignore`:** se agrega `.claude/worktrees/`, para que nadie suba por error los worktrees de los agentes.

## Pendiente / siguiente paso
- Jerónimo prueba en Windows (`npm ci`, `npm test` y `npm run e2e`); falta comprobar que los scripts corren ahí.
- H0 (26 de octubre): aprobar y congelar `web-1` (el PR de T-611) junto con C-05; Jerónimo revisa los tokens de T-613 y `package.json`.
- Después de H0: T-620 (portada) y T-622 (armazón de la misión), en paralelo.
- **Preguntas abiertas que siguen en el PR:**
  - el paquete de estilos de Protomaps (T-632);
  - el `base` de Vite si PEN-W05 elige un subpath;
  - los tipos de los imports de `vite-imagetools` (T-621);
  - medir el peso real de Preact 11 contra los "4 KB" de 04 §2 (T-622).
- El entorno de Python (venv y versiones fijadas) se define al arrancar el relay o la estación.

## Documentos afectados
- [04_diseno/decisiones.md](../04_diseno/decisiones.md): D-035.
- [08_gui/00_README.md](../08_gui/00_README.md): D-W17.
- [08_gui/04_arquitectura_web.md](../08_gui/04_arquitectura_web.md) §2: `lucide-preact`, Ajv y la fila "Entorno".
- [07_bitacora/README.md](README.md): el índice, con las entradas de C-02/C-04, T-610, T-613 y esta.
- `.gitignore` (raíz): `.claude/worktrees/`.
