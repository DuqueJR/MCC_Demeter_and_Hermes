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
