# tools/tbeam/

Herramientas de PC para trabajar con las placas T-Beam. **Es una copia de las herramientas de Pablo** (`tbeam_fw/tools/` de `ptilanom/DEMETER@17139b2`, D-037): no se editan a mano; los cambios van por el repo de Pablo y se re-sincronizan (T-007). Los `calib_*.json` y `dashboard.html` viven junto a los `.py` porque `dashboard.py` los busca en su propia carpeta.

Dependencias: `pip install pyserial numpy scipy` (`pyserial` para los puertos; `numpy` y `scipy` solo para `calib.py` y `ekf.py`).

| Herramienta | Uso |
| --- | --- |
| `dashboard.py` | Dashboard local de misión: `python3 dashboard.py` abre `http://127.0.0.1:8765`. `--demo` no necesita placas (datos inventados). `--no-abrir` no abre el navegador. `--puerto N` cambia el puerto HTTP. Los puertos serie por rol (`tierra`, `demeter`, `hermes`) están en `ROLES` dentro del archivo. Cierra antes los monitores serie. |
| `tbget.py` | Descarga los logs de un cohete por USB: `python3 tbget.py COM3 list`, `get`, `get --ultimos 2`, `reset`. Opciones `--dir`, `--analizar`, `--csv`. Solo lee. |
| `tblog.py` | Resume un log `.BIN`: `python3 tblog.py LOG.BIN` (`--csv` deja un CSV por fuente en `LOG_csv/`). |
| `calib.py` | Calibración de un cohete desde un log hecho con la guía del dashboard: `python3 calib.py LOG.BIN --salida calib_x.json`. |
| `ekf.py` | EKF de prueba en PC (INS + GNSS) sobre un log: `python3 ekf.py LOG.BIN` deja `NOMBRE_ekf.csv`. |

Salidas locales que no se versionan: `sesiones/`, `mision.json`, `*.BIN`, `*_csv/`, `*_ekf.csv`. Los resúmenes de `tblog.py` de los logs reales de Pablo están en `datos/logs_referencia/pablo/`.
