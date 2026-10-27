---
fecha: 2026-10-26
tipo: sesion
ids: [T-625, T-622, T-631, T-624, T-668, D-W16, D-W17, D-W18, GS-03, GS-04]
autor: documentador (Claude Opus 5.5)
rama: docs/T-625-lanzamiento
---
# Lanzamiento de T-625 (Recuperación y Salud del cohete)

## Contexto
El usuario pidió lanzar T-625 del plan web ([06_plan_web](../08_gui/06_plan_web.md) §3). La tarea está lista:
- T-622 y T-631 están integradas;
- T-624 se integró (PR #30 y #31), así que `src/mision/` quedó libre;
- `gh pr list` vacío al lanzar; `develop` en `c445406`.

Es la última sección M de E en W2 (Recuperación es M; Salud es S). El dashboard de operación la reutiliza en T-668 ([09](../08_gui/09_dashboard_operacion.md) §3.6).

## Qué se hizo
- **Backlog:** T-625 pasa a `en curso`.
- **Alcance que se le da al agente `desarrollador`** (una rama `feature/T-625-*`, PR en borrador como candado de D-W16, que pasa a listo para revisión al terminar, sin merge):
  1. **Recuperación** (hueco `recuperacion`, [03 §3.5](../08_gui/03_experiencia_y_pantallas.md)):
     - las coordenadas en decimal, grandes y en alto contraste, con "Copiar";
     - el botón principal "Abrir en Google Maps" (`https://www.google.com/maps/search/?api=1&query=LAT,LON`);
     - el QR con `uqr`, que ya está en `package.json`: al lado en el portátil y a un toque en el celular;
     - el vector desde la estación (`calc.dist_horiz_m` y `calc.azimut_deg`) con una flecha de brújula;
     - antes del aterrizaje, el centro de `calc.elipse` con la etiqueta "estimado"; después, `pos` o el `lkp` con su antigüedad (GS-03).
  2. **Aterrizado** (03 §4): con `fase = LANDED`, la sección Recuperación sube al inicio de la página.
  3. **Salud del cohete** (hueco `salud`, 03 §3.8, con los campos de [05 §2.3](../08_gui/05_contrato_datos_web.md)):
     - el resumen siempre visible ("Todo en orden ✓", "N avisos ⚠", "Falla en un sensor ⛔");
     - el chip maestro Go/No-Go en PREFLIGHT y ARMED, desde `go_nogo`;
     - el detalle desplegable: sensores, calibraciones, navegación, enlace, batería, SD y temperatura.
  4. **Pruebas:** unitarias de la lógica pura y e2e con fallas simuladas, alimentando `salud` en la prueba.
  5. **Capturas** de las dos secciones, en celular y portátil.
- **Prohibido:** `src/contrato/`, `src/datos/` (solo lectura), `src/mapa/`, `src/actitud/`, `tools/web_datos/`, `package.json` y los tokens de `src/tema/`.

## Decisiones tomadas o propuestas (suposiciones del documentador)
- **La lógica va en módulos puros** (`vista_recuperacion.ts` y `vista_salud.ts`, como `vista_telemetria.ts` de T-624), para que T-668 los reutilice en el dashboard sin copiar.
- **La flecha de brújula es fija con el norte arriba.** No usa la orientación del celular: eso pide permisos en iOS y no está en 03. Queda como propuesta.
- **Qué cuenta como aviso y qué como falla** no lo dice 03 §3.8. La propuesta que se le da al agente:
  - **falla** (⛔): algún bit de `fallas`;
  - **aviso** (⚠): las calibraciones sin terminar, el EKF no listo y la batería baja según un umbral de [constantes](../02_requisitos/constantes.md), si existe.
  - Si no hay umbral en `constantes.md`, el agente no inventa el número: lo reporta.
- **Fallas simuladas:** no hay un escenario con fallas en los datos de ejemplo, y `tools/web_datos/` es del área D. Las pruebas alimentan `salud` directamente. Un escenario `fallas` queda como propuesta para D.
- **Sin imágenes nuevas.** Los íconos de estado van con `lucide-preact` (D-W17).

## Pendiente / siguiente paso
- Revisar el PR del agente: el diff dentro del alcance, `npm run build`, `npm test`, `npm run e2e` y las capturas.
- El criterio del plan pide **abrir el QR en un celular real**. Eso lo hace un humano después del merge, con `npm run web`.
- El usuario aprueba y hace el merge. Después: T-625 `hecha` en el backlog, `CLAUDE.md` al día y `graphify update .`.
- **Mientras T-625 está en curso, nada más entra en `src/mision/`** (06 §1). T-626 (Los ojos de Deméter) va en paralelo solo si vive en otra carpeta.

## Documentos afectados
- [backlog](../05_plan/backlog.md) (la fila de T-625)

## Revisión del PR #32 (mismo día)
El agente abrió el **PR #32** (`feature/T-625-recuperacion-salud`, 6 commits `[T-625]`, desde `c445406`), sin merge y listo para revisión. El detalle técnico está en su [entrada](2026-10-26_T-625_recuperacion_salud.md), que llega con el PR.

- **Alcance respetado:** el diff no toca `src/datos/`, `src/contrato/`, `src/mapa/`, `src/actitud/`, `src/tema/`, `tools/web_datos/` ni `package.json`.
  - Lo nuevo está en `src/mision/`: `Recuperacion`, `Salud`, `Qr`, `vista_recuperacion`, `vista_salud`, `datos_qr`, `copiar`, `aterrizado` y `recuperacion_salud.css`.
  - Los archivos compartidos que cambian son `Pagina.tsx` y `mision.css` (la rejilla del portátil con `--fila-extra` para Aterrizado).
  - GitHub lo marca `MERGEABLE`.
- **Lógica revisada:**
  - qué punto se muestra: sin señal, el LKP con su antigüedad; con LANDED, la `pos` real; antes, el centro de la elipse "estimado"; sin elipse, la posición actual, marcada como no estimado;
  - con coordenadas nulas o inválidas no hay enlace, ni botón, ni QR;
  - con LANDED, Recuperación es el primer hijo del `<main>` en el DOM, no solo a la vista;
  - el resumen de Salud y el Go/No-Go (solo en PREFLIGHT y ARMED) salen de `salud` sin recalcular nada del firmware.
- **Dos hallazgos del documentador, corregidos en `2a8f9b6`:**
  1. **`Pagina` se volvía a dibujar entera a 10 Hz.** Leía `estadoPagina.value` directo, y ese `computed` devuelve un objeto nuevo en cada tic del reloj local. Ahora usa `computed(() => estadoPagina.value.aterrizado)` (`aterrizado.ts`), el mismo patrón de `EstadoMision` y `Telemetria`, con 3 pruebas en `pruebas/aterrizado.test.ts`.
  2. **La batería baja salía dos veces y se contradecía:** la web la recalculaba con una copia de `BAT_MIN_ARM_PCT` y, en el mismo detalle, el bit 13 decía "Sin falla". **Decisión del usuario: solo el bit 13** (la web no recalcula, como con la alarma de descenso). Se borró `constantes_salud.ts`. El detalle sigue mostrando el % y los V.
- **Verificación del documentador**, en el worktree del agente, en serie:
  - `npm test`: **377 pasan y 1 saltada** (antes eran 327);
  - `npm run e2e` (incluye el build y la prueba de aislamiento): **164 pasan, 14 saltadas y 1 falla**, `mapa.spec.ts:198`, los gestos de T-632, que falla igual en `develop`.
  - **Ojo:** con `npm test` corriendo en paralelo a la e2e fallaron por tiempo 4 pruebas más (`mapa_limites.spec.ts:320` y `:386`, y `mision.spec.ts:65`). Solas pasan. La e2e se corre sin nada más encima.
- **Capturas revisadas:** `salud-fallas` (390×844, ya con "3 fallas" y el bit 13 en falla), `aterrizado-1440x900` (Recuperación a todo el ancho, con el QR al lado) y `recuperacion-lkp-390x844` (el LKP en rojo, "hace 38 s", con el QR a un toque).

### Observaciones y propuestas (abiertas, no aplicadas)
| # | Observación o propuesta | Quién o dónde |
| --- | --- | --- |
| 1 | `calc.dist_horiz_m` y `calc.azimut_deg` van de la estación al cohete, no al punto estimado. Antes del aterrizaje la pantalla lo aclara. Propuesta: campos opcionales con la distancia y el azimut al centro de la elipse | Servicio de tierra y `web-1` (D, con decisión) |
| 2 | No hay umbral para la innovación del EKF: solo se muestra el valor. Los umbrales del Go/No-Go (`SD_MIN_LIBRE_MB`, `GO_SV_MIN`, `GO_HACC_MAX_M`) tampoco generan avisos | `constantes.md` si se quieren como avisos |
| 3 | Sin elipse antes del aterrizaje se muestra la posición actual. No está en 03 §3.5: es una decisión del agente | Confirmar en 03 §3.5 o quitarlo |
| 4 | "Copiar" usa punto decimal (para pegar en Maps) y la pantalla usa coma | Aceptable; dejarlo dicho en 03 §3.5 |
| 5 | El resumen del vuelo en Aterrizado (apogeo, duración, velocidad máxima y deriva, 03 §4) no está hecho | Tarea S de E |
| 6 | En el portátil, el QR va debajo del botón en la columna de ≈300 px. Al lado solo queda en LANDED, a todo el ancho | Revisar en T-644 |
| 7 | `grid-row: calc(N + var(--fila-extra))` funciona en Chromium. Falta verlo en Safari (iPhone real) | T-644 |
| 8 | Un escenario JSONL con fallas para ver Salud con el repetidor | `tools/web_datos/` (D) |
| 9 | Abrir el QR en un celular real, que es el criterio del plan | Un humano después del merge, con `npm run web` |

## Cierre (mismo día)
El usuario hizo el merge del **PR #32** en `develop` (`95b20e1`). **T-625 queda hecha.**

- **Backlog:** T-625 `hecha` (PR #32). Con T-624 y T-625 hechas, **T-644** (pulido para el celular) queda lista.
- **`CLAUDE.md`:** la lista de código integrado suma T-625.
- **Grafo:** se corrió `graphify update .` en la carpeta principal.
- **Criterio del plan que falta:** abrir el QR en un celular real. Lo hace un humano con el repetidor y `npm run web` (en el celular, con `--host 0.0.0.0`).
- **El PR de esta entrada** (la entrada, el backlog y `CLAUDE.md`) sale de `docs/T-625-lanzamiento`, ya con `develop` mezclado.

### Siguiente paso
- **Web, lista:** T-626 (Los ojos de Deméter) y T-623 (contenido), ya sin el candado de `src/mision/`. Después, T-644.
- **Propuestas de la revisión** (la tabla de arriba): la n.º 1 (distancia y azimut al punto estimado) pide un cambio de contrato con su decisión; la n.º 5 (resumen del vuelo en Aterrizado) cabe como tarea S de E.
