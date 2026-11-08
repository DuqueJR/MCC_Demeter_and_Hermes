---
fecha: 2026-11-07
tipo: tarea
ids: [T-658, D-065]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-658-salud-simplificada
---
# T-658: Salud del cohete simplificada en la web pública

## Contexto
La víspera del lanzamiento, Juan Pablo pidió que la web no muestre cada sensor y sistema por separado, que no muestre la referencia exacta de los chips ni las calibraciones, y que el Go/No-Go no diga "No Go" antes de armar. Los hallazgos A2, A4 y A7 y la decisión D-065 están en `docs/08_gui/12_correcciones_web_vuelo.md`. Tarea de la web solamente: no se tocó `estacion/`, `gui/relay/`, `gui/web/src/contrato/`, `Recuperacion.tsx` ni el mapa.

## Qué se hizo
- **`gui/web/src/mision/vista_salud.ts`** (lógica pura, reescrita):
  - **Una sola fila de estado general:** "Sin fallas reportadas", "Falla: <qué>" (una causa) o "N fallas" (varias, con la lista debajo). Salen las listas de sensores y sistemas y los avisos.
  - **Honesta con lo que sí llega.** `fallas` va siempre vacío con `net_proto` v2 (A2), así que las causas salen de:
    - los nombres de `fallas` y de `fallas_bits`, si algún día llegan;
    - `estado.flags.falla_activa` (solo si no hay nombres: "El cohete reporta una falla");
    - `estado.fase === "ERROR"`;
    - `flags.ekf_ok` en falso ("Navegación del cohete no lista") y `flags.gnss_fix` en falso ("Sin fix del GNSS"); ninguno se juzga en BOOT, cuando el cohete acaba de encenderse;
    - la batería: el bit 13 de `fallas` o, en PREFLIGHT y ARMED, la condición `bateria` del Go/No-Go (su umbral es `vbat_arm_mv` y lo aplica `web1.py`; la web no inventa ningún número);
    - el enlace: dato viejo (`WEB_DATO_VIEJO_S`, ya existente), con "último hace N s". Reemplaza la nota aparte `salud-edad`;
    - la Pi: `salud.pi?.estado` en un estado de error (`ABORTED`, `SD_FULL`, `RATE_FALLBACK`, `TELEMETRY_LOST`, `ABORT_REQUESTED`, `CLOCK_UNSYNCED`, `PIPELINE_ERROR`), con el `motivo` en palabras si se conoce. `DESCONOCIDO` (sin latido) no es falla aquí: la Pi tiene su propia sección (T-659).
  - **`salud.pi` se tipa localmente como opcional** (`Salud & { pi?: ... | null }`) para que este PR compile con y sin el contrato nuevo de T-657. Con T-657 integrado, el tipo local se puede borrar y usar el del contrato.
  - **Sin modelos de chip (`sinModelos`):** los bits de `fallas` tienen nombres genéricos (acelerómetro y giróscopo, barómetro, magnetómetro, y su versión "de respaldo" para los de la placa). Además, todo lo que mande el servicio pasa por `sinModelos` (patrones por familia: por ejemplo, el nombre de condición "LSM6DSO32 con datos" que genera `web1.py` sale como "Acelerómetro y giróscopo con datos"; las condiciones `lsm` y `bmp` tienen nombre fijo). Así los modelos no llegan al HTML aunque el servicio los mande.
  - **Go/No-Go en tres estados:** `esperando`, `go` y `nogo`. Ver "Decisiones".
  - Sin calibraciones: salen `CALIBRACIONES`, la subsección y el aviso. Sin la fila de la Pi en Temperatura (queda "Placa de vuelo", que hoy es "sin dato" y se llena con T-657, hallazgo A6).
- **`gui/web/src/mision/Salud.tsx` y `recuperacion_salud.css`:** pintan lo anterior. El detalle conserva Navegación, Enlace, Batería, Tarjeta SD y Temperatura, sin chips. El chip maestro "Esperando armado" lleva ícono (reloj de arena) y palabra, nunca solo color, y una nota: "El cohete confirma el Go cuando responde al armado. Estas son las condiciones que ya se ven." Se quitan los estilos que ya no se usan (aviso del resumen, `salud-edad`, `salud-sin-dato`).
- **Pruebas:** `pruebas/salud.test.ts` reescrita (37 pruebas); `e2e/salud.spec.ts` nuevo (25). Las pruebas de Salud salieron de `e2e/recuperacion_salud.spec.ts` para que T-671 edite ese archivo (Recuperación) sin pisarlas.

## Evidencia
Node v24 en el equipo. Todo corrido en el worktree de la tarea.
- `npm ci`: instaló sin problemas (solo el aviso conocido de `allow-scripts` de `workerd`).
- `npm test`: 25 archivos, **562 pruebas pasan**, 1 omitida (las de `salud.test.ts` pasaron de 26 a 37).
- `npm run build` (`tsc --noEmit`, colores, `vite build` y la prueba de aislamiento): pasa. `Aislamiento OK: /demeter/ y /hermes/ no se referencian entre sí.`, `Sin datos de ejemplo en el dist/ de producción.`, fuentes de `/demeter/` 62 808 B y `/hermes/` 67 268 B (< 81 920).
- e2e: `npx playwright test e2e/salud.spec.ts e2e/recuperacion_salud.spec.ts` → **47 pasan**; con `e2e/mision.spec.ts` (que lista `section#salud` y la navegación) → 75 pasan.
- **Sin modelos de chip** (`grep -rn -i -E "LSM6DSO32|BMP581|MMC5983MA|QMI8658|BME280|QMC6310|ESP32" src` → sin coincidencias, salida 1; en todo `gui/web` fuera de `pruebas/` y `e2e/` → sin coincidencias; en `dist/` → sin coincidencias). Las pruebas que lo citan a propósito (para comprobar que se esconde) están en `pruebas/salud.test.ts` y `e2e/salud.spec.ts`. La e2e comprueba, además, que ni el texto ni el HTML de `main` de Demeter y Hermes, a 390 y 1440 px, traen un modelo aunque el servicio los mande en `fallas` y en las condiciones.
- Capturas en `docs/07_bitacora/capturas/T-658/` (celular 390x844 y escritorio 1440x900): `salud-nominal`, `salud-fallas` (cuatro causas), `salud-una-falla`, `salud-esperando-armado`, `salud-no-go` y `salud-go`.
- `biome check` de los archivos de la tarea: sin errores. Quedan los avisos de `noDescendingSpecificity` de `recuperacion_salud.css` que ya existían (los listó T-655) y los errores previos de `dev/prueba_carga/`, que no se tocaron.
- Commits: `de8798e` (código y pruebas unitarias), `52f9502` (e2e), `69fe102` (capturas), `5dcde4d` (ajuste de la e2e).

## Decisiones tomadas o propuestas
- **Go/No-Go antes de armar (A7).** El contrato no trae un campo que diga "el cohete ya respondió al armado". Se decide por la forma de lo que manda `web1.py` (`go_nogo`):
  - `listo: true` es `go` (el cohete respondió APTO).
  - `listo: false` con alguna condición cuyo `id` no sea `gnss`, `bateria` ni `reserva` es `nogo`: solo la respuesta a un armado trae el checklist completo (los otros ids son del checklist de `CONDICIONES_ARM`), y un rechazo siempre los trae todos.
  - `listo: false` con solo esas tres condiciones es `esperando`: "Esperando armado", con las condiciones visibles, sin "No Go".
  - En ARMED sin respuesta registrada (por ejemplo, el dashboard se reinició), el chip no aparece.
  - **Es una heurística que depende de la forma de `web1.py`.** La simulación pública (`src/assets/*/simulacion_nominal.json` y los escenarios de `dev/datos`) usa otra lista de condiciones (`hora`, `sensores`, `quietud`…); en su PREFLIGHT con `listo: false` se ve "NO-GO", como antes.
- **Propuesta de cambio (no aplicada, para el documentador y después del vuelo):** agregar a `salud.go_nogo` un campo explícito (por ejemplo `armado_respondido: boolean`) para no depender de los ids. Lo calcula `web1.py`, que ya sabe si hay `c.arm`.
- **El resumen no dice "falla" por un No-Go.** Un armado negado se ve en el chip, no en la fila de estado general: la fila afirma solo fallas del cohete. Con el armado negado por el sensor "lsm" puede verse "Sin fallas reportadas" junto a "NO-GO · falta 1 condición". Es coherente (el cohete está sano y se negó a armar por una condición), pero si el equipo prefiere que la fila también diga "Falla", es un cambio de una línea.
- **EKF y GNSS cuentan como falla en cualquier fase menos BOOT.** Antes de tener fix, en PREFLIGHT, la fila dirá "Falla: Sin fix del GNSS" hasta que lo consiga, como pidió el usuario. Con una pérdida de fix en vuelo también.
- Los nombres de los bits que no son de un sensor (`SD`, `PMIC`, `RTC`, `UART del VisionPack`, `EKF divergente`…) se dejan como los manda el servicio. No son modelos de chip (la regla de D-065), pero "UART del VisionPack" y "PMIC" son jerga: con `fallas` siempre vacío hoy no se ven.

## Problemas y cómo se resolvieron
- **Puerto 5174 ocupado por otro worktree.** `playwright.config.ts` reutiliza el servidor de desarrollo si el puerto ya está en uso, y otra tarea (`agent-a339ec0a6a431b132`) levantó el suyo entre dos corridas. La e2e se corrió contra el código de esa otra carpeta y falló (el texto era "Todo en orden", el viejo) y sobrescribió capturas. Se revirtieron las capturas con `git checkout` y se volvió a correr con el puerto libre (47 pruebas pasan). **Cuidado al integrar:** si dos tareas corren e2e a la vez en la misma máquina, los resultados no son confiables.
- La e2e regenera las capturas de otras tareas (`T-622`, `T-625`) al correr sus specs; se revirtieron para no mezclarlas en este PR.
- **`salud.pi` no está en el contrato todavía** (lo agrega T-657). Se tipó localmente como opcional; la e2e lo inyecta tal cual.

## Pendiente / siguiente paso
- Merge de T-658 (cada merge publica la web sola) y, después de T-657, quitar el tipo local `SaludPi`, o dejarlo (compila igual).
- T-659 (la sección de la Pi) y T-671 (Recuperación): esta tarea no las toca. `e2e/recuperacion_salud.spec.ts` perdió sus pruebas de Salud; T-671 lo edita en otras partes, pero el diff de ambas está en el mismo archivo y puede pedir resolver un conflicto de texto.
- Verificación de punta a punta con un cohete en tierra (manual) para ver "Esperando armado" y después "GO" con datos reales de `web1.py`.
- Después del vuelo: el campo explícito del armado (arriba) y la salud por sensor en el protocolo.

## Documentos afectados
- Ninguno editado. Para el documentador: `docs/08_gui/12_correcciones_web_vuelo.md` (estado de T-658), `docs/08_gui/03_experiencia_y_pantallas.md` §3.8 (el resumen ya no habla de avisos ni de sensores) y la propuesta del campo `armado_respondido`.
