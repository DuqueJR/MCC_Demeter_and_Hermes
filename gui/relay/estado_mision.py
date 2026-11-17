"""El estado de UNA mision en el relay y las reglas de 04 §4.3 (tasa), §4.4 (atrasados y repetidos) y §4.5 (misiones).

Es logica pura y sincrona, sin red ni disco: `aplicar()` recibe un mensaje ya validado y dice que hacer con el.
El relay corre con un solo proceso y un solo hilo de eventos, asi que no hay candados.

Resumen de las reglas (la fuente es docs/08_gui/04_arquitectura_web.md):
  * El orden de los `estado` se decide con `rx_utc_ms` (y `t_ms` para desempatar), NO con `t_ms` (D-060).
  * Un mensaje atrasado nunca sale por el stream. Un `estado` atrasado solo entra a la `serie`, en su lugar.
  * `seq_relay` (el `id` del SSE) crece por mision, sin repetirse, tambien tras un reinicio.
"""
from __future__ import annotations

import json
import math
from bisect import bisect_left, bisect_right
from collections import deque
from dataclasses import dataclass
from typing import Any, Callable, Optional

import constantes as K


def serializar(obj: Any) -> str:
    """JSON compacto en UTF-8, una sola vez por mensaje. Sin NaN (no es JSON valido)."""
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def trama(tipo: str, data: str, seq: Optional[int] = None) -> bytes:
    """Un evento SSE ya codificado. El `meta` de bienvenida va sin `id` (D2)."""
    cab = "" if seq is None else f"id: {seq}\n"
    return f"{cab}event: {tipo}\ndata: {data}\n\n".encode("utf-8")


@dataclass(frozen=True)
class Emision:
    seq: int
    tipo: str
    trama: bytes


@dataclass
class Resultado:
    """Que paso con un mensaje. `persistir`: hay que agregarlo al JSONL. `emision`: sale por el stream."""
    accion: str                      # "emitido" | "guardado" | "descartado"
    motivo: str = ""
    persistir: bool = False
    emision: Optional[Emision] = None
    datos: Optional[dict] = None     # lo que se persiste (con `relay_utc_ms` ya puesto)


_DESCARTADO = Resultado("descartado")


def meta_defecto(mision: str) -> dict:
    """El `meta` antes de recibir datos (04 §4.2)."""
    return {"contrato_version": "web-1", "mision": mision, "nodo": K.NODO_DE[mision], "modo": "vivo",
            "mission_id": None, "proto_version": 4, "sitio": dict(K.SITIO)}


def clave_evento(e: dict) -> str:
    """La misma clave de `costura.ts`: tipo|t_ms|fase|activa."""
    activa = "" if e.get("activa") is None else ("true" if e["activa"] else "false")
    return f"{e['tipo']}|{e['t_ms']}|{e.get('fase') or ''}|{activa}"


def _redondear_js(x: float) -> int:
    """`Math.round` de JS: la mitad sube. (`round` de Python redondea la mitad al par.)"""
    return math.floor(x + 0.5)


def _repartir(lista: list[int], cuantos: int) -> list[int]:
    if cuantos <= 0:
        return []
    if cuantos >= len(lista):
        return lista
    if cuantos == 1:
        return [lista[-1]]
    paso = (len(lista) - 1) / (cuantos - 1)
    return [lista[_redondear_js(k * paso)] for k in range(cuantos)]


def decimar_indices(n: int, maximo: int, en_vuelo: Callable[[int], bool]) -> list[int]:
    """Porta `decimarIndices` de gui/web/dev/repetidor/snapshot.ts: a lo sumo `maximo` de `n` puntos, en orden.

    Todos los de vuelo se conservan (05 §3); lo que sobra de presupuesto se reparte parejo entre los de tierra,
    con el primero y el ultimo. Si solo el vuelo ya excede `maximo`, se decima parejo todo.
    """
    todos = list(range(n))
    if n <= maximo:
        return todos
    vuelo = [i for i in todos if en_vuelo(i)]
    if len(vuelo) >= maximo:
        return _repartir(todos, maximo)
    tierra = [i for i in todos if not en_vuelo(i)]
    return sorted(set(vuelo) | set(_repartir(tierra, maximo - len(vuelo))))


# Un punto de la trayectoria: (t_ms, lat, lon, alt_agl_m, vz_ms, acc_x_g, acc_y_g, acc_z_g, en_vuelo)
_T, _LAT, _LON, _ALT, _VZ, _AX, _AY, _AZ, _VUELO = range(9)


def _punto(e: dict) -> tuple:
    pos, vel, acc = e.get("pos"), e.get("vel"), e["acc_g"]
    return (e["t_ms"],
            pos["lat"] if pos else None, pos["lon"] if pos else None, pos["alt_agl_m"] if pos else None,
            vel["u_ms"] if vel else None, acc["x"], acc["y"], acc["z"],
            e["fase"] in K.FASES_EN_VUELO)


class EstadoMision:
    def __init__(self, mision: str, *, tasa_tierra_hz: float = K.WEB_TASA_TIERRA_HZ,
                 reanudar_max: int = K.RELAY_REANUDAR_MAX_MENSAJES,
                 serie_max_puntos: int = K.WEB_SERIE_MAX_PUNTOS):
        self.mision = mision
        self._periodo_ms = 1000.0 / tasa_tierra_hz
        self._serie_max = serie_max_puntos
        # lo que muestra el snapshot
        self.meta: Optional[dict] = None
        self.estado: Optional[dict] = None
        self.salud: Optional[dict] = None
        self.estacion: Optional[dict] = None
        self.backfill: Optional[dict] = None
        self.eventos: list[dict] = []
        self._t_eventos: list[int] = []            # t_ms de `eventos`, para insertar en orden
        self._claves_evento: set[str] = set()
        # la serie: puntos ordenados por (rx_utc_ms, t_ms)
        self._claves: list[tuple[int, int]] = []
        self._puntos: list[tuple] = []
        # misiones (04 §4.5)
        self.cerrados: set[int] = set()
        self._inicio_rx: Optional[int] = None      # un `estado` con rx_utc_ms <= esto es de la mision anterior
        # tasa hacia el publico (04 §4.3)
        self._fase_vista: Optional[str] = None
        self._proximo_rx: Optional[float] = None
        # stream
        self.seq = 0
        self.reanudar: deque[Emision] = deque(maxlen=reanudar_max)
        self._cache_snapshot: Optional[bytes] = None
        self.contadores = {"emitidos": 0, "guardados_atrasados": 0, "descartados_repetidos": 0,
                           "descartados_viejos": 0, "descartados_mision_anterior": 0, "estados_bajados_de_tasa": 0,
                           "misiones_nuevas": 0}

    # ---- lectura -----------------------------------------------------------------------------------------------
    def meta_actual(self) -> dict:
        return self.meta if self.meta is not None else meta_defecto(self.mision)

    def trama_bienvenida(self) -> bytes:
        return trama("meta", serializar(self.meta_actual()))

    def reanudar_desde(self, ultimo_id: int) -> list[bytes]:
        """Lo emitido despues de `ultimo_id`, como mucho lo que guarda `reanudar` (RELAY_REANUDAR_MAX_MENSAJES)."""
        return [e.trama for e in self.reanudar if e.seq > ultimo_id]

    def _t_despegue(self) -> Optional[int]:
        for e in self.eventos:
            if e["tipo"] == "despegue":
                return e["t_ms"]
        return None

    def serie(self) -> dict:
        """La `serie` en columnas, decimada. `t_mas_s` es `null` antes del despegue (el repetidor, igual)."""
        pts = self._puntos
        idx = decimar_indices(len(pts), self._serie_max, lambda i: pts[i][_VUELO])
        t0 = self._t_despegue()
        sel = [pts[i] for i in idx]
        return {
            "t_mas_s": [None if t0 is None else _redondear_js((p[_T] - t0) / 10) / 100 for p in sel],
            "lat": [p[_LAT] for p in sel], "lon": [p[_LON] for p in sel], "alt_agl_m": [p[_ALT] for p in sel],
            "vz_ms": [p[_VZ] for p in sel], "acc_x_g": [p[_AX] for p in sel], "acc_y_g": [p[_AY] for p in sel],
            "acc_z_g": [p[_AZ] for p in sel],
        }

    def snapshot(self) -> dict:
        return {"meta": self.meta_actual(), "estado": self.estado, "salud": self.salud, "estacion": self.estacion,
                "eventos": self.eventos, "serie": self.serie(), "backfill": self.backfill, "vuelo_completo_url": None}

    def snapshot_bytes(self) -> bytes:
        """El JSON del snapshot, sin cache de tiempo (D1): se regenera en la primera peticion tras un cambio."""
        if self._cache_snapshot is None:
            self._cache_snapshot = serializar(self.snapshot()).encode("utf-8")
        return self._cache_snapshot

    # ---- escritura ---------------------------------------------------------------------------------------------
    def _emitir(self, tipo: str, datos: dict, seq_guardado: Optional[int] = None) -> Resultado:
        self.seq = max(self.seq + 1, seq_guardado or 0)
        em = Emision(self.seq, tipo, trama(tipo, serializar(datos), self.seq))
        self.reanudar.append(em)
        self.contadores["emitidos"] += 1
        self._cache_snapshot = None
        return Resultado("emitido", persistir=True, emision=em, datos=datos)

    def _guardar(self, datos: dict) -> Resultado:
        self._cache_snapshot = None
        return Resultado("guardado", persistir=True, datos=datos)

    def _descartar(self, contador: str, motivo: str) -> Resultado:
        self.contadores[contador] += 1
        return Resultado("descartado", motivo=motivo)

    def aplicar(self, tipo: str, datos: dict, ahora_ms: int, seq_guardado: Optional[int] = None,
                reproduciendo: bool = False) -> Resultado:
        """Aplica un mensaje ya validado. `seq_guardado`/`reproduciendo`: al reconstruir desde el JSONL."""
        if tipo == "estado":
            return self._estado(datos, ahora_ms, seq_guardado, reproduciendo)
        if tipo == "salud":
            if self.salud is not None and datos["t_ms"] <= self.salud["t_ms"]:
                return self._descartar("descartados_viejos", "salud con t_ms menor o igual")
            self.salud = datos
            return self._emitir("salud", datos, seq_guardado=seq_guardado)
        if tipo == "estacion":
            if self.estacion is not None and datos["utc_ms"] <= self.estacion["utc_ms"]:
                return self._descartar("descartados_viejos", "estacion con utc_ms menor o igual")
            self.estacion = datos
            return self._emitir("estacion", datos, seq_guardado=seq_guardado)
        if tipo == "evento":
            return self._evento(datos, seq_guardado)
        if tipo == "backfill":
            self.backfill = datos
            return self._emitir("backfill", datos, seq_guardado=seq_guardado)
        if tipo == "meta":
            return self._meta(datos, seq_guardado)
        return _DESCARTADO

    # -- meta y misiones (04 §4.5) --
    def _meta(self, datos: dict, seq_guardado: Optional[int]) -> Resultado:
        actual = self.meta["mission_id"] if self.meta is not None else None
        nuevo = datos["mission_id"]
        if nuevo is not None and nuevo in self.cerrados:
            return self._descartar("descartados_viejos", "meta de una mision ya cerrada (atraso)")
        if actual is not None and nuevo is None:
            return self._descartar("descartados_viejos", "meta sin mission_id tras uno con valor (atraso)")
        if actual is not None and nuevo != actual:
            self._nueva_mision(actual)
        elif self.meta == datos:
            return self._descartar("descartados_repetidos", "meta igual al vigente")
        self.meta = datos
        return self._emitir("meta", datos, seq_guardado=seq_guardado)

    def _nueva_mision(self, cerrada: int) -> None:
        """Otro `mission_id`: se vacia lo acumulado y `seq_relay` sigue creciendo. Ver la nota en la bitacora de T-640."""
        self.cerrados.add(cerrada)
        if self._claves:
            self._inicio_rx = self._claves[-1][0]
        self.estado = self.salud = self.backfill = None     # `estacion` es la del sitio, no de la mision
        self.eventos, self._t_eventos, self._claves_evento = [], [], set()
        self._claves, self._puntos = [], []
        self._fase_vista = self._proximo_rx = None
        self.contadores["misiones_nuevas"] += 1

    # -- eventos --
    def _evento(self, datos: dict, seq_guardado: Optional[int]) -> Resultado:
        clave = clave_evento(datos)
        if clave in self._claves_evento:
            return self._descartar("descartados_repetidos", "evento repetido")
        self._claves_evento.add(clave)
        i = bisect_right(self._t_eventos, datos["t_ms"])         # ordenado por t_ms, estable
        self._t_eventos.insert(i, datos["t_ms"])
        self.eventos.insert(i, datos)
        return self._emitir("evento", datos, seq_guardado=seq_guardado)     # un evento nuevo siempre sale

    # -- estado: orden, serie y tasa --
    def _estado(self, e: dict, ahora_ms: int, seq_guardado: Optional[int], reproduciendo: bool) -> Resultado:
        rx = e["rx_utc_ms"]
        if self._inicio_rx is not None and rx <= self._inicio_rx:
            return self._descartar("descartados_mision_anterior", "estado anterior al inicio de la mision")
        clave = (rx, e["t_ms"])
        if self._claves and clave <= self._claves[-1]:
            i = bisect_left(self._claves, clave)
            if i < len(self._claves) and self._claves[i] == clave:
                return self._descartar("descartados_repetidos", "estado repetido")
            # Atrasado: entra a la `serie` en su lugar y no toca el ultimo `estado` ni el stream.
            self._claves.insert(i, clave)
            self._puntos.insert(i, _punto(e))
            self.contadores["guardados_atrasados"] += 1
            return self._guardar(e)
        # Nuevo: el de mayor (rx_utc_ms, t_ms). `relay_utc_ms` lo escribe siempre el relay.
        if not reproduciendo:
            e["relay_utc_ms"] = ahora_ms
        self._claves.append(clave)
        self._puntos.append(_punto(e))
        self.estado = e
        if self._pasa_la_tasa(e["fase"], rx):
            return self._emitir("estado", e, seq_guardado=seq_guardado)
        self.contadores["estados_bajados_de_tasa"] += 1
        self._cache_snapshot = None
        return Resultado("guardado", persistir=True, datos=e)

    def _pasa_la_tasa(self, fase: str, rx: int) -> bool:
        """04 §4.3: en tierra, `WEB_TASA_TIERRA_HZ` medido con `rx_utc_ms`; en vuelo, todo; el primero tras un cambio
        de fase siempre pasa. Una rejilla de un periodo, con tolerancia, para que el jitter no pierda cuadros."""
        cambio = fase != self._fase_vista
        self._fase_vista = fase
        if fase not in K.FASES_TIERRA:
            self._proximo_rx = None
            return True
        if cambio or self._proximo_rx is None:
            self._proximo_rx = rx + self._periodo_ms
            return True
        if rx < self._proximo_rx - self._periodo_ms * K.RELAY_TASA_TOLERANCIA:
            return False
        # La rejilla avanza un periodo; si ya se atraso mas de uno (un hueco), se vuelve a anclar en este.
        self._proximo_rx = self._proximo_rx + self._periodo_ms if rx < self._proximo_rx + self._periodo_ms \
            else rx + self._periodo_ms
        return True
