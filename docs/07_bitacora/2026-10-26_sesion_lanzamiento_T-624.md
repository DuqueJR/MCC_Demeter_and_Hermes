---
fecha: 2026-10-26
tipo: sesion
ids: [T-624, T-622, T-631, T-634, D-W16, D-W17, D-W18, GS-13]
autor: documentador (Claude Opus 5.5)
rama: docs/T-624-lanzamiento
---
# Lanzamiento de T-624 (Estado de la misión, Telemetría y banner de alarma)

## Contexto
El usuario pidió lanzar T-624 del plan web ([06_plan_web](../08_gui/06_plan_web.md) §3) y dejar el PR listo para que él lo apruebe. La tarea estaba lista: T-622 y T-631 están integradas y no hay PR abierto en `src/mision/` ni en `src/entradas/` (`gh pr list` vacío al lanzar; `develop` en `1ec4e1b`). Es la tarea que cierra HW1, porque conecta el cliente a las páginas de misión ([cierre de T-631](2026-10-25_sesion_cierre_T-631.md)).

## Qué se hizo
- **Backlog:** T-624 pasa a `en curso`.
- **Alcance que se le da al agente `desarrollador`** (una rama `feature/T-624-*`, PR en borrador como candado de D-W16, que pasa a listo para revisión al terminar, sin merge):
  1. **Estado de la misión** (hueco `estado`, [03 §3.2](../08_gui/03_experiencia_y_pantallas.md)): la línea de fases pública con la T+ de cada paso, la T+ transcurrida y los objetivos que se encienden solos (despegue, fin de combustión, eyección, apogeo, aterrizaje y, en Deméter, cámaras grabando).
  2. **Telemetría** (hueco `telemetria`, 03 §3.3): la cuadrícula del celular, con unidades, números tabulares, coma decimal y el dato viejo en `--estado-sin-dato`.
  3. **Banner de alarma de descenso** (03 §4, D-W18): se lee de `alarmas.descenso_rapido` y se sostiene `WEB_ALARMA_SOSTENER_S`. La web no recalcula la alarma.
  4. **Conectar el cliente:** `iniciarCliente({ mision })` en las dos entradas, sin arrancarlo con `?ejemplo`.
  5. **Capturas:** regenerar las `*-ejemplo-*` de T-622, que quedaron viejas desde T-634 (propuesta 6 del [lanzamiento de T-634](2026-10-25_sesion_lanzamiento_T-634.md)), y capturas nuevas con `nominal`, `descenso_rapido` y "sin transmisión".
- **Prohibido:** `src/contrato/`, `src/datos/` (solo lectura), `src/mapa/`, `src/actitud/`, `package.json` y los tokens de `src/tema/`.

## Decisiones tomadas o propuestas (suposiciones del documentador)
- **El botón "Ver la simulación del vuelo"** (pregunta abierta 5 de [T-622](2026-10-25_T-622_armazon_mision.md)) va en la sección Estado de la misión, y solo con el estado principal "sin transmisión". Hoy la simulación solo la decide el servidor (`meta.modo`). Si el usuario no puede elegirla sin tocar `src/datos/`, **no se pone un botón muerto**: queda el texto y el agente reporta qué le falta al área D.
- **Fuera del alcance:** el tiempo estimado a la siguiente fase y el tiempo restante (GS-13, prioridad S), y el objetivo "motor caracterizado", que todavía no tiene fuente de datos. Quedan como propuestas.
- **Íconos de los objetivos:** `lucide-preact` (D-W17) o los que ya existen en `src/assets/`. No se generan imágenes nuevas. Esto atiende el ⏳ de la [revisión de T-621](2026-10-25_revision_T-621.md).

## Pendiente / siguiente paso
- Revisar el PR del agente: el diff dentro del alcance, `npm run build`, `npm test`, `npm run e2e` y las capturas.
- El usuario aprueba y hace el merge. Después: T-624 `hecha` en el backlog, HW1 revisado, `CLAUDE.md` al día y `graphify update .`.
- T-625 (Recuperación y Salud) espera a que se integre T-624, porque es la misma carpeta (`src/mision/`).

## Documentos afectados
- [backlog](../05_plan/backlog.md) (la fila de T-624)
