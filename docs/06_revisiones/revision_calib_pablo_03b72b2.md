---
id: revision_calib_pablo_03b72b2
estado: vivo (2026-11-03). Revisión para Pablo; él revisa a su vez T-416b.
actualizado: 2026-11-03
depende_de: [revision_firmware_pablo, sincronizacion_firmware_pablo]
revisa: ptilanom/DEMETER @ 9b59e86 (rutas relativas), 03b72b2 y 3108b42 (calib.py)
---
# Revisión de los commits de Pablo del 3 de noviembre (`9b59e86`, `03b72b2`)

**Para Pablo.** Desde D-045, el código vive en nuestro repo ([DuqueJR/MCC_Demeter_and_Hermes](https://github.com/DuqueJR/MCC_Demeter_and_Hermes), rama `develop`):
- `calib.py` está en `estacion/calib.py`;
- la guía para trabajar ahí está en [sincronizacion_firmware_pablo](../05_plan/sincronizacion_firmware_pablo.md) §5.

Tus dos commits los traemos nosotros (T-008, T-416b). **Lo que hagas desde ahora, mejor en una rama de nuestro repo**, para no tener dos versiones.

## 1. `03b72b2`: `calib.py`

**Coincidimos en el diagnóstico.**
- Juan Pablo nos pasó los mismos logs (DEM 0092 y HER 0024), y llegamos a lo mismo por nuestro lado ([bitácora](../07_bitacora/2026-11-03_prueba_diagnostico_calibracion.md)):
  - Demeter falló por **el orden de aparición** de las posiciones (133° → 3,4° nombrándolas por dirección);
  - y los dos, por **un campo de 1,2–1,4 G** en una parte del log.
- **Una corrección a nuestra bitácora:** la atribuimos a un imán (el del DRV5032). **Tu explicación es la correcta:** el portátil debajo en las posiciones quietas.

**Corrimos tu versión sobre los dos logs:**

| Log | Resultado | Magnetómetros | MMC contra QMC | Inclinación |
| --- | --- | --- | --- | --- |
| DEM 0092 | **COMPLETA**, sin avisos | MMC 4,7 mG, QMC 5,5 mG | 0,4–2,5° | 29,4° (sin nariz abajo, por campo anómalo) |
| HER 0024 | **COMPLETA**, sin avisos | 7,6 y 8,4 mG | 2,4–3,7° | 35,1° |

Es mejor que nuestro reproceso, sobre todo en Hermes.

**Un hallazgo: sin una calibración anterior, vuelve a fallar.**
- **Qué pasa:** `label_poses` necesita `calib_<rol>.json` o `calib_<rol>_nuevo.json` junto a `calib.py`. Sin ninguno, cae al orden de aparición, y **DEM 0092 vuelve a dar 133°** (lo reproducimos).
- **Cuándo pasa:**
  - **Siempre que calibras Demeter desde el dashboard:** en la carpeta solo existe `calib_demeter_nuevo.json`, y `/api/calib/run` lo **borra antes** de correr `calib.py`, para que un resultado viejo no pueda aceptarse.
  - En la **primera calibración** de cualquier cohete.
- **Lo que hacemos en T-416b:** **tu `calib.py` byte a byte**, más un cambio mínimo. Sin una calibración anterior (o si no cuadra), las posiciones se nombran **por geometría**:
  1. nariz arriba es la primera dirección, y nariz abajo, su opuesta;
  2. marca arriba es la siguiente, y marca abajo, su opuesta;
  3. las dos laterales, en el orden de menor error.
- **También en T-416b:** un guardia para cuando no queda ninguna posición limpia, porque `np.ptp` de un arreglo vacío revienta.

**Lo demás no tiene observaciones:**
- el filtro por la mediana y la iteración ±25 % del radio;
- `POSE_FIELD_TOL` y `DIP_POSE_DEG`;
- alinear solo con las muestras limpias.

## 2. `9b59e86`: rutas relativas

- **En tu repo** usas `${PROJECT_DIR}/../Lilygo-LoRa-Series/lib` y `${PROJECT_DIR}/../common`.
- **En el nuestro**, la librería está en `firmware/vendor/` y `common` en `firmware/common/`, así que nuestro P1 (`../vendor/Lilygo-LoRa-Series/lib`, `../common`) sigue siendo la versión vigente.
- `core.longpaths` y `--ignore-whitespace` ya están en `firmware/README.md` y en la guía.

## 3. Lo que te pedimos revisar a ti

- **El PR de T-416b** (`feature/T-416b-calib-robusto`): tu `calib.py` + el nombrado por geometría + el guardia.
- **La bitácora del diagnóstico**, por si algo no cuadra con lo que viste en la cancha.
- **Ya en `develop`, para que lo mires cuando puedas:**
  - **T-410, la detección de BOOST:** `boost_detect.*` y maquina_estados §6. Te toca validar los valores (P). **Hallazgo:** con el reinicio de 50 ms, una sacudida de ±3 g a 5 Hz daba un falso BOOST; se agregó un decaimiento de dv a 3 g (D-048).
  - **T-413, el buzzer y `pi encender`:** ext_act y maquina_estados §7. **Revisa PEN-27:** IO45 e IO46 son pines de arranque del S3.

## 4. Actualización: `3108b42` (el nombrado sin una calibración previa)

**Qué cambia:**
- `LSM_NOMINAL`: el montaje medido, igual en los dos cohetes (X del cuerpo = +Y del chip). Si no hay una calibración anterior **con `ok: true`**, las posiciones se nombran con ese montaje.
- **Verificado:** sin ninguna calibración en la carpeta, DEM 0092 y HER 0024 salen **COMPLETAS** ("por orientación (montaje nominal)", 3,4° y 4,0°).
- **Resuelve el bug de §1**, y es mejor que nuestro nombrado por geometría: con el montaje conocido, arriba y abajo no son ambiguos.

**Qué hacemos:**
- **T-416b se rehace sobre `3108b42`:** su `calib.py` byte a byte.
- **Lo nuestro queda solo como último recurso:** el nombrado por geometría cuando ni la calibración anterior ni el montaje nominal cuadran (hoy, en ese caso, cae al orden de aparición), además de la guardia y el aviso.

**Una observación:** si algún día un cohete se monta con el LSM girado, `LSM_NOMINAL` deja de cuadrar (más de 45°) y entra el último recurso. Conviene anotar el montaje en el checklist de integración.
