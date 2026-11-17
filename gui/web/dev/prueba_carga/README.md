# Prueba de carga SSE (T-643)

Un script Node **standalone, sin dependencias** (solo módulos `node:*`) que abre N conexiones SSE
contra una URL base, durante un tiempo dado, y reporta la latencia (p50/p95/p99, mínimo y máximo)
y el desglose de errores. Sirve para la prueba de carga de T-643: **600 clientes SSE durante 5 min
con un vuelo repetido**, p95 de la latencia del relay < 1 s y sin errores ([04 §5](../../../../docs/08_gui/04_arquitectura_web.md)).

- **Solo lectura (GS-14):** el script hace únicamente `GET` a `snapshot` y `stream`. Nunca manda
  comandos ni abre rutas de escritura.
- **Windows y macOS:** puro Node, sin bash; las URLs se arman con `node:url` (nada de concatenar
  strings a mano). No modifica `package.json`: se ejecuta con `node` directamente.

## Archivos

| Archivo    | Qué es                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------- |
| `main.mjs` | El cliente de carga.                                                                         |
| `stub.mjs` | **Test double** mínimo para probar el cliente sin el relay real (ver [Stub](#stub)). ¡NO es el relay! |

## Uso

```
node gui/web/dev/prueba_carga/main.mjs <url-base> [opciones]
```

`<url-base>` es la raíz del servidor que sirve las rutas de lectura. El script llama a:

- `GET <url-base>/api/v1/{mision}/stream` (SSE), abriendo `--conexiones` a la vez;
- si se pide con `--snapshot`, `GET <url-base>/api/v1/{mision}/snapshot` de forma periódica.

| Opción                  | Por defecto | Qué hace                                                                 |
| ----------------------- | ----------- | ------------------------------------------------------------------------ |
| `--conexiones N`        | `600`       | conexiones SSE que abrir                                                  |
| `--duracion S`          | `300`       | duración de la prueba, en segundos (5 min)                                |
| `--mision <demeter\|hermes>` | `demeter`   | misión a probar                                                           |
| `--limite-conexiones N` | `= conexiones` | conexiones abiertas a la vez **durante la subida** (la rampa del handshake) |
| `--tiempo-espera MS`    | `1000`      | tiempo límite para que responda el servidor al conectar                   |
| `--reconexion-ms MS`    | `1000`      | espera antes de reconectar tras un corte o error                          |
| `--snapshot S`          | `0`         | además, mide la latencia del `snapshot` cada S segundos (`0` = no)         |
| `--progreso S`          | `30`        | una línea de progreso cada S segundos (`0` = no)                          |
| `--help`, `-h`          |             | ayuda en español                                                          |

### Contra el stub (sin relay, misma máquina)

```bash
node gui/web/dev/prueba_carga/stub.mjs &
node gui/web/dev/prueba_carga/main.mjs http://127.0.0.1:8790 --conexiones 20 --duracion 10 --mision demeter
```

### Contra el repetidor de desarrollo

```bash
# en otra terminal, desde gui/web/:
npm run repetidor -- demeter nominal
# y luego:
node gui/web/dev/prueba_carga/main.mjs http://127.0.0.1:8787 --conexiones 20 --duracion 10 --mision demeter
```

> ⚠️ El repetidor **no reescribe** los tiempos de los JSONL ([su README](../repetidor/README.md)):
> `relay_utc_ms` es el de la simulación (8-nov-2026). Por eso, contra el repetidor, la **métrica de
> latencia no tiene sentido** (sale un número muy negativo). Sirve igual para medir conexiones,
> mensajes y errores.

### Contra el relay real (cuando exista, T-640)

```bash
node gui/web/dev/prueba_carga/main.mjs https://api.ejemplo.com --conexiones 600 --duracion 300 --mision demeter --snapshot 5
```

## La métrica de latencia y su supuesto de relojes

Por cada mensaje del stream, el script calcula:

```
latencia = (reloj local al recibir el mensaje) − relay_utc_ms
```

- Usa `relay_utc_ms` (la hora en que el **relay** emitió el mensaje) cuando existe —es el caso de
  los mensajes `estado`—, y `utc_ms` como respaldo para los demás (05 §0 y §2).
- **Supuesto:** los relojes del cliente y del relay están sincronizados por NTP. Con un relay
  remoto, cualquier desvío de reloj aparece en la latencia. En la misma máquina (el stub) el reloj
  es el mismo y **no hay sesgo**: la latencia mide solo el viaje por el socket más el parseo.
- La latencia del **snapshot** es el tiempo de ida y vuelta de la petición (reloj local), no una
  diferencia de marcas.

## Errores que cuenta

| Categoría            | Qué cuenta                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| Conexiones fallidas  | fallos al conectar (DNS, conexión rechazada, socket roto)               |
| Timeouts al conectar | el servidor no respondió dentro de `--tiempo-espera`                    |
| Respuestas no 200    | el `stream` (o el `snapshot`) respondió con un código distinto de 200   |
| Streams cortados     | una conexión 200 que se cae a mitad de stream, antes del fin de la prueba |
| Reconexiones         | intentos de volver a conectar tras un corte o error (mantienen la carga) |

## Ejemplo de salida (real, contra el stub)

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

## Stub

`stub.mjs` es un **test double mínimo** (solo `node:http`) para probar el cliente de carga sin el
relay. Está **claramente etiquetado** como tal en su ayuda, en su salida y en `/api/v1/salud`
(`"test_double": true`). No vive en `gui/relay/` y **no reimplementa el relay** (no hay ingesta,
persistencia ni bajada a 1 Hz en tierra: eso es T-640).

```
node gui/web/dev/prueba_carga/stub.mjs [--puerto 8790] [--host 127.0.0.1] [--mensajes-por-segundo 9] [--latido-s 15]
```

- `GET /api/v1/{demeter,hermes}/stream`: SSE con `id` creciente y `event: estado`, a la tasa dada,
  con `relay_utc_ms` = reloj local del stub en el instante de emitir. Manda un `meta` al conectar
  (sin `id`) y un `: ping` cada `--latido-s`.
- `GET /api/v1/{demeter,hermes}/snapshot`: un snapshot mínimo de una sola misión.
- `GET /api/v1/salud`: estado del stub (con `"test_double": true`).
- El puerto por defecto (`8790`) no choca con el repetidor (`8787`).
