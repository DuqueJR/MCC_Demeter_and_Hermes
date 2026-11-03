---
fecha: 2026-11-03
tipo: tarea
ids: [T-416, T-416b]
autor: Claude (agente desarrollador, Sonnet)
rama: feature/T-416b-calib-robusto
---
# T-416b: `estacion/calib.py` robusto

## Contexto

El [diagnóstico](2026-11-03_prueba_diagnostico_calibracion.md) (PR #48) mostró que `calib.py` fallaba con DEM 0092 y HER 0024 por dos causas: las posiciones se nombraban por orden de aparición (en DEM 0092 el operador giró 90° y no 180°: error de 133°), y un campo de 1,2–1,4 G los primeros 25–30 s (un imán cerca) más picos del QMC dañaban el ajuste del elipsoide.

**Cambios de plan durante la tarea.** Pablo corrigió `calib.py` en su repo mientras se hacía la tarea, dos veces, y la rama parte ahora de su versión:

- `03b72b2` ("tolera posiciones apoyadas sobre algo magnético y en otro orden"): nombra por orientación con la calibración anterior; elipsoide robusto; posiciones con campo anómalo no cuentan.
- `3108b42` ("nombra las posiciones sin depender de una calibración previa"): `LSM_NOMINAL`, el montaje medido, igual en los dos cohetes; solo usa `calib_<rol>(_nuevo).json` si tiene `ok: true`.

La rama se reescribió desde `origin/develop` (la versión anterior, basada en `03b72b2`, queda en la rama local `backup-T-416b-v1`, que no se sube).

## Qué se hizo

Tres commits más esta bitácora. **Qué es de Pablo y qué es nuestro:**

| Commit | Autor del código | Contenido |
| --- | --- | --- |
| `4c41489` | **Pablo**, byte a byte (`tbeam_fw/tools/calib.py` de `3108b42`, que incluye `03b72b2`) | Elipsoide robusto (filtro por la mediana y luego ±25 % del radio, iterado); posiciones con el campo anómalo (más del 5 % fuera del radio) o con la inclinación a más de 12° de la mediana no cuentan; alineación solo con muestras limpias; nombrado por orientación con la calibración anterior buena o con `LSM_NOMINAL`. |
| `eb0c38b` | **Nuestro**, sobre su código | (1) `label_geometry` como último recurso; `label_poses` prueba primero la calibración anterior, luego `LSM_NOMINAL` y, si ninguna cuadra, nombra por geometría (antes caía al orden de aparición); el mensaje dice cuál camino se usó. (2) Guardias para `dp` y `par` vacíos. (3) `mag_at_poses` imprime la posición que se queda sin muestras limpias. Se separó `match_orientation` (el bucle de Pablo, sin cambios de lógica) para poder llamarlo con dos referencias. |
| `877bb93` | **Nuestro** | `estacion/pruebas/test_calib.py`. |

No se tocó `dashboard.py`, `ekf.py`, `tblog.py` ni el formato del JSON (la clave `descartadas` en `mmc` y `qmc` es de Pablo). `find_poses` no cambió: `ekf.py` recorre las posiciones en orden de tiempo.

### Cadena de nombrado en `label_poses`

1. Menos de 6 posiciones: orden de aparición (como antes).
2. **Por orientación con la calibración anterior** (`ok: true`), si cuadra (cada posición a ≤ 45° de la esperada, sin repetidas): `por orientacion (calibracion anterior)`.
3. **Por orientación con `LSM_NOMINAL`**: `por orientacion (montaje nominal)`. Es el camino normal de los dos cohetes.
4. **Por geometría** (último recurso, un cohete montado distinto): `por geometria: no cuadran con calibracion anterior ni con montaje nominal` (o solo con el nominal), más `; el orden fue distinto al de la guía` si lo fue. Nunca hace fallar.

### Nombrado por geometría (`label_geometry`)

1. **Nariz arriba** = la primera dirección quieta.
2. **Nariz abajo** = la más opuesta a ella.
3. **Marca arriba** = la primera, en orden de aparición, de las que quedan.
4. **Marca abajo** = la más opuesta a marca arriba.
5. **Derecha / izquierda**: las dos que quedan, con la regla de la mano derecha del cuerpo FRD: Y = Z × X (X = lectura de nariz arriba; Z = la de marca abajo, ortogonalizada); "derecha arriba" es la que apunta hacia +Y. Es la misma convención de `body_rotation`; no se probaron los dos órdenes porque el otro da 180° de error en esas dos posiciones.

**Límites conocidos**
- La geometría no distingue "arriba" de "abajo": necesita que la primera posición sea nariz arriba y que marca arriba aparezca antes que marca abajo. Con el montaje nominal ya no hace falta (arriba y abajo no son ambiguos).
- **El montaje nominal "cuadra" con cualquier montaje girado un múltiplo de 90°** (las seis lecturas siguen alineadas con un eje, solo permutadas), y nombra con eso sin avisar: la geometría solo entra cuando alguna posición queda a más de 45° de la esperada (por ejemplo, un montaje girado 45° o 40° en cada eje). Si un cohete se monta girado 90°, la calibración saldría con un `R` equivocado y `COMPLETA`. Es una propiedad del diseño de Pablo (`3108b42`), no de nuestro cambio; se deja anotado como riesgo. Conviene comparar el `R` del LSM de cada calibración con el nominal (X del cuerpo = +Y del chip).

## Evidencia

### Cifras de DEM 0092 y HER 0024 (los `.BIN` del 3 de noviembre, 13:14 y 13:27)

`develop` = `calib.py` antes de la tarea. "Con anterior" = `calib_demeter_nuevo.json` (0091) y `calib_hermes.json` (0023) junto a `calib.py`; "sin" = `calib.py` y `tblog.py` copiados a una carpeta temporal, sin ninguna calibración.

| Caso | Nombrado | Error de posición LSM / QMI | Residuo MMC / QMC | Resultado |
| --- | --- | --- | --- | --- |
| DEM 0092, `develop` | orden de aparición | 133,2° / 133,1° | 43,9 mG (max/min 5,12, cobertura 46 %) / no es elipsoide | INCOMPLETA (7 avisos) |
| DEM 0092, Pablo `03b72b2`, sin anterior | orden de aparición | 133,2° / 133,1° | 4,7 / 5,5 mG | INCOMPLETA |
| DEM 0092, esta rama, sin anterior | orientación (montaje nominal) | **3,4° / 3,2°** | **4,7 / 5,5 mG** (max/min 1,87 / 1,20, cobertura 100 %) | **COMPLETA, sin avisos** |
| DEM 0092, esta rama, con anterior | orientación (calibración anterior) | 3,4° / 3,2° | 4,7 / 5,5 mG | **COMPLETA, sin avisos** |
| HER 0024, `develop` | orden de aparición | 4,0° / 4,0° | 72,8 mG (max/min 6,31, cobertura 62 %) / no es elipsoide | INCOMPLETA (5 avisos) |
| HER 0024, esta rama, sin anterior | orientación (montaje nominal) | **4,0° / 4,0°** | **7,6 / 8,4 mG** (max/min 1,18 / 1,22) | **COMPLETA, sin avisos** |
| HER 0024, esta rama, con anterior | orientación (calibración anterior) | 4,0° / 4,0° | 7,6 / 8,4 mG | **COMPLETA, sin avisos** |

- Inclinación: DEM 29,4° (rango 1,1° con el MMC, 6,0° con el QMC); HER 35,1° (rango 4,4° y 2,0°). MMC contra QMC difieren 0,4–2,5° (DEM) y 2,4–3,7° (HER). Retraso del QMI: 42 ms en los dos.
- Posiciones que no cuentan para el magnetómetro (imán cerca al inicio): en las dos, la primera cae entera en el tramo descartado; en DEM además "nariz abajo" del MMC; en HER "nariz abajo" del MMC (inclinación 5,8°, lejos de las demás) y del QMC. Ahora se informan todas (`sin muestras limpias del magnetometro`).
- Muestras descartadas: DEM MMC 1939 de 23008 y QMC 799 de 20229; HER MMC 1580 de 13840 y QMC 1533 de 12116.
- Antes de Pablo, el reproceso manual del documentador dejaba HER 0024 con avisos (inclinación 33°, QMC 34 mG); con el filtro de Pablo sale limpio.

### Pruebas

- `python -m unittest discover -s estacion/pruebas`: **98 pruebas, OK, 4 saltadas** sin los `.BIN` (las de `web1`, 74, siguen en verde). Con `CALIB_LOGS_DIR=<carpeta con los .BIN>`: 98, **OK, 0 saltadas** (97 s).
- `estacion/pruebas/test_calib.py` (24 pruebas):
  - `Geometria` (5): `label_geometry` con el giro de 90°, derecha/izquierda por mano derecha, desorden y ruido de 3°.
  - `EtiquetaPoses` (5): `label_poses` con el montaje nominal, la calibración anterior preferida, el montaje girado (cae a geometría), una anterior que no cuadra y menos de 6 posiciones.
  - `Sinteticas` (10): un log inventado entra a `calib.run` por `calib.load` (seis posiciones de 6 s, 100 s de giro; hierro duro y blando; giro coherente con el campo). Con el chip montado como `LSM_NOMINAL` (camino normal, también con posiciones en desorden) o girado 40° en cada eje (entra la geometría, también con el giro de 90°); una anterior buena; **una anterior con `ok: false`, que se ignora** (la de la prueba cuadraría con los datos, así que si se usara los nombres saldrían cambiados); **campo extra de 1 G durante 25 s**; **60 picos de 10 G en el QMC**; todo junto; y la guardia de "ninguna posición limpia".
  - `RealesOpcionales` (4): DEM 0092 y HER 0024, con y sin anterior (`ok: true`, error de posición < 5°, residuo del MMC < 10 mG, y el mensaje del camino usado).
- Con el `calib.py` de Pablo sin nuestros cambios, 19 verificaciones de las pruebas nuevas fallan (todas las de geometría y de la cadena de nombrado, el campo extra, la guardia con `ValueError: zero-size array to reduction operation maximum`).
- **Sin correr:** DEM 0091 y HER 0023 (los logs de la calibración vigente) no están en el entorno: no se pudo comprobar "dan lo mismo que antes". Con una calibración anterior que cuadra, o con el montaje nominal, el camino es el de Pablo sin tocar.

## Decisiones tomadas o propuestas

- **Partir de la versión de Pablo, byte a byte,** en un commit aparte con `Upstream: ptilanom/DEMETER@3108b42`, y poner lo nuestro en commits separados para que Pablo los revise.
- **Conservar solo lo que sigue sumando:** la geometría como último recurso, las guardias y el aviso de la posición sin muestras limpias.
- **Mano derecha en lugar de probar los dos órdenes** de derecha/izquierda: más simple, determinista y equivalente.
- **No se implementó** el aviso "campo fuerte en t=a–b s: ¿imán cerca?" ni el informe de tramos de ±1 s en el JSON del plan original: Pablo descarta por muestra y avisa solo cuando se descarta más del 20 %; las dos calibraciones reales ya salen limpias.
- No hay propuestas de cambio a contratos.

## Problemas y cómo se resolvieron

- Mi primera idea (un ajuste robusto propio con recorte y esfera) no separaba las muestras con hierro duro de 2–5 G y un campo de 1 G; se descartó al llegar la versión de Pablo.
- Al reescribir las pruebas apareció el límite del montaje nominal descrito arriba: un giro de 55° o 70° sobre la diagonal todavía "cuadra" con el nominal, y uno de 90° también. Las pruebas usan 40° en cada eje, que sí queda fuera.
- `poses[i] in out` en `match_orientation` (de Pablo) compara diccionarios con arreglos de numpy: funciona con las posiciones reales (`t1` va primero y siempre difiere) pero lanzaría `ValueError` con otro orden de claves. No se cambió.

## Pendiente / siguiente paso

- Que Pablo revise el PR (sobre todo `eb0c38b`) y decida si lleva a su repo la geometría de último recurso.
- Decidir si se avisa cuando el `R` del LSM de una calibración nueva difiere del nominal (cubre el montaje girado 90°).
- Regresión con DEM 0091 y HER 0023 cuando haya acceso a esos `.BIN`.
- Opcional: aviso "campo fuerte en t=a–b s" con los tiempos descartados, guardado en el JSON.
- T-416: Demeter y Hermes salen COMPLETAS con DEM 0092 y HER 0024 desde el dashboard; queda la aceptación de Pablo.

## Documentos afectados

Ninguno editado (lo consolida el documentador): backlog T-416b y T-416. Código: `estacion/calib.py`, `estacion/pruebas/test_calib.py`.
