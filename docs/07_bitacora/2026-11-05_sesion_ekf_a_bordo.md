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

## Primera prueba en la placa (Pablo, Demeter, sin calibracion activa)

El EKF corre en vivo: `ciclo_max=14216 us`, `perdidas=0/0` y "con origen GNSS". Lo que salió mal y cómo se corrigió:

- **Rotación invertida en el dashboard** (el cabeceo bien; el alabeo y la guiñada al revés).
  - La vista 3D de la ventana EKF estaba espejada: proyectaba una vista desde abajo y la mostraba como si fuera desde arriba.
  - Se corrigió en `dashboard_ekf.js`. Se comprobó en el papel: N→E queda en sentido horario visto desde arriba.
  - El EKF no tenía la culpa: los ángulos de `[ekf ]` salen del mismo cuaternión.
- **Montaje nominal del QMI** (sin calibración): tenía los mismos ejes que el LSM.
  - Las calibraciones de ambos cohetes dan y y z del cuerpo al revés, porque el chip va girado 180° sobre x.
  - Con la gravedad en contra, el QMI quedaba siempre descartado por discrepancia, así que el error no se veía en la actitud.
  - `configNominal` ahora usa `{{0,1,0},{0,0,1},{1,0,0}}`.
- **Fluidez y latencia.** En TIERRA, TELEM va a 2 Hz y el dashboard la consultaba cada 500 ms. Cambios:
  - El dashboard consulta cada 200 ms.
  - Entre dos TELEM, la vista 3D lleva el último cuaternión al presente con el giro en cuerpo de TELEM, hasta 0,7 s.
  - Con el cohete conectado por USB, el dashboard le pide `E` cada 2 s y el cohete manda `@E q w sd` a 25 Hz. Deja de mandarlo a los 5 s sin pedido, así que un monitor serie normal no lo ve.
  - La vista 3D dice qué fuente usa: USB a 25 Hz, TELEM + giro, o solo TELEM.
- **Ciclo.**
  - `[ekf ]` muestra ahora `ciclo_prom`, `max` y `lentos` (ciclos de más de 5 ms), para saber si los 14 ms son raros o frecuentes.
  - `imuPaso` suma en `Real`: en la S3, double es por software.
- **Campo de Calibración** que se borraba al escribir: la página se reescribe cada segundo (por la edad del resumen). Ahora conserva el texto, el foco y el cursor.

## Reinicio en vuelo (resuelto, sin validar en la placa)

- **La foto.** En FLY y RECOVERY, la tarea guarda una foto del filtro en `RTC_NOINIT` a 10 Hz (`ekf::Foto`, con CRC):
  - actitud, velocidad, posición, sesgos, sesgo inicial del giro, origen, p0 y escala de altura;
  - el último giro y la última aceleración.
  - Sobrevive a un reinicio por software, por perro guardián o por pánico. En TIERRA y ARMED se invalida.
- **Al arrancar,** si la misión se reanudó en FLY o RECOVERY (`TF_REANUDADO`):
  - **Con foto:** sigue desde ella. El tiempo sin filtro (`gettimeofday`, que el RTC mantiene a través del reinicio) se proyecta con el último giro (hasta 3 s) y la última aceleración (hasta 2 s). La incertidumbre crece con ese tiempo.
  - **Sin foto** (corte de alimentación), en FLY: arranca con 0,5 s de IMU.
    - Actitud: la gravedad si |a| está cerca de 1 g; si no (empuje o inercia), la nariz arriba.
    - Rumbo: el último campo del magnetómetro.
    - Altura: el p0 de la misión (`missionP0`) y la última presión del BMP.
    - Sesgos del giro: desconocidos.
  - **Sin foto,** en RECOVERY: busca el reposo en el suelo, como siempre.
- **Monitor:** `[ekf ] ... arranque=reposo|foto_RTC|vuelo_gravedad|vuelo_nariz_arriba (N s sin filtro)`.
- **Prueba en el PC:** `EKF_REINICIO="t,foto|sinfoto,gap"` en `prueba_ekf` simula el reinicio. Ejemplo: `EKF_REINICIO=30.6,foto,1.5 python vuelo_sintetico.py demeter --cpp`.
  - **Vuelo sintético de Demeter** (alabeo de 200 °/s): el hueco y el transitorio que le sigue dejan picos. En la mediana de actitud por fase:

    | Reinicio | Resultado |
    | --- | --- |
    | Empuje, 1,5 s sin datos | inercia 0,86°, eyección 0,39° |
    | Inercia, 4 s sin datos | inercia 5,4°, paracaídas 0,9° |
    | Paracaídas, 1,5 s sin datos | paracaídas 0,26° |
    | Sin foto, en empuje | inercia 1,0° |
    | Sin foto, en inercia | inercia 1,8° |

    Sin foto, la posición horizontal queda corrida 20-36 m frente a la verdad, porque el origen nuevo es el primer GNSS tras el reinicio; la latitud y longitud son las correctas.
  - **DEM 0094**, reinicio a los 1000 s, contra la misma corrida sin reinicio:
    - con foto, 2 s sin datos: menos de 3° desde los 2 s y |dv| < 0,2 m/s;
    - sin foto: 1-7° desde los 15 s, con el rumbo débil porque en el carro no hay magnetómetro.

## Pendiente

- `ciclo_prom`, `lentos` y la memoria real en la ESP32-S3.
- En la placa: un reinicio en FLY forzado (por ejemplo, `reiniciar` desde tierra) debe mostrar `arranque=foto_RTC`.
- Usar el EKF en la detección de momentos (apogeo, aterrizaje). Hoy la misión no lo lee: el EKF lee la misión, como en `ekf.py`.
