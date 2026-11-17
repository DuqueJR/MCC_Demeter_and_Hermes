#!/usr/bin/env python3
"""vuelos_replay.py - Vuelos sinteticos para el banco de replay (T-304): archivos .BIN en el formato `rec` y su verdad en JSON.

Uso:  python vuelos_replay.py                        las 24 variantes de P-03 en estacion/vuelos_replay/
      python vuelos_replay.py --cohete demeter --eyeccion despues --ruido 3 --semillas 1
      python vuelos_replay.py --lista                solo lista las variantes, sin generar nada
      python vuelos_replay.py --ruido 0 --semillas 0 --salida /tmp/ref     referencia sin ruido (la de la aceptacion)

Entrada: la exportacion de OpenRocket de cada cohete (datos/simulaciones/openrocket/), leida y convertida por vuelo_sintetico.py (Pablo): la verdad
(trayectoria, actitud, fuerza especifica y giro en el cuerpo) y los sensores con sus ruidos. Aqui se agrega lo que ese modulo no hace:
  1. mover la carga de eyeccion respecto al apogeo (antes, en o despues);
  2. la presion como funcion de la altura (solo diferencias de altitud, perfiles_vuelo §3.4: la presion absoluta de la sim. no se usa);
  3. escribir los sensores como registros `rec` (formato_log.md, rec_format.h) en un .BIN y la verdad en un .json aparte.

Registros que escribe: FILEHDR, EXT_LSM (palabras del FIFO del LSM6DSO32: giro, acel., marca y el BMP581 por el hub), IMU (QMI8658), BAR (BME280),
MAG (QMC6309), EXT_MMC (MMC5983MA), PVT y PPS (GNSS) y HEARTBEAT. No escribe MISSION, LINK, PI, AMB ni CAL: el banco de replay los produce.
Los ejes de los chips coinciden con los del cuerpo (calibracion identidad, como vuelo_sintetico.py; vuelo_sintetico escribe la suya en calib_identidad.json).

SUPUESTOS (todos son parametros de linea de comandos; los marcados (P) los revisa el documentador):
  - Trayectoria. `antes` (la nominal de cada sim.) y `en` usan la trayectoria de OpenRocket tal cual (la sim. abre el paracaidas en el apogeo);
    solo cambia el instante de la carga: la de `antes` es la de la sim. (1,46 s antes del apogeo en Demeter, 0,45 s en Hermes) y la de `en` es el apogeo.
    `despues` (P: --despues-s, 1,5 s): hasta el apogeo la de la sim.; desde ahi caida balistica con el arrastre cuadratico ajustado a la inercia de la
    propia sim.; en la carga el paracaidas se abre en --apertura-s (P: 0,3 s) y se frena hasta la velocidad de descenso de la sim. La actitud entre el
    apogeo y la carga queda fija; el viento es la velocidad horizontal media de la sim. bajo el paracaidas.
  - Ruido (--ruido R): R multiplica el ruido aleatorio de TODOS los sensores y la vibracion del motor; los sesgos de los sensores no cambian.
  - Carga de eyeccion (P): choque axial de 25 g y 15 ms (media senoide) y pulso de presion de +300 Pa con tau de 0,15 s: los defaults de vuelo_sintetico.py.
  - Presion: p = p0 (1 - h/h_escala)^(1/0,190263), h_escala = (T + 273,15)/0,0065: la inversa exacta de la formula de ekf.py, con T la temperatura de
    la rampa de la sim. y p0 (P) la presion estandar a la altitud del sitio (--p-rampa-pa).
  - BME280: solo la presion y la temperatura compensadas; los conteos crudos (adc_*) y el BARCAL no se escriben (quedan en cero).
"""
import argparse, binascii, itertools, json, os, struct, sys, types
import numpy as np
from scipy.interpolate import PchipInterpolator, make_smoothing_spline

import tblog
import vuelo_sintetico as vs

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, 'vuelos_replay')

# --- Constantes: los mismos nombres y valores de constantes.md §5 y de rec_format.h / ext_lsm.cpp / in_imu.h ---
LSM_HZ = {'demeter': 1610.0, 'hermes': 1560.0}      # constantes.md §5 (la ranura de 600 us es el nominal de ext_lsm.cpp)
IMU_HZ, IMU_ACC_FS_G, IMU_GYR_FS_DPS = vs.QMI_HZ, 16, 1024
IMU_WTM, IMU_MAX_CHUNK = 16, 32                      # in_imu.h / in_imu.cpp
ACC_FS_G, GYR_FS_DPS = 32, 2000                      # ext_lsm.cpp
ACC_LSB_PER_G, GYR_LSB_PER_DPS = 1000.0 / 0.976, 1000.0 / 70.0
WTM_WORDS, MAX_CHUNK, TS_TICKS_PER_SLOT = 32, 64, 24
QMC_FS_GAUSS, MMC_COUNTS_PER_G = 8, 16384.0
ROCKET_ID = {'demeter': 1, 'hermes': 2}              # platformio.ini: -DROCKET_ID
NET_TX_DBM = 10                                      # constantes.md: 10 dBm en banco
MOTOR = {'demeter': 'H135W-8', 'hermes': 'G80-7T'}
PREFIJO = {'demeter': 'DEM', 'hermes': 'HER'}        # ekf.py elige la calibracion por este prefijo
COHETES, EYECCIONES = ('demeter', 'hermes'), ('antes', 'en', 'despues')
RUIDOS, SEMILLAS = (1.0, 3.0), (1, 2)                # P-03: ruido x1 y x3, dos semillas: 2 x 3 x 2 x 2 = 24 archivos

# rec_format.h
MAGIC, HDR_SIZE, CRC_SIZE, MAX_LEN = 0x5AA5, 14, 2, 512
S_IN_IMU, S_IN_MAG, S_IN_BAR, S_IN_GNSS, S_EX_IMU, S_EX_MAG, S_SYS = 0, 1, 2, 3, 6, 8, 15
IF_EST_OK = 2
TIPOS = {tblog.T_FILEHDR: 'FILEHDR', tblog.T_EXT_LSM: 'EXT_LSM', tblog.T_IMU: 'IMU', tblog.T_BAR: 'BAR', tblog.T_MAG: 'MAG',
         tblog.T_EXT_MMC: 'EXT_MMC', tblog.T_PVT: 'PVT', tblog.T_PPS: 'PPS', tblog.T_HB: 'HEARTBEAT'}

# (P) Parametros del generador que no estan en constantes.md: se pueden cambiar por linea de comandos
TS_CADA_RANURAS = 16        # una palabra de marca del chip cada tantas ranuras del LSM (el firmware solo revisa la primera de cada lote)
LECTURA_LSM_US, LECTURA_IMU_US = 350, 250   # read_us de los lotes
BME_MEDICION_US = 14000     # t_trig de BAR: el BME280 forzado con P x8 tarda unos 14 ms (hoja de datos, 9.1)
GRAD_T_KM = 6.5             # K/km: la temperatura del aire baja con la altura (atmosfera estandar)


# ----------------------------------------------------------------------------------------------------------------------------------------------
# Trayectoria: variantes de la eyeccion
# ----------------------------------------------------------------------------------------------------------------------------------------------

def suavizar_sim(s):
    """Copia de la sim. con la posicion horizontal sin el ruido de resolucion de la exportacion (1 mm).

    vuelo_sintetico.verdad deriva esa posicion para sacar la velocidad y la aceleracion horizontales; con nodos cada 2-4 ms el milimetro de
    resolucion se vuelve un ruido de hasta 31 g en la fuerza especifica de Hermes (comprobado). Un spline de suavizado (GCV) la deja
    a menos de 4 mm de la original y su derivada coincide con la velocidad horizontal de la propia sim. (mediana 5 mm/s).
    """
    s2 = dict(s)
    for k in ('e', 'n'):
        y = np.asarray(s[k], dtype=float)
        if np.ptp(y) > 1e-6:
            s2[k] = make_smoothing_spline(s['t'], y)(s['t'])
    return s2


def _horiz(s):
    return PchipInterpolator(s['t'], s['n']), PchipInterpolator(s['t'], s['e'])


def parametros_descenso(s):
    """De la propia sim.: arrastre cuadratico del tramo balistico (1/m), velocidad de descenso y viento horizontal bajo el paracaidas.

    Tramo balistico = de BURNOUT + 0,3 s a la carga (sin motor y sin paracaidas, la sim. lo abre en el apogeo):
    a_z + g = -k |v| v_z   (z hacia arriba), ajustado por minimos cuadrados.
    """
    ev, t = s['ev'], s['t']
    pn, pe = _horiz(s)
    m = (t >= ev['BURNOUT'] + 0.3) & (t <= ev['EJECTION_CHARGE'])
    vz = s['vz'][m]
    vh = np.hypot(pn.derivative()(t[m]), pe.derivative()(t[m]))
    x = -np.hypot(vz, vh) * vz
    y = np.gradient(vz, t[m]) + vs.G0
    k_bal = float(np.sum(x * y) / np.sum(x * x))
    a, b = ev['APOGEE'] + 10.0, ev['GROUND_HIT'] - 3.0
    w = (t >= a) & (t <= b)
    v_desc = float(-np.median(s['vz'][w]))
    ta, tb = a, b
    viento = np.array([(pn(tb) - pn(ta)) / (tb - ta), (pe(tb) - pe(ta)) / (tb - ta)])
    return dict(k_bal=k_bal, v_desc_ms=v_desc, viento_ne_ms=viento.tolist())


def variante_sim(s, eyeccion, despues_s=1.5, apertura_s=0.3):
    """Devuelve (s2, info): la sim. con la carga de eyeccion donde se pide. s no se modifica.

    antes: la sim. tal cual (la carga de la sim.). en: la sim. tal cual, con la carga en el apogeo.
    despues: hasta el apogeo, la sim.; luego caida balistica hasta la carga y paracaidas desde ahi (ver el docstring del modulo).
    """
    ev = dict(s['ev'])
    t_apo, t_ej_sim = ev['APOGEE'], ev['EJECTION_CHARGE']
    info = dict(eyeccion=eyeccion, t_ej_sim_s=t_ej_sim)
    if eyeccion == 'antes':
        info.update(t_ej_s=t_ej_sim, trayectoria='sim')
        return s, info
    if eyeccion == 'en':
        s2 = dict(s)
        ev['EJECTION_CHARGE'] = t_apo
        s2['ev'] = ev
        info.update(t_ej_s=t_apo, trayectoria='sim')
        return s2, info
    if eyeccion != 'despues':
        raise ValueError(f'eyeccion desconocida: {eyeccion}')
    par = parametros_descenso(s)
    t_ej = t_apo + despues_s
    k_par = vs.G0 / par['v_desc_ms'] ** 2 - par['k_bal']       # en equilibrio: (k_bal + k_par) v^2 = g
    pn, pe = _horiz(s)
    w = np.array(par['viento_ne_ms'])
    y = [float(pn(t_apo)), float(pe(t_apo)), float(PchipInterpolator(s['t'], s['alt'])(t_apo)),
         float(pn.derivative()(t_apo)), float(pe.derivative()(t_apo)), float(PchipInterpolator(s['t'], s['vz'])(t_apo))]

    def f(t, y):
        vr = np.array([y[3] - w[0], y[4] - w[1], y[5]])
        k = par['k_bal'] + (k_par * min(max((t - t_ej) / apertura_s, 0.0), 1.0) if t >= t_ej else 0.0)
        sp = float(np.linalg.norm(vr))
        return np.array([y[3], y[4], y[5], -k * sp * vr[0], -k * sp * vr[1], -vs.G0 - k * sp * vr[2]])

    h = 0.01
    T, Y = [t_apo], [np.array(y)]
    while Y[-1][2] > 0.0 and T[-1] < t_apo + 600.0:         # RK4 hasta tocar el suelo
        t0, y0 = T[-1], Y[-1]
        k1 = f(t0, y0); k2 = f(t0 + h / 2, y0 + h / 2 * k1); k3 = f(t0 + h / 2, y0 + h / 2 * k2); k4 = f(t0 + h, y0 + h * k3)
        Y.append(y0 + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4))
        T.append(t0 + h)
    T, Y = np.array(T), np.array(Y)
    f_ = Y[-2, 2] / (Y[-2, 2] - Y[-1, 2])                    # el ultimo nodo, exactamente en z = 0 (interpolacion lineal)
    T[-1], Y[-1] = T[-2] + f_ * h, Y[-2] + f_ * (Y[-1] - Y[-2])
    Y[-1, 2] = 0.0
    k = int(np.searchsorted(s['t'], t_apo, side='right'))   # nodos de la sim. hasta el apogeo (inclusive); el resto es el modelo
    kp = k - 1
    s2 = dict(s)
    s2['t'] = np.r_[s['t'][:k], T[1:]]
    s2['n'] = np.r_[s['n'][:k], Y[1:, 0]]
    s2['e'] = np.r_[s['e'][:k], Y[1:, 1]]
    s2['alt'] = np.r_[s['alt'][:k], Y[1:, 2]]
    s2['vz'] = np.r_[s['vz'][:k], Y[1:, 5]]
    for nombre in ('elev', 'az', 'p_mbar'):                  # actitud fija desde el apogeo; la presion de la sim. no se usa
        s2[nombre] = np.r_[s[nombre][:k], np.full(len(T) - 1, s[nombre][kp])]
    s2['empuje'] = np.r_[s['empuje'][:k], np.zeros(len(T) - 1)]
    ev['EJECTION_CHARGE'] = t_ej
    ev['RECOVERY_DEVICE_DEPLOYMENT'] = t_ej
    ev['GROUND_HIT'] = ev['SIMULATION_END'] = float(T[-1])
    s2['ev'] = ev
    info.update(t_ej_s=t_ej, trayectoria='sim hasta el apogeo, balistica y paracaidas despues', despues_s=despues_s, apertura_s=apertura_s,
                k_par=k_par, v_ej_ms=float(-np.interp(t_ej, T, Y[:, 5])), alt_ej_m=float(np.interp(t_ej, T, Y[:, 2])), **par)
    return s2, info


# ----------------------------------------------------------------------------------------------------------------------------------------------
# Senales de un vuelo
# ----------------------------------------------------------------------------------------------------------------------------------------------

def p_isa(h_m):
    """Presion estandar a la altitud h (m s.n.m.), Pa."""
    return 101325.0 * (1.0 - 2.25577e-5 * h_m) ** 5.25588


def presion_de_altura(alt_m, t_rampa_c, p0_pa):
    """Inversa exacta de la altura barometrica de ekf.py: h = (T + 273,15)/0,0065 * (1 - (p/p0)^0,190263)."""
    h_escala = (t_rampa_c + 273.15) / 0.0065
    return p0_pa * (1.0 - alt_m / h_escala) ** (1.0 / 0.190263)


def senales(cohete, eyeccion, ruido, semilla, a):
    """Corre vuelo_sintetico (verdad y sensores) sobre la variante. Devuelve dict(V, d, x, c, s, info, args)."""
    s0 = suavizar_sim(vs.leer_sim(cohete))
    s, info = variante_sim(s0, eyeccion, a.despues_s, a.apertura_s)
    args = types.SimpleNamespace(alabeo=a.alabeo, vibracion=a.vibracion, escala=a.escala, semilla=semilla, sin_mag=False, ruido=ruido,
                                 pad_s=a.reposo_antes, post_s=a.reposo_despues, lsm_hz=LSM_HZ[cohete], choque_g=a.choque_g, choque_s=a.choque_ms * 1e-3,
                                 pulso_pa=a.pulso_pa, pulso_tau=a.pulso_tau_s)
    V = vs.verdad(s, args)
    p0 = a.p_rampa_pa if a.p_rampa_pa else p_isa(s['h0'])
    V['p_pa'] = presion_de_altura(-V['p'][:, 2], s['temp'], p0)   # NED: z hacia abajo; la presion sale de la altura, no de la sim.
    d, x, c, sg = vs.sensores(s, V, args)
    info.update(p_rampa_pa=p0, t_rampa_c=s['temp'])
    return dict(V=V, d=d, x=x, c=c, s=s, info=info, args=args, sg=sg)


# ----------------------------------------------------------------------------------------------------------------------------------------------
# Registros `rec`
# ----------------------------------------------------------------------------------------------------------------------------------------------

def registro(tipo, src, t_us, payload):
    """Un registro: [A5 5A][len][type][src][t_us][payload][crc16 CCITT-FALSE], little-endian."""
    ln = HDR_SIZE + len(payload) + CRC_SIZE
    assert ln <= MAX_LEN, (tipo, ln)
    cuerpo = struct.pack('<HHBBq', MAGIC, ln, tipo, src, int(t_us)) + payload
    return cuerpo + struct.pack('<H', binascii.crc_hqx(cuerpo, 0xFFFF))


def i16(v, escala, lim=32767):
    return np.clip(np.rint(np.asarray(v) * escala), -lim - 1, lim).astype('<i2')


def palabras_lsm(d, x, V, lista, cohete, t_rampa_c):
    """EXT_LSM: la ristra de palabras del FIFO (giro, acel., marca cada TS_CADA_RANURAS y el BMP581 por el hub), en lotes de la marca de agua."""
    t = d['lsm_t']
    n = len(t)
    periodo = 1e6 / LSM_HZ[cohete]
    ga = np.empty((n, 14), np.uint8)
    ga[:, 0], ga[:, 7] = 0x01 << 3, 0x02 << 3                        # tag giro y tag acel.
    ga[:, 1:7] = i16(d['lsm_g'], GYR_LSB_PER_DPS).view(np.uint8).reshape(n, 6)
    ga[:, 8:14] = i16(d['lsm_a'], ACC_LSB_PER_G).view(np.uint8).reshape(n, 6)
    # BMP581 por el hub: la palabra va despues de la ranura que cierra su medicion
    bmp_t, bmp_p = x['bmp'][:, 0], x['bmp'][:, 1]
    alt = -np.interp(bmp_t, V['t_us'], V['p'][:, 2])
    bmp_c = temp_aire(alt, t_rampa_c)
    pw = np.rint(bmp_p * 64.0).astype(np.int64)
    tw = np.rint(bmp_c * 65536.0).astype(np.int64)
    hub = {}
    for j, k in enumerate(np.clip(np.searchsorted(t, bmp_t) - 1, 0, n - 1)):
        w = bytearray([0x0E << 3])
        w += (int(tw[j]) & 0xFFFFFF).to_bytes(3, 'little') + (int(pw[j]) & 0xFFFFFF).to_bytes(3, 'little')
        hub[int(k)] = bytes(w)
    partes, cuenta, k0 = [], 0, 0
    for k in range(n):
        b = ga[k].tobytes()
        if k % TS_CADA_RANURAS == 0:
            b += bytes([0x04 << 3]) + struct.pack('<I', (k * TS_TICKS_PER_SLOT) & 0xFFFFFFFF) + b'\0\0'
        b += hub.get(k, b'')
        partes.append(b)
        cuenta += len(b) // 7
        if cuenta >= WTM_WORDS or k == n - 1:                          # la marca de agua dispara la lectura del FIFO
            assert cuenta <= MAX_CHUNK, cuenta
            cab = struct.pack('<IHBBqfHH', k0, cuenta, IF_EST_OK, ACC_FS_G, int(round(t[k0])), periodo, LECTURA_LSM_US, GYR_FS_DPS)
            lista.append((int(round(t[k])), len(lista), tblog.T_EXT_LSM, S_EX_IMU, cab + b''.join(partes)))
            partes, cuenta, k0 = [], 0, k + 1


def temp_aire(alt_m, t_rampa_c):
    """Temperatura del aire a la altura dada: la de la rampa menos el gradiente estandar."""
    return t_rampa_c - GRAD_T_KM * 1e-3 * np.asarray(alt_m)


def lotes_imu(d, lista):
    """IMU: lotes de IMU_WTM muestras del QMI8658 (ax ay az gx gy gz, int16 del chip)."""
    t = d['qmi_t']
    n = len(t)
    raw = np.empty((n, 6), '<i2')
    raw[:, :3] = i16(d['qmi_a'], 32768.0 / IMU_ACC_FS_G)
    raw[:, 3:] = i16(d['qmi_g'], 32768.0 / IMU_GYR_FS_DPS)
    periodo = 1e6 / IMU_HZ
    for k0 in range(0, n, IMU_WTM):
        k1 = min(k0 + IMU_WTM, n)
        t_isr = int(round(t[k1 - 1]))
        cab = struct.pack('<IHBBqqdIHH', k0, k1 - k0, IF_EST_OK, IMU_ACC_FS_G, t_isr, int(round(t[k0])), periodo, 0, LECTURA_IMU_US, IMU_GYR_FS_DPS)
        lista.append((t_isr, len(lista), tblog.T_IMU, S_IN_IMU, cab + raw[k0:k1].tobytes()))


def lotes_bar(x, V, lista, t_rampa_c):
    """BAR: el BME280 compensado (presion y temperatura); los conteos crudos quedan en cero."""
    for t, p in x['bme']:
        alt = -float(np.interp(t, V['t_us'], V['p'][:, 2]))
        pl = struct.pack('<qIIHHfff', int(t) - BME_MEDICION_US, 0, 0, 0, 0, float(p), float(temp_aire(alt, t_rampa_c)), 50.0)
        lista.append((int(round(t)), len(lista), tblog.T_BAR, S_IN_BAR, pl))


def lotes_mag(d, lista):
    for t, bx, by, bz in d['qmc']:
        lista.append((int(round(t)), len(lista), tblog.T_MAG, S_IN_MAG,
                      struct.pack('<3hBB', *i16([bx, by, bz], 32000.0 / QMC_FS_GAUSS), 0, QMC_FS_GAUSS)))
    for t, bx, by, bz in d['mmc']:
        lista.append((int(round(t)), len(lista), tblog.T_EXT_MMC, S_EX_MAG,
                      struct.pack('<3iBB', *(int(np.rint(v * MMC_COUNTS_PER_G)) for v in (bx, by, bz)), 0, 0)))


def pvt_ubx(fila, nsv):
    """NAV-PVT de 92 B (UBX-NAV-PVT) con lo que leen tblog.decode_pvt y ekf.load_extra."""
    _, utc, fix, lat, lon, h, hacc, vacc, vn, ve, vd, sacc = fila
    sec = int(np.floor(utc))
    nano = int(round((utc - sec) * 1e9))
    dias, resto = divmod(sec, 86400)
    # fecha civil a partir de los dias desde 1970 (inversa de tblog.days_from_civil)
    z = dias + 719468
    era = z // 146097
    doe = z - era * 146097
    yoe = (doe - doe // 1460 + doe // 36524 - doe // 146096) // 365
    doy = doe - (365 * yoe + yoe // 4 - yoe // 100)
    mp = (5 * doy + 2) // 153
    dia, mes = doy - (153 * mp + 2) // 5 + 1, mp + (3 if mp < 10 else -9)
    anio = yoe + era * 400 + (mes <= 2)
    itow = int(round(utc * 1000.0)) % 604800000
    mm = lambda v: int(round(v * 1000.0))
    p = bytearray(92)
    struct.pack_into('<IH6B', p, 0, itow, anio, mes, dia, resto // 3600, resto // 60 % 60, resto % 60, 0x07)
    struct.pack_into('<Ii', p, 12, 50, nano)
    struct.pack_into('<4B', p, 20, int(fix), 0x01 if fix == 3 else 0x00, 0, int(nsv))
    struct.pack_into('<4i', p, 24, int(round(lon * 1e7)), int(round(lat * 1e7)), mm(h), mm(h))
    struct.pack_into('<II', p, 40, mm(hacc), mm(vacc))
    struct.pack_into('<3i', p, 48, mm(vn), mm(ve), mm(vd))
    struct.pack_into('<I', p, 68, mm(sacc))
    return bytes(p)


def lotes_gnss(x, lista):
    sv = x['sv']
    for fila, (_, nsv) in zip(x['pvt'], sv):
        lista.append((int(round(fila[0])), len(lista), tblog.T_PVT, S_IN_GNSS, pvt_ubx(fila, nsv)))
    for sec, te in x['pps']:
        lista.append((int(round(te)) + 1000, len(lista), tblog.T_PPS, S_IN_GNSS,
                      struct.pack('<qqBBHI', int(round(te)), int(round(sec)), 1, 3, 0, 50)))


def cabecera(cohete, t0_us, utc0):
    ph = struct.pack('<4sHHIIIq16s16s12sbBxx', b'TBLG', 3, ROCKET_ID[cohete], 0, 1, 0, int(round(utc0 * 1e6)),
                     b'SINT-T304', b'sintetico', b'T-304', NET_TX_DBM, 0)
    return (int(t0_us) - 1000, -1, tblog.T_FILEHDR, S_SYS, ph)


def escribir_bin(ruta, cohete, sen):
    """Arma todos los registros, los ordena por t_us (el orden del anillo de escritura) y los escribe. Devuelve el conteo por tipo."""
    d, x, V = sen['d'], sen['x'], sen['V']
    t_c = sen['info']['t_rampa_c']
    lista = []
    palabras_lsm(d, x, V, lista, cohete, t_c)
    lotes_imu(d, lista)
    lotes_bar(x, V, lista, t_c)
    lotes_mag(d, lista)
    lotes_gnss(x, lista)
    t_ini, t_fin = float(d['lsm_t'][0]), float(d['lsm_t'][-1])
    for k, t in enumerate(np.arange(np.ceil(t_ini / 1e6) * 1e6, t_fin, 1e6)):     # HEARTBEAT: uno por segundo, con los bytes ya escritos
        lista.append((int(t) + 5000, len(lista), tblog.T_HB, S_SYS, None))
    utc0 = vs.UTC0 + (t_ini - vs.T_LOCAL0_US) / 1e6
    lista.append(cabecera(cohete, t_ini, utc0))
    lista.sort(key=lambda r: (r[0], r[1]))
    cuenta, total = {}, 0
    with open(ruta, 'wb') as f:
        for t, _, tipo, src, pl in lista:
            if tipo == tblog.T_HB:
                pl = struct.pack('<I4IIIIBBBB', int(t // 1000), 0, 0, 0, 0, 0, 0, total, 0, 0, 0, 0)
            b = registro(tipo, src, t, pl)
            f.write(b)
            total += len(b)
            cuenta[tipo] = cuenta.get(tipo, 0) + 1
    return cuenta, total


# ----------------------------------------------------------------------------------------------------------------------------------------------
# Verdad
# ----------------------------------------------------------------------------------------------------------------------------------------------

def nombre_base(cohete, eyeccion, ruido, semilla):
    r = f'{ruido:g}'
    return f'{PREFIJO[cohete]}_SINT_{MOTOR[cohete]}_{eyeccion}_r{r}_s{semilla:02d}'


def verdad_json(cohete, eyeccion, ruido, semilla, sen, ruta_bin, cuenta, a):
    V, s, info, args = sen['V'], sen['s'], sen['info'], sen['args']
    ev = V['ev']
    t_des = ev['despegue']
    t_ign = a.reposo_antes * 1e6 + vs.T_LOCAL0_US          # t = 0 de la sim.
    us = lambda k: float(ev[k])
    evt = lambda k, nombre_sim: dict(t_us=us(k), t_vuelo_s=(us(k) - t_des) / 1e6, t_sim_s=float(s['ev'][nombre_sim]))
    apogeo = evt('apogeo', 'APOGEE')
    apogeo['alt_agl_m'] = float(np.max(-V['p'][:, 2]))
    j = int(np.argmax(-V['p'][:, 2]))
    apogeo['t_us_max_altura'] = float(V['t_us'][j])
    return dict(
        tarea='T-304', version=1, archivo_bin=os.path.basename(ruta_bin),
        cohete=cohete, rocket_id=ROCKET_ID[cohete], motor=MOTOR[cohete], sim=vs.SIM[cohete],
        variante=eyeccion, ruido=ruido, semilla=semilla,
        t_inicio_registro_us=float(V['t_us'][0]), t_despegue_us=t_des,
        eventos=dict(IGNITION=dict(t_us=t_ign, t_vuelo_s=(t_ign - t_des) / 1e6, t_sim_s=0.0, nota='t = 0 de la sim.: aqui empieza la fuerza; LIFTOFF es el evento de OpenRocket'),
                     LIFTOFF=evt('despegue', 'LIFTOFF'), BURNOUT=evt('burnout', 'BURNOUT'), EJECTION=evt('eyeccion', 'EJECTION_CHARGE'),
                     APOGEE=apogeo, PARACAIDAS_ABRE=evt('eyeccion', 'EJECTION_CHARGE'), GROUND_HIT=evt('suelo', 'GROUND_HIT')),
        eyeccion=dict(info, t_vs_apogeo_s=info['t_ej_s'] - float(s['ev']['APOGEE']), choque_g=args.choque_g, choque_ms=args.choque_s * 1e3,
                      pulso_pa=args.pulso_pa, pulso_tau_s=args.pulso_tau),
        parametros=dict(reposo_antes_s=a.reposo_antes, reposo_despues_s=a.reposo_despues, alabeo_dps=a.alabeo, vibracion_g=a.vibracion,
                        escala_giro_pct=a.escala, lsm_hz=LSM_HZ[cohete], imu_hz=IMU_HZ, bmp_hz=vs.BMP_HZ, bme_hz=vs.BME_HZ, mag_hz=vs.MAG_HZ,
                        g0_ms2=vs.G0, ruido_factor=ruido),
        registros={TIPOS.get(k, str(k)): v for k, v in sorted(cuenta.items())},
        marco_de_cuerpo='calibracion identidad: los ejes de los chips son los del cuerpo (X = nariz)')


def generar(cohete, eyeccion, ruido, semilla, a, salida):
    sen = senales(cohete, eyeccion, ruido, semilla, a)
    base = nombre_base(cohete, eyeccion, ruido, semilla)
    ruta = os.path.join(salida, base + '.BIN')
    cuenta, total = escribir_bin(ruta, cohete, sen)
    vj = verdad_json(cohete, eyeccion, ruido, semilla, sen, ruta, cuenta, a)
    vj['bytes'] = total
    with open(os.path.join(salida, base + '.verdad.json'), 'w', encoding='utf-8') as f:
        json.dump(vj, f, indent=1, ensure_ascii=False)
    with open(os.path.join(salida, 'calib_identidad.json'), 'w', encoding='utf-8') as f:
        json.dump(sen['c'], f, indent=1)
    return ruta, vj


def variantes(a):
    return list(itertools.product(a.cohete, a.eyeccion, a.ruido, a.semillas))


def parser():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--salida', default=SALIDA, help='carpeta de los .BIN y .verdad.json (defecto estacion/vuelos_replay/, no se versiona)')
    ap.add_argument('--cohete', nargs='+', choices=COHETES, default=list(COHETES))
    ap.add_argument('--eyeccion', nargs='+', choices=EYECCIONES, default=list(EYECCIONES))
    ap.add_argument('--ruido', nargs='+', type=float, default=list(RUIDOS), help='factor del ruido aleatorio (0 = sin ruido); defecto 1 3')
    ap.add_argument('--semillas', nargs='+', type=int, default=list(SEMILLAS))
    ap.add_argument('--despues-s', type=float, default=1.5, help='(P) eyeccion despues del apogeo: segundos de caida balistica antes de la carga')
    ap.add_argument('--apertura-s', type=float, default=0.3, help='(P) el paracaidas pasa de cerrado a abierto en este tiempo')
    ap.add_argument('--reposo-antes', type=float, default=10.0, help='(P) segundos quieto en la rampa antes del despegue')
    ap.add_argument('--reposo-despues', type=float, default=20.0, help='(P) segundos quieto en el suelo despues de caer')
    ap.add_argument('--choque-g', type=float, default=vs.EJ_CHOQUE_G, help='(P) choque axial de la carga de eyeccion, g (media senoide)')
    ap.add_argument('--choque-ms', type=float, default=vs.EJ_CHOQUE_S * 1e3, help='(P) duracion del choque, ms')
    ap.add_argument('--pulso-pa', type=float, default=vs.EJ_PULSO_PA, help='(P) pulso de presion de la carga, Pa')
    ap.add_argument('--pulso-tau-s', type=float, default=vs.EJ_PULSO_TAU, help='(P) constante de tiempo del pulso, s')
    ap.add_argument('--p-rampa-pa', type=float, default=None, help='(P) presion en la rampa; defecto: la estandar a la altitud del sitio')
    ap.add_argument('--alabeo', type=float, default=200.0, help='(P) giro maximo sobre el eje, dps (el de vuelo_sintetico)')
    ap.add_argument('--vibracion', type=float, default=1.0, help='(P) vibracion del motor, g de sigma (el de vuelo_sintetico)')
    ap.add_argument('--escala', default='0.75,0,1.5', help='(P) factor de escala real del giro en %% (el de vuelo_sintetico)')
    ap.add_argument('--lista', action='store_true', help='solo muestra las variantes')
    return ap


def main(argv=None):
    a = parser().parse_args(argv)
    todas = variantes(a)
    print(f'{len(todas)} variantes -> {a.salida}')
    if a.lista:
        for v in todas:
            print('  ', nombre_base(v[0], v[1], v[2], v[3]))
        return 0
    os.makedirs(a.salida, exist_ok=True)
    for i, (cohete, eyeccion, ruido, semilla) in enumerate(todas, 1):
        ruta, vj = generar(cohete, eyeccion, ruido, semilla, a, a.salida)
        e = vj['eventos']
        print(f'[{i:2d}/{len(todas)}] {os.path.basename(ruta)}  {vj["bytes"] / 1e6:.1f} MB  carga {vj["eyeccion"]["t_vs_apogeo_s"]:+.2f} s del apogeo  '
              f'apogeo {e["APOGEE"]["alt_agl_m"]:.1f} m a {e["APOGEE"]["t_vuelo_s"]:.3f} s', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
