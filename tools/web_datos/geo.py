"""Geodesia local sobre el elipsoide WGS84 (plano tangente ENU en la rampa).

Para los metros que maneja la web (hasta unos pocos km) basta el plano tangente con
los radios de curvatura del elipsoide en la latitud de referencia. Son fórmulas
SIMULADAS: los cálculos reales de la estación son de T-S08.
"""

from __future__ import annotations

import math

from . import constantes as C

_E2 = C.WGS84_F * (2.0 - C.WGS84_F)  # excentricidad al cuadrado


def _radios(lat_deg: float) -> tuple[float, float]:
    """(radio meridiano, radio del primer vertical) en metros."""
    s = math.sin(math.radians(lat_deg))
    w = math.sqrt(1.0 - _E2 * s * s)
    return C.WGS84_A_M * (1.0 - _E2) / (w**3), C.WGS84_A_M / w


def enu_a_latlon(lat0: float, lon0: float, este_m: float, norte_m: float) -> tuple[float, float]:
    """Desplazamiento ENU (m) respecto a (lat0, lon0) -> (lat, lon) en grados."""
    rm, rn = _radios(lat0)
    lat = lat0 + math.degrees(norte_m / rm)
    lon = lon0 + math.degrees(este_m / (rn * math.cos(math.radians(lat0))))
    return lat, lon


def azimut_grados(de_este_m: float, de_norte_m: float) -> float:
    """Rumbo de un desplazamiento, 0 = norte, 90 = este, en [0, 360)."""
    return math.degrees(math.atan2(de_este_m, de_norte_m)) % 360.0


def elevacion_grados(dist_horiz_m: float, dif_alt_m: float) -> float:
    """Ángulo sobre el horizonte con que se ve un punto."""
    return math.degrees(math.atan2(dif_alt_m, dist_horiz_m))
