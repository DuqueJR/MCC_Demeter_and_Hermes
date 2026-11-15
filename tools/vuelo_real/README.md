# tools/vuelo_real: reconstrucción reproducible de los vuelos reales (T-680)

Convierte lo que registraron Hermes y Deméter el 8 de noviembre de 2026 en los JSONL de `web-1` con `meta.modo = "reconstruccion"` (D-W24). La web los reproduce y muestra los momentos a medida que suceden.

## Uso

Desde la **raíz del repo** (Python 3.9 o más, con `numpy`, como `estacion/ekf.py`):

```
python -m tools.vuelo_real                 # genera datos/vuelos/20261108/web/ desde los recortes del repo (~20 s)
python -m tools.vuelo_real --validar       # además compara con lo versionado
python -m unittest discover -s tools/vuelo_real/pruebas -t .
```

Rehacer los recortes solo hace falta si cambia la ventana. Necesita los originales, que **no van al repo** (177 y 248 MB): se guardan en local u OneDrive.

```
python -m tools.vuelo_real recortar --originales CARPETA_DE_LOS_BIN --sesiones CARPETA_DE_LAS_SESIONES
```

El recorte verifica el tamaño y el SHA-256 de cada original contra `vuelos.py` antes de copiar nada.

## Qué entra y qué sale

| Archivo | Qué es |
| --- | --- |
| `datos/vuelos/20261108/HER_vuelo_20261108.BIN`, `DEM_vuelo_20261108.BIN` | Los registros del `.BIN` original entre 5 s antes de LAUNCH y 10 s después del aterrizaje, **los mismos bytes** (más el FILEHDR). Se leen con `estacion/tblog.py` como cualquier `.BIN` |
| `datos/vuelos/20261108/tierra_<mision>_20261108.txt` | La sesión de la estación de tierra del día, recortada a la misma ventana |
| `datos/vuelos/20261108/manifiesto.json` | SHA-256 y tamaño de cada original y de cada recorte, la ventana y el desfase UTC del reloj del cohete |
| `datos/vuelos/20261108/web/<mision>.jsonl` | Los mensajes de `web-1`, con el formato de `gui/web/dev/datos/`: `{"t_rel_ms", "evento", "datos"}`, empezando por `meta` |
| `datos/vuelos/20261108/web/<mision>_snapshot.json` | El snapshot al final (§3 del contrato), con la `serie` completa |
| `datos/vuelos/20261108/web/resumen.json` | Apogeos por método, momentos (hecho y anuncio), velocidad máxima, temperaturas y parámetros del detector |

## Cómo se arma

1. **Momentos** (`momentos.py`): el detector por motor, prototipo de T-430 (después va a C). Usa la norma de la aceleración y del giro del LSM6DSO32 y la altura barométrica (BMP581 si está vivo; si se congela 0,5 s, BME280), como los tendrá el firmware. Los momentos se anuncian en el siguiente tick de 20 ms de la tarea de misión. **No usa los comandos manuales del día.**
2. **EKF en PC** (`estacion/ekf.py`) sobre el recorte, con la calibración versionada (`estacion/calib_<cohete>.json`), los momentos del detector para los pesos por fase y, en Deméter, sin el BMP581 (congelado).
3. **Altura** (`altura.py`): se publica solo la **referencia ESTER**. Es la hipsométrica con una temperatura efectiva constante, la que reproduce el apogeo oficial (Hermes 34,1 °C, Deméter 30,7 °C). El resumen guarda además la física (aire del suelo con −6,5 K/km, la que coincide con el GNSS), la de la temperatura medida en la bahía, la del EKF y la del GNSS.
4. **Telemetría** (`reconstruir.py`): desde LAUNCH, un TELEM cada 100 ms en la ranura del cohete. Posición, velocidad, actitud, fuerza específica y giro salen del EKF; estado y momento, del detector; la altura, de la referencia; el GNSS, del PVT. Batería, temperaturas, banderas, la Pi, ACK, RSSI y SNR salen del paquete real más cercano que recibió tierra. Antes de LAUNCH van los paquetes reales tal cual.
5. Todo pasa por el **mismo `Traductor` de `estacion/web1.py`** que usó la estación en vivo. La sesión se corre para que el reloj del portátil (iba ~34 ms atrasado) quede en UTC.

## Reproducibilidad

- La salida es determinista: en la misma máquina sale idéntica byte a byte.
- Entre máquinas (otra versión de numpy) el EKF puede mover un redondeo: `--validar` acepta números que difieran a lo sumo en dos unidades de su último decimal, y exige iguales el texto, los eventos y la cantidad de mensajes.
- **Si cambias el código, vuelve a generar y sube los archivos.**

## Resultados (8 nov)

| | Hermes (G80-7T) | Deméter (H135W-8) |
| --- | --- | --- |
| Apogeo oficial (ESTER) y publicado | 393,0 m | 598,0 m |
| Con la temperatura de la bahía | 392,1 m | — (BMP581 congelado) |
| Físico (aire del suelo) / EKF / GNSS | 381,9 / 383,2 / 379,9 m | 586,7 / 586,6 / 534,3 (perdió el fix en el quemado: no sirve) |
| Fin de combustión (hecho) | 1,07 s | 1,29 s |
| Apogeo (hecho / anuncio) | 8,78 / 10,01 s | 10,32 / 11,71 s |
| Eyección | 9,56 s (después del apogeo) | 9,40 s (antes del apogeo) |
| Aterrizaje (hecho / anuncio) | 57,6 / 59,6 s | 81,6 / 83,6 s |

Tiempos desde el BOOST detectado (el encendido es ~60 ms antes).
