#!/usr/bin/env python3
"""vuelo_sintetico.py - Vuelo sintetico a partir de la simulacion de OpenRocket, para probar ekf.py contra la verdad.

Uso:  python vuelo_sintetico.py demeter                  EKF con fases y escala del giro, contra la verdad
      python vuelo_sintetico.py hermes --comparar        tres corridas: completo, --sin-fases y --sin-escala
Opciones: --alabeo DPS (giro maximo sobre el eje, defecto 200)  --vibracion G (ruido del motor, defecto 1.0)
          --escala X,Y,Z (factor de escala real del giro en %, defecto 0.75,0,1.5)  --semilla N  --sin-fases --sin-escala --sin-mag

Genera los mismos datos que calib.load y ekf.load_extra sacan de un .BIN (LSM6DSO32 a 1610 Hz, QMI8658 a 445 Hz, BMP581, BME280,
MMC5983MA, QMC6309, GNSS a 10 Hz con PPS y los momentos de la mision), con una calibracion identidad, y corre ekf.navigate.
Deja sinteticos/SINT_<cohete>_ekf.csv para verlo en la pestana EKF del dashboard.

De la simulacion salen: trayectoria, elevacion y rumbo de la nariz hasta la carga de eyeccion, empuje, presion del aire y eventos.
SUPUESTOS (la simulacion no los tiene; todos son parametros): el alabeo, la actitud bajo el paracaidas (nariz abajo con balanceo),
la vibracion del motor, el choque y el pulso de presion de la carga de eyeccion, la perdida del GNSS por encima de 4 g y los ruidos
y sesgos de los sensores (sacados de los logs reales de banco).
"""
import argparse, os, sys, types
import numpy as np
from scipy.interpolate import CubicSpline, PchipInterpolator
from scipy.spatial.transform import Rotation

import ekf

AQUI = os.path.dirname(os.path.abspath(__file__))
SIM = {'demeter': 'demeter_H135W-8_santa-fe-antioquia_sim2.csv', 'hermes': 'hermes_G80-7T_santa-fe-antioquia_pablo.csv'}
G0 = 9.78
PAD_S, POST_S = 30.0, 20.0                    # quieto en la rampa antes del despegue y en el suelo despues de caer
UTC0 = 1793851200.0                           # 2026-11-05, solo para las marcas de hora
T_LOCAL0_US = 5e6                             # el reloj local empieza en 5 s, como tras un arranque

# Sensores (ruidos por muestra, de los logs de banco: DEM 0096, 0091, 0092)
LSM_HZ, QMI_HZ, BMP_HZ, BME_HZ, MAG_HZ, GNSS_HZ = 1610.4, 445.0, 100.7, 40.2, 100.0, 10.0
LSM_ACC_SD, LSM_GYR_SD = 0.006, 0.23          # g, dps
QMI_ACC_SD, QMI_GYR_SD = 0.004, 0.07
LSM_BG, QMI_BG = np.array([-0.46, -0.21, -0.38]), np.array([-3.97, 0.04, 2.10])   # dps: los que mide el arranque quieto
LSM_BA = np.array([0.005, -0.002, 0.001])     # g
BMP_SD, BME_SD, BME_OFS = 0.5, 1.8, -105.0    # Pa
MAG_B, MAG_DIP = 0.30, 28.0                   # G, grados (Colombia: ~29 medido)
MMC_SD, QMC_SD = 0.0015, 0.0025               # G
GNSS_POS_SD, GNSS_POS_TAU, GNSS_VEL_SD, GNSS_ALT_SD = 0.8, 20.0, 0.08, 1.5
GNSS_LAT_S = 0.05                             # retraso de entrega del PVT
GNSS_MAX_G, GNSS_REACQ_S = 4.0, 1.5           # M10S en modo aereo (<4 g): SUPUESTO, pierde la solucion por encima y la recupera despues
# Carga de eyeccion (SUPUESTOS)
EJ_CHOQUE_G, EJ_CHOQUE_S = 25.0, 0.015
EJ_PULSO_PA, EJ_PULSO_TAU = 300.0, 0.15
IMPACTO_S = 0.15                              # SUPUESTO: el golpe contra el suelo dura esto
VOLTEO_S = 1.0                                # tras la carga, el cohete pasa a colgar del paracaidas
DESC_ELEV, DESC_BALANCEO, DESC_HZ, DESC_GIRO_DPS = -80.0, 10.0, 0.4, 25.0
# Retardos con que la mision detecta cada momento (los que usaria el EKF para su fase)
DET = {'boost': 0.08, 'coast': 0.2, 'apogeo': 0.5, 'paracaidas': 0.05, 'aterrizaje': 2.0}


def leer_sim(nombre):
    path = os.path.join(AQUI, '..', 'datos', 'simulaciones', 'openrocket', SIM[nombre])
    lines = open(path, encoding='utf-8').read().splitlines()
    head = [h.strip() for h in lines[3].lstrip('# ').split(',')]
    rows = np.array([[float(v) for v in l.split(',')] for l in lines if l and not l.startswith('#')])
    col = lambda pref: rows[:, [i for i, h in enumerate(head) if h.startswith(pref)][0]]
    ev = {}
    for l in lines:
        if l.startswith('# Event '):
            name, t = l.split()[2], float(l.split('t=')[1].split()[0])
            ev.setdefault(name, t)
    return dict(t=col('Tiempo'), alt=col('Altitud (m)'), e=col('Posición al este'), n=col('Posición al norte'), vz=col('Velocidad vertical'),
                elev=col('Orientación vertical'), temp=col('Temperatura del aire')[0], az=col('Orientación lateral'), empuje=col('Empuje'), p_mbar=col('Presión del aire'),
                lat0=col('Latitud')[0], lon0=col('Longitud')[0], h0=col('Altitude above sea level')[0], ev=ev)


def nariz_C(elev, az, alabeo):
    """Matriz cuerpo -> NED: X = nariz con elevacion y rumbo dados; Y horizontal a la derecha con alabeo 0."""
    e, a = np.radians(elev), np.radians(az)
    x = np.array([np.cos(e) * np.cos(a), np.cos(e) * np.sin(a), -np.sin(e)])
    y0 = np.array([-np.sin(a), np.cos(a), 0.0])
    z0 = np.cross(x, y0)
    r = np.radians(alabeo)
    y, z = np.cos(r) * y0 + np.sin(r) * z0, -np.sin(r) * y0 + np.cos(r) * z0
    return np.column_stack([x, y, z])


def verdad(s, args):
    ev = s['ev']
    t_desp, t_burn, t_ej, t_apo, t_suelo = ev['LIFTOFF'], ev['BURNOUT'], ev['EJECTION_CHARGE'], ev['APOGEE'], ev['GROUND_HIT']
    dt = 1.0 / LSM_HZ
    t = np.arange(-PAD_S, t_suelo + POST_S, dt)
    tf = np.clip(t, 0.0, t_suelo)
    # Cinematica coherente: velocidad horizontal de la derivada de la posicion, vertical de la simulacion; luego aceleracion y posicion
    pe, pn = PchipInterpolator(s['t'], s['e']), PchipInterpolator(s['t'], s['n'])
    vel = np.column_stack([pn.derivative()(s['t']), pe.derivative()(s['t']), -s['vz']])
    vs = CubicSpline(s['t'], vel, bc_type='clamped')
    v = vs(tf)
    a = vs.derivative()(tf)
    fuera = (t < 0) | (t > t_suelo)
    v[fuera], a[fuera] = 0.0, 0.0
    # Impacto: la velocidad de descenso se anula en IMPACTO_S antes del suelo (la simulacion la corta de golpe)
    v_fin = vs(t_suelo - IMPACTO_S)
    imp = (t >= t_suelo - IMPACTO_S) & (t <= t_suelo)
    v[imp] = v_fin * (1 - (t[imp] - (t_suelo - IMPACTO_S)) / IMPACTO_S)[:, None]
    a[imp] = -v_fin / IMPACTO_S
    p = np.zeros((len(t), 3))
    p[:, 0], p[:, 1], p[:, 2] = pn(tf), pe(tf), -PchipInterpolator(s['t'], s['alt'])(tf)
    # Actitud: rampa y ascenso de la simulacion (elevacion y rumbo), alabeo SUPUESTO, volteo y descenso bajo paracaidas SUPUESTOS
    elev = np.interp(tf, s['t'], s['elev'])
    az = np.where(np.interp(tf, s['t'], s['elev']) > 89.9, 90.0, np.interp(tf, s['t'], s['az']))
    w_alabeo = np.where(t < t_desp, 0.0, np.where(t < t_burn, args.alabeo * (t - t_desp) / (t_burn - t_desp), args.alabeo * np.exp(-(t - t_burn) / 6.0)))
    alabeo = np.cumsum(w_alabeo) * dt
    Cs = np.array([nariz_C(elev[k], az[k], alabeo[k]) for k in range(len(t))])
    R = Rotation.from_matrix(Cs)
    k_ej = np.searchsorted(t, t_ej)
    td = t - t_ej
    desc_el = DESC_ELEV + DESC_BALANCEO * np.sin(2 * np.pi * DESC_HZ * td)
    desc_az = az[k_ej] + DESC_GIRO_DPS * td
    Cd = np.array([nariz_C(desc_el[k], desc_az[k], alabeo[k_ej]) for k in range(len(t))])
    Rd = Rotation.from_matrix(Cd)
    # suelo: acostado de lado al caer
    Cg = nariz_C(0.0, desc_az[np.searchsorted(t, t_suelo) - 1], 30.0)
    q = R.as_quat()
    for k in range(k_ej, len(t)):
        if t[k] < t_ej + VOLTEO_S:
            f = (t[k] - t_ej) / VOLTEO_S
            q[k] = Rotation.from_quat([R[k_ej].as_quat(), Rd[k].as_quat()]).mean([1 - f, f]).as_quat()
        elif t[k] < t_suelo:
            q[k] = Rd[k].as_quat()
        elif t[k] < t_suelo + 0.5:
            f = (t[k] - t_suelo) / 0.5
            q[k] = Rotation.from_quat([Rd[np.searchsorted(t, t_suelo) - 1].as_quat(), Rotation.from_matrix(Cg).as_quat()]).mean([1 - f, f]).as_quat()
        else:
            q[k] = Rotation.from_matrix(Cg).as_quat()
    R = Rotation.from_quat(q)
    C = R.as_matrix()
    # giro en cuerpo, de la actitud
    w = np.zeros((len(t), 3))
    w[:-1] = (R[:-1].inv() * R[1:]).as_rotvec() / dt
    w[-1] = w[-2]
    w = np.degrees(w)
    # fuerza especifica en cuerpo
    f = np.einsum('kji,kj->ki', C, a - np.array([0, 0, G0])) / G0
    vib = (np.interp(tf, s['t'], s['empuje']) > 2.0) & (t > 0)
    rng = np.random.default_rng(args.semilla)
    f[vib] += rng.normal(0, args.vibracion, (vib.sum(), 3))
    w[vib] += rng.normal(0, 3.0, (vib.sum(), 3))
    ch = (t >= t_ej) & (t < t_ej + EJ_CHOQUE_S)
    f[ch, 0] -= EJ_CHOQUE_G * np.sin(np.pi * (t[ch] - t_ej) / EJ_CHOQUE_S)
    q_wxyz = np.column_stack([q[:, 3], q[:, 0], q[:, 1], q[:, 2]])
    q_wxyz[q_wxyz[:, 0] < 0] *= -1
    t_us = (t + PAD_S) * 1e6 + T_LOCAL0_US
    ev_us = {k: (v + PAD_S) * 1e6 + T_LOCAL0_US for k, v in dict(despegue=t_desp, burnout=t_burn, eyeccion=t_ej, apogeo=t_apo, suelo=t_suelo).items()}
    return dict(t=t, t_us=t_us, p=p, v=v, a=a, f=f, w=w, C=C, q=q_wxyz, p_pa=np.interp(tf, s['t'], s['p_mbar']) * 100.0, ev=ev_us, rng=rng)


def sensores(s, V, args):
    rng = V['rng']
    t_us, t = V['t_us'], V['t']
    sg = np.array([float(x) for x in args.escala.split(',')]) / 100.0
    interp = lambda tq, y: np.column_stack([np.interp(tq, t_us, y[:, i]) for i in range(y.shape[1])])
    d = {}
    # LSM6DSO32: +-32 g, +-2000 dps
    d['lsm_t'] = t_us.copy()
    d['lsm_a'] = np.clip(V['f'] + LSM_BA + rng.normal(0, LSM_ACC_SD, V['f'].shape), -32, 32)
    d['lsm_g'] = np.clip((1 + sg) * V['w'] + LSM_BG + rng.normal(0, LSM_GYR_SD, V['w'].shape), -2000, 2000)
    # QMI8658: +-16 g, +-1024 dps (satura en el empuje)
    tq = np.arange(t_us[0], t_us[-1], 1e6 / QMI_HZ)
    d['qmi_t'] = tq
    d['qmi_a'] = np.clip(interp(tq, V['f']) + rng.normal(0, QMI_ACC_SD, (len(tq), 3)), -16, 16)
    d['qmi_g'] = np.clip((1 + sg) * interp(tq, V['w']) + QMI_BG + rng.normal(0, QMI_GYR_SD, (len(tq), 3)), -1024, 1024)
    # Magnetometros: campo terrestre en NED, al cuerpo
    dip, dec = np.radians(MAG_DIP), np.radians(ekf.DECL_DEG)
    m_ned = MAG_B * np.array([np.cos(dip) * np.cos(dec), np.cos(dip) * np.sin(dec), np.sin(dip)])
    tm = np.arange(t_us[0], t_us[-1], 1e6 / MAG_HZ)
    km = np.searchsorted(t_us, tm)
    mb = np.einsum('kji,j->ki', V['C'][km], m_ned)
    d['mmc'] = np.column_stack([tm, mb + rng.normal(0, MMC_SD, mb.shape)]) if not args.sin_mag else np.zeros((0, 4))
    d['qmc'] = np.column_stack([tm, mb + rng.normal(0, QMC_SD, mb.shape)]) if not args.sin_mag else np.zeros((0, 4))
    x = {}
    # Barometros: presion de la simulacion, ruido y pulso de la carga de eyeccion (SUPUESTO)
    def baro(hz, sd, ofs):
        tb = np.arange(t_us[0], t_us[-1], 1e6 / hz)
        pb = np.interp(tb, t_us, V['p_pa']) + ofs + rng.normal(0, sd, len(tb))
        dt_ej = (tb - V['ev']['eyeccion']) / 1e6
        pb += np.where(dt_ej >= 0, EJ_PULSO_PA * np.exp(-np.maximum(dt_ej, 0) / EJ_PULSO_TAU), 0.0)
        return np.column_stack([tb, pb])
    x['bmp'], x['bme'] = baro(BMP_HZ, BMP_SD, 0.0), baro(BME_HZ, BME_SD, BME_OFS)
    # GNSS a 10 Hz en el segundo UTC, con error de posicion correlacionado y perdida por encima de 4 g (SUPUESTO)
    te = np.arange(np.ceil(t_us[0] / 1e5) * 1e5, t_us[-1] - 2e5, 1e5)
    ke = np.searchsorted(t_us, te)
    g_tot = np.linalg.norm(V['f'], axis=1)
    alto = t_us[g_tot > GNSS_MAX_G]                          # cada instante por encima de 4 g quita la solucion hasta 1.5 s despues
    j = np.searchsorted(alto, te, side='right') - 1
    sin_fix = (j >= 0) & (te - alto[np.maximum(j, 0)] <= GNSS_REACQ_S * 1e6) if len(alto) else np.zeros(len(te), bool)
    ar = np.exp(-0.1 / GNSS_POS_TAU)
    err = np.zeros((len(te), 2))
    for i in range(1, len(te)):
        err[i] = ar * err[i - 1] + np.sqrt(1 - ar * ar) * rng.normal(0, GNSS_POS_SD, 2)
    pos = V['p'][ke]
    kd = np.pi / 180 * 6378137.0
    lat = s['lat0'] + (pos[:, 0] + err[:, 0]) / kd
    lon = s['lon0'] + (pos[:, 1] + err[:, 1]) / (kd * np.cos(np.radians(s['lat0'])))
    h = s['h0'] - pos[:, 2] + rng.normal(0, GNSS_ALT_SD, len(te))
    vel = V['v'][ke] + rng.normal(0, GNSS_VEL_SD, (len(te), 3))
    utc = UTC0 + (te - T_LOCAL0_US) / 1e6
    fix = np.where(sin_fix, 0, 3)
    x['pvt'] = np.column_stack([te + GNSS_LAT_S * 1e6, utc, fix, lat, lon, h, np.full(len(te), 1.2), np.full(len(te), 2.0), vel, np.full(len(te), 0.15)])
    secs = np.arange(np.ceil(utc[0]), utc[-1])
    x['pps'] = np.column_stack([secs, (secs - UTC0) * 1e6 + T_LOCAL0_US])
    x['link'], x['hb'] = np.zeros((0, 3)), np.zeros((0, 2))
    x['sv'] = np.column_stack([te, np.where(sin_fix, 0, 20)])
    # Momentos que detecta la mision, con sus retardos
    ev = V['ev']
    x['momentos'] = [(ev['despegue'] - 10e6, ekf.M_LAUNCH), (ev['despegue'] + DET['boost'] * 1e6, ekf.M_BOOST),
                     (ev['burnout'] + DET['coast'] * 1e6, ekf.M_COAST), (ev['eyeccion'] + DET['paracaidas'] * 1e6, ekf.M_PARACAIDAS),
                     (ev['suelo'] + DET['aterrizaje'] * 1e6, ekf.M_ATERRIZAJE)]
    ident = dict(R=np.eye(3).tolist(), sesgo_g=[0, 0, 0], escala=[1, 1, 1])
    c = dict(lsm=ident, qmi=dict(ident, ganancia_giro=[1, 1, 1], retraso_ms=0.0),
             mmc=dict(centro=[0, 0, 0], A=np.eye(3).tolist(), R=np.eye(3).tolist(), radio_G=MAG_B),
             qmc=dict(centro=[0, 0, 0], A=np.eye(3).tolist(), R=np.eye(3).tolist(), radio_G=MAG_B))
    if args.sin_mag:
        del c['mmc'], c['qmc']
    return d, x, c, sg


def comparar(e, V, sg):
    """Error del EKF contra la verdad, por fase del vuelo real."""
    out = np.array([r[:14] + r[53:56] for r in e.out])
    tk = out[:, 0]
    k = np.clip(np.searchsorted(V['t_us'], tk), 0, len(V['t_us']) - 1)
    qe, qt = out[:, 1:5], V['q'][k]
    dot = np.abs(np.sum(qe * qt, axis=1))
    att = np.degrees(2 * np.arccos(np.clip(dot, -1, 1)))
    # la posicion del EKF va desde su primer fix (con error); se compara la horizontal relativa a ese origen
    pe_ = out[:, 8:11]
    pt = V['p'][k]
    k0 = np.argmax(np.isfinite(pe_[:, 0]))
    hor = np.hypot(*(pe_[:, :2] - (pt[:, :2] - pt[k0, :2])).T)
    ver = np.abs(-pe_[:, 2] - (-pt[:, 2]))
    vel = np.linalg.norm(out[:, 11:14] - V['v'][k], axis=1)
    ev = V['ev']
    fases = [('rampa', tk[0], ev['despegue']), ('empuje', ev['despegue'], ev['burnout']), ('inercia', ev['burnout'], ev['eyeccion']),
             ('eyeccion +2 s', ev['eyeccion'], ev['eyeccion'] + 2e6), ('paracaidas', ev['eyeccion'] + 2e6, ev['suelo']), ('suelo', ev['suelo'], tk[-1])]
    print('\nerror contra la verdad (mediana / maximo):')
    print(f'  {"fase":14s} {"actitud (grados)":>18s} {"horizontal (m)":>16s} {"altura (m)":>14s} {"velocidad (m/s)":>16s}')
    filas = {}
    for nombre, a_, b_ in fases:
        w = (tk >= a_) & (tk < b_)
        if not w.any():
            continue
        m = lambda v: (np.median(v[w]), np.max(v[w]))
        filas[nombre] = dict(att=m(att), hor=m(hor), ver=m(ver), vel=m(vel))
        print(f'  {nombre:14s} {m(att)[0]:8.2f} / {m(att)[1]:7.2f} {m(hor)[0]:7.2f} / {m(hor)[1]:6.2f} {m(ver)[0]:6.2f} / {m(ver)[1]:5.2f} {m(vel)[0]:7.2f} / {m(vel)[1]:6.2f}')
    print(f'factor de escala: real {(100 * sg).round(2).tolist()} %, estimado al final {(out[-1, 14:17]).round(2).tolist()} %')
    return filas


def opciones(args, **extra):
    a = types.SimpleNamespace(sin_gnss=False, sin_mag=args.sin_mag, sin_baro=False, sin_gravedad=False, solo_lsm=False, solo_qmi=False,
                              sin_escala=args.sin_escala, con_bme=False, sin_fases=args.sin_fases, t_suelo=args.t_suelo_usado)
    for k, v in extra.items():
        setattr(a, k, v)
    return a


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cohete', choices=sorted(SIM))
    ap.add_argument('--alabeo', type=float, default=200.0)
    ap.add_argument('--vibracion', type=float, default=1.0)
    ap.add_argument('--escala', default='0.75,0,1.5')
    ap.add_argument('--semilla', type=int, default=1)
    ap.add_argument('--sin-fases', action='store_true')
    ap.add_argument('--sin-escala', action='store_true')
    ap.add_argument('--sin-mag', action='store_true')
    ap.add_argument('--atmosfera-estandar', action='store_true', help='el EKF usa 15 C en vez de la temperatura del sitio')
    ap.add_argument('--comparar', action='store_true', help='corre completo, --sin-fases y --sin-escala con los mismos datos')
    args = ap.parse_args()
    s = leer_sim(args.cohete)
    print(f'{args.cohete}: {SIM[args.cohete]}; eventos {s["ev"]}')
    args.t_suelo_usado = s['temp'] if not args.atmosfera_estandar else None    # en vuelo: la temperatura medida en la rampa
    V = verdad(s, args)
    d, x, c, sg = sensores(s, V, args)
    os.makedirs(os.path.join(AQUI, 'sinteticos'), exist_ok=True)
    corridas = [('completo', {})]
    if args.comparar:
        corridas += [('sin fases', dict(sin_fases=True)), ('sin escala', dict(sin_escala=True))]
    res = {}
    for nombre, extra in corridas:
        print(f'\n===== {nombre} =====')
        salida = os.path.join(AQUI, 'sinteticos', f'SINT_{args.cohete}' + ('' if nombre == 'completo' else '_' + nombre.replace(' ', '_')) + '_ekf.csv')
        e, _ = ekf.run(f'SINT_{args.cohete}', opciones(args, **extra), data=(d, x, c), salida=salida)
        res[nombre] = comparar(e, V, sg)
    if len(res) > 1:
        print('\nresumen, actitud mediana / maxima (grados) por fase:')
        for fase in res['completo']:
            print(f'  {fase:14s} ' + '   '.join(f'{n}: {r[fase]["att"][0]:.2f} / {r[fase]["att"][1]:.2f}' for n, r in res.items() if fase in r))


if __name__ == '__main__':
    sys.exit(main())
