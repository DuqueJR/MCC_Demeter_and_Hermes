"""resumen.json: lo que se sabe de cada vuelo, para la pagina (Resumen del vuelo) y para revisar la reconstruccion."""
import numpy as np

from . import momentos


UNIDAD = {'BOOST': 'dv_mps', 'APOGEO': 'altura_fisica_m', 'PARACAIDAS': 'pico_g'}


def _r(x, n=2):
    return None if x is None or not np.isfinite(x) else round(float(x), n)


def de_vuelo(mision, r, ofs_utc_s):
    v, det, e = r['v'], r['det'], r['ekf']
    t0 = det.t_boost
    rel = lambda t_us: _r((t_us - t0) / 1e6, 3)                                    # noqa: E731
    pvt = r['s']['extra']['pvt']
    en_vuelo = (pvt[:, 0] > t0) & (pvt[:, 0] < t0 + 60e6) & (pvt[:, 2] == 3)
    en_rampa = (pvt[:, 0] < v['t_launch_us'] + 2e6) & (pvt[:, 2] == 3)
    h_gnss = float(pvt[en_vuelo, 5].max() - np.median(pvt[en_rampa, 5])) if en_vuelo.any() and en_rampa.any() else None
    vuela = (e['t_us'] > t0) & (e['t_us'] < t0 + 120e6)
    vel = np.sqrt(e['vn_mps'] ** 2 + e['ve_mps'] ** 2 + e['vd_mps'] ** 2)
    sube = (r['baro'][:, 0] > t0) & (r['baro'][:, 0] < t0 + 30e6)
    return {
        'mision': mision, 'motor': v['motor'],
        'despegue_utc_ms': int(round((t0 / 1e6 + ofs_utc_s) * 1000)),
        'apogeo_m': {
            'oficial_ester': v['apogeo_oficial_m'],
            'referencia_publicada': _r(r['h_ref'][sube].max(), 1),
            'ester_con_temperatura_bahia': _r(r['h_medida'][sube].max(), 1) if r['h_medida'] is not None else None,
            'fisica_aire_suelo': _r(r['h_fis'][sube].max(), 1),
            'ekf_pc': _r(float(-e['pd_m'][vuela].min()), 1),
            'gnss': _r(h_gnss, 1),
        },
        'temperaturas_c': {'efectiva_ester': _r(r['t_eff'], 2), 'bahia_en_rampa': _r(r['t_bahia'], 2), 'aire_suelo': _r(r['s']['t_suelo_c'], 2)},
        'barometro': 'BMP581' if r['s']['usa_bmp'] else 'BME280 (BMP581 congelado)',
        'velocidad_max_mps': _r(float(vel[vuela].max()), 1),
        # T+ desde el BOOST detectado, como la web. El encendido es ~60 ms antes (lo que tarda el detector en sumar 5 m/s).
        'momentos': {k: dict({'t_mas_s': rel(t)}, **({UNIDAD[k]: _r(val, 2)} if k in UNIDAD else {}))
                     for k, (t, val) in sorted(det.hechos.items(), key=lambda kv: kv[1][0])},
        'anuncios': [{'momento': momentos.NOMBRES[m], 't_mas_s': rel(t)} for t, m in det.anuncios],
        'avisos_respaldo': [{'t_mas_s': rel(t), 'texto': txt} for t, txt in det.avisos],
        'parametros_detector': momentos.MOTORES[v['motor']],
    }
