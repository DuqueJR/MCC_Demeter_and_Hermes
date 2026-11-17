"""Reconstruccion de un vuelo para la web: del recorte del .BIN y la sesion de tierra a los mensajes web-1 (modo `reconstruccion`).

Desde LAUNCH, la telemetria de ese cohete se rehace a 10 Hz con lo que el cohete registro a bordo:
- posicion, velocidad, actitud, fuerza especifica y giro: el EKF en PC (estacion/ekf.py) sobre el recorte, con la calibracion del repo;
- estado y momento: el detector de momentos (momentos.py), no los comandos manuales del dia;
- altura: la referencia ESTER (altura.py), la unica que se publica;
- GNSS (fix, satelites): el PVT del recorte;
- bateria, temperaturas, banderas, actuadores (Pi), hora, ACK, RSSI y SNR: el paquete real mas cercano que recibio tierra.
Antes de LAUNCH van los paquetes reales tal cual. Todo pasa por el mismo Traductor de web1.py que uso la estacion en vivo.
"""
import json
import math
import os
import statistics
import struct
import sys
import tempfile
import argparse
import contextlib
import io

import numpy as np

from . import altura, momentos, sensores
from . import vuelos as V

sys.path.insert(0, os.path.join(V.RAIZ, 'estacion'))
import ekf  # noqa: E402
import tblog  # noqa: E402
import web1  # noqa: E402

MODO = 'reconstruccion'
PERIODO_S = 0.1                     # TELEM a 10 Hz en vuelo
SLOT_S = 0.040
BASE_SLOT = {1: 1, 2: 2}            # ranura base de cada cohete (Demeter 1, Hermes 2)
TX_OFFSET_S = 0.002                 # el TX empieza 2 ms despues del inicio de la ranura
AIRE_MIN_S = 0.030                  # un TELEM tarda 29.5 ms en el aire (BW500, SF7)
TELEM = web1.TELEM


def _clamp16(x):
    return int(max(-32768, min(32767, round(x))))


def leer_sesion(ruta):
    out = []
    with open(ruta, encoding='utf-8') as f:
        for crudo in f:
            tok, _, linea = crudo.rstrip('\n').partition(' ')
            out.append((float(tok), linea))
    return out


def paquetes_reales(sesion, rid):
    """(t_local, utc_ms, campos, rssi, snr) de los TELEM de ese cohete."""
    out = []
    for t, linea in sesion:
        if not linea.startswith('@T '):
            continue
        p = linea.split(' ')
        if len(p) != 4:
            continue
        try:
            f = TELEM.unpack(bytes.fromhex(p[3]))
        except (ValueError, struct.error):
            continue
        if f[1] == rid:
            out.append((t, f[3], f, float(p[1]), float(p[2])))
    return out


def ekf_pc(s, v, det):
    """Corre estacion/ekf.py sobre el recorte con los momentos del detector. Devuelve un arreglo estructurado a 50 Hz."""
    d, x = s['imu'], s['extra']
    x = dict(x)
    x['momentos'] = [(t, m) for t, m in det.anuncios]
    if not s['usa_bmp']:                                   # BMP581 congelado: el EKF usa el BME280 de respaldo
        x['bmp'], x['bmp_temp'] = np.zeros((0, 2)), np.zeros(0)
    c = json.load(open(os.path.join(V.RAIZ, 'estacion', v['calib']), encoding='utf-8'))
    a = argparse.Namespace(calib=None, sin_gnss=False, sin_mag=False, sin_baro=False, sin_gravedad=False, solo_lsm=False,
                           solo_qmi=False, sin_escala=False, con_bme=False, sin_fases=False, t_suelo=s['t_suelo_c'])
    with tempfile.TemporaryDirectory() as tmp:
        salida = os.path.join(tmp, 'ekf.csv')
        registro = io.StringIO()
        with contextlib.redirect_stdout(registro):
            ekf.run(s['ruta'], a, data=(d, x, c), salida=salida)
        tabla = np.genfromtxt(salida, delimiter=',', names=True)
    return tabla, registro.getvalue()


def preparar(mision):
    v = V.VUELOS[mision]
    s = sensores.cargar(mision)
    d = s['imu']
    a = np.linalg.norm(d['lsm_a'], axis=1)
    w = np.linalg.norm(d['lsm_g'], axis=1)
    vivo = s['bmp_vivo']
    s['usa_bmp'] = bool(len(vivo) and vivo.mean() > 0.9)
    baro = s['bmp'][vivo] if s['usa_bmp'] else s['bme']          # t_us, p_pa, t_c
    en_rampa = baro[:, 0] < v['t_launch_us'] + 2e6
    p0 = float(np.median(baro[en_rampa, 1]))
    h_fis = altura.fisica(baro[:, 1], p0, s['t_suelo_c'])
    det = momentos.detectar(v['motor'], v['t_launch_us'], d['lsm_t'], a, w, baro[:, 0], h_fis)
    # referencia ESTER: isotermica con la temperatura efectiva que reproduce el apogeo oficial
    p_filt = momentos.mediana_movil(baro[:, 1], momentos.BARO_MEDIANA)
    p_min = float(p_filt[baro[:, 0] > det.t_boost].min())
    t_eff = altura.temperatura_efectiva(p_min, p0, v['apogeo_oficial_m'])
    h_ref = altura.isotermica(p_filt, p0, t_eff)
    t_bahia = float(np.median(baro[en_rampa, 2])) if s['usa_bmp'] else None
    h_medida = altura.con_temperatura_medida(p_filt, baro[:, 2], p0) if s['usa_bmp'] else None
    tabla, registro = ekf_pc(s, v, det)
    return dict(v=v, s=s, det=det, baro=baro, p0=p0, h_fis=momentos.mediana_movil(h_fis, momentos.BARO_MEDIANA), h_ref=h_ref,
                t_eff=t_eff, t_bahia=t_bahia, h_medida=h_medida, ekf=tabla, ekf_registro=registro)


def _ultimo(t_arr, t):
    i = int(np.searchsorted(t_arr, t, side='right')) - 1
    return max(i, 0)


def telemetria(r, ofs_utc_s, reales, latencia_s):
    """Los TELEM reconstruidos desde LAUNCH, como lineas `@T rssi snr hex` con su t_local."""
    v, det, e = r['v'], r['det'], r['ekf']
    rid = v['rid']
    pvt = r['s']['extra']['pvt']                                 # t_us, utc, fix, lat, lon, h, ...
    nsv = r['s']['extra']['sv']
    anuncios = det.anuncios
    t_real = np.array([p[1] for p in reales], dtype=float) / 1000.0
    ground_msl = statistics.median(p[2][6] / 100.0 for p in reales if p[1] / 1000.0 < v['t_launch_us'] / 1e6 + ofs_utc_s)
    u0 = v['t_launch_us'] / 1e6 + ofs_utc_s
    u1 = v['t_fin_us'] / 1e6 + ofs_utc_s
    pendientes = list(anuncios)
    momento = momentos.M_LAUNCH
    fase_ranura = BASE_SLOT[rid] * SLOT_S + TX_OFFSET_S
    k = math.ceil((u0 - fase_ranura) / PERIODO_S)
    out = []
    while True:
        utc = round(k * PERIODO_S + fase_ranura, 3)
        k += 1
        if utc > u1:
            break
        if utc < u0:
            continue
        t_us = (utc - ofs_utc_s) * 1e6
        i = _ultimo(e['t_us'], t_us)
        j = _ultimo(r['baro'][:, 0], t_us)
        q = _ultimo(pvt[:, 0], t_us) if len(pvt) else None
        # Un momento por paquete: si dos se anuncian dentro del mismo periodo (APOGEO y PARACAIDAS a 20 ms), cada uno sale en su
        # paquete; si no, tierra (y la web) se saltaria el primero. El firmware debe hacer lo mismo (T-412).
        while pendientes and pendientes[0][0] <= t_us:
            momento = pendientes.pop(0)[1]
            break
        ir = int(np.argmin(np.abs(t_real - utc)))
        real = reales[ir]
        f = real[2]
        rssi, snr = real[3], real[4]
        lat = e['lat_deg'][i] if math.isfinite(e['lat_deg'][i]) else f[4] / 1e7       # sin origen del EKF aun: la del paquete real
        lon = e['lon_deg'][i] if math.isfinite(e['lon_deg'][i]) else f[5] / 1e7
        campos = (web1.P_TELEM, rid, f[2], int(round(utc * 1000)),
                  int(round(lat * 1e7)), int(round(lon * 1e7)),
                  int(round((ground_msl + r['h_ref'][j]) * 100)),
                  _clamp16(e['vn_mps'][i] * 100), _clamp16(e['ve_mps'][i] * 100), _clamp16(e['vd_mps'][i] * 100),
                  _clamp16(e['qw'][i] * 32767), _clamp16(e['qx'][i] * 32767), _clamp16(e['qy'][i] * 32767), _clamp16(e['qz'][i] * 32767),
                  _clamp16(e['fx_g'][i] * 1000), _clamp16(e['fy_g'][i] * 1000), _clamp16(e['fz_g'][i] * 1000),
                  _clamp16(e['wx_dps'][i] * 10), _clamp16(e['wy_dps'][i] * 10), _clamp16(e['wz_dps'][i] * 10),
                  int(pvt[q, 2]) if q is not None else 0, int(nsv[q, 1]) if q is not None else 0,
                  f[22], f[23], f[24], 3 | (momento << 4), f[26] | 1, f[27], f[28], f[29], 0)
        out.append((round(utc + latencia_s, 3), f'@T {rssi:.1f} {snr:.1f} ' + TELEM.pack(*campos).hex()))
    return out


def generar(mision):
    r = preparar(mision)
    v, rid = r['v'], r['v']['rid']
    sesion = leer_sesion(V.ruta_sesion(mision))
    reales = paquetes_reales(sesion, rid)
    ofs = sensores_ofs(r['s'])
    # El reloj del portatil de la estacion no era UTC (iba ~34 ms atrasado): se corre la sesion para que el paquete que llego
    # mas rapido tarde AIRE_MIN_S, el aire de un TELEM, y los reconstruidos llegan con la demora mediana.
    retardos = [t - u / 1000.0 for t, u, *_ in reales if u]
    corrimiento = AIRE_MIN_S - min(retardos)
    sesion = [(round(t + corrimiento, 3), linea) for t, linea in sesion]
    reales = paquetes_reales(sesion, rid)
    latencia = statistics.median(retardos) + corrimiento
    u_launch = v['t_launch_us'] / 1e6 + ofs
    lineas = []
    for t, linea in sesion:
        if linea.startswith('@T '):
            p = linea.split(' ')
            try:
                f = TELEM.unpack(bytes.fromhex(p[3]))
            except (ValueError, struct.error, IndexError):
                continue
            if f[1] != rid or f[3] / 1000.0 >= u_launch:
                continue                     # el otro cohete no va en este stream; desde LAUNCH, la reconstruccion
        lineas.append((t, linea))
    lineas += telemetria(r, ofs, reales, latencia)
    lineas.sort(key=lambda x: x[0])
    tr = web1.Traductor(modo=MODO, ruta_referencia=None)
    mensajes = []
    t_ini = None
    for t, linea in lineas:
        for m in tr.procesar(linea, t):
            if m['mision'] != mision or (t_ini is None and m['tipo'] != 'meta'):
                continue                     # el archivo empieza con `meta`, como un stream al conectar
            t_ini = t if t_ini is None else t_ini
            mensajes.append({'t_rel_ms': int(round((t - t_ini) * 1000)), 'evento': m['tipo'], 'datos': m['datos']})
    snapshot = tr.snapshot(mision, lineas[-1][0])
    return r, mensajes, snapshot, ofs


def sensores_ofs(s):
    pvt = s['extra']['pvt']
    ok = pvt[:, 2] >= 2
    return float(np.median(pvt[ok, 1] - pvt[ok, 0] / 1e6))
