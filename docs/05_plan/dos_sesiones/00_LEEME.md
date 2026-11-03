---
id: dos_sesiones_leeme
estado: propuesta (aprobada para crear el 2026-10-25 por Jerónimo; los contratos y cambios siguen como propuesta hasta promoverse)
actualizado: 2026-10-25
depende_de: [plan_maestro, backlog, flujo_trabajo, decisiones]
---

> **⚠️ 2026-11-03: este plan quedó superado en buena parte** por la adopción del firmware de Pablo (D-037, D-045, D-046). **Lo vigente es el [backlog](../backlog.md), E10–E12, y [brechas_objetivos](../brechas_objetivos.md).**
>
> **Qué pasa con cada sesión:**
>
> | Sesión | Ya no aplica (lo hizo Pablo o quedó reemplazado) | Sigue / nuevo |
> | --- | --- | --- |
> | **A, Jerónimo** (enlace, tiempo, tierra y Pi) | C-03 (trama USB), el módem T-601, el módem falso T-S07, la CLI T-S04, el servicio T-602 separado, T-501 TDMA, T-S12 | **El dashboard como estación** (E10: T-661 `web1.py`, T-662 API local y páginas, T-605a reenviador) · **la Pi** (T-701, T-705, T-704, y T-702 con el firmware) · la web, carril D (T-633, T-640, T-642 a T-645) |
> | **B, Juan Pablo** (adquisición, log y decisión) | C-02, C-04, T-101 a T-107, T-201 a T-203, T-002 a T-006 | **El firmware:** T-410, T-413, T-411, T-412, T-414, T-417 y T-420 a T-425 · T-305 replay · T-415 alcance · T-416 calibración |
>
> - C-01 (propiedad de carpetas) sigue para `estacion/`, `gui/`, `visionpack/` y `tools/`.
> - `firmware/` es de B, y Pablo revisa sus PR.
> - Las fichas de `estado/` las actualiza cada uno.
# Plan de dos sesiones (Jerónimo y Juan Pablo)

Esta carpeta organiza el trabajo **en paralelo** de dos personas, cada una con su cuenta de Claude y sus propias sesiones de Claude Code, sobre el **back-end** de Hermes y Demeter: firmware de vuelo, enlace LoRa, módem, servicio de tierra, VisionPack y datos.

- **No reemplaza** el plan existente ([plan_maestro](../plan_maestro.md), [backlog](../backlog.md), [plan_pruebas](../plan_pruebas.md)). Es **una capa de coordinación** encima: quién es dueño de qué, qué contratos se fijan primero, cuándo se sincroniza, cómo se comparte la placa y cómo arranca cada sesión.
- **No toca nada existente.** Las correcciones aprobadas a los documentos existentes están descritas en [12_cambios_a_aplicar_en_lo_existente.md](12_cambios_a_aplicar_en_lo_existente.md) y se aplican después, en otra tarea, con aprobación aparte.
- **La GUI y el dashboard están fuera de alcance**: los lleva otro plan (rama `docs/plan-web`, carpeta `docs/08_gui/`). Aquí solo se define el back-end que la GUI consumirá ([06_contratos/05_api_backend_tierra.md](06_contratos/05_api_backend_tierra.md)). **Su salida es el contrato `web-1` del plan web** (DP-17).

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
| — | [bitacora_2026-10-25_ajuste_C-05_web-1.md](bitacora_2026-10-25_ajuste_C-05_web-1.md) | El ajuste de C-05 al contrato `web-1` del plan web (DP-17) |

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
