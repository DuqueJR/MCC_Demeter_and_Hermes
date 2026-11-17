---
fecha: 2026-11-05
tipo: sesion
ids: []
autor: Claude, con Pablo
rama: feature/intrinsecos-camaras
---
# Intrínsecos de las cámaras de Demeter

## Contexto

- Las dos Camera Module 3 ya van montadas en la nariz de Demeter (`camaras.json` v2: cam0 en la cara de la marca, cam1 en la opuesta, rotadas 180°).
- Hasta hoy, los intrínsecos de `camaras.json` eran nominales y sin distorsión.

## Qué se hizo

- **Captura guiada en la Pi** (`visionpack/eyes_of_demeter/calibration/intrinsecos/capturar.py`):
  - foto completa cada 2 s, con exposición fija de 10 ms y el lente fijo;
  - vista en vivo en el puerto 8080, con barras de fotos, zonas, 8 direcciones de inclinación y esquinas extremas, luz de quietud y botones para girar la imagen;
  - la quietud del cohete se lee de la TELEM de Demeter que recibe el dashboard del PC, por un túnel `ssh -R 8765`.
- **Tablero:** ChArUco de calib.io (11×7, 5X5) en la pantalla de una laptop y luego de una tablet, con un tablero 7×5 4X4 de cuadros grandes como alternativa.
- **Resultado:** queda en `camaras.json` v3. `demeter_pose.intrinsics_for` lo usa en los modos de campo completo.

| Cámara | Fotos | RMS | fx a infinito | cx, cy | Distorsión en las esquinas |
| --- | --- | --- | --- | --- | --- |
| cam0 | 55 | 0.50 px | 3360.0 | 2351.6, 1295.9 | 52–69 px |
| cam1 | 44 | 0.41 px | 3339.8 | 2291.2, 1295.5 | 40–47 px |

- **Documentación:** `docs/04_diseno/vision_pose_camaras.md` quedó al día con el montaje v2, los intrínsecos, quién corrige la distorsión y el código de píxel a suelo con `cv2.undistortPoints`.

## Hallazgos

1. **Al infinito, los marcadores no se leían.** Con el foco fijo al infinito, el desenfoque en el plano del tablero es la apertura (4.74/1.8 = 2.6 mm) a cualquier distancia, y los bits de un marcador de 14 mm (2 mm) quedaban por debajo.
   - Pablo decidió calibrar con el lente enfocado cerca: 1.5 dioptrías, fijo toda la sesión.
   - fx se lleva a infinito con lente delgada (factor 1 − f·D = 0.9929). Falta verificarlo contra una escena lejana.
2. **Sostenido a mano, el cohete gira 5–20 dps.** Con el obturador rodante (~70 ms de lectura) eso tuerce el tablero varios píxeles.
   - La captura exige menos de 1.5 dps, sin sesgo, en la TELEM y menos de 20 px entre fotos.
   - Al final, el cohete quedó fijo y se movió la tablet.
3. **La cuadrícula de 6×4 zonas engañaba.** Daba todo por cubierto sin datos en las esquinas extremas: los datos llegaban solo al 76–84 % del radio y la distorsión de cam1 salía en cientos de píxeles (extrapolación de `k3`).
   - Se agregó el indicador de esquinas extremas (fuera del 85 %), con 30 puntos por esquina. Con él, los datos llegan al 94 %.
4. **cx de cam0 depende del conjunto de fotos.** Daba 2297 sin las esquinas y 2367 solo con ellas; la incertidumbre que reporta OpenCV (±5 px) la subestima.
   - El ajuste conjunto reproyecta a 0.5 px. cx se compensa con `p1`: los intrínsecos se usan completos.
5. **Una foto mala cambia mucho cam1.** Con `cal_25` (error mayor que 2.5 veces la mediana) la distorsión era asimétrica (21–64 px); sin ella queda simétrica (40–47 px).

## Pendiente

- Desalineación fina de cada cámara frente al cuerpo: tablero más IMU de la LilyGo. `imu_por_foto.json` ya guarda la gravedad de cada foto, pero en esta sesión el cohete quedó fijo y no da rotaciones.
- Verificar fx al infinito.
- Medir `t_linea` del obturador rodante.
- `rumbo_eje_deg` daba 360.0 en lugar de 0.0 por un −0 numérico: corregido.
