# Herramienta manual de T-640 (criterio 13): NO es parte de pytest. Ver gui/relay/README.md.
# Corre con el python del venv del relay, desde cualquier carpeta.
"""Criterio 13b: dashboard.py --reproducir contra el relay real; se corta el relay a mitad y se reinicia con los mismos datos.
Uso: python corte.py <repo> <sesion> <carpeta de trabajo>"""
import http.client, json, os, shutil, subprocess, sys, threading, time, urllib.request

repo, sesion, trabajo = sys.argv[1:4]
TOKEN = 'token-e2e-0123456789abcdef'
datos = os.path.join(trabajo, 'datos_relay')
cola = os.path.join(trabajo, 'cola.db')
shutil.rmtree(datos, ignore_errors=True)
for f in os.listdir(trabajo) if os.path.isdir(trabajo) else []:
    if f.startswith('cola.db'):
        os.remove(os.path.join(trabajo, f))
os.makedirs(trabajo, exist_ok=True)
py_relay = sys.executable      # corre con el python del venv del relay
env = dict(os.environ, WEB_INGESTA_TOKEN=TOKEN, WEB_RELAY_DATOS=datos)


def relay():
    p = subprocess.Popen([py_relay, 'servidor.py'], cwd=os.path.join(repo, 'gui', 'relay'), env=env,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            urllib.request.urlopen('http://127.0.0.1:8787/api/v1/salud', timeout=1).read()
            return p
        except OSError:
            time.sleep(0.1)
    p.kill()
    raise SystemExit('el relay no arranco')


def stream_registro(salida, parar):
    """Se queda conectado al stream de demeter (reconecta) y apunta cada evento."""
    ultimo = None
    while not parar.is_set():
        try:
            c = http.client.HTTPConnection('127.0.0.1', 8787, timeout=3)
            cab = {'Accept': 'text/event-stream'}
            if ultimo is not None:
                cab['Last-Event-ID'] = str(ultimo)
            c.request('GET', '/api/v1/demeter/stream', headers=cab)
            r = c.getresponse()
            buf = []
            while not parar.is_set():
                l = r.fp.readline()
                if not l:
                    break
                l = l.decode().rstrip('\r\n')
                if l:
                    buf.append(l)
                    continue
                campos = {a: b for a, _, b in (x.partition(': ') for x in buf if not x.startswith(':'))}
                buf = []
                if 'event' in campos:
                    if 'id' in campos:
                        ultimo = int(campos['id'])
                    d = json.loads(campos['data'])
                    salida.append((campos.get('id'), campos['event'], d.get('rx_utc_ms'), d.get('t_ms')))
        except OSError:
            time.sleep(0.3)


salida, parar = [], threading.Event()
r1 = relay()
hilo = threading.Thread(target=stream_registro, args=(salida, parar), daemon=True)
hilo.start()
dash = subprocess.Popen([sys.executable, os.path.join(repo, 'estacion', 'dashboard.py'), '--no-abrir', '--puerto', '8899',
                         '--reproducir', sesion, '--velocidad', '6', '--web-relay', 'http://127.0.0.1:8787', '--web-cola', cola],
                        env=env, cwd=repo, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(7)
    s = json.load(urllib.request.urlopen('http://127.0.0.1:8787/api/v1/demeter/snapshot'))
    print('antes del corte: serie', len(s['serie']['t_mas_s']), 'fase', s['estado']['fase'] if s['estado'] else None)
    r1.kill(); r1.wait()
    print('relay cortado')
    time.sleep(6)
    r2 = relay()
    print('relay reiniciado')
    s = json.load(urllib.request.urlopen('http://127.0.0.1:8787/api/v1/demeter/snapshot'))
    print('tras reiniciar: serie', len(s['serie']['t_mas_s']), 'fase', s['estado']['fase'] if s['estado'] else None, '(reconstruido del JSONL)')
    for _ in range(90):
        time.sleep(1)
        if dash.poll() is not None:
            break
    time.sleep(8)       # que se vacie la cola
    esperado = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
    for m in ('demeter', 'hermes'):
        s = json.load(urllib.request.urlopen(f'http://127.0.0.1:8787/api/v1/{m}/snapshot'))
        ts = s['serie']['t_mas_s']
        print(m, 'serie', len(ts), 'eventos', len(s['eventos']), 'fase', s['estado']['fase'])
    h = json.load(urllib.request.urlopen('http://127.0.0.1:8787/api/v1/salud'))
    print('ingesta', h['ingesta'])
    for m, v in h['misiones'].items():
        print(m, {k: v[k] for k in ('seq_relay', 'emitidos', 'guardados_atrasados', 'descartados_repetidos', 'descartados_viejos', 'estados_bajados_de_tasa')})
    parar.set()
    # el stream: nunca un estado atrasado, ids estrictamente crecientes tras la reconexion
    est = [(i, rx, t) for i, tipo, rx, t in salida if tipo == 'estado']
    atras = sum(1 for a, b in zip(est, est[1:]) if b[1] < a[1])
    ids = [int(i) for i, *_ in salida if i is not None]
    print('stream: estados', len(est), 'con rx que retrocede:', atras, '| ids crecientes:', all(b > a for a, b in zip(ids, ids[1:])), '| ids', len(ids))
    r2.kill()
finally:
    for p in (dash,):
        if p.poll() is None:
            p.kill()
    for p in (r1,):
        if p.poll() is None:
            p.kill()
    parar.set()
