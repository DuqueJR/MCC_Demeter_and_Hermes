---
fecha: 2026-11-05
tipo: sesion
ids: [D-060]
autor: Claude, con Pablo
rama: feature/ekf-a-bordo
---
# EKF a bordo

## Decisión (Pablo)

"El EKF debe estar a bordo, no hay forma de no hacerlo así." Se porta `estacion/ekf.py` tal como está validado, sin rediseñarlo.

## Qué se hizo (sin compilar en la placa; Pablo compila y carga)

**Núcleo: `ekf_core.h/.cpp`, C++11 puro.** Es el mismo código para el cohete y para el PC.
- Los mismos 19 errores, constantes, puertas y pesos por fase que `ekf.py`.
- IMU virtual: 0,8 LSM + 0,2 QMI, o solo el LSM si el QMI satura o discrepa.
- Medidas: GNSS (posición horizontal y velocidad), BMP581 (con el BME280 solo de respaldo), rumbo de MMC y QMC con la puerta de campo terrestre, y gravedad cuando está quieto.
- **Tiempo real:**
  - el filtro corre 300 ms atrasado, para tener el GNSS y el QMI (que va 42 ms atrasado);
  - `presente()` lleva el estado al instante actual integrando el IMU guardado;
  - arranca solo cuando encuentra 1,5 s quieto, con la misma búsqueda que `find_still`.
- **CPU:**
  - la covarianza se propaga con la F dispersa: unas 1400 multiplicaciones por paso, en vez de 14 000 densas;
  - todo en float (la FPU de la S3); el PC compila también en double para comparar.

**Tarea `ekf_task`** (núcleo 1, prioridad 3, cada 5 ms):
- **Entradas:**
  - cada muestra del LSM y del QMI, por anillos SPSC que llenan `ext_lsm` e `in_imu`;
  - BMP581, BME280, MMC, QMC y GNSS, por sus `Latest`;
  - el momento de la misión;
  - la ventana de TX de la radio (`ekfTx`), para descartar el magnetómetro como lo hace `calib.load`.
- **Reinicio y calibración:**
  - se reinicia al pasar de TIERRA a ARMED: sesgos, p0, actitud en la rampa y la temperatura del suelo (`ambTempC`);
  - toma la calibración activa (`calActiva`) y la recarga si cambia, fuera de ARMED y FLY;
  - sin calibración usa el montaje nominal y no usa magnetómetros.
- **Salidas:**
  - `g_ekf`: el estado llevado al presente;
  - **TELEM:** cuaternión, aceleración y giro en cuerpo; con origen GNSS, además posición, velocidad y altura;
  - **POSE de la Pi:** cuaternión, giro, altura sobre el p0 y sigmas, con `F_EKF`, `F_ATT` y `F_ALT`; con origen GNSS, además posición y `F_POS`;
  - **`T_EKF` (16):** 152 B a 50 Hz en el anillo `RING_EKF`;
  - **monitor:** la línea `[ekf ]`.

**`tblog`:** lee `T_EKF` y con `--csv` deja `ekf_abordo.csv`.

## Verificación en el PC (float, como en el cohete)

**Logs reales** (`test/host/comparar_ekf.py`): el C++ sobre el mismo log, alimentado en orden de llegada y avanzando cada 5 ms como la tarea, contra `ekf.py`. Calibraciones de la cancha del 3 nov, recalculadas.

| | DEM 0094 (24 min, prueba de alcance) |
| --- | --- |
| Actitud | p95 0,08°, mediana 0,000° |
| Posición | p95 1-2 cm |
| Velocidad | p95 4-6 mm/s |
| Altura barométrica | p95 4 mm |
| Sesgos del giro | iguales a 0,001 dps |
| Medidas aceptadas y rechazadas | casi iguales (GNSS 11 758 contra 11 761; gravedad 8994 contra 8970) |

El máximo de 7,5° en actitud es del arranque: el C++ busca el reposo en vivo y `ekf.py` en todo el log. Converge enseguida.

**Vuelo sintético de Demeter** (`vuelo_sintetico.py demeter --cpp`): mismas muestras para los dos. Error contra la verdad, mediana / máximo de la actitud:

| Fase | ekf.py | C++ a bordo |
| --- | --- | --- |
| Rampa | 0,10 / 2,72° | 0,10 / 2,25° |
| Empuje | 0,33 / 1,51° | 0,34 / 1,48° |
| Inercia | 0,50 / 1,82° | 0,34 / 1,84° |
| Eyección + 2 s | 1,50 / 6,28° | 1,57 / 6,37° |
| Paracaídas | 0,16 / 6,27° | 0,11 / 6,36° |
| Suelo | 0,08 / 0,32° | 0,08 / 0,32° |

Horizontal, altura y velocidad quedan iguales a la décima. El factor de escala del giro se estima igual (real 0,75 / 0 / 1,5 %; C++ 0,76 / −0,15 / 1,48 %).

**Pruebas:** `correr_pruebas.py` todo OK, con `ekf_core.cpp` y `ekf_task.cpp` en la revisión de sintaxis y los arneses `prueba_ekf` (float y double) compilados siempre.

## Para probar en la placa

1. Cargar `demeter` y `hermes`.
2. En el monitor, `[ekf ]` dice "buscando reposo" hasta que el cohete esté 1,5 s quieto, y después muestra la actitud. Probar girándolo a mano:
   - guiñada, cabeceo y alabeo coherentes;
   - `ciclo_max` muy por debajo de 5000 µs;
   - `perdidas` en 0.
3. Con GNSS a cielo abierto debe salir "con origen GNSS", y el dashboard recibe la posición del EKF.
4. Registrar con FLY forzado, bajar el log y comparar `ekf_abordo.csv` con `ekf.py` sobre el mismo archivo.

## Pendiente

- **Reinicio en vuelo:** si la placa se reinicia en FLY, el EKF no arranca, porque no encuentra reposo. Hay que arrancarlo con la gravedad promediada o con la actitud guardada.
- `ciclo_max` y la memoria real en la ESP32-S3.
- Usar el EKF en la detección de momentos (apogeo, aterrizaje). Hoy la misión no lo lee: el EKF lee la misión, como en `ekf.py`.
