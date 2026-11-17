---
fecha: 2026-11-05
tipo: tarea
ids: [T-641, T-605a, T-640, T-661, PEN-W05]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-641-fixtures-integracion
---
# T-641: fixtures de integración reenviador → relay sin hardware

## Contexto
T-641 es la integración: el reenviador de la estación (T-605a) postea los mensajes `web-1` (T-661) al relay público (T-640) en `POST /api/v1/ingesta`. El criterio del backlog es que una sesión reproducida aparezca en la web pública con < 2 s de retraso, pero **el relay (T-640) todavía no existe** (en progreso) y no hay hosting/dominio (PEN-W05). Esta tarea deja, sin hardware, una forma **reproducible y versionada** de probar la cadena "estación → reenviador → relay" contra un *test double* local, y documenta el procedimiento. No se crea ni se toca `gui/relay/` (regla dura: es de otra persona, PR #74).

## Qué se hizo
- **`estacion/fixtures/`** (nueva, versionada; elegida en vez de `estacion/sesiones/`, que está en `.gitignore` por guardar sesiones reales de `dashboard.py`):
  - `web1.jsonl` (1 153 734 B, 1347 mensajes): un vuelo completo de Demeter desde la simulación de OpenRocket (`datos/simulaciones/openrocket/`), generado con `estacion/pruebas/generador.py` y reprocesado con `estacion/web1.py` (`--modo simulacion`). Cada línea es `{"tipo","mision","datos"}` válido según `web-1`. Cubre `meta`, `estado` (941, con PREFLIGHT→ARMED→BOOST→COAST→APOGEE→DESCENT→LANDED), `salud` (131), `estacion` (131 por misión) y `evento` (12: `despegue`, `fin_combustion`, `apogeo`, `eyeccion`, `aterrizaje`, `fase`).
  - `web1_snapshot.json` (59 645 B): el `snapshot` final de `demeter` y `hermes` (Hermes no transmitió, como en el vuelo de la sim.: sin `estado`/`salud`, con `meta`).
  - `regenerar.py` (solo biblioteca estándar): regenera los dos archivos **de forma determinista** (misma semilla: `g.vuelo(g.perfil_demeter(), t_ini=-30.0)`, es decir T-30 s hasta `t_fin + 15 s`). Con `--sesion RUTA` además escribe la sesión cruda de tierra (ignorada por git) para `dashboard.py --reproducir`.
- **`estacion/pruebas/test_fixture_web1.py`** (8 pruebas): valida el fixture contra `contrato.errores_mensaje`/`errores_snapshot` (esquema + `tools/web_datos/validacion.py`) y lo publica con el `Reenviador` real contra `RelayFalso` (el servidor HTTP falso de `test_reenviador.py`, que solo registra el POST y responde 200). Comprueba que los 1347 mensajes llegan **íntegros, en orden**, con ruta `/api/v1/ingesta`, `Authorization: Bearer <token>` y `Content-Type: application/json`.
- **`estacion/README.md`**: sección "Fixture de integración reenviador → relay sin hardware (T-641)" con los comandos exactos (regenerar, test, y publicar a mano con `--reproducir --web-relay`).

No se tocó ningún contrato (`gui/web/src/contrato/`, `datos/api.ts`, `tema/`, `05_contrato_datos_web.md`) ni `gui/relay/`, y no se modificó `package.json`.

## Evidencia
- Fixture regenerado dos veces → hashes idénticos (`web1.jsonl` = `7f51222…`, `web1_snapshot.json` = `250e849…`): **determinista**.
- `python -m unittest discover -s estacion/pruebas -p 'test_fixture_web1.py'` → **8 pruebas, OK, ~1 s**.
- Suites relevantes de la estación, todas en verde:
  - `test_web1.py`: 74 OK.
  - `test_reenviador.py`: 35 OK.
  - `test_dashboard_api.py`: 22 OK.
  - `test_fixture_web1.py`: 8 OK.
  - Total relevante: **139 pruebas OK**.
- `test_calib.py` y `test_vuelos_replay.py` fallan en la **importación de `numpy`** (no instalado en este entorno); es una dependencia documentada del README (calibración/ekf/replay) y **preexistente**, ajena a T-641. La suite de integración de esta tarea no usa numpy.
- Conteo del fixture (salida de `web1.py`): `demeter` 941 `estado`, 131 `salud`, 131 `estacion`, 12 `evento`, 1 `meta`; `hermes` 131 `estacion`.

## Decisiones tomadas o propuestas
1. **Ruta del fixture:** `estacion/fixtures/` (nueva), fuera de `estacion/sesiones/` (ignorada por git). El JSONL y el snapshot se versionan; la sesión cruda no (se regenera o se escribe a `estacion/sesiones/` con `--sesion`).
2. **Método determinista:** reutilizar `estacion/pruebas/generador.py` (que ya produce las líneas `@T/@L/@G/[time]` con el TDMA de `net_proto` a partir de la sim. de OpenRocket de Demeter) en vez de capturar `dashboard.py --demo` (que **no escribe** archivo de sesión y usa `time.time()`, no reproducible). Se fija `modo='simulacion'` (datos de simulación, no de vuelo real).
3. **Test double:** reutilizar `RelayFalso` de `test_reenviador.py` (ya existía, en `estacion/pruebas/`, no en `gui/relay/`): no se reimplementa el relay. El test del fixture alimenta el `Reenviador` real con los mensajes del JSONL y compara lo que llega con el fixture, mensaje a mensaje y en orden.
4. **Sin cambios de contrato ni de transporte:** el fixture se produce con `web1.py` tal cual (no se añade nada a `web-1`); el cuerpo POST lo arma el `Reenviador` existente (T-605a).

## Problemas y cómo se resolvieron
- `python -m unittest discover -s estacion/pruebas -t .` falla en Python 3.14 ("Start directory is not importable") porque `estacion/` no tiene `__init__.py`. Se usa el comando documentado del README, `python -m unittest discover -s estacion/pruebas`, que sí funciona. No se añaden `__init__.py` (cambiaría la estructura sin necesidad para esta tarea).
- El primer intento de `Reenviador(..., RAPIDO)` pasaba el dict como `evento`; se corrigió a `**RAPIDO`.
- `dashboard.py --demo` (clase `DemoLink`) alimenta `ground_line()` con líneas sintéticas pero **no escribe** `self.rec` (eso solo lo hace `Link`, con un puerto real): confirmado leyendo `dashboard.py`. Por eso la sesión reproducible sale del generador, no de capturar `--demo`.

## Pendiente / siguiente paso
- **T-640 (el relay, en progreso):** repetir la prueba punta a punta contra el relay real. El stub local cubre formato, ruta, token y orden, pero no la deduplicación por `X-Lote-Id`, la bajada a 1 Hz en tierra ni los SSE públicos.
- **PEN-W05 (hosting/dominio):** probar con `--web-relay https://<dominio>` y el token real (TLS, DNS, Starlink en P-08). Hasta entonces el flujo documentado usa `http://127.0.0.1`.
- Si se quiere, ampliar el fixture con un vuelo de Hermes (el generador hoy emite un solo cohete; la sim. de Hermes no existe, PEN-W04).

## Documentos afectados
- Nuevos: `estacion/fixtures/regenerar.py`, `estacion/fixtures/web1.jsonl`, `estacion/fixtures/web1_snapshot.json`, `estacion/pruebas/test_fixture_web1.py`.
- Modificados: `estacion/README.md` (sección de la integración T-641).
- Por actualizar por el documentador: backlog (T-641: fixtures listos; falta T-640 y PEN-W05 para cerrarla).
