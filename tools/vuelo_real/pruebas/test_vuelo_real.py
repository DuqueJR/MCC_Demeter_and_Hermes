"""Pruebas de la reconstruccion. Desde la raiz:  python -m unittest discover -s tools/vuelo_real/pruebas -t .
(necesitan numpy, como estacion/ekf.py; la de reproducibilidad tarda ~20 s)."""
import json
import os
import tempfile
import unittest

import numpy as np

from tools.vuelo_real import momentos, reconstruir, validar
from tools.vuelo_real import vuelos as V
from tools.vuelo_real.__main__ import generar_todo
from tools.web_datos import validacion

# Ventanas (s desde el BOOST detectado) de lo que se ve en los datos del 8 nov, con margen
ESPERADO = {
    'hermes': {'COAST': (1.0, 1.2), 'APOGEO': (8.4, 9.2), 'PARACAIDAS': (9.3, 9.8), 'ATERRIZAJE': (57.0, 58.2)},
    'demeter': {'COAST': (1.2, 1.4), 'APOGEO': (10.0, 10.8), 'PARACAIDAS': (9.1, 9.6), 'ATERRIZAJE': (80.5, 82.0)},
}


class Momentos(unittest.TestCase):
    def test_vuelos_reales(self):
        for mision, ventanas in ESPERADO.items():
            r = reconstruir.preparar(mision)
            det = r['det']
            orden = [m for _, m in det.anuncios]
            self.assertEqual(orden, [momentos.M_BOOST, momentos.M_COAST, momentos.M_APOGEO, momentos.M_PARACAIDAS, momentos.M_ATERRIZAJE], mision)
            self.assertEqual(det.avisos, [], mision)
            for nombre, (a, b) in ventanas.items():
                t = (det.hechos[nombre][0] - det.t_boost) / 1e6
                self.assertTrue(a <= t <= b, f'{mision} {nombre} en {t:.3f} s, fuera de [{a}, {b}]')

    def test_sacudida_no_es_boost(self):
        """Golpes de 6 g de 10 ms cada 100 ms (manipular el cohete en la rampa) no suman 5 m/s."""
        t = np.arange(0, 3_000_000, 625)
        a = np.where((t % 100_000) < 10_000, 6.0, 1.0)
        det = momentos.detectar('G80-7T', 0, t, a, np.zeros(len(t)), np.array([0]), np.array([0.0]))
        self.assertIsNone(det.t_boost)

    def test_bmp_congelado(self):
        from tools.vuelo_real import sensores
        t = np.arange(0, 2_000_000, 10_000)
        p = np.where(t < 1_000_000, 95000 + np.sin(t / 1e4), 95010.0)
        vivo = sensores.bmp_valido(t, p)
        self.assertTrue(vivo[50:100].all())
        self.assertFalse(vivo[-10:].any())


class Reproducible(unittest.TestCase):
    def test_igual_a_lo_versionado_y_valido(self):
        with tempfile.TemporaryDirectory() as tmp:
            nuevas = generar_todo(tmp)
        self.assertEqual(validar.comparar(nuevas, V.SALIDA), 0)
        for mision in V.VUELOS:
            lineas = [json.loads(x) for x in nuevas[f'{mision}.jsonl'].splitlines()]
            self.assertEqual(validacion.validar_lineas(lineas), [], mision)
            metas = [x['datos'] for x in lineas if x['evento'] == 'meta']
            self.assertTrue(metas and all(m['modo'] == 'reconstruccion' for m in metas), mision)

    def test_recortes_del_manifiesto(self):
        import hashlib
        man = json.load(open(os.path.join(V.DATOS, 'manifiesto.json'), encoding='utf-8'))
        for mision, m in man['vuelos'].items():
            datos = open(V.ruta_recorte(mision), 'rb').read()
            self.assertEqual(hashlib.sha256(datos).hexdigest(), m['recorte']['sha256'], mision)


if __name__ == '__main__':
    unittest.main()
