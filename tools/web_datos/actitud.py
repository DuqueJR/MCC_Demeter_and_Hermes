"""Actitud del cohete: cuaternión del cuerpo a ENU (protocolo_paquetes §2, NAV).

El eje +X del cuerpo apunta a la nariz. OpenRocket no modela el giro (roll), así que
se usa la rotación mínima que lleva +X a la dirección de la nariz.
Se publica con `w >= 0` (forma canónica).
"""

from __future__ import annotations

import math

Vec = tuple[float, float, float]
Cuat = tuple[float, float, float, float]  # (w, x, y, z)


def nariz_enu(elevacion_deg: float, rumbo_deg: float) -> Vec:
    """Dirección de la nariz en ENU. Elevación sobre el horizonte; rumbo 0 = norte."""
    el, az = math.radians(elevacion_deg), math.radians(rumbo_deg)
    return (math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el))


def cuaternion_desde_nariz(n: Vec) -> Cuat:
    """Rotación mínima de +X (cuerpo) a `n` (ENU): q = normalizar(1 + x·n, x × n)."""
    ne, nn, nu = n
    w = 1.0 + ne
    x, y, z = 0.0, -nu, nn  # (1,0,0) × n
    norma = math.sqrt(w * w + x * x + y * y + z * z)
    if norma < 1e-12:  # nariz hacia -X: media vuelta alrededor de Z
        return (0.0, 0.0, 0.0, 1.0)
    return (w / norma, x / norma, y / norma, z / norma)


def rotar(q: Cuat, v: Vec) -> Vec:
    """Rota `v` del cuerpo a ENU con `q`."""
    w, x, y, z = q
    vx, vy, vz = v
    # t = 2 q_vec × v ; v' = v + w t + q_vec × t
    tx = 2.0 * (y * vz - z * vy)
    ty = 2.0 * (z * vx - x * vz)
    tz = 2.0 * (x * vy - y * vx)
    return (
        vx + w * tx + (y * tz - z * ty),
        vy + w * ty + (z * tx - x * tz),
        vz + w * tz + (x * ty - y * tx),
    )


def rotar_inverso(q: Cuat, v: Vec) -> Vec:
    """Rota `v` de ENU al cuerpo (con el conjugado de `q`)."""
    w, x, y, z = q
    return rotar((w, -x, -y, -z), v)


def norma(v: Vec) -> float:
    return math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
