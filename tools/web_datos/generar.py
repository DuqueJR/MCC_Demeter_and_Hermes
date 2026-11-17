"""Escritura de los JSONL y orden de línea de comandos del generador.

Uso (desde la raíz del repo, igual en Windows y en macOS):

    python -m tools.web_datos                       # los 12 archivos en gui/web/dev/datos/
    python -m tools.web_datos --mision demeter --escenario nominal
    python -m tools.web_datos --salida OTRA_CARPETA
    python -m tools.web_datos --validar             # además valida lo que exige el contrato 05
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import constantes as C
from .simulador import generar_lineas
from .validacion import validar_lineas


def serializar(lineas: list[dict]) -> str:
    """JSONL compacto, UTF-8, con salto de línea `\\n` (igual en todos los sistemas)."""
    return "".join(json.dumps(l, ensure_ascii=False, separators=(",", ":")) + "\n" for l in lineas)


def ruta_salida(carpeta: Path, mision: str, escenario: str) -> Path:
    return Path(carpeta) / f"{mision}_{escenario}.jsonl"


def escribir(carpeta: Path, mision: str, escenario: str, lineas: list[dict]) -> Path:
    destino = ruta_salida(carpeta, mision, escenario)
    destino.parent.mkdir(parents=True, exist_ok=True)
    with open(destino, "w", encoding="utf-8", newline="\n") as f:
        f.write(serializar(lineas))
    return destino


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="python -m tools.web_datos",
        description="Genera los JSONL de ejemplo del contrato web-1 desde la simulación de OpenRocket.",
    )
    ap.add_argument("--mision", choices=C.MISIONES, help="solo esta misión (por defecto, las dos)")
    ap.add_argument("--escenario", choices=C.ESCENARIOS, help="solo este escenario (por defecto, los 6)")
    ap.add_argument("--salida", type=Path, default=C.SALIDA_POR_DEFECTO, help="carpeta de salida")
    ap.add_argument("--validar", action="store_true", help="valida cada archivo contra el contrato 05")
    args = ap.parse_args(argv)

    misiones = (args.mision,) if args.mision else C.MISIONES
    escenarios = (args.escenario,) if args.escenario else C.ESCENARIOS
    errores = 0
    for mision in misiones:
        for escenario in escenarios:
            lineas = generar_lineas(mision, escenario)
            destino = escribir(args.salida, mision, escenario, lineas)
            tam_kb = destino.stat().st_size / 1024
            print(f"{destino.name}: {len(lineas)} mensajes, {tam_kb:.0f} KB")
            if args.validar:
                fallos = validar_lineas(lineas)
                for f in fallos[:10]:
                    print(f"  ERROR: {f}")
                errores += len(fallos)
    if errores:
        print(f"{errores} errores de validación", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
