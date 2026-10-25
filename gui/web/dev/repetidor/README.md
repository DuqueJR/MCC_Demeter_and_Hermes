# Repetidor de desarrollo (T-630)

El "relay falso" de la web: sirve con las **mismas rutas de lectura del relay** ([04 §4 y §7](../../../../docs/08_gui/04_arquitectura_web.md)) lo que hay en `dev/datos/*.jsonl`, en tiempo real y en bucle. Sirve para desarrollar la web sin el back (D-W07). Node 22, **sin dependencias** (`node:http` y poco más).

## Uso

Desde la raíz del repo o desde `gui/web/` (Windows y macOS):

```
npm run repetidor -- demeter nominal
npm run repetidor -- todas lkp_descenso
npm run repetidor -- hermes backfill --velocidad 5
```

`npm run repetidor -- [misión] [escenario] [opciones]`

| Parámetro     | Valores                                                                                 | Por defecto                          |
| ------------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
| misión        | `demeter`, `hermes`, `todas`                                                            | `todas`                              |
| escenario     | `nominal`, `lkp_descenso`, `descenso_rapido`, `backfill`, `espera_rampa`, `relay_caido` | `nominal`                            |
| `--puerto`    |                                                                                         | 8787 (donde apunta el proxy de Vite) |
| `--host`      | `0.0.0.0` para probar desde un celular                                                  | 127.0.0.1                            |
| `--velocidad` | factor del tiempo (`10` = diez veces más rápido)                                        | 1                                    |
| `--datos`     | otra carpeta de `.jsonl`                                                                | `dev/datos`                          |

Con `npm run dev` en otra terminal, la web usa `VITE_API_BASE=/api` y el proxy de Vite manda `/api` a `:8787`. Con otro origen, el repetidor tiene CORS abierto para `GET`.

## Rutas

| Ruta                            | Qué hace                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/{mision}/snapshot` | Lo emitido hasta ahora en la vuelta: último `meta`, `estado`, `salud`, `estacion` y `backfill`; los `eventos`; la `serie` en columnas, decimada a `WEB_SERIE_MAX_PUNTOS`; `vuelo_completo_url: null` |
| `GET /api/v1/{mision}/stream`   | SSE con `id`, `event` y `data`. Manda un `meta` al conectar (sin `id`), un `: ping` cada `WEB_SSE_LATIDO_S` y reanuda con `Last-Event-ID`                                                            |
| `GET /api/v1/salud`             | Siempre 200. Dice el escenario, la vuelta, el último `id` y si simula el relay caído                                                                                                                 |

Cualquier otro método da 405: no hay ruta de escritura (GS-14).

## Cómo reproduce

- Cada línea sale en el instante `t_rel_ms` (el instante en que la emite el relay, T-612). Al terminar, una pausa de `PAUSA_ENTRE_VUELTAS_MS` y vuelve a empezar: el snapshot se reinicia (es otro "vuelo") y el primer mensaje es el `meta`.
- **`id` del SSE:** un contador por misión que **no se reinicia** al dar la vuelta. Como la reproducción es determinista, el mensaje de un `id` es la línea `(id − 1) mod N` del archivo, así que `Last-Event-ID` reanuda desde cualquier punto sin guardar un historial (hasta `REANUDAR_MAX_MENSAJES` hacia atrás).
- **Los tiempos del archivo no se reescriben** (`utc_ms`, `rx_utc_ms`, `relay_utc_ms`): son los de la simulación (8 de noviembre de 2026). La web calcula la edad del dato sin el reloj del celular (05 §0), así que no hace falta.
- **`relay_caido`:** un salto de `t_rel_ms` de al menos `HUECO_RELAY_CAIDO_MIN_MS` es el relay caído. Durante el hueco el repetidor **cierra los streams abiertos** y responde **503** (con `Retry-After`) al snapshot y al stream; al terminar el hueco vuelve a servir, y el archivo trae un `meta` en ese punto. `/salud` sigue en 200.
- **`backfill`:** el repetidor no hace nada especial con `completo: true`. Al volver a pedir el snapshot, `backfill` trae `completo: true` y la `serie` tiene lo que llegó (con los huecos del enlace), porque `vuelo_completo_url` es `null`.

Los saltos de `seq` y el hueco de `relay_caido` son intencionales (T-612).

## Pruebas

`npm test` (en `gui/web/`): `pruebas/repetidor.test.ts`. Levanta el servidor en un puerto libre con un reloj falso, de modo que no espera tiempo real.

## Archivos

| Archivo          | Contenido                                                          |
| ---------------- | ------------------------------------------------------------------ |
| `main.ts`        | Línea de comandos                                                  |
| `servidor.ts`    | HTTP, SSE, CORS, 503 y latido                                      |
| `reproductor.ts` | Tiempo, `id`, vueltas y `relay_caido`                              |
| `snapshot.ts`    | Acumulador del snapshot y decimación                               |
| `jsonl.ts`       | Lectura del JSONL                                                  |
| `constantes.ts`  | `WEB_*` (de `src/datos/constantes.ts`) y los valores propios `(P)` |

Los `.ts` se ejecutan con Node 22 sin compilar (quita los tipos): imports con extensión `.ts`, sin `enum` ni sintaxis que genere código (`erasableSyntaxOnly` en `tsconfig.json`).
