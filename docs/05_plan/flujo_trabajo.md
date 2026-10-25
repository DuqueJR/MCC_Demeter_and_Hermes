---
id: flujo_trabajo
estado: aprobado (D-028, D-029, D-030)
actualizado: 2026-10-25
---
# Flujo de trabajo: roles, git, worktrees y documentación

## 1. Roles

| Rol | Quién | Hace | No hace |
| --- | --- | --- | --- |
| **Documentador / planificador** | El Claude principal de la sesión | Documenta cada paso en la bitácora; mantiene el backlog, las decisiones, los pendientes, los riesgos, las constantes y los contratos; prepara las tareas; revisa el código y los PR en prosa; hace de tutor | No escribe código |
| **Desarrollador** | El agente `.claude/agents/desarrollador.md` (Sonnet) | Implementa **una** tarea `T-xxx` por invocación, en su propio worktree y su rama `feature/`; escribe la bitácora de la tarea | No cambia contratos ni hace merge; no edita backlog, decisiones, pendientes ni constantes |
| **Revisores e integradores** | Juan Pablo y Jerónimo | Revisan y aprueban los PR; hacen el merge; operan el hardware; deciden | — |

## 2. Gitflow

```
main ──●────────────────────────────●── (v1.0.0-cccd)  solo releases y hotfix
        \                          /
develop  ●──●────●──────●────●────●     integración (PR obligatorio)
             \  /      / \  /
feature/T-101 ●●      /   ●●  feature/T-301
feature/T-201 ───────●
```

- **`main`:** solo se toca con las versiones etiquetadas (`vX.Y.Z`). Lo que vuela el 8 de noviembre sale de una etiqueta de `main`.
- **`develop`:** la rama de integración. **Solo se entra por PR**, con revisión de una persona (Juan Pablo o Jerónimo).
- **Ramas de trabajo:**
  - `feature/T-xxx-<slug>`: sale de `develop`. Es una tarea por rama y una rama por worktree.
  - `fix/T-xxx-<slug>`: un error encontrado en `develop`.
  - `release/vX.Y.Z`: sale de `develop` en el congelamiento (4 de noviembre). Ahí solo entran correcciones, y se integra a `main` y a `develop`.
  - `hotfix/vX.Y.Z-<slug>`: sale de `main` para un error en una versión ya etiquetada (por ejemplo, en el campo).
- **Merge a `develop`:** con `--no-ff` (un "merge commit" desde GitHub), para conservar los commits de la tarea.
- **Versionado:** `v0.x` mientras se desarrolla. `v1.0.0-cccd` es la versión de vuelo.

## 3. Worktrees

- Cada invocación del agente `desarrollador` corre en **su propio worktree** (`isolation: worktree` en su definición). Así varias tareas avanzan en paralelo sin pisarse.
- **Para humanos que quieran el mismo esquema:**
  - crear: `git worktree add ../hermes-wt/T-xxx -b feature/T-xxx-<slug> develop`
  - limpiar después del merge: `git worktree remove ../hermes-wt/T-xxx` y `git branch -d feature/T-xxx-<slug>`.
- **No lances en paralelo dos tareas que toquen los mismos archivos.** Mira las dependencias del backlog.

## 4. Commits

**Conventional Commits en español:** `<tipo>(<ámbito>): <resumen> [T-xxx]`, con un cuerpo que diga el qué y el porqué, y el pie `Refs: T-xxx`.
Los tipos y ámbitos permitidos, y un ejemplo, están en `.claude/agents/desarrollador.md` §3.

## 5. Definido como hecho (checklist del PR)

- [ ] Cumple el criterio de aceptación de la tarea en el backlog.
- [ ] Compila en todos los environments afectados (`supreme_hermes`, `supreme_demeter`, `modem_v12`) o las pruebas de Python pasan.
- [ ] Ningún número mágico: todo sale de `constantes.md`, con el mismo nombre.
- [ ] No cambia ningún contrato, o hay una decisión aprobada que lo autoriza.
- [ ] Pruebas corridas y registradas en la bitácora, con su evidencia.
- [ ] Commits atómicos con el formato acordado.
- [ ] Ni secretos ni binarios pesados.
- [ ] Hay entrada de bitácora.

## 6. Documentar cada paso (D-029)

- **Todo paso del proceso queda en `docs/07_bitacora/`**, con **un archivo por entrada**: sesiones de trabajo, tareas, pruebas, reuniones y decisiones. La plantilla está en su [README](../07_bitacora/README.md).
  - Así, dos ramas nunca editan el mismo archivo y no hay conflictos de merge.
- **Quién escribe qué:**
  - el **desarrollador** escribe la entrada de su tarea, en su rama;
  - el **documentador** escribe las entradas de sesión, reunión y decisión;
  - el documentador **consolida**: a partir de las entradas, actualiza el estado del backlog, `registro_pruebas.md`, decisiones, pendientes y riesgos.
- Lo que contesten Pablo u otros equipos se registra como una entrada de reunión o de respuesta, citando lo que dijeron.

## 7. Cómo lanzar una tarea

1. El documentador verifica que la tarea está lista: sus dependencias están hechas y no hay un `PEN` que la bloquee.
2. Se lanza el agente `desarrollador` con un mensaje como "Implementa T-xxx". Tareas independientes se pueden lanzar en paralelo.
3. Cuando el agente termina, el documentador revisa su informe y su bitácora, consolida la documentación y le pasa el PR a un humano para revisión.

## 8. Puesta en marcha del repo (T-001, hecha el 2026-10-24)

- **Remoto:** `git@github.com:DuqueJR/MCC_Demeter_and_Hermes.git`. Ramas `main` y `develop`. La estructura está en `README.md` (D-032).
- **`.gitignore`:** builds, Python, secretos, el estado de Obsidian y **los PDF de los datasheets**, porque Git LFS no está instalado. Sus conversiones a `.md` sí se versionan, y las fichas tienen la URL oficial de cada PDF.
  - Para versionar también los PDF: instalar `git-lfs`, ejecutar `git lfs track "*.pdf"` y quitar la línea del `.gitignore`.
- **Plantilla de PR:** `.github/pull_request_template.md`, con el checklist de §5.
- **Pendiente en GitHub (lo hace el dueño del repo):** proteger `main` y `develop` (exigir PR, una revisión y prohibir el force-push).

## 9. Búsqueda con graphify (D-036)

[Graphify](https://github.com/Graphify-Labs/graphify) arma un grafo de conocimiento con el código y los `.md` de `docs/`. Así, los agentes consultan el grafo en vez de leer archivo por archivo. Las reglas de uso están en la sección "graphify" de `CLAUDE.md` y en el §0 del agente `desarrollador`.

**Instalación (una vez por máquina, Windows y macOS).** Hace falta porque el hook de `.claude/settings.json` llama a `graphify`; sin él, Claude Code muestra un error en cada búsqueda.

1. Instalar `uv`:
   - macOS: `brew install uv`;
   - Windows: `winget install astral-sh.uv`.
2. `uv tool install "graphifyy==0.9.95"`. El paquete se llama así, con **doble y**; los otros `graphify*` de PyPI no son oficiales. El comando sigue siendo `graphify`.
3. Si `graphify` no aparece en la terminal: `uv tool update-shell` y abrir otra terminal.

**Construir el grafo (una vez por persona, en la carpeta principal del repo):**
- En Claude Code: `/graphify .`.
  - El código se lee localmente con el AST, sin modelo.
  - Los `.md` pasan por el modelo de la sesión: es un costo único de tokens, de unos 200 000.
- **Sin claves de API en el entorno:** si existe una variable como `GEMINI_API_KEY` u `OPENAI_API_KEY`, el modo sin asistente (`graphify extract`) le enviaría los documentos a ese proveedor.

**Mantenerlo al día (solo en la carpeta principal):**
- Después de integrar código: `graphify update .` (gratis).
- Después de cambios grandes en `docs/`: `/graphify . --update`.

**Qué queda en el repo:**
- **Se versiona:** `.claude/skills/graphify/` (la skill), `.claude/settings.json` (el hook), `.graphifyignore` y las reglas.
- **No se versiona:** `graphify-out/`. Es un archivo generado que se reescribe entero en cada actualización, y con varias ramas en paralelo daría conflictos todo el tiempo.

**Para quitarlo:** `graphify uninstall` y borrar la sección de `CLAUDE.md`.
