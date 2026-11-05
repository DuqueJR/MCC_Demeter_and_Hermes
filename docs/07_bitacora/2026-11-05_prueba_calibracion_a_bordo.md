---
fecha: 2026-11-05
tipo: prueba
ids: [D-059, D-058]
autor: Claude, con Pablo
rama: feature/calibracion-a-bordo
---
# Primera prueba de la calibración a bordo (Demeter, cohete cerrado)

## Qué hizo Pablo

- Calibración guiada con Demeter cerrado. Empezó con 30 min de curva de calentamiento; la Pi transmitía las cámaras para dar estrés térmico, y su disipador se calentó bastante.
- Al terminar la guía, el cohete volvió a TIERRA y se mandó `cal analizar`.
- Registro: DEM 0101 a 0104, cuatro archivos de 32 MB desde las 14:32.

## Qué pasó (sesión de tierra `20261105_141502_tierra.txt`)

- **El análisis corrió entero sin reinicios ni watchdog.** Pasada 1, cálculo y pasada 2 en **unos 3 min** (178 s), con el progreso cada 4 s. El resumen bajó por radio (`@C`) y las dos páginas llegaron.
- **Resultado:** LISTO con avisos `0x00404002`, es decir solo 3 posiciones (`AV_POCAS_POS`) y los dos magnetómetros con posiciones insuficientes. Sin calibración aplicada.
- **`calib.py` en el PC con DEM 0101** (descargado por USB): 1 posición; los magnetómetros descartaron 18-20 mil muestras como "campo anómalo".

## Causa

1. **El registro ocupa 4 archivos y cada lado leyó uno.**
   - El cohete leyó solo el último (0104), que tenía las últimas 3 posiciones y el giro.
   - En el PC, la guía bajó el primero (0101), que tenía solo el calentamiento.
2. **El calentamiento rompía la calibración aunque estuviera todo:**
   - 30 min quieto son un tramo quieto más: cuenta como posición, y si es la más larga de su orientación reemplaza a la de la guía.
   - En los magnetómetros, la mediana queda en ese punto, y el filtro "lejos de la mediana" descarta el giro.
   - A bordo, 45 min de MMC y QMC (unos 9 MB) no caben en la PSRAM de 8 MB.

## Corrección (sin compilar en la placa)

**Cabecera FILEHDR v3** (`logger.cpp`, `rec_format.h`): byte 73 con `FH_CONTINUA` cuando el archivo sigue al anterior por llenarse. `tblog` lo muestra.

**Un registro = varios archivos:**
- **A bordo (`cal_onboard.cpp`):**
  - toma el archivo de índice más alto y, hacia atrás, los que este continúa (mismo arranque y, desde v3, la bandera; en v1-v2 basta el mismo arranque), hasta 16;
  - los lee en orden en las dos pasadas, sin leer la cola de ceros;
  - `[cal ]` muestra el primero y cuántos siguen.
- **En el PC:**
  - `tblog.registro` y `calib.py` con el primer archivo toman los siguientes de la misma carpeta (`--solo` lo evita);
  - `tbget get NOMBRE --registro` baja los que siguen, mirando las cabeceras en la placa;
  - "Bajar y analizar" del dashboard lo usa.

**Calentamiento** (`cal_core.cpp` y `calib.py`, la misma regla):
- un tramo quieto de 2 min o más seguido de posiciones de la guía;
- la guía empieza al final del último de esos tramos;
- antes de eso no hay posiciones ni magnetómetros; la curva de temperatura sí usa todo;
- el reposo largo del final no cuenta, porque no lo siguen posiciones.

A bordo, los magnetómetros pasan a la segunda pasada, ya con el inicio de la guía conocido; solo se guardan los de la guía.

## Verificación en el PC

**Registro sintético:** el calentamiento real de DEM 0101 (752 s quieto) seguido de la guía de DEM 0091, corrida en el tiempo. Se armó en dos archivos (el segundo con `FH_CONTINUA`) y en uno solo.
- **`calib.py` con el primer archivo:**
  - toma los dos y reconoce 756 s de calentamiento;
  - encuentra 6 de 6 posiciones, sin avisos;
  - da lo mismo que la guía sola: sesgos a 0.02 mg, centros de los magnetómetros a 0.04 mG.
- **C++ contra `calib.py`** (`comparar_cal.py`):
  - 0 magnitudes fuera de tolerancia en el sintético y en DEM 0091, HER 0023, DEM 0092 y HER 0024;
  - ida y vuelta del blob correcta.

**Hallazgo de proceso:** `build/prueba_cal` no lo recompilaba nadie, así que una comparación podía hacerse contra un binario viejo. Ahora `correr_pruebas.py` recompila `prueba_cal` y `prueba_cal_blob` siempre.

**Pruebas:** `correr_pruebas.py`, todo OK; `estacion/pruebas`, 120 OK.

## Pendiente

- Cargar el firmware y repetir. Los archivos 0101-0104 que ya están en la SD son v2 y comparten arranque, así que el cohete los debería tomar juntos si siguen siendo los últimos.
- Bajar DEM 0102-0104 (`tbget get 101 --registro`) para comparar el cohete con `calib.py` sobre la captura real.
- Con eso, medir el tiempo del análisis de 4 archivos y la memoria.
