---
fecha: 2026-10-25
tipo: tarea
ids: [T-612, PEN-W04, PEN-07, D-W07]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-612-generador-datos-web
---
# T-612: generador de datos de ejemplo de la web (OpenRocket a JSONL `web-1`)

## Contexto
La web se construye desde ya con datos simulados (D-W07). T-612 entrega los 12 JSONL (2 misiones por 6 escenarios) que usarán el repetidor (T-630) y la validación del contrato (T-611). Sesión web (`SESION=web`): `tools/web_datos/` es carpeta del plan web.

## Qué se hizo
- Paquete Python `tools/web_datos/` (sin dependencias; `python -m tools.web_datos`, con pathlib; sin bash). Detalle de módulos y escenarios en su [README](../../tools/web_datos/README.md).
- **Deméter:** sale de `demeter_H135W-8_santa-fe-antioquia_sim2.csv` (454 puntos, `meta.modo = "simulacion"`). El CSV se lee por prefijo ASCII de columna (el archivo trae bytes dañados en los acentos). La altitud y la Vz se remuestrean con interpolación de Hermite para no perder el apogeo. Las posiciones salen del este y el norte de la simulación (la latitud y la longitud del CSV solo traen 3 decimales).
- **Hermes:** sintético (`meta.modo = "sintetico"`, PEN-W04): la forma de Deméter con el tiempo escalado para que el retardo sea de 7 s (G80-7T) y las distancias por 0,75 (apogeo de 502 m). Es una suposición `(P)`: el escalado de tiempo es uniforme, así que la velocidad máxima y la de descenso (7,98 m/s) quedan en el mismo orden que las de Deméter.
- Los 6 escenarios de 05 §5 para cada misión: `nominal`, `lkp_descenso` (corte a 120 m), `descenso_rapido` (alarma), `backfill`, `espera_rampa` (30 min a 1 Hz) y `relay_caido` (hueco de 20 s y `meta` al volver).
- Rejilla TDMA de 100 ms: NAV en 9 de cada 10 ciclos con su `seq` real, STATUS en el décimo; ~9 Hz en vuelo y 1 Hz en tierra (`WEB_TASA_TIERRA_HZ`). Cuaternión y fuerza específica (promedio de 100 ms) en el marco del cuerpo desde la elevación y el rumbo de la nariz de OpenRocket (sin roll: la simulación no lo modela).
- Simulado con fórmulas simples (T-S08 hará los reales): `calc`, `enlace`, batería, SD, temperaturas y GNSS. Ruido determinista con semilla: regenerar produce los mismos bytes.
- `constantes.py` replica con el mismo nombre las `WEB_*` y las constantes de proyecto que usa; una prueba compara las `WEB_*` con `constantes.md` §9. Los parámetros propios del generador están en la sección 4 del archivo, todos `(P)`.
- Validador propio (`validacion.py`) de lo que exige 05: campos exactos (ninguno omitido ni sobrante; `null` = sin dato), tipos, rangos, decimales de §0 y coherencias (fase y fase_cod, cuaternión unitario con w ≥ 0, `pos.fuente`). **No es el esquema oficial.**
- Commits: `9c7380c`, `54427a6`, `4ae6138`, `a75c631`, `1b5f870` y este de bitácora.

## Evidencia
Criterio de aceptación (Deméter, `nominal`). La simulación tiene el apogeo en 669,321 m (máximo de sus 454 filas):

| Magnitud | Simulación | JSONL | Diferencia |
| --- | --- | --- | --- |
| Apogeo, máx. de `pos.alt_agl_m` en los estados | 669,321 m | 669,3 m | 0,02 m (< 1 m) |
| Apogeo, `valor` del evento `apogeo` | 669,321 m | 669,3 m | 0,02 m |
| `despegue` (LIFTOFF) | 0,029 s | `t_mas_s` 0,00 (T0) | 0,000 s |
| `fin_combustion` (BURNOUT) | 2,072 s | `t_mas_s` 2,04 (+0,029 = 2,069 s) | 0,003 s |
| `eyeccion` (EJECTION_CHARGE) | 10,072 s | `t_mas_s` 10,04 (10,069 s) | 0,003 s |
| `apogeo` (APOGEE) | 11,536 s | `t_mas_s` 11,51 (11,539 s) | 0,003 s |
| `aterrizaje` (GROUND_HIT) | 85,083 s | `t_mas_s` 85,05 (85,079 s) | 0,004 s |

- Con el reloj del cohete (`t_ms`) los eventos coinciden con la simulación al milisegundo. La diferencia de arriba sale solo de redondear `t_mas_s` a 2 decimales y de que cuenta desde LIFTOFF. Contado desde la ignición (t = 0) la diferencia máxima sería de 0,03 s. Ambas, muy por debajo de 0,1 s.
- Fases de Deméter: ARMED (8 s del archivo), BOOST T+0,00, COAST T+2,04, (eyección T+10,04), APOGEE T+11,51, DESCENT T+11,72 (Vz < −2 m/s), LANDED T+85,05. Es la ruta T10 (eyección antes del apogeo, sin FREE_FALL).
- Otras cifras de Deméter: velocidad máxima 129,1 m/s, aceleración pico en el eje 10,4 g, Vz mínima −9,31 m/s (la alarma de 10 m/s no se dispara en el nominal).
- Hermes sintético: apogeo 502,0 m, fin de combustión T+1,79 s, eyección T+8,79 s (retardo 7,00 s), apogeo T+10,07 s, aterrizaje T+74,42 s, Vz mínima −7,98 m/s.
- `descenso_rapido` (Deméter): alarma activa a T+12,01 s (Vz −10,0 m/s) y se apaga al aterrizar (T+57,47 s). `lkp_descenso`: el último estado llega a 120,6 m y el archivo sigue 43 s con solo el latido de la estación.
- Archivos (mensajes / tamaño): Deméter nominal 1095 / 1041 KB, lkp 890 / 828, descenso rápido 794 / 735, backfill 1343 / 1066, espera 5401 / 3682, relay caído 876 / 818; Hermes nominal 976 / 888, lkp 756 / 668, descenso rápido 714 / 631, backfill 1180 / 891, espera 5401 / 3535, relay caído 757 / 673. En total 16 MB en disco (el de espera_rampa comprime a 100 KB).
- `python -m tools.web_datos --validar`: 12 archivos, 0 errores.
- `python -m pytest tools/web_datos`: **66 pasaron**. `python -m unittest discover -s tools/web_datos/pruebas -t .`: 66 OK. Python 3.14.3, Windows 11.

## Decisiones tomadas o propuestas
Ninguna cambia un contrato. Estas son ambigüedades de 05 que resolví de la forma más conservadora; el documentador decide si se formalizan en `web-1` antes del congelamiento (H0):

1. **`evento`: `fase` y `activa` siempre presentes.** 05 §2.5 dice que `fase` va en los eventos de tipo `fase` y `activa` en la alarma, pero §0 dice que un campo nunca se omite. Los emití en todos los eventos, con `null` cuando no aplican (y `valor` también). Propuesta: dejarlo escrito en 05 §2.5. Además, `camaras` no dice dónde va el nuevo estado de `act.cam_ok`: usé `activa`.
2. **`secundario` (Deméter).** El ejemplo de 05 es `{"codigo": 12, "texto": "Grabando"}`, pero el `StatusCode` real de la Pi (`visionpack/demeter_protocol.py`) es RECORDING = 0x30 (48) y ASCENT = 0x08, y ningún documento fija los textos en español. Usé los códigos del código de la Pi y textos propios (tabla `STATUS_PI_TEXTO` en `constantes.py`). Propuesta: que 05 o `visionpack_integracion` fije la tabla código a texto, y cambiar el ejemplo de 05.
3. **`t_mas_s`.** Lo cuento desde LIFTOFF (BOOST) como dice 05 y con 2 decimales como el ejemplo. Antes de ese instante (la fase ARMED) es `null`.
4. **Tiempos de los eventos.** Son los de la simulación. En la máquina de estados real el despegue se confirma 100 ms después (`LAUNCH_VENTANA_MS`) y el aterrizaje 5 s después (`LANDED_VENTANA_S`), así que la web real verá LANDED unos 5 s más tarde que estos datos. Si interesa probar eso, se agrega un parámetro.
5. **`q` con 5 decimales.** 05 §0 no fija la precisión del cuaternión; el ejemplo trae 3, pero el protocolo da 1/32767.
6. **`proto_version` / `fw_version`.** Para cubrir las dos ramas de PA-15, Deméter va con `proto_version` 3 y `fw_version` `"a1b2c3d"`, y Hermes con 2 y `null`. Es solo de ejemplo.
7. **`seq` en tierra.** 05 no dice qué hace `seq` cuando el relay baja a 1 Hz: lo dejé con los saltos reales (la estación cuenta todos los NAV, el relay reenvía uno por segundo).
8. **Alarma de descenso.** No hay ventana definida en `constantes.md` (PEN-20 propone 11 m/s con 2 s). El generador usa solo el umbral `ALARMA_DESCENSO_MS` = 10,0, sin ventana.
9. **Peso en el repo.** 16 MB de JSONL en `gui/web/dev/datos/` (unos 1,5 MB comprimidos en git). Si molesta, la alternativa es dejar solo `nominal` y `lkp_descenso` versionados y generar el resto en `npm run` de desarrollo; lo dejé completo porque T-611 y T-630 los esperan ahí.
10. **Hermes sintético.** Los parámetros (0,75 de altura, retardo 7 s) son suposiciones mías, no datos de Hermes. Se reemplazan al llegar su simulación (PEN-07).

## Problemas y cómo se resolvieron
- El CSV dice ser UTF-8 pero trae caracteres dañados (U+FFFD) en los acentos y los símbolos: las columnas se buscan por su prefijo ASCII, sin acentos.
- Las posiciones del CSV tienen 4 cifras significativas, y con pasos de 4 ms las diferencias son ruidosas. La velocidad horizontal sale del módulo del CSV y la dirección de una ventana de al menos 0,2 s.
- Primera corrida de las pruebas: una falló por comparar `−10,0 < −10,0` en el cruce de la alarma (el valor es justo el umbral); la prueba se corrigió a `<=`.
- `python -I -m tools.web_datos` no encuentra el paquete (el modo aislado quita el directorio actual). Se ejecuta sin `-I`.

## Pendiente / siguiente paso
- **Validar contra `esquema.json` queda para T-611**, que todavía no existe: no inventé un esquema oficial. Cuando exista, agregar a `pruebas/test_escenarios.py` una prueba que valide los 12 archivos con él y comparar con `validacion.py` (el criterio de aceptación de T-612 dice "los 12 archivos validan contra el esquema (cuando esté T-611)").
- No se corrieron `npm run lint`, `build`, `test` ni `e2e` de `gui/web` (no hay `node_modules` en el worktree); los archivos nuevos de `gui/web/dev/datos/` son `.jsonl`, que Biome no revisa.
- No probado en macOS ni con Python menor que 3.14 (el código evita sintaxis posterior a 3.9, pero sin verificar). Pytest hace falta solo para la opción pytest; `unittest` viene con Python.
- No se actualizó `tools/README.md` (tabla compartida con otras tareas): el documentador puede agregar la fila de `tools/web_datos/`.
- T-630 debe leer `t_rel_ms` como el instante de emisión del relay; el hueco de `relay_caido` y los saltos de `seq` son intencionales.

## Documentos afectados
Ninguno editado. A consolidar por el documentador: estado de T-612 en el backlog, las propuestas 1 a 8 sobre 05 y la fila de `tools/README.md`.
