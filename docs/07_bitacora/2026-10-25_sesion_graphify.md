---
fecha: 2026-10-25
tipo: sesion
ids: [D-036]
autor: Claude (documentador) con Juan Pablo
rama: docs/T-610-revision
---
# Instalación de graphify para la búsqueda de los agentes

## Contexto
Juan Pablo pidió instalar [graphify](https://github.com/Graphify-Labs/graphify) "para poder hacer más eficiente la búsqueda de los agentes sobre la información del repo a medida que crezca", revisarlo y dejarlo claro en `CLAUDE.md` y en el agente `desarrollador`.

## Revisión de la herramienta
- **Proyecto:** Apache-2.0, activo (último push el 2026-10-23). El paquete oficial de PyPI es `graphifyy`, con doble y. Se fijó la versión `0.9.95`.
- **Qué hace:** convierte el código (con tree-sitter, local y sin modelo) y los documentos (con el modelo del asistente) en `graphify-out/graph.json`. Se consulta con `graphify query`, `path` y `explain`. Cada relación lleva la marca `EXTRACTED` (leída) o `INFERRED` (deducida).
- **Privacidad:**
  - El código no sale de la máquina.
  - Los documentos van al modelo de la sesión de Claude Code.
  - Sin la skill, `graphify extract` elige un proveedor según la clave de API que encuentre en el entorno. **Hoy no hay ninguna definida** en la máquina de Juan Pablo.
  - No tiene telemetría. Las consultas quedan en `~/.cache/graphify-queries.log`.
- **Integración con Claude Code:**
  - `graphify install --project` instala la skill en `.claude/skills/graphify/` (unos 96 KB).
  - `graphify claude install` agrega una sección a `CLAUDE.md` y dos hooks `PreToolUse` en `.claude/settings.json`: `Bash|Grep` → `graphify hook-guard search`, y `Read|Glob` → `graphify hook-guard read`.
  - Los hooks tienen un *timeout* de 10 s y **no bloquean** si falta el grafo. No se activó el modo estricto, que bloquea la primera lectura.
- **Tamaño de lo que se indexa:**
  - `docs/` sin los datasheets ni el archivo pesa unos 770 KB, unos 200 000 tokens de texto. **La construcción real costó unos 850 000 tokens** (lo que suman los 6 subagentes, con sus instrucciones), cuatro veces lo estimado.
  - Los `.md` de los datasheets pesan 7,4 MB, unos 2 millones de tokens. Por eso **se excluyen**.

## Decisiones de configuración (D-036)
- **No se versiona `graphify-out/`.** Graphify sugiere commitearlo, pero el archivo se reescribe entero en cada actualización. Con dos personas y varios worktrees en paralelo, daría conflictos en cada PR. Cada uno lo construye localmente.
- **Worktrees:** el grafo vive en la carpeta principal. El agente `desarrollador` lo consulta con `--graph`, usando la ruta que obtiene de `git rev-parse --git-common-dir`. Nunca lo regenera.
- **`.graphifyignore`** deja fuera:
  - los datasheets;
  - `docs/99_archivo/` y `docs/fuentes/`;
  - `datos/` y las capturas;
  - el estado de Obsidian, los worktrees, `node_modules/` y `dist/`.
- **La sección "graphify" de `CLAUDE.md`** se reescribió en español con las reglas del proyecto:
  - el grafo no es fuente de verdad;
  - lo `INFERRED` se verifica en el archivo;
  - los datasheets siguen con ficha + grep;
  - la actualización solo se hace en la carpeta principal.

  **No hay que volver a correr `graphify claude install`**, porque sobrescribiría esa sección.
- **El hook es compartido** (`.claude/settings.json`), así que Jerónimo también debe instalar graphify. Si no lo hace, Claude Code le muestra un error en cada búsqueda. La instalación para Windows y macOS está en [flujo_trabajo](../05_plan/flujo_trabajo.md) §9.
- `graphify install` también creó `.claude/CLAUDE.md`, que solo apunta a la skill. Se dejó como lo generó la herramienta.

## Construcción del grafo (`/graphify .`, en la carpeta principal)
- **Corpus:** 131 archivos, unas 140 000 palabras.
  - 19 de código: 231 nodos por AST.
  - 112 documentos: 6 subagentes Sonnet en paralelo, todos leídos hasta la última línea.
  - Las licencias OFL se excluyeron después del primer conteo.
- **El filtro de archivos "sensibles"** dejó fuera `gui/web/dev/tokens.css` y `tokens.html` por el nombre. Es un falso positivo y se pierde poco.
- **Resultado:** 686 nodos, 1115 relaciones y 48 comunidades, a las que se les puso nombre.
- **Aviso de integridad:** 38 relaciones apuntan a nodos que no existen, hay 1 bucle y algunas relaciones se fusionaron (casi todas `contains` + `calls` entre los mismos nodos). El grafo sirve, pero no es completo.
- **Nodos más conectados:**
  - el registro de decisiones;
  - `MissionDaemon` (Pi);
  - el enlace LoRa/TDMA;
  - el índice de la web;
  - el protocolo LoRa v2;
  - el plan de dos sesiones;
  - `constantes.md`.
- **Prueba de consulta:** `graphify query "¿qué tareas dependen del contrato web-1?"` encontró los tres nodos de `web-1`. También trajo ruido, como "10 Hz requiere GPS+GAL", porque la búsqueda inicial es por palabras. **Sirve para ubicar archivos, no para responder sola.**
- **Costo:** unos 850 000 tokens, lo que suman los subagentes.

## Pendiente / siguiente paso
- **Jerónimo:** instalar `uv` y `graphifyy==0.9.95`, y construir su grafo.
- **Evaluar en una semana** si los agentes de verdad leen menos archivos. Si no ayuda, se quita con `graphify uninstall`.

## Documentos afectados
- `CLAUDE.md`: la sección "graphify".
- `.claude/agents/desarrollador.md`: el §0, paso 5.
- [flujo_trabajo](../05_plan/flujo_trabajo.md): el §9.
- [decisiones](../04_diseno/decisiones.md): D-036.
- `.gitignore` (`graphify-out/`), `.graphifyignore`, `.claude/settings.json`, `.claude/skills/graphify/` y `.claude/CLAUDE.md`.
