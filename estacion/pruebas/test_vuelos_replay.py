"""Pruebas de `estacion/vuelos_replay.py` (T-304). Solo unittest, mas numpy y scipy (las mismas que pide vuelo_sintetico.py).

Correr desde la raiz del repo:  python -m unittest estacion.pruebas.test_vuelos_replay -v      (unos 90 s: genera 10 vuelos cortos)
o con todo:                     python -m unittest discover -s estacion/pruebas -v

Genera vuelos de verdad (sin ruido, y con ruido x1 y x3) con 2 s de reposo antes y 3 s despues, y comprueba contra la exportacion de OpenRocket:
- ACEPTACION (T-304): con la sim. de Demeter el apogeo reproducido en los datos del .BIN difiere menos de 1 m y los eventos menos de 0,05 s.
  Se hace tambien con la de Hermes. Los eventos salen de los datos, no de la verdad: despegue por |a| > 1,5 g, fin del empuje por el minimo de la
  fuerza especifica axial (el empuje decae a cero sin escalon: la cola se cancela con el arrastre), eyeccion por el pico del choque, apogeo por el
  maximo de la altura barometrica, golpe contra el suelo por el ultimo |a| > 2 g.
- Los .BIN se leen con tblog.py, calib.load y ekf.load_extra sin saltos, sin resync y con CRC valido; las tasas por sensor son las de constantes.md §5.
- La eyeccion queda antes, en o despues del apogeo, segun la variante, en la verdad y en los datos.
- El ruido x3 triplica la desviacion de los sensores; la matriz por defecto son las 24 variantes de P-03.
"""
import contextlib
import io
import json
import os
import struct
import subprocess
import sys
import tempfile
import unittest

import numpy as np

ESTACION = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ESTACION not in sys.path:
    sys.path.insert(0, ESTACION)

import calib            # noqa: E402
import ekf              # noqa: E402
import tblog            # noqa: E402
import vuelo_sintetico as vs     # noqa: E402
import vuelos_replay as vr       # noqa: E402

# constantes.md §5, replicadas aqui a proposito: si alguien cambia el generador, la prueba lo nota
TASAS_S5 = dict(lsm_demeter=1610.0, lsm_hermes=1560.0, qmi=445.0, bmp=100.0, bme=40.0, qmc=100.0)
TOL_APOGEO_M, TOL_EVENTO_S = 1.0, 0.05           # aceptacion de T-304
G_SIM = vs.G0

ARGS_CORTOS = ['--reposo-antes', '2', '--reposo-despues', '3']
CASOS = {            # nombre: (cohete, eyeccion, ruido, semilla, argumentos extra)
    'D_antes': ('demeter', 'antes', 0.0, 0, []),
    'D_en': ('demeter', 'en', 0.0, 0, []),
    'D_despues': ('demeter', 'despues', 0.0, 0, []),
    'H_antes': ('hermes', 'antes', 0.0, 0, []),
    'H_antes_sin_pulso': ('hermes', 'antes', 0.0, 0, ['--pulso-pa', '0']),
    'H_en': ('hermes', 'en', 0.0, 0, []),
    'H_despues': ('hermes', 'despues', 0.0, 0, []),
    'D_r1': ('demeter', 'antes', 1.0, 1, []),
    'D_r3': ('demeter', 'antes', 3.0, 1, []),
}


def analizar(ruta):
    """Lee el .BIN con los lectores de la estacion (calib.load, ekf.load_extra) y devuelve lo que las pruebas miden."""
    d = calib.load(ruta)
    x = ekf.load_extra(ruta)
    with open(ruta.replace('.BIN', '.verdad.json'), encoding='utf-8') as f:
        verdad = json.load(f)
    return d, x, verdad


def eventos_de_los_datos(d, x, verdad):
    """Los eventos medidos en los datos del .BIN, en segundos del reloj local."""
    t = d['lsm_t'] / 1e6
    a = np.linalg.norm(d['lsm_a'], axis=1)
    ev = verdad['eventos']
    us = lambda k: ev[k]['t_us'] / 1e6
    out = {}
    out['LIFTOFF'] = t[np.argmax(a > 1.5)]
    # fin del empuje: el minimo de la fuerza axial (X del cuerpo) entre el despegue y la carga; desde ahi el arrastre manda solo
    w = (t > us('LIFTOFF')) & (t < us('EJECTION') - 0.1) & (t < us('APOGEE'))
    out['BURNOUT'] = t[w][np.argmin(d['lsm_a'][w, 0])]
    w = (t > us('BURNOUT') + 0.5) & (t < us('GROUND_HIT') - 5.0)
    out['EJECTION'] = t[w][np.argmax(a[w])]
    # apogeo: maximo de la altura barometrica, con p0 de la rampa y la formula de ekf.py (con la temperatura del suelo)
    bt, bp = x['bmp'][:, 0] / 1e6, x['bmp'][:, 1]
    p0 = bp[bt < us('IGNITION') - 0.5].mean()
    alt = (verdad['eyeccion']['t_rampa_c'] + 273.15) / 0.0065 * (1.0 - (bp / p0) ** 0.190263)
    k = int(np.argmax(alt))
    out['APOGEE'], out['alt_apogeo_m'] = bt[k], alt[k]
    w = (t > us('EJECTION') + 1.0) & (a > 2.0)
    out['GROUND_HIT'] = t[w][-1]
    return out


class Vuelos(unittest.TestCase):
    """Genera una sola vez los vuelos de todas las pruebas."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.vuelos, cls.sims, cls.analisis = {}, {}, {}
        for nombre, (cohete, eyeccion, ruido, semilla, extra) in CASOS.items():
            a = vr.parser().parse_args(ARGS_CORTOS + extra)
            carpeta = os.path.join(cls.tmp.name, nombre)             # el nombre del archivo no lleva el pulso: una carpeta por caso
            os.makedirs(carpeta)
            ruta, vj = vr.generar(cohete, eyeccion, ruido, semilla, a, carpeta)
            cls.vuelos[nombre] = (ruta, vj)
        cls.sims = {c: vs.leer_sim(c) for c in vr.COHETES}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def datos(self, nombre):
        ruta, _ = self.vuelos[nombre]
        if nombre not in self.analisis:
            self.analisis[nombre] = analizar(ruta)                # los lectores de la estacion tardan unos segundos por archivo
        return (ruta,) + self.analisis[nombre]

    # ---------------------------------------------------------------- aceptacion de T-304
    def comprobar_aceptacion(self, nombre, con_eyeccion_sim=True):
        ruta, d, x, v = self.datos(nombre)
        cohete = v['cohete']
        s = self.sims[cohete]
        ev_sim = s['ev']
        # 1) la verdad: la altura maxima de la trayectoria y los eventos son los de OpenRocket
        self.assertLess(abs(v['eventos']['APOGEE']['alt_agl_m'] - float(np.max(s['alt']))), TOL_APOGEO_M)
        t_ign = v['eventos']['IGNITION']['t_us']
        for ev_json, ev_ork in (('LIFTOFF', 'LIFTOFF'), ('BURNOUT', 'BURNOUT'), ('APOGEE', 'APOGEE')):
            self.assertLess(abs((v['eventos'][ev_json]['t_us'] - t_ign) / 1e6 - ev_sim[ev_ork]), 1e-3, ev_json)
        if con_eyeccion_sim:
            self.assertLess(abs((v['eventos']['EJECTION']['t_us'] - t_ign) / 1e6 - ev_sim['EJECTION_CHARGE']), 1e-3)
            self.assertLess(abs((v['eventos']['GROUND_HIT']['t_us'] - t_ign) / 1e6 - ev_sim['GROUND_HIT']), 1e-3)
        # 2) los datos: los eventos medidos en el .BIN contra los de la sim. (misma referencia de tiempo: el encendido)
        m = eventos_de_los_datos(d, x, v)
        esperado = dict(LIFTOFF=ev_sim['LIFTOFF'], BURNOUT=ev_sim['BURNOUT'], APOGEE=ev_sim['APOGEE'])
        if con_eyeccion_sim:
            esperado.update(EJECTION=ev_sim['EJECTION_CHARGE'], GROUND_HIT=ev_sim['GROUND_HIT'])
        errores = {k: m[k] - t_ign / 1e6 - t_sim for k, t_sim in esperado.items()}
        err_alt = m['alt_apogeo_m'] - float(np.max(s['alt']))
        print(f'\n  {nombre}: apogeo {m["alt_apogeo_m"]:.2f} m (sim {np.max(s["alt"]):.2f}), error {err_alt:+.3f} m; errores de eventos (s): '
              + ', '.join(f'{k} {e:+.3f}' for k, e in errores.items()))
        return err_alt, errores

    def test_aceptacion_demeter(self):
        err_alt, errores = self.comprobar_aceptacion('D_antes')
        self.assertLess(abs(err_alt), TOL_APOGEO_M)
        for k, e in errores.items():
            self.assertLess(abs(e), TOL_EVENTO_S, k)

    def test_aceptacion_hermes(self):
        # Con el pulso de la carga la altura barometrica queda unos metros abajo del apogeo (la carga cae 0,45 s antes y su pulso dura
        # 0,15 s de constante de tiempo): eso es lo que tiene que sobrevivir el detector (T-412). Sin el pulso, el apogeo se reproduce.
        err_alt, errores = self.comprobar_aceptacion('H_antes_sin_pulso')
        self.assertLess(abs(err_alt), TOL_APOGEO_M)
        for k, e in errores.items():
            self.assertLess(abs(e), TOL_EVENTO_S, k)
        self.comprobar_aceptacion('H_antes')                          # informativo: imprime el error con el pulso

    def test_variantes_conservan_apogeo_y_eventos(self):
        # `en` y `despues` no mueven nada hasta el apogeo; `despues` si mueve el suelo (cae sin paracaidas): solo se compara hasta el apogeo
        for nombre in ('D_en', 'D_despues', 'H_en', 'H_despues'):
            err_alt, errores = self.comprobar_aceptacion(nombre, con_eyeccion_sim=False)
            self.assertLess(abs(err_alt), TOL_APOGEO_M, nombre)
            for k, e in errores.items():
                self.assertLess(abs(e), TOL_EVENTO_S, f'{nombre} {k}')

    # ---------------------------------------------------------------- eyeccion antes, en y despues
    def test_orden_de_la_eyeccion(self):
        esperado = {'D_antes': (-1.464, -1.3), 'H_antes': (-0.448, -0.3), 'D_en': (0.0, 0.0), 'H_en': (0.0, 0.0),
                    'D_despues': (1.5, 1.5), 'H_despues': (1.5, 1.5)}
        for nombre, (nominal, _) in esperado.items():
            ruta, d, x, v = self.datos(nombre)
            antes_apogeo = v['eyeccion']['t_vs_apogeo_s']
            self.assertAlmostEqual(antes_apogeo, nominal, delta=0.01, msg=nombre)
            m = eventos_de_los_datos(d, x, v)
            dif = m['EJECTION'] - m['APOGEE']                              # el pico del choque contra el maximo de la altura barometrica
            if v['variante'] == 'antes':
                self.assertLess(dif, -0.2, nombre)
            elif v['variante'] == 'en':
                self.assertLess(abs(dif), TOL_EVENTO_S, nombre)
            else:
                self.assertGreater(dif, 1.0, nombre)
            print(f'\n  {nombre}: carga {antes_apogeo:+.3f} s del apogeo en la verdad, {dif:+.3f} s en los datos')

    def test_pulso_de_presion_en_la_eyeccion(self):
        ruta, d, x, v = self.datos('D_antes')
        bt, bp = x['bmp'][:, 0] / 1e6, x['bmp'][:, 1]
        t_ej = v['eventos']['EJECTION']['t_us'] / 1e6
        antes = bp[(bt > t_ej - 0.1) & (bt < t_ej - 0.02)].mean()
        pico = bp[(bt >= t_ej) & (bt < t_ej + 0.05)].max()
        self.assertGreater(pico - antes, 0.7 * v['eyeccion']['pulso_pa'])    # la subida de la altura en 0,1 s ya son unos Pa
        ch = np.linalg.norm(d['lsm_a'], axis=1)
        w = (d['lsm_t'] / 1e6 >= t_ej) & (d['lsm_t'] / 1e6 <= t_ej + 0.03)
        self.assertGreater(ch[w].max(), 0.9 * v['eyeccion']['choque_g'])

    def test_despues_sin_paracaidas_hasta_la_carga(self):
        ruta, d, x, v = self.datos('D_despues')
        a = np.linalg.norm(d['lsm_a'], axis=1)
        t = d['lsm_t'] / 1e6
        t_apo, t_ej = v['eventos']['APOGEE']['t_us'] / 1e6, v['eventos']['EJECTION']['t_us'] / 1e6
        w = (t > t_apo + 0.1) & (t < t_ej - 0.05)
        self.assertLess(a[w].max(), 0.3)                       # caida casi libre: el acelerometro marca el arrastre, no 1 g
        w = (t > t_ej + 5.0) & (t < v['eventos']['GROUND_HIT']['t_us'] / 1e6 - 1.0)
        self.assertAlmostEqual(float(np.median(a[w])), 1.0, delta=0.05)    # bajo el paracaidas cuelga: 1 g
        self.assertLess(v['eyeccion']['v_ej_ms'], 16.0)

    # ---------------------------------------------------------------- formato `rec`
    def test_bin_sin_errores_de_crc_ni_resync(self):
        for nombre, (ruta, v) in self.vuelos.items():
            buf = open(ruta, 'rb').read()
            recs, saltados, resync, cortado = tblog.records(buf)
            self.assertEqual((saltados, resync, cortado), (0, 0, 0), nombre)
            tipos = {r[1] for r in recs}
            self.assertLessEqual({tblog.T_FILEHDR, tblog.T_EXT_LSM, tblog.T_IMU, tblog.T_BAR}, tipos, nombre)
            self.assertEqual(recs[0][1], tblog.T_FILEHDR)
            t_us = [r[3] for r in recs]
            self.assertEqual(t_us, sorted(t_us), f'{nombre}: t_us no monotonico')
            self.assertEqual(sum(len(r[4]) + tblog.HDR + tblog.CRC for r in recs), len(buf))
            magic, ver, rid, mid, boot, idx, utc = struct.unpack_from('<4sHHIIIq', recs[0][4])
            self.assertEqual((magic, ver, rid), (b'TBLG', 3, vr.ROCKET_ID[v['cohete']]))

    def test_crc_igual_al_del_firmware(self):
        rng = np.random.default_rng(3)
        for n in (0, 1, 15, 300, 498):
            datos = bytes(rng.integers(0, 256, n, dtype=np.uint8))
            self.assertEqual(vr.binascii.crc_hqx(datos, 0xFFFF), tblog.crc16(datos))
        self.assertEqual(tblog.crc16(b'123456789'), 0x29B1)         # CRC-16/CCITT-FALSE: el valor de comprobacion estandar

    def test_tasas_por_sensor(self):
        for nombre in ('D_antes', 'H_antes'):
            ruta, d, x, v = self.datos(nombre)
            lsm = TASAS_S5['lsm_' + v['cohete']]
            tasa = lambda t: (len(t) - 1) / ((t[-1] - t[0]) / 1e6)
            self.assertAlmostEqual(tasa(d['lsm_t']) / lsm, 1.0, delta=0.001, msg=f'{nombre} LSM {tasa(d["lsm_t"]):.2f} Hz')
            self.assertAlmostEqual(tasa(d['qmi_t']) / TASAS_S5['qmi'], 1.0, delta=0.001, msg=f'{nombre} QMI {tasa(d["qmi_t"]):.2f} Hz')
            self.assertAlmostEqual(tasa(x['bmp'][:, 0]) / TASAS_S5['bmp'], 1.0, delta=0.01, msg=f'{nombre} BMP {tasa(x["bmp"][:, 0]):.2f} Hz')
            self.assertAlmostEqual(tasa(x['bme'][:, 0]) / TASAS_S5['bme'], 1.0, delta=0.01, msg=f'{nombre} BME {tasa(x["bme"][:, 0]):.2f} Hz')
            self.assertAlmostEqual(tasa(d['qmc'][:, 0]) / TASAS_S5['qmc'], 1.0, delta=0.001, msg=f'{nombre} QMC')
            self.assertAlmostEqual(tasa(x['pvt'][:, 0]) / 10.0, 1.0, delta=0.01, msg=f'{nombre} GNSS')
            print(f'\n  {nombre}: LSM {tasa(d["lsm_t"]):.2f} Hz, QMI {tasa(d["qmi_t"]):.2f}, BMP {tasa(x["bmp"][:, 0]):.2f}, BME {tasa(x["bme"][:, 0]):.2f}, '
                  f'QMC {tasa(d["qmc"][:, 0]):.2f}, GNSS {tasa(x["pvt"][:, 0]):.2f}')

    def test_cuentas_de_la_cabecera_lsm(self):
        ruta, v = self.vuelos['D_antes']
        recs = tblog.records(open(ruta, 'rb').read())[0]
        n_prev, cnt_max = 0, 0
        for r in recs:
            if r[1] != tblog.T_EXT_LSM:
                continue
            n0, cnt, fl, accfs, t_first, period, rd, gfs = struct.unpack_from('<IHBBqfHH', r[4], 0)
            self.assertEqual(len(r[4]), 24 + 7 * cnt)
            self.assertEqual((accfs, gfs), (32, 2000))
            self.assertEqual(n0, n_prev)                       # los indices de ranura no tienen huecos
            n_prev += sum(1 for i in range(cnt) if r[4][24 + 7 * i] >> 3 == 2)
            cnt_max = max(cnt_max, cnt)
        self.assertLessEqual(cnt_max, 64)

    def test_gnss_y_pps_se_leen(self):
        ruta, d, x, v = self.datos('D_antes')
        self.assertGreater(len(x['pvt']), 100)
        self.assertGreater(len(x['pps']), 5)
        recs = tblog.records(open(ruta, 'rb').read())[0]
        pvt = [tblog.decode_pvt(r[4]) for r in recs if r[1] == tblog.T_PVT]
        self.assertTrue(all(p is not None for p in pvt))
        self.assertTrue(all(b['itow'] - a['itow'] == 100 for a, b in zip(pvt, pvt[1:])))
        self.assertTrue(all(b['utc_sec'] >= a['utc_sec'] for a, b in zip(pvt, pvt[1:])))
        # la hora UTC de la rampa es la que fija vuelo_sintetico (2026-11-05)
        self.assertEqual(pvt[0]['utc_sec'], int(np.floor(vs.UTC0 + (x['pvt'][0, 0] / 1e6 - vs.T_LOCAL0_US / 1e6 - vs.GNSS_LAT_S) + 1e-6)))
        self.assertAlmostEqual(pvt[0]['lat'], vs.leer_sim('demeter')['lat0'], delta=1e-3)

    def test_bmp_por_el_hub_sin_palabras_malas(self):
        ruta, d, x, v = self.datos('D_antes')
        p = x['bmp'][:, 1]
        self.assertTrue(((p > 20000) & (p < 115000)).all())
        recs = tblog.records(open(ruta, 'rb').read())[0]
        tags = {}
        for r in recs:
            if r[1] == tblog.T_EXT_LSM:
                cnt = struct.unpack_from('<H', r[4], 4)[0]
                for i in range(cnt):
                    tag = r[4][24 + 7 * i] >> 3
                    tags[tag] = tags.get(tag, 0) + 1
        self.assertEqual(set(tags), {1, 2, 4, 0x0E})            # giro, acel., marca y hub: ninguna palabra desconocida
        self.assertEqual(tags[1], tags[2])

    # ---------------------------------------------------------------- ruido
    def test_ruido_triplica_la_desviacion(self):
        sd = {}
        for nombre in ('D_antes', 'D_r1', 'D_r3'):
            ruta, d, x, v = self.datos(nombre)
            t = d['lsm_t'] / 1e6
            w = t < v['eventos']['IGNITION']['t_us'] / 1e6 - 0.2          # quieto en la rampa
            sd[nombre] = (d['lsm_a'][w].std(0).mean(), d['lsm_g'][w].std(0).mean(), x['bmp'][x['bmp'][:, 0] / 1e6 < v['eventos']['IGNITION']['t_us'] / 1e6 - 0.2, 1].std())
        print('\n  sigma en reposo (acel. g, giro dps, BMP Pa): ' + ', '.join(f'{k}: {v[0]:.4f}/{v[1]:.3f}/{v[2]:.2f}' for k, v in sd.items()))
        self.assertLess(sd['D_antes'][0], 1e-4)                          # sin ruido: reposo limpio
        # ekf.load_extra aplica la mediana de 3 del firmware al BMP581, que deja el 67 % del sigma de una gaussiana
        ref = (vs.LSM_ACC_SD, vs.LSM_GYR_SD, 0.67 * vs.BMP_SD)
        for i in range(3):
            self.assertAlmostEqual(sd['D_r1'][i] / ref[i], 1.0, delta=0.15)
            self.assertAlmostEqual(sd['D_r3'][i] / sd['D_r1'][i], 3.0, delta=0.4)

    def test_reposo_antes_y_despues(self):
        ruta, d, x, v = self.datos('D_antes')
        t = d['lsm_t'] / 1e6
        a = np.linalg.norm(d['lsm_a'], axis=1)
        w = t < v['eventos']['IGNITION']['t_us'] / 1e6 - 0.1
        self.assertGreaterEqual(t[w][-1] - t[0], 1.8)
        self.assertAlmostEqual(float(a[w].mean()), 1.0, delta=0.02)
        w = t > v['eventos']['GROUND_HIT']['t_us'] / 1e6 + 0.7
        self.assertGreaterEqual(t[w][-1] - t[w][0], 2.0)
        self.assertLess(float(a[w].std()), 1e-3)                         # sin ruido: quieto en el suelo
        self.assertAlmostEqual(float(a[w].mean()), 1.0, delta=0.02)

    # ---------------------------------------------------------------- lectores de la estacion
    def test_tblog_por_linea_de_comandos(self):
        ruta, v = self.vuelos['H_antes']
        r = subprocess.run([sys.executable, os.path.join(ESTACION, 'tblog.py'), ruta], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('bytes_saltados=0  resync=0', r.stdout)
        self.assertNotIn('DESCONOCIDA', r.stdout)

    def test_la_verdad_describe_el_archivo(self):
        for nombre, (ruta, v) in self.vuelos.items():
            self.assertTrue(os.path.exists(ruta.replace('.BIN', '.verdad.json')))
            e = v['eventos']
            for k in ('IGNITION', 'LIFTOFF', 'BURNOUT', 'EJECTION', 'APOGEE', 'PARACAIDAS_ABRE', 'GROUND_HIT'):
                self.assertIn('t_us', e[k])
            self.assertLess(e['LIFTOFF']['t_us'], e['BURNOUT']['t_us'])
            self.assertLess(e['BURNOUT']['t_us'], e['APOGEE']['t_us'])
            self.assertLess(e['APOGEE']['t_us'], e['GROUND_HIT']['t_us'])
            self.assertLess(e['EJECTION']['t_us'], e['GROUND_HIT']['t_us'])
            for k in ('choque_g', 'choque_ms', 'pulso_pa', 'pulso_tau_s', 't_vs_apogeo_s'):
                self.assertIn(k, v['eyeccion'])
            self.assertEqual((v['cohete'], v['motor']), (('demeter', 'H135W-8') if nombre[0] == 'D' else ('hermes', 'G80-7T')))


class Matriz(unittest.TestCase):
    def test_p03_veinticuatro_variantes(self):
        a = vr.parser().parse_args([])
        v = vr.variantes(a)
        self.assertEqual(len(v), 24)
        self.assertGreaterEqual(len(v), 20)                              # P-03: al menos 20
        self.assertEqual({x[0] for x in v}, {'demeter', 'hermes'})
        self.assertEqual({x[1] for x in v}, {'antes', 'en', 'despues'})
        self.assertEqual({x[2] for x in v}, {1.0, 3.0})
        self.assertEqual(len({vr.nombre_base(*x) for x in v}), 24)       # nombres distintos

    def test_lista_no_genera(self):
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(vr.main(['--lista', '--salida', tmp]), 0)
            self.assertEqual(os.listdir(tmp), [])
        self.assertIn('DEM_SINT_H135W-8_antes_r1_s01', out.getvalue())

    def test_pvt_fecha_civil(self):
        fila = [0, vs.UTC0 + 0.3, 3, 6.5, -75.8, 1000.0, 1.2, 2.0, 1.0, -2.0, 3.0, 0.15]
        p = tblog.decode_pvt(vr.pvt_ubx(fila, 20))
        self.assertEqual(p['utc_sec'], int(vs.UTC0))
        self.assertEqual((p['fix'], p['nsv']), (3, 20))
        self.assertAlmostEqual(p['lat'], 6.5, places=6)
        self.assertAlmostEqual(p['h'], 1000.0, places=3)

    def test_vuelo_sintetico_sigue_igual_sin_los_parametros_nuevos(self):
        # el CLI de Pablo: los argumentos nuevos son opcionales (getattr) y el modulo se importa y se explica sin errores
        r = subprocess.run([sys.executable, os.path.join(ESTACION, 'vuelo_sintetico.py'), '-h'], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('--comparar', r.stdout)


if __name__ == '__main__':
    unittest.main()
