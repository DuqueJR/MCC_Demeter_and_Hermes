"""Pruebas de la API local de `estacion/dashboard.py` (T-662). Solo unittest y la biblioteca estandar.

Levanta el dashboard de verdad (un proceso, `--demo` o `--reproducir`) en un puerto libre y le habla por HTTP:
  - `GET /api/v1/{mision}/snapshot` y `/stream` (SSE), validados contra `gui/web/src/contrato/esquema.json`
    con el mismo validador de las pruebas de T-661 (`contrato.py`);
  - la seguridad: solo 127.0.0.1 y `Host` conocido; nada de `..` fuera de dist/;
  - los archivos estaticos de dist/ (tipos MIME, Range) con un dist/ de mentira, para no depender del build.

Correr desde la raiz del repo:  python -m unittest discover -s estacion/pruebas -v
"""
import http.client
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest

import generador as g
import contrato

DASHBOARD = os.path.join(g.RAIZ, 'estacion', 'dashboard.py')
TIPOS = {'meta', 'estado', 'salud', 'estacion', 'evento', 'backfill'}


def puerto_libre():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class Servidor:
    """El dashboard como subproceso. `args` va despues de `--no-abrir --puerto N`."""
    def __init__(self, *args, web_dist=None):
        self.puerto = puerto_libre()
        cmd = [sys.executable, DASHBOARD, '--no-abrir', '--puerto', str(self.puerto)]
        if web_dist is not None:
            cmd += ['--web-dist', web_dist]
        self.proc = subprocess.Popen(cmd + list(args), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=g.RAIZ)
        t0 = time.time()
        while time.time() - t0 < 15:
            if self.proc.poll() is not None:
                raise RuntimeError('el dashboard no arranco: ' + self.proc.stdout.read().decode(errors='replace'))
            try:
                self.get('/api/state')
                return
            except OSError:
                time.sleep(0.1)
        self.parar()
        raise RuntimeError('el dashboard no respondio en 15 s')

    def conexion(self, timeout=10):
        return http.client.HTTPConnection('127.0.0.1', self.puerto, timeout=timeout)

    def pedir(self, ruta, host=None, cabeceras=None, metodo='GET', cuerpo=None):
        """(codigo, cabeceras, cuerpo). `http.client` no normaliza la ruta: los `..` llegan tal cual."""
        c = self.conexion()
        try:
            c.putrequest(metodo, ruta, skip_host=True)
            c.putheader('Host', host or f'127.0.0.1:{self.puerto}')
            for k, v in (cabeceras or {}).items():
                c.putheader(k, v)
            if cuerpo is not None:
                c.putheader('Content-Length', str(len(cuerpo)))
            c.endheaders(cuerpo)
            r = c.getresponse()
            return r.status, dict((k.lower(), v) for k, v in r.getheaders()), r.read()
        finally:
            c.close()

    def get(self, ruta, **kw):
        return self.pedir(ruta, **kw)

    def snapshot(self, mision):
        codigo, _, cuerpo = self.get(f'/api/v1/{mision}/snapshot')
        assert codigo == 200, codigo
        return json.loads(cuerpo)

    def esperar_estado(self, mision='demeter', minimo=1, segundos=15):
        t0 = time.time()
        while time.time() - t0 < segundos:
            snap = self.snapshot(mision)
            if snap['estado'] is not None and len(snap['serie']['t_mas_s']) >= minimo:
                return snap
            time.sleep(0.2)
        raise AssertionError(f'sin datos de {mision} en {segundos} s')

    def stream(self, mision, n_eventos=8, segundos=6, last_id=None):
        """Lee el SSE hasta `n_eventos` eventos o `segundos`; devuelve (cabeceras, [(id, tipo, datos)])."""
        c = self.conexion(timeout=segundos + 5)
        cab = {'Accept': 'text/event-stream', 'Host': f'127.0.0.1:{self.puerto}'}
        if last_id is not None:
            cab['Last-Event-ID'] = str(last_id)
        c.request('GET', f'/api/v1/{mision}/stream', headers=cab)
        r = c.getresponse()
        eventos, buf, t0 = [], b'', time.time()
        try:
            while len(eventos) < n_eventos and time.time() - t0 < segundos:
                d = r.fp.readline()
                if not d:
                    break
                buf += d
                if buf.endswith(b'\n\n'):
                    ev = dict(l.split(': ', 1) for l in buf.decode().strip().split('\n') if l and not l.startswith(':'))
                    if ev:
                        eventos.append((ev.get('id'), ev['event'], json.loads(ev['data'])))
                    buf = b''
        finally:
            c.close()
        return dict((k.lower(), v) for k, v in r.getheaders()), eventos

    def parar(self):
        self.proc.terminate()
        try:
            self.proc.wait(5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.proc.stdout.close()


class ApiDemo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.dist = os.path.join(cls.tmp, 'dist')
        for ruta, datos in (('index.html', b'<h1>portada</h1>'), ('demeter/index.html', b'<h1>demeter</h1>'), ('hermes/index.html', b'<h1>hermes</h1>'),
                            ('assets/app-1.js', b'export const x = 1;'), ('assets/app-1.css', b'body{}'), ('assets/f.woff2', b'wOF2....'),
                            ('assets/i.webp', b'RIFF'), ('mapas/santa_fe.pmtiles', bytes(range(256)) * 4)):
            os.makedirs(os.path.dirname(os.path.join(cls.dist, ruta)), exist_ok=True)
            with open(os.path.join(cls.dist, ruta), 'wb') as f:
                f.write(datos)
        with open(os.path.join(cls.tmp, 'secreto.txt'), 'w') as f:          # al lado de dist/: no debe salir nunca
            f.write('NO-SALIR')
        cls.srv = Servidor('--demo', web_dist=cls.dist)
        cls.srv.esperar_estado('demeter')

    @classmethod
    def tearDownClass(cls):
        cls.srv.parar()
        shutil.rmtree(cls.tmp, ignore_errors=True)

    # -- snapshot y stream ------------------------------------------------------
    def test_snapshot_de_las_dos_misiones_valido(self):
        for mision in ('demeter', 'hermes'):
            snap = self.srv.esperar_estado(mision)
            self.assertEqual(contrato.errores_snapshot(snap), [], mision)
            self.assertEqual(snap['meta']['mision'], mision)
            self.assertEqual(snap['meta']['proto_version'], 4)
            self.assertIsNotNone(snap['estacion'])
            self.assertIsNotNone(snap['salud'])

    def test_snapshot_json_y_cabeceras(self):
        codigo, cab, _ = self.srv.get('/api/v1/hermes/snapshot')
        self.assertEqual(codigo, 200)
        self.assertEqual(cab['content-type'], 'application/json')
        self.assertEqual(cab['cache-control'], 'no-store')

    def test_mision_desconocida_404(self):
        for ruta in ('/api/v1/marte/snapshot', '/api/v1/marte/stream', '/api/v1/demeter/otra'):
            self.assertEqual(self.srv.get(ruta)[0], 404, ruta)

    def test_stream_eventos_validos(self):
        for mision in ('demeter', 'hermes'):
            cab, eventos = self.srv.stream(mision, n_eventos=10)
            self.assertIn('text/event-stream', cab['content-type'])
            self.assertGreaterEqual(len(eventos), 8, mision)
            self.assertEqual(eventos[0][:2], (None, 'meta'), 'la bienvenida es un meta sin id')
            ids = [int(i) for i, _, _ in eventos[1:]]
            self.assertEqual(ids, sorted(set(ids)), 'los ids crecen sin repetirse')
            for i, tipo, datos in eventos:
                self.assertIn(tipo, TIPOS)
                msg = {'tipo': tipo, 'mision': mision, 'datos': datos}
                self.assertEqual(contrato.errores_mensaje(msg), [], f'{tipo}: {json.dumps(datos)[:200]}')
            self.assertTrue({'estado', 'estacion'} <= {t for _, t, _ in eventos}, 'en ~5 s llegan estado y estacion')

    def test_stream_last_event_id_repite_lo_que_falta(self):
        _, ev = self.srv.stream('demeter', n_eventos=6)
        ids = [int(i) for i, _, _ in ev[1:]]
        corte = ids[2]
        _, rep = self.srv.stream('demeter', n_eventos=3, last_id=corte)
        self.assertEqual(rep[0][1], 'meta')
        repetidos = [int(i) for i, _, _ in rep[1:]]
        self.assertEqual(repetidos[:2], [corte + 1, corte + 2], 'sigue desde el id pedido, sin huecos')
        # un id de otro proceso (mayor que el actual) o basura: empieza desde lo nuevo, sin repetir el pasado
        _, futuro = self.srv.stream('demeter', n_eventos=2, last_id=10**9)
        self.assertTrue(all(int(i) < 10**9 for i, _, _ in futuro[1:]))
        _, basura = self.srv.stream('demeter', n_eventos=2, last_id='abc')
        self.assertEqual(basura[0][1], 'meta')

    def test_streams_abiertos_no_bloquean_al_resto(self):
        """Un SSE ocupa un hilo; varios abiertos a la vez no deben frenar el snapshot ni /api/state."""
        abiertos = []
        try:
            for mision in ('demeter', 'hermes', 'demeter', 'hermes', 'demeter'):
                c = self.srv.conexion(timeout=10)
                c.request('GET', f'/api/v1/{mision}/stream', headers={'Host': f'127.0.0.1:{self.srv.puerto}'})
                r = c.getresponse()
                r.fp.readline()
                abiertos.append(c)
            t0 = time.time()
            self.assertEqual(self.srv.get('/api/state')[0], 200)
            self.assertEqual(self.srv.get('/api/v1/demeter/snapshot')[0], 200)
            self.assertLess(time.time() - t0, 2.0)
        finally:
            for c in abiertos:
                c.close()

    def test_el_traductor_recibe_los_comandos(self):
        """`/api/cmd` llama a `Traductor.comando`; el demo contesta APTO/EJECUTADO y la fase pasa a ARMED en web-1."""
        for linea in ('d armar', 'si'):
            self.assertEqual(self.srv.pedir('/api/cmd', metodo='POST', cabeceras={'Content-Type': 'application/json'},
                                            cuerpo=json.dumps({'line': linea}).encode())[0], 200)
        t0, fase = time.time(), None
        while time.time() - t0 < 8 and fase != 'ARMED':
            fase = self.srv.snapshot('demeter')['estado']['fase']
            time.sleep(0.2)
        self.assertEqual(fase, 'ARMED')
        snap = self.srv.snapshot('demeter')
        self.assertEqual(contrato.errores_snapshot(snap), [])
        self.assertTrue(any(e['tipo'] == 'fase' for e in snap['eventos']))
        self.srv.pedir('/api/cmd', metodo='POST', cabeceras={'Content-Type': 'application/json'}, cuerpo=json.dumps({'line': 'd estado tierra'}).encode())

    # -- seguridad ---------------------------------------------------------------
    def test_host_ajeno_se_rechaza(self):
        rutas = ('/api/v1/demeter/snapshot', '/api/v1/demeter/stream', '/api/state', '/web/demeter/', '/assets/app-1.js', '/')
        for host in ('evil.com', 'evil.com:80', f'127.0.0.1:{self.srv.puerto + 1}', 'localhost', '127.0.0.1', f'evil.com:{self.srv.puerto}'):
            for ruta in rutas:
                self.assertEqual(self.srv.get(ruta, host=host)[0], 403, f'{host!r} {ruta}')

    def test_sin_host_se_rechaza(self):
        with socket.create_connection(('127.0.0.1', self.srv.puerto), timeout=5) as s:
            s.sendall(b'GET /api/v1/demeter/snapshot HTTP/1.0\r\n\r\n')
            self.assertIn(b' 403 ', s.recv(200))

    def test_host_conocido_se_acepta(self):
        for host in (f'127.0.0.1:{self.srv.puerto}', f'localhost:{self.srv.puerto}'):
            self.assertEqual(self.srv.get('/api/v1/demeter/snapshot', host=host)[0], 200)

    def test_origen_ajeno_se_rechaza(self):
        self.assertEqual(self.srv.get('/api/v1/demeter/snapshot', cabeceras={'Origin': 'http://evil.com'})[0], 403)
        self.assertEqual(self.srv.get('/api/v1/demeter/snapshot', cabeceras={'Origin': f'http://127.0.0.1:{self.srv.puerto}'})[0], 200)

    def test_no_hay_comandos_desde_fuera(self):
        cab = {'Content-Type': 'application/json'}
        cuerpo = json.dumps({'line': 'd armar'}).encode()
        self.assertEqual(self.srv.pedir('/api/cmd', host='evil.com', metodo='POST', cabeceras=cab, cuerpo=cuerpo)[0], 403)
        self.assertEqual(self.srv.pedir('/api/cmd', metodo='POST', cabeceras={'Content-Type': 'application/json', 'Origin': 'http://evil.com'}, cuerpo=cuerpo)[0], 403)
        # las rutas de lectura no aceptan POST: la API de web-1 es solo de lectura
        self.assertEqual(self.srv.pedir('/api/v1/demeter/snapshot', metodo='POST', cabeceras=cab, cuerpo=b'{}')[0], 404)

    def test_escucha_solo_en_loopback(self):
        # la direccion de escucha es 127.0.0.1: no se puede llegar por otra interfaz del equipo
        otras = [a for a in socket.gethostbyname_ex(socket.gethostname())[2] if not a.startswith('127.')]
        for a in otras:
            with socket.socket() as s:
                s.settimeout(1)
                self.assertNotEqual(s.connect_ex((a, self.srv.puerto)), 0, a)

    def test_no_sale_de_dist(self):
        malas = ('/web/../secreto.txt', '/web/%2e%2e/secreto.txt', '/web/%2E%2E%2Fsecreto.txt', '/assets/../secreto.txt', '/assets/../../secreto.txt',
                 '/assets/..%2fsecreto.txt', '/demeter/../../dashboard.py', '/web/..\\secreto.txt', '/web/assets/..\\..\\secreto.txt',
                 '/web//..//secreto.txt', '/web/assets/%2e%2e/%2e%2e/secreto.txt', '/web/%00', '/web/C:/Windows/win.ini', '/mapas/../../secreto.txt',
                 '/web/assets/../../estacion/dashboard.py', '//web/../secreto.txt')
        for ruta in malas:
            codigo, _, cuerpo = self.srv.get(ruta)
            self.assertNotIn(b'NO-SALIR', cuerpo, ruta)
            self.assertNotIn(b'def web_archivo', cuerpo, ruta)
            self.assertNotEqual(codigo, 200, ruta)

    def test_un_enlace_simbolico_no_saca_de_dist(self):
        if not hasattr(os, 'symlink'):
            self.skipTest('sin enlaces simbolicos')
        enlace = os.path.join(self.dist, 'assets', 'fuera.txt')
        try:
            os.symlink(os.path.join(self.tmp, 'secreto.txt'), enlace)
        except OSError:
            self.skipTest('no se pueden crear enlaces simbolicos')
        try:
            codigo, _, cuerpo = self.srv.get('/assets/fuera.txt')
            self.assertEqual((codigo, b'NO-SALIR' in cuerpo), (404, False))
        finally:
            os.remove(enlace)

    # -- estaticos ---------------------------------------------------------------
    def test_sirve_dist_con_sus_tipos(self):
        casos = (('/web/', b'portada', 'text/html; charset=utf-8'), ('/web/demeter/', b'demeter', 'text/html; charset=utf-8'),
                 ('/demeter/', b'demeter', 'text/html; charset=utf-8'), ('/hermes/', b'hermes', 'text/html; charset=utf-8'),
                 ('/hermes', b'hermes', 'text/html; charset=utf-8'), ('/assets/app-1.js', b'export', 'text/javascript; charset=utf-8'),
                 ('/web/assets/app-1.js', b'export', 'text/javascript; charset=utf-8'), ('/assets/app-1.css', b'body', 'text/css; charset=utf-8'),
                 ('/assets/f.woff2', b'wOF2', 'font/woff2'), ('/assets/i.webp?v=1', b'RIFF', 'image/webp'),
                 ('/mapas/santa_fe.pmtiles', b'\x00\x01', 'application/octet-stream'))
        for ruta, inicio, tipo in casos:
            codigo, cab, cuerpo = self.srv.get(ruta)
            self.assertEqual(codigo, 200, ruta)
            self.assertEqual(cab['content-type'], tipo, ruta)
            self.assertIn(inicio, cuerpo[:20], ruta)
            self.assertEqual(int(cab['content-length']), len(cuerpo), ruta)

    def test_lo_que_no_es_de_dist_no_se_sirve(self):
        for ruta in ('/assets/no_existe.js', '/web/no_existe', '/estacion/dashboard.py', '/dashboard.py', '/assets/', '/mision.json'):
            self.assertEqual(self.srv.get(ruta)[0], 404, ruta)

    def test_range_para_el_pmtiles(self):
        codigo, cab, cuerpo = self.srv.get('/mapas/santa_fe.pmtiles', cabeceras={'Range': 'bytes=10-19'})
        self.assertEqual((codigo, cuerpo, cab['content-range']), (206, bytes(range(10, 20)), 'bytes 10-19/1024'))
        codigo, _, cuerpo = self.srv.get('/mapas/santa_fe.pmtiles', cabeceras={'Range': 'bytes=1020-'})
        self.assertEqual((codigo, len(cuerpo)), (206, 4))
        codigo, _, cuerpo = self.srv.get('/mapas/santa_fe.pmtiles', cabeceras={'Range': 'bytes=-6'})
        self.assertEqual((codigo, len(cuerpo)), (206, 6))
        self.assertEqual(self.srv.get('/mapas/santa_fe.pmtiles', cabeceras={'Range': 'bytes=5000-6000'})[0], 416)
        self.assertEqual(self.srv.get('/mapas/santa_fe.pmtiles')[1]['accept-ranges'], 'bytes')

    def test_estado_dice_que_hay_web(self):
        self.assertTrue(json.loads(self.srv.get('/api/state')[2])['web'])

    def test_la_pagina_del_dashboard_trae_las_pestanas_de_vuelo(self):
        html = self.srv.get('/')[2].decode()
        self.assertIn('Vuelo Demeter', html)
        self.assertIn('Vuelo Hermes', html)


class SinWeb(unittest.TestCase):
    def test_sin_dist_el_dashboard_dice_que_compile(self):
        tmp = tempfile.mkdtemp()
        srv = Servidor('--demo', web_dist=os.path.join(tmp, 'no_hay'))
        try:
            self.assertFalse(json.loads(srv.get('/api/state')[2])['web'])
            for ruta in ('/web/demeter/', '/demeter/', '/assets/x.js'):
                codigo, cab, cuerpo = srv.get(ruta)
                self.assertEqual(codigo, 404, ruta)
                self.assertIn(b'npm run web:build', cuerpo, ruta)
            self.assertEqual(srv.get('/api/v1/demeter/snapshot')[0], 200, 'la API sigue funcionando sin la web')
        finally:
            srv.parar()
            shutil.rmtree(tmp, ignore_errors=True)


class Reproduccion(unittest.TestCase):
    def test_reproduce_una_sesion_guardada(self):
        lineas = g.vuelo(g.perfil_demeter(), t_ini=-10.0, t_fin=20.0)
        tmp = tempfile.mkdtemp()
        ruta = os.path.join(tmp, 'sesion_tierra.txt')
        with open(ruta, 'w', encoding='utf-8') as f:
            f.write(g.sesion_texto(lineas))
        srv = Servidor('--reproducir', ruta, '--velocidad', '500')
        try:
            snap = srv.esperar_estado('demeter', minimo=150, segundos=20)
            self.assertEqual(contrato.errores_snapshot(snap), [])
            self.assertTrue(any(e['tipo'] == 'despegue' for e in snap['eventos']), 'la sesion tiene el despegue (t = 0)')
            self.assertEqual(contrato.errores_snapshot(srv.snapshot('hermes')), [])
        finally:
            srv.parar()
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    unittest.main()
