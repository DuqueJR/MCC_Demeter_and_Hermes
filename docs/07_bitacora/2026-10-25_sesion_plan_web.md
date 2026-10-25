---
fecha: 2026-10-25
tipo: sesion
ids: [GS-12, D-025, D-W01, D-W02, D-W03, D-W04, D-W05, D-W06, D-W07, D-W08, D-W09, T-605, T-610..T-654]
autor: Claude (documentador y diseñador) con Juan Pablo
---
# Plan y diseño de la web pública

## Contexto
El usuario pidió diseñar la web pública de los dos cohetes y un plan en el que él y Jerónimo trabajen en paralelo con sus agentes. Pidió hacerlo en una carpeta aparte, porque alguien edita `05_plan/` al mismo tiempo.
Al principio iba a ser un prompt para Claude Design. El usuario lo cambió: **Claude hace de diseñador**.

## Qué se hizo
- **Escudos organizados** en `docs/fuentes/marca/`: `escudo_hermes.png`, `escudo_demeter.png`, `escudo_eia_con_fondo.png` y `escudo_eia_sin_fondo.png` (este es la versión blanca). Antes estaban en la raíz con el nombre "Copia de …".
- **Generación de imágenes** para trabajar el diseño:
  - Se probó `@llmindset/mcp-hfspace` 0.5.4: lista las herramientas, pero **la llamada a FLUX se queda colgada** (no se actualiza desde abril de 2025). Se descartó.
  - El Space `black-forest-labs/FLUX.1-schnell` sí responde por su API de Gradio (se probó con `curl`).
  - **Se configuró el servidor MCP oficial de Hugging Face** en `.mcp.json` (alcance de proyecto, `https://huggingface.co/mcp`, con `Authorization: Bearer ${HF_TOKEN:-}`). Cada persona pone su token en `~/.zshrc`; el token no queda en el repo.
  - Se agregó `generated_images/` al `.gitignore`.
  - Hoy el servidor conecta (usuario `apnauj`), pero solo con las herramientas del Hub. **Falta activar FLUX en huggingface.co/settings/mcp** (PEN-W08).
- **Lectura de *Objetivos* §6 y §7**, completos, para definir qué muestra la web: todo menos el centro de comandos (D-W04).
- **Colores muestreados de los escudos** y contraste WCAG verificado de todas las combinaciones de texto y estado sobre los fondos oscuros.
- **Se creó `docs/08_gui/`:**
  - índice, decisiones y pendientes;
  - visión y alcance;
  - identidad visual (paletas, tokens, tipografía, voz);
  - pantallas (portada, misión y estados);
  - arquitectura;
  - contrato de datos `web-1`;
  - plan con fases W0–W4, carriles A y B, worktrees y tareas T-610 a T-654;
  - assets (con los prompts de FLUX);
  - el modelo 3D (congelado).

## Respuestas del usuario (2026-10-25)
- **Portada:** es una cubierta. Cada mitad tiene un parche sobre un fondo de naturaleza acorde con su equipo; con el hover, el parche crece, y al dar clic se entra. **Quien entra a Deméter no carga nada de Hermes** (D-W01).
- **El 3D queda congelado** como *could*. Se reemplaza por fotos del cohete y del equipo (D-W03).
- Él y Jerónimo trabajan en paralelo. La web se planea para empezar ya, sin esperar al back, y se conecta después (D-W07).
- Solo español, solo modo oscuro (D-W02). Hasta 500 personas a la vez. Retraso < 2 s (D-W09).
- Los textos los escriben ellos por ahora. El framework, "el que mejor vaya" (D-W05).
- **Los cohetes están en OpenRocket.** Los archivos llegan más adelante.

## Decisiones tomadas o propuestas
- Aprobadas por el usuario: D-W01, D-W02, D-W03, D-W04, D-W07 y D-W09.
- Propuestas por el diseñador: **D-W05** (Vite + TS + Preact y signals, MapLibre + PMTiles, uPlot, SSE, relay en FastAPI) y **D-W08** (los colores de estado son independientes de las marcas).
- Propuesta que necesita a Jerónimo: **D-W06**. T-605 se divide: el reenviador se queda en el back y el relay pasa a la web.

## Pendiente / siguiente paso
1. Que Juan Pablo y Jerónimo revisen y aprueben `docs/08_gui/`. Que se cierren PEN-W06 (Jerónimo) y PEN-W07 (¿"Deméter" con tilde?).
2. **Consolidar** (06_plan_web §7):
   - la épica E10 en `backlog.md`;
   - D-W en `decisiones.md`, PEN-W en `pendientes.md` y R-W en `riesgos.md`;
   - las constantes `WEB_*` en `constantes.md`;
   - la división de T-605;
   - una fila en el índice de esta bitácora y en `00_INDICE.md`.

   No se hizo ahora para no chocar con quien edita `05_plan/`.
3. El usuario activa FLUX en Hugging Face, y luego T-621 (los fondos).
4. Arrancar W0: T-610 (A) y T-612 (B) en paralelo.

## Actualización, mismo día
- **El usuario aprobó:**
  - que toda la mitad de la portada sea el enlace (D-W10);
  - "Deméter" con tilde (D-W11);
  - D-W06: el relay pasa a la web y T-605 se divide.
- **Hugging Face:** `black-forest-labs/FLUX.1-schnell` ya no aparece en el buscador de Spaces del MCP. Se recomiendan `evalstate/flux1_schnell` para los borradores y `black-forest-labs/FLUX.2-klein-9B` para la versión final. Se revisaron con el MCP: los dos son Spaces de Gradio con la etiqueta `mcp-server`.
- **Pull de los cambios de Jerónimo:** se revisó GitHub (`git fetch`, ramas, PR, forks y eventos del repo). **No hay nada suyo publicado.** `main` y `develop` siguen en `6c649f3`, sin PR ni otras ramas, y todos los pushes son de `apnauj`. No hubo nada que ajustar.
- El usuario confirmó el reparto (PEN-W09): **A para Juan Pablo y B para Jerónimo**. Se abrió el PR #1 (`docs/plan-web` → `develop`).

## Prueba de generación de imágenes (fondos de la portada)
- Los Spaces nuevos no cargan en la sesión de Claude Code hasta reiniciarla. Por eso se llamaron **directamente por la API de Gradio**, con el `HF_TOKEN` del usuario: es el mismo servicio que usa el MCP.
- **`evalstate/flux1_schnell`:** 4 imágenes de 1152×1280 (Hermes y Deméter, semillas 7 y 42), en unos segundos cada una. Quedaron en `generated_images/`, que no se versiona.
- **`black-forest-labs/FLUX.2-klein-9B`:** responde `event: error`, `data: null`, incluso con 1024×1024. El Space está `RUNNING` en `zero-a10g`. **La causa probable es la cuota de ZeroGPU de la cuenta gratuita** (V): la cuenta no es Pro.
- **Maquetas de la portada** (portátil y celular) con el oscurecido y el degradado de 07 §2 y el parche encima: `generated_images/maqueta_portada_*.webp`.
- **Evaluación:**
  - schnell da fondos correctos y coherentes con la paleta. Con el oscurecido funcionan bien detrás del parche.
  - Son más "planos" (de estilo vectorial) que la ilustración de los parches, ignoran "más oscuro abajo" (lo resuelve el degradado) y la pluma de Hermes sobra.
  - **Alcanzan para la portada.** Un modelo mejor daría más textura pintada.
- **Hallazgo:** los parches no tienen transparencia, y **la capa roja de Hermes sale del círculo**. Hace falta el PNG transparente original (PEN-W10).

## Documentos afectados
- Nuevos: `docs/08_gui/00_README.md` a `08_modelo_3d_futuro.md`, `docs/fuentes/marca/*` y `.mcp.json`.
- Modificado: `.gitignore`.
