---
fecha: 2026-11-08
tipo: tarea
ids: [T-675, T-661, T-674]
autor: agente desarrollador (Sonnet)
rama: feature/T-675-marco-cuaternion-web
---
# Marco del cuaternión: de FRD -> NED (firmware) a FLU -> ENU (`web-1`)

## Contexto
Con el cohete real, la actitud de la web salía invertida: hacia abajo se veía hacia arriba y al revés. La ventana EKF del dashboard de Pablo (`estacion/dashboard_ekf.js`) sí se veía bien y es la referencia.

Causa: el TELEM trae `quat` Hamilton, escalar primero, **cuerpo FRD -> NED** (`protocolo_paquetes.md` §2, línea 40). `estacion/web1.py` lo normalizaba y lo publicaba tal cual en `estado.q`. Pero `web-1` (`05_contrato_datos_web.md`, fila `q.*`) dice "del cuerpo a ENU", y la web lo lee como **cuerpo FLU (X nariz, Y izquierda, Z arriba) -> ENU** (`gui/web/src/actitud/angulos.ts`, `mision/vista_rosa.ts`), igual que el generador sintético `tools/web_datos/actitud.py`. La nariz en NED (N, E, D) se leía como (E, N, U): la vertical invertida y N/E cruzados.

## Qué se hizo
- `estacion/web1.py`: nueva `quat_firmware_a_web(q)` y su uso en `_estado`.
  - **Fórmula:** `q_web = q_M ⊗ q_firmware ⊗ q_F`, con `q_M = (0, 1/√2, 1/√2, 0)` (NED -> ENU: 180° sobre (1,1,0)/√2) y `q_F = (0, 1, 0, 0)` (FLU -> FRD: 180° sobre X). Producto de Hamilton, luego unitario y `w ≥ 0` (sin ceros negativos).
  - **En matrices:** `R_web = M · C · F`, con `C = R(q_firmware)`, `M = [[0,1,0],[1,0,0],[0,0,-1]]` y `F = diag(1,-1,-1)`. Ambos son rotaciones propias (det = +1). La prueba compara cuaternión y matriz.
  - **Por qué ese orden:** `C` lleva un vector de FRD a NED; para recibirlo en FLU se aplica antes `F` (FLU -> FRD) y después `M` (NED -> ENU). Un vector se multiplica por la derecha de `R_web`, así que el último paso queda a la izquierda.
- `ekf_ok` se sigue calculando con el `quat` crudo (la identidad del firmware o el cuaternión nulo significan "sin EKF"). **Sin EKF, `q` es la identidad ya convertida**: `(√½, 0, 0, √½)`, es decir nariz al norte y nivelado. Se eligió convertir siempre (un solo camino, sin caso especial); la web no usa `q` mientras `ekf_ok` sea false y muestra "aún no disponible".
- Fixtures (`estacion/fixtures/web1.jsonl` y `web1_snapshot.json`) regenerados con `regenerar.py`: cambia solo `estado.q` (el vuelo sintético usa la identidad del firmware). Sin otros cambios.
- `docs/04_diseno/protocolo_paquetes.md` §6: la fila de `q` precisa el cambio de marco que hace `web1.py` (describe el código; `web-1` no cambia). Ver "Propuestas".
- Pruebas nuevas (`MarcoCuaternion` en `estacion/pruebas/test_web1.py`) y un ajuste de `test_estado_unidades` (esperaba la identidad cruda).
- No se tocó la web, ni `acc_g`, ni la serie.

## Evidencia
- `python -m pytest estacion/pruebas/test_web1.py estacion/pruebas/test_fixture_web1.py -q`: **128 passed, 2318 subtests passed**.
- `MarcoCuaternion` (8 pruebas), con `nose()`, `euler()` y `qC` de `dashboard_ekf.js` portados a la prueba y la fórmula de `angulos.ts` replicada en Python:
  - la matriz del cuaternión convertido es `M · C · F`;
  - nariz arriba en NED -> cabeceo +90°; nariz abajo -> −90°;
  - nariz horizontal al norte -> cabeceo 0°, rumbo 0°; al este -> rumbo 90°;
  - 30° desde la vertical hacia el este: `nose()` de Pablo da (30°, 90°) y la web da cabeceo 60° y rumbo 90° (90° − cabeceo = inclinación);
  - una malla de 9 × 11 × 9 orientaciones (guiñada −180…180, cabeceo −85…85, alabeo −170…170): inclinación, rumbo de la nariz, cabeceo y **alabeo** de la web coinciden con los de Pablo (alabeo en el mismo sentido: ala derecha abajo = positivo);
  - de punta a punta por el `Traductor`: TELEM con nariz arriba/abajo sale con cabeceo ±90°, `ekf_ok` true y `w ≥ 0`;
  - sin EKF: `q` es la identidad convertida y `ekf_ok` false.
- `npm run build` en `gui/web/` (incluye `tsc --noEmit`): sin errores. No se tocó TypeScript.
- Capturas con Playwright (script temporal de capturas, no versionado), inyectando en `/demeter/` el `q` que sale de `web1.py` y, para comparar, el crudo de antes. En `docs/08_gui/capturas/T-675/`:
  - `nariz-arriba-{antes,despues}-{rosa,actitud}.png`: antes se leía cabeceo −90,0° con la nariz abajo en la rosa; después +90,0° con la nariz arriba;
  - `nariz-abajo-…`: antes +90,0°; después −90,0°;
  - `inclinada-30-este-…`: antes −60,0°; después 60,0° con guiñada 90,0° y alabeo 0,0°.
- La flecha de velocidad de la rosa (`armarEscena`) usa la velocidad ENU (`vel.e_ms`, `n_ms`, `u_ms`) sobre las mismas coordenadas (este, norte, arriba) que el resto de la escena: está bien y no se tocó.

## Decisiones tomadas o propuestas
- Se corrige el código, no el contrato: `web-1` ya decía "del cuerpo a ENU" y la web lo implementa así.
- **Propuesta (para el documentador):** que `05_contrato_datos_web.md`, fila `q.*`, diga explícitamente "cuerpo FLU (X nariz, Y izquierda, Z arriba) -> ENU", que es lo que ya implementan `angulos.ts` y el generador sintético. Hoy solo dice "del cuerpo a ENU" y de ahí vino el malentendido. No se editó.
- Se editó la fila de `q` de `protocolo_paquetes.md` §6 porque describe lo que hace `web1.py`; si el documentador prefiere que ese cambio pase por una decisión, que lo revierta o lo registre.

## Problemas y cómo se resolvieron
- Mi réplica en Python de `angulos.ts` dividía entre cero con la nariz exactamente vertical; se le agregó la rama de "vertical exacta" que ya tiene la web.
- La captura de la web necesita un `dist/` construido (el servidor de `preview` de Playwright); se hizo `npm run build` y no se versiona.

## Pendiente / siguiente paso
- **Reiniciar el dashboard de la estación** para que el cambio llegue en vivo (y redesplegar el relay si aplica: el relay solo reenvía lo que publica la estación).
- Sesiones grabadas antes del cambio, reprocesadas con `web1.py` nuevo, salen ya convertidas; las que ya estén en el relay o en el archivo de la web seguirán con el marco viejo.
- El cero del alabeo sigue sin medir (D-007): `R_MONTAJE` sigue pendiente.

## Documentos afectados
- `estacion/web1.py`, `estacion/pruebas/test_web1.py`, `estacion/fixtures/web1.jsonl`, `estacion/fixtures/web1_snapshot.json`
- `docs/04_diseno/protocolo_paquetes.md` (§6, fila `q`)
- `docs/05_plan/backlog.md` (fila T-675)
