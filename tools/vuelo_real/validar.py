"""Compara la salida recien generada con la versionada.

En la misma maquina sale identica byte a byte. Entre maquinas (Windows y macOS, otra version de numpy) el EKF puede diferir en el
ultimo bit y mover un redondeo: por eso los numeros se aceptan si difieren a lo sumo en dos unidades de su ultimo decimal.
El texto, los eventos, las fases y la cantidad de mensajes deben coincidir exactamente.
"""
import json
import os


def _decimales(x):
    s = repr(x)
    return len(s.split('.')[1]) if '.' in s and 'e' not in s else 0


def _igual(a, b, ruta, difs):
    if isinstance(a, bool) or isinstance(b, bool) or a is None or b is None or isinstance(a, str) or isinstance(b, str):
        if a != b:
            difs.append(f'{ruta}: {a!r} != {b!r}')
        return
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        tol = 2 * 10 ** -max(_decimales(a), _decimales(b)) + 1e-9
        if abs(a - b) > tol:
            difs.append(f'{ruta}: {a!r} != {b!r}')
        return
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            difs.append(f'{ruta}: claves distintas')
            return
        for k in a:
            _igual(a[k], b[k], f'{ruta}.{k}', difs)
        return
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            difs.append(f'{ruta}: {len(a)} elementos frente a {len(b)}')
            return
        for i, (x, y) in enumerate(zip(a, b)):
            _igual(x, y, f'{ruta}[{i}]', difs)
        return
    difs.append(f'{ruta}: tipos distintos')


def comparar(nuevas, carpeta):
    total = []
    for nombre, texto in sorted(nuevas.items()):
        ruta = os.path.join(carpeta, nombre)
        if not os.path.exists(ruta):
            total.append(f'{nombre}: no esta versionado')
            continue
        viejo = open(ruta, encoding='utf-8').read()
        if viejo == texto:
            print(f'{nombre}: identico')
            continue
        if nombre.endswith('.jsonl'):
            a = [json.loads(x) for x in texto.splitlines()]
            b = [json.loads(x) for x in viejo.splitlines()]
        else:
            a, b = json.loads(texto), json.loads(viejo)
        difs = []
        _igual(a, b, nombre, difs)
        print(f'{nombre}: ' + ('igual dentro del redondeo' if not difs else f'{len(difs)} diferencias'))
        total += difs
    for d in total[:20]:
        print('  ' + d)
    return 1 if total else 0
