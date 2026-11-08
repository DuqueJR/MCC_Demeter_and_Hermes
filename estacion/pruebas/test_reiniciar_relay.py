"""Pruebas de `estacion/reiniciar_relay.sh` (T-673). Solo unittest y la biblioteca estandar. NUNCA toca Fly ni el relay real.

Cada prueba levanta un relay LOCAL de verdad (`gui/relay/servidor.py` en 127.0.0.1 y un puerto libre, con un token de prueba y
`WEB_RELAY_DATOS` en una carpeta temporal), lo llena con `gui/relay/alimentar.py` y corre el script con `SIN_FLY=1`. La rama de
Fly se prueba con un `fly` FALSO (un ejecutable en el PATH que imita `fly ssh console/sftp`, `machine list/start` y
`apps restart` sobre esa misma carpeta temporal y anota cada llamada).

Cubre: rechazo con un dashboard corriendo, que sin confirmacion no se borre nada (sin terminal; con otra respuesta que no sea
BORRAR), que si el respaldo falla no se borre nada, el camino feliz (respaldo, cola archivada, jsonl borrados, relay en ceros,
resumen) y el camino de Fly (con respaldo por base64 cuando sftp falla).

Necesita bash y un python con las dependencias del relay (`gui/relay/requirements.txt`): el de `gui/relay/.venv`, el de la
variable RELAY_PYTHON o, si no, el que corre la prueba. Si no hay ninguno, se salta. No se puede correr con un `dashboard.py`
real abierto (el script se negaria a proceder, que es justo lo que protege).

Correr desde la raiz del repo:  python -m unittest estacion.pruebas.test_reiniciar_relay -v   (o desde estacion/pruebas)
"""
import json
import os
import pty
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / 'estacion' / 'reiniciar_relay.sh'
RELAY_DIR = REPO / 'gui' / 'relay'
DATOS_WEB = REPO / 'gui' / 'web' / 'dev' / 'datos'
TOKEN = 'ab' * 32           # 64 caracteres, como el real
BASH = '/bin/bash' if Path('/bin/bash').exists() else 'bash'

FLY_FALSO = r'''#!{py}
import base64, json, os, sys
datos, log = os.environ['FAKE_FLY_DATOS'], os.environ['FAKE_FLY_LOG']
a = sys.argv[1:]
with open(log, 'a') as f:
    f.write(' '.join(a) + '\n')
def jsonl():
    return sorted(n for n in os.listdir(datos) if n.endswith('.jsonl'))
if a[:2] == ['auth', 'whoami']:
    print('prueba@example.com')
elif a[:2] == ['machine', 'list']:
    if '--json' in a:
        print(json.dumps([{{'id': 'm123abc', 'state': os.environ.get('FAKE_FLY_ESTADO', 'started')}}]))
    else:
        sys.stdout.write('   m123abc   \n\n')
elif a[:2] == ['machine', 'start']:
    pass
elif a[:2] == ['ssh', 'console']:
    cmd = a[a.index('-C') + 1]
    if cmd == 'ls -la /datos':
        if os.environ.get('FAKE_FLY_LS') == 'falla':
            sys.exit(1)
        print('total 8\ndrwxr-xr-x 2 root root 4096 Nov  8 10:00 .\ndrwxr-xr-x 1 root root 4096 Nov  8 10:00 ..')
        for n in jsonl():
            print('-rw-r--r-- 1 root root %d Nov  8 10:00 %s' % (os.path.getsize(os.path.join(datos, n)), n))
    elif cmd == 'ls /datos':
        print('\n'.join(jsonl()))
    elif cmd.startswith('base64 /datos/'):
        if os.environ.get('FAKE_FLY_BASE64') == 'falla':
            sys.exit(1)
        b = base64.encodebytes(open(os.path.join(datos, cmd.split('/')[-1]), 'rb').read()).decode()
        sys.stdout.write(b.replace('\n', '\r\n'))      # como un pty
    elif cmd == "sh -c 'rm -f /datos/*.jsonl'":
        for n in jsonl():
            os.remove(os.path.join(datos, n))
    else:
        sys.exit(2)
elif a[:3] == ['ssh', 'sftp', 'get']:
    modo = os.environ.get('FAKE_FLY_SFTP', 'ok')
    if modo == 'falla':
        sys.exit(1)
    datos_b = open(os.path.join(datos, os.path.basename(a[3])), 'rb').read()
    if modo == 'corta':
        datos_b = datos_b[:-5]
    open(a[4], 'wb').write(datos_b)
elif a[:2] == ['apps', 'restart']:
    sys.exit(int(os.environ.get('FAKE_FLY_RESTART_RC', '0')))
else:
    sys.exit(2)
'''


def puerto_libre():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def python_del_relay():
    cand = [os.environ.get('RELAY_PYTHON'), str(RELAY_DIR / '.venv' / 'bin' / 'python'), sys.executable]
    for c in cand:
        if c and Path(c).exists() and subprocess.run(
                [c, '-c', 'import fastapi, uvicorn, sse_starlette, jsonschema'], capture_output=True).returncode == 0:
            return c
    return None


RELAY_PY = python_del_relay()


@unittest.skipUnless(RELAY_PY and Path(BASH).exists(), 'sin un python con las dependencias del relay (gui/relay/requirements.txt)')
class PruebasReiniciarRelay(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix='t673_'))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.datos = self.tmp / 'datos'
        self.datos.mkdir()
        self.sesiones = self.tmp / 'sesiones_relay'
        self.cola = self.tmp / 'cola_web.db'
        self.puerto = puerto_libre()
        self.url = f'http://127.0.0.1:{self.puerto}'
        self.relay = None
        self.procs = []
        self.addCleanup(self._limpiar)
        self.arrancar_relay()
        self.llenar_relay()
        # La cola local del reenviador (con sus -wal y -shm), con contenido reconocible.
        for suf, txt in (('', 'db'), ('-wal', 'wal'), ('-shm', 'shm')):
            Path(str(self.cola) + suf).write_text('cola ' + txt)

    # ---------- utilidades ----------
    def _limpiar(self):
        for p in self.procs + ([self.relay] if self.relay else []):
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(5)
                except subprocess.TimeoutExpired:
                    p.kill()

    def salud(self):
        with urllib.request.urlopen(self.url + '/api/v1/salud', timeout=5) as r:
            return json.load(r)

    def arrancar_relay(self):
        env = {**os.environ, 'WEB_INGESTA_TOKEN': TOKEN, 'WEB_RELAY_DATOS': str(self.datos),
               'WEB_RELAY_HOST': '127.0.0.1', 'WEB_RELAY_PUERTO': str(self.puerto)}
        self.relay = subprocess.Popen([RELAY_PY, 'servidor.py'], cwd=RELAY_DIR, env=env,
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        limite = time.time() + 30
        while time.time() < limite:
            try:
                if self.salud().get('estado') == 'ok':
                    return
            except Exception:
                time.sleep(0.2)
        self.fail('el relay local no arranco')

    def reiniciar_relay_local(self):
        self.relay.terminate()
        self.relay.wait(10)
        self.arrancar_relay()

    def llenar_relay(self):
        env = {**os.environ, 'WEB_INGESTA_TOKEN': TOKEN}
        r = subprocess.run([RELAY_PY, 'alimentar.py', str(DATOS_WEB / 'demeter_nominal.jsonl'),
                            str(DATOS_WEB / 'hermes_nominal.jsonl'), '--url', self.url, '--velocidad', '2000'],
                           cwd=RELAY_DIR, env=env, capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        s = self.salud()
        for m in ('demeter', 'hermes'):
            self.assertGreater(s['misiones'][m]['seq_relay'], 0)
        self.assertGreater(s['ingesta']['lotes'], 0)
        self.assertTrue(list(self.datos.glob('*.jsonl')))
        self.originales = {p.name: p.read_bytes() for p in self.datos.glob('*.jsonl')}

    def entorno(self, **extra):
        e = {**os.environ, 'NO_COLOR': '1', 'RELAY_URL': self.url, 'SESIONES_RELAY_DIR': str(self.sesiones),
             'COLA_WEB_DB': str(self.cola), 'PYTHON_ESTACION': sys.executable, 'ESPERA_SALUD_S': '12',
             'SIN_FLY': '1', 'RELAY_DATOS_LOCAL': str(self.datos)}
        e.pop('RELAY_MAQUINA', None)
        e.update(extra)
        return e

    def lanzar(self, args=(), tty=False, **extra):
        """Lanza el script. Con tty=True su stdin es una terminal (pty) y se devuelve (proceso, fd maestro)."""
        maestro = None
        if tty:
            maestro, esclavo = pty.openpty()
            stdin = esclavo
        else:
            stdin = subprocess.DEVNULL
        p = subprocess.Popen([BASH, str(SCRIPT), *args], stdin=stdin, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                             env=self.entorno(**extra), text=True)
        self.procs.append(p)
        if tty:
            os.close(esclavo)
        return p, maestro

    def terminar(self, p, maestro=None, timeout=90):
        salida, _ = p.communicate(timeout=timeout)
        if maestro is not None:
            os.close(maestro)
        return p.returncode, salida

    def correr(self, args=(), **extra):
        p, _ = self.lanzar(args, **extra)
        return self.terminar(p)

    def esperar_borrado(self, p, timeout=60):
        """Espera a que el script borre los jsonl del relay local (o termine)."""
        limite = time.time() + timeout
        while time.time() < limite and p.poll() is None and list(self.datos.glob('*.jsonl')):
            time.sleep(0.05)

    def reinicios(self):
        return sorted(self.sesiones.glob('reinicio_*')) if self.sesiones.exists() else []

    def assert_nada_tocado(self):
        """Los jsonl del relay y la cola local siguen exactamente como estaban y no hay carpeta de reinicio."""
        self.assertEqual({p.name: p.read_bytes() for p in self.datos.glob('*.jsonl')}, self.originales)
        for suf, txt in (('', 'db'), ('-wal', 'wal'), ('-shm', 'shm')):
            self.assertEqual(Path(str(self.cola) + suf).read_text(), 'cola ' + txt)
        self.assertEqual(self.reinicios(), [])
        self.assertGreater(self.salud()['misiones']['demeter']['seq_relay'], 0)

    def assert_en_ceros(self):
        s = self.salud()
        for m in ('demeter', 'hermes'):
            self.assertEqual(s['misiones'][m]['seq_relay'], 0)
            self.assertIsNone(s['misiones'][m]['mission_id'])
            with urllib.request.urlopen(f'{self.url}/api/v1/{m}/snapshot', timeout=5) as r:
                self.assertFalse(json.load(r).get('estado'))
        self.assertEqual(s['ingesta']['lotes'], 0)

    def assert_respaldo_completo(self, carpeta):
        for nombre, datos in self.originales.items():
            self.assertEqual((carpeta / nombre).read_bytes(), datos, nombre)
        for f in ('salud_antes.json', 'snapshot_demeter.json', 'snapshot_hermes.json', 'resumen.txt'):
            self.assertTrue((carpeta / f).is_file(), f)
        antes = json.loads((carpeta / 'salud_antes.json').read_text())
        self.assertGreater(antes['misiones']['demeter']['seq_relay'], 0)
        for suf, txt in (('', 'db'), ('-wal', 'wal'), ('-shm', 'shm')):
            self.assertEqual((carpeta / 'cola_vieja' / ('cola_web.db' + suf)).read_text(), 'cola ' + txt)

    # ---------- las pruebas ----------
    def test_ayuda(self):
        rc, salida = self.correr(['--ayuda'])
        self.assertEqual(rc, 0)
        for palabra in ('BORRAR', '--si-borrar', 'UNICA EXCEPCION', 'cola_vieja'):
            self.assertIn(palabra, salida)
        self.assert_nada_tocado()

    def test_opcion_desconocida(self):
        rc, salida = self.correr(['--borra-ya'])
        self.assertEqual(rc, 1)
        self.assertIn('Opcion desconocida', salida)
        self.assert_nada_tocado()

    def test_rechaza_con_dashboard_corriendo(self):
        falso = self.tmp / 'dashboard.py'
        falso.write_text('import time\ntime.sleep(120)\n')
        dash = subprocess.Popen([sys.executable, str(falso)])
        self.procs.append(dash)
        time.sleep(0.5)
        rc, salida = self.correr(['--si-borrar'])
        self.assertEqual(rc, 1, salida)
        self.assertIn('dashboard.py corriendo', salida)
        self.assertIn('Cierra el dashboard', salida)
        self.assertIsNone(dash.poll(), 'el script no debe cerrar el dashboard por su cuenta')
        self.assert_nada_tocado()
        dash.terminate()
        dash.wait(5)

    def test_un_editor_con_dashboard_py_no_cuenta(self):
        """Solo un python que EJECUTA dashboard.py bloquea; algo que solo lo menciona (un editor, `less`) no."""
        falso = subprocess.Popen(['/bin/sh', '-c', 'sleep 120', 'dashboard.py'])
        self.procs.append(falso)
        time.sleep(0.3)
        p, m = self.lanzar(['--si-borrar'])
        self.esperar_borrado(p)
        self.reiniciar_relay_local()
        rc, salida = self.terminar(p, m)
        self.assertEqual(rc, 0, salida)

    def test_sin_terminal_no_borra(self):
        rc, salida = self.correr()
        self.assertEqual(rc, 1, salida)
        self.assertIn('Sin terminal interactiva: no borro nada', salida)
        self.assertIn('--si-borrar', salida)
        self.assert_nada_tocado()

    def test_otra_respuesta_cancela(self):
        for resp in ('s', 'si', 'borrar', 'BORRAR YA', '', 'y'):
            with self.subTest(respuesta=resp):
                p, m = self.lanzar(tty=True)
                os.write(m, resp.encode() + b'\n')
                rc, salida = self.terminar(p, m)
                self.assertEqual(rc, 1, salida)
                self.assertIn('Cancelado', salida)
                self.assertIn('No se toco nada', salida)
                self.assert_nada_tocado()

    def test_respaldo_que_falla_no_borra_nada(self):
        """Un jsonl que no se puede leer: el respaldo falla y el script se detiene antes de borrar o mover nada."""
        ilegible = self.datos / 'hermes.jsonl'
        self.assertTrue(ilegible.exists())
        os.chmod(ilegible, 0)
        self.addCleanup(os.chmod, ilegible, 0o644)
        rc, salida = self.correr(['--si-borrar'])
        self.assertEqual(rc, 1, salida)
        self.assertIn('el respaldo fallo', salida)
        self.assertIn('No se borro NADA del relay', salida)
        os.chmod(ilegible, 0o644)
        # Los datos del relay y la cola local siguen intactos (la carpeta de reinicio SI existe, con el resumen del aborto).
        self.assertEqual({p.name: p.read_bytes() for p in self.datos.glob('*.jsonl')}, self.originales)
        for suf, txt in (('', 'db'), ('-wal', 'wal'), ('-shm', 'shm')):
            self.assertEqual(Path(str(self.cola) + suf).read_text(), 'cola ' + txt)
        self.assertFalse((self.reinicios()[0] / 'cola_vieja').exists())
        resumen = (self.reinicios()[0] / 'resumen.txt').read_text()
        self.assertIn('ABORTADO', resumen)
        self.assertIn('Borrado de /datos/*.jsonl: NO', resumen)
        self.assertGreater(self.salud()['misiones']['demeter']['seq_relay'], 0)

    def test_camino_feliz_con_si_borrar(self):
        p, m = self.lanzar(['--si-borrar'])
        self.esperar_borrado(p)
        self.assertEqual(list(self.datos.glob('*.jsonl')), [])
        self.reiniciar_relay_local()                       # el relay local se reinicia "a mano"
        rc, salida = self.terminar(p, m)
        self.assertEqual(rc, 0, salida)
        self.assertIn('RELAY EN CEROS', salida)
        self.assertIn('Cmd+Shift+R', salida)
        self.assertIn('iniciar_sesion.sh', salida)
        self.assertIn('REINICIALO A MANO', salida)
        self.assert_en_ceros()
        carpetas = self.reinicios()
        self.assertEqual(len(carpetas), 1)
        self.assert_respaldo_completo(carpetas[0])
        for suf in ('', '-wal', '-shm'):
            self.assertFalse(Path(str(self.cola) + suf).exists(), 'la cola se mueve, no se queda')
        resumen = (carpetas[0] / 'resumen.txt').read_text()
        self.assertIn('RESULTADO: RELAY EN CEROS', resumen)
        self.assertIn('Borrado de /datos/*.jsonl: SI', resumen)
        self.assertIn('demeter.jsonl', resumen)

    def test_camino_feliz_escribiendo_borrar(self):
        p, m = self.lanzar(tty=True)
        os.write(m, b'BORRAR\n')
        self.esperar_borrado(p)
        self.reiniciar_relay_local()
        os.write(m, b'\n')                                  # "ya lo reinicie"
        rc, salida = self.terminar(p, m)
        self.assertEqual(rc, 0, salida)
        self.assertIn('RELAY EN CEROS', salida)
        self.assert_en_ceros()
        self.assert_respaldo_completo(self.reinicios()[0])

    def test_relay_ya_en_ceros_tambien_funciona(self):
        """Si no hay datos que borrar, el script igual termina bien (y archiva la cola)."""
        for f in self.datos.glob('*.jsonl'):
            f.unlink()
        self.reiniciar_relay_local()
        self.originales = {}
        rc, salida = self.correr(['--si-borrar'])
        self.assertEqual(rc, 0, salida)
        self.assertIn('RELAY EN CEROS', salida)
        self.assertIn('no tiene ningun .jsonl', salida)
        self.assertEqual((self.reinicios()[0] / 'cola_vieja' / 'cola_web.db').read_text(), 'cola db')

    def test_si_el_relay_no_queda_en_ceros_falla_claro(self):
        """Nadie reinicia el relay local: sigue con el estado viejo en memoria y el script lo detecta y falla."""
        rc, salida = self.correr(['--si-borrar'], ESPERA_SALUD_S='4')
        self.assertEqual(rc, 1, salida)
        self.assertIn('NO quedo en ceros', salida)
        self.assertIn('seq_relay=', salida)
        self.assertNotIn('RELAY EN CEROS', salida)
        self.assertEqual(list(self.datos.glob('*.jsonl')), [])      # se borro, pero lo viejo esta respaldado
        self.assert_respaldo_completo(self.reinicios()[0])
        resumen = (self.reinicios()[0] / 'resumen.txt').read_text()
        self.assertIn('NO QUEDO EN CEROS', resumen)

    def test_sin_fly_pide_relay_local_y_carpeta(self):
        rc, salida = self.correr(['--si-borrar'], RELAY_URL='https://api.eiaspice.space')
        self.assertEqual(rc, 1)
        self.assertIn('solo para un relay local', salida)
        rc, salida = self.correr(['--si-borrar'], RELAY_DATOS_LOCAL='')
        self.assertEqual(rc, 1)
        self.assertIn('RELAY_DATOS_LOCAL', salida)
        self.assert_nada_tocado()

    # ---------- la rama de Fly, con un `fly` falso ----------
    def con_fly_falso(self, **extra):
        """Un `fly` falso en el PATH. Devuelve el entorno extra y la ruta del registro de llamadas."""
        bin_dir = self.tmp / 'bin'
        bin_dir.mkdir(exist_ok=True)
        fly = bin_dir / 'fly'
        fly.write_text(FLY_FALSO.format(py=sys.executable))
        fly.chmod(0o755)
        log = self.tmp / 'fly.log'
        log.write_text('')
        env = dict(PATH=f'{bin_dir}{os.pathsep}{os.environ["PATH"]}', FAKE_FLY_DATOS=str(self.datos), FAKE_FLY_LOG=str(log),
                   SIN_FLY='0', RELAY_DATOS_LOCAL='')
        env.update(extra)
        return env, log

    def llamadas(self, log):
        return [l for l in log.read_text().splitlines() if l]

    def test_fly_camino_feliz_con_maquina_parada(self):
        env, log = self.con_fly_falso(FAKE_FLY_ESTADO='stopped')
        p, m = self.lanzar(['--si-borrar'], **env)
        self.esperar_borrado(p)
        self.reiniciar_relay_local()
        rc, salida = self.terminar(p, m)
        self.assertEqual(rc, 0, salida)
        self.assertIn('maquina del relay: m123abc', salida)
        self.assertIn("La maquina esta 'stopped'", salida)
        self.assertIn('RELAY EN CEROS', salida)
        ll = self.llamadas(log)
        orden = [i for i, l in enumerate(ll) if l.startswith(('machine start', 'ssh sftp get', "ssh console -a hermes-demeter-relay "
                                                                "--machine m123abc -C sh -c 'rm", 'apps restart'))]
        textos = [ll[i] for i in orden]
        self.assertTrue(textos[0].startswith('machine start m123abc'), ll)
        self.assertEqual(sum(t.startswith('ssh sftp get') for t in textos), 2, ll)
        self.assertTrue(textos[-2].startswith('ssh console') and 'rm -f /datos/*.jsonl' in textos[-2], ll)
        self.assertEqual(textos[-1], 'apps restart hermes-demeter-relay', ll)
        self.assert_respaldo_completo(self.reinicios()[0])
        self.assert_en_ceros()

    def test_fly_sftp_corto_usa_base64(self):
        env, log = self.con_fly_falso(FAKE_FLY_SFTP='corta')
        p, m = self.lanzar(['--si-borrar'], **env)
        self.esperar_borrado(p)
        self.reiniciar_relay_local()
        rc, salida = self.terminar(p, m)
        self.assertEqual(rc, 0, salida)
        self.assertIn('sftp no dejo la copia completa', salida)
        self.assertTrue(any('base64 /datos/' in l for l in self.llamadas(log)))
        self.assert_respaldo_completo(self.reinicios()[0])

    def test_fly_respaldo_que_falla_no_borra_ni_reinicia(self):
        env, log = self.con_fly_falso(FAKE_FLY_SFTP='falla', FAKE_FLY_BASE64='falla')
        rc, salida = self.correr(['--si-borrar'], **env)
        self.assertEqual(rc, 1, salida)
        self.assertIn('el respaldo fallo', salida)
        ll = self.llamadas(log)
        self.assertFalse(any('rm -f' in l for l in ll), ll)
        self.assertFalse(any(l.startswith('apps restart') for l in ll), ll)
        self.assertEqual({p.name: p.read_bytes() for p in self.datos.glob('*.jsonl')}, self.originales)
        for suf, txt in (('', 'db'), ('-wal', 'wal'), ('-shm', 'shm')):
            self.assertEqual(Path(str(self.cola) + suf).read_text(), 'cola ' + txt)
        self.assertGreater(self.salud()['misiones']['demeter']['seq_relay'], 0)

    def test_fly_sin_listar_datos_no_borra(self):
        env, log = self.con_fly_falso(FAKE_FLY_LS='falla')
        rc, salida = self.correr(['--si-borrar'], **env)
        self.assertEqual(rc, 1, salida)
        self.assertIn('No pude listar /datos', salida)
        self.assertFalse(any('rm -f' in l for l in self.llamadas(log)))
        self.assertEqual({p.name: p.read_bytes() for p in self.datos.glob('*.jsonl')}, self.originales)

    def test_fly_restart_que_falla_lo_dice(self):
        env, log = self.con_fly_falso(FAKE_FLY_RESTART_RC='1')
        rc, salida = self.correr(['--si-borrar'], **env)
        self.assertEqual(rc, 1, salida)
        self.assertIn('fly apps restart fallo', salida)
        self.assertIn('REINICIALO YA', salida)
        resumen = (self.reinicios()[0] / 'resumen.txt').read_text()
        self.assertIn('Borrado de /datos/*.jsonl: SI', resumen)
        self.assert_respaldo_completo(self.reinicios()[0])

    def test_fly_sin_confirmacion_no_hace_nada(self):
        env, log = self.con_fly_falso()
        rc, salida = self.correr([], **env)                # sin terminal y sin --si-borrar
        self.assertEqual(rc, 1, salida)
        ll = self.llamadas(log)
        self.assertFalse(any(l.startswith(('ssh', 'apps')) for l in ll), ll)
        self.assert_nada_tocado()


if __name__ == '__main__':
    unittest.main()
