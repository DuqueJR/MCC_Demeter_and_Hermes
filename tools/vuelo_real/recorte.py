"""Recorte de los originales: los registros del .BIN dentro de la ventana, byte a byte, y las lineas de la sesion de tierra.

Solo se corre en la maquina que tiene los originales (local u OneDrive). El resultado va al repo y desde ahi todo es reproducible.
"""
import hashlib
import json
import os
import statistics
import sys

from . import vuelos as V

sys.path.insert(0, os.path.join(V.RAIZ, 'estacion'))
import tblog  # noqa: E402


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def utc_de_reloj(recs):
    """Desfase UTC - reloj local (s) con los PVT del propio archivo: la mediana, igual que el analisis forense."""
    d = [tblog.decode_pvt(r[4]) for r in recs if r[1] == tblog.T_PVT and len(r[4]) == 92]
    t = [r[3] for r in recs if r[1] == tblog.T_PVT and len(r[4]) == 92]
    return statistics.median(x['utc_sec'] + x['nano'] * 1e-9 - ti / 1e6 for x, ti in zip(d, t) if x['fix'] >= 2)


def recortar_bin(mision, carpeta_originales):
    v = V.VUELOS[mision]
    ruta = os.path.join(carpeta_originales, v['original'])
    if os.path.getsize(ruta) != v['bytes'] or sha256(ruta) != v['sha256']:
        raise SystemExit(f'{ruta}: no es el original registrado (tamano o SHA-256 distintos)')
    buf = open(ruta, 'rb').read()
    recs, saltados, _, _ = tblog.records(buf)
    if saltados:
        raise SystemExit(f'{ruta}: {saltados} bytes saltados; el recorte copia registros enteros y no deberia haberlos')
    n_hdr = sum(1 for r in recs if r[1] == tblog.T_FILEHDR)
    salida = bytearray()
    t_ini = v['t_launch_us'] - int(V.VENTANA_ANTES_S * 1e6)
    for pos, typ, _, t_us, payload in recs:
        if typ == tblog.T_FILEHDR or t_ini <= t_us <= v['t_fin_us']:
            ln = buf[pos + 2] | (buf[pos + 3] << 8)
            salida += buf[pos:pos + ln]
    os.makedirs(V.DATOS, exist_ok=True)
    with open(V.ruta_recorte(mision), 'wb') as f:
        f.write(salida)
    return dict(t_ini_us=t_ini, t_launch_us=v['t_launch_us'], t_fin_us=v['t_fin_us'], utc_menos_reloj_s=utc_de_reloj(recs), registros_filehdr=n_hdr,
                bytes=len(salida), sha256=hashlib.sha256(salida).hexdigest())


def recortar_sesion(mision, carpeta_sesiones, info_bin):
    s = V.SESION_TIERRA
    ruta = os.path.join(carpeta_sesiones, s['original'])
    if os.path.getsize(ruta) != s['bytes'] or sha256(ruta) != s['sha256']:
        raise SystemExit(f'{ruta}: no es la sesion registrada (tamano o SHA-256 distintos)')
    ofs = info_bin['utc_menos_reloj_s']
    u0 = info_bin['t_ini_us'] / 1e6 + ofs
    u1 = info_bin['t_fin_us'] / 1e6 + ofs
    lineas = []
    with open(ruta, 'rb') as f:
        for crudo in f:
            linea = crudo.decode('utf-8', 'replace').rstrip('\r\n')
            p = linea.split(' ', 1)
            try:
                ts = float(p[0])
            except ValueError:
                continue
            if u0 <= ts <= u1:
                lineas.append(linea)
    texto = '\n'.join(lineas) + '\n'
    with open(V.ruta_sesion(mision), 'w', encoding='utf-8', newline='\n') as f:
        f.write(texto)
    return dict(utc_ini_s=round(u0, 3), utc_fin_s=round(u1, 3), lineas=len(lineas), sha256=hashlib.sha256(texto.encode('utf-8')).hexdigest())


def recortar(carpeta_originales, carpeta_sesiones):
    manifiesto = {'fecha': '2026-11-08', 'vuelos': {}}
    for mision, v in V.VUELOS.items():
        ib = recortar_bin(mision, carpeta_originales)
        isn = recortar_sesion(mision, carpeta_sesiones, ib)
        manifiesto['vuelos'][mision] = dict(
            original=dict(archivo=v['original'], bytes=v['bytes'], sha256=v['sha256']),
            recorte=dict(archivo=v['recorte'], **ib),
            sesion_tierra=dict(original=V.SESION_TIERRA['original'], sha256_original=V.SESION_TIERRA['sha256'],
                               archivo=os.path.basename(V.ruta_sesion(mision)), **isn))
        print(f"{mision}: {ib['bytes'] / 1e6:.1f} MB de {v['bytes'] / 1e6:.1f} MB; sesion {isn['lineas']} lineas")
    with open(os.path.join(V.DATOS, 'manifiesto.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(manifiesto, f, indent=2, ensure_ascii=False)
        f.write('\n')
