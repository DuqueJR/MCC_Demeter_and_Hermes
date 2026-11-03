---
fecha: 2026-11-03
tipo: tarea
ids: [T-611b, D-047, PEN-24]
autor: agente desarrollador (Sonnet 5.5)
rama: feature/T-611b-proto-version-4
---
# T-611b: `web-1` acepta `meta.proto_version = 4`

## Contexto
D-047 (aprobada por el usuario el 2026-11-03): `4` = `net_proto`, el protocolo de radio de Pablo. Es un valor nuevo de un campo existente y se trata como compatible, sin `web-2`. Resuelve PEN-24. La regla de `web-1` §0 dice que el documento, el esquema y los tipos cambian en el mismo PR. D-047 y la fila de T-611b están en el PR #36 (ya integrado en `develop`).

## Qué se hizo
- `docs/08_gui/05_contrato_datos_web.md`:
  - §2.1: el comentario de `proto_version` dice "2, 3 o 4 (… 4 = net_proto, D-047)";
  - encabezado: PA-15 aclara "y, desde D-047, también `4`", y un bloque nuevo "Cambio aceptado después de congelar" registra D-047.
- `gui/web/src/contrato/esquema.json`: `proto_version` pasa de `enum [2, 3]` a `[2, 3, 4]`.
- `gui/web/src/contrato/tipos.ts`: `proto_version?: 2 | 3 | 4`.
- `tools/web_datos/validacion.py`: `opciones=(2, 3, 4)` (el validador propio del generador replica el contrato).
- Pruebas:
  - `gui/web/pruebas/contrato.test.ts`: prueba nueva (2, 3 y 4 válidos; 0, 1, 5, `"4"` y `null` rechazados); la prueba existente de "valores fuera de lo permitido" ahora usa 5 en lugar de 4;
  - `tools/web_datos/pruebas/test_escenarios.py`: `test_proto_version_admite_2_3_y_4_pero_no_5`.
- Búsqueda de otros lugares que restrinjan `proto_version` (grep en `gui/web/src`, `gui/web/pruebas`, `tools/`): `validacion_extra.ts` no lo toca; ninguna vista lee `proto_version` ni `fw_version` (solo `tipos.ts` y `ejemplos.ts`), así que 4 se comporta como 2 sin cambiar código. El generador (`simulador.py`) sigue emitiendo 3 (Demeter) y 2 (Hermes), así que los JSONL de `gui/web/dev/datos/` no cambian.
- No se tocó: `docs/08_gui/00_README.md` (D-W13 es historia), `ejemplos.ts` (el ejemplo sigue en 3), ni los documentos del back.

## Evidencia
- `npm ci` en `gui/web/` y `npm test`: 19 archivos, **378 pruebas en verde y 1 omitida** (la omitida ya existía). `pruebas/contrato.test.ts`: 49 en verde.
- `npx tsc --noEmit` sin errores; `biome check` sobre lo tocado, limpio (se aplicó el formato de Biome a la prueba nueva).
- `python3 -m unittest discover -s tools/web_datos/pruebas -t .`: 67 pruebas, 65 en verde y **2 fallan, las dos ya fallaban antes** (`ConstantesReplicadas.test_fases_y_numeros_de_proyecto` y `test_web_coincide_con_el_documento`): leen `docs/02_requisitos/constantes.md`, que D-037/D-045 reescribió (`APOGEO_VZ_SALIDA_MS` y `WEB_ALARMA_SOSTENER_S` ya no tienen el formato que buscan). Reproducidas sobre un `git archive` de `origin/develop`. `ValidadorPropio`, 8 de 8 en verde (incluye la nueva).
- `pytest` no está instalado en el entorno; se usó `unittest`, que es lo que usan esas pruebas.
- La e2e (Playwright) no se corrió: no se tocó la interfaz.

## Decisiones tomadas o propuestas
Ninguna propuesta nueva. Se aplica D-047 tal cual.

## Problemas y cómo se resolvieron
- Las 2 fallas de `ConstantesReplicadas` no son de esta tarea. Se sugiere una tarea aparte para que `test_escenarios.py` lea el formato nuevo de `constantes.md` (o para decidir de dónde toman sus valores las pruebas de `web_datos`, ya que esa tabla pasó a describir el firmware de Pablo).

## Pendiente / siguiente paso
- T-661 (módulo `web1.py`) queda sin su bloqueo T-611b: puede emitir `proto_version: 4` y validarlo contra `esquema.json`.
- El documentador consolida: marcar T-611b como hecha en el backlog.

## Documentos afectados
- `docs/08_gui/05_contrato_datos_web.md`
