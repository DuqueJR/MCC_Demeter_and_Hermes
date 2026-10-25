---
fecha: 2026-10-25
tipo: sesion
ids: [D-034, D-W12, D-W13, D-W14, D-W15, PA-15, PA-22, PA-23, PA-24, T-603, T-604, T-605, T-605a, T-640, T-660..T-670, PEN-21, R-16]
autor: Claude (documentador y diseñador) con Juan Pablo
rama: docs/web-compatibilidad
---
# Compatibilidad de los dos planes y dashboard de operación

## Contexto
Juan Pablo integró los PR #1 (plan web) y #2 (plan de dos sesiones del back, de Jerónimo) en `develop`. Antes se verificó que no tenían conflictos, haciendo los dos merges en un worktree aparte.
Juan Pablo pidió dos cosas:
- **"organizar de manera que todo quede bien y compatible"**;
- planear el **dashboard de operación**: "estético pero más funcional e informativo; se deben poder revisar todas las variables sin ningún problema".

## Qué se hizo

**Compatibilidad con el plan de dos sesiones:**
- **Carriles de la web renombrados a E (Experiencia, Juan Pablo) y D (Datos, Jerónimo)** (D-W12). Las letras A y B ya eran las sesiones del back, con las personas al revés.
- **`web-1`** acepta, antes de congelarse, las propuestas del back (D-W13):
  - `meta.proto_version` 2 o 3 y `salud.fw_version` (PA-15, por DP-07);
  - `estado.lkp` (PA-22).

  Se congela en H0 junto con C-05.
- **Plan web (06):**
  - el flujo de ramas de DP-01 (ramas de ≤ 1 día; "preguntar" o "mostrar"; D-W15);
  - T-641 depende de T-S06 y se puede probar con el reprocesamiento de un log crudo;
  - `SESION=web` para el hook `no_gui.py`;
  - scripts compatibles con Windows (Jerónimo) y macOS (Juan Pablo);
  - los riesgos R-W7 (carga de Jerónimo) y R-W8 (cambios de `web-1`).
- **Arquitectura (04):** el repetidor, el servicio local de C-05 y el relay sirven las mismas rutas de lectura; el cliente de datos es el mismo.
- **Las preguntas PA-15, PA-22, PA-23 y PA-24** del back quedaron marcadas como respondidas en su `11_preguntas_abiertas.md`.

**Consolidación en los documentos generales:**
- **`backlog.md`:**
  - T-603 y T-604 quedan reemplazadas por el dashboard de operación y la CLI;
  - T-605 se divide en **T-605a** (reenviador, back) y T-640 (relay);
  - **la épica E10** (T-610…T-670) apunta a `08_gui/06` y `08_gui/09`.
- **`decisiones.md`:** D-034 (el plan web y la división de T-603, T-604 y T-605).
- **`pendientes.md`:** PEN-21 (apunta a los PEN-W).
- **`riesgos.md`:** R-16 (competencia de tiempo con el back).
- **`constantes.md`:** la sección 9, "Web", con las `WEB_*`.
- **`estacion_terrena.md`:**
  - §2.3 apunta al dashboard de operación;
  - §2.4: la ingesta es `web-1`;
  - los temas D3 quedan resueltos.
- **`00_INDICE.md`:** la carpeta `08_gui/`, el plan de dos sesiones y los prefijos de ID de los dos planes.
- **El índice de la bitácora:** las entradas del 2026-10-25, incluidas las dos del back, que siguen en su carpeta hasta T-S14.
- **`gui/README.md`:** reescrito.

**El dashboard de operación:** se creó el borrador [08_gui/09_dashboard_operacion.md](../08_gui/09_dashboard_operacion.md) (D-W14), con:
- los principios;
- la arquitectura: una cuarta entrada de la app, servida por C-05;
- 8 pestañas: Vuelo, Preparar, **Variables**, Gráficas, Enlace, Recuperación, Comandos y Post-vuelo;
- la seguridad de los comandos y las alarmas;
- la estética "consola";
- las tareas T-660…T-670;
- la cobertura de *Objetivos* §7;
- **12 preguntas** (PEN-W12).

## Decisiones tomadas o propuestas
- **Aprobadas por compatibilidad:** D-W12 y D-W15.
- **Propuesta para H0:** D-W13 (`web-1`).
- **Pedida por el usuario, con el detalle en borrador:** D-W14.
- **Consolidación:** D-034.

## Problemas y cómo se resolvieron
- **La tabla de preguntas del back:** una primera edición metió la respuesta como columna nueva. Se corrigió de inmediato y la respuesta quedó dentro de la celda de la pregunta.
- **Su `15_CLAUDE_md_propuesto` dice que "los dos usan Windows",** pero Juan Pablo usa macOS. Se agregó la regla de scripts multiplataforma en la web. **Hay que corregirlo en su plan** (lo hace Jerónimo).

## Pendiente / siguiente paso
1. Las respuestas a las 12 preguntas de 09 §9 (PEN-W12).
2. H0 (26 de octubre): congelar `web-1` junto con C-05; T-610 y T-612 arrancan.
3. Jerónimo: confirmar que su servidor local sirve `gui/web/dist/operacion/` (09 §9, pregunta 12) y corregir el "los dos usan Windows".

## Documentos afectados
- **`docs/08_gui/`:** 00, 04, 05, 06 y el nuevo 09.
- **`docs/05_plan/`:** `backlog.md`, `pendientes.md`, `riesgos.md` y `dos_sesiones/11_preguntas_abiertas.md`.
- **`docs/04_diseno/`:** `decisiones.md` y `estacion_terrena.md`.
- **El resto:** `docs/02_requisitos/constantes.md`, `docs/00_INDICE.md`, `docs/07_bitacora/README.md` y `gui/README.md`.
