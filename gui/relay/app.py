"""El relay publico (T-640): FastAPI. Contrato: docs/08_gui/04_arquitectura_web.md §4 y §5 (D-060).

  POST /api/v1/ingesta               SOLO para el reenviador (token); la unica ruta de escritura
  GET  /api/v1/{mision}/snapshot     el ultimo estado, la trayectoria decimada y los eventos
  GET  /api/v1/{mision}/stream       SSE
  GET  /api/v1/salud                 {"estado": "ok", ...}

Un solo proceso de uvicorn y un solo hilo de eventos: el estado esta en memoria y no hay candados. Para correrlo:
  uvicorn app:crear_app --factory --port 8787     (o `python servidor.py`)
"""
from __future__ import annotations

import hmac
import json
import logging
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse
from starlette.middleware.cors import CORSMiddleware

import constantes as K
from almacen import Almacen
from config import Config, desde_entorno
from difusion import Difusor, Reserva
from estado_mision import EstadoMision
from validacion import Validador

log = logging.getLogger("relay")

PING = b": ping\n\n"


def _json(codigo: int, cuerpo: object, cabeceras: Optional[dict[str, str]] = None) -> Response:
    return Response(json.dumps(cuerpo, ensure_ascii=False).encode("utf-8"), status_code=codigo,
                    media_type="application/json", headers=cabeceras)


class Relay:
    """Todo el estado del proceso: una `EstadoMision`, un `Almacen` y un `Difusor` por mision."""
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.validador = Validador(cfg.esquema)
        self.token = cfg.token.encode("utf-8")
        self.misiones = {m: EstadoMision(m, tasa_tierra_hz=cfg.tasa_tierra_hz, reanudar_max=cfg.reanudar_max,
                                         serie_max_puntos=cfg.serie_max_puntos) for m in K.MISIONES}
        self.almacenes = {m: Almacen(cfg.datos_dir / f"{m}.jsonl", fsync=cfg.fsync) for m in K.MISIONES}
        self.difusores = {m: Difusor(cfg.cola_cliente_max) for m in K.MISIONES}
        self.por_ip: dict[str, int] = {}
        self.lotes: OrderedDict[str, tuple[int, int]] = OrderedDict()
        self.contadores = {"lotes": 0, "lotes_repetidos": 0, "aceptados": 0, "invalidos": 0, "rechazos_401": 0,
                           "rechazos_413": 0, "rechazos_forma": 0, "rechazos_429": 0, "errores_disco": 0}
        self._reconstruir()

    # ---- reinicio (04 §4.5) ----
    def _reconstruir(self) -> None:
        """Vuelve a aplicar cada JSONL: el estado, la `serie`, los eventos y `seq_relay` quedan como antes del reinicio."""
        for m in K.MISIONES:
            n = 0
            for seq, tipo, datos in self.almacenes[m].leer():
                try:
                    self.misiones[m].aplicar(tipo, datos, 0, seq_guardado=seq, reproduciendo=True)
                    n += 1
                except Exception:      # una linea mala no debe impedir arrancar
                    log.exception("%s: linea que no se pudo reaplicar; se salta", m)
            if n:
                log.info("%s: reconstruida desde el JSONL con %d mensajes, seq_relay=%d", m, n, self.misiones[m].seq)

    # ---- ingesta (04 §4.1) ----
    def autorizado(self, request: Request) -> bool:
        cab = request.headers.get("authorization", "")
        esquema, _, valor = cab.partition(" ")
        if esquema.lower() != "bearer" or not valor:
            return False
        return hmac.compare_digest(valor.strip().encode("utf-8"), self.token)

    def procesar_lote(self, mensajes: list) -> tuple[int, int]:
        """Valida y aplica cada mensaje; uno invalido se descarta y no tira el lote. Devuelve (aceptados, descartados)."""
        ahora = self.cfg.reloj_ms()
        lineas: dict[str, list[bytes]] = {m: [] for m in K.MISIONES}
        aceptados = descartados = 0
        for msg in mensajes:
            error = self.validador.error_mensaje(msg)
            if error is not None:
                descartados += 1
                self.contadores["invalidos"] += 1
                log.debug("mensaje descartado: %s", error)
                continue
            aceptados += 1
            m = msg["mision"]
            res = self.misiones[m].aplicar(msg["tipo"], msg["datos"], ahora)
            if res.emision is not None:
                self.difusores[m].publicar(res.emision)
            if res.persistir:
                lineas[m].append(Almacen.linea(res.emision.seq if res.emision else None, msg["tipo"], res.datos))
        for m, ls in lineas.items():
            self.almacenes[m].agregar(ls)       # antes de responder; si falla, sube y el lote responde 500
        return aceptados, descartados

    def recordar_lote(self, lote_id: Optional[str], conteo: tuple[int, int]) -> None:
        if not lote_id:
            return
        self.lotes[lote_id] = conteo
        while len(self.lotes) > self.cfg.lotes_recordados:
            self.lotes.popitem(last=False)

    def cerrar(self) -> None:
        for a in self.almacenes.values():
            a.cerrar()


def crear_app(cfg: Optional[Config] = None) -> FastAPI:
    cfg = cfg or desde_entorno()          # sin WEB_INGESTA_TOKEN lanza ConfigError: el relay no arranca
    relay = Relay(cfg)

    @asynccontextmanager
    async def vida(_app: FastAPI):
        yield
        relay.cerrar()

    # Sin /docs, /redoc ni /openapi.json (04 §4.2).
    app = FastAPI(title="relay", docs_url=None, redoc_url=None, openapi_url=None, lifespan=vida)
    app.state.relay = relay
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(cfg.origenes), allow_methods=["GET", "OPTIONS"],
        allow_headers=["Last-Event-ID", "Cache-Control", "Accept"], expose_headers=["Retry-After", "Age"],
    )

    @app.post("/api/v1/ingesta")
    async def ingesta(request: Request) -> Response:
        # 1. Token, ANTES de leer el cuerpo.
        if not relay.autorizado(request):
            relay.contadores["rechazos_401"] += 1
            return _json(401, {"error": "token ausente o invalido"}, {"WWW-Authenticate": "Bearer"})
        # 2. Tamano: por la cabecera si viene, y mientras se lee.
        tope = cfg.cuerpo_max_kb * 1024
        try:
            declarado = int(request.headers.get("content-length", "0"))
        except ValueError:
            declarado = 0
        if declarado > tope:
            relay.contadores["rechazos_413"] += 1
            return _json(413, {"error": "cuerpo demasiado grande"})
        partes: list[bytes] = []
        leido = 0
        async for trozo in request.stream():
            leido += len(trozo)
            if leido > tope:
                relay.contadores["rechazos_413"] += 1
                return _json(413, {"error": "cuerpo demasiado grande"})
            partes.append(trozo)
        # 3. Lote ya procesado: 2xx sin reprocesar.
        lote_id = request.headers.get("x-lote-id", "")
        if not lote_id or len(lote_id) > K.RELAY_LOTE_ID_MAX_CHARS:
            lote_id = ""
        if lote_id and lote_id in relay.lotes:
            relay.contadores["lotes_repetidos"] += 1
            a, d = relay.lotes[lote_id]
            return _json(200, {"aceptados": a, "descartados": d})
        # 4. Forma: JSON legible (400) con la forma {"mensajes": [...]} (422).
        try:
            cuerpo = json.loads(b"".join(partes), parse_constant=_sin_constantes)
        except (ValueError, RecursionError):
            relay.contadores["rechazos_forma"] += 1
            return _json(400, {"error": "JSON ilegible"})
        if not isinstance(cuerpo, dict) or not isinstance(cuerpo.get("mensajes"), list):
            relay.contadores["rechazos_forma"] += 1
            return _json(422, {"error": 'se esperaba {"mensajes": [...]}'})
        # 5. Aplicar.
        try:
            conteo = relay.procesar_lote(cuerpo["mensajes"])
        except OSError:
            relay.contadores["errores_disco"] += 1
            log.exception("no se pudo escribir el JSONL")
            return _json(500, {"error": "no se pudo guardar"})
        relay.contadores["lotes"] += 1
        relay.contadores["aceptados"] += conteo[0]
        relay.recordar_lote(lote_id, conteo)
        return _json(200, {"aceptados": conteo[0], "descartados": conteo[1]})

    def _mision(mision: str) -> Optional[str]:
        return mision if mision in relay.misiones else None

    @app.get("/api/v1/salud")
    async def salud() -> Response:
        return _json(200, {
            "estado": "ok", "contrato_version": "web-1",
            "misiones": {m: {"seq_relay": e.seq, "mission_id": e.meta_actual()["mission_id"],
                             "clientes_sse": len(relay.difusores[m].clientes), **e.contadores}
                         for m, e in relay.misiones.items()},
            "ingesta": relay.contadores,
        }, {"Cache-Control": "no-store"})

    @app.get("/api/v1/{mision}/snapshot")
    async def snapshot(mision: str) -> Response:
        if _mision(mision) is None:
            return _json(404, {"error": "mision desconocida"})
        return Response(relay.misiones[mision].snapshot_bytes(), media_type="application/json",
                        headers={"Cache-Control": "no-store"})

    @app.get("/api/v1/{mision}/stream")
    async def stream(mision: str, request: Request) -> Response:
        if _mision(mision) is None:
            return _json(404, {"error": "mision desconocida"})
        ip = request.client.host if request.client else "?"
        if relay.por_ip.get(ip, 0) >= cfg.sse_max_por_ip:
            relay.contadores["rechazos_429"] += 1
            return _json(429, {"error": "demasiadas conexiones desde esta IP"}, {"Retry-After": str(cfg.reintento_s)})
        reserva = Reserva(relay.por_ip, ip)
        estado = relay.misiones[mision]
        visto = request.headers.get("last-event-id", "").strip()

        def armar() -> list[bytes]:
            # El `meta` de bienvenida va sin `id`; despues, lo emitido desde Last-Event-ID (acotado).
            return [estado.trama_bienvenida(), *(estado.reanudar_desde(int(visto)) if visto.isdigit() else [])]

        return EventSourceResponse(
            relay.difusores[mision].flujo(armar, reserva),
            ping=cfg.latido_s, ping_message_factory=lambda: PING,       # type: ignore[arg-type,return-value]
            headers={"Cache-Control": "no-cache, no-transform"},
        )

    return app


def _sin_constantes(nombre: str):
    """`NaN` e `Infinity` no son JSON: Python los acepta por defecto y no deben pasar."""
    raise ValueError(nombre)
