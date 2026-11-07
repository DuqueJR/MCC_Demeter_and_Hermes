---
fecha: 2026-11-07
tipo: tarea
ids: [T-642, D-061, PEN-W05, T-643, T-636]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-642-despliegue-relay
---
# T-642: despliegue del relay (Dockerfile, fly.toml, guía) y conexión con el sitio

## Contexto
El relay (`gui/relay/`, T-640) está hecho y probado, pero no está desplegado: `api.eiaspice.space` no resuelve y el repo no traía `Dockerfile` ni `fly.toml`. El sitio ya está en Cloudflare Pages (`https://eiaspice.space`). El lanzamiento es el 8 de noviembre. **Esta tarea deja todo lo que se puede preparar sin credenciales**; crear la app en Fly, el DNS, el certificado y la variable de Pages los hace una persona con `docs/08_gui/11_guia_despliegue.md`. **T-642 no está hecha: está "preparada, falta el despliegue por el humano".**

## Qué se hizo
- `gui/relay/Dockerfile` (Python 3.12, `ARG PYTHON_VERSION`), `gui/relay/entrypoint.sh` y `.dockerignore` **de la raíz del repo**.
  - **Contexto de build = raíz del repo**: la imagen copia `gui/web/src/contrato/esquema.json` a `/app/esquema.json` y fija `WEB_RELAY_ESQUEMA`; así no hay una segunda copia del contrato.
  - `.dockerignore` con lista blanca (`*` y excepciones): solo los `.py` del relay, `requirements.txt`, `entrypoint.sh` y `esquema.json`. Ni `.git`, ni `.env`, ni pruebas ni datos entran a la imagen.
  - Arranque: `uvicorn app:crear_app --factory --proxy-headers --forwarded-allow-ips "$FORWARDED_ALLOW_IPS" --host 0.0.0.0 --port 8080 --workers 1 --no-access-log --timeout-graceful-shutdown 5`. `FORWARDED_ALLOW_IPS` es configurable (por defecto `*`).
  - **Usuario no root:** el entrypoint arranca como root solo para `chown` de `/datos` (un volumen de Fly se monta con dueño root; sin eso el usuario sin privilegios no podría escribir los JSONL) y baja a `relay` (uid 10001) con `setpriv` antes del `exec`. Si el contenedor ya arranca sin root, no hace nada de eso.
- `gui/relay/fly.toml`: `shared-cpu-1x` de 1 GB, una máquina, `auto_stop_machines = "off"`, `auto_start_machines = false`, `[[restart]] always`, volumen `relay_datos` en `/datos`, check `GET /api/v1/salud` cada 15 s, `force_https`, concurrencia por conexiones con `soft 1500` / `hard 2000` (el SSE son conexiones largas), `kill_signal = SIGTERM`. Variables no secretas: `WEB_RELAY_DATOS`, `WEB_RELAY_ORIGENES=https://eiaspice.space` (el repo no usa `www.`), `WEB_SSE_MAX_POR_IP=600` y `FORWARDED_ALLOW_IPS=*`. **Sin secretos:** el token va por `fly secrets set WEB_INGESTA_TOKEN`.
- `docs/08_gui/11_guia_despliegue.md` (nueva; enlazada desde `08_gui/00_README.md` y `04_arquitectura_web.md` §9): decisiones con su razón, paso a paso para el humano (flyctl, `fly launch --no-deploy --copy-config`, volumen, secreto, `fly deploy --ha=false`, CNAME `api` en modo solo DNS, `fly certs add`, variable de Pages, verificación con `curl`, `alimentar.py`, prueba de carga T-643, reenviador), borrado de datos de ensayo antes del vuelo y cuándo quitar `SIMULACION_SIEMPRE_VISIBLE`.
- `gui/web/.env.example` y `gui/web/README.md`: en producción `VITE_API_BASE=https://api.eiaspice.space/api` va como variable de build de Pages. No se creó `.env.production` a propósito: afectaría a `npm run e2e` y a la prueba de aislamiento, que construyen en modo producción y prueban contra el proxy local. `vite.config.ts` y el proxy de desarrollo (`/api` → 8787) **no se tocaron**.
- READMEs y `.env.example` del relay: ya no dicen "se decide en T-642" y enlazan la guía. Backlog: T-642 queda "preparada, falta el despliegue por el humano".
- **No se tocó código de `gui/relay/*.py`**, ni `constantes.md`, ni contratos, ni `parametros.ts` (`SIMULACION_SIEMPRE_VISIBLE` sigue en `true`; la guía dice cuándo ponerlo en `false`).

## Evidencia
Docker (OrbStack; el daemon estaba apagado y se encendió con `orbctl start`), `docker build -f gui/relay/Dockerfile -t relay-t642 .` desde la raíz del repo, imagen de Python 3.12.16:
- `ls /app` de la imagen: solo `alimentar.py`, `almacen.py`, `app.py`, `config.py`, `constantes.py`, `difusion.py`, `entrypoint.sh`, `esquema.json`, `estado_mision.py`, `requirements.txt`, `servidor.py`, `validacion.py`.
- Con un volumen vacío (dueño root): `Uid: 10001` del proceso 1; `/datos` con dueño `relay`. `curl /api/v1/salud` → 200 `{"estado": "ok", "contrato_version": "web-1", ...}`.
- `alimentar.py` (demeter y hermes, `--velocidad 20`) contra el contenedor: `demeter_nominal.jsonl: 1095 aceptados, 0 descartados, 0 reintentos`; `hermes_nominal.jsonl: 976 aceptados, 0 descartados, 0 reintentos`; `demeter.jsonl` y `hermes.jsonl` aparecen en el volumen. `docker restart` → `seq_relay` 1094 y 976 y el mismo `mission_id`: reconstruye desde el volumen.
- Borrar `/datos/*.jsonl` y `docker restart` → `seq_relay` 0 y `mission_id` null en las dos misiones (el procedimiento de la guía §4).
- Prueba de carga de T-643 contra el contenedor, **100 clientes SSE desde una sola IP** (con límite 600) y `alimentar.py` a ×5: 100 conexiones a 200, 96 503 mensajes, 0 errores, 0 reconexiones, p50 5 ms, p95 8 ms, p99 11 ms (local; **no es** la prueba de T-643). Con el límite por defecto de 10 esto habría dado 429.
- `X-Forwarded-For` con `WEB_SSE_MAX_POR_IP=2`:

  | `FORWARDED_ALLOW_IPS` | 3 streams sin la cabecera | 3 streams con `X-Forwarded-For` distintos |
  | --- | --- | --- |
  | `*` | 200, 200, 429 | 200, 200, 200 (la cabecera se obedece) |
  | `127.0.0.1` | 200, 200, 429 | 200, 200, 429 (la cabecera se ignora) |

- CORS con `WEB_RELAY_ORIGENES=https://eiaspice.space`: el origen del sitio recibe `access-control-allow-origin: https://eiaspice.space`; el preflight de `/stream` con `Last-Event-ID, Accept` devuelve 200 con esas cabeceras permitidas; un origen ajeno no recibe `allow-origin`.
- `fly.toml` leído con `tomllib` de Python 3.12 (válido) y contrastado con la documentación de Fly (`docs.fly.io/reference/configuration`).
- Pruebas del relay dentro de la imagen base `python:3.12-slim-bookworm`: `118 passed in 28.38s` (Python 3.12.16; T-640 las había corrido en 3.14.3).
- Web: `npm ci` y `VITE_API_BASE=https://api.eiaspice.space/api npm run build` en `gui/web/`: la URL queda en `dist/assets/guion-*.js` (una sola aparición) y "Aislamiento OK"; `npm test`: `517 passed | 3 skipped` (24 archivos). Los e2e de Playwright no se corrieron (esta tarea no cambia código de la web).

## Decisiones tomadas o propuestas
Propuestas (las consolida el documentador; nada de esto se aplicó a `constantes.md` ni a contratos):
1. **`WEB_SSE_MAX_POR_IP`: 600 en producción.** Razón: el público del evento sale por pocas IP (NAT del recinto o del operador móvil) y cada pestaña es un stream; con 10 la persona 11 recibe 429. 600 = el tope de T-643 y el público esperado (500, D-W09) con margen. Memoria: cola acotada de 100 mensajes por cliente (~35 KB). No es una defensa contra abuso. Propuesta: en `constantes.md` §9 anotar "10 por defecto; 600 en producción (configuración de despliegue, T-642)". El valor del `constantes.py` del relay no cambia.
2. **`--forwarded-allow-ips` = `*` en Fly.** Razón: la dirección del proxy de Fly no es fija ni está documentada, y con `127.0.0.1` todos cuentan como una IP (probado arriba). Riesgo: con `*` uvicorn toma el **primer** valor de `X-Forwarded-For`; la documentación de Fly no dice si el proxy reemplaza o agrega a la cabecera del cliente (consulté `docs.fly.io/networking/request-headers`: solo dice que se trate con cuidado). Si agrega, un cliente puede falsear su IP y saltarse el límite por IP, que de todos modos no es una barrera. **Propuesta de tarea (opcional, post-evento):** que `app.py` use `Fly-Client-IP` (la IP real según el proxy) cuando exista, en lugar de `request.client.host`.
3. **DNS de `api` en solo DNS (nube gris):** TLS y reto de certificado directo con Fly, un salto menos para el SSE, sin interacción con el tiempo de inactividad ni el búfer de Cloudflare. Se pierde la caché y la protección DDoS de Cloudflare para `api`, que no aplican (el snapshot es `no-store`).
4. **`VITE_API_BASE` por variable de build de Pages**, no por `.env.production` (razón arriba). Si se prefiere un valor por defecto en el repo, habría que hacer que `npm run e2e` fije `VITE_API_BASE=/api` de forma portable (hoy el equipo usa Windows y macOS).
5. **Dockerfile/entrypoint:** la parte de bajar de privilegios con `setpriv` existe por el dueño root del volumen de Fly. No se encontró otra forma sencilla de tener a la vez "usuario no root" y "escribe en un volumen de Fly".

## Problemas y cómo se resolvieron
- El puerto 8080 de la máquina estaba ocupado por otro servicio local: las pruebas usaron los puertos 18642 a 18644.
- `flyctl` no está instalado y no hay cuenta: `fly.toml`, `[http_service.concurrency]`, el contexto de build y la región `bog` no se pudieron comprobar contra Fly. Por eso la guía trae alternativas (`fly apps create`, `--local-only`, `mia`).
- El límite de concurrencia por defecto del servicio de Fly (un servicio nuevo suele traer valores bajos) mataría 600 SSE: se fijaron `soft`/`hard` explícitos.
- Un volumen de Fly se monta con dueño root: de ahí el `chown` del entrypoint.

## Pendiente / siguiente paso
**Todo lo siguiente es de una persona con las cuentas** (pasos en `docs/08_gui/11_guia_despliegue.md`):
1. Instalar `flyctl`, `fly auth login`, `fly launch --no-deploy --copy-config ...`, `fly volumes create relay_datos ...` (un solo volumen), `fly secrets set WEB_INGESTA_TOKEN=...`, `fly deploy ... --ha=false`. Confirmar la región `bog` (`fly platform regions`).
2. Cloudflare: CNAME `api` → `hermes-demeter-relay.fly.dev` en solo DNS; `fly certs add api.eiaspice.space`.
3. Cloudflare Pages: variable de build `VITE_API_BASE=https://api.eiaspice.space/api` y volver a desplegar el sitio.
4. Verificar: `curl /api/v1/salud`, CORS, SSE sin búfer, `alimentar.py --url https://api.eiaspice.space`, el sitio llamando a `api.eiaspice.space`.
5. T-643 (prueba de carga de 600 SSE; `ulimit -n 4096` en macOS) y P-08 de punta a punta; T-645 (guía de operación del día del vuelo).
6. **Antes del vuelo real:** apagar el reenviador, borrar `/datos/*.jsonl`, `fly apps restart`, comprobar `seq_relay` 0 y `mission_id` null. **No desplegar ni rotar secretos el día del vuelo.**
7. Cuando el relay esté verificado en vivo: PR que ponga `SIMULACION_SIEMPRE_VISIBLE = false` (`gui/web/src/datos/parametros.ts`, T-636) y volver a desplegar el sitio.
8. Después del evento: rotar el token.

## Documentos afectados
`docs/08_gui/11_guia_despliegue.md` (nuevo), `docs/08_gui/00_README.md` y `04_arquitectura_web.md` (un enlace cada uno), `docs/05_plan/backlog.md` (fila de T-642), `gui/relay/README.md`, `gui/relay/.env.example`, `gui/web/.env.example`, `gui/web/README.md`. Para consolidar: la propuesta 1 en `constantes.md` §9 y el estado de PEN-W05 (la infraestructura está lista; falta el despliegue).
