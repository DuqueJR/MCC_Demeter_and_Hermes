"""Pruebas del fixture de integracion T-641 (`estacion/fixtures/web1.jsonl`).

1. El JSONL versionado cumple el contrato `web-1`: cada linea es `{"tipo", "mision", "datos"}`
   y valida contra el esquema y `tools/web_datos/validacion.py` (`contrato.py`).
2. El snapshot versionado (`web1_snapshot.json`) cumple el contrato de snapshot.
3. El fixture pasa por el reenviador REAL y llega integro, en orden y con el cuerpo POST correcto
   a un servidor HTTP falso en 127.0.0.1 (`RelayFalso` de `test_reenviador.py`: solo registra el
   POST y responde 200). NO es una reimplementacion del relay y NO esta en `gui/relay/`.

Sin red real ni hardware. Correr desde la raiz del repo:

    python -m unittest discover -s estacion/pruebas -p 'test_fixture_web1.py' -v

Para regenerar el fixture: `python estacion/fixtures/regenerar.py`.
"""
import json
import os
import shutil
import tempfile
import unittest

import generador as g
import contrato
import reenviador as R
from test_reenviador import RelayFalso, TOKEN

FIXTURES = os.path.join(g.RAIZ, 'estacion', 'fixtures')
JSONL = os.path.join(FIXTURES, 'web1.jsonl')
SNAP = os.path.join(FIXTURES, 'web1_snapshot.json')

# Parametros del reenviador en las pruebas: rapidos para que el envio termine en segundos.
RAPIDO = dict(ciclo_s=0.02, timeout_s=0.5, backoff_ini_s=0.05, backoff_max_s=0.2)


def cargar():
    with open(JSONL, encoding='utf-8') as f:
        return [json.loads(l) for l in f if l.strip()]


class Fixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.msgs = cargar()
        with open(SNAP, encoding='utf-8') as f:
            cls.snap = json.load(f)

    def test_existe_y_tiene_un_vuelo_completo(self):
        self.assertGreater(len(self.msgs), 1000)

    def test_cada_linea_es_un_mensaje_web1_valido(self):
        for i, m in enumerate(self.msgs):
            with self.subTest(i=i, tipo=m.get('tipo')):
                self.assertEqual(set(m), {'tipo', 'mision', 'datos'}, f'linea {i}')
                self.assertEqual(contrato.errores_mensaje(m), [], f'linea {i}: {m["tipo"]}')

    def test_empieza_con_el_meta_de_demeter_en_simulacion(self):
        m = self.msgs[0]
        self.assertEqual(m['tipo'], 'meta')
        self.assertEqual(m['mision'], 'demeter')
        self.assertEqual(m['datos']['modo'], 'simulacion')
        self.assertEqual(m['datos']['proto_version'], 4)
        self.assertEqual(m['datos']['contrato_version'], 'web-1')

    def test_cubre_las_fases_del_vuelo(self):
        fases = [m['datos']['fase'] for m in self.msgs if m['tipo'] == 'estado' and m['mision'] == 'demeter']
        for fase in ('PREFLIGHT', 'ARMED', 'BOOST', 'COAST', 'APOGEE', 'DESCENT', 'LANDED'):
            self.assertIn(fase, fases, fase)

    def test_los_eventos_clave_estan(self):
        tipos = [m['datos']['tipo'] for m in self.msgs if m['tipo'] == 'evento']
        for t in ('despegue', 'fin_combustion', 'apogeo', 'eyeccion', 'aterrizaje'):
            self.assertIn(t, tipos, t)

    def test_los_tipos_esperados_y_nada_mas(self):
        self.assertEqual({m['tipo'] for m in self.msgs}, {'meta', 'estado', 'salud', 'estacion', 'evento'})

    def test_el_snapshot_versionado_valida(self):
        self.assertEqual(set(self.snap), {'demeter', 'hermes'})
        for mision, s in self.snap.items():
            with self.subTest(mision=mision):
                self.assertEqual(contrato.errores_snapshot(s), [], mision)
        # Hermes no transmitio en este vuelo: sin estado ni salud, pero con meta.
        self.assertIsNone(self.snap['hermes']['estado'])
        self.assertIsNone(self.snap['hermes']['salud'])
        self.assertEqual(self.snap['hermes']['meta']['nodo'], 2)
        self.assertEqual(self.snap['demeter']['estado']['fase'], 'LANDED')


class ReenviadorConFixture(unittest.TestCase):
    """El fixture (los mensajes web-1 reales) pasa por el reenviador real y llega integro al stub."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.srv = RelayFalso()
        self.activos = []

    def tearDown(self):
        for r in self.activos:
            r.detener()
        self.srv.parar()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_llega_completo_en_orden_y_con_el_cuerpo_correcto(self):
        msgs = cargar()
        r = R.Reenviador(self.srv.url, TOKEN, os.path.join(self.tmp, 'cola.db'), **RAPIDO)
        self.activos.append(r)
        r.iniciar()
        for m in msgs:
            r.publicar(m['mision'], m['tipo'],
                       json.dumps(m['datos'], ensure_ascii=False, separators=(',', ':'), allow_nan=False))
        ok = self.srv.esperar(lambda: len(self.srv.mensajes()) == len(msgs), 60)
        self.assertTrue(ok, f'llegaron {len(self.srv.mensajes())} de {len(msgs)}')
        self.assertEqual(self.srv.mensajes(), msgs, 'el reenviador entrego el fixture integro y en orden')
        self.assertEqual(r.enviados, len(msgs))
        self.assertEqual(r.perdidos, 0)
        for req in self.srv.aceptadas:
            self.assertEqual(req['ruta'], '/api/v1/ingesta')
            self.assertEqual(req['auth'], 'Bearer ' + TOKEN)
            self.assertTrue(req['tipo'].startswith('application/json'))
            self.assertEqual(set(req['cuerpo']), {'mensajes'})


if __name__ == '__main__':
    unittest.main()
