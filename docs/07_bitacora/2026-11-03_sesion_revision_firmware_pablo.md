---
fecha: 2026-11-03
tipo: sesion
ids: [D-037, D-038, D-039, D-040, D-041, D-042, D-043, D-044, T-007, T-008, T-410, T-411, T-412, T-413, T-414, T-415, T-416, T-602, PEN-22, PEN-23, PEN-24, PEN-25, PEN-26, R-17, R-18, R-19, R-20, R-21]
autor: Claude (documentador), con Juan Pablo
rama: claude/trusting-dirac-k7vp9e
---
# Revisión del firmware de Pablo y replan

## Contexto

- Pablo Tilano compartió su repo [ptilanom/DEMETER](https://github.com/ptilanom/DEMETER) (un solo commit, `17139b2`, del 2026-11-03). Trae el firmware de los dos cohetes y de la estación, **ya funcionando en hardware**, más las herramientas de PC.
- Nosotros solo teníamos la web y los documentos.
- Juan Pablo pidió revisarlo todo, decir qué cambia frente a nuestro plan y dejar listo cómo integrar sus avances.

## Preguntas y respuestas (Juan Pablo)

| Pregunta | Respuesta |
| --- | --- |
| ¿Quién es el dueño del firmware y dónde vive? | **Pablo, en su repo;** nosotros sincronizamos copias |
| Si su código contradice nuestros contratos, ¿qué gana? | **El código de Pablo:** los contratos se reescriben para describir su sistema |
| ¿Cómo entra el código? | **Copiado en la estructura de D-032,** con las carpetas ordenadas |
| ¿En qué trabajamos nosotros? | Ordenar el código de Pablo, servicio de tierra + dashboard, web pública, Pi y huecos del firmware |
| ¿6 u 8 de noviembre? | **El 8** (el 6 es el viaje) |
| ¿Qué tan profundo se ordena? | **Solo las carpetas;** los archivos quedan intactos |
| ¿Quién ejecuta la importación? | **El agente `desarrollador`,** con una tarea escrita por el documentador |
| ¿Quién lee la revisión? | Solo Juan Pablo (en el repo) |

## Qué se hizo

- **Se clonó y revisó el repo de Pablo:** `mission.cpp`, `net_radio.cpp`, `net_proto.h`, `rec_format.h`, `core_selftest.cpp`, `gnd_rx.cpp`, `gnd_cmd.cpp`, `dashboard.py` y su `CLAUDE.md`.
- **La rama se rehízo sobre `develop`:** salía de `main`, que estaba desactualizado (con 189 commits menos: la web y el plan de dos sesiones).
- **Documentos nuevos:**
  - [revision_firmware_pablo](../06_revisiones/revision_firmware_pablo.md);
  - [cambios_por_firmware_pablo](../05_plan/cambios_por_firmware_pablo.md);
  - [sincronizacion_firmware_pablo](../05_plan/sincronizacion_firmware_pablo.md);
  - [formato_log](../04_diseno/formato_log.md).
- **Contratos reescritos** (la v1 se movió a `99_archivo/diseno_v1/`):
  - [enlace_lora_tdma](../04_diseno/enlace_lora_tdma.md);
  - [protocolo_paquetes](../04_diseno/protocolo_paquetes.md), con el USB de tierra y la correspondencia con `web-1`;
  - [maquina_estados](../04_diseno/maquina_estados.md);
  - [firmware_vuelo](../04_diseno/firmware_vuelo.md);
  - [buses_y_pines](../03_hardware/buses_y_pines.md).
- **Actualizados:**
  - [constantes](../02_requisitos/constantes.md) (§2–§8);
  - [visionpack_integracion](../04_diseno/visionpack_integracion.md) (pines);
  - [estacion_terrena](../04_diseno/estacion_terrena.md) y C-01 a C-05 (avisos de reemplazo);
  - [decisiones](../04_diseno/decisiones.md) (D-037 a D-044 nuevas; 17 marcadas como reemplazadas o cerradas);
  - [backlog](../05_plan/backlog.md) (E11 y los estados de E0–E8);
  - [pendientes](../05_plan/pendientes.md) (cinco resueltos, PEN-22 a PEN-26 nuevos);
  - [riesgos](../05_plan/riesgos.md) (R-01 y R-14 cerrados, R-17 a R-21 nuevos);
  - `00_INDICE.md`, `plan_maestro.md` y `CLAUDE.md`.

## Evidencia

- **Commit revisado:** `ptilanom/DEMETER@17139b2`.
- **Submódulo de LilyGO:** `1991b1e`.
- **La simulación de Demeter de Pablo es idéntica a la nuestra** (md5 `f00556cf…`); **la de Hermes es nueva**.
- Los cuatro directorios `bloque*`/`logger_bloque5` difieren de `tbeam_fw/src`: son versiones viejas.

## Decisiones

- **Aprobadas por el usuario:** D-037 (adopción y sincronización), D-038, D-039, D-040, D-042, D-043 y D-044. Describen el sistema de Pablo.
- **Propuesta:** D-041 (operar con `dashboard.py` y alimentar la web desde su archivo de sesión). Falta confirmarla con Jerónimo (PEN-25).

## Hallazgos principales (detalle en la revisión)

- **C1:** no hay detección de BOOST. Sin LAUNCH no se registra, y en vuelo las protecciones de los comandos no actúan.
- **C2:** no hay persistencia ante un reinicio.
- **C3:** nada termina el vuelo.
- **A1–A7:**
  - no hay buzzer ni encendido de la Pi;
  - no hay UART con la Pi;
  - TELEM no trae la altura barométrica;
  - falta la prueba de alcance;
  - no hay versión de protocolo;
  - la clave HMAC es un punto único de falla;
  - solo compila en el PC de Pablo.

## Pendiente / siguiente paso

1. T-007, la importación (se lanza al agente `desarrollador` en esta sesión).
2. Hablar con Pablo: PEN-22, PEN-23 y PEN-26. **T-410 (BOOST) es lo más urgente.**
3. T-415 (alcance) y T-701 (la Pi) el 4 de noviembre.
4. PEN-24 y PEN-25 con Jerónimo (`web-1` y D-041).

## Documentos afectados

Todos los listados en "Qué se hizo".
