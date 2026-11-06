---
id: calibracion_nvs
estado: implementado (2026-11-05); la calibración a bordo falta validarla en hardware. Reemplaza la propuesta de subir la calibración por LoRa.
actualizado: 2026-11-05
depende_de: [protocolo_paquetes, formato_log, maquina_estados]
decisiones: [D-057, D-059]
---
# Calibración a bordo y en NVS

## Por qué a bordo

- La calibración válida es la del cohete **cerrado**, como vuela.
- Con el cohete cerrado **no hay USB**. Descargar el registro exige abrirlo, y eso deshace justamente lo que se quería medir.
- Por eso **el cohete analiza su propio registro** de la guía de calibración: hace lo mismo que `estacion/calib.py`.
- Manda por radio **solo un resumen** para aprobarlo. No sube ni baja datos de calibración en bloque.
- El registro queda en la SD, así que siempre se puede repetir el análisis en el PC.

**Respaldo:** con el cohete abierto, `calib.py` en el PC y la carga del resultado por USB (`estacion/cal_blob.py`, clave `TBCAL`). `calib.py` recibe el primer archivo y toma solo los que continúan el registro en la misma carpeta (`--solo` lo evita); "Bajar y analizar" del dashboard baja todo el registro (`tbget get NOMBRE --registro`).

## Flujo

1. **Captura:** la guía del dashboard de siempre, con el cohete cerrado y registrando en FLY forzado. Desde el 6 nov la guía ya no hace la curva de calentamiento: el calentamiento por la Pi ya está caracterizado y la referencia de temperatura en tierra la da el otro cohete (Pablo). Son las 6 posiciones quietas y luego 2 min girando. Cada posición se compara en vivo con las ya capturadas, con la gravedad de TELEM y sin depender de los ejes: su pareja (1-2, 3-4, 5-6) debe quedar a más de 135° y las demás entre 45° y 135°. Si no cuadra, la guía no avanza y dice con cuál choca. Si cambian los ejes de TELEM (el EKF arranca o se reinicia), esa comparación se omite. El análisis sigue aceptando un registro con calentamiento.
2. **Análisis:** orden `cal analizar` (dashboard, pestaña Calibración → "Analizar el último registro").
   - Solo en TIERRA y sin registrar.
   - Una tarea en el núcleo 0, prioridad 1, lee de la SD el último registro de ese cohete, con `g_sdBusMx`, en dos pasadas.
   - **El registro puede ocupar varios archivos** (la guía con 30 min de calentamiento llena unos 4 de 32 MB). Se toma el archivo de índice más alto y, hacia atrás, los que este continúa: mismo arranque y la bandera `FH_CONTINUA` de la cabecera v3 ([formato_log](formato_log.md)); en archivos v1-v2 basta el mismo arranque. Hasta 16 archivos. La cola de ceros de la preasignación no se lee.
   - **El calentamiento no es una posición:** un tramo quieto de 2 min o más seguido de posiciones de la guía. La guía empieza 20 s antes del final del último (`WARM_TAIL_S`): ese final cuenta como posición, porque la 1 (nariz arriba) suele hacerse sin mover el cohete después del calentamiento. Lo anterior solo sirve para la curva de temperatura. Sin ese final, DEM 0101 se quedaba con 5 posiciones (6 nov). Sin esto, los 30 min quietos ocupaban la PSRAM con el magnetómetro y llevaban su mediana a ese punto, y el filtro descartaba el giro (falla del 5 nov, DEM 0101-0104). Los magnetómetros se leen en la segunda pasada, ya con el inicio de la guía conocido.
3. **Resumen:** dos paquetes `CAL_RES`, en lugar de TELEM:
   - mientras analiza, el progreso, una página cada 4 s;
   - con el resultado listo, las dos páginas alternadas;
   - el dashboard lo muestra como el resultado de `calib.py`: avisos, sesgos, escalas, error de posición, retraso y ganancia del QMI, radio, residuo, cobertura e inclinación de los magnetómetros, MMC contra QMC y la curva de temperatura.
4. **Aprobación:** `cal aplicar` va **siempre en dos pasos**, con el modal de confirmación del dashboard. Si el análisis dejó avisos, se puede forzar.
   - Forzarla no marca la misión como FORZADA.
   - `cal descartar` borra el resultado; `cal anterior` vuelve a la calibración previa, también en dos pasos.
5. **Guardado en NVS** (`tbcal`):
   - dos ranuras, `a` y `b`, más `act`;
   - se escribe en la inactiva, se relee para verificarla y solo entonces se activa;
   - un corte a mitad no deja al cohete sin calibración.
6. **Trazabilidad:** registro `T_CAL` (15) cuando hay resultado, al aplicar, al volver a la anterior y al empezar a registrar. Cada archivo dice con qué calibración (CRC32) se grabó. Además, la página 0 de `CAL_RES` sale cada minuto con el CRC32 activo.

## El análisis (`cal_core.cpp`, C++11 puro)

- **Mismas reglas y umbrales que `calib.py`:**
  - posiciones quietas (ventanas de 0.5 s, dispersión < 0.03 g, al menos 4 s, 30° entre posiciones);
  - nombres por la calibración anterior (la activa en NVS), por el montaje nominal o por geometría;
  - sesgo y escala del acelerómetro por mínimos cuadrados no lineales;
  - rotación a cuerpo;
  - retraso (±80 ms) y ganancia del giro del QMI respecto al LSM;
  - elipsoide de cada magnetómetro, con descarte de lo perturbado (mediana, luego ±25 % del radio), 26 celdas de dirección y cobertura;
  - sin las muestras durante la transmisión;
  - alineación con el giro (las 24 rotaciones de ejes y luego Gauss-Newton), signo por la inclinación y posiciones perturbadas fuera;
  - MMC contra QMC;
  - curva de temperatura.
- **Diferencias para que quepa en la ESP32:**
  - dos pasadas sobre el archivo, con resúmenes por ventana, en vez de guardar todo;
  - el giro para alinear sale de ventanas de 100 ms;
  - el retraso del QMI se mide en el tramo de giro.
  - Los bucles largos ceden CPU (`cal::ceder`) para que no salte el watchdog del IDLE0.
- **Verificado en el PC** contra `calib.py` sobre DEM 0091, HER 0023, DEM 0092 y HER 0024. Ninguna magnitud fuera de tolerancia:
  - rotaciones a 0.01°;
  - sesgos a 0.01 mg;
  - escalas a 11 ppm;
  - retraso del QMI igual;
  - ganancia a 0.002;
  - centros y radios de los magnetómetros a menos de 0.02 mG;
  - rotación de los magnetómetros a cuerpo a 0.3°.
  - Herramienta: `firmware/cohete/test/host/comparar_cal.py`.

## Formato de la calibración (`cal_blob.h`, igual en `estacion/cal_blob.py`)

- **Cabecera:** `'CAL1'`, versión, `rocket_id`, largo u16 y hora UTC u32 (12 B).
- **Secciones** `[id, largo, float32...]`:
  - 1 LSM: `R`, sesgo y escala;
  - 2 QMI: lo mismo, más la ganancia del giro y el retraso;
  - 3 MMC y 4 QMC: centro, `A`, `R` a cuerpo y radio.
- **Al final:** CRC32 de zlib. Unos 336 B.
- **Antes de guardar se revisa:**
  - que sea del cohete;
  - que las rotaciones sean ortonormales;
  - escalas entre 0.9 y 1.1;
  - sesgos de menos de 0.2 g;
  - radio entre 0.15 y 0.8 G;
  - ganancia del QMI entre 0.7 y 1.4.
- **Ida y vuelta verificada:** el blob del cohete lo lee Python, y el que arma Python desde `calib.py` lo lee el firmware.

## Lo que falta

- Compilarlo y probarlo en la placa: memoria (los resúmenes y los magnetómetros van a PSRAM), tiempo del análisis y que no salte el watchdog.
- El EKF a bordo, que es quien va a usar `calActiva()`.
- La sección de la temperatura del suelo puesta a mano (D-058, `F_MANO`).
