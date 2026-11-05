---
id: vision_pose_camaras
estado: vigente (2026-11-05). Lo que entrega el VisionPack de Demeter al equipo de visión artificial. Actitud sin EKF a bordo todavía.
actualizado: 2026-11-05
depende_de: [visionpack_integracion, protocolo_paquetes]
decisiones: [D-054, D-055, D-056]
---
# Pose y cámaras de Demeter para visión artificial

Este documento explica cómo ubicar en el terreno lo que se ve en cada imagen de Demeter. Por cada cuadro entregamos:
- la hora de misión;
- la pose del cohete: posición, velocidad, actitud y su calidad;
- los extrínsecos e intrínsecos de la cámara;
- la dirección del eje óptico en el marco local.

El código de referencia está en `visionpack/demeter_pose.py`; las cámaras, en `visionpack/eyes_of_demeter/calibration/camaras.json`.

> **Estado al 2026-11-05.**
> - La hora, la posición y la sincronía entre cámaras ya sirven.
> - La **actitud todavía no:** el EKF aún no corre a bordo. Mientras tanto, el cuaternión llega en identidad y `pose.valida` es `false`.
> - Los extrínsecos son nominales: falta confirmar con una foto qué índice corresponde a qué lado.
> - Los intrínsecos son nominales: falta calibrarlos con tablero.
>
> Los datos de banco sirven para probar el formato, no la geometría.

## 1. Marcos de referencia

| Marco | Ejes | Origen | Uso |
| --- | --- | --- | --- |
| **NED** (local) | X = Norte, Y = Este, Z = Abajo | La posición del cohete en cada cuadro (rotación pura) | Actitud y direcciones |
| **Cuerpo FRD** | X = nariz (hacia adelante), Y = derecha, Z = opuesto a la marca | El cohete | IMU, actitud |
| **Cámara** (estilo OpenCV) | x = derecha de la imagen, y = abajo de la imagen, z = eje óptico (hacia la escena) | El centro óptico | Píxeles |
| **Geodésico** | Latitud y longitud WGS84 (GNSS u-blox), alturas en m | — | Ubicación |

- **"Derecha" del cuerpo:** se mira el cohete desde la cola hacia la nariz, con la marca hacia arriba. Así, la marca está en −Z del cuerpo.
- **Norte:** es el geográfico. Es el que sale del GNSS y del EKF con la declinación corregida.
- **Un cohete vertical, nariz arriba:** su X de cuerpo apunta a −Z NED, es decir, hacia arriba.

## 2. Cuaterniones

- **Convención:** Hamilton, con el escalar primero: `q = [w, x, y, z]`.
- **`q_cuerpo_a_ned`** rota vectores del cuerpo a NED: `v_ned = q ⊗ [0, v_cuerpo] ⊗ q*`. Su matriz es `R_ned_cuerpo`; cada columna es un eje del cuerpo expresado en NED.
- **`q_camara_a_cuerpo`** rota vectores de la cámara al cuerpo.
- **`q_camara_a_ned = q_cuerpo_a_ned ⊗ q_camara_a_cuerpo`** viene ya calculado en cada sidecar.
- **Interpolación:** la actitud se interpola con slerp entre dos muestras de pose (50 Hz). No conviene usar Euler: con el cohete vertical, el pitch vale ±90° y el roll y el yaw quedan indefinidos.
- **En la trama UART:** cada componente va como `int16 × 32767`. En los JSON va ya en `float` y normalizado.

Matriz a partir del cuaternión (con `w, x, y, z = q`):

```
R = [[1-2(y²+z²),  2(xy-wz),    2(xz+wy)],
     [2(xy+wz),    1-2(x²+z²),  2(yz-wx)],
     [2(xz-wy),    2(yz+wx),    1-2(x²+y²)]]
```

## 3. Las cámaras

- **Modelo:** dos Raspberry Pi Camera Module 3 estándar (IMX708):
  - 4608 × 2592 px;
  - FOV nominal ≈ 66° × 41°;
  - focal 4.74 mm, píxel 1.4 µm.
- **Montaje:** las dos van en la nariz, a 90° de la marca y a 180° entre sí.
- **Eje óptico:** apunta 60° por encima de la sección del cohete, hacia la nariz; es decir, a 30° del eje longitudinal.
- **Orientación de la imagen:** su horizontal es paralela a la sección.
  - En la cámara 0, la x de la imagen apunta hacia la marca (−Z del cuerpo).
  - En la cámara 1, apunta al lado opuesto (+Z).
  - En las dos, la y de la imagen (hacia abajo) queda en el plano X-Y del cuerpo, perpendicular al eje óptico: apunta hacia la cola y hacia afuera de su costado (cámara 0: −0.5·X + 0.866·Y).

| Índice | Nombre | Eje óptico en cuerpo | `R_camara_a_cuerpo` (columnas = x, y, z de la cámara en cuerpo) | `q_camara_a_cuerpo` |
| --- | --- | --- | --- | --- |
| 0 | derecha (+Y) | `cos30·X + sin30·Y` = (0.866, 0.5, 0) | `[[0, -0.5, 0.866], [0, 0.866, 0.5], [-1, 0, 0]]` | `[0.6830, -0.1830, 0.6830, 0.1830]` |
| 1 | izquierda (−Y) | `cos30·X − sin30·Y` = (0.866, −0.5, 0) | `[[0, -0.5, 0.866], [0, -0.866, -0.5], [1, 0, 0]]` | en el sidecar |

- **Extrínsecos (pendiente):** son nominales (`extrinsecos_confirmados: false`). Falta confirmar con una foto que el índice 0 sea la derecha y el sentido de la imagen.
  - Si una cámara resulta invertida, solo cambia su fila en `camaras.json`.
  - Los sidecars dicen qué versión del archivo se usó.
- **Intrínsecos:** se usa el modelo de cámara estenopeica.

  ```
  u = fx · x/z + cx
  v = fy · y/z + cy
  ```

  - Valores nominales: `fx = fy = 3385.7 px` (4.74 mm / 1.4 µm), `cx = 2304`, `cy = 1296`, sin distorsión (`distorsion: null`, `calibrado: false`).
  - Si la imagen se escala, se escalan `fx`, `fy`, `cx` y `cy`. El sidecar ya trae los valores de su imagen.
  - Falta calibrar con tablero, por cámara y con el foco de vuelo. La distorsión de la lente es apreciable en los bordes.
- **Distancia entre cámara y GNSS:** es de unos centímetros y se desprecia.

## 4. Tiempo

- **Hora de misión:** es UTC. La toma la LilyGo de su GNSS con PPS y la manda en cada pose. La Pi disciplina su reloj con chrony a partir de esa hora: fuente `LILY`, con desfase RMS de unos 1.5 µs medido en banco.
- **`tiempo.frame_wallclock_ns`:** es el inicio de la exposición de la primera fila del cuadro (`SensorTimestamp` de libcamera), en el reloj de la Pi.
- **`tiempo.centro_exposicion_utc_ns`:** es la hora de misión del centro de la exposición de la primera fila. Es la que se usa para interpolar la pose.
  - `residuo_reloj_ms` es la corrección aplicada: unos 0.015 ms medidos.
  - `hora_de_mision: true` indica que había hora de misión cerca del cuadro.
- **Obturador rodante:** el IMX708 tiene obturador rodante. Cada fila empieza un poco después que la anterior: `t_fila ≈ t_primera_fila + fila × t_linea`.
  - Con el cohete girando, eso deforma la imagen y desplaza la pose fila a fila.
  - **Pendiente:** medir `t_linea` en el modo de captura de vuelo. Mientras tanto, suponer que el tiempo de lectura total es de decenas de ms.
- **Sincronía entre cámaras:** se hace por software con libcamera (`SyncMode` servidor/cliente).
  - En el vuelo de banco del 2026-11-05, por pares del mismo `frame_id`: 0.019 ms de mediana, en 168 de 169 pares.
  - El único par fuera (19.5 ms) es el primer cuadro guardado, de antes de que libcamera reportara "Sync achieved". Recomendación: descartar los cuadros previos a la sincronía, o los que tengan una diferencia mayor de 1 ms con su par.
  - Las exposiciones de las dos cámaras fueron iguales (60 ms).
- **Diezmado:** los `frame_id` no son consecutivos.
  - El sensor captura a 10 fps, pero se guardan menos según la altura: el FPS objetivo baja al subir.
  - Hay huecos de hasta ~2 s entre cuadros guardados.
  - Una misma `frame_id` en las dos cámaras corresponde al mismo instante.

## 5. Posición y alturas

| Campo | Qué es | Fuente |
| --- | --- | --- |
| `lat_deg`, `lon_deg` | WGS84 | GNSS u-blox M10 (GPS+Galileo), 10 Hz; luego el EKF |
| `alt_agl_m` | Altura sobre el punto de lanzamiento | Barómetros (BMP581) con su p0 al armar, como el altímetro oficial. **No** es la altura sobre el terreno bajo el cohete |
| `alt_msl_m` | Altura sobre el nivel del mar = `suelo_msl + alt_agl` | — |
| `suelo_msl` (en la telemetría) | Altura MSL del sitio de lanzamiento | GNSS menos barómetro, promediado en tierra y fijo desde el despegue |
| `v_ned_mps` | Velocidad NED, en m/s | GNSS (luego el EKF) |
| `sd_pos_m`, `sd_alt_m`, `sd_actitud_deg` | Desviación estándar estimada | `null` = sin estimar (sin EKF). Hoy `sd_pos_m` es el hAcc del GNSS |

- **Geoide:** la altura MSL del GNSS usa el modelo de geoide interno del receptor. Si se cruza con un modelo de terreno (por ejemplo, Copernicus GLO-30, referido a EGM2008), puede haber diferencias de metros entre geoides. Hay que comprobarlo en el sitio con un punto conocido.
- **Altura sobre el terreno:** para intersecar con el terreno, la altura de la cámara sobre el suelo bajo ella es `alt_msl_m − terreno_msl(lat, lon)`, no `alt_agl_m`. Solo en un sitio plano coinciden.
- **Modelo del terreno:** está pendiente de entregar al equipo de visión.

## 6. Archivos de una misión (en la Pi, `~/demeter_recording/scientific_rec/`)

| Ruta | Contenido |
| --- | --- |
| `jpeg/<mision>/camN_frame_NNNNNN.jpg` | Imagen revelada, 4608 × 2592, JPEG |
| `jpeg/<mision>/camN_frame_NNNNNN.json` | **El sidecar del cuadro** (abajo) |
| `png/<mision>/camN_frame_NNNNNN.png` | La misma imagen en PNG RGB de 8 bits, sin pérdidas |
| `raw/<mision>/telemetry.jsonl` | Todas las poses de la LilyGo a 50 Hz, para interpolar por cuenta propia |
| `raw/<mision>/mission_report.json` | Resumen de la misión (tiempos, cuadros, alertas) |
| `raw/<mision>/chunk_*` | Los RAW Bayer originales |

`<mision>` es la hora UTC de ARM más un sufijo, por ejemplo `20261105_051446_428223`.

## 7. El sidecar de cada cuadro

Ejemplo real del vuelo de banco del 2026-11-05. Los valores están recortados, y la actitud es identidad porque no hay EKF:

```json
{
  "camera_index": 0,
  "frame_id": 83,
  "tiempo": {
    "frame_wallclock_ns": 1793851999957204282,
    "exposicion_us": 30023,
    "centro_exposicion_utc_ns": 1793851999972230564,
    "residuo_reloj_ms": 0.0148,
    "hora_de_mision": true,
    "utc": "2026-11-05T04:13:19.972231+00:00"
  },
  "camara": {
    "indice": 0, "nombre": "derecha", "calibracion": "camaras.json v1", "extrinsecos_confirmados": false,
    "q_camara_a_cuerpo": [0.6830, -0.1830, 0.6830, 0.1830],
    "intrinsecos": {"fx_px": 3385.7, "fy_px": 3385.7, "cx_px": 2304.0, "cy_px": 1296.0,
                    "ancho_px": 4608, "alto_px": 2592, "distorsion": null, "calibrado": false}
  },
  "pose": {
    "valida": false, "metodo": "slerp", "seq_antes": 26149, "seq_despues": 26150, "hueco_s": 0.0194,
    "lat_deg": 6.2283713, "lon_deg": -75.6044235, "alt_agl_m": 0.271, "alt_msl_m": 1592.541,
    "v_ned_mps": [2.15, 1.53, 6.37],
    "q_cuerpo_a_ned": [1.0, 0.0, 0.0, 0.0],
    "giro_cuerpo_dps": [0.0, 0.0, 0.0],
    "sd_actitud_deg": null, "sd_pos_m": 7.28, "sd_alt_m": null,
    "estado": {"ekf": false, "actitud": false, "posicion": true, "altura": true, "hora": true,
               "gnss_3d": true, "en_vuelo": true, "fuente_hora": "gnss_pps"}
  },
  "camara_en_ned": {
    "q_camara_a_ned": [0.6830, -0.1830, 0.6830, 0.1830],
    "eje_optico_ned": [0.866, 0.5, 0.0],
    "angulo_desde_nadir_deg": 90.0,
    "rumbo_eje_deg": 30.0
  }
}
```

**Cuándo confiar en un cuadro:**
- `pose.valida` es `true` solo si hay EKF, actitud y hora a la vez.
- Para ubicar en el terreno hacen falta, además, `estado.posicion` y una `sd_actitud_deg` pequeña: un error de 1° a 300 m desplaza el punto unos 5 m sobre el suelo, y más con la cámara inclinada.
- `hueco_s` es la distancia entre las dos poses usadas para interpolar (normal: 0.02 s). Más de 0.1 s indica un hueco en la telemetría.
- `giro_cuerpo_dps` sirve para estimar el desenfoque por movimiento: `blur_px ≈ fx · ω[rad/s] · t_exp`.

**Otros campos de `camara_en_ned`:**
- `angulo_desde_nadir_deg`: 0 es mirar hacia abajo.
- `rumbo_eje_deg`: rumbo del eje óptico, de 0 a 360 desde el norte.

## 8. De un píxel a un punto del suelo

```python
import math
import numpy as np

def R_desde_q(q):                              # q = [w, x, y, z], Hamilton
    w, x, y, z = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-w*z),   2*(x*z+w*y)],
                     [2*(x*y+w*z),   1-2*(x*x+z*z), 2*(y*z-w*x)],
                     [2*(x*z-w*y),   2*(y*z+w*x),   1-2*(x*x+y*y)]])

def pixel_al_suelo(sidecar, u, v, terreno_msl):
    """Interseca el rayo del píxel (u, v) con un plano horizontal a terreno_msl. Devuelve lat, lon y distancia."""
    K, p = sidecar["camara"]["intrinsecos"], sidecar["pose"]
    rayo_cam = np.array([(u - K["cx_px"]) / K["fx_px"], (v - K["cy_px"]) / K["fy_px"], 1.0])   # sin distorsión
    rayo_ned = R_desde_q(sidecar["camara_en_ned"]["q_camara_a_ned"]) @ rayo_cam
    h = p["alt_msl_m"] - terreno_msl              # altura de la cámara sobre ese terreno
    if rayo_ned[2] <= 0:                          # el rayo no baja: cielo u horizonte
        return None
    t = h / rayo_ned[2]
    n, e = t * rayo_ned[0], t * rayo_ned[1]       # metros al norte y al este de la cámara
    lat = p["lat_deg"] + math.degrees(n / 6378137.0)
    lon = p["lon_deg"] + math.degrees(e / (6378137.0 * math.cos(math.radians(p["lat_deg"]))))
    return lat, lon, t * np.linalg.norm(rayo_ned)
```

- **Comprobación:** con el cohete nariz abajo (`q_cuerpo_a_ned = [cos(−45°), 0, sin(−45°), 0]`) a 300 m sobre un terreno plano, el centro de la imagen de la cámara 0 cae 173 m al este, a 346 m de distancia. Su eje queda a 30° del nadir, hacia el lado +Y del cohete.
- **Terreno real:** hay que intersecar contra el modelo de terreno iterando el punto. Con la cámara casi horizontal, el error de actitud domina.
- **Aproximación:** se usa un plano local tangente, suficiente para cientos de metros. Para distancias mayores conviene ECEF.

## 9. Pendientes que afectan a visión

| Pendiente | Efecto | Quién |
| --- | --- | --- |
| EKF a bordo (actitud en la pose) | Sin él no hay `q_cuerpo_a_ned` real: no se puede ubicar nada | Firmware (Pablo) |
| Confirmar lado y sentido de cada cámara (foto) | Un índice cruzado pone los objetos en el lado opuesto | Pablo |
| Calibrar intrínsecos y distorsión (tablero, foco de vuelo) | Error angular en los bordes de la imagen | Visión y Pablo |
| Medir `t_linea` del obturador rodante | Pose por fila con el cohete girando | Visión y Pablo |
| Modelo del terreno y referencia del geoide | Altura de la cámara sobre el suelo bajo ella | Por definir |
