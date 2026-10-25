---
id: graphify
estado: vivo
actualizado: 2026-10-25
---
# graphify: el grafo de conocimiento del repo

[graphify](https://github.com/Graphify-Labs/graphify) (paquete `graphifyy` en PyPI, v0.9.95) convierte el repo en un grafo: nodos (conceptos, archivos, funciones), relaciones y comunidades.
Claude lo consulta **antes** de hacer grep o de leer archivos, así gasta menos contexto para ubicarse.
**No es una fuente de verdad:** los números y los contratos se confirman siempre en su `.md`.

## Instalación (una vez por persona)

```powershell
python -m pip install --user graphifyy
```

- Para que el comando `graphify` funcione en la terminal, agrega `%APPDATA%\Python\Python3XX\Scripts` al `Path` del usuario y abre una terminal nueva.
  - Los hooks del repo usan `python -m graphify`, así que funcionan aunque el PATH no esté configurado.
- Alternativa: `uv tool install graphifyy`, que deja el ejecutable en `~/.local/bin`.

## Qué hay en el repo (versionado)

| Archivo | Para qué |
| --- | --- |
| `.claude/skills/graphify/` | El skill `/graphify` (lo escribió `graphify install --project`) |
| `.claude/settings.json` | Dos hooks `PreToolUse` (`Bash\|Grep` y `Read\|Glob`) que, si existe el grafo, le recuerdan a Claude consultarlo. No bloquean nada. Si graphify no está instalado, fallan sin efecto |
| `CLAUDE.md`, sección "graphify" | Las reglas de uso para Claude |
| `.graphifyignore` | Lo que no entra al grafo |
| `.worktreeinclude` | Copia `graphify-out/` a cada worktree nuevo, incluidos los del agente `desarrollador` |

**`graphify-out/` no se versiona** (está en `.gitignore`).
- El grafo se reescribe entero en cada construcción, y con dos personas y varias ramas en paralelo daría conflictos en cada PR.
- Cada persona lo construye en su checkout principal.

## Qué entra y qué no

- **Entra:** el código (`gui/`, `tools/`, `visionpack/` y, cuando exista, `firmware/` y `estacion/`) y los documentos vigentes de `docs/`, incluidas las fichas de `03_hardware/componentes/`.
- **No entra** (`.graphifyignore`): los datasheets completos (más de un millón de palabras; se consultan con grep), `99_archivo/`, `fuentes/`, las capturas, los datos de ejemplo (`*.jsonl`, `*.csv`), `package-lock.json`, las imágenes, las fuentes tipográficas, `.claude/` y `.mcp.json`.
- **Tamaño medido el 2026-10-25:** 145 archivos (31 de código y 114 documentos), unas 150 000 palabras.

## Cómo se usa

| Qué | Comando | Costo |
| --- | --- | --- |
| Primera construcción (código + documentos) | `/graphify .` dentro de Claude Code | El código se analiza en local (tree-sitter). **Los documentos los extrae el modelo de la sesión**, con subagentes: consume cuota |
| Actualizar después de cambiar código | `graphify update .` | Ninguno (solo AST) |
| Actualizar después de cambiar documentos | `/graphify . --update` | Solo reextrae los archivos que cambiaron |
| Preguntar | `graphify query "<pregunta>"`, `graphify explain "<concepto>"`, `graphify path "<A>" "<B>"` | Ninguno |
| Ver el grafo | Abrir `graphify-out/graph.html` en el navegador; resumen en `graphify-out/GRAPH_REPORT.md` | — |

- **Privacidad:** el código no sale del PC. Los documentos pasan por el modelo de Claude, igual que cuando Claude los lee. graphify no tiene telemetría; las consultas quedan en `~/.cache/graphify-queries.log` (se desactiva con `GRAPHIFY_QUERY_LOG_DISABLE=1`).
- **Desinstalar:** `graphify uninstall` (con `--purge` borra también `graphify-out/`).
