---
fecha: 2026-11-07
tipo: tarea
ids: [T-649, T-642, D-062]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-649-publicacion-automatica-web
---
# T-649: publicación automática de la web con Workers Builds, mapa versionado y relay en iad

## Contexto
`https://eiaspice.space` no está en Cloudflare Pages: la sirve un Worker de solo assets, `hermes-demeter`, que se ha subido a mano desde el panel. Se deja el repo listo para que Workers Builds lo publique solo desde `develop`, y se fija la región real del relay en Fly (ya no existen `bog` ni `mia`; la app y su volumen están en `iad`).

## Qué se hizo
- `gui/web/wrangler.jsonc` (nuevo): `name` `hermes-demeter`, `compatibility_date` `2026-11-07`, assets `./dist` con `html_handling: auto-trailing-slash` y `not_found_handling: none`, dominios propios `eiaspice.space` y `web.eiaspice.space` (`custom_domain: true`), `workers_dev: true`, `preview_urls: false`, sin `main` (solo assets) y sin bindings. Comentario de cabecera: lo publica Workers Builds desde `develop`; `VITE_API_BASE` es variable de build del panel.
- `wrangler` `^4` (resuelto a `^4.158.0`) como devDependency de `gui/web`, con `package-lock.json` actualizado (`npm install -D wrangler@^4`).
- Mapa: `!public/mapas/santa_fe.pmtiles` en `gui/web/.gitignore` (la regla general `public/mapas/*.pmtiles` se mantiene); archivo versionado (940 348 B, copiado de la carpeta principal); `gui/web/src/mapa/README.md` actualizado (ya se versiona porque pesa menos de 1 MB, D-062).
- `gui/relay/fly.toml`: `primary_region = "iad"` con comentario (Ashburn; Fly ya no tiene `bog` ni `mia`, verificado el 2026-11-07). Nada más cambió.
- `gui/web/README.md` y `gui/web/.env.example`: "Cloudflare Pages" pasa a "Worker de assets con Workers Builds"; `VITE_API_BASE` en Settings → Build → Variables del Worker.
- No se tocaron `backlog.md`, `decisiones.md`, `11_guia_despliegue.md` ni contratos.

## Evidencia
Node v24.19.0 en el equipo (el proyecto pide `>=22`; Workers Builds usará 22).
- `npm ci` y `npm install -D wrangler@^4`: 0 vulnerabilidades.
- `npm run build`: pasa (`tsc`, colores, `vite build` y la prueba de aislamiento). Salida: `Aislamiento OK: /demeter/ y /hermes/ no se referencian entre sí.`, `Sin datos de ejemplo en el dist/ de producción.`, fuentes de `/demeter/` 62 808 B y `/hermes/` 67 268 B (< 81 920). `dist/mapas/santa_fe.pmtiles` existe (918,3 KiB).
- `npm test` (vitest): 24 archivos pasan; 519 pruebas pasan, 1 omitida.
- `npx wrangler deploy --dry-run` (wrangler 4.158.0, sin autenticación): `Read 93 files from the assets directory .../dist`, `Total Upload: 0.31 KiB / gzip: 0.22 KiB`, `No bindings found.`, `--dry-run: exiting now.` La configuración se validó sin publicar.
- `git ls-files gui/web/public/mapas`: `gui/web/public/mapas/santa_fe.pmtiles`.
- `biome check` de los archivos de la tarea (`wrangler.jsonc`, `package.json`): limpio.
- `npm run lint` (Biome sobre todo `gui/web`): **falla con 5 errores y 15 avisos, todos previos a esta tarea** y en archivos que esta tarea no toca: `dev/prueba_carga/main.mjs`, `dev/prueba_carga/stub.mjs` y `dev/prueba_carga/README.md` (formato, imports, variables sin uso, asignación en expresión, `noApproximativeNumericConstant`), y avisos en `src/datos/estado_pagina.ts`, `src/mision/recuperacion_salud.css`, `src/simulacion/simulacion.css` y `src/tema/comun.css`. No se corrigieron para no mezclar alcance.
- Commits: `cecb5eb` (mapa), `5f38a01` (wrangler), `e120df9` (fly), `ee0afb5` (README y .env.example).

## Decisiones tomadas o propuestas
- Se cita D-062 (versionar el mapa) tal como indicó el documentador; la decisión la registra él.
- `package.json` fija `wrangler` como `^4.158.0` (lo que escribe npm con `^4`), no `^4` literal; ambos admiten cualquier 4.x y el lock deja la versión exacta.

## Problemas y cómo se resolvieron
- **Colisión del identificador T-649:** existe en el remoto la rama `origin/feature/T-649-mapa-topografico` (relieve y curvas de nivel del mapa), con otro contenido. T-649 tampoco aparece aún en `backlog.md` de `develop`. Se siguió el encargo (rama y bitácora con T-649) y se avisa para que el documentador renumere una de las dos.
- `npm` avisa que los scripts de instalación de `esbuild` y `workerd` (dependencias de wrangler) no están cubiertos por `allowScripts`; no impidió ni el build ni el dry-run.

## Pendiente / siguiente paso
Después del merge (lo hace un humano): DuqueJR aprueba la app de Cloudflare en GitHub; se conecta el Worker `hermes-demeter` en el panel con root `gui/web`, build `npm run build`, deploy `npx wrangler deploy`, rama de producción `develop`, sin builds de otras ramas, y variables de build `VITE_API_BASE=https://api.eiaspice.space/api` y `NODE_VERSION=22`. Tras el primer build, comprobar que los dos dominios propios siguen asignados y que `/mapas/santa_fe.pmtiles` responde. Aparte, los errores previos de Biome en `dev/prueba_carga/` merecen su propia tarea.

## Documentos afectados
`gui/web/wrangler.jsonc`, `gui/web/package.json`, `gui/web/package-lock.json`, `gui/web/.gitignore`, `gui/web/public/mapas/santa_fe.pmtiles`, `gui/web/src/mapa/README.md`, `gui/web/README.md`, `gui/web/.env.example`, `gui/relay/fly.toml`. Los actualiza el documentador en otro PR: `docs/08_gui/11_guia_despliegue.md` y `decisiones.md`.
