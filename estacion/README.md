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
| `web1.py` | (T-661) Traduce las líneas de la estación (`@T`, `@L`, `@G`, `[cmd ]`, `[time]`) a mensajes `web-1`. Solo biblioteca estándar. Como librería: `Traductor.procesar(linea, t_local)`, `tick`, `comando` y `snapshot(mision)`. Por línea de comandos reprocesa una sesión: `python estacion/web1.py sesiones/AAAAMMDD_HHMMSS_tierra.txt --salida web1.jsonl [--snapshot snap.json]`. Desde T-662 `dashboard.py` lo usa: un `Traductor` por proceso, con candado. |
| `tbget.py` | Descarga los logs de un cohete por USB: `python estacion/tbget.py COM3 list`, `get`, `get --ultimos 2`, `reset`. Opciones `--dir`, `--analizar`, `--csv`. Solo lee. |
| `tblog.py` | Resume un log `.BIN`: `python estacion/tblog.py LOG.BIN` (`--csv` deja un CSV por fuente en `LOG_csv/`). |
| `calib.py` | Calibración de un cohete desde un log hecho con la guía del dashboard: `python estacion/calib.py LOG.BIN --salida calib_x.json`. |
| `ekf.py` | EKF de prueba en PC (INS + GNSS) sobre un log: `python estacion/ekf.py LOG.BIN` deja `NOMBRE_ekf.csv`. |

Los `calib_*.json` y `dashboard.html` viven junto a los `.py` porque se buscan en la carpeta del propio script. Dependencias: `pyserial` para los puertos; `numpy` y `scipy` solo para `calib.py` y `ekf.py`.

Pruebas de `web1.py` y de la API local (unittest, sin dependencias nuevas): `python -m unittest discover -s estacion/pruebas`.

Salidas locales que no se versionan: `sesiones/`, `mision.json`, `*.BIN`, `*_csv/`, `*_ekf.csv`. Los resúmenes de `tblog.py` de los logs reales de Pablo están en `datos/logs_referencia/pablo/`.

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

## Qué viene (épica E10 del backlog)

| Tarea | Qué agrega |
| --- | --- |
| ~~T-661~~ | ~~`web1.py`: los paquetes de tierra → mensajes `web-1`~~ (hecha) |
| ~~T-662~~ | ~~API local `/api/v1/{mision}/snapshot` y `/stream`, y las páginas de misión de `gui/web`~~ (hecha, ver arriba) |
| T-663 | Panel Preparar / Go-No-Go por cohete |
| T-664 | Alarmas sonoras y visuales |
| T-605a | Reenviador de `web-1` al relay (solo de salida, con cola en disco) |

**Leer primero:** [estacion_terrena](../docs/04_diseno/estacion_terrena.md), [protocolo_paquetes](../docs/04_diseno/protocolo_paquetes.md) y [constantes](../docs/02_requisitos/constantes.md).
