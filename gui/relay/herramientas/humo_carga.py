# Herramienta manual de T-640 (criterio 14): humo de carga, NO es la prueba de T-643. Ver gui/relay/README.md.
"""Criterio 14: humo de carga. N clientes SSE contra el relay real durante un vuelo repetido.
Uso: python carga.py <repo> <carpeta de trabajo> <N clientes> <vueltas> <velocidad>"""
import asyncio, json, os, shutil, statistics, subprocess, sys, time, urllib.request

repo, trabajo, N, vueltas, vel = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5]
TOKEN = 'token-e2e-0123456789abcdef'
datos = os.path.join(trabajo, 'datos_carga')
shutil.rmtree(datos, ignore_errors=True)
os.makedirs(trabajo, exist_ok=True)
py = sys.executable
env = dict(os.environ, WEB_INGESTA_TOKEN=TOKEN, WEB_RELAY_DATOS=datos, WEB_SSE_MAX_POR_IP=str(N + 50))
relay = subprocess.Popen([py, 'servidor.py'], cwd=os.path.join(repo, 'gui', 'relay'), env=env,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(100):
    try:
        urllib.request.urlopen('http://127.0.0.1:8787/api/v1/salud', timeout=1).read()
        break
    except OSError:
        time.sleep(0.1)

lat, tam, cuentas = [], [], {'conexiones': 0, 'cierres': 0, 'estados': 0, 'errores': 0}
fin = False


async def cliente(mision):
    global fin
    ultimo = None
    while not fin:
        try:
            r, w = await asyncio.open_connection('127.0.0.1', 8787)
            cab = f'GET /api/v1/{mision}/stream HTTP/1.1\r\nHost: x\r\nAccept: text/event-stream\r\n'
            if ultimo is not None:
                cab += f'Last-Event-ID: {ultimo}\r\n'
            w.write((cab + '\r\n').encode())
            cuentas['conexiones'] += 1
            bloque = []
            while not fin:
                linea = await asyncio.wait_for(r.readline(), 30)
                if not linea:
                    cuentas['cierres'] += 1
                    break
                t = linea.decode().rstrip('\r\n')
                if t:
                    bloque.append(t)
                    continue
                ev = {a: b for a, _, b in (x.partition(': ') for x in bloque if not x.startswith(':') and ': ' in x)}
                bloque = []
                if ev.get('event') == 'estado':
                    ahora = time.time() * 1000
                    d = json.loads(ev['data'])
                    lat.append(ahora - d['relay_utc_ms'])
                    cuentas['estados'] += 1
                    if len(tam) < 3:
                        tam.append(len(ev['data'].encode()))
                if 'id' in ev:
                    ultimo = ev['id']
            w.close()
        except (OSError, asyncio.TimeoutError):
            cuentas['errores'] += 1
            await asyncio.sleep(0.5)


async def principal():
    global fin
    tareas = [asyncio.create_task(cliente('demeter' if i % 2 == 0 else 'hermes')) for i in range(N)]
    await asyncio.sleep(2)
    cmd = [py, 'alimentar.py', '../web/dev/datos/demeter_nominal.jsonl', '../web/dev/datos/hermes_nominal.jsonl',
           '--velocidad', vel, '--vueltas', vueltas]
    p = await asyncio.create_subprocess_exec(*cmd, cwd=os.path.join(repo, 'gui', 'relay'), env=env,
                                             stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
    t0 = time.time()
    out, _ = await p.communicate()
    print(out.decode().strip())
    print(f'alimentar: {time.time() - t0:.1f} s')
    await asyncio.sleep(2)
    fin = True
    for t in tareas:
        t.cancel()
    await asyncio.gather(*tareas, return_exceptions=True)


try:
    asyncio.run(principal())
    lat.sort()
    h = json.load(urllib.request.urlopen('http://127.0.0.1:8787/api/v1/salud'))
    print('clientes', N, 'cuentas', cuentas)
    if lat:
        q = lambda p: lat[min(len(lat) - 1, int(len(lat) * p))]
        print(f'latencia ms (relay_utc_ms -> recepcion): n={len(lat)} p50={q(.5):.1f} p95={q(.95):.1f} p99={q(.99):.1f} max={lat[-1]:.1f}')
    print('bytes de data de un estado:', tam)
    print({m: (v['seq_relay'], v['clientes_sse']) for m, v in h['misiones'].items()}, h['ingesta'])
finally:
    relay.kill()
