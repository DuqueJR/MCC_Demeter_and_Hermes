"""Validacion de la ingesta contra `esquema.json` (el de la web, sin copiarlo: la ruta es configurable porque T-642 lo
despliega aparte), mas lo que JSON Schema no expresa (`validacion_extra.ts`): mision <-> nodo y fase <-> fase_cod.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator

import constantes as K

_ITEM = "#/$defs/ingesta/properties/mensajes/items"


class Validador:
    def __init__(self, ruta_esquema: Path):
        esquema = json.loads(Path(ruta_esquema).read_text(encoding="utf-8"))
        defs = esquema["$defs"]
        # Un mensaje suelto de la ingesta. Se valida de a uno para que uno malo no tire el lote (04 §4.1).
        self._mensaje = Draft7Validator({"$ref": _ITEM, "$defs": defs})
        self._snapshot = Draft7Validator(esquema)
        Draft7Validator.check_schema(esquema)

    def error_mensaje(self, m: Any) -> str | None:
        """`None` si el mensaje es valido; si no, una frase corta (sin el contenido, que puede ser grande)."""
        err = next(iter(self._mensaje.iter_errors(m)), None)
        if err is not None:
            ruta = "/".join(str(p) for p in err.absolute_path)
            return f"{ruta or '(raiz)'}: {err.message[:120]}"
        datos, mision, tipo = m["datos"], m["mision"], m["tipo"]
        if tipo == "meta":
            if datos["mision"] != mision:
                return f"meta.mision {datos['mision']} no coincide con la mision del mensaje {mision}"
            if datos["nodo"] != K.NODO_DE[mision]:
                return f"la mision {mision} es el nodo {K.NODO_DE[mision]}, no {datos['nodo']}"
        elif tipo == "estado":
            if K.FASES.index(datos["fase"]) != datos["fase_cod"]:
                return f"fase {datos['fase']} no corresponde al codigo {datos['fase_cod']}"
        return None

    def errores_snapshot(self, snapshot: Any) -> list[str]:
        """Para las pruebas: todo snapshot generado debe validar."""
        return [e.message[:200] for e in self._snapshot.iter_errors(snapshot)]
