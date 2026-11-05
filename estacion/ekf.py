#!/usr/bin/env python3
"""ekf.py - Proto EKF en PC: navegacion inercial corregida por referencias absolutas (INS+GNSS), sobre un log del cohete.
Uso:  python ekf.py DEM_M00_..._0091.BIN                 resumen, y NOMBRE_ekf.csv a 50 Hz
      python ekf.py NOMBRE.BIN --sin-mag --sin-gnss      apaga fuentes, para comparar
Opciones: --sin-gnss --sin-mag --sin-baro --sin-gravedad --solo-lsm --solo-qmi --calib ARCHIVO.json
Predice con los dos IMU a la vez (IMU virtual) y corrige con GNSS, BMP581, BME280, MMC, QMC y, quieto, la gravedad.
NED, cuerpo FRD, cuaternion Hamilton escalar primero, de cuerpo a NED. Requiere numpy.
"""
import argparse, os, struct, sys
import numpy as np
import calib, tblog

DT = 0.0025                  # 400 Hz
G = 9.80665
DPS = np.pi / 180.0
DECL_DEG = -8.0              # declinacion aproximada en Medellin; a confirmar con un modelo del campo
ACC_SAT_G = 15.0             # el QMI satura en +-16 g
GYR_SAT_DPS = 1000.0         # y en +-1024 dps
ACC_DISAGREE_G = 1.0         # si los IMU difieren mas que esto, se usa solo el LSM
GYR_DISAGREE_DPS = 30.0
STILL_S = 1.5                # ventana quieta para arrancar
W_LSM = 0.8                  # peso fijo en el IMU virtual: el LSM es el principal; el QMI tiene mas sesgo, error de escala y retraso

# Ruido del modelo, por raiz de segundo. Mayores que el ruido en reposo: incluyen pulso de la mano y vibracion.
Q_GYR = 0.05 * DPS
Q_ACC = 0.03
Q_BG = 0.002 * DPS
Q_BA = 0.0005
Q_BARO = 0.001               # la altura la definen los barometros con su p0: su sesgo casi no se mueve

# Ruido de medida
R_BARO_M = {'bmp': 0.5, 'bme': 1.0}
R_MAG_DEG = {'mmc': 4.0, 'qmc': 6.0}
MAG_RATE_HZ = 10.0
MAG_NORM_TOL = 0.05          # el modulo calibrado debe quedar a +-5 % del radio de la calibracion
MAG_DIP_DEG = 32.0           # inclinacion esperada: las calibraciones dieron 29 (Demeter) y 35 (Hermes)
MAG_DIP_TOL_DEG = 8.0
BARO_RATE_HZ = 20.0
GATE = 5.0                   # sigmas para aceptar una medida
GATE_RUN = {'gnss': 20, 'baro': 40, 'mag': 40}    # tras tantos rechazos seguidos se abre la covarianza: mejor recuperar que quedar ciego
GNSS_MAX_HACC_M = 50.0       # peor que esto no es referencia: pasa con la antena tapada o girando
GNSS_MAX_SACC_MPS = 3.0
GYR_SF = 0.02                # error de escala del giro aun sin calibrar: pesa cuando el cohete gira
STILL_G = 0.03               # quieto: |a| a menos de esto de 1 g
STILL_DPS = 5.0              # y girando menos que esto
STILL_N = 200                # durante 0.5 s
R_GRAV_RAD = 0.03

TH, P, V, BG, BA, B_BMP, B_BME, NX = 0, 3, 6, 9, 12, 15, 16, 17
QD = np.array([Q_GYR ** 2] * 3 + [0.0] * 3 + [Q_ACC ** 2] * 3 + [Q_BG ** 2] * 3 + [Q_BA ** 2] * 3 + [Q_BARO ** 2] * 2)


def skew(v):
    return np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])


def q_to_C(q):
    w, x, y, z = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
                     [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
                     [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]])


def C_to_q(C):
    t = np.trace(C)
    if t > 0:
        s = np.sqrt(t + 1) * 2
        return np.array([0.25 * s, (C[2, 1] - C[1, 2]) / s, (C[0, 2] - C[2, 0]) / s, (C[1, 0] - C[0, 1]) / s])
    i = int(np.argmax(np.diag(C)))
    j, k = (i + 1) % 3, (i + 2) % 3
    s = np.sqrt(1 + C[i, i] - C[j, j] - C[k, k]) * 2
    q = np.zeros(4)
    q[0] = (C[k, j] - C[j, k]) / s
    q[i + 1] = 0.25 * s
    q[j + 1] = (C[j, i] + C[i, j]) / s
    q[k + 1] = (C[k, i] + C[i, k]) / s
    return q


def q_mul(a, b):
    return np.array([a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
                     a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
                     a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
                     a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]])


def q_rot(th):
    """Cuaternion de un giro pequeno."""
    n = np.linalg.norm(th)
    if n < 1e-9:
        return np.array([1.0, th[0] / 2, th[1] / 2, th[2] / 2])
    s = np.sin(n / 2) / n
    return np.array([np.cos(n / 2), th[0] * s, th[1] * s, th[2] * s])


def euler_deg(C):
    """Guinada, cabeceo y alabeo. Con el cohete en vertical la guinada pierde sentido: mirar el cuaternion."""
    pitch = np.arcsin(np.clip(-C[2, 0], -1, 1))
    return np.degrees(np.arctan2(C[1, 0], C[0, 0])), np.degrees(pitch), np.degrees(np.arctan2(C[2, 1], C[2, 2]))


def load_extra(path):
    """Lo que calib.load no trae: GNSS, PPS y barometros."""
    recs = tblog.records(open(path, 'rb').read())[0]
    pvt, pps, bme, bmp, link, hb, sv = [], [], [], [], [], [], []
    for r in recs:
        if r[1] == tblog.T_PVT and len(r[4]) == 92:
            d = tblog.decode_pvt(r[4])
            vn, ve, vd = struct.unpack_from('<3i', r[4], 48)
            sacc = struct.unpack_from('<I', r[4], 68)[0]
            vacc = struct.unpack_from('<I', r[4], 44)[0]
            pvt.append((r[3], d['utc_sec'] + d['nano'] * 1e-9, d['fix'], d['lat'], d['lon'], d['h'], d['hacc'], vacc / 1000.0, vn / 1000.0, ve / 1000.0, vd / 1000.0, sacc / 1000.0))
            sv.append((r[3], d['nsv']))
        elif r[1] == tblog.T_LINK and len(r[4]) == 16:              # para el dashboard: el enlace (balizas de tierra recibidas)
            direc, _, _, _, rssi, snr = struct.unpack_from('<BBBBhh', r[4])
            if direc == 1:
                link.append((r[3], rssi / 10.0, snr / 10.0))
        elif r[1] == tblog.T_HB and len(r[4]) >= 32:                   # para el dashboard: lo escrito en la SD
            hb.append((r[3], struct.unpack_from('<I', r[4], 28)[0]))
        elif r[1] == tblog.T_PPS and len(r[4]) >= 18:
            te, sec, used = struct.unpack_from('<qqB', r[4])
            if used:
                pps.append((sec, te))
        elif r[1] == tblog.T_BAR and len(r[4]) == 32:
            bme.append((r[3], struct.unpack_from('<f', r[4], 20)[0]))
        elif r[1] == tblog.T_EXT_LSM and len(r[4]) >= 24:
            n0, cnt, _, _, t_first, period = struct.unpack_from('<IHBBqf', r[4], 0)
            if len(r[4]) != 24 + 7 * cnt:
                continue
            n = n0
            for i in range(cnt):
                w = r[4][24 + 7 * i:24 + 7 * i + 7]
                tag = w[0] >> 3
                if tag == 2:
                    n += 1
                elif tag == 0x0E:
                    pp = w[4] | (w[5] << 8) | (w[6] << 16)
                    tt = w[1] | (w[2] << 8) | (w[3] << 16)
                    pp -= (pp & 0x800000) << 1
                    tt -= (tt & 0x800000) << 1
                    p, c = pp / 64.0, tt / 65536.0
                    if 20000 <= p <= 115000 and -40 <= c <= 85:      # igual que el firmware
                        bmp.append((t_first + (n - n0) * period, p))
    arr = lambda v, w: np.array(v, dtype=float) if v else np.zeros((0, w))
    bmp = arr(bmp, 2)
    if len(bmp) > 2:                                                 # mediana de 3, como el firmware
        bmp[1:-1, 1] = np.median(np.c_[bmp[:-2, 1], bmp[1:-1, 1], bmp[2:, 1]], axis=1)
    return dict(pvt=arr(pvt, 12), pps=arr(pps, 2), bme=arr(bme, 2), bmp=bmp, link=arr(link, 3), hb=arr(hb, 2), sv=arr(sv, 2))


def last_at(series, t, cols):
    """Ultimo valor de series (columna 0 = tiempo) en t, o NaN."""
    if not len(series):
        return [float('nan')] * len(cols)
    i = int(np.searchsorted(series[:, 0], t, side='right')) - 1
    return [float(series[i, c]) for c in cols] if i >= 0 else [float('nan')] * len(cols)


def ned_to_latlon(n, e, d, o):
    lat0 = np.radians(o[0])
    return o[0] + np.degrees(n / 6378137.0), o[1] + np.degrees(e / (6378137.0 * np.cos(lat0))), o[2] - d


def bin_steps(t, x, t0, n):
    """Promedia x por paso de DT. Devuelve la media y cuantas muestras cayeron en cada paso."""
    k = ((t - t0) / (DT * 1e6)).astype(np.int64)
    ok = (k >= 0) & (k < n)
    k = k[ok]
    cnt = np.bincount(k, minlength=n)
    out = np.zeros((n, x.shape[1]))
    for i in range(x.shape[1]):
        out[:, i] = np.bincount(k, weights=x[ok, i], minlength=n)
    out[cnt > 0] /= cnt[cnt > 0, None]
    return out, cnt


def to_body(c, a, g):
    R = np.array(c['R'])
    return ((a - np.array(c['sesgo_g'])) / np.array(c['escala'])) @ R.T, g @ R.T


def mag_body(c, m):
    return (m - np.array(c['centro'])) @ np.array(c['A']).T @ np.array(c['R']).T


def find_still(t, a, g):
    """Primera ventana quieta: de ahi salen actitud inicial y sesgos."""
    win = STILL_S * 1e6
    step = int(0.25 * len(t) / max((t[-1] - t[0]) / 1e6, 1))
    for i in range(0, len(t) - step, step):
        j = np.searchsorted(t, t[i] + win)
        if j >= len(t):
            break
        if a[i:j].std(0).max() < 0.02 and g[i:j].std(0).max() < 3.0:
            return t[i], t[j]
    return None


class Ekf:
    def __init__(self, q, ref):
        self.q, self.p, self.v = q, np.zeros(3), np.zeros(3)
        self.bg, self.ba = np.zeros(3), np.zeros(3)
        self.b = {'bmp': 0.0, 'bme': 0.0}
        self.ref = ref                                       # p0 por barometro
        s = np.r_[[np.radians(2)] * 2, np.radians(10), [5.0] * 3, [0.5] * 3, [0.2 * DPS] * 3, [0.2] * 3, 0.05, 0.05]
        self.Pm = np.diag(s ** 2)
        self.I = np.eye(NX)
        self.stats = {}

    def predict(self, w, f):
        w, f = w - self.bg, f - self.ba
        C = q_to_C(self.q)
        a = C @ f + np.array([0, 0, G])
        self.p = self.p + self.v * DT + 0.5 * a * DT * DT
        self.v = self.v + a * DT
        self.q = q_mul(self.q, q_rot(w * DT))
        self.q /= np.linalg.norm(self.q)

        F = self.I.copy()
        F[TH:TH + 3, TH:TH + 3] -= skew(w) * DT
        F[TH:TH + 3, BG:BG + 3] = -np.eye(3) * DT
        F[P:P + 3, V:V + 3] = np.eye(3) * DT
        F[V:V + 3, TH:TH + 3] = -C @ skew(f) * DT
        F[V:V + 3, BA:BA + 3] = -C * DT
        self.Pm = F @ self.Pm @ F.T
        qd = QD.copy()
        qd[TH:TH + 3] += (GYR_SF * np.linalg.norm(w)) ** 2
        self.Pm[np.diag_indices(NX)] += qd * DT

    def update(self, name, H, y, r, group):
        """Una medida escalar: y = medida - prediccion, H fila sobre el estado de error."""
        s = self.stats.setdefault(name, dict(ok=0, rej=0, run=0, reabre=0, e2=[]))
        PH = self.Pm @ H
        S = H @ PH + r * r
        if y * y > GATE * GATE * S:
            s['rej'] += 1
            s['run'] += 1
            if s['run'] < GATE_RUN[group]:
                return
            i = int(np.argmax(np.abs(H)))                    # la referencia lleva tiempo diciendo otra cosa: se le vuelve a creer
            self.Pm[i, i] += y * y / (H[i] * H[i])
            s['reabre'] += 1
            PH = self.Pm @ H
            S = H @ PH + r * r
        s['ok'] += 1
        s['run'] = 0
        s['e2'].append(y)
        K = PH / S
        dx = K * y
        self.Pm = self.Pm - np.outer(K, PH)
        self.Pm = 0.5 * (self.Pm + self.Pm.T)
        self.q = q_mul(self.q, q_rot(dx[TH:TH + 3]))
        self.q /= np.linalg.norm(self.q)
        self.p = self.p + dx[P:P + 3]
        self.v = self.v + dx[V:V + 3]
        self.bg = self.bg + dx[BG:BG + 3]
        self.ba = self.ba + dx[BA:BA + 3]
        self.b['bmp'] += dx[B_BMP]
        self.b['bme'] += dx[B_BME]

    def scalar(self, name, idx, y, r):
        H = np.zeros(NX)
        H[idx] = 1.0
        self.update(name, H, y, r, 'gnss')

    def baro(self, which, press):
        alt = 44330.0 * (1.0 - (press / self.ref[which]) ** 0.19029)
        idx = B_BMP if which == 'bmp' else B_BME
        H = np.zeros(NX)
        H[P + 2] = -1.0                                      # hacia abajo en el estado, hacia arriba en la medida
        H[idx] = 1.0
        self.update(which, H, alt - (-self.p[2] + self.b[which]), R_BARO_M[which], 'baro')

    def heading(self, which, m, radius):
        """Solo el rumbo: un error magnetico no debe inclinar el cohete. Antes, el campo tiene que parecer el de la Tierra:
        cerca de acero (techo del carro, rampa) cambian el modulo y la inclinacion, y el rumbo sale con decenas de grados de error."""
        C = q_to_C(self.q)
        mn = C @ m
        nm = np.linalg.norm(m)
        dip = np.degrees(np.arcsin(np.clip(mn[2] / nm, -1, 1)))
        if abs(nm / radius - 1) > MAG_NORM_TOL or abs(dip - MAG_DIP_DEG) > MAG_DIP_TOL_DEG:
            self.stats.setdefault(which, dict(ok=0, rej=0, run=0, reabre=0, e2=[]))
            self.stats[which]['no_terrestre'] = self.stats[which].get('no_terrestre', 0) + 1
            return
        if np.hypot(mn[0], mn[1]) < 0.3 * np.linalg.norm(m):  # campo casi vertical: el rumbo no se puede medir
            return
        y = np.radians(DECL_DEG) - np.arctan2(mn[1], mn[0])
        y = (y + np.pi) % (2 * np.pi) - np.pi
        H = np.zeros(NX)
        H[TH:TH + 3] = C[2, :]
        self.update(which, H, y, np.radians(R_MAG_DEG[which]), 'mag')

    def gravity(self, f):
        """Quieto, el acelerometro mide la vertical: referencia absoluta de inclinacion. Nunca corrige la guinada."""
        C = q_to_C(self.q)
        fn = C @ (f / np.linalg.norm(f))
        H = np.zeros(NX)
        H[TH:TH + 3] = -C[1, :]
        self.update('gravedad', H, -fn[0], R_GRAV_RAD, 'mag')
        C = q_to_C(self.q)
        fn = C @ (f / np.linalg.norm(f))
        H = np.zeros(NX)
        H[TH:TH + 3] = C[0, :]
        self.update('gravedad', H, -fn[1], R_GRAV_RAD, 'mag')


def latlon_to_ned(lat, lon, h, o):
    k = np.pi / 180.0
    Rn = 6378137.0 + o[2]
    return np.array([(lat - o[0]) * k * Rn, (lon - o[1]) * k * Rn * np.cos(o[0] * k), o[2] - h])


def run(path, a):
    d = calib.load(path)
    x = load_extra(path)
    base = os.path.basename(path)
    cal_path = a.calib
    if not cal_path:
        role = 'demeter' if base.startswith('DEM') else 'hermes'
        here = os.path.dirname(os.path.abspath(__file__))
        cal_path = next((p for p in (os.path.join(here, f'calib_{role}.json'), os.path.join(here, f'calib_{role}_nuevo.json')) if os.path.exists(p)), None)
    if not cal_path:
        raise SystemExit('sin calibracion: usa la guia del dashboard o --calib')
    import json
    c = json.load(open(cal_path, encoding='utf-8'))
    print(f'log {base}, calibracion {os.path.basename(cal_path)}')

    la, lg = to_body(c['lsm'], d['lsm_a'], d['lsm_g'])
    qa, qg = to_body(c['qmi'], d['qmi_a'], d['qmi_g'])
    if 'ganancia_giro' not in c['qmi']:
        raise SystemExit('calibracion sin retraso ni ganancia del giro del QMI: vuelve a analizar la captura con la guia')
    qg = qg / np.array(c['qmi']['ganancia_giro'])       # el LSM es la referencia
    d['qmi_t'] = d['qmi_t'] - c['qmi']['retraso_ms'] * 1e3

    still = find_still(d['lsm_t'], la, lg)
    if not still:
        raise SystemExit('no encontre una ventana quieta para arrancar')
    t0 = still[1]
    n = int((d['lsm_t'][-1] - t0) / (DT * 1e6))
    print(f'arranque quieto en t={still[0] / 1e6:.2f} s; {n * DT:.1f} s de navegacion')

    # Sesgos del giro de cada IMU: se miden al arrancar, como al armar
    win = (d['lsm_t'] >= still[0]) & (d['lsm_t'] <= still[1])
    winq = (d['qmi_t'] >= still[0]) & (d['qmi_t'] <= still[1])
    bl = lg[win].mean(0)
    bq = qg[winq].mean(0) if winq.any() else qg.mean(0)
    lg, qg = lg - bl, qg - bq
    print(f'sesgo del giro al arrancar (dps): LSM {bl.round(3).tolist()}  QMI {bq.round(3).tolist()}')

    la_s, lc = bin_steps(d['lsm_t'], la, t0, n)
    lg_s, _ = bin_steps(d['lsm_t'], lg, t0, n)
    qa_s, qc = bin_steps(d['qmi_t'], qa, t0, n)
    qg_s, _ = bin_steps(d['qmi_t'], qg, t0, n)

    both = (lc > 0) & (qc > 0)
    dg = np.linalg.norm(lg_s[both] - qg_s[both], axis=1)
    da = np.linalg.norm(la_s[both] - qa_s[both], axis=1)
    print(f'LSM contra QMI en cuerpo: giro mediana {np.median(dg):.2f} dps, p99 {np.percentile(dg, 99):.1f}; acel mediana {1000 * np.median(da):.0f} mg, p99 {1000 * np.percentile(da, 99):.0f}')

    # Medidas ordenadas por tiempo. GNSS en su instante de medicion, con el reloj que dan los PPS
    ev = []
    pvt = x['pvt']
    if len(pvt) and not a.sin_gnss:
        if len(x['pps']) > 5:
            fit = np.polyfit(x['pps'][:, 0] - x['pps'][0, 0], x['pps'][:, 1], 1)
            tm = np.polyval(fit, pvt[:, 1] - x['pps'][0, 0])
        else:
            tm = pvt[:, 0] - 60000.0
        ev += [(t, 'gnss', i) for i, t in enumerate(tm) if pvt[i, 2] >= 3 and t > t0]
    if not a.sin_baro:
        for name, s, rate in (('bmp', x['bmp'], 100.0), ('bme', x['bme'], 40.0)):
            step = max(int(round(rate / BARO_RATE_HZ)), 1)
            for i in range(step, len(s), step):
                if s[i, 0] > t0:
                    ev.append((s[i, 0], name, float(s[i - step + 1:i + 1, 1].mean())))
    if not a.sin_mag:
        for name in ('mmc', 'qmc'):
            m = d[name]
            if name in c and len(m):
                mb = mag_body(c[name], m[:, 1:])
                step = max(int(round(100.0 / MAG_RATE_HZ)), 1)
                for i in range(0, len(m), step):
                    if m[i, 0] > t0:
                        ev.append((m[i, 0], name, mb[i]))
    ev.sort(key=lambda e: e[0])

    # Actitud inicial con gravedad y campo
    f0 = la[win].mean(0)
    down = -f0 / np.linalg.norm(f0)
    mname = 'mmc' if 'mmc' in c and len(d['mmc']) else 'qmc'
    mw = (d[mname][:, 0] >= still[0]) & (d[mname][:, 0] <= still[1])
    m0 = mag_body(c[mname], d[mname][mw, 1:]).mean(0) if mw.any() else None
    if m0 is None:
        raise SystemExit('sin magnetometro en la ventana quieta')
    north = m0 - (m0 @ down) * down
    north /= np.linalg.norm(north)
    east = np.cross(down, north)
    dc = np.radians(DECL_DEG)
    Cm = np.array([north, east, down])
    Rz = np.array([[np.cos(dc), -np.sin(dc), 0], [np.sin(dc), np.cos(dc), 0], [0, 0, 1]])
    q0 = C_to_q(Rz @ Cm)
    dip = np.degrees(np.arcsin((m0 @ down) / np.linalg.norm(m0)))
    print(f'inclinacion magnetica al arrancar: {dip:.1f} grados')

    ref = {}
    for name, s in (('bmp', x['bmp']), ('bme', x['bme'])):
        w = (s[:, 0] >= still[0]) & (s[:, 0] <= still[1])
        ref[name] = float(s[w, 1].mean()) if w.any() else (float(s[0, 1]) if len(s) else 101325.0)
    e = Ekf(q0, ref)

    origin = None
    gnss_res = []
    gnss_bad = 0
    still_n, f_lp, last_grav = 0, None, -1
    out = []
    poses = calib.find_poses(d['lsm_t'], d['lsm_a'])
    pose_checks = []
    pose_i = 0
    k_ev = 0
    every = int(round(1 / (50 * DT)))
    for k in range(n):
        tk = t0 + (k + 1) * DT * 1e6
        while k_ev < len(ev) and ev[k_ev][0] <= tk:
            _, kind, v = ev[k_ev]
            k_ev += 1
            if kind == 'gnss':
                r = pvt[v]
                if r[6] > GNSS_MAX_HACC_M or r[11] > GNSS_MAX_SACC_MPS:
                    gnss_bad += 1
                    continue
                if origin is None:
                    if r[6] > 20:
                        continue
                    origin = (r[3], r[4], r[5])
                ned = latlon_to_ned(r[3], r[4], r[5], origin)
                inn = []
                for i, (idx, val, sd) in enumerate(((P, ned[0], r[6]), (P + 1, ned[1], r[6]), (P + 2, 0.0, None), (V, r[8], r[11]), (V + 1, r[9], r[11]), (V + 2, r[10], r[11]))):
                    if sd is None:
                        continue                     # la altura del GNSS no se usa: la dan los barometros, como el altimetro oficial
                    pred = e.p[i] if idx < V else e.v[i - 3]
                    inn.append(val - pred)
                    e.scalar(('gnss_p' if idx < V else 'gnss_v') + 'NED'[i % 3], idx, val - pred, max(sd, 0.3 if idx < V else 0.05))
                gnss_res.append(inn)
            elif kind in ('bmp', 'bme'):
                e.baro(kind, v)
            else:
                e.heading(kind, v, c[kind]['radio_G'])
        # IMU virtual: los dos cuando se puede; solo el LSM si el QMI satura o si no coinciden
        use_l, use_q = lc[k] > 0 and not a.solo_qmi, qc[k] > 0 and not a.solo_lsm
        if use_l and use_q:
            bad = np.abs(qa_s[k]).max() > ACC_SAT_G or np.abs(qg_s[k]).max() > GYR_SAT_DPS or np.linalg.norm(la_s[k] - qa_s[k]) > ACC_DISAGREE_G or np.linalg.norm(lg_s[k] - qg_s[k]) > GYR_DISAGREE_DPS
            if bad:
                use_q = False
        if use_l and use_q:
            fk, wk = W_LSM * la_s[k] + (1 - W_LSM) * qa_s[k], W_LSM * lg_s[k] + (1 - W_LSM) * qg_s[k]
        elif use_l:
            fk, wk = la_s[k], lg_s[k]
        elif use_q:
            fk, wk = qa_s[k], qg_s[k]
        else:
            continue                                         # sin IMU en este paso (muy raro con 1610 Hz): se sigue en el siguiente
        e.predict(wk * DPS, fk * G)
        f_lp = fk if f_lp is None else f_lp + 0.05 * (fk - f_lp)
        still_n = still_n + 1 if abs(np.linalg.norm(fk) - 1.0) < STILL_G * 3 and abs(np.linalg.norm(f_lp) - 1.0) < STILL_G and np.linalg.norm(wk - e.bg / DPS) < STILL_DPS else 0
        if not a.sin_gravedad and still_n >= STILL_N and k - last_grav >= 40:
            last_grav = k
            e.gravity(f_lp)
        if k % every == 0:
            C = q_to_C(e.q)
            yaw, pitch, roll = euler_deg(C)
            sd = np.sqrt(np.diag(e.Pm))
            ll = ned_to_latlon(e.p[0], e.p[1], e.p[2], origin) if origin else (float('nan'),) * 3
            cnt = lambda pref: [sum(s[k2] for nm, s in e.stats.items() if nm.startswith(pref)) for k2 in ('ok', 'rej')]
            gfix, ghacc = last_at(pvt, tk, (2, 6))
            out.append((tk, *e.q, yaw, pitch, roll, *e.p, *e.v, *(e.bg / DPS), *(e.ba / G), e.b['bmp'], e.b['bme'], -e.p[2] + e.b['bmp'], *sd[TH:TH + 3] * 180 / np.pi,
                        *(fk - e.ba / G), *(wk - e.bg / DPS), *ll, *sd[P:P + 3], *sd[V:V + 3],
                        *cnt('gnss'), *[a_ + b_ for a_, b_ in zip(cnt('bmp'), cnt('bme'))], *[a_ + b_ for a_, b_ in zip(cnt('mmc'), cnt('qmc'))],
                        gfix, last_at(x['sv'], tk, (1,))[0], ghacc, *last_at(x['link'], tk, (1, 2)), last_at(x['hb'], tk, (1,))[0] / 1e6))
        while pose_i < len(poses) and tk > poses[pose_i]['t1']:     # al llegar: antes de que la gravedad corrija
            p = poses[pose_i]
            pose_i += 1
            if tk > t0 + 2e6:
                mean = calib.window_mean(d['lsm_t'], la, p)
                if mean is not None:
                    C = q_to_C(e.q)
                    up_b = C.T @ np.array([0, 0, -1.0])
                    tilt = np.degrees(np.arccos(np.clip(up_b @ mean / np.linalg.norm(mean), -1, 1)))
                    pose_checks.append((calib.POSES[pose_i - 1] if pose_i <= len(calib.POSES) else str(pose_i), tilt, *euler_deg(C)))

    print(f'\nresultado final: posicion NED {e.p.round(2).tolist()} m  velocidad {e.v.round(3).tolist()} m/s')
    print(f'sesgo residual del giro {(e.bg / DPS).round(3).tolist()} dps, del acel {(1000 * e.ba / G).round(1).tolist()} mg; barometros BMP {e.b["bmp"]:.2f} m, BME {e.b["bme"]:.2f} m')
    print(f'incertidumbre de actitud 1 sigma: {np.round(np.degrees(np.sqrt(np.diag(e.Pm)[TH:TH + 3])), 2).tolist()} grados')
    print(f'epocas GNSS descartadas por mala precision: {gnss_bad} de {len(pvt)}')
    print('medidas (aceptadas, rechazadas, reaperturas, rms de la innovacion):')
    for name, s in sorted(e.stats.items()):
        rms = float(np.sqrt(np.mean(np.square(s['e2'])))) if s['e2'] else 0.0
        unit = 'grados' if name in ('mmc', 'qmc', 'gravedad') else ('m/s' if name.startswith('gnss_v') else 'm')
        extra = f'   campo no terrestre: {s["no_terrestre"]}' if s.get('no_terrestre') else ''
        print(f'  {name:9s} {s["ok"]:6d} {s["rej"]:6d} {s["reabre"]:5d}   {np.degrees(rms) if unit == "grados" else rms:.3f} {unit}{extra}')
    if pose_checks:
        print('inclinacion del EKF contra la gravedad medida, al llegar a cada posicion quieta:')
        for name, tilt, yaw, pitch, roll in pose_checks:
            print(f'  {name:18s} error {tilt:5.2f} grados   guinada {yaw:7.1f}  cabeceo {pitch:6.1f}  alabeo {roll:7.1f}')

    salida = os.path.splitext(path)[0] + '_ekf.csv'
    with open(salida, 'w') as f:
        # Las primeras 26 columnas no cambian; las demas son para el dashboard de control (radares G, mapa, enlace, SD, estadisticas)
        f.write('t_us,qw,qx,qy,qz,guinada_deg,cabeceo_deg,alabeo_deg,pn_m,pe_m,pd_m,vn_mps,ve_mps,vd_mps,bgx_dps,bgy_dps,bgz_dps,bax_g,bay_g,baz_g,b_bmp_m,b_bme_m,alt_baro_m,sig_x_deg,sig_y_deg,sig_z_deg,'
                'fx_g,fy_g,fz_g,wx_dps,wy_dps,wz_dps,lat_deg,lon_deg,alt_msl_m,sig_pn_m,sig_pe_m,sig_pd_m,sig_vn_mps,sig_ve_mps,sig_vd_mps,'
                'gnss_ok,gnss_rej,baro_ok,baro_rej,mag_ok,mag_rej,gnss_fix,gnss_nsv,gnss_hacc_m,rssi_dbm,snr_db,sd_mb\n')
        for r in out:
            f.write(','.join(f'{v:.6g}' if i else f'{v:.0f}' for i, v in enumerate(r)) + '\n')
    print(f'escribi {salida}')
    return e, pose_checks


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('file')
    ap.add_argument('--calib')
    for o in ('sin-gnss', 'sin-mag', 'sin-baro', 'sin-gravedad', 'solo-lsm', 'solo-qmi'):
        ap.add_argument('--' + o, action='store_true')
    a = ap.parse_args()
    run(a.file, a)


if __name__ == '__main__':
    main()
