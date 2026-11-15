"""Alturas barometricas sobre la rampa.

Hay tres formas de pasar presion a altura, y en los vuelos del 8 nov dan apogeos distintos (Hermes: 367, 382 y 392 m):
- estandar ISA (15 C a nivel del mar): la que da menos; no es la del ESTER.
- fisica: hipsometrica con la temperatura del aire en el suelo (D-058) y el gradiente estandar de -6.5 K/km. Es la que coincide con
  el GNSS (Hermes: 382 m frente a 380 m del GNSS) y la que debe usar el EKF.
- referencia ESTER: el altimetro oficial (un BMx280) parece usar su propia temperatura interna. Con la temperatura de la bahia (BMP581)
  Hermes da 392 m frente a 393 oficiales, y Demeter ~601 m frente a 598. Para la web se usa una temperatura efectiva constante, la que
  reproduce el apogeo oficial de cada cohete; el resumen guarda tambien la estimacion con la temperatura medida.
"""
import math

import numpy as np

R = 287.053
G = 9.80665
GRADIENTE = 0.0065


def fisica(p, p0, t_suelo_c):
    """Hipsometrica con perfil lineal de temperatura desde el suelo (exacta)."""
    tk = t_suelo_c + 273.15
    return tk / GRADIENTE * (1.0 - (np.asarray(p) / p0) ** (R * GRADIENTE / G))


def isotermica(p, p0, t_c):
    return R * (t_c + 273.15) / G * np.log(p0 / np.asarray(p))


def con_temperatura_medida(p, t_c, p0):
    """Integra dz = R T / g dp / p con la temperatura de cada muestra (la del sensor)."""
    p = np.asarray(p, dtype=float)
    tk = np.asarray(t_c, dtype=float) + 273.15
    prev = np.r_[p0, p[:-1]]
    return np.cumsum(R * tk / G * np.log(prev / p))


def temperatura_efectiva(p_apogeo, p0, apogeo_oficial_m):
    """La temperatura constante con la que la isotermica da el apogeo oficial."""
    return apogeo_oficial_m * G / (R * math.log(p0 / p_apogeo)) - 273.15
