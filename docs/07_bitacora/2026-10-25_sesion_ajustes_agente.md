---
fecha: 2026-10-25
tipo: sesion
ids: [D-030, D-035, D-036, T-610, T-612]
autor: Claude (documentador) con Jerónimo
rama: chore/ajustes-agente-desarrollador
---
# Ajustes al agente `desarrollador`

## Contexto
Jerónimo pidió dejar bien configurado el agente `.claude/agents/desarrollador.md`.
Las bitácoras de T-610 y T-612 mostraban dos fallas: el worktree arrancaba en un commit viejo y no tenía `node_modules`.
También pidió configurar graphify, pero Juan Pablo ya lo había hecho en el PR #9 ([D-036](2026-10-25_sesion_graphify.md)), así que esta entrada no lo toca.

## Qué se hizo
- **Diagnóstico** (contra la documentación de Claude Code sobre subagentes y worktrees):
  1. Con `isolation: worktree`, el worktree sale de la **rama por defecto del remoto (`main`)**. `worktree.baseRef` solo acepta `"fresh"` o `"head"`: no se le puede dar el nombre de una rama.
     - El agente leía `CLAUDE.md`, el backlog y los contratos **antes** de cambiar de rama, o sea, la versión de `main`, que va atrasada.
  2. El worktree es un checkout limpio: no trae `node_modules/`. Por eso T-612 no corrió lint, build ni las pruebas de `gui/web`.
  3. `gh pr create` sin `--base` abre el PR contra `main`. Los PR 4 a 11 salieron bien, pero la regla no estaba escrita.
  4. El agente tenía disponibles herramientas que no le corresponden: Artifact, los MCP de Google y Claude Docs, entrar y salir de worktrees, y programar tareas.
  5. Había texto vencido: "si no hay repositorio git" (T-001 ya está hecha) y "vuela en 15 días".
- **Cambios en `desarrollador.md`:**
  - **§0 en un orden nuevo:**
    1. verifica que está en su worktree;
    2. crea la rama desde `origin/develop` y comprueba con `git log -1` que quedó en la punta;
    3. solo entonces lee la documentación.
    - El paso de graphify de D-036 quedó igual, ahora en el punto 6.
  - **§2, nueva, "Preparar el entorno del worktree":** `npm ci` (D-035), PlatformIO y Python.
  - **§6:** `gh pr create --base develop --head <rama>`, con la plantilla de PR, y `git status` limpio antes del push.
  - **Frontmatter:** `effort: high` y `disallowedTools` (Agent, EnterWorktree, ExitWorktree, Artifact*, ScheduleWakeup, Cron*, RemoteTrigger, PushNotification y los MCP de Claude Docs, Google Drive y Google Sheets).
  - **Reglas nuevas:** tocar solo los archivos de la tarea, no editar las fichas de `dos_sesiones/estado/` y usar la línea `Co-Authored-By` del modelo con el que corre.
  - **Se dejó para después** lo que depende de decisiones sin aprobar: la distinción "mostrar/preguntar" de DP-01 y la lectura de las fichas de estado (`12_cambios_a_aplicar_en_lo_existente.md`).
- `flujo_trabajo.md` §3: una nota sobre el origen del worktree y las dependencias.

## Evidencia
- Los cambios se probaron en una primera rama, `chore/agente-desarrollador-y-graphify` (PR #12). Esa sesión cargó el agente con la lista de herramientas restringida.
- **No probado:** una invocación real del agente con una tarea.

## Problemas y cómo se resolvieron
- El PR #12 salió de un `develop` local sin `git fetch`. Por eso **duplicaba la instalación de graphify** que el PR #9 ya había integrado, y además con otro diseño: copiaba el grafo a los worktrees en vez de usar `--graph`.
  - Se cerró y se rehízo esta rama desde `origin/develop`, solo con los ajustes del agente.
  - **Lección para el documentador:** `git fetch` antes de crear una rama.

## Decisiones tomadas o propuestas
- **Propuesta (la decide el dueño del repo):** cambiar la rama por defecto de GitHub a `develop`. Así los worktrees de los agentes nacerían ya en `develop` (PA-18). Con la corrección de §0 ya no es indispensable.
- **Para consolidar:** anotar en D-030 que el agente se ajustó (§0, §2 y §6).

## Pendiente / siguiente paso
- Reiniciar Claude Code para que cargue el agente nuevo.

## Documentos afectados
`.claude/agents/desarrollador.md`, `docs/05_plan/flujo_trabajo.md` §3 y el índice de esta bitácora.
