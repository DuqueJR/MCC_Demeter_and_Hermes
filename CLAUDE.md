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
- **Firmware de Pablo (D-037, desde el 2026-11-03):** el firmware de vuelo y el de la estación son los de Pablo Tilano ([ptilanom/DEMETER](https://github.com/ptilanom/DEMETER)).
  - **Él es el dueño:** `firmware/` y `tools/tbeam/` son **copias** que solo cambian en las tareas de sincronización (`05_plan/sincronizacion_firmware_pablo.md`). **No se editan a mano.**
  - Qué cambió frente a nuestro plan: `05_plan/cambios_por_firmware_pablo.md`. Revisión: `06_revisiones/revision_firmware_pablo.md`.
- **Contratos** (desde D-037 describen el sistema de Pablo; la v1 está en `99_archivo/diseno_v1/`):
  - `04_diseno/protocolo_paquetes.md` (`net_proto`, el USB de tierra y la correspondencia con `web-1`)
  - `04_diseno/enlace_lora_tdma.md`
  - `04_diseno/maquina_estados.md`
  - `04_diseno/formato_log.md`
  - `04_diseno/visionpack_integracion.md` (UART con la Pi)
  - `08_gui/05_contrato_datos_web.md` (`web-1`, sin cambios)
  - No se cambian desde nuestro código: primero el documento y una entrada en `04_diseno/decisiones.md`. Lo del firmware cambia cuando cambia el código de Pablo.
- **Hardware:** `03_hardware/componentes.md` (el directorio de fichas) y `03_hardware/buses_y_pines.md`.
  - No leas datasheets completos: usa la ficha y busca con grep en el `.md` del datasheet.
- **Plan:** `05_plan/plan_maestro.md`, `backlog.md` (cada tarea dice qué leer), `plan_pruebas.md`, `riesgos.md` y `pendientes.md`.
- `docs/99_archivo/` es historia: no lo uses para decidir.

## Estructura del repo (D-032)

| Carpeta | Contenido |
| --- | --- |
| `firmware/` | **Copia del firmware de Pablo (D-043):** `cohete/` (envs `demeter`, `hermes` y `*_campo`), `tierra/` (envs `tierra` y `tierra_campo`), `common/` (`net_proto`) y `vendor/` (el submódulo de LilyGO) |
| `estacion/` | Servicio de tierra en Python: serial, log crudo, decodificación, comandos y reenviador |
| `gui/` | Dashboard local y frontend público (web) |
| `visionpack/` | El código de la Pi de Demeter (`demeter_*.py`). **Tiene bugs bloqueantes:** ver `docs/06_revisiones/revision_codigo_pi_demeter.md` |
| `datos/` | Datos de entrada que no se editan: las simulaciones de OpenRocket (`datos/simulaciones/openrocket/`), con su catálogo en `datos/README.md` y su análisis en `docs/02_requisitos/perfiles_vuelo.md` |
| `tools/` | Herramientas de PC. `tools/tbeam/` es la copia de las de Pablo (`dashboard.py`, `tbget.py`, `tblog.py`, `calib.py`, `ekf.py`); `tools/web_datos/` es el generador de datos de la web |
| `docs/` | La bóveda de Obsidian con toda la documentación |
| `docs/fuentes/` | Los documentos originales: `Objetivos_Sistemas.pdf`, `Tabla_componentes.xlsx` y los `.docx`, ya traducidos a `docs/` |

- Los PDF de los datasheets **no se versionan**, porque no hay Git LFS. En git van sus `.md`, y cada ficha tiene la URL oficial.

## Estado

- Remoto: `git@github.com:DuqueJR/MCC_Demeter_and_Hermes.git`, con las ramas `main` y `develop`.
- **2026-11-03:** se adopta el firmware de Pablo (D-037 a D-044). Se importa con T-007 (snapshot `17139b2`). D-022 quedó cerrada por su cableado (D-042).
- **Código propio en `develop`:** la web (`gui/web/`, `tools/web_datos/`). La estación (T-602) todavía no.
- **Crítico antes del vuelo:** la detección de BOOST (T-410, en el repo de Pablo), la prueba de alcance a 22 dBm (T-415), la Pi autónoma (T-701), la calibración final (T-416) y la sincronización final (T-008). Ver `05_plan/cambios_por_firmware_pablo.md` §4–§5.
- **Abiertos con Pablo:** PEN-22 (cómo le llegan los PR) y PEN-23 (las peticiones de contrato).

## Imágenes generadas (D-W20)

Las imágenes de la web se generan con IA: fondos, íconos ilustrativos (partes del cohete, objetivos, equipo) y otras ilustraciones. Los íconos de interfaz (estado, navegación, flechas) siguen con `lucide-preact` (D-W17).

- **Generador principal (desde el 2026-10-25, a pedido del usuario): el MCP de Replicate con `black-forest-labs/flux-schnell`.**
  - **Herramienta:** `mcp__replicate__create_models_predictions` con `Prefer: wait`.
  - **Entrada:** `prompt`, `aspect_ratio`, `output_format: png`, `num_outputs`, `seed` y `megapixels: "1"`.
  - **Descargar enseguida:** las URL de `replicate.delivery` caducan en 1 h.
  - Cobra por imagen, poco: no generar en exceso.
- **Respaldo: los Spaces de Hugging Face** (servidor `huggingface` de `.mcp.json`, token `HF_TOKEN`, cuenta gratuita `apnauj`, con Dynamic Spaces):

| Space | Para qué |
| --- | --- |
| `mcp-tools/Z-Image-Turbo` | Borradores (funcionó el 2026-10-25) |
| `evalstate/flux1_schnell` | Borradores (falló por su API el 2026-10-25) |
| `black-forest-labs/FLUX.2-klein-9B` | Versión final |
| `black-forest-labs/flux-3-image-klein` | Versión final, la más reciente |

  - **Cuota:** ZeroGPU gratis, de unas 5 imágenes al día, porque cada llamado reserva 60 s. **Generar de a una, nunca en paralelo.**
  - **Inference Providers no tiene créditos** (responde 402).
  - Si los Spaces no aparecen en la sesión, reconectar con `/mcp`.
- **Quién genera:** el Claude principal, en su rol de diseñador, con el usuario.
  - El agente `desarrollador` no genera: solo integra los archivos elegidos.
  - Las elegidas se toman de `generated_images/…/elegidos/` con rutas absolutas, porque esa carpeta no se versiona y no está en su worktree.
- **Flujo y prompts:** en `docs/08_gui/07_assets_e_imagenes.md`. Lo generado va a `generated_images/`; lo elegido termina en `gui/web/src/assets/<misión>/`.

## graphify

Búsqueda en el repo con un grafo de conocimiento (D-036). [Graphify](https://github.com/Graphify-Labs/graphify) `0.9.95` convierte el código y los `.md` de `docs/` en un grafo que se consulta en vez de leer archivo por archivo.

**Dónde está el grafo:**
- En `graphify-out/` de la **carpeta principal** del repo. **No se versiona** (está en `.gitignore`): cada persona lo construye en su máquina.
- `.graphifyignore` deja fuera los datasheets, `docs/99_archivo/`, `docs/fuentes/`, `datos/`, los worktrees y los builds.

**Cómo buscar:**
1. Antes del primer grep o de leer archivos para responder algo sobre el repo, consulta el grafo:
   - `graphify query "<pregunta>"`;
   - `graphify path "<A>" "<B>"` para ver cómo se conectan dos cosas;
   - `graphify explain "<concepto>"` para un concepto.
2. Después lee solo las líneas que el grafo ubicó.
3. Usa `graphify-out/GRAPH_REPORT.md` solo para una vista general.
4. **Si no existe `graphify-out/graph.json` o no está instalado `graphify`, sigue con grep normal.** El hook no bloquea nada.

**Desde un worktree** (por ejemplo, el agente `desarrollador`): el grafo no está en el worktree. Apunta al de la carpeta principal con `--graph <carpeta principal>/graphify-out/graph.json`. La carpeta principal es el padre de lo que devuelve `git rev-parse --path-format=absolute --git-common-dir`.

**Qué no hace el grafo:**
- No reemplaza las fuentes de verdad. Los números salen de `constantes.md`; los contratos, de sus documentos.
- Una relación marcada `INFERRED` es una pista, no un hecho: verifica en el archivo antes de citarla.
- Los datasheets siguen la regla de siempre: la ficha y grep en su `.md`.

**Actualizar el grafo** (solo en la carpeta principal, nunca desde un worktree):
- Después de integrar código a `develop`: `graphify update .`. Solo usa el AST, sin modelo y sin costo.
- Después de cambios grandes en `docs/`: `/graphify . --update`. Usa el modelo de la sesión, así que lo corre el Claude principal o un humano, no el `desarrollador`.

**Reglas:**
- Pon una línea sobre el grafo en cada prompt de un subagente que explore el repo.
- **No vuelvas a correr `graphify claude install`:** reescribe esta sección en inglés y sin las reglas del proyecto.
- El hook de `.claude/settings.json` llama a `graphify hook-guard`, así que **cada persona necesita `graphify` instalado**. La instalación está en `docs/05_plan/flujo_trabajo.md` §9.
