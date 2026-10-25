---
fecha: 2026-10-25
tipo: tarea
ids: [T-630, D-W07]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-630-repetidor-dev
---
# T-630: repetidor de desarrollo de la web

## Contexto
La web se desarrolla sin el back (D-W07). T-630 entrega el "relay falso": sirve con las mismas rutas de lectura del relay lo que hay en `gui/web/dev/datos/*.jsonl` (T-612), en tiempo real y en bucle. Lo usarán T-631 (cliente de datos) y T-640 (el relay se prueba contra él). Sesión web (`SESION=web`).

## Qué se hizo
- `gui/web/dev/repetidor/` en Node 22, **sin dependencias nuevas** (`node:http`, `node:fs`, `node:util`). Uso, parámetros y diseño en su [README](../../gui/web/dev/repetidor/README.md).
- Rutas: `GET /api/v1/{mision}/snapshot`, `GET /api/v1/{mision}/stream` (SSE) y `GET /api/v1/salud`, en `:8787`. Cualquier otro método da 405 (no hay ruta de escritura, GS-14). CORS abierto para `GET` y `OPTIONS`.
- Línea de comandos: `npm run repetidor -- demeter nominal` (en `gui/web/` y, como atajo, en la raíz, igual que T-614). Misión `demeter | hermes | todas` (por defecto `todas`), escenario (por defecto `nominal`), y `--puerto`, `--host`, `--velocidad`, `--datos`.
- **Tiempo y bucle:** cada línea sale en su `t_rel_ms`; al terminar, `PAUSA_ENTRE_VUELTAS_MS` y otra vuelta. El tiempo es virtual (reloj × velocidad), así que las pruebas lo mueven a mano.
- **`id` del SSE:** contador por misión que no se reinicia en el bucle. Como la reproducción es determinista, el mensaje del `id` k es la línea `(k − 1) mod N`: `Last-Event-ID` reanuda desde cualquier punto sin guardar historial (tope `REANUDAR_MAX_MENSAJES`). Al conectar manda un `meta` **sin `id`** (no mueve el cursor del cliente) y después lo que falta desde `Last-Event-ID`. Latido `: ping` cada `WEB_SSE_LATIDO_S`.
- **Snapshot** armado con lo emitido hasta el instante actual de la vuelta: último `meta`, `estado`, `salud`, `estacion` y `backfill`; todos los `eventos`; `serie` en columnas; `vuelo_completo_url: null`. Se reinicia al dar la vuelta.
- **Decimación de la `serie`** a `WEB_SERIE_MAX_PUNTOS`: los puntos de vuelo (BOOST a DESCENT) se conservan todos y el presupuesto que sobra se reparte parejo entre los de tierra (con el primero y el último). Si solo el vuelo ya excede el máximo, se decima parejo todo.
- **`relay_caido`:** un salto de `t_rel_ms` de al menos `HUECO_RELAY_CAIDO_MIN_MS` (5 periodos de tierra, derivado de `WEB_TASA_TIERRA_HZ`) es el relay caído. Entre el último mensaje antes del hueco y el primero después, el repetidor cierra los streams abiertos y responde 503 (con `Retry-After`).
- Las `WEB_*` salen de `src/datos/constantes.ts` (`WEB_SERIE_MAX_PUNTOS`, `WEB_SSE_LATIDO_S`, `WEB_TASA_TIERRA_HZ`); los números propios del repetidor están en `dev/repetidor/constantes.ts`, marcados `(P)`.
- **Ejecución:** los `.ts` corren con Node 22 sin compilar. Cambios en `gui/web/tsconfig.json`: `dev/repetidor` en `include`, `allowImportingTsExtensions` y `erasableSyntaxOnly` (para que `tsc` avise si alguien usa sintaxis que Node no puede quitar). Verificado con Node 22.22.0.
- Pruebas: `gui/web/pruebas/repetidor.test.ts` (27).
- Commits: `0e34818` (repetidor), `ccbcc47` (pruebas), `9355a5f` (README) y este de bitácora.

## Evidencia
- Entorno: Windows 11, Node 22.22.0, `npm ci` limpio (0 vulnerabilidades).
- `npm run lint`: sin errores; **3 avisos que ya existían** en archivos que no toqué (`src/datos/estado_pagina.ts:68` y dos `!important` en `src/tema/comun.css`).
- `npx tsc --noEmit`: sin salida (con `dev/repetidor` incluido y `erasableSyntaxOnly`).
- `npm test`: **5 archivos, 103 pruebas en verde** (27 nuevas en `repetidor.test.ts`; 2,2 s).
- `npm run build`: OK (tsc, colores, vite y "Aislamiento OK").
- Lo que cubren las pruebas nuevas:
  - ids crecientes de uno en uno, el `meta` de bienvenida sin `id`, y el `id` que no se reinicia en la vuelta;
  - `Last-Event-ID`: un cliente A se conecta, se cae, B reanuda con el último id de A. Los ids de A y B juntos son exactamente `n0+1 … n3`, sin repetidos ni saltos, y el contenido de B es igual al de un cliente C que nunca se cayó. Un `Last-Event-ID` al día, de otra época (mayor que el actual), vacío o inválido no reenvía nada viejo;
  - el snapshot de los **12 JSONL** en 6 instantes cada uno (0, 9, 25, 60, 100 s y el final de la vuelta) valida contra `esquema.json` (`#/$defs/snapshot`, Ajv) y `validarExtra`; el snapshot tras una vuelta completa más 60 s es idéntico byte a byte al de los 60 s de la primera;
  - el snapshot refleja el último `estado`, `salud`, `estacion`, `meta` y todos los `eventos` hasta el corte, con la `serie` sin decimar si cabe;
  - decimación: nunca pasa de `WEB_SERIE_MAX_PUNTOS`, queda en orden, conserva todo el vuelo y los extremos de la tierra; con un máximo de 120 la `serie` es una subsecuencia de la completa; con un máximo que alcanza para el vuelo, el apogeo sobrevive;
  - `relay_caido`: el stream abierto se cierra al empezar el hueco; durante el hueco, 503 al snapshot y al stream, `/salud` sigue en 200 con `relay_caido: true`; al volver, 200 y reanudar con `Last-Event-ID` entrega el `meta` de regreso sin perder ni repetir;
  - CORS, preflight `OPTIONS` (204), POST/PUT/DELETE/PATCH dan 405, y misión no servida o ruta inexistente dan 404; latido `: ping`.
- **`curl -N` contra el servidor real** (`npm run repetidor -- demeter nominal`), recortado a 100 columnas:

  ```
  $ curl -s -N --max-time 3 -i localhost:8787/api/v1/demeter/stream
  HTTP/1.1 200 OK
  Access-Control-Allow-Origin: *
  Content-Type: text/event-stream; charset=utf-8
  Cache-Control: no-cache, no-transform
  X-Accel-Buffering: no
  event: meta
  data: {"contrato_version":"web-1","mision":"demeter","nodo":1,"modo":"simulacion","mission_id":null,...
  id: 12
  event: estado
  data: {"seq":31,"t_ms":1203500,"utc_ms":1794150003500,"rx_utc_ms":1794150003515,"relay_utc_ms":17941...
  id: 13
  event: estacion
  data: {"utc_ms":1794150003740,"pos":{"lat":6.5806436,"lon":-75.8211915,"alt_msl_m":511.5},"gnss_ok":...
  id: 14
  event: salud
  id: 15
  event: estado
  ```

  Reanudar (`curl -s -N --max-time 2 -H "Last-Event-ID: 5" .../stream`), solo `id` y `event`:
  `event: meta  id: 6 estado  id: 7 estacion  id: 8 salud  id: 9 estado  id: 10 estacion  id: 11 salud …` (empieza en el 6, el siguiente al 5).

  Snapshot: `200 2873 B`, claves `meta,estado,salud,estacion,eventos,serie,backfill,vuelo_completo_url`, `fase ARMED`, 15 puntos de serie, 1 evento, `vuelo_completo_url null`. `POST` al snapshot: `405`. `GET /api/v1/hermes/stream` con solo Deméter cargada: `404`. `/api/v1/salud`: `{"estado":"ok","contrato_version":"web-1","repetidor":true,"misiones":{"demeter":{"escenario":"nominal","vuelta":0,"ultimo_id":49,"relay_caido":false,"clientes_sse":0}}}`.

  `relay_caido` a 10x (`--velocidad 10`; el hueco de 20 s dura 2 s reales), sondeando cada 0,5 s snapshot y stream:

  ```
  26 snapshot=200 stream=200
  27 snapshot=200 stream=200
  28 snapshot=503 stream=503
  30 snapshot=503 stream=503
  31 snapshot=200 stream=200
  32 snapshot=200 stream=200
  ```

  El `curl -N` que estaba abierto terminó limpio (código 0) al empezar el hueco.
- A través del proxy de Vite (`npx vite --port 5199`): `GET :5199/api/v1/demeter/snapshot` da 200 y el stream llega con su `meta`. El navegador de verdad con `VITE_API_BASE` no se probó (eso es T-631).

## Decisiones tomadas o propuestas
Ninguna cambia un contrato (no toqué `src/contrato/`, el esquema, `src/datos/` ni `docs/08_gui/`). Las tres que pidió el encargo, como propuestas `(P)`:

1. **(P) Cómo se simula `relay_caido`.** Un salto de `t_rel_ms` de al menos 5 periodos de tierra (5 s) en el JSONL es "el relay caído". Durante él el repetidor **cierra los streams abiertos con un fin normal** (`res.end()`) y responde **503 con `Retry-After`** al snapshot y al stream; `/salud` sigue en 200 y dice `relay_caido: true`, para que una herramienta pueda saber que el repetidor vive. Al terminar el hueco vuelve a servir. Así T-631 prueba la reconexión con retroceso (`WEB_RECONEXION_MAX_S`). Cierra con fin normal y no con un reset de conexión; para la web es lo mismo (`EventSource` reconecta), pero un reset es más fiel a un relay que se cae de verdad. Se detecta en cualquier escenario, no solo en `relay_caido` (en los demás nunca hay saltos de más de 1 s).
2. **(P) Los tiempos no se reescriben** (`utc_ms`, `rx_utc_ms`, `relay_utc_ms`, `estacion.utc_ms` quedan como en el JSONL, 2026-11-08 15:00 UTC más el vuelo). Razón: la edad del dato no usa el reloj del celular (05 §0, §4.4) sino `ultimo_paquete_hace_ms`, así que la web no los necesita para su lógica. Dejarlos mantiene intacto lo que se validó en T-611/T-612, hace la salida determinista (la prueba compara un snapshot de la vuelta 2 con la 1 byte a byte) y evita inventar relaciones entre campos. Costo: la hora UTC que se muestre (si alguna sección la muestra) será siempre la del 8 de noviembre, y `relay_utc_ms` retrocede al dar la vuelta; no sirve para medir la latencia del relay (eso es la prueba de carga de T-643, contra el relay real). Si alguna sección de la UI muestra la hora y molesta, se agrega una opción `--hora-actual`.
3. **(P) `backfill.completo: true`: el repetidor no hace nada especial.** El mensaje pasa por el stream como cualquier otro. Cuando la web vuelve a pedir el snapshot, `backfill` trae `completo: true`, y la `serie` trae lo que llegó por el enlace (con los huecos del 25 % de NAV perdidos), porque el JSONL no contiene los registros recuperados y `vuelo_completo_url` es `null`. Es suficiente para probar la mecánica de "al completar, repedir el snapshot", pero **no** muestra la gráfica "reemplazada por la trayectoria completa" que pide T-633 ("la barra avanza y la gráfica se reemplaza"). Si se quiere, hace falta que T-612 genere para `backfill` un segundo archivo con la serie completa, o que el repetidor reciba la `serie` completa de `{mision}_nominal.jsonl` al llegar `completo`. Lo dejo para quien lleve T-633.

Otras decisiones del repetidor que los documentos no fijan (todas `(P)`, fáciles de cambiar):

4. **`meta` al conectar sin `id`.** 05 §1 dice que cada mensaje lleva `id`. El `meta` de bienvenida no es un mensaje de la secuencia, así que no lo lleva: con `EventSource`, un evento sin `id` no cambia `lastEventId`, y la reanudación no se corre. El `meta` que sí está en el archivo (al arrancar la vuelta y al volver de `relay_caido`) lleva su `id` normal.
5. **El snapshot no dice hasta qué `id` llega.** 05 §3 no trae un cursor, así que el cliente no puede saber con qué `Last-Event-ID` abrir el stream justo después del snapshot (un mensaje emitido entre las dos peticiones se pierde o se repite). En el repetidor la ventana es de milisegundos y la interpolación y el siguiente `estado` la tapan, pero con 500 clientes en el relay real puede importar. **Propuesta de contrato (para el documentador):** un campo opcional `seq_relay` (el `id` del último mensaje incluido) en el snapshot, que el esquema ya permitiría agregar como opcional compatible (05 §0). No lo agregué: es un contrato.
6. **`/salud`** no tiene forma definida en 05. Devuelve `{"estado":"ok","contrato_version":"web-1","repetidor":true,"misiones":{…}}`. El relay real puede devolver lo mínimo (`{"estado":"ok"}`); T-631 no debe depender del resto.
7. **`serie.t_mas_s`:** `null` mientras no haya llegado el evento `despegue`; desde que llega, todos los puntos (también los de antes) se expresan relativos al despegue con 2 decimales, así que los de la espera quedan en T− (negativos). Con `t_mas_s` nulo en toda la espera, la gráfica no tiene eje de tiempo; negativo es lo natural. Es un cálculo del servicio de tierra real (05 §2.5), que puede decidirlo distinto.
8. **Varias vueltas y el snapshot.** Al dar la vuelta el snapshot se reinicia (otra misión simulada), y el primer mensaje es el `meta` con `mission_id: null`. Un cliente conectado ve que la fase vuelve a `BOOT`/`PREFLIGHT`; T-631 debe tolerar que `t_ms` retroceda.
9. **Misión por parámetro:** `todas` (por defecto) sirve Deméter y Hermes con el mismo escenario, para poder abrir las dos páginas a la vez; una sola misión deja la otra en 404. Escucha en `127.0.0.1` por defecto; para el celular, `--host 0.0.0.0` (los datos son públicos y falsos, pero no se abre a la red sin pedirlo).
10. **Sin límite de conexiones SSE por IP** (`WEB_SSE_MAX_POR_IP`): lo aplica el relay (04 §8), no hace falta en desarrollo.
11. **Sin contrapresión:** si un cliente SSE no lee, Node acumula en memoria. Es una herramienta de desarrollo; el relay real (T-640) debe descartar al más viejo (04 §5).

## Problemas y cómo se resolvieron
- Una prueba mía suponía que con una `serie` decimada a 120 puntos (menos que los puntos de vuelo) el apogeo sobrevive; no tiene por qué, porque entonces se decima parejo todo. La corregí: con un máximo menor que el vuelo se comprueba el máximo y el orden; con un máximo que alcanza para el vuelo se comprueba que el apogeo se conserva.
- No hay grafo de graphify en la carpeta principal (`graphify-out/graph.json` no existe), así que usé grep y lectura directa de los documentos citados en el encargo.
- El entorno del agente no deja correr comandos de shell compuestos con redirecciones a rutas calculadas; los scripts de análisis temporales van en el directorio de trabajo temporal de la sesión, no en el repo.

## Pendiente / siguiente paso
- **T-631** puede usar el repetidor ya: `npm run repetidor -- demeter relay_caido` para la reconexión, `backfill` para volver a pedir el snapshot, y `--velocidad` para recorrer los umbrales `WEB_*` sin esperar.
- Decidir el `seq_relay` del snapshot (propuesta 5) y qué hacer con el `backfill` completo (propuesta 3) antes de T-633.
- No probado: la web real contra el repetidor en un navegador (T-631); `npm run e2e` (Playwright) no se corrió porque T-630 no toca la web ni el humo; macOS (el código no usa nada específico de Windows, pero no se corrió); Node 22 anterior a 22.18 (podría pedir `--experimental-strip-types`; el `.nvmrc` dice `22`, que instala la última 22.x).
- Un fallo posible a vigilar: `T-614` abre `/dev/` y lista los escenarios de ejemplo; el índice no menciona al repetidor todavía (no lo toqué: es otra tarea).

## Documentos afectados
Ninguno editado de `docs/`. Cambié `gui/web/package.json` (script `repetidor`, sin dependencias), `gui/web/tsconfig.json`, el `package.json` de la raíz (atajo) y los README de la raíz y de `gui/web/`. A consolidar por el documentador: estado de T-630 en el backlog, las propuestas 1 a 11, y el campo opcional `seq_relay` de 05 §3 si se acepta.
