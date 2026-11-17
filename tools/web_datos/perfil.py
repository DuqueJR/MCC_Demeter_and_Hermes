"""Perfil de vuelo continuo: lo que el generador muestrea a 10 Hz.

A partir de las filas de OpenRocket (paso variable, de 4 ms a 0,5 s) arma un
perfil que se puede evaluar en cualquier instante:
- la altitud y la velocidad vertical usan interpolación cúbica de Hermite
  (la pendiente de la altitud es la velocidad, y la de la velocidad es la
  aceleración), para que el apogeo no se pierda al remuestrear;
- el resto se interpola linealmente.

Los ejes: ENU (este, norte, arriba). El tiempo de la simulación es el de OpenRocket
(t = 0 es la ignición).
"""

from __future__ import annotations

import math
from bisect import bisect_right
from dataclasses import dataclass, field

from .openrocket import DatosOpenRocket, es_nan

# Ventana mínima (s) para estimar la dirección del movimiento horizontal por
# diferencias: las posiciones del CSV tienen solo 4 cifras significativas.
_VENTANA_DIRECCION_S = 0.2


@dataclass
class Perfil:
    t: list[float]
    alt: list[float]
    vz: list[float]
    aup: list[float]
    e: list[float]
    n: list[float]
    ve: list[float]
    vn: list[float]
    ae: list[float]
    an: list[float]
    el: list[float]  # elevación de la nariz sobre el horizonte, °
    az: list[float]  # rumbo de la nariz (0 = norte, 90 = este), °
    g_local: float
    eventos: dict[str, float] = field(default_factory=dict)

    # ---------------------------------------------------------------- consulta
    @property
    def t_fin(self) -> float:
        return self.t[-1]

    @property
    def alt_max_nodos(self) -> float:
        return max(self.alt)

    def en(self, t: float) -> dict[str, float]:
        """Estado en el instante `t` (s). Antes de t[0] el cohete está en la rampa;
        después de t[-1] está en el suelo y quieto."""
        if t <= self.t[0]:
            return self._reposo(0)
        if t >= self.t[-1]:
            return self._reposo(len(self.t) - 1)
        i = bisect_right(self.t, t) - 1
        t0, t1 = self.t[i], self.t[i + 1]
        h = t1 - t0
        u = (t - t0) / h
        return {
            "alt": _hermite(self.alt[i], self.alt[i + 1], self.vz[i], self.vz[i + 1], h, u),
            "vz": _hermite(self.vz[i], self.vz[i + 1], self.aup[i], self.aup[i + 1], h, u),
            "aup": _lin(self.aup[i], self.aup[i + 1], u),
            "e": _lin(self.e[i], self.e[i + 1], u),
            "n": _lin(self.n[i], self.n[i + 1], u),
            "ve": _lin(self.ve[i], self.ve[i + 1], u),
            "vn": _lin(self.vn[i], self.vn[i + 1], u),
            "ae": _lin(self.ae[i], self.ae[i + 1], u),
            "an": _lin(self.an[i], self.an[i + 1], u),
            "el": _lin(self.el[i], self.el[i + 1], u),
            "az": _lin(self.az[i], self.az[i + 1], u),
        }

    def _reposo(self, i: int) -> dict[str, float]:
        return {
            "alt": self.alt[i],
            "vz": 0.0,
            "aup": 0.0,
            "e": self.e[i],
            "n": self.n[i],
            "ve": 0.0,
            "vn": 0.0,
            "ae": 0.0,
            "an": 0.0,
            "el": self.el[i],
            "az": self.az[i],
        }

    # ------------------------------------------------------------- transformaciones
    def escalar(self, k_tiempo: float, k_altura: float) -> "Perfil":
        """Escala uniforme: tiempos x k_tiempo, distancias x k_altura.
        Velocidades x k_altura/k_tiempo y aceleraciones x k_altura/k_tiempo²."""
        kv = k_altura / k_tiempo
        ka = k_altura / (k_tiempo * k_tiempo)
        return Perfil(
            t=[x * k_tiempo for x in self.t],
            alt=[x * k_altura for x in self.alt],
            vz=[x * kv for x in self.vz],
            aup=[x * ka for x in self.aup],
            e=[x * k_altura for x in self.e],
            n=[x * k_altura for x in self.n],
            ve=[x * kv for x in self.ve],
            vn=[x * kv for x in self.vn],
            ae=[x * ka for x in self.ae],
            an=[x * ka for x in self.an],
            el=list(self.el),
            az=list(self.az),
            g_local=self.g_local,
            eventos={k: v * k_tiempo for k, v in self.eventos.items()},
        )

    def acelerar_descenso(self, factor: float, t_desde: float) -> "Perfil":
        """Después de `t_desde` el tiempo corre `factor` veces más rápido: la misma
        trayectoria se recorre más deprisa (velocidades x factor, aceleraciones x factor²)."""

        def mapa_t(t: float) -> float:
            return t if t <= t_desde else t_desde + (t - t_desde) / factor

        def esc(valores: list[float], k: float) -> list[float]:
            return [v * k if t > t_desde else v for v, t in zip(valores, self.t)]

        return Perfil(
            t=[mapa_t(t) for t in self.t],
            alt=list(self.alt),
            vz=esc(self.vz, factor),
            aup=esc(self.aup, factor * factor),
            e=list(self.e),
            n=list(self.n),
            ve=esc(self.ve, factor),
            vn=esc(self.vn, factor),
            ae=esc(self.ae, factor * factor),
            an=esc(self.an, factor * factor),
            el=list(self.el),
            az=list(self.az),
            g_local=self.g_local,
            eventos={k: mapa_t(v) for k, v in self.eventos.items()},
        )

    # --------------------------------------------------------------- búsquedas
    def instante_cruce_vz(self, umbral: float, desde: float) -> float:
        """Primer instante después de `desde` en que la velocidad vertical baja de
        `umbral` (negativo), con bisección sobre la interpolación."""
        paso = 0.005
        t = desde
        while t < self.t_fin:
            if self.en(t + paso)["vz"] < umbral:
                lo, hi = t, t + paso
                for _ in range(40):
                    medio = 0.5 * (lo + hi)
                    if self.en(medio)["vz"] < umbral:
                        hi = medio
                    else:
                        lo = medio
                return hi
            t += paso
        raise ValueError("la velocidad vertical nunca baja del umbral")

    def instante_cruce_alt_bajando(self, altura: float, desde: float) -> float:
        """Primer instante después de `desde` en que la altitud baja de `altura`."""
        paso = 0.005
        t = desde
        while t < self.t_fin:
            if self.en(t + paso)["alt"] < altura:
                lo, hi = t, t + paso
                for _ in range(40):
                    medio = 0.5 * (lo + hi)
                    if self.en(medio)["alt"] < altura:
                        hi = medio
                    else:
                        lo = medio
                return hi
            t += paso
        raise ValueError("la altitud nunca baja del umbral")


def _lin(a: float, b: float, u: float) -> float:
    return a + (b - a) * u


def _hermite(y0: float, y1: float, m0: float, m1: float, h: float, u: float) -> float:
    u2, u3 = u * u, u * u * u
    return (
        (2 * u3 - 3 * u2 + 1) * y0
        + (u3 - 2 * u2 + u) * h * m0
        + (-2 * u3 + 3 * u2) * y1
        + (u3 - u2) * h * m1
    )


def _rellenar_nan(valores: list[float], por_defecto: float) -> list[float]:
    """Cada NaN toma el último valor válido (o `por_defecto` al principio)."""
    salida: list[float] = []
    ultimo = por_defecto
    for v in valores:
        if not es_nan(v):
            ultimo = v
        salida.append(ultimo)
    return salida


def desde_openrocket(datos: DatosOpenRocket) -> Perfil:
    """Convierte las columnas crudas en un `Perfil`."""
    c = datos.columnas
    t = c["t"]
    n_pts = len(t)
    if n_pts < 3 or any(t[i + 1] <= t[i] for i in range(n_pts - 1)):
        raise ValueError("el tiempo de la simulación no es estrictamente creciente")
    alt = _rellenar_nan(c["alt"], 0.0)
    vz = _rellenar_nan(c["vz"], 0.0)
    aup = _rellenar_nan(c["aup"], 0.0)
    este = _rellenar_nan(c["este"], 0.0)
    norte = _rellenar_nan(c["norte"], 0.0)
    vh = _rellenar_nan(c["vh"], 0.0)
    ah = _rellenar_nan(c["ah"], 0.0)
    elev = _rellenar_nan(c["elev"], 90.0)
    azim = _rellenar_nan(c["azim"], 0.0)
    g_local = _rellenar_nan(c["g"], 9.80665)[0]

    # Dirección del movimiento horizontal: diferencias de la posición en una ventana
    # de al menos _VENTANA_DIRECCION_S (las posiciones tienen pocas cifras).
    ue = [0.0] * n_pts
    un = [0.0] * n_pts
    ult = (0.0, 0.0)
    for i in range(n_pts):
        j0, j1 = i, i
        while j0 > 0 and t[i] - t[j0] < _VENTANA_DIRECCION_S / 2:
            j0 -= 1
        while j1 < n_pts - 1 and t[j1] - t[i] < _VENTANA_DIRECCION_S / 2:
            j1 += 1
        de, dn = este[j1] - este[j0], norte[j1] - norte[j0]
        norma = math.hypot(de, dn)
        if norma > 1e-9:
            ult = (de / norma, dn / norma)
        ue[i], un[i] = ult

    ve = [vh[i] * ue[i] for i in range(n_pts)]
    vn = [vh[i] * un[i] for i in range(n_pts)]
    # La aceleración horizontal del CSV es un módulo: se le da el signo de d|vh|/dt.
    ae: list[float] = []
    an: list[float] = []
    for i in range(n_pts):
        a, b = max(i - 1, 0), min(i + 1, n_pts - 1)
        signo = 1.0 if vh[b] - vh[a] >= 0 else -1.0
        ae.append(signo * abs(ah[i]) * ue[i])
        an.append(signo * abs(ah[i]) * un[i])

    return Perfil(
        t=list(t),
        alt=alt,
        vz=vz,
        aup=aup,
        e=este,
        n=norte,
        ve=ve,
        vn=vn,
        ae=ae,
        an=an,
        el=elev,
        az=azim,
        g_local=g_local,
        eventos=dict(datos.eventos),
    )
