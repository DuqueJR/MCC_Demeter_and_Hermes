---
fecha: 2026-11-05
tipo: sesion
ids: [T-902, R-19, D-060]
autor: Claude (documentador), a pedido de Juan Pablo
rama: docs/verificacion-compilacion
---
# Plan de verificación de compilación del firmware

## Contexto
Un agente advirtió del riesgo de que el firmware no se había compilado completo para el chip. Casi todo el trabajo reciente (EKF a bordo D-060, calibración a bordo D-059, temperatura del suelo D-058, UART con la Pi D-054/055/056) se validó solo en el PC con `g++` + *stubs* o en Python, con la nota "sin compilar en la placa; Pablo compila y carga". La única compilación limpia registrada (`pio run -e hermes -e demeter`) fue en T-304 y quedó **antes** de integrar el EKF. No hay CI (sin `.github/workflows`).

## Qué se hizo
- Se creó `docs/05_plan/verificacion_compilacion_firmware.md`: un checklist para Pablo con los 7 environments, la preparación (submódulo, parche de LilyGO, `secrets.h`), el orden de compilación, qué vigilar en la salida (RAM/flash, `FW_GIT`, los símbolos `gpio_hold_*` de T-413) y qué hacer ante cada error típico.
- Se enlazó el plan desde la tarea T-902 del backlog.

## Evidencia
- Env verificados en los `platformio.ini`: cohete `demeter`, `hermes`, `demeter_campo`, `hermes_campo`, `hermes_sinhora`; tierra `tierra`, `tierra_campo`.
- Confirmados en el repo `firmware/common/net_proto/secrets.h.ejemplo`, `firmware/common/fw_version.py` y `firmware/common/lilygo_local.patch`; el submódulo apunta a `LilyGo-LoRa-Series`.
- `fw_version.py` embebe `FW_ENV` y `FW_GIT` (hash corto de 7, con `+` si hay cambios sin commitear), por eso conviene compilar desde un `develop` limpio.

## Decisiones tomadas o propuestas
- Ningún contrato cambia: es solo documentación y un procedimiento.

## Problemas y cómo se resolvieron
- El entorno del agente desarrollador bloquea `api.registry.platformio.org`, por eso la compilación real queda para una máquina con red (Pablo o un portátil).

## Pendiente / siguiente paso
- Que Pablo corra el plan y registre el resultado (hash de develop, versión de PlatformIO, RAM/flash y warnings) en una entrada nueva.
- El índice de esta bitácora (`README.md`) está desactualizado: faltan las entradas del 2026-11-04 y 2026-11-05 (UART Pi, calibración a bordo, EKF 19 estados, intrínsecos, temperatura suelo, T-605a, T-633, T-304 y EKF a bordo). Conviene ponerse al día aparte.

## Documentos afectados
- Nuevo: `docs/05_plan/verificacion_compilacion_firmware.md` y esta entrada.
- Tocados: `docs/05_plan/backlog.md` (fila T-902) y `docs/07_bitacora/README.md` (índice).
