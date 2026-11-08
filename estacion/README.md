# estacion/

**La estación terrena y el dashboard de operación** de Hermes y Demeter. Son las herramientas de Pablo Tilano (`tbeam_fw/tools/` de `ptilanom/DEMETER@17139b2`), adaptadas por tareas del backlog (D-045, D-046). Ya no habrá un servicio de tierra separado (T-602 queda reemplazada): `dashboard.py` es el dueño de los puertos, los comandos, las descargas y la calibración. Escucha solo en `127.0.0.1` (GS-14).

El firmware de las placas está en [`firmware/`](../firmware/README.md).

## Uso

```
pip install pyserial numpy scipy
python estacion/dashboard.py              # abre http://127.0.0.1:8765
python estacion/dashboard.py --demo       # sin placas: datos inventados
python estacion/dashboard.py --no-abrir --puerto 8799
python estacion/dashboard.py --reproducir sesiones/AAAAMMDD_HHMMSS_tierra.txt --velocidad 4
```

- `--demo`: no necesita placas.
- `--no-abrir`: no abre el navegador.
- `--puerto N`: cambia el puerto HTTP (por defecto 8765).
- `--reproducir SESION` (`--velocidad X`): sin placas, repite una sesión de tierra guardada por el propio dashboard (`<epoch> <línea>`); la estación de tierra queda conectada a esa reproducción.
- `--web-dist CARPETA`: el build de la web (por defecto `gui/web/dist`).
- Con `--demo` o `--reproducir`, la estación de tierra arranca conectada, para ver las páginas de misión sin hacer nada más.
- Los puertos serie por rol (`tierra`, `demeter`, `hermes`) están en `ROLES`, dentro de `dashboard.py`. Cierra antes los monitores serie.

## Herramientas

| Herramienta | Uso |
| --- | --- |
| `dashboard.py` + `dashboard.html` | La estación y el dashboard de misión (arriba). |
| `dashboard_ekf.js` | La pestaña **EKF** del dashboard de control (abajo). No toca la web pública. |
| `web1.py` | (T-661) Traduce las líneas de la estación (`@T`, `@L`, `@G`, `[cmd ]`, `[time]`) a mensajes `web-1`. Solo biblioteca estándar. Como librería: `Traductor.procesar(linea, t_local)`, `tick`, `comando` y `snapshot(mision)`. Por línea de comandos reprocesa una sesión: `python estacion/web1.py sesiones/AAAAMMDD_HHMMSS_tierra.txt --salida web1.jsonl [--snapshot snap.json]`. Desde T-662 `dashboard.py` lo usa: un `Traductor` por proceso, con candado. |
| `tbget.py` | Descarga los logs de un cohete por USB: `python estacion/tbget.py COM3 list`, `get`, `get --ultimos 2`, `reset`. Opciones `--dir`, `--analizar`, `--csv`. Solo lee. |
| `tblog.py` | Resume un log `.BIN`: `python estacion/tblog.py LOG.BIN` (`--csv` deja un CSV por fuente en `LOG_csv/`). |
| `calib.py` | Calibración de un cohete desde un log hecho con la guía del dashboard: `python estacion/calib.py LOG.BIN --salida calib_x.json`. |
| `cal_blob.py` | La calibración en el formato binario del cohete (D-059) y su carga por USB, como respaldo de la calibración a bordo: `python estacion/cal_blob.py calib_demeter.json --puerto COM4`. También desde el dashboard (Calibración → Cargar por USB). |
| `ekf.py` | EKF de prueba en PC (19 estados, D-057) sobre un log: `python estacion/ekf.py LOG.BIN` deja `NOMBRE_ekf.csv`. Opciones para comparar: `--sin-fases`, `--sin-escala`, `--con-bme`, `--t-suelo C`. |
| `vuelo_sintetico.py` | Vuelo sintético a partir de la simulación de OpenRocket (`datos/simulaciones/openrocket/`): genera los sensores con sus ruidos, corre el EKF y lo compara contra la verdad por fase. `python estacion/vuelo_sintetico.py demeter --comparar`. Deja `sinteticos/SINT_<cohete>_ekf.csv` para la pestaña EKF. |
| `vuelos_replay.py` | (T-304) Vuelos sintéticos para el banco de replay: escribe `.BIN` en el formato `rec` y su verdad en JSON, con la carga de eyección antes, en y después del apogeo. Ver [Vuelos sintéticos para el replay](#vuelos-sintéticos-para-el-replay-t-304). |

Los `calib_*.json` y `dashboard.html` viven junto a los `.py` porque se buscan en la carpeta del propio script. Dependencias: `pyserial` para los puertos; `numpy` y `scipy` solo para `calib.py` y `ekf.py`.

Pruebas de `web1.py` y de la API local (unittest, sin dependencias nuevas): `python -m unittest discover -s estacion/pruebas`.

Salidas locales que no se versionan: `sesiones/`, `mision.json`, `*.BIN`, `*_csv/`, `*_ekf.csv`. Los resúmenes de `tblog.py` de los logs reales de Pablo están en `datos/logs_referencia/pablo/`.

## Vuelos sintéticos para el replay (T-304)

`vuelos_replay.py` convierte la exportación de OpenRocket de cada cohete en archivos `.BIN` que se leen como los logs reales (`tblog.py`, `calib.py`, `ekf.py`). Es la entrada del banco de replay (T-305) y de la validación de la detección de momentos (T-412). Reutiliza `vuelo_sintetico.py` (la verdad y los sensores con ruido) y no cambia su línea de comandos.

```
python estacion/vuelos_replay.py                 # las 24 variantes de P-03 en estacion/vuelos_replay/ (unos 10 s cada una)
python estacion/vuelos_replay.py --lista         # solo las nombra
python estacion/vuelos_replay.py --cohete demeter --eyeccion despues --ruido 3 --semillas 1 2
python estacion/vuelos_replay.py --ruido 0 --semillas 0 --salida /tmp/ref      # sin ruido: la referencia de la aceptación
python -m unittest estacion.pruebas.test_vuelos_replay -v                      # unos 2 min: aceptación de T-304
```

**Qué produce** (en `estacion/vuelos_replay/`, que no se versiona), por variante `<DEM|HER>_SINT_<motor>_<eyeccion>_r<ruido>_s<semilla>`:
- `.BIN`: FILEHDR, EXT_LSM (giro, acelerómetro, marca del chip y BMP581 por el hub), IMU (QMI8658), BAR (BME280), MAG (QMC6309), EXT_MMC, PVT, PPS y HEARTBEAT, con `t_us` monótono y CRC válido. No escribe MISSION, LINK, PI, AMB ni CAL: eso lo produce el replay. Los ejes de los chips son los del cuerpo (calibración identidad).
- `.verdad.json`: cohete, motor, variante, semilla, factor de ruido, `t_us` de IGNITION, LIFTOFF, BURNOUT, EJECTION, APOGEE (con su altura AGL), PARACAIDAS_ABRE y GROUND_HIT, los parámetros de la carga de eyección y el conteo de registros.
- `calib_identidad.json`: para `python estacion/ekf.py archivo.BIN --calib estacion/vuelos_replay/calib_identidad.json`.

**Variantes:** los dos cohetes × la carga de eyección `antes` (la nominal de cada sim.: 1,46 s antes del apogeo en Demeter, 0,45 s en Hermes), `en` el apogeo y `despues` (1,5 s) × ruido ×1 y ×3 × 2 semillas = 24. Con `--ruido 0` salen sin ruido aleatorio (los sesgos de los sensores se quedan).

**Suposiciones** (los valores marcados **(P)** son parámetros de línea de comandos; los revisa el documentador):
- Trayectoria: `antes` y `en` usan la de OpenRocket tal cual (la sim. abre el paracaídas en el apogeo) y solo mueven el instante del choque y del pulso. `despues`: hasta el apogeo, la sim.; luego caída balística con el arrastre ajustado a la propia sim. y el paracaídas desde la carga (**(P)** `--despues-s` 1,5 s, `--apertura-s` 0,3 s) hasta la velocidad de descenso de la sim. La actitud entre el apogeo y la carga queda fija.
- Carga de eyección **(P)**: choque axial de 25 g y 15 ms (`--choque-g`, `--choque-ms`) y pulso de presión de +300 Pa con τ = 0,15 s (`--pulso-pa`, `--pulso-tau-s`): los de `vuelo_sintetico.py`.
- Ruido: `--ruido R` multiplica el ruido aleatorio de todos los sensores y la vibración del motor (1 g de σ **(P)**, `--vibracion`). Los ruidos por sensor son los de `vuelo_sintetico.py` (logs de banco).
- Presión: `p = p0 (1 − h/h_escala)^(1/0,190263)`, la inversa exacta de la altura de `ekf.py`, con la temperatura de la rampa de la sim. y `p0` **(P)** la estándar a 510 m (`--p-rampa-pa`). La presión absoluta de la sim. no se usa (perfiles_vuelo §3.4).
- Reposo **(P)**: 10 s en la rampa antes del encendido y 20 s en el suelo después (`--reposo-antes`, `--reposo-despues`).
- Tasas por sensor, las de `constantes.md` §5: LSM 1610 Hz (Demeter) y 1560 Hz (Hermes), QMI 445 Hz, BMP581 ≈ 100 Hz, BME280 ≈ 40 Hz, QMC 100 Hz, GNSS 10 Hz.
- El BME280 va compensado; sus conteos crudos (`adc_*`) y el BARCAL quedan en cero.
- `LIFTOFF` es el evento de OpenRocket, 0,03 s después de que empieza la fuerza (`IGNITION`, t = 0 de la sim.). El fin del empuje (`BURNOUT`) no es un escalón en la aceleración: la cola del empuje decae a cero, y se nota como el mínimo de la fuerza específica axial.
- La posición horizontal de la sim. se suaviza antes de derivarla (la exportación tiene 1 mm de resolución y con nodos de 2 ms daba picos de hasta 31 g en la fuerza específica de Hermes).

## Pestaña EKF (dashboard de control)

Es una sola vista con dos fuentes:

- **Repaso:** un `NOMBRE_ekf.csv` de `ekf.py`.
- **En vivo:** el TELEM de cada cohete.

**Qué muestra:**
- La actitud en 3D del cohete:
  - en cuerpo FRD;
  - naranja = la marca (-Z), azul = el costado derecho (+Y), verde = la velocidad;
  - la vista se gira arrastrando.
- La tabla de valores en el instante del cursor.
- Las gráficas:
  - altura, velocidad NED y Euler;
  - la nariz: inclinación desde la vertical y rumbo, que sirven con el cohete vertical, donde Euler pierde sentido;
  - la incertidumbre y los sesgos (solo en el repaso);
  - la aceleración y el enlace (solo en vivo).
- La trayectoria horizontal.
- La línea de tiempo:
  - reproducir y pausar con la barra espaciadora;
  - ±1 s con las flechas y ±10 s con Shift;
  - velocidad de 0.25 a 100x;
  - ventana de 30 s, 2 min, 10 min o todo;
  - clic en las gráficas para saltar a un instante.

**En vivo:**
- El servidor guarda el último TELEM de cada cohete (1 h a 10 Hz), así que al abrir la pestaña se ve todo desde que se conectó tierra.
- Con `--reproducir` sirve para repasar una sesión de tierra guardada.
- Mientras el cuaternion llegue en identidad, la pestaña avisa que aún no hay EKF a bordo.

**Instrumentos (desde el 2026-11-05):**
- **Fuerzas G:** un radar para el plano de la sección, visto desde la cola (+Y a la derecha, la marca arriba), y un indicador del eje X (nariz), donde se ve la gravedad (1 g quieto, nariz arriba). Estela de 2 s y banda de los últimos 10 s. En el repaso usan la fuerza específica en cuerpo ya calibrada; en vivo, los ejes del chip hasta que haya EKF a bordo.
- **Posición:** la trayectoria sobre teselas de OpenStreetMap (si hay internet; si no, la cuadrícula), con lat/lon y distancia al origen.
- **Estado:** batería (solo en vivo), RSSI y SNR, calidad del enlace (TELEM recibidos frente a los esperados, en vivo), SD (en vivo, el % del bloque; en el repaso, los MB escritos), GNSS y las estadísticas del EKF (sigmas y medidas aceptadas o rechazadas, en total y en los últimos 10 s).
- Los `_ekf.csv` y `.BIN` se buscan también en subcarpetas (por ejemplo, `Calibraciones fallidas/`). Un `_ekf.csv` de antes de este cambio se ve, pero sin instrumentos: hay que recalcularlo.

**Calcular:**
- Corre `ekf.py` sobre un `.BIN` de esta carpeta y carga el resultado.
- La calibración solo puede ser una que `ekf.py` acepte, es decir, con `retraso_ms` y `ganancia_giro` del QMI. Se busca aquí y en las subcarpetas.
- Si la vigente no sirve, se escoge la más reciente de ese cohete.
- Tarda alrededor de 1 min por `.BIN`.

**Rutas:**

| Ruta | Qué da |
| --- | --- |
| `GET /api/ekf/lista` | Los `_ekf.csv`, los `.BIN` y las calibraciones que sirven. |
| `GET /api/ekf/archivo?f=NOMBRE_ekf.csv` | El CSV tal cual. |
| `GET /api/ekf/vivo?r=1\|2&desde=N` | Los TELEM con número mayor que N, en columnas. |
| `POST /api/ekf/run {name, opts, calib}` | Corre `ekf.py`. Usa el mismo panel de trabajos que las descargas, así que no corre mientras haya una descarga. |

## API local y páginas de misión (T-662)

`dashboard.py` sirve, solo en `127.0.0.1` y solo con `Host` conocido (GS-14):

| Ruta | Qué da |
| --- | --- |
| `GET /api/v1/{demeter\|hermes}/snapshot` | El `snapshot` de `web-1` ([05 §3](../docs/08_gui/05_contrato_datos_web.md)) de esa misión. |
| `GET /api/v1/{demeter\|hermes}/stream` | SSE: `id` = contador por misión (de este proceso), `event: <tipo>`, `data: <JSON>`, y un `: ping` cada 15 s (`WEB_SSE_LATIDO_S`). Primero un `meta` sin `id`; después, solo lo nuevo. Con `Last-Event-ID` repite lo que aún guarda (los últimos 4000 mensajes por misión). |
| `/web/…`, `/demeter/`, `/hermes/`, `/assets/…`, `/mapas/…` | Los archivos de `gui/web/dist/` (con `Range`, para el PMTiles del mapa). Son las mismas rutas del build de la web pública (`base` = `/`): no hace falta otra configuración. |

- Las páginas salen de `npm run web:build` (desde la raíz del repo). Sin `dist/`, las pestañas **Vuelo Demeter** y **Vuelo Hermes** del dashboard dicen que hay que compilarla.
- La web usa `/api` (relativo), así que, servida desde aquí, lee estas rutas sin configurar nada.
- Un stream SSE ocupa un hilo del servidor (`ThreadingHTTPServer`); no bloquea al resto.
- Cada línea de tierra entra al `Traductor` (`procesar`), un hilo da el latido a 1 Hz (`tick`) y cada comando de `/api/cmd` llama antes a `comando()`.

## Pendiente del dashboard de control (pedido de Pablo, 2026-11-04)

El dashboard de control es privado: tiene toda la información, los controles y las herramientas, y hace relay a la web pública de lo que se decida, cuando y como se decida. La web pública (`gui/web`, `web1.py`, contrato `web-1`) es trabajo aparte.

Para cuando se retome el dashboard:

- Toda la información del vuelo: aceleraciones, actitud, ubicación y velocidades.
- Dos indicadores de fuerzas G tipo radar (un punto que se desplaza dentro de un círculo): uno para el plano de la sección del cohete (Y-Z del cuerpo) y otro para el eje longitudinal (X del cuerpo), donde se ve la gravedad.
- El visualizador de actitud (ya existe en la pestaña EKF).
- La carga de las baterías, la intensidad de la señal y la calidad del enlace.
- La posición actual del cohete en un mapa.
- Las estadísticas del EKF.
- El nivel de las memorias SD de la LilyGo y de la Pi.

Observaciones sobre la pestaña EKF (Pablo, 2026-11-05), menores:

- SD: la reserva preasignada en verde y, al excederla, lo que se graba fuera de ella en otro color.
- Filtros seleccionables por variable (paso alto y de ruido) en las gráficas, con un filtro recomendado según los registros (identificar las vibraciones y sugerir el corte).
- Mapa: la flecha del rumbo de la nariz, con largo según la proyección horizontal de la punta (casi nula con la nariz arriba).
- Reubicar el selector de ventana.

## Qué viene (épica E10 del backlog)

| Tarea | Qué agrega |
| --- | --- |
| ~~T-661~~ | ~~`web1.py`: los paquetes de tierra → mensajes `web-1`~~ (hecha) |
| ~~T-662~~ | ~~API local `/api/v1/{mision}/snapshot` y `/stream`, y las páginas de misión de `gui/web`~~ (hecha, ver arriba) |
| T-663 | Panel Preparar / Go-No-Go por cohete |
| T-664 | Alarmas sonoras y visuales |
| T-605a | Reenviador de `web-1` al relay (solo de salida, con cola en disco) |

**Leer primero:** [estacion_terrena](../docs/04_diseno/estacion_terrena.md), [protocolo_paquetes](../docs/04_diseno/protocolo_paquetes.md) y [constantes](../docs/02_requisitos/constantes.md).

## Sesión en un comando (T-672)

Dos scripts para macOS (`bash`) que hacen el proceso de [`11_guia_despliegue`](../docs/08_gui/11_guia_despliegue.md) §8 sin pasos manuales. Funcionan desde cualquier carpeta; `--ayuda` explica cada uno.

```
estacion/iniciar_sesion.sh [--permitir-ensayo] [opciones del dashboard]    # ej.: --no-abrir  --puerto 8799
estacion/detener_sesion.sh [--apagar] [carpeta de la sesión]
```

**`iniciar_sesion.sh`** (queda en **primer plano**: es el propio dashboard, `Ctrl+C` lo cierra):
1. Revisa `fly` con sesión, `estacion/.venv` con `pyserial`, el token del Llavero (`hermes-relay-token`, 64 caracteres, sin mostrarlo) y el puerto 8765 libre (si hay un dashboard viejo, pregunta antes de cerrarlo).
2. Busca el ID de la máquina (limpio), la prende si está `stopped`, espera `salud` `"estado": "ok"` y avisa si en `fly logs` sale `Trial machine stopping`.
3. Muestra `seq_relay` y `mission_id` por misión. **Si `seq_relay` > 0 avisa en grande** que hay datos de una sesión anterior; **no limpia** (guía §4).
4. Crea `estacion/sesiones_relay/AAAAMMDD_HHMMSS/` (ignorada por git) con `inicio.json` (hora, máquina, salud inicial y el PID del dashboard) y abre `dashboard.py --web-relay https://api.eiaspice.space` con el token **solo en su entorno**.
5. `--demo` y `--reproducir` se rechazan contra el relay real, salvo con `--permitir-ensayo` (con un relay local, `http://127.0.0.1`, no hace falta). `--web-relay` no se acepta: la URL sale de `RELAY_URL`.

Después: en el dashboard, "tierra" → elegir el puerto → Conectar; la web está en `https://eiaspice.space/demeter/` y `/hermes/`.

**`detener_sesion.sh`** (en otra terminal, o en la misma tras `Ctrl+C`):
1. Toma la última carpeta de `sesiones_relay/` (o la que le pases), cierra el dashboard de esa sesión (SIGINT al PID de `inicio.json`, solo si sigue siendo un `dashboard.py`).
2. Guarda en esa carpeta `salud_final.json`, `snapshot_demeter.json`, `snapshot_hermes.json`, los `/datos/*.jsonl` del relay (por `fly ssh sftp get`, con la copia verificada por tamaño; si falla, por `base64` en `fly ssh console -C`), los `*_tierra.txt` de `estacion/sesiones/` creados desde el inicio y un `resumen.txt` (conteos por misión y tipo, `seq_relay` final, tamaños y fallos).
3. Pregunta si apagar la máquina (por defecto **no**; `--apagar` la apaga sin preguntar). **Nunca borra datos del relay**: la limpieza antes del vuelo es aparte (guía §4).
4. Sale con código 1 si algo no se pudo guardar (el `resumen.txt` dice qué).

Variables: `RELAY_APP` (`hermes-demeter-relay`), `RELAY_URL` (`https://api.eiaspice.space`), `RELAY_MAQUINA`, `SIN_FLY=1` (salta Fly: para un relay local; con `RELAY_DATOS_LOCAL=<carpeta>` copia ahí los `*.jsonl`), `PYTHON_ESTACION`, `ESPERA_SALUD_S`. El token se toma de `WEB_INGESTA_TOKEN` si ya está en el entorno, y si no, del Llavero. `sesion_comun.sh` es la parte compartida (se carga con `source`, no se corre sola).

Probar sin tocar Fly ni el relay real: arrancar `gui/relay/servidor.py` (127.0.0.1:8787) con un token de prueba de 64 caracteres y correr los dos scripts con `RELAY_URL=http://127.0.0.1:8787 SIN_FLY=1 RELAY_DATOS_LOCAL=<WEB_RELAY_DATOS del relay>`.

## Reenviador al relay público (T-605a)

`reenviador.py` sube los mensajes `web-1` de los dos cohetes al relay público (`POST /api/v1/ingesta`, lotes `{"mensajes": [...]}` con `Authorization: Bearer <token>`). **Está apagado por defecto**: sin URL y sin token no hay hilo, ni archivos, ni cambios en el dashboard. Solo biblioteca estándar. Nota: el relay (T-640) todavía no existe; esto se probó contra un servidor de mentira.

```
cp estacion/.env.example estacion/.env      # y llena WEB_INGESTA_TOKEN (y WEB_RELAY_URL, si no usas --web-relay)
python estacion/dashboard.py --web-relay https://relay.ejemplo.org
```

- **Token:** la variable de entorno `WEB_INGESTA_TOKEN` o `estacion/.env` (ignorado por git; la variable gana). No se pasa por línea de comandos y no sale en los eventos. Con `http://` a otra máquina avisa que el token viaja sin cifrar.
- `--web-relay URL` (o `WEB_RELAY_URL`): la URL base del relay. `--web-cola ARCHIVO`: la cola en disco (por defecto `estacion/cola_web.db`, ignorada por git).
- **Solo de salida:** no abre puertos ni recibe nada. Solo `web-1` de `demeter` y `hermes`; nunca comandos ni la API local.
- **No afecta al dashboard:** `web_publicar` (dentro de `tr_lock`) solo agrega a una cola en memoria acotada (5000); un hilo aparte hace el disco y la red, con tiempo límite de 5 s. Un relay caído, lento o colgado, un disco lleno o una excepción solo se ven en los eventos.
- **Cola en disco** (sqlite): sobrevive a reiniciar el dashboard y guarda hasta 50 000 mensajes; si se llena, descarta lo más viejo y lo cuenta. Si el disco falla, sigue en memoria.
- **Reintentos:** retroceso de 0,5 s a 8 s. Con 401 o 403 avisa una vez y reintenta cada 60 s. Un 400, 413 o 422 parte el lote hasta aislar el mensaje malo, que se descarta y se cuenta.
- **Orden tras una caída:** cada lote lleva hasta 50 mensajes viejos (en orden) más todo lo de los últimos 5 s. Lo que pasa ahora llega enseguida (objetivo `WEB_LATENCIA_MAX_S` = 2 s) y el atraso se vacía en paralelo. Un lote sin respuesta se reintenta idéntico, con el mismo `X-Lote-Id`.
- **Estado en los eventos del dashboard:** `web: reenviador CONECTADO ...`, `... SIN CONEXION ...` y, mientras esté caído, una línea por minuto con los mensajes en cola y los perdidos.
- Con `--demo` o `--reproducir` avisa que lo que sube no es del vuelo (el `meta.modo` seguirá diciendo `vivo`): no lo uses contra el relay real.
- Pruebas: `python -m unittest discover -s estacion/pruebas` (`test_reenviador.py`, sin red real).

## Fixture de integración reenviador → relay sin hardware (T-641)

Para probar la cadena **estación → reenviador → relay** sin placas ni relay real, se versiona un JSONL de mensajes `web-1` en `estacion/fixtures/` (fuera de `estacion/sesiones/`, que está en `.gitignore` porque guarda sesiones reales):

| Archivo | Qué es |
| --- | --- |
| `estacion/fixtures/web1.jsonl` | Vuelo completo de Demeter desde la simulación de OpenRocket, reprocesado por `web1.py`: 1347 mensajes `{"tipo","mision","datos"}` (`meta`, `estado`, `salud`, `estacion`, `evento`). |
| `estacion/fixtures/web1_snapshot.json` | El `snapshot` final de `demeter` y `hermes` (Hermes no transmitió). |
| `estacion/fixtures/regenerar.py` | Regenera los dos de arriba, **de forma determinista** (misma semilla: T-30 s → aterrizaje + 15 s de la sim. de Demeter). Solo biblioteca estándar. |

**Regenerar el fixture (determinista):**

```
python estacion/fixtures/regenerar.py
python estacion/fixtures/regenerar.py --sesion estacion/sesiones/T641_tierra.txt   # además deja la sesión cruda (ignorada por git)
```

**Probar reenviador → relay sin hardware** (el relay todavía no existe, T-640): el test valida el fixture contra el contrato `web-1` y lo publica con el `Reenviador` real contra un servidor HTTP falso en `127.0.0.1` (`RelayFalso` de `test_reenviador.py`; solo registra el `POST /api/v1/ingesta` y responde 200 — no es una reimplementación del relay):

```
python -m unittest discover -s estacion/pruebas -p 'test_fixture_web1.py' -v
```

**Publicarlo a mano apuntando a una URL local** (con una sesión cruda y un stub que responda 200):

```
python estacion/fixtures/regenerar.py --sesion estacion/sesiones/T641_tierra.txt
WEB_INGESTA_TOKEN=token-de-prueba python estacion/dashboard.py --reproducir estacion/sesiones/T641_tierra.txt \
  --velocidad 500 --web-relay http://127.0.0.1:8000 --web-cola /tmp/cola_web.db --no-abrir
```

El reenviador hará `POST http://127.0.0.1:8000/api/v1/ingesta` con `Authorization: Bearer <token>` y lotes `{"mensajes":[...]}`.

**Huecos que dependen de otros (no se pueden cerrar aquí):**
- **T-640 (el relay, en progreso):** la prueba de punta a punta contra el relay real no se puede hacer todavía. El stub local (`RelayFalso`) cubre el formato y el orden, pero no la deduplicación por `X-Lote-Id`, la bajada a 1 Hz en tierra ni los SSE públicos.
- **PEN-W05 (hosting/dominio):** no hay URL pública con TLS a la que apuntar `--web-relay`; el flujo documentado usa `http://127.0.0.1`.
