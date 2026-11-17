"""Fabrica los mensajes `web-1` de una misión y un escenario (05_contrato_datos_web §2 y §5).

Cómo funciona:
- El archivo se arma sobre la rejilla de ciclos TDMA de 100 ms (`TDMA_CICLO_MS`). El
  ciclo `k` empieza en `UTC_INICIO_MS + k*100`. En 9 de cada 10 ciclos el cohete manda
  NAV y en el décimo manda STATUS (protocolo §1), así que el `seq` de NAV es el número
  de NAV emitidos antes (módulo 256) y se ven los saltos reales.
- En vuelo (BOOST hasta el aterrizaje) pasan todos los NAV (~9 Hz). En tierra el relay
  baja el estado a 1 Hz (`WEB_TASA_TIERRA_HZ`).
- `t_rel_ms` de cada línea es el instante en que el relay la emite
  (`relay_utc_ms - UTC_INICIO_MS`).
- Los tiempos de los eventos son los de la simulación (sin la demora de detección de
  la máquina de estados real: ver el README).
- Todo lo que depende del cohete sale del `Perfil` (OpenRocket). Lo que calcula la
  estación (calc, enlace) se SIMULA con fórmulas simples. El ruido es determinista.
"""

from __future__ import annotations

import math
import random
import zlib
from dataclasses import dataclass
from functools import lru_cache

from . import actitud, geo
from . import constantes as C
from .openrocket import leer_csv
from .perfil import Perfil, desde_openrocket

# Orden de los mensajes que caen en el mismo milisegundo.
_ORDEN = {"meta": 0, "estado": 1, "salud": 2, "estacion": 3, "evento": 4, "backfill": 5}

_SIGUIENTE_FASE = {
    "PREFLIGHT": "ARMED",
    "ARMED": "BOOST",
    "BOOST": "COAST",
    "COAST": "APOGEE",
    "APOGEE": "DESCENT",
    "DESCENT": "LANDED",
    "LANDED": None,
}

_CONDICIONES = (
    ("gnss", "Satélites y precisión"),
    ("hora", "Hora válida y sincronía"),
    ("sensores", "Sensores críticos"),
    ("quietud", "Cohete quieto"),
    ("sd", "SD con espacio"),
    ("bateria", "Batería suficiente"),
    ("pi", "VisionPack listo"),
)


def r(x: float | None, decimales: int) -> float | None:
    """Redondea y normaliza el -0.0."""
    if x is None:
        return None
    return round(x, decimales) + 0.0


# --------------------------------------------------------------------------- #
# Misiones
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Mision:
    nombre: str
    nodo: int
    modo: str  # "simulacion" (OpenRocket real) o "sintetico"
    proto_version: int
    fw_version: str | None
    tiene_pi: bool
    bat_descarga_pct_h: float
    perfil: Perfil


@lru_cache(maxsize=None)
def cargar_perfil_demeter() -> Perfil:
    return desde_openrocket(leer_csv(C.CSV_DEMETER))


def construir_hermes(base: Perfil) -> Perfil:
    """Hermes sintético (PEN-W04): la forma de Deméter escalada al G80-7T.
    El tiempo se escala para que el retardo entre el fin de la combustión y la
    eyección sea el del G80-7T (7 s); las distancias, con HERMES_ESCALA_ALTURA."""
    retardo_demeter = base.eventos["EJECTION_CHARGE"] - base.eventos["BURNOUT"]
    return base.escalar(C.G80_RETARDO_S / retardo_demeter, C.HERMES_ESCALA_ALTURA)


def cargar_mision(nombre: str) -> Mision:
    base = cargar_perfil_demeter()
    if nombre == "demeter":
        return Mision(
            nombre="demeter",
            nodo=C.NODO_DEMETER,
            modo="simulacion",
            proto_version=3,
            fw_version="a1b2c3d",
            tiene_pi=True,
            bat_descarga_pct_h=C.BAT_DESCARGA_PCT_H_DEMETER,
            perfil=base,
        )
    if nombre == "hermes":
        return Mision(
            nombre="hermes",
            nodo=C.NODO_HERMES,
            modo="sintetico",
            proto_version=2,
            fw_version=None,
            tiene_pi=False,
            bat_descarga_pct_h=C.BAT_DESCARGA_PCT_H_HERMES,
            perfil=construir_hermes(base),
        )
    raise ValueError(f"misión desconocida: {nombre!r}")


# --------------------------------------------------------------------------- #
# Línea de tiempo de un escenario
# --------------------------------------------------------------------------- #
@dataclass
class Tiempos:
    """Instantes de la simulación (s desde la ignición) y de la rejilla (ms de archivo)."""

    lift: float
    burnout: float
    eyeccion: float
    apogeo: float
    descenso: float  # APOGEE -> DESCENT (Vz < -APOGEO_VZ_SALIDA_MS)
    suelo: float
    alarma: float | None  # Vz < -ALARMA_DESCENSO_MS en DESCENT
    corte: float | None  # `lkp_descenso`: instante en que se pierde la señal
    lanz_ms: int  # instante del archivo en que t_sim = 0
    fin_ms: int
    backfill_k0: int | None  # ciclo del primer mensaje de backfill
    backfill_kf: int | None  # ciclo del último
    backfill_n: int | None


def _calcular_tiempos(escenario: str, perfil: Perfil) -> Tiempos:
    ev = perfil.eventos
    lanz_ms = round((C.ARM_S + C.ARMADO_S) * 1000)
    if escenario == "espera_rampa":
        return Tiempos(0, 0, 0, 0, 0, 0, None, None, lanz_ms, round(C.ESPERA_RAMPA_S * 1000), None, None, None)
    apogeo = ev["APOGEE"]
    descenso = perfil.instante_cruce_vz(-C.APOGEO_VZ_SALIDA_MS, apogeo)
    suelo = ev["GROUND_HIT"]
    try:
        alarma = perfil.instante_cruce_vz(-C.ALARMA_DESCENSO_MS, descenso)
        if alarma >= suelo:
            alarma = None
    except ValueError:
        alarma = None
    corte = None
    if escenario == "lkp_descenso":
        corte = perfil.instante_cruce_alt_bajando(C.LKP_CORTE_ALT_M, descenso)
    fin_ms = lanz_ms + round(suelo * 1000) + round(C.POST_ATERRIZAJE_S * 1000)
    k0 = kf = n = None
    if escenario == "backfill":
        n = int(suelo * 1000 / C.TDMA_CICLO_MS) + 1  # un registro NAV por ciclo hasta aterrizar
        inicio_ms = lanz_ms + round(suelo * 1000) + round(C.BACKFILL_INICIO_S * 1000)
        k0 = -(-inicio_ms // C.TDMA_CICLO_MS)
        while k0 % 10 != 9:
            k0 += 1
        pasos = -(-n // C.BACKFILL_REG_POR_S)
        kf = k0 + 10 * pasos
        fin_ms = max(fin_ms, kf * C.TDMA_CICLO_MS + round(C.POST_ATERRIZAJE_S * 1000))
    return Tiempos(
        lift=ev["LIFTOFF"],
        burnout=ev["BURNOUT"],
        eyeccion=ev["EJECTION_CHARGE"],
        apogeo=apogeo,
        descenso=descenso,
        suelo=suelo,
        alarma=alarma,
        corte=corte,
        lanz_ms=lanz_ms,
        fin_ms=fin_ms,
        backfill_k0=k0,
        backfill_kf=kf,
        backfill_n=n,
    )


# --------------------------------------------------------------------------- #
# Generador
# --------------------------------------------------------------------------- #
class Generador:
    def __init__(self, mision: str, escenario: str):
        if escenario not in C.ESCENARIOS:
            raise ValueError(f"escenario desconocido: {escenario!r}")
        self.m = cargar_mision(mision)
        self.escenario = escenario
        self.vuelo = escenario != "espera_rampa"
        perfil = self.m.perfil
        if escenario == "descenso_rapido":
            perfil = perfil.acelerar_descenso(C.DESCENSO_RAPIDO_FACTOR, perfil.eventos["APOGEE"])
        self.p = perfil
        self.t = _calcular_tiempos(escenario, perfil)
        self.n_ciclos = -(-self.t.fin_ms // C.TDMA_CICLO_MS)
        self.mission_id = (C.UTC_INICIO_MS + round(C.ARM_S * 1000)) // 1000 if self.vuelo else None
        self._max_alt = self._alturas_maximas()
        self._preparar_ruido()
        self._preparar_enlace()

    # ---------------------------------------------------------------- utilidades
    def t_sim(self, k: int) -> float:
        return (k * C.TDMA_CICLO_MS - self.t.lanz_ms) / 1000.0

    def t_arch(self, k: int) -> float:
        return k * C.TDMA_CICLO_MS / 1000.0

    def _alturas_maximas(self) -> list[float]:
        acumulado, maximo = [], 0.0
        for a in self.p.alt:
            maximo = max(maximo, a)
            acumulado.append(maximo)
        return acumulado

    def alt_max_hasta(self, t: float) -> float:
        if t <= 0:
            return 0.0
        base = 0.0
        for i, ti in enumerate(self.p.t):
            if ti > t:
                break
            base = self._max_alt[i]
        return max(base, self.p.en(t)["alt"])

    def _preparar_ruido(self) -> None:
        semilla = zlib.crc32(f"{self.m.nombre}/{self.escenario}/{C.SEMILLA}".encode("utf-8"))
        rng = random.Random(semilla)
        n = self.n_ciclos
        self.u_perdida = [rng.random() for _ in range(n)]
        self.g_rssi = [rng.gauss(0.0, 1.0) for _ in range(n)]
        self.g_snr = [rng.gauss(0.0, 1.0) for _ in range(n)]
        self.u_innov = [rng.random() for _ in range(n)]

    def fase_en(self, k: int) -> str:
        if not self.vuelo:
            return "PREFLIGHT"
        ts, ta = self.t_sim(k), self.t_arch(k)
        t = self.t
        if ta < C.ARM_S:
            return "PREFLIGHT"
        if ts < t.lift:
            return "ARMED"
        if ts < t.burnout:
            return "BOOST"
        if ts < t.apogeo:
            return "COAST"
        if ts < t.descenso:
            return "APOGEE"
        if ts < t.suelo:
            return "DESCENT"
        return "LANDED"

    def en_vuelo_rapido(self, k: int) -> bool:
        """¿Pasan todos los NAV (~9 Hz)? Desde el despegue hasta el aterrizaje."""
        if not self.vuelo:
            return False
        ts = self.t_sim(k)
        return self.t.lift <= ts <= self.t.suelo + C.TDMA_CICLO_MS / 1000.0

    # ---------------------------------------------------------- enlace y entregas
    def _preparar_enlace(self) -> None:
        """Qué ciclos llegan a la estación y las pérdidas de los últimos 10 s."""
        n = self.n_ciclos
        entregado = [True] * n
        t = self.t
        for k in range(n):
            es_nav = k % C.STATUS_CADA_CICLOS != 0
            ts = self.t_sim(k)
            if self.escenario == "lkp_descenso" and t.corte is not None:
                if ts >= t.corte:
                    entregado[k] = False
                    continue
                frac = (ts - (t.corte - C.LKP_DEBILITAMIENTO_S)) / C.LKP_DEBILITAMIENTO_S
                if es_nav and frac > 0 and self.u_perdida[k] < min(frac, 1.0) * C.LKP_PERDIDA_MAX_FRAC:
                    entregado[k] = False
            elif self.escenario == "backfill":
                if es_nav and t.lift <= ts <= t.suelo and self.u_perdida[k] < C.BACKFILL_PERDIDA_FRAC:
                    entregado[k] = False
        self.entregado = entregado
        # acumulados de NAV emitidos y perdidos (para `seq` y para el % de 10 s)
        self.nav_antes = [0] * (n + 1)
        self.perd_antes = [0] * (n + 1)
        for k in range(n):
            es_nav = k % C.STATUS_CADA_CICLOS != 0
            self.nav_antes[k + 1] = self.nav_antes[k] + (1 if es_nav else 0)
            self.perd_antes[k + 1] = self.perd_antes[k] + (1 if es_nav and not entregado[k] else 0)
        # último ciclo entregado hasta k (para `ultimo_paquete_hace_ms`)
        self.ultimo_entregado: list[int | None] = []
        ult: int | None = None
        for k in range(n):
            if entregado[k]:
                ult = k
            self.ultimo_entregado.append(ult)

    def seq_nav(self, k: int) -> int:
        return self.nav_antes[k] % 256

    def perdidos_pct(self, k: int) -> float:
        ventana = 10_000 // C.TDMA_CICLO_MS
        a = max(0, k - ventana + 1)
        total = self.nav_antes[k + 1] - self.nav_antes[a]
        perdidos = self.perd_antes[k + 1] - self.perd_antes[a]
        return 100.0 * perdidos / total if total else 0.0

    # --------------------------------------------------------------- geometría
    def _pos_estacion(self) -> tuple[float, float]:
        return geo.enu_a_latlon(C.SITIO_LAT, C.SITIO_LON, C.ESTACION_ESTE_M, C.ESTACION_NORTE_M)

    def _distancias(self, e: float, n: float, alt: float) -> tuple[float, float]:
        """(distancia horizontal, distancia 3D) desde la estación."""
        dh = math.hypot(e - C.ESTACION_ESTE_M, n - C.ESTACION_NORTE_M)
        dz = (alt + C.SITIO_ALT_MSL_M) - C.ESTACION_ALT_MSL_M
        return dh, math.sqrt(dh * dh + dz * dz)

    def _rssi(self, k: int, dist3d: float) -> float:
        rssi = C.RSSI_REF_DBM - 20.0 * math.log10(max(dist3d, 1.0) / C.RSSI_DIST_REF_M)
        rssi += C.RSSI_RUIDO_DB * self.g_rssi[k]
        t = self.t
        if self.escenario == "lkp_descenso" and t.corte is not None:
            frac = (self.t_sim(k) - (t.corte - C.LKP_DEBILITAMIENTO_S)) / C.LKP_DEBILITAMIENTO_S
            if frac > 0:
                rssi += (C.LKP_RSSI_CORTE_DBM - rssi) * min(frac, 1.0)
        return max(rssi, -120.0)

    # ---------------------------------------------------------------- estado
    def _acc_cuerpo(self, ts: float) -> tuple[float, float, float]:
        """Fuerza específica en el cuerpo (g), promedio de los 100 ms previos."""
        n = 5
        sx = sy = sz = 0.0
        for j in range(n):
            tj = ts - (C.TDMA_CICLO_MS / 1000.0) * j / (n - 1)
            s = self.p.en(tj)
            q = actitud.cuaternion_desde_nariz(actitud.nariz_enu(s["el"], s["az"]))
            f = (s["ae"], s["an"], s["aup"] + self.p.g_local)
            bx, by, bz = actitud.rotar_inverso(q, f)
            sx, sy, sz = sx + bx, sy + by, sz + bz
        k = n * C.GRAVEDAD_ESTANDAR_MS2
        return sx / k, sy / k, sz / k

    def _secundario(self, k: int, fase: str) -> dict | None:
        if not self.m.tiene_pi:
            return None
        ta = self.t_arch(k)
        if ta < C.PI_ENCENDIDA_S:
            codigo = C.PI_BOOT
        elif ta < C.PI_LISTA_S:
            codigo = C.PI_PREFLIGHT
        elif fase == "PREFLIGHT":
            codigo = C.PI_READY
        elif fase == "ARMED":
            codigo = C.PI_ARMED
        elif fase in ("BOOST", "COAST"):
            codigo = C.PI_ASCENT
        else:
            codigo = C.PI_RECORDING
        return {"codigo": codigo, "texto": C.STATUS_PI_TEXTO[codigo]}

    def _backfill_activo(self, k: int) -> bool:
        t = self.t
        return t.backfill_k0 is not None and t.backfill_k0 <= k < t.backfill_kf

    def _bat_pct(self, k: int) -> int:
        return int(round(C.BAT_INICIAL_PCT - self.m.bat_descarga_pct_h * self.t_arch(k) / 3600.0))

    def _gnss(self, k: int) -> tuple[int, int, float | None]:
        ta = self.t_arch(k)
        if ta < C.FIX_GNSS_S:
            return 0, 3, None
        dt = ta - C.FIX_GNSS_S
        hacc = C.GNSS_HACC_FINAL_M + (C.GNSS_HACC_INICIAL_M - C.GNSS_HACC_FINAL_M) * math.exp(
            -dt / C.GNSS_HACC_TAU_S
        )
        sv = min(C.GNSS_SV_FINAL, C.GNSS_SV_INICIAL + int(dt / C.GNSS_SV_PASO_S))
        return 3, sv, hacc

    def estado(self, k: int) -> dict:
        ts, ta = self.t_sim(k), self.t_arch(k)
        fase = self.fase_en(k)
        s = self.p.en(ts)
        fix, _sv, _hacc = self._gnss(k)
        gnss_fix = fix == 3
        ekf_ok = self.vuelo and fase != "PREFLIGHT"
        utc = C.UTC_INICIO_MS + k * C.TDMA_CICLO_MS
        rx = utc + C.RX_RETRASO_MS
        relay = rx + C.RELAY_RETRASO_MS
        dh, d3 = self._distancias(s["e"], s["n"], s["alt"])
        lat, lon = geo.enu_a_latlon(C.SITIO_LAT, C.SITIO_LON, s["e"], s["n"])

        if gnss_fix:
            pos = {
                "lat": r(lat, C.DECIMALES_LATLON),
                "lon": r(lon, C.DECIMALES_LATLON),
                "alt_agl_m": r(s["alt"], C.DECIMALES_M),
                "alt_msl_m": r(s["alt"] + C.SITIO_ALT_MSL_M, C.DECIMALES_M),
                "fuente": "ekf" if ekf_ok else "gnss",
            }
            vz = s["vz"]
            vel = {
                "n_ms": r(s["vn"], C.DECIMALES_MS),
                "e_ms": r(s["ve"], C.DECIMALES_MS),
                "u_ms": r(vz, C.DECIMALES_MS),
                "total_ms": r(math.sqrt(s["ve"] ** 2 + s["vn"] ** 2 + vz**2), C.DECIMALES_MS),
            }
            lkp = {
                "lat": pos["lat"],
                "lon": pos["lon"],
                "alt_agl_m": pos["alt_agl_m"],
                "utc_ms": utc,
            }
        else:
            pos = vel = lkp = None

        ax, ay, az = self._acc_cuerpo(ts)
        q = actitud.cuaternion_desde_nariz(actitud.nariz_enu(s["el"], s["az"]))

        activo_alarma = (
            self.t.alarma is not None and self.t.alarma <= ts < self.t.suelo and fase == "DESCENT"
        )
        rssi = self._rssi(k, d3)
        ruido_snr = self.g_snr[k]
        snr = min(C.SNR_MAX_DB - abs(ruido_snr), rssi - C.SNR_PISO_DBM + 0.5 * ruido_snr)

        return {
            "seq": self.seq_nav(k),
            "t_ms": C.ARRANQUE_COHETE_MS + k * C.TDMA_CICLO_MS,
            "utc_ms": utc,
            "rx_utc_ms": rx,
            "relay_utc_ms": relay,
            "fase": fase,
            "fase_cod": C.FASES[fase],
            "pos": pos,
            "vel": vel,
            "acc_g": {
                "x": r(ax, C.DECIMALES_G),
                "y": r(ay, C.DECIMALES_G),
                "z": r(az, C.DECIMALES_G),
            },
            "q": {
                "w": r(q[0], C.DECIMALES_Q),
                "x": r(q[1], C.DECIMALES_Q),
                "y": r(q[2], C.DECIMALES_Q),
                "z": r(q[3], C.DECIMALES_Q),
            },
            "flags": {
                "gnss_fix": gnss_fix,
                "ekf_ok": ekf_ok,
                "falla_activa": False,
                "eyeccion": self.vuelo and ts >= self.t.eyeccion,
                "apogeo": self.vuelo and ts >= self.t.apogeo,
                "log_activo": True,
                "reanudado": False,
            },
            "act": {
                "pi_pulso": self.m.tiene_pi and ta >= C.PI_ENCENDIDA_S,
                "cam_ok": self.m.tiene_pi and self.vuelo and ts >= self.t.lift,
                "buzzer": fase == "LANDED",
                "wifi_ap": False,
                "backfill": self._backfill_activo(k),
            },
            "bat_pct": self._bat_pct(k),
            "secundario": self._secundario(k, fase),
            "calc": self._calc(fase, s, gnss_fix, dh),
            "enlace": {
                "rssi_dbm": int(round(rssi)),
                "snr_db": r(snr, 1),
                "perdidos_pct_10s": r(self.perdidos_pct(k), 1),
            },
            "alarmas": {"descenso_rapido": bool(activo_alarma)},
            "lkp": lkp,
        }

    def _calc(self, fase: str, s: dict, gnss_fix: bool, dh: float) -> dict:
        vacio = {
            "dist_horiz_m": None,
            "azimut_deg": None,
            "elevacion_deg": None,
            "elipse": None,
            "t_a_apogeo_s": None,
            "t_restante_s": None,
            "siguiente_fase": _SIGUIENTE_FASE.get(fase),
            "t_siguiente_fase_s": None,
        }
        if not gnss_fix:
            return vacio
        calc = dict(vacio)
        de, dn = s["e"] - C.ESTACION_ESTE_M, s["n"] - C.ESTACION_NORTE_M
        dz = (s["alt"] + C.SITIO_ALT_MSL_M) - C.ESTACION_ALT_MSL_M
        calc["dist_horiz_m"] = r(dh, C.DECIMALES_M)
        calc["azimut_deg"] = r(geo.azimut_grados(de, dn), C.DECIMALES_GRADOS)
        calc["elevacion_deg"] = r(geo.elevacion_grados(dh, dz), C.DECIMALES_GRADOS)
        if fase in ("BOOST", "COAST"):
            t_apo = max(s["vz"], 0.0) / C.GRAVEDAD_ESTANDAR_MS2
            calc["t_a_apogeo_s"] = r(t_apo, 1)
            if fase == "COAST":
                calc["t_siguiente_fase_s"] = r(t_apo, 1)
        elif fase == "DESCENT":
            t_rest = s["alt"] / max(abs(s["vz"]), 0.1)
            calc["t_restante_s"] = r(t_rest, 1)
            calc["t_siguiente_fase_s"] = r(t_rest, 1)
            deriva_e, deriva_n = s["ve"] * t_rest, s["vn"] * t_rest
            lat, lon = geo.enu_a_latlon(
                C.SITIO_LAT, C.SITIO_LON, s["e"] + deriva_e, s["n"] + deriva_n
            )
            mayor = C.ELIPSE_MIN_M + C.ELIPSE_FRAC_DERIVA * math.hypot(deriva_e, deriva_n)
            calc["elipse"] = {
                "lat": r(lat, C.DECIMALES_LATLON),
                "lon": r(lon, C.DECIMALES_LATLON),
                "semieje_mayor_m": r(mayor, C.DECIMALES_M),
                "semieje_menor_m": r(mayor * C.ELIPSE_RELACION_EJES, C.DECIMALES_M),
                "rumbo_deg": r(geo.azimut_grados(s["ve"], s["vn"]), C.DECIMALES_GRADOS),
            }
        return calc

    # ----------------------------------------------------------------- salud
    def salud(self, k: int) -> dict:
        ts, ta = self.t_sim(k), self.t_arch(k)
        fase = self.fase_en(k)
        utc = C.UTC_INICIO_MS + k * C.TDMA_CICLO_MS
        fix, sv, hacc = self._gnss(k)
        ekf_ok = self.vuelo and fase != "PREFLIGHT"
        bat_pct = self._bat_pct(k)
        sd_libre = C.SD_LIBRE_INICIAL_MB - C.SD_MB_S_TIERRA * ta
        if self.vuelo:
            vuelo_s = min(max(ts, 0.0), self.t.suelo)
            sd_libre -= (C.SD_MB_S_VUELO - C.SD_MB_S_TIERRA) * vuelo_s
        s = self.p.en(ts)
        _dh, d3 = self._distancias(s["e"], s["n"], s["alt"])
        sec = self._secundario(k, fase)
        temp_esp = min(C.TEMP_ESP_MAX_C, C.TEMP_ESP_INICIAL_C + C.TEMP_ESP_SUBE_C_MIN * ta / 60.0)
        armado = self.vuelo and ta >= C.ARM_S
        condiciones_ok = {
            "gnss": fix == 3 and hacc is not None and hacc < C.GO_HACC_MAX_M and sv >= C.GO_SV_MIN,
            "hora": ta >= C.HORA_VALIDA_S,
            "sensores": True,
            "quietud": True,
            "sd": sd_libre >= C.SD_MIN_LIBRE_MB,
            "bateria": bat_pct >= C.BAT_MIN_ARM_PCT,
            "pi": (not self.m.tiene_pi)
            or (sec is not None and sec["codigo"] in (C.PI_READY, C.PI_ARMED, C.PI_ASCENT, C.PI_RECORDING)),
        }
        condiciones = [
            {"id": cid, "nombre": nombre, "ok": bool(condiciones_ok[cid])}
            for cid, nombre in _CONDICIONES
            if cid != "pi" or self.m.tiene_pi
        ]
        return {
            "t_ms": C.ARRANQUE_COHETE_MS + k * C.TDMA_CICLO_MS,
            "utc_ms": utc,
            "mission_id": self.mission_id if armado else None,
            "boot_count": 1,
            "gnss": {"fix": fix, "sv": sv, "hacc_m": r(hacc, C.DECIMALES_M)},
            "bat_mv": int(round(C.BAT_MV_BASE + C.BAT_MV_POR_PCT * bat_pct)),
            "temp_esp_c": int(round(temp_esp)),
            "temp_pi_c": int(round(temp_esp + C.TEMP_PI_SOBRE_ESP_C)) if self.m.tiene_pi else None,
            "fallas": [],
            "fallas_bits": 0,
            "calib": {
                "giro": ta >= 1.0,
                "mag": True,
                "baro": True,
                "origen": ekf_ok,
                "actitud": ta >= C.HORA_VALIDA_S,
            },
            "nav_innov_m": r(0.4 + 0.8 * self.u_innov[k], 2) if ekf_ok else None,
            "apogeo_m": r(self.alt_max_hasta(ts), C.DECIMALES_M) if self.vuelo else 0.0,
            "alt_origen_msl_m": C.SITIO_ALT_MSL_M,
            "sd_libre_mb": int(sd_libre),
            "rssi_tierra_dbm": int(round(self._rssi(k, d3) + C.RSSI_UPLINK_DESFASE_DB)),
            "ultimo_cmd_seq": 1 if armado else 0,
            "fw_version": self.m.fw_version,
            "go_nogo": {"listo": all(c["ok"] for c in condiciones), "condiciones": condiciones},
        }

    # ------------------------------------------------------------- estación
    def estacion(self, k: int) -> dict:
        utc = C.UTC_INICIO_MS + k * C.TDMA_CICLO_MS + C.LATIDO_DESFASE_MS
        lat, lon = self._pos_estacion()
        ult = self.ultimo_entregado[k]
        hace = None
        if ult is not None:
            rx_ult = C.UTC_INICIO_MS + ult * C.TDMA_CICLO_MS + C.RX_RETRASO_MS
            hace = utc - rx_ult
        return {
            "utc_ms": utc,
            "pos": {
                "lat": r(lat, C.DECIMALES_LATLON),
                "lon": r(lon, C.DECIMALES_LATLON),
                "alt_msl_m": C.ESTACION_ALT_MSL_M,
            },
            "gnss_ok": self.t_arch(k) >= C.HORA_VALIDA_S,
            "ultimo_paquete_hace_ms": hace,
        }

    # ----------------------------------------------------------------- meta
    def meta(self, armado: bool) -> dict:
        return {
            "contrato_version": C.CONTRATO_VERSION,
            "mision": self.m.nombre,
            "nodo": self.m.nodo,
            "modo": self.m.modo,
            "mission_id": self.mission_id if armado else None,
            "proto_version": self.m.proto_version,
            "sitio": {"lat": C.SITIO_LAT, "lon": C.SITIO_LON, "alt_msl_m": C.SITIO_ALT_MSL_M},
        }

    # --------------------------------------------------------------- eventos
    def eventos(self) -> list[tuple[int, str, dict]]:
        """(ms del archivo, tipo, extras) de todos los hechos puntuales, en orden."""
        if not self.vuelo:
            return []
        t = self.t
        L = t.lanz_ms

        def ms(ts: float) -> int:
            return L + round(ts * 1000)

        out: list[tuple[int, str, dict]] = []
        out.append((round(C.ARM_S * 1000), "fase", {"fase": "ARMED"}))
        out.append((ms(t.lift), "despegue", {}))
        out.append((ms(t.lift), "fase", {"fase": "BOOST"}))
        if self.m.tiene_pi:
            out.append((ms(t.lift), "camaras", {"activa": True}))
        out.append((ms(t.burnout), "fin_combustion", {}))
        out.append((ms(t.burnout), "fase", {"fase": "COAST"}))
        out.append((ms(t.eyeccion), "eyeccion", {}))
        out.append((ms(t.apogeo), "apogeo", {"valor": r(self.p.en(t.apogeo)["alt"], C.DECIMALES_M)}))
        out.append((ms(t.apogeo), "fase", {"fase": "APOGEE"}))
        out.append((ms(t.descenso), "fase", {"fase": "DESCENT"}))
        if t.alarma is not None:
            vz = self.p.en(t.alarma)["vz"]
            out.append((ms(t.alarma), "alarma_descenso", {"valor": r(vz, C.DECIMALES_MS), "activa": True}))
            out.append((ms(t.suelo), "alarma_descenso", {"valor": 0.0, "activa": False}))
        out.append((ms(t.suelo), "aterrizaje", {}))
        out.append((ms(t.suelo), "fase", {"fase": "LANDED"}))
        if t.corte is not None:  # sin señal: nada de lo que pasa después llega
            out = [e for e in out if e[0] < ms(t.corte)]
        return out

    def _mensaje_evento(self, ms_arch: int, tipo: str, extras: dict) -> dict:
        t0 = self.t.lanz_ms + round(self.t.lift * 1000)
        t_mas = None if ms_arch < t0 else r((ms_arch - t0) / 1000.0, C.DECIMALES_S)
        return {
            "tipo": tipo,
            "t_ms": C.ARRANQUE_COHETE_MS + ms_arch,
            "utc_ms": C.UTC_INICIO_MS + ms_arch,
            "t_mas_s": t_mas,
            "valor": extras.get("valor"),
            "fase": extras.get("fase"),
            "activa": extras.get("activa"),
        }

    # -------------------------------------------------------------- backfill
    def _mensaje_backfill(self, k: int) -> dict:
        t = self.t
        paso = (k - t.backfill_k0) // 10
        recibidos = min(t.backfill_n, C.BACKFILL_REG_POR_S * paso)
        completo = recibidos >= t.backfill_n
        return {
            "activo": not completo,
            "recibidos": recibidos,
            "esperados": t.backfill_n,
            "progreso": r(recibidos / t.backfill_n, 2),
            "completo": completo,
        }

    # ----------------------------------------------------------------- todo
    def generar(self) -> list[dict]:
        lineas: list[tuple[int, int, str, dict]] = []

        def agregar(t_rel: int, tipo: str, datos: dict) -> None:
            lineas.append((t_rel, _ORDEN[tipo], tipo, datos))

        retraso = C.RX_RETRASO_MS + C.RELAY_RETRASO_MS
        agregar(0, "meta", self.meta(armado=False))
        if self.vuelo:
            agregar(round(C.ARM_S * 1000) + retraso, "meta", self.meta(armado=True))
        for ms_arch, tipo, extras in self.eventos():
            agregar(ms_arch + retraso, "evento", self._mensaje_evento(ms_arch, tipo, extras))

        t = self.t
        for k in range(self.n_ciclos):
            c = k % C.STATUS_CADA_CICLOS
            t_rel = k * C.TDMA_CICLO_MS + retraso
            if self.entregado[k]:
                if c == 0:
                    agregar(t_rel, "salud", self.salud(k))
                elif self.en_vuelo_rapido(k) or c == C.FASE_TIERRA_CICLO:
                    agregar(t_rel, "estado", self.estado(k))
            if c == C.LATIDO_CICLO:
                latido = C.UTC_INICIO_MS + k * C.TDMA_CICLO_MS + C.LATIDO_DESFASE_MS
                agregar(latido + C.RELAY_RETRASO_MS - C.UTC_INICIO_MS, "estacion", self.estacion(k))
            if t.backfill_k0 is not None and t.backfill_k0 <= k <= t.backfill_kf and (k - t.backfill_k0) % 10 == 0:
                agregar(t_rel, "backfill", self._mensaje_backfill(k))

        if self.escenario == "relay_caido":
            ini = t.lanz_ms + round(C.RELAY_CAIDO_INICIO_S * 1000)
            fin = ini + round(C.RELAY_CAIDO_DURACION_S * 1000)
            lineas = [x for x in lineas if not (ini <= x[0] < fin)]
            agregar(fin, "meta", self.meta(armado=True))  # al reconectar, el relay manda `meta`

        lineas.sort(key=lambda x: (x[0], x[1]))
        return [{"t_rel_ms": t_rel, "evento": tipo, "datos": datos} for t_rel, _o, tipo, datos in lineas]


def generar_lineas(mision: str, escenario: str) -> list[dict]:
    """Los mensajes del escenario, en orden, listos para serializar."""
    return Generador(mision, escenario).generar()
