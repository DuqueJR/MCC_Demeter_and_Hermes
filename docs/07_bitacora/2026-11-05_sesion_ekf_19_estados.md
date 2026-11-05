---
fecha: 2026-11-05
tipo: sesion
ids: [D-057]
autor: Claude, con Pablo
rama: feature/ekf-19-estados
---
# EKF de 19 estados: sin BME280 y con factor de escala del giro

## Decisión (Pablo)

- El BME280 no es una observación activa del EKF: se registra y solo entra de respaldo si el BMP581 se calla más de 0.5 s.
  - Corrección: registra a unos 40 Hz, no a 1 Hz (DEM 0096: 40.2 Hz).
  - Lo que lo descarta es la calidad: 1.78 Pa de ruido frente a 0.32 del BMP581, y 105 Pa de diferencia entre los dos BME frente a 0.6 Pa entre los dos BMP581 en el mismo sitio.
- El factor de escala del giro entra como estado (3).
- La calibración viajará al cohete por LoRa a NVS.

## Cambios en `estacion/ekf.py`

- Estados: actitud (3), posición (3), velocidad (3), sesgo del giro (3), sesgo del acel (3), escala del giro (3) y sesgo del BMP581 (1) = 19.
- Modelo del giro: `w_medido = (1 + sg)·w + bg`; en la predicción, `w = (w_medido − bg) / (1 + sg)` y `∂θ̇/∂sg = −diag(w)`.
- Incertidumbre inicial de la escala: 3 %. Ruido de proceso de la escala: 2e-5/√s. El ruido de escala no modelado baja de 2 % a 0.5 %.
- Opciones para comparar: `--sin-escala` (escala fija en cero, como antes) y `--con-bme` (el BME280 entra siempre).
- CSV: columnas nuevas `sgx_pct`, `sgy_pct`, `sgz_pct` y sus sigmas; `b_bme_m` queda en NaN. El dashboard grafica la escala y la muestra en las estadísticas.

## Comparación en DEM 0092 (calibración en la cancha, con giros)

| | Antes (17) | Ahora (19) |
| --- | --- | --- |
| Escala estimada x y z | — | +0.75, −0.09, +1.49 % (1σ 0.11, 0.15, 0.10 %) |
| Sigma de actitud x y z | 0.82, 0.35, 0.22° | 0.59, 0.26, 0.17° |
| Innovación MMC / QMC | 1.90 / 2.40° | 1.50 / 2.20° |
| Campo no terrestre MMC / QMC | 404 / 191 | 313 / 109 |
| Innovación BMP | 0.110 m | 0.087 m |
| Error al llegar a nariz arriba / abajo | 0.18 / 0.12° | 0.03 / 0.08° |

La escala es observable cuando el cohete gira, y en vuelo girará. Las dos posiciones con errores de 85-91° son el defecto conocido de los nombres por orden de aparición en el cotejo de `ekf.py`, no errores del filtro.

## Comparación sin giros a mano: el viaje (0093) y el alcance (0094), sin magnetómetros

| | 0093 antes | 0093 ahora | 0094 antes | 0094 ahora |
| --- | --- | --- | --- | --- |
| Escala estimada x y z | — | +0.46, +0.30, −3.18 % (1σ 0.28, 0.59, 0.76) | — | +0.72, −0.04, +3.21 % (1σ 0.71, 0.38, 0.32) |
| Sigma de actitud x y z | 1.19, 0.13, 0.16° | 0.86, 0.12, 0.14° | 0.12, 0.62, 1.25° | 0.12, 0.57, 1.16° |
| Velocidad GNSS rechazada | 40 | 41 | 137 | 103 |
| Innovación de la gravedad | 0.775° | 0.774° | 0.911° | 0.900° |

**Lectura:**
- La escala en x es coherente en los tres logs (+0.5 a +0.75 %).
- La escala en z no lo es: +1.49 % ± 0.10 en la cancha, −3.2 % ± 0.8 en el viaje (casi no observable: con la nariz arriba, z queda horizontal y casi no gira) y +3.2 % ± 0.3 en el alcance.
- En el carro, sin magnetómetro, el rumbo solo se observa por el GNSS en las curvas, y la escala de z absorbe parte de ese error y de la vibración.
- El filtro ajusta un poco mejor (sigmas y rechazos), pero el valor de la escala en z no es todavía una medida confiable.

**Propuesta:** mantener los estados de escala, pero darles un valor inicial medido.
- `calib.py` estima la escala del giro en la fase de "2 min girando" de la guía, contra la gravedad y el magnetómetro, con el cohete cerrado.
- El EKF arranca de ese valor con una sigma de unos 0.5 % y un ruido de proceso menor.
- En vuelo el giro es rápido (alabeo de cientos de dps): un 1 % de escala a 300 dps son 3 dps, que deriva la actitud muy rápido. Por eso vale la pena el estado.
