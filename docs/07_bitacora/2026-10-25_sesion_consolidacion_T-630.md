---
fecha: 2026-10-25
tipo: sesion
ids: [T-630, T-631, T-633, T-640, T-614, D-W07]
autor: documentador (Claude Opus 5.5)
rama: docs/consolidar-T-630
---
# Consolidación de T-630 (repetidor de desarrollo de la web)

## Contexto
El usuario pidió continuar con T-630 del plan web ([06_plan_web](../08_gui/06_plan_web.md) §3). La tarea estaba lista: T-612 está integrada y los 12 JSONL están en `gui/web/dev/datos/`. Se lanzó el agente `desarrollador`, que la implementó y abrió el **PR #18** hacia `develop`, sin merge. Esta entrada recoge la revisión del PR y clasifica las propuestas del agente. El detalle técnico y la evidencia con `curl` están en la [entrada del agente](2026-10-25_T-630_repetidor_desarrollo.md), que llega a `develop` con el PR #18.

## Qué se hizo
- **Lanzamiento:**
  - el agente `desarrollador` en su worktree, con la rama `feature/T-630-repetidor-dev` desde `origin/develop` (`43d4877`);
  - 4 commits `[T-630]` y el PR #18.
  - En el encargo se le pidió marcar como `(P)` tres suposiciones que los documentos no fijan: cómo simular `relay_caido`, si se reescriben los tiempos y qué hacer con el backfill completo.
- **Revisión del código, en prosa** (`gui/web/dev/repetidor/`: `servidor.ts`, `reproductor.ts`, `snapshot.ts`, `jsonl.ts`, `constantes.ts` y `main.ts`):
  - **Rutas:** las de lectura del relay (04 §4). Cualquier otro método responde 405, así que no hay ninguna ruta de escritura (GS-14).
  - **`id` del SSE:** se calcula; no se guarda un historial. El `id` k es la línea `(k−1) mod N` del archivo, así que es creciente y no se reinicia al dar la vuelta (05 §1). Con eso, `Last-Event-ID` reanuda desde cualquier punto.
  - **Constantes:** `WEB_SERIE_MAX_PUNTOS`, `WEB_SSE_LATIDO_S` y `WEB_TASA_TIERRA_HZ` se importan de `src/datos/constantes.ts`. Los parámetros propios van en `constantes.ts` del repetidor, marcados `(P)`.
  - **Decimación de la `serie`:** conserva todos los puntos de BOOST a DESCENT y reparte el resto del cupo entre los de tierra (05 §3).
  - **Sin cambios de contrato:** no toca `src/contrato/`, `src/datos/` ni `docs/08_gui/`.
- **Comprobación del orden del backfill:** en `demeter_backfill.jsonl` el `t_ms` de los 729 `estado` nunca retrocede. Por eso la `serie` del snapshot sale ordenada en el tiempo sin tener que reordenarla.
- **[Backlog](../05_plan/backlog.md):**
  - T-630 queda en revisión (PR #18);
  - T-631 queda lista en cuanto se integre el #18;
  - T-614 pasa a hecha (PR #16, que ya estaba integrado y el backlog no lo decía).
- **Índice de la bitácora:** esta entrada y la del agente.

## Evidencia
- Lo informa el agente:
  - `npm ci` limpio;
  - `npm run lint` sin errores (3 avisos que ya existían);
  - `tsc --noEmit` sin errores;
  - `npm test`: 103 pruebas en verde, 27 de ellas nuevas;
  - `npm run build` OK, con la prueba de aislamiento;
  - `curl -N` contra el servidor real.
- **Verificado por el documentador:** `npx vitest run pruebas/repetidor.test.ts` en el worktree del agente, con Node v22.22.0: **27 pasaron**.

## Decisiones tomadas o propuestas
**Clasificación de las propuestas del agente.** Ninguna se aplica aquí: las que tocan `web-1` necesitan una decisión D-W y el mismo PR para el documento 05, el esquema y los tipos (05 §0).

| # | Propuesta del agente | Estado | Qué falta |
| --- | --- | --- | --- |
| 1 | `relay_caido`: un hueco de ≥ 5 s en el JSONL es el relay caído. Cierra los streams y responde 503 con `Retry-After`; `/salud` sigue en 200 | **Aceptable para desarrollo** | Nada. T-631 prueba con esto la reconexión con retroceso |
| 2 | Los tiempos (`utc_ms`, `rx_utc_ms`, `relay_utc_ms`) no se reescriben: siempre son del 8 de noviembre y retroceden en cada vuelta | **Aceptable.** La edad no usa el reloj del celular (05 §0) | Agregar `--hora-actual` si alguna sección muestra la hora UTC y molesta |
| 3 | Con `backfill.completo: true`, el snapshot trae la `serie` con los huecos (`vuelo_completo_url: null`): no hay "trayectoria completa" que mostrar | **Abierta, bloquea el criterio de T-633** | Elegir antes de T-633: un segundo JSONL en T-612 con la serie completa, o que el repetidor la tome de `{mision}_nominal.jsonl` |
| 4 | El `meta` de bienvenida va **sin `id`**, para no mover el cursor de `Last-Event-ID` | **Abierta.** 05 §1 dice que cada mensaje lleva `id` | Escribir la excepción en 05 §1, porque el relay real (T-640) hará lo mismo |
| 5 | **Cursor del snapshot:** campo opcional `seq_relay` (el `id` del último mensaje incluido), para abrir el stream sin perder ni repetir mensajes entre las dos peticiones | **Abierta, la más importante.** Con 500 clientes al despegue (D-W09), la ventana entre snapshot y stream deja de ser despreciable | Decidirlo en H0 (es un campo opcional compatible), antes de T-631 y T-640 |
| 6 | La forma de `/api/v1/salud` no está definida | **Abierta, menor** | Fijar en 04 §4 lo mínimo (`{"estado": "ok"}`); T-631 no debe depender del resto |
| 7 | `serie.t_mas_s`: `null` hasta el despegue; después, todos los puntos relativos al despegue, y los de la espera quedan negativos | **Abierta.** 05 §3 no lo dice, y lo calcula el servicio de tierra | Escribirlo en 05 §3, para que el back haga lo mismo (C-05) |
| 8 | Al dar la vuelta, el snapshot se reinicia y `t_ms` y la fase retroceden | Informativa | T-631 debe tolerarlo (es una particularidad del repetidor) |
| 9 | `todas` sirve las dos misiones a la vez; escucha en `127.0.0.1` (para el celular, `--host 0.0.0.0`) | Aceptada | Nada |
| 10 | Sin límite por IP y sin contrapresión | Aceptada en desarrollo | **T-640 sí debe** descartar al cliente más lento (04 §5) y aplicar `WEB_SSE_MAX_POR_IP` (04 §8) |

**Observaciones propias de la revisión** (no bloquean el merge):
- **Node 22.18 o más.** `npm run repetidor` ejecuta TypeScript con Node, sin compilar. Node quita los tipos sin opciones desde la 22.18. El `.nvmrc` (`22`) instala la última 22.x, pero `engines` en `gui/web/package.json` acepta `>=22`. Con Node 22.0 a 22.17 no arranca: hace falta `--experimental-strip-types` o, en las versiones más viejas, no hay forma. **Propuesta:** subir `engines` a `>=22.18` en un `fix/T-630-*` o en la próxima tarea que toque ese archivo, y dejarlo en D-035.
- **`erasableSyntaxOnly` vale para todo `gui/web/`.** El agente lo activó en `tsconfig.json` para que Node pueda ejecutar el repetidor. Desde ahora, ningún archivo de la web puede usar `enum`, `namespace` ni propiedades de parámetro en el constructor. Es razonable (el código actual no los usa), pero es una regla nueva para T-622 y las siguientes.
- **El repetidor importa `src/contrato/tipos.ts` y `src/datos/constantes.ts` en tiempo de ejecución.** Si alguien agrega a esos archivos un import sin la extensión `.ts`, el repetidor se rompe aunque el build de Vite siga en verde. Las pruebas del repetidor lo detectan, porque levantan el servidor real.

## Problemas y cómo se resolvieron
- **No hay grafo de graphify** (`graphify-out/graph.json` no existe en la carpeta principal). El agente usó grep, como dice CLAUDE.md. Hay que reconstruirlo en la carpeta principal (`graphify update .`) después de integrar el #18.

## Pendiente / siguiente paso
1. **Revisión humana del PR #18** (Juan Pablo o Jerónimo) y merge a `develop`. Este PR de documentación enlaza la entrada del agente, así que conviene integrar primero el #18.
2. **Llevar a la agenda de H0 las propuestas 4, 5, 6 y 7** (cambios a 05 y 04 §4). La 5 (el cursor del snapshot) va antes de T-631 y T-640.
3. **Decidir la propuesta 3** (backfill completo) antes de lanzar T-633.
4. **T-631** (el cliente de datos) se puede lanzar en cuanto se integre el #18. Puede ir en paralelo con T-622 (PR #17): no comparten archivos, salvo que T-622 toque `src/datos/`.
5. Subir `engines` a `>=22.18` (observación de arriba).
6. **Sin probar:** la web real contra el repetidor en un navegador (se prueba en T-631), `npm run e2e`, macOS y Node anterior a 22.18.

## Documentos afectados
- `docs/05_plan/backlog.md` (el estado de T-630, T-631 y T-614)
- `docs/07_bitacora/README.md` (índice)
