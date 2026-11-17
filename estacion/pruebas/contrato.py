"""Valida un mensaje `web-1` contra `gui/web/src/contrato/esquema.json` y contra las coherencias de
`tools/web_datos/validacion.py` (T-612), que se importa tal cual.

Desde T-611d `validacion.py` esta alineado con el esquema (nulabilidad de `relay_utc_ms`, `enlace.*`,
`temp_esp_c`, `sd_libre_mb`, `apogeo_m`, `estacion.pos`, `boot_count` y `calib.*`; `seq` sin tope;
`lkp` con `pos` nula valido), asi que los mensajes se le entregan SIN normalizar.
"""
from generador import RAIZ  # noqa: F401  (deja `estacion/` y la raiz en sys.path)
import esquema_minimo

from tools.web_datos import validacion as V

_ESQUEMA = esquema_minimo.cargar_esquema()


def errores_mensaje(msg):
    """Errores de un mensaje `{"tipo", "mision", "datos"}`; lista vacia si es valido."""
    tipo, mision, datos = msg['tipo'], msg['mision'], msg['datos']
    errores = []
    if set(msg) != {'tipo', 'mision', 'datos'}:
        errores.append(f'el mensaje debe tener exactamente tipo, mision y datos: {sorted(msg)}')
    if mision not in ('demeter', 'hermes'):
        errores.append(f'mision invalida: {mision!r}')
    errores += esquema_minimo.validar_mensaje(tipo, datos, _ESQUEMA)
    errores += V.validar_mensaje(tipo, datos)
    if tipo == 'meta' and datos['nodo'] != {'demeter': 1, 'hermes': 2}.get(mision):
        errores.append('meta: mision y nodo no coinciden')
    return errores


def errores_snapshot(snap):
    """Errores de un snapshot: el esquema, y lo que el esquema no expresa (serie, mision y nodo, fase y fase_cod)."""
    errores = esquema_minimo.validar_snapshot(snap, _ESQUEMA)
    serie = snap['serie']
    largos = {k: len(v) for k, v in serie.items()}
    if len(set(largos.values())) != 1:
        errores.append(f'serie: columnas de largo distinto {largos}')
    if max(largos.values()) > 2000:
        errores.append('serie: mas de WEB_SERIE_MAX_PUNTOS')
    est = snap['estado']
    if est is not None and V.C.FASES[est['fase']] != est['fase_cod']:
        errores.append('estado: fase y fase_cod no coinciden')
    if snap['meta']['nodo'] != {'demeter': 1, 'hermes': 2}[snap['meta']['mision']]:
        errores.append('meta: mision y nodo no coinciden')
    for ev in snap['eventos']:
        errores += [f'evento: {e}' for e in V.validar_mensaje('evento', ev)]
    return errores
