#!/usr/bin/env python3
"""dashboard.py - Proto dashboard de mision: herramienta minima para trabajar con las placas.
Uso:  python dashboard.py          abre http://127.0.0.1:8765
      python dashboard.py --demo   sin placas: datos inventados, para probar la interfaz
      python dashboard.py --reproducir sesiones/AAAAMMDD_HHMMSS_tierra.txt   repite una sesion guardada
Requiere pyserial. Cierra antes los monitores serie de los puertos que vayas a conectar.
Ademas sirve en local (T-662) la API de lectura de web-1 (/api/v1/{demeter|hermes}/snapshot y /stream)
y las paginas de mision de gui/web (el dist/ de `npm run web:build`).
"""
import argparse, collections, json, math, os, re, socket, struct, subprocess, sys, threading, time, urllib.parse, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import web1

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 8765
MISSION_FILE = os.path.join(HERE, 'mision.json')
SESSION_DIR = os.path.join(HERE, 'sesiones')
TELEM = struct.Struct('<BBHQiiihhh4h3h3hBBH2bBBHBBH')       # net::Telem, 64 B
LOGINFO = struct.Struct('<BBBBBB34sIIIH')                   # net::LogInfo, 54 B
STATES = ['-', 'TIERRA', 'ARMED', 'FLY', 'RECOVERY']
MOMENTS = ['-', 'LAUNCH', 'BOOST', 'COAST', 'APOGEO', 'CAIDA', 'PARACAIDAS', 'ATERRIZAJE']
TF_BOOST_SIN_ARMAR, TF_FORZADO, TF_LAUNCH_VENCIDO, TF_REANUDADO = 2, 4, 8, 16   # TF_REANUDADO: T-411, D-052
ACT_BUZZER, ACT_PI_EN_CURSO, ACT_PI_ENVIADO = 1, 2, 4       # bits de TELEM.actuators (protocolo_paquetes.md seccion 2, T-413)
PI_STATUS = {0x00: 'BOOT', 0x01: 'PREFLIGHT', 0x02: 'READY', 0x03: 'ARMED', 0x04: 'STARTING', 0x05: 'INGESTING', 0x06: 'PROCESSING', 0x07: 'COMPLETE', 0x08: 'ASCENT', 0x30: 'RECORDING', 0xE0: 'ABORTED', 0xE1: 'SD_FULL', 0xE2: 'RATE_FALLBACK', 0xE3: 'TELEMETRY_LOST', 0xE4: 'ABORT_REQUESTED', 0xE5: 'CLOCK_UNSYNCED', 0xEF: 'PIPELINE_ERROR', 0xFF: 'desconocido'}   # byte alto de TELEM.actuators (ext_pi)
STALE_S = 3.0
ROLES = {'tierra': 'COM5', 'demeter': 'COM4', 'hermes': 'COM3'}
ROCKET_ROLE = {1: 'demeter', 2: 'hermes'}
WEB_DIST = os.path.abspath(os.path.join(HERE, '..', 'gui', 'web', 'dist'))      # el build de la web (T-662)
WEB_PREFIJOS = ('assets', 'demeter', 'hermes', 'mapas')      # lo que el build (base /) pide en la raiz del origen
WEB_SSE_LATIDO_S = 15                                        # constantes.md
WEB_BUS_MAX = 4000                                           # mensajes por mision que se guardan para Last-Event-ID
MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.map': 'application/json',
        '.pmtiles': 'application/octet-stream'}              # fijos: en Windows mimetypes lee el registro y a veces da .js = text/plain

# Lo relevante de cada linea del monitor; el resto queda en la linea completa
DIAG_KEYS = {
    'pmu': ['vbat', 'vbus', 'chg'], 'gnss': ['init', 'fix', 'sv', 'tAcc', 'pvt/s', 'gaps', 'ckerr'],
    'time': ['q', 'src', 'err', 'deriva', 'UTC', 'anclas'],
    'sd': ['esc', 'reserva', 'fallos', 'err', 'reab', 'libre'],
    'imu': ['muestras', 'perdidas', 'odr', 'rms', 'llenos', 'timeouts'],
    'mag': ['id', 'muestras', '|B|', 'sat', 'err', 'inits', 'gap_max'], 'bar': ['P', 'T', 'H', 'err', 'tmo'],
    'lsm': ['who', 'muestras', 'odr', 'rms', 'perdidas', 'sobrescr', 'tag_malos', '|a|'],
    'bmp': ['paso', 'hub', 'id', 'muestras', 'P', 'T', 'nack', 'malas'],
    'mmc': ['id', 'muestras', '|B|', 'sat', 'err', 'gap_max'], 'drv': ['iman', 'despertar'],
    'rx': ['balizas', 'malas', 'residuo'], 'net': ['tx', 'err', 'saltadas', 'tarde_max', 'fin_max', 'aire'],
    'mis': ['estado', 'momento', 'flags', 'alt', 'vz', 'baro', 'cmd', 'ult_res', 'motivos'],
    'pi': ['estado', 'latido', 'cambios', 'perdidas', 'tramas', 'crc_mal', 'pose', 'omitidas', 'banderas'],   # UART con la Pi (solo Demeter)
    'ring': ['malos', 'resync'], 'log': ['archivo', 'tiempo', 'lleno', 'restante', 'reserva'],
}
ALERT_KEYS = {'crc_mal', 'omitidas', 'err', 'tmo', 'sat', 'nack', 'fallos', 'ckerr', 'sobrescr', 'tag_malos', 'timeouts', 'llenos', 'malas', 'malos', 'saltadas'}
KV = re.compile(r'([\w/|]+)=(\S+(?: (?:mV|ns|us|Hz|kHz|MB|KB|G|Pa|C|ppm|m/s|m|g|s)\b| %)?)')
TAG = re.compile(r'^\[([^\]]+)\]\s*(.*)$')

lock = threading.RLock()
links = {}
telem = {}                    # rocket_id -> ultimo TELEM
loginfo = {}                  # rocket_id -> ultimo LogInfo
diag = {r: {} for r in ROLES}  # rol -> etiqueta -> fila
raw_lines = {r: collections.deque(maxlen=400) for r in ROLES}   # monitor en crudo, sin las lineas de maquina
events = []
ask = None
ask_head = []
ground_time = None
ground_seen = 0.0
sleeping = {}                 # rocket_id -> instante del "dormir" aceptado
job = {'running': False, 'lines': [], 'role': '', 'port': '', 'proc': None, 'rc': None, 'port_free': False, 'reconnect': None}
demo = False
replay = None                 # archivo de sesion de tierra que se repite en vez de leer el puerto (--reproducir)
replay_vel = 1.0

# web-1 (T-661/T-662): un Traductor por proceso. No es seguro entre hilos: TODA llamada va con tr_lock,
# y lo que sale se publica dentro del mismo candado para que el orden de los ids sea el de los mensajes.
tr = web1.Traductor()
tr_lock = threading.Lock()
bus = {m: dict(seq=0, buf=collections.deque(maxlen=WEB_BUS_MAX)) for m in web1.NODO}   # mision -> contador y (id, tipo, json)
bus_cond = threading.Condition()
web_errores = 0


def calib_path(role, new):
    return os.path.join(HERE, f'calib_{role}_nuevo.json' if new else f'calib_{role}.json')


def event(text):
    with lock:
        events.append(time.strftime('%H:%M:%S ') + text)
        del events[:-300]


def web_publicar(msgs):
    """Pasa los mensajes web-1 al bus de cada mision (id = contador por mision) y despierta a los SSE. Va con tr_lock."""
    global web_errores
    with bus_cond:
        for m in msgs or ():
            try:
                datos = json.dumps(m['datos'], ensure_ascii=False, separators=(',', ':'), allow_nan=False)
            except ValueError:                  # NaN o infinito: un JSON invalido no se manda
                web_errores += 1
                continue
            b = bus[m['mision']]
            b['seq'] += 1
            b['buf'].append((b['seq'], m['tipo'], datos))
        bus_cond.notify_all()


def web_llamar(f, *args):
    """Una llamada al Traductor, con su candado. Un error del traductor no debe tumbar el hilo del puerto ni al servidor."""
    global web_errores
    try:
        with tr_lock:
            web_publicar(f(*args, time.time()))
    except Exception as e:
        web_errores += 1
        if web_errores <= 3:
            event(f'web-1: error {e!r}; se ignora ({web_errores})')


def web_tick():
    """Los latidos a 1 Hz (salud y estacion) aunque no llegue nada; el Traductor se limita solo a 1 Hz."""
    while True:
        time.sleep(0.25)
        web_llamar(tr.tick)


def web_snapshot(mision):
    with tr_lock:
        return tr.snapshot(mision, time.time())


def web_archivo(ruta):
    """El archivo de dist/ para una ruta URL, o None. Sirve /web/<x> y lo que el build pide en la raiz (assets/, demeter/, hermes/, mapas/).
    Nunca sale de dist/: se rechazan '..', barras invertidas y ':', y ademas se comprueba la ruta real."""
    p = urllib.parse.unquote(ruta.split('?')[0].split('#')[0])
    if '\0' in p or '\\' in p or ':' in p or '..' in p.split('/'):
        return None
    partes = [x for x in p.split('/') if x]
    if partes and partes[0] == 'web':
        partes = partes[1:]
    elif not partes or partes[0] not in WEB_PREFIJOS:
        return None
    raiz = os.path.realpath(WEB_DIST)
    full = os.path.realpath(os.path.join(raiz, *partes))
    if os.path.commonpath([full, raiz]) != raiz:
        return None
    if os.path.isdir(full):
        full = os.path.join(full, 'index.html')
    return full if os.path.isfile(full) else None


def diag_line(role, line):
    m = TAG.match(line)
    if not m:
        return
    tag, rest = m.group(1).strip(), m.group(2)
    kv = KV.findall(rest)
    first = KV.search(rest)
    status = (rest[:first.start()] if first else rest).split('|')[0].strip()
    keys = None if role == 'tierra' else DIAG_KEYS.get(tag)
    if role != 'tierra' and keys is None:     # avisos sueltos ([boot], [sleep]...): van solo al monitor
        return
    shown = [(k, v) for k, v in kv if keys is None or k in keys]
    alert = [k for k, v in shown if k in ALERT_KEYS and tag != 'time' and v.split(' ')[0] not in ('0', '0.0')]   # en [time], err es el error estimado
    if tag == 'pi' and dict(shown).get('estado') == 'desconocido':     # sin latido de la Pi en 3 s
        alert.append('estado')
    bad = bool(re.search(r'CAIDO|ERROR|FALLO|SIN ', status))
    with lock:
        diag[role][tag] = dict(tag=tag, status=status, kv=shown, alert=alert, bad=bad, raw=line, t=time.time())


def note_telem(rid, old, new):
    """Lo que cambia solo, sin un comando de por medio, tambien va al historial."""
    name = ROCKET_ROLE.get(rid, str(rid))
    if old['state'] != new['state'] and new['state'] <= 4:
        event(f"{name}: estado {STATES[old['state']]} -> {STATES[new['state']]}")
    if old['moment'] != new['moment'] and new['moment'] <= 7:
        event(f"{name}: momento {MOMENTS[old['moment']]} -> {MOMENTS[new['moment']]}")
    up = new['flags'] & ~old['flags']
    if up & TF_LAUNCH_VENCIDO:
        event(f'{name}: tiempo sin BOOST vencido tras LAUNCH; sigue en FLY y registrando. Para cancelar: abortar')
    if up & TF_BOOST_SIN_ARMAR:
        event(f'{name}: BOOST SIN ARMAR')
    if up & TF_FORZADO:
        event(f'{name}: modo FORZADO')
    if up & TF_REANUDADO:
        event(f'{name}: REANUDADO tras un reinicio (retomo {STATES[new["state"]] if new["state"] <= 4 else "?"})')
    act_up, act_down = new['actuators'] & ~old['actuators'], old['actuators'] & ~new['actuators']
    if act_up & ACT_BUZZER:
        event(f'{name}: buzzer sonando')
    if act_down & ACT_BUZZER:
        event(f'{name}: buzzer apagado')
    if act_up & ACT_PI_EN_CURSO:
        event(f'{name}: pulso de encendido a la Pi')
    pi_old, pi_new = old['actuators'] >> 8, new['actuators'] >> 8
    if rid == 1 and pi_new != pi_old:
        event(f"{name}: Raspberry Pi {PI_STATUS.get(pi_new, hex(pi_new))}")


def note_log(rid, old, new):
    name = ROCKET_ROLE.get(rid, str(rid))
    if new['rec'] and not old['rec']:
        event(f"{name}: registro iniciado, {new['name']}")
    elif old['rec'] and not new['rec']:
        event(f"{name}: registro terminado, {old['name']}, ultimo dato a los {old['elapsed']} s")
    elif new['rec'] and old['name'] != new['name']:
        event(f"{name}: registro sigue en {new['name']}")


def ground_line(line):
    global ask, ask_head, ground_time, ground_seen
    ground_seen = time.time()
    web_llamar(tr.procesar, line)
    if line.startswith('@T '):
        p = line.split(' ')
        if len(p) != 4:
            return
        try:
            f = TELEM.unpack(bytes.fromhex(p[3]))
        except (ValueError, struct.error):
            return
        with lock:
            prev = telem.get(f[1])
            telem[f[1]] = dict(t=time.time(), rssi=float(p[1]), snr=float(p[2]), mission=f[2], utc_ms=f[3], lat=f[4] / 1e7, lon=f[5] / 1e7,
                               alt=f[6] / 100.0, vn=f[7] / 100.0, ve=f[8] / 100.0, vd=f[9] / 100.0, quat=f[10:14], acc=f[14:17], gyro=f[17:20],
                               fix=f[20], nsv=f[21], vbat=f[22], state=f[25] & 15, moment=f[25] >> 4, flags=f[26], actuators=f[27], time_flags=f[28], ack=f[29])
            if prev:
                note_telem(f[1], prev, telem[f[1]])
        return
    if line.startswith('@L '):
        try:
            f = LOGINFO.unpack(bytes.fromhex(line[3:].strip()))
        except (ValueError, struct.error):
            return
        with lock:
            prev = loginfo.get(f[1])
            loginfo[f[1]] = dict(t=time.time(), rec=f[2] == 1, prep=f[2] == 2, pct=f[3], spare=f[4], spare_pct=f[5], name=f[6].split(b'\0')[0].decode(errors='replace'), elapsed=f[7], pos=f[8], remain=f[9])
            if prev:
                note_log(f[1], prev, loginfo[f[1]])
        return
    if line.startswith('@G '):
        ground_time = line[3:].strip() == '1'
        return
    if line.startswith('[cmd ]'):
        text = line[6:].rstrip()
        event(text.strip())
        with lock:
            if text.startswith('   - '):
                ask_head.append(text[5:])
            elif 'escribe si o no' in text:
                ask = dict(question=text.split('(')[0].strip(), reasons=list(ask_head), until=time.time() + 9.0)
            else:
                ask_head = []
        return
    diag_line('tierra', line)


class Link:
    """Un puerto USB leido por lineas; todo lo recibido se guarda en la sesion."""
    def __init__(self, role, port):
        import serial
        self.role, self.port = role, port
        s = serial.Serial()
        s.port, s.baudrate, s.timeout = port, 115200, 0.2
        s.dtr = False                   # sin esto, abrir el puerto puede reiniciar la placa
        s.rts = False
        s.open()
        self.s = s
        self.alive = True
        os.makedirs(SESSION_DIR, exist_ok=True)
        self.rec = open(os.path.join(SESSION_DIR, time.strftime('%Y%m%d_%H%M%S_') + role + '.txt'), 'a', encoding='utf-8', buffering=1)
        self.th = threading.Thread(target=self.loop, daemon=True)
        self.th.start()

    def loop(self):
        buf = b''
        while self.alive:
            try:
                d = self.s.read(self.s.in_waiting or 1)
            except Exception as e:
                if self.alive:
                    event(f'{self.role}: puerto perdido ({e})')
                self.alive = False
                break
            if not d:
                continue
            buf += d
            *lines, buf = buf.split(b'\n')
            for raw in lines:
                self.handle(raw.decode(errors='replace').rstrip('\r'))
        try:
            self.s.close()
            self.rec.close()
        except Exception:
            pass

    def handle(self, line):
        self.rec.write(f'{time.time():.3f} {line}\n')
        if not line.startswith(('@T ', '@L ', '@G ')):
            raw_lines[self.role].append(time.strftime('%H:%M:%S ') + line)
        if self.role == 'tierra':
            ground_line(line)
        else:
            diag_line(self.role, line)

    def write(self, text):
        self.s.write(text.encode() + b'\n')

    def close(self):
        """Vuelve con el puerto ya libre: lo cierra su propio hilo, para no cerrarlo en medio de una lectura."""
        self.alive = False
        self.th.join(2.0)


class DemoLink:
    """Finge una placa: suficiente para ver la interfaz sin hardware."""
    def __init__(self, role, port):
        self.role, self.port, self.alive = role, port, True
        self.st = {1: [1, 0, 0], 2: [1, 0, 0]}       # estado, momento, flags
        self.act = {1: 0, 2: 0}                      # TELEM.actuators
        self.rec_t = {1: None, 2: None}
        threading.Thread(target=self.loop, daemon=True).start()

    def loop(self):
        t0 = time.time()
        while self.alive:
            t = time.time() - t0
            if self.role == 'tierra':
                ground_line('@G 1')
                for rid, (st, mo, fl) in self.st.items():
                    b = TELEM.pack(1, rid, 0, int(time.time() * 1000), 65820000, -758230000, int((510 + 3 * math.sin(t)) * 100), 0, 0, 0, 32767, 0, 0, 0, 0, 0, 1000, 0, 0, 0, 3, 15 + rid, 4100, 25, 0, st | (mo << 4), fl, self.act[rid], 4, 0, 0)
                    ground_line(f'@T {-70.0 - rid:.1f} 9.5 {b.hex()}')
                    run = time.time() - self.rec_t[rid] if st == 3 and self.rec_t[rid] else 0
                    ground_line('@L ' + LOGINFO.pack(5, rid, 1 if st == 3 else (2 if st == 2 else 0), int(run * 45000 * 100 / 33554432), 0 if st in (2, 3) else 2, 0 if st in (2, 3) else 100, b'DEM_M00_20261102_101500_0072.BIN' if st in (2, 3) else b'', int(run), int(run * 45000), int(745 - run), 0).hex())
                ground_line('[time] q=0 err=0.4 us deriva=+0.10 ppm UTC=15:00:00 anclas=120 sin_flanco=0 | pos(5)=6.5790000 -75.8150000 505.0 m')   # la estacion, a ~1,3 km de la rampa
                diag_line('tierra', f'[bcn ] tx={int(t)} err=0 tarde_max=90 us aire=12850 us adelanto=6500 us')
            else:
                for line in (f'[pmu] vbat=4160 mV vbus=4998 mV chg=0', f'[gnss] init=OK fix=3 sv=16 tAcc=21 ns pvt/s=10.0 gaps={int(t / 9)} (ult 200 ms) ckerr=0',
                             '[sd  ] registrando (preasignado) | DEM_0066.BIN | 6216 KB esc=9766 fl=174 | reserva=2/100% fallos=0 rollovers=0 | err=8 (eio=1) errno=9 w=0 reab=1 libre=28218 MB',
                             '[mag ] CAIDO | muestras=0 0.0 Hz |B|=0.000 G sat=0 err=3 inits=1 gap_max=0 us',
                             f'[lsm ] muestreando who=0x6C spi=2248 kHz whoerr=0 freq_fine=-23 (1609.2 Hz) | muestras={int(t * 1610)} 1610.0 Hz odr=1610.58 Hz rms=1.5 us perdidas=5 sobrescr=0 tag_malos=0 | |a|=0.993 g giro=0.1 -0.6 0.1 dps'):
                    diag_line(self.role, line)
                    raw_lines[self.role].append(time.strftime('%H:%M:%S ') + line)
            time.sleep(0.5)

    def write(self, text):
        p = text.split(' ')
        name = {'d': 'Demeter', 'h': 'Hermes'}.get(p[0])
        if text == 'si' and self.pending[1] == 'pi':
            rid = self.pending[0]
            self.act[rid] |= ACT_PI_EN_CURSO | ACT_PI_ENVIADO
            threading.Timer(1.5, lambda: self.act.__setitem__(rid, self.act[rid] & ~ACT_PI_EN_CURSO)).start()
            ground_line(f'[cmd ] {ROCKET_ROLE[rid]}: EJECUTADO | pi encender')
        elif text == 'si':
            rid, to = self.pending
            self.st[rid][0] = to
            self.rec_t[rid] = time.time() if to == 3 else self.rec_t[rid]
            self.st[rid][2] |= TF_FORZADO if to != 2 else 0
            ground_line(f'[cmd ] {ROCKET_ROLE[rid]}: EJECUTADO | estado={STATES[to]}')
        elif text == 'no':
            ground_line('[cmd ] cancelado')
        elif name:
            rid = 1 if p[0] == 'd' else 2
            if p[1] == 'estado' and p[2] in ('recovery', 'fly'):
                self.pending = (rid, 4 if p[2] == 'recovery' else 3)
                for x in (f'[cmd ] {name}: NO APTO | estado={STATES[self.st[rid][0]]}', '[cmd ]   - sin aterrizaje detectado', '[cmd ]   - altura aumentando', '[cmd ] Seguro que quieres forzar? (10 s): escribe si o no'):
                    ground_line(x)
            elif p[1] == 'pi':
                self.pending = (rid, 'pi')
                for x in (f'[cmd ] {name}: NO APTO | estado={STATES[self.st[rid][0]]}', '[cmd ]   - no se sabe si la Pi esta encendida: una pulsacion podria apagarla', '[cmd ] Seguro que quieres forzar? (10 s): escribe si o no'):
                    ground_line(x)
            elif p[1] == 'buzzer':
                self.act[rid] = self.act[rid] | ACT_BUZZER if p[2] == 'on' else self.act[rid] & ~ACT_BUZZER
                ground_line(f'[cmd ] {name}: EJECUTADO | buzzer {p[2]}')
            elif p[1] == 'armar':
                self.pending = (rid, 2)
                ground_line(f'[cmd ] {name}: APTO | estado=TIERRA')
                ground_line('[cmd ] Confirma el armado (10 s): escribe si o no')
            else:
                if p[1] == 'estado' and p[2] == 'tierra':
                    self.st[rid][0], self.st[rid][1], self.st[rid][2] = 1, 0, 0
                if p[1] == 'launch':
                    self.st[rid][0], self.st[rid][1] = 3, 1
                ground_line(f'[cmd ] {name}: EJECUTADO | {p[1]}')

    def close(self):
        self.alive = False


class ReplayLink:
    """Repite una sesion de tierra guardada (`<epoch> <linea>`) por ground_line, al ritmo original (por velocidad)."""
    def __init__(self, role, port):
        self.role, self.port, self.alive = role, port, True
        threading.Thread(target=self.loop, daemon=True).start()

    def loop(self):
        prev = None
        for t, line in web1.leer_sesion(replay):
            if not self.alive:
                return
            if prev is not None and t > prev:
                time.sleep(min((t - prev) / replay_vel, 2.0))      # un hueco largo de la sesion no deja esperando
            prev = t
            ground_line(line)
        event('reproduccion terminada')

    def write(self, text):
        event('reproduciendo una sesion: el comando no se manda a ninguna placa')

    def close(self):
        self.alive = False


def connect(role, port):
    if job['running'] and job['role'] == role and not job['port_free']:
        raise RuntimeError(f'{role} esta ocupado descargando')
    disconnect(role)
    links[role] = (ReplayLink if replay and role == 'tierra' else DemoLink if demo else Link)(role, port)
    event(f'{role}: conectado a {port}')


def disconnect(role):
    l = links.pop(role, None)
    if l:
        l.close()


def log_view(rid, now):
    """Estado del registro: por LoRa cada 5 s, o del monitor si el cohete esta por USB."""
    u = diag[ROCKET_ROLE[rid]].get('log')
    if u and now - u['t'] < STALE_S:
        kv = dict(u['kv'])
        num = lambda k: int(kv.get(k, '0').split(' ')[0])
        sp = re.match(r'(\d+)/(\d+)', kv.get('reserva', ''))
        name = kv.get('archivo', '-')
        return dict(rec=u['status'] == 'REGISTRANDO', prep=u['status'] == 'PREPARADO', name='' if name == '-' else name, elapsed=num('tiempo'), pct=num('lleno'), remain=num('restante'),
                    spare=int(sp.group(1)) if sp else None, spare_pct=int(sp.group(2)) if sp else 0)
    i = loginfo.get(rid)
    if not i or now - i['t'] > 15:
        return None
    run = int(now - i['t']) if i['rec'] else 0        # entre paquetes el tiempo sigue corriendo
    return dict(rec=i['rec'], prep=i['prep'], name=i['name'], elapsed=i['elapsed'] + run, pct=i['pct'], remain=max(0, i['remain'] - run), spare=i['spare'], spare_pct=i['spare_pct'])


def rocket_view(rid):
    role = ROCKET_ROLE[rid]
    now = time.time()
    t = telem.get(rid)
    fresh = t is not None and now - t['t'] < STALE_S
    usb = diag[role].get('mis')
    view = dict(name=role.capitalize(), estado='-', momento='-', modo='SIN ENLACE', stale=True, telem=t and dict(t, age=round(now - t['t'], 1)), log=log_view(rid, now))
    if t:
        view['estado'], view['momento'] = STATES[t['state']] if t['state'] <= 4 else '?', MOMENTS[t['moment']] if t['moment'] <= 7 else '?'
    if fresh:
        modo = []
        if t['flags'] & TF_BOOST_SIN_ARMAR:
            modo.append('BOOST SIN ARMAR')
        if t['flags'] & TF_FORZADO:
            modo.append('FORZADO')
        if t['flags'] & TF_REANUDADO:
            modo.append('REANUDADO')
        if t['utc_ms'] == 0:
            modo.append('SIN HORA')
        view.update(modo=' + '.join(modo) or 'NORMAL', stale=False)
    elif usb and now - usb['t'] < STALE_S:
        kv = dict(usb['kv'])
        view.update(estado=kv.get('estado', '-'), momento=kv.get('momento', '-'), modo='SOLO USB', stale=False)
    if rid in sleeping:
        if fresh and now - sleeping[rid] > 5:
            del sleeping[rid]
        elif not fresh:
            view.update(estado='SLEEP', modo='DORMIDO')
    return view


def snapshot():
    global ask
    now = time.time()
    with lock:
        if ask and now > ask['until']:
            ask = None
        conn = {r: (links[r].port if r in links and links[r].alive else '') for r in ROLES}
        gnd_ok = bool(conn['tierra']) and now - ground_seen < STALE_S
        out = dict(demo=demo, web=os.path.isfile(os.path.join(WEB_DIST, 'index.html')), conn=conn, defaults=ROLES, events=events[-300:], job=dict(running=job['running'], role=job['role'], port=job['port'], rc=job['rc'], port_free=job['port_free'], lines=job['lines'][-300:]),
                   calib={r: dict(nuevo=os.path.exists(calib_path(r, True)), vigente=os.path.exists(calib_path(r, False))) for r in ('demeter', 'hermes')},
                   ask=ask and dict(question=ask['question'], reasons=ask['reasons'], left=max(0, int(ask['until'] - now))),
                   ground=dict(name='Tierra', estado='CONECTADA' if gnd_ok else 'SIN USB', momento='', modo='' if not gnd_ok else ('CON HORA' if ground_time else 'SIN HORA'), stale=not gnd_ok),
                   rockets=[rocket_view(1), rocket_view(2)],
                   diag={r: sorted((dict(x, age=round(now - x['t'], 1)) for x in diag[r].values()), key=lambda x: x['t']) for r in ROLES})
    return out


def stream(p):
    """Pasa la salida de un proceso a la pantalla; las lineas que terminan en CR se reescriben (progreso)."""
    job['proc'] = p
    cur = pending = b''
    while True:
        c = pending or p.stdout.read(1)
        pending = b''
        if not c:
            break
        if c not in b'\r\n':
            cur += c
            continue
        if c == b'\r':                  # en Windows el fin de linea es CRLF: solo un CR suelto es progreso
            pending = p.stdout.read(1)
            if pending == b'\n':
                c, pending = pending, b''
        if cur:
            text = cur.decode(errors='replace')
            if text.startswith('PUERTO LIBRE') and job['reconnect'] and not job['port_free']:
                job['port_free'] = True                      # lo que queda es local: el cohete vuelve al monitor ya
                threading.Thread(target=job['reconnect'], daemon=True).start()
            with lock:
                progress = job['lines'] and job['lines'][-1].startswith('~')
                if c == b'\r':
                    if progress:
                        job['lines'][-1] = '~' + text
                    else:
                        job['lines'].append('~' + text)
                else:
                    if progress:
                        job['lines'].pop()
                    job['lines'].append(text)
        cur = b''
    return p.wait()


def run_tbget(role, args, then=None):
    """Corre tbget.py con el puerto libre, luego el comando then si todo fue bien, y vuelve a conectar."""
    port = job['port']
    was = role in links

    def reconnect():                      # al reiniciarse la placa el puerto desaparece unos segundos
        for intento in range(25):
            try:
                connect(role, port)
                return
            except Exception as e:
                if intento == 24:
                    event(f'{role}: no pude reconectar ({e})')
                time.sleep(0.4)

    with lock:
        job['lines'].append('soltando el puerto del monitor...')
        job.update(port_free=False, reconnect=reconnect if was else None)
    disconnect(role)
    popen = lambda cmd: subprocess.Popen(cmd, cwd=HERE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    rc = -1
    try:
        rc = stream(popen([sys.executable, '-u', os.path.join(HERE, 'tbget.py'), port] + args))
        event(f'{role}: tbget termino con codigo {rc}')
        if rc == 0 and then:
            rc = stream(popen([sys.executable, '-u'] + then))
    except OSError as e:
        event(f'{role}: no arranco ({e})')
    with lock:
        job['proc'] = None
    if was and not job['port_free']:
        job['port_free'] = True
        reconnect()
    with lock:
        job.update(running=False, role=role, rc=rc, reconnect=None)


def list_ports():
    if demo or replay:
        return list(ROLES.values())
    from serial.tools import list_ports as lp
    return sorted(p.device for p in lp.comports())


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, code, body, ctype='application/json'):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def trusted(self):
        """Solo esta misma pagina: otra web abierta en el navegador no puede mandar comandos."""
        ok = (f'127.0.0.1:{PORT}', f'localhost:{PORT}')
        origin = self.headers.get('Origin')
        return self.headers.get('Host') in ok and (origin is None or origin.split('://')[-1] in ok)

    def sse(self, mision):
        """Stream SSE de web-1 de una mision (05 §1): `id` = contador por mision, `event` = tipo, `data` = JSON.
        Sin Last-Event-ID, solo lo nuevo (el estado actual lo da el snapshot); con el, repite lo que aun guarda el bus."""
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Accel-Buffering', 'no')
        self.end_headers()
        self.close_connection = True
        self.connection.settimeout(10.0)                   # un cliente que no lee no debe dejar el hilo colgado
        b = bus[mision]
        try:
            last = int(self.headers.get('Last-Event-ID', ''))
        except ValueError:
            last = None
        meta = json.dumps(web_snapshot(mision)['meta'], ensure_ascii=False, separators=(',', ':'))
        try:
            self.wfile.write(f'event: meta\ndata: {meta}\n\n'.encode())      # bienvenida, sin id: no mueve el cursor
            with bus_cond:
                cursor = last if last is not None and 0 <= last <= b['seq'] else b['seq']
            while True:
                with bus_cond:
                    pend = [m for m in b['buf'] if m[0] > cursor]
                    if not pend:
                        bus_cond.wait(WEB_SSE_LATIDO_S)
                        pend = [m for m in b['buf'] if m[0] > cursor]
                if pend:
                    self.wfile.write(''.join(f'id: {i}\nevent: {t}\ndata: {d}\n\n' for i, t, d in pend).encode())
                    cursor = pend[-1][0]
                else:
                    self.wfile.write(b': ping\n\n')
        except OSError:                                    # el navegador cerro la pagina
            pass

    def archivo(self, full):
        """Un archivo de dist/, con Range (el PMTiles del mapa lo necesita)."""
        size = os.path.getsize(full)
        ctype = MIME.get(os.path.splitext(full)[1].lower(), 'application/octet-stream')
        m = re.fullmatch(r'bytes=(\d*)-(\d*)', self.headers.get('Range') or '')
        start, end, code = 0, size - 1, 200
        if m and (m.group(1) or m.group(2)):
            if m.group(1):
                start, end = int(m.group(1)), min(int(m.group(2) or size - 1), size - 1)
            else:
                start = max(0, size - int(m.group(2)))
            if start > end:
                return self.reply(416, {'error': 'rango no valido'})
            code = 206
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-store')
        if code == 206:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        try:
            with open(full, 'rb') as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    d = f.read(min(65536, left))
                    if not d:
                        break
                    self.wfile.write(d)
                    left -= len(d)
        except OSError:
            pass

    def do_GET(self):
        if not self.trusted():
            return self.reply(403, {'error': 'origen no permitido'})
        path = self.path.split('?')[0]
        m = re.fullmatch(r'/api/v1/(demeter|hermes)/(snapshot|stream)', path)
        if m:
            if m.group(2) == 'snapshot':
                return self.reply(200, web_snapshot(m.group(1)))
            return self.sse(m.group(1))
        if self.path == '/':
            with open(os.path.join(HERE, 'dashboard.html'), 'rb') as f:
                return self.reply(200, f.read(), 'text/html; charset=utf-8')
        if self.path == '/api/state':
            return self.reply(200, snapshot())
        if self.path == '/api/ports':
            return self.reply(200, list_ports())
        if self.path == '/api/raw':
            with lock:
                return self.reply(200, {r: list(raw_lines[r]) for r in ROLES})
        if self.path == '/api/mission':
            data = {}
            if os.path.exists(MISSION_FILE):
                with open(MISSION_FILE, encoding='utf-8') as f:
                    data = json.load(f)
            return self.reply(200, data)
        if path.startswith(('/web', '/demeter', '/hermes', '/assets', '/mapas')):     # la web de gui/web (T-662)
            full = web_archivo(path)
            if full:
                return self.archivo(full)
            if not os.path.isfile(os.path.join(WEB_DIST, 'index.html')):
                return self.reply(404, '<meta charset="utf-8"><p style="font:16px system-ui;padding:20px">La web no esta compilada: compila la web con <code>npm run web:build</code> (desde la raiz del repo).</p>'.encode(), 'text/html; charset=utf-8')
        self.reply(404, {'error': 'no existe'})

    def do_POST(self):
        if not self.trusted() or self.headers.get('Content-Type') != 'application/json':
            return self.reply(403, {'error': 'origen no permitido'})
        a = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        try:
            if self.path == '/api/cmd':
                global ask
                l = links.get('tierra')
                if not l or not l.alive:
                    return self.reply(409, {'error': 'tierra sin conectar'})
                web_llamar(tr.comando, a['line'])       # para que go_nogo sepa a que orden responde el [cmd ]
                l.write(a['line'])
                event('> ' + a['line'])
                if a['line'] in ('si', 'no'):
                    with lock:
                        ask = None
            elif self.path == '/api/clear':
                with lock:
                    events.clear()
            elif self.path == '/api/tbget/abort':
                if job['proc']:
                    job['proc'].kill()
                    with lock:
                        job['lines'].append('ABORTADA. Lo bajado queda en .part y se retoma la proxima vez. La placa sigue en modo descarga: usa Reset, o se reinicia sola en 2 min.')
            elif self.path == '/api/connect':
                connect(a['role'], a['port'])
            elif self.path == '/api/disconnect':
                disconnect(a['role'])
            elif self.path == '/api/mission':
                with open(MISSION_FILE, 'w', encoding='utf-8') as f:
                    json.dump(a, f, indent=1, ensure_ascii=False)
            elif self.path == '/api/calib/accept':
                os.replace(calib_path(a['role'], True), calib_path(a['role'], False))
                event(f"{a['role']}: calibracion aceptada: {os.path.basename(calib_path(a['role'], False))}")
            elif self.path in ('/api/tbget', '/api/calib/run'):
                role = a['role']
                if demo:
                    return self.reply(409, {'error': 'en modo demo no hay descarga'})
                if job['running']:
                    return self.reply(409, {'error': 'ya hay una descarga en curso'})
                rid = {'demeter': 1, 'hermes': 2}[role]
                t = telem.get(rid)
                if t and time.time() - t['t'] < STALE_S and t['state'] in (2, 3):
                    return self.reply(409, {'error': f'{role} esta en {STATES[t["state"]]}: descargar detendria el registro'})
                if self.path == '/api/calib/run' and not re.fullmatch(r'[\w]+\.BIN', a['name']):
                    return self.reply(400, {'error': 'nombre de archivo invalido'})
                port = links[role].port if role in links else ROLES[role]
                if port not in list_ports():
                    return self.reply(409, {'error': f'{role}: no veo {port}. Conecta el USB y, si cambio de puerto, escogelo arriba y dale Conectar.'})
                if self.path == '/api/calib/run' and os.path.exists(calib_path(role, True)):
                    os.remove(calib_path(role, True))        # un resultado viejo no debe poder aceptarse si este falla
                # El aviso aparece antes de soltar el puerto; list y get salen con reset para que la placa no quede en modo descarga
                args = ['get', a['name'], '--reset'] if self.path == '/api/calib/run' else a['args'] + ([] if a['args'][0] == 'reset' else ['--reset'])
                with lock:
                    job.update(running=True, role=role, port=port, rc=None, lines=[f'> tbget {port} ' + ' '.join(args)])
                if self.path == '/api/calib/run':
                    then = [os.path.join(HERE, 'calib.py'), a['name'], '--salida', calib_path(role, True)]
                    threading.Thread(target=run_tbget, args=(role, args, then), daemon=True).start()
                else:
                    threading.Thread(target=run_tbget, args=(role, args), daemon=True).start()
            else:
                return self.reply(404, {'error': 'no existe'})
            self.reply(200, {'ok': True})
        except Exception as e:
            self.reply(500, {'error': str(e)})


class OnlyOneServer(ThreadingHTTPServer):
    """En Windows, con reuse dos instancias comparten el puerto y responde cualquiera de ellas."""
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    global demo, PORT, WEB_DIST, replay, replay_vel
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--demo', action='store_true')
    ap.add_argument('--no-abrir', action='store_true')
    ap.add_argument('--puerto', type=int, default=PORT)
    ap.add_argument('--reproducir', metavar='SESION', help='repite una sesion de tierra guardada (sesiones/AAAAMMDD_HHMMSS_tierra.txt) en vez de leer el puerto')
    ap.add_argument('--velocidad', type=float, default=1.0, help='con --reproducir: 2 = al doble de la velocidad real')
    ap.add_argument('--web-dist', default=WEB_DIST, help='carpeta con el build de la web (por defecto gui/web/dist)')
    a = ap.parse_args()
    demo = a.demo
    PORT = a.puerto
    WEB_DIST = os.path.abspath(a.web_dist)
    replay, replay_vel = a.reproducir, a.velocidad
    try:
        srv = OnlyOneServer(('127.0.0.1', PORT), Handler)
    except OSError:
        raise SystemExit(f'El puerto {PORT} esta ocupado: ya hay un dashboard abierto. Cierralo primero (Ctrl+C en su ventana), o usa --puerto 8766.')
    threading.Thread(target=web_tick, daemon=True).start()
    if demo or replay:                          # sin placas: la estacion arranca conectada para ver las paginas de mision
        connect('tierra', ROLES['tierra'])
    print(f'http://127.0.0.1:{PORT}' + ('  (demo)' if demo else '  (reproduccion)' if replay else ''))
    if not a.no_abrir:
        webbrowser.open(f'http://127.0.0.1:{PORT}')
    srv.serve_forever()


if __name__ == '__main__':
    main()
