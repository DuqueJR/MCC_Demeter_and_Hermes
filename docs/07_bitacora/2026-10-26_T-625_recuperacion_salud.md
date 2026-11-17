---
fecha: 2026-10-26
tipo: tarea
ids: [T-625, D-W16, D-W17, GS-03, GS-04]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-625-recuperacion-salud
---
# T-625: Recuperación y Salud del cohete

## Contexto
Secciones Recuperación (03 §3.5) y Salud del cohete (03 §3.8) de la web pública, más el estado "Aterrizado" de 03 §4. Reemplazan los huecos `recuperacion` y `salud` que dejó T-622. Base: `develop` en `c445406`. PR en borrador abierto como candado de D-W16 (#32).

## Qué se hizo
- **Lógica pura** (sin Preact, para que T-668 la reutilice):
  - `src/mision/vista_recuperacion.ts`: qué punto se muestra, URL de Google Maps, texto a copiar y punto cardinal del azimut.
  - `src/mision/vista_salud.ts`: resumen, fallas, avisos, Go/No-Go y detalle.
  - `src/mision/datos_qr.ts`: el trazo SVG del QR con `uqr`.
  - `src/mision/constantes_salud.ts`: `BAT_MIN_ARM_PCT` (mismo nombre que en `constantes.md`). `src/datos/constantes.ts` es solo de los `WEB_*` y no se tocó.
- **UI**: `Recuperacion.tsx`, `Salud.tsx`, `Qr.tsx`, `copiar.ts` y `recuperacion_salud.css` (solo tokens). `Pagina.tsx` sustituye los dos `Hueco`. `mision.css` pasa las filas del portátil a `calc(N + var(--fila-extra))`.
- **Recuperación**
  - Coordenadas en decimal con coma (7 decimales, números tabulares), "Copiar" (copia `lat, lon` con punto decimal, pegable en Maps), aviso `aria-live`, respaldo con `execCommand` y, si todo falla, un mensaje para copiar a mano (las coordenadas se seleccionan de un toque).
  - "Abrir en Google Maps" (`target=_blank`, `rel=noopener noreferrer`) y QR de la misma URL: siempre visible desde 1024 px; en el celular detrás de un botón con `aria-expanded`.
  - Vector con brújula SVG de norte fijo arriba (sin orientación del dispositivo). Distancia en m y azimut en grados con su punto cardinal.
  - Con datos `null`: una frase, sin enlace, sin botón y sin QR.
- **Qué punto se muestra** (en `vista_recuperacion.ts`, por prioridad):
  1. sin señal (`principal = sin_senal`): el LKP (o la última `pos`) con su antigüedad, en rojo (GS-03);
  2. `LANDED`: `pos` real; si no hay, el LKP;
  3. antes del aterrizaje: el centro de `calc.elipse`, con la etiqueta "estimado";
  4. sin elipse: la `pos` actual con la etiqueta "aún sin estimado de impacto" (para no hacerla pasar por estimado); si no, el LKP.
  - La antigüedad del LKP es `edad` más la diferencia entre `estado.utc_ms` y `lkp.utc_ms` (ambas del cohete).
- **Aterrizado**: con `estadoPagina.aterrizado` el componente se monta como primer hijo del `<main>` (en el DOM, así el orden de lectura y del teclado coincide). En el portátil ocupa toda la fila 1, el resto baja una fila y Salud ocupa dos filas en la columna 3 para no dejar un hueco. El mapa no se remonta (los `false` de JSX mantienen las posiciones de los demás hijos).
- **Salud**
  - Falla (⛔) = algún bit de `fallas` (nombres de `fallas` unidos a los decodificados de `fallas_bits`). Resumen: "Falla en un sensor" (bits 0 a 6), "Falla en un sistema" (7 a 13) o "N fallas".
  - Aviso (⚠), una causa cuenta una vez: calibraciones sin terminar; EKF no listo (`flags.ekf_ok` falso, salvo que ya sea la falla "EKF divergente"); batería por debajo de `BAT_MIN_ARM_PCT` (salvo que ya sea la falla "Batería baja").
  - Chip GO / NO-GO con la lista de condiciones, solo en PREFLIGHT y ARMED.
  - Detalle `<details>`: sensores, sistemas, calibraciones, navegación (EKF e innovación), enlace, batería, SD y temperatura. La fila de la Pi y el bit "UART del VisionPack" no se muestran en Hermes (salvo que el bit esté en falla).
  - Si el dato tiene edad ≥ `WEB_DATO_VIEJO_S`, una nota "Último dato hace X s: puede haber cambiado".
  - Sin `salud`: estado vacío claro.

## Evidencia
Desde `gui/web/`:
- `npm run build`: bien (`tsc`, colores, vite, aislamiento OK: "Sin datos de ejemplo en el dist/ de producción").
- `npm test`: **18 archivos, 374 pruebas ok, 1 omitida** (preexistente). Nuevas: `pruebas/recuperacion.test.ts` y `pruebas/salud.test.ts`, **47 pruebas** (URL de Maps, coordenadas inválidas, elipse, LANDED, LKP con y sin hora, sin señal, nulos, 8 vientos y normalización, QR, falla por nombre y por bit, avisos, umbral exacto de batería, Go/No-Go por fase, Hermes sin Pi).
- `npm run e2e`: **163 ok, 14 omitidas, 1 falla: `mapa.spec.ts:198`** (gestos de T-632; ya fallaba en `develop`, no es de esta tarea: el scroll queda en 2114 y se esperaba > 2214).
  - Nuevas: `e2e/recuperacion_salud.spec.ts`, **34 pruebas** (todas ok): punto "estimado" con la URL y el `data-qr-url` exactos, QR a un toque y visible a 1440 px, LANDED real, LKP rojo (`rgb(255, 77, 94)`), datos nulos sin enlace ni QR, copiar con la API (se lee el portapapeles) y con el respaldo, aterrizado a 390 y 1440 px (primera sección del `<main>`, sin superposición, anclas funcionando, Hermes), Salud con fallas simuladas (el resumen pasa de "Todo en orden" a "Falla en un sensor" y "2 fallas" y vuelve; el detalle marca "En falla"), calibraciones, Go/No-Go y datos viejos.
  - No hay un escenario JSONL con fallas: las pruebas parten del snapshot real de `nominal` y le cambian `salud`; `tools/web_datos/` no se tocó.
- Capturas en `docs/07_bitacora/capturas/T-625/` (390x844 y 1440x900): `recuperacion-nominal-*`, `salud-nominal-*`, `salud-fallas-*`, `salud-preflight-*`, `aterrizado-*`, `recuperacion-aterrizado-*` y `recuperacion-lkp-*`.
- Commits: `038091c` (candado), `c076dc3` (lógica y pruebas unitarias), `82fb56a` (UI y e2e), `727e499` (capturas).

## Decisiones tomadas o propuestas
1. **Umbral de batería.** `constantes.md` no tiene un umbral de "batería baja" para la web. Lo único es `BAT_MIN_ARM_PCT = 60 (P)`, que `protocolo_paquetes` §3 (bit 13) usa como definición de "batería baja". Se usó ese, con su nombre, como aviso (⚠). Es un umbral de ARM, provisional: en vuelo 55 % puede ser normal. Falta decidir si la web necesita un umbral propio (en `bat_pct` o en `bat_mv`). **No se inventó ningún número.**
2. **Innovación del EKF**: no hay umbral en `constantes.md`; solo se muestra el valor, no genera aviso.
3. **Vector `calc` hacia el cohete, no hacia el punto estimado.** `calc.dist_horiz_m` y `calc.azimut_deg` son de la estación a la posición actual del cohete (05 §2.2). Antes del aterrizaje la pantalla lo dice ("al cohete en este momento, no al punto estimado"). Propuesta para el servicio de tierra: un campo opcional con la distancia y el azimut al centro de la elipse.
4. **Fallback "posición actual"** cuando no hay elipse antes del aterrizaje (p. ej. en PREFLIGHT con fix): 03 §3.5 no lo dice. Es una decisión mía; se puede quitar si se prefiere el texto vacío.
5. **Copiar** pone `lat, lon` con punto decimal (formato de Maps), mientras la pantalla muestra coma decimal (02 §5). Latitud y longitud van en filas separadas para que la coma no se confunda con el separador.
6. **Avisos que el documentador podría sumar** (están en `constantes.md` como condiciones del Go/No-Go, pero 03 §3.8 no los pide como avisos): `sd_libre_mb < SD_MIN_LIBRE_MB` (500), `gnss.sv < GO_SV_MIN` (6) y `hacc_m > GO_HACC_MAX_M` (5). No se implementaron.
7. **Resumen de vuelo** del estado Aterrizado (apogeo, duración, velocidad máxima y deriva, 03 §4) no estaba en el alcance de T-625 y no se hizo.
8. **QR "al lado".** En la columna angosta del portátil (≈300 px) el QR queda debajo del botón; solo en LANDED (fila a todo el ancho) queda al lado del botón.

## Problemas y cómo se resolvieron
- El Go/No-Go de la prueba con `T_PREFLIGHT_CON_POS` (5 s) ya venía en verde en el escenario `nominal`; se usó el instante sin fix (1 s) para el NO-GO y el ARMED real para el GO.
- `npm run e2e` **regenera las capturas de T-621, T-622, T-624 y T-632** (las pruebas de esas tareas las reescriben). No se commitearon: se restauraron con `git checkout`.
- `biome check .` da 9 avisos (no errores), 6 de ellos `noDescendingSpecificity` en `recuperacion_salud.css` por los selectores `[data-nivel=...] svg`; son falsos positivos (otros elementos).

## Pendiente / siguiente paso
- Abrir el QR en un **celular real** (criterio del plan): lo hace un humano con `npm run web`.
- Decidir los puntos 1, 3, 4 y 6.
- El PR #32 queda listo para revisión; sin merge.

## Actualización tras la revisión del PR (mismo día)
- **Decisión del usuario sobre la batería: solo el bit 13.** La web no recalcula: se quitó el aviso por `BAT_MIN_ARM_PCT` y se borró `constantes_salud.ts`. La batería baja sale únicamente como la falla "Batería baja" que manda el firmware; el detalle sigue con el % y los V. Esto reemplaza lo dicho en las decisiones 1 y en "Qué se hizo" sobre el aviso de batería. La captura `salud-fallas-*` se regeneró (3 fallas, sin aviso de batería).
- **Render a 10 Hz corregido:** `Pagina` leía `estadoPagina.value.aterrizado` y se volvía a dibujar entera con cada tic del reloj (el objeto cambia a 10 Hz). Ahora usa `aterrizado` (`src/mision/aterrizado.ts`, un `computed` de un booleano, que solo avisa cuando cambia). Prueba unitaria `pruebas/aterrizado.test.ts` (3 pruebas): leer `estadoPagina` directo avisa en la mayoría de los 50 tics; el booleano avisa 1 vez (la inicial) y una sola más al pasar a LANDED. No se cuentan los renders de `Pagina` porque vitest corre en Node sin DOM.
- Resultados: `npm run build` ok; `npm test` 19 archivos, 377 ok, 1 omitida; e2e completa en una segunda corrida: 164 ok, 14 omitidas, 1 falla preexistente (`mapa.spec.ts:198`). En la primera corrida fallaron además `mapa_limites.spec.ts:320` y `mision.spec.ts:186` (por carga de la máquina: pasan solas y en la segunda corrida).

## Documentos afectados
- Ninguno de los contratos. Para el documentador: `backlog.md` (T-625), `constantes.md` (si se agrega un umbral de batería de la web) y `05_contrato_datos_web.md` (si se acepta la propuesta del punto 3).
