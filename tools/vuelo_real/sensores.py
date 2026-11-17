"""Lectura del recorte: lo que necesitan el detector de momentos, las alturas y la telemetria reconstruida."""
import os
import struct
import sys

import numpy as np

from . import vuelos as V

sys.path.insert(0, os.path.join(V.RAIZ, 'estacion'))
import calib  # noqa: E402
import ekf  # noqa: E402
import tblog  # noqa: E402

BMP_CONGELADO_S = 0.5          # el BMP581 repite el mismo valor este tiempo: no esta midiendo (8 nov, Demeter: congelado horas)


def bmp_valido(t_us, p):
    """Mascara de muestras del BMP581 en las que el sensor esta vivo: el valor cambio en los ultimos BMP_CONGELADO_S."""
    ok = np.zeros(len(p), dtype=bool)
    ultimo_cambio = None
    for i in range(len(p)):
        if i == 0 or p[i] != p[i - 1]:
            ultimo_cambio = t_us[i]
        ok[i] = i > 0 and t_us[i] - ultimo_cambio < BMP_CONGELADO_S * 1e6
    return ok


def cargar(mision):
    ruta = V.ruta_recorte(mision)
    recs = tblog.records(open(ruta, 'rb').read())[0]
    d = calib.load(ruta)                                        # LSM y QMI en ejes del chip (g, dps), MMC y QMC
    x = ekf.load_extra(ruta)                                    # PVT, BMP (mediana de 3, como el firmware), BME, momentos
    bar = [(r[3],) + struct.unpack('<qIIHHfff', r[4]) for r in recs if r[1] == tblog.T_BAR and len(r[4]) == 32]
    bme = np.array([(b[0], b[6], b[7]) for b in bar], dtype=float)          # t_us, p_pa, t_c
    bmp = np.c_[x['bmp'], x['bmp_temp']] if len(x['bmp']) else np.zeros((0, 3))
    vivo = bmp_valido(bmp[:, 0], bmp[:, 1]) if len(bmp) else np.zeros(0, dtype=bool)
    amb = [struct.unpack('<fffffqffBBBB', r[4]) for r in recs if r[1] == tblog.T_AMB and len(r[4]) == 40]
    mision_recs = [(r[3],) + struct.unpack('<IIBBBBBBBB', r[4]) for r in recs if r[1] == tblog.T_MISSION and len(r[4]) == 16]
    return dict(ruta=ruta, recs=recs, imu=d, extra=x, bme=bme, bmp=bmp, bmp_vivo=vivo,
                t_suelo_c=amb[0][2] if amb else None, mision=mision_recs)
