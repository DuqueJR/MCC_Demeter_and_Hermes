#!/usr/bin/env python3
"""tblog.py - Lector de archivos LOGxxxx.BIN del firmware tbeam_fw.
Uso:  python tblog.py LOG0001.BIN            resumen
      python tblog.py LOG0001.BIN --csv      ademas deja cada fuente en un CSV, en la carpeta LOG0001_csv
Formato: [A5 5A][len u16][type u8][src u8][t_us i64] payload [crc16 ccitt-false]  (little endian)
"""
import os, sys, struct, argparse, statistics, collections, time

T_PVT, T_PPS, T_LINK, T_HB, T_FILEHDR, T_IMU, T_MAG, T_BAR, T_BARCAL, T_EXT_LSM, T_EXT_MMC, T_MISSION, T_PI, T_AMB, T_CAL, T_EKF, T_EVENT = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 250
PI_STATUS = {0x00: 'BOOT', 0x01: 'PREFLIGHT', 0x02: 'READY', 0x03: 'ARMED', 0x04: 'STARTING', 0x05: 'INGESTING', 0x06: 'PROCESSING', 0x07: 'COMPLETE', 0x08: 'ASCENT', 0x30: 'RECORDING', 0xE0: 'ABORTED', 0xE1: 'SD_FULL', 0xE2: 'RATE_FALLBACK', 0xE3: 'TELEMETRY_LOST', 0xE4: 'ABORT_REQUESTED', 0xE5: 'CLOCK_UNSYNCED', 0xEF: 'PIPELINE_ERROR', 0xFF: 'desconocido'}   # demeter_protocol.StatusCode
PI_CMD = {0xA0: 'PREFLIGHT', 0xA1: 'ARM', 0xA2: 'START_ASCENT', 0xB1: 'START_REC', 0xC1: 'TOUCHDOWN', 0xF1: 'ABORT'}   # comandos LilyGo -> Pi (T_PI kind 3)
PI_MOTIVO = {0: '', 1: 'SD_ESPACIO', 2: 'SD_LENTA', 3: 'RAM', 4: 'CAMARA', 5: 'TELEMETRIA', 6: 'PROCESO', 7: 'ARCHIVOS', 31: 'OTRO'}   # demeter_protocol.ErrorCode (T_PI kind 1, en pad; D-056)
HDR, CRC = 14, 2
# rec::EkfRec (D-060): q[4] p[3] v[3] bg[3] ba[3] sg[3] b_bmp alt_baro sd_th[3] sd_p[3] sd_v[3] lat0 lon0 h0 fase flags gnss_ok baro_ok mag_ok grav_ok rechazos
EKF_FMT = '<4f3f3f3f3f3fff3f3f3fddfBB5H'

def crc16(data, c=0xFFFF):
    for b in data:
        c ^= b << 8
        for _ in range(8):
            c = ((c << 1) ^ 0x1021) & 0xFFFF if c & 0x8000 else (c << 1) & 0xFFFF
    return c

def records(buf):
    """Genera (offset, type, src, t_us, payload); cuenta bytes saltados y resincronizaciones."""
    pos, skipped, resync = 0, 0, 0
    out = []
    trunc = 0
    n = len(buf)
    while pos + HDR + CRC <= n:
        if buf[pos] == 0 and not any(buf[pos:pos + 64]):          # cola de ceros: fin de datos
            break
        ok = False
        if buf[pos] == 0xA5 and buf[pos + 1] == 0x5A:
            ln = buf[pos + 2] | (buf[pos + 3] << 8)
            if HDR + CRC <= ln <= 512 and pos + ln <= n:
                if crc16(buf[pos:pos + ln - CRC]) == (buf[pos + ln - 2] | (buf[pos + ln - 1] << 8)):
                    typ, src = buf[pos + 4], buf[pos + 5]
                    t_us = struct.unpack_from('<q', buf, pos + 6)[0]
                    out.append((pos, typ, src, t_us, bytes(buf[pos + HDR:pos + ln - CRC])))
                    pos += ln
                    ok = True
        if not ok:
            nxt = buf.find(b'\xA5\x5A', pos + 1)
            if nxt < 0:
                if len(bytes(buf[pos:]).rstrip(b'\0')) <= 512:      # registro final cortado (apagado) y luego solo ceros
                    trunc = n - pos
                else:
                    skipped += n - pos
                break
            skipped += nxt - pos
            resync += 1
            pos = nxt
    return out, skipped, resync, trunc

FH_CONTINUA = 1          # FILEHDR v3, byte 73: el archivo sigue al anterior del mismo registro (cambio de archivo al llenarse)


def cabecera(datos):
    """FILEHDR del principio de un archivo (bastan sus primeros 512 B): dict(ver, rocket, boot, idx, continua) o None."""
    for r in records(datos[:512])[0]:
        if r[1] == T_FILEHDR and len(r[4]) >= 28:
            _, ver, rid, _, boot, idx = struct.unpack_from('<4sHHIII', r[4])
            return dict(ver=ver, rocket=rid, boot=boot, idx=idx, continua=bool(ver >= 3 and len(r[4]) > 73 and r[4][73] & FH_CONTINUA))
    return None


def continua(previa, cab):
    """cab sigue a previa en el mismo registro: mismo arranque y, desde v3, la bandera; en v1-v2 basta el mismo arranque (como cal_onboard)."""
    if not previa or not cab or previa['boot'] != cab['boot']:
        return False
    return cab['continua'] if cab['ver'] >= 3 else True


def indice_log(name):
    import re
    m = re.search(r'_(\d+)\.BIN$', os.path.basename(name))
    return int(m.group(1)) if m else -1


def registro(path):
    """Todos los archivos del registro al que pertenece path, en orden, buscando en su carpeta los vecinos que lo continuan."""
    carpeta, base = os.path.split(os.path.abspath(path))
    pre = base[:4]
    vecinos = sorted((f for f in os.listdir(carpeta) if f.startswith(pre) and f.endswith('.BIN') and indice_log(f) >= 0), key=indice_log)
    if base not in vecinos:
        return [path]
    cab = {}
    def c(f):
        if f not in cab:
            with open(os.path.join(carpeta, f), 'rb') as fh:
                cab[f] = cabecera(fh.read(512))
        return cab[f]
    i = j = vecinos.index(base)
    while i > 0 and continua(c(vecinos[i - 1]), c(vecinos[i])):
        i -= 1
    while j + 1 < len(vecinos) and continua(c(vecinos[j]), c(vecinos[j + 1])):
        j += 1
    return [os.path.join(carpeta, f) for f in vecinos[i:j + 1]]


def days_from_civil(y, m, d):
    y -= m <= 2
    era = (y if y >= 0 else y - 399) // 400
    yoe = y - era * 400
    mp = m + (-3 if m > 2 else 9)
    doy = (153 * mp + 2) // 5 + d - 1
    doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    return era * 146097 + doe - 719468

def decode_pvt(p):
    if len(p) != 92:
        return None
    itow, year = struct.unpack_from('<IH', p, 0)
    month, day, hour, minute, sec, valid = struct.unpack_from('<6B', p, 6)
    tacc, nano = struct.unpack_from('<Ii', p, 12)
    fix, flags, flags2, nsv = struct.unpack_from('<4B', p, 20)
    lon, lat, h, hmsl = struct.unpack_from('<4i', p, 24)
    hacc, vacc = struct.unpack_from('<II', p, 40)
    utc_sec = days_from_civil(year, month, day) * 86400 + hour * 3600 + minute * 60 + sec
    return dict(itow=itow, utc_sec=utc_sec, nano=nano, valid=valid, tacc=tacc, fix=fix, nsv=nsv,
                lat=lat * 1e-7, lon=lon * 1e-7, h=h / 1000.0, hacc=hacc / 1000.0)

def pct(v, q):
    v = sorted(v)
    return v[min(len(v) - 1, int(len(v) * q))] if v else float('nan')

def espectro_flancos(ts, f_ref):
    """El reloj de muestras del chip corre libre: todo flanco cae en t0 + k*T aunque se pierdan muestras entre lotes.
    Devuelve (f_pico, coherencia_pico, coherencia en f_ref) sobre los primeros 120 s. Sin perdidas los flancos tambien
    caen en k*wtm*T y aparecen picos en los armonicos de f/wtm: lo que valida es la coherencia en f_ref."""
    try:
        import numpy as np
    except ImportError:
        return None
    t = np.array(ts, dtype=np.int64)
    t = (t - t[0]).astype(float)
    t = t[t < 120e6] * 1e-6
    if len(t) < 50:
        return None
    fs = np.arange(300.0, 600.0, 0.004)
    P = np.zeros_like(fs)
    for i in range(0, len(fs), 500):
        P[i:i + 500] = np.abs(np.exp(2j * np.pi * np.outer(fs[i:i + 500], t)).sum(axis=1)) / len(t)
    k = int(np.argmax(P))
    cerca = P[np.abs(fs - f_ref) < 0.05]
    return float(fs[k]), float(P[k]), float(cerca.max()) if len(cerca) else 0.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file'); ap.add_argument('--csv', action='store_true')
    a = ap.parse_args()
    buf = open(a.file, 'rb').read()
    if a.csv:
        carpeta = os.path.abspath(os.path.splitext(a.file)[0] + '_csv')
        os.makedirs(carpeta, exist_ok=True)
        os.chdir(carpeta)
    recs, skipped, resync, trunc = records(buf)
    print(f"archivo: {a.file}  tamano={len(buf)} B  registros={len(recs)}  bytes_saltados={skipped}  resync={resync}" + ("  (registro final cortado por el apagado, resto ceros)" if trunc else ""))
    tipos = collections.Counter(r[1] for r in recs)
    names = {T_PVT: 'PVT', T_PPS: 'PPS', T_LINK: 'LINK', T_HB: 'HEARTBEAT', T_FILEHDR: 'FILEHDR', T_IMU: 'IMU', T_MAG: 'MAG', T_BAR: 'BAR', T_BARCAL: 'BARCAL', T_EXT_LSM: 'EXT_LSM', T_EXT_MMC: 'EXT_MMC', T_MISSION: 'MISSION', T_PI: 'PI', T_AMB: 'AMB', T_CAL: 'CAL', T_EKF: 'EKF', T_EVENT: 'EVENT'}
    print("por tipo: " + ", ".join(f"{names.get(k, k)}={v}" for k, v in sorted(tipos.items())))
    if recs:
        sens = [r[3] for r in recs if r[1] not in (T_EVENT, T_FILEHDR, T_MISSION, T_PI, T_AMB, T_CAL, T_EKF)]     # lo guardado antes de registrar no cuenta
        if sens:
            print(f"duracion (reloj local): {(max(sens) - min(sens)) / 1e6:.1f} s")

    for r in recs:
        if r[1] == T_FILEHDR:
            magic, ver, rid, mid, boot, idx, utc = struct.unpack_from('<4sHHIIIq', r[4])
            fw = r[4][28:44].split(b'\0')[0].decode(errors='replace')
            if ver >= 2 and len(r[4]) >= 73:
                fw += f" entorno={r[4][44:60].split(bytes(1))[0].decode(errors='replace')} commit={r[4][60:72].split(bytes(1))[0].decode(errors='replace')} LoRa={struct.unpack_from('<b', r[4], 72)[0]} dBm"
            else:
                fw += " (firmware anterior: sin entorno ni potencia)"
            cont = ' (continua el archivo anterior del mismo registro)' if ver >= 3 and len(r[4]) > 73 and r[4][73] & FH_CONTINUA else ''
            print(f"cabecera: {magic.decode()} v{ver} rocket_id={rid} mission_id={mid} arranque={boot} archivo={idx} fw={fw}{cont}")
            break

    hbs = [r for r in recs if r[1] == T_HB]
    if hbs:
        up, d0, d1, d2, d3, wmax, fmax, nbytes, tf, ss, sp, _ = struct.unpack_from('<I4IIIIBBBB', hbs[-1][4])
        print(f"ultimo latido: t={up / 1000:.0f} s  descartes anillos={[d0, d1, d2, d3]}  escritura_max={wmax / 1000:.1f} ms  flush_max={fmax / 1000:.1f} ms  bytes={nbytes}  time_flags=0x{tf:02X}")

    # ---- PVT ----
    pvt = [(r[3], decode_pvt(r[4])) for r in recs if r[1] == T_PVT]
    pvt = [(t, d) for t, d in pvt if d]
    if len(pvt) > 2:
        dur = (pvt[-1][0] - pvt[0][0]) / 1e6
        print(f"\nPVT: {len(pvt)} en {dur:.1f} s -> {len(pvt) / dur:.2f} Hz   ultimo: fix={pvt[-1][1]['fix']} sv={pvt[-1][1]['nsv']} hAcc={pvt[-1][1]['hacc']:.2f} m tAcc={pvt[-1][1]['tacc']} ns")
        gaps, phase = [], collections.Counter()
        for (t0, a0), (t1, a1) in zip(pvt, pvt[1:]):
            dt = a1['itow'] - a0['itow']
            if dt != 100:
                gaps.append(dt)
                phase[(a0['itow'] % 1000 + 100) % 1000 // 100] += 1       # fase de la primera epoca perdida
        print(f"huecos: {len(gaps)} ({100.0 * len(gaps) / len(pvt):.1f} % de las epocas)  tamanos: {dict(collections.Counter(gaps))}")
        if gaps:
            print("fase (x100 ms dentro del segundo) de la epoca perdida: " + ", ".join(f"{k}:{v}" for k, v in sorted(phase.items())))

    # ---- PPS y reloj ----
    pps = []
    for r in recs:
        if r[1] == T_PPS and len(r[4]) >= 18:
            te, sec, used, fix, _, tacc = struct.unpack_from('<qqBBHI', r[4])
            pps.append((te, sec, used, fix, tacc))
    used = [(te, sec) for te, sec, u, _, _ in pps if u]
    print(f"\nPPS: {len(pps)} registros, {len(used)} anclados")
    if len(used) > 5:
        ppm = [((t1 - t0) / ((s1 - s0) * 1e6) - 1) * 1e6 for (t0, s0), (t1, s1) in zip(used, used[1:]) if s1 - s0 == 1]
        if ppm:
            tot = ((used[-1][0] - used[0][0]) / ((used[-1][1] - used[0][1]) * 1e6) - 1) * 1e6
            print(f"error del reloj local (negativo = va lento): media por segundo={statistics.mean(ppm):+.2f} ppm  sd={statistics.pstdev(ppm):.2f} ppm  (ventana completa: {tot:+.2f} ppm)")
            print(f"  (la sd por segundo refleja el jitter del PPS: ~{statistics.pstdev(ppm):.1f} us)")

    # ---- latencia de entrega del PVT por fase ----
    edge = {sec: te for te, sec in used}
    lat = collections.defaultdict(list)
    for t_rx, d in pvt:
        te = edge.get(d['utc_sec'] + (1 if d['nano'] < -500000000 else 0)) or edge.get(d['utc_sec'])
        if te is None:
            continue
        ph = d['itow'] % 1000
        lat[ph // 100].append((t_rx - te) / 1000.0 - ph)
    if lat:
        print("\nretraso de entrega del PVT (ms desde el inicio de su epoca, por fase de 100 ms):")
        for k in sorted(lat):
            v = lat[k]
            print(f"  fase {k}: n={len(v):4d}  mediana={statistics.median(v):6.1f}  p95={pct(v, 0.95):6.1f}  max={max(v):6.1f}")

    # ---- IMU ----
    imu = []
    for r in recs:
        if r[1] == T_IMU and len(r[4]) >= 40:
            n0, cnt, fl, accfs, t_isr, t_first, period, dev, rd, gfs = struct.unpack_from('<IHBBqqdIHH', r[4], 0)
            if len(r[4]) == 40 + 12 * cnt:
                imu.append(dict(n0=n0, cnt=cnt, fl=fl, accfs=accfs, t_isr=t_isr, t_first=t_first, period=period,
                                dev=dev, rd=rd, gfs=gfs, raw=struct.unpack_from('<%dh' % (6 * cnt), r[4], 40)))
    if imu:
        tot = sum(b['cnt'] for b in imu)
        print(f"\nIMU: {len(imu)} registros, {tot} muestras  (rango +-{imu[0]['accfs']} g, +-{imu[0]['gfs']} dps)")
        hist = collections.Counter(b['cnt'] for b in imu)
        print("  muestras por registro: " + ", ".join(f"{k}:{v}" for k, v in sorted(hist.items())))
        fl = collections.Counter()
        for b in imu:
            for bit, nm in ((1, 'LLENO'), (2, 'est_ok'), (4, 'sondeo'), (8, 'continuacion'), (16, 'rechazado'), (32, 'hueco')):
                if b['fl'] & bit: fl[nm] += 1
        print("  banderas: " + ", ".join(f"{k}={v}" for k, v in fl.items()))
        # Un flanco puede repartirse en varios registros (continuacion): se agrupan en lotes
        lotes = []
        for b in imu:
            if (b['fl'] & 8) and lotes:
                lotes[-1]['cnt'] += b['cnt']
            else:
                lotes.append(dict(n0=b['n0'], cnt=b['cnt'], fl=b['fl'], t=b['t_isr']))
        wtm = collections.Counter(l['cnt'] for l in lotes if not (l['fl'] & 4)).most_common(1)[0][0]
        print(f"  lotes: {len(lotes)}  marca de agua deducida: {wtm} muestras")
        # Regresion: indice de muestra del flanco (n0+wtm-1) contra instante de la interrupcion
        pts = [(l['n0'] + wtm - 1, l['t']) for l in lotes if not (l['fl'] & (4 | 16)) and l['cnt'] >= wtm]
        wtm_pts = pts
        if len(pts) > 20:
            for _ in range(4):                                   # regresion con recorte de atipicos
                n = len(wtm_pts); mx = sum(p[0] for p in wtm_pts) / n; my = sum(p[1] for p in wtm_pts) / n
                sxx = sum((p[0] - mx) ** 2 for p in wtm_pts); sxy = sum((p[0] - mx) * (p[1] - my) for p in wtm_pts)
                T = sxy / sxx
                res = [p[1] - (my + T * (p[0] - mx)) for p in wtm_pts]
                sd = statistics.pstdev(res)
                wtm_pts = [p for p, r in zip(wtm_pts, res) if abs(r) < 3 * sd + 1]
            print(f"  periodo por indice = {T:.3f} us -> {1e6 / T:.3f} Hz (reloj local)   residuo de la interrupcion: sd={sd:.1f} us  ({len(wtm_pts)}/{len(pts)} lotes usados)")
            clk = 1.0
            if len(used) > 5:
                clk = ((used[-1][0] - used[0][0]) / ((used[-1][1] - used[0][1]) * 1e6))
                print(f"  corregido con el PPS (reloj local {1e6 * (clk - 1):+.2f} ppm): {1e6 / T * clk:.3f} Hz por segundo real   (nominal del chip 448.4)")
            span = (lotes[-1]['t'] - lotes[0]['t']) / 1e6 / clk
            huecos = [l2['n0'] - l1['n0'] - l1['cnt'] for l1, l2 in zip(lotes, lotes[1:]) if l2['n0'] > l1['n0'] + l1['cnt']]
            print(f"  lotes/s={(len(lotes) - 1) / span:.2f}  muestras/lote={tot / len(lotes):.2f}  recibidas/s={tot / span:.1f}")
            print(f"  huecos en los indices: {len(huecos)} lotes, {sum(huecos)} muestras ({100.0 * sum(huecos) / (tot + sum(huecos)):.2f} %)  tamanos: {dict(collections.Counter(huecos))}")
            sp = espectro_flancos([l['t'] for l in lotes if not (l['fl'] & 4)], 1e6 / T)
            if sp:
                print(f"  flancos contra el reloj del chip: coherencia {sp[2]:.3f} en el ODR por indice; pico 300-600 Hz en {sp[0]:.3f} Hz ({sp[1]:.3f})")
                if sp[2] < 0.8:
                    print("  AVISO: los indices no cuadran con el reloj del chip (hay perdidas sin contabilizar; es normal en logs anteriores a la lectura propia)")
        rd = [b['rd'] for b in imu]
        print(f"  tiempo de lectura del FIFO: mediana={statistics.median(rd)} us  p95={pct(rd, 0.95)} us  max={max(rd)} us")
        ax = [b['raw'][i] for b in imu for i in range(0, len(b['raw']), 6)]
        sc = 32768.0 / imu[0]['accfs']
        ay = [b['raw'][i + 1] for b in imu for i in range(0, len(b['raw']), 6)]
        az = [b['raw'][i + 2] for b in imu for i in range(0, len(b['raw']), 6)]
        mag = [((x * x + y * y + z * z) ** 0.5) / sc for x, y, z in zip(ax, ay, az)]
        print(f"  |a| = {statistics.mean(mag):.4f} g (sd {statistics.pstdev(mag):.4f})")
        gx = [b['raw'][i + 3] for b in imu for i in range(0, len(b['raw']), 6)]
        gy = [b['raw'][i + 4] for b in imu for i in range(0, len(b['raw']), 6)]
        gz = [b['raw'][i + 5] for b in imu for i in range(0, len(b['raw']), 6)]
        gs = 32768.0 / imu[0]['gfs']
        print(f"  giro medio: x={statistics.mean(gx) / gs:+.3f} y={statistics.mean(gy) / gs:+.3f} z={statistics.mean(gz) / gs:+.3f} dps   ruido sd: {statistics.pstdev(gx) / gs:.3f} {statistics.pstdev(gy) / gs:.3f} {statistics.pstdev(gz) / gs:.3f} dps")
        if a.csv:
            with open('imu.csv', 'w') as f:
                f.write('n,t_est_us,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps\n')
                for b in imu:
                    for k in range(b['cnt']):
                        v = b['raw'][6 * k:6 * k + 6]
                        f.write(f"{b['n0'] + k},{b['t_first'] + k * b['period']:.1f},{v[0] / sc:.5f},{v[1] / sc:.5f},{v[2] / sc:.5f},{v[3] / gs:.4f},{v[4] / gs:.4f},{v[5] / gs:.4f}\n")
            print("  escribi imu.csv")

    # ---- LSM6DSO32 y BMP581 por el hub (palabras crudas del FIFO: tag + 6 bytes) ----
    lsm = []
    for r in recs:
        if r[1] == T_EXT_LSM and len(r[4]) >= 24:
            n0, cnt, fl, accfs, t_first, period, rd, gfs = struct.unpack_from('<IHBBqfHH', r[4], 0)
            if len(r[4]) == 24 + 7 * cnt:
                lsm.append(dict(t=r[3], n0=n0, cnt=cnt, fl=fl, accfs=accfs, t_first=t_first, period=period, rd=rd, gfs=gfs, data=r[4][24:]))
    if lsm:
        tags = collections.Counter()
        acc, gyr, ts, bmp = [], [], [], []               # acc, ts y bmp llevan el indice de ranura; gyr se empareja por orden
        for b in lsm:
            n = b['n0']
            for i in range(b['cnt']):
                w = b['data'][7 * i:7 * i + 7]
                tag = w[0] >> 3
                tags[tag] += 1
                if tag == 2:
                    acc.append((n, b['t_first'] + (n - b['n0']) * b['period']) + struct.unpack('<3h', w[1:]))
                    n += 1
                elif tag == 1:
                    gyr.append(struct.unpack('<3h', w[1:]))
                elif tag == 4:
                    ts.append((n, struct.unpack('<I', w[1:5])[0]))
                elif tag == 0x0E:
                    tt = w[1] | (w[2] << 8) | (w[3] << 16)
                    pp = w[4] | (w[5] << 8) | (w[6] << 16)
                    tt -= (tt & 0x800000) << 1
                    pp -= (pp & 0x800000) << 1
                    bmp.append((b['t_first'] + (n - b['n0']) * b['period'], pp / 64.0, tt / 65536.0))
        nombres = {1: 'giro', 2: 'acel', 3: 'temp', 4: 'marca', 5: 'cambio_cfg', 0x0E: 'hub', 0x19: 'hub_nack'}
        print(f"\nLSM: {len(lsm)} registros, {len(acc)} acel, {len(gyr)} giro  (rango +-{lsm[0]['accfs']} g, +-{lsm[0]['gfs']} dps)")
        print("  palabras: " + ", ".join(f"{nombres.get(k, hex(k) + ' DESCONOCIDA')}={v}" for k, v in sorted(tags.items())))
        fl = collections.Counter()
        for b in lsm:
            for bit, nm in ((1, 'SOBRESCRITO'), (2, 'est_ok'), (4, 'sondeo'), (8, 'continuacion'), (16, 'rechazado'), (32, 'hueco')):
                if b['fl'] & bit: fl[nm] += 1
        print("  banderas: " + ", ".join(f"{k}={v}" for k, v in fl.items()))
        huecos = [a2[0] - a1[0] - 1 for a1, a2 in zip(acc, acc[1:]) if a2[0] != a1[0] + 1]
        print(f"  huecos en los indices: {len(huecos)}, {sum(huecos)} muestras ({100.0 * sum(huecos) / max(1, len(acc) + sum(huecos)):.3f} %)")
        if len(ts) > 2:
            d = [(t2 - t1) / (n2 - n1) for (n1, t1), (n2, t2) in zip(ts, ts[1:]) if n2 > n1]
            print(f"  marcas: {len(ts)}  ticks por ranura: mediana={statistics.median(d):.3f}  min={min(d):.3f}  max={max(d):.3f}  (se espera 24: si no, revisar TS_TICKS_PER_SLOT)")
        p = [b['period'] for b in lsm if b['fl'] & 2]
        if p:
            print(f"  periodo estimado: {p[-1]:.3f} us -> {1e6 / p[-1]:.3f} Hz (reloj local)  marca real={p[-1] / 24:.3f} us (nominal 25: comparte oscilador con el ODR)")
        rd = [b['rd'] for b in lsm]
        print(f"  tiempo de lectura del FIFO: mediana={statistics.median(rd)} us  p95={pct(rd, 0.95)} us  max={max(rd)} us")
        sa, sg = 1000.0 / 0.976, 1000.0 / 70.0
        na = [(a[2] * a[2] + a[3] * a[3] + a[4] * a[4]) ** 0.5 / sa for a in acc]
        print(f"  |a| = {statistics.mean(na):.4f} g (sd {statistics.pstdev(na):.4f})   medio: x={statistics.mean(a[2] for a in acc) / sa:+.4f} y={statistics.mean(a[3] for a in acc) / sa:+.4f} z={statistics.mean(a[4] for a in acc) / sa:+.4f} g")
        if gyr:
            print("  giro medio: " + " ".join(f"{e}={statistics.mean(g[i] for g in gyr) / sg:+.3f}" for i, e in enumerate('xyz')) + " dps   ruido sd: " + " ".join(f"{statistics.pstdev([g[i] for g in gyr]) / sg:.3f}" for i in range(3)) + " dps")
        if len(bmp) > 2:
            dur = (bmp[-1][0] - bmp[0][0]) / 1e6
            # Palabras corruptas en el bus del hub: imposibles, o a mas de 100 Pa de la mediana de 3, igual que el firmware
            val = [b for b in bmp if 20000 <= b[1] <= 115000 and -40 <= b[2] <= 85]
            med = [sorted(c[1] for c in val[i - 1:i + 2])[1] for i in range(1, len(val) - 1)]
            good = [v for v, m in zip(val[1:-1], med) if abs(v[1] - m) <= 100]
            ps, tb = [b[1] for b in good], [b[2] for b in good]
            print(f"\nBMP581: {len(bmp)} en {dur:.1f} s -> {len(bmp) / dur:.2f} Hz   palabras malas={len(bmp) - len(good) - 2} ({100 * (len(bmp) - len(good) - 2) / len(bmp):.2f} %)   sin ellas: P = {statistics.mean(ps):.1f} Pa (sd {statistics.pstdev(ps):.2f}, min {min(ps):.1f}, max {max(ps):.1f})   T = {statistics.mean(tb):.2f} C (sd {statistics.pstdev(tb):.3f})")
        if a.csv:
            with open('lsm.csv', 'w') as f:
                f.write('n,t_est_us,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps\n')
                for s, g in zip(acc, gyr):
                    f.write(f"{s[0]},{s[1]:.1f},{s[2] / sa:.5f},{s[3] / sa:.5f},{s[4] / sa:.5f},{g[0] / sg:.4f},{g[1] / sg:.4f},{g[2] / sg:.4f}\n")
            with open('bmp.csv', 'w') as f:
                f.write('t_est_us,p_pa,t_c\n')
                for b in bmp:
                    f.write(f"{b[0]:.1f},{b[1]:.3f},{b[2]:.4f}\n")
            print("  escribi lsm.csv y bmp.csv")

    # ---- Radio ----
    link =[(r[3],) + struct.unpack('<BBBBhhiI', r[4]) for r in recs if r[1] == T_LINK and len(r[4]) == 16]
    tx = [l for l in link if l[1] == 0]
    if len(tx) > 2:
        ran = [l for l in tx if l[2] != 0xFF]
        dur = (tx[-1][0] - tx[0][0]) / 1e6
        print(f"\nRADIO: {len(tx)} TX en {dur:.1f} s -> {len(tx) / dur:.2f} Hz   balizas={len(tx) - len(ran)}")
        if ran:
            late = [l[7] for l in ran]; air = [l[8] for l in ran]
            print(f"  ranuras: {dict(sorted(collections.Counter(l[2] for l in ran).items()))}")
            print(f"  inicio respecto al previsto: mediana={statistics.median(late)} us  p95={pct(late, 0.95)}  max={max(late)}   aire: mediana={statistics.median(air)} us  max={max(air)}")

    rx = [l for l in link if l[1] == 1 and l[2] == 0]       # slot 1 = comando recibido
    ncmd = sum(1 for l in link if l[1] == 1 and l[2] == 1)
    if ncmd:
        print(f"  comandos recibidos: {ncmd}")
    if len(rx) > 2:
        res = [l[7] for l in rx]
        print(f"  balizas de tierra: {len(rx)}   residuo: mediana={statistics.median(res)} us  sd={statistics.pstdev(res):.1f}  min={min(res)}  max={max(res)}   RSSI mediana={statistics.median(l[5] for l in rx) / 10.0:.1f} dBm")

    # ---- Magnetometro ----
    mag = [(r[3],) + struct.unpack('<3hBB', r[4]) for r in recs if r[1] == T_MAG and len(r[4]) == 8]
    if len(mag) > 2:
        lsb = 32000.0 / mag[0][5]
        dur = (mag[-1][0] - mag[0][0]) / 1e6
        dt = [(m2[0] - m1[0]) / 1000.0 for m1, m2 in zip(mag, mag[1:])]
        mx, my, mz = ([m[i] / lsb for m in mag] for i in (1, 2, 3))
        norm = [(x * x + y * y + z * z) ** 0.5 for x, y, z in zip(mx, my, mz)]
        print(f"\nMAG: {len(mag)} en {dur:.1f} s -> {len(mag) / dur:.2f} Hz  (rango +-{mag[0][5]} G)   intervalo: mediana={statistics.median(dt):.2f} ms  p95={pct(dt, 0.95):.2f}  max={max(dt):.2f}  pausas >25 ms: {sum(1 for x in dt if x > 25)}")
        print(f"  saturadas={sum(1 for m in mag if m[4] & 1)}   medio: x={statistics.mean(mx):+.4f} y={statistics.mean(my):+.4f} z={statistics.mean(mz):+.4f} G   ruido sd: {1000 * statistics.pstdev(mx):.2f} {1000 * statistics.pstdev(my):.2f} {1000 * statistics.pstdev(mz):.2f} mG")
        print(f"  |B| = {statistics.mean(norm):.4f} G (sd {1000 * statistics.pstdev(norm):.2f} mG, min {min(norm):.4f}, max {max(norm):.4f})")
        if a.csv:
            with open('mag.csv', 'w') as f:
                f.write('t_us,x_g,y_g,z_g,flags\n')
                for m in mag:
                    f.write(f"{m[0]},{m[1] / lsb:.5f},{m[2] / lsb:.5f},{m[3] / lsb:.5f},{m[4]}\n")
            print("  escribi mag.csv")

    # ---- MMC5983MA ----
    mmc = [(r[3],) + struct.unpack('<3iBB', r[4]) for r in recs if r[1] == T_EXT_MMC and len(r[4]) == 14]
    flujo = [m for m in mmc if not m[4] & 6]
    if len(flujo) > 2:
        lsb = 16384.0
        dur = (flujo[-1][0] - flujo[0][0]) / 1e6
        dt = [(m2[0] - m1[0]) / 1000.0 for m1, m2 in zip(flujo, flujo[1:])]
        mx, my, mz = ([m[i] / lsb for m in flujo] for i in (1, 2, 3))
        norm = [(x * x + y * y + z * z) ** 0.5 for x, y, z in zip(mx, my, mz)]
        print(f"\nMMC5983MA: {len(flujo)} en {dur:.1f} s -> {len(flujo) / dur:.2f} Hz  (rango +-8 G)   intervalo: mediana={statistics.median(dt):.2f} ms  p95={pct(dt, 0.95):.2f}  max={max(dt):.2f}  pausas >25 ms: {sum(1 for x in dt if x > 25)}")
        print(f"  saturadas={sum(1 for m in flujo if m[4] & 1)}   medio: x={statistics.mean(mx):+.4f} y={statistics.mean(my):+.4f} z={statistics.mean(mz):+.4f} G   ruido sd: {1000 * statistics.pstdev(mx):.2f} {1000 * statistics.pstdev(my):.2f} {1000 * statistics.pstdev(mz):.2f} mG")
        print(f"  |B| = {statistics.mean(norm):.4f} G (sd {1000 * statistics.pstdev(norm):.2f} mG, min {min(norm):.4f}, max {max(norm):.4f})")
        for s, rs in zip((m for m in mmc if m[4] & 2), (m for m in mmc if m[4] & 4)):
            h = [(s[i] - rs[i]) / 2 / lsb for i in (1, 2, 3)]
            of = [1000 * (s[i] + rs[i]) / 2 / lsb for i in (1, 2, 3)]
            print(f"  par SET/RESET: H = {h[0]:+.4f} {h[1]:+.4f} {h[2]:+.4f} G  |H| = {sum(v * v for v in h) ** 0.5:.4f} G   offset del puente = {of[0]:+.1f} {of[1]:+.1f} {of[2]:+.1f} mG")
        if a.csv:
            with open('mmc.csv', 'w') as f:
                f.write('t_us,x_g,y_g,z_g,flags\n')
                for m in mmc:
                    f.write(f"{m[0]},{m[1] / lsb:.5f},{m[2] / lsb:.5f},{m[3] / lsb:.5f},{m[4]}\n")
            print("  escribi mmc.csv")

    # ---- Barometro ----
    bar = [(r[3],) + struct.unpack('<qIIHHfff', r[4]) for r in recs if r[1] == T_BAR and len(r[4]) == 32]
    if len(bar) > 2:
        dur = (bar[-1][0] - bar[0][0]) / 1e6
        dt = [(b2[0] - b1[0]) / 1000.0 for b1, b2 in zip(bar, bar[1:])]
        med = [(b[0] - b[1]) / 1000.0 for b in bar]
        ps, ts, hs = [b[6] for b in bar], [b[7] for b in bar], [b[8] for b in bar]
        print(f"\nBAR: {len(bar)} en {dur:.1f} s -> {len(bar) / dur:.2f} Hz   intervalo: mediana={statistics.median(dt):.2f} ms  p95={pct(dt, 0.95):.2f}  max={max(dt):.2f}   medicion: mediana={statistics.median(med):.2f} ms  max={max(med):.2f}")
        print(f"  P = {statistics.mean(ps):.1f} Pa (sd {statistics.pstdev(ps):.2f}, min {min(ps):.1f}, max {max(ps):.1f})   T = {statistics.mean(ts):.2f} C (sd {statistics.pstdev(ts):.3f})   H = {statistics.mean(hs):.1f} %")
        print(f"  calibraciones registradas: {tipos.get(T_BARCAL, 0)}")
        if a.csv:
            with open('bar.csv', 'w') as f:
                f.write('t_fin_us,t_inicio_us,p_pa,t_c,h_pct,adc_p,adc_t,adc_h\n')
                for b in bar:
                    f.write(f"{b[0]},{b[1]},{b[6]:.2f},{b[7]:.3f},{b[8]:.2f},{b[2]},{b[3]},{b[4]}\n")
            print("  escribi bar.csv")

    # ---- Posicion real frente a lo que el logger cree escrito ----
    d = [struct.unpack_from('<I', r[4], 28)[0] - r[0] for r in recs if r[1] == T_HB and len(r[4]) >= 32]
    if d:
        print(f"\nPOSICION: bytes contados - posicion real: rango {max(d) - min(d)} B" + ("  (normal: menos de 4096)" if max(d) - min(d) < 4096 else "  HAY PERDIDA O RETROCESO: lo normal es menos de 4096"))

    # ---- Comandos y estados ----
    mis = [(r[3],) + struct.unpack('<IIBBBBBBBB', r[4]) for r in recs if r[1] == T_MISSION and len(r[4]) == 16]
    if mis:
        ops = {0: 'automatico', 1: 'ping', 2: 'armar', 3: 'desarmar', 4: 'launch', 5: 'abortar', 6: 'dormir', 7: 'estado', 8: 'momento', 9: 'reiniciar'}
        st = ['-', 'TIERRA', 'ARMED', 'FLY', 'RECOVERY']
        mo = ['-', 'LAUNCH', 'BOOST', 'COAST', 'APOGEO', 'CAIDA', 'PARACAIDAS', 'ATERRIZAJE']
        res = ['EJECUTADO', 'NO APTO', 'APTO', 'ERROR']
        print(f"\nMISION: {len(mis)} registros")
        for t, ctr, rz, op, arg, r_, fr, to, m, fl, _ in mis:
            print(f"  t={t / 1e6:.2f} s  {ops.get(op & 0x7F, op)}{' confirmado' if op & 0x80 else ''} arg={arg} contador={ctr}: {res[r_ & 3]} motivos=0x{rz:08X}  {st[fr]} -> {st[to]}  momento={mo[m]}  flags=0x{fl:02X}")
        if a.csv:
            with open('mision.csv', 'w') as f:
                f.write('t_us,comando,confirmado,arg,contador,resultado,motivos,de,a,momento,flags\n')
                for t, ctr, rz, op, arg, r_, fr, to, m, fl, _ in mis:
                    f.write(f"{t},{ops.get(op & 0x7F, op)},{1 if op & 0x80 else 0},{arg},{ctr},{res[r_ & 3]},0x{rz:08X},{st[fr]},{st[to]},{mo[m]},0x{fl:02X}\n")

    # ---- Raspberry Pi de Demeter por la UART (ext_pi) ----
    pis = [(r[3],) + struct.unpack('<BBBBIII', r[4]) for r in recs if r[1] == T_PI and len(r[4]) == 16]
    if pis:
        print(f"\nPI: {len(pis)} registros")
        for t, stt, prev, kind, intento, rx, crc, pose in pis:
            if kind == 3:
                print(f"  t={t / 1e6:.2f} s  comando {PI_CMD.get(prev, hex(prev))} (intento {intento}) con la Pi en {PI_STATUS.get(stt, hex(stt))}")
                continue
            que = 'latido perdido' if kind == 2 else 'estado'
            mot = f"  motivo={PI_MOTIVO.get(intento, intento)}" if kind == 1 and intento else ''
            print(f"  t={t / 1e6:.2f} s  {que}: {PI_STATUS.get(prev, hex(prev))} -> {PI_STATUS.get(stt, hex(stt))}{mot}  tramas={rx} crc_mal={crc} pose={pose}")
        if a.csv:
            with open('pi.csv', 'w') as f:
                f.write('t_us,evento,de,a,tramas,crc_mal,pose\n')
                for t, stt, prev, kind, intento, rx, crc, pose in pis:
                    if kind == 3:
                        f.write(f"{t},comando {PI_CMD.get(prev, prev)} intento {intento},{PI_STATUS.get(stt, stt)},{PI_STATUS.get(stt, stt)},{rx},{crc},{pose}\n")
                    else:
                        f.write(f"{t},{'perdido' if kind == 2 else 'estado'},{PI_STATUS.get(prev, prev)},{PI_STATUS.get(stt, stt)},{rx},{crc},{pose}\n")

    # ---- Temperatura del suelo (amb_temp, D-058) ----
    ambs = [(r[3],) + struct.unpack('<fffffqffBBBB', r[4]) for r in recs if r[1] == T_AMB and len(r[4]) == 40]
    if ambs:
        fuentes = {0: '-', 1: 'sueno largo', 2: 'encendido', 3: 'a mano'}
        eventos = {1: 'muestra en frio', 3: 'copia al registrar'}
        armb = {1: 'sin muestra', 2: 'dudosa', 4: 'vieja', 8: 'deriva', 16: 'BMP y BME discrepan'}
        print()
        print(f"TEMPERATURA DEL SUELO: {len(ambs)} registros")
        for t, tb, te, tu, pb, pe, utc, tba, tea, fu, ca, ev, arm in ambs:
            hora = f", muestra de las {time.strftime('%H:%M:%S', time.gmtime(utc / 1000))} UTC" if utc else ''
            print(f"  t={t / 1e6:.2f} s  {eventos.get(ev, ev)}: usada {tu:.2f} C ({'dudosa' if ca else 'buena'}, {fuentes.get(fu, fu)}{hora}); "
                  f"BMP {tb:.2f} C ({pb:+.3f} C/min), BME {te:.2f} C ({pe:+.3f} C/min); ahora BMP {tba:.2f}, BME {tea:.2f} C; "
                  f"armar: {', '.join(v for k, v in armb.items() if arm & k) or 'sirve'}")

    # ---- Calibracion a bordo (cal_onboard, D-059) ----
    cals = [(r[3],) + struct.unpack('<IIIBBBB', r[4]) for r in recs if r[1] == T_CAL and len(r[4]) == 16]
    if cals:
        ev = {1: 'resultado listo', 2: 'aplicada por radio', 3: 'aplicada por USB', 4: 'vuelta a la anterior', 5: 'calibracion en uso al registrar', 6: 'error del analisis'}
        print()
        print(f"CALIBRACION A BORDO: {len(cals)} registros")
        for t, act, res, av, e, est, npos, ok in cals:
            print(f"  t={t / 1e6:.2f} s  {ev.get(e, e)}: activa {act:08X}" + (f", resultado {res:08X} ({'ok' if ok else 'con avisos 0x%08X' % av}, {npos} posiciones)" if res else ''))

    # ---- EKF a bordo (ekf_task, D-060) ----
    ekfs = [(r[3],) + struct.unpack(EKF_FMT, r[4]) for r in recs if r[1] == T_EKF and len(r[4]) == struct.calcsize(EKF_FMT)]
    if ekfs:
        fases = ['reposo', 'boost', 'coast', 'eyeccion', 'paracaidas', 'aterrizaje']
        u = ekfs[-1]
        dur = (ekfs[-1][0] - ekfs[0][0]) / 1e6
        print()
        print(f"EKF A BORDO: {len(ekfs)} estados en {dur:.1f} s ({len(ekfs) / max(dur, 1e-3):.1f} Hz)"
              f"{', calibrado' if u[-6] & 4 else ', SIN CALIBRAR'}{', con origen GNSS' if u[-6] & 2 else ', sin origen GNSS'}")
        print(f"  final: q={[round(v, 4) for v in u[1:5]]} p={[round(v, 2) for v in u[5:8]]} m v={[round(v, 3) for v in u[8:11]]} m/s altura={u[21]:.2f} m fase={fases[u[-7] % 6]}")
        print(f"  sesgo giro {[round(v, 3) for v in u[11:14]]} dps, acel {[round(1000 * v, 1) for v in u[14:17]]} mg, escala giro {[round(100 * v, 3) for v in u[17:20]]} %, BMP {u[20]:.2f} m")
        print(f"  1 sigma: actitud {[round(v, 2) for v in u[22:25]]} grados (z = guinada), posicion {[round(v, 2) for v in u[25:28]]} m, velocidad {[round(v, 3) for v in u[28:31]]} m/s")
        print(f"  medidas aceptadas: gnss {u[-5]}, baro {u[-4]}, mag {u[-3]}, gravedad {u[-2]}; rechazos {u[-1]} (contadores de 16 bits)")
        if a.csv:
            with open('ekf_abordo.csv', 'w') as f:
                f.write('t_us,qw,qx,qy,qz,pn_m,pe_m,pd_m,vn_mps,ve_mps,vd_mps,bgx_dps,bgy_dps,bgz_dps,bax_g,bay_g,baz_g,sgx,sgy,sgz,b_bmp_m,alt_baro_m,'
                        'sig_x_deg,sig_y_deg,sig_z_deg,sig_pn_m,sig_pe_m,sig_pd_m,sig_vn_mps,sig_ve_mps,sig_vd_mps,lat0,lon0,h0_m,fase,flags,gnss_ok,baro_ok,mag_ok,grav_ok,rechazos\n')
                for r in ekfs:
                    f.write(','.join(f'{v:.9g}' if isinstance(v, float) else str(v) for v in r) + '\n')

    # ---- Incidentes de SD y silencios ----
    no_sensor = (T_EVENT, T_FILEHDR, T_MISSION, T_PI, T_AMB, T_CAL, T_EKF)
    ts = sorted(r[3] for r in recs if r[1] not in no_sensor)
    t0 = ts[0] if ts else 0
    evs = [struct.unpack('<qIIhBB', r[4]) for r in recs if r[1] == T_EVENT and len(r[4]) == 20]
    nombres_ev = {1: 'escritura', 2: 'reabierto', 3: 'REAPERTURA FALLIDA'}
    if recs:
        print(f"\nSD: {len(evs)} incidentes")
    if evs:
        c = collections.Counter((('reserva' if e[4] else 'activo'), nombres_ev.get(e[5], e[5]), e[3]) for e in evs)
        print("  (archivo, tipo, errno): " + ", ".join(f"{k}: {v}" for k, v in sorted(c.items(), key=str)))
        for e in [e for e in evs if not e[4]][:10]:
            print(f"  ACTIVO t={(e[0] - t0) / 1e6:.2f} s  {nombres_ev.get(e[5], e[5])} errno={e[3]} pos={e[1]} duracion={e[2] / 1000:.1f} ms")
    sil = [(ta, tb - ta) for ta, tb in zip(ts, ts[1:]) if tb - ta > 100000]
    if recs:
        print(f"  silencios de mas de 100 ms en todos los sensores: {len(sil)}")
    for ta, d in sil[:10]:
        cerca = [e for e in evs if ta - 500000 <= e[0] <= ta + d + 500000]
        print(f"  t={(ta - t0) / 1e6:.2f} s  {d / 1000:.0f} ms  incidentes a menos de 0.5 s: {len(cerca)}")

    if a.csv:
        with open('pvt.csv', 'w') as f:
            f.write('t_rx_us,itow,utc_sec,nano,fix,nsv,lat,lon,h_m,hacc_m,tacc_ns\n')
            for t, d in pvt:
                f.write(f"{t},{d['itow']},{d['utc_sec']},{d['nano']},{d['fix']},{d['nsv']},{d['lat']:.7f},{d['lon']:.7f},{d['h']:.3f},{d['hacc']:.3f},{d['tacc']}\n")
        with open('pps.csv', 'w') as f:
            f.write('t_edge_us,utc_sec,used,fix,tacc_ns\n')
            for te, sec, u, fx, tc in pps:
                f.write(f"{te},{sec},{u},{fx},{tc}\n")
        with open('radio.csv', 'w') as f:
            f.write('t_fin_us,sentido,ranura,largo,rssi_dbm,snr_db,tarde_us,aire_us\n')
            for t, d, sl, ln, _, rs, sn, late, air in link:
                f.write(f"{t},{'TX' if d == 0 else 'RX'},{sl},{ln},{rs / 10},{sn / 10},{late},{air}\n")
        with open('sd.csv', 'w') as f:
            f.write('t_us,archivo,tipo,errno,posicion,duracion_us\n')
            for e in evs:
                f.write(f"{e[0]},{'reserva' if e[4] else 'activo'},{nombres_ev.get(e[5], e[5])},{e[3]},{e[1]},{e[2]}\n")
        with open('latidos.csv', 'w') as f:
            f.write('t_us,uptime_ms,descartes_0,descartes_1,descartes_2,descartes_3,escritura_max_us,flush_max_us,bytes,time_flags,reserva,reserva_pct\n')
            for r in hbs:
                up, d0, d1, d2, d3, wmax, fmax, nbytes, tf, ss, sp, _ = struct.unpack_from('<I4IIIIBBBB', r[4])
                f.write(f"{r[3]},{up},{d0},{d1},{d2},{d3},{wmax},{fmax},{nbytes},0x{tf:02X},{ss},{sp}\n")
        print(f"\nCSV en {carpeta}")

if __name__ == '__main__':
    main()
