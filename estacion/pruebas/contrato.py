"""Valida un mensaje `web-1` contra `gui/web/src/contrato/esquema.json` y contra las coherencias de
`tools/web_datos/validacion.py` (T-612), que se importa tal cual.

`validacion.py` es el validador del generador de ejemplos: se escribio antes que el esquema oficial y en
varios puntos es MAS estricto que `esquema.json` y que los documentos 05 y protocolo §6. Aqui se compara
con el esquema oficial (la fuente de verdad) y, para que `validacion.py` pueda correr sus comprobaciones
de coherencia (decimales, fase y fase_cod, cuaternion unitario, `pos` frente a `gnss_fix`, eventos...),
se le entrega el mensaje con esos puntos normalizados:

1. `estado.relay_utc_ms` exige entero: el servicio local no tiene relay, y 05 §0 dice que es siempre `null`.
2. `estado.seq` exige 0..255: protocolo §6 fija `seq = utc_ms / 40` (un indice de ranura de ~4,4e10).
3. `estado.lkp` con `pos = null` lo marca error ("lkp sin posicion"): es justo el caso para el que existe el
   LKP (PA-22: "si `pos` llega en `null`, la web dibuja el LKP").
4. `estado.enlace.*` exige dato: 05 §0 los admite `null` (sin ranura no hay perdidas que contar).
5. `salud.temp_esp_c`, `salud.sd_libre_mb`, `salud.apogeo_m` y `estacion.pos` exigen dato: net_proto no los trae
   (protocolo §6) y el esquema los admite `null`.
"""
import copy

from generador import RAIZ  # noqa: F401  (deja `estacion/` y la raiz en sys.path)
import esquema_minimo

from tools.web_datos import validacion as V

_ESQUEMA = esquema_minimo.cargar_esquema()


def _normalizar(tipo, datos):
    d = copy.deepcopy(datos)
    if tipo == 'estado':
        d['relay_utc_ms'] = d['rx_utc_ms']
        d['seq'] = d['seq'] & 0xFF
        if d['pos'] is None:
            d['lkp'] = None
        for k in ('rssi_dbm', 'snr_db', 'perdidos_pct_10s'):
            if d['enlace'][k] is None:
                d['enlace'][k] = 0
    elif tipo == 'salud':
        if d['temp_esp_c'] is None:
            d['temp_esp_c'] = 0
        if d['sd_libre_mb'] is None:
            d['sd_libre_mb'] = 0
        if d['apogeo_m'] is None:
            d['apogeo_m'] = 0.0
    elif tipo == 'estacion':
        if d['pos'] is None:
            d['pos'] = {'lat': 0.0, 'lon': 0.0, 'alt_msl_m': 0.0}
    return d


def errores_mensaje(msg):
    """Errores de un mensaje `{"tipo", "mision", "datos"}`; lista vacia si es valido."""
    tipo, mision, datos = msg['tipo'], msg['mision'], msg['datos']
    errores = []
    if set(msg) != {'tipo', 'mision', 'datos'}:
        errores.append(f'el mensaje debe tener exactamente tipo, mision y datos: {sorted(msg)}')
    if mision not in ('demeter', 'hermes'):
        errores.append(f'mision invalida: {mision!r}')
    errores += esquema_minimo.validar_mensaje(tipo, datos, _ESQUEMA)
    errores += V.validar_mensaje(tipo, _normalizar(tipo, datos))
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
