#!/usr/bin/env python3
"""cal_blob.py - La calibracion en el formato binario del cohete (firmware/cohete/src/cal_blob.h, D-059) y su carga por USB.
Respaldo de la calibracion a bordo: con el cohete abierto, calib.py en el PC y este script la guarda en la NVS del cohete.
Uso:  python cal_blob.py calib_demeter.json --puerto COM4          arma el blob y lo carga (el cohete en TIERRA, sin registrar)
      python cal_blob.py calib_demeter.json --salida cal.bin       solo lo arma
      python cal_blob.py --leer cal.bin                            lo lee y lo muestra
Formato: 'CAL1' | ver u8 | rocket u8 | largo u16 | utc u32 | secciones (id u8, largo u8, float32...) | crc32 (zlib)."""
import argparse, json, struct, sys, time, zlib

VER = 1
S_LSM, S_QMI, S_MMC, S_QMC = 1, 2, 3, 4
ROCKET = {'demeter': 1, 'hermes': 2}


def _f(vals):
    return struct.pack('<%df' % len(vals), *vals)


def _m3(M):
    return [float(x) for fila in M for x in fila]


def armar(c, rocket, utc=None):
    """c: el JSON de calib.py. Devuelve el blob (bytes). Solo entran los sensores calibrados (los magnetometros, si estan alineados)."""
    sec = b''
    if 'lsm' in c:
        d = c['lsm']
        sec += bytes([S_LSM, 60]) + _f(_m3(d['R']) + list(d['sesgo_g']) + list(d['escala']))
    if 'qmi' in c:
        d = c['qmi']
        gan = d.get('ganancia_giro', [1.0, 1.0, 1.0])
        sec += bytes([S_QMI, 76]) + _f(_m3(d['R']) + list(d['sesgo_g']) + list(d['escala']) + list(gan) + [float(d.get('retraso_ms', 0))])
    for sid, k in ((S_MMC, 'mmc'), (S_QMC, 'qmc')):
        d = c.get(k)
        if d and 'R' in d:
            sec += bytes([sid, 88]) + _f(list(d['centro']) + _m3(d['A']) + _m3(d['R']) + [float(d['radio_G'])])
    largo = 12 + len(sec) + 4
    cab = b'CAL1' + bytes([VER, rocket]) + struct.pack('<HI', largo, int(time.time() if utc is None else utc))
    cuerpo = cab + sec
    return cuerpo + struct.pack('<I', zlib.crc32(cuerpo) & 0xFFFFFFFF)


def leer(b):
    """El blob como dict (las mismas claves que el JSON de calib.py). ValueError si no es valido."""
    if len(b) < 16 or b[:4] != b'CAL1':
        raise ValueError('no es una calibracion')
    if b[4] != VER:
        raise ValueError('version distinta')
    largo, utc = struct.unpack_from('<HI', b, 6)
    if largo != len(b):
        raise ValueError('largo distinto al de la cabecera')
    crc = struct.unpack_from('<I', b, len(b) - 4)[0]
    if zlib.crc32(b[:-4]) & 0xFFFFFFFF != crc:
        raise ValueError('CRC32 no coincide')
    out = dict(rocket=b[5], utc=utc, crc=crc)
    i = 12
    while i + 2 <= len(b) - 4:
        sid, sl = b[i], b[i + 1]
        v = list(struct.unpack_from('<%df' % (sl // 4), b, i + 2))
        R = lambda o: [v[o:o + 3], v[o + 3:o + 6], v[o + 6:o + 9]]
        if sid == S_LSM:
            out['lsm'] = dict(R=R(0), sesgo_g=v[9:12], escala=v[12:15])
        elif sid == S_QMI:
            out['qmi'] = dict(R=R(0), sesgo_g=v[9:12], escala=v[12:15], ganancia_giro=v[15:18], retraso_ms=v[18])
        elif sid in (S_MMC, S_QMC):
            out['mmc' if sid == S_MMC else 'qmc'] = dict(centro=v[0:3], A=R(3), R=R(12), radio_G=v[21])
        i += 2 + sl
    return out


def cargar_usb(puerto, blob, espera=8.0):
    """Manda la clave TBCAL, el largo y el blob; devuelve la respuesta del cohete ('CAL OK ...' o 'CAL ERROR ...').
    DTR y RTS se bajan antes de abrir, como en tbget: abrirlo con ellos arriba y bajarlos despues reinicia el S3 y el blob se pierde.
    El blob va despues de una pausa y en trozos: el cohete atiende el USB una vez por segundo y su bufer de entrada es corto."""
    import serial
    s = serial.Serial()
    s.port = puerto
    s.baudrate = 115200
    s.timeout = 0.2
    s.dtr = False
    s.rts = False
    fin = time.time() + 6.0
    while True:                                        # el dashboard acaba de soltar el puerto: Windows tarda en liberarlo
        try:
            s.open()
            break
        except serial.SerialException:
            if time.time() > fin:
                raise
            time.sleep(0.3)
    with s:
        time.sleep(0.3)
        s.reset_input_buffer()
        s.write(b'TBCAL' + struct.pack('<H', len(blob)))
        s.flush()
        time.sleep(1.5)                                # el cohete ya esta esperando el blob (le da 5 s desde la clave)
        for i in range(0, len(blob), 64):
            s.write(blob[i:i + 64])
            s.flush()
            time.sleep(0.02)
        fin = time.time() + espera
        while time.time() < fin:
            linea = s.readline().decode(errors='replace').strip()
            if linea.startswith('CAL '):
                return linea
    return 'sin respuesta del cohete (revisa el puerto y que este en TIERRA sin registrar)'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('json', nargs='?')
    ap.add_argument('--cohete', choices=sorted(ROCKET))
    ap.add_argument('--puerto')
    ap.add_argument('--salida')
    ap.add_argument('--leer')
    a = ap.parse_args()
    if a.leer:
        print(json.dumps(leer(open(a.leer, 'rb').read()), indent=1))
        return 0
    if not a.json:
        ap.error('falta el JSON de calib.py')
    c = json.load(open(a.json, encoding='utf-8'))
    cohete = a.cohete or {'DEM': 'demeter', 'HER': 'hermes'}.get(str(c.get('archivo', ''))[:3])
    if not cohete:
        ap.error('no se sabe de que cohete es: usa --cohete')
    if not c.get('ok'):
        print('AVISO: la calibracion tiene avisos: ' + '; '.join(c.get('avisos', [])))
    blob = armar(c, ROCKET[cohete])
    print(f'blob de {len(blob)} B para {cohete}, CRC32 {zlib.crc32(blob[:-4]) & 0xFFFFFFFF:08X}')
    if a.salida:
        open(a.salida, 'wb').write(blob)
    if a.puerto:
        print(cargar_usb(a.puerto, blob))
    return 0


if __name__ == '__main__':
    sys.exit(main())
