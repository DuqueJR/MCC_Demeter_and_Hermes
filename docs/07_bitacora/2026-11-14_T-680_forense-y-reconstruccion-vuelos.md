---
fecha: 2026-11-14
tipo: tarea
ids: [T-680, T-681, T-430, T-431, T-432, T-433, T-434, T-435, T-436, T-437, T-438, D-066, D-W24]
autor: Claude (Opus 5.5) con Pablo Tilano
rama: feature/T-680-reconstruccion-vuelo
---
# T-680: análisis forense del lanzamiento del 8 nov y reconstrucción reproducible para la web

## Contexto
El 8 de noviembre volaron Hermes (G80-7T) y Deméter (H135W-8) en el CCCD 2026. Altímetro oficial (ESTER): **Hermes 393 m** (ganó mejor cohete, objetivo 400 m) y **Deméter 598 m**. En tierra no se vio ningún momento después del despegue y se forzaron estados a mano. Pablo descargó los registros y la sesión de la estación y pidió (1) el análisis forense y (2) la recreación de cada vuelo en la web, reproducible.

Archivos: Hermes `HER_M00_20261108_101601_0036.BIN` (arranque 163, `hermes_campo`, `ea4faff+`, 22 dBm); Deméter `DEM_M00_20261108_123013_0011.BIN` (arranque 111, `demeter_campo`, `ea4faff+`, 22 dBm); sesión `20261108_092801_tierra.txt`. Los demás del día son pruebas (HER 0032–0035, DEM 0012, 0014–0016).

## Hallazgos del vuelo

**Hermes: funcionó como se diseñó.**
- Despegue 15:23:03.04 UTC. **BOOST automático (inercial) a los 75 ms** del encendido (la simulación decía 84 ms); en el log, 80 ms con el tick de la tarea.
- La telemetría llegó a 10 Hz durante todo el vuelo (RSSI −46 a −94 dBm) y llevó el momento BOOST. El firmware solo detectaba BOOST: por eso no hubo más momentos.
- Fin de combustión 1,07 s, apogeo 8,8 s, eyección 9,56 s (pico 22 g), choques de apertura de 10,7 y 11,7 g, aterrizaje 57,0 s (golpe de 48 g, terreno 12 m más bajo).
- **El giro satura el LSM6DSO32**: hasta 2294 dps (el tope) en 2227 muestras del costeo. La actitud del costeo no es confiable (T-437).
- BMP581 con 12,6 % de palabras malas a 22 dBm; en la prueba previa (HER 0035) una dio un **BOOST barométrico falso** (T-432).
- Después de aterrizar casi ningún comando subió (~30 intentos, uno con respuesta): la asimetría de enlace ya conocida.

**Deméter**
- Despegue 17:30:42.8 UTC (12:30:43 local). LAUNCH 26 s antes; `momento boost` manual 8,5 s antes del despegue (en una cuenta regresiva no oficial). Eso dejó al cohete en BOOST antes de tiempo y el detector automático ya no podía actuar; reconstruido offline, habría disparado a los 68 ms.
- **La Pi abortó en cada LAUNCH** (aquí y en el ensayo DEM 0012): el ARM se forzó por la temperatura del suelo «dudosa», eso pone `TF_FORZADO`, y con FLY+LAUNCH+`TF_FORZADO` `goalFor` pide `G_READY`. Con el BOOST manual la Pi fue a ASCENT y grabó desde t0+7,1 s (fallback de 15 s) hasta 1 s antes del aterrizaje; terminó en COMPLETE. Sin el BOOST manual también habría llegado, pero si el BOOST cae en los 6,5 s de PREFLIGHT, se atrasa (T-431).
- **BMP581 congelado** desde las 14:48:07 UTC hasta reiniciar (95710,52 Pa y 32,10 °C fijos): la altura de misión quedó en 1,0 m, sin BOOST barométrico ni apogeo por presión. La referencia en `float` no convergió a 0 (los incrementos son menores que su resolución). Volvió a medir en los arranques de la noche (T-432, T-433).
- **QMI8658 bloqueado en ±16 g** desde el golpe de aterrizaje (t0+80,97 s) hasta reiniciar. En plataforma y en vuelo midió bien (T-434).
- El EKF a bordo falló (se quedó en 206 m) por el BMP congelado: la altura que llegó a la web estaba mal.
- Carga de eyección a los 9,4 s, **antes** del apogeo (10,3 s), como predijo la simulación.

**Común**
- El ARM se forzó en los dos cohetes por la temperatura del suelo (D-058).
- Calibraciones: Deméter voló con `93A2DE8F`; Hermes con la anterior (`29B2B23E`), porque la nueva falló tres veces (avisos `0x00300660`: magnetómetros sin giro ni cobertura, QMI) (T-438).

## El apogeo y el ESTER
Con la misma presión, la altura depende de la temperatura que se suponga:

| | ISA | Aire del suelo, −6,5 K/km | Temperatura de la bahía | Oficial |
| --- | --- | --- | --- | --- |
| Hermes | 367 m | 382 m | 392 m | 393 m |
| Deméter | 564 m | 587 m | ~601 m (BME con la T del BMP) | 598 m |

- El ESTER (un BMx280, según Pablo) parece usar **su temperatura interna**: con la de nuestra bahía coincidimos a 1 y 3 m. La temperatura implícita (34 y 30,5 °C) no sigue al aire, que estaba más caliente en el segundo vuelo.
- **La altura física fue menor**: Hermes ~380 m (GNSS 380, EKF 383). El ESTER infla ~3 % por la bahía caliente. Para competir hay que apuntar a los 400 m del ESTER (T-436, pruebas con un ESTER en banco).
- El BME de Deméter estaba más arriba, cerca de la Pi, y en rampa mucho tiempo: más caliente que el ESTER (612 m con su temperatura).

## La reconstrucción (`tools/vuelo_real/`)
- **Recorte** byte a byte de cada `.BIN` entre 5 s antes de LAUNCH y 10 s después del aterrizaje (3,7 y 6,2 MB) y de la sesión de tierra. El SHA-256 y el tamaño de los originales quedan en `vuelos.py` y `manifiesto.json`; los originales se guardan en local u OneDrive.
- **Detector de momentos por motor** (`momentos.py`, D-066), con las mismas entradas que tendrá el firmware. Resultado (s desde el BOOST detectado):

| | Hermes | Deméter |
| --- | --- | --- |
| COAST | 1,07 (anuncio 1,13) | 1,29 (1,35) |
| APOGEO | 8,78 (anuncio 10,01) | 10,32 (11,71) |
| PARACAIDAS | 9,56 | 9,40 (anunciado tras el apogeo) |
| ATERRIZAJE | 57,6 (anuncio 59,6) | 81,6 (83,6) |

  `coast_g` queda por motor (Hermes 4 g, Deméter 3 g): con el «\|a\| < 2 g» original Hermes pasaría a COAST casi 1 s tarde. El apogeo barométrico (3 m bajo el máximo, sostenido 0,3 s) llega 1,2–1,4 s después del máximo: mejorable con la IMU (T-430).
- **EKF en PC** (`estacion/ekf.py`) con la calibración versionada y los momentos del detector; Deméter sin BMP. Apogeo físico 383 y 587 m; velocidad máxima 95,6 y 117,4 m/s (sim. 94 y 129).
- **Altura publicada: solo la referencia ESTER** (isotérmica con la temperatura efectiva que da el apogeo oficial: 34,1 y 30,7 °C).
- **Telemetría a 10 Hz** desde LAUNCH, en la ranura de cada cohete, y antes de LAUNCH los paquetes reales; todo por el `Traductor` de `web1.py` con `modo = "reconstruccion"` (D-W24). Un momento por paquete: si no, APOGEO (a 20 ms de PARACAIDAS) se perdía. La sesión se corrió 34 ms: el reloj del portátil iba atrasado y algunos paquetes figuraban recibidos antes de transmitirse.
- Salida: `datos/vuelos/20261108/web/` (JSONL, snapshot y `resumen.json`). Eventos: fase ARMED, despegue, fin de combustión, apogeo (393 / 598 m), eyección, alarma de descenso (real: >10 m/s antes de abrir el paracaídas) y aterrizaje.

## Cambios fuera de la herramienta
- Contrato `web-1`: `meta.modo` admite `"reconstruccion"` (05 §2.1, `esquema.json`, `tipos.ts`, `tools/web_datos/validacion.py`, `web1.py --modo`).
- `tools/web_datos/validacion.py`: una `pos` del EKF sin fix GNSS ya no es error (Deméter perdió el fix en el quemado y el EKF siguió); solo la del GNSS lo exige.
- `.gitignore`: se versionan los `.BIN` de `datos/vuelos/`.
- Backlog: T-680, T-681 (cargarla en la web) y T-430 a T-438. Decisiones D-066 y D-W24.

## Pruebas
- `python -m unittest discover -s tools/vuelo_real/pruebas -t .`: 5 pruebas en verde (momentos en las ventanas medidas, una sacudida no es BOOST, BMP congelado, reproducibilidad contra lo versionado y validez `web-1`, hashes del manifiesto).
- `python -m unittest discover -s tools/web_datos/pruebas -t .`: 82 en verde.
- `python -m tools.vuelo_real --validar`: los cinco archivos idénticos.
- Las pruebas de TypeScript de la web no se corrieron en esta máquina (no tiene `node_modules`); el cambio es un valor más en un tipo unión.

## Pendiente
- T-681: la página estática que reproduce estos JSONL.
- T-430: el detector en C, con un replay en `native` contra los recortes.
- La actitud de Hermes en el costeo (giro saturado) y la de Deméter tras el aterrizaje no son confiables: la web las muestra igual que llegarían en vivo.
