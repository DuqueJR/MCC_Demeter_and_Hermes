---
fecha: 2026-11-08
tipo: tarea
ids: [T-674, T-624, T-625, T-671, T-673]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-674-cabecera-estado-objetivos-mapa
---
# T-674: el estado y los objetivos arriba, la telemetría en el mapa y el Resumen del vuelo

## Contexto
Pedido directo del usuario (autorizado por el Claude principal): que el estado de la misión y los objetivos se muestren en la parte de arriba, en el espacio muerto que hay junto a la información de la misión; que el mapa ocupe ese lugar y quede más grande, con la telemetría dentro; y que al terminar el vuelo se vea todo en un resumen bajo Recuperación. Aplica a `/demeter/` y `/hermes/` por igual (la página es común, D-W01). La tarea no estaba en el backlog: se agregó su fila (T-674, después de T-673). Sale de `origin/develop` en `f33e196` (con T-673 integrada).

## Qué se hizo
- **Inicio (`Inicio.tsx`, `EstadoInicio.tsx`):** en el hueco bajo el motor (columna de texto de Inicio) va el estado: la fase de ahora con su subtítulo, el T+ y una **tira de objetivos** (ícono + nombre + marca de check; apagado = pendiente, atenuado y con círculo; logrado = borde de acento y check). El estado de cada objetivo también va en un texto para lectores de pantalla (`logrado` / `pendiente`), así que nunca es solo color. La tira se envuelve en filas (no desborda en el celular). `Inicio` recibe el estado por una prop (`estado`) y no sabe nada de datos en vivo. Se conservó el ancla `#estado` (la usan `Navegacion` y la barra de misión), el aviso "La transmisión en vivo empieza el día del lanzamiento" y el botón de simulación (T-635/T-637), con sus clases (`.estado-aviso`, `.sim-invitacion`).
- **Se quitaron del flujo** la sección grande "Estado de la misión" y la sección "Telemetría". `EstadoMision.tsx` se renombró a `ObjetivosFases.tsx` (git lo sigue como renombre) y conserva solo lo reutilizable: `LineaFases`, `ListaObjetivos`, `ICONO_OBJETIVO` y `textoPaso`. No se duplicó ningún cálculo: siguen siendo `objetivos.ts`, `linea_fases.ts`, `fases.ts` y `formato.ts`.
- **Telemetría dentro del mapa (`Telemetria.tsx`, `SeccionMapa.tsx`, `seccion.css`, `mapa.css`):** `Telemetria.tsx` exporta ahora `DatosTelemetria` (la rejilla y el aviso de dato viejo, con las mismas reglas de `vista_telemetria.ts`) y `TelemetriaMapa`, un panel superpuesto dentro de `.mapa-marco` con el ancla `#telemetria`. Vive en el JS inicial (junto a `CoordenadasMapa`), no en el módulo diferido: si el mapa falla o no carga, la telemetría se ve igual (hay prueba). Franja inferior semitransparente (el fondo va en un `::before` con `opacity`, porque `scripts/colores.mjs` prohíbe `rgba()` y `color-mix()` fuera del tema), sin capturar gestos.
  - Portátil: una sola fila pegada al borde, de 60 px de alto.
  - Celular: dos filas de tres columnas (~100 px). El T+ del apogeo no cabe en la columna y se oculta en el panel; sigue en el Resumen.
  - Para que no tape nada, `--alto-telemetria` (en `seccion.css`) sube la escala y la atribución de MapLibre (que se despliega entera al cargar y no puede quedar tapada) y el aviso del mapa (`mapa.css`). Las coordenadas (arriba a la izquierda), el zoom y los botones (derecha) quedan libres.
- **Mapa más grande:**
  - Portátil: el mapa ocupa de la columna 1 a la 2 (antes la 2), debajo de Inicio; Recuperación y Salud siguen en la columna 3. Alto mínimo del marco: el mayor entre 576 px y la ventana menos la cabecera.
  - Celular y tableta: marco de 70 svh (antes 60).
  - `mision.css`: se quitaron las reglas de grilla de `#estado` y `#telemetria`.
- **Resumen del vuelo (`Resumen.tsx`):** solo con `aterrizado`, `id="resumen"`, justo bajo Recuperación en el DOM (que ya sube al inicio del `<main>`). Tiene tres bloques: la línea de fases con sus T+, la lista de objetivos con hora y dato (la `ListaObjetivos` de siempre) y la telemetría final (la rejilla de siempre, con `DatosTelemetria`). Grilla del portátil: `--fila-extra` pasa de 1 a 2 al aterrizar; Salud toma `calc(2 + var(--fila-extra))`.
- **Navegación (`Navegacion.tsx`):** "Resumen" aparece solo al aterrizar, entre Mapa y Equipo. Se quitó "Datos" (ver decisiones).
- **Pruebas:** ver Evidencia. Se ajustaron las specs que asumían las secciones viejas y se agregó `e2e/estado_en_inicio.spec.ts`, que además genera las capturas del PR.
- **Documentación:** fila de T-674 en `backlog.md`, y nota en `src/mapa/README.md` sobre el panel.

## Evidencia
- `tsc --noEmit`: sin errores. `node scripts/colores.mjs`: OK (sin colores literales fuera del tema).
- `biome check src e2e`: 0 errores (17 avisos, todos de `noDescendingSpecificity` y similares que ya existían; antes de mi cambio `biome check .` ya traía 7 errores en `dev/prueba_carga/*.mjs` y `pruebas/contrato.test.ts`, que no toqué).
- `npm run build` (tsc + colores + vite + aislamiento): OK. El aislamiento entre `/demeter/` y `/hermes/` sigue verde.
- Pruebas unitarias (`vitest run`): 27 archivos, 643 pasaron y 1 se omitió. Corrí toda la suite unitaria porque tarda 12 s; las que cubren lo tocado son `estado_mision.test.ts` (objetivos, fases y telemetría: la lógica no cambió) y `aterrizado.test.ts`.
- Playwright (Chromium, `--workers=3`), solo las specs de la página de misión: `mision.spec.ts`, `estado_telemetria.spec.ts` (sin el bloque de capturas de T-624), `recuperacion_salud.spec.ts` y la nueva `estado_en_inicio.spec.ts`: **74 pasaron, 0 fallaron** (2,2 min). Todas vigilan los errores de consola de `/demeter/` y `/hermes/`.
- **No corrí:** `mapa*.spec.ts`, `graficas*.spec.ts`, `actitud`, `salud`, `seccion_pi`, `simulacion`, `en_vivo` ni `relay` (estas dos últimas necesitan el repetidor en el puerto 8787). Las dos últimas las ajusté solo en sus selectores (`#estado [data-objetivo]`, `#resumen .paso`) sin ejecutarlas; `simulacion.spec.ts` usa `.estado-aviso`, que se conservó.
- La spec de `mision.spec.ts` y las de T-625 reescriben capturas históricas en `docs/07_bitacora/capturas/`; las restauré con `git checkout` para que el PR no las toque.
- Capturas del PR en `docs/08_gui/capturas/T-674/`: portátil en vuelo (arriba y mapa), mapa en pantalla completa, celular en vuelo (estado y mapa), y aterrizado en portátil y celular (Recuperación + Resumen), de Deméter y de Hermes (14 archivos).
- Lo que comprueba la spec nueva: el estado está dentro de Inicio con su ancla; las secciones viejas no están en el flujo; el mapa queda bajo Inicio, más ancho que el 60 % del panel y de más de 560 px de alto; la telemetría queda dentro del marco y no se superpone con zoom, botones, coordenadas, escala ni atribución; en pantalla completa se ve; en el celular la tira no desborda y la franja es menor que la mitad del mapa; aterrizado, el orden es Recuperación, Resumen, Inicio, con las 3 partes y el enlace "Resumen" que navega; y con el módulo del mapa abortado la telemetría sigue visible.

## Decisiones tomadas o propuestas
- **Se quitó "Datos" de la navegación.** Su ancla `#telemetria` ahora está en la parte baja del marco del mapa: ir a ella dejaba el panel pegado bajo la cabecera y el mapa fuera de vista. "Mapa" ya lleva a donde está la telemetría. El ancla `#telemetria` se conserva (un enlace directo sigue funcionando). Es fácil de revertir si se prefiere el enlace.
- **"Resumen" solo aparece al aterrizar** (no siempre): antes de aterrizar la sección no existe, y un enlace que no lleva a ninguna parte sería peor.
- **Telemetría en el mapa, siempre** (también aterrizado, donde se repite en el Resumen como telemetría final): se dejó para no tener un mapa sin datos a ratos y por simplicidad. Los `data-celda` se repiten en el DOM al aterrizar; las pruebas se acotan con `#telemetria` y `#resumen`.
- **Panel del mapa en el celular:** franja de dos filas sin plegado (los datos de vuelo no deben esconderse). El T+ del apogeo se oculta ahí (no cabe; sigue en el Resumen). En el celular tapa hasta ~100 px de la parte baja del mapa, algo más que el relleno de 72 px con que se encuadra la trayectoria; el fondo es semitransparente. No se tocó el encuadre del mapa (`MAPA_RELLENO_PX`) porque la tarea dice no cambiar la lógica del mapa más allá del tamaño y la superposición.
- **El texto del objetivo en el banner no lleva hora ni dato** (cabe mejor en el celular); la hora y el dato del apogeo están en el Resumen y en la telemetría.
- **Propuestas sobre contratos:** ninguna. No se tocaron `contrato/`, `esquema.json` ni datos.
- **Para el documentador:** `docs/08_gui/03_experiencia_y_pantallas.md` (§3.2, §3.3, §2.1 y §4) describe las secciones "Estado de la misión" y "Telemetría" y la navegación con "Datos"; conviene actualizarlo con una decisión (D-W…) que registre este cambio. No lo edité.

## Problemas y cómo se resolvieron
- La atribución de MapLibre se desplegaba entera bajo la franja de telemetría (la prueba de superposición lo detectó en el portátil, y en el celular se veía mezclada con el panel). Se resolvió subiendo la escala y la atribución sobre el panel con una variable CSS compartida.
- El mapa tarda en dibujar sin GPU: las pruebas del mapa con relieve en 3D necesitaron un margen de 150 s por prueba (como las de T-656).
- Mi primera versión de la franja del celular medía ~150 px (etiquetas largas que se partían en 3 líneas); se compactó a ~100 px con tipos más chicos y ocultando el T+ del apogeo.
- Los archivos que edité con un script de Python en Windows quedaron con CRLF; los convertí a LF (el repo usa `eol=lf`).

## Pendiente / siguiente paso
- Revisión visual del usuario con las capturas del PR (sobre todo el celular, y el mapa en un celular real).
- Actualizar `docs/08_gui/03_experiencia_y_pantallas.md` y registrar la decisión (documentador).
- Probar con el repetidor en vivo (`en_vivo.spec.ts` y `relay.spec.ts`), ya con los selectores ajustados.

## Documentos afectados
- `docs/05_plan/backlog.md` (fila T-674).
- `gui/web/src/mapa/README.md`.
- Por actualizar (documentador): `docs/08_gui/03_experiencia_y_pantallas.md`.
