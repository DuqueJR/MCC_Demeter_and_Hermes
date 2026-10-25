---
fecha: 2026-10-25
tipo: sesion
ids: [T-631, T-624, T-623, T-625, T-626, T-634, T-640, T-660, T-661, T-621, D-036]
autor: documentador (Claude Opus 5.5)
rama: docs/cierre-T-631
---
# Cierre de T-631, el grafo y la siguiente tarea

## Contexto
Jerónimo integró los PR #23 (T-631) y #24 (su [consolidación](2026-10-25_sesion_consolidacion_T-631.md)). Pidió tres cosas:
- actualizar la documentación;
- actualizar el grafo;
- recomendar la siguiente tarea, sabiendo que Juan Pablo está con T-621 y revisando las tareas que ya quedaron listas.

## Qué se hizo
- **[Backlog](../05_plan/backlog.md):**
  - T-631 hecha (PR #23 y #24);
  - quedan listas T-624, T-625, T-626 y T-634.
- **`CLAUDE.md`, sección "Estado":** ya no dice "todavía no hay código propio". Ahora dice qué hay integrado: la web y `tools/web_datos/`.
- **Grafo (D-036), en la carpeta principal, sobre `develop` en `88f0ac7`:**
  1. `graphify update .` (AST): de 1267 a 1559 nodos.
  2. `/graphify . --update` (semántico):
     - 11 documentos cambiados, en un solo bloque, con un subagente que leyó todos los archivos hasta la última línea;
     - 183 nodos y 392 aristas nuevos.
  3. **Resultado:** 1690 nodos, 3525 aristas y 83 comunidades, sin aristas colgantes ni aristas sin extremo.
- **Worktrees:** se borraron los de T-631 (el del agente) y `docs/consolidar-T-631`, porque ya están integrados.

## Problemas y cómo se resolvieron
- **El grafo se negó a sobrescribir `graph.json`** porque se "perdían" 28 nodos semánticos.
  - Los 28 eran de los tres documentos que se volvieron a extraer: el backlog, 04 y la agenda. Solo cambiaron de ID (por ejemplo, `backlog_t701` pasó a `backlog_t_701`).
  - Se escribió con `force=True` después de comprobarlo.
- **Las 3 imágenes nuevas** (`src/assets/`: el logo de la EIA y los dos parches) **no se extrajeron.** Quedan sin marcar en el manifiesto, así que el próximo `--update` las vuelve a intentar.
- **Nombres de las comunidades:** se reutilizaron los nombres anteriores cuando la mayoría de los nodos de una comunidad ya tenía uno. Las comunidades nuevas quedaron con el nombre de su nodo central (por ejemplo, `cliente.test.ts`). Se pueden renombrar con `graphify label`.

## Siguiente tarea: el análisis

**Lo que ya está listo** (sus dependencias están hechas), en el orden de prioridad de D-W16 (S+, luego M, luego S):

| Tarea | Pri | Área y carpeta | ¿Se puede ya? |
| --- | --- | --- | --- |
| T-660, entrada y tema "consola" del dashboard de operación | S+ | E: `operacion/`, `src/operacion/` y una variante de `src/tema/` | Sus dependencias están hechas, pero el calendario la pone **después de HW1**. Además, toca los tokens de `src/tema/`, que son contrato y necesitan el acuerdo de los dos |
| T-661, cliente local | S+ | D | **No:** C-05 sigue en borrador |
| **T-624, Estado de la misión, Telemetría y banner** | **M** | E: `src/mision/` y `src/entradas/` | **Sí** |
| T-623, contenido provisional | M | E: `src/contenido/` | Sí, pero los textos los revisa el usuario (PEN-W02, PEN-W03) |
| T-625, Recuperación y Salud | M/S | E: `src/mision/` | Sí, pero **no en paralelo con T-624** (la misma carpeta) |
| T-626, Los ojos de Deméter | S | E: `src/mision/` | Lo mismo |
| T-634, Actitud 2D | S | D: `src/actitud/` | Sí, en paralelo con cualquiera de E |
| T-640, relay público | S | D: `gui/relay/` | Antes hay que decidir D1, D3 y D7 de la [agenda](../08_gui/10_agenda_H0_web-1.md) |
| T-633, gráficas | S | D | **No:** espera a D5 y D6 |

**T-621 no choca con nada de esto.** Son assets en `src/assets/` y no es código.

**Recomendación: T-624.**
1. **Es la tarea M de mayor valor que está lista.** Es la primera sección que pinta datos en vivo: la línea de fases, los objetivos con su T+ y el banner de descenso rápido.
2. **Cierra HW1** (29 de octubre). De HW1 solo falta que "las páginas de misión muestran la barra en vivo desde el repetidor". Eso es conectar `iniciarCliente({ mision })` en las entradas, que se anotó dentro de T-624.
3. **Desbloquea lo que sigue:**
   - T-644, el pulido para el celular;
   - T-663, Vuelo en el dashboard, que la reutiliza;
   - y, después de HW1, el dashboard (T-660 y siguientes).
4. **Es la primera vez que se usa el cliente de T-631 en una página real.** Si algo falla, conviene saberlo antes de construir encima.

**En paralelo, si hay alguien libre:** T-634 (`src/actitud/`, área D). No comparte carpeta con T-624 ni con T-621.

**Después:**
- T-625 (cuando termine T-624, porque es la misma carpeta);
- T-623, que necesita los textos del usuario;
- el `fix/T-632-*` de la prueba de los gestos.

**Antes de T-640 y T-633:** resolver D1, D3, D5, D6 y D7 de la agenda.

## Pendiente / siguiente paso
1. **Lanzar T-624** con el agente `desarrollador` y tomarla con un PR en borrador (D-W16).
2. **Resolver la sección D de la agenda** (Juan Pablo y Jerónimo).
3. **`fix/T-632-*`:** la e2e de los gestos (`mapa.spec.ts:196`), que falla en `develop`.
4. **Extraer las 3 imágenes de `src/assets/`** en el próximo `/graphify . --update`, cuando T-621 agregue las demás.

## Documentos afectados
- `docs/05_plan/backlog.md`
- `CLAUDE.md` (Estado)
- `docs/07_bitacora/README.md`
