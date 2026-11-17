---
fecha: 2026-10-25
tipo: sesion
ids: [DP-01, DP-02, DP-03, DP-04, DP-05, DP-06, DP-07, DP-08, DP-09, DP-15, D-028, D-022, PEN-17, PEN-18]
autor: Claude (Claude principal, sesión de Jerónimo), con dos subagentes de solo lectura
rama: docs/plan-doble-sesion
---
# Plan de trabajo de dos sesiones (Jerónimo y Juan Pablo)

> Esta entrada vive en `docs/05_plan/dos_sesiones/` porque la sesión tenía prohibido escribir fuera de esa carpeta. Hay que copiarla a `docs/07_bitacora/` ([12](12_cambios_a_aplicar_en_lo_existente.md) §10).

## Contexto

Jerónimo clonó el repo y pidió:
1. una revisión completa (Etapa 1);
2. una investigación sobre cómo trabajar en pareja con agentes de Claude Code (Etapa 2);
3. una propuesta (Etapa 3);
4. crear el plan de dos sesiones en una carpeta nueva, sin tocar nada existente, en una rama nueva desde `develop` (Etapa 4).

**Fuera de alcance:** la GUI (es de otro plan).

## Qué se hizo

- **Etapa 1:**
  - Lectura completa de `docs/`, las fuentes y los README; muestreo del código de la Pi.
  - Dos subagentes de solo lectura: la identidad del hardware y la viabilidad de vuelo, con datasheets y fuentes oficiales.
  - Recálculo del tiempo en el aire.
- **Respuestas del equipo** (Jerónimo, 2026-10-25):
  - el alcance es solo el back-end;
  - la CLI del operador está aceptada;
  - trabajan en el mismo lugar;
  - hay dos Supreme V3.1 y una V1.2, sin repuestos;
  - la lista de hardware sale de leer los chips (PMU TG28-ESP, RTC BM8563 con batería, PSRAM APS6404L);
  - se mantiene el modelo de roles.
- **Etapa 2:** investigación con fuentes (documentación de Claude Code, Anthropic Engineering, Fowler, trunk-based, Nygard, Memfault, PlatformIO, Espressif). Resultado en [02_metodo_trabajo.md](02_metodo_trabajo.md).
- **Etapa 3:** propuesta, corregida una vez con las respuestas del equipo y aprobada por Jerónimo.
- **Etapa 4:** se creó la rama `docs/plan-doble-sesion` desde `develop` (`6c649f3`) y los documentos de esta carpeta, en 6 commits.

## Evidencia

- `develop` = `main` = `6c649f3` (verificado con `git fetch` antes de crear la rama). El árbol estaba limpio.
- **Tiempo en el aire** (SF6, BW500, CR 4/5, preámbulo 8, cabecera explícita, CRC): 14 B = 6,688 ms · 44 B = 13,088 ms · 58 B = 15,648 ms · 59–61 B = 16,288 ms. Por eso el máximo en 16 ms es 58 B.
- **El código de la Pi:** `demeter_telemetryd.py:39` solo mapea ARM, START_REC, TOUCHDOWN y ABORT, y `health_check` no tiene manejador (`:210`). Confirma los bloqueantes 1 y 2 de la revisión.

## Decisiones tomadas o propuestas

| ID | Estado |
| --- | --- |
| DP-01 (reemplaza a D-028), DP-02, DP-03, DP-04 | Aprobadas por Jerónimo y Juan Pablo (según lo comunicado por Jerónimo) |
| DP-05 a DP-09 | Correcciones a contratos, aprobadas; las que dependen de terceros están marcadas |
| DP-15 (CLI) | Aprobada |
| DP-11 a DP-14 | Aprobadas con la propuesta; las ratifica Juan Pablo en H0 |
| DP-10, DP-16 | Propuestas |

El detalle está en [09_decisiones.md](09_decisiones.md).

## Problemas y cómo se resolvieron

- **Las reglas de la sesión impedían tocar lo existente.** Las correcciones aprobadas quedaron descritas en [12_cambios_a_aplicar_en_lo_existente.md](12_cambios_a_aplicar_en_lo_existente.md), para T-S14.
- **D-029 pide la bitácora en `07_bitacora/`.** Quedó aquí, con la instrucción de copiarla.

## Pendiente / siguiente paso

- **Jerónimo:** revisar la rama y abrir el PR (no se hizo push).
- **Antes de H0:** responder PA-01, PA-02, PA-04 a PA-07, PA-12 a PA-14 y PA-20 ([11](11_preguntas_abiertas.md)).
- **25 por la tarde:** C-02 a C-05 por sesión. **26 por la mañana:** la sesión de pareja con la placa.
- **Con aprobación aparte:** T-S10 (integración continua), T-S11 (hooks, skills, `revisor`) y T-S14 (aplicar los cambios a lo existente).

## Documentos afectados

Solo se crearon archivos en `docs/05_plan/dos_sesiones/`. No se modificó ningún archivo existente.
