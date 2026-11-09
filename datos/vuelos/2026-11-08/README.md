# Vuelos del 8 de noviembre de 2026 (Hermes y Demeter)

Datos reales de los dos vuelos, para analizarlos y usarlos como base de desarrollo. **No se editan:** si hace falta una versión procesada, se genera aparte y se documenta de dónde sale.

El análisis está en la bitácora:
- [`docs/07_bitacora/2026-11-08_analisis_forense-vuelos.md`](../../../docs/07_bitacora/2026-11-08_analisis_forense-vuelos.md)
- [`docs/07_bitacora/2026-11-08_analisis_forense-vuelos_ampliacion.md`](../../../docs/07_bitacora/2026-11-08_analisis_forense-vuelos_ampliacion.md)

**Horas en Bogotá (UTC−5).** `t_desde_launch_s` es el tiempo desde el comando `launch` de cada cohete.

| | Hermes | Demeter |
| --- | --- | --- |
| Comando `launch` | 10:22:57 | 12:30:16 (el sexto intento del día) |
| `t_us` del `launch` en `mision.csv` (reloj de la placa) | 7 376 690 776 µs | 14 034 940 233 µs |
| Origen usado para `t_desde_launch_s` | 7 376 694 207 µs (el primer PVT del registro, 3 ms después del `launch`) | 14 034 940 000 µs (el `launch` redondeado a 10 ms) |
| Registro en la SD | `HER_M00_20261108_101601_0036.BIN` | `DEM_M00_20261108_123013_0011.BIN` |
| Duración del registro | 3428 s | 4728 s |

## Qué hay

```
hermes/  y  demeter/
├── <registro>.BIN.txt        resumen de tblog.py del registro completo
├── bin/                      el .BIN original, comprimido y partido (ver abajo)
└── csv_ventana/              CSV de tblog.py recortados al vuelo (+ lo completo que es chico)
tierra/                       sesión de la estación de tierra (ventanas de vuelo) e historial de comandos
web/                          lo que mostraba la web y su reproceso con estacion/web1.py
```

### `csv_ventana/`
- **Ventana de vuelo:** de 30 s antes a 160 s después del `launch` en Hermes (más 780–830 s: la divergencia del EKF) y a 200 s en Demeter. Archivos: `imu`, `ekf_abordo`, `bar`, `bmp`. Llevan la columna `t_desde_launch_s`.
- **Completos:** `radio_completo.csv`, `pvt_completo.csv` (todo el registro), y `mision.csv`, `pi.csv` (solo Demeter), `sd.csv`, `latidos.csv`, `pps.csv`.
- **No se incluyen** `lsm`, `mag` ni `mmc`: pesan cientos de MB. Salen del `.BIN` con `estacion/tblog.py --csv`.

### `bin/`: el registro original
Los `.BIN` pesan 177,6 MB (Hermes) y 248,3 MB (Demeter), y GitHub no acepta archivos de más de 100 MB. Están comprimidos con `gzip -9` y partidos en trozos de 45 MB. Para reconstruirlos:

```
cat bin/HER_M00_20261108_101601_0036.BIN.gz.parte-* | gunzip > HER_M00_20261108_101601_0036.BIN
shasum -a 256 HER_M00_20261108_101601_0036.BIN        # debe coincidir con SHA256_del_BIN_original.txt
```

Con el `.BIN` reconstruido sirven `estacion/tblog.py`, `estacion/ekf.py` y `estacion/calib.py`. El formato está en [`formato_log.md`](../../../docs/04_diseno/formato_log.md).

### `tierra/`
- `sesion_tierra_ventana_hermes_1019-1033.txt` y `sesion_tierra_ventana_demeter_1226-1243.txt`: recortes de `estacion/sesiones/20261108_092801_tierra.txt` (la sesión completa pesa 22 MB y no se versiona). Son la entrada de `estacion/web1.py`.
- `historial_comandos.txt`: todas las líneas `[cmd ]` de las dos sesiones de tierra del día (09:28 y 18:43), sin los avisos «hay un comando en curso». Aquí se ven los «sin respuesta tras 4 intentos».
- **No hay sesión de tierra entre las 12:43 y las 18:43**, y el comando `dormir` no aparece en ninguna.

### `web/`
- `relay_snapshot_vivo_*.json`: lo que servía el relay público a las 19:22, ya con el vuelo mezclado con las prácticas (fase `PREFLIGHT` y apogeo de Demeter de 227 m: incorrecto).
- `web1_*_ventana.jsonl` y `snapshot_reproceso_*.json`: el reproceso de las ventanas de vuelo con `python estacion/web1.py <ventana> --salida … --snapshot …`. Base para reconstruir la misión de forma estática. **Ojo:** la altura de Demeter sale del EKF de a bordo y está mal (ver la bitácora).

## Limitaciones conocidas
- La altura de Demeter en la telemetría es incorrecta (apogeo real: 534 m con el GNSS, 564 m con el barómetro; la web dice 227 m).
- Hermes: a partir de t ≈ 796 s (10:36:13) el EKF de a bordo divergió; el cuaternión de ahí en adelante no vale.
- El BMP581 de Demeter estuvo congelado en 95 710,5 Pa.
