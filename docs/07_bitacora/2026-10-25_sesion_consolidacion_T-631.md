---
fecha: 2026-10-25
tipo: sesion
ids: [T-631, T-630, T-632, T-624, T-633, T-640, D-W18, R-W8]
autor: documentador (Claude Opus 5.5)
rama: docs/consolidar-T-631
---
# Consolidación de T-631 (cliente de datos de la web)

## Contexto
El usuario pidió implementar T-631 del plan web ([06_plan_web](../08_gui/06_plan_web.md) §3). La tarea estaba lista: T-611 y T-630 están integradas. Se lanzó el agente `desarrollador`, que abrió el **PR #23** hacia `develop`, sin merge. Esta entrada recoge la revisión y la verificación del PR, y clasifica las propuestas del agente. El detalle técnico está en la [entrada del agente](2026-10-25_T-631_cliente_datos.md), que llega a `develop` con el PR #23.

## Qué se hizo
- **Lanzamiento:**
  - el agente `desarrollador` en su worktree, con la rama `feature/T-631-cliente-datos` desde `origin/develop` (`fc8188f`);
  - 6 commits `[T-631]` y el PR #23.
- **Lo que se le dio al agente como decidido:**
  - A2-b de H0: solo se congela el lado de lectura de `api.ts`, y `alimentar` es interno del área D;
  - el `id` del SSE es opaco (D-W18);
  - la edad usa un reloj local, monotónico e inyectado;
  - las particularidades del repetidor que dejó la [consolidación de T-630](2026-10-25_sesion_consolidacion_T-630.md): `relay_caido` con 503, `meta` sin `id`, el snapshot que se reinicia al dar la vuelta, y `/salud` sin forma fija.
- **Suposición del documentador:** la costura entre el snapshot y el stream se hace **sin el cursor `seq_relay`**, que no está decidido (propuesta 5 de T-630), y sin tocar `web-1`. El agente debía detenerse si no era posible con los campos que ya existen. Sí fue posible: ver la sección D de la [agenda](../08_gui/10_agenda_H0_web-1.md).
- **Revisión del PR, en prosa:**
  - **Alcance:** `src/datos/` (`cliente.ts`, `sse.ts`, `costura.ts`, `serie.ts`, `interpolacion.ts`, `parametros.ts` y `visor_dev.ts`), 5 archivos de pruebas nuevos y el lado de escritura de `api.ts`.
  - **Fuera de `src/datos/`**, lo mínimo para probar en un navegador: `dev/en_vivo.html`, su enlace en `dev/index.html` y `e2e/en_vivo.spec.ts`. Ninguno entra al `dist/`.
  - **`api.ts`:** el diff no toca ninguna signal exportada. Solo `alimentar` gana métodos por mensaje. `alimentar.snapshot` pide ahora un segundo argumento (la hora de llegada local); `e2e/mapa_ayudas.ts` de T-632 ya lo pasa (`0`), así que sigue compatible.
  - **`fetch` en vez de `EventSource`:** con `EventSource` no se ve el 503 ni su `Retry-After`. La decisión es correcta.
  - **La interpolación no es una signal:** se consume con `interpolador.muestrear(performance.now())` en el ciclo de dibujo. Choca con la [revisión de T-632](2026-10-25_revision_T-632.md) (decisión 2), que proponía una signal nueva en `api.ts`. Pasa a la agenda (D9).
- **Verificación del documentador:**
  - en el worktree del agente: `npx vitest run`, **210 de 210**;
  - **el PR #23 sobre el `develop` actual** (`c2882a4`, que ya trae T-632 con los PR #21 y #22), en un worktree temporal, ya borrado:
    - el merge no tiene conflictos;
    - `tsc --noEmit` OK;
    - `vitest`: **241 de 241**;
    - `npm run build` OK, con la prueba de aislamiento y sin datos de ejemplo en el `dist/`;
    - `npm run e2e`: 69 pasan, 4 saltadas (las del PMTiles) y **1 falla**: ver la sección siguiente.

## Problemas y cómo se resolvieron
- **La prueba e2e `mapa.spec.ts:196` falla también en `develop` sin el PR #23** ("un dedo sobre el mapa desplaza la página: no queda atrapada").
  - Esperado: `scrollY > 1002`. Recibido: `902`. Es decir, la página no se desplazó.
  - Falla 3 de 3 con el PR #23 y 3 de 3 en `c2882a4` solo. **No la causa T-631.**
  - La bitácora de T-632 la reporta en verde (4 repeticiones). Hipótesis, sin verificar: depende de la máquina o del alto de la ventana, o de algún cambio posterior a esa corrida (por ejemplo, `b29543e`, el de la elipse).
  - **No se corrigió aquí:** es de T-632 (Juan Pablo). Queda como pendiente para un `fix/T-632-*`.
- **`npm run e2e` vuelve a modificar las capturas de T-620 y T-622.** Lo reportaron T-632 y T-631, y pasó otra vez en el worktree temporal. No se commitearon.
- **El backlog no decía que T-632 estaba hecha**, aunque los PR #21 y #22 ya estaban integrados. Se corrigió aquí.

## Decisiones tomadas o propuestas
Las propuestas del agente que tocan contratos (05, 04 §4, 03 §4, `constantes.md`) **no se aplican aquí**. `web-1` está congelado, y después de H0 solo entran campos opcionales (R-W8). Se pasan, junto con las de T-630 y T-632 que seguían abiertas, a la nueva **sección D de la [agenda de H0](../08_gui/10_agenda_H0_web-1.md)**, cada una con su recomendación.

| # | Propuesta | Estado |
| --- | --- | --- |
| D1 | Cursor del snapshot (propuesta 5 de T-630) | Abierta. El cliente no lo necesita para que el estado sea correcto; solo cierra un hueco de eventos de hasta 1 s si el relay cachea el snapshot |
| D2 | El `meta` de bienvenida va sin `id` | Abierta, falta escribirla en 05 §1. El cliente ya lo maneja |
| D3 | CORS del relay real: `Last-Event-ID`, y exponer `Retry-After` y `Age` | Abierta, para 04 §4 y T-640 |
| D4 | Qué mostrar si se deja de recibir el latido de la estación | Abierta, para 03 §4 (área E) |
| D5 | `serie.t_mas_s` antes del despegue (propuesta 7 de T-630) | Abierta, para 05 §3. **Bloquea T-633** |
| D6 | El backfill completo (propuesta 3 de T-630) | Abierta. **Bloquea T-633** |
| D7 | La forma mínima de `/salud` (propuesta 6 de T-630) | Abierta, para 04 §4 |
| D8 | Los 15 parámetros `(P)` de `src/datos/parametros.ts` | Abierta, para `constantes.md` §9 |
| D9 | La posición interpolada: ¿signal o `interpolador.muestrear`? | Abierta, entre T-631 y T-632 |

## Pendiente / siguiente paso
1. **Merge del PR #23** (lo hacen los humanos). Después, `graphify update .` en la carpeta principal.
2. **Conectar el cliente a las páginas:** `src/entradas/demeter.tsx` y `hermes.tsx` todavía no llaman a `iniciarCliente({ mision })`. Esos archivos son del área E. **Suposición del documentador:** se hace en T-624, que es la primera que pinta datos en vivo, y se anotó en su fila del backlog. Con `?ejemplo` el cliente no debe arrancar, porque los dos escriben en las mismas signals.
3. **Resolver la sección D de la agenda**, entre Juan Pablo y Jerónimo. Antes de T-633: D5 y D6. Antes de T-640: D1, D3 y D7.
4. **`fix/T-632-*`** para la prueba de los gestos que falla en `develop`.
5. **Al integrar el PR #23 quedan listas** T-624, T-625, T-626 y T-634. T-633 espera además a D5 y D6.
6. **Sin probar** (de la bitácora del agente):
   - Safari, iOS y Firefox;
   - macOS;
   - un celular real;
   - el relay real (T-640);
   - 500 clientes a la vez (T-643);
   - la suavidad de la interpolación, a simple vista.
7. El "Estado" de `CLAUDE.md` sigue diciendo que no hay código propio (lo arrastra la consolidación de T-630).

## Documentos afectados
- `docs/05_plan/backlog.md`: T-631 en revisión (PR #23); T-632 hecha; nota en T-624 (conectar el cliente); dependencia de T-633 en D5 y D6.
- `docs/08_gui/10_agenda_H0_web-1.md`: la sección D nueva.
- `docs/07_bitacora/README.md`: esta entrada y la del agente.
