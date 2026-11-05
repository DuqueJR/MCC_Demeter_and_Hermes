---
fecha: 2026-11-05
tipo: sesion
ids: [D-059]
autor: Claude, con Pablo
rama: feature/calibracion-a-bordo
---
# Calibración a bordo

## Decisión (Pablo)

- El USB no es accesible con el cohete cerrado, y la calibración válida es la del cohete cerrado.
- Por eso el cohete analiza su propio registro y solo baja un resumen por radio. Con USB disponible, la calibración se carga por USB.
- Se descartan subir la calibración por LoRa y el modo de TDMA para calibrar. El diseño queda en [calibracion_nvs](../04_diseno/calibracion_nvs.md).

## Qué se hizo (sin compilar en la placa; Pablo compila y carga)

**Núcleo:**
- `cal_core.h/.cpp`: `estacion/calib.py` en C++11 puro, sin Arduino. Dos pasadas sobre el registro, con resúmenes por ventana para que quepa en la ESP32.
- `cal_blob.h`: formato binario de la calibración (secciones y CRC32).

**Cohete:**
- `cal_onboard.cpp/.h`:
  - tarea de análisis que lee la SD con su semáforo y cede CPU;
  - NVS en dos ranuras con verificación;
  - paquetes `CAL_RES` (dos páginas);
  - registro `T_CAL` (15);
  - carga por USB (`TBCAL`).
- **Misión:** órdenes `cal analizar|aplicar|descartar|anterior` (ops 12-15). Aplicar y volver a la anterior van siempre en dos pasos. Motivos 24 (no se puede forzar) y 25 (avisos, se puede forzar). Forzar una calibración no marca la misión como FORZADA.
- **Monitor:** línea `[cal ]` con el CRC32 activo y el estado del análisis.

**Tierra:**
- reenvía `CAL_RES` como `@C`;
- entiende `cal <orden>`.

**Estación:**
- **Dashboard de control (pestaña Calibración):** panel "A bordo, sin USB" con las órdenes, el estado, los avisos en texto y las tablas de resultados como las de `calib.py`, más el botón de respaldo "Cargar por USB".
- **`cal_blob.py`:** arma el blob desde el JSON de `calib.py` y lo carga por USB.
- **`tblog`:** lee `T_CAL`.
- **Separación:** `web1.py` y la web pública no cambian.

## Verificación en el PC

- **`comparar_cal.py`:** `cal_core` contra `calib.py` sobre DEM 0091, HER 0023, DEM 0092 y HER 0024 (los dos últimos con posiciones sobre el portátil y descartes). 0 magnitudes fuera de tolerancia:
  - rotaciones de los IMU a 0.01°;
  - sesgos a 0.01 mg;
  - escalas a 11 ppm;
  - retraso del QMI igual (42 ms);
  - ganancia a 0.002;
  - magnetómetros a menos de 0.02 mG en centro y radio;
  - rotación de los magnetómetros a cuerpo a 0.3°.
- **Sin calibración anterior**, nombra las posiciones con el montaje nominal y queda sin avisos.
- **Ida y vuelta del blob:** el del cohete lo lee Python, y el que arma Python desde `calib.py` lo lee y lo acepta el firmware.
- **`correr_pruebas.py` con g++:** todo OK, con `cal_onboard.cpp` y `cal_core.cpp` en la revisión de sintaxis.
- **`estacion/pruebas`:** 120 OK.
- **Dashboard** probado en el navegador con el modo demo.

## Pendiente

- **En la placa:**
  - que la memoria alcance (los vectores grandes deben ir a PSRAM);
  - cuánto tarda el análisis de un registro de unos 10 min;
  - que no salte el watchdog;
  - que el resumen llegue por radio.
- **Prueba sugerida:**
  1. Con el cohete cerrado, hacer la guía.
  2. Mandar `cal analizar` y comparar el resumen con `calib.py` sobre el mismo archivo, bajado después por USB.
  3. Aplicar.
  4. Reiniciar y ver el CRC32 activo en `[cal ]`.
