---
fecha: 2026-11-03
tipo: tarea
ids: [T-662, D-046, D-050, PEN-23]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-662-api-local-dashboard
---
# T-662: la API local y las páginas de misión dentro del dashboard de Pablo

## Contexto
D-046 hace de `estacion/dashboard.py` la estación y el dashboard. T-661 dejó `web1.py` (`Traductor`, sin E/S). T-662 lo conecta al servidor HTTP: las rutas de lectura de C-05 §2 (las mismas del relay) y el `dist/` de `gui/web`, para ver las páginas de misión (Vuelo, mapa, actitud, Recuperación con LKP y QR) sin internet, solo en `127.0.0.1`.

## Qué se hizo
**`estacion/dashboard.py`** (biblioteca estándar y `pyserial`; sin FastAPI; el archivo conserva su estructura, todo lo nuevo es aditivo):
- **Un `Traductor` por proceso** (`tr`), con `tr_lock`.
  - `ground_line()` llama a `tr.procesar()` con cada línea de tierra.
  - Un hilo (`web_tick`, cada 0,25 s) llama a `tr.tick()`; el propio `Traductor` se limita a 1 Hz.
  - `/api/cmd` llama a `tr.comando()` antes de escribir al puerto, para que `go_nogo` sepa a qué orden responde el `[cmd ]`.
  - Un error del traductor no tumba el hilo del puerto: se cuenta y se anota en el Historial (las 3 primeras veces).
- **Bus de mensajes por misión.** Cada mensaje que sale del `Traductor` se serializa una sola vez y se guarda con su `id` (contador por misión) en un `deque` de 4000. La publicación va **dentro de `tr_lock`**, así el orden de los ids es el de los mensajes. Los lectores solo toman la condición del bus, nunca `tr_lock` (sin interbloqueo).
- **`GET /api/v1/{demeter|hermes}/snapshot`**: `Traductor.snapshot()` bajo el candado.
- **`GET /api/v1/{demeter|hermes}/stream`** (SSE): `id`, `event: <tipo>`, `data: <JSON>`; primero un `meta` **sin `id`** (la bienvenida, como pide el cliente de la web); después solo lo nuevo; `: ping` a los 15 s (`WEB_SSE_LATIDO_S`, de `constantes.md`).
  - **`Last-Event-ID` sí está soportado**: repite lo que aún guarde el bus (4000 mensajes por misión). Un id mayor que el actual (otro proceso) o no numérico se ignora y se sigue desde lo nuevo. Si el hueco es mayor que el bus, la web resincroniza con el snapshot (como ya hace).
  - Un stream ocupa un hilo de `ThreadingHTTPServer` (hilos *daemon*); el socket tiene un tope de 10 s por escritura para no quedar colgado ante un cliente que no lee. Cinco streams abiertos a la vez no frenan a `/api/state` ni al snapshot (hay prueba).
- **Seguridad intacta:** sigue en `127.0.0.1` y todas las rutas nuevas pasan por `trusted()` (`Host` y `Origin`). Las rutas de lectura no aceptan POST. Nada de comandos nuevos.
- **Archivos estáticos de `gui/web/dist/`** (`web_archivo`, `Handler.archivo`):
  - se sirven `/web/<x>` y, directamente, `/assets/`, `/demeter/`, `/hermes/` y `/mapas/` (ver la decisión 1);
  - tipos MIME **fijos** (en Windows `mimetypes` lee el registro y a veces da `.js` = `text/plain`, y los módulos no cargan);
  - `Range` (el PMTiles de T-632 lo necesita);
  - no se sale de `dist/`: se rechazan `..`, `\`, `:` y `\0`, y además se compara la ruta **real** (`realpath` + `commonpath`), así que un enlace simbólico tampoco saca. Se probó quitando los dos controles: las pruebas fallan.
  - sin `dist/`, esas rutas responden 404 con "compila la web con `npm run web:build`", y `/api/state` trae `web: false`.
- **`--reproducir SESION [--velocidad X]`** (nuevo): `ReplayLink` repite una sesión guardada (`<epoch> <línea>`) por `ground_line()`. El criterio del backlog dice "con `--demo` y con una sesión reproducida"; son ~20 líneas.
- **`--web-dist CARPETA`** (para las pruebas) y, con `--demo` o `--reproducir`, la estación de tierra **arranca conectada** (antes había que pulsar Conectar).
- **`--demo`** también manda `[time] … pos(5)=` (la estación a ~1,3 km de la rampa), para que `calc` (distancia, azimut y elevación) no salga `null`. Alimenta al `Traductor` por el mismo `ground_line()`.

**`estacion/dashboard.html`**: pestañas **Vuelo Demeter** y **Vuelo Hermes**, cada una un `<iframe>` a `/web/<mision>/` (con un enlace "abrir en una pestaña nueva"). Sin `dist/`, dicen que hay que compilar. `iframe.web` ocupa el alto restante (con `flex`).

**`estacion/pruebas/test_dashboard_api.py`** (22 pruebas): levanta el dashboard real como subproceso en un puerto libre.
**`estacion/README.md`**: las banderas nuevas y la sección de la API local.

## Evidencia
- `python -m unittest discover -s estacion/pruebas` → **96 pruebas, OK, 10,8 s** (74 de T-661 + 22 nuevas; Python 3.13, solo biblioteca estándar).
- Las 22 nuevas, contra el dashboard en `--demo`, `--reproducir` y sin `dist/`:
  - `snapshot` de las dos misiones válido contra `gui/web/src/contrato/esquema.json` (con `contrato.errores_snapshot` de T-661) y `proto_version` 4;
  - el stream de cada misión: cabecera `text/event-stream`, `meta` sin `id` primero, ids crecientes sin repetirse, y **cada evento válido contra el esquema** (`errores_mensaje`); llegan `estado` y `estacion` en ~5 s;
  - `Last-Event-ID`: continúa en `id + 1` sin huecos; un id futuro o basura no repite el pasado;
  - cinco streams abiertos y el resto responde en < 2 s;
  - `/api/cmd` (`d armar`, `si`) pasa por `comando()` y la fase de `web-1` llega a `ARMED` con su evento `fase`;
  - `Host` ajeno (`evil.com`, otro puerto, `localhost` sin puerto, ausente) y `Origin` ajeno → 403, en la API, el stream, `/web/`, `/assets/` y `/api/cmd`;
  - **16 rutas con `..`** (`/web/../secreto.txt`, `%2e%2e`, `%2F` codificada, `..\`, `//`, `C:/`, `%00`, un enlace simbólico dentro de `assets/`…): ninguna entrega el archivo de al lado de `dist/` ni el código del dashboard;
  - tipos MIME, `Content-Length` y `Range` (206, sufijo `bytes=-6`, 416);
  - sin `dist/`: 404 con el aviso y la API sigue;
  - la reproducción de una sesión generada de Demeter (T-6 s a T+20 s a ×500): snapshot válido, serie ≥ 150 puntos y el evento `despegue`.
- **Build real:** `npm ci` y `npm run build` (en `gui/web/`; 53 s, aislamiento OK). Con `dashboard.py --demo`, `curl` da 200 y el tipo correcto en `/web/demeter/`, `/web/hermes/`, `/web/`, `/demeter/`, `/assets/demeter-*.js` (`text/javascript`), `/assets/Pagina-*.css`, `/assets/Mapa-*.js` (1,1 MB), el `.woff2` y el worker de maplibre. `/mapas/santa_fe.pmtiles` da 404 porque aún no hay PMTiles (la web lo trata como "sin mapa base": es la única petición que falla en la consola).
- **Playwright** (Chromium, 1440×900, `deviceScaleFactor` 1), en `docs/07_bitacora/capturas/T-662/`:
  - `dashboard_vuelo_demeter.png`, `dashboard_vuelo_hermes.png`: `--demo`, pestañas del dashboard; "EN VIVO", "En la rampa", 2 m, sin errores de JS;
  - `reproduccion_demeter_estado.png`, `reproduccion_demeter_datos.png`: `--reproducir` de un vuelo generado (T+ 00:59 y 00:27, "Bajando con paracaídas", altitud, velocidad vertical, apogeo, Recuperación con el punto de impacto estimado, el botón de Google Maps y el QR).

## Decisiones tomadas o propuestas
1. **`dist/` se sirve con su `base` por defecto (`/`), sin tocar `vite.config.ts` ni el build.** El build de Vite escribe `/assets/…` y las páginas enlazan `/demeter/` y `/hermes/` en absoluto; con `base = /web/` habría que hacer un segundo build (no es el que se vuela) y, además, los enlaces fijos de `contenido/*.ts` y de la portada seguirían apuntando a `/demeter/`. Por eso el dashboard sirve esas cuatro carpetas en la raíz de su origen (no chocan con `/`, `/api/*`) y `/web/<x>` es un alias del mismo `dist/` (la portada queda en `/web/`). **Lo que se prueba es el mismo `dist/` que irá a internet.**
2. **Pestañas con `<iframe>`** (no pestaña nueva): lo más simple, comparte el origen (el cliente de la web usa `/api` relativo) y deja el banner de estado y el Historial a la vista. El enlace "abrir en una pestaña nueva" cubre una segunda pantalla. Al salir de la pestaña, el iframe se destruye y el stream se cierra (el hilo del servidor lo detecta al siguiente `ping`).
3. **`--reproducir` y la conexión automática de la estación en `--demo`** no estaban en la lista de la tarea; los agregué por el criterio de aceptación del backlog y porque sin eso las páginas no muestran datos hasta pulsar Conectar. Si Pablo no los quiere, se quitan sin tocar el resto.
4. **El bus guarda 4000 mensajes por misión** (≈ 7 min a 9 Hz en vuelo) para `Last-Event-ID`; es un parámetro propio (`WEB_BUS_MAX`, no está en `constantes.md`: lo marco como (P)). `WEB_SSE_LATIDO_S` (15) sí es de `constantes.md`.
5. **Sin `/api/v1/salud` ni `/api/v1/local/*`** (C-05 §2–§3): la tarea pide solo `snapshot` y `stream`; los comandos siguen siendo los de `/api/cmd` de Pablo.
6. **`estacion/web1.py` no se modificó.**

**Propuestas de cambio a contratos (no aplicadas):**
- **C-05 §2/§3 y el backlog:** documentar que, en la estación de Pablo, la API local es la de §2 sin `/api/v1/salud` ni `/api/v1/local/*` (los comandos son `/api/cmd` con el texto de la estación). Si T-663 quiere comandos con estado (`en_cola`/`confirmado`), sería la ocasión de hablar de `local/comandos`.
- Si más adelante se quiere un `base` distinto para la web local, `import.meta.env.BASE_URL` ya se usa para el PMTiles, pero los enlaces `otra.href` de `contenido/*.ts` y la portada son absolutos: habría que cambiarlos en otra tarea.

## Problemas y cómo se resolvieron
- `curl` y los navegadores normalizan `..`: las pruebas hablan con `http.client.putrequest`, que manda la ruta tal cual.
- Quedan en pantalla los avisos "Calibraciones sin terminar" (la `salud` de T-661 manda `calib` en `false`); lo resuelve T-611d (D-050: `null`).
- La captura en `--demo` no muestra trayectoria: el demo mantiene la altitud en ~510 m. Por eso las dos de vuelo salen de `--reproducir`.
- Playwright de `gui/web` (1.64) pide un Chromium que no está en este equipo; se usó el `playwright` global.

## Pendiente / siguiente paso
- **T-411** cambia `dashboard.py` para mostrar `TF_REANUDADO`; los puntos de contacto con esta tarea son `ground_line()` (una línea al inicio), `/api/cmd` (una línea), `connect()` y `main()`. Debe fusionarse sin conflicto de fondo.
- No se probó con el puerto serie real ni con una sesión real (T-670): no hay una en el repo.
- T-663 (panel Go/No-Go) y T-664 (alarmas) pueden leer `/api/v1/…/snapshot` o los mensajes ya calculados.
- Probado solo en Linux con Python 3.13; en Windows falta correr las pruebas (`SO_EXCLUSIVEADDRUSE` no cambió).

## Documentos afectados
`estacion/README.md` (banderas, API local). Ningún contrato.
