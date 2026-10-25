"""Lectura de la exportación CSV de OpenRocket (formato en `datos/README.md`).

- Separado por comas, decimal en punto, líneas de comentario con `#`.
- La cabecera de columnas es la línea `# Tiempo (s),…`; sus nombres traen acentos,
  símbolos y caracteres invisibles (U+200B) y el archivo puede traer bytes
  dañados. Por eso las columnas se buscan por su prefijo ASCII, sin acentos.
- Los eventos van como comentarios: `# Event <NOMBRE> occurred at t=<s> seconds`.
- `NaN` significa que no hay dato.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path

# Prefijos (ASCII, sin acentos ni símbolos) de las columnas que usa el generador.
_COLUMNAS = {
    "t": "Tiempo (s)",
    "alt": "Altitud (m)",
    "vz": "Velocidad vertical (m/s)",
    "aup": "Aceleracin vertical",
    "este": "Posicin al este",
    "norte": "Posicin al norte",
    "vh": "Velocidad horizontal",
    "ah": "Aceleracin horizontal",
    "elev": "Orientacin vertical",
    "azim": "Orientacin lateral",
    "g": "Aceleracin gravitacional",
}

_EVENTO = re.compile(r"^#\s*Event\s+(\S+)\s+occurred at t=([-+0-9.eE]+)\s+seconds")


@dataclass
class DatosOpenRocket:
    """Columnas crudas de la simulación (listas de float, NaN donde no hay dato) y eventos."""

    columnas: dict[str, list[float]]
    eventos: dict[str, float]
    origen: Path


def _normalizar(nombre: str) -> str:
    """Quita todo lo que no sea ASCII imprimible (acentos, U+200B, bytes dañados)."""
    return "".join(c for c in nombre if " " <= c <= "~").strip()


def leer_csv(ruta: Path) -> DatosOpenRocket:
    texto = Path(ruta).read_text(encoding="utf-8", errors="replace")
    cabecera: list[str] | None = None
    eventos: dict[str, float] = {}
    filas: list[list[float]] = []
    for linea in texto.splitlines():
        if linea.startswith("#"):
            m = _EVENTO.match(linea)
            if m:
                eventos[m.group(1)] = float(m.group(2))
            elif cabecera is None and linea[1:].lstrip().startswith("Tiempo"):
                cabecera = [_normalizar(c) for c in linea[1:].lstrip().split(",")]
            continue
        if not linea.strip():
            continue
        filas.append([float(x) for x in linea.split(",")])
    if cabecera is None:
        raise ValueError(f"{ruta}: no tiene la cabecera '# Tiempo (s),…'")
    columnas: dict[str, list[float]] = {}
    for clave, prefijo in _COLUMNAS.items():
        indices = [i for i, c in enumerate(cabecera) if c.startswith(prefijo)]
        if not indices:
            raise ValueError(f"{ruta}: falta la columna '{prefijo}'")
        i = indices[0]
        columnas[clave] = [f[i] for f in filas]
    return DatosOpenRocket(columnas=columnas, eventos=eventos, origen=Path(ruta))


def es_nan(x: float) -> bool:
    return isinstance(x, float) and math.isnan(x)
