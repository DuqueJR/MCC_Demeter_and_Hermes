# tools/web_datos: generador de datos de ejemplo de la web (T-612)

Convierte la simulación de OpenRocket en los JSONL del contrato `web-1` ([05_contrato_datos_web.md](../../docs/08_gui/05_contrato_datos_web.md) §5). Los consume el repetidor de desarrollo (T-630) y las pruebas del contrato (T-611).

- **Deméter:** sale de la simulación real `datos/simulaciones/openrocket/demeter_H135W-8_santa-fe-antioquia_sim2.csv` (`meta.modo = "simulacion"`).
- **Hermes:** **sintético** (`meta.modo = "sintetico"`, PEN-W04). Es la forma de Deméter escalada al G80-7T: el tiempo, para que el retardo sea de 7 s (`G80_RETARDO_S`), y las distancias por `HERMES_ESCALA_ALTURA` (apogeo de unos 502 m). Se reemplaza cuando exista su simulación (PEN-07).

## Uso

Desde la **raíz del repo**, igual en Windows y en macOS (Python 3.9 o más, sin dependencias):

```
python -m tools.web_datos                 # los 12 archivos en gui/web/dev/datos/
python -m tools.web_datos --validar       # además valida contra lo que exige el documento 05
python -m tools.web_datos --mision demeter --escenario nominal --salida OTRA_CARPETA
```

Pruebas (pytest o unittest, a elección):

```
python -m pytest tools/web_datos
python -m unittest discover -s tools/web_datos/pruebas -t .
```

La salida es determinista (ruido con semilla): volver a generar produce los mismos bytes, y una prueba compara los JSONL versionados con lo que genera el código. **Si cambias el generador, vuelve a generar y sube los archivos.**

## Qué hace cada archivo

| Archivo | Contenido |
| --- | --- |
| `constantes.py` | Todos los números. Las secciones 1 a 3 replican `constantes.md` con el mismo nombre; la 4 son parámetros propios del generador `(P)` |
| `openrocket.py` | Lee el CSV (columnas por prefijo ASCII, eventos de los comentarios) |
| `perfil.py` | Perfil continuo (Hermite), escala de Hermes y aceleración del descenso |
| `actitud.py`, `geo.py` | Cuaternión de la nariz y geodesia WGS84 local |
| `simulador.py` | Arma los mensajes del contrato para una misión y un escenario |
| `validacion.py` | Valida campos, tipos, rangos y decimales de 05. **No es el esquema oficial** (`esquema.json` es de T-611) |
| `generar.py`, `__main__.py` | Línea de comandos |

## Los 6 escenarios (cada uno para las dos misiones)

| Escenario | Qué muestra |
| --- | --- |
| `nominal` | PREFLIGHT (sin fix, luego fix y Go/No-Go en verde), ARM a los 8 s, 10 s en ARMED, vuelo completo y 30 s en LANDED |
| `lkp_descenso` | Se pierde la señal a 120 m en el descenso (el enlace se degrada 3 s antes). El latido de la estación sigue y la edad del último paquete crece |
| `descenso_rapido` | El descenso va 1,6 veces más rápido (`DESCENSO_RAPIDO_FACTOR`): Vz < −`ALARMA_DESCENSO_MS`, evento `alarma_descenso` y `alarmas.descenso_rapido` |
| `backfill` | Pierde el 25 % de los NAV en vuelo y, ya aterrizado, retransmite ~850 registros a 8 por segundo |
| `espera_rampa` | 30 min en PREFLIGHT a 1 Hz (consumo de la página) |
| `relay_caido` | Un vuelo nominal sin nada del relay entre T+20 s y T+40 s; al volver llega un `meta` |

## Cómo se arma cada mensaje

- Todo va sobre la rejilla TDMA de 100 ms. En 9 de cada 10 ciclos sale NAV (con su `seq` real) y en el décimo, STATUS. En vuelo pasan todos los NAV (~9 Hz); en tierra, uno por segundo.
- `t_rel_ms` de cada línea es el instante en que lo emite el relay (`relay_utc_ms` menos el inicio del archivo, 2026-11-08 15:00 UTC).
- Los eventos llevan el tiempo de la simulación: **no** incluyen la demora de detección de la máquina de estados real (la ventana de 100 ms del despegue y los `LANDED_VENTANA_S` = 5 s del aterrizaje). `t_mas_s` cuenta desde el despegue (LIFTOFF).
- **Simulado con fórmulas simples (no son los cálculos reales de la estación):** `calc` (distancia, azimut, elevación, elipse y tiempos), `enlace` (RSSI, SNR y pérdidas) y el estado de la batería, la SD, las temperaturas y el GNSS.
- La orientación sale de la elevación y el rumbo de la nariz de OpenRocket, sin giro (la simulación no modela el roll). La fuerza específica se pasa al marco del cuerpo y se promedia en los 100 ms previos, como el NAV real.
