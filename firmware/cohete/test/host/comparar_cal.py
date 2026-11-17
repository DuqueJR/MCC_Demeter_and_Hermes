#!/usr/bin/env python3
"""comparar_cal.py - La calibracion a bordo (cal_core.cpp, compilada en build/prueba_cal) contra estacion/calib.py, sobre los mismos logs.
Uso: python comparar_cal.py LOG.BIN [LOG2.BIN ...]       (desde firmware/cohete/test/host, con build/prueba_cal ya compilado)
Las dos usan la misma calibracion anterior para nombrar las posiciones (la que calib.py tomaria de estacion/)."""
import contextlib, io, json, os, subprocess, sys
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
ESTACION = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..', 'estacion'))
sys.path.insert(0, ESTACION)
import calib  # noqa: E402

EXE = os.path.join(AQUI, 'build', 'prueba_cal.exe' if os.name == 'nt' else 'prueba_cal')


def prev_de(base):
    role = {'DEM': 'demeter', 'HER': 'hermes'}.get(base[:3])
    for f in ([f'calib_{role}.json', f'calib_{role}_nuevo.json'] if role else []):
        try:
            c = json.load(open(os.path.join(ESTACION, f), encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if c.get('ok') and c.get('lsm'):
            return c['lsm']
    return None


def ang_rot(A, B):
    """Angulo entre dos matrices de rotacion (grados)."""
    M = np.asarray(A) @ np.asarray(B).T
    return float(np.degrees(np.arccos(np.clip((np.trace(M) - 1) / 2, -1, 1))))


def comparar(path):
    base = os.path.basename(path)
    prev = prev_de(base)
    args = [EXE, path]
    if prev:
        ptxt = os.path.join(AQUI, 'build', 'prev.txt')
        with open(ptxt, 'w') as f:
            f.write(' '.join(str(v) for v in list(np.ravel(prev['R'])) + list(prev['sesgo_g']) + list(prev['escala'])))
        args.append(ptxt)
    c = json.loads(subprocess.run(args, capture_output=True, text=True, check=True).stdout)
    with contextlib.redirect_stdout(io.StringIO()):
        p = calib.run(path)
    filas = []
    def fila(nombre, a, b, tol, unidad=''):
        if a is None or b is None:
            filas.append((nombre, a, b, None, 'falta en uno'))
            return
        d = abs(a - b)
        filas.append((nombre, a, b, d, 'OK' if d <= tol else 'DIFIERE'))
    for k in ('lsm', 'qmi'):
        if k in p and k in c:
            filas.append((f'{k} R (angulo entre las dos)', None, None, ang_rot(p[k]['R'], c[k]['R']), 'OK' if ang_rot(p[k]['R'], c[k]['R']) < 0.5 else 'DIFIERE'))
            for i in range(3):
                fila(f'{k} sesgo[{i}] (mg)', 1000 * p[k]['sesgo_g'][i], 1000 * c[k]['sesgo_g'][i], 3.0)
                fila(f'{k} escala[{i}] (ppm)', 1e6 * p[k]['escala'][i], 1e6 * c[k]['escala'][i], 3000.0)
            fila(f'{k} error de posicion (grados)', p[k]['error_pos_grados'], c[k]['error_pos_grados'], 0.5)
        else:
            filas.append((k, k in p, k in c, None, 'falta en uno'))
    if 'qmi' in p and 'qmi' in c and 'retraso_ms' in p['qmi']:
        fila('qmi retraso (ms)', p['qmi']['retraso_ms'], c['qmi'].get('retraso_ms'), 4.0)
        for i in range(3):
            fila(f'qmi ganancia giro[{i}]', p['qmi']['ganancia_giro'][i], (c['qmi'].get('ganancia_giro') or [None] * 3)[i], 0.01)
    for k in ('mmc', 'qmc'):
        if k in p and k in c:
            fila(f'{k} centro (mG, distancia)', 0.0, 1000 * float(np.linalg.norm(np.subtract(p[k]['centro'], c[k]['centro']))), 5.0)
            fila(f'{k} radio (mG)', 1000 * p[k]['radio_G'], 1000 * c[k]['radio_G'], 5.0)
            fila(f'{k} max/min', p[k]['max_min'], c[k]['max_min'], 0.03)
            fila(f'{k} residuo (mG)', p[k]['residuo_mG'], c[k]['residuo_mG'], 1.0)
            fila(f'{k} cobertura', p[k]['cobertura'], c[k]['cobertura'], 0.05)
            fila(f'{k} descartadas', p[k].get('descartadas', 0), c[k].get('descartadas', 0), max(50, 0.05 * p[k].get('muestras', 0)))
            if 'R' in p[k] and 'R' in c[k]:
                filas.append((f'{k} R a cuerpo (angulo)', None, None, ang_rot(p[k]['R'], c[k]['R']), 'OK' if ang_rot(p[k]['R'], c[k]['R']) < 2.0 else 'DIFIERE'))
        else:
            filas.append((k, k in p, k in c, None, 'falta en uno'))
    print(f'\n=== {base}  (prev: {"calibracion de estacion/" if prev else "montaje nominal"})')
    print(f'  calib.py: ok={p["ok"]} avisos={len(p["avisos"])}  |  a bordo: ok={c["ok"]} avisos=0x{c["avisos"]:08X} posiciones={c["n_pos"]} nombradas={c["nombradas"]}')
    for a in p['avisos']:
        print(f'    calib.py aviso: {a}')
    print(f'  {"magnitud":36s} {"calib.py":>12s} {"a bordo":>12s} {"diferencia":>11s}')
    malas = 0
    for n, a, b, d, est in filas:
        fa = '' if a is None or isinstance(a, bool) else f'{a:12.4f}'
        fb = '' if b is None or isinstance(b, bool) else f'{b:12.4f}'
        fd = '' if d is None else f'{d:11.4f}'
        print(f'  {n:36s} {fa:>12s} {fb:>12s} {fd:>11s}  {est}')
        malas += est != 'OK'
    return malas


def ida_y_vuelta(path):
    """El blob: el que arma el cohete lo lee cal_blob.py, y el que arma cal_blob.py (desde calib.py) lo lee el firmware (prueba_cal_blob)."""
    import cal_blob
    base = os.path.basename(path)
    rocket = 2 if base.startswith('HER') else 1
    bfw = os.path.join(AQUI, 'build', 'blob_fw.bin')
    env = dict(os.environ, PRUEBA_CAL_BLOB=bfw)
    c = json.loads(subprocess.run([EXE, path], capture_output=True, text=True, check=True, env=env).stdout)
    d = cal_blob.leer(open(bfw, 'rb').read())
    malas = 0
    for k in ('lsm', 'qmi', 'mmc', 'qmc'):
        if k not in c:
            continue
        for campo in ('R', 'sesgo_g', 'escala', 'centro', 'A', 'radio_G'):
            if campo in c[k] and (k in ('mmc', 'qmc') or campo not in ('centro', 'A', 'radio_G')):
                if not np.allclose(np.ravel(c[k][campo]), np.ravel(d[k][campo]), atol=1e-6, rtol=1e-6):
                    print(f'  ida y vuelta: {k}.{campo} del cohete no coincide al leerlo en Python'); malas += 1
    with contextlib.redirect_stdout(io.StringIO()):
        p = calib.run(path)
    bpy = os.path.join(AQUI, 'build', 'blob_py.bin')
    open(bpy, 'wb').write(cal_blob.armar(p, rocket, utc=0))
    exe2 = os.path.join(AQUI, 'build', 'prueba_cal_blob.exe' if os.name == 'nt' else 'prueba_cal_blob')
    f = json.loads(subprocess.run([exe2, bpy, str(rocket)], capture_output=True, text=True).stdout)
    if f.get('revisar'):
        print(f'  ida y vuelta: el firmware rechaza el blob de calib.py: {f["revisar"]}'); malas += 1
    for k in ('lsm', 'qmi', 'mmc', 'qmc'):
        if k in p and 'R' in p[k] and not np.allclose(np.ravel(p[k]['R']), np.ravel(f[k]['R']), atol=1e-6):
            print(f'  ida y vuelta: {k}.R de calib.py no coincide al leerlo en el firmware'); malas += 1
    print(f'  ida y vuelta del blob {base}: ' + ('OK' if not malas else f'{malas} diferencias') + f' (firmware ok={f.get("ok")}, CRC {f.get("crc", 0):08X})')
    return malas


if __name__ == '__main__':
    sys.path.insert(0, ESTACION)
    total = sum(comparar(p) + ida_y_vuelta(p) for p in sys.argv[1:])
    print(f'\n{total} magnitudes fuera de tolerancia')
    sys.exit(1 if total else 0)
