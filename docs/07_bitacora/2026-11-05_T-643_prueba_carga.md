---
fecha: 2026-11-05
tipo: tarea
ids: [T-643, D-W09, GS-14]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-643-prueba-carga
---
# T-643: prueba de carga SSE standalone

## Contexto

W3 exige probar que el relay público aguanta **600 clientes SSE durante 5 min con un vuelo
repetido** ([06 §3, fila T-643](../../05_plan/../08_gui/06_plan_web.md)), con p95 de la latencia
del relay < 1 s ([04 §5](../../05_plan/../08_gui/04_arquitectura_web.md)). El relay real (T-640)
está en progreso y en PR (#74), así que **no se podía probar contra él**: la orden fue construir el
cliente de carga contra el **contrato de rutas** ([05](../../05_plan/../08_gui/05_contrato_datos_web.md))
y probarlo con un test double local.

## Qué se hizo

Nuevos archivos en `gui/web/dev/prueba_carga/` (solo módulos `node:*`, sin dependencias, sin
tocar `package.json`, Windows y macOS):

- **`main.mjs`** — el cliente de carga. CLI `node …/main.mjs <url-base> [opciones]`.
  - Abre `--conexiones` (default 600) conexiones SSE a `<url-base>/api/v1/{mision}/stream`, con la
    URL armada con `node:url`. Mantiene cada conexión viva durante `--duracion` (default 300 s) y
    **reconecta** si se cae.
  - Mide por cada mensaje: `latencia = reloj local al recibir − relay_utc_ms` (respaldo: `utc_ms`),
    y opcionalmente (`--snapshot S`) la latencia de ida y vuelta del `snapshot`.
  - Cuenta errores: conexiones fallidas (DNS/rechazada), timeouts al conectar, respuestas no 200,
    streams cortados a mitad y reconexiones.
  - Reporte final en español con p50/p95/p99, mínimo y máximo (percentil por interpolación lineal),
    y desglose de errores. Progreso periódico opcional (`--progreso S`).
  - **Solo lectura (GS-14):** únicamente `GET` a `snapshot`/`stream`; no hay ruta de escritura.
- **`stub.mjs`** — test double mínimo (`node:http`) que sirve `snapshot` y `stream` de `demeter` y
  `hermes` a 9 msg/s con `relay_utc_ms` = reloj local, y `/api/v1/salud` con `"test_double": true`.
  Puerto por defecto **8790** (no choca con el repetidor, 8787). **NO es una reimplementación del
  relay** y no vive en `gui/relay/`.
- **`README.md`** — uso contra el stub, contra el repetidor y contra el relay real; las opciones;
  la métrica de latencia y su supuesto de relojes; y un ejemplo de salida real.

## Evidencia

Validación en verde (worktree `feature/T-643-prueba-carga`, Node v24.19.0):

| Paso | Resultado |
| --- | --- |
| `node --check` de los dos scripts | sin errores de sintaxis |
| `stub.mjs` + `curl` de `/salud`, `/snapshot` y `/stream` | SSE con `id` creciente, `meta` al conectar y `estado` con `relay_utc_ms` |
| `main.mjs` contra el stub (`--conexiones 20 --duracion 10 --mision demeter --snapshot 2`) | **termina limpio (exit 0)**: 20/20 conexiones, 1800 mensajes, 1780 muestras, 0 errores; latencia p50 1 ms, p95 2 ms, p99 4 ms |
| `main.mjs` contra un puerto cerrado (`--conexiones 5`) | cuenta 15 conexiones fallidas y 10 reconexiones, sale 0 |
| `main.mjs` contra el repetidor (`npm run repetidor -- demeter nominal`) | conecta y cuenta mensajes sin errores; la latencia sale muy negativa porque el repetidor **no reescribe** los tiempos de la simulación (documentado en el README) |

Ejemplo de salida (real, contra el stub):

```
$ node gui/web/dev/prueba_carga/main.mjs http://127.0.0.1:8790 --conexiones 20 --duracion 10 --mision demeter --snapshot 2 --progreso 5
Prueba de carga SSE (T-643)
  URL base: http://127.0.0.1:8790/
  Misión: demeter → http://127.0.0.1:8790/api/v1/demeter/stream
  Conexiones: 20 · duración: 10 s
  Snapshot medido cada 2 s → http://127.0.0.1:8790/api/v1/demeter/snapshot

[progreso] t=5.0s  activas=20  mensajes=920  errores=0
[progreso] t=10.0s  activas=20  mensajes=1800  errores=0
── Resultados ──────────────────────────────────────────
Duración real:                 10.0 s
Conexiones pedidas:            20
Conexiones que llegaron a 200: 20
Pico de conexiones a la vez:   20
Mensajes recibidos (eventos):  1800
Muestras de latencia:          1780
── Latencia (reloj local − relay_utc_ms | utc_ms) ───────
  mínimo: 0.00 ms
  p50:    1.00 ms
  p95:    2.00 ms
  p99:    4.00 ms
  máximo: 6.00 ms
── Errores ─────────────────────────────────────────────
  Conexiones fallidas (DNS/rechazada): 0
  Timeouts al conectar:                0
  Respuestas no 200:                   0
  Streams cortados a mitad:            0
  Reconexiones:                        0
── Snapshot ────────────────────────────────────────────
  Peticiones: 5
  Éxitos:     5
  No 200:     0
  Timeouts:   0
  Errores:    0
  Latencia:   mín 1.21 ms · p50 2.09 ms · p95 7.29 ms · p99 8.33 ms · máx 8.59 ms
────────────────────────────────────────────────────────
```

## Decisiones tomadas o propuestas

- **La métrica de latencia usa `relay_utc_ms`** (y `utc_ms` de respaldo), como pide el plan
  ([04 §5](../../05_plan/../08_gui/04_arquitectura_web.md): "marca de tiempo del relay contra la del
  cliente"). Queda **documentado** el supuesto de relojes sincronizados por NTP; en la misma máquina
  no hay sesgo. El script no lo corrige: reporta la diferencia tal cual (así un desvío de NTP es
  visible, no escondido).
- **Contra el repetidor la latencia no es significativa** (los `relay_utc_ms` son de la simulación,
  no del instante real de emisión). El repetidor sirve para probar conexiones, mensajes y errores.
  Se anota en el README para no sacar conclusiones falsas.
- **Reconectar para mantener la carga** es parte del comportamiento: sin ello, los cortes a mitad
  de stream bajarían la carga y dejarían de medir lo que se quiere (04 §5 pide 600 clientes
  simultáneos).

## Problemas y cómo se resolvieron

- **Primera versión colgaba al terminar.** `dormir()` cancelaba el `setTimeout` cuando llegaba el
  abort de fin de prueba pero no resolvía la promesa, así que el bucle del snapshot (o un
  reconexión en espera) nunca terminaba. Se corrigió resolviendo la promesa al abortar.
- **Medir latencia contra el repetidor da números absurdos** (≈ −2,5 días). No es un bug: es el
  efecto de los tiempos fijos de la simulación. Se documentó en vez de "arreglarlo".

## Pendiente / siguiente paso

- **Correr la prueba real contra el relay (T-640)** cuando esté: 600 conexiones, 5 min, con un
  vuelo repetido, y registrar CPU y memoria del relay (eso no lo hace el script: es del proceso del
  relay, no del cliente). El criterio: p95 de la latencia < 1 s y sin errores.
- Con un relay remoto, verificar que el cliente y el relay estén **sincronizados por NTP** para que
  la latencia sea válida.

## Documentos afectados

Nuevos: `gui/web/dev/prueba_carga/{main.mjs,stub.mjs,README.md}` y este archivo. Ninguno editado
(los contratos y el `package.json` no se tocaron).
