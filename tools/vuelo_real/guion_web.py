"""El guion que reproduce la web (T-681): el JSONL de la reconstruccion, recortado y diezmado como el de la simulacion.

Misma forma que `gui/web/scripts/generar-simulacion.mjs` (`compactar`), con `formato = "reconstruccion-1"`: la web
(`src/simulacion/guion.ts`) exige que todo su `meta` traiga `modo = "reconstruccion"`. Se escribe en
`gui/web/src/assets/<mision>/vuelo_real.json` y la pagina lo descarga solo al pulsar "Ver el vuelo real".
"""
import json
import os

from . import vuelos as V

FORMATO = 'reconstruccion-1'
ESCENARIO = 'vuelo_real_20261108'
MODO = 'reconstruccion'
FASES_DE_TIERRA = {'BOOT', 'PREFLIGHT', 'ARMED', 'LANDED', 'ERROR'}
ESTADO_EN_VUELO_CADA = 1            # en vuelo, todo lo que el cohete transmitio (10 Hz): es el vuelo real, no se diezma
SALUD_CADA = 10
COLA_TRAS_ATERRIZAJE_MS = 10_000
PRESUPUESTO_BYTES = 1536 * 1024     # sin comprimir; comprimido (como lo sirve la web) pesa ~60-85 KB. El de la simulacion es 400 KB


def ruta(mision):
    return os.path.join(V.RAIZ, 'gui', 'web', 'src', 'assets', mision, 'vuelo_real.json')


def _firma_salud(s):
    return json.dumps([s['go_nogo'], s['calib'], s['fallas_bits'], s['gnss']['fix'], s['apogeo_m'] not in (0, None)],
                      sort_keys=True, ensure_ascii=False)


def compactar(lineas):
    aterrizaje = next((l for l in lineas if l['evento'] == 'evento' and l['datos']['tipo'] == 'aterrizaje'), None)
    if aterrizaje is None:
        raise ValueError('la reconstruccion no trae el evento aterrizaje')
    fin = aterrizaje['t_rel_ms'] + COLA_TRAS_ATERRIZAJE_MS
    salida, fase_ant, en_vuelo, salud_n, salud_firma, t_tierra = [], None, 0, 0, None, None
    for l in lineas:
        if l['t_rel_ms'] > fin:
            break
        if l['evento'] == 'estado':
            fase = l['datos']['fase']
            tierra = fase in FASES_DE_TIERRA
            cambio = fase != fase_ant
            # En tierra el cohete ya transmite a 10 Hz desde LAUNCH, pero el relay lo baja a 1 Hz (05 §2.2): aqui igual
            un_segundo = tierra and (t_tierra is None or l['t_rel_ms'] - t_tierra >= 1000)
            if un_segundo or cambio or (not tierra and en_vuelo % ESTADO_EN_VUELO_CADA == 0):
                salida.append(l)
                if tierra:
                    t_tierra = l['t_rel_ms']
            en_vuelo = 1 if (tierra or cambio) else en_vuelo + 1
            fase_ant = fase
        elif l['evento'] == 'salud':
            firma = _firma_salud(l['datos'])
            if salud_n % SALUD_CADA == 0 or firma != salud_firma:
                salida.append(l)
            salud_firma = firma
            salud_n += 1
        else:
            salida.append(l)
    return salida


def generar(mision, mensajes):
    if not any(l['evento'] == 'meta' and l['datos']['modo'] == MODO for l in mensajes):
        raise ValueError('la reconstruccion debe traer meta en modo reconstruccion')
    lineas = compactar(mensajes)
    guion = {'formato': FORMATO, 'mision': mision, 'escenario': ESCENARIO, 'duracion_ms': lineas[-1]['t_rel_ms'], 'lineas': lineas}
    texto = json.dumps(guion, ensure_ascii=False, separators=(',', ':')) + '\n'
    if len(texto.encode('utf-8')) > PRESUPUESTO_BYTES:
        raise ValueError(f'{mision}: el guion pesa {len(texto.encode("utf-8"))} B (presupuesto {PRESUPUESTO_BYTES} B)')
    return texto
