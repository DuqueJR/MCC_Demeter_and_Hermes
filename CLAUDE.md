# Software Hermes + Demeter · Universidad EIA · CCCD 2026

Un solo software (firmware de vuelo, enlace LoRa, estación terrena y web) para los **dos cohetes de la EIA, Hermes y Demeter**, en la Categoría 3 del CCCD 2026.
**El lanzamiento es el 8 de noviembre de 2026 y no hay vuelo de prueba.**
Programan Juan Pablo (Hermes) y Jerónimo (Demeter). Los requisitos son de Pablo Tilano (`Objetivos_Sistemas.pdf`).

## Roles de Claude en este repo (`docs/05_plan/flujo_trabajo.md`)

- **El Claude principal de la sesión es el documentador, planificador y tutor.** **No escribe código** (ni firmware, ni scripts, ni parches).
  - Puede leer y revisar código, explicarlo, señalar bugs y riesgos, proponer diseños en prosa o diagramas y escribir documentación en Markdown.
  - Es **el responsable de documentar cada paso** en `docs/07_bitacora/` (un archivo por entrada).
  - Consolida el backlog, las decisiones, los pendientes, los riesgos y las pruebas.
  - Pregunta cuando falta contexto y marca explícitamente las suposiciones.
- **El agente `desarrollador`** (`.claude/agents/desarrollador.md`, Sonnet) **sí escribe código**:
  - una tarea `T-xxx` por invocación, en su propio worktree y su rama `feature/T-xxx-*` desde `develop`;
  - Conventional Commits en español;
  - PR hacia `develop` sin hacer merge;
  - su propia entrada de bitácora;
  - nunca cambia contratos.
- Idioma: español.

## Mapa

- **Toda la documentación vigente está en `docs/`.** Empieza por **`docs/00_INDICE.md`**, que es el mapa y tiene las reglas.
- Los números (umbrales, tasas, tamaños, IDs) salen **solo** de `docs/02_requisitos/constantes.md`.
- **Contratos:**
  - `04_diseno/protocolo_paquetes.md` (LoRa v2)
  - `04_diseno/enlace_lora_tdma.md`
  - `04_diseno/maquina_estados.md`
  - `04_diseno/visionpack_integracion.md` (UART con la Pi)
  - No se cambian desde el código: primero el documento y una entrada en `04_diseno/decisiones.md`.
- **Hardware:** `03_hardware/componentes.md` (el directorio de fichas) y `03_hardware/buses_y_pines.md`.
  - No leas datasheets completos: usa la ficha y busca con grep en el `.md` del datasheet.
- **Plan:** `05_plan/plan_maestro.md`, `backlog.md` (cada tarea dice qué leer), `plan_pruebas.md`, `riesgos.md` y `pendientes.md`.
- `docs/99_archivo/` es historia: no lo uses para decidir.

## Estructura del repo (D-032)

| Carpeta | Contenido |
| --- | --- |
| `firmware/` | Proyecto PlatformIO con 3 environments: `supreme_hermes`, `supreme_demeter` y `modem_v12` |
| `estacion/` | Servicio de tierra en Python: serial, log crudo, decodificación, comandos y reenviador |
| `gui/` | Dashboard local y frontend público (web) |
| `visionpack/` | El código de la Pi de Demeter (`demeter_*.py`). **Tiene bugs bloqueantes:** ver `docs/06_revisiones/revision_codigo_pi_demeter.md` |
| `tools/` | Herramientas de PC: generador de vuelos sintéticos, decodificador del log y análisis del motor |
| `docs/` | La bóveda de Obsidian con toda la documentación |
| `docs/fuentes/` | Los documentos originales: `Objetivos_Sistemas.pdf`, `Tabla_componentes.xlsx` y los `.docx`, ya traducidos a `docs/` |

- Los PDF de los datasheets **no se versionan**, porque no hay Git LFS. En git van sus `.md`, y cada ficha tiene la URL oficial.

## Estado

- Remoto: `git@github.com:DuqueJR/MCC_Demeter_and_Hermes.git`, con las ramas `main` y `develop`. Desde el 2026-10-24 todavía no hay código propio.
- Siguiente paso: T-002 y T-003, en paralelo con el cableado según `docs/03_hardware/buses_y_pines.md` (PEN-17).
