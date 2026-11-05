#!/usr/bin/env python3
"""calib.py - Calibracion de un cohete a partir de un log hecho con la guia del dashboard.
Uso:  python calib.py LOG.BIN --salida calib_demeter_nuevo.json
El log debe tener, en este orden, el cohete quieto en 6 posiciones y despues girando en todas las direcciones:
  nariz arriba, nariz abajo, marca arriba, marca abajo, costado derecho arriba, costado izquierdo arriba.
Cuerpo FRD: X hacia la nariz, Z hacia el lado contrario a la marca, Y a la derecha mirando de la cola a la nariz con la marca arriba.
Salida: acel_cal = (crudo_g - sesgo) / escala por eje; v_cuerpo = R * v_chip.
        mag_cal = A * (crudo_G - centro), en G, en ejes del chip del magnetometro; R_mag lleva sus ejes a cuerpo.
"""
import argparse, bisect, json, os, struct, sys
import numpy as np
from scipy.optimize import least_squares
import tblog

POSES = ['nariz arriba', 'nariz abajo', 'marca arriba', 'marca abajo', 'derecha arriba', 'izquierda arriba']
STILL_WIN_S = 0.5
STILL_SD_G = 0.03          # incluye el pulso de la mano
STILL_MIN_S = 4.0
NEW_POSE_DEG = 30.0
ANGLE_WARN_DEG = 12.0      # sostenido a mano: mas que esto ya no es la posicion pedida
TX_MARGIN_US = 15000
BIN_KEEP = 300             # muestras por direccion en el ajuste magnetico: las poses quietas no deben pesar mas que el giro
COVER_MIN = 0.8
RES_WARN_MG = 15.0
DIP_MIN_DEG = 10.0         # con menos inclinacion, el signo del campo no se puede decidir
DIP_RANGE_WARN_DEG = 25.0
DIP_POSE_DEG = 12.0         # una posicion asi de lejos de la mediana estaba perturbada
MAG_AGREE_WARN_DEG = 15.0
MAG_OUTLIER = 0.25          # fuera de +-25 % del radio, la muestra tenia algo magnetico cerca
POSE_BODY = np.array([[1, 0, 0], [-1, 0, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, -1, 0]], float)   # lo que mide el acelerometro en cada posicion, en cuerpo
POSE_MATCH_DEG = 45.0
# Montaje del LSM en ambos cohetes, medido el 2 y 3 nov (X del cuerpo = +Y del chip). Solo sirve para nombrar las posiciones.
LSM_NOMINAL = dict(R=[[0, 1, 0], [0, 0, -1], [-1, 0, 0]], sesgo_g=[0, 0, 0], escala=[1, 1, 1])
POSE_FIELD_TOL = 0.05       # una posicion quieta con el campo mas de 5 % fuera del radio estaba sobre algo magnetico


def load(path):
    recs = tblog.records(open(path, 'rb').read())[0]
    lsm_t, lsm_a, lsm_g, qmi_t, qmi_a, qmi_g = [], [], [], [], [], []
    lsm_lsb = gyr_lsb = qmi_lsb = qmi_gsb = None
    for r in recs:
        if r[1] == tblog.T_EXT_LSM and len(r[4]) >= 24:
            n0, cnt, fl, accfs, t_first, period, rd, gfs = struct.unpack_from('<IHBBqfHH', r[4], 0)
            if len(r[4]) != 24 + 7 * cnt:
                continue
            lsm_lsb, gyr_lsb = 1000.0 / 0.976, 1000.0 / 70.0     # tabla de sensibilidades de la hoja de datos, no 32768/FS
            d = r[4][24:]
            n = n0
            pend = None
            for i in range(cnt):
                tag = d[7 * i] >> 3
                if tag == 2:
                    lsm_t.append(t_first + (n - n0) * period)
                    lsm_a.append(struct.unpack_from('<3h', d, 7 * i + 1))
                    lsm_g.append(pend if pend else (0, 0, 0))
                    n += 1
                elif tag == 1:
                    pend = struct.unpack_from('<3h', d, 7 * i + 1)
        elif r[1] == tblog.T_IMU and len(r[4]) >= 40:
            n0, cnt, fl, accfs, t_isr, t_first, period, dev, rd, gfs = struct.unpack_from('<IHBBqqdIHH', r[4], 0)
            if len(r[4]) != 40 + 12 * cnt:
                continue
            qmi_lsb, qmi_gsb = 32768.0 / accfs, 32768.0 / gfs
            raw = np.frombuffer(r[4], dtype='<i2', count=6 * cnt, offset=40).reshape(-1, 6)
            qmi_t.extend(t_first + i * period for i in range(cnt))
            qmi_a.extend(raw[:, :3].tolist())
            qmi_g.extend(raw[:, 3:].tolist())

    tx = sorted((r[3] - struct.unpack_from('<I', r[4], 12)[0] - TX_MARGIN_US, r[3] + TX_MARGIN_US) for r in recs if r[1] == tblog.T_LINK and len(r[4]) == 16 and r[4][0] == 0)
    starts = [a for a, _ in tx]

    def no_tx(t):
        i = bisect.bisect_right(starts, t) - 1
        return not (i >= 0 and t <= tx[i][1])

    mmc = [(r[3],) + tuple(v / 16384.0 for v in struct.unpack('<3iBB', r[4])[:3]) for r in recs if r[1] == tblog.T_EXT_MMC and len(r[4]) == 14 and not r[4][12] & 7 and no_tx(r[3])]
    qmc = []
    for r in recs:
        if r[1] == tblog.T_MAG and len(r[4]) == 8 and not r[4][6] & 1 and no_tx(r[3]):
            x, y, z, _, fs = struct.unpack('<3hBB', r[4])
            lsb = 32000.0 / fs
            qmc.append((r[3], x / lsb, y / lsb, z / lsb))
    arr = lambda v: np.array(v, dtype=float)
    return dict(lsm_t=arr(lsm_t), lsm_a=arr(lsm_a) / (lsm_lsb or 1), lsm_g=arr(lsm_g) / (gyr_lsb or 1), qmi_t=arr(qmi_t), qmi_a=arr(qmi_a) / (qmi_lsb or 1), qmi_g=arr(qmi_g) / (qmi_gsb or 1), mmc=arr(mmc), qmc=arr(qmc))


def find_poses(t, a):
    """Tramos quietos; devuelve las primeras direcciones distintas, en orden de aparicion, cada una con su tramo mas largo."""
    if len(t) < 100:
        return []
    t0 = t[0]
    win = ((t - t0) / (STILL_WIN_S * 1e6)).astype(int)
    edges = np.flatnonzero(np.diff(win)) + 1
    segs, cur = [], None
    for chunk_t, chunk_a in zip(np.split(t, edges), np.split(a, edges)):
        still = len(chunk_t) > 10 and chunk_a.std(0).max() < STILL_SD_G
        if still:
            if cur is None:
                cur = [chunk_t[0], chunk_t[-1]]
            cur[1] = chunk_t[-1]
        elif cur is not None:
            segs.append(cur)
            cur = None
    if cur is not None:
        segs.append(cur)

    poses = []
    for t1, t2 in segs:
        if (t2 - t1) / 1e6 < STILL_MIN_S:
            continue
        m = (t > t1 + 5e5) & (t < t2 - 5e5)
        if not m.any():
            continue
        mean = a[m].mean(0)
        u = mean / np.linalg.norm(mean)
        for p in poses:
            if np.degrees(np.arccos(np.clip(u @ p['u'], -1, 1))) < NEW_POSE_DEG:
                if t2 - t1 > p['t2'] - p['t1']:
                    p.update(t1=t1, t2=t2)
                break
        else:
            poses.append(dict(t1=t1, t2=t2, u=u))
    return poses[:len(POSES)]


def window_mean(t, a, p):
    m = (t > p['t1'] + 5e5) & (t < p['t2'] - 5e5)
    return a[m].mean(0) if m.any() else None


def fit_accel(means):
    """Sesgo y escala por eje para que |a| = 1 g en todas las posiciones."""
    m = np.array(means)
    res = least_squares(lambda x: np.linalg.norm((m - x[:3]) / x[3:], axis=1) - 1.0, np.r_[np.zeros(3), np.ones(3)])
    return res.x[:3], res.x[3:]


def body_rotation(cal):
    """cal: lecturas calibradas por pose. Devuelve R (cuerpo desde chip) y el peor error de las posiciones, en grados."""
    u = [c / np.linalg.norm(c) for c in cal]
    x = u[0] - u[1]
    z = u[3] - u[2]
    y_meas = u[4] - u[5]
    x /= np.linalg.norm(x)
    z -= (z @ x) * x
    z /= np.linalg.norm(z)
    y = np.cross(z, x)
    R = np.vstack([x, y, z])
    expected = np.array([[1, 0, 0], [-1, 0, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, -1, 0]], dtype=float)
    err = max(np.degrees(np.arccos(np.clip((R @ v) @ e, -1, 1))) for v, e in zip(u, expected))
    return R, float(err), float(y_meas @ y) > 0


def fit_ellipsoid(m):
    """Devuelve centro, A (lleva el elipsoide a la esfera de radio medio) y residuo en G."""
    mu = m.mean(0)
    s = m - mu
    x, y, z = s.T
    D = np.c_[x * x, y * y, z * z, 2 * x * y, 2 * x * z, 2 * y * z, 2 * x, 2 * y, 2 * z]
    v = np.linalg.lstsq(D, np.ones(len(s)), rcond=None)[0]
    Q = np.array([[v[0], v[3], v[4]], [v[3], v[1], v[5]], [v[4], v[5], v[2]]])
    c = -np.linalg.solve(Q, v[6:])
    w, V = np.linalg.eigh(Q / (1 + c @ Q @ c))
    if (w <= 0).any():
        raise ValueError('el ajuste no es un elipsoide: falta cobertura de direcciones')
    radii = 1 / np.sqrt(w)
    r = radii.mean()
    A = V @ np.diag(r / radii) @ V.T
    res = np.linalg.norm((s - c) @ A, axis=1) - r
    return c + mu, A, r, res, radii.max() / radii.min()


def direction_bins(u):
    """Celda de cada direccion: 26 direcciones de un cubo."""
    return tuple(map(tuple, np.round(u / np.abs(u).max(axis=1, keepdims=True) * 1.2).astype(int)))


def fit_mag(m):
    """Ajuste con descarte de lo perturbado (el cohete apoyado sobre algo magnetico). Primero se apartan las muestras
    muy lejos de la mediana, que arrastrarian el ajuste; despues, lo que quede lejos del elipsoide, y se repite."""
    keep = np.ones(len(m), bool)
    if len(m) >= 300:
        d = np.linalg.norm(m - np.median(m, axis=0), axis=1)
        keep = d < 2.5 * np.median(d)
    cal, avis = fit_mag_once(m[keep])
    for _ in range(4):
        if cal is None:
            break
        r = np.linalg.norm((m - np.array(cal['centro'])) @ np.array(cal['A']).T, axis=1) / cal['radio_G']
        ok = np.abs(r - 1) < MAG_OUTLIER
        if (ok == keep).all() or ok.sum() < 300:
            break
        keep = ok
        cal, avis = fit_mag_once(m[keep])
    if cal is not None and not keep.all():
        cal['descartadas'] = int((~keep).sum())
        print(f'  descarte {cal["descartadas"]} de {len(m)} muestras con el campo fuera de lo normal: algo magnetico cerca en ese momento')
        if cal['descartadas'] > 0.2 * len(m):
            avis.append(f'{cal["descartadas"]} muestras con campo anomalo: algo magnetico cerca durante la captura')
    return cal, avis, keep


def fit_mag_once(m):
    if len(m) < 300:
        return None, ['pocas muestras']
    c0 = m.mean(0)
    A = np.c_[2 * m, np.ones(len(m))]
    x = np.linalg.lstsq(A, (m ** 2).sum(1), rcond=None)[0]
    u = m - x[:3]
    u = u / np.linalg.norm(u, axis=1, keepdims=True)
    bins = direction_bins(u)
    seen, keep = {}, []
    for i, b in enumerate(bins):
        seen[b] = seen.get(b, 0) + 1
        if seen[b] <= BIN_KEEP:
            keep.append(i)
    cover = len(seen) / 26.0
    avis = []
    if cover < COVER_MIN:
        avis.append(f'cobertura {100 * cover:.0f} %: faltan direcciones, gira mas')
    try:
        c, Am, r, res, ratio = fit_ellipsoid(m[keep])
    except (ValueError, np.linalg.LinAlgError) as e:
        return None, [str(e)]
    rms = 1000 * float(res.std())
    if rms > RES_WARN_MG:
        avis.append(f'residuo {rms:.1f} mG alto')
    return dict(centro=c.tolist(), A=Am.tolist(), radio_G=float(r), max_min=float(ratio), residuo_mG=rms, cobertura=cover, muestras=len(keep)), avis


AXIS_ROTS = []
for perm in ((0, 1, 2), (0, 2, 1), (1, 0, 2), (1, 2, 0), (2, 0, 1), (2, 1, 0)):
    for sx in (1, -1):
        for sy in (1, -1):
            for sz in (1, -1):
                M = np.zeros((3, 3))
                M[0, perm[0]], M[1, perm[1]], M[2, perm[2]] = sx, sy, sz
                if np.linalg.det(M) > 0:
                    AXIS_ROTS.append(M)


def rotvec_to_matrix(v):
    a = np.linalg.norm(v)
    if a < 1e-9:
        return np.eye(3)
    k = v / a
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + np.sin(a) * K + (1 - np.cos(a)) * K @ K


def mag_alignment(mag, cal, t, gyr):
    """Rotacion de ejes del magnetometro a ejes del IMU, con el giro: dm/dt = -w x m, sin saber el campo terrestre."""
    tm = mag[:, 0]
    m = (mag[:, 1:] - np.array(cal['centro'])) @ np.array(cal['A']).T
    dt = 0.1e6
    tq = np.arange(tm[0], tm[-1], dt)
    mi = np.c_[[np.interp(tq, tm, m[:, i]) for i in range(3)]].T
    w = np.radians(np.c_[[np.interp(tq, t, gyr[:, i]) for i in range(3)]].T)
    dm = np.gradient(mi, dt / 1e6, axis=0)
    fast = np.linalg.norm(w, axis=1) > np.radians(40)
    if fast.sum() < 100:
        return None, 'poco giro para alinear el magnetometro'
    mi, w, dm = mi[fast], w[fast], dm[fast]

    def resid(x, R0):
        R = rotvec_to_matrix(x) @ R0            # magnetometro desde IMU
        return (dm + np.cross(w @ R.T, mi)).ravel()

    best = None
    for R0 in AXIS_ROTS:
        cost = float((resid(np.zeros(3), R0) ** 2).sum())
        if best is None or cost < best[0]:
            best = (cost, R0)
    sol = least_squares(resid, np.zeros(3), args=(best[1],))
    R = rotvec_to_matrix(sol.x) @ best[1]
    return R.T, f'giro residual {np.degrees(np.linalg.norm(sol.x)):.1f} grados sobre el eje de chip mas cercano'    # IMU desde magnetometro


def qmi_gyro_vs_lsm(lsm, qmi):
    """Retraso en ms y ganancia por eje del giro del QMI respecto al LSM, en cuerpo. El LSM es la referencia."""
    t_l, g_l, t_q, g_q = lsm[0], lsm[1], qmi[0], qmi[1]
    tg = np.arange(max(t_l[0], t_q[0]) + 2e5, min(t_l[-1], t_q[-1]) - 2e5, 5000.0)
    L = np.c_[[np.interp(tg, t_l, g_l[:, i]) for i in range(3)]].T
    best = None
    for lag in range(-80, 82, 2):
        Q = np.c_[[np.interp(tg + lag * 1e3, t_q, g_q[:, i]) for i in range(3)]].T
        e = float(np.mean((L - Q) ** 2))
        if best is None or e < best[0]:
            best = (e, lag, Q)
    _, lag, Q = best
    return lag, [float(L[:, i] @ Q[:, i] / (L[:, i] @ L[:, i])) for i in range(3)], [float(np.corrcoef(L[:, i], Q[:, i])[0, 1]) for i in range(3)]


def mag_at_poses(m, cal, poses):
    """Campo corregido, sin alinear, en cada posicion quieta."""
    out = []
    for k, p in enumerate(poses):
        w = (m[:, 0] > p['t1'] + 5e5) & (m[:, 0] < p['t2'] - 5e5)
        v = (m[w, 1:] - np.asarray(cal['centro'])) @ np.asarray(cal['A']).T if w.any() else None
        if v is None:
            print(f'  posicion {POSES[k]}: sin muestras limpias del magnetometro (campo anomalo en todo el tramo); no cuenta para la inclinacion')
        if v is not None and abs(np.median(np.linalg.norm(v, axis=1)) / cal['radio_G'] - 1) >= POSE_FIELD_TOL:
            print(f'  posicion {POSES[poses.index(p)]}: campo anomalo, algo magnetico debajo o cerca; no cuenta para la inclinacion')
            v = None
        out.append(None if v is None else v.mean(0))
    return out


def match_orientation(poses, t, a, ref):
    """Las posiciones como POSES segun lo que el montaje `ref` (R, sesgo_g, escala) dice que mide cada una; None si no cuadran."""
    R = np.array(ref['R'])
    got = [R @ ((window_mean(t, a, p) - np.array(ref['sesgo_g'])) / np.array(ref['escala'])) for p in poses]
    out = []
    for e in POSE_BODY:
        ang = [np.degrees(np.arccos(np.clip(g @ e / np.linalg.norm(g), -1, 1))) for g in got]
        i = int(np.argmin(ang))
        if ang[i] > POSE_MATCH_DEG or poses[i] in out:
            return None
        out.append(poses[i])
    return out


def label_geometry(poses):
    """Ultimo recurso, sin saber como esta montado el chip: nombra las posiciones solo por geometria.
    Nariz arriba es la primera direccion quieta; nariz abajo, la mas opuesta a ella; marca arriba, la primera de las que
    quedan en orden de aparicion; marca abajo, la mas opuesta a esa. Las dos que quedan se ordenan con la regla de la mano
    derecha del cuerpo FRD: Y = Z x X, y 'derecha arriba' es la que apunta hacia +Y. Mide las direcciones sin calibrar:
    basta para nombrar. No puede saber cual de dos direcciones opuestas es 'arriba': depende de que la primera sea nariz
    arriba y de que marca arriba aparezca antes que marca abajo."""
    u = [p['u'] for p in poses]
    resto = list(range(len(poses)))

    def opuesta(i):
        j = min(resto, key=lambda k: u[i] @ u[k])
        resto.remove(j)
        return j

    n0 = resto.pop(0)
    n1 = opuesta(n0)
    m0 = resto.pop(0)
    m1 = opuesta(m0)
    z = u[m1] - (u[m1] @ u[n0]) * u[n0]
    y = np.cross(z, u[n0])
    d, i = resto
    if u[d] @ y < 0:
        d, i = i, d
    return [poses[k] for k in (n0, n1, m0, m1, d, i)]


def label_poses(poses, t, a, prev):
    """Ordena las posiciones halladas como POSES. Por orientacion, con la calibracion anterior y, si no cuadra, con el montaje
    nominal; si tampoco cuadra (un cohete montado distinto), por geometria."""
    if len(poses) != len(POSES):
        return poses, 'por orden de aparicion'
    refs = [(prev, 'calibracion anterior')] if prev is not None and prev is not LSM_NOMINAL else []
    refs.append((LSM_NOMINAL, 'montaje nominal'))
    for ref, nombre in refs:
        out = match_orientation(poses, t, a, ref)
        if out is not None:
            return out, f'por orientacion ({nombre})'
    out = label_geometry(poses)
    note = '' if all(x is y for x, y in zip(out, poses)) else '; el orden fue distinto al de la guia'
    return out, f'por geometria: no cuadran con ' + ' ni con '.join(n for _, n in refs) + note


def dips(b_imu, ups):
    """Inclinacion en grados, positiva hacia abajo. El acelerometro quieto marca hacia arriba."""
    return np.array([np.degrees(np.arcsin(-(b @ u) / np.linalg.norm(b) / np.linalg.norm(u))) for b, u in zip(b_imu, ups) if b is not None])


def curva_temperatura(path):
    """Curva de calentamiento del BMP581 (detras de la placa, por el hub del LSM) y del BME280 (en la placa) durante la calibracion (D-058).
    La guia empieza en frio: encender, forzar FLY y registrar 30 min con el cohete cerrado (y en Demeter, la Pi encendida a los 5 min).
    Ajusta T(t) = Tinf - (Tinf - T0) exp(-t / tau) a cada sensor; con eso se fijan los umbrales de la muestra en frio y del armado."""
    recs = tblog.records(open(path, 'rb').read())[0]
    bme = np.array([(r[3], struct.unpack_from('<f', r[4], 24)[0]) for r in recs if r[1] == tblog.T_BAR and len(r[4]) == 32], dtype=float).reshape(-1, 2)
    bmp = []
    for r in recs:                                          # BMP581 por el hub del LSM: palabras con etiqueta 0x0E (como ekf.load_extra)
        if r[1] != tblog.T_EXT_LSM or len(r[4]) < 24:
            continue
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
                if 20000 <= pp / 64.0 <= 115000 and -40 <= tt / 65536.0 <= 85:
                    bmp.append((t_first + (n - n0) * period, tt / 65536.0))
    bmp = np.array(bmp, dtype=float).reshape(-1, 2)
    if len(bmp) > 2:                                        # mediana de 3, como el firmware: quita las palabras corruptas
        bmp[1:-1, 1] = np.median(np.c_[bmp[:-2, 1], bmp[1:-1, 1], bmp[2:, 1]], axis=1)
    out = {}
    for name, s in (('bmp', bmp), ('bme', bme)):
        if len(s) < 100:
            continue
        t = (s[:, 0] - s[0, 0]) / 60e6                      # minutos desde el inicio del registro
        v = s[:, 1]
        best = None
        for tau in np.geomspace(0.5, 120, 60):              # tau en minutos: busqueda en rejilla, lineal en T0 y Tinf
            e = np.exp(-t / tau)
            A = np.c_[1 - e, e]
            coef, res, *_ = np.linalg.lstsq(A, v, rcond=None)
            r = float(np.sum((A @ coef - v) ** 2))
            if best is None or r < best[0]:
                best = (r, tau, coef)
        _, tau, (tinf, t0) = best
        dur = float(t[-1])
        sube = lambda m: round(float(tinf - (tinf - t0) * np.exp(-m / tau) - t0), 2) if m <= dur + 0.05 else None   # solo dentro de lo registrado
        out[name] = dict(t0_C=round(float(t0), 2), tinf_C=round(float(tinf), 2), tau_min=round(float(tau), 1), duracion_min=round(dur, 1),
                         sube_5min_C=sube(5), sube_10min_C=sube(10), sube_30min_C=sube(30),
                         pendiente_inicial_Cmin=round(float((tinf - t0) / tau), 3), final_C=round(float(v[t >= dur - 1].mean()), 2),
                         tau_fiable=bool(tau < dur))
    if 'bmp' in out and 'bme' in out:
        out['bme_menos_bmp_inicio_C'] = round(out['bme']['t0_C'] - out['bmp']['t0_C'], 2)
        out['bme_menos_bmp_final_C'] = round(out['bme']['final_C'] - out['bmp']['final_C'], 2)    # medido, el ultimo minuto
    return out


def run(path):
    d = load(path)
    out = dict(archivo=path.replace('\\', '/').split('/')[-1], avisos=[])
    print(f'archivo {out["archivo"]}: LSM {len(d["lsm_t"])} muestras, QMI {len(d["qmi_t"])}, MMC {len(d["mmc"])}, QMC {len(d["qmc"])}')

    poses = find_poses(d['lsm_t'], d['lsm_a']) if len(d['lsm_t']) else []
    if not poses and len(d['qmi_t']):
        poses = find_poses(d['qmi_t'], d['qmi_a'])
        out['avisos'].append('sin LSM: posiciones halladas con el QMI')
    # Para nombrar las posiciones: la calibracion vigente si es buena; si no, el montaje nominal, igual en ambos cohetes
    prev = LSM_NOMINAL
    role = {'DEM': 'demeter', 'HER': 'hermes'}.get(out['archivo'][:3])
    here = os.path.dirname(os.path.abspath(__file__))
    for f in ([f'calib_{role}.json', f'calib_{role}_nuevo.json'] if role else []):
        try:
            c = json.load(open(os.path.join(here, f), encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if c.get('ok') and c.get('lsm'):
            prev = c['lsm']
            break
    if len(d['lsm_t']):
        poses, how = label_poses(poses, d['lsm_t'], d['lsm_a'], prev)
    else:
        how = 'por orden de aparicion'
    print(f'posiciones quietas distintas: {len(poses)} de {len(POSES)}, nombradas {how}')
    for p, n in zip(poses, POSES):
        print(f'  {n:18s} {(p["t2"] - p["t1"]) / 1e6:5.1f} s')
    if len(poses) < len(POSES):
        out['avisos'].append(f'solo {len(poses)} posiciones: acelerometros sin calibrar')

    R_lsm = None
    ups = None
    body_mag = {}
    if len(poses) == len(POSES):
        for name, t, a in (('lsm', d['lsm_t'], d['lsm_a']), ('qmi', d['qmi_t'], d['qmi_a'])):
            if not len(t):
                out['avisos'].append(f'{name}: sin datos')
                continue
            means = [window_mean(t, a, p) for p in poses]
            if any(x is None for x in means):
                out['avisos'].append(f'{name}: sin datos en alguna posicion')
                continue
            b, s = fit_accel(means)
            cal = [(x - b) / s for x in means]
            R, err, sign_ok = body_rotation(cal)
            raw = [float(np.linalg.norm(x)) for x in means]
            print(f'{name.upper()}: |a| crudo {min(raw):.4f}..{max(raw):.4f} g  sesgo {b.round(4).tolist()} g  escala {s.round(4).tolist()}  peor error de posicion {err:.1f} grados')
            print(f'  X,Y,Z del cuerpo en ejes del chip: {R[0].round(3).tolist()} {R[1].round(3).tolist()} {R[2].round(3).tolist()}')
            if not sign_ok or err > ANGLE_WARN_DEG:
                out['avisos'].append(f'{name}: las posiciones no cuadran ({err:.1f} grados): orden equivocado o cohete mal sostenido; repite')
            out[name] = dict(sesgo_g=b.tolist(), escala=s.tolist(), R=R.tolist(), error_pos_grados=err)
            if name == 'lsm':
                R_lsm = R
                ups = cal

    if 'lsm' in out and 'qmi' in out and len(d['qmi_g']):
        body = lambda g, k: g @ np.array(out[k]['R']).T
        lag, gain, corr = qmi_gyro_vs_lsm((d['lsm_t'], body(d['lsm_g'], 'lsm')), (d['qmi_t'], body(d['qmi_g'], 'qmi')))
        print(f'giro del QMI respecto al LSM: retraso {lag} ms, ganancia en cuerpo {np.round(gain, 3).tolist()}, correlacion {np.round(corr, 4).tolist()}')
        out['qmi'].update(retraso_ms=lag, ganancia_giro=gain)
        if min(corr) < 0.95:
            out['avisos'].append(f'giro del QMI y del LSM poco parecidos (correlacion {min(corr):.3f}): falto mover el cohete o hay un eje mal')

    # Sesgo del giro de esta corrida, solo para alinear: se mide de nuevo al armar
    gyr = d['lsm_g']
    if len(gyr) and poses:
        m = (d['lsm_t'] > poses[0]['t1'] + 5e5) & (d['lsm_t'] < poses[0]['t2'] - 5e5)
        gyr = gyr - gyr[m].mean(0)

    for name, m in (('mmc', d['mmc']), ('qmc', d['qmc'])):
        if not len(m):
            out['avisos'].append(f'{name}: sin datos')
            continue
        cal, avis, keep = fit_mag(m[:, 1:])
        m = m[keep]                                  # lo perturbado tampoco sirve para alinear con el giro
        out['avisos'] += [f'{name}: {a}' for a in avis]
        if cal is None:
            continue
        print(f'{name.upper()}: centro {np.round(cal["centro"], 4).tolist()} G  radio {cal["radio_G"]:.4f} G  max/min {cal["max_min"]:.3f}  residuo {cal["residuo_mG"]:.2f} mG  cobertura {100 * cal["cobertura"]:.0f} %')
        if len(gyr):
            Rm, msg = mag_alignment(m, cal, d['lsm_t'], gyr)
            if Rm is None:
                out['avisos'].append(f'{name}: {msg}')
            else:
                # El giro no distingue B de -B: el signo sale de la inclinacion. Vale donde el campo apunta hacia abajo, como en Colombia.
                if ups is None:
                    out['avisos'].append(f'{name}: sin posiciones quietas no se puede comprobar el signo del campo')
                else:
                    v = [None if x is None else Rm @ x for x in mag_at_poses(m, cal, poses)]
                    dp = np.array([np.nan if x is None else dips([x], [u])[0] for x, u in zip(v, ups)])
                    if np.nanmedian(dp) < 0:
                        Rm, dp, v = -Rm, -dp, [None if x is None else -x for x in v]
                        msg += '; salida invertida respecto a una rotacion pura: determinante -1'
                    # Una posicion con la inclinacion muy distinta de las demas estaba perturbada: no cuenta
                    off = np.abs(dp - np.nanmedian(dp)) > DIP_POSE_DEG
                    for i in np.flatnonzero(off):
                        print(f'  posicion {POSES[i]}: inclinacion {dp[i]:.1f} grados, lejos de las demas; no cuenta')
                        v[i] = None
                    dp = dp[~np.isnan(dp) & ~off]
                    body_mag[name] = v
                    if not len(dp):
                        out['avisos'].append(f'{name}: ninguna posicion con campo limpio: repite las posiciones lejos de metal y aparatos')
                        print('  inclinacion en las posiciones: ninguna posicion limpia')
                    else:
                        print(f'  inclinacion en las posiciones: media {dp.mean():.1f} grados, rango {np.ptp(dp):.1f}, con {len(dp)} posiciones')
                    if 0 < len(dp) < 3:
                        out['avisos'].append(f'{name}: solo {len(dp)} posiciones con campo limpio: repite las posiciones lejos de metal y aparatos')
                    if len(dp) and dp.mean() < DIP_MIN_DEG:
                        out['avisos'].append(f'{name}: inclinacion de {dp.mean():.1f} grados: signo del campo dudoso')
                    if len(dp) and np.ptp(dp) > DIP_RANGE_WARN_DEG:
                        out['avisos'].append(f'{name}: la inclinacion cambia {np.ptp(dp):.1f} grados entre posiciones: metal cerca o mala calibracion; repite')
                print(f'  ejes respecto al LSM: {Rm.round(3).tolist()}  ({msg})')
                cal['R_imu_desde_mag'] = Rm.tolist()
                if R_lsm is not None:
                    cal['R'] = (R_lsm @ Rm).tolist()
        out[name] = cal

    if len(body_mag) == 2:
        par = [np.degrees(np.arccos(np.clip(a @ b / np.linalg.norm(a) / np.linalg.norm(b), -1, 1))) for a, b in zip(body_mag['mmc'], body_mag['qmc']) if a is not None and b is not None]
        if par:
            print(f'MMC contra QMC en las posiciones: {min(par):.1f} a {max(par):.1f} grados')
        else:
            out['avisos'].append('MMC y QMC: ninguna posicion limpia en los dos para compararlos')
        if par and max(par) > MAG_AGREE_WARN_DEG:
            out['avisos'].append(f'MMC y QMC difieren hasta {max(par):.1f} grados: revisar ejes o signo')

    try:
        out['temperatura'] = curva_temperatura(path) if os.path.isfile(path) else {}
        tc = out['temperatura']
        if tc:
            print()
            print('curva de calentamiento (D-058; la calibracion debe empezar en frio):')
            for name in ('bmp', 'bme'):
                if name in tc:
                    c = tc[name]
                    print(f"  {name.upper()}: inicio {c['t0_C']} C, final {c['final_C']} C, sube {c['sube_5min_C']} / {c['sube_10min_C']} / {c['sube_30min_C']} C "
                          f"a 5 / 10 / 30 min, tau {c['tau_min']} min{'' if c['tau_fiable'] else ' (mas largo que el registro: no fiable)'}, "
                          f"pendiente inicial {c['pendiente_inicial_Cmin']} C/min ({c['duracion_min']} min registrados)")
            if 'bme_menos_bmp_inicio_C' in tc:
                print(f"  BME - BMP: {tc['bme_menos_bmp_inicio_C']} C al inicio, {tc['bme_menos_bmp_final_C']} C al final")
    except Exception as e:                                   # la curva es informativa: no tumba la calibracion ni cuenta como aviso
        out['temperatura'] = dict(error=f'{type(e).__name__}: {e}')
    out['ok'] = not out['avisos'] and all(k in out for k in ('lsm', 'qmi', 'mmc', 'qmc'))
    print('\nAVISOS:' if out['avisos'] else '\nsin avisos')
    for a in out['avisos']:
        print('  - ' + a)
    print('CALIBRACION ' + ('COMPLETA' if out['ok'] else 'INCOMPLETA'))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('log')
    ap.add_argument('--salida')
    a = ap.parse_args()
    out = run(a.log)
    if a.salida:
        with open(a.salida, 'w', encoding='utf-8') as f:
            json.dump(out, f, indent=1, ensure_ascii=False)
        print(f'escribi {a.salida}')


if __name__ == '__main__':
    main()
