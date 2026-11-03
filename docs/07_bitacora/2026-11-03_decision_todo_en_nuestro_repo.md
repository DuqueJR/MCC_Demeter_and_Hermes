---
fecha: 2026-11-03
tipo: decision
ids: [D-037, D-041, D-045, D-046, D-047, PEN-22, PEN-23, PEN-24, PEN-25, PEN-26, T-008, T-009, T-410, T-411, T-412, T-413, T-414, T-417, T-420, T-421, T-422, T-423, T-424, T-425, T-305, T-415, T-416, T-660, T-661, T-662, T-663, T-664, T-665, T-666, T-611b, T-705, T-670, R-22]
autor: Claude (documentador), con Juan Pablo
rama: claude/trusting-dirac-k7vp9e
---
# Todo en nuestro repo, el dashboard de Pablo como el nuestro, y el plan completo

## Contexto

Después de la revisión del firmware de Pablo ([entrada anterior](2026-11-03_sesion_revision_firmware_pablo.md)) y de la importación (T-007, PR #35), Juan Pablo respondió las preguntas abiertas.

## Respuestas del usuario

1. **Todo lo que falte para los objetivos finales tiene que estar en nuestro plan.** Se le pueden mandar PR a Pablo sin problema (pero ver el punto 5).
2. **Pablo tiene las claves** → PEN-26 resuelto.
3. **El dashboard de operación propio es el de Pablo:** hay que articularlo y adaptarlo → D-046 (reemplaza a D-041).
4. **`proto_version = 4` en `web-1` está bien** → D-047.
5. **Cambio de decisión:** todo queda en nuestro repo, y luego se le explica a Pablo cómo correrlo como lo hacía → D-045 (reemplaza en parte a D-037). Con esto, PEN-22 ya no aplica y PEN-23 pasa a ser la tarea T-414.

## Qué se hizo

- **[brechas_objetivos](../05_plan/brechas_objetivos.md) (nuevo):** cada requisito (REG, HW, DAT, NAV, GS y la Pi) con su estado real (Pablo + nuestra web), lo que falta y la tarea que lo cierra.
- **[backlog](../05_plan/backlog.md):**
  - **E11 (firmware):** T-008, T-009, T-410 a T-414, T-417, T-420 a T-425 y la nueva T-702;
  - **E12 (operación y pruebas):** T-415, T-416, T-305 y T-670;
  - **E10 redefinido** (el dashboard de Pablo como estación y dashboard): T-660 (mover `tools/tbeam/` a `estacion/`), T-611b, T-661 (`web1.py`), T-662 (API local y páginas de misión), T-663 (Go/No-Go), T-664 (alarmas), T-605a, T-665 y T-666;
  - **E7:** T-705 (la Pi autónoma). T-602, la T-702 vieja y T-703 quedan reemplazadas.
- **[sincronizacion_firmware_pablo](../05_plan/sincronizacion_firmware_pablo.md):** ahora es "importación + guía para Pablo" (§5, que es T-009).
- **[decisiones](../04_diseno/decisiones.md):** D-045, D-046 y D-047; D-037, D-041 y D-043 actualizadas.
- **Contratos:** desde D-045, primero se cambia el documento y después el código (enlace, protocolo y constantes).
- **[requisitos](../02_requisitos/requisitos.md):** los estados, al día (D-042, D-039 y las tareas nuevas).
- **[pendientes](../05_plan/pendientes.md)** (PEN-22 a PEN-26 cerrados) y **[riesgos](../05_plan/riesgos.md)** (R-22, el alcance frente a 5 días).
- **Avisos** en 08_gui/09 y C-01; `CLAUDE.md`, el índice y la entrada anterior del plan.

## Decisiones

- **D-045:** nuestro repo es la fuente única; Pablo trabaja aquí y revisa los PR de firmware.
- **D-046:** el dashboard de operación es `dashboard.py`, adaptado. Es el dueño de los puertos, y además produce `web-1`, sirve la API local y las páginas de misión, el Go/No-Go y las alarmas, y le pasa los datos al relay. Solo escucha en 127.0.0.1.
- **D-047:** `web-1` acepta `proto_version = 4`.

## Pendiente / siguiente paso

1. **Revisar y hacer merge del PR #35 (T-007)**, y **compilar los tres envs en un portátil**: la sesión en la nube no llega al registro de PlatformIO.
2. Lanzar T-410 (BOOST) al `desarrollador` sobre `develop`, ya con T-007 integrada. Pablo revisa.
3. En paralelo: T-660 → T-661 → T-662 (dashboard), T-415 (alcance), T-701/T-705 (la Pi).
4. Pasarle a Pablo la guía (sincronización §5) y hacer T-008 si tiene commits nuevos.
5. **R-22:** no todo cabe antes del 8 de noviembre. Se ataca en orden M → S → C.

## Documentos afectados

Los listados en "Qué se hizo".
