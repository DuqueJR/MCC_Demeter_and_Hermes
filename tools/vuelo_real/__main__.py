"""Linea de comandos. Desde la raiz del repo:

    python -m tools.vuelo_real                          # genera datos/vuelos/20261108/web/ desde los recortes del repo
    python -m tools.vuelo_real --validar                # ademas compara con lo versionado
    python -m tools.vuelo_real recortar --originales CARPETA_BIN --sesiones CARPETA_SESIONES   # rehace los recortes (originales en local)
"""
import argparse
import json
import os
import sys

from . import vuelos as V


def escribir(ruta, texto):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        f.write(texto)


def generar_todo(carpeta):
    from . import reconstruir, resumen
    res = {}
    salidas = {}
    for mision in V.VUELOS:
        r, mensajes, snap, ofs = reconstruir.generar(mision)
        salidas[f'{mision}.jsonl'] = ''.join(json.dumps(m, ensure_ascii=False, separators=(',', ':')) + '\n' for m in mensajes)
        salidas[f'{mision}_snapshot.json'] = json.dumps(snap, ensure_ascii=False, separators=(',', ':')) + '\n'
        res[mision] = resumen.de_vuelo(mision, r, ofs)
        print(f"{mision}: {len(mensajes)} mensajes; apogeo publicado {res[mision]['apogeo_m']['referencia_publicada']} m")
    salidas['resumen.json'] = json.dumps(res, ensure_ascii=False, indent=2) + '\n'
    for nombre, texto in salidas.items():
        escribir(os.path.join(carpeta, nombre), texto)
    return salidas


def main(argv=None):
    ap = argparse.ArgumentParser(prog='python -m tools.vuelo_real', description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('accion', nargs='?', default='generar', choices=('generar', 'recortar'))
    ap.add_argument('--salida', default=V.SALIDA)
    ap.add_argument('--validar', action='store_true', help='compara lo generado con lo versionado (tolerancia de redondeo)')
    ap.add_argument('--originales', help='recortar: carpeta con los .BIN originales')
    ap.add_argument('--sesiones', help='recortar: carpeta con la sesion de tierra del dia')
    a = ap.parse_args(argv)
    if a.accion == 'recortar':
        from . import recorte
        if not (a.originales and a.sesiones):
            ap.error('recortar necesita --originales y --sesiones')
        recorte.recortar(a.originales, a.sesiones)
        return 0
    if a.validar:
        from . import validar
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            nuevas = generar_todo(tmp)
            return validar.comparar(nuevas, a.salida)
    generar_todo(a.salida)
    return 0


if __name__ == '__main__':
    sys.exit(main())
