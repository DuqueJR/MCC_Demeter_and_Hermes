---
fecha: 2026-11-06
tipo: tarea
ids: [T-638, T-632, T-642]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-638-pmtiles-sin-range
---
# T-638: el mapa base (PMTiles) carga aunque el hosting ignore `Range`

## Contexto
En producción (Cloudflare Pages, <https://eiaspice.space>) el mapa caía a la cuadrícula de respaldo aunque `mapas/santa_fe.pmtiles` está desplegado y es válido. En local (`vite preview`) funcionaba porque ese servidor sí atiende `Range`.

## Causa
`detectarBase` hacía `new PMTiles(url)`, que usa `FetchSource` y pide cada trozo con `Range`. Cloudflare Pages **ignora `Range`** y responde `200` con el archivo completo; la librería exige un 206 o un 200 cuyo `content-length` no exceda lo pedido y lanza "Server returned no content-length header or content-length exceeding request". `detectarBase` capturaba el error y devolvía `null` sin dejar rastro, así que el mapa usaba la cuadrícula.

Evidencia (2026-11-06, 18:54 GMT):

```
$ curl -s -r 0-126 -D - -o /dev/null https://eiaspice.space/mapas/santa_fe.pmtiles
HTTP/2 200
content-type: application/octet-stream
content-length: 940348
cf-cache-status: HIT
etag: "3e1c933952f0bea065de5fed0ff3b830"
server: cloudflare
(sin accept-ranges ni content-range)
$ curl -s -r 0-6 https://eiaspice.space/mapas/santa_fe.pmtiles | head -c 7
PMTiles
```

## Qué se hizo
- `gui/web/src/mapa/fuente_pmtiles.ts` (nuevo): `FuenteArchivoCompleto`, una `Source` de `pmtiles` que baja el archivo **completo una sola vez** (un `fetch` simple sin `Range`, la promesa se comparte entre todas las lecturas) y responde cada `getBytes(offset, length)` cortando el búfer en memoria.
  - Descarta con `PmtilesNoDisponible` (sin reintentos y sin ruido): 4xx, más de `MAPA_PMTILES_MAX_BYTES` (30 MB) o que no empiece con "PMTiles" (un `index.html` con 200).
  - Reintenta fallos de red, 5xx y tiempos agotados (`MAPA_PMTILES_REINTENTOS`, `MAPA_PMTILES_ESPERA_MS` duplicada, `MAPA_PMTILES_TIMEOUT_MS`). Una descarga fallida no se guarda.
  - Abortar una lectura (`signal`) no cancela la descarga compartida.
- `base.ts`: `detectarBase(protocolo, opciones?)` usa `new PMTiles(new FuenteArchivoCompleto(url))`; sigue devolviendo `null` si no existe o no es PMTiles, y ahora deja un `console.warn` si el fallo fue de red (antes la causa se perdía). `getKey()` es la URL, así que `Protocol` encuentra el archivo por `pmtiles://<url>`.
- `constantes.ts`: las cuatro constantes nuevas. `VITE_MAPA_PMTILES_URL` sigue funcionando (el servidor ya no necesita `Range`; el CORS de otro origen sí).
- `controlador.tsx`: en cada `idle` publica `data-mapa-capas-base` (capas `base-*` del estilo) y `data-mapa-base-dibujada` (elementos de esas capas ya dibujados), para que las pruebas comprueben que las teselas se leyeron y decodificaron.
- `playwright.config.ts`: `E2E_PUERTO` (por defecto 4173) para no reutilizar el `vite preview` de otra carpeta, que serviría otro `dist/`.
- Pruebas: `pruebas/mapa_pmtiles.test.ts` y `pruebas/ayuda_pmtiles.ts` (PMTiles sintético y servidor simulado sin `Range`); `e2e/mapa_sin_range.spec.ts` y `e2e/servidor_sin_range.ts`.
- Documentación: README de `src/mapa/` (tabla de archivos, "Otra ubicación", sección nueva y pruebas) y fila T-638 en el backlog (a pedido del usuario).
- No se tocaron contratos ni el estilo del mapa. La carga sigue diferida: `fuente_pmtiles.ts` va en el chunk `Mapa-*.js`, no en el bundle inicial.

## Evidencia
- `vitest run` completo: 23 archivos, 508 pruebas pasan (1 omitida, ya existente). `mapa_pmtiles.test.ts`: 17 pruebas, incluida la del PMTiles real de la zona (copiado de la carpeta principal a `public/mapas/`, que no se versiona).
  - La fuente por defecto de `pmtiles` falla ante el 200 completo con `content-length` (la causa, reproducida); `FuenteArchivoCompleto` carga la cabecera y las teselas.
  - 30 lecturas simultáneas más otra ráfaga: 1 sola llamada a `fetch`, y sin cabecera `Range`.
  - 404 e `index.html` dan `null` sin `console.warn`; red caída da `null` con un aviso.
- `tsc --noEmit`, `biome check` sobre `src pruebas e2e` y `npm run build` (incluye `scripts/colores.mjs` y `scripts/aislamiento.mjs`): sin errores nuevos. `biome check src` ya daba 11 avisos antiguos (CSS y un `useOptionalChain`), ninguno en archivos de esta tarea.
- Playwright con `E2E_PUERTO=4181` (el 4173 lo ocupa el `vite preview` de la carpeta principal): `mapa_sin_range.spec.ts` 7/7. Incluye el `dist/` servido por un servidor que ignora `Range` (200 completo, sin `accept-ranges`): capas `base-*` (7) con elementos dibujados, atribución de OpenStreetMap, exactamente 1 petición al `.pmtiles` y sin `Range`; el archivo no se pide hasta llegar a la sección; con el PMTiles ausente (404 o `index.html` con 200) queda la cuadrícula sin errores de consola; y `vite preview` (con `Range`) también muestra el mapa base.
- **La prueba e2e reproduce el bug:** con `base.ts` de `develop` (`new PMTiles(url)`) y un `dist/` reconstruido, las 3 pruebas del servidor sin `Range` fallan (`data-mapa-base` queda en `sin-base`) y las otras 4 pasan; con el arreglo, 7/7.
- Toda la suite del mapa (`mapa.spec.ts`, `mapa_limites.spec.ts`, `mapa_sin_range.spec.ts`, 42 pruebas, 5 hilos): 41 pasan; `mapa_limites.spec.ts` "1440x900: límites y zoom máximo…" agotó los 30 s en un `mouse.wheel` (la prueba más pesada, con el equipo cargado). Sola pasa (4/4) y 3 repeticiones con 1 hilo pasan (12/12). Se toma como lentitud por carga, sin relación con el cambio, pero queda anotado.

## Decisiones tomadas o propuestas
- No se distingue si el servidor atiende `Range`: la descarga completa es la única estrategia (pedido de la tarea). Costo: unos 918 KB de una vez al abrir el mapa; el tope de 30 MB (`MAPA_PMTILES_MAX_BYTES`) es la meta que ya fijaba el README. Si el archivo creciera de eso, habría que volver a una fuente por rangos con un hosting que los atienda (T-642).
- Propuesta (no es contrato): `E2E_PUERTO` y `data-mapa-capas-base`/`data-mapa-base-dibujada` son de pruebas; ninguna toca `web-1`.

## Problemas y cómo se resolvieron
- El PMTiles sintético de las pruebas mide menos de 16384 bytes, así que la fuente por defecto de la librería **no** fallaba con él (el `content-length` no excede lo pedido). Se agregó una tesela de 20 KB para que se comporte como el archivo real (918 KB).
- El worktree no trae `public/mapas/santa_fe.pmtiles` (no se versiona): se copió de la carpeta principal solo para correr las pruebas; no se commitea.

## Pendiente / siguiente paso
- Verificar en producción tras el despliegue de Cloudflare Pages: que `https://eiaspice.space/demeter/` y `/hermes/` muestren el mapa base y que la pestaña de red tenga **una** petición `200` a `santa_fe.pmtiles`. No se pudo hacer desde aquí (no hay despliegue de esta rama).
- Si se mueve el PMTiles a otro origen (`VITE_MAPA_PMTILES_URL`, T-642), el servidor debe devolver CORS (`access-control-allow-origin`); `Range` ya no hace falta.

## Documentos afectados
- `gui/web/src/mapa/README.md`, `docs/05_plan/backlog.md` (fila T-638).
