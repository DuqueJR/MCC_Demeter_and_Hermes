---
fecha: 2026-10-25
tipo: sesion
ids: [T-610, T-612]
autor: Claude (documentador) con Jerónimo
rama: chore/agente-desarrollador-y-graphify
---
# Ajuste del agente `desarrollador` e instalación de graphify

## Contexto
Jerónimo pidió dos cosas antes de seguir: dejar bien configurado el agente `.claude/agents/desarrollador.md` e instalar y configurar graphify en el repo.
Las bitácoras de T-610 y T-612 mostraban dos fallas del agente: el worktree arrancaba en un commit viejo y no tenía `node_modules`.

## Qué se hizo

### Agente `desarrollador`
- **Diagnóstico** (contra la documentación de Claude Code sobre subagentes y worktrees):
  1. Con `isolation: worktree`, el worktree sale de la **rama por defecto del remoto (`main`)**, no de `develop`. `worktree.baseRef` solo acepta `"fresh"` o `"head"`: no se le puede dar el nombre de una rama.
     - El agente leía `CLAUDE.md`, el backlog y los contratos **antes** de cambiar de rama, o sea, la versión de `main`, que va atrasada.
  2. El worktree es un checkout limpio: no trae `node_modules/` ni nada ignorado. Por eso T-612 no pudo correr lint, build ni las pruebas de `gui/web`.
  3. `gh pr create` sin `--base` abre el PR contra la rama por defecto (`main`). Hasta ahora salió bien (los PR 4 a 11 van a `develop`), pero no estaba escrito.
  4. Tenía disponibles herramientas que no le corresponden (Artifact, los MCP de Google y Claude Docs, entrar y salir de worktrees, programar tareas).
  5. Texto vencido: "si no hay repositorio git" (T-001 ya está hecha) y "vuela en 15 días".
- **Cambios en `desarrollador.md`:**
  - §0 en un orden nuevo: primero verifica el worktree, después **crea la rama desde `origin/develop`**, y solo entonces lee la documentación. También comprueba con `git log -1` que quedó en la punta de `origin/develop`.
  - §2 nueva, "Preparar el entorno del worktree": `npm ci` en `gui/web/` si la tarea lo toca, PlatformIO y Python.
  - §6: `gh pr create --base develop --head <rama>`, con el cuerpo de `.github/pull_request_template.md` y `git status` limpio antes del push.
  - Frontmatter: `effort: high` y `disallowedTools` (Agent, EnterWorktree, ExitWorktree, Artifact*, ScheduleWakeup, Cron*, RemoteTrigger, PushNotification y los MCP de Claude Docs, Google Drive y Google Sheets).
  - Nuevas reglas: tocar solo los archivos de la tarea, no editar las fichas de `dos_sesiones/estado/`, usar graphify para ubicarse y la línea `Co-Authored-By` del modelo con que corre.
  - **No se cambió** lo que depende de decisiones sin aprobar: la distinción "mostrar/preguntar" de DP-01 y la lectura de las fichas de estado (`12_cambios_a_aplicar_en_lo_existente.md`).

### graphify
- `graphifyy` 0.9.95 instalado con `pip install --user` (Python 3.14). Se agregó `%APPDATA%\Python\Python314\Scripts` al `Path` del usuario.
- `graphify install --project` y `graphify claude install` escribieron:
  - el skill `.claude/skills/graphify/`;
  - los hooks en `.claude/settings.json`;
  - una sección en `CLAUDE.md`;
  - un `.claude/CLAUDE.md`.
- **Ajustes:**
  - Los hooks usan `python -m graphify ...` en vez de `graphify`, para que funcionen sin el PATH configurado y en el PC de Juan Pablo.
  - La sección de `CLAUDE.md` quedó en español, con la regla de que el grafo **no es una fuente de verdad**.
  - Se borró `.claude/CLAUDE.md`, que repetía lo mismo.
- Nuevos `.graphifyignore` y `.worktreeinclude` (este copia `graphify-out/` a los worktrees).
- En `.gitignore`: `.claude/worktrees/` (pendiente de `12_cambios…`) y `graphify-out/`.
- La guía de uso está en [graphify.md](../05_plan/graphify.md).

## Evidencia
- La detección de graphify con las exclusiones encontró 145 archivos (31 de código y 114 documentos), unas 150 000 palabras. Sin `.graphifyignore`, solo `docs/03_hardware` sumaba 1 086 691 palabras, casi todas de los datasheets.
- `python -m graphify hook-guard search` sin grafo: no imprime nada y termina con código 0, así que no bloquea.

## Decisiones tomadas o propuestas
- **`graphify-out/` no se versiona.** Se reescribe entero en cada construcción y daría conflictos con dos personas y varias ramas. Cada uno construye el suyo. Si se prefiere compartirlo, graphify trae un merge driver (`graphify hook install`).
- **Propuesta (la decide el dueño del repo):** cambiar la rama por defecto de GitHub a `develop`. Así los worktrees de los agentes nacen ya en `develop` (PA-18). Con la corrección de §0, ya no es indispensable.

## Pendiente / siguiente paso
- **Construir el grafo** con `/graphify .`. Los documentos los extrae el modelo de la sesión, con subagentes, y consume cuota.
- Juan Pablo: `python -m pip install --user graphifyy` en su PC (ver [graphify.md](../05_plan/graphify.md)).
- Reiniciar Claude Code para que cargue los hooks y el agente nuevo.

## Documentos afectados
`.claude/agents/desarrollador.md`, `.claude/settings.json`, `.claude/skills/graphify/`, `CLAUDE.md`, `.gitignore`, `.graphifyignore`, `.worktreeinclude`, `docs/05_plan/graphify.md`, `docs/05_plan/flujo_trabajo.md` §3, `docs/00_INDICE.md` y el índice de esta bitácora.
