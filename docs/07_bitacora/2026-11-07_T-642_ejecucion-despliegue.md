---
fecha: 2026-11-07
tipo: sesión
ids: [T-642, T-655, D-061, D-062, T-643, T-636]
autor: Claude principal (documentador), con Juan Pablo
rama: docs/T-642-relay-estado-otro-pc
---
# T-642: ejecución del despliegue (relay en Fly, dominio api y TLS) y plan para publicar la web desde Git

## Contexto
El PR #90 (T-642) dejó el `Dockerfile`, el `fly.toml` y la guía. Esta sesión ejecutó la parte que necesita las cuentas, con el MCP de Cloudflare y la CLI `fly` (el MCP de Fly estaba disponible, pero se usó la CLI). Cada acción remota se hizo con la confirmación de Juan Pablo.

A mitad de la sesión el plan cambió:
- el relay **no se opera desde este PC**: queda desplegado y **apagado**, y se prende desde otro PC para probar (guía §8);
- la web debe **publicarse sola desde el repo** (D-062, T-655).

## Qué se hizo (remoto)
- **Fly** (cuenta `alzatejuanpablo25@gmail.com`; solo existe la organización `personal`):
  - `fly apps create hermes-demeter-relay --org personal`. Se usó en vez de `fly launch --copy-config` porque este puede reescribir el `fly.toml` y borrarle los comentarios.
  - `fly volumes create relay_datos --region iad --size 1`: quedó uno solo (`vol_491j5d7xnxdyoy9r`).
  - El secreto `WEB_INGESTA_TOKEN` lo generó Juan Pablo en su terminal con `openssl rand -hex 32`. Se guardó en el Llavero de macOS (`hermes-relay-token`) y se subió con `fly secrets set --stage`. El valor nunca pasó por el chat.
  - **El deploy (v1) se ejecutó y el usuario lo canceló cuando ya había terminado.** Quedó publicado desde el árbol local, con `primary_region = "iad"` cambiado solo en ese momento.
    - Se verificó y se apagó: `fly machine stop`.
    - Hubo que liberar un *lease* huérfano del deploy cortado (`fly machine leases clear`).
- **Cloudflare** (zona `eiaspice.space`): CNAME `api` → `hermes-demeter-relay.fly.dev`, **solo DNS**, con un comentario.
- **Fly:** `fly certs add api.eiaspice.space`. Quedó en **Issued** en menos de un minuto, sin necesidad de registros A ni AAAA.

## Evidencia
- `fly platform regions`: no hay `bog` ni `mia`; en Latinoamérica solo `gru`. Se eligió `iad`.
- Con la máquina prendida (`https://hermes-demeter-relay.fly.dev`):
  - `salud` dio 200 con `contrato_version` `web-1` y las dos misiones en `seq_relay 0` y `mission_id null`, sin rutas de disco ni el token;
  - `/docs`, `/redoc` y `/openapi.json` dieron 404;
  - `http://` respondió 301;
  - el check estaba en 1/1;
  - `fly secrets list` mostraba `WEB_INGESTA_TOKEN` en `Deployed`.
- Apagada: `fly machine stop` respondió "successfully stopped" y `salud` ya no contesta (timeout), como se espera con `auto_start_machines = false`.
- `dig` sobre 1.1.1.1: `api` → CNAME → `66.241.125.33`. `fly certs check`: Issued por Let's Encrypt (RSA y ECDSA). `curl -v`: `CN=api.eiaspice.space`, `SSL certificate verify ok`, HTTP/2.

## Hallazgos
1. **Fly ya no tiene `bog` ni `mia`.** El plan B de la guía no servía. Va en `iad` (D-062), y el `fly.toml` se corrige en T-655.
2. **La web no está en Cloudflare Pages.** La sirve un **Worker de solo assets**, `hermes-demeter`, con los dominios `eiaspice.space` y `web.eiaspice.space`.
   - Configuración de assets: `auto-trailing-slash` y `not_found_handling: none`; `compatibility_date` `2026-11-07`; sin bindings.
   - Siempre se ha subido a mano desde el panel, nunca desde Git.
   - La guía §3.6 (variable de Pages) no aplicaba y se corrigió (§9).
3. **El mapa no está en Git.** `gui/web/public/mapas/santa_fe.pmtiles` (940 KB) está en `.gitignore`, así que un build desde Git saldría sin mapa. Decisión: versionarlo (D-062, T-655).
4. **El repo es de la cuenta `DuqueJR`**, y `apnauj` tiene permiso de escritura pero no es admin. Conectar Workers Builds exige que el dueño instale la app de Cloudflare en GitHub.
5. **`www.eiaspice.space` da 522**, porque su CNAME apunta a un Worker (`weathered-brook-8b18`) que ya no existe. No es de T-642: queda anotado.
6. **Colisión de ID:** la tarea de publicación se encargó como T-649, pero DuqueJR ya usaba T-649 para el mapa topográfico (PR #91), y esa fila no estaba en el backlog de `develop`. Se renumeró a **T-655** (PR #92; sus primeros commits conservan la etiqueta `[T-649]`).
   - Los dos PR se integraron a `develop` el mismo día (#92 y luego #91). La fila de T-649 (el mapa) la agregó el #91.
7. `main` está 449 commits detrás de `develop` (último del 25 de octubre). La rama de producción de la web será `develop`.

## Decisiones
- **D-062** (ajustes a D-061): Worker de assets con Workers Builds desde `develop`, PMTiles versionado, relay en `iad` y relay apagado entre pruebas.

## Estado al cierre
- **Hecho:** la app y el volumen en `iad`, el secreto, la imagen v1, la máquina apagada, el DNS de `api` y el TLS emitido.
- **Hecho también:** T-655 (PR #92: `wrangler.jsonc`, `wrangler` fijado, el mapa versionado y `primary_region = "iad"`) y T-649 (PR #91, el relieve), los dos en `develop`. Todavía no se publican: Workers Builds no está conectado.
- **Pendiente:**
  - que DuqueJR instale la app de Cloudflare;
  - conectar el Worker en el panel (guía §9) con `VITE_API_BASE`, y desde ahí `VITE_API_BASE` queda activa en cada build;
  - desde el otro PC: prender y hacer las pruebas de §3.4 a §3.10, T-643 (600 SSE, p95 < 1 s) y, si quedan datos de ensayo, la limpieza de §4 antes del vuelo;
  - el PR que apaga `SIMULACION_SIEMPRE_VISIBLE` (T-636), solo con el relay verificado en vivo.
- **Recordatorios:** el día del vuelo no se despliega, no se cambian secretos y no se hacen merges que toquen `gui/web/` (ahora publican solos). Después del evento se rota el token.
