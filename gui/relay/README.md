# Relay público (T-640)

El servidor de internet de la web pública: recibe del reenviador (`estacion/reenviador.py`, T-605a) los mensajes `web-1`
y los entrega a los navegadores por `snapshot` y SSE. **Solo lectura hacia afuera: no existe ninguna ruta que llegue a un
cohete** (GS-14).

- Contrato: [`docs/08_gui/04_arquitectura_web.md`](../../docs/08_gui/04_arquitectura_web.md) §4 y §5, y D-060. Formato de los
  mensajes: [`05_contrato_datos_web.md`](../../docs/08_gui/05_contrato_datos_web.md).
- Python ≥ 3.12 (probado en 3.14.3), FastAPI + uvicorn + `sse-starlette`. **Un solo proceso**: el estado está en memoria.

## Rutas

| Ruta | Quién | Qué |
| --- | --- | --- |
| `POST /api/v1/ingesta` | Solo el reenviador (`Authorization: Bearer <token>`) | Lote `{"mensajes": [{"tipo", "mision", "datos"}]}`. 200 `{"aceptados","descartados"}`, 401, 400/422, 413, 500. `X-Lote-Id` repetido: 200 sin reprocesar |
| `GET /api/v1/{mision}/snapshot` | Público | `meta`, último `estado`, `salud`, `estacion`, `eventos`, `serie` en columnas (≤ 2000 puntos). `Cache-Control: no-store` |
| `GET /api/v1/{mision}/stream` | Público | SSE; `id` = `seq_relay`; el `meta` de bienvenida va sin `id`; reanuda con `Last-Event-ID` (≤ 200 mensajes); `: ping` cada 15 s; 429 pasado el límite por IP |
| `GET /api/v1/salud` | Público | `{"estado": "ok", ...}` con contadores. Sin rutas de disco ni el token |

`{mision}` es `demeter` o `hermes`. No hay `/docs`, `/redoc` ni `/openapi.json`.

## Cómo correrlo

```bash
cd gui/relay
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt     # en Linux/macOS: .venv/bin/python
cp .env.example .env                                            # y cambia WEB_INGESTA_TOKEN
.venv/Scripts/python servidor.py                                # escucha en 127.0.0.1:8787
```

El puerto **8787** es al que apunta el proxy de Vite (`gui/web/vite.config.ts`): con el relay arriba, `npm run dev` o
`npm run preview` en `gui/web/` ya hablan con él, sin tocar el código de la web.

Sin `WEB_INGESTA_TOKEN` el relay **no arranca** (sale con código 2).

### Variables de entorno (el entorno gana a `.env`)

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `WEB_INGESTA_TOKEN` | — (obligatoria) | El token de la ingesta. El mismo del reenviador. Nunca en el repo |
| `WEB_RELAY_DATOS` | `gui/relay/datos/` (ignorada por git) | Carpeta de los JSONL, uno por misión |
| `WEB_RELAY_ORIGENES` | localhost y 127.0.0.1 en 5173, 4173 y 5174 | Orígenes CORS, separados por comas |
| `WEB_RELAY_ESQUEMA` | `gui/web/src/contrato/esquema.json` | Ruta de `esquema.json` (T-642 lo despliega aparte) |
| `WEB_SSE_MAX_POR_IP` | `WEB_SSE_MAX_POR_IP` de `constantes.py` (10) | Streams abiertos por IP antes de 429. Detrás de un NAT compartido puede hacer falta subirlo (se decide en T-642) |
| `WEB_RELAY_HOST` / `WEB_RELAY_PUERTO` | `127.0.0.1` / `8787` | Dónde escucha `servidor.py` |

Detrás de un proxy (T-642), arrancar con `uvicorn app:crear_app --factory --proxy-headers --forwarded-allow-ips <ip del proxy>`
para que el límite por IP use la IP real. **Siempre un solo proceso** (`workers=1`).

## Qué hace con cada mensaje (resumen de 04 §4.3 a §4.5)

- **Orden:** el de `estado` se decide con `rx_utc_ms` (y `t_ms` para desempatar), no con `t_ms`.
  - Un `estado` más nuevo que el último: pasa a ser el del snapshot y sale por el stream (con la tasa de abajo).
  - Un `estado` **atrasado** (`rx_utc_ms` menor): entra a la `serie` en su lugar. **Nunca sale por el stream** ni cambia el último `estado`.
  - Un `estado` **repetido**: se descarta.
- `salud` (por `t_ms`) y `estacion` (por `utc_ms`) viejos o repetidos se descartan. Un `evento` con la clave de uno guardado
  (`tipo|t_ms|fase|activa`) se descarta; uno nuevo siempre sale, aunque llegue tarde.
- **Tasa en tierra** (BOOT, PREFLIGHT, ARMED, LANDED): 1 Hz medido con `rx_utc_ms`; el primer `estado` tras un cambio de fase
  pasa; en vuelo y en ERROR pasa todo. La serie y el snapshot usan todo.
- `relay_utc_ms` lo escribe siempre el relay.
- **Misiones:** otro `mission_id` (distinto de `null`) inicia otra misión (se vacían eventos y `serie`; `seq_relay` sigue). De
  `null` a un valor se conserva todo. Un `mission_id` ya cerrado no se vuelve a abrir.
- **Persistencia:** cada mensaje aceptado se agrega a `datos/<mision>.jsonl` **antes** de responder el lote. Al reiniciar, el
  relay reconstruye el estado desde ahí (tolera una última línea cortada) y `seq_relay` no se repite ni retrocede.

## Limpiar después de un ensayo

No hay ruta para hacerlo desde afuera (a propósito). Se detiene el relay, se borra su carpeta de datos y se vuelve a arrancar:

```bash
# detener el relay (Ctrl+C), luego:
rm -rf gui/relay/datos          # o la carpeta de WEB_RELAY_DATOS
.venv/Scripts/python servidor.py
```

**Hay que hacerlo antes del vuelo real** si el relay recibió algo de ensayo: el snapshot y la `serie` conservan lo ya recibido
(y un `mission_id` de ensayo cerrado nunca se vuelve a abrir).

## Alimentarlo sin el back (`alimentar.py`)

Sube un JSONL de `gui/web/dev/datos/` como lo haría el reenviador, en el instante de su `t_rel_ms`. La misión sale del nombre
del archivo.

```bash
export WEB_INGESTA_TOKEN=...        # el mismo del relay (o lo lee de gui/relay/.env)
.venv/Scripts/python alimentar.py ../web/dev/datos/demeter_nominal.jsonl ../web/dev/datos/hermes_nominal.jsonl
# --velocidad 5 (cinco veces más rápido)   --vueltas 3 (repite el vuelo, corriendo los relojes)   --url http://host:puerto
```

## Herramientas manuales (`herramientas/`)

No son parte de `pytest`; son las corridas de punta a punta de T-640. Todas con el python del venv y desde la raíz del repo.

| Archivo | Para qué |
| --- | --- |
| `sesion_dos_cohetes.py <salida.txt>` | Genera una sesión de tierra con Deméter y Hermes (con el generador de `estacion/pruebas/`) |
| `corte_reenviador.py <repo> <sesion.txt> <carpeta de trabajo>` | `dashboard.py --reproducir --web-relay` contra el relay real; corta el relay a mitad de la sesión, lo reinicia con los mismos datos y revisa `serie`, repetidos y que el stream no lleve atrasados |
| `humo_carga.py <repo> <carpeta> <clientes> <vueltas> <velocidad>` | N clientes SSE durante un vuelo repetido (`alimentar.py --vueltas`); imprime latencia p50/p95/p99 y el tamaño de un `estado`. **No es la prueba de T-643** |

La spec de Playwright contra el relay es `gui/web/e2e/relay.spec.ts` (se activa con `RELAY_E2E=sin_datos|vivo`; ver su encabezado).

## Pruebas

```bash
.venv/Scripts/python -m pytest          # ~35 s; el SSE se prueba con un uvicorn real en un hilo
```

| Archivo | Cubre |
| --- | --- |
| `pruebas/test_ingesta.py` | token (401 antes de leer el cuerpo), inventario de rutas, códigos 200/400/422/413/500, `X-Lote-Id` |
| `pruebas/test_orden.py` | tasa en tierra, atrasados y repetidos, cambio de misión |
| `pruebas/test_snapshot_reinicio.py` | snapshot sin datos y válido contra el esquema, reconstrucción tras reiniciar |
| `pruebas/test_stream.py` | SSE, `Last-Event-ID`, CORS, 429, cliente lento |
| `pruebas/test_alimentar.py` | `alimentar.py` contra un relay real |

Archivos: `app.py` (rutas), `estado_mision.py` (las reglas), `difusion.py` (fan-out SSE), `almacen.py` (JSONL),
`validacion.py` (esquema), `config.py`, `constantes.py` (los nombres de `constantes.md` §9).
