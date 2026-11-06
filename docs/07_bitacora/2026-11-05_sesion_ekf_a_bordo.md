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

## Qué se hizo

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

## Reinicio en vuelo

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

## Segunda prueba en la placa (Pablo, Demeter, 5 nov, firmware de `450ed0d`)

- **Actitud:** la vista 3D gira en el sentido correcto y es fluida, tanto por USB como en vuelo (TELEM a 10 Hz).
- **Reinicio:** tras `reiniciar`, la placa vuelve a conectarse y el EKF retoma.
- **Ciclo:** `ciclo_prom` de 1,6 ms, `max` de 7,3 ms y unos 230 ciclos lentos (>5 ms) en 40 min. `perdidas=0/0`.
- **BOOST sin armar:** a las 21:48 (sesión de tierra `20261105_201037`) el cohete pasó solo de TIERRA a FLY/BOOST con `TF_BOOST_SIN_ARMAR`.
  - TELEM de ese instante (`@T` a 10 Hz): antes, |a| de 0,8 a 1,2 g y giros de hasta 124 °/s (manipulación a mano). Luego una sola muestra con |a| = 17,1 g y 781 °/s, unos 0,4 s girando a 290-720 °/s y el cohete quieto en otra orientación (unos 45° distinta).
  - Es la firma de un golpe o una caída corta, no de un movimiento de la mano: la mano no llega a 17 g. Pablo duda de que la mano llegue a 17 g.
  - La detección hizo lo que dice §6: integra |a| − 1 g mientras |a| > 2 g, y en un impacto la vibración del fuselaje queda por encima de 2 g en módulo, aunque cambie de signo. Unas decenas de milisegundos a ~15 g bastan para 5 m/s.
  - No hay registro del instante: el cohete no registraba, y los `T_MISSION` guardados van al archivo siguiente, que no se bajó. Por eso no se sabe si lo dio el LSM o el QMI ni el dv exacto.
  - El EKF y los cambios de este PR no la tocan.
  - **Defecto:** la bandera no se borraba con "estado tierra". Un FLY forzado posterior la volvía a guardar en NVS, así que seguía después de cada reinicio. El dashboard mostraba "BOOST sin armar" aunque el cohete ya estuviera en TIERRA.
  - **Segundo BOOST sin armar, con el cohete quieto:** a las 23:03 (sesión `20261105_222454`), en TIERRA, sin comandos y con |a| = 1,00 g y giro < 0,5 °/s antes y después. No es inercial por movimiento: queda el salto barométrico o una lectura mala de un IMU. Falta el `T_MISSION` de ese BOOST (criterio y dv o salto), que está en el primer archivo registrado después, en la SD.
  - Desde ahí cada arranque reanudaba FLY/BOOST (`flags=0x13`): es la reanudación de §8, que dura hasta "estado tierra". A las 00:25 del 6 nov se mandó "estado tierra" y la bandera siguió en TIERRA: la placa aún tenía el firmware de `450ed0d`, sin esta corrección.
  - **Corregido** (rama `fix/boost-sin-armar-y-cal`): el paso a TIERRA borra `TF_BOOST_SIN_ARMAR`, como ya hacía con `TF_FORZADO` y `TF_REANUDADO`. Está en `maquina_estados.md` §6 y en `prueba_mision` (escenario `tierra`).
- **Calibración:** "nombre de archivo invalido" al escribir `DEM_M00_20261105_143219_0101` sin `.BIN`. El dashboard ahora agrega la extensión y acepta `.bin` en minúsculas.
- **Campo del archivo de calibración:** no se podía escribir. Con el resumen de la calibración a bordo llegando por radio, la sección se reescribía cada segundo ("hace N s") y el clic caía en un campo que ya no existía. Ahora el campo y el selector de cohete están fuera de lo que se reescribe. Probado en el modo demo del dashboard, reescribiendo cada 300 ms mientras se escribe.

## Calibración DEM 0101-0104 (6 nov)

- Primer análisis: 5 de 6 posiciones, acelerómetros sin calibrar y "CALIBRACION INCOMPLETA".
- **Causa:** el calentamiento se hizo con la nariz arriba y la posición 1 también es nariz arriba. Sin mover el cohete, las dos quedaron en un mismo tramo quieto, que se tomó entero como calentamiento. Las otras 5 posiciones están completas (17-62 s cada una).
- **Corregido** en `calib.py` y en `cal_core.cpp` (a bordo): la guía empieza 20 s antes del final del calentamiento (`WARM_TAIL_S`), y ese final cuenta como posición. El aviso de los magnetómetros ahora dice que falta calibrar el acelerómetro, en vez de "sin posiciones quietas".
- Resultado: 6 de 6, peor error de posición 1,4° (LSM) y 1,5° (QMI); MMC residuo 4,4 mG e inclinación 35,2°; QMC 5,3 mG y 36,3°; MMC contra QMC 0,8-4,3°; giro del QMI con 42 ms de retraso y ganancia z 1,17. Sin avisos.

- Comparación a bordo contra PC sobre la captura completa (los 4 archivos unidos): 0 magnitudes fuera de tolerancia; el blob de ida y vuelta da OK (CRC 8EE76914).

## Guía de captura más firme (6 nov)

- **Pedido de Pablo:** que la captura sea sólida. El calentamiento por la Pi ya está caracterizado y la referencia de temperatura en tierra la da el otro cohete, así que la guía ya no hace los 30 min de calentamiento.
- **Cambios en la guía del dashboard:**
  - se quitó el paso de calentamiento;
  - cada posición se compara con las ya capturadas, usando la gravedad de TELEM: la pareja (1-2, 3-4, 5-6) debe quedar a más de 135° y las demás entre 45° y 135°;
  - si no cuadra, la guía no avanza y dice con cuál posición choca;
  - si cambian los ejes de TELEM (EKF listo o no, visto en el cuaternión), esa comparación se omite.
  - Así no puede repetirse el caso de la 0101: una posición sin mover el cohete o repetida se detecta en el momento.
- Probado en el modo demo con TELEM simulada: una posición 2 igual a la 1 se rechaza, y la secuencia correcta llega al giro.

## BOOST sin armar en cada arranque (6 nov)

- **Síntoma (Pablo):** con el firmware nuevo, Demeter pasaba a FLY/BOOST sin armar y registraba cada vez que encendía (`flags=0x03`, sin la marca de reanudado: no era la persistencia).
- **Causa, en la TELEM de cada arranque (00:45 y 02:18):** las primeras muestras del QMI traen x = −16 000 mg (−32768 cuentas, el tope de ±16 g) y un giro de 56 °/s. Luego el valor queda quieto ~1,7 s y pasa a lo normal. Ese primer lote del FIFO son 16 muestras a 445 Hz y ~16,5 g, que integran 5,5 m/s. El LSM todavía no está listo, así que BOOST usa el QMI.
- Apareció desde el arranque de las 22:21 del 5 nov; a las 20:19 el primer dato era normal. El código del QMI no cambió entre esos firmwares; la causa en el chip queda sin aislar.
- **Corregido:**
  - `boost_detect.cpp` ignora toda muestra con un eje en el tope de la escala;
  - `in_imu.cpp` no manda a BOOST ni al EKF el primer lote tras encender; ese lote sí se registra.
  - Está en `maquina_estados.md` §6.
- **Pruebas en el PC:**
  - el lote real (16 muestras saturadas) da cero detecciones;
  - un control con 24 muestras a −15,8 g sin saturar sí detecta;
  - el resto de `correr_pruebas.py` pasa.

## Carga de la calibración de Demeter (6 nov)

- **"Aplicar" respondía "no hay resultado listo":** es lo esperado. Aplicar usa el análisis que hace el propio cohete ("Analizar el último registro"), y no se había corrido. La calibración de la 0101 la analizó el PC, así que entra por USB.
  - Analizar a bordo ahora no serviría: el último registro de la SD ya no es la captura, sino los registros de los BOOST sin armar.
- **La carga por USB no respondía.** `cal_blob.py` abría el puerto con DTR y RTS arriba y los bajaba después; en el USB del S3 eso puede reiniciar la placa, y el blob se perdía. Además mandaba los 343 B de una vez, y el cohete atiende el USB una vez por segundo con un búfer de entrada corto.
- **Corregido en `cal_blob.py`:**
  - baja DTR y RTS antes de abrir el puerto, como `tbget.py`;
  - reintenta abrir durante 6 s;
  - manda la clave y el largo, espera 1,5 s y manda el blob en trozos de 64 B.
- **Probado con Demeter:** `CAL OK 29B2B23E`, el mismo CRC del blob. Por radio el cohete reporta esa calibración como activa.

## Calibración a bordo de Hermes, primera en hardware (6 nov, HER 0027)

- **Flujo:** guía (FLY forzado, 311 s), "estado tierra", "Analizar el último registro" (lectura 2 min, cálculo 2 min, LISTO a las 02:59), Aplicar y "si". Después, Bajar y analizar en el PC con el mismo archivo.
- **A bordo y en el PC dan lo mismo** (resumen por radio contra `calib_hermes_nuevo.json`):

| | A bordo | PC |
| --- | --- | --- |
| Sesgo LSM | 7 / 1 / 21 mg | 7,1 / 0,8 / 20,8 mg |
| Escala LSM | −2640 / +3030 / +4960 ppm | −2632 / +3031 / +4952 ppm |
| Peor posición LSM | 5,44° | 5,43° |
| Peor posición QMI | 5,06° | 5,05° |
| Retraso QMI | 42 ms | 42 ms |
| Ganancia giro QMI | 0,979 / 0,994 / 1,127 | 0,978 / 0,994 / 1,126 |
| MMC (residuo, descartadas) | 10,91 mG, 639 | 10,91 mG, 639 |
| QMC (residuo, descartadas) | 10,73 mG, 4 | 10,73 mG, 4 |

- **Aplicar funcionó:** la calibración activa pasó a `3D882C48`, el CRC del resultado. Pero tierra dijo "sin respuesta tras 4 intentos" después del "si": la confirmación se ejecutó y su respuesta no llegó (pendiente: probablemente la escritura en NVS demora la respuesta).
- "Volver a la anterior" respondió "no hay una anterior": correcto, Hermes no tenía calibración a bordo antes.
- **Calidad:** peor que la de Demeter (5,4° frente a 1,4° y 10,9 frente a 4,4 mG) y la inclinación sale de 4 de 6 posiciones. Pasa los umbrales; conviene repetirla al aire libre si sobra tiempo.
- **Demeter** tras cargar la suya por USB (02:38): la fuerza específica en reposo pasó de (1000, −45, 27) a (997, −6, 6) mg y la nariz de 87,0° a 89,4° de elevación (estaba vertical). En TIERRA y sin reinicios hasta las 03:11. Bajo techo, el giro sobre la nariz deriva ~1,5°/min: falta ver el rumbo con el magnetómetro a cielo abierto.
- El arranque de Demeter con el firmware de `703ec6f` (primer lote del QMI) no quedó en esta sesión: no hubo un arranque desde TIERRA.

## Pendiente

Lo que queda de hardware y firmware (Pablo, 6 nov):

- **Integración con la Pi:** POSE con el EKF y la calibración activa, vista en `telemetryd`, con una actitud coherente con cómo está el cohete. Confirmar que la marca de la calibración es la misma que usa `camaras.json` para ubicar las cámaras.
- **Extrínsecos de las cámaras** con el cohete ensamblado. Los intrínsecos ya están.
- **Cableado del encendido de la Pi** (IO45 → J2, PWR_ON). Probarlo con "pi encender" y ver que llegue el latido.
- Ver el arranque de Demeter desde TIERRA con el firmware de `703ec6f`: que no pase a BOOST sin armar.
- Rumbo con el magnetómetro a cielo abierto.

- La memoria real en la ESP32-S3.
- Ver `arranque=foto_RTC` tras un reinicio en FLY forzado.
- Decidir si BOOST exige |a| > 2 g sostenido unos 30-50 ms, para que un golpe en TIERRA no lo dispare (el motor da más de 1,8 s seguidos).
- Usar el EKF en la detección de momentos (apogeo, aterrizaje). Hoy la misión no lo lee: el EKF lee la misión, como en `ekf.py`.
