---
fecha: 2026-11-03
tipo: prueba
ids: [T-416, T-416b]
autor: Claude (documentador), con Juan Pablo
rama: docs/diagnostico-calibracion
---
# Diagnóstico de las calibraciones fallidas de Pablo (DEM 0092 y HER 0024)

## Contexto

Pablo corrió la calibración guiada de los dos cohetes (3 de noviembre, 13:14 y 13:27), y `calib.py` las dio por incompletas (`ok: false`). Juan Pablo subió los dos `.BIN` y los JSON resultantes.

## Qué se hizo

- Se corrió `estacion/calib.py` de `develop` sobre los dos logs. Da los mismos avisos que vio Pablo.
- Se analizaron los datos con scripts de prueba en el scratchpad, sin cambiar `calib.py`:
  - la gravedad en cada posición quieta;
  - `|B|` en el tiempo;
  - la calibración vieja (DEM 0091, HER 0023) aplicada a los logs nuevos;
  - un reproceso con las posiciones etiquetadas por geometría y los tramos contaminados excluidos.

## Evidencia

### 1. Los acelerómetros de Demeter: el orden de las posiciones, no los sensores

- **Qué pasó:** `find_poses` nombra las posiciones **por orden de aparición**. En DEM 0092, después de "marca arriba" (+X del chip) el cohete quedó girado 90° (−Z) y no 180°, así que "marca abajo" no era la opuesta.
- **Resultado:** el error de posición fue de 133° en el LSM y en el QMI (los dos iguales, así que no es el sensor).
- **Con las posiciones etiquetadas por geometría** (nariz arriba, su opuesta, la siguiente y su opuesta, y las dos restantes): **3,4°** (LSM) y 3,2° (QMI), comparable con Hermes (4,0°).

### 2. Los magnetómetros de los dos cohetes: un campo fuerte al principio de cada log

- **Lo que se ve:** con la calibración vieja aplicada, `|B|` corregido es **0,30 G** (el campo terrestre, coherente con el radio de 0,26–0,31 G) en casi todo el log.
- **Las excepciones:**
  - **Los primeros 25 a 30 s de cada log, con 1,2–1,4 G** (cuatro o cinco veces el campo terrestre);
  - unos segundos alrededor de t = 210 s en Demeter (0,9 G).
- **Cuánto es:** un 8 % de las muestras del MMC en Demeter y un 11 % en Hermes. Además, el QMC tiene picos de 7,6 a 10,4 G.
- **Qué rompe:** eso daña el ajuste del elipsoide:
  - radio de 2,46 y 1,35 G;
  - max/min de 5 a 6;
  - residuos de 44 y 73 mG;
  - inclinación que varía 130°.
- **Causa probable [inferencia]: un imán cerca del cohete al iniciar,** el del DRV5032 con el que se despierta la placa. Encaja con el momento (el arranque) y con la magnitud.
- **El montaje no cambió:** el centro del MMC de Demeter coincide con el de DEM 0091 (−0,48, 1,63, 2,59 G frente a −0,48, 1,61, 2,55 G).

### 3. Reproceso: posiciones por geometría y sin los tramos contaminados

| Cohete | Resultado | LSM / QMI | MMC | QMC | Inclinación |
| --- | --- | --- | --- | --- | --- |
| **Demeter** | **`ok: true`, sin avisos** | 3,4° / 3,2° | Residuo 3,8 mG, max/min 1,87, cobertura 100 % | Residuo 4,5 mG, max/min 1,20 | 27,9° (rango 6,6°) |
| **Hermes** | Todavía incompleta | 4,0° | Bien (residuo 10 mG, max/min 1,19, cobertura 100 %) | Residuo 34 mG | Varía 33–37° entre posiciones; MMC y QMC difieren 21° |

- **En Hermes**, su primera posición ("nariz arriba", de 0 a 15 s) se tomó con el campo contaminado.
- **El retraso del QMI es de 42 ms en los dos cohetes**, el mismo que había medido Pablo.

## Conclusión

1. **Demeter queda calibrado con este mismo log** (el archivo reprocesado se le entrega a Juan Pablo para Pablo). Falta que Pablo lo acepte.
2. **Hermes se repite:**
   - **con el imán lejos** (más de 1 m) desde antes de empezar a registrar;
   - siguiendo **el orden exacto** de las posiciones de la guía.
3. **`calib.py` debe ser robusto a las dos cosas** (T-416b):
   - nombrar las posiciones por geometría;
   - excluir los tramos con `|B|` fuera de lo normal;
   - avisar si al inicio hay un campo fuerte ("¿imán cerca?").

## Documentos afectados

backlog (T-416 y T-416b nueva).
