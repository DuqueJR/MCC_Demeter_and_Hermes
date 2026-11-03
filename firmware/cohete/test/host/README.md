# test/host: pruebas en el PC de la detección de BOOST (T-410)

Corren con `g++` y Python. **No necesitan PlatformIO, ESP32 ni placa.** Compilan el código de vuelo tal cual (`boost_detect.cpp` y `mission.cpp`) y lo alimentan con las simulaciones de OpenRocket y con casos de manipulación.

## Cómo correrlas

```
python3 firmware/cohete/test/host/correr_pruebas.py            # todo, con 30 min de reposo
python3 firmware/cohete/test/host/correr_pruebas.py --reposo-min 2   # más rápido
```

Requisitos: `g++` (probado con 13.3), `python3` y `numpy`. Sale con código 0 si se cumplen todos los criterios. Escribe en `entradas/` (los archivos generados, unos 35 MB con el reposo de 30 min) y en `build/`; los dos están ignorados por git.

## Qué hay

| Archivo | Qué hace |
| --- | --- |
| `correr_pruebas.py` | Genera las entradas, compila y corre todo, e imprime una tabla con OK/FALLA/INFO |
| `prueba_boost.cpp` | Arnés del módulo puro `src/boost_detect.cpp`: lee un archivo binario y reporta las detecciones. Modos `inercial` (3 columnas, pasa por el gancho `boostLsmSample` con cuentas `int16` del LSM) y `baro` (1 columna, a 50 Hz) |
| `prueba_mision.cpp` | Compila el `src/mission.cpp` **real** contra los stubs y corre su tarea con un reloj virtual de 20 ms por paso. Un escenario por proceso: `tierra`, `armado`, `launch_sin_boost`, `baro`, `qmi_con_lsm`, `qmi_sin_lsm` |
| `stubs/` | Cabeceras mínimas de Arduino/FreeRTOS/ESP32, solo para compilar en el PC. También sirven para `g++ -fsyntax-only` de `ext_lsm.cpp` e `in_imu.cpp` |

Formato del archivo de entrada: `double fs_hz`, `int32 ncol`, `int32 nfilas` y luego `nfilas × ncol` `float32`.

## Qué prueba

- **Positivas inerciales:** las dos simulaciones de `datos/simulaciones/openrocket/`, convertidas a fuerza específica (`|a|` = aceleración cinemática vertical + 1 g), remuestreadas a 1600 Hz y a 1666,67 Hz (la del LSM real), con ruido σ = 0,01 g por eje, 2 s de reposo antes del despegue y 5 semillas de ruido. Criterio: BOOST en < 0,2 s desde el despegue (se suma el peor caso de 20 ms de la tarea de misión, que lee la bandera a 50 Hz).
- **Negativas inerciales (cero detecciones):** golpe de 10 g y 20 ms; impacto de 20 g y 10 ms (los dos rectangulares, el peor caso); 30 min de reposo con ruido; y el barrido de la sacudida de ±3 g durante 5 s, de 3 a 20 Hz, en el eje vertical (|a| = |1 + 3·sen|) y en uno horizontal (|a| = √(1 + 9·sen²)). Criterio con el decaimiento de dv (D-048).
- **Informativas:** la sacudida de ±3 g a 1 y 2 Hz solo reporta el dv máximo: mueve el cohete más de un metro, es movimiento real.
- **Barométricas:** el perfil de altura de las sims. a 100 Hz (y decimado a 50 Hz, la tasa de la tarea de misión) con ruido de 0,05 m; negativas: 30 min de reposo con deriva de clima, un dato malo de un solo cuadro (+15 m) y un portazo (+12 m, 60 ms).
- **Misión:** el gancho por estado (TIERRA, ARMED, LAUNCH sin BOOST), el `T_MISSION` automático, `s_boosted` (las protecciones en vuelo dejan de ser nulas), el QMI como respaldo y el BOOST barométrico.
- **Sintaxis:** `g++ -std=gnu++11 -fsyntax-only` de `boost_detect.cpp`, `mission.cpp`, `ext_lsm.cpp` e `in_imu.cpp` con los stubs.

## Qué NO prueba

- La sincronización entre núcleos en el chip, la tasa real del FIFO ni los tiempos de CPU. Eso va en el banco (P-04) y con el IMU en una mesa.
- La respuesta real del LSM (su filtro pasa-bajas) ni la vibración del motor.
- Los demás momentos (T-412), la persistencia (T-411) ni los actuadores (T-413).
