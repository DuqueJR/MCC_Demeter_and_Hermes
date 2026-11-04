# R7 - Validacion ALSC y sombreado residual

**Estimulo:** campo blanco del test de pixeles muertos del MateBook X Pro 2020. Pantalla fijada en las condiciones de la campana (70% de brillo, sin HDR/Night Light/brillo automatico). Lente en 0.0 dpt. La caja activa del panel se recorto con el ROI 3:2 de R5; no se incluyo el cuarto oscuro.

## Capturas

| Camara | Exposicion | Ganancia analogica | Digital gain | Media verde centro |
|---|---:|---:|---:|---:|
| Cam0 | 9990 us | 1.3819 | 1.0021 | 33256 DN |
| Cam1 | 9990 us | 1.3857 | 1.0017 | 33033 DN |

Ningun canal recorto en el ROI activo. El rectangulo detectado fue 1071x723 px (Cam0) y 1072x728 px (Cam1) en el plano verde 2304x1296, con relacion 3:2. El campo blanco presenta un gradiente espacial pronunciado; no es una fuente Lambertiana ni una referencia radiometrica plana.

## Campo antes de ALSC

Luminancia verde de los promedios por zona, relativa al centro:

| Zona | Cam0 | Cam1 |
|---|---:|---:|
| Centro | 100.0% | 100.0% |
| Arriba | 77.2% | 76.5% |
| Abajo | 78.2% | 77.8% |
| Izquierda | 75.3% | 62.2% |
| Derecha | 52.2% | 62.6% |
| Superior izquierda | 55.8% | 44.3% |
| Superior derecha | 43.7% | 52.7% |
| Inferior izquierda | 59.1% | 49.1% |
| Inferior derecha | 42.8% | 47.6% |

Este es el campo observado por el sistema: incluye panel, oblicuidad, iluminacion, ventana angular del LCD y lente. No atribuirlo directamente a viñeteo del objetivo.

## ALSC y residual

El Controller genero ALSC 32x32. Su ganancia verde fue 1.03 en el centro y aumento hacia los bordes; el maximo de la tabla fue 2.633. Aplicando esa tabla numericamente al Bayer de entrada, la esquina mas oscura queda en:

- Cam0: 57.5% del centro (superior derecha); residual de campo 42.5%.
- Cam1: 53.3% del centro (superior izquierda); residual de campo 46.7%.

El RGB888 producido por el PiSP BE con **todos** los bloques mapeados activos (ALSC, WB, CCM, gamma, denoise, etc.) queda entre 77.4% y 89.6% del centro en las esquinas medidas. El residual de luma de replay es, por tanto, 10.4-22.6% segun camara/zona. No es una medida de ALSC aislado: gamma, CCM, canales WB y demas bloques cambian la luma final.

Mapas (escala de color local independiente por imagen):

- Cam0: `white_dead_pixel/cam0_raw_map.jpg`, `cam0_predicted_map.jpg`, `cam0_lsc_gain_map.jpg`.
- Cam1: `white_dead_pixel/cam1_raw_map.jpg`, `cam1_predicted_map.jpg`, `cam1_lsc_gain_map.jpg`.

Datos numericos completos, zonas, ganancias y estado Controller: `white_dead_pixel/alsc_results.json`. RAW COMP1, Bayer16, stats FE, config BE y salida RGB estan conservados en `white_dead_pixel/`.

## Interpretacion y limites

- El campo blanco permite comprobar que el Controller emite y el BE aplica una correccion espacial, pero no identifica lente-shading puro: el LCD visto fuera de eje tambien cae fuertemente y sus coordenadas no coinciden con las de ambas camaras por el baseline lateral.
- La correccion generada no aplana la entrada por completo. No ajustar todavia la calibracion ALSC con estos datos, ni convertir el residuo de salida completa en un parametro de lente.
- Para aislar ALSC se requiere comparar BE encendido/apagado con los mismos datos y el mismo WBG/CCM/gamma, o una fuente difusa uniforme caracterizada. La salida actual demuestra funcionamiento del camino integrado, no calibracion fotometrica absoluta.
