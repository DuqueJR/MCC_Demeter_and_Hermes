---
fecha: 2026-10-25
tipo: sesion
ids: [T-612, T-611, T-610, T-613, T-630, PEN-W04, PEN-20]
autor: documentador (Claude Opus 5.5)
rama: docs/consolidar-T-612
---
# Consolidación de T-612 (generador de datos de la web)

## Contexto
El usuario pidió implementar T-612 y dejarla en PR para aprobarla él. El agente `desarrollador` la implementó (PR #8) y el usuario la integró en `develop` (`cd41977`). Esta entrada consolida el estado y clasifica las propuestas del agente. El detalle técnico y las cifras están en la [entrada del agente](2026-10-25_T-612_generador_datos_web.md).

## Qué se hizo
- **Lanzamiento:** el tipo de agente `desarrollador` no estaba registrado en esta sesión de Claude Code. Se lanzó un agente general con Sonnet y worktree propio, con la instrucción de seguir `.claude/agents/desarrollador.md` al pie de la letra. El flujo fue el mismo: rama `feature/T-612-generador-datos-web` desde `origin/develop`, 6 commits `[T-612]` y el PR hacia `develop` sin merge.
- **Verificación antes de integrar:** el PR #8 no compartía archivos con los otros PR abiertos (#7, T-611, y #9, revisiones y H0). Se podían integrar en cualquier orden.
- **Estado en el [backlog](../05_plan/backlog.md):**
  - T-610 hecha (PR #4), T-613 hecha (PR #6) y T-612 hecha (PR #8);
  - T-611 en curso (PR #7 abierto);
  - T-630 queda lista.
- **[tools/README](../../tools/README.md):** la fila de `web_datos/`. **[gui/README](../../gui/README.md):** dónde están los JSONL y cómo se regeneran.
- **Limpieza:** se borró el worktree del agente y su rama local, ya integrada.
- **Sin tocar, a propósito:** `CLAUDE.md`, `docs/08_gui/00_README.md`, `05_contrato_datos_web.md`, la agenda de H0 y el índice de esta bitácora. El PR #9 los edita, y tocarlos aquí habría generado conflictos.

## Evidencia
- PR #8 integrado: 27 archivos y 22 696 líneas agregadas, sin borrados.
- **Criterio de aceptación (lo informa el agente):**
  - apogeo de Deméter: 669,3 m en el JSONL frente a 669,321 m en la simulación, 0,02 m de diferencia (< 1 m);
  - eventos: diferencia máxima de 0,004 s (< 0,1 s);
  - pruebas: 66 en verde con pytest y con unittest, y 0 errores de `--validar` en los 12 archivos.

## Decisiones tomadas o propuestas
**Clasificación de las 10 propuestas del agente.** Ninguna se aplica aquí: los contratos no se tocan sin decisión.

| # | Propuesta del agente | Estado | Qué falta |
| --- | --- | --- | --- |
| 1 | `evento.fase` y `evento.activa` siempre presentes, con `null` si no aplican | **Ya cubierta:** la agenda de H0 (PR #9, punto B3) decide lo mismo | Nada |
| 1b | El evento `camaras` lleva el nuevo estado en `activa` | **Abierta** | Escribirlo en 05 §2.5 |
| 2 | Los códigos de `secundario` (Deméter) deben ser los de `StatusCode` de la Pi (RECORDING = 0x30), no el 12 del ejemplo de 05. Ningún documento fija los textos en español. | **Abierta, conviene antes de congelar** | Fijar la tabla código → texto en 05 o en `visionpack_integracion`, y corregir el ejemplo de 05 |
| 3 | `t_mas_s` desde LIFTOFF con 2 decimales, y `null` en ARMED | Coherente con 05 | Nada |
| 4 | Los eventos llevan el tiempo de la simulación, sin las ventanas de la máquina de estados (LANDED real unos 5 s después) | Informativa | Tenerla en cuenta en T-630 y T-631 |
| 5 | `q` con 5 decimales | **Abierta** | Fijar la precisión del cuaternión en 05 §0 |
| 6 | `proto_version` 3 y `fw_version` en Deméter; 2 y `null` en Hermes | Solo de ejemplo | Nada |
| 7 | En tierra, a 1 Hz, `seq` conserva los saltos reales | **Abierta** | Escribirlo en 05, junto con el punto B10 de la agenda (el `id` del SSE) |
| 8 | La alarma de descenso sin ventana: solo el umbral `ALARMA_DESCENSO_MS` | Depende de PEN-20 | Regenerar `descenso_rapido` si PEN-20 fija una ventana |
| 9 | 16 MB de JSONL versionados | **Aceptada** (el usuario integró el PR así) | Revisar si crecen |
| 10 | Hermes sintético: 0,75 de la altura de Deméter y retardo de 7 s, marcado `(P)` | Suposición marcada | Reemplazar al llegar la simulación de Hermes (PEN-W04 / PEN-07) |

## Problemas y cómo se resolvieron
- El tipo `desarrollador` no aparecía entre los agentes disponibles. Probablemente se registra al reiniciar Claude Code (suposición, no verificada). Se resolvió con un agente general que sigue la misma definición.

## Pendiente / siguiente paso
1. **Cuando se integren el #7 (T-611) y el #9 (cambios a 05):** validar los 12 JSONL contra `esquema.json` y contra la función de validación extra de la agenda (B6 y B7). El #9 cambia 05: entre otras cosas, la lista de campos que pueden ser `null`. Si los JSONL no validan, la corrección va en una rama `fix/T-612-*` (generador y JSONL regenerados). Conviene unificar `tools/web_datos/validacion.py` con esa validación para no mantener dos.
2. **Llevar a la agenda de H0 (o a 05) las propuestas abiertas 1b, 2, 5 y 7.** La agenda vive en el PR #9: se agregan después de integrarlo.
3. **Después de integrar el #9:**
   - agregar al índice de la bitácora (README) esta entrada y la del agente;
   - actualizar el "Estado" de `CLAUDE.md`, que todavía dice que no hay código propio.
4. **Sin probar:** el generador en macOS y con Python anterior a 3.14 (lo informa el agente).
5. **T-630** (el repetidor) ya se puede tomar.

## Documentos afectados
- `docs/05_plan/backlog.md` (el estado de T-610, T-611, T-612, T-613 y T-630)
- `tools/README.md`
- `gui/README.md`
