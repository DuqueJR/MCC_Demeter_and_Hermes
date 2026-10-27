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
| `datos/` | Datos de entrada que no se editan: las simulaciones de OpenRocket (`datos/simulaciones/openrocket/`), con su catálogo en `datos/README.md` y su análisis en `docs/02_requisitos/perfiles_vuelo.md` |
| `tools/` | Herramientas de PC: generador de vuelos sintéticos, decodificador del log y análisis del motor |
| `docs/` | La bóveda de Obsidian con toda la documentación |
| `docs/fuentes/` | Los documentos originales: `Objetivos_Sistemas.pdf`, `Tabla_componentes.xlsx` y los `.docx`, ya traducidos a `docs/` |

- Los PDF de los datasheets **no se versionan**, porque no hay Git LFS. En git van sus `.md`, y cada ficha tiene la URL oficial.

## Estado

- Remoto: `git@github.com:DuqueJR/MCC_Demeter_and_Hermes.git`, con las ramas `main` y `develop`.
- **Código propio integrado en `develop`** (al 2026-10-26): solo la web: `gui/web/` y `tools/web_datos/` (T-610 a T-614, T-620 a T-622, T-624, T-625, T-630 a T-632 y T-634). El firmware y la estación todavía no tienen código; `visionpack/` solo tiene el código heredado de la Pi.
- **D-022 está reabierta:** el M.2 es interno. Se cierra con la sesión de verificación física (PEN-18, T-003). El cableado espera a esa sesión.
- Siguiente paso: T-002 y T-003. Lo que no depende de la placa se puede hacer en paralelo: T-304, T-502 y T-701.

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
