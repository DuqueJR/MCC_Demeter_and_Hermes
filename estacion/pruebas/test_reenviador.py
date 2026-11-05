"""Pruebas de `estacion/reenviador.py` (T-605a). Solo unittest y la biblioteca estandar. Sin red real.

Un servidor HTTP falso (en un hilo, en 127.0.0.1) hace de relay: guarda lo que le llega y responde lo que la prueba le diga
(200, 401, 503, 413, que se cuelgue o que corte la conexion). Las pruebas de punta a punta levantan el dashboard de verdad
con `--reproducir` y `--web-relay` contra ese servidor.

Correr desde la raiz del repo:  python -m unittest discover -s estacion/pruebas -v
"""
import http.client
import json
import os
import shutil
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock

import generador as g
import contrato
import reenviador as R
import web1
from test_dashboard_api import Servidor

TOKEN = 'token-de-prueba-0123456789'
RAPIDO = dict(ciclo_s=0.02, timeout_s=0.5, backoff_ini_s=0.05, backoff_max_s=0.2, auth_reintento_s=0.3, resumen_s=30)


class RelayFalso(ThreadingHTTPServer):
    """El relay de mentira. `modo`: 'ok' | 'colgar' | 'cortar' (recibe y cierra sin responder) | un codigo HTTP (int).
    `regla(req)` (opcional) devuelve el codigo a responder para esa peticion y gana al modo."""
    daemon_threads = True

    def __init__(self):
        super().__init__(('127.0.0.1', 0), _Manejador)
        self.modo = 'ok'
        self.regla = None
        self.liberar = threading.Event()
        self.intentos = []          # todas las peticiones que llegaron
        self.aceptadas = []         # las que se respondieron 2xx
        self.mutex = threading.Lock()
        threading.Thread(target=self.serve_forever, daemon=True).start()

    def handle_error(self, request, client_address):          # las conexiones cortadas a proposito no ensucian la salida
        pass

    @property
    def url(self):
        return f'http://127.0.0.1:{self.server_address[1]}'

    def mensajes(self):
        """Todos los mensajes aceptados, en el orden en que se aceptaron."""
        with self.mutex:
            return [m for r in self.aceptadas for m in r['cuerpo']['mensajes']]

    def esperar(self, cond, segundos=10):
        t0 = time.time()
        while time.time() - t0 < segundos:
            if cond():
                return True
            time.sleep(0.01)
        return False

    def parar(self):
        self.liberar.set()
        self.shutdown()
        self.server_close()


class _Manejador(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    def do_POST(self):
        srv = self.server
        bruto = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        try:
            cuerpo = json.loads(bruto)
        except ValueError:
            cuerpo = None
        req = dict(ruta=self.path, auth=self.headers.get('Authorization'), lote=self.headers.get('X-Lote-Id'),
                   tipo=self.headers.get('Content-Type'), cuerpo=cuerpo, bruto=bruto, t=time.time())
        with srv.mutex:
            srv.intentos.append(req)
        modo = srv.regla(req) if srv.regla else srv.modo
        if modo == 'colgar':
            srv.liberar.wait(30)
            modo = 'ok' if srv.modo == 'colgar' else srv.modo
        if modo == 'cortar':
            self.close_connection = True
            return
        codigo = 200 if modo == 'ok' else modo
        if 200 <= codigo < 300:
            with srv.mutex:
                srv.aceptadas.append(req)
        resp = b'{}'
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)


def mensaje(i, mision='demeter', tipo='estado'):
    return mision, tipo, json.dumps({'n': i, 'texto': 'áé'}, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cola = os.path.join(self.tmp, 'cola.db')
        self.srv = RelayFalso()
        self.eventos = []
        self.activos = []

    def tearDown(self):
        for r in self.activos:
            r.detener()
        self.srv.parar()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def nuevo(self, iniciar=True, cola=None, url=None, **kw):
        r = R.Reenviador(url or self.srv.url, TOKEN, cola or self.cola, self.eventos.append, **dict(RAPIDO, **kw))
        self.activos.append(r)
        return r.iniciar() if iniciar else r

    def ns(self, mensajes):
        return [m['datos']['n'] for m in mensajes]

    def sin_token_en(self, textos):
        for t in textos:
            self.assertNotIn(TOKEN, t)


class Entrega(Base):
    def test_formato_del_lote_y_encabezados(self):
        r = self.nuevo()
        for i in range(3):
            r.publicar(*mensaje(i, 'hermes' if i == 1 else 'demeter', 'salud' if i == 2 else 'estado'))
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 3))
        req = self.srv.aceptadas[0]
        self.assertEqual(req['ruta'], '/api/v1/ingesta')
        self.assertEqual(req['auth'], 'Bearer ' + TOKEN)
        self.assertTrue(req['tipo'].startswith('application/json'))
        self.assertTrue(req['lote'])
        self.assertEqual(set(req['cuerpo']), {'mensajes'})
        msgs = self.srv.mensajes()
        for m in msgs:
            self.assertEqual(set(m), {'tipo', 'mision', 'datos'})
        self.assertEqual([(m['mision'], m['tipo'], m['datos']['n']) for m in msgs],
                         [('demeter', 'estado', 0), ('hermes', 'estado', 1), ('demeter', 'salud', 2)])
        self.assertEqual(msgs[0]['datos']['texto'], 'áé', 'UTF-8 intacto')
        self.assertEqual(r.estado()['en_cola'], 0)
        self.assertEqual(r.enviados, 3)

    def test_solo_los_dos_cohetes(self):
        r = self.nuevo()
        r.publicar(*mensaje(1, 'otra_cosa'))
        r.publicar(*mensaje(2, 'local'))
        r.publicar(*mensaje(3, 'hermes'))
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 1))
        time.sleep(0.2)
        self.assertEqual(self.ns(self.srv.mensajes()), [3])

    def test_url_con_o_sin_la_ruta_de_ingesta(self):
        for url in (self.srv.url, self.srv.url + '/', self.srv.url + '/api/v1/ingesta'):
            self.srv.aceptadas.clear()
            r = self.nuevo(url=url, cola=os.path.join(self.tmp, 'c%d.db' % len(self.activos)))
            r.publicar(*mensaje(1))
            self.assertTrue(self.srv.esperar(lambda: self.srv.aceptadas), url)
            self.assertEqual(self.srv.aceptadas[0]['ruta'], '/api/v1/ingesta', url)

    def test_conectado_se_avisa_una_vez(self):
        r = self.nuevo()
        for i in range(5):
            r.publicar(*mensaje(i))
            time.sleep(0.05)
        self.srv.esperar(lambda: len(self.srv.mensajes()) == 5)
        self.assertEqual(len([e for e in self.eventos if 'CONECTADO' in e]), 1, self.eventos)


class Caida(Base):
    def test_relay_caido_y_recuperacion_sin_perder_ni_reordenar(self):
        self.srv.modo = 503
        r = self.nuevo(fresco_s=0.1)
        for i in range(10):
            r.publicar(*mensaje(i))
        self.assertTrue(self.srv.esperar(lambda: r.estado()['estado'] == 'caido'))
        for i in range(10, 20):
            r.publicar(*mensaje(i))
        time.sleep(0.4)
        self.assertEqual(r.estado()['en_cola'], 20)
        self.assertEqual(self.srv.mensajes(), [])
        self.srv.modo = 'ok'
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 20))
        self.assertEqual(self.ns(self.srv.mensajes()), list(range(20)))
        self.assertEqual(r.perdidos, 0)
        self.assertEqual(r.estado()['estado'], 'conectado')
        self.assertEqual(len([e for e in self.eventos if 'SIN CONEXION' in e]), 1, 'se avisa una vez, no en cada reintento')
        self.assertTrue(any('CONECTADO' in e and 'recuperado' in e for e in self.eventos), self.eventos)

    def test_el_retroceso_tiene_tope_y_no_es_un_bucle_apretado(self):
        self.srv.modo = 503
        r = self.nuevo(backoff_ini_s=0.05, backoff_max_s=0.2)
        r.publicar(*mensaje(1))
        time.sleep(1.5)
        # 0,05 + 0,1 + 0,2 + 0,2 ...: unos 9 intentos en 1,5 s. Sin retroceso serian cientos.
        self.assertTrue(4 <= len(self.srv.intentos) <= 14, len(self.srv.intentos))

    def test_tras_la_caida_lo_nuevo_llega_antes_que_todo_el_atraso(self):
        self.srv.modo = 503
        r = self.nuevo(fresco_s=0.3, lote_max=100, atraso_por_lote=50)
        for i in range(300):
            r.publicar(*mensaje(i))
        self.assertTrue(self.srv.esperar(lambda: r.estado()['estado'] == 'caido'))
        time.sleep(0.5)                                       # los 300 ya son "viejos"
        self.srv.modo = 'ok'
        r.publicar(*mensaje(999))
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 301))
        orden = self.ns(self.srv.mensajes())
        self.assertEqual(sorted(orden), sorted(list(range(300)) + [999]), 'ni se pierde ni se repite nada')
        pos = orden.index(999)
        self.assertLess(pos, 160, 'lo nuevo viajo en el segundo lote, no al final de 300 viejos')
        viejos = [n for n in orden if n != 999]
        self.assertEqual(viejos, sorted(viejos), 'el atraso sale en orden')

    def test_un_lote_sin_respuesta_se_reintenta_identico_con_el_mismo_id(self):
        """El relay recibio el lote pero la respuesta no llego: el reintento lleva el mismo X-Lote-Id y el mismo contenido."""
        self.srv.modo = 'cortar'
        r = self.nuevo()
        r.publicar(*mensaje(1))
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.intentos) >= 1))
        r.publicar(*mensaje(2))
        time.sleep(0.3)
        self.srv.modo = 'ok'
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) >= 1))
        primero, aceptado = self.srv.intentos[0], self.srv.aceptadas[0]
        self.assertEqual(primero['lote'], aceptado['lote'])
        self.assertEqual(primero['bruto'], aceptado['bruto'])

    def test_conexion_vieja_se_reabre_sin_contar_como_fallo(self):
        r = self.nuevo()
        r.publicar(*mensaje(1))
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 1))
        r._con.sock.close()                                   # el servidor "cerro" la conexion ociosa
        r.publicar(*mensaje(2))
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 2))
        self.assertEqual(r.estado()['estado'], 'conectado')
        self.assertEqual([e for e in self.eventos if 'SIN CONEXION' in e], [])

    def test_sin_servidor_escuchando(self):
        puerto_muerto = self.srv.server_address[1]
        self.srv.parar()
        r = self.nuevo(url=f'http://127.0.0.1:{puerto_muerto}')
        r.publicar(*mensaje(1))
        self.assertTrue(self.srv.esperar(lambda: r.estado()['estado'] == 'caido'))
        self.assertEqual(r.estado()['en_cola'], 1)


class Persistencia(Base):
    def test_sobrevive_a_reiniciar_el_dashboard(self):
        self.srv.modo = 503
        a = self.nuevo()
        for i in range(5):
            a.publicar(*mensaje(i))
        self.assertTrue(self.srv.esperar(lambda: a._cola is not None and a._cola.n == 5))
        a.detener()
        self.assertTrue(os.path.exists(self.cola))
        self.srv.modo = 'ok'
        b = self.nuevo()
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 5))
        self.assertEqual(self.ns(self.srv.mensajes()), [0, 1, 2, 3, 4])
        self.assertTrue(any('pendientes de antes' in e for e in self.eventos), self.eventos)

    def test_lo_que_esta_en_memoria_al_apagar_va_a_disco(self):
        self.srv.modo = 503
        r = self.nuevo(ciclo_s=5)                             # el hilo duerme: nada se vacia solo
        time.sleep(0.2)
        for i in range(4):
            r.publicar(*mensaje(i))
        r.detener()
        self.srv.modo = 'ok'
        self.nuevo(cola=self.cola)
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 4))

    def test_cola_llena_descarta_lo_mas_viejo_y_lo_cuenta(self):
        self.srv.modo = 503
        r = self.nuevo(cola_max=10, ciclo_s=5)
        time.sleep(0.2)                                       # el primer ciclo ya paso
        for i in range(25):
            r.publicar(*mensaje(i))
        r.detener()                                           # el vaciado final mete los 25 y recorta a 10
        self.assertEqual(r.perdidos_cola, 15)
        self.assertEqual(r.perdidos, 15)
        self.srv.modo = 'ok'
        b = self.nuevo(cola_max=10)
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 10))
        self.assertEqual(self.ns(self.srv.mensajes()), list(range(15, 25)), 'quedan los 10 mas nuevos')

    def test_memoria_acotada_cuenta_lo_que_pierde(self):
        r = self.nuevo(iniciar=False, mem_max=5)
        for i in range(8):
            r.publicar(*mensaje(i))
        self.assertEqual(r.perdidos, 3)
        self.assertEqual(r.estado()['en_cola'], 5)

    def test_sin_disco_la_cola_sigue_en_memoria(self):
        ruta_mala = os.path.join(self.tmp, 'archivo_que_es_carpeta')
        os.makedirs(os.path.join(ruta_mala, 'cola.db'))       # sqlite no puede abrir una carpeta como archivo
        r = self.nuevo(cola=os.path.join(ruta_mala, 'cola.db'))
        r.publicar(*mensaje(1))
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 1))
        self.assertTrue(any('SIN DISCO' in e for e in self.eventos), self.eventos)


class Rechazos(Base):
    def test_401_avisa_una_vez_sin_el_token_y_no_reintenta_en_bucle(self):
        self.srv.modo = 401
        r = self.nuevo()
        r.publicar(*mensaje(1))
        time.sleep(1.0)
        avisos = [e for e in self.eventos if 'rechazo el token' in e]
        self.assertEqual(len(avisos), 1, self.eventos)
        self.assertIn('HTTP 401', avisos[0])
        self.assertLessEqual(len(self.srv.intentos), 6, 'un intento cada auth_reintento_s (0,3 s), no un bucle')
        self.assertEqual(r.estado()['estado'], 'auth')
        self.assertEqual(r.estado()['en_cola'], 1, 'no se tira nada')
        self.sin_token_en(self.eventos)
        self.assertNotIn(TOKEN, json.dumps(r.estado()))
        self.srv.modo = 'ok'                                  # se rota el token en el relay: se recupera solo
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 1))

    def test_403_igual_que_401(self):
        self.srv.modo = 403
        r = self.nuevo()
        r.publicar(*mensaje(1))
        self.assertTrue(self.srv.esperar(lambda: r.estado()['estado'] == 'auth'))
        self.assertTrue(any('HTTP 403' in e for e in self.eventos))

    def test_413_parte_el_lote_hasta_que_cabe(self):
        self.srv.regla = lambda req: 413 if len(req['cuerpo']['mensajes']) > 3 else 200
        r = self.nuevo(ciclo_s=5)
        time.sleep(0.2)
        for i in range(20):
            r.publicar(*mensaje(i))
        r._ciclo_s = 0.02
        r.detener()
        r2 = self.nuevo()
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 20))
        self.assertEqual(self.ns(self.srv.mensajes()), list(range(20)))
        self.assertEqual(r2.descartados, 0)

    def test_un_mensaje_que_el_relay_rechaza_se_descarta_y_no_traba_la_cola(self):
        self.srv.regla = lambda req: 400 if b'VENENO' in req['bruto'] else 200
        r = self.nuevo()
        r.publicar(*mensaje(0))
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 1))      # ya hubo un exito
        r.detener()
        r = self.nuevo(ciclo_s=5)
        time.sleep(0.2)
        for i in range(1, 8):
            r.publicar('demeter', 'evento', json.dumps({'n': i, 'x': 'VENENO' if i == 4 else 'ok'}))
        r.detener()
        r = self.nuevo()
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 7))
        self.assertEqual(self.ns(self.srv.mensajes()), [0, 1, 2, 3, 5, 6, 7])
        self.assertEqual(r.descartados, 1)
        self.assertEqual(r.perdidos, 1)
        self.assertTrue(any('rechazo un mensaje' in e for e in self.eventos), self.eventos)

    def test_si_el_relay_rechaza_todo_no_se_vacia_la_cola(self):
        """Un 400 para todo (URL mal puesta, por ejemplo) no debe tirar la cola entera: el descarte tiene tope."""
        self.srv.regla = lambda req: 200 if req['cuerpo']['mensajes'][0]['datos']['n'] == 0 else 400
        r = self.nuevo()
        r.publicar(*mensaje(0))
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 1))      # ya hubo un exito: los 400 se leen como "este mensaje"
        for i in range(1, 101):
            r.publicar(*mensaje(i))
        self.assertTrue(self.srv.esperar(lambda: r.descartados >= R.REENV_RECHAZOS_MAX))
        time.sleep(0.5)
        self.assertEqual(r.descartados, R.REENV_RECHAZOS_MAX)
        self.assertEqual(r.estado()['en_cola'], 100 - R.REENV_RECHAZOS_MAX)
        self.assertEqual(r.estado()['estado'], 'caido')


class NoBloquea(Base):
    def test_un_relay_colgado_no_bloquea_a_quien_publica(self):
        self.srv.modo = 'colgar'
        r = self.nuevo(timeout_s=1.0, mem_max=500)
        r.publicar(*mensaje(0))
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.intentos) >= 1), 'el reenviador ya esta esperando al relay')
        peor, t0 = 0.0, time.perf_counter()
        for i in range(1, 10001):
            t1 = time.perf_counter()
            r.publicar(*mensaje(i))
            peor = max(peor, time.perf_counter() - t1)
        total = time.perf_counter() - t0
        self.assertLess(peor, 0.05, f'una llamada tardo {peor * 1000:.1f} ms')
        self.assertLess(total, 3.0, f'10000 llamadas tardaron {total:.2f} s')
        self.assertGreater(r.perdidos, 0, 'la memoria esta acotada y cuenta lo que pierde')
        self.srv.modo = 'ok'
        self.srv.liberar.set()                                # el relay despierta: se recupera
        self.assertTrue(self.srv.esperar(lambda: r.estado()['estado'] == 'conectado', 15))

    def test_publicar_no_lanza_aunque_todo_falle(self):
        r = self.nuevo(iniciar=False)
        r._mem = None                                         # estado corrupto a proposito
        r.publicar(*mensaje(1))                               # no debe lanzar

    def test_el_evento_que_lanza_no_mata_al_hilo(self):
        def malo(texto):
            raise RuntimeError('boom')
        self.srv.modo = 503
        r = R.Reenviador(self.srv.url, TOKEN, self.cola, malo, **RAPIDO)
        self.activos.append(r)
        r.iniciar()
        r.publicar(*mensaje(1))
        self.assertTrue(self.srv.esperar(lambda: r.estado()['estado'] == 'caido'))
        self.srv.modo = 'ok'
        self.assertTrue(self.srv.esperar(lambda: len(self.srv.mensajes()) == 1))

    def test_resumen_periodico_mientras_esta_caido(self):
        self.srv.modo = 503
        r = self.nuevo(resumen_s=0.2)
        r.publicar(*mensaje(1))
        time.sleep(0.9)
        resumenes = [e for e in self.eventos if '1 en cola' in e and 'SIN CONEXION' in e]
        self.assertGreaterEqual(len(resumenes), 3, self.eventos)


class ApagadoPorDefecto(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.env = os.path.join(self.tmp, '.env')
        self.eventos = []
        self.hilos = {t.name for t in threading.enumerate()}

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def cfg(self, url=None, entorno=None, **kw):
        return R.configurar(url, os.path.join(self.tmp, 'cola.db'), self.eventos.append, entorno if entorno is not None else {}, self.env, **kw)

    def sin_rastro(self):
        self.assertEqual(os.listdir(self.tmp) if os.path.exists(self.env) is False else [f for f in os.listdir(self.tmp) if f != '.env'], [])
        self.assertEqual({t.name for t in threading.enumerate()}, self.hilos)

    def test_sin_configuracion_no_hay_nada(self):
        self.assertIsNone(self.cfg())
        self.assertEqual(self.eventos, [])
        self.sin_rastro()

    def test_solo_el_token_sin_url_tampoco(self):
        self.assertIsNone(self.cfg(entorno={'WEB_INGESTA_TOKEN': TOKEN}))
        self.assertEqual(self.eventos, [])
        self.sin_rastro()

    def test_url_sin_token_avisa_y_no_arranca(self):
        self.assertIsNone(self.cfg('http://127.0.0.1:1'))
        self.assertEqual(len(self.eventos), 1)
        self.assertIn('WEB_INGESTA_TOKEN', self.eventos[0])
        self.sin_rastro()

    def test_configurado_pero_sin_iniciar_no_toca_disco_ni_hilos(self):
        r = self.cfg('http://127.0.0.1:1', {'WEB_INGESTA_TOKEN': TOKEN})
        self.assertIsNotNone(r)
        r.publicar(*mensaje(1))
        self.sin_rastro()

    def test_url_invalida_o_token_invalido(self):
        self.assertIsNone(self.cfg('ftp://x', {'WEB_INGESTA_TOKEN': TOKEN}))
        self.assertIsNone(self.cfg('http://127.0.0.1:1', {'WEB_INGESTA_TOKEN': 'con espacio'}))
        self.assertEqual(len(self.eventos), 2)
        self.sin_rastro()

    def test_env_y_prioridad_del_entorno(self):
        with open(self.env, 'w', encoding='utf-8') as f:
            f.write('# comentario\nWEB_RELAY_URL=http://127.0.0.1:2\nWEB_INGESTA_TOKEN="del-archivo"\n\nbasura sin igual\n')
        self.assertEqual(R.leer_env(self.env), {'WEB_RELAY_URL': 'http://127.0.0.1:2', 'WEB_INGESTA_TOKEN': 'del-archivo'})
        r = self.cfg()
        self.assertEqual(r._token, 'del-archivo')
        self.assertEqual(r._puerto, 2)
        r = self.cfg(entorno={'WEB_INGESTA_TOKEN': 'del-entorno'})
        self.assertEqual(r._token, 'del-entorno')
        self.assertEqual(R.leer_env(os.path.join(self.tmp, 'no_existe')), {})

    def test_avisa_si_son_datos_de_demo(self):
        self.cfg('http://127.0.0.1:1', {'WEB_INGESTA_TOKEN': TOKEN}, modo='demo')
        self.assertTrue(any('AVISO' in e and 'demo' in e for e in self.eventos), self.eventos)

    def test_avisa_si_el_token_va_sin_cifrar_a_otra_maquina(self):
        eventos = []
        R.Reenviador('http://relay.ejemplo.org', TOKEN, os.path.join(self.tmp, 'c.db'), eventos.append).iniciar().detener()
        self.assertTrue(any('SIN cifrar' in e for e in eventos), eventos)
        eventos.clear()
        R.Reenviador('http://127.0.0.1:1', TOKEN, os.path.join(self.tmp, 'c.db'), eventos.append).iniciar().detener()
        self.assertFalse(any('SIN cifrar' in e for e in eventos), eventos)

    def test_el_dashboard_sin_configuracion_no_crea_la_cola_ni_el_hilo(self):
        """El dashboard de verdad, sin --web-relay ni variables: ni hilo 'reenviador' ni archivo de cola."""
        entorno = {k: v for k, v in os.environ.items() if not k.startswith('WEB_')}
        antes = os.path.exists(R.RUTA_COLA_DEF)
        with mock.patch.dict(os.environ, entorno, clear=True):
            srv = Servidor('--demo')
        try:
            srv.esperar_estado('demeter')
            eventos = json.loads(srv.get('/api/state')[2])['events']
            self.assertFalse(any('reenviador' in e for e in eventos), eventos)
        finally:
            srv.parar()
        self.assertEqual(os.path.exists(R.RUTA_COLA_DEF), antes)


class PuntaAPunta(unittest.TestCase):
    """El dashboard de verdad (`--reproducir`) contra el relay falso: la sesion llega completa, en orden y valida."""
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.relay = RelayFalso()

    def tearDown(self):
        self.relay.parar()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def sesion(self):
        lineas = g.vuelo(g.perfil_demeter(), t_ini=-10.0, t_fin=20.0)
        ruta = os.path.join(self.tmp, 'sesion_tierra.txt')
        with open(ruta, 'w', encoding='utf-8') as f:
            f.write(g.sesion_texto(lineas))
        return ruta

    def esperado(self, ruta):
        """Lo que el traductor produce sin red: los `estado` de cada mision, en orden."""
        tr, estados = web1.Traductor(), {'demeter': [], 'hermes': []}
        for t, linea in web1.leer_sesion(ruta):
            for m in tr.procesar(linea, t):
                if m['tipo'] == 'estado':
                    estados[m['mision']].append(m['datos']['t_ms'])
        return estados

    def correr(self, ruta, relay_url, extra_env=None):
        entorno = dict(os.environ, WEB_INGESTA_TOKEN=TOKEN, **(extra_env or {}))
        with mock.patch.dict(os.environ, entorno, clear=True):
            return Servidor('--reproducir', ruta, '--velocidad', '500', '--web-relay', relay_url,
                            '--web-cola', os.path.join(self.tmp, 'cola.db'))

    def test_la_sesion_llega_completa_en_orden_y_valida(self):
        ruta = self.sesion()
        esperado = self.esperado(ruta)
        self.assertGreater(len(esperado['demeter']), 100)
        srv = self.correr(ruta, self.relay.url)
        try:
            def llegaron():
                return len([m for m in self.relay.mensajes() if m['tipo'] == 'estado' and m['mision'] == 'demeter']) >= len(esperado['demeter'])
            self.assertTrue(self.relay.esperar(llegaron, 30), 'no llegaron todos los estado')
            time.sleep(1.0)                                   # que se vacie lo que falte (salud, estacion...)
            msgs = self.relay.mensajes()
            for req in self.relay.aceptadas:
                self.assertEqual(req['ruta'], '/api/v1/ingesta')
                self.assertEqual(req['auth'], 'Bearer ' + TOKEN)
            for m in msgs:
                # con --reproducir a 500x el reloj local (rx_utc_ms) no coincide con el de la sesion (utc_ms): esa coherencia solo vale en vivo
                errores = [e for e in contrato.errores_mensaje(m) if 'rx_utc_ms' not in e]
                self.assertEqual(errores, [], m['tipo'])
            for mision in ('demeter', 'hermes'):
                t_ms = [m['datos']['t_ms'] for m in msgs if m['tipo'] == 'estado' and m['mision'] == mision]
                self.assertEqual(t_ms, esperado[mision], f'los estado de {mision}: completos y en orden')
            self.assertEqual({m['tipo'] for m in msgs} - {'meta', 'estado', 'salud', 'estacion', 'evento', 'backfill'}, set())
            self.assertTrue(any(m['tipo'] == 'evento' and m['datos'].get('tipo') == 'despegue' for m in msgs), 'el despegue llego')
            self.assertEqual(len({r['lote'] for r in self.relay.aceptadas}), len(self.relay.aceptadas), 'ningun lote repetido')
            eventos = json.loads(srv.get('/api/state')[2])['events']
            self.assertTrue(any('reenviador activo' in e for e in eventos), eventos)
            self.assertTrue(any('AVISO' in e for e in eventos), 'avisa que son datos de una reproduccion')
            for e in eventos:
                self.assertNotIn(TOKEN, e)
        finally:
            srv.parar()

    def test_el_dashboard_sigue_con_el_relay_caido_y_entrega_al_volver(self):
        ruta = self.sesion()
        esperado = self.esperado(ruta)
        self.relay.modo = 503
        srv = self.correr(ruta, self.relay.url)
        try:
            snap = srv.esperar_estado('demeter', minimo=150, segundos=30)       # el dashboard local no se entera
            self.assertEqual(contrato.errores_snapshot(snap), [])
            self.assertEqual(self.relay.mensajes(), [])
            eventos = json.loads(srv.get('/api/state')[2])['events']
            self.assertTrue(any('SIN CONEXION' in e for e in eventos), eventos)
            self.relay.modo = 'ok'
            n = len(esperado['demeter'])
            self.assertTrue(self.relay.esperar(lambda: len([m for m in self.relay.mensajes() if m['tipo'] == 'estado' and m['mision'] == 'demeter']) >= n, 30))
            t_ms = [m['datos']['t_ms'] for m in self.relay.mensajes() if m['tipo'] == 'estado' and m['mision'] == 'demeter']
            self.assertEqual(t_ms, esperado['demeter'], 'sin perder ni reordenar')
        finally:
            srv.parar()


if __name__ == '__main__':
    unittest.main()
