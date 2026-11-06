#!/usr/bin/env python3
"""comparar_ekf.py - El EKF a bordo (ekf_core.cpp, compilado en build/prueba_ekf) contra estacion/ekf.py, sobre el mismo log y la
misma calibracion (D-060).
Uso: python comparar_ekf.py LOG.BIN CALIB.json [--double] [--t-suelo C]
Compara en los instantes del C++ (interpolando ekf.py): actitud (angulo entre cuaterniones), posicion, velocidad, altura barometrica,
sesgos del giro y factor de escala. Las diferencias de arranque (el C++ busca el reposo en vivo, ekf.py en todo el log) se ven al
principio y deben converger."""
import argparse, json, os, subprocess, sys, types
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
ESTACION = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..', 'estacion'))
sys.path.insert(0, ESTACION)


def cal_txt(c, path):
    v = []
    for k in ('lsm', 'qmi'):
        v += list(np.ravel(c[k]['R'])) + list(c[k]['sesgo_g']) + list(c[k]['escala'])
    v += list(c['qmi'].get('ganancia_giro', [1, 1, 1])) + [c['qmi'].get('retraso_ms', 0.0)]
    for k in ('mmc', 'qmc'):
        m = c.get(k)
        if m and 'R' in m:
            v += [1] + list(m['centro']) + list(np.ravel(m['A'])) + list(np.ravel(m['R'])) + [m['radio_G']]
        else:
            v += [0] + [0] * 3 + [0] * 9 + [0] * 9 + [1]
    with open(path, 'w') as f:
        f.write(' '.join(repr(float(x)) for x in v))


def ang_q(a, b):
    d = np.abs(np.sum(a * b, axis=1))
    return np.degrees(2 * np.arccos(np.clip(d, -1, 1)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('log')
    ap.add_argument('calib')
    ap.add_argument('--double', action='store_true')
    ap.add_argument('--t-suelo', type=float, default=None)
    a = ap.parse_args()
    build = os.path.join(AQUI, 'build')
    base = os.path.splitext(os.path.basename(a.log))[0]
    c = json.load(open(a.calib, encoding='utf-8'))
    ctxt = os.path.join(build, 'cal_ekf.txt')
    cal_txt(c, ctxt)
    csv_c = os.path.join(build, base + '_ekf_c.csv')
    exe = os.path.join(build, 'prueba_ekf_d' if a.double else 'prueba_ekf')
    args = [exe, a.log, ctxt, csv_c] + ([str(a.t_suelo)] if a.t_suelo is not None else [])
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout, r.stderr)
        sys.exit(1)
    info = json.loads(r.stdout)

    import ekf
    csv_p = os.path.join(build, base + '_ekf_py.csv')
    opt = types.SimpleNamespace(calib=a.calib, sin_gnss=False, sin_mag=False, sin_baro=False, sin_gravedad=False, solo_lsm=False, solo_qmi=False,
                                sin_escala=False, con_bme=False, sin_fases=False, t_suelo=a.t_suelo)
    import contextlib, io
    txt = io.StringIO()
    with contextlib.redirect_stdout(txt):
        e, _ = ekf.run(a.log, opt, salida=csv_p)
    P = np.genfromtxt(csv_p, delimiter=',', names=True)
    C = np.genfromtxt(csv_c, delimiter=',', names=True)
    t = C['t_us']
    ok = (t >= P['t_us'][0]) & (t <= P['t_us'][-1])
    t = t[ok]
    C = C[ok]
    ip = lambda k: np.interp(t, P['t_us'], P[k])
    qp = np.c_[ip('qw'), ip('qx'), ip('qy'), ip('qz')]
    qp /= np.linalg.norm(qp, axis=1, keepdims=True)
    qc = np.c_[C['qw'], C['qx'], C['qy'], C['qz']]
    dq = ang_q(qp, qc)
    rel = (t - t[0]) / 1e6
    print(f'=== {base}  ({"double" if a.double else "float"}), {rel[-1]:.0f} s comparados; C++: {info["pasos"]} pasos, '
          f'presente hasta {info["presente_max_ms"]:.0f} ms adelante, h_escala {info["h_escala"]:.0f} m')
    print('  python: ' + ' | '.join(l.strip() for l in txt.getvalue().splitlines() if l.startswith(('arranque', 'temperatura del suelo'))))
    filas = [('actitud (grados)', dq)]
    for k, n in (('pn_m', 'posicion N (m)'), ('pe_m', 'posicion E (m)'), ('pd_m', 'posicion D (m)'), ('vn_mps', 'velocidad N (m/s)'), ('ve_mps', 'velocidad E (m/s)'),
                 ('vd_mps', 'velocidad D (m/s)'), ('alt_baro_m', 'altura barometrica (m)'), ('bgx_dps', 'sesgo giro x (dps)'), ('bgy_dps', 'sesgo giro y (dps)'),
                 ('bgz_dps', 'sesgo giro z (dps)'), ('sgx_pct', 'escala giro x (%)'), ('sgz_pct', 'escala giro z (%)')):
        filas.append((n, np.abs(C[k] - ip(k))))
    print(f'  {"magnitud":28s} {"mediana":>9s} {"p95":>9s} {"max":>9s} {"final":>9s}   (tras 60 s: p95)')
    late = rel > 60
    for n, v in filas:
        print(f'  {n:28s} {np.median(v):9.3f} {np.percentile(v, 95):9.3f} {v.max():9.3f} {v[-1]:9.3f}   {np.percentile(v[late], 95) if late.any() else float("nan"):9.3f}')
    print('  medidas C++ (ok, rechazos, reaperturas, campo no terrestre): ' + ', '.join(f'{k} {v[0]}/{v[1]}/{v[2]}/{v[3]}' for k, v in info['stats'].items() if v[0] or v[1] or v[3]))
    print('  medidas python (ok, rechazos): ' + ', '.join(f'{k} {s["ok"]}/{s["rej"]}' for k, s in sorted(e.stats.items())))


if __name__ == '__main__':
    main()
