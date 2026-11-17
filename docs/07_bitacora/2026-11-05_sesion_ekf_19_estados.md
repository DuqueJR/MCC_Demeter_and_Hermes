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

## Vuelo sintético, pesos por fase y temperatura del suelo

**`estacion/vuelo_sintetico.py`:**
- Toma la simulación de OpenRocket de cada cohete: trayectoria, elevación y rumbo, empuje, presión y eventos.
- Genera los sensores con los ruidos y sesgos de los logs de banco: LSM a 1610 Hz (±32 g), QMI a 445 Hz (±16 g, satura en el empuje), BMP, BME, MMC, QMC, GNSS a 10 Hz con PPS, y los momentos de la misión con sus retardos de detección.
- Corre el mismo `ekf.py` (`navigate`) y compara contra la verdad.
- **Supuestos, todos parametrizados:**
  - alabeo de hasta 200 dps;
  - vibración del motor de 1 g;
  - escala real del giro de +0.75 / 0 / +1.5 %;
  - choque de la carga (25 g, 15 ms) y su pulso de presión (+300 Pa, τ 0.15 s);
  - volteo a colgar del paracaídas en 1 s;
  - nariz abajo con balanceo de ±10° bajo el paracaídas;
  - pérdida del GNSS por encima de 4 g, con recuperación en 1.5 s;
  - impacto contra el suelo en 0.15 s.

**Pesos por fase en `ekf.py`:**
- Tabla `FASES`: multiplica el ruido de proceso (acel, giro) y el de medida (GNSS, barómetro, magnetómetro), o apaga la medida.
- La fase sale del momento de la misión: `T_MISSION` en los logs reales, la verdad con retardos en el sintético.
- Fases: reposo, boost, coast, eyección (2 s tras PARACAIDAS, sin barómetro ni magnetómetro), paracaídas y aterrizaje.
- `--sin-fases` lo apaga.

**Temperatura del suelo (hallazgo):**
- `ekf.py` convertía la presión con la atmósfera estándar (15 °C).
- La simulación de Demeter tiene 31 °C en el sitio: eso daba **25-37 m de error de altura** (un 5.5 %).
- Ahora la altura barométrica usa la temperatura del suelo: `--t-suelo`, o la del BMP581 en la ventana quieta.
- Con eso, Demeter queda en 2-5 m.
- **En vuelo:** la temperatura del BMP581 está calentada por la electrónica, así que conviene ingresar la del aire en las condiciones de misión del dashboard y enviarla con la calibración.

**Resultados, mediana / máximo del error de actitud en grados:**

| Fase | Hermes completo | sin fases | sin escala | Demeter completo | sin fases | sin escala |
| --- | --- | --- | --- | --- | --- | --- |
| Empuje | 0.37 / 1.31 | 0.33 / 0.57 | 0.37 / 1.70 | 0.33 / 1.51 | 0.30 / 0.86 | 0.33 / 2.42 |
| Inercia | 0.67 / 1.72 | 0.41 / 0.70 | 1.53 / 4.23 | 0.50 / 1.82 | 0.49 / 0.89 | 1.67 / 8.12 |
| Eyección + 2 s | 2.34 / 12.96 | 10.24 / 34.13 | 1.84 / 11.21 | 1.50 / 6.28 | 3.05 / 11.96 | 1.41 / 3.84 |
| Paracaídas | 0.13 / 11.05 | 0.45 / 25.75 | 0.67 / 10.33 | 0.16 / 6.27 | 0.28 / 32.31 | 0.68 / 4.07 |
| Suelo | 0.06 / 0.30 | 0.23 / 1.79 | 0.09 / 1.14 | 0.08 / 0.32 | 0.19 / 1.72 | 0.08 / 0.61 |

**Lectura:**
- **Las fases** son las que evitan perder la actitud en la carga y bajo el paracaídas (máximos de 25-34° sin fases). En el empuje y la inercia todavía restan un poco (máximos de 1.3-1.8° frente a 0.6-0.9°): queda por ajustar con el vuelo real.
- **La escala** sí importa con alabeo: sin ella, la inercia llega a 4-8°. En el eje de alabeo se estima bien (+0.76/+0.78 % frente a +0.75 % real). Los ejes que casi no giran quedan con sigma de 0.6-1 %, por eso conviene darles un valor inicial medido en `calib.py`.
- **La posición horizontal** queda en 0.4-2.8 m y la velocidad en menos de 0.7 m/s, salvo en la carga (unos 2.3 m/s).
- **La altura** queda en 2-5 m. La diferencia de 1 % entre la atmósfera de OpenRocket y la fórmula hipsométrica es lo que queda.

**Validez:** son pruebas sobre supuestos. Los números sirven para comparar variantes, no para predecir el vuelo. El primer vuelo real dirá la vibración, el alabeo y el comportamiento del GNSS.

## Temperatura del suelo: decisiones y estrategia (Pablo, 2026-11-05)

- **Fuente:** la temperatura para la altura barométrica sale del BMP581. No hay otra fuente mejor: tierra no tiene barómetro ni termómetro.
- **Precisión aceptada:** ±2-3 m en el apogeo.
  - Los 3.3 cm del BMP581 son su precisión entre muestras.
  - La altura absoluta sobre unos 670 m depende de la temperatura de toda la columna de aire: el gradiente real puede ser de hasta 9.8 °C/km a mediodía, frente a los 6.5 de la fórmula. Eso es el límite físico, no del sensor.
- **Simulaciones:** ninguna tiene la atmósfera de Santa Fe de Antioquia. Hermes trae la atmósfera estándar (11.7 °C, 953.5 hPa); Demeter trae 31 °C con 1014.9 hPa, la presión del nivel del mar. Hay que corregir las condiciones del sitio en los archivos de OpenRocket.
- **Calentamiento medido en banco** (sesiones con `[boot]`, cohete abierto): +0.3 a +0.9 °C en 10 min. El BME (en la placa) lee 0.5-1.5 °C más que el BMP, salvo una sesión.

### Estrategia propuesta (sin implementar)

1. **Muestra en frío:** en los primeros 10-30 s tras encender o despertar, antes de transmitir a 22 dBm y antes de encender la Pi. Cuenta como fría si la placa llevaba más de 30 min apagada o dormida. Al despertar para el lanzamiento ya la tiene.
2. **Contraste BMP con BME:** la muestra vale si difieren menos de 1.5 °C y ninguno sube más de 0.05 °C/min. Si no, queda marcada como dudosa y se usa la menor.
3. **NVS:** se guarda con su hora UTC.
4. **ARM revisa la temperatura:** compara la muestra fría con el BMP y el BME de ese momento. Una discrepancia grande es un motivo de "no apto", que se puede forzar.
5. **Dashboard:** la muestra, su hora y su coherencia, más las temperaturas actuales; corrección por el comando de calibración a NVS.
6. **Hermes como referencia en tierra (idea de Pablo):** Hermes no lleva la Pi; si está en tierra (incluso abierto) mientras vuela Demeter, su BMP581 sirve de termómetro y de barómetro de referencia.
   - Con eso se ve cuánto se desvía la temperatura de Demeter.
   - También se ve la deriva de la presión por el clima durante el vuelo (unos 0.5 hPa/h, unos 4 m/h).
   - Requiere que la telemetría lleve la temperatura y la presión del BMP con buena resolución. Hoy TELEM solo trae `temp_c[0]` del BME en grados enteros, así que hay que ampliar el contrato: candidato, el LogInfo de cada 5 s.

### Pendientes en hardware

- Calibrar con el cohete cerrado en el fuselaje: la calibración correcta.
- En la misma sesión, la curva de calentamiento: encender Demeter en frío y cerrado, encender la Pi a los 5 min y registrar 30 min.
