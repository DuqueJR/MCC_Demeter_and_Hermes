#!/bin/bash
# Punto unico de entrada R8: la Pi inicia las camaras, sirve el estimulo y registra eventos.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$HERE/r8_controller.py"
