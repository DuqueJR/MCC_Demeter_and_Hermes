---
id: dos_sesiones_leeme
estado: propuesta (aprobada para crear el 2026-10-25 por Jerónimo; los contratos y cambios siguen como propuesta hasta promoverse)
actualizado: 2026-10-25
depende_de: [plan_maestro, backlog, flujo_trabajo, decisiones]
---
# Plan de dos sesiones (Jerónimo y Juan Pablo)

Esta carpeta organiza el trabajo **en paralelo** de dos personas, cada una con su cuenta de Claude y sus propias sesiones de Claude Code, sobre el **back-end** de Hermes y Demeter: firmware de vuelo, enlace LoRa, módem, servicio de tierra, VisionPack y datos.

- **No reemplaza** el plan existente ([plan_maestro](../plan_maestro.md), [backlog](../backlog.md), [plan_pruebas](../plan_pruebas.md)). Es **una capa de coordinación** encima: quién es dueño de qué, qué contratos se fijan primero, cuándo se sincroniza, cómo se comparte la placa y cómo arranca cada sesión.
- **No toca nada existente.** Las correcciones aprobadas a los documentos existentes están descritas en [12_cambios_a_aplicar_en_lo_existente.md](12_cambios_a_aplicar_en_lo_existente.md) y se aplican después, en otra tarea, con aprobación aparte.
- **La GUI y el dashboard están fuera de alcance**: los lleva otro plan. Aquí solo se define el back-end que la GUI consumirá ([06_contratos/05_api_backend_tierra.md](06_contratos/05_api_backend_tierra.md)).

## Orden de lectura

| # | Archivo | Para qué |
| --- | --- | --- |
| 1 | [01_punto_de_control.md](01_punto_de_control.md) | Estado del proyecto al 2026-10-25: sistemas, hardware, viabilidad, requisitos, huecos y riesgos |
| 2 | [02_metodo_trabajo.md](02_metodo_trabajo.md) | Cómo se trabaja en pareja con agentes y por qué (con fuentes) |
| 3 | [03_plan_maestro.md](03_plan_maestro.md) | Hitos H0–H4, fases, bloques diarios, dependencias, criterios y recortes |
| 4 | [04_plan_sesion_A.md](04_plan_sesion_A.md) / [05_plan_sesion_B.md](05_plan_sesion_B.md) | El plan de cada sesión |
| 5 | [06_contratos/](06_contratos/) | Las interfaces entre sesiones y sistemas (borradores) |
| 6 | [07_pruebas_y_placas.md](07_pruebas_y_placas.md) | Qué se prueba sin placa, el calendario de la placa y cómo cuidarla |
| 7 | [08_sincronizacion_y_merge.md](08_sincronizacion_y_merge.md) | Sincronizaciones, merges y revisión cruzada |
| 8 | [09_decisiones.md](09_decisiones.md), [10_riesgos.md](10_riesgos.md), [11_preguntas_abiertas.md](11_preguntas_abiertas.md) | Registros del plan |
| 9 | [12_cambios_a_aplicar_en_lo_existente.md](12_cambios_a_aplicar_en_lo_existente.md) | Correcciones aprobadas, pendientes de aplicar |
| 10 | [13_prompt_arranque_A.md](13_prompt_arranque_A.md) / [14_prompt_arranque_B.md](14_prompt_arranque_B.md) | Lo que se pega al abrir cada sesión |
| 11 | [15_CLAUDE_md_propuesto.md](15_CLAUDE_md_propuesto.md) | Borrador del CLAUDE.md compartido, hooks, CI, skills y el agente revisor |
| — | [estado/](estado/) | Estado vivo: una ficha por sesión y la bitácora de la placa |
| — | [bitacora_2026-10-25_plan_dos_sesiones.md](bitacora_2026-10-25_plan_dos_sesiones.md) | La entrada de bitácora de la sesión que creó esta carpeta |

## Sesiones

| Sesión | Persona | Tema |
| --- | --- | --- |
| **A** | Jerónimo | Enlace, tiempo, tierra y Pi |
| **B** | Juan Pablo | Adquisición, log y decisión |

## Convenciones de esta carpeta

- Se siguen las reglas de [00_INDICE](../../00_INDICE.md): enlaces Markdown relativos, frontmatter, hechos frente a suposiciones (`(P)`, `(V)`, ⚠️, ❓).
- Etiquetas de evidencia: **[repo]** con la ruta, **[inferencia]**, **[por verificar]**.
- IDs propios, para no chocar con los del plan existente:
  - `T-S…` = tarea nueva de este plan;
  - `DP-…` = decisión del plan;
  - `RP-…` = riesgo del plan;
  - `PA-…` = pregunta abierta;
  - `C-…` = contrato de [06_contratos/](06_contratos/).
- Los IDs existentes (T-xxx, P-xx, D-xxx, R-xx, PEN-xx) se citan tal cual.
