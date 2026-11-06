"""Ayudas de las pruebas del relay: mensajes validos de `web-1`, un cliente HTTP y un uvicorn real en un hilo.

Los mensajes salen de plantillas de `gui/web/dev/datos/demeter_nominal.jsonl` (versionado, generado por T-612 y validado
contra `esquema.json`): asi nunca se escribe a mano un `estado` de 40 campos.
"""
from __future__ import annotations

import copy
import http.client
import json
import queue
import socket
import threading
import time
from pathlib import Path

import uvicorn

from app import crear_app
from config import Config

TOKEN = "token-de-prueba-0123456789"
RAIZ = Path(__file__).resolve().parents[2]
DATOS_DEV = RAIZ / "web" / "dev" / "datos"


def _plantillas() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for linea in (DATOS_DEV / "demeter_nominal.jsonl").read_text(encoding="utf-8").splitlines():
        o = json.loads(linea)
        out.setdefault(o["evento"], o["datos"])
    return out


_PLANTILLAS = _plantillas()
FASES = ("BOOT", "PREFLIGHT", "ARMED", "BOOST", "COAST", "APOGEE", "FREE_FALL", "DESCENT", "LANDED", "ERROR")


def msg(tipo: str, datos: dict, mision: str = "demeter") -> dict:
    return {"tipo": tipo, "mision": mision, "datos": datos}


def meta(mision: str = "demeter", mission_id=None, modo: str = "vivo") -> dict:
    d = copy.deepcopy(_PLANTILLAS["meta"])
    d.update(mision=mision, nodo=1 if mision == "demeter" else 2, mission_id=mission_id, modo=modo)
    return msg("meta", d, mision)


def estado(rx: int, t_ms: int | None = None, fase: str = "PREFLIGHT", mision: str = "demeter", **extra) -> dict:
    d = copy.deepcopy(next(m for m in _estados_dev() if m["fase"] == "PREFLIGHT"))
    d.update(rx_utc_ms=rx, t_ms=rx if t_ms is None else t_ms, relay_utc_ms=None, fase=fase, fase_cod=FASES.index(fase))
    d["seq"] = d["t_ms"] // 40
    d.update(extra)
    return msg("estado", d, mision)


_ESTADOS: list[dict] = []


def _estados_dev() -> list[dict]:
    if not _ESTADOS:
        for linea in (DATOS_DEV / "demeter_nominal.jsonl").read_text(encoding="utf-8").splitlines():
            o = json.loads(linea)
            if o["evento"] == "estado":
                _ESTADOS.append(o["datos"])
    return _ESTADOS


def salud(t_ms: int, mision: str = "demeter") -> dict:
    d = copy.deepcopy(_PLANTILLAS["salud"])
    d["t_ms"] = t_ms
    return msg("salud", d, mision)


def estacion(utc_ms: int, mision: str = "demeter") -> dict:
    d = copy.deepcopy(_PLANTILLAS["estacion"])
    d["utc_ms"] = utc_ms
    return msg("estacion", d, mision)


def evento(tipo: str, t_ms: int, mision: str = "demeter", fase=None, activa=None, valor=None) -> dict:
    return msg("evento", {"tipo": tipo, "t_ms": t_ms, "utc_ms": None, "t_mas_s": None, "valor": valor, "fase": fase,
                          "activa": activa}, mision)


def backfill(recibidos: int = 10, mision: str = "demeter") -> dict:
    return msg("backfill", {"activo": True, "recibidos": recibidos, "esperados": 100, "progreso": recibidos / 100,
                            "completo": False}, mision)


def cfg_prueba(tmp_path: Path, **kw) -> Config:
    kw.setdefault("fsync", False)
    return Config(token=TOKEN, datos_dir=tmp_path / "datos", **kw)


def auth(token: str = TOKEN) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------------------------------------------------
# Un uvicorn REAL en un hilo (TestClient se queda colgado con los streams).
# ---------------------------------------------------------------------------------------------------------------------
class ServidorReal:
    def __init__(self, cfg: Config):
        self.app = crear_app(cfg)
        self.relay = self.app.state.relay
        conf = uvicorn.Config(self.app, host="127.0.0.1", port=0, log_level="warning", workers=1,
                              timeout_graceful_shutdown=2, lifespan="on")
        self.servidor = uvicorn.Server(conf)
        self.hilo = threading.Thread(target=self.servidor.run, daemon=True)

    def __enter__(self) -> "ServidorReal":
        self.hilo.start()
        t0 = time.time()
        while not self.servidor.started:
            if time.time() - t0 > 15:
                raise RuntimeError("uvicorn no arranco")
            time.sleep(0.02)
        self.puerto = self.servidor.servers[0].sockets[0].getsockname()[1]
        return self

    def __exit__(self, *a) -> None:
        self.servidor.should_exit = True
        self.hilo.join(10)

    def conexion(self, timeout: float = 10) -> http.client.HTTPConnection:
        return http.client.HTTPConnection("127.0.0.1", self.puerto, timeout=timeout)

    def post(self, mensajes: list, lote: str | None = None, token: str | None = TOKEN) -> tuple[int, dict]:
        cab = {"Content-Type": "application/json"}
        if token is not None:
            cab["Authorization"] = f"Bearer {token}"
        if lote:
            cab["X-Lote-Id"] = lote
        c = self.conexion()
        try:
            c.request("POST", "/api/v1/ingesta", body=json.dumps({"mensajes": mensajes}).encode("utf-8"), headers=cab)
            r = c.getresponse()
            return r.status, json.loads(r.read() or b"{}")
        finally:
            c.close()

    def get(self, ruta: str, cabeceras: dict | None = None) -> tuple[int, dict, bytes]:
        c = self.conexion()
        try:
            c.request("GET", ruta, headers=cabeceras or {})
            r = c.getresponse()
            return r.status, {k.lower(): v for k, v in r.getheaders()}, r.read()
        finally:
            c.close()

    def abrir_stream(self, mision: str = "demeter", last_id: int | None = None, origen: str | None = None,
                     timeout: float = 5) -> "Stream":
        cab = {"Accept": "text/event-stream"}
        if last_id is not None:
            cab["Last-Event-ID"] = str(last_id)
        if origen:
            cab["Origin"] = origen
        c = self.conexion(timeout)
        c.request("GET", f"/api/v1/{mision}/stream", headers=cab)
        return Stream(c, c.getresponse())


class Stream:
    """Lee un SSE en un hilo y deja los eventos en una cola. `leer(n, segundos)` devuelve hasta `n` eventos
    [(id, tipo, datos)]; los comentarios (`: ping`) quedan en `comentarios`. Un hilo evita tocar el timeout del socket."""
    def __init__(self, conexion: http.client.HTTPConnection, respuesta: http.client.HTTPResponse):
        self.conexion, self.r = conexion, respuesta
        self.status = respuesta.status
        self.cabeceras = {k.lower(): v for k, v in respuesta.getheaders()}
        self.comentarios: list[str] = []
        self.cerrada = threading.Event()
        self._cola: queue.Queue = queue.Queue()
        self._hilo = threading.Thread(target=self._leer, daemon=True)
        if self.status == 200:
            self._hilo.start()

    def _leer(self) -> None:
        buf: list[str] = []
        try:
            while True:
                linea = self.r.fp.readline()
                if not linea:
                    break
                linea = linea.decode("utf-8").rstrip("\r\n")
                if linea:
                    buf.append(linea)
                    continue
                campos = {}
                for l in buf:
                    if l.startswith(":"):
                        self.comentarios.append(l)
                    else:
                        k, _, v = l.partition(": ")
                        campos[k] = v
                buf = []
                if "event" in campos:
                    self._cola.put((campos.get("id"), campos["event"], json.loads(campos["data"])))
        except (OSError, ValueError, AttributeError):
            pass
        finally:
            self.cerrada.set()

    def leer(self, n: int = 1, segundos: float = 5) -> list[tuple[str | None, str, dict]]:
        """Hasta `n` eventos o `segundos`."""
        salida: list[tuple[str | None, str, dict]] = []
        limite = time.time() + segundos
        while len(salida) < n:
            restante = limite - time.time()
            if restante <= 0:
                break
            try:
                salida.append(self._cola.get(timeout=min(restante, 0.2)))
            except queue.Empty:
                if self.cerrada.is_set() and self._cola.empty():
                    break
        return salida

    def cerrar(self) -> None:
        """`shutdown` primero: `close()` espera el candado del lector, que esta bloqueado en `readline`."""
        try:
            if self.conexion.sock is not None:
                self.conexion.sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        self._hilo.join(2) if self._hilo.is_alive() else None
        try:
            self.conexion.close()
        except OSError:
            pass
