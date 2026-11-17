---
fecha: 2026-10-25
tipo: decision
ids: [DP-17, C-05, T-605, PA-02, PA-15, PA-22, PA-23, PA-24, RP-15]
autor: Claude (Claude principal, sesión de Jerónimo)
rama: docs/plan-doble-sesion
---
# Ajuste de C-05 al contrato `web-1` del plan web

> Hay que copiarla a `docs/07_bitacora/` junto con la entrada anterior ([12](12_cambios_a_aplicar_en_lo_existente.md) §10).

## Contexto

- Después de abrir el PR #2 apareció en el remoto la rama `docs/plan-web`: el plan de la GUI, con `docs/08_gui/`.
- Su `05_contrato_datos_web.md` define **`web-1`**, el JSON que debe producir el servicio de tierra.
- Nuestro C-05 v1 definía otro formato para lo mismo.
- Jerónimo pidió alinear C-05 y volver a plantear el PR contra `develop`.

## Qué se hizo

- **C-05 v2:**
  - adopta `web-1` como el único formato de salida del servicio de tierra (por misión, con las mismas rutas del relay);
  - agrega solo extensiones locales `/api/v1/local/` (comandos, paquetes crudos, diagnóstico), que nunca se reenvían;
  - define la CLI sobre esas rutas;
  - define el reenviador T-605a hacia el relay T-640 del plan web.
- **Se actualizaron las referencias:**
  - el punto de control;
  - el plan maestro y el plan de la sesión A;
  - las pruebas y la sincronización;
  - C-01 y C-02;
  - las decisiones (**DP-17**);
  - los riesgos (**RP-15**: las mismas dos personas llevan el back-end y la web);
  - las preguntas (PA-02 resuelta en parte; PA-15 actualizada; nuevas PA-22, PA-23 y PA-24);
  - los cambios pendientes;
  - el CLAUDE.md propuesto;
  - los prompts;
  - el estado de A.
- **No se tocó nada de `docs/plan-web`**: solo se leyó.

## Evidencia

- **Leído desde `origin/docs/plan-web`:**
  - `docs/08_gui/05_contrato_datos_web.md` (`web-1`: `meta`, `estado`, `salud`, `estacion`, `evento`, `backfill`, `snapshot`, ingesta por lotes);
  - `04_arquitectura_web.md` §4: T-605a (el reenviador) en `estacion/`, T-640 (el relay) en el plan web;
  - `06_plan_web.md`: los carriles A/B (Juan Pablo y Jerónimo), y que la web se pausa si el back-end se atrasa.
- **El ejemplo de `web-1` usa `proto_version: 2`**; con DP-07 será 3 (PA-15).

## Decisiones tomadas o propuestas

- **DP-17**, aprobada por Jerónimo. Se congela junto con `web-1` (T-611 del plan web).

## Pendiente / siguiente paso

- Proponerle al plan web el campo opcional `lkp` (PA-22) y el uso de `/api/v1/local/` por el dashboard local (PA-23).
- Avisar de PROTO_VERSION 3 (PA-15).
- Coordinar el orden de integración de `.gitignore` (PA-24).

## Documentos afectados

Solo los de `docs/05_plan/dos_sesiones/`.
