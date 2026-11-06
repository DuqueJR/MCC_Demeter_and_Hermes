#!/usr/bin/env python3
"""Regenera los fixtures de integracion de T-641 (estacion/fixtures/).

Deja, de forma determinista y reproducible, los archivos versionados:
  - web1.jsonl:           los mensajes `web-1` (`{"tipo", "mision", "datos"}`) de un vuelo de Demeter;
  - web1_snapshot.json:   el snapshot final de cada mision.

Metodo (determinista, sin hardware): genera una sesion de tierra sintetica con el generador de
`estacion/pruebas/generador.py` (la simulacion de OpenRocket de Demeter, con el TDMA de net_proto)
y la reprocesa con `estacion/web1.py`. La sesion cruda NO se versiona: va a un archivo temporal
(o al archivo que pidas con `--sesion`).

Uso (desde la raiz del repo):

    python estacion/fixtures/regenerar.py
    python estacion/fixtures/regenerar.py --sesion estacion/sesiones/T641_tierra.txt

Con `--sesion` ademas deja la sesion cruda (en `estacion/sesiones/`, ignorada por git), lista para
`python estacion/dashboard.py --reproducir <sesion> ...`.

Solo biblioteca estandar. No toca puertos ni red.
"""
import argparse
import os
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
ESTACION = os.path.dirname(AQUI)
RAIZ = os.path.dirname(ESTACION)
for ruta in (os.path.join(ESTACION, 'pruebas'), ESTACION, RAIZ):
    if ruta not in sys.path:
        sys.path.insert(0, ruta)

import generador as g  # noqa: E402
import web1           # noqa: E402

# Semilla del fixture: el vuelo completo de la simulacion de OpenRocket de Demeter,
# desde T-30 s (espera en la rampa) hasta t_fin + 15 s (aterrizado y margen de recuperacion).
T_INI = -30.0


def lineas():
    return g.vuelo(g.perfil_demeter(), t_ini=T_INI)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sesion', metavar='RUTA', help='ademas, escribe aqui la sesion cruda de tierra (no se versiona)')
    a = ap.parse_args(argv)

    salida = os.path.join(AQUI, 'web1.jsonl')
    snap = os.path.join(AQUI, 'web1_snapshot.json')
    texto = g.sesion_texto(lineas())

    if a.sesion:
        sesion = a.sesion
        os.makedirs(os.path.dirname(os.path.abspath(sesion)), exist_ok=True)
        with open(sesion, 'w', encoding='utf-8') as f:
            f.write(texto)
        web1.main([sesion, '--salida', salida, '--snapshot', snap, '--modo', 'simulacion'])
    else:
        with tempfile.NamedTemporaryFile('w', suffix='_tierra.txt', encoding='utf-8', delete=False) as f:
            f.write(texto)
            sesion = f.name
        try:
            web1.main([sesion, '--salida', salida, '--snapshot', snap, '--modo', 'simulacion'])
        finally:
            try:
                os.unlink(sesion)
            except OSError:
                pass

    print(f'fixtures regenerados: {salida} y {snap}' + (f'; sesion cruda en {sesion}' if a.sesion else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
