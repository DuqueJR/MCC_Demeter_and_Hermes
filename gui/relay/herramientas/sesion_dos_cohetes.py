# Herramienta manual de T-640: genera una sesion de tierra con los dos cohetes para `dashboard.py --reproducir`.
# Uso (desde la raiz del repo): python gui/relay/herramientas/sesion_dos_cohetes.py <salida.txt>
"""Genera una sesion de tierra con los dos cohetes (rid 1 = demeter, rid 2 = hermes) con el generador de las pruebas."""
import sys
sys.path[:0] = ['estacion/pruebas', 'estacion', '.']
import generador as g

salida = sys.argv[1]
p = g.perfil_demeter()
a = g.vuelo(p, rid=1, t_ini=-20.0)
b = g.vuelo(p, rid=2, t_ini=-20.0)
# los '@G' y '[time]' se repiten en las dos listas: se dejan los de una sola
b = [x for x in b if x[1].startswith('@T') or x[1].startswith('@L')]
lineas = sorted(a + b, key=lambda x: x[0])
open(salida, 'w', encoding='utf-8').write(g.sesion_texto(lineas))
print(len(lineas), 'lineas')
