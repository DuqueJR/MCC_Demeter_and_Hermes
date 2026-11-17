---
fecha: 2026-11-03
tipo: tarea
ids: [T-611d, D-050, D-047, T-661]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-611d-salud-nulable
---
# T-611d: `web-1` con `salud` nulable (D-050) y el validador de `web_datos` alineado con el esquema

## Contexto
`estacion/web1.py` (T-661) no tiene de dónde sacar `salud.boot_count` ni `salud.calib.*` con `net_proto`, y mandaba `0` y `false`: la web habría mostrado "sin calibrar" aunque el cohete lo estuviera (propuesta 2 de T-661). D-050 los hace nulables. Además `tools/web_datos/validacion.py` (T-612) era más estricto que `esquema.json` en 5 puntos (propuesta 1 de T-661), y las pruebas de `estacion/` lo normalizaban antes de usarlo. Esta tarea aplica D-050 en el documento, el esquema, los tipos, la vista y el validador, y deja que el productor y sus pruebas usen todo sin parches.

## Qué se hizo
- **`docs/08_gui/05_contrato_datos_web.md`:** §0 agrega `boot_count` y `calib.*` a los campos nulables de `salud`; el registro de cambios aceptados agrega D-050; la fila de `seq` en §2.2 aclara que con `net_proto` (`proto_version` 4) es el índice de ranura, `utc_ms/40`.
- **`gui/web/src/contrato/esquema.json` y `tipos.ts`:** `boot_count` es `integer | null` y cada `calib.*` es `boolean | null` (`calib` sigue siendo objeto obligatorio, y sus cinco campos no se omiten).
- **`gui/web/src/mision/vista_salud.ts` y `Salud.tsx`:** `completa: boolean | null`. Solo `false` cuenta como "calibración sin terminar" (aviso); `null` no genera aviso. En el detalle, `null` se muestra con ícono de información, "Sin dato" y `--estado-sin-dato` (gris neutro, clase nueva `.salud-sin-dato`), no "En proceso". Un resumen con las cinco en `null` sigue en "Todo en orden".
- **`tools/web_datos/validacion.py`:** cada punto se verificó contra `esquema.json` (el esquema manda):
  - `relay_utc_ms` admite `null` (y la comprobación `rx_utc_ms <= relay_utc_ms` solo corre si hay relay);
  - `seq` sin tope (solo `>= 0`);
  - se quitó el error "lkp sin posición" (`lkp` con `pos = null` es el caso de PA-22);
  - `enlace.rssi_dbm`, `snr_db` y `perdidos_pct_10s` nulables;
  - `temp_esp_c`, `sd_libre_mb`, `apogeo_m`, `estacion.pos` (y `estacion.pos.alt_msl_m`) nulables;
  - `boot_count` y `calib.*` nulables (D-050);
  - además, los demás campos que el esquema ya admitía nulos y el validador no: `estado.pos.alt_msl_m`, `salud.bat_mv`, `alt_origen_msl_m`, `rssi_tierra_dbm` y `ultimo_cmd_seq`. Un script comparó los dos (nulabilidad de cada campo del validador contra la del esquema): quedan 0 diferencias.
  - Cabecera y README ya no dicen que `esquema.json` "todavía no existe".
- **`estacion/web1.py`:** `boot_count` y `calib.*` salen `null`.
- **`estacion/pruebas/contrato.py`:** se eliminó `_normalizar`; usa `validacion.py` tal cual. `test_web1.py` comprueba `boot_count` y `calib` en `None`.
- **Pruebas nuevas:**
  - `gui/web/pruebas/salud.test.ts`: 2 casos (todo `null`: sin aviso y "Todo en orden"; mixto: solo `false` es aviso).
  - `gui/web/pruebas/contrato.test.ts`: 1 caso (el esquema acepta `null` en `boot_count` y `calib.*`, y rechaza `calib` nulo, `0` o `"3"`).
  - `gui/web/e2e/recuperacion_salud.spec.ts`: 1 caso de Salud con `null` (5 filas "Sin dato", sin aviso, ninguna "En proceso" ni "Completa").
  - `tools/web_datos/pruebas/test_validacion.py` (nuevo, 14 pruebas): un caso por punto, y una prueba que compara la nulabilidad de cada campo del validador con la de `esquema.json`.
- **No se tocó** `estacion/calib.py` ni `estacion/dashboard.py`, ni el firmware, ni otros contratos.

## Evidencia
- `npm ci` en `gui/web/` sin vulnerabilidades. `npx tsc --noEmit` sin errores; Biome sin errores (10 advertencias que ya estaban).
- `npm test` (Vitest): **19 archivos, 381 pruebas pasaron, 1 omitida** (la que ya se omitía).
- `python3 -m unittest discover -s tools/web_datos/pruebas -t .`: **81 pruebas, OK** (14 nuevas).
- `python3 -m unittest discover -s estacion/pruebas`: **74 pruebas, OK**, ya sin normalizar ningún mensaje.
- Las 14 pruebas nuevas de `test_validacion.py` **fallan con el validador anterior** (15 fallos, incluida la comparación con el esquema) y pasan con el nuevo.
- `npm run build` (tsc, vite build y aislamiento) OK.
- Playwright (`e2e/recuperacion_salud.spec.ts`, 36 casos, 390x844 y 1440x900): **35 pasaron**, incluido el caso nuevo de Salud con `null`. Falló 1: `Recuperación … en descenso: el centro de la elipse …`, por un `404` de `public/mapas/santa_fe.pmtiles` (el archivo no está en el repo; ver `src/mapa/base.ts`). Es una prueba de Recuperación, ajena a este cambio. No la corrí sobre `develop` para confirmar que ya fallaba.

## Decisiones tomadas o propuestas
- Se aplicó D-050 tal como está (aprobada el 2026-11-03). No hace falta `web-2`.
- **`validacion.py` sigue exigiendo tres campos que el esquema deja opcionales:** `meta.proto_version`, `estado.lkp` y `salud.fw_version` (el esquema no los pone en `required`; el generador de T-612 y `web1.py` siempre los emiten). No se tocó porque no estaba en la lista y una prueba existente (`test_campo_omitido`) depende de ello: dejarlos exigidos detecta si el generador deja de emitirlos. Si se prefiere, se vuelven opcionales en el validador en otra tarea.
- **`validacion.py` conserva rangos que el esquema no tiene** (por ejemplo `rssi_dbm` -150..0, `bat_pct` 0..100, rangos de `vel` y `acc_g`) y la comprobación `utc_ms <= rx_utc_ms` en `estado`. Esta última compara el reloj del cohete con el de la PC: con un reloj de PC atrasado podría rechazar un mensaje válido del esquema. No apareció en las pruebas; queda anotada por si pasa en la prueba real (T-670).
- No hay propuestas de cambio a los contratos (D-050 ya los cubre).

## Problemas y cómo se resolvieron
- `npx playwright install chromium` no pudo bajar el navegador (sin salida a ese host). Se corrió Playwright con el Google Chrome del sistema mediante una configuración temporal (borrada; no se commitea), y se descartaron las capturas que la e2e regenera en `docs/07_bitacora/capturas/T-625/` (`git checkout`), porque no son parte de esta tarea.

## Pendiente / siguiente paso
- El documentador consolida en el backlog el estado de T-611d y lo de `proto_version`/`lkp`/`fw_version` de arriba, si se quiere.
- Con `@R`/`@E` de PEN-23, `boot_count` y `calib.*` podrían volver a tener dato; entonces `web1.py` los llena y no hace falta tocar contratos.

## Documentos afectados
`docs/08_gui/05_contrato_datos_web.md`, `tools/web_datos/README.md`.
