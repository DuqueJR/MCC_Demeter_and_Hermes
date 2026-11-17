"""Los vuelos reales: de donde salen, que ventana se recorta y los datos oficiales.

Los .BIN completos no van al repo (177 y 248 MB; GitHub no acepta mas de 100 MB y no usamos LFS): se guardan en local u OneDrive.
Al repo va el recorte de cada uno (los mismos bytes de cada registro, solo los de la ventana), y aqui queda el SHA-256 del original
para verificarlo si hace falta rehacer el recorte.
"""
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATOS = os.path.join(RAIZ, 'datos', 'vuelos', '20261108')
SALIDA = os.path.join(DATOS, 'web')

# Lanzamiento del CCCD 2026, 8 de noviembre. Tiempos t_us del reloj local del cohete (el del .BIN).
VUELOS = {
    'hermes': dict(
        rid=2, motor='G80-7T',
        original='HER_M00_20261108_101601_0036.BIN', bytes=177609890,
        sha256='6fab3fa87333a15865fa5aa1047b34c523fa5703ad432887a864d2d6e7765b5f',
        recorte='HER_vuelo_20261108.BIN',
        t_launch_us=7376_690_776,              # el comando LAUNCH (T_MISSION): el logger registra desde aqui
        t_fin_us=7449_000_000,                 # 10 s despues del golpe de aterrizaje (t0+57 s)
        apogeo_oficial_m=393.0,                # altimetro ESTER de la competencia
        calib='calib_hermes.json',             # estacion/calib_hermes.json (HER 0027): la que esta en el repo
        excluir_bmp_desde_us=None,
    ),
    'demeter': dict(
        rid=1, motor='H135W-8',
        original='DEM_M00_20261108_123013_0011.BIN', bytes=248344672,
        sha256='6579a796e08ae03e80cf49a900c9738559a0ab2a647ce5f4502e5846c5476f70',
        recorte='DEM_vuelo_20261108.BIN',
        t_launch_us=14034_940_233,
        t_fin_us=14152_000_000,                # golpe de aterrizaje en t0+80.5 s (t=14141.8 s) mas 10 s
        apogeo_oficial_m=598.0,
        calib='calib_demeter.json',            # estacion/calib_demeter.json (DEM 0101)
        excluir_bmp_desde_us=0,                # BMP581 congelado desde las 14:48:07 UTC, antes de este archivo: todo el archivo
    ),
}

# La sesion de la estacion de tierra (dashboard) del dia: cubre los dos vuelos. Se recorta a la ventana de cada uno.
SESION_TIERRA = dict(
    original='20261108_092801_tierra.txt', bytes=22310347,
    sha256='6602f9dabb58a6c1fdb687cca0ac1493ee3e0bd8db62bc2a2c4cc067a3bdc292',
)
VENTANA_ANTES_S = 5.0                          # la web arranca 5 s antes de LAUNCH con la telemetria real (en ARMED no hay registro a bordo)


def ruta_recorte(mision):
    return os.path.join(DATOS, VUELOS[mision]['recorte'])


def ruta_sesion(mision):
    return os.path.join(DATOS, f'tierra_{mision}_20261108.txt')
