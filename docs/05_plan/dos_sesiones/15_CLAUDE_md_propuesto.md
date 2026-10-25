---
id: dos_sesiones_claude_md
estado: borrador. No se aplica sin aprobación aparte (T-S10, T-S11; DP-03).
actualizado: 2026-10-25
depende_de: [dos_sesiones_decisiones, dos_sesiones_metodo]
---
# CLAUDE.md compartido propuesto, más hooks, integración continua, agente `revisor` y skills

**Nada de esto se aplica todavía.**
- §1 reemplazaría la raíz `CLAUDE.md`.
- §3 a §6 son **especificaciones**. Los archivos (`.claude/settings.json`, los scripts, `.github/workflows/ci.yml`, `.claude/agents/revisor.md`, `.claude/skills/*`) los escribe el agente `desarrollador` en T-S10 y T-S11, después de la aprobación. El Claude principal no escribe código (DP-04).

**Criterios** ([memoria](https://code.claude.com/docs/en/memory.md), [mejores prácticas](https://code.claude.com/docs/en/best-practices)):
- corto (por debajo de unas 200 líneas);
- solo lo que no se puede deducir;
- neutral respecto a la sesión: lo personal va en `CLAUDE.local.md`;
- lo que debe cumplirse sin excepción, en hooks.

## 1. Borrador de `CLAUDE.md`

```markdown
# Software Hermes + Demeter · Universidad EIA · CCCD 2026

Un solo software (firmware de vuelo, enlace LoRa, módem, servicio de tierra) para los dos
cohetes de la EIA, **Hermes y Demeter**. Hardware idéntico: cada CanSat es una T-Beam
Supreme V3.1; la estación es una T-Beam V1.2. Entre cohetes solo cambia la configuración
(`ROCKET_ID`, `MODULO_VISIONPACK`). **Vuelo: 8 de noviembre de 2026. Sin vuelo de prueba.
Congelamiento: 4 de noviembre a las 12:00.** Idioma: español.

## Dos sesiones (docs/05_plan/dos_sesiones/)
- **Sesión A, Jerónimo:** enlace, tiempo, tierra y Pi. **Sesión B, Juan Pablo:** adquisición, log y decisión.
- Quién es quién lo dice tu `CLAUDE.local.md`. Las carpetas de cada sesión: `06_contratos/01_propiedad_y_carpetas.md`.
  **No edites las carpetas de la otra sesión ni `gui/` (la GUI es de otro plan).**
- Al empezar: `/arranque`. Al terminar un bloque: `/cierre`. Sincronización: `/sync`.
- Estado vivo: `docs/05_plan/dos_sesiones/estado/` (sesion_A.md, sesion_B.md, placa.md).

## Roles
- **Claude principal:** documenta, planifica, revisa y enseña. **No escribe código.**
- **`desarrollador`** (Sonnet, worktree): una tarea T-xxx por invocación, rama `feature/T-xxx-*`
  desde `origin/develop`, una entrada de bitácora; no cambia contratos.
- **`revisor`** (solo lectura): revisa cada PR contra el contrato y el "hecho" antes del humano.

## Fuentes de verdad
- Números: **solo** `docs/02_requisitos/constantes.md` (se replican con el mismo nombre en `config.h` y `constantes.py`).
- Contratos: `04_diseno/protocolo_paquetes.md`, `enlace_lora_tdma.md`, `maquina_estados.md`,
  `visionpack_integracion.md` y los contratos C-02 a C-05 (en `04_diseno/` cuando se promuevan;
  hasta entonces en `05_plan/dos_sesiones/06_contratos/`). **Primero el documento y una decisión;
  después el código.**
- Hardware: `03_hardware/componentes.md` y `buses_y_pines.md`. No leas datasheets completos: ficha + grep.
- `docs/99_archivo/` es historia: no lo uses para decidir.

## Git (DP-01)
- Ramas de ≤ 1 día desde `develop`. **Preguntar** (revisión humana previa): firmware, contratos,
  `estacion/`, `visionpack/` (estas dos, si se confirma PA-20). **Mostrar** (merge con la integración continua en verde, revisión en < 24 h): `tools/`, pruebas, documentación.
- Conventional Commits en español: `<tipo>(<ámbito>): <resumen> [T-xxx]`. Merge `--no-ff`.
  Nunca: commit directo a `main` o `develop`, push --force, rebase de ramas ajenas.

## Hardware (no hay repuestos)
- Una persona a la vez con la placa; reserva y registro en `estado/placa.md`.
- **Nunca transmitir sin antena**; en el banco, `LORA_TX_DBM` bajo. Medir los pull-ups de 45/46
  antes de conectar breakouts. Nada de conectar en caliente. Cargar firmware solo si la tarea lo pide.

## Verificación
- Lógica en el PC: PlatformIO `env:native` (Unity) y pytest; replay con C-04. Drivers: en la placa, con scripts.
- "Hecho" = criterio del backlog + integración continua en verde + `revisor` sin hallazgos de corrección + evidencia en el PR
  (+ P-xx registrada con el hash si usó la placa).

## Cuota (dos cuentas Pro)
- Como mucho 2 `desarrollador` a la vez. Sonnet para implementar; el modelo más caro solo para contratos y la
  revisión de la lógica crítica. `/clear` entre tareas. Explora con subagentes de solo lectura.

## Al compactar
Conserva: la tarea en curso, los archivos modificados, los comandos de prueba, las decisiones tomadas en la sesión.
```

## 2. `CLAUDE.local.md` (cada persona, no se versiona)

```markdown
Soy <Jerónimo | Juan Pablo>. Esta es la SESIÓN <A | B>.
Mis carpetas: ver 06_contratos/01_propiedad_y_carpetas.md, columna <A | B>.
Mi ficha de estado: docs/05_plan/dos_sesiones/estado/sesion_<A | B>.md.
```

Y en la configuración local (`.claude/settings.local.json`, no versionada): la variable de entorno `SESION=A` o `SESION=B`, que usan los hooks de §3.

## 3. Hooks (`.claude/settings.json`, versionado)

Los scripts van **en Python** (los dos usan Windows), en `.claude/hooks/`. Cada uno lee el JSON de la entrada estándar, como se describe en [hooks](https://code.claude.com/docs/en/hooks-guide.md).

| Hook | Evento y matcher | Qué hace | Bloquea |
| --- | --- | --- | --- |
| `proteger_contratos.py` | `PreToolUse` sobre `Edit\|Write` | Si la ruta es un contrato (`docs/04_diseno/{protocolo_paquetes,enlace_lora_tdma,maquina_estados,visionpack_integracion}.md`, `docs/02_requisitos/constantes.md`, `docs/05_plan/dos_sesiones/06_contratos/**`, `firmware/src/estado/**`, `firmware/include/config.h`, `estacion/constantes.py`) **y** la rama actual no empieza por `contrato/` ni `docs/consolidacion-`, termina con código 2 y el mensaje "contrato: usa el protocolo de 08 §3" | Sí (código 2) |
| `respetar_propiedad.py` | `PreToolUse` sobre `Edit\|Write` | Lee `SESION`. Si la ruta pertenece a la **otra** sesión según una tabla en `.claude/hooks/propiedad.json` (copia de C-01), termina con código 2. Si `SESION` no está definida, no bloquea y avisa | Sí (código 2) |
| `no_gui.py` | `PreToolUse` sobre `Edit\|Write` | Bloquea las ediciones en `gui/**` | Sí (código 2) |
| `contexto_inicio.py` | `SessionStart` (inicio, reanudación, compactación) | Imprime el resumen de `estado/sesion_A.md`, `sesion_B.md` y la última entrada de `estado/placa.md` (Claude Code lo agrega al contexto). En la compactación también recuerda la tarea en curso | No |
| `antes_de_parar.py` (opcional) | `Stop` | Si hay cambios sin commit en un worktree de `desarrollador`, recuerda correr las pruebas y escribir la bitácora | No (solo avisa) |

**Notas:**
- `${CLAUDE_PROJECT_DIR}` no sigue a los worktrees. Los scripts deben usar el campo `cwd` de la entrada para resolver la rama y la ruta ([worktrees](https://code.claude.com/docs/en/worktrees.md)).
- **La documentación del Claude principal** (bitácora, estado) no se bloquea: no son contratos.

## 4. Integración continua (`.github/workflows/ci.yml`)

| Job | Cuándo | Pasos | Falla si |
| --- | --- | --- | --- |
| `firmware` | PR y push a `develop` | Python + PlatformIO (con caché); `pio run -e supreme_hermes -e supreme_demeter -e modem_v12`; `pio test -e native` | No compila o falla una prueba |
| `python` | Ídem | Instalar las dependencias de `estacion/` y `tools/`; `pytest` (incluidos los vectores de `tools/vectores/`) | Falla una prueba |
| `constantes` | Ídem | Correr `tools/chequeo_constantes` (T-S09) | Un nombre o valor de `config.h` o `constantes.py` no coincide con `constantes.md` |
| `contratos` | Ídem | Si el PR toca un contrato, exige la etiqueta `contrato` y dos aprobaciones (o falla con un aviso) | Contrato cambiado sin el flujo de 08 §3 |

**Notas:**
- Sin hardware en la integración continua: el hardware en el lazo es manual ([07](07_pruebas_y_placas.md) §6).
- Las versiones de las acciones y de PlatformIO quedan fijas.

## 5. Agente `revisor` (`.claude/agents/revisor.md`)

```markdown
---
name: revisor
description: Revisa el diff de una tarea T-xxx en contexto limpio contra su contrato, su criterio de
  aceptación y el "hecho". Úsalo antes de pedir la revisión humana de cualquier PR. No edita archivos.
model: sonnet
tools: Read, Grep, Glob, Bash
color: yellow
---

Eres el revisor del proyecto Hermes + Demeter. Recibes una rama o PR de una tarea T-xxx.

1. Lee la tarea en docs/05_plan/backlog.md (o en 05_plan/dos_sesiones/03_plan_maestro.md si es T-S…),
   los documentos de su columna "Leer", los contratos que toca y docs/02_requisitos/constantes.md.
2. Mira el diff (`git diff origin/develop...HEAD`) y solo lo necesario a su alrededor.
3. Verifica: (a) el criterio de aceptación; (b) que respeta los contratos (formatos, offsets,
   nombres de constantes, transiciones); (c) que no hay números mágicos; (d) que las pruebas
   existen, se corrieron y su evidencia está; (e) que no edita carpetas de la otra sesión,
   `gui/` ni contratos sin decisión; (f) seguridad del hardware (TX con antena, potencia de banco).
4. Corre las pruebas que se puedan correr en el PC (`pio test -e native`, `pytest`) y pega la salida.
5. Reporta SOLO hallazgos que afecten la corrección, los contratos o el "hecho", cada uno con
   archivo:línea, el escenario que falla y la gravedad. No reportes preferencias de estilo.
   Si no hay hallazgos, dilo claramente. No edites nada.
```

## 6. Skills (`.claude/skills/*/SKILL.md`)

| Skill | `disable-model-invocation` | Qué hace |
| --- | --- | --- |
| `/arranque` | true | `git fetch`; muestra la rama; lee CLAUDE.md, el plan de su sesión, las dos fichas de estado y `placa.md`; resume el estado, la siguiente tarea, el turno de la placa, lo que se espera del otro y los bloqueos; propone el plan del bloque y **espera el OK** |
| `/cierre` | true | Actualiza la ficha de la sesión (hecho, siguiente, bloqueos, qué se necesita del otro); escribe la entrada de bitácora del bloque; si usó la placa, agrega la entrada a `placa.md`; commit y push de la rama de documentación |
| `/sync` | true | Arma la agenda de [08](08_sincronizacion_y_merge.md) §1 para la sincronización que corresponde (de la mañana o de hito), con lo que dicen las fichas, los PR abiertos (`gh pr list`) y `/status`; al terminar, registra los acuerdos |
