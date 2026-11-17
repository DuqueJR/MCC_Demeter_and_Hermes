"""Validador del subconjunto de JSON Schema (draft-07) que usa `gui/web/src/contrato/esquema.json`.

Solo biblioteca estandar (no se agrega `jsonschema`). Cubre lo que el esquema usa para los mensajes y el
snapshot: `$ref` local, `type`, `enum`, `const`, `anyOf`, `properties`, `required`,
`additionalProperties: false`, `items`, `minimum` y `maximum`. Lo que no entiende y no cambia el significado
(por ejemplo `format`) lo ignora; una palabra de `PALABRAS_SIN_SOPORTE` hace fallar en voz alta, para que un
esquema nuevo no pase en silencio.
"""
import json
import math
import os

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RUTA_ESQUEMA = os.path.join(RAIZ, 'gui', 'web', 'src', 'contrato', 'esquema.json')
PALABRAS_SIN_SOPORTE = ('allOf', 'oneOf', 'not', 'if', 'then', 'else', 'patternProperties', 'pattern',
                        'minItems', 'maxItems', 'uniqueItems', 'exclusiveMinimum', 'exclusiveMaximum')


def cargar_esquema():
    with open(RUTA_ESQUEMA, encoding='utf-8') as f:
        return json.load(f)


def _es_entero(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _es_numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _tipo_ok(v, t):
    return {'integer': _es_entero, 'number': _es_numero, 'string': lambda x: isinstance(x, str),
            'boolean': lambda x: isinstance(x, bool), 'null': lambda x: x is None,
            'object': lambda x: isinstance(x, dict), 'array': lambda x: isinstance(x, list)}[t](v)


def _en_enum(v, opciones):
    return any(v == x and isinstance(v, bool) == isinstance(x, bool) for x in opciones)


def errores(esquema, nodo, dato, ruta='$'):
    """Lista de errores de `dato` contra el sub-esquema `nodo` (vacia si valida)."""
    if '$ref' in nodo:
        destino = esquema
        for parte in nodo['$ref'].lstrip('#/').split('/'):
            destino = destino[parte]
        return errores(esquema, destino, dato, ruta)
    for k in nodo:
        if k in PALABRAS_SIN_SOPORTE:
            raise NotImplementedError(f'el validador minimo no entiende `{k}`')
    if 'anyOf' in nodo:
        todos = [errores(esquema, n, dato, ruta) for n in nodo['anyOf']]
        return [] if any(not e for e in todos) else [f'{ruta}: no cumple ninguna alternativa ({dato!r})']
    out = []
    if 'const' in nodo and dato != nodo['const']:
        out.append(f'{ruta}: debe ser {nodo["const"]!r}, es {dato!r}')
    if 'enum' in nodo and not _en_enum(dato, nodo['enum']):
        out.append(f'{ruta}: {dato!r} no esta en {nodo["enum"]}')
    if 'type' in nodo:
        tipos = nodo['type'] if isinstance(nodo['type'], list) else [nodo['type']]
        if not any(_tipo_ok(dato, t) for t in tipos):
            return out + [f'{ruta}: debe ser {nodo["type"]}, es {dato!r}']
    if _es_numero(dato):
        if 'minimum' in nodo and dato < nodo['minimum']:
            out.append(f'{ruta}: {dato} < {nodo["minimum"]}')
        if 'maximum' in nodo and dato > nodo['maximum']:
            out.append(f'{ruta}: {dato} > {nodo["maximum"]}')
    if isinstance(dato, dict):
        props = nodo.get('properties', {})
        for r in nodo.get('required', []):
            if r not in dato:
                out.append(f'{ruta}: falta `{r}`')
        if nodo.get('additionalProperties') is False:
            for k in dato:
                if k not in props:
                    out.append(f'{ruta}: campo `{k}` fuera del contrato')
        for k, v in dato.items():
            if k in props:
                out += errores(esquema, props[k], v, f'{ruta}.{k}')
    if isinstance(dato, list) and 'items' in nodo:
        for i, x in enumerate(dato):
            out += errores(esquema, nodo['items'], x, f'{ruta}[{i}]')
    return out


def validar_mensaje(tipo, datos, esquema=None):
    esquema = esquema or cargar_esquema()
    return errores(esquema, {'$ref': f'#/$defs/{tipo}'}, datos, tipo)


def validar_snapshot(snap, esquema=None):
    esquema = esquema or cargar_esquema()
    return errores(esquema, {'$ref': '#/$defs/snapshot'}, snap, 'snapshot')
