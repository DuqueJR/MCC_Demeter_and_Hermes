---
fecha: 2026-10-25
tipo: tarea
ids: [T-611, T-612, D-W19]
autor: desarrollador (Claude)
rama: fix/T-611-vel-nulable
---
# Fix de T-611: estado.vel nulable (D-W19)

## Contexto
En develop, `npm test` de gui/web fallaba en 12 pruebas (una por JSONL de T-612, 36 líneas): los `estado` en PREFLIGHT, antes del fix de GNSS, traen `pos: null, vel: null` y el esquema exigía `vel` como objeto.

## Qué se hizo
- `esquema.json`: `estado.vel` es `anyOf [objeto, null]`, igual que `pos`.
- `tipos.ts`: nueva interfaz `Vel` y `vel: Vel | null`.
- `validacion_extra.ts`, `estado_pagina.ts`, `api.ts`: no leen `vel` (grep sobre src/, pruebas/ y e2e/); sin cambios.
- `contrato.test.ts`: vel null se acepta; texto, número, lista, objeto incompleto o con campo extra se rechaza.
- No se tocaron `tools/web_datos/` ni los JSONL.

## Evidencia
- `npm test`: 4 archivos, 76 pruebas pasan, ninguna saltada; las 12 `valida *.jsonl` corren y pasan.
- `npm run build`: OK (tsc, colores, vite, aislamiento).
- `npm run e2e`: 21 pasan. Una primera corrida en frío falló 2 de `tokens.spec.ts` (página de desarrollo en el puerto 5174); no se repitió en dos corridas más. Parece arranque en frío del servidor de Vite, ajeno a este fix.
- Commits: d37d3b5 (test), y el fix justo antes.
- No hay otro campo que el esquema rechace en los JSONL.

## Decisiones tomadas o propuestas
Aplica D-W19 (docs en el PR #13). Sin propuestas nuevas.

## Pendiente
Los datos no cambian; el documentador consolida la errata.
