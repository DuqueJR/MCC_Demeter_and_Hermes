---
fecha: 2026-11-03
tipo: tarea
ids: [T-660, D-043, D-045, D-046]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-660-estacion-dashboard
---
# T-660: ordenar la estación (`tools/tbeam/` a `estacion/`)

## Contexto
D-046: el dashboard de Pablo, adaptado, es nuestra estación y nuestro dashboard de operación. D-045: el firmware es nuestro. El PR #36 (plan) ya estaba integrado en `develop` (`9f70138`), así que los documentos se leyeron de la propia rama.

## Qué se hizo
- Rama `feature/T-660-estacion-dashboard` desde `origin/develop` (`9f70138`), en su propio worktree.
- `git mv` de `tools/tbeam/{dashboard.py, dashboard.html, tbget.py, tblog.py, calib.py, ekf.py, calib_demeter_nuevo.json, calib_hermes.json}` a `estacion/`. Los `.py` no se modificaron (el diff de git los marca como renombrados al 100 %).
- `tools/tbeam/` desaparece (su README se fusionó).
- `estacion/README.md`: fusiona el del servicio de tierra (ya no se hará) con el de `tools/tbeam/`: qué es, uso, herramientas, dependencias y qué viene (T-661 a T-664, T-605a).
- `firmware/README.md`: ya no es "copia que no se edita a mano"; es nuestro firmware (D-045), con el flujo (tarea, contrato primero, PR a `develop`, revisión de Pablo) y el enlace a `sincronizacion_firmware_pablo.md` §5. La ruta de las herramientas apunta a `estacion/`.
- `.gitignore`: `estacion/sesiones/` y `estacion/mision.json`.
- `tools/README.md` y `datos/logs_referencia/README.md`: revisados, no tenían rutas a `tools/tbeam` (el segundo solo cita el origen `tbeam_fw/tools/` en el repo de Pablo, que es correcto).
- Rutas cambiadas en el código: **ninguna**. `grep` de `tools/tbeam` en `.py`, `.html`, `.ini`, `.yml` y `.json` no encontró nada; los `.py` usan `HERE` / `__file__`.

## Evidencia
- `python3 estacion/tblog.py --help`, `calib.py --help` y `ekf.py --help`: salida 0 los tres (numpy, scipy y pyserial ya instalados).
- `python3 estacion/dashboard.py --demo --no-abrir --puerto 8799`: `GET /` responde 200 y `GET /api/state` responde 200 con JSON de los dos cohetes. El proceso se cerró al terminar.
- `git status` limpio; sin `sesiones/` ni `__pycache__` (se borró el generado por las pruebas).

## Decisiones tomadas o propuestas
Ninguna propuesta de cambio a contratos.

## Problemas y cómo se resolvieron
- El primer `git fetch` falló una vez por un bloqueo de ref (`origin/develop`); se repitió y funcionó.

## Pendiente / siguiente paso
- Los documentos mencionan `tools/tbeam/` y no se tocaron (fuera de alcance; los consolida el documentador): `CLAUDE.md` (tabla de estructura, fila `tools/`), `docs/05_plan/sincronizacion_firmware_pablo.md` §5 (tabla "Antes/Ahora") y la bitácora de T-007 (histórica, no se reescribe). También conviene actualizar la fila de `tools/` y la de `estacion/` en `CLAUDE.md`.
- Siguiente: T-661 (`web1.py`).

## Documentos afectados
`estacion/README.md`, `firmware/README.md`, `.gitignore`. Pendientes de actualizar por el documentador: `CLAUDE.md`, `sincronizacion_firmware_pablo.md` §5, `backlog.md` (T-660 a `hecha` tras el merge).
