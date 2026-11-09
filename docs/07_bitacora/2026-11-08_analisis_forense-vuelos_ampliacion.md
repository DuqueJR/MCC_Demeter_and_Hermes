---
fecha: 2026-11-08
tipo: analisis
ids: []
autor: Claude principal (documentador)
---
# Ampliación del análisis forense de los vuelos (2026-11-08)

Continúa [`2026-11-08_analisis_forense-vuelos.md`](2026-11-08_analisis_forense-vuelos.md). Mismos registros y mismas horas (Bogotá). Lo que **no** se pudo confirmar va marcado como hipótesis.

## 1. Por qué el EKF de Demeter perdió la altura

Qué se ve en `ekf_abordo.csv` de Demeter (`t` desde `launch`; la ignición real fue en t ≈ 26 s):

| t (s) | Altura del EKF | Qué pasa |
| --- | --- | --- |
| 26,6 a 29,1 | 2 → 204 m | Sube bien durante el empuje (velocidad vertical hasta 108 m/s) |
| ≈ 29,5 | **204 → −0,3 m** | Salto brusco a cero |
| 30 a 37 | 0 → −138 m | Deriva hacia abajo con «velocidad de caída» de hasta 75 m/s, cuando el cohete aún subía por inercia |
| ≈ 37,7 | −138 → −0,6 m | Segundo salto a cero |
| 38 a 110 | ≈ 0 m | Se queda en cero durante el descenso y el aterrizaje |

Datos que acompañan:
- Los rechazos de medidas pasaron de 0 a 160 entre t = 27 y 38 s.
- El GNSS tuvo fix 2 y 3 satélites hacia t ≈ 30 s.
- Las medidas de gravedad se quedaron congeladas en 528 durante todo el vuelo.
- **El BMP581 de Demeter entrega siempre 95 710,5 Pa** (con ocasionales valores basura: 0 y 130 526 Pa), también en vuelo. Con el cohete a 534 m la presión debía bajar ~6 kPa. Eso equivale a una altura barométrica constante de 0 m.

**Hipótesis (sin confirmar en el código):** el EKF impone la medida del barómetro congelado, que dice «0 m», cuando acumula varios rechazos seguidos (`GATE_RUN` en `ekf_core.cpp`: 20 para GNSS, 40 para barómetro). Eso explicaría los dos saltos a ≈ 0 m. Falta verificarlo en el filtro con una repetición del registro (`ekf.py` del PC sobre el `.BIN`).

**Agravante comprobado en el código:** el EKF pondera las medidas según el momento de la misión (`FASES` en `ekf_core.cpp`). Como COAST, EYECCIÓN y PARACAÍDAS **nunca se marcaron**, el filtro voló todo el vuelo con los pesos de BOOST (acelerómetro ×10, magnetómetro desactivado) y saltó directo a ATERRIZAJE.

## 2. El EKF no tiene protección contra NaN

En `firmware/cohete/src/ekf_core.cpp` y `ekf_task.cpp` no hay ninguna comprobación `isfinite` ni `isnan` sobre el estado o la covarianza. Es coherente con la divergencia de Hermes a los 796 s (ver el informe principal §7): una vez que sale un NaN, el filtro no tiene cómo recuperarse.

Un reinicio del filtro sí existe: `reiniciar()` al armar y, en vuelo, la reanudación desde la foto en RTC (`ekf_task.cpp`). Ninguno se dispara por un NaN.

## 3. Hermes: pérdidas del enlace después de aterrizar

Porcentaje de paquetes perdidos en la estación de tierra, por bloques de 10 minutos desde el aterrizaje (10:27:53):

| Bloque | Recibidos | Perdidos | % |
| --- | --- | --- | --- |
| 10:27 | 4635 | 1208 | 20,7 |
| 10:37 | 3937 | 1916 | **32,7** |
| 10:47 | 4650 | 1185 | 20,3 |
| 10:57 | 5361 | 453 | 7,8 |
| 11:07 | 5701 | 105 | 1,8 |
| 11:17 | 1582 | 7 | 0,4 |

El enlace estuvo malo mientras Hermes yacía en el suelo y fue mejorando hasta quedar limpio. **Causa no determinada.** Hipótesis a revisar: la posición y el apantallamiento de la antena sobre el terreno, o alguien o algo cercano. No coincide con la divergencia del EKF (que fue a las 10:36:13, dentro del bloque peor, pero no tiene relación con la radio).

## 4. Pico de giro de Demeter después del vuelo

El EKF de Demeter registró 63 picos de giro de más de 300 °/s después de t = 130 s, en dos grupos: hacia t ≈ 1628–1661 s (≈ 12:57–12:58) y hacia t ≈ 2592–2610 s (≈ 13:13). Se parecen a manipulación del cohete, pero **no se cruzó con el IMU crudo ni con el registro de campo**; queda pendiente.

## 5. Enlace de comandos (tierra → cohete) tras aterrizar: se perdió; el de telemetría no

Lo contó el equipo en campo y los registros lo confirman. **Se corrige la hipótesis del §3: no era la antena de Hermes hacia tierra, sino el enlace de comandos de tierra hacia el cohete.**

**Historial de comandos de la estación de tierra** (`[cmd ]`, sesión `20261108_092801_tierra.txt`):
- **Hermes:** el comando ATERRIZAJE salió bien a las 10:27:53 (EJECUTADO). Antes, desde las 10:25:03, y después hasta las 11:04:27, hay **más de 40 respuestas «sin respuesta tras 4 intentos»**. Esos fueron los intentos de pasar a RECOVERY y otros. El siguiente comando que llegó fue `estado tierra` a las 11:20:05 (NO APTO por «en vuelo: ya hubo BOOST», y se confirmó forzado).
- **Demeter:** ATERRIZAJE EJECUTADO a las 12:32:01. Después, tres «sin respuesta» a las 12:37:39, 12:37:49 y 12:38:40.
- **No hay ningún `estado recovery` ejecutado.** Los dos cohetes quedaron en `FLY/ATERRIZAJE`. El registro de campo de las 18:44 aún muestra a Demeter en `FLY/ATERRIZAJE`, más de seis horas después.

**Lo que recibió cada placa de tierra** (`radio.csv`, líneas RX = balizas y comandos de la estación):

| Cohete | RX a bordo en todo el registro | Distribución |
| --- | --- | --- |
| Hermes | 422 (de ~3400 posibles), RSSI mediano −86,5 dBm | 85 en los primeros 5 min; 7 entre t = 300 y 600 s; 1 entre 600 y 900; **ninguna** entre 900 y 1500; sube lento y llega a 113–119 por bloque hacia t ≈ 3000–3600 s, cuando lo recogieron |
| Demeter | 103, RSSI mediano −71 dBm | **Las 103 en los primeros 5 min.** Cero después, aunque la estación siguió transmitiendo al menos hasta las 12:43 |

**Conclusión:** en los dos cohetes el enlace tierra → cohete murió pocos minutos después de aterrizar, mientras la telemetría cohete → tierra siguió (con 20–33 % de pérdidas en Hermes, pero siguió). Un cohete tendido en el suelo, con la antena a ras de tierra, parece transmitir mejor de lo que recibe. **Causa de fondo sin determinar.** Hipótesis a probar: potencia de la baliza de tierra frente a la del cohete, la antena de tierra o su altura, la orientación de la antena a bordo.

**Consecuencia operativa:** el procedimiento no puede depender de llegar a RECOVERY ni de `dormir` por radio después de aterrizar. Los cohetes se apagaron en la carpa. **El comando `dormir` no está en ningún registro de la estación de tierra** (no hay sesión de tierra entre las 12:43 y las 18:43), así que no se pudo verificar cuándo actuó.

## 6. Qué sigue

- Verificar la hipótesis del §1 repitiendo el registro de Demeter con `estacion/ekf.py` (con y sin el barómetro 581).
- Dar de alta las tareas del §9 del informe principal (EKF, BMP581, T-412, T+ de la web, magnetómetro de Hermes).
- Decidir con el equipo qué altura de Demeter se publica en la web.
