# estacion/

**La estación terrena y el dashboard de operación** de Hermes y Demeter. Son las herramientas de Pablo Tilano (`tbeam_fw/tools/` de `ptilanom/DEMETER@17139b2`), adaptadas por tareas del backlog (D-045, D-046). Ya no habrá un servicio de tierra separado (T-602 queda reemplazada): `dashboard.py` es el dueño de los puertos, los comandos, las descargas y la calibración. Escucha solo en `127.0.0.1` (GS-14).

El firmware de las placas está en [`firmware/`](../firmware/README.md).

## Uso

```
pip install pyserial numpy scipy
python estacion/dashboard.py              # abre http://127.0.0.1:8765
python estacion/dashboard.py --demo       # sin placas: datos inventados
python estacion/dashboard.py --no-abrir --puerto 8799
```

- `--demo`: no necesita placas.
- `--no-abrir`: no abre el navegador.
- `--puerto N`: cambia el puerto HTTP (por defecto 8765).
- Los puertos serie por rol (`tierra`, `demeter`, `hermes`) están en `ROLES`, dentro de `dashboard.py`. Cierra antes los monitores serie.

## Herramientas

| Herramienta | Uso |
| --- | --- |
| `dashboard.py` + `dashboard.html` | La estación y el dashboard de misión (arriba). |
| `web1.py` | (T-661) Traduce las líneas de la estación (`@T`, `@L`, `@G`, `[cmd ]`, `[time]`) a mensajes `web-1`. Solo biblioteca estándar. Como librería: `Traductor.procesar(linea, t_local)`, `tick`, `comando` y `snapshot(mision)`. Por línea de comandos reprocesa una sesión: `python estacion/web1.py sesiones/AAAAMMDD_HHMMSS_tierra.txt --salida web1.jsonl [--snapshot snap.json]`. Todavía no está integrado con el servidor HTTP del dashboard (T-662). |
| `tbget.py` | Descarga los logs de un cohete por USB: `python estacion/tbget.py COM3 list`, `get`, `get --ultimos 2`, `reset`. Opciones `--dir`, `--analizar`, `--csv`. Solo lee. |
| `tblog.py` | Resume un log `.BIN`: `python estacion/tblog.py LOG.BIN` (`--csv` deja un CSV por fuente en `LOG_csv/`). |
| `calib.py` | Calibración de un cohete desde un log hecho con la guía del dashboard: `python estacion/calib.py LOG.BIN --salida calib_x.json`. |
| `ekf.py` | EKF de prueba en PC (INS + GNSS) sobre un log: `python estacion/ekf.py LOG.BIN` deja `NOMBRE_ekf.csv`. |

Los `calib_*.json` y `dashboard.html` viven junto a los `.py` porque se buscan en la carpeta del propio script. Dependencias: `pyserial` para los puertos; `numpy` y `scipy` solo para `calib.py` y `ekf.py`.

Pruebas de `web1.py` (unittest, sin dependencias nuevas): `python -m unittest discover -s estacion/pruebas`.

Salidas locales que no se versionan: `sesiones/`, `mision.json`, `*.BIN`, `*_csv/`, `*_ekf.csv`. Los resúmenes de `tblog.py` de los logs reales de Pablo están en `datos/logs_referencia/pablo/`.

## Qué viene (épica E10 del backlog)

| Tarea | Qué agrega |
| --- | --- |
| T-661 | `web1.py`: los paquetes de tierra → mensajes `web-1` |
| T-662 | API local `/api/v1/{mision}/snapshot` y `/stream`, y las páginas de misión de `gui/web` |
| T-663 | Panel Preparar / Go-No-Go por cohete |
| T-664 | Alarmas sonoras y visuales |
| T-605a | Reenviador de `web-1` al relay (solo de salida, con cola en disco) |

**Leer primero:** [estacion_terrena](../docs/04_diseno/estacion_terrena.md), [protocolo_paquetes](../docs/04_diseno/protocolo_paquetes.md) y [constantes](../docs/02_requisitos/constantes.md).
