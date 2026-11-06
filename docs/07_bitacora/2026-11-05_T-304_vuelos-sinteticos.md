---
fecha: 2026-11-05
tipo: tarea
ids: [T-304, P-03, T-305, T-412]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-304-vuelos-sinteticos
---
# T-304: generador de vuelos sintéticos para el banco de replay

## Contexto
El banco de replay (T-305) y la validación de la detección de momentos (T-412) necesitan vuelos con la verdad conocida: la exportación de OpenRocket de cada cohete, con el ruido de los sensores, la carga de eyección y sus variantes (P-03: al menos 20). Los archivos deben tener el formato del log (`rec`), para que los lean los mismos lectores que los logs reales.

## Qué se hizo
- **`estacion/vuelos_replay.py` (nuevo):** el generador. Está en `estacion/` y no en `tools/replay/` porque reutiliza `vuelo_sintetico.py` (de Pablo) y sus lectores hermanos (`tblog.py`, `calib.py`, `ekf.py`), que viven ahí; `tools/web_datos/openrocket.py` se descartó como lector de la sim. porque `vuelo_sintetico.leer_sim` ya trae todo lo que hace falta (no se creó un tercer lector).
  - `variante_sim()` mueve la carga de eyección (antes, en, después) y `senales()` corre `vuelo_sintetico.verdad` y `sensores` sobre la variante.
  - Escribe `.BIN` con FILEHDR (v3), EXT_LSM (palabras de 7 B: giro, acelerómetro, marca cada 16 ranuras y el BMP581 por el hub, en lotes de 32 palabras como `ext_lsm.cpp`), IMU (lotes de 16 del QMI8658), BAR (BME280 compensado), MAG, EXT_MMC, PVT, PPS y HEARTBEAT. El CRC es `binascii.crc_hqx` (CCITT-FALSE, igual a `rec::crc16`, comprobado contra `tblog.crc16`). Los registros se ordenan por `t_us`.
  - Escribe el `.verdad.json` junto al `.BIN` (cohete, motor, variante, semilla, ruido, `t_us` de IGNITION, LIFTOFF, BURNOUT, EJECTION, APOGEE con su altura AGL, PARACAIDAS_ABRE, GROUND_HIT, parámetros de la carga y conteo de registros) y un `calib_identidad.json`.
  - 24 variantes por defecto: 2 cohetes × eyección antes/en/después × ruido ×1 y ×3 × 2 semillas.
- **`estacion/vuelo_sintetico.py` (cambio mínimo):** `verdad()` y `sensores()` leen con `getattr` parámetros opcionales (`ruido`, `pad_s`, `post_s`, `lsm_hz`, `choque_g`, `choque_s`, `pulso_pa`, `pulso_tau`). Con los valores por defecto el resultado es idéntico: la huella sha1 de `verdad()` y `sensores()` (Demeter y Hermes, semilla 1) dio lo mismo antes y después (`5453cb58…` y `ffa9b396…`), y `python vuelo_sintetico.py -h` sigue igual.
- **`estacion/pruebas/test_vuelos_replay.py` (nuevo):** 20 pruebas con unittest.
- **`estacion/README.md`:** sección "Vuelos sintéticos para el replay (T-304)" y la fila de la herramienta. **`.gitignore`:** `estacion/vuelos_replay/`.

### Cómo se construye la trayectoria al mover la eyección (suposición mía)
- **Antes (la nominal de cada sim.):** la trayectoria de OpenRocket tal cual. La sim. abre el paracaídas en el apogeo (no en la eyección), así que entre la carga y el apogeo el cohete sigue sin paracaídas; solo el choque y el pulso de presión están en `t_ej` de la sim. (Demeter 10,072 s = 1,464 s antes del apogeo; Hermes 8,808 s = 0,448 s antes).
- **En:** la misma trayectoria, con el choque y el pulso en el apogeo (la sim. ya abre el paracaídas ahí).
- **Después (1,5 s, (P)):** hasta el apogeo, la sim. Luego caída balística en 3D con arrastre cuadrático `a = −k |v − w| (v − w)`, con `k` ajustado por mínimos cuadrados al tramo balístico de la propia sim. (de BURNOUT + 0,3 s a la carga): `k` = 8,6e-4 1/m (Demeter) y 1,1e-3 (Hermes). En la carga el paracaídas se abre en 0,3 s ((P)) con `k_par = g/v_desc² − k`, de modo que la velocidad tiende a la de descenso de la sim. (9,17 m/s en Demeter y 8,79 en Hermes, la mediana del tramo estable); el viento `w` es la velocidad horizontal media de la sim. bajo el paracaídas. Resultado: velocidad de 14,6 m/s al abrir y una desaceleración de unos 2,4 g de apertura, además del choque de 25 g. El suelo llega antes que en la sim. (Demeter 84,5 s contra 85,1 s). La actitud entre el apogeo y la carga queda fija; luego vale lo que ya hacía `vuelo_sintetico` (volteo de 1 s a colgar del paracaídas).

## Evidencia
**Aceptación** (`python -m unittest discover -s estacion/pruebas -p test_vuelos_replay.py -v`: 20 pruebas, OK, 132 s). Los eventos se miden **en los datos del `.BIN`** (sin ruido), no en la verdad, y se comparan con la sim. de OpenRocket (referencia de tiempo: el encendido, t = 0 de la sim.):

| Caso | Apogeo (m): datos / sim. / error | LIFTOFF | BURNOUT | EJECTION | APOGEE | GROUND_HIT |
| --- | --- | --- | --- | --- | --- | --- |
| Demeter, antes (aceptación) | 669,32 / 669,32 / **−0,003** | −0,028 s | +0,011 s | +0,008 s | −0,011 s | −0,000 s |
| Hermes, antes, sin pulso | 408,61 / 408,61 / −0,001 | −0,029 s | −0,009 s | +0,007 s | −0,014 s | −0,000 s |
| Hermes, antes, con pulso (informativo) | 408,05 / 408,61 / **−0,562** | −0,029 s | −0,009 s | +0,007 s | **+0,214 s** | −0,000 s |
| Demeter y Hermes, en y después | error ≤ 0,001 m | ≈ −0,03 s | ±0,011 s | n/a | ≈ −0,011 s | n/a |

- Cómo se miden: despegue = primer |a| > 1,5 g; fin del empuje = mínimo de la fuerza específica axial; eyección = pico del choque; apogeo = máximo de la altura barométrica del BMP581 (con la fórmula de `ekf.py`); suelo = último |a| > 2 g. El `LIFTOFF` de OpenRocket cae 0,03 s después de que empieza la fuerza (a los 10 ms ya hay 114 N): el primer |a| > 1,5 g coincide con el encendido.
- **Hallazgo para T-412:** en Hermes, con la eyección 0,45 s antes del apogeo, el pulso de +300 Pa deja una altura barométrica 1,2 m abajo del apogeo y el máximo aparente llega **0,21 s tarde y 0,56 m bajo**. En Demeter (1,46 s) no se nota. Es justo lo que el detector tiene que aguantar (maquina_estados §1, "la bajada debe ser sostenida"). Con el pulso de 300 Pa como supuesto (P).
- Orden de la eyección contra el apogeo (verdad / datos): Demeter antes −1,464 / −1,446 s; Hermes antes −0,448 / −0,654 s; en 0 / +0,02 s; después +1,500 / +1,52 s.
- Lectores: `tblog.records` sin saltos, sin `resync` ni registro cortado en los 9 archivos de la prueba; `t_us` monótono; la suma de los registros es el tamaño del archivo; `tblog.py` por línea de comandos termina con 0 y no marca palabras desconocidas; `calib.load` y `ekf.load_extra` los leen. Además `python estacion/ekf.py DEM_SINT_H135W-8_antes_r1_s01.BIN --calib estacion/vuelos_replay/calib_identidad.json` corre de punta a punta (posición final −0,37 N, −83,54 E, 0,04 D m; la sim. deriva 83 m al oeste).
- Tasas medidas en el `.BIN` contra `constantes.md` §5: LSM 1610,00 Hz (Demeter) y 1560,00 (Hermes), QMI 445,00, BMP581 100,70 (≈ 100), BME280 40,20 (≈ 40), QMC 100,00, GNSS 10,00.
- Ruido (σ en reposo): sin ruido 0; ×1: acelerómetro 0,0059 g, giro 0,233 °/s, BMP581 0,33 Pa (0,67 × 0,5: es la mediana de 3 de `ekf.load_extra`); ×3: 0,0177 g, 0,696 °/s, 0,99 Pa.
- Archivos de la matriz completa (`python estacion/vuelos_replay.py`, 24 archivos): Demeter 5,0 MB y Hermes 3,7 MB cada uno (reposo de 10 s antes y 20 s después).
- Commits: `4833802` (parámetros opcionales), `a49f96a` (generador), `f27eeec` (pruebas).

**Compilación del firmware (PlatformIO 6.2.0 vía `uvx --from platformio pio`):** `pio run -e hermes -e demeter` en `firmware/cohete/` → **SUCCESS** en los dos (Hermes: RAM 16,5 %, flash 19,4 %, 35 s; Demeter 41 s). Para lograrlo hizo falta lo que dice `firmware/README.md` y que no está en el worktree: `git submodule update --init` del submódulo de LilyGO, el parche `lilygo_local.patch` y `secrets.h` copiado de `secrets.h.ejemplo` (los tres ignorados o locales; revertidos después, `git status` limpio). Un primer intento sin el parche ni `secrets.h` falló por `secrets.h` ausente y `SensorQMI8658::readFifoInterruptConfig` inexistente, que es lo que ese parche corrige. Esta tarea no toca `firmware/`: es solo verificación.

## Decisiones tomadas o propuestas
Parámetros (P) que defino, todos opciones de línea de comandos, para que los revise el documentador (ninguno está en `constantes.md`):

| Parámetro | Valor | De dónde sale |
| --- | --- | --- |
| Choque de la carga (`--choque-g`, `--choque-ms`) | 25 g, 15 ms (media senoide) | Default de `vuelo_sintetico.py` (Pablo) |
| Pulso de presión (`--pulso-pa`, `--pulso-tau-s`) | +300 Pa, τ = 0,15 s | Default de `vuelo_sintetico.py` |
| Ruidos por sensor | LSM 0,006 g y 0,23 °/s; QMI 0,004 g y 0,07 °/s; BMP 0,5 Pa; BME 1,8 Pa (offset −105 Pa); MMC 1,5 mG; QMC 2,5 mG; GNSS 0,8 m | `vuelo_sintetico.py`, medidos en logs de banco DEM 0096, 0091, 0092 |
| Vibración del motor (`--vibracion`) | 1 g de σ, 3 °/s en el giro | `vuelo_sintetico.py`. **Con `--ruido R` se multiplica por R** (decisión mía: el ×3 también estresa el integrador de BOOST) |
| Eyección después (`--despues-s`) | 1,5 s después del apogeo | Mía: simétrica a los 1,46 s de la nominal de Demeter |
| Apertura del paracaídas (`--apertura-s`) | 0,3 s | Mía |
| Reposo (`--reposo-antes`, `--reposo-despues`) | 10 s y 20 s | Mía (Pablo usa 30 y 20 en su CLI) |
| `p0` de la rampa (`--p-rampa-pa`) | 95 346 Pa (estándar a 510 m) | Mía; la presión absoluta de la sim. de Demeter (1014,9 mbar) es la que perfiles_vuelo §3.4 manda no usar |
| Gradiente de temperatura | 6,5 K/km | Atmósfera estándar |
| `read_us` de los lotes (350 y 250 µs), marca del chip cada 16 ranuras, `t_trig` del BME280 14 ms | | Estimaciones mías (no afectan a la lógica) |

Propuestas (no aplicadas):
1. **`vuelo_sintetico.py` deriva la posición horizontal de la sim.**, y con nodos de 2 ms y 1 mm de resolución daba picos de hasta **31 g** en la fuerza específica de Hermes (en Demeter no se nota: sus nodos son más espaciados). Aquí se suaviza (spline de suavizado GCV, error de posición < 4 mm, su derivada coincide con la velocidad horizontal de OpenRocket y su aceleración máxima con la columna "Aceleración horizontal" de la sim.), pero solo en `vuelos_replay.py`: su CLI sigue sin cambios. Conviene que Pablo aplique lo mismo en `vuelo_sintetico.py`.
2. **P-03 y T-412:** el apogeo barométrico de Hermes con la eyección nominal falla por 0,21 s y 0,56 m solo por el pulso de presión: si el criterio de T-412 exige 0,3 s de error, hay poco margen. Conviene medir el pulso real de una carga en el banco.
3. **P-03** habla de "ruido ×1 y ×3 (y semillas)": aquí son dos semillas por combinación. Si se quieren más, es solo `--semillas 1 2 3`.

**Contratos:** no se cambió ninguno. No faltó nada en ellos; `formato_log.md` y `rec_format.h` bastaron. Una sola nota: `formato_log.md` dice que los lectores están en `tools/tbeam/`, que desde T-660 es `estacion/`.

## Problemas y cómo se resolvieron
- Picos espurios de fuerza específica en Hermes (ver propuesta 1): se encontraron al medir `|a|` en el coast del primer vuelo; se suavizó la posición horizontal.
- El BURNOUT de OpenRocket no es un escalón: la cola del empuje decae a cero y se cancela con el arrastre, así que `|a|` baja sin cortes (último |a| > 2 g a 0,33 s antes del evento en Demeter). El fin del empuje se mide por el mínimo de la fuerza axial (peak de arrastre).
- El nombre del archivo no lleva el pulso: la prueba de Hermes con y sin pulso se pisaba; ahora cada caso va en su carpeta.
- `ekf.load_extra` aplica la mediana de 3 al BMP581 y deja 0,67 del σ: se ajustó la prueba del ruido, no el generador.

## Pendiente / siguiente paso
- **T-305** puede tomar los `.BIN` y sus `.verdad.json`. No traen registros `MISSION`: el replay produce los suyos. Los conteos crudos del BME280 y el BARCAL no se escriben: si el banco los necesita habría que invertir la compensación con una calibración típica.
- Los ejes de los chips son los del cuerpo (calibración identidad). Si T-305 reproduce con la matriz real de montaje (`calib.LSM_NOMINAL`), habrá que rotar al escribir.
- La presión del pulso y del choque, y la de la vibración del motor, son supuestos hasta medir una carga real.
- No se generó una variante "antes" distinta de la nominal (por ejemplo, la eyección 5 s antes del apogeo): sería `variante_sim` con otro retardo.

## Documentos afectados
- Ninguno de los contratos. Nuevos: `estacion/vuelos_replay.py`, `estacion/pruebas/test_vuelos_replay.py`. Tocados: `estacion/vuelo_sintetico.py`, `estacion/README.md`, `.gitignore`.
- Para el documentador: marcar T-304 como hecha (PR de esta rama) y ajustar la ruta de los lectores en `formato_log.md`.
