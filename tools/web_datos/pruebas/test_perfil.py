"""Lectura del CSV de OpenRocket, perfil continuo, Hermes sintético, actitud y geodesia."""

from __future__ import annotations

import math
import unittest

from .. import actitud, geo
from .. import constantes as C
from ..openrocket import leer_csv
from ..perfil import desde_openrocket
from ..simulador import construir_hermes

# Valores del análisis de docs/02_requisitos/perfiles_vuelo.md §1
EVENTOS_SIM = {
    "LIFTOFF": 0.029,
    "LAUNCHROD": 0.231,
    "BURNOUT": 2.072,
    "EJECTION_CHARGE": 10.072,
    "APOGEE": 11.536,
    "GROUND_HIT": 85.083,
}


class PerfilDemeter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.datos = leer_csv(C.CSV_DEMETER)
        cls.perfil = desde_openrocket(cls.datos)

    def test_eventos_del_csv(self):
        for nombre, t in EVENTOS_SIM.items():
            self.assertAlmostEqual(self.datos.eventos[nombre], t, places=3, msg=nombre)

    def test_454_puntos(self):
        self.assertEqual(len(self.perfil.t), 454)

    def test_apogeo_de_la_simulacion(self):
        self.assertAlmostEqual(max(self.datos.columnas["alt"]), 669.3, delta=0.1)

    def test_remuestreo_conserva_el_apogeo(self):
        # El apogeo se busca sobre una rejilla de 10 Hz (la del generador).
        rejilla = max(self.perfil.en(i / 10.0)["alt"] for i in range(0, 200))
        self.assertLess(abs(rejilla - max(self.datos.columnas["alt"])), 0.5)

    def test_hermite_exacto_en_los_nodos(self):
        for i in (10, 100, 250, 400):
            s = self.perfil.en(self.perfil.t[i])
            self.assertAlmostEqual(s["alt"], self.perfil.alt[i], places=6)
            self.assertAlmostEqual(s["vz"], self.perfil.vz[i], places=6)

    def test_antes_del_encendido_y_despues_del_suelo(self):
        antes = self.perfil.en(-5.0)
        self.assertEqual((antes["alt"], antes["vz"]), (0.0, 0.0))
        despues = self.perfil.en(500.0)
        self.assertEqual((despues["alt"], despues["vz"], despues["ve"]), (0.0, 0.0, 0.0))

    def test_descenso_nominal_bajo_el_limite_del_reglamento(self):
        vz = self.perfil.en(40.0)["vz"]
        self.assertTrue(-C.ALARMA_DESCENSO_MS < vz < -8.0, vz)  # ~9,2 m/s, sin disparar la alarma

    def test_deriva_hacia_el_oeste(self):
        self.assertAlmostEqual(self.perfil.e[-1], -83.0, delta=0.5)


class HermesSintetico(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = desde_openrocket(leer_csv(C.CSV_DEMETER))
        cls.hermes = construir_hermes(cls.base)

    def test_retardo_del_g80(self):
        ev = self.hermes.eventos
        self.assertAlmostEqual(ev["EJECTION_CHARGE"] - ev["BURNOUT"], C.G80_RETARDO_S, places=6)

    def test_apogeo_escalado(self):
        esperado = max(self.base.alt) * C.HERMES_ESCALA_ALTURA
        self.assertAlmostEqual(max(self.hermes.alt), esperado, places=6)

    def test_eyeccion_antes_del_apogeo(self):
        ev = self.hermes.eventos
        self.assertLess(ev["EJECTION_CHARGE"], ev["APOGEE"])

    def test_velocidad_coherente_con_la_altitud(self):
        # d(alt)/dt por diferencias ~ vz, en un punto de la subida
        h = 1e-3
        t = 3.0
        num = (self.hermes.en(t + h)["alt"] - self.hermes.en(t - h)["alt"]) / (2 * h)
        self.assertAlmostEqual(num, self.hermes.en(t)["vz"], delta=0.2)

    def test_descenso_bajo_el_limite(self):
        self.assertLess(abs(self.hermes.en(40.0)["vz"]), 11.0)


class DescensoRapido(unittest.TestCase):
    def test_misma_trayectoria_mas_deprisa(self):
        base = desde_openrocket(leer_csv(C.CSV_DEMETER))
        apo = base.eventos["APOGEE"]
        rapido = base.acelerar_descenso(C.DESCENSO_RAPIDO_FACTOR, apo)
        self.assertAlmostEqual(max(rapido.alt), max(base.alt), places=9)
        esperado = apo + (base.eventos["GROUND_HIT"] - apo) / C.DESCENSO_RAPIDO_FACTOR
        self.assertAlmostEqual(rapido.eventos["GROUND_HIT"], esperado, places=9)
        self.assertLess(rapido.en(apo + 20.0)["vz"], -C.ALARMA_DESCENSO_MS)


class Actitud(unittest.TestCase):
    def test_cohete_vertical(self):
        q = actitud.cuaternion_desde_nariz(actitud.nariz_enu(90.0, 0.0))
        self.assertAlmostEqual(math.sqrt(sum(c * c for c in q)), 1.0, places=12)
        self.assertGreaterEqual(q[0], 0.0)
        # +X del cuerpo debe quedar hacia arriba
        arriba = actitud.rotar(q, (1.0, 0.0, 0.0))
        self.assertAlmostEqual(arriba[2], 1.0, places=9)

    def test_nariz_en_cualquier_direccion(self):
        for el in (0.0, 30.0, 60.0, 90.0):
            for az in (0.0, 45.0, 90.0, 200.0, 300.0):
                n = actitud.nariz_enu(el, az)
                q = actitud.cuaternion_desde_nariz(n)
                x = actitud.rotar(q, (1.0, 0.0, 0.0))
                for a, b in zip(x, n):
                    self.assertAlmostEqual(a, b, places=9)

    def test_rotar_inverso_deshace_rotar(self):
        q = actitud.cuaternion_desde_nariz(actitud.nariz_enu(40.0, 110.0))
        v = (0.3, -1.2, 2.0)
        w = actitud.rotar_inverso(q, actitud.rotar(q, v))
        for a, b in zip(v, w):
            self.assertAlmostEqual(a, b, places=12)


class Geodesia(unittest.TestCase):
    def test_un_grado_de_latitud(self):
        lat, _ = geo.enu_a_latlon(C.SITIO_LAT, C.SITIO_LON, 0.0, 110_000.0)
        self.assertAlmostEqual(lat - C.SITIO_LAT, 0.99, delta=0.01)

    def test_este_aumenta_la_longitud(self):
        _, lon = geo.enu_a_latlon(C.SITIO_LAT, C.SITIO_LON, 100.0, 0.0)
        self.assertGreater(lon, C.SITIO_LON)

    def test_azimut_y_elevacion(self):
        self.assertAlmostEqual(geo.azimut_grados(0.0, 10.0), 0.0)
        self.assertAlmostEqual(geo.azimut_grados(10.0, 0.0), 90.0)
        self.assertAlmostEqual(geo.azimut_grados(-10.0, 0.0), 270.0)
        self.assertAlmostEqual(geo.elevacion_grados(100.0, 100.0), 45.0)


if __name__ == "__main__":
    unittest.main()
