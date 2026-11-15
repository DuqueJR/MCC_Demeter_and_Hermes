---
fecha: 2026-11-14
tipo: tarea
ids: [T-680, T-681, D-067, T-430, T-431, T-432, T-433, T-434, T-435, T-436, T-437, T-438, D-066, D-W24]
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
- **EKF en PC** (`estacion/ekf.py`) con la calibración versionada y los momentos del detector; Deméter sin BMP. Apogeo físico 381 y 587 m; velocidad máxima 96,0 y 117,7 m/s (sim. 94 y 129). Ver «Correcciones del EKF».
- **Altura publicada: solo la referencia ESTER** (isotérmica con la temperatura efectiva que da el apogeo oficial: 34,1 y 30,7 °C).
- **Telemetría a 10 Hz** desde LAUNCH, en la ranura de cada cohete, y antes de LAUNCH los paquetes reales; todo por el `Traductor` de `web1.py` con `modo = "reconstruccion"` (D-W24). Un momento por paquete: si no, APOGEO (a 20 ms de PARACAIDAS) se perdía. La sesión se corrió 34 ms: el reloj del portátil iba atrasado y algunos paquetes figuraban recibidos antes de transmitirse.
- Salida: `datos/vuelos/20261108/web/` (JSONL, snapshot y `resumen.json`). Eventos: fase ARMED, despegue, fin de combustión, apogeo (393 / 598 m), eyección, alarma de descenso (real: >10 m/s antes de abrir el paracaídas) y aterrizaje.

## El giro de los cohetes es real
Hermes llegó al tope del LSM6DSO32 (2294 dps) en el costeo. Se verificó con tres medidas independientes:
- el QMI8658 coincide (en Hermes satura en su tope de 1024 dps; en Deméter, 801 frente a 812 dps del LSM);
- los magnetómetros, ya calibrados, cuentan las mismas vueltas que la integral del giro (Hermes 3–4 s: 4,0 frente a 4,3; Deméter con el QMC: 2,18, 1,68 y 0,87 frente a 2,37, 1,77 y 0,89). Sin calibrar, el offset del montaje engaña: la frecuencia dominante salía ~2,4 veces mayor;
- el giro es proporcional a la velocidad en todo el costeo de Hermes (22–26 dps por m/s): es el alabeo por aletas desalineadas (Pablo: las de Hermes no eran las más derechas).
El MMC de Deméter no sirve con su calibración actual (el campo calibrado da 0,55 G en vez de ~0,28).

## Correcciones del EKF (D-067)
La primera reconstrucción de Deméter tenía la velocidad mal: 13 m/s a los 2,5 s y 72 m/s a los 8 s, subiendo hacia el apogeo, cuando el barómetro da 81 y 27 m/s. Causas y cambios, en `estacion/ekf.py` y en `ekf_core.cpp` por igual:
1. **El GNSS entraba en lo vertical** por su `vD`. En el quemado de Deméter el M10S dio fix 3D con hAcc 2 m pero a −3 m con el cohete a 300 m, y su velocidad vertical arrastró la del filtro. Ahora lo vertical sale solo de los barómetros, como estaba decidido, y una solución con la altura a más de 30 m del barómetro se descarta entera.
2. **La puerta descartaba el barómetro contra la inercial.** Cuando la inercial se desviaba con su covarianza pequeña, el barómetro parecía el equivocado (Pablo: los sensores absolutos son el ancla). Se sube el ruido de proceso en el quemado (×20 acel., ×3 giro) y en el costeo (×10 y ×4); el barómetro lleva más ruido en el quemado (presión dinámica) y en la eyección (antes se apagaba 2 s) y nunca se apaga. Al reabrir una posición se abre también su velocidad.
3. Resultado: Deméter con velocidad vertical igual a la del barómetro (75, 49, 32 y 15 m/s a 3, 5, 7 y 9 s frente a 74, 53, 35 y 17), horizontal de 2–10 m/s, cabeceo de 90 a 12° hasta el apogeo y 0 rechazos del GNSS; el BME pasó de 8,3 m de innovación rms (1607 rechazos en una variante) a 1,6 m. Hermes queda igual de bien.
4. El filtro a bordo y el de PC siguen iguales (`test/host/comparar_ekf.py`, mediana de 0,003 m en altura y 0,003 m/s en velocidad vertical) y las pruebas de PC del firmware siguen en verde.
- **Limitación que queda:** con el giro a 800–2000 dps y casi 0 g, la actitud en el costeo depende mucho de la alineación del eje de giro; en Hermes, además, el LSM satura (T-437).

## `web1.py`: lo que manda es el cohete
`web1.py` solo publicaba posición y velocidad con fix GNSS, aunque el EKF las tuviera: en el quemado de Deméter la web se quedaba 2,6 s sin altura. Ahora, con el EKF listo, las publica (05 §0: `null` es «sin fix ni EKF»). Sus 118 pruebas siguen en verde.

## La carga en la web (T-681)
- El reproductor de la simulación del público (T-635) ya hacía lo necesario: descarga un guion `web-1` al pulsar un botón y lo reproduce en el navegador, sin servidor. Se reutiliza con un formato nuevo, `reconstruccion-1`, cuyo `meta` debe venir en modo `reconstruccion`: `esGuion` rechaza cualquier otro modo, así que nunca pasa por un vuelo en vivo.
- `tools/vuelo_real/guion_web.py` genera `gui/web/src/assets/<mision>/vuelo_real.json` con el vuelo completo a 10 Hz y la espera en tierra a 1 Hz, como el relay: 681 y 974 KB, 58 y 84 KB comprimidos (como los sirve la web). El tope de 400 KB del guion de la simulación (T-635) no aplica: es el vuelo real y no se diezma (Pablo).
- En `/hermes/` y `/demeter/`, el botón pasa a ser «Ver el vuelo real», con su aviso (apogeo oficial de 393 y 598 m); durante la repetición el indicador dice REPETICIÓN, la marca REAL y el banner «Repetición: vuelo real del 8 de noviembre de 2026». Sin transmisión, la página dice que el lanzamiento fue el 8 de noviembre.
- Prueba nueva: `gui/web/pruebas/vuelo_real.test.ts`.

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
