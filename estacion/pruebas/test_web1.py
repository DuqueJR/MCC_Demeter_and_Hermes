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
        self.assertEqual(slot['q'], {'w': 0.70711, 'x': 0.0, 'y': 0.0, 'z': 0.70711})   # identidad del firmware (FRD->NED) ya convertida a FLU->ENU (T-675)
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
        self.estado(lat=lat, lon=lon, alt_msl_m=510.0)                 # la rampa en TIERRA: la referencia de altura (D-064)
        e = self.estado(lat=lat, lon=lon, alt_msl_m=810.0, vn=3.0, ve=4.0, vu=-10.0, state=web1.S_FLY, moment=web1.M_PARACAIDAS,
                        t_local=T0 + 4.05, utc_ms=g.UTC0_MS + 4000)
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


QUAT_EKF = (23170, 23170, 0, 0)      # un cuaternion que no es la identidad: el TELEM lo manda solo si el EKF tiene solucion


def serie_paquetes(n, alt, rid=1, i0=0, dt=0.48, **kw):
    """`n` paquetes @T cada `dt` s (ranuras de 40 ms, a partir del indice `i0`); `alt(i)` es la altura MSL del paquete `i`."""
    out = []
    for i in range(i0, i0 + n):
        out.append(paquete(rid=rid, t_local=T0 + 0.05 + i * dt, utc_ms=g.UTC0_MS + int(round(i * dt * 1000 / 40)) * 40,
                           alt_msl_m=alt(i), **kw))
    return out


def alt_agl_ultimo(msgs, mision='demeter'):
    return de_tipo(msgs, 'estado', mision)[-1]['pos']['alt_agl_m']


class AlturaDeMision(Contrato):
    """T-657 / D-064: la altura sobre la rampa sale de una referencia que sigue al clima en TIERRA y se congela al armar
    (la regla de `p0` de mission.cpp), no de una constante del sitio."""

    def test_quieto_en_tierra_queda_en_cero(self):
        # 60 s de espera (125 paquetes de 0,48 s) a 1200 m de altitud, con 0,5 m de ruido
        tr, msgs = correr(serie_paquetes(130, lambda i: 1200.0 + 0.5 * math.sin(i)))
        est = de_tipo(msgs, 'estado')
        self.assertLessEqual(max(abs(e['pos']['alt_agl_m']) for e in est), 1.0)
        self.assertLessEqual(abs(est[-1]['pos']['alt_agl_m']), 2.0)
        self.assertAlmostEqual(est[-1]['pos']['alt_msl_m'], 1200.0, delta=0.6)     # el MSL es el del TELEM, sin tocar
        self.assertAlmostEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], 1200.0, delta=0.6)
        self.assertValidos(msgs)

    def test_sin_el_sitio(self):
        """La altitud del sitio no entra: otra constante da el mismo resultado."""
        lineas = serie_paquetes(20, lambda i: 1200.0)
        _, a = correr(lineas)
        _, b = correr(lineas, Traductor(sitio=(0.0, 0.0, 9999.0)))
        self.assertEqual([e['pos'] for e in de_tipo(a, 'estado')], [e['pos'] for e in de_tipo(b, 'estado')])
        self.assertEqual(alt_agl_ultimo(a), 0.0)

    def test_sigue_al_clima_con_tau_60(self):
        """La altitud sube 5 m de golpe (el clima cambio): la referencia la alcanza con tau = 60 s, como `p0` del firmware."""
        n = 300
        tr, msgs = correr(serie_paquetes(n, lambda i: 800.0 if i < 20 else 805.0))
        est = de_tipo(msgs, 'estado')
        for i in (21, 100, 200, n - 1):
            t = (i - 20) * 0.48                               # tiempo desde el salto; el paquete 20 ya trae los 805
            esperado = 5.0 * math.exp(-t / web1.REF_TAU_S) if t > 0 else 5.0
            self.assertAlmostEqual(est[i]['pos']['alt_agl_m'], esperado, delta=0.15, msg=f'paquete {i}')
        self.assertEqual(web1.REF_TAU_S, 60.0)

    def test_sigue_en_armed_y_se_congela_en_vuelo(self):
        """TIERRA tau = 60 s; ARMED tau = 5 s (absorbe el salto del EKF); FLY y RECOVERY congelada con el ultimo valor de ARMED."""
        tr, msgs = correr(serie_paquetes(100, lambda i: 600.0))
        # ARMED: la altitud sube 3 m (el EKF rehace el reposo al armar) y se queda ahi 5 minutos
        tr, m2 = correr(serie_paquetes(600, lambda i: 603.0, i0=100, state=web1.S_ARMED), tr)
        armado = de_tipo(m2, 'estado')
        self.assertAlmostEqual(armado[0]['pos']['alt_agl_m'], 3.0, delta=0.3)     # no reinicializa de golpe
        for k in (10, 33, 599):
            esperado = 3.0 * math.exp(-(k + 1) * 0.48 / web1.REF_TAU_ARMADO_S)
            self.assertAlmostEqual(armado[k]['pos']['alt_agl_m'], esperado, delta=0.15, msg=f'paquete ARMED {k}')
        self.assertLessEqual(abs(armado[33]['pos']['alt_agl_m']), 0.5)            # tras ~15 s en ARMED
        ref = tr.snapshot('demeter')['salud']['alt_origen_msl_m']
        self.assertAlmostEqual(ref, 603.0, delta=0.05)
        # FLY: 100 m mas arriba; el primer paquete de FLY no mueve la referencia
        tr, m3 = correr(serie_paquetes(5, lambda i: 703.0, i0=700, state=web1.S_FLY, moment=web1.M_BOOST), tr)
        self.assertAlmostEqual(alt_agl_ultimo(m3), 703.0 - ref, delta=0.06)
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], ref)
        # RECOVERY: sigue congelada
        tr, m4 = correr(serie_paquetes(5, lambda i: 590.0, i0=710, state=web1.S_RECOVERY, moment=web1.M_ATERRIZAJE), tr)
        self.assertAlmostEqual(alt_agl_ultimo(m4), 590.0 - ref, delta=0.06)
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], ref)

    def test_salto_de_4_m_al_armar_se_absorbe_en_15_s(self):
        tr, _ = correr(serie_paquetes(150, lambda i: 600.0))                         # 72 s en TIERRA
        tr, m = correr(serie_paquetes(35, lambda i: 604.0, i0=150, state=web1.S_ARMED), tr)   # +4 m al armar, 16,8 s
        est = de_tipo(m, 'estado')
        self.assertGreater(est[0]['pos']['alt_agl_m'], 3.5)                           # al principio se ve el salto
        self.assertLessEqual(abs(est[-1]['pos']['alt_agl_m']), 0.5)                   # y a los ~15 s ya no

    def test_el_despegue_no_mueve_la_referencia(self):
        tr, _ = correr(serie_paquetes(150, lambda i: 600.0))
        tr, _ = correr(serie_paquetes(60, lambda i: 600.0, i0=150, state=web1.S_ARMED), tr)
        ref = tr.snapshot('demeter')['salud']['alt_origen_msl_m']
        # el primer paquete FLY ya viene subiendo (LAUNCH) y luego BOOST: la referencia es la de ARMED, siempre
        alturas = [601.5, 604.0, 612.0, 640.0, 700.0, 800.0]
        tr, m = correr(serie_paquetes(len(alturas), lambda i: alturas[i - 210], i0=210, state=web1.S_FLY, moment=web1.M_LAUNCH), tr)
        est = de_tipo(m, 'estado')
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], ref)
        for e, h in zip(est, alturas):
            self.assertAlmostEqual(e['pos']['alt_agl_m'], h - ref, delta=0.06)
        tr, m = correr(serie_paquetes(3, lambda i: 900.0, i0=216, state=web1.S_FLY, moment=web1.M_BOOST), tr)
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], ref)

    def test_si_se_desarma_vuelve_a_tau_60(self):
        tr, _ = correr(serie_paquetes(50, lambda i: 600.0))
        tr, _ = correr(serie_paquetes(50, lambda i: 603.0, i0=50, state=web1.S_ARMED), tr)
        ref0 = tr.snapshot('demeter')['salud']['alt_origen_msl_m']
        self.assertAlmostEqual(ref0, 603.0, delta=0.1)                                # ARMED siguio la altitud con tau = 5 s
        # desarme: TIERRA otra vez, con tau = 60 s desde ahi (la altitud ahora es 610)
        tr, _ = correr(serie_paquetes(200, lambda i: 610.0, i0=100), tr)
        ref = tr.snapshot('demeter')['salud']['alt_origen_msl_m']
        self.assertAlmostEqual(ref, 610.0 - (610.0 - ref0) * math.exp(-200 * 0.48 / web1.REF_TAU_S), delta=0.05)
        self.assertGreater(610.0 - ref, 0.5)                                          # con tau = 5 s ya estaria en 610

    def test_tras_estar_congelada_no_cuenta_ese_tiempo(self):
        tr, _ = correr(serie_paquetes(50, lambda i: 600.0))
        tr, _ = correr(serie_paquetes(5, lambda i: 600.0, i0=50, state=web1.S_FLY, moment=web1.M_COAST), tr)
        ref = tr.snapshot('demeter')['salud']['alt_origen_msl_m']
        tr, _ = correr(serie_paquetes(1, lambda i: 650.0, i0=5000), tr)               # una hora despues, de nuevo en TIERRA
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], ref)    # no salta a la muestra

    def test_las_referencias_son_por_cohete(self):
        lin = serie_paquetes(40, lambda i: 700.0, rid=1) + serie_paquetes(40, lambda i: 1500.0, rid=2)
        tr, msgs = correr(sorted(lin, key=lambda x: x[0]))
        self.assertEqual(alt_agl_ultimo(msgs, 'demeter'), 0.0)
        self.assertEqual(alt_agl_ultimo(msgs, 'hermes'), 0.0)
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], 700.0)
        self.assertEqual(tr.snapshot('hermes')['salud']['alt_origen_msl_m'], 1500.0)

    def test_solo_muestras_con_ekf_y_sin_ekf_las_del_gnss_3d(self):
        # sin EKF (cuaternion identidad) y con fix 3D: el GNSS manda
        tr, msgs = correr(serie_paquetes(10, lambda i: 560.0))
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], 560.0)
        # aparece el EKF (otra altura): la referencia se rehace con el EKF, no se mezcla
        tr, _ = correr(serie_paquetes(10, lambda i: 550.0, i0=10, quat=QUAT_EKF), tr)
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], 550.0)
        # el EKF se cae un momento: las muestras solo-GNSS ya no mueven la referencia
        tr, m = correr(serie_paquetes(10, lambda i: 560.0, i0=20), tr)
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], 550.0)
        # sin fix 3D y sin EKF no hay muestra valida
        tr2, m2 = correr(serie_paquetes(10, lambda i: 999.0, fix=2))
        self.assertIsNone(tr2.snapshot('demeter')['salud']['alt_origen_msl_m'])
        self.assertEqual(alt_agl_ultimo(m2), 0.0)             # sin referencia: en la rampa, 0 m (nunca la altitud MSL)

    def test_ekf_sin_fix_tambien_vale(self):
        tr, msgs = correr(serie_paquetes(10, lambda i: 777.0, fix=0, quat=QUAT_EKF))
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], 777.0)

    def test_apogeo_medido_desde_la_rampa_en_un_vuelo_reproducido(self):
        """El mismo vuelo de la simulacion en una rampa a 1500 m: el apogeo y la serie siguen en ~669 m sobre la rampa."""
        tr, msgs = correr(tuple(g.vuelo(g.perfil_demeter(), alt_base_m=1500.0)))
        apogeo = [e for e in de_tipo(msgs, 'evento') if e['tipo'] == 'apogeo'][0]
        self.assertAlmostEqual(apogeo['valor'], 669.3, delta=3.0)
        snap = tr.snapshot('demeter')
        self.assertAlmostEqual(snap['salud']['apogeo_m'], 669.3, delta=3.0)
        self.assertAlmostEqual(max(snap['serie']['alt_agl_m']), 669.3, delta=3.0)
        self.assertEqual(snap['salud']['alt_origen_msl_m'], 1500.0)
        self.assertAlmostEqual(max(e['pos']['alt_msl_m'] for e in de_tipo(msgs, 'estado')), 1500.0 + 669.3, delta=3.0)
        aterrizado = de_tipo(msgs, 'estado')[-1]
        self.assertLess(abs(aterrizado['pos']['alt_agl_m']), 1.0)                  # vuelve a la rampa
        self.assertValidos(msgs)

    def test_apogeo_con_un_salto_de_4_m_al_armar(self):
        """El EKF salta +4 m al armar y se queda ahi: la referencia lo absorbe en ARMED y el apogeo sigue en 669,3 +- 3 m
        (si se congelara en el primer paquete ARMED, el error fijo seria de 4 m)."""
        tr, msgs = correr(tuple(g.vuelo(g.perfil_demeter(), alt_base_m=1500.0, salto_armado_m=4.0)))
        apogeo = [e for e in de_tipo(msgs, 'evento') if e['tipo'] == 'apogeo'][0]
        self.assertAlmostEqual(apogeo['valor'], 669.3, delta=3.0)
        snap = tr.snapshot('demeter')
        self.assertAlmostEqual(snap['salud']['apogeo_m'], 669.3, delta=3.0)
        self.assertAlmostEqual(snap['salud']['alt_origen_msl_m'], 1504.0, delta=0.5)      # la referencia absorbio el salto
        est = de_tipo(msgs, 'estado')
        antes = [e for e in est if e['fase'] == 'ARMED'][0]
        self.assertGreater(antes['pos']['alt_agl_m'], 2.0)                                # el salto se ve al armar...
        despegue = [e for e in est if e['fase'] == 'BOOST'][0]
        self.assertLess(abs(est[est.index(despegue) - 1]['pos']['alt_agl_m']), 0.5)       # ...y ya no al despegar
        self.assertLess(abs(est[-1]['pos']['alt_agl_m']), 1.0)
        self.assertValidos(msgs)

    def test_tiempo_restante_usa_la_altura_sobre_la_rampa(self):
        """En DESCENT, a 1000 m de altitud con la rampa a 700: 300 m sobre la rampa a 10 m/s = 30 s."""
        lin = serie_paquetes(40, lambda i: 700.0)
        lin += serie_paquetes(5, lambda i: 700.0, i0=40, state=web1.S_ARMED)
        lin += [paquete(t_local=T0 + 30.0 + k * 0.1, utc_ms=g.UTC0_MS + 40 * (1000 + 3 * k), alt_msl_m=1000.0, vu=-10.0,
                        state=web1.S_FLY, moment=web1.M_PARACAIDAS, flags=web1.TF_FLYING) for k in range(3)]
        tr, msgs = correr(lin)
        e = de_tipo(msgs, 'estado')[-1]
        self.assertEqual(e['pos']['alt_agl_m'], 300.0)
        self.assertEqual(e['calc']['elipse']['rumbo_deg'], 0.0)
        self.assertEqual(tr.snapshot('demeter')['salud']['alt_origen_msl_m'], 700.0)


class ReferenciaPersistida(Contrato):
    """La referencia se guarda en un archivo (ignorado por el repo) para sobrevivir a un reinicio del dashboard con el cohete armado."""

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.ruta = os.path.join(self.dir.name, 'web1_referencia.json')

    def tearDown(self):
        self.dir.cleanup()

    def test_sin_ruta_no_se_escribe_nada(self):
        correr(serie_paquetes(40, lambda i: 600.0) + serie_paquetes(5, lambda i: 600.0, i0=40, state=web1.S_ARMED))
        self.assertFalse(os.path.exists(self.ruta))

    def test_se_guarda_en_tierra_y_al_congelarse(self):
        tr = Traductor(ruta_referencia=self.ruta)
        correr(serie_paquetes(60, lambda i: 600.0), tr)
        with open(self.ruta, encoding='utf-8') as f:
            d = json.load(f)
        self.assertEqual(list(d), ['1:0'])                     # por cohete (1 = Demeter) y mision (0 = sin MISSION_ID)
        self.assertEqual(d['1:0']['alt_msl_m'], 600.0)
        self.assertFalse(d['1:0']['congelada'])
        # ARMED: sigue y tambien guarda (cada 10 s); 40 paquetes son 19 s
        correr(serie_paquetes(40, lambda i: 603.0, i0=60, state=web1.S_ARMED), tr)
        with open(self.ruta, encoding='utf-8') as f:
            d = json.load(f)
        self.assertFalse(d['1:0']['congelada'])
        self.assertGreater(d['1:0']['alt_msl_m'], 602.0)
        # FLY: se congela y guarda siempre
        correr(serie_paquetes(1, lambda i: 640.0, i0=100, state=web1.S_FLY, moment=web1.M_BOOST), tr)
        with open(self.ruta, encoding='utf-8') as f:
            d2 = json.load(f)
        self.assertTrue(d2['1:0']['congelada'])
        self.assertAlmostEqual(d2['1:0']['alt_msl_m'], tr.snapshot('demeter')['salud']['alt_origen_msl_m'], delta=0.06)   # el snapshot redondea a 0,1 m

    def test_un_reinicio_con_el_cohete_armado_recupera_la_referencia(self):
        tr = Traductor(ruta_referencia=self.ruta)
        correr(serie_paquetes(100, lambda i: 600.0), tr)
        correr(serie_paquetes(60, lambda i: 603.0, i0=100, state=web1.S_ARMED), tr)
        correr(serie_paquetes(2, lambda i: 640.0, i0=160, state=web1.S_FLY, moment=web1.M_BOOST), tr)   # se congela y guarda
        ref = tr.snapshot('demeter')['salud']['alt_origen_msl_m']
        self.assertAlmostEqual(ref, 603.0, delta=0.05)
        # el dashboard se reinicia con el cohete en vuelo: otro Traductor recupera la referencia congelada
        nuevo = Traductor(ruta_referencia=self.ruta)
        _, m = correr(serie_paquetes(3, lambda i: 750.0, i0=162, state=web1.S_FLY, moment=web1.M_COAST), nuevo)
        self.assertAlmostEqual(alt_agl_ultimo(m), 750.0 - ref, delta=0.01)
        self.assertEqual(nuevo.snapshot('demeter')['salud']['alt_origen_msl_m'], ref)
        self.assertValidos(m)

    def test_un_reinicio_con_el_cohete_en_armed_sigue_desde_la_guardada(self):
        tr = Traductor(ruta_referencia=self.ruta)
        correr(serie_paquetes(100, lambda i: 600.0), tr)
        correr(serie_paquetes(30, lambda i: 600.0, i0=100, state=web1.S_ARMED), tr)
        nuevo = Traductor(ruta_referencia=self.ruta)
        # la altitud salto 4 m mientras el dashboard estaba apagado: parte de la guardada (600) y sigue con tau = 5 s
        _, m = correr(serie_paquetes(40, lambda i: 604.0, i0=130, state=web1.S_ARMED), nuevo)
        est = de_tipo(m, 'estado')
        self.assertGreater(est[0]['pos']['alt_agl_m'], 3.0)
        self.assertLessEqual(abs(est[-1]['pos']['alt_agl_m']), 0.5)

    def test_otra_mision_u_otro_cohete_no_la_usan(self):
        tr = Traductor(ruta_referencia=self.ruta)
        correr(serie_paquetes(100, lambda i: 600.0), tr)
        correr(serie_paquetes(3, lambda i: 600.0, i0=100, state=web1.S_ARMED), tr)
        nuevo = Traductor(ruta_referencia=self.ruta)
        _, m = correr(serie_paquetes(3, lambda i: 1500.0, rid=2, i0=103, state=web1.S_ARMED), nuevo)
        self.assertEqual(nuevo.snapshot('hermes')['salud']['alt_origen_msl_m'], 1500.0)   # el respaldo, no los 600 de Demeter

    def test_una_referencia_vieja_no_se_usa(self):
        with open(self.ruta, 'w', encoding='utf-8') as f:
            json.dump({'1:0': {'alt_msl_m': 600.0, 't': T0 - web1.REF_VIGENCIA_S - 1.0, 'fuente': 'ekf', 'congelada': True}}, f)
        nuevo = Traductor(ruta_referencia=self.ruta)
        correr(serie_paquetes(3, lambda i: 603.0, state=web1.S_ARMED), nuevo)
        self.assertEqual(nuevo.snapshot('demeter')['salud']['alt_origen_msl_m'], 603.0)

    def test_respaldo_sin_archivo_la_altitud_de_la_estacion(self):
        """(P) Sin referencia guardada: la altitud del GNSS de la estacion (`[time] ... pos(n)=`); sin ella, la primera muestra."""
        nuevo = Traductor(ruta_referencia=self.ruta)
        nuevo.procesar(g.linea_time(6.579, -75.815, 505.0), T0)
        _, m = correr(serie_paquetes(3, lambda i: 603.0, i0=1, state=web1.S_FLY, moment=web1.M_BOOST), nuevo)
        self.assertEqual(alt_agl_ultimo(m), 98.0)
        self.assertEqual(nuevo.snapshot('demeter')['salud']['alt_origen_msl_m'], 505.0)
        self.assertFalse(os.path.exists(self.ruta))            # un respaldo no se guarda como si fuera real
        sin = Traductor(ruta_referencia=self.ruta)
        _, m = correr(serie_paquetes(3, lambda i: 603.0, i0=1, state=web1.S_FLY, moment=web1.M_BOOST), sin)
        self.assertEqual(alt_agl_ultimo(m), 0.0)
        # en ARMED (el cohete sigue en la rampa) el respaldo lo reemplaza la primera muestra valida
        armado = Traductor(ruta_referencia=self.ruta)
        armado.procesar(g.linea_time(6.579, -75.815, 505.0), T0)
        correr(serie_paquetes(3, lambda i: 603.0, i0=1, state=web1.S_ARMED), armado)
        self.assertEqual(armado.snapshot('demeter')['salud']['alt_origen_msl_m'], 603.0)

    def test_un_archivo_roto_o_ilegible_no_tumba_nada(self):
        with open(self.ruta, 'w', encoding='utf-8') as f:
            f.write('{no es json')
        tr = Traductor(ruta_referencia=self.ruta)
        _, m = correr(serie_paquetes(30, lambda i: 600.0), tr)
        self.assertEqual(alt_agl_ultimo(m), 0.0)
        _, m = correr(serie_paquetes(3, lambda i: 600.0, i0=30, state=web1.S_ARMED), Traductor(ruta_referencia=self.dir.name))   # un directorio
        self.assertEqual(alt_agl_ultimo(m), 0.0)

    def test_el_dashboard_en_vivo_la_activa(self):
        tr = Traductor()
        self.assertIsNone(tr.ruta_referencia)
        tr.persistir_en(self.ruta)
        correr(serie_paquetes(5, lambda i: 600.0), tr)
        self.assertTrue(os.path.exists(self.ruta))


class Actuadores(Contrato):
    """T-657 / D-065: `act.*` y `flags.reanudado` salen de TELEM.actuators y TELEM.flags."""

    @staticmethod
    def estado(rid=1, **kw):
        _, msgs = correr([paquete(rid=rid, **kw)])
        return msgs, de_tipo(msgs, 'estado')[0]

    def test_buzzer_y_pulso(self):
        _, e = self.estado(actuators=web1.ACT_BUZZER)
        self.assertEqual((e['act']['buzzer'], e['act']['pi_pulso']), (True, False))
        _, e = self.estado(actuators=web1.ACT_PI_PULSO)
        self.assertEqual((e['act']['buzzer'], e['act']['pi_pulso']), (False, True))
        _, e = self.estado(actuators=web1.ACT_BUZZER | ACT_PI_ENVIADO | web1.ACT_PI_PULSO)       # el bit 2 (ya se envio) no es el pulso
        self.assertEqual((e['act']['buzzer'], e['act']['pi_pulso']), (True, True))
        _, e = self.estado(actuators=ACT_PI_ENVIADO)
        self.assertEqual((e['act']['buzzer'], e['act']['pi_pulso']), (False, False))

    def test_cam_ok_segun_el_estado_de_la_pi(self):
        buenos = {'READY', 'ARMED', 'STARTING', 'ASCENT', 'RECORDING'}
        for codigo, nombre in web1.PI_ESTADOS.items():
            with self.subTest(estado=nombre):
                _, e = self.estado(actuators=codigo << 8)
                self.assertEqual(e['act']['cam_ok'], nombre in buenos)
        _, e = self.estado(actuators=0xFF << 8)                  # sin latido
        self.assertFalse(e['act']['cam_ok'])
        _, e = self.estado(actuators=(0x30 << 8) | (4 << 3))      # grabando, con un motivo de error anterior: sigue grabando
        self.assertTrue(e['act']['cam_ok'])

    def test_hermes_no_tiene_pi(self):
        for act in (0xFF << 8, (0x30 << 8) | web1.ACT_PI_PULSO, (0x03 << 8) | web1.ACT_PI_PULSO | web1.ACT_BUZZER):
            with self.subTest(actuators=hex(act)):
                msgs, e = self.estado(rid=2, actuators=act)
                self.assertEqual((e['act']['cam_ok'], e['act']['pi_pulso']), (False, False))
                self.assertEqual(e['act']['buzzer'], bool(act & web1.ACT_BUZZER))
                self.assertValidos(msgs)

    def test_los_otros_actuadores_siguen_en_falso(self):
        _, e = self.estado(actuators=0xFFFF)
        self.assertFalse(e['act']['wifi_ap'])
        self.assertFalse(e['act']['backfill'])

    def test_reanudado(self):
        _, e = self.estado(flags=web1.TF_REANUDADO)
        self.assertTrue(e['flags']['reanudado'])
        _, e = self.estado(flags=web1.TF_REANUDADO | web1.TF_FLYING | web1.TF_BOOST_SIN_ARMAR)
        self.assertTrue(e['flags']['reanudado'])
        self.assertTrue(e['flags']['falla_activa'])
        for f in (0, web1.TF_FLYING, web1.TF_BOOST_SIN_ARMAR, 4, 8, 32):                  # los otros bits de TelemFlags
            with self.subTest(flags=f):
                _, e = self.estado(flags=f)
                self.assertFalse(e['flags']['reanudado'])
        self.assertEqual(web1.TF_REANUDADO, 16)

    def test_temp_esp_c_sigue_nula(self):
        """TELEM.temp_c[0] es la del barometro, no la de la placa: no se pasa a `temp_esp_c`."""
        tr, msgs = correr([paquete()])
        self.assertIsNone(tr.snapshot('demeter')['salud']['temp_esp_c'])


ACT_PI_ENVIADO = 4


class SaludPi(Contrato):
    """T-657 / D-065: `salud.pi` es opcional; null en Hermes, y en Demeter {estado, motivo, bat_pct}."""

    @staticmethod
    def salud(rid=1, **kw):
        tr, msgs = correr([paquete(rid=rid, **kw)])
        return tr.snapshot('demeter' if rid == 1 else 'hermes')['salud'], msgs

    def test_hermes_es_null(self):
        s, msgs = self.salud(rid=2, actuators=0xFF << 8)
        self.assertIn('pi', s)
        self.assertIsNone(s['pi'])
        self.assertValidos(msgs)

    def test_demeter_sin_latido_es_desconocido(self):
        s, msgs = self.salud(actuators=0xFF << 8)
        self.assertEqual(s['pi'], {'estado': 'DESCONOCIDO', 'motivo': None, 'bat_pct': None})
        self.assertValidos(msgs)

    def test_demeter_estado_y_motivo(self):
        s, msgs = self.salud(actuators=(0x30 << 8) | (1 << 3))
        self.assertEqual(s['pi'], {'estado': 'RECORDING', 'motivo': 'SD_ESPACIO', 'bat_pct': None})
        s, _ = self.salud(actuators=(0xE1 << 8) | (1 << 3))
        self.assertEqual(s['pi'], {'estado': 'SD_FULL', 'motivo': 'SD_ESPACIO', 'bat_pct': None})
        s, _ = self.salud(actuators=(0x02 << 8) | (31 << 3))
        self.assertEqual(s['pi'], {'estado': 'READY', 'motivo': 'OTRO', 'bat_pct': None})
        s, _ = self.salud(actuators=(0x00 << 8))              # BOOT es un estado real (0x00), no "sin dato"
        self.assertEqual(s['pi'], {'estado': 'BOOT', 'motivo': None, 'bat_pct': None})
        s, _ = self.salud(actuators=(0x77 << 8) | (9 << 3))   # byte y codigo que el firmware no define
        self.assertEqual(s['pi'], {'estado': 'DESCONOCIDO', 'motivo': 'OTRO', 'bat_pct': None})

    def test_el_mensaje_salud_emitido_la_lleva_y_valida(self):
        _, msgs = correr([paquete(actuators=(0x08 << 8))])
        sal = de_tipo(msgs, 'salud', 'demeter')
        self.assertTrue(sal)
        self.assertEqual(sal[0]['pi'], {'estado': 'ASCENT', 'motivo': None, 'bat_pct': None})
        self.assertValidos(msgs)

    def test_el_esquema_acepta_con_y_sin_pi(self):
        _, msgs = correr([paquete(actuators=(0x03 << 8))])
        m = [x for x in msgs if x['tipo'] == 'salud'][0]
        self.assertEqual(contrato.errores_mensaje(m), [])
        sin = json.loads(json.dumps(m))
        del sin['datos']['pi']
        self.assertEqual(contrato.errores_mensaje(sin), [])
        nulo = json.loads(json.dumps(m))
        nulo['datos']['pi'] = None
        self.assertEqual(contrato.errores_mensaje(nulo), [])

    def test_el_esquema_rechaza_un_pi_mal_formado(self):
        _, msgs = correr([paquete(actuators=(0x03 << 8))])
        m = [x for x in msgs if x['tipo'] == 'salud'][0]
        for malo in ({'estado': 'ARMED'}, {'estado': 'ARMED', 'motivo': None, 'bat_pct': None, 'extra': 1},
                     {'estado': 3, 'motivo': None, 'bat_pct': None}, {'estado': 'ARMED', 'motivo': None, 'bat_pct': 101}):
            with self.subTest(pi=malo):
                x = json.loads(json.dumps(m))
                x['datos']['pi'] = malo
                self.assertNotEqual(contrato.errores_mensaje(x), [])

    def test_los_nombres_son_los_de_visionpack(self):
        """`PI_ESTADOS` y `PI_MOTIVOS` repiten `StatusCode` y `ErrorCode` de visionpack/demeter_protocol.py."""
        sys.path.insert(0, os.path.join(g.RAIZ, 'visionpack'))
        try:
            import demeter_protocol as dp
        finally:
            sys.path.pop(0)
        self.assertEqual(web1.PI_ESTADOS, {int(s): s.name for s in dp.StatusCode})
        self.assertEqual(web1.PI_MOTIVOS, {int(e): e.name for e in dp.ErrorCode if e != dp.ErrorCode.NINGUNO})
        self.assertEqual(web1.PI_ESTADOS_CAMARA_OK,
                         {int(s) for s in (dp.StatusCode.READY, dp.StatusCode.ARMED, dp.StatusCode.STARTING,
                                           dp.StatusCode.ASCENT, dp.StatusCode.RECORDING)})
        import dashboard
        self.assertEqual({k: v for k, v in dashboard.PI_STATUS.items() if k != 0xFF}, web1.PI_ESTADOS)
        self.assertEqual({k: v for k, v in dashboard.PI_MOTIVO.items() if k}, web1.PI_MOTIVOS)
        self.assertEqual((dashboard.ACT_BUZZER, dashboard.ACT_PI_EN_CURSO), (web1.ACT_BUZZER, web1.ACT_PI_PULSO))



# --- T-675: el marco del cuaternion (FRD -> NED del firmware  =>  FLU -> ENU de web-1) --------------------------------

def _qc(w, x, y, z):
    """`qC` de `estacion/dashboard_ekf.js` (Pablo): matriz cuerpo FRD -> NED del cuaternion."""
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
            [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
            [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]]


def _nose_pablo(c):
    """`nose` de dashboard_ekf.js: (inclinacion de la nariz desde arriba, rumbo de la nariz), en grados."""
    return (math.degrees(math.acos(max(-1.0, min(1.0, -c[2][0])))), math.degrees(math.atan2(c[1][0], c[0][0])))


def _euler_pablo(c):
    """`euler` de dashboard_ekf.js: (guinada, cabeceo, alabeo) en grados."""
    return (math.degrees(math.atan2(c[1][0], c[0][0])), math.degrees(math.asin(max(-1.0, min(1.0, -c[2][0])))),
            math.degrees(math.atan2(c[2][1], c[2][2])))


def _angulos_web(q):
    """`angulosDeCuaternion` de gui/web/src/actitud/angulos.ts (cuerpo FLU -> ENU): (cabeceo, alabeo, rumbo) en grados."""
    w, x, y, z = q
    n_e, n_n, n_u = 1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)
    y_e, y_n, y_u = 2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)
    horiz = math.hypot(n_e, n_n)
    if horiz < 1e-6:                  # vertical exacta (ACTITUD_HORIZ_MIN): sin rumbo de la nariz; alabeo 0
        return (math.degrees(math.asin(max(-1.0, min(1.0, n_u)))), 0.0, math.degrees(math.atan2(y_n, -y_e)) % 360.0)
    l0 =(-n_n / horiz, n_e / horiz)
    u0 = (-n_u * n_e / horiz, -n_u * n_n / horiz, horiz)
    return (math.degrees(math.asin(max(-1.0, min(1.0, n_u)))),
            math.degrees(math.atan2(y_e * u0[0] + y_n * u0[1] + y_u * u0[2], y_e * l0[0] + y_n * l0[1])),
            math.degrees(math.atan2(n_e, n_n)) % 360.0)


def _q_zyx(yaw, pitch, roll):
    """Cuaternion FRD -> NED con guinada, cabeceo (+ = nariz arriba) y alabeo (+ = ala derecha abajo), en grados."""
    h = [math.radians(a) / 2 for a in (yaw, pitch, roll)]
    cy, cp, cr = (math.cos(a) for a in h)
    sy, sp, sr = (math.sin(a) for a in h)
    return (cr * cp * cy + sr * sp * sy, sr * cp * cy - cr * sp * sy, cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * sp * cy)


def _dif_ang(a, b):
    """Diferencia angular a - b llevada a [-180, 180)."""
    return (a - b + 180.0) % 360.0 - 180.0


class MarcoCuaternion(unittest.TestCase):
    """El firmware manda el cuaternion cuerpo FRD -> NED; web-1 (`estado.q`) lo pide cuerpo FLU -> ENU (T-675)."""
    M = ((0, 1, 0), (1, 0, 0), (0, 0, -1))            # NED -> ENU
    F = ((1, 0, 0), (0, -1, 0), (0, 0, -1))           # FLU -> FRD

    @staticmethod
    def _mm(a, b):
        return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]

    def _ang(self, yaw, pitch, roll):
        q = web1.quat_firmware_a_web(_q_zyx(yaw, pitch, roll))
        return _angulos_web(q), q

    def test_la_matriz_es_M_C_F(self):
        for yaw, pitch, roll in ((0, 0, 0), (30, 20, 10), (-120, 45, -70), (200, -60, 150), (75, 89, 5)):
            with self.subTest(yaw=yaw, pitch=pitch, roll=roll):
                q0 = _q_zyx(yaw, pitch, roll)
                esperada = self._mm(self._mm(self.M, _qc(*q0)), self.F)
                obtenida = _qc(*web1.quat_firmware_a_web(q0))
                for i in range(3):
                    for j in range(3):
                        self.assertAlmostEqual(obtenida[i][j], esperada[i][j], places=9)

    def test_nariz_arriba_es_cabeceo_mas_90(self):
        (cab, _, _), q = self._ang(0, 90, 0)
        self.assertAlmostEqual(cab, 90.0, places=6)
        self.assertGreaterEqual(q[0], 0)

    def test_nariz_abajo_es_cabeceo_menos_90(self):
        (cab, _, _), _ = self._ang(0, -90, 0)
        self.assertAlmostEqual(cab, -90.0, places=6)

    def test_nariz_horizontal_al_norte_y_al_este(self):
        (cab, ala, rumbo), _ = self._ang(0, 0, 0)
        self.assertAlmostEqual(cab, 0.0, places=6)
        self.assertAlmostEqual(ala, 0.0, places=6)
        self.assertAlmostEqual(_dif_ang(rumbo, 0.0), 0.0, places=6)
        (cab, _, rumbo), _ = self._ang(90, 0, 0)
        self.assertAlmostEqual(cab, 0.0, places=6)
        self.assertAlmostEqual(rumbo, 90.0, places=6)

    def test_nariz_inclinada_30_grados_hacia_el_este(self):
        # nariz en NED = (0, sen 30, -cos 30): 30 grados desde la vertical, hacia el este
        q0 = _q_zyx(90, 60, 0)
        incl, rumbo_pablo = _nose_pablo(_qc(*q0))
        self.assertAlmostEqual(incl, 30.0, places=6)
        self.assertAlmostEqual(rumbo_pablo, 90.0, places=6)
        cab, _, rumbo = _angulos_web(web1.quat_firmware_a_web(q0))
        self.assertAlmostEqual(90.0 - cab, incl, places=6)       # la inclinacion desde arriba de Pablo = 90 - cabeceo de la web
        self.assertAlmostEqual(_dif_ang(rumbo, rumbo_pablo), 0.0, places=6)

    def test_coincide_con_la_convencion_de_pablo(self):
        """Nariz (inclinacion y rumbo) y euler de `dashboard_ekf.js` frente a lo que calcula la web, en una malla."""
        for yaw in range(-180, 181, 45):
            for pitch in range(-85, 86, 17):
                for roll in range(-170, 171, 40):
                    with self.subTest(yaw=yaw, pitch=pitch, roll=roll):
                        q0 = _q_zyx(yaw, pitch, roll)
                        c = _qc(*q0)
                        incl, rumbo_nariz = _nose_pablo(c)
                        _, p_p, r_p = _euler_pablo(c)
                        cab, ala, rumbo = _angulos_web(web1.quat_firmware_a_web(q0))
                        self.assertAlmostEqual(90.0 - cab, incl, places=5)
                        self.assertAlmostEqual(cab, p_p, places=5)                       # cabeceo: el mismo
                        self.assertAlmostEqual(_dif_ang(rumbo, rumbo_nariz), 0.0, places=5)
                        self.assertAlmostEqual(_dif_ang(ala, r_p), 0.0, places=5)        # alabeo: el mismo sentido

    def test_de_punta_a_punta_por_el_traductor(self):
        """Un TELEM con la nariz arriba / abajo en FRD -> NED sale de `web1` con cabeceo +90 / -90 y ekf_ok."""
        for pitch in (90, -90):
            with self.subTest(pitch=pitch):
                quat = tuple(round(32767 * x) for x in _q_zyx(0, pitch, 0))
                _, msgs = correr([paquete(quat=quat)])
                e = de_tipo(msgs, 'estado')[0]
                self.assertTrue(e['flags']['ekf_ok'])
                cab, _, _ = _angulos_web(tuple(e['q'][k] for k in 'wxyz'))
                self.assertAlmostEqual(cab, float(pitch), delta=0.1)
                self.assertGreaterEqual(e['q']['w'], 0)

    def test_sin_ekf_publica_la_identidad_convertida(self):
        """Sin EKF (identidad o nulo) `q` es la identidad del firmware ya convertida: nariz al norte y nivelado."""
        s = math.sqrt(0.5)
        for quat in ((32767, 0, 0, 0), (0, 0, 0, 0)):
            with self.subTest(quat=quat):
                _, msgs = correr([paquete(quat=quat)])
                e = de_tipo(msgs, 'estado')[0]
                self.assertFalse(e['flags']['ekf_ok'])
                for k, v in zip('wxyz', (s, 0.0, 0.0, s)):
                    self.assertAlmostEqual(e['q'][k], v, places=4)


if __name__ == '__main__':
    unittest.main()
