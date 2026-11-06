"""El JSONL de cada mision (04 §4.5): cada mensaje aceptado se agrega aqui antes de responder el lote, y al reiniciar el
relay reconstruye el estado leyendo este archivo.

Una linea por mensaje: {"s": <seq_relay o null>, "tipo": "...", "datos": {...}}. `s` es el `id` con que salio por el
stream (null si no salio: un `estado` bajado de tasa o atrasado). Asi `seq_relay` no se repite ni retrocede tras un reinicio.

Si la ultima linea quedo cortada (el proceso murio a media escritura), se ignora y se recorta el archivo antes de seguir
agregando: si no, la siguiente linea se pegaria a la cortada y se perderian las dos.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Iterator, Optional

log = logging.getLogger("relay.almacen")


class Almacen:
    def __init__(self, ruta: Path, fsync: bool = True):
        self.ruta = ruta
        self._fsync = fsync
        self._pendiente: list[bytes] = []      # lo que no se pudo escribir (disco lleno...): se reintenta en el siguiente lote
        self.ilegibles = 0
        ruta.parent.mkdir(parents=True, exist_ok=True)
        self._f = None

    def leer(self) -> Iterator[tuple[Optional[int], str, dict]]:
        """(seq, tipo, datos) de cada linea legible. Recorta una ultima linea cortada. Una linea mala del medio se salta."""
        try:
            bruto = self.ruta.read_bytes()
        except FileNotFoundError:
            return
        fin = bruto.rfind(b"\n") + 1
        if fin != len(bruto):
            log.warning("%s: la ultima linea estaba cortada (%d bytes); se recorta", self.ruta.name, len(bruto) - fin)
            with open(self.ruta, "r+b") as f:
                f.truncate(fin)
            self.ilegibles += 1
        for linea in bruto[:fin].split(b"\n"):
            if not linea.strip():
                continue
            try:
                o = json.loads(linea)
                yield o["s"], o["tipo"], o["datos"]
            except (ValueError, KeyError, TypeError):
                self.ilegibles += 1
                log.warning("%s: linea ilegible, se salta", self.ruta.name)

    def _abrir(self):
        if self._f is None:
            self._f = open(self.ruta, "ab")
        return self._f

    @staticmethod
    def linea(seq: Optional[int], tipo: str, datos: dict) -> bytes:
        return (json.dumps({"s": seq, "tipo": tipo, "datos": datos}, ensure_ascii=False, separators=(",", ":"),
                           allow_nan=False) + "\n").encode("utf-8")

    def agregar(self, lineas: list[bytes]) -> None:
        """Escribe y vacia a disco. Si falla, deja las lineas pendientes y relanza: el lote responde 500 y se reintenta."""
        self._pendiente.extend(lineas)
        if not self._pendiente:
            return
        try:
            f = self._abrir()
            f.write(b"".join(self._pendiente))
            f.flush()
            if self._fsync:
                os.fsync(f.fileno())
        except OSError:
            # Lo escrito a medias se recorta en el proximo arranque; aqui se conserva todo para reintentar.
            self.cerrar()
            raise
        self._pendiente.clear()

    def cerrar(self) -> None:
        if self._f is not None:
            try:
                self._f.close()
            except OSError:
                pass
            self._f = None
