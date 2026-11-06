---
fecha: 2026-11-05
tipo: sesion
ids: [D-058]
autor: Claude, con Pablo
rama: feature/temperatura-suelo
---
# Temperatura del suelo: muestra en frío, revisión al armar y ambiente en la telemetría

## Por qué

- El vuelo sintético mostró que la altura barométrica con la atmósfera estándar (15 °C) sale un 5.5 % alta a 31 °C: 37 m en el apogeo de Demeter.
- Pablo decidió que la temperatura salga del BMP581: no hay otra fuente mejor (tierra no tiene barómetro ni termómetro). Acepta ±2-3 m en el apogeo, el límite que pone la temperatura de la columna de aire.

## Qué se hizo

**Firmware:**
- **`amb_calc.h`** (C++ puro, probado en PC):
  - evalúa la muestra: media de los primeros segundos y pendiente;
  - la contrasta con el BME280;
  - revisa el armado;
  - calcula la altura hipsométrica.
- **`amb_temp.cpp/.h`:**
  - decide si el arranque es frío: encendido, o sueño profundo de 30 min o más, medido con `gettimeofday`, que sigue en el sueño;
  - toma la muestra entre los 3 y los 23 s;
  - la guarda en NVS (`tbamb`) y le pone hora UTC cuando la hay;
  - la registra (`T_AMB`, 14), también al empezar a registrar;
  - expone `ambTempC()` y `ambArmBits()`.
- **Misión:** la altura (y con ella la POSE a la Pi y la detección barométrica de BOOST) usa la temperatura del suelo. ARM agrega el motivo 23 `RZ_TEMP`.
- **Radio:** paquete `AMB` (18 B) cada 10 s en lugar de un TELEM. Tierra lo reenvía como `@A`. `web1.py` no se toca: ignora esa línea.
- **Monitor:** línea `[amb ]`. `core_sleep` anota la hora antes de dormir.

**Estación:**
- **Dashboard de control (Mando):**
  - la temperatura del suelo (buena o dudosa, fuente y edad);
  - el BMP, el BME y la presión de ahora;
  - si sirve para armar;
  - la diferencia con el otro cohete (Hermes en tierra como referencia).
- **Historial:** anota la muestra y los cambios de aptitud. El modo demo lo simula.
- **Calibración:**
  - la guía puede empezar con 30 min de curva de calentamiento en frío, con la Pi encendida a los 5 min en Demeter;
  - `calib.py` ajusta la curva del BMP y del BME (`T0`, `τ`, subida a 5, 10 y 30 min dentro de lo registrado) y la guarda en el JSON, como información; no cuenta como aviso.
- **`tblog.py`** lee `T_AMB`.

## Lo que mostraron los datos

- **Sesiones de banco** con `[boot]`, cohete abierto: +0.3 a +0.9 °C en 10 min; el BME lee 0.5-1.5 °C más que el BMP.
- **DEM 0092** (cancha, al aire libre, con sol): el BMP subió 1.7 °C en 5 min (τ ≈ 1.7 min). Es un aviso de que el sol o el arranque pueden calentar más rápido de lo que se vio en banco.

## Pruebas

- `firmware/cohete/test/host/correr_pruebas.py` con g++: todo OK, con `prueba_amb.cpp` (22 comprobaciones), `amb_temp.cpp` en la revisión de sintaxis y `RZ_COUNT = 24`.
- `estacion/pruebas`: 120 OK.
- Dashboard probado en el navegador con el modo demo.

## Pendiente

- **Prueba en hardware:** calibración con el cohete cerrado empezando en frío. Da la curva real y con ella los umbrales: 2 °C BMP/BME, 0.1 °C/min, 6 °C de deriva y 4 °C al armar son provisionales.
- **Comprobar en la placa** que `gettimeofday` sigue en el sueño profundo. Si no, solo el encendido cuenta como frío.
- **El EKF a bordo** usará `ambTempC()`.
- **La muestra "a mano"** (`F_MANO`) llegará con el comando de calibración por LoRa a NVS.
