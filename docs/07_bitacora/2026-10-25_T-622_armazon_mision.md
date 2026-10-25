---
fecha: 2026-10-25
tipo: tarea
ids: [T-622, PEN-W01, PEN-W02, PEN-W03]
autor: agente desarrollador (Sonnet)
rama: feature/T-622-armazon-mision
---
# Armazón de la página de misión (T-622)

## Contexto
Área E, prioridad M. Dependía de T-611 y T-613 (integradas). Construye las páginas `/demeter/` y `/hermes/` con su tema, la barra de misión, la navegación y las secciones Inicio, Equipo y Pie. Las secciones de datos son solo huecos con título y ancla.

## Qué se hizo
- **Entradas** (`src/entradas/demeter.tsx` y `hermes.tsx`): cada una importa solo su tema y su contenido, más lo común (D-W01). "Los ojos de Deméter" (hueco) lo pasa solo la entrada de Deméter como `extra`.
- **`src/mision/`** (común, sin nombres de misión):
  - `Pagina.tsx`: el armazón. `mision.css`: layout en 3 puntos de quiebre (< 600, 600–1023, ≥ 1024) con solo tokens.
  - `BarraMision.tsx`: lee solo `meta`/`estado`/`estadoPagina`/`edad`/`eventos` de `api.ts`. Fase con su título público (02 §9), T+, indicador (EN VIVO / Señal débil / Sin señal / Sin servidor / Sin transmisión / Cargando) con color de estado, ícono y palabra; altitud (roja con pin y antigüedad en LKP); marca SIM y banner fijo de SIMULACIÓN.
  - `Navegacion.tsx`: Estado, Mapa, Datos y Equipo. Fija abajo en el celular; en el portátil es la fila bajo la barra.
  - `Inicio.tsx` (carrusel con scroll-snap, datos fijos, chips con tarjeta), `Equipo.tsx`, `Pie.tsx`, `Hueco.tsx`, `formato.ts` (coma decimal, T+, antigüedad) y `fases.ts`.
- **`src/contenido/`**: `tipos.ts` (la forma que T-623 llena), `demeter.ts` y `hermes.ts` con textos **provisionales**, fotos en `null` (placeholder con el parche, PEN-W01) e integrantes por apellido de los parches.
- **Ejemplo solo en desarrollo:** `src/mision/ejemplo_dev.ts`.
  - Las entradas lo cargan así: `if (import.meta.env.DEV) { import("../mision/ejemplo_dev")… }`. Vite sustituye `DEV` por `false` en el build y elimina el bloque y el chunk.
  - Con `?ejemplo` llama a `alimentar.snapshot(snapshotEjemplo, 0)` y `alimentar.conexion("conectado")`. Variantes: `?ejemplo=senal_debil|sin_senal|sin_transmision|simulacion|reconectando`. Para Hermes adapta `meta.mision`, `nodo`, `secundario` y `temp_pi_c`.
- **Que no esté en producción:** `buscarEjemplosEnDist` (en `scripts/aislamiento.mjs`) busca valores característicos de `ejemplos.ts` (`1793980800`, `6.5823456`, `-75.8231234`, `1793981012345`) en todo `.js/.css/.html` del `dist/`. Corre dentro de `npm run build` y tiene pruebas de Vitest (un dist falso falla; el real pasa). El e2e comprueba además que `?ejemplo` en producción no hace nada.
- Pruebas nuevas: `pruebas/mision.test.ts` (formato, T+, indicadores) y `e2e/mision.spec.ts`.

## Evidencia
- `npm run build`: en verde; `Aislamiento OK` y `Sin datos de ejemplo en el dist/ de producción`. Fuentes: `/demeter/` 62 808 B y `/hermes/` 67 268 B (< 81 920).
- `npm test`: 5 archivos y 84 pruebas en verde.
- `npm run e2e`: 47 pruebas en verde (las 2 páginas × 390×844, 768×1024 y 1440×900; anclas; los 5 estados de la barra; sin desborde horizontal; sin errores de consola; humo, portada y tokens previos).
- Capturas (a página completa) en `docs/07_bitacora/capturas/T-622/`: `{demeter,hermes}-ejemplo-{390x844,768x1024,1440x900}.png` y `barra-{senal_debil,sin_senal,sin_transmision,reconectando,simulacion}-390x844.png`.
- Biome: sin errores. Quedan 3 advertencias previas en `estado_pagina.ts` y `comun.css`, que no se tocaron.

## Decisiones tomadas o propuestas
- **No se cambió nada congelado.** No hizo falta nada nuevo en `api.ts`.
- **Propuesta (tema):** los tamaños de texto de 02 §5 (13, 20, 24, 40/56 px) no son tokens. Se agruparon como variables locales `--t-*` en `mision.css`. Conviene promoverlos a `tema/comun.css` en una tarea que toque tokens.
- **Propuesta (assets):** los PNG de los parches traen fondo blanco. Se recortan con `border-radius: 50%` en esta página. Sale con T-621 / PEN-W (parches transparentes).
- Excepciones a "sin tamaños sueltos": bordes de 1 px y el contorno de foco de 2 px, y los puntos de quiebre de las `@media` (CSS no admite variables ahí).

## Problemas y cómo se resolvieron
- Dentro de Vitest `NODE_ENV=test`, así que el `build()` programático dejaba `import.meta.env.DEV = true` y el ejemplo se colaba en la prueba. Se fuerza `NODE_ENV=production` solo durante ese build. Con `npm run build` nunca pasó.
- El nombre de la misión en la barra no es un `h1` a `h3`, y el tema solo da estilo a esos. Se le dio fuente de títulos con `font-synthesis: none`, para que Marcellus (solo 400) no se vea en negrita falsa.

## Pendiente / siguiente paso
- T-623: textos reales (PEN-W02 y PEN-W03) y fotos (PEN-W01).
- T-624 a T-626 llenan los huecos. Dejar los ids de ancla (`estado`, `telemetria`, `mapa`, `recuperacion`, `actitud`, `graficas`, `salud`, `ojos`, `equipo`).
- La barra no actualiza el reloj: `alimentar.reloj` es de T-631.
- Estado activo del enlace de la navegación (resaltar la sección en pantalla): no se hizo.

## Preguntas abiertas sobre 03
1. §3.0 pide 📍 y §4 usa íconos. Se usaron íconos Lucide, no emoji (D-W17). ¿Es lo que se quiere?
2. §3.0: "T+" sale del último evento con `t_mas_s` más el reloj del cohete. Antes del despegue es `T+ --:--`. ¿Se prefiere `T+ 00:00`?
3. §2.2 pone "Ojos de Deméter" en la columna derecha. Aquí va a lo ancho bajo Gráficas y Actitud, para no dejar un hueco en Hermes. ¿Está bien?
4. §3.0: la navegación del celular tiene 4 anclas (Estado, Mapa, Datos, Equipo). "Datos" apunta a Telemetría. ¿Se quiere otra?
5. §4, estado "Sin transmisión todavía": el botón "Ver la simulación del vuelo" no está en la barra y va con T-624. ¿Dónde se pone?

## Documentos afectados
Ninguno de los contratos. `06_plan_web.md`: T-622 lista para marcar como hecha al integrar el PR.

## Ajustes tras la revisión del PR #17
- **Estado sin recorte.** La barra pasa a 3 filas en celular y tableta: parche, nombre y T+; el estado (con SIM) solo en una fila; fase y altitud. Se quitó el `text-overflow: ellipsis` del indicador. Prueba e2e a 360 y 390 px, en las dos misiones y en 6 variantes (`scrollWidth <= clientWidth` del indicador y de sus `span`, y que no pase del borde derecho). `scroll-margin-top` sube 16 px por la barra más alta.
- **T+ con el reloj del cohete.** `T+ = t_ms del estado − t_ms del despegue + t_mas_s`. Sin evento `despegue`, usa el primer evento con `t_mas_s` (todos dan el mismo instante); sin ninguno o antes del despegue, `null` (`T+ --:--`). Pruebas unitarias con un despegue y un estado conocidos.
- **Hallazgo:** `contrato/ejemplos.ts` no trae el evento `despegue`, y su estado (`t_ms` 1234567) es anterior a su apogeo (`t_ms` 1245900), así que el cálculo correcto daba 0,2 s ("00:00"): era el ejemplo, no el reloj. En `ejemplo_dev.ts` (solo desarrollo) se agrega el despegue implícito (`t_ms` del apogeo − 11,54 s) y se adelanta el estado a T+ 42 s. El contrato no se tocó. Propuesta para D: que `ejemplos.ts` tenga un estado coherente con sus eventos.
- Evidencia: build, `npm test` (86) y `npm run e2e` (51) en verde; capturas de la barra regeneradas.
