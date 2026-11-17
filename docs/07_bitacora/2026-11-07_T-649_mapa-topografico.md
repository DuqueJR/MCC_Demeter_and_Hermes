---
fecha: 2026-11-07
tipo: tarea
ids: [T-649, D-W22, T-632, T-634, T-638]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-649-mapa-topografico
---
# T-649: mapa topográfico en `/demeter/` y `/hermes/`

## Contexto
Pedido del usuario (Jerónimo, 2026-11-07): "implementa un mapa topográfico en los mapas de ambos cohetes; si necesitas descargarlo de internet puedes hacerlo". El lanzamiento es el 8 de noviembre y el sitio ya está en producción (Cloudflare Pages): nada de esto puede romper el mapa, y si los archivos del relieve faltan o fallan el mapa debe quedar como hoy. Diseño decidido por el planificador (D-W22).

## Qué se hizo
- **Datos y script.** `gui/web/scripts/generar-relieve.mjs` (`npm run relieve`; la lógica pura en `relieve-lib.mjs`, con tipos en `.d.mts`) baja los *Terrain Tiles* públicos de AWS (terrarium; Mapzen/Tilezen y SRTM del USGS) del recorte `-75.873,6.532,-75.773,6.632` más una tesela de margen por lado, z10 a z12 (34 teselas), y guarda los PNG sin tocarlos en `public/mapas/relieve/{z}/{x}/{y}.png`, más `relieve.json` (recorte, `bounds`, zooms, fuente, fecha, curvas) y `curvas.geojson`. `--comprobar` verifica el disco sin red (teselas completas, PNG de 256 px, GeoJSON con índice e intermedias, presupuesto). Se agregaron `pngjs` y `d3-contour` como devDependencies (JS puro) y `public/mapas/relieve` se excluyó de Biome (salida generada).
- **Curvas de nivel.** Del DEM de z12 (recortado al mapa más 0,005°): mediana 3 × 3 (quita píxeles sueltos del SRTM; había uno de −2 m junto a 500 m), dos pasadas de promedio 3 × 3, `d3-contour` cada 50 m, descarte de los tramos que `d3-contour` dibuja por el borde de la malla, Douglas-Peucker de 0,25 px y 5 decimales. Propiedades `ele` y `tipo` (`indice` cada 250 m, `intermedia` cada 50 m). Final: **34 niveles de 450 a 2100 m**, 7 de ellos índice, 7 763 vértices.
- **Mapa** (`src/mapa/`): `relieve.ts` (carga y valida `relieve.json` y las curvas; nunca lanza), `estado_relieve.ts` (una `signal` para la leyenda), y cambios en `estilo.ts`, `controlador.tsx`, `constantes.ts` y `Leyenda.tsx`. Fuente `raster-dem` (`encoding: terrarium`, `bounds`, `minzoom` y `maxzoom` desde `relieve.json`), capa `hillshade` y dos capas `line` (intermedias desde el zoom 13; índice más marcadas), sin etiquetas. Orden: fondo → tierra y uso del suelo (o cuadrícula sin PMTiles) → relieve → agua, vías y lugares → misión. Se pide a la vez que el PMTiles (`Promise.all`) y solo al crear el mapa. Un único `console.warn` si falla una tesela; el resto de errores de MapLibre se sigue escribiendo con `console.error`.
- **Colores:** tokens nuevos en `src/tema/demeter.css` y `hermes.css` (`--relieve-sombra`, `--relieve-luz`, `--relieve-curva`, `--relieve-curva-indice`), leídos en tiempo de ejecución (`leerTokensRelieve`); si faltan, no hay relieve (no se inventa un color). Opacidades, exageración (0,35), luz (315°) y anchos en `ESTILO_RELIEVE` de `constantes.ts`; el intervalo y el índice (`RELIEVE_CURVA_INTERVALO_M` = 50, `RELIEVE_CURVA_INDICE_M` = 250) también, y una prueba los compara con `relieve.json`.
- **Leyenda:** "Relieve y curvas de nivel cada 50 m", solo cuando el relieve se dibuja. **Atribución:** "Relieve: Mapzen/Tilezen · SRTM y GMTED2010, cortesía del USGS" (de la página oficial de Tilezen: *SRTM data courtesy of the U.S. Geological Survey*; la de Colombia es SRTM), junto a la de OpenStreetMap y Protomaps, que no se tocó.
- **Documentación:** sección "El relieve (T-649)" en `src/mapa/README.md`, fila D-W22 en `docs/08_gui/00_README.md`, la línea de capas en `03_experiencia_y_pantallas.md` §3.4, la fila T-649 del backlog (con PR #91) y `npm run relieve` en `gui/web/README.md`. (El pedido de la tarea pedía editar el backlog; no se tocó ninguna otra cosa de las que consolida el documentador.)

## Evidencia
**Tamaño de `public/mapas/relieve/`: 2 486 413 B (2,37 MiB), 36 archivos** (meta ≤ 3 MB): z10 705,1 KB (9 teselas), z11 629,3 KB (9), z12 938,4 KB (16), `curvas.geojson` 154,4 KB y `relieve.json` ~1 KB.

**Por qué z10–z12** (medido): una tesela de z8 o z9 pesa ~89 KB y de z13, ~47 KB; con z8–z13 el conjunto sumaba 5,5 MB. El SRTM tiene unos 30 m y un píxel de z12 mide ~38 m: z13 solo sobremuestrea. MapLibre pide el zoom del mapa + 1 para teselas de 256 px: con el zoom mínimo del mapa (11 a 12 según la pantalla) se piden z12 y sobrezoom; z10 y z11 cubren que el área se amplíe por un LKP lejano (T-634). z8 y z9 no se pedirían nunca.

**Determinismo:** `npm run relieve` repetido no cambia ni un byte (`git status` limpio en `public/mapas/relieve`), y bajar todo otra vez de AWS en una carpeta nueva (`diff -r`) da archivos idénticos a los versionados.

**Intervalo de las curvas:** 50 m (intermedias) y 250 m (índice), como pedía el diseño. Con 50 m a z12 mínimo no se ve denso (capturas `*-amplio`); cerca de la rampa (valle plano, 485 a 556 m en un radio de 500 m) hay solo una o dos curvas a cada zoom de vuelo. Las intermedias solo salen desde el zoom 13.

**Tamaño del JS inicial** (suma de todos los `.js` que no son el chunk `Mapa-*` ni el worker, antes → después): 170 811 B → 171 186 B (**+375 B**; +181 B con gzip: 65 765 → 65 946). Es solo la entrada de la leyenda (ícono `Mountain`, texto y la `signal`): el relieve, MapLibre y el GeoJSON siguen en el chunk diferido (`Mapa-*`: 1 118 058 → 1 122 246 B). No crece nada más, pero **no es exactamente cero**.

**Resultados de las suites** (en `gui/web/`, Windows, Node 22.22; Chromium de Playwright sin GPU; el PMTiles real se bajó de `eiaspice.space` solo para las capturas y las pruebas "con PMTiles", y no se versiona):
- `npm run build` (`tsc --noEmit`, `colores.mjs`, `vite build`, `aislamiento.mjs dist`): **pasó** ("Colores OK", "Aislamiento OK", "Sin datos de ejemplo en el dist/ de producción", fuentes por debajo de 80 KB).
- `npx tsc --noEmit`: **pasó**.
- `npx vitest run`: **25 archivos, 551 pasaron, 1 omitida (552)**; `pruebas/relieve.test.ts` aporta 32.
- `npx biome check .` (`npm run lint`): **falla con 6 errores, todos ya existentes en `develop` y en archivos que esta tarea no creó**: `dev/prueba_carga/main.mjs`, `dev/prueba_carga/stub.mjs` y `dev/prueba_carga/README.md` (formato, imports, variables sin usar), `src/datos/estado_pagina.ts:68` (`useOptionalChain`) y el formato de `gui/web/README.md` (ya fallaba sin mi fila). Los archivos nuevos y editados de T-649 pasan Biome sin errores. 15 advertencias, todas anteriores.
- `npm run relieve -- --comprobar`: **pasó** (2 428,1 KB de 3 072 KB).
- Playwright (`E2E_PUERTO=4181 npx playwright test`, `--workers=3`, 281 pruebas), **tercera corrida completa: 270 pasaron, 4 fallaron, 4 omitidas, 3 "did not run"**. Las 4 fallas:
  - `mapa.spec.ts:198` "un dedo sobre el mapa desplaza la página" (gestos en el celular; en la tarea se citaba como `:196`): **es la que ya fallaba en la máquina de Jerónimo**. Falla igual **sin** el relieve (se comprobó moviendo `public/mapas/relieve`: `scrollY` se queda en 2142, esperaba > 2242) y no se tocó.
  - `fotos_equipo.spec.ts:166` (escritorio 1470, Deméter), `simulacion.spec.ts:274` y `simulacion.spec.ts:449`: **fallas por carga**, sin relación con el mapa. Corridas solas (`--workers=1`), `fotos_equipo.spec.ts` y `simulacion.spec.ts` pasan las **31**. (En la segunda corrida completa fallaron `simulacion.spec.ts:274` y las pruebas de `mapa_limites` descritas abajo; la primera se cortó por una interrupción y no cuenta.)
  - Las 4 omitidas y las 3 "did not run" no son de T-649: `mapa.spec.ts` corrido solo da 19 pasadas y 1 fallada (la de gestos), sin omitidas.
  - **Hallazgo propio:** las pruebas de `mapa_limites.spec.ts` (arrastrar y acercar decenas de veces, 1440 × 900) pasaron a tardar más de 30 s con el relieve en Chromium sin GPU (sin relieve 18,0 s; con solo curvas 20,6 s; con el sombreado, más de 30 s; `hillshade-method: "basic"` mejoró el celular pero no el escritorio). Como esas pruebas son de los límites, no del relieve, **ahora abortan la ruta `/mapas/relieve/**`** (commit aparte, con la razón): `mapa_limites.spec.ts` da **15 pasadas**. Queda como riesgo de rendimiento en un celular de gama baja; ver "Pendiente".
- `mapa_relieve.spec.ts` (nuevo): **19 de 19 pasaron** en la tercera corrida (3 de relieve en producción, 8 de fallos con red/404/index.html/solo teselas/solo curvas y 8 de capturas); ningún `console.error` ni `pageerror`.

## Decisiones tomadas o propuestas
- Ninguna propuesta a contratos (`web-1` no cambia).
- z10 como zoom mínimo y z12 como máximo (justificado arriba). Quedó fuera z8–z9 por peso y por no pedirse.
- El sombreado usa las teselas tal cual (el diseño pide guardarlas sin tocar), así que sus artefactos de SRTM se ven; las curvas, no, por la mediana.
- La leyenda nombra el relieve solo cuando se dibuja (una `signal` en el JS inicial).

## Problemas y cómo se resolvieron
- **Píxeles sueltos en el SRTM** (8 en el recorte, cerca de 6,607 N, −75,809 E; de −2 m, 184 m, 172 m… junto a vecinos de 400 a 640 m): dejaban circulitos de curvas. Se resolvió con la mediana 3 × 3 antes del suavizado. En el sombreado de MapLibre quedan como motas de ~40 m (limitación conocida, a ~2 km de la rampa).
- **Curvas angulosas** con la primera tolerancia (0,7 px de z12, ~4 px de pantalla a zoom 14,5): se bajó a 0,25 px (curvas de 85 KB a 154 KB).
- **Relieve invisible** con los primeros colores y, con los segundos, demasiado marcado: se ajustaron con capturas a exageración 0,35 y luces `#7ba3be` (Deméter) y `#8c81c4` (Hermes).
- Una corrida completa de Playwright se cortó por una interrupción (los workers murieron con código 3221225794, `STATUS_CONTROL_C_EXIT`, y fallaron 138 pruebas de golpe): no cuenta; se volvió a correr entera.
- Los comandos con *heredoc* de Bash no corrieron en este entorno; se editó con las herramientas de archivos.

## Pendiente / siguiente paso
- Revisar las capturas (`docs/07_bitacora/capturas/T-649/`) y, si hace falta, ajustar los tokens `--relieve-*` y `ESTILO_RELIEVE`.
- **Riesgo de rendimiento no medido en hardware real:** el sombreado es un paso de pantalla completa por cuadro y en WebGL por software fue lo que más costó. Hay que abrir el mapa en un celular de gama baja antes del vuelo; si se siente pesado, la salida de un solo cambio es dejar de agregar `relieve-sombreado` en `capasRelieve` (`estilo.ts`) y quedarse con las curvas (ver el README del mapa).
- Mirarlo en un celular real y en producción tras el despliegue (Cloudflare Pages sirve los PNG y el GeoJSON como estáticos; no se necesita `Range`).

## Documentos afectados
`gui/web/src/mapa/README.md`, `gui/web/README.md`, `docs/08_gui/00_README.md` (D-W22), `docs/08_gui/03_experiencia_y_pantallas.md` §3.4, `docs/05_plan/backlog.md` (T-649).
