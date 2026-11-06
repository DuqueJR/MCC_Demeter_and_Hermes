#!/usr/bin/env python3
"""Alimenta el relay con un JSONL de `gui/web/dev/datos/`, como lo haria el reenviador: la prueba sin el back.

  WEB_INGESTA_TOKEN=... python alimentar.py ../web/dev/datos/demeter_nominal.jsonl ../web/dev/datos/hermes_nominal.jsonl

Cada linea es {"t_rel_ms", "evento", "datos"}; se sube en el instante `t_rel_ms` (dividido por --velocidad), en lotes
`POST /api/v1/ingesta` con `Authorization: Bearer` y `X-Lote-Id`. La mision sale del NOMBRE del archivo
(`demeter_nominal.jsonl` -> demeter). Con varios archivos corren a la vez, uno por hilo.

--vueltas N repite el vuelo N veces: en cada vuelta se corren t_ms, utc_ms y rx_utc_ms (para que el relay no tome la vuelta
por mensajes repetidos). Solo biblioteca estandar.
"""
from __future__ import annotations

import argparse
import http.client
import json
import os
import sys
import threading
import time
import urllib.parse
import uuid
from pathlib import Path

import constantes as K
from config import leer_env, AQUI

PAUSA_ENTRE_VUELTAS_MS = 5000          # (P) lo que se suma al ultimo t_rel_ms para correr el reloj en la vuelta siguiente


def mision_de(ruta: Path) -> str:
    m = ruta.name.split("_", 1)[0]
    if m not in K.MISIONES:
        raise SystemExit(f"{ruta.name}: no empieza con una mision conocida ({', '.join(K.MISIONES)})")
    return m


def leer(ruta: Path) -> list[dict]:
    return [json.loads(l) for l in ruta.read_text(encoding="utf-8").splitlines() if l.strip()]


def correr(datos: dict, delta_ms: int) -> dict:
    """Una copia con los relojes del cohete y de la estacion corridos `delta_ms` (vuelta 2, 3...)."""
    if delta_ms == 0:
        return datos
    d = dict(datos)
    for k in ("t_ms", "utc_ms", "rx_utc_ms"):
        if isinstance(d.get(k), int):
            d[k] += delta_ms
    return d


class Alimentador(threading.Thread):
    def __init__(self, ruta: Path, url: str, token: str, velocidad: float, vueltas: int, lote_max: int):
        super().__init__(daemon=True, name=ruta.name)
        self.ruta, self.mision = ruta, mision_de(ruta)
        u = urllib.parse.urlsplit(url)
        self.https, self.host, self.puerto = u.scheme == "https", u.hostname, u.port
        self.token, self.velocidad, self.vueltas, self.lote_max = token, velocidad, vueltas, lote_max
        self.inst = uuid.uuid4().hex[:8]
        self.n_lote = 0
        self.con: http.client.HTTPConnection | None = None
        self.enviados = self.descartados = self.lotes = self.reintentos = 0
        self.error: str | None = None          # el ultimo fallo transitorio de red
        self.fatal: str | None = None          # el relay rechazo (401, 400...): se aborta

    def post(self, mensajes: list[dict]) -> None:
        self.n_lote += 1
        lote_id = f"{self.inst}-{self.n_lote}"
        cuerpo = json.dumps({"mensajes": mensajes}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        cab = {"Content-Type": "application/json; charset=utf-8", "Authorization": "Bearer " + self.token,
               "X-Lote-Id": lote_id}
        espera = 0.5
        while True:
            try:
                if self.con is None:
                    clase = http.client.HTTPSConnection if self.https else http.client.HTTPConnection
                    self.con = clase(self.host, self.puerto, timeout=5)
                self.con.request("POST", "/api/v1/ingesta", body=cuerpo, headers=cab)
                r = self.con.getresponse()
                resp = r.read()
                if r.will_close:
                    self.con.close()
                    self.con = None
                if r.status == 200:
                    o = json.loads(resp)
                    self.enviados += o["aceptados"]
                    self.descartados += o["descartados"]
                    self.lotes += 1
                    return
                if r.status in (401, 403, 400, 413, 422):
                    raise SystemExit(f"{self.ruta.name}: el relay respondio {r.status}: {resp[:200]!r}")
                raise OSError(f"HTTP {r.status}")
            except (OSError, http.client.HTTPException) as e:
                if self.con is not None:
                    self.con.close()
                    self.con = None
                self.reintentos += 1
                self.error = f"{type(e).__name__}: {e}"
                time.sleep(espera)
                espera = min(8.0, espera * 2)

    def run(self) -> None:
        try:
            lineas = leer(self.ruta)
            periodo = lineas[-1]["t_rel_ms"] + PAUSA_ENTRE_VUELTAS_MS
            t0 = time.monotonic()
            for vuelta in range(self.vueltas):
                i = 0
                while i < len(lineas):
                    ahora = (time.monotonic() - t0) * 1000 * self.velocidad - vuelta * periodo
                    vencidas = []
                    while i < len(lineas) and lineas[i]["t_rel_ms"] <= ahora and len(vencidas) < self.lote_max:
                        l = lineas[i]
                        vencidas.append({"tipo": l["evento"], "mision": self.mision,
                                         "datos": correr(l["datos"], vuelta * periodo)})
                        i += 1
                    if vencidas:
                        self.post(vencidas)
                    elif i < len(lineas):
                        time.sleep(max(0.001, min(0.05, (lineas[i]["t_rel_ms"] - ahora) / 1000 / self.velocidad)))
                # fin de la vuelta: espera el hueco antes de la siguiente
                if vuelta + 1 < self.vueltas:
                    pausa = ((vuelta + 1) * periodo - (time.monotonic() - t0) * 1000 * self.velocidad) / 1000 / self.velocidad
                    if pausa > 0:
                        time.sleep(pausa)
        except SystemExit as e:
            self.fatal = str(e)


def main() -> int:
    ap = argparse.ArgumentParser(description="Sube un JSONL de gui/web/dev/datos/ a la ingesta del relay.")
    ap.add_argument("archivos", nargs="+", type=Path)
    ap.add_argument("--url", default=f"http://127.0.0.1:{K.RELAY_PUERTO_DEF}")
    ap.add_argument("--velocidad", type=float, default=1.0, help="2 = al doble de la velocidad real")
    ap.add_argument("--vueltas", type=int, default=1)
    ap.add_argument("--lote-max", type=int, default=K.REENV_LOTE_MAX)
    a = ap.parse_args()
    if a.velocidad <= 0 or a.vueltas < 1:
        ap.error("--velocidad debe ser > 0 y --vueltas >= 1")
    env = {**leer_env(AQUI / ".env"), **os.environ}
    token = (env.get("WEB_INGESTA_TOKEN") or "").strip()
    if not token:
        print("alimentar: falta WEB_INGESTA_TOKEN (entorno o gui/relay/.env)", file=sys.stderr)
        return 2
    hilos = [Alimentador(r, a.url, token, a.velocidad, a.vueltas, a.lote_max) for r in a.archivos]
    t0 = time.time()
    for h in hilos:
        h.start()
    for h in hilos:
        h.join()
    for h in hilos:
        print(f"{h.ruta.name}: {h.enviados} aceptados, {h.descartados} descartados, {h.lotes} lotes, "
              f"{h.reintentos} reintentos en {time.time() - t0:.1f} s" + (f"  ERROR: {h.fatal}" if h.fatal else ""))
    return 1 if any(h.fatal for h in hilos) else 0


if __name__ == "__main__":
    sys.exit(main())
