---
fecha: 2026-11-03
tipo: tarea
ids: [T-611c, D-W18]
autor: desarrollador (Claude Sonnet 5.5)
rama: fix/T-611c-web-alarma-sostener
---
# T-611c: replicar `WEB_ALARMA_SOSTENER_S` en `tools/web_datos/constantes.py`

## Contexto
`constantes.md` §9 define `WEB_ALARMA_SOSTENER_S` = 10 (D-W18) y la prueba `test_web_coincide_con_el_documento` exige que cada `WEB_*` exista en `constantes.py` con el mismo valor. Faltaba y la prueba fallaba en `develop`.

## Qué se hizo
- Se agregó `WEB_ALARMA_SOSTENER_S = 10` en la sección 2 (Web) de `tools/web_datos/constantes.py`, después de `WEB_RECONEXION_MAX_S` (el orden del documento).
- Se revisó la web: `gui/web/src/datos/constantes.ts:22` ya la replica con 10 y la usa `gui/web/src/mision/alarma.ts`. No se tocó.
- No se tocó `constantes.md`.

## Evidencia
`python3 -m unittest discover -s tools/web_datos/pruebas -t .` desde la raíz: 66 pruebas, 65 en verde. Antes del cambio fallaban 2 (esta y la de abajo).
- `test_web_coincide_con_el_documento`: ahora pasa.
- `test_fases_y_numeros_de_proyecto`: sigue fallando (`APOGEO_VZ_SALIDA_MS` no está en `constantes.md`). Depende del PR #39 (`docs/consolidar-t660-t611b`) y no se arregló aquí.

## Problemas y cómo se resolvieron
Ninguno.

## Pendiente / siguiente paso
Cuando el PR #39 esté en `develop`, la suite debe quedar completa en verde (el backlog espera 67 pruebas).

## Documentos afectados
Ninguno (solo `tools/web_datos/constantes.py`).
