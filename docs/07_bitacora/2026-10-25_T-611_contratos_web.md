---
fecha: 2026-10-25
tipo: tarea
ids: [T-611, D-W13, PA-15, PA-22]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-611-contratos-web
---
# T-611: contratos `web-1` en código

## Contexto
`web-1` ([05](../08_gui/05_contrato_datos_web.md)) pasa a código: tipos, esquema, validador y la API de signals que consume el área E. Es un contrato en modo "preguntar": lo aprueban Juan Pablo y Jerónimo en H0, junto con C-05, y queda congelado.

## Qué se hizo
- `gui/web/src/contrato/tipos.ts`: todos los tipos de 05 (`Meta`, `Estado`, `Salud`, `Estacion`, `Evento`, `Backfill`, `Serie`, `Snapshot`, `LineaJsonl`, `Ingesta`). Los campos de D-W13 son opcionales (`?`).
- `gui/web/src/contrato/esquema.json`: JSON Schema **draft-07** (el `Ajv` por defecto de Ajv 8; se compila en modo estricto). La raíz valida un snapshot; cada mensaje se valida con `#/$defs/<nombre>`: `meta`, `estado`, `salud`, `estacion`, `evento`, `backfill`, `snapshot`, `linea_jsonl` (05 §5) e `ingesta` (05 §1). `additionalProperties: false` en todos los objetos.
- `gui/web/src/contrato/ejemplos.ts`: ejemplos tipados (de 05 §2), incluido un snapshot vacío.
- `gui/web/src/datos/constantes.ts`: los `WEB_*` de `constantes.md` §9 con su fila de referencia.
- `gui/web/src/datos/estado_pagina.ts`: `calcularEdadMs` y `calcularEstadoPagina` (puras).
- `gui/web/src/datos/api.ts`: signals de solo lectura `meta`, `estado`, `salud`, `estacion`, `eventos`, `serie`, `backfill`, `vueloCompletoUrl`, `conexion`, `edad`, `estadoPagina`; escritura solo por `alimentar` (para T-631). Carga inicial: el snapshot de ejemplo.
- Pruebas: `pruebas/contrato.test.ts` y `pruebas/api.test.ts`.

## Evidencia
- `npm test`: 4 archivos, 52 pasan, 1 se salta (la que exige que haya `.jsonl` en `dev/datos/`; T-612 aún no los genera, y la prueba avisa con `console.warn`).
- `npm run build` (incluye `tsc`, la regla de colores y la prueba de aislamiento): OK.
- `npm run e2e`: 12 pasan.
- Casos falsos rechazados: campo obligatorio ausente (`estado.fase`, `salud.calib.mag`, `estacion.ultimo_paquete_hace_ms`), tipos equivocados (`lat` texto, `bat_pct` texto, flag numérico), `contrato_version` ≠ `web-1` (`web-2`, `web-0`, vacío, número), `proto_version` 4, fase inventada, `lat` 91, campo desconocido, snapshot sin `meta`, línea JSONL con `datos` que no corresponde a su `evento`, ingesta con misión inexistente.
- Tipos y esquema: las claves de cada ejemplo tipado (completo, con los opcionales) son exactamente las propiedades del esquema.

## Decisiones tomadas o propuestas
Se implementó **lo más literal posible**. Preguntas abiertas para H0 (no las decidí):

Sobre 05:
1. **Nulabilidad.** 05 dice "un campo nunca se omite: está o es `null`", pero no marca cuáles admiten `null`. Se permite `null` donde 05 lo dice o donde el valor puede no existir: `pos` completo (05 §2.2: "si `pos` llega en `null`"), `pos.alt_msl_m`, `utc_ms`, `relay_utc_ms`, `bat_pct`, `secundario`, cada `calc.*`, `enlace.*`, `lkp`, y en `salud` los sensores y contadores. Confirmar la lista.
2. **`estacion.ultimo_paquete_hace_ms` = `null`** cuando aún no llegó ningún paquete (05 no lo dice). Y `estacion.pos` `null` sin GNSS.
3. **`evento.fase` y `evento.activa`** son condicionales por tipo (05 §2.5). Los modelé como opcionales (los demás campos del evento son obligatorios, `valor` puede ser `null`). Choca con "nunca se omite"; ¿mejor `null` siempre?
4. **`additionalProperties: false`.** Atrapa errores del generador, pero un campo opcional nuevo "compatible" (05 §0) rompería a un validador viejo. Si se prefiere tolerancia, se quita.
5. **Snapshot:** `meta` obligatorio; `estado`, `salud`, `estacion` y `backfill` pueden ser `null` (05 §3: "lo que no existe es `null`").
6. **Serie:** las 8 columnas deben tener el mismo largo; JSON Schema no lo expresa (lo comprueba la prueba solo en el ejemplo). `WEB_SERIE_MAX_PUNTOS` no se aplica en el esquema.
7. **`mision` ↔ `nodo`** (demeter=1, hermes=2) no se cruza en el esquema; `fase` ↔ `fase_cod` tampoco.
8. **`estadoPagina`:** 03 §4 lista como "estados" cosas que coinciden (simulación + señal débil, aterrizado, reconstruyendo, alarma). Lo modelé como `principal` (excluyente: `cargando`, `sin_transmision`, `en_vivo`, `senal_debil`, `sin_senal`, `sin_servidor`) más 4 avisos booleanos. Confirmar. Además:
   - `sin_transmision` se da si nunca llegó dato del cohete (`estado` o `ultimo_paquete_hace_ms` en `null`) o si la edad ≥ `WEB_SIN_TRANSMISION_MIN`. Esto último hace que, tras 10 min sin señal, se pase de "sin señal (LKP)" a "sin transmisión"; 03 §4 no precisa cómo conviven. El LKP no se borra de las signals.
   - `simulacion` = `meta.modo` ≠ `"vivo"` (incluye `sintetico`).
   - Bordes: `< WEB_DATO_VIEJO_S` en vivo; `≤ WEB_SIN_SENAL_S` señal débil; más, sin señal.
   - El "10 s más" del banner de alarma (03 §4) no es un `WEB_*` y no está en `constantes.md`; queda para la UI.
9. **Reloj de `edad`.** La edad usa un reloj local monotónico inyectado (`alimentar.reloj`), no `Date.now()`.

Sobre C-05 (solo comprobación, sin cambios):
10. Las rutas y mensajes coinciden: `snapshot` y `stream` con `id: <seq>` y `Last-Event-ID`, los 6 tipos de mensaje y las equivalencias de §1. Notas: C-05 §2 dice que el stream local usa `id: <seq>` mientras 05 §1 dice `id: <seq_relay>`; y en local no hay relay, así que `relay_utc_ms` sería `null` (por eso lo dejé nullable). C-05 no define `seq_relay` del servicio local.
11. C-05 §1 dice que `ESTADO_MODEM` produce un `estacion` "en cada flujo de misión": el latido es de la estación pero el stream es por misión; el esquema no lleva la misión dentro de `estacion`.

## Problemas y cómo se resolvieron
- Las pruebas de `api.ts` mutan las signals globales del módulo; las pruebas de `calcularEstadoPagina` usan los ejemplos directamente para no depender del orden.
- No se tocó `package.json`: Ajv, ajv-formats y todo lo demás ya estaban.

## Pendiente / siguiente paso
- Aprobación humana (H0), junto con C-05; al aprobarse, `web-1` queda congelado.
- T-612 genera los JSONL en `gui/web/dev/datos/`; la prueba los valida sin cambios.
- T-631 llena las signals con el cliente real usando `alimentar`.

## Documentos afectados
Ninguno editado. Sugerido para el documentador: marcar T-611 como hecha cuando se apruebe, y resolver las preguntas 1 a 8 en 05.

## Correcciones de la revisión
Las preguntas 1 a 11 quedan **resueltas** (decisiones delegadas por Juan Pablo; D-W18 en el PR #9):
- **Nulabilidad (1, 2, 5), `additionalProperties: false` (4) y `relay_utc_ms` nullable (10):** se aceptan tal como están, sin cambio de código.
- **`evento.fase` y `evento.activa` (3):** van siempre presentes, con `null` si no aplican. Cambiado en tipos, esquema y ejemplos.
- **Serie, `mision`/`nodo` y `fase`/`fase_cod` (6, 7):** nuevo `src/contrato/validacion_extra.ts` (función pura que devuelve la lista de errores): 8 columnas con el mismo largo y máximo `WEB_SERIE_MAX_PUNTOS`; demeter=1 y hermes=2; `fase_cod` es el índice en `FASES`, verificado contra `maquina_estados.md` §1 (BOOT 0 … LANDED 8, ERROR 9): **todo cuadra**. La usan las pruebas, incluida la de los JSONL de `dev/datos/`.
- **`estadoPagina` (8):** `sin_transmision` si nunca llegó dato del cohete, o si la última fase es BOOT, PREFLIGHT o ERROR con edad ≥ `WEB_SIN_TRANSMISION_MIN`. Desde ARMED nunca: queda `sin_senal` con el LKP (GS-03). Borde de 5 s: `<` es señal débil y `≥` es sin señal.
- **`api.ts`:** solo se congela el lado de lectura; `alimentar` es interno del área D. **Arranca vacío** (todo `null`, `conexion` en `"cargando"`) y no importa los ejemplos: así `/hermes/` no empaqueta datos de Deméter (D-W01) ni muestra "EN VIVO" inventado (R-W5). Las pruebas lo alimentan con `alimentar.snapshot(snapshotEjemplo, …)`.
- **`WEB_ALARMA_SOSTENER_S` = 10** agregada a `constantes.ts` para la UI (no la usa `estadoPagina`).

Evidencia: `npm test` 61 pasan y 1 se salta (sin `.jsonl` aún); `npm run build` OK; `npm run e2e` 12 pasan. Casos nuevos: DESCENT 30 min → sin_senal; PREFLIGHT 11 min → sin_transmision; LANDED 2 h → sin_senal; bordes de 2 s y 5 s; evento sin fase/activa rechazado; serie desigual o mayor al máximo; mision/nodo y fase/fase_cod cruzados.
