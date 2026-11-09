---
fecha: 2026-11-08
tipo: analisis
ids: []
autor: Claude principal (documentador), con Juan Pablo y Jerónimo en campo
---
# Análisis forense de los vuelos de Hermes y Demeter (2026-11-08)

Se bajaron por USB los registros largos de cada cohete y se compararon con la sesión de la estación de tierra y con lo que quedó en la web pública. **Las horas son de Bogotá (UTC−5).** Los tiempos `t` son segundos desde el comando `launch`, salvo donde se diga otra cosa.

## 1. Qué se descargó

| Cohete | Registro | Tamaño | Qué es |
| --- | --- | --- | --- |
| Hermes | `HER_M00_20261108_101601_0036.BIN` | 169,4 MB | El vuelo y la hora siguiente (3428 s). 1 519 918 registros, 0 bytes saltados |
| Demeter | `DEM_M00_20261108_123013_0011.BIN` | 236,8 MB | El vuelo y lo posterior (4728 s). 2 105 326 registros, 0 bytes saltados |

- **Demeter:** el dashboard bajó antes solo `--ultimos 4`, que eran archivos chicos (1,3 MB, 1,1 MB, 0,4 MB) y el 0016 (17,4 MB, posterior al vuelo). **El registro del vuelo (0011) no estaba:** se bajó en esta sesión.
- Quedaron en `estacion/` con su `.BIN.txt` (resumen de `tblog`) y su carpeta `_csv/`. No se versionan.
- Las dos placas se reiniciaron al terminar la descarga (`--reset`).

## 2. Procedimiento de misión

**Hermes** (sesión de tierra y `mision.csv` coinciden):

| Hora | Comando / evento |
| --- | --- |
| 10:16:03 | `armar` (la primera vez salió NO APTO 0x00800000 y se confirmó) |
| 10:22:57 | `launch` (ARMED → FLY, LAUNCH) |
| 10:23:03 | BOOST **automático** (t = 5,4 s; la ignición real fue en t ≈ 5,0 s) |
| 10:27:53 | `momento aterrizaje` **a mano** (t = 296 s) |
| 11:20:06 | `estado tierra` (NO APTO la primera vez por 0x400; confirmado) |

**Demeter:** el 8 de noviembre hizo **seis** intentos de `launch` (11:31, 11:33, 12:06, 12:25, 12:28 y 12:30) con abortos y vueltas a TIERRA entre ellos. **El vuelo real fue el de las 12:30:16.**

| Hora | Comando / evento |
| --- | --- |
| 12:30:15 | `armar` |
| 12:30:16 | `launch` |
| 12:30:34 | BOOST **a mano** (`momento 2`, t = 17,8 s) |
| 12:32:01 | `momento aterrizaje` **a mano** (t = 105,2 s) |

La Pi hizo el ciclo completo: ABORT, PREFLIGHT, READY, ARM, START_ASCENT, RECORDING, TOUCHDOWN, INGESTING, PROCESSING y COMPLETE (a las 14428 s del reloj de la placa). Luego perdió el latido y reinició a BOOT. Sin CRC malos.

## 3. Perfil real de cada vuelo

| | Hermes | Demeter |
| --- | --- | --- |
| Ignición real (IMU) | t ≈ 5,0 s | **t ≈ 26 s** (13,8 g) |
| Fin del empuje | t ≈ 7 s | t ≈ 28 s |
| Apogeo (GNSS) | **945 m MSL = 380 m** sobre la salida, t = 14,2 s | **1098 m MSL = 534 m** sobre la salida, t = 39,1 s |
| Apogeo (barómetro BME) | 367 m | 564 m |
| Apogeo del EKF a bordo | 390 m (t = 12,1 s) | **206 m** (t = 28,8 s) |
| Eyección / paracaídas | pico ~8 g en t ≈ 14–16 s | pico 11,4 g en t ≈ 35 s |
| Descenso | ~8,5 m/s | ~8,2 m/s |
| Aterrizaje (impacto) | t ≈ 62 s (6,4 g) | t ≈ 107 s (**22,9 g**) |
| Altura de reposo respecto a la salida | −9 m | −14 m |
| Deriva | ~173 m al oeste | ~94 m al sur y 75 m al oeste |

## 4. Detección de momentos

- **BOOST automático:** funcionó en Hermes (0,4 s después de la ignición, T-410). **En Demeter fue manual** y se dio unos **8 s antes de la ignición real**: el T+ de la web de Demeter arranca 8 s adelantado.
- **COAST, APOGEO, CAÍDA y PARACAÍDAS no se detectaron** en ninguno de los dos (T-412 está pendiente). Nadie los marcó a mano. Por eso en la web las fases solo van ARMED → BOOST → LANDED y **no hay evento de apogeo**.
- **ATERRIZAJE** fue siempre manual: en Hermes se dio **~4 min después de tocar el suelo**; en Demeter, ~2 s antes del impacto.

## 5. Transmisión (LoRa y estación de tierra)

- Cada placa transmitió a 10 Hz sin desvíos de ranura (inicio respecto al previsto: mediana −5 µs, p95 ≈ 100 µs).
- **En vuelo:** Demeter recibió 1011 paquetes y perdió 2 (0,2 %); Hermes recibió 2665 y perdió 193 (6,8 %).
- **Después de aterrizar, Hermes se degradó:** de 206 a 5083 perdidos (≈ 16 % en 52 min). RSSI mediano de las balizas de tierra en cada cohete: Hermes −87 dBm, Demeter −71 dBm.
- Los PVT (GNSS) a 10 Hz salieron sin pérdidas: 4 huecos en Hermes y 2 en Demeter.

## 6. Estabilidad de los sensores

**Bien:** IMU principal con 0,22 % de huecos; LSM con 0,005 %; PPS anclado en el 100 %; cero silencios de más de 100 ms; cero descartes de anillos.

**Problemas:**
1. **Demeter, BMP581 congelado:** en reposo reporta siempre 95 710,5 Pa y 32,10 °C con desviación 0,00. En vuelo da valores basura (presión de −8192 a 130 526 Pa, temperatura de −15,9 a 127 °C). El EKF de Demeter aceptó solo 825 medidas de barómetro en 4728 s (Hermes: 45 980).
2. **Demeter, GNSS en el empuje:** hacia t ≈ 30 s los satélites bajaron de 17 a 3 y el fix a 2 (muestra de 5 s; no se midió la duración exacta). Hacia t ≈ 35 s ya había fix 3D con 12 satélites. Se atribuye al empuje, sin confirmar.
3. **Hermes, BMP581:** 12,6 % de palabras malas (Demeter 1,3 %). El LSM tuvo `hub_nack` de 66 252.
4. **Magnetómetro de Hermes contaminado:** |B| ≈ 1,39 G (lo esperable es ≈ 0,3 G). El EKF nunca aceptó una medida de magnetómetro en Hermes.
5. **SD:** 56 incidentes en Hermes y 84 en Demeter (escritura con errno 5, y en Demeter 14 con errno 9 en el archivo de reserva). Se reabrió el archivo cada vez, sin pérdida de datos.

## 7. Comportamiento anormal de Hermes tras aterrizar: causa

**No fue movimiento real ni una falla de sensores: falló el EKF de a bordo.**

- Desde t ≈ 70 s hasta t ≈ 3120 s el IMU crudo muestra al cohete **inmóvil** (aceleración constante en 0,95 g, giro estable en el sesgo de ≈ 5 °/s).
- A **t = 796,4 s (10:36:13)** la covarianza del EKF pasó a **NaN** (`sig_z` subió de 2,6° a 18° desde el aterrizaje y se volvió NaN). En 2 s los sesgos del giroscopio saltaron a ≈ 700 °/s y los del acelerómetro a 0,8 g. A partir de ahí el cuaternión giraba a ≈ 2000 °/s con el cohete quieto, y eso es lo que se vio en la web.
- Causa de fondo, a confirmar en el código: sin medidas de magnetómetro, la incertidumbre de guiñada crece sin límite en un reposo largo y la covarianza pierde la positividad. Sin protección contra NaN, el filtro no se recupera.
- Hacia t ≈ 3120–3400 s hay giros reales de 200–300 °/s: es cuando lo recogieron y lo manipularon.
- **Demeter no divergió por NaN.** Su EKF quedó quieto tras aterrizar (mediana de giro 0,00 °/s). Tuvo un pico aislado de 2154 °/s en el cuaternión del EKF después de t = 130 s. **No se investigó cuándo ocurrió ni su causa** (queda pendiente).

## 8. Datos que quedaron en la web (verificación)

Copia de lo que servía el relay, en `estacion/sesiones_relay/vuelo_20261108_web/`.

| Lo que muestra la web | Contra el registro |
| --- | --- |
| **Hermes, altura máxima:** 381,8 m (serie decimada); 393 m en el reproceso | ✅ Coincide con GNSS (380 m), barómetro (367 m) y EKF (390 m) |
| **Demeter, altura máxima: 227 m** | ❌ **Incorrecta.** El apogeo real fue de 534–564 m. La web usa la altura del EKF de a bordo, que colapsó tras el empuje (a t ≈ 40 s marca ≈ 0 m) |
| Evento de apogeo | ❌ No existe (ver §4) |
| T+ de Demeter | ⚠️ Arranca ~8 s antes de la ignición real (BOOST manual) |
| Aterrizaje de Hermes (T+ 290,5 s) | ⚠️ Es el instante del comando, no del impacto (t ≈ 62 s) |
| Fase final de las dos misiones | ❌ `PREFLIGHT`: se mandó `estado tierra` después del vuelo. La web ya no dice «Aterrizó» |
| Datos de práctica | ❌ Demeter muestra varios despegues falsos (los seis intentos). La serie decimada cubre de T+ −3299 a +3610 s |
| Después de las 10:36 en Hermes | ❌ Actitud errática por el EKF divergido |

El reproceso con `estacion/web1.py` de las ventanas de vuelo (Hermes 10:19–10:33, Demeter 12:26–12:43:30) da fases ARMED → BOOST → LANDED, Hermes con 5590 estados y Demeter con 8514. **Eso arregla la fase final y los despegues falsos, pero no el apogeo de Demeter.**

## 9. Qué hay que arreglar (propuesta; no están dadas de alta)

1. **EKF a bordo:** protección contra NaN y límite o reinicio de la covarianza en reposo largo (Hermes divergió a los 13 min).
2. **EKF de Demeter:** que no pierda la altura tras el empuje; revisar el rechazo del barómetro. Cambiar o reparar el BMP581 de Demeter (congelado).
3. **T-412:** detección automática de COAST, APOGEO, CAÍDA, PARACAÍDAS y ATERRIZAJE, y que BOOST no dependa de un comando en Demeter.
4. **Web:** que el T+ se detenga al aterrizar, y que la fase `LANDED` no se pierda si después se manda `estado tierra`.
5. **Magnetómetro de Hermes:** calibración o revisar el cableado y el hierro cercano.
6. **Reconstrucción estática:** una herramienta que arme los mensajes `web-1` desde los `.BIN` (GNSS y barómetro a resolución completa) para que la web tenga el apogeo de Demeter correcto.
7. **Procedimiento:** el relay solo debe limpiarse antes de una misión nueva, y los intentos de práctica deberían hacerse sin subir al relay público, o con un reinicio antes del vuelo real.

## 10. Pendiente

Cargar en la web la reconstrucción del vuelo para dejarla estática hasta la próxima misión. Se espera la decisión de Juan Pablo y Jerónimo sobre dos puntos: dejar fuera el tramo de Hermes posterior a las 10:33 (EKF divergido) y qué hacer con la altura de Demeter (publicar la del EKF, que es incorrecta, o esperar a la herramienta del punto 6 del §9).
