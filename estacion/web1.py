#!/usr/bin/env python3
"""web1.py - Traduce lo que sale por USB de la estacion de tierra a mensajes `web-1` (T-661).

Solo biblioteca estandar. No abre puertos ni sirve HTTP: recibe lineas de texto, una por una,
con la hora local de llegada, y devuelve los mensajes `web-1` que correspondan, como dicts
`{"tipo": ..., "mision": ..., "datos": {...}}` (el mismo formato de `POST /api/v1/ingesta`).

Contratos que cumple (no se cambian desde aqui):
- docs/04_diseno/protocolo_paquetes.md  §2 a §6 (TELEM, LogInfo, lineas `@T/@L/@G`, texto `[cmd ]`
  y `[time]`, y la tabla de correspondencia con `web-1` de §6);
- docs/04_diseno/maquina_estados.md §5 (de `state`/`moment` a `fase`);
- docs/08_gui/05_contrato_datos_web.md (`web-1`) y gui/web/src/contrato/esquema.json.

Uso como libreria (lo que hara dashboard.py en T-662; NO esta integrado todavia):

    from web1 import Traductor
    tr = Traductor()                       # modo="vivo"
    # en el hilo que lee el puerto de tierra, por cada linea recibida:
    for msg in tr.procesar(linea, time.time()):
        ...                                # msg = {"tipo", "mision", "datos"}
    # cuando el operador escribe un comando en el dashboard (opcional, mejora el Go/No-Go):
    tr.comando("d armar", time.time())
    # al menos una vez por segundo, aunque no llegue nada (latido de la estacion):
    for msg in tr.tick(time.time()): ...
    # la API local /api/v1/{mision}/snapshot:
    tr.snapshot("demeter", time.time())

Reproceso de una sesion guardada por dashboard.py (lineas `<epoch con 3 decimales> <linea>`):

    python estacion/web1.py sesiones/20261108_101500_tierra.txt --salida web1.jsonl
"""
import argparse
import collections
import json
import math
import re
import struct
import sys
import time

# ---------------------------------------------------------------------------
# Constantes. Los nombres son los de docs/02_requisitos/constantes.md y net_proto.h;
# si un valor cambia, se cambia primero alli.
# ---------------------------------------------------------------------------
SITIO_LAT = 6.582                 # SITIO: Santa Fe de Antioquia
SITIO_LON = -75.823
SITIO_ALT_MSL_M = 510.0
ALARMA_DESCENSO_MS = 10.0         # se evalua solo en DESCENT (= momento PARACAIDAS)
BAT_PCT_VMIN_MV = 3300            # (P) para pasar vbat_mv a bat_pct
BAT_PCT_VMAX_MV = 4200            # (P)
WEB_SERIE_MAX_PUNTOS = 2000       # (P) maximo de puntos de la `serie` del snapshot
SLOT_US = 40000                   # ranura TDMA de 40 ms
SLOTS_PER_S = 25
VBAT_ARM_MV = 3700                # vbat_arm_mv de mission_config.h (P): umbral de bateria para armar
CONTRATO_VERSION = "web-1"
PROTO_VERSION = 4                 # net_proto (D-047)
WGS84_A_M = 6378137.0
WGS84_F = 1.0 / 298.257223563

# net_proto.h
DEMETER, HERMES = 1, 2
P_TELEM, P_LOG_INFO = 1, 5
TF_FLYING, TF_BOOST_SIN_ARMAR = 1, 2
MAX_GAP_SLOTS = SLOTS_PER_S * 60  # gnd_rx.cpp: un salto mayor es un reinicio, no perdidas

# Parametros propios de este modulo, todos provisionales (P): no estan en constantes.md.
ENLACE_VENTANA_S = 10.0           # ventana de `perdidos_pct_10s`
ELIPSE_INCERT_FRAC = 0.30         # (P) semieje mayor (a lo largo de la deriva) = 30 % de la deriva
ELIPSE_TRANSV_FRAC = 0.5          # (P) el semieje menor es la mitad del mayor
ELIPSE_SEMIEJE_MIN_M = 20.0       # (P) minimo de cada semieje
DESCENSO_VZ_MIN_MS = 0.1          # (P) por debajo de esta bajada no hay tiempo restante util
LATIDO_S = 1.0                    # `salud` y `estacion` a 1 Hz
CMD_VIGENCIA_S = 30.0             # un comando escrito vale para atribuir la respuesta
SERIE_MAX_RETENIDOS = 200_000     # (P) puntos que se guardan en memoria por mision

MISIONES = {DEMETER: "demeter", HERMES: "hermes"}
NODO = {"demeter": DEMETER, "hermes": HERMES}

# Formatos de dashboard.py (TELEM de 64 B, LogInfo de 54 B). Se repiten aqui porque dashboard.py
# importara este modulo en T-662 (un import circular); las pruebas comprueban que son iguales.
TELEM = struct.Struct('<BBHQiiihhh4h3h3hBBH2bBBHBBH')
LOGINFO = struct.Struct('<BBBBBB34sIIIH')
STATES = ['-', 'TIERRA', 'ARMED', 'FLY', 'RECOVERY']
MOMENTS = ['-', 'LAUNCH', 'BOOST', 'COAST', 'APOGEO', 'CAIDA', 'PARACAIDAS', 'ATERRIZAJE']
M_LAUNCH, M_BOOST, M_COAST, M_APOGEO, M_CAIDA, M_PARACAIDAS, M_ATERRIZAJE = 1, 2, 3, 4, 5, 6, 7
S_TIERRA, S_ARMED, S_FLY, S_RECOVERY = 1, 2, 3, 4

# maquina_estados.md §1 y §5
FASES = ("BOOT", "PREFLIGHT", "ARMED", "BOOST", "COAST", "APOGEE", "FREE_FALL", "DESCENT", "LANDED", "ERROR")
FASE_COD = {n: i for i, n in enumerate(FASES)}
_FASE_FLY = {0: "ARMED", M_LAUNCH: "ARMED", M_BOOST: "BOOST", M_COAST: "COAST", M_APOGEO: "APOGEE",
             M_CAIDA: "FREE_FALL", M_PARACAIDAS: "DESCENT", M_ATERRIZAJE: "LANDED"}
FASES_VUELO = ("BOOST", "COAST", "APOGEE", "FREE_FALL", "DESCENT")   # la serie conserva toda la resolucion aqui

# Motivos de una respuesta (`reasonText` de net_proto.h, tal como los imprime la estacion, sin tildes).
# (id, texto exacto). El orden es el del bit.
MOTIVOS = (
    ("transicion", "esa transicion no existe desde el estado actual"),
    ("reserva", "reserva incompleta"),
    ("sd", "la SD no esta registrando"),
    ("lsm", "LSM6DSO32 sin datos"),
    ("bmp", "BMP581 sin datos"),
    ("gnss", "sin fix 3D del GNSS"),
    ("bateria", "bateria baja"),
    ("subiendo", "altura aumentando"),
    ("bajando", "altura disminuyendo"),
    ("movimiento", "aceleracion distinta de 1 g: el cohete se mueve"),
    ("en_vuelo", "en vuelo: ya hubo BOOST"),
    ("sin_aterrizaje", "sin aterrizaje detectado"),
    ("sin_boost", "sin BOOST detectado"),
    ("no_armado", "el cohete no esta armado"),
    ("sin_vuelo", "no ha habido vuelo"),
    ("ya_esta", "ya esta en ese estado"),
    ("iman", "hay un iman presente: despertaria al instante"),
    ("recovery", "RECOVERY: aun sin bateria baja, el cohete debe seguir transmitiendo"),
    ("confirmacion", "confirmacion invalida o vencida"),
    ("contador", "contador antiguo"),
    ("comando", "comando desconocido"),
)
_MOTIVO_ID = {texto: id_ for id_, texto in MOTIVOS}
# Las condiciones del "listo para armar" (maquina_estados §2, `armar`) y su nombre en positivo.
CONDICIONES_ARM = (
    ("reserva", "Reserva de la SD completa"),
    ("sd", "SD registrando"),
    ("lsm", "LSM6DSO32 con datos"),
    ("bmp", "BMP581 con datos"),
    ("gnss", "Fix 3D del GNSS"),
    ("bateria", "Bateria suficiente"),
    ("movimiento", "Cohete quieto (1 g)"),
    ("subiendo", "Altura estable (no sube)"),
    ("bajando", "Altura estable (no baja)"),
)
_IDS_ARM = frozenset(i for i, _ in CONDICIONES_ARM)
_IDS_SENSOR = frozenset(("lsm", "bmp"))

_RE_CMD = re.compile(r'^\[cmd \]\s*(Demeter|Hermes):\s*(EJECUTADO|NO APTO|APTO|ERROR)\b(.*)$')
_RE_CMD_MOTIVO = re.compile(r'^\[cmd \]\s+-\s+(.*?)\s*$')
_RE_ESTADO = re.compile(r'estado=(\S+)')
_RE_POS = re.compile(r'pos\((\d+)\)=(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) m')
_RE_ORDEN = re.compile(r'^\s*([dh])\s+(\w+)', re.IGNORECASE)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
def redondear(x, n):
    """Redondea a `n` decimales y evita el -0.0."""
    return round(float(x), n) + 0.0


def fase_de(state, moment):
    """maquina_estados.md §5: (state, moment) -> nombre de `fase` web-1."""
    if state == 0:
        return "BOOT"
    if state == S_TIERRA:
        return "PREFLIGHT"
    if state == S_ARMED:
        return "ARMED"
    if state == S_FLY:
        return _FASE_FLY.get(moment, "ARMED")
    if state == S_RECOVERY:
        return "LANDED"
    return "ERROR"                      # estado desconocido: ERROR (9) no lo usa el firmware


def _ecef(lat, lon, h):
    e2 = WGS84_F * (2.0 - WGS84_F)
    la, lo = math.radians(lat), math.radians(lon)
    s = math.sin(la)
    n = WGS84_A_M / math.sqrt(1.0 - e2 * s * s)
    return ((n + h) * math.cos(la) * math.cos(lo), (n + h) * math.cos(la) * math.sin(lo), (n * (1.0 - e2) + h) * s)


def enu_wgs84(lat0, lon0, h0, lat, lon, h):
    """Posicion (lat, lon, h) vista desde (lat0, lon0, h0) en el elipsoide WGS84: (este, norte, arriba) en m."""
    x0, y0, z0 = _ecef(lat0, lon0, h0)
    x, y, z = _ecef(lat, lon, h)
    dx, dy, dz = x - x0, y - y0, z - z0
    la, lo = math.radians(lat0), math.radians(lon0)
    e = -math.sin(lo) * dx + math.cos(lo) * dy
    n = -math.sin(la) * math.cos(lo) * dx - math.sin(la) * math.sin(lo) * dy + math.cos(la) * dz
    u = math.cos(la) * math.cos(lo) * dx + math.cos(la) * math.sin(lo) * dy + math.sin(la) * dz
    return e, n, u


def desplazar_latlon(lat0, lon0, este_m, norte_m):
    """Mueve (lat0, lon0) este_m al este y norte_m al norte, con los radios de curvatura del WGS84."""
    e2 = WGS84_F * (2.0 - WGS84_F)
    s = math.sin(math.radians(lat0))
    w = math.sqrt(1.0 - e2 * s * s)
    rm = WGS84_A_M * (1.0 - e2) / (w ** 3)
    rn = WGS84_A_M / w
    return (lat0 + math.degrees(norte_m / rm), lon0 + math.degrees(este_m / (rn * math.cos(math.radians(lat0)))))


def slot_owner(s):
    p = s % 5
    return 0 if p == 0 else (DEMETER if p in (1, 3) else HERMES)


def slot_is_base(s):
    return s in (1, 13, 2, 14)


def slot_is_tx(rocket, s, flying):
    """net_proto.h: slotIsTx."""
    return slot_owner(s) == rocket and (flying or slot_is_base(s))


def decimar_indices(puntos_vuelo, limite):
    """Indices que se conservan: toda la resolucion en vuelo; la espera en tierra se decima.
    `puntos_vuelo` es una lista de bool (True = punto en vuelo). Siempre incluye el ultimo punto."""
    n = len(puntos_vuelo)
    if n <= limite:
        return list(range(n))

    def uniforme(idx, k):
        if k >= len(idx):
            return list(idx)
        if k <= 0:
            return []
        if k == 1:
            return [idx[-1]]
        return [idx[round(j * (len(idx) - 1) / (k - 1))] for j in range(k)]

    vuelo = [i for i, v in enumerate(puntos_vuelo) if v]
    tierra = [i for i, v in enumerate(puntos_vuelo) if not v]
    cupo = limite - len(vuelo)
    if cupo >= 2:
        elegidos = set(vuelo) | set(uniforme(tierra, cupo))
    else:                                # solo el vuelo ya no cabe: se decima parejo
        elegidos = set(uniforme(list(range(n)), limite))
    return sorted(elegidos)


# ---------------------------------------------------------------------------
# Estado por mision
# ---------------------------------------------------------------------------
class _Cohete:
    def __init__(self, rid):
        self.rid = rid
        self.mision = MISIONES[rid]
        self.reiniciar(None)
        self.meta = None
        self.telem = None             # ultimo TELEM (dict)
        self.t_telem = None           # hora local de ese TELEM
        self.rssi = None
        self.snr = None
        self.logi = None              # ultimo LogInfo
        self.estado = None            # ultimo mensaje `estado` (datos)
        self.salud_sucia = False
        self.t_salud = None
        self.cmd_abierto = None       # respuesta [cmd ] cuyos motivos aun pueden llegar
        self.arm = None               # {"resultado", "motivos"} de la ultima respuesta a un ARM
        self.arm_pendiente = False    # un ARM apto/no apto espera su confirmacion
        self.ultimo_comando = None    # (op, t_local) del ultimo comando escrito

    def reiniciar(self, mission_id):
        """Lo que depende de la mision (se borra cuando cambia `mission_id`)."""
        self.mission_id = mission_id
        self.prev = None              # (state, moment, fase)
        self.t0_ms = None             # t_ms del despegue
        self.aterrizaje_emitido = False
        self.lkp = None
        self.eventos = []
        self.serie = collections.deque(maxlen=SERIE_MAX_RETENIDOS)   # (t_ms, lat, lon, alt, vz, ax, ay, az, en_vuelo)
        self.seq_local = -1
        self.utc_ref = None           # (utc_ms, t_local) del ultimo TELEM con hora
        self.alt_max = None
        self.alarma = False
        self.alarma_prev = False
        self.vz_alarma = None
        self.lastAbs = 0
        self.enlace = collections.deque()   # (t_local, esperados, perdidos)


class Traductor:
    """Convierte las lineas de la estacion en mensajes web-1.

    Los metodos devuelven listas de dicts `{"tipo", "mision", "datos"}`. No es seguro entre hilos:
    quien lo use desde varios (dashboard.py, T-662) debe proteger las llamadas con un candado.
    """

    def __init__(self, modo="vivo", sitio=(SITIO_LAT, SITIO_LON, SITIO_ALT_MSL_M)):
        self.modo = modo
        self.sitio = sitio
        self.cohetes = {rid: _Cohete(rid) for rid in MISIONES}
        self.gnss_ok = False
        self.pos_estacion = None      # (lat, lon, alt_msl_m): la ultima del texto `[time] ... pos(n)=`
        self.t_estacion = None
        self.t_ultimo = None

    # -- entrada ------------------------------------------------------------
    def procesar(self, linea, t_local):
        """Una linea de la estacion de tierra (sin el salto de linea) y su hora local (s, epoch)."""
        linea = linea.rstrip('\r\n')
        self.t_ultimo = t_local
        out = []
        if linea.startswith('@T '):
            out += self._telem(linea, t_local)
        elif linea.startswith('@L '):
            self._loginfo(linea)
        elif linea.startswith('@G '):
            self.gnss_ok = linea[3:].strip() == '1'
        elif linea.startswith('[cmd ]'):
            self._cmd(linea, t_local)
        elif linea.startswith('[time]'):
            self._tiempo(linea)
        return out + self.tick(t_local)

    def comando(self, linea, t_local):
        """Opcional: el comando que el operador escribio (`d armar`, `h launch`...). Sirve para atribuir
        las respuestas `[cmd ]` (que no dicen su orden) al ARM. Sin esto, se usa la respuesta misma."""
        m = _RE_ORDEN.match(linea)
        if m:
            rid = DEMETER if m.group(1).lower() == 'd' else HERMES
            self.cohetes[rid].ultimo_comando = (m.group(2).lower(), t_local)

    def tick(self, t_local):
        """Los latidos a 1 Hz: `salud` por mision (si hay algo nuevo) y `estacion` (siempre)."""
        self.t_ultimo = t_local
        out = []
        for c in self.cohetes.values():
            if c.salud_sucia and c.telem is not None and (c.t_salud is None or t_local - c.t_salud >= LATIDO_S):
                c.t_salud = t_local
                c.salud_sucia = False
                out.append(self._msg("salud", c, self._salud(c, t_local)))
        if self.t_estacion is None or t_local - self.t_estacion >= LATIDO_S:
            self.t_estacion = t_local
            for c in self.cohetes.values():
                out.append(self._msg("estacion", c, self._estacion(c, t_local)))
        return out

    # -- lineas de maquina ---------------------------------------------------
    def _telem(self, linea, t_local):
        p = linea.split(' ')
        if len(p) != 4:
            return []
        try:
            rssi, snr = float(p[1]), float(p[2])
            f = TELEM.unpack(bytes.fromhex(p[3]))
        except (ValueError, struct.error):
            return []
        if f[0] != P_TELEM or f[1] not in MISIONES:
            return []
        t = dict(rid=f[1], mission=f[2], utc_ms=f[3], lat_e7=f[4], lon_e7=f[5], alt_cm=f[6], vn=f[7], ve=f[8], vd=f[9],
                 quat=f[10:14], acc=f[14:17], gyro=f[17:20], fix=f[20], nsv=f[21], vbat=f[22], temp=f[23:25],
                 state=f[25] & 15, moment=f[25] >> 4, flags=f[26], actuators=f[27], time_flags=f[28], ack=f[29])
        c = self.cohetes[t['rid']]
        out = []
        if c.meta is None or c.mission_id != t['mission']:
            c.reiniciar(t['mission'])
            c.meta = self._meta(c)
            out.append(self._msg("meta", c, c.meta))
        c.telem, c.t_telem, c.rssi, c.snr = t, t_local, rssi, snr
        c.salud_sucia = True
        e = self._estado(c, t, t_local)
        c.estado = e
        out.append(self._msg("estado", c, e))
        out += [self._msg("evento", c, ev) for ev in self._eventos(c, t, e)]
        return out

    def _loginfo(self, linea):
        try:
            f = LOGINFO.unpack(bytes.fromhex(linea[3:].strip()))
        except (ValueError, struct.error):
            return
        if f[0] != P_LOG_INFO or f[1] not in MISIONES:
            return
        c = self.cohetes[f[1]]
        c.logi = dict(rec=f[2], pct=f[3], spare_state=f[4], spare_pct=f[5], name=f[6].split(b'\0')[0].decode(errors='replace'),
                      elapsed=f[7], pos=f[8], remain=f[9])
        c.salud_sucia = True

    def _tiempo(self, linea):
        m = _RE_POS.search(linea)
        if m and int(m.group(1)) > 0:
            self.pos_estacion = (float(m.group(2)), float(m.group(3)), float(m.group(4)))

    # -- go / no-go: las respuestas [cmd ] -------------------------------------
    def _cmd(self, linea, t_local):
        m = _RE_CMD.match(linea)
        if m:
            for c in self.cohetes.values():
                self._cerrar_cmd(c)
            c = self.cohetes[DEMETER if m.group(1) == 'Demeter' else HERMES]
            est = _RE_ESTADO.search(m.group(3))
            c.cmd_abierto = dict(resultado=m.group(2), estado=est.group(1) if est else None, motivos=[], t=t_local)
            c.salud_sucia = True
            return
        m = _RE_CMD_MOTIVO.match(linea)
        if m:
            for c in self.cohetes.values():
                if c.cmd_abierto is not None:
                    c.cmd_abierto['motivos'].append(m.group(1))
                    c.salud_sucia = True
            return
        for c in self.cohetes.values():      # cualquier otra linea [cmd ] cierra la respuesta anterior
            self._cerrar_cmd(c)

    def _clasificar(self, c, r):
        """La respuesta `r` ({resultado, estado, motivos, t}): si era la de un ARM, {resultado, motivos, ids}; si no, None.
        Las respuestas `[cmd ]` no dicen su orden: se atribuye con el comando escrito (`comando()`), y si no lo hay,
        con la respuesta misma (APTO solo lo produce el ARM; un NO APTO en TIERRA con motivos del checklist)."""
        ids = [_MOTIVO_ID.get(t) for t in r['motivos']]
        op = None
        if c.ultimo_comando and r['t'] - c.ultimo_comando[1] <= CMD_VIGENCIA_S:
            op = c.ultimo_comando[0]
        if op is not None:
            es_arm = op == 'armar'
        elif r['resultado'] == 'APTO':
            es_arm = True                    # CR_CONFIRMA solo lo produce el ARM (protocolo §4)
        elif r['resultado'] == 'NO APTO':
            es_arm = r['estado'] == 'TIERRA' and any(i in _IDS_ARM for i in ids)
        elif r['resultado'] == 'EJECUTADO':
            es_arm = c.arm_pendiente and r['estado'] == 'ARMED'
        else:
            es_arm = False
        return dict(resultado=r['resultado'], motivos=list(r['motivos']), ids=ids) if es_arm else None

    def _cerrar_cmd(self, c):
        """Cierra la respuesta abierta (ya no llegan mas motivos) y, si era de un ARM, la guarda."""
        r, c.cmd_abierto = c.cmd_abierto, None
        a = self._clasificar(c, r) if r is not None else None
        if a is not None:
            c.arm_pendiente = a['resultado'] in ('APTO', 'NO APTO')
            c.arm = a

    def _arm_vigente(self, c):
        """La ultima respuesta a un ARM, incluida la que aun esta abierta (sus motivos pueden estar a medias)."""
        if c.cmd_abierto is not None:
            a = self._clasificar(c, c.cmd_abierto)
            if a is not None:
                return a
        return c.arm

    def go_nogo(self, c):
        """`salud.go_nogo` de un cohete: lo que dijo la ultima respuesta a un ARM, con los textos de `reasonText`."""
        a = self._arm_vigente(c)
        nombres = dict(CONDICIONES_ARM)
        if a is not None:
            cond = [dict(id=i, nombre=n, ok=(i not in a['ids'])) for i, n in CONDICIONES_ARM]
            for texto, i in zip(a['motivos'], a['ids']):
                if i not in _IDS_ARM:        # un motivo que no es del checklist (o desconocido) va tal cual
                    cond.append(dict(id=i or 'otro', nombre=texto, ok=False))
            return dict(listo=a['resultado'] in ('APTO', 'EJECUTADO') and not a['motivos'], condiciones=cond)
        # Sin ARM todavia: solo las condiciones que se ven en el TELEM y el LogInfo; nunca "listo".
        cond = []
        t, li = c.telem, c.logi
        if t is not None:
            cond.append(dict(id='gnss', nombre=nombres['gnss'], ok=t['fix'] >= 3))
            cond.append(dict(id='bateria', nombre=nombres['bateria'], ok=t['vbat'] >= VBAT_ARM_MV))
        if li is not None:
            cond.append(dict(id='reserva', nombre=nombres['reserva'], ok=li['spare_state'] == 2 and li['spare_pct'] >= 100))
        return dict(listo=False, condiciones=cond)

    # -- mensajes --------------------------------------------------------------
    @staticmethod
    def _msg(tipo, c, datos):
        return {"tipo": tipo, "mision": c.mision, "datos": datos}

    def _meta(self, c):
        return {"contrato_version": CONTRATO_VERSION, "mision": c.mision, "nodo": c.rid, "modo": self.modo,
                "mission_id": c.mission_id or None,            # 0 = sin -DMISSION_ID: no hay identificador
                "proto_version": PROTO_VERSION,
                "sitio": {"lat": self.sitio[0], "lon": self.sitio[1], "alt_msl_m": redondear(self.sitio[2], 1)}}

    def _tiempos(self, c, t, t_local):
        """(seq, t_ms, utc_ms): protocolo §6. Con utc_ms = 0 (baliza lenta sin hora) el reloj sale del local."""
        if t['utc_ms']:
            c.utc_ref = (t['utc_ms'], t_local)
            c.seq_local = t['utc_ms'] // (SLOT_US // 1000)
            return c.seq_local, t['utc_ms'], t['utc_ms']
        c.seq_local += 1
        if c.utc_ref:
            t_ms = c.utc_ref[0] + int(round((t_local - c.utc_ref[1]) * 1000))
        else:
            t_ms = int(round(t_local * 1000))
        return c.seq_local, t_ms, None

    def _estado(self, c, t, t_local):
        seq, t_ms, utc_ms = self._tiempos(c, t, t_local)
        fase = fase_de(t['state'], t['moment'])
        en_ctx = t['state'] in (S_FLY, S_RECOVERY)
        # cuaternion: unitario y con w >= 0 (q y -q son la misma rotacion)
        q = [x / 32767.0 for x in t['quat']]
        norma = math.sqrt(sum(x * x for x in q))
        q = [1.0, 0.0, 0.0, 0.0] if norma < 1e-6 else [x / norma for x in q]
        if q[0] < 0:
            q = [-x for x in q]
        ekf_ok = norma >= 1e-6 and tuple(t['quat']) != (32767, 0, 0, 0)
        pos = vel = None
        alt_msl = t['alt_cm'] / 100.0
        alt_agl = alt_msl - self.sitio[2]
        if t['fix'] >= 2:
            pos = {"lat": redondear(t['lat_e7'] / 1e7, 7), "lon": redondear(t['lon_e7'] / 1e7, 7), "alt_agl_m": redondear(alt_agl, 1),
                   "alt_msl_m": redondear(alt_msl, 1), "fuente": "ekf" if ekf_ok else "gnss"}
        vz = None
        if t['fix'] >= 3:
            vn, ve, vu = t['vn'] / 100.0, t['ve'] / 100.0, -t['vd'] / 100.0
            vz = vu
            vel = {"n_ms": redondear(vn, 2), "e_ms": redondear(ve, 2), "u_ms": redondear(vu, 2),
                   "total_ms": redondear(math.sqrt(vn * vn + ve * ve + vu * vu), 2)}
        if pos is not None:
            c.lkp = {"lat": pos["lat"], "lon": pos["lon"], "alt_agl_m": pos["alt_agl_m"], "utc_ms": utc_ms}
            c.alt_max = alt_agl if c.alt_max is None else max(c.alt_max, alt_agl)
        if fase != "DESCENT":
            alarma = False
        elif vz is None:
            alarma = c.alarma                 # sin velocidad (se perdio el fix 3D) no hay dato nuevo: se mantiene
        else:
            alarma = vz < -ALARMA_DESCENSO_MS
        c.alarma_prev = c.alarma
        c.alarma = alarma
        if vz is not None:
            c.vz_alarma = vz
        vuelo = fase in FASES_VUELO
        c.serie.append((t_ms, pos["lat"] if pos else None, pos["lon"] if pos else None, pos["alt_agl_m"] if pos else None,
                        redondear(vz, 2) if vz is not None else None, redondear(t['acc'][0] / 1000.0, 3), redondear(t['acc'][1] / 1000.0, 3),
                        redondear(t['acc'][2] / 1000.0, 3), vuelo))
        log_activo = c.logi is not None and c.logi['rec'] == 1
        falla = bool(t['flags'] & TF_BOOST_SIN_ARMAR)
        a = self._arm_vigente(c)
        if a is not None and a['resultado'] not in ('APTO', 'EJECUTADO') and any(i in _IDS_SENSOR for i in a['ids']):
            falla = True                     # el ultimo ARM se negó por un sensor
        bat = None
        if t['vbat'] > 0:
            bat = int(round(100.0 * (t['vbat'] - BAT_PCT_VMIN_MV) / (BAT_PCT_VMAX_MV - BAT_PCT_VMIN_MV)))
            bat = max(0, min(100, bat))
        return {
            "seq": seq, "t_ms": t_ms, "utc_ms": utc_ms, "rx_utc_ms": int(round(t_local * 1000)), "relay_utc_ms": None,
            "fase": fase, "fase_cod": FASE_COD[fase], "pos": pos, "vel": vel,
            "acc_g": {"x": redondear(t['acc'][0] / 1000.0, 3), "y": redondear(t['acc'][1] / 1000.0, 3), "z": redondear(t['acc'][2] / 1000.0, 3)},
            "q": {"w": redondear(q[0], 5), "x": redondear(q[1], 5), "y": redondear(q[2], 5), "z": redondear(q[3], 5)},
            "flags": {"gnss_fix": t['fix'] >= 3, "ekf_ok": ekf_ok, "falla_activa": falla,
                      "eyeccion": en_ctx and t['moment'] >= M_PARACAIDAS, "apogeo": en_ctx and t['moment'] >= M_APOGEO,
                      "log_activo": log_activo, "reanudado": False},
            "act": {"pi_pulso": False, "cam_ok": False, "buzzer": False, "wifi_ap": False, "backfill": False},
            "bat_pct": bat, "secundario": None,
            "calc": self._calc(c, t, fase, pos, vel, alt_agl),
            "enlace": {"rssi_dbm": int(round(c.rssi)), "snr_db": redondear(c.snr, 1), "perdidos_pct_10s": self._perdidos(c, t, t_local)},
            "alarmas": {"descenso_rapido": alarma},
            "lkp": c.lkp,
        }

    def _calc(self, c, t, fase, pos, vel, alt_agl):
        """GS-02 (distancia, azimut, elevacion desde la estacion) y GS-10 (elipse de aterrizaje, provisional)."""
        calc = {"dist_horiz_m": None, "azimut_deg": None, "elevacion_deg": None, "elipse": None,
                "t_a_apogeo_s": None, "t_restante_s": None, "siguiente_fase": None, "t_siguiente_fase_s": None}   # los tiempos son T-665
        if pos is not None and self.pos_estacion is not None:
            la0, lo0, h0 = self.pos_estacion
            e, n, u = enu_wgs84(la0, lo0, h0, pos["lat"], pos["lon"], pos["alt_msl_m"])
            dist = math.hypot(e, n)
            calc["dist_horiz_m"] = redondear(dist, 1)
            calc["azimut_deg"] = redondear(math.degrees(math.atan2(e, n)) % 360.0, 1) % 360.0
            calc["elevacion_deg"] = redondear(math.degrees(math.atan2(u, dist)), 1)
        if fase == "DESCENT" and pos is not None and vel is not None and vel["u_ms"] < -DESCENSO_VZ_MIN_MS:
            t_rest = max(0.0, alt_agl) / -vel["u_ms"]
            vn, ve = vel["n_ms"], vel["e_ms"]
            deriva = math.hypot(vn, ve) * t_rest
            lat, lon = desplazar_latlon(pos["lat"], pos["lon"], ve * t_rest, vn * t_rest)
            mayor = max(ELIPSE_SEMIEJE_MIN_M, ELIPSE_INCERT_FRAC * deriva)
            menor = max(ELIPSE_SEMIEJE_MIN_M, ELIPSE_TRANSV_FRAC * mayor)
            rumbo = math.degrees(math.atan2(ve, vn)) % 360.0 if deriva > 0 else 0.0
            calc["elipse"] = {"lat": redondear(lat, 7), "lon": redondear(lon, 7), "semieje_mayor_m": redondear(mayor, 1),
                              "semieje_menor_m": redondear(menor, 1), "rumbo_deg": redondear(rumbo, 1) % 360.0}
        return calc

    def _perdidos(self, c, t, t_local):
        """Ranuras propias esperadas contra recibidas en los ultimos ENLACE_VENTANA_S (como gnd_rx.cpp:accept)."""
        if t['utc_ms']:
            absol = t['utc_ms'] * 1000 // SLOT_US
            perdidos = 0
            if c.lastAbs and absol > c.lastAbs and absol - c.lastAbs <= MAX_GAP_SLOTS:
                flying = bool(t['flags'] & TF_FLYING)
                for a in range(c.lastAbs + 1, absol):
                    if slot_is_tx(t['rid'], a % SLOTS_PER_S, flying):
                        perdidos += 1
            c.lastAbs = absol
            c.enlace.append((t_local, perdidos + 1, perdidos))
        while c.enlace and t_local - c.enlace[0][0] > ENLACE_VENTANA_S:
            c.enlace.popleft()
        esperados = sum(x[1] for x in c.enlace)
        if esperados == 0:
            return None
        return redondear(100.0 * sum(x[2] for x in c.enlace) / esperados, 1)

    def _eventos(self, c, t, e):
        """Los cambios de fase y de momento (protocolo §6), y la alarma de descenso."""
        evs = []
        ref = (e['t_ms'], e['utc_ms'])

        def ev(tipo, valor=None, fase=None, activa=None):
            t_mas = redondear((ref[0] - c.t0_ms) / 1000.0, 2) if c.t0_ms is not None else None
            d = {"tipo": tipo, "t_ms": ref[0], "utc_ms": ref[1], "t_mas_s": t_mas,
                 "valor": None if valor is None else redondear(valor, 2), "fase": fase, "activa": activa}
            c.eventos.append(d)
            evs.append(d)

        state, moment, fase = t['state'], t['moment'], e['fase']
        prev = c.prev
        c.prev = (state, moment, fase)
        cambia_momento = prev is not None and state in (S_FLY, S_RECOVERY) and moment != prev[1]
        if prev is not None and prev[2] in FASES_VUELO + ("LANDED",) and fase in ("BOOT", "PREFLIGHT", "ARMED"):
            c.t0_ms, c.aterrizaje_emitido, c.alt_max = None, False, None      # un vuelo nuevo (aborto o reinicio)
        if cambia_momento and moment == M_BOOST:
            c.t0_ms = e['t_ms']               # antes de emitir: el cambio de fase a BOOST ya lleva T+ = 0
        if prev is None or prev[2] != fase:
            ev("fase", fase=fase)
        if cambia_momento:
            if moment == M_BOOST:
                ev("despegue")
            elif moment == M_COAST:
                ev("fin_combustion")
            elif moment == M_APOGEO:
                ev("apogeo", valor=c.alt_max)
            elif moment == M_PARACAIDAS:
                ev("eyeccion")
            elif moment == M_ATERRIZAJE and not c.aterrizaje_emitido:
                c.aterrizaje_emitido = True
                ev("aterrizaje")
        if prev is not None and state == S_RECOVERY and prev[0] != S_RECOVERY and not c.aterrizaje_emitido:
            c.aterrizaje_emitido = True
            ev("aterrizaje")
        if c.alarma != c.alarma_prev:
            ev("alarma_descenso", valor=c.vz_alarma if c.vz_alarma is not None else 0.0, activa=c.alarma)
        return evs

    def _salud(self, c, t_local):
        t = c.telem
        # t_ms y utc_ms del ultimo estado emitido
        est = c.estado
        return {
            "t_ms": est['t_ms'], "utc_ms": est['utc_ms'], "mission_id": c.mission_id or None,
            "boot_count": None,      # net_proto no lo trae: null = sin dato (D-050), no 0
            "gnss": {"fix": 3 if t['fix'] in (3, 4) else (2 if t['fix'] == 2 else 0), "sv": t['nsv'], "hacc_m": None},
            "bat_mv": t['vbat'], "temp_esp_c": None, "temp_pi_c": None,
            "fallas": [], "fallas_bits": 0,
            # net_proto no trae la calibracion: null = sin dato (D-050). Con `false` la web diria "no calibrado".
            "calib": {"giro": None, "mag": None, "baro": None, "origen": None, "actitud": None},
            "nav_innov_m": None,
            "apogeo_m": redondear(c.alt_max, 1) if (est['flags']['apogeo'] and c.alt_max is not None) else None,
            "alt_origen_msl_m": redondear(self.sitio[2], 1), "sd_libre_mb": None,
            "rssi_tierra_dbm": int(round(c.rssi)), "ultimo_cmd_seq": t['ack'] & 63,
            "go_nogo": self.go_nogo(c), "fw_version": None,
        }

    def _estacion(self, c, t_local):
        pos = None
        if self.pos_estacion is not None:
            pos = {"lat": redondear(self.pos_estacion[0], 7), "lon": redondear(self.pos_estacion[1], 7),
                   "alt_msl_m": redondear(self.pos_estacion[2], 1)}
        hace = None if c.t_telem is None else max(0, int(round((t_local - c.t_telem) * 1000)))
        return {"utc_ms": int(round(t_local * 1000)), "pos": pos, "gnss_ok": self.gnss_ok, "ultimo_paquete_hace_ms": hace}

    # -- snapshot --------------------------------------------------------------
    def snapshot(self, mision, t_local=None):
        """El snapshot de una mision (05 §3): ultimo `estado`, `salud` y `estacion`, los eventos y la `serie`
        en columnas, decimada a WEB_SERIE_MAX_PUNTOS (toda la resolucion en vuelo; la espera en tierra se decima)."""
        c = self.cohetes[NODO[mision]]
        if t_local is None:
            t_local = self.t_ultimo if self.t_ultimo is not None else time.time()
        meta = c.meta if c.meta is not None else self._meta(c)
        salud = self._salud(c, t_local) if c.telem is not None else None
        pts = list(c.serie)
        idx = decimar_indices([p[8] for p in pts], WEB_SERIE_MAX_PUNTOS)
        serie = {k: [] for k in ("t_mas_s", "lat", "lon", "alt_agl_m", "vz_ms", "acc_x_g", "acc_y_g", "acc_z_g")}
        for i in idx:
            p = pts[i]
            serie["t_mas_s"].append(None if c.t0_ms is None else redondear((p[0] - c.t0_ms) / 1000.0, 2))
            for k, v in zip(("lat", "lon", "alt_agl_m", "vz_ms", "acc_x_g", "acc_y_g", "acc_z_g"), p[1:8]):
                serie[k].append(v)
        return {"meta": meta, "estado": c.estado, "salud": salud, "estacion": self._estacion(c, t_local),
                "eventos": list(c.eventos), "serie": serie, "backfill": None, "vuelo_completo_url": None}


# ---------------------------------------------------------------------------
# CLI de reproceso
# ---------------------------------------------------------------------------
def leer_sesion(ruta):
    """Genera (t_local, linea) desde una sesion de dashboard.py: `<epoch con 3 decimales> <linea>`.
    Una linea sin hora hereda la de la anterior."""
    t = 0.0
    with open(ruta, encoding='utf-8', errors='replace') as f:
        for crudo in f:
            crudo = crudo.rstrip('\r\n')
            if not crudo:
                continue
            tok, _, resto = crudo.partition(' ')
            try:
                t, linea = float(tok), resto
            except ValueError:
                linea = crudo
            yield t, linea


def main(argv=None):
    ap = argparse.ArgumentParser(description="Convierte una sesion de tierra de dashboard.py en mensajes web-1 (JSONL).")
    ap.add_argument('sesion', help="archivo de sesion de tierra (sesiones/AAAAMMDD_HHMMSS_tierra.txt)")
    ap.add_argument('--salida', default='web1.jsonl', help="JSONL de mensajes {tipo, mision, datos} (por defecto web1.jsonl)")
    ap.add_argument('--snapshot', help="ademas, el snapshot final de cada mision en este archivo JSON")
    ap.add_argument('--modo', default='vivo', choices=('vivo', 'simulacion', 'sintetico'), help="meta.modo")
    a = ap.parse_args(argv)
    tr = Traductor(modo=a.modo)
    cuenta = collections.Counter()
    with open(a.salida, 'w', encoding='utf-8') as out:
        for t, linea in leer_sesion(a.sesion):
            for m in tr.procesar(linea, t):
                cuenta[(m['mision'], m['tipo'])] += 1
                out.write(json.dumps(m, ensure_ascii=False, separators=(',', ':')) + '\n')
    if a.snapshot:
        with open(a.snapshot, 'w', encoding='utf-8') as f:
            json.dump({m: tr.snapshot(m) for m in NODO}, f, ensure_ascii=False)
    total = sum(cuenta.values())
    print(f'{total} mensajes -> {a.salida}', file=sys.stderr)
    for (mision, tipo), n in sorted(cuenta.items()):
        print(f'  {mision:8s} {tipo:9s} {n}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
