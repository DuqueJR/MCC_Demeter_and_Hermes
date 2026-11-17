# R8 - Respuesta dinamica del AE oficial

## Resultado

La secuencia A/B/C se completo en ambas camaras a 10 fps. La Pi registró el inicio y cada cambio del HTML en `events.jsonl`; el analizador alineo esos eventos con `FrameWallClock` por camara, y uso los colores del H.264 como verificacion independiente. Video/metadata: Cam0 1694 frames, Cam1 1697 frames; duracion de la secuencia 120.1 s. Salidas completas en `runs/20261010T005825Z/`.

Referencia de exposicion: `rpicam-vid --exposure sport --metering centre --ev 0`, AE automatico, WB bloqueado con ganancias R/B medidas en R7, lente en 0 dpt. `sport` es el preset corto disponible en rpicam-vid; esta corrida no mide un controlador AE propio de Demeter.

## Metricas

El cambio neto EV compara la mediana de `ExposureTime * AnalogueGain * DigitalGain` del nivel actual con la del nivel gris estable previo. La convergencia es el tiempo desde el inicio del gris hasta que cinco frames consecutivos caen dentro de ±0.25 EV del valor final. `sigma final` es la desviacion EV durante los ultimos 2 s del nivel.

| Nivel lineal | ΔEV neto Cam0/Cam1 | Convergencia Cam0/Cam1 | sigma final Cam0/Cam1 |
|---:|---:|---:|---:|
| A1 10% | inicio condicionado por marcadores; sin gris previo | 0.0 / 0.0 s | 0.000 / 0.000 EV |
| A2 90% | -2.62 / -2.63 EV | 2.00 / 1.90 s | 0.000 / 0.000 EV |
| A3 10% | +2.62 / +2.62 EV | 1.00 / 1.00 s | 0.000 / 0.000 EV |
| B1 5% | +1.37 / +1.37 EV | 0.90 / 1.00 s | 0.032 / 0.033 EV |
| B2 50% | -3.52 / -3.53 EV | 2.00 / 1.90 s | 0.000 / 0.000 EV |
| B3 100% | -1.47 / -1.46 EV | 6.90 / 6.70 s | 0.066 / 0.066 EV |
| B4 50% | +0.85 / +0.85 EV | 0.80 / 0.80 s | 0.000 / 0.000 EV |
| B5 5% | +4.13 / +4.13 EV | 1.10 / 1.10 s | 0.000 / 0.000 EV |
| C1 20% | -2.58 / -2.59 EV | 0.70 / 0.70 s | 0.000 / 0.000 EV |
| C2 100% | -2.40 / -2.41 EV | 6.80 / 6.80 s | 0.065 / 0.065 EV |
| C3 20% | +2.41 / +2.43 EV | 0.90 / 0.90 s | 0.007 / 0.000 EV |

Las dos camaras siguen curvas de exposicion muy similares. Los pasos de 5-10-20-50% convergen normalmente en ~0.7-2.0 s. Los pasos a blanco pleno tardan ~6.8 s y retienen una pequena variacion residual (~0.065 EV). No se observan oscilaciones persistentes en los ultimos 2 s.

En C1 (verde marcador -> gris lineal 20%) aparece un sobreimpulso transitorio de ~0.95 EV en la direccion de reduccion, en ambas camaras, antes de converger en ~0.7 s. Es distinto de la oscilacion residual final, que es practicamente cero.

## Sincronizacion y luminancia

Frames de marcador (Cam0/Cam1): inicio A 509/512, inicio B 830/833, inicio C 1349/1352, fin 1672/1675. La diferencia constante de tres frames es una discrepancia de arranque/indice entre las dos grabaciones; cada camara se alinea independientemente con el reloj del evento web y su FrameWallClock.

El detector visual confirmo azul (A), rojo (B) y amarillo (END). Magenta (START) y verde (C) aparecen casi acromaticos/blancos en el video porque AE llego con exposicion alta y los canales se lavaron. Para esos dos puntos, el evento POST del navegador y el timestamp del servidor son la referencia de sincronizacion; el video es solo control visual.

Media de pantalla del H.264 (Rec.709, tras el ISP de rpicam) durante el primer segundo y los ultimos 2 s de nivel:

| Nivel | Media inicial/final, promedio de ambas camaras |
|---|---:|
| A1 10% | 173 / 174 DN |
| A2 90% | 230 / 165 DN |
| A3 10% | 119 / 168 DN |
| B1 5% | 125 / 186 DN |
| B2 50% | 232 / 170 DN |
| B3 100% | 186 / 171 DN |
| B4 50% | 146 / 170 DN |
| B5 5% | 93 / 171 DN |
| C1 20% | 153 / 170 DN |
| C2 100% | 220 / 166 DN |
| C3 20% | 121 / 176 DN |

Esta media corresponde al video de referencia, despues de AE, AWB bloqueado, tone mapping y codificacion; no es luminancia lineal del sensor. El nivel lineal de entrada correcto esta registrado en cada evento HTML.

## Limitacion importante de esta primera corrida

Las camaras grabaron durante ~50 s mientras la pantalla permanecia negra, antes del evento START. AE llevo exposicion/ganancia hacia su limite; por eso el magenta START y el verde C se saturaron visualmente y A1 comenzo desde un estado condicionado. El resto de A/B/C queda medido y sincronizado; excluir A1 de conclusiones de convergencia desde un estado previo neutral. En una repeticion, arrancar el controlador cuando el MateBook ya esta listo para pulsar INICIAR R8, o mostrar gris medio hasta armar, evitara ese preacondicionamiento negro.

El marcador de color tambien cambia el estimulo AE durante 2 s; se reportan los pasos tanto desde el gris previo estable como en el frame del nuevo nivel. Para vuelo no se recomienda usar colores como marcadores opticos: en esta prueba son utiles para sincronizar y cuantificar la perturbacion.

## Artefactos

- `runs/20261010T005825Z/r8_analysis.json`: marcadores, indices, metricas y eventos originales.
- `runs/20261010T005825Z/cam0_frames.csv`, `cam1_frames.csv`: video clasificado y metadata AE por frame.
- `runs/20261010T005825Z/cam0.h264`, `cam1.h264`: video compacto original.
- `runs/20261010T005825Z/cam0_metadata.json`, `cam1_metadata.json`, PTS y logs: originales para reprocesar.
