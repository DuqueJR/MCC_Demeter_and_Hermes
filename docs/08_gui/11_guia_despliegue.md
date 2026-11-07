---
id: gui_guia_despliegue
estado: preparada (T-642), falta ejecutarla por una persona con las cuentas de Fly.io y Cloudflare
actualizado: 2026-11-07
depende_de: [gui_arquitectura_web, D-061]
---
# Guía de despliegue del relay y la web (T-642)

Cómo poner en internet el relay (`gui/relay/`, en **Fly.io**) y conectarlo con el sitio (`https://eiaspice.space`, en **Cloudflare Pages**). Decisión de base: [D-061](../04_diseno/decisiones.md) y [04_arquitectura_web §9](04_arquitectura_web.md). Esta guía es de **despliegue**; la de **operación el día del vuelo** es T-645.

```
estacion/reenviador.py ──POST /api/v1/ingesta (Bearer)──►  https://api.eiaspice.space  ──►  Fly.io (1 máquina, volumen /datos)
                                                                      ▲  snapshot + SSE (solo GET)
navegadores ─►  https://eiaspice.space (Cloudflare Pages, estático) ──┘   VITE_API_BASE=https://api.eiaspice.space/api
```

> **Si algo de esto no sale a tiempo, el vuelo no depende de ello:** el sitio ya muestra la simulación (T-635 y T-636) y el dashboard local no se entera del relay (estacion_terrena §2.2).

## 0. Qué hay en el repo y qué falta

| Archivo | Para qué |
| --- | --- |
| `gui/relay/Dockerfile`, `gui/relay/entrypoint.sh` | La imagen: Python 3.12, un solo worker, usuario sin privilegios, `esquema.json` incluido |
| `.dockerignore` (raíz) | Lista blanca: a la imagen solo entran los `.py` del relay, `requirements.txt`, `entrypoint.sh` y `esquema.json` |
| `gui/relay/fly.toml` | La app de Fly: una máquina, 1 GB, volumen, health check, HTTPS forzado, variables no secretas |
| `gui/web/.env.example`, `gui/web/README.md` | Cómo se define `VITE_API_BASE` en el build de Pages |

**Falta, y es de una persona** (necesita las cuentas): crear la app y el volumen en Fly, el secreto, el despliegue, el DNS, el certificado y la variable de Pages (§2 y §3). Nada de eso se probó desde el repo: ver §6.

## 1. Decisiones de configuración (con su razón)

### 1.1 Una sola máquina, sin auto-stop, contexto de build en la raíz

- El estado del relay está **en memoria** (04 §4.5): dos procesos tendrían dos estados. Por eso `--workers 1`, **una** máquina (`--ha=false` al desplegar, **un** solo volumen), sin autoscale y `auto_stop_machines = "off"`. Un reinicio corta el SSE: **no se despliega ni se cambian secretos con el cohete en vuelo.**
- El límite de conexiones del servicio de Fly se sube (`soft 1500`, `hard 2000`, tipo `connections`): cada navegador es una conexión SSE larga y el límite por defecto de un servicio nuevo es mucho menor que 600.
- **El contexto del build es la raíz del repo**, porque `esquema.json` vive en `gui/web/src/contrato/` y la imagen lo copia a `/app/esquema.json` (y fija `WEB_RELAY_ESQUEMA`): así hay una sola copia del contrato. Por eso todos los comandos de Docker y de Fly se corren **desde la raíz**.
- `entrypoint.sh` arranca como root solo para `chown` de `/datos` (un volumen de Fly se monta con dueño root y el relay no podría escribir) y baja a `relay` (uid 10001) con `setpriv` antes de `exec uvicorn`.

### 1.2 `WEB_SSE_MAX_POR_IP`: 600 en producción (el defecto de `constantes.py` sigue en 10)

- **El problema:** con 10, un NAT compartido no cabe. El público del evento (Wi-Fi del recinto, o el NAT de un operador móvil) sale a internet con **una o muy pocas IP**, y cada pestaña abierta es un stream. Con 10, la persona 11 recibiría 429 y vería "Sin servidor" aunque el relay esté sano. También el script de T-643 abre 600 conexiones desde una sola IP.
- **El valor:** `600` = el tope de la prueba de carga (T-643) y el público esperado (500, D-W09) con margen. Se fija con la variable de `fly.toml`; **no se cambia `constantes.md`**: el valor por defecto sigue siendo 10 (desarrollo y pruebas del relay) y lo de producción es configuración de despliegue. Propuesta de nota en `constantes.md` §9: en la bitácora de T-642.
- **Costo de subirlo:** cada cliente tiene una cola acotada de `RELAY_COLA_CLIENTE_MAX` = 100 mensajes (~35 KB) y se descarta el más viejo si va lento: 600 clientes caben holgados en 1 GB. Esto **no es una defensa contra abuso** (nunca lo fue: una sola IP con 600 conexiones llena el cupo); lo que protege el relay es el tope total del servicio (`hard_limit`) y la cola por cliente.

### 1.3 `--forwarded-allow-ips`: `*` detrás del proxy de Fly

- **Qué hace:** con `--proxy-headers`, uvicorn toma la IP del cliente de `X-Forwarded-For` **solo si** quien le habla está en `--forwarded-allow-ips`. El valor se configura con `FORWARDED_ALLOW_IPS` (el `entrypoint.sh` lo pasa explícito).
- **Por qué `*`:** detrás de Fly, todas las conexiones llegan desde el proxy de Fly, cuya dirección interna no está documentada de forma fija. Con el valor por defecto (`127.0.0.1`) uvicorn **ignora** `X-Forwarded-For` y todos los usuarios del mundo cuentan como una sola IP (la del proxy). Se probó en el contenedor (§5): con `127.0.0.1` y límite 2, el tercer stream da 429 aunque cada uno traiga un `X-Forwarded-For` distinto; con `*`, esos tres pasan.
- **Riesgo que se acepta:** con `*`, uvicorn usa el **primer** valor de `X-Forwarded-For`. Si el proxy de Fly *agrega* a la cabecera del cliente en vez de reemplazarla (su documentación no lo aclara), un cliente malicioso puede inventar IP y saltarse el límite por IP. Como ese límite no es una barrera de seguridad (§1.2), el impacto es que alguien podría llenar los puertos de SSE del relay; no toca los datos ni la ingesta (que va con token). La máquina de Fly no tiene IP pública propia: el tráfico público solo llega por el proxy.
- **Si se quiere cerrar:** una tarea futura puede leer `Fly-Client-IP` (la IP real según el proxy) en `gui/relay/app.py` en vez de `request.client.host`. No se hizo aquí: es un cambio de código del relay (T-640), no de despliegue.

### 1.4 DNS de `api`: solo DNS (nube gris), sin el proxy naranja de Cloudflare

- El **TLS** de `api.eiaspice.space` lo termina Fly (certificado propio, `fly certs add`), y el reto de Let's Encrypt pasa directo a Fly. Con el proxy naranja, Cloudflare termina el TLS y cambia lo demás (modo de cifrado, reto de certificado, cabeceras).
- **SSE:** Cloudflare puede dejar pasar `text/event-stream`, pero añade un salto con su propio tiempo de inactividad (100 s en el plan gratuito; el latido de 15 s lo cubre), posible *buffering* y compresión; en un vuelo de 90 s no queremos descubrir esa interacción. Sin el proxy hay un salto menos que depurar.
- Lo que se pierde (la caché y la protección DDoS de Cloudflare para `api`) no importa: el snapshot es `no-store` y el stream no se cachea; no hay nada que cachear.
- **Lo estático** (`eiaspice.space`) sigue en Cloudflare Pages: es otro registro y no cambia.

### 1.5 `VITE_API_BASE`: en producción `https://api.eiaspice.space/api`

- El cliente arma `${VITE_API_BASE}/v1/<misión>/stream` y `/snapshot` (`gui/web/src/datos/cliente.ts`); sin la variable usa `/api` (desarrollo: el proxy de Vite al 8787, `vite.config.ts`, **sin tocar**).
- Vite **incrusta** la variable al construir. Se define como variable de build del proyecto de Pages (§3.6), **no** en un archivo del repo: un `.env.production` también afectaría a `npm run e2e` (que construye y prueba contra el proxy local) y a la prueba de aislamiento.
- **CORS:** el sitio (`https://eiaspice.space`) llama a otro origen, así que el relay devuelve `Access-Control-Allow-Origin` solo para `WEB_RELAY_ORIGENES=https://eiaspice.space` (el repo no usa `www.`; si algún día se publica ahí, se agrega separado por coma). Se aceptan `GET` y `OPTIONS` y las cabeceras `Last-Event-ID`, `Cache-Control` y `Accept`, que son las que usa el cliente.

## 2. Relay en Fly.io

Todo **desde la raíz del repo**. Reemplaza `hermes-demeter-relay` si el nombre de la app ya está tomado (cámbialo también en `app = ` de `gui/relay/fly.toml`).

1. **Instalar `flyctl` y entrar.**
   - macOS: `brew install flyctl`. Windows (PowerShell): `iwr https://fly.io/install.ps1 -useb | iex`. Linux: `curl -L https://fly.io/install.sh | sh`.
   - `fly auth login` (Fly pide una tarjeta aunque el costo sea de unos dólares al mes, D-061: ≤ US$10).
2. **Crear la app con la configuración del repo, sin desplegar:**
   ```bash
   fly launch --no-deploy --copy-config --config gui/relay/fly.toml --name hermes-demeter-relay --region bog
   ```
   - `--copy-config` usa nuestro `fly.toml` tal cual. Si `fly launch` ofrece variantes (base de datos, Redis, "tweak settings"), la respuesta es **no** a todo.
   - Si da problemas, alternativa equivalente: `fly apps create hermes-demeter-relay`.
   - **Región (P):** `bog` (Bogotá) es la más cercana, pero no se pudo comprobar desde aquí que tenga capacidad: `fly platform regions`. Si no sirve, usa `mia` (Miami) en `primary_region` de `fly.toml`, en `--region` de este paso y en el del volumen.
3. **Crear el volumen, exactamente UNO** (en la misma región; `fly deploy` crea una máquina por volumen libre y queremos una):
   ```bash
   fly volumes create relay_datos --app hermes-demeter-relay --region bog --size 1
   ```
4. **El secreto de la ingesta** (nunca en el repo):
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"      # copia el valor a un gestor de contraseñas
   fly secrets set WEB_INGESTA_TOKEN='<el valor>' --app hermes-demeter-relay
   ```
   Es **el mismo** que va en el reenviador (§3.9) y se rota después del evento (04 §8). Cambiar un secreto reinicia la máquina.
5. **Desplegar:**
   ```bash
   fly deploy --config gui/relay/fly.toml --dockerfile gui/relay/Dockerfile --ha=false
   ```
   (`--ha=false`: una sola máquina.) Revisa: `fly status --app hermes-demeter-relay` (1 máquina `started`, el check en `passing`) y `fly logs --app hermes-demeter-relay` (`Uvicorn running on http://0.0.0.0:8080`).
6. **Probar el relay por su dirección de Fly**, antes del DNS:
   ```bash
   curl -s https://hermes-demeter-relay.fly.dev/api/v1/salud
   ```
   Debe responder `{"estado": "ok", "contrato_version": "web-1", ...}`. `curl -sI http://hermes-demeter-relay.fly.dev/api/v1/salud` debe redirigir (301) a `https`.

## 3. Dominio, sitio y verificación

1. **DNS en Cloudflare** (`eiaspice.space` → DNS → Records → Add record): tipo `CNAME`, nombre `api`, destino `hermes-demeter-relay.fly.dev`, **Proxy status: DNS only (nube gris)** (§1.4).
2. **Certificado:**
   ```bash
   fly certs add api.eiaspice.space --app hermes-demeter-relay
   fly certs show api.eiaspice.space --app hermes-demeter-relay        # repetir hasta "Issued" (minutos)
   ```
   Si queda pendiente, `fly certs show` dice qué registro falta (a veces pide `A` y `AAAA` con las IP de `fly ips list` en vez del `CNAME`; hay que seguir lo que diga).
3. **Probar el dominio:** `curl -s https://api.eiaspice.space/api/v1/salud` (200 y `"estado": "ok"`) y `curl -sI http://api.eiaspice.space/api/v1/salud` (redirige a HTTPS).
4. **CORS** (con el origen del sitio):
   ```bash
   curl -si -H 'Origin: https://eiaspice.space' https://api.eiaspice.space/api/v1/salud | grep -i access-control-allow-origin
   # access-control-allow-origin: https://eiaspice.space
   curl -si -H 'Origin: https://otro.example' https://api.eiaspice.space/api/v1/salud | grep -ic access-control-allow-origin    # 0
   ```
5. **Que el SSE no quede en búfer** (los mensajes llegan uno a uno): con datos corriendo (paso 8), `curl -N https://api.eiaspice.space/api/v1/demeter/stream` debe imprimir cada `event:` apenas llega, no en bloques.
6. **Variable de build del sitio (Cloudflare Pages):** Workers & Pages → el proyecto → Settings → Variables and secrets → entorno **Production** → `VITE_API_BASE` = `https://api.eiaspice.space/api` (texto plano).
   - Ajustes de build del proyecto (si se despliega desde Git): carpeta raíz `gui/web`, comando `npm run build`, salida `dist`, `NODE_VERSION` = 22 (`.nvmrc`).
   - Vuelve a desplegar el sitio (Deployments → Retry deployment, o un push): **la variable solo cuenta al construir**.
   - Si el sitio se sube a mano (sin Git): `cd gui/web && npm ci && VITE_API_BASE=https://api.eiaspice.space/api npm run build`, y se sube `dist/` como siempre (el mapa PMTiles incluido, T-638).
   - Comprobación: en `https://eiaspice.space/demeter/` (con las herramientas de desarrollo → Red) las peticiones van a `https://api.eiaspice.space/api/v1/demeter/snapshot` y `/stream`, no a `https://eiaspice.space/api/...`.
7. **Datos de ensayo con `alimentar.py`** (sube un vuelo grabado, como lo haría el reenviador; solo biblioteca estándar, Python ≥ 3.12):
   ```bash
   cd gui/relay
   export WEB_INGESTA_TOKEN='<el token>'            # Windows: $env:WEB_INGESTA_TOKEN='<el token>'
   python alimentar.py ../web/dev/datos/demeter_nominal.jsonl ../web/dev/datos/hermes_nominal.jsonl --url https://api.eiaspice.space --velocidad 5
   ```
   Debe terminar con `... aceptados, 0 descartados, ... 0 reintentos` y `curl -s https://api.eiaspice.space/api/v1/salud` mostrar `seq_relay` > 0. En el sitio se ve el vuelo de ensayo en modo simulación. **Esto deja datos de ensayo en el volumen: ver §4.**
8. **Prueba de carga (T-643)**, 600 SSE durante 5 min con un vuelo repetido; criterio: p95 de la latencia < 1 s y sin errores ([04 §5](04_arquitectura_web.md), [README de la prueba](../../gui/web/dev/prueba_carga/README.md)). En dos terminales, **desde un PC con la hora sincronizada por NTP** (la latencia se mide contra `relay_utc_ms`):
   ```bash
   # terminal 1: el vuelo repetido (tres vueltas ≈ 5 min)
   cd gui/relay && python alimentar.py ../web/dev/datos/demeter_nominal.jsonl --url https://api.eiaspice.space --vueltas 3
   # terminal 2: 600 clientes. En macOS/Linux, antes: ulimit -n 4096 (el límite por defecto de macOS es 256 archivos abiertos)
   node gui/web/dev/prueba_carga/main.mjs https://api.eiaspice.space --conexiones 600 --duracion 300 --mision demeter --snapshot 5
   ```
   Mira también `fly status` y la CPU y la memoria de la máquina (`fly dashboard` → Metrics): se registran en la bitácora de T-643. Si salen 429, `WEB_SSE_MAX_POR_IP` no llegó (`fly ssh console -C env | grep WEB_`).
9. **El reenviador de la estación** (`estacion/reenviador.py`, apagado si falta la URL o el token). En el PC de la estación:
   ```bash
   cp estacion/.env.example estacion/.env      # (ignorado por git) y edítalo:
   #   WEB_RELAY_URL=https://api.eiaspice.space
   #   WEB_INGESTA_TOKEN=<el mismo token del paso 2.4>
   python estacion/dashboard.py                # o con la URL en la línea: --web-relay https://api.eiaspice.space
   ```
   En los eventos del dashboard debe salir `web: reenviador CONECTADO ...`; con `401` dirá que el token no coincide. Sin hardware se puede probar con `python estacion/dashboard.py --demo --web-relay https://api.eiaspice.space` (ver `estacion/README.md`, y esto también deja datos de ensayo: §4).
10. **De punta a punta (P-08):** la web publicada en un celular con datos móviles, con el reenviador subiendo desde la estación, mismo vuelo en la web y en el dashboard.

## 4. Antes del vuelo real (obligatorio)

El snapshot y la `serie` conservan lo ya recibido, y un `mission_id` de ensayo ya cerrado **no se vuelve a abrir** (relay README, "Limpiar después de un ensayo"). Hay que **borrar los datos de ensayo del volumen**:

1. **Apagar el reenviador** (cerrar el dashboard o quitar el token de `estacion/.env`). Que nada esté subiendo.
2. Borrar los JSONL y **reiniciar enseguida** (el proceso aún tiene el estado en memoria):
   ```bash
   fly ssh console --app hermes-demeter-relay -C "sh -c 'rm -f /datos/*.jsonl'"
   fly apps restart hermes-demeter-relay                   # reinicia la única máquina
   ```
3. **Comprobar:** `curl -s https://api.eiaspice.space/api/v1/salud` debe dar `"seq_relay": 0` y `"mission_id": null` en las dos misiones, y `.../demeter/snapshot` sin `estado`.
4. Recién entonces, encender el reenviador para el vuelo.

Además:
- **Quitar `SIMULACION_SIEMPRE_VISIBLE`** (`gui/web/src/datos/parametros.ts`, T-636) **solo cuando el relay esté verificado en vivo** (§3.1 a §3.7 y §3.10 hechos). Se pone en `false` (vuelve exacto a T-635: el botón de la simulación solo sale en "Sin transmisión todavía"), por un PR a `develop`, y se vuelve a desplegar el sitio. **Este PR no lo cambia.** Con el relay arriba y sin datos reales, la web dirá "Sin transmisión todavía" con su botón de simulación, que es lo correcto.
- **No desplegar ni cambiar secretos** el día del vuelo, salvo emergencia: reinicia la máquina y corta el SSE.
- **Después del evento:** rotar el token (`fly secrets set WEB_INGESTA_TOKEN=...`, y el reenviador) y, si se quiere, `fly apps destroy` para dejar de pagar.

## 5. Cómo se verificó localmente (7 de noviembre de 2026)

Con Docker (OrbStack), desde la raíz del repo: `docker build -f gui/relay/Dockerfile -t relay-t642 .`

- La imagen contiene solo `/app/*.py`, `requirements.txt`, `entrypoint.sh` y `esquema.json` (ni `.env`, ni pruebas, ni datos).
- Arranca con un volumen vacío (dueño root) y con `WEB_INGESTA_TOKEN`; el proceso 1 corre con **uid 10001** y `/datos` queda con dueño `relay`.
- `curl /api/v1/salud` da 200; `alimentar.py` (demeter y hermes, ×20) sube 2071 mensajes sin descartes y los JSONL aparecen en el volumen; tras `docker restart` el relay reconstruye `seq_relay` (1094 y 976) y el snapshot.
- Borrar `/datos/*.jsonl` y reiniciar deja `seq_relay` 0 y `mission_id` null (el paso de §4).
- Con `WEB_SSE_MAX_POR_IP=600`: 100 clientes SSE desde una sola IP (script de T-643) sin ningún error, p95 de 8 ms (local; no cuenta como la prueba de T-643).
- `X-Forwarded-For` con `FORWARDED_ALLOW_IPS=*` y con `127.0.0.1` (§1.3); CORS con `WEB_RELAY_ORIGENES=https://eiaspice.space` (origen permitido, el preflight con `Last-Event-ID`, y un origen ajeno sin cabecera).
- Las 118 pruebas del relay pasan en Python 3.12.16 (la imagen), además de las de Python 3.14.3 de T-640.
- `npm run build` en `gui/web` con `VITE_API_BASE=https://api.eiaspice.space/api`: la URL queda incrustada en el JS compartido (`assets/guion-*.js`) y la prueba de aislamiento pasa.

**No se pudo verificar desde el repo** (necesita cuentas y red): el despliegue en Fly, que `fly.toml` lo acepte `flyctl` (no está instalado aquí; solo se comprobó que es TOML válido y se contrastó con la documentación de Fly), la capacidad de la región `bog`, que el contexto de build de la raíz y el `.dockerignore` con lista blanca se comporten igual en el constructor remoto de Fly (con Docker local sí), el DNS, el TLS, la variable de Pages y todo §3.

## 6. Si algo falla

| Síntoma | Qué mirar |
| --- | --- |
| `fly deploy` no encuentra archivos (`COPY ... not found`) | No se corrió desde la raíz, o el `.dockerignore` de la raíz no se aplicó: `fly deploy --local-only` (usa el Docker de la PC) |
| Dos máquinas tras el deploy | Faltó `--ha=false`, o hay dos volúmenes libres: `fly machines list`, `fly machine destroy <id>`, y `fly volumes list` |
| El sitio dice "Sin servidor" | `VITE_API_BASE` no estaba al construir (§3.6), el CORS (§3.4) o el certificado (§3.2). `curl` a `https://api.eiaspice.space/api/v1/demeter/snapshot` |
| 429 en el stream | `WEB_SSE_MAX_POR_IP` (en `fly ssh console -C env`) o, con `FORWARDED_ALLOW_IPS` mal puesto, todos cuentan como una IP |
| 401 del reenviador o de `alimentar.py` | El token no coincide con el secreto de Fly |
| El relay se reinicia solo | `fly logs`: sin `WEB_INGESTA_TOKEN` sale con código 2; o sin memoria (`fly status`). El volumen conserva los datos |
| Hay que volver atrás | `fly releases` y `fly deploy --image <la imagen de la versión anterior>` |
