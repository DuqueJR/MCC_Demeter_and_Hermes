# Intrínsecos de las cámaras (5 nov 2026)

Calibración de las dos Camera Module 3 de Demeter, ya montadas en el cohete, con un ChArUco mostrado en una pantalla.
El resultado vigente está en `../camaras.json` (v3, bloque `intrinsecos` de cada cámara).

## Resultado

| Cámara | Fotos | RMS | fx a infinito | cx, cy | Distorsión en las esquinas |
| --- | --- | --- | --- | --- | --- |
| cam0 (cara de la marca) | 55 | 0.50 px | 3360.0 px | 2351.6, 1295.9 | 52–69 px |
| cam1 (cara opuesta) | 44 | 0.41 px | 3339.8 px | 2291.2, 1295.5 | 40–47 px |

- **Modelo:** OpenCV `k1 k2 p1 p2 k3` en 4608×2592. Los datos llegan al 94 % del radio de la esquina. Más allá, el modelo extrapola.
- **Foco:**
  - El lente se fijó en **1.5 dioptrías (~0.67 m)** durante toda la captura, porque con foco al infinito los marcadores no se leían a menos de 1 m.
  - fx se llevó a infinito con lente delgada: `fx_inf = fx_cal · (1 − f·D)`, con `f = 4.74 mm` y `D = 1.5`, que da un factor de 0.9929.
  - cx, cy y la distorsión se toman iguales a los de 1.5 dioptrías.
  - Ni la conversión ni el mapa de dioptrías de libcamera están verificados al infinito.
- **Incertidumbre de cx:**
  - La que reporta OpenCV es ±5 px, pero en cam0 las fotos sin esquinas daban cx = 2297 y las de las esquinas 2367.
  - cx se compensa con la distorsión tangencial. Lo que importa para proyectar es el conjunto, que reproyecta a 0.5 px en todo el campo cubierto.
- **Modos de cámara:** `demeter_pose.intrinsics_for` escala a 2304×1296 (binning). El modo 1536×864 es un recorte del sensor y ahí se marca `calibrado: false`.
- **Archivos:** `intrinsecos_cam*_1p5D.json` son la salida cruda de `calibrar.py`, a 1.5 dioptrías.

## Cómo repetirla

Las fotos se capturaron en la Pi y quedaron en `/home/admin/calib_intrinsecos/` (no van a git):
- `cam0_infinito` es el primer intento, al infinito; no sirve.
- `cam0_cerca` y `cam1_cerca` son las capturas que se usaron.

1. **Tablero.** Muestra en una pantalla, con el brillo al máximo y sin estirarlo, uno de estos dos:
   - el ChArUco de calib.io: 11×7, `DICT_5X5`, cuadro de 19.5 mm y marcador de 14 mm;
   - `tablero_tablet_4x4_7x5.png`: 7×5, `DICT_4X4`.
2. **Captura en la Pi.** Con el dashboard del PC conectado a tierra, la LilyGo vigila que el cohete esté quieto por medio de la TELEM. Se lanza desde el PC:
   ```bash
   ssh -R 8765:127.0.0.1:8765 admin@eyes-of-demeter 'python3 -u capturar.py CAMARA CARPETA 1800 1.5'
   ```
3. **Vista en vivo.** Se abre en `http://eyes-of-demeter:8080`. Muestra:
   - las barras de fotos, zonas, inclinaciones (8 direcciones de 25° o más) y esquinas extremas (fuera de la elipse naranja);
   - la luz de quietud de la LilyGo;
   - botones para girar la imagen.

   La captura guarda una foto solo si el tablero está quieto (menos de 20 px en 2 s), el cohete está quieto (menos de 1.5 dps) y la pose es nueva.
4. **Cálculo.** `python3 calibrar.py CARPETA` calibra, descarta las fotos con error mayor que 2.5 veces la mediana y guarda `intrinsecos.json`. `comparar_k3.py` muestra hasta qué radio llegan los datos.
