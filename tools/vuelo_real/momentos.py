"""Detector de momentos del vuelo, por motor. Prototipo en Python de T-412: despues se traduce a C para la ESP32.

Entradas, como las tendra el firmware: |a| y |w| del LSM6DSO32 muestra a muestra (ejes del chip: la norma no depende de la
calibracion) y la altura barometrica (BMP581 si esta vivo; si no, BME280). Las decisiones se toman en la tarea de mision, que
corre cada TAREA_MS: un momento detectado en una muestra se anuncia en el siguiente tick de la tarea.

Momentos (maquina_estados, Pablo): BOOST -> COAST -> APOGEO -> (CAIDA) -> PARACAIDAS -> ATERRIZAJE. La carga de eyeccion del motor
puede llegar antes del apogeo (Demeter, 8 nov: eyeccion en t0+9.25 s, apogeo en t0+10.4 s). El momento es uno solo y no retrocede,
asi que una eyeccion antes del apogeo se guarda y PARACAIDAS se anuncia justo despues de APOGEO; la hora real de cada hecho queda
en `hechos`. Los tiempos de respaldo (fallback) solo AVISAN: nunca cambian el momento ni el registro (Pablo).
"""
import math

import numpy as np

M_LAUNCH, M_BOOST, M_COAST, M_APOGEO, M_CAIDA, M_PARACAIDAS, M_ATERRIZAJE = 1, 2, 3, 4, 5, 6, 7
NOMBRES = {M_LAUNCH: 'LAUNCH', M_BOOST: 'BOOST', M_COAST: 'COAST', M_APOGEO: 'APOGEO', M_CAIDA: 'CAIDA',
           M_PARACAIDAS: 'PARACAIDAS', M_ATERRIZAJE: 'ATERRIZAJE'}
G = 9.80665
TAREA_MS = 20                       # mission.cpp: TASK_MS

# Comunes (iguales a mission_config.h donde existen)
BOOST_ACC_MIN_G = 2.0
BOOST_RESET_S = 0.050
BOOST_DV_DECAY_G = 3.0
BOOST_DT_MAX_S = 0.005
BARO_MEDIANA = 5                    # mediana de la altura barometrica para APOGEO (quita picos sueltos)
QUIETO_G = 0.05                     # ATERRIZAJE: ||a| - 1| por debajo de esto
QUIETO_DPS = 5.0                    # y |w| por debajo de esto
CAIDA_S = 1.5                       # APOGEO sin eyeccion en este tiempo: CAIDA libre

# Por motor. Medido en los vuelos del 8 nov (t0 = encendido):
#  G80-7T (Hermes): quemado hasta t0+1.10 s (|a| 8.2 -> 2.1 g); en costeo |a| ~2 g por la resistencia y el giro (~2000 dps);
#    apogeo t0+8.9 s; carga t0+9.50 s (pico 22 g); choques de apertura 10.7 y 11.7 g; golpe de aterrizaje t0+57.0 s (48 g).
#  H135W-8 (Demeter): quemado hasta t0+1.30 s (|a| 5.8 -> 1.1 g); en costeo |a| < 1 g; carga t0+9.25 s (pico 32 g), antes del apogeo
#    (t0+10.4 s); apertura suave (< 2.5 g); golpe de aterrizaje t0+80.5 s (41 g).
# coast_g queda entre el final del empuje y el costeo de cada motor: con el 2 g de la propuesta original, Hermes pasaria a COAST
# casi 1 s tarde. Los tiempos de respaldo salen de mission_config.h (sim) y se ajustan con lo medido.
MOTORES = {
    'G80-7T': dict(boost_dv_mps=5.0, coast_g=4.0, coast_s=0.05, t_burn_max=2.7,
                   t_apogeo_min=5.5, apo_caida_m=3.0, apo_s=0.3, t_apogeo_max=13.0,
                   t_para_min=6.0, para_g=6.0, para_n=3, t_para_max=12.0,
                   aterrizaje_s=2.0, t_vuelo_max=140.0),
    'H135W-8': dict(boost_dv_mps=5.0, coast_g=3.0, coast_s=0.05, t_burn_max=3.0,
                    t_apogeo_min=7.0, apo_caida_m=3.0, apo_s=0.3, t_apogeo_max=16.0,
                    t_para_min=7.0, para_g=6.0, para_n=3, t_para_max=13.0,
                    aterrizaje_s=2.0, t_vuelo_max=210.0),
}


def mediana_movil(x, n):
    if len(x) < n:
        return x.copy()
    h = n // 2
    y = x.copy()
    for i in range(h, len(x) - h):
        y[i] = np.median(x[i - h:i + h + 1])
    return y


class Detector:
    def __init__(self, motor, t_launch_us):
        self.c = MOTORES[motor]
        self.momento = M_LAUNCH
        self.t_launch = t_launch_us
        self.t_boost = None
        self.hechos = {}                # nombre -> (t_us del hecho, valor)
        self.anuncios = []              # (t_us del anuncio en la tarea de mision, momento)
        self.avisos = []                # respaldos vencidos: (t_us, texto)
        # BOOST inercial (boost_detect.cpp)
        self.dv, self.t_prev, self.below, self.t_below = 0.0, None, False, None
        # COAST
        self.t_bajo = None
        # APOGEO
        self.h_max, self.t_hmax, self.t_bajo_max = -1e9, None, None
        # PARACAIDAS
        self.n_pico = 0
        self.eyeccion = None
        # ATERRIZAJE
        self.t_quieto = None
        self._avisado = set()

    def _tick(self, t_us):
        return int(math.ceil(t_us / (TAREA_MS * 1000.0)) * TAREA_MS * 1000)

    def _anunciar(self, t_us, m):
        self.momento = m
        self.anuncios.append((self._tick(t_us), m))

    def _desde_boost(self, t_us):
        return (t_us - self.t_boost) / 1e6

    def imu(self, t_us, a_g, w_dps):
        c = self.c
        if self.momento < M_BOOST:
            dt = (t_us - self.t_prev) / 1e6 if self.t_prev is not None else 0.0
            self.t_prev = t_us
            if dt > BOOST_RESET_S:
                self.dv, self.below = 0.0, False
            if a_g <= BOOST_ACC_MIN_G:
                if 0 < dt <= BOOST_DT_MAX_S:
                    self.dv = max(0.0, self.dv - BOOST_DV_DECAY_G * G * dt)
                if not self.below:
                    self.below, self.t_below = True, t_us
                elif t_us - self.t_below > BOOST_RESET_S * 1e6:
                    self.dv = 0.0
                return
            self.below = False
            if 0 < dt <= BOOST_DT_MAX_S:
                self.dv += (a_g - 1.0) * G * dt
                if self.dv >= c['boost_dv_mps']:
                    self.t_boost = t_us
                    self.hechos['BOOST'] = (t_us, self.dv)
                    self._anunciar(t_us, M_BOOST)
            return
        s = self._desde_boost(t_us)
        if self.momento == M_BOOST:
            if a_g < c['coast_g']:
                self.t_bajo = self.t_bajo or t_us
                if t_us - self.t_bajo >= c['coast_s'] * 1e6:
                    self.hechos['COAST'] = (self.t_bajo, None)
                    self._anunciar(t_us, M_COAST)
            else:
                self.t_bajo = None
        # eyeccion: un pico de aceleracion despues de t_para_min (sostenido para_n muestras: no un dato suelto)
        if self.eyeccion is None and self.momento >= M_COAST and s >= c['t_para_min']:
            self.n_pico = self.n_pico + 1 if a_g > c['para_g'] else 0
            if self.n_pico >= c['para_n']:
                self.eyeccion = t_us
                self.hechos['PARACAIDAS'] = (t_us, a_g)
                if self.momento >= M_APOGEO:
                    self._anunciar(t_us, M_PARACAIDAS)
        # aterrizaje: quieto, despues de la eyeccion o del apogeo
        if self.momento >= M_APOGEO and self.momento != M_ATERRIZAJE:
            if abs(a_g - 1.0) < QUIETO_G and w_dps < QUIETO_DPS:
                self.t_quieto = self.t_quieto or t_us
                if t_us - self.t_quieto >= c['aterrizaje_s'] * 1e6:
                    self.hechos['ATERRIZAJE'] = (self.t_quieto, None)
                    self._anunciar(t_us, M_ATERRIZAJE)
            else:
                self.t_quieto = None
        if self.momento == M_APOGEO and self.eyeccion is None and (t_us - self.anuncios[-1][0]) / 1e6 >= CAIDA_S:
            self.hechos['CAIDA'] = (self.anuncios[-1][0], None)
            self._anunciar(t_us, M_CAIDA)
        self._respaldos(t_us, s)

    def baro(self, t_us, h_m):
        """h_m: altura barometrica ya filtrada (mediana de BARO_MEDIANA)."""
        if self.momento < M_COAST or self.momento >= M_APOGEO:
            if self.momento >= M_BOOST and h_m > self.h_max:
                self.h_max, self.t_hmax = h_m, t_us
            return
        c = self.c
        if h_m > self.h_max:
            self.h_max, self.t_hmax, self.t_bajo_max = h_m, t_us, None
            return
        if self._desde_boost(t_us) < c['t_apogeo_min']:
            return
        if h_m < self.h_max - c['apo_caida_m']:
            self.t_bajo_max = self.t_bajo_max or t_us
            if t_us - self.t_bajo_max >= c['apo_s'] * 1e6:
                self.hechos['APOGEO'] = (self.t_hmax, self.h_max)
                self._anunciar(t_us, M_APOGEO)
                if self.eyeccion is not None:              # la carga llego antes del apogeo: PARACAIDAS va justo despues
                    self._anunciar(t_us + TAREA_MS * 1000, M_PARACAIDAS)
        else:
            self.t_bajo_max = None

    def _respaldos(self, t_us, s):
        c = self.c
        for m, clave, texto in ((M_COAST, 't_burn_max', 'sin fin de combustion'), (M_APOGEO, 't_apogeo_max', 'sin apogeo'),
                                (M_PARACAIDAS, 't_para_max', 'sin eyeccion'), (M_ATERRIZAJE, 't_vuelo_max', 'sin aterrizaje')):
            if self.momento < m and s >= c[clave] and clave not in self._avisado:
                self._avisado.add(clave)
                self.avisos.append((t_us, f'{texto} a {c[clave]:.1f} s del BOOST'))


def detectar(motor, t_launch_us, t_imu, a_imu, w_imu, t_baro, h_baro):
    """Recorre las muestras en orden de tiempo, como llegarian a la tarea de mision. Devuelve el detector."""
    det = Detector(motor, t_launch_us)
    h = mediana_movil(np.asarray(h_baro, dtype=float), BARO_MEDIANA)
    i = j = 0
    ni, nj = len(t_imu), len(t_baro)
    while i < ni or j < nj:
        if j >= nj or (i < ni and t_imu[i] <= t_baro[j]):
            if t_imu[i] >= t_launch_us:
                det.imu(int(t_imu[i]), float(a_imu[i]), float(w_imu[i]))
            i += 1
        else:
            if t_baro[j] >= t_launch_us:
                det.baro(int(t_baro[j]), float(h[j]))
            j += 1
    return det
