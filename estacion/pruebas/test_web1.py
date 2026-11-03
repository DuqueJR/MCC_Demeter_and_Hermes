"""Pruebas de `estacion/web1.py` (T-661). Solo unittest y la biblioteca estandar.

Correr desde la raiz del repo:  python -m unittest discover -s estacion/pruebas -v

Los mensajes se validan contra `gui/web/src/contrato/esquema.json` y contra `tools/web_datos/validacion.py`
(ver `contrato.py`). Los vuelos salen de la simulacion de OpenRocket de Demeter, con el TDMA de net_proto.
"""
import collections
import json
import math
import os
import subprocess
import sys
import tempfile
import unittest
from functools import lru_cache

import generador as g
import contrato
import web1
from web1 import Traductor

T0 = 1793980800.0     # un epoch local cualquiera (coincide con UTC0 del generador)


@lru_cache(maxsize=None)
def vuelo_demeter(factor_descenso=1.0, **kw):
    return tuple(g.vuelo(g.perfil_demeter(factor_descenso), **dict(kw)))


def correr(lineas, tr=None):
    """Procesa [(t_local, linea)] y devuelve (traductor, [mensajes])."""
    tr = tr or Traductor()
    out = []
    for t, linea in lineas:
        out += tr.procesar(linea, t)
    return tr, out


def de_tipo(msgs, tipo, mision=None):
    return [m['datos'] for m in msgs if m['tipo'] == tipo and (mision is None or m['mision'] == mision)]


def paquete(rid=1, t_local=T0 + 0.05, utc_ms=g.UTC0_MS + 40, **kw):
    """Una linea @T suelta, con valores razonables de reposo en la rampa."""
    base = dict(lat=web1.SITIO_LAT, lon=web1.SITIO_LON, alt_msl_m=web1.SITIO_ALT_MSL_M, vn=0, ve=0, vu=0,
                state=web1.S_TIERRA, moment=0)
    base.update(kw)
    return t_local, g.linea_t(rid, utc_ms=utc_ms, **base)


class Contrato(unittest.TestCase):
    def assertValidos(self, msgs):
        self.assertTrue(msgs, 'no salio ningun mensaje')
        for m in msgs:
            self.assertEqual(contrato.errores_mensaje(m), [], f'{m["tipo"]}: {json.dumps(m["datos"])[:300]}')


class Formatos(unittest.TestCase):
    def test_mismos_formatos_que_dashboard(self):
        """web1.py repite las estructuras de dashboard.py (import circular en T-662): deben ser iguales."""
        import dashboard
        self.assertEqual(web1.TELEM.format, dashboard.TELEM.format)
        self.assertEqual(web1.LOGINFO.format, dashboard.LOGINFO.format)
        self.assertEqual(web1.TELEM.size, 64)
        self.assertEqual(web1.LOGINFO.size, 54)
        self.assertEqual(web1.STATES, dashboard.STATES)
        self.assertEqual(web1.MOMENTS, dashboard.MOMENTS)

    def test_constantes_del_proyecto(self):
        self.assertEqual(web1.ALARMA_DESCENSO_MS, 10.0)
        self.assertEqual((web1.BAT_PCT_VMIN_MV, web1.BAT_PCT_VMAX_MV), (3300, 4200))
        self.assertEqual(web1.WEB_SERIE_MAX_PUNTOS, 2000)
        self.assertEqual((web1.SITIO_LAT, web1.SITIO_LON, web1.SITIO_ALT_MSL_M), (6.582, -75.823, 510.0))
        self.assertEqual((web1.SLOT_US, web1.SLOTS_PER_S), (40000, 25))


class Fases(unittest.TestCase):
    def test_tabla_maquina_estados_5(self):
        S, M = web1.S_TIERRA, web1
        casos = [(0, 0, 'BOOT', 0), (1, 0, 'PREFLIGHT', 1), (2, 0, 'ARMED', 2), (3, 1, 'ARMED', 2), (3, 2, 'BOOST', 3),
                 (3, 3, 'COAST', 4), (3, 4, 'APOGEE', 5), (3, 5, 'FREE_FALL', 6), (3, 6, 'DESCENT', 7), (3, 7, 'LANDED', 8),
                 (4, 0, 'LANDED', 8), (4, 7, 'LANDED', 8), (9, 0, 'ERROR', 9)]
        for state, moment, fase, cod in casos:
            with self.subTest(state=state, moment=moment):
                self.assertEqual(web1.fase_de(state, moment), fase)
                self.assertEqual(web1.FASE_COD[fase], cod)


class VueloCompleto(Contrato):
    @classmethod
    def setUpClass(cls):
        cls.tr, cls.msgs = correr(vuelo_demeter())

    def test_todos_los_mensajes_validan(self):
        self.assertValidos(self.msgs)

    def test_tipos_y_cuentas(self):
        c = collections.Counter((m['mision'], m['tipo']) for m in self.msgs)
        self.assertEqual(c[('demeter', 'meta')], 1)
        self.assertEqual(c[('hermes', 'meta')], 0)           # Hermes no transmitio: no hay meta
        self.assertGreater(c[('demeter', 'estado')], 900)
        n_estacion = c[('demeter', 'estacion')]
        self.assertEqual(n_estacion, c[('hermes', 'estacion')])
        self.assertAlmostEqual(c[('demeter', 'salud')], n_estacion, delta=2)   # los dos a 1 Hz
        # 1 Hz: la separacion entre latidos consecutivos
        ts = [m['datos']['utc_ms'] for m in self.msgs if m['tipo'] == 'estacion' and m['mision'] == 'demeter']
        self.assertTrue(all(1000 <= b - a < 1400 for a, b in zip(ts, ts[1:])), 'el latido no es de 1 Hz')

    def test_meta(self):
        meta = de_tipo(self.msgs, 'meta')[0]
        self.assertEqual(meta['proto_version'], 4)
        self.assertEqual((meta['mision'], meta['nodo'], meta['modo']), ('demeter', 1, 'vivo'))
        self.assertIsNone(meta['mission_id'])                # -DMISSION_ID = 0: sin identificador
        self.assertEqual(meta['sitio'], {'lat': 6.582, 'lon': -75.823, 'alt_msl_m': 510.0})
        self.assertEqual(self.msgs[0]['tipo'], 'meta')       # el primero de todos

    def test_estado_unidades(self):
        est = de_tipo(self.msgs, 'estado')
        slot = [e for e in est if e['fase'] == 'COAST'][20]
        self.assertEqual(slot['seq'], slot['utc_ms'] // 40)
        self.assertEqual(slot['t_ms'], slot['utc_ms'])
        self.assertGreater(slot['pos']['alt_agl_m'], 100)
        self.assertAlmostEqual(slot['pos']['alt_msl_m'] - slot['pos']['alt_agl_m'], 510.0, places=1)
        self.assertEqual(slot['pos']['fuente'], 'gnss')
        self.assertGreater(slot['vel']['u_ms'], 0)           # sube
        self.assertAlmostEqual(slot['vel']['total_ms'], math.sqrt(slot['vel']['n_ms'] ** 2 + slot['vel']['e_ms'] ** 2 + slot['vel']['u_ms'] ** 2), delta=0.02)
        self.assertEqual(slot['q'], {'w': 1.0, 'x': 0.0, 'y': 0.0, 'z': 0.0})
        self.assertFalse(slot['flags']['ekf_ok'])            # cuaternion identidad: no hay EKF
        self.assertTrue(slot['flags']['gnss_fix'])
        self.assertEqual(slot['bat_pct'], 78)                # (4000 - 3300) / 900
        self.assertIsNone(slot['secundario'])
        self.assertIsNone(slot['relay_utc_ms'])
        self.assertEqual(set(slot['act'].values()), {False})

    def test_apogeo_y_flags_por_momento(self):
        est = de_tipo(self.msgs, 'estado')
        antes = [e for e in est if e['fase'] == 'COAST'][-1]
        apo = [e for e in est if e['fase'] == 'APOGEE'][0]
        desc = [e for e in est if e['fase'] == 'DESCENT'][0]
        self.assertEqual((antes['flags']['apogeo'], antes['flags']['eyeccion']), (False, False))
        self.assertEqual((apo['flags']['apogeo'], apo['flags']['eyeccion']), (True, False))
        self.assertEqual((desc['flags']['apogeo'], desc['flags']['eyeccion']), (True, True))

    def test_eventos_en_orden_con_t_mas(self):
        evs = de_tipo(self.msgs, 'evento')
        tipos = [e['tipo'] for e in evs]
        for t in ('despegue', 'fin_combustion', 'apogeo', 'eyeccion', 'aterrizaje'):
            self.assertEqual(tipos.count(t), 1, t)
        self.assertEqual([e['fase'] for e in evs if e['tipo'] == 'fase'],
                         ['PREFLIGHT', 'ARMED', 'BOOST', 'COAST', 'APOGEE', 'DESCENT', 'LANDED'])
        orden = [t for t in tipos if t != 'fase']
        self.assertEqual(orden, ['despegue', 'fin_combustion', 'apogeo', 'eyeccion', 'aterrizaje'])
        despegue = [e for e in evs if e['tipo'] == 'despegue'][0]
        self.assertEqual(despegue['t_mas_s'], 0.0)
        apogeo = [e for e in evs if e['tipo'] == 'apogeo'][0]
        self.assertAlmostEqual(apogeo['t_mas_s'], 11.54, delta=0.15)      # sim: apogeo a los 11,54 s
        self.assertAlmostEqual(apogeo['valor'], 669.3 - 0.0, delta=3.0)   # altura sobre el sitio (sim: 669,3 m)
        previos = [e for e in evs if e['t_ms'] < despegue['t_ms']]
        self.assertTrue(previos and all(e['t_mas_s'] is None for e in previos))
        self.assertTrue(all(e['t_mas_s'] is not None for e in evs if e['t_ms'] >= despegue['t_ms']))

    def test_salud(self):
        s = de_tipo(self.msgs, 'salud', 'demeter')[-1]
        self.assertEqual(s['gnss'], {'fix': 3, 'sv': 14, 'hacc_m': None})
        self.assertEqual(s['bat_mv'], 4000)
        self.assertIsNone(s['temp_esp_c'])
        self.assertIsNone(s['temp_pi_c'])
        self.assertIsNone(s['fw_version'])
        # D-050: net_proto no trae el contador de arranques ni la calibracion: sin dato, no 0 ni false
        self.assertIsNone(s['boot_count'])
        self.assertEqual(s['calib'], {'giro': None, 'mag': None, 'baro': None, 'origen': None, 'actitud': None})
        self.assertEqual(s['alt_origen_msl_m'], 510.0)
        self.assertFalse(s['go_nogo']['listo'])               # nadie ha mandado un ARM

    def test_estacion(self):
        e = de_tipo(self.msgs, 'estacion', 'demeter')[10]
        self.assertEqual(e['pos'], {'lat': 6.579, 'lon': -75.815, 'alt_msl_m': 505.0})
        self.assertTrue(e['gnss_ok'])
        self.assertLess(e['ultimo_paquete_hace_ms'], 1000)

    def test_snapshot_valido_y_serie(self):
        snap = self.tr.snapshot('demeter')
        self.assertEqual(contrato.errores_snapshot(snap), [])
        serie = snap['serie']
        n = len(serie['t_mas_s'])
        self.assertTrue(0 < n <= 2000)
        self.assertTrue(all(len(v) == n for v in serie.values()))
        self.assertLess(serie['t_mas_s'][0], 0)               # la espera en rampa: T+ negativo
        self.assertEqual(serie['t_mas_s'], sorted(serie['t_mas_s']))
        self.assertIn(0.0, serie['t_mas_s'])                  # el despegue
        self.assertAlmostEqual(max(serie['alt_agl_m']), 669.3, delta=3.0)
        self.assertEqual(snap['estado']['fase'], 'LANDED')
        self.assertEqual(len(snap['eventos']), len(de_tipo(self.msgs, 'evento')))
        self.assertIsNone(snap['backfill'])
        self.assertIsNone(snap['vuelo_completo_url'])

    def test_snapshot_de_la_mision_sin_datos(self):
        snap = self.tr.snapshot('hermes')
        self.assertEqual(contrato.errores_snapshot(snap), [])
        self.assertIsNone(snap['estado'])
        self.assertIsNone(snap['salud'])
        self.assertEqual(snap['serie']['t_mas_s'], [])
        self.assertEqual(snap['meta']['nodo'], 2)
        self.assertIsNone(snap['estacion']['ultimo_paquete_hace_ms'])

    def test_las_listas_de_mensajes_son_independientes(self):
        """Un mensaje ya emitido no cambia despues (el snapshot no comparte el dict mutable con los emitidos)."""
        est = de_tipo(self.msgs, 'estado')[100]
        copia = json.dumps(est, sort_keys=True)
        self.tr.snapshot('demeter')
        self.assertEqual(json.dumps(est, sort_keys=True), copia)


class SinFix(Contrato):
    def test_sin_fix_pos_y_vel_nulos(self):
        tr, msgs = correr([paquete(fix=0, nsv=0)])
        e = de_tipo(msgs, 'estado')[0]
        self.assertIsNone(e['pos'])
        self.assertIsNone(e['vel'])
        self.assertIsNone(e['lkp'])
        self.assertFalse(e['flags']['gnss_fix'])
        self.assertEqual(e['calc'], {'dist_horiz_m': None, 'azimut_deg': None, 'elevacion_deg': None, 'elipse': None,
                                     't_a_apogeo_s': None, 't_restante_s': None, 'siguiente_fase': None, 't_siguiente_fase_s': None})
        self.assertEqual(de_tipo(msgs, 'salud') and de_tipo(msgs, 'salud')[0]['gnss'], {'fix': 0, 'sv': 0, 'hacc_m': None})
        self.assertValidos(msgs)
        self.assertEqual(contrato.errores_snapshot(tr.snapshot('demeter')), [])

    def test_fix_2d_da_posicion_pero_no_velocidad(self):
        _, msgs = correr([paquete(fix=2)])
        e = de_tipo(msgs, 'estado')[0]
        self.assertIsNotNone(e['pos'])
        self.assertIsNone(e['vel'])
        self.assertFalse(e['flags']['gnss_fix'])              # gnss_fix = fix >= 3
        self.assertIsNotNone(e['lkp'])

    def test_serie_sin_fix_lleva_null(self):
        tr, _ = correr([paquete(fix=0)])
        s = tr.snapshot('demeter')['serie']
        self.assertEqual((s['lat'], s['alt_agl_m'], s['vz_ms']), ([None], [None], [None]))
        self.assertEqual(s['acc_z_g'], [1.0])


class SinHora(Contrato):
    def test_utc_cero_es_baliza_lenta(self):
        lineas = [paquete(t_local=T0 + 1.0 * i, utc_ms=0) for i in range(5)]
        tr, msgs = correr(lineas)
        est = de_tipo(msgs, 'estado')
        self.assertEqual([e['utc_ms'] for e in est], [None] * 5)
        self.assertEqual([e['seq'] for e in est], [0, 1, 2, 3, 4])    # contador local
        self.assertEqual([e['enlace']['perdidos_pct_10s'] for e in est], [None] * 5)   # sin ranura no hay pierdas que contar
        t = [e['t_ms'] for e in est]
        self.assertTrue(all(isinstance(x, int) for x in t) and t == sorted(t))
        self.assertEqual(t[1] - t[0], 1000)                    # t_ms sale del reloj local
        self.assertValidos(msgs)

    def test_la_hora_vuelve(self):
        """Con hora, sin hora y con hora otra vez: t_ms sigue siendo continuo y seq no retrocede en el contador local."""
        a = paquete(t_local=T0 + 0.05, utc_ms=g.UTC0_MS + 40)
        b = paquete(t_local=T0 + 1.05, utc_ms=0)
        c = paquete(t_local=T0 + 2.05, utc_ms=g.UTC0_MS + 2040)
        _, msgs = correr([a, b, c])
        est = de_tipo(msgs, 'estado')
        self.assertEqual([e['utc_ms'] for e in est], [g.UTC0_MS + 40, None, g.UTC0_MS + 2040])
        self.assertEqual(est[1]['t_ms'], g.UTC0_MS + 40 + 1000)
        self.assertEqual(est[1]['seq'], est[0]['seq'] + 1)
        self.assertEqual(est[2]['t_ms'], g.UTC0_MS + 2040)


class Perdidas(Contrato):
    def test_conteo_exacto_en_tierra(self):
        """Demeter, 2 Hz en tierra: ranuras 1 y 13. Se pierde la 13 de un segundo: 1 perdido de 3 esperados."""
        s1 = g.UTC0_MS + 1 * 40
        lineas = [paquete(t_local=T0 + 0.1, utc_ms=s1),
                  paquete(t_local=T0 + 1.1, utc_ms=s1 + 25 * 40)]      # salta la ranura 13
        _, msgs = correr(lineas)
        est = de_tipo(msgs, 'estado')
        self.assertEqual(est[0]['enlace']['perdidos_pct_10s'], 0.0)
        self.assertEqual(est[1]['enlace']['perdidos_pct_10s'], round(100 / 3, 1))     # 1 de (1 + 2)

    def test_la_ranura_de_otro_cohete_no_cuenta(self):
        """Hermes tiene las 2 y 14: entre dos ranuras 2 consecutivas se pierde la 14, no la 1 ni la 13 de Demeter."""
        s2 = g.UTC0_MS + 2 * 40
        _, msgs = correr([paquete(rid=2, t_local=T0 + 0.1, utc_ms=s2), paquete(rid=2, t_local=T0 + 1.1, utc_ms=s2 + 1000)])
        est = de_tipo(msgs, 'estado', 'hermes')
        self.assertEqual(est[1]['enlace']['perdidos_pct_10s'], round(100 / 3, 1))

    def test_en_vuelo_se_esperan_las_diez_ranuras(self):
        """Con TF_FLYING, Demeter transmite en 1,3,6,8,11,13,16,18,21,23: faltar la 3 cuenta como una perdida."""
        base = g.UTC0_MS
        sl = lambda s: base + s * 40
        lineas = [paquete(t_local=T0 + 0.1, utc_ms=sl(1), flags=web1.TF_FLYING),
                  paquete(t_local=T0 + 0.3, utc_ms=sl(6), flags=web1.TF_FLYING)]      # faltan 3 (propia) y 2, 4, 5 (ajenas)
        _, msgs = correr(lineas)
        self.assertEqual(de_tipo(msgs, 'estado')[1]['enlace']['perdidos_pct_10s'], round(100 / 3, 1))

    def test_ventana_de_diez_segundos(self):
        """Dos ranuras base por segundo (1 y 13); en el segundo 1 se pierde la 13. 12 s despues ya no cuenta."""
        lineas = []
        for seg in range(14):
            for sl in (1, 13):
                if (seg, sl) != (1, 13):
                    lineas.append(paquete(t_local=T0 + seg + 0.1 + 0.001 * sl, utc_ms=g.UTC0_MS + seg * 1000 + sl * 40))
        _, msgs = correr(lineas)
        est = de_tipo(msgs, 'estado')
        self.assertEqual([e['enlace']['perdidos_pct_10s'] for e in est[:3]], [0.0, 0.0, 0.0])
        self.assertEqual(est[3]['enlace']['perdidos_pct_10s'], 20.0)       # llega (seg 2, ranura 1): 1 perdido de 1+1+1+(1+1)
        self.assertEqual(max(e['enlace']['perdidos_pct_10s'] for e in est), 20.0)
        self.assertEqual(est[-1]['enlace']['perdidos_pct_10s'], 0.0)       # la perdida salio de la ventana de 10 s

    def test_un_hueco_enorme_es_un_reinicio(self):
        """gnd_rx.cpp: mas de MAX_GAP_SLOTS es un reinicio del cohete, no perdidas."""
        lineas = [paquete(t_local=T0 + 0.1, utc_ms=g.UTC0_MS + 40),
                  paquete(t_local=T0 + 1.1, utc_ms=g.UTC0_MS + 40 + 3 * 60 * 1000)]
        _, msgs = correr(lineas)
        self.assertEqual(de_tipo(msgs, 'estado')[1]['enlace']['perdidos_pct_10s'], 0.0)

    def test_vuelo_con_corte_de_3_s(self):
        lineas = vuelo_demeter(1.0, perdidas=((5.0, 8.0),))
        _, msgs = correr(lineas)
        est = de_tipo(msgs, 'estado')
        coast = [e for e in est if e['fase'] == 'COAST']
        self.assertGreater(max(e['enlace']['perdidos_pct_10s'] for e in coast), 20.0)      # ~30 de ~100 en la ventana
        self.assertEqual([e for e in est if e['fase'] == 'DESCENT'][-1]['enlace']['perdidos_pct_10s'], 0.0)
        self.assertValidos(msgs)

    def test_rssi_y_snr_de_la_linea(self):
        _, msgs = correr([paquete()])
        # linea_t usa -80.0 dBm y 7.5 dB por omision
        self.assertEqual(de_tipo(msgs, 'estado')[0]['enlace']['rssi_dbm'], -80)
        self.assertEqual(de_tipo(msgs, 'estado')[0]['enlace']['snr_db'], 7.5)
        self.assertEqual(de_tipo(msgs, 'salud')[0]['rssi_tierra_dbm'], -80)


class AlarmaDescenso(Contrato):
    def test_no_se_activa_con_el_descenso_nominal(self):
        _, msgs = correr(vuelo_demeter(1.0))
        self.assertFalse(any(e['alarmas']['descenso_rapido'] for e in de_tipo(msgs, 'estado')))
        self.assertEqual([e for e in de_tipo(msgs, 'evento') if e['tipo'] == 'alarma_descenso'], [])

    def test_se_activa_con_descenso_rapido(self):
        tr, msgs = correr(vuelo_demeter(1.5))
        self.assertValidos(msgs)
        est = de_tipo(msgs, 'estado')
        con = [e for e in est if e['alarmas']['descenso_rapido']]
        self.assertGreater(len(con), 50)
        self.assertTrue(all(e['fase'] == 'DESCENT' and e['vel']['u_ms'] < -web1.ALARMA_DESCENSO_MS for e in con))
        sin = [e for e in est if e['fase'] == 'DESCENT' and not e['alarmas']['descenso_rapido']]
        self.assertTrue(all(e['vel']['u_ms'] >= -web1.ALARMA_DESCENSO_MS for e in sin))
        evs = [e for e in de_tipo(msgs, 'evento') if e['tipo'] == 'alarma_descenso']
        self.assertEqual([e['activa'] for e in evs], [True, False])
        self.assertLess(evs[0]['valor'], -web1.ALARMA_DESCENSO_MS)
        self.assertEqual(evs[0]['t_ms'], con[0]['t_ms'])
        self.assertIsNotNone(evs[0]['t_mas_s'])

    def test_sin_fix_la_alarma_se_mantiene(self):
        """Si se pierde el fix 3D en pleno descenso rapido, la alarma no parpadea: se mantiene hasta que haya dato o termine DESCENT."""
        _, msgs = correr(vuelo_demeter(1.5, fix_perdido=(40.0, 50.0)))
        evs = [e for e in de_tipo(msgs, 'evento') if e['tipo'] == 'alarma_descenso']
        self.assertEqual([e['activa'] for e in evs], [True, False])
        sin_vel = [e for e in de_tipo(msgs, 'estado') if e['vel'] is None and e['fase'] == 'DESCENT']
        self.assertTrue(sin_vel and all(e['alarmas']['descenso_rapido'] for e in sin_vel))

    def test_solo_en_descent(self):
        """Caer a 30 m/s en COAST o en CAIDA no es la alarma: solo cuenta en PARACAIDAS (maquina_estados §5)."""
        for moment in (web1.M_COAST, web1.M_CAIDA):
            with self.subTest(moment=moment):
                _, msgs = correr([paquete(state=web1.S_FLY, moment=moment, vu=-30.0, alt_msl_m=900.0)])
                self.assertFalse(de_tipo(msgs, 'estado')[0]['alarmas']['descenso_rapido'])
                self.assertEqual([e for e in de_tipo(msgs, 'evento') if e['tipo'] == 'alarma_descenso'], [])

    def test_umbral_exacto(self):
        """vz = -10,0 no es menor que -ALARMA_DESCENSO_MS; -10,01 si."""
        for vu, esperado in ((-10.0, False), (-10.01, True), (-9.9, False)):
            with self.subTest(vu=vu):
                _, msgs = correr([paquete(state=web1.S_FLY, moment=web1.M_PARACAIDAS, vu=vu, alt_msl_m=800.0)])
                self.assertEqual(de_tipo(msgs, 'estado')[0]['alarmas']['descenso_rapido'], esperado)

    def test_sin_fix_3d_no_se_evalua(self):
        _, msgs = correr([paquete(state=web1.S_FLY, moment=web1.M_PARACAIDAS, vu=-30.0, alt_msl_m=800.0, fix=2)])
        self.assertFalse(de_tipo(msgs, 'estado')[0]['alarmas']['descenso_rapido'])


class LKP(Contrato):
    def test_lkp_tras_perder_el_fix(self):
        """Se pierde el fix en el descenso: pos pasa a null y lkp conserva la ultima posicion valida."""
        tr, msgs = correr(vuelo_demeter(1.0, fix_perdido=(40.0, 60.0)))
        self.assertValidos(msgs)
        est = de_tipo(msgs, 'estado')
        antes = [e for e in est if e['pos'] is not None and e['fase'] == 'DESCENT' and e['lkp'] is not None]
        sin = [e for e in est if e['pos'] is None and e['fase'] == 'DESCENT']
        self.assertGreater(len(sin), 100)
        ultimo_valido = [e for e in est if e['pos'] is not None and e['t_ms'] < sin[0]['t_ms']][-1]
        for e in sin:
            self.assertEqual(e['lkp'], ultimo_valido['lkp'])
            self.assertEqual(e['lkp']['lat'], ultimo_valido['pos']['lat'])
            self.assertEqual(e['lkp']['alt_agl_m'], ultimo_valido['pos']['alt_agl_m'])
            self.assertEqual(e['lkp']['utc_ms'], ultimo_valido['utc_ms'])
            self.assertIsNone(e['calc']['dist_horiz_m'])
            self.assertIsNone(e['calc']['elipse'])
        despues = [e for e in est if e['pos'] is not None and e['t_ms'] > sin[-1]['t_ms']][0]
        self.assertEqual(despues['lkp']['lat'], despues['pos']['lat'])         # el LKP se renueva con el fix
        self.assertTrue(antes)

    def test_lkp_tras_perder_la_senal(self):
        """Se corta el enlace en pleno descenso: no llega nada, pero el snapshot conserva el LKP y la edad crece."""
        lineas = [(t, l) for t, l in vuelo_demeter(1.0)]
        corte = next(t for t, l in lineas if l.startswith('@T') and t > T0 + 30 + 60)
        tr, msgs = correr([(t, l) for t, l in lineas if t < corte])
        ultimo = tr.cohetes[1].estado
        self.assertIsNotNone(ultimo['lkp'])
        tick = tr.tick(corte + 20.0)
        est = [m['datos'] for m in tick if m['tipo'] == 'estacion' and m['mision'] == 'demeter'][0]
        self.assertGreaterEqual(est['ultimo_paquete_hace_ms'], 20000)
        snap = tr.snapshot('demeter', corte + 20.0)
        self.assertEqual(snap['estado']['lkp'], ultimo['lkp'])
        self.assertGreaterEqual(snap['estacion']['ultimo_paquete_hace_ms'], 20000)
        self.assertEqual(contrato.errores_snapshot(snap), [])
        self.assertValidos(tick)


class Calculos(Contrato):
    def setUp(self):
        self.tr = Traductor()
        self.tr.procesar(g.linea_time(6.5790, -75.8150, 505.0), T0)

    def estado(self, **kw):
        t, linea = paquete(**kw)
        return de_tipo(self.tr.procesar(linea, t), 'estado')[0]

    def test_distancia_azimut_y_elevacion(self):
        la0, lo0, h0 = 6.5790, -75.8150, 505.0
        casos = [(0.0, 100.0, 0.0, 100.0, 0.0, 0.0), (100.0, 0.0, 0.0, 100.0, 90.0, 0.0),
                 (0.0, -100.0, 0.0, 100.0, 180.0, 0.0), (-100.0, 0.0, 0.0, 100.0, 270.0, 0.0),
                 (0.0, 100.0, 100.0, 100.0, 0.0, 45.0), (0.0, 0.0, 100.0, 0.0, 0.0, 90.0)]
        for este, norte, arriba, dist, az, el in casos:
            with self.subTest(este=este, norte=norte, arriba=arriba):
                lat, lon = web1.desplazar_latlon(la0, lo0, este, norte)
                e = self.estado(lat=lat, lon=lon, alt_msl_m=h0 + arriba)
                self.assertAlmostEqual(e['calc']['dist_horiz_m'], dist, delta=0.25)
                if dist:
                    self.assertAlmostEqual(math.cos(math.radians(e['calc']['azimut_deg'] - az)), 1.0, places=4)
                self.assertAlmostEqual(e['calc']['elevacion_deg'], el, delta=0.3)

    def test_la_rampa_vista_desde_la_estacion(self):
        """La rampa esta ~0,9 km al oeste y ~0,3 km al norte de la estacion; la distancia coincide con una cuenta independiente (haversine)."""
        e = self.estado(lat=web1.SITIO_LAT, lon=web1.SITIO_LON, alt_msl_m=510.0)
        la1, lo1, la2, lo2 = map(math.radians, (6.5790, -75.8150, web1.SITIO_LAT, web1.SITIO_LON))
        h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
        haversine = 2 * 6371008.8 * math.asin(math.sqrt(h))
        self.assertAlmostEqual(e['calc']['dist_horiz_m'], haversine, delta=haversine * 0.005)
        self.assertTrue(285 < e['calc']['azimut_deg'] < 295)           # al oeste-noroeste
        self.assertGreater(e['calc']['elevacion_deg'], 0)              # 5 m mas alta
        self.assertValidos([{'tipo': 'estado', 'mision': 'demeter', 'datos': e}])

    def test_sin_posicion_de_la_estacion_calc_es_null(self):
        tr = Traductor()
        t, linea = paquete()
        e = de_tipo(tr.procesar(linea, t), 'estado')[0]
        self.assertEqual((e['calc']['dist_horiz_m'], e['calc']['azimut_deg'], e['calc']['elevacion_deg']), (None, None, None))

    def test_elipse_en_descent(self):
        """alt_agl 300 m, bajando 10 m/s con deriva (vn 3, ve 4): 30 s restantes -> 90 m al norte, 120 m al este."""
        lat, lon = web1.SITIO_LAT, web1.SITIO_LON
        e = self.estado(lat=lat, lon=lon, alt_msl_m=810.0, vn=3.0, ve=4.0, vu=-10.0, state=web1.S_FLY, moment=web1.M_PARACAIDAS)
        el = e['calc']['elipse']
        este, norte, _ = web1.enu_wgs84(lat, lon, 810.0, el['lat'], el['lon'], 810.0)
        self.assertAlmostEqual(este, 120.0, delta=0.5)
        self.assertAlmostEqual(norte, 90.0, delta=0.5)
        self.assertEqual(el['semieje_mayor_m'], 45.0)                  # 30 % de 150 m
        self.assertEqual(el['semieje_menor_m'], 22.5)                  # la mitad
        self.assertAlmostEqual(el['rumbo_deg'], math.degrees(math.atan2(4, 3)), delta=0.1)
        self.assertValidos([{'tipo': 'estado', 'mision': 'demeter', 'datos': e}])

    def test_elipse_minimo_de_20_m(self):
        e = self.estado(alt_msl_m=530.0, vn=0.1, ve=0.0, vu=-10.0, state=web1.S_FLY, moment=web1.M_PARACAIDAS)
        el = e['calc']['elipse']
        self.assertEqual((el['semieje_mayor_m'], el['semieje_menor_m']), (20.0, 20.0))
        self.assertEqual(el['rumbo_deg'], 0.0)

    def test_elipse_solo_en_descent(self):
        for state, moment in ((web1.S_FLY, web1.M_BOOST), (web1.S_FLY, web1.M_COAST), (web1.S_FLY, web1.M_APOGEO),
                              (web1.S_FLY, web1.M_CAIDA), (web1.S_TIERRA, 0), (web1.S_RECOVERY, web1.M_ATERRIZAJE)):
            with self.subTest(state=state, moment=moment):
                e = self.estado(alt_msl_m=810.0, vn=3.0, ve=4.0, vu=-10.0, state=state, moment=moment)
                self.assertIsNone(e['calc']['elipse'])

    def test_elipse_necesita_velocidad_y_descenso(self):
        sin_vel = self.estado(alt_msl_m=810.0, vu=-10.0, state=web1.S_FLY, moment=web1.M_PARACAIDAS, fix=2)
        subiendo = self.estado(alt_msl_m=810.0, vu=+5.0, state=web1.S_FLY, moment=web1.M_PARACAIDAS)
        self.assertIsNone(sin_vel['calc']['elipse'])
        self.assertIsNone(subiendo['calc']['elipse'])

    def test_elipse_en_el_vuelo_de_la_sim_es_consistente(self):
        """En el descenso real de la sim., el centro cae cerca de donde la sim. dice que aterriza."""
        tr = Traductor()
        tr.procesar(g.linea_time(*g.ESTACION), T0)
        _, msgs = correr(vuelo_demeter(1.0), tr)
        est = de_tipo(msgs, 'estado')
        con = [e for e in est if e['calc']['elipse'] is not None]
        self.assertGreater(len(con), 100)
        final = [e for e in est if e['fase'] == 'LANDED'][0]['pos']
        mitad = con[len(con) // 2]['calc']['elipse']
        este, norte, _ = web1.enu_wgs84(final['lat'], final['lon'], 510.0, mitad['lat'], mitad['lon'], 510.0)
        self.assertLess(math.hypot(este, norte), 120.0)               # una estimacion lineal a mitad del descenso


class GoNoGo(Contrato):
    def preparar(self, rid=1):
        tr = Traductor()
        t, linea = paquete(rid=rid)
        tr.procesar(linea, t)
        return tr

    def go(self, tr, t, mision='demeter'):
        """El go_nogo vigente: el del snapshot, y se comprueba que el mensaje `salud` que sale despues dice lo mismo."""
        snap = tr.snapshot(mision, t)
        self.assertEqual(contrato.errores_snapshot(snap), [])
        c = tr.cohetes[web1.NODO[mision]]
        c.salud_sucia, c.t_salud = True, None
        msgs = tr.tick(t)
        s = [m['datos'] for m in msgs if m['tipo'] == 'salud' and m['mision'] == mision]
        self.assertEqual(len(s), 1)
        self.assertValidos(msgs)
        self.assertEqual(s[0]['go_nogo'], snap['salud']['go_nogo'])
        return s[0]['go_nogo']

    def test_sin_arm_no_esta_listo(self):
        tr = self.preparar()
        tr.procesar(g.linea_l(1, spare_state=2, spare_pct=100), T0 + 0.2)
        gn = self.go(tr, T0 + 2.0)
        self.assertFalse(gn['listo'])
        self.assertEqual([(c['id'], c['ok']) for c in gn['condiciones']], [('gnss', True), ('bateria', True), ('reserva', True)])

    def test_sin_arm_las_condiciones_conocidas_fallan(self):
        tr = Traductor()
        t, linea = paquete(fix=0, vbat=3400)
        tr.procesar(linea, t)
        tr.procesar(g.linea_l(1, spare_state=1, spare_pct=40), T0 + 0.2)
        gn = self.go(tr, T0 + 2.0)
        self.assertEqual([(c['id'], c['ok']) for c in gn['condiciones']], [('gnss', False), ('bateria', False), ('reserva', False)])
        self.assertFalse(gn['listo'])

    def bloque_no_apto(self, tr, t, nombre='Demeter', extra=''):
        for i, linea in enumerate((f'[cmd ] {nombre}: NO APTO | estado=TIERRA momento=- alt=0.0 m vz=0.0 m/s reserva=40% vbat=4000 mV',
                                   '[cmd ]   - reserva incompleta', '[cmd ]   - sin fix 3D del GNSS', '[cmd ]   - aceleracion distinta de 1 g: el cohete se mueve',
                                   '[cmd ] Seguro que quieres forzar? (10 s): escribe si o no')):
            tr.procesar(linea, t + i * 0.01)

    def test_no_apto_con_motivos(self):
        tr = self.preparar()
        self.bloque_no_apto(tr, T0 + 1.0)
        gn = self.go(tr, T0 + 3.0)
        self.assertFalse(gn['listo'])
        ok = {c['id']: c['ok'] for c in gn['condiciones']}
        self.assertEqual((ok['reserva'], ok['gnss'], ok['movimiento']), (False, False, False))
        self.assertTrue(ok['bateria'] and ok['lsm'] and ok['bmp'] and ok['sd'])
        self.assertEqual(len(gn['condiciones']), len(web1.CONDICIONES_ARM))

    def test_los_motivos_llegan_a_medias_y_el_snapshot_no_los_pierde(self):
        """Un snapshot en medio de la respuesta no debe tragarse los motivos que faltan."""
        tr = self.preparar()
        tr.procesar('[cmd ] Demeter: NO APTO | estado=TIERRA momento=- alt=0.0 m vz=0.0 m/s reserva=40% vbat=4000 mV', T0 + 1.0)
        tr.procesar('[cmd ]   - reserva incompleta', T0 + 1.01)
        tr.snapshot('demeter', T0 + 1.02)
        tr.procesar('[cmd ]   - sin fix 3D del GNSS', T0 + 1.03)
        ok = {c['id']: c['ok'] for c in self.go(tr, T0 + 3.0)['condiciones']}
        self.assertEqual((ok['reserva'], ok['gnss']), (False, False))

    def test_motivo_de_sensor_enciende_falla_activa(self):
        tr = self.preparar()
        for i, l in enumerate(('[cmd ] Demeter: NO APTO | estado=TIERRA momento=- alt=0.0 m vz=0.0 m/s reserva=100% vbat=4000 mV',
                               '[cmd ]   - LSM6DSO32 sin datos')):
            tr.procesar(l, T0 + 1 + i * 0.01)
        t, linea = paquete(t_local=T0 + 2.0, utc_ms=g.UTC0_MS + 40 + 1000)
        e = de_tipo(tr.procesar(linea, t), 'estado')[0]
        self.assertTrue(e['flags']['falla_activa'])

    def test_apto_es_un_arm_y_queda_listo(self):
        tr = self.preparar()
        tr.procesar('[cmd ] Demeter: APTO | estado=TIERRA momento=- alt=0.0 m vz=0.0 m/s reserva=100% vbat=4000 mV', T0 + 1.0)
        tr.procesar('[cmd ] Confirma el armado (10 s): escribe si o no', T0 + 1.01)
        gn = self.go(tr, T0 + 3.0)
        self.assertTrue(gn['listo'])
        self.assertTrue(all(c['ok'] for c in gn['condiciones']))

    def test_ejecutado_despues_de_un_apto_sigue_listo(self):
        tr = self.preparar()
        tr.procesar('[cmd ] Demeter: APTO | estado=TIERRA momento=- alt=0.0 m vz=0.0 m/s reserva=100% vbat=4000 mV', T0 + 1.0)
        tr.procesar('[cmd ] Confirma el armado (10 s): escribe si o no', T0 + 1.01)
        tr.procesar('[cmd ] Demeter: EJECUTADO | estado=ARMED momento=- alt=0.0 m vz=0.0 m/s reserva=100% vbat=4000 mV', T0 + 5.0)
        self.assertTrue(self.go(tr, T0 + 7.0)['listo'])

    def test_otro_comando_no_borra_el_go_nogo(self):
        """Un `launch` no apto desde TIERRA ("el cohete no esta armado") no es un ARM: no cambia el go/no-go."""
        tr = self.preparar()
        self.bloque_no_apto(tr, T0 + 1.0)
        tr.procesar('[cmd ] Demeter: NO APTO | estado=TIERRA momento=- alt=0.0 m vz=0.0 m/s reserva=100% vbat=4000 mV', T0 + 5.0)
        tr.procesar('[cmd ]   - el cohete no esta armado', T0 + 5.01)
        ok = {c['id']: c['ok'] for c in self.go(tr, T0 + 7.0)['condiciones']}
        self.assertFalse(ok['reserva'])                      # sigue la respuesta del ARM
        self.assertNotIn('no_armado', ok)

    def test_el_comando_escrito_atribuye_la_respuesta(self):
        """Con el enganche `comando()`, un NO APTO con un motivo fuera del checklist si cuenta como ARM."""
        tr = self.preparar()
        tr.comando('d armar', T0 + 0.9)
        tr.procesar('[cmd ] Demeter: NO APTO | estado=TIERRA momento=- alt=0.0 m vz=0.0 m/s reserva=100% vbat=4000 mV', T0 + 1.0)
        tr.procesar('[cmd ]   - hay un iman presente: despertaria al instante', T0 + 1.01)
        gn = self.go(tr, T0 + 3.0)
        self.assertFalse(gn['listo'])
        self.assertIn(('iman', False), [(c['id'], c['ok']) for c in gn['condiciones']])
        # y con otro comando, esa misma respuesta no es del ARM
        tr2 = self.preparar()
        tr2.comando('d launch', T0 + 0.9)
        self.bloque_no_apto(tr2, T0 + 1.0)
        self.assertEqual([c['id'] for c in self.go(tr2, T0 + 3.0)['condiciones']], ['gnss', 'bateria'])

    def test_cada_cohete_tiene_su_go_nogo(self):
        tr = Traductor()
        for rid in (1, 2):
            t, linea = paquete(rid=rid, utc_ms=g.UTC0_MS + 40 * (1 if rid == 1 else 2))
            tr.procesar(linea, t)
        self.bloque_no_apto(tr, T0 + 1.0, nombre='Hermes')
        d = self.go(tr, T0 + 3.0, 'demeter')
        h = self.go(tr, T0 + 5.0, 'hermes')
        self.assertEqual([c['id'] for c in d['condiciones']], ['gnss', 'bateria'])
        self.assertFalse({c['id']: c['ok'] for c in h['condiciones']}['reserva'])

    def test_todos_los_textos_de_net_proto_se_reconocen(self):
        """Los 21 textos de `reasonText` (net_proto.h) tienen su id; si el firmware cambia uno, esto falla."""
        ruta = os.path.join(g.RAIZ, 'firmware', 'common', 'net_proto', 'net_proto.h')
        with open(ruta, encoding='utf-8') as f:
            codigo = f.read()
        self.assertEqual(len(web1.MOTIVOS), 21)
        for _, texto in web1.MOTIVOS:
            self.assertIn(f'"{texto}"', codigo, texto)


class MetaYMision(Contrato):
    def test_meta_una_vez_y_otra_al_cambiar_mission_id(self):
        lineas = [paquete(t_local=T0 + 0.1, utc_ms=g.UTC0_MS + 40, mission=7),
                  paquete(t_local=T0 + 0.6, utc_ms=g.UTC0_MS + 40 + 500, mission=7),
                  paquete(t_local=T0 + 1.1, utc_ms=g.UTC0_MS + 40 + 1000, mission=8)]
        tr = Traductor()
        tipos = []
        for t, l in lineas:
            tipos.append([(m['tipo'], m['datos'].get('mission_id')) for m in tr.procesar(l, t) if m['tipo'] == 'meta'])
        self.assertEqual(tipos, [[('meta', 7)], [], [('meta', 8)]])

    def test_cambio_de_mision_reinicia_la_serie_y_los_eventos(self):
        tr = Traductor()
        t, l = paquete(mission=7)
        tr.procesar(l, t)
        self.assertEqual(len(tr.snapshot('demeter')['serie']['t_mas_s']), 1)
        t, l = paquete(mission=8, t_local=T0 + 1.0, utc_ms=g.UTC0_MS + 1040)
        tr.procesar(l, t)
        snap = tr.snapshot('demeter')
        self.assertEqual(len(snap['serie']['t_mas_s']), 1)
        self.assertEqual(snap['meta']['mission_id'], 8)
        self.assertEqual([e['fase'] for e in snap['eventos']], ['PREFLIGHT'])

    def test_las_dos_misiones_son_independientes(self):
        tr = Traductor()
        for rid, utc in ((1, g.UTC0_MS + 40), (2, g.UTC0_MS + 80)):
            t, l = paquete(rid=rid, utc_ms=utc, state=web1.S_ARMED if rid == 2 else web1.S_TIERRA)
            out = tr.procesar(l, t)
            self.assertEqual({m['mision'] for m in out if m['tipo'] in ('meta', 'estado')}, {MISIONES[rid]})
        self.assertEqual(tr.snapshot('demeter')['estado']['fase'], 'PREFLIGHT')
        self.assertEqual(tr.snapshot('hermes')['estado']['fase'], 'ARMED')


MISIONES = {1: 'demeter', 2: 'hermes'}


class EstacionYLineas(Contrato):
    def test_posicion_y_gnss_de_la_estacion(self):
        tr = Traductor()
        tr.procesar('@G 0', T0)
        out = tr.tick(T0 + 1.0)
        e = de_tipo(out, 'estacion', 'demeter')[0]
        self.assertEqual((e['pos'], e['gnss_ok'], e['ultimo_paquete_hace_ms']), (None, False, None))
        tr.procesar('@G 1', T0 + 1.0)
        tr.procesar(g.linea_time(6.5790123, -75.8150456, 505.26, n=12), T0 + 1.1)
        e = de_tipo(tr.tick(T0 + 2.1), 'estacion', 'hermes')[0]
        self.assertEqual(e['pos'], {'lat': 6.5790123, 'lon': -75.8150456, 'alt_msl_m': 505.3})
        self.assertTrue(e['gnss_ok'])
        self.assertEqual(e['utc_ms'], int(round((T0 + 2.1) * 1000)))
        self.assertValidos([{'tipo': 'estacion', 'mision': 'hermes', 'datos': e}])

    def test_time_sin_hora_no_borra_la_ultima_posicion(self):
        tr = Traductor()
        tr.procesar(g.linea_time(6.579, -75.815, 505.0), T0)
        tr.procesar('[time] sin hora (q=3) anclas=0 sin_flanco=0', T0 + 1)
        self.assertEqual(tr.pos_estacion, (6.579, -75.815, 505.0))

    def test_pos_con_n_cero_se_ignora(self):
        tr = Traductor()
        tr.procesar(g.linea_time(0.0, 0.0, 0.0, n=0), T0)
        self.assertIsNone(tr.pos_estacion)

    def test_el_latido_de_la_estacion_es_a_1_hz(self):
        tr = Traductor()
        n = 0
        for i in range(100):
            n += len([m for m in tr.procesar('[bcn ] tx=1 err=0', T0 + i * 0.1) if m['tipo'] == 'estacion' and m['mision'] == 'demeter'])
        self.assertAlmostEqual(n, 10, delta=1)

    def test_ultimo_paquete_hace_ms(self):
        tr = Traductor()
        t, l = paquete(t_local=T0 + 5.0)
        tr.procesar(l, t)
        e = de_tipo(tr.tick(T0 + 8.0), 'estacion', 'demeter')
        self.assertEqual(e[0]['ultimo_paquete_hace_ms'], 3000)

    def test_lineas_basura_no_rompen_ni_emiten(self):
        tr = Traductor()
        _, valida = paquete()
        malas = ['@T', '@T 1 2', '@T -80 7 zz', '@T -80.0 7.5 ' + 'ab' * 63, '@T -80.0 7.5 ' + 'ab' * 65, '@L zz', '@L ' + 'ab' * 10, '',
                 'basura', '[cmd ]', '[cmd ] Marte: APTO', '[time] pos(x)=a b c m', '@G', '@T -80.0 7.5 ' + valida.split(' ')[3][:-2]]
        # un TELEM con un ID de cohete que no existe (tipo 1, rocket_id 9)
        malo = bytearray(bytes.fromhex(valida.split(' ')[3]))
        malo[1] = 9
        malas.append('@T -80.0 7.5 ' + malo.hex())
        for i, l in enumerate(malas):
            out = tr.procesar(l, T0 + i * 0.001)
            self.assertEqual([m for m in out if m['tipo'] in ('meta', 'estado', 'evento')], [], l)

    def test_acepta_el_cr_final(self):
        _, msgs = correr([(T0, paquete()[1] + '\r')])
        self.assertEqual(len(de_tipo(msgs, 'estado')), 1)


class ConElGeneradorDeDemo(Contrato):
    """Las lineas que inventa `dashboard.py --demo` (CRC en cero, hora de la PC, sin alinear a la ranura) tambien se traducen."""

    def test_lineas_del_demo(self):
        import dashboard
        tr = Traductor()
        msgs = []
        t = T0
        for i in range(30):
            for rid in (1, 2):
                st = 1 if i < 10 else (2 if i < 20 else 3)
                b = dashboard.TELEM.pack(1, rid, 0, int((t + i) * 1000), 65820000, -758230000, int((510 + 3 * math.sin(i)) * 100), 0, 0, 0, 32767, 0, 0, 0,
                                         0, 0, 1000, 0, 0, 0, 3, 15 + rid, 4100, 25, 0, st | (1 << 4 if st == 3 else 0), 0, 0, 4, 0, 0)
                msgs += tr.procesar(f'@T {-70.0 - rid:.1f} 9.5 {b.hex()}', t + i)
            msgs += tr.procesar('@G 1', t + i)
        for i, l in enumerate(('[cmd ] Demeter: APTO | estado=TIERRA', '[cmd ] Confirma el armado (10 s): escribe si o no',
                               '[cmd ] Hermes: NO APTO | estado=TIERRA', '[cmd ]   - sin aterrizaje detectado', '[cmd ]   - altura aumentando',
                               '[cmd ] Seguro que quieres forzar? (10 s): escribe si o no')):
            msgs += tr.procesar(l, t + 31 + i * 0.01)
        msgs += tr.tick(t + 40)
        self.assertValidos(msgs)
        fases = [e['fase'] for e in de_tipo(msgs, 'evento', 'demeter') if e['tipo'] == 'fase']
        self.assertEqual(fases, ['PREFLIGHT', 'ARMED'])       # FLY + LAUNCH sigue siendo ARMED: no hay un evento de mas
        self.assertTrue(tr.snapshot('demeter')['salud']['go_nogo']['listo'])          # el APTO era de un ARM
        self.assertFalse(tr.snapshot('hermes')['salud']['go_nogo']['listo'])          # "sin aterrizaje" no es de un ARM: sin ARM no hay listo


class Cuaternion(Contrato):
    def test_cuaternion_normalizado_y_w_positivo(self):
        s = round(32767 * math.sqrt(0.5))
        for quat in ((s, s, 0, 0), (-s, -s, 0, 0), (32767, 0, 0, 0), (0, 0, 0, 0)):
            with self.subTest(quat=quat):
                _, msgs = correr([paquete(quat=quat)])
                e = de_tipo(msgs, 'estado')[0]
                self.assertGreaterEqual(e['q']['w'], 0)
                self.assertAlmostEqual(sum(e['q'][k] ** 2 for k in 'wxyz'), 1.0, places=3)
                self.assertEqual(e['flags']['ekf_ok'], quat not in ((32767, 0, 0, 0), (0, 0, 0, 0)))   # identidad o nulo: no hay EKF
                self.assertValidos(msgs)

    def test_bateria(self):
        for vbat, pct in ((4200, 100), (3300, 0), (3750, 50), (5000, 100), (3000, 0)):
            with self.subTest(vbat=vbat):
                self.assertEqual(de_tipo(correr([paquete(vbat=vbat)])[1], 'estado')[0]['bat_pct'], pct)
        self.assertIsNone(de_tipo(correr([paquete(vbat=0)])[1], 'estado')[0]['bat_pct'])


class SerieDecimada(Contrato):
    def test_decimar_indices(self):
        vuelo = [False] * 3000 + [True] * 500 + [False] * 500
        idx = web1.decimar_indices(vuelo, 2000)
        self.assertEqual(len(idx), 2000)
        self.assertEqual(idx, sorted(set(idx)))
        self.assertTrue(set(range(3000, 3500)) <= set(idx))     # todo el vuelo
        self.assertEqual((idx[0], idx[-1]), (0, 3999))          # el primero y el ultimo
        self.assertEqual(web1.decimar_indices([False] * 10, 2000), list(range(10)))

    def test_si_solo_el_vuelo_no_cabe_se_decima_parejo(self):
        idx = web1.decimar_indices([True] * 5000, 2000)
        self.assertEqual((len(idx), idx[0], idx[-1]), (2000, 0, 4999))

    def test_snapshot_de_espera_larga_mas_vuelo(self):
        """30 min en la rampa a 2 Hz (3600 puntos) y luego el vuelo a 10 Hz: caben 2000 y el vuelo queda completo."""
        tr = Traductor()
        n = 0
        utc = g.UTC0_MS
        for i in range(3600):                                  # espera: ranuras 1 y 13 de cada segundo
            utc = g.UTC0_MS + (1 + 12 * (i % 2)) * 40 + (i // 2) * 1000
            tr.procesar(paquete(t_local=T0 + i * 0.5, utc_ms=utc)[1], T0 + i * 0.5)
        for i in range(300):                                   # 30 s de vuelo a 10 Hz
            utc = g.UTC0_MS + 2_000_000 + i * 100
            moment = web1.M_BOOST if i < 100 else web1.M_COAST
            t, l = paquete(t_local=T0 + 2000 + i * 0.1, utc_ms=utc, state=web1.S_FLY, moment=moment, alt_msl_m=510.0 + i,
                           flags=web1.TF_FLYING, vu=10.0)
            tr.procesar(l, t)
        snap = tr.snapshot('demeter')
        self.assertEqual(contrato.errores_snapshot(snap), [])
        s = snap['serie']
        self.assertEqual(len(s['t_mas_s']), 2000)
        self.assertEqual(sum(1 for t in s['t_mas_s'] if t is not None and t >= 0), 300)    # toda la resolucion en vuelo
        self.assertTrue(all(t < 0 for t in s['t_mas_s'][:1700]))                           # el resto es espera

    def test_sin_despegue_t_mas_s_es_null(self):
        tr, _ = correr([paquete(), paquete(t_local=T0 + 1.0, utc_ms=g.UTC0_MS + 1040)])
        self.assertEqual(tr.snapshot('demeter')['serie']['t_mas_s'], [None, None])


class Reproceso(Contrato):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.TemporaryDirectory()
        cls.sesion = os.path.join(cls.dir.name, '20261108_100000_tierra.txt')
        with open(cls.sesion, 'w', encoding='utf-8') as f:
            f.write(g.sesion_texto(vuelo_demeter(1.5)))
            f.write('1793981000.000 [bcn ] tx=1 err=0\n')

    @classmethod
    def tearDownClass(cls):
        cls.dir.cleanup()

    def test_leer_sesion(self):
        with open(os.path.join(self.dir.name, 'x.txt'), 'w', encoding='utf-8') as f:
            f.write('100.500 @G 1\n\nsin hora aqui\n101.000 [time] sin hora (q=3)\n')
        self.assertEqual(list(web1.leer_sesion(f.name)), [(100.5, '@G 1'), (100.5, 'sin hora aqui'), (101.0, '[time] sin hora (q=3)')])

    def test_cli_genera_un_jsonl_valido(self):
        salida = os.path.join(self.dir.name, 'web1.jsonl')
        snap = os.path.join(self.dir.name, 'snap.json')
        r = subprocess.run([sys.executable, '-I', os.path.join(g.RAIZ, 'estacion', 'web1.py'), self.sesion, '--salida', salida, '--snapshot', snap],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        with open(salida, encoding='utf-8') as f:
            msgs = [json.loads(l) for l in f]
        self.assertGreater(len(msgs), 1000)
        self.assertEqual({m['tipo'] for m in msgs}, {'meta', 'estado', 'salud', 'estacion', 'evento'})
        self.assertValidos(msgs)
        with open(snap, encoding='utf-8') as f:
            snaps = json.load(f)
        self.assertEqual(set(snaps), {'demeter', 'hermes'})
        for s in snaps.values():
            self.assertEqual(contrato.errores_snapshot(s), [])
        self.assertIn('estado', r.stderr)
        self.assertIn(f'{len(msgs)} mensajes', r.stderr)

    def test_el_reproceso_es_igual_que_el_vivo(self):
        """Procesar el archivo da lo mismo que alimentar el traductor linea por linea."""
        _, vivo = correr(vuelo_demeter(1.5))
        salida = os.path.join(self.dir.name, 'otra.jsonl')
        web1.main([self.sesion, '--salida', salida])
        with open(salida, encoding='utf-8') as f:
            archivo = [json.loads(l) for l in f]
        self.assertEqual(archivo[:len(vivo)], json.loads(json.dumps(vivo)))

    def test_el_modo_va_a_meta(self):
        salida = os.path.join(self.dir.name, 'modo.jsonl')
        web1.main([self.sesion, '--salida', salida, '--modo', 'simulacion'])
        with open(salida, encoding='utf-8') as f:
            metas = [json.loads(l)['datos'] for l in f if '"tipo":"meta"' in l]
        self.assertEqual([m['modo'] for m in metas], ['simulacion'])


if __name__ == '__main__':
    unittest.main()
