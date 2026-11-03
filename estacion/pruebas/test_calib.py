"""Pruebas de `estacion/calib.py` (T-416b). Solo unittest, mas numpy y scipy (las mismas que pide calib.py).

Correr desde la raiz del repo:  python -m unittest discover -s estacion/pruebas -v

- Sinteticas: un log inventado (6 posiciones quietas y un giro en todas las direcciones) entra a `calib.run` por
  `calib.load`, sin tocar el disco. El chip va montado como `calib.LSM_NOMINAL` (el camino normal: se nombra por
  orientacion) o girado respecto a el (entra la geometria, el ultimo recurso). Comprueban el nombre de las posiciones
  (en desorden, con un giro de 90 grados en vez de 180), una calibracion anterior buena o con `ok: false`, y el descarte
  de un campo extra, de picos y de posiciones con algo magnetico cerca.
- Reales (opcionales): DEM 0092 y HER 0024 del 3 de noviembre. No estan en el repo (pesan 13 a 24 MB): se buscan en la
  carpeta de la variable de entorno CALIB_LOGS_DIR y, si no estan, la prueba se salta.
"""
import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import numpy as np

ESTACION = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ESTACION not in sys.path:
    sys.path.insert(0, ESTACION)
try:
    from scipy.spatial.transform import Rotation, Slerp
    import calib
except ImportError as e:      # numpy y scipy son dependencias de calib.py, no de las demas pruebas
    raise unittest.SkipTest(f'calib.py necesita numpy y scipy: {e}')

# Lo que mide el acelerometro (hacia arriba) en cada posicion, en cuerpo FRD: la guia de calib.py
POSE_BODY = calib.POSE_BODY
NOMBRES = {n: i for i, n in enumerate(calib.POSES)}
HZ_IMU, HZ_MAG = 100.0, 50.0
POSE_S, GIRO_S = 6.0, 100.0
R_NOMINAL = np.array(calib.LSM_NOMINAL['R'], float)          # cuerpo desde chip
# Un montaje girado 40 grados en cada eje respecto al nominal: ninguna posicion cuadra con el nominal. (Un montaje girado
# 90 grados si cuadra, con los nombres cambiados: el nominal no puede distinguirlo y la geometria no llega a entrar.)
R_GIRADO = R_NOMINAL @ Rotation.from_euler('xyz', [40, 40, 40], degrees=True).as_matrix()
B_TIERRA = np.array([0.26, 0.0, -0.15])        # mundo con z hacia arriba; el campo apunta hacia abajo (inclinacion ~30 grados)
DURO_MMC = np.array([-0.48, 1.63, 2.59])        # hierro duro, como el MMC de Demeter
BLANDO = np.diag([1.2, 0.9, 1.0])
DURO_QMC = np.array([-0.18, 0.65, 0.20])


def rot_pose(e, giro):
    """Rotacion mundo->cuerpo que deja el 'arriba' del mundo en la lectura `e` del acelerometro; `giro` es un giro libre sobre e."""
    e = np.asarray(e, float)
    eje = np.cross([0, 0, 1.0], e)
    if np.linalg.norm(eje) > 1e-9:
        base = Rotation.from_rotvec(eje / np.linalg.norm(eje) * np.arccos(np.clip(e[2], -1, 1)))
    else:
        base = Rotation.identity() if e[2] > 0 else Rotation.from_rotvec([np.pi, 0, 0])
    return Rotation.from_rotvec(e * giro) * base


def trayectoria(orden, rng, giro_s=GIRO_S):
    """Rotaciones mundo->cuerpo en el tiempo. `orden` son los indices de POSE_BODY en el orden en que se ponen las
    posiciones. Devuelve (t en s, rotaciones, lista de (t1, t2) de cada posicion)."""
    keys, tk, tramos, t = [], [], [], 0.0
    for k, i in enumerate(orden):
        r = rot_pose(POSE_BODY[i], 0.3 * k)
        keys += [r, r]
        tk += [t, t + POSE_S]
        tramos.append((t, t + POSE_S))
        t += POSE_S + 1.5                       # 1,5 s de transicion entre posiciones
    n = int(giro_s / 1.5)
    keys += list(Rotation.random(n, random_state=int(rng.integers(1 << 30))))
    tk += [t + 1.5 * j for j in range(n)]
    sl = Slerp(tk, Rotation.concatenate(keys))
    ts = np.arange(0, tk[-1], 1 / HZ_IMU)
    return ts, sl(ts), tramos


def log_sintetico(orden=(0, 1, 2, 3, 4, 5), seed=1, campo_extra=None, picos_qmc=0, montaje=R_NOMINAL, t0_us=5e6):
    """Un `d` como el de calib.load. `campo_extra`=(t_a, t_b, vector en G, ejes del cuerpo): un iman pegado al cohete.
    `montaje` es la matriz cuerpo desde chip: los sensores miden en el chip (v_chip = montaje^T v_cuerpo)."""
    rng = np.random.default_rng(seed)
    ts, rots, tramos = trayectoria(orden, rng)
    Q = rots.as_matrix()                                    # mundo -> cuerpo
    up = Q @ np.array([0, 0, 1.0])                          # el acelerometro quieto marca hacia arriba
    # giro en cuerpo (dps): Q(t+dt) = exp(-[w]x dt) Q(t)
    rel = (rots[1:] * rots[:-1].inv()).as_rotvec()
    w = np.vstack([-rel * HZ_IMU, [0, 0, 0]]) * 180 / np.pi
    ruido = lambda n, s: rng.normal(0, s, (n, 3))
    up, w = up @ montaje, w @ montaje
    lsm_a = up * np.array([1.003, 0.998, 1.002]) + np.array([0.01, -0.005, 0.02]) + ruido(len(ts), 0.002)
    qmi_a = up + np.array([0.08, 0.07, 0.01]) + ruido(len(ts), 0.003)
    t_us = t0_us + ts * 1e6
    d = dict(lsm_t=t_us, lsm_a=lsm_a, lsm_g=w + ruido(len(ts), 0.3), qmi_t=t_us.copy(), qmi_a=qmi_a, qmi_g=w + ruido(len(ts), 0.3))
    tm = np.arange(0, ts[-1], 1 / HZ_MAG)
    rm = Slerp(ts, rots)(tm)
    B = rm.as_matrix() @ B_TIERRA @ montaje
    if campo_extra is not None:
        ta, tb, v = campo_extra
        en = (tm >= ta) & (tm <= tb)
        B[en] += np.asarray(v) @ montaje
    d['mmc'] = np.c_[t0_us + tm * 1e6, B @ BLANDO.T + DURO_MMC + ruido(len(tm), 0.003)]
    qm = B @ np.eye(3) + DURO_QMC + ruido(len(tm), 0.004)
    qm = np.c_[t0_us + (tm + 0.003) * 1e6, qm]
    for i in rng.choice(np.flatnonzero(tm > POSE_S * 7.5), picos_qmc, replace=False):
        v = rng.normal(0, 1, 3)
        qm[i, 1:] = v / np.linalg.norm(v) * 10.0                    # 10 G, mas alto que el rango del QMC (8 G)
    d['qmc'] = qm
    d['tramos_s'] = tramos
    return d


def correr(d, prev=None, ok=True):
    """calib.run sobre un log sintetico; devuelve (salida, texto impreso). `prev` es la calibracion anterior del LSM, que
    se escribe como calib_demeter.json junto a calib.py (con `ok`)."""
    def cargar(_):
        return d
    carpeta = tempfile.mkdtemp()
    try:
        if prev is not None:
            with open(os.path.join(carpeta, 'calib_demeter.json'), 'w') as f:
                json.dump(dict(ok=ok, lsm=prev), f)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            orig_load, orig_file = calib.load, calib.__file__
            calib.load, calib.__file__ = cargar, os.path.join(carpeta, 'calib.py')
            try:
                out = calib.run('DEM_sintetico.BIN')
            finally:
                calib.load, calib.__file__ = orig_load, orig_file
        return out, buf.getvalue()
    finally:
        shutil.rmtree(carpeta)


class Geometria(unittest.TestCase):
    """`label_geometry`: el ultimo recurso nombra las posiciones por sus direcciones, no por el orden de aparicion."""

    def poses(self, orden):
        return [dict(t1=10.0 * k, t2=10.0 * k + 5, u=POSE_BODY[i] / np.linalg.norm(POSE_BODY[i])) for k, i in enumerate(orden)]

    def nombres(self, orden):
        poses = self.poses(orden)
        return [orden[poses.index(p)] for p in calib.label_geometry(poses)]

    def test_en_orden_no_cambia(self):
        self.assertEqual(self.nombres((0, 1, 2, 3, 4, 5)), [0, 1, 2, 3, 4, 5])

    def test_giro_de_90_en_vez_de_180(self):
        """DEM 0092: tras 'marca arriba' el cohete quedo girado 90 grados (derecha) y 'marca abajo' llego despues."""
        self.assertEqual(self.nombres((0, 1, 2, 4, 3, 5)), [0, 1, 2, 3, 4, 5])

    def test_derecha_e_izquierda_por_mano_derecha(self):
        """Los dos ordenes de las ultimas dos posiciones dan los nombres de la guia, no los de aparicion."""
        self.assertEqual(self.nombres((0, 1, 2, 3, 5, 4)), [0, 1, 2, 3, 4, 5])

    def test_desorden_con_nariz_arriba_primero_y_marca_arriba_antes_que_marca_abajo(self):
        """Lo unico que la geometria no puede saber es cual de dos direcciones opuestas es 'arriba': por eso la primera
        es nariz arriba y la primera de las que quedan tras el par de la nariz es marca arriba."""
        for orden in ((0, 2, 1, 3, 5, 4), (0, 2, 4, 1, 3, 5), (0, 2, 5, 3, 4, 1), (0, 1, 2, 5, 3, 4)):
            with self.subTest(orden=orden):
                self.assertEqual(self.nombres(orden), [0, 1, 2, 3, 4, 5])

    def test_ruido_de_pocos_grados(self):
        rng = np.random.default_rng(3)
        poses = self.poses((0, 2, 4, 1, 3, 5))
        for p in poses:
            v = p['u'] + rng.normal(0, 0.05, 3)
            p['u'] = v / np.linalg.norm(v)
        orden = [(0, 2, 4, 1, 3, 5)[poses.index(p)] for p in calib.label_geometry(poses)]
        self.assertEqual(orden, [0, 1, 2, 3, 4, 5])


class EtiquetaPoses(unittest.TestCase):
    """`label_poses`: calibracion anterior, montaje nominal y, al final, geometria. Los datos son lo que mide el chip."""

    def lecturas(self, orden, montaje):
        """(poses, t, a): cada posicion dura 5 s a 100 Hz, con el chip montado como `montaje` (cuerpo desde chip)."""
        t = np.arange(0, 10.0 * len(orden), 0.01) * 1e6
        a = np.zeros((len(t), 3))
        poses = []
        for k, i in enumerate(orden):
            u = POSE_BODY[i] @ montaje                      # v_chip = montaje^T v_cuerpo
            a[(t >= 10e6 * k) & (t < 10e6 * k + 5e6)] = u
            poses.append(dict(t1=10e6 * k, t2=10e6 * k + 5e6, u=u))
        return poses, t, a

    def test_montaje_nominal_sin_anterior(self):
        poses, t, a = self.lecturas((0, 1, 2, 4, 3, 5), R_NOMINAL)
        out, how = calib.label_poses(poses, t, a, None)
        self.assertEqual(how, 'por orientacion (montaje nominal)')
        self.assertIs(out[3], poses[4])           # el orden de aparicion no importa

    def test_la_calibracion_anterior_se_prefiere_al_nominal(self):
        poses, t, a = self.lecturas((0, 1, 2, 3, 4, 5), R_GIRADO)
        prev = dict(R=R_GIRADO.tolist(), sesgo_g=[0, 0, 0], escala=[1, 1, 1])
        out, how = calib.label_poses(poses, t, a, prev)
        self.assertEqual(how, 'por orientacion (calibracion anterior)')

    def test_montaje_girado_cae_a_geometria(self):
        poses, t, a = self.lecturas((0, 1, 2, 4, 3, 5), R_GIRADO)
        out, how = calib.label_poses(poses, t, a, None)
        self.assertIn('por geometria: no cuadran con montaje nominal', how)
        self.assertIn('distinto al de la guia', how)
        self.assertIs(out[3], poses[4])

    def test_anterior_que_no_cuadra_prueba_el_nominal_y_luego_la_geometria(self):
        poses, t, a = self.lecturas((0, 1, 2, 3, 4, 5), R_GIRADO)
        prev = dict(R=(R_GIRADO @ Rotation.from_euler('xyz', [40, 40, 40], degrees=True).as_matrix()).tolist(), sesgo_g=[0, 0, 0], escala=[1, 1, 1])
        out, how = calib.label_poses(poses, t, a, prev)
        self.assertIn('por geometria: no cuadran con calibracion anterior ni con montaje nominal', how)
        self.assertNotIn('distinto', how)
        self.assertTrue(all(x is y for x, y in zip(out, poses)))

    def test_menos_de_seis_posiciones(self):
        poses, t, a = self.lecturas((0, 1, 2), R_NOMINAL)
        self.assertEqual(calib.label_poses(poses, t, a, None), (poses, 'por orden de aparicion'))


class Sinteticas(unittest.TestCase):
    """`calib.run` completo sobre logs inventados. El cohete quieto 6 s en cada posicion y despues 100 s girando."""

    @classmethod
    def setUpClass(cls):
        cls.limpio = log_sintetico()
        cls.girado = log_sintetico(montaje=R_GIRADO)

    def comprobar_bien(self, out):
        self.assertTrue(out['ok'], out['avisos'])
        self.assertLess(out['lsm']['error_pos_grados'], 2.0)
        self.assertLess(out['qmi']['error_pos_grados'], 2.0)
        self.assertLess(out['mmc']['residuo_mG'], 10)
        self.assertLess(out['qmc']['residuo_mG'], 10)

    def test_montaje_nominal_en_orden(self):
        out, txt = correr(self.limpio)
        self.comprobar_bien(out)
        self.assertIn('por orientacion (montaje nominal)', txt)
        np.testing.assert_allclose(out['mmc']['centro'], DURO_MMC, atol=0.02)
        np.testing.assert_allclose(out['lsm']['R'], R_NOMINAL, atol=0.02)

    def test_montaje_nominal_con_posiciones_en_desorden(self):
        """Por orientacion, el orden no importa: ni siquiera el de marca arriba y marca abajo."""
        for orden in ((0, 1, 2, 4, 3, 5), (0, 1, 3, 2, 5, 4), (0, 4, 2, 5, 1, 3)):
            with self.subTest(orden=orden):
                out, txt = correr(log_sintetico(orden=orden))
                self.comprobar_bien(out)
                self.assertIn('por orientacion (montaje nominal)', txt)
                np.testing.assert_allclose(out['lsm']['R'], R_NOMINAL, atol=0.02)

    def test_montaje_girado_entra_la_geometria(self):
        out, txt = correr(self.girado)
        self.comprobar_bien(out)
        self.assertIn('por geometria: no cuadran con montaje nominal', txt)
        self.assertNotIn('distinto al de la guia', txt)
        np.testing.assert_allclose(out['lsm']['R'], R_GIRADO, atol=0.02)

    def test_montaje_girado_con_giro_de_90_en_vez_de_180(self):
        """DEM 0092: 'marca abajo' no es la opuesta de 'marca arriba' en el orden de aparicion."""
        for orden in ((0, 1, 2, 4, 3, 5), (0, 1, 2, 3, 5, 4), (0, 2, 4, 1, 3, 5)):
            with self.subTest(orden=orden):
                out, txt = correr(log_sintetico(orden=orden, montaje=R_GIRADO))
                self.comprobar_bien(out)
                self.assertIn('distinto al de la guia', txt)
                np.testing.assert_allclose(out['lsm']['R'], R_GIRADO, atol=0.02)

    def test_con_calibracion_anterior_buena(self):
        base, _ = correr(self.girado)
        prev = {k: base['lsm'][k] for k in ('R', 'sesgo_g', 'escala')}
        out, txt = correr(log_sintetico(orden=(0, 1, 2, 4, 3, 5), montaje=R_GIRADO), prev=prev)
        self.comprobar_bien(out)
        self.assertIn('por orientacion (calibracion anterior)', txt)

    def test_calibracion_anterior_con_ok_false_se_ignora(self):
        """Una calibracion que salio incompleta no sirve para nombrar: se usa el montaje nominal. La de la prueba cuadra con
        los datos (es el nominal girado 90 grados), asi que si se usara, los nombres saldrian cambiados."""
        mala = dict(R=(R_NOMINAL @ Rotation.from_euler('z', 90, degrees=True).as_matrix()).tolist(), sesgo_g=[0, 0, 0], escala=[1, 1, 1])
        datos = log_sintetico(orden=(0, 1, 2, 4, 3, 5))
        out, txt = correr(datos, prev=mala, ok=False)
        self.comprobar_bien(out)
        self.assertIn('por orientacion (montaje nominal)', txt)
        np.testing.assert_allclose(out['lsm']['R'], R_NOMINAL, atol=0.02)
        con_ok, txt2 = correr(datos, prev=mala, ok=True)       # la misma, con ok: true, se usa
        self.assertIn('por orientacion (calibracion anterior)', txt2)
        self.assertGreater(np.abs(np.array(con_ok['lsm']['R']) - R_NOMINAL).max(), 0.5)

    def test_campo_extra_de_1_g_al_inicio(self):
        """Un iman pegado al cohete los primeros 25 s: cubre 'nariz arriba' y parte de 'nariz abajo'."""
        for nombre, montaje in (('nominal', R_NOMINAL), ('girado', R_GIRADO)):
            with self.subTest(montaje=nombre):
                d = log_sintetico(campo_extra=(0.0, 25.0, [1.0, 0.8, 0.5]), montaje=montaje)
                out, txt = correr(d)
                self.comprobar_bien(out)
                np.testing.assert_allclose(out['mmc']['centro'], DURO_MMC, atol=0.03)
                self.assertGreater(out['mmc']['descartadas'], 800)       # ~25 s a 50 Hz
                self.assertIn('campo anomalo', txt)
                self.assertIn('sin muestras limpias', txt)      # 'nariz arriba' cae entera en el tramo descartado

    def test_picos_de_10_g_en_el_qmc(self):
        out, txt = correr(log_sintetico(picos_qmc=60))
        self.comprobar_bien(out)
        np.testing.assert_allclose(out['qmc']['centro'], DURO_QMC, atol=0.03)
        self.assertGreaterEqual(out['qmc']['descartadas'], 55)

    def test_campo_extra_y_picos_con_desorden(self):
        d = log_sintetico(orden=(0, 1, 2, 4, 3, 5), campo_extra=(0.0, 25.0, [1.0, 0.8, 0.5]), picos_qmc=40, montaje=R_GIRADO)
        out, _ = correr(d)
        self.comprobar_bien(out)

    def test_ninguna_posicion_limpia_avisa_y_no_revienta(self):
        """Si todas las posiciones quedan fuera para el magnetometro, `np.ptp` y `min` de una lista vacia levantaban una excepcion."""
        with mock.patch.object(calib, 'mag_at_poses', lambda m, cal, poses: [None] * len(poses)):
            out, _ = correr(self.limpio)
        self.assertFalse(out['ok'])
        self.assertTrue(any('mmc: ninguna posicion con campo limpio' in a for a in out['avisos']), out['avisos'])
        self.assertTrue(any(a.startswith('MMC y QMC: ninguna posicion') for a in out['avisos']), out['avisos'])
        self.assertLess(out['lsm']['error_pos_grados'], 2.0)      # lo demas sigue saliendo


class RealesOpcionales(unittest.TestCase):
    """DEM 0092 y HER 0024. Con y sin una calibracion anterior en la carpeta: calib.py y tblog.py se copian a una
    carpeta temporal, sin ningun calib_*.json (se nombra por el montaje nominal) o con los vigentes de `estacion/`."""
    DIR = os.environ.get('CALIB_LOGS_DIR', '')
    LOGS = dict(DEM='DEM_M00_20261103_131429_0092.BIN', HER='HER_M00_20261103_132752_0024.BIN')

    def correr(self, rol, con_anterior):
        ruta = os.path.join(self.DIR, self.LOGS[rol])
        if not os.path.exists(ruta):
            self.skipTest(f'no esta {ruta} (definir CALIB_LOGS_DIR)')
        with tempfile.TemporaryDirectory() as t:
            for f in ('calib.py', 'tblog.py'):
                shutil.copy(os.path.join(ESTACION, f), t)
            if con_anterior:
                for f in ('calib_demeter_nuevo.json', 'calib_hermes.json'):
                    shutil.copy(os.path.join(ESTACION, f), t)
            sal = os.path.join(t, 'salida.json')
            p = subprocess.run([sys.executable, os.path.join(t, 'calib.py'), ruta, '--salida', sal], capture_output=True, text=True, check=True)
            with open(sal, encoding='utf-8') as f:
                return json.load(f), p.stdout

    def comprobar(self, rol, con_anterior):
        out, txt = self.correr(rol, con_anterior)
        self.assertTrue(out['ok'], out['avisos'])
        self.assertLess(out['lsm']['error_pos_grados'], 5.0)
        self.assertLess(out['mmc']['residuo_mG'], 10.0)
        self.assertIn('por orientacion (calibracion anterior)' if con_anterior else 'por orientacion (montaje nominal)', txt)

    def test_dem_0092_sin_anterior(self):
        self.comprobar('DEM', False)

    def test_dem_0092_con_anterior(self):
        self.comprobar('DEM', True)

    def test_her_0024_sin_anterior(self):
        self.comprobar('HER', False)

    def test_her_0024_con_anterior(self):
        self.comprobar('HER', True)


if __name__ == '__main__':
    unittest.main()
