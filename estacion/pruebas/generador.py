"""Genera lineas de la estacion de tierra (`@T`, `@L`, `@G`, `[time]`, `[cmd ]`) con `struct`, a partir de un perfil.

El perfil es el de la simulacion de OpenRocket de Demeter (`datos/simulaciones/openrocket/`, leido con
`tools/web_datos`), o uno sintetico simple (rampa -> boost -> apogeo -> descenso). Respeta el TDMA de
`net_proto.h` (`slotIsTx`): cada cohete solo emite en sus ranuras, a 2 Hz en tierra y a 10 Hz en vuelo, y
`perdidas` permite quitar paquetes para probar `perdidos_pct_10s`.
"""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
for ruta in (os.path.join(RAIZ, 'estacion'), RAIZ):
    if ruta not in sys.path:
        sys.path.insert(0, ruta)

import web1  # noqa: E402

SIM_DEMETER = os.path.join(RAIZ, 'datos', 'simulaciones', 'openrocket', 'demeter_H135W-8_santa-fe-antioquia_sim2.csv')
UTC0_MS = 1793980800000          # multiplo de 40 ms (la ranura 0 de un segundo)
AIRE_S = 0.045                   # del inicio de la ranura a la llegada al PC
ESTACION = (6.5790, -75.8150, 505.0)   # la estacion, a ~1,3 km de la rampa (SITIO 6,582 -75,823)


def crc16(datos):
    """CRC-16/CCITT-FALSE (net_proto)."""
    crc = 0xFFFF
    for b in datos:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def telem(rid, utc_ms, lat, lon, alt_msl_m, vn, ve, vu, state, moment, fix=3, nsv=14, vbat=4000, flags=0,
          mission=0, quat=(32767, 0, 0, 0), acc_mg=(0, 0, 1000), ack=0, actuators=0):
    """Los 64 B de un TELEM. `vu` es la velocidad hacia arriba, m/s (el paquete lleva `vd`, hacia abajo, en cm/s)."""
    cuerpo = web1.TELEM.pack(1, rid, mission, utc_ms, round(lat * 1e7), round(lon * 1e7), round(alt_msl_m * 100),
                             round(vn * 100), round(ve * 100), round(-vu * 100), *quat, *acc_mg, 0, 0, 0, fix, nsv, vbat,
                             25, 0, state | (moment << 4), flags, actuators, 4, ack, 0)
    return cuerpo[:-2] + crc16(cuerpo[:-2]).to_bytes(2, 'little')


def linea_t(rid, rssi=-80.0, snr=7.5, **kw):
    return f'@T {rssi:.1f} {snr:.1f} {telem(rid, **kw).hex()}'


def linea_l(rid, rec=0, spare_state=2, spare_pct=100, nombre=b'', elapsed=0):
    cuerpo = web1.LOGINFO.pack(5, rid, rec, 0, spare_state, spare_pct, nombre, elapsed, 0, 0, 0)
    return '@L ' + (cuerpo[:-2] + crc16(cuerpo[:-2]).to_bytes(2, 'little')).hex()


def linea_time(lat, lon, alt, n=60):
    return f'[time] q=0 err=0.4 us deriva=+0.10 ppm UTC=15:00:00 anclas=120 sin_flanco=0 | pos({n})={lat:.7f} {lon:.7f} {alt:.1f} m'


def perfil_demeter(factor_descenso=1.0):
    """El Perfil de la simulacion de Demeter; con `factor_descenso` > 1 la bajada se acelera (alarma de descenso)."""
    from pathlib import Path
    from tools.web_datos.openrocket import leer_csv
    from tools.web_datos.perfil import desde_openrocket
    p = desde_openrocket(leer_csv(Path(SIM_DEMETER)))
    if factor_descenso != 1.0:
        p = p.acelerar_descenso(factor_descenso, p.eventos['APOGEE'])
    return p


def momento(t, ev):
    """(estado, momento) segun el tiempo de simulacion `t` (s) y los eventos de OpenRocket (aproximado a la maquina de Pablo)."""
    if t < -15.0:
        return web1.S_TIERRA, 0
    if t < -3.0:
        return web1.S_ARMED, 0
    if t < ev['LIFTOFF']:
        return web1.S_FLY, web1.M_LAUNCH
    if t < ev['BURNOUT']:
        return web1.S_FLY, web1.M_BOOST
    if t < ev['APOGEE']:
        return web1.S_FLY, web1.M_COAST
    if t < ev['APOGEE'] + 0.5:
        return web1.S_FLY, web1.M_APOGEO
    if t < ev['GROUND_HIT']:
        return web1.S_FLY, web1.M_PARACAIDAS
    if t < ev['GROUND_HIT'] + 2.0:
        return web1.S_FLY, web1.M_ATERRIZAJE
    return web1.S_RECOVERY, web1.M_ATERRIZAJE


def actuators_demeter(estado, momento):
    """`TELEM.actuators` de Demeter con la Pi sana: READY en tierra, ARMED al armar, RECORDING en vuelo y COMPLETE al final
    (los bits 8-15 son el `StatusCode`; sin buzzer ni pulso ni error)."""
    if estado == web1.S_TIERRA:
        codigo = 0x02
    elif estado == web1.S_ARMED or (estado == web1.S_FLY and momento < web1.M_BOOST):
        codigo = 0x03
    elif estado == web1.S_FLY:
        codigo = 0x30
    else:
        codigo = 0x07
    return codigo << 8


def vuelo(perfil=None, rid=1, t_ini=-30.0, t_fin=None, perdidas=(), fix_perdido=(None, None), mission=0, rssi=-80.0, vbat=4000,
          fix_desde=-30.0, alt_base_m=web1.SITIO_ALT_MSL_M, actuators=0):
    """Lista de (t_local, linea) de la estacion, ordenada, del vuelo del perfil.

    - `alt_base_m`: la altitud sobre el nivel del mar de la rampa (por defecto la del SITIO); la altura del TELEM es
      `alt_base_m + alt` del perfil.
    - `actuators`: el valor de `TELEM.actuators` de todos los paquetes, o una funcion `(estado, momento) -> valor`
      (por ejemplo `actuators_demeter`).
    - `perdidas`: tiempos de simulacion `(desde, hasta)` en los que no llega ningun paquete del cohete.
    - `fix_perdido`: `(desde, hasta)`: el GNSS del cohete pierde el fix (fix=0) en ese rango.
    - Cada segundo: `@G 1` y la posicion de la estacion en `[time]`. Cada 5 s, un `@L`.
    """
    perfil = perfil or perfil_demeter()
    t_fin = perfil.t_fin + 15.0 if t_fin is None else t_fin
    ev = perfil.eventos
    out = []
    abs0 = UTC0_MS // 40
    a = abs0
    while True:
        t = t_ini + (a - abs0) * 0.04
        if t > t_fin:
            break
        s = a % 25
        st, mo = momento(t, ev)
        vuela = st == web1.S_FLY and mo >= web1.M_BOOST and mo <= web1.M_PARACAIDAS
        if web1.slot_is_tx(rid, s, vuela) and not any(d <= t < h for d, h in perdidas):
            x = perfil.en(max(t, 0.0))
            lat, lon = web1.desplazar_latlon(web1.SITIO_LAT, web1.SITIO_LON, x['e'], x['n'])
            fix = 0 if (fix_perdido[0] is not None and fix_perdido[0] <= t < fix_perdido[1]) else (3 if t >= fix_desde else 0)
            out.append((UTC0_MS / 1000 + (a - abs0) * 0.04 + AIRE_S,
                        linea_t(rid, rssi=rssi, utc_ms=a * 40, lat=lat, lon=lon, alt_msl_m=alt_base_m + x['alt'],
                                vn=x['vn'], ve=x['ve'], vu=x['vz'], state=st, moment=mo, fix=fix, vbat=vbat,
                                actuators=actuators(st, mo) if callable(actuators) else actuators,
                                flags=web1.TF_FLYING if vuela else 0, mission=mission,
                                acc_mg=(0, 0, round(1000 * (1 + x['aup'] / 9.80665))))))
        a += 1
    t_a, t_b = out[0][0], out[-1][0]
    seg = int(t_a)
    while seg <= t_b:
        out.append((seg + 0.30, '@G 1'))
        out.append((seg + 0.31, linea_time(*ESTACION)))
        if seg % 5 == 0:
            out.append((seg + 0.20, linea_l(rid)))
        seg += 1
    out.sort(key=lambda x: x[0])
    return out


def sesion_texto(lineas):
    """El archivo de sesion de dashboard.py: `<epoch con 3 decimales> <linea>`."""
    return ''.join(f'{t:.3f} {linea}\n' for t, linea in lineas)
