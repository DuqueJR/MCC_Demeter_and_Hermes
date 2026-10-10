#!/bin/bash
# Punto unico R9: sirve estimulo y captura COMP1+stats con controles manuales fijos.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$HERE/r9_controller.py"
