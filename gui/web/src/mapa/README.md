# Mapa de la misión (T-632)

La sección "Mapa" de `/demeter/` y `/hermes/` ([03 §3.4](../../../../docs/08_gui/03_experiencia_y_pantallas.md), [04 §2](../../../../docs/08_gui/04_arquitectura_web.md)). MapLibre GL JS dibuja la trayectoria, el cohete, la rampa, la estación, la elipse de impacto y el LKP sobre el mapa base de la zona (un PMTiles propio, opcional).

## Cómo está armado

| Archivo                      | Qué hace                                                                                                                                                                                                                | Va en                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `SeccionMapa.tsx`            | El cascarón de la sección: título, marco, leyenda y pantalla completa. Pide el mapa con `import("./Mapa")` cuando la sección está a `MAPA_MARGEN_CARGA_PX` de entrar en pantalla (`IntersectionObserver`)               | JS inicial (pequeño) |
| `Leyenda.tsx`, `seccion.css` | La leyenda bajo el mapa y el alto de la sección (60 % de la pantalla en el celular)                                                                                                                                     | JS y CSS iniciales   |
| `Mapa.tsx`                   | El lienzo y los tres controles (centrar en el cohete, ver todo, pantalla completa)                                                                                                                                      | **Chunk diferido**   |
| `controlador.tsx`            | Crea MapLibre, lo conecta a las signals de `datos/api.ts` y actualiza capas y marcadores                                                                                                                                | Chunk diferido       |
| `marcadores.tsx`, `mapa.css` | Marcadores del DOM (rampa, estación, impacto, chip, cohete, LKP)                                                                                                                                                        | Chunk diferido       |
| `geo.ts`                     | Lógica pura: GeoJSON de cada capa, decisión de LKP, elipse, rumbo, cuadrícula. **Sin DOM ni MapLibre**                                                                                                                  | Chunk diferido       |
| `area.ts`                    | Lógica pura del **área navegable** (T-634): límites y zoom máximo desde la cabecera del PMTiles, área por defecto, zoom mínimo, y la ampliación para que lo dibujado nunca quede fuera (GS-03). **Sin DOM ni MapLibre** | Chunk diferido       |
| `estilo.ts`                  | Los tokens del tema y el estilo de MapLibre                                                                                                                                                                             | Chunk diferido       |
| `base.ts`                    | Detecta el PMTiles, lo registra con el protocolo `pmtiles://` y lee su cabecera (recuadro y zoom máximo)                                                                                                                | Chunk diferido       |
| `constantes.ts`              | Zoom, relleno, desvanecido y anchos de línea (de presentación; los `WEB_*` salen de `datos/constantes.ts`)                                                                                                              | Chunk diferido       |
- **MapLibre no está en el JS inicial de la misión.** El worker de MapLibre se emite como un archivo aparte (`maplibre-gl-worker-*.mjs`) y se registra con `setWorkerUrl`: el empaquetado no lo deja junto al chunk, que es donde MapLibre lo busca por defecto.
- **El mapa solo lee** `meta`, `estado`, `estacion`, `serie`, `estadoPagina` y `edad` de `datos/api.ts`. No escribe nada y no manda nada a ningún cohete (GS-14).

### Colores: salen de los tokens del tema, en tiempo de ejecución

MapLibre pinta en un lienzo WebGL y necesita colores literales, pero [06 §6](../../../../docs/08_gui/06_plan_web.md) los prohíbe fuera de `src/tema/` (lo vigila `scripts/colores.mjs`). Por eso `estilo.ts` **lee las variables CSS del tema** con `getComputedStyle(document.documentElement)` y arma el estilo con eso:

- `--fondo`, `--superficie`, `--superficie-2`, `--linea`, `--texto`, `--texto-2`, `--acento`, `--marca-1`, `--estado-alarma` y la duración `--dur-media`.
- Un estilo por tema sale solo: cada página lleva su `data-mision`, así que Deméter y Hermes obtienen su paleta sin ningún condicional. No hay ningún color escrito en `src/mapa/`.
- Los marcadores, controles y la leyenda son DOM: sus colores van en `mapa.css` con `var(--…)`.
- Si falta un token, `leerTokens` falla en voz alta: un mapa con un color inventado sería peor que no tener mapa.

### LKP (GS-03)

- **Cuándo:** la página está en `sin_senal`, o `estado.pos` llega en `null`.
- **Qué se dibuja:** el punto en vivo se reemplaza por un pin rojo fijo (`--estado-alarma`, ícono `MapPin` de Lucide) en `estado.lkp`. Si el servicio no lo manda, en `estado.pos`; y si tampoco, en el último punto de la `serie`. Lleva la altitud y "hace X s".
- **Nunca se borra:** no tiene límite de tiempo, se conserva si se cae el servidor del celular (`sin_servidor`) y, si ya no hay de dónde sacar la posición, queda la última que se tuvo. Solo desaparece cuando vuelve a llegar un dato en vivo.
- **"Hace X s"** no usa el reloj del celular (05 §0): sin señal sale de `edad` (`api.ts`); con señal pero sin posición, de la hora del cohete (`estado.utc_ms − lkp.utc_ms`).

### Gestos en el celular

`cooperativeGestures: true`: **un dedo desplaza la página** y dos dedos mueven el mapa (en el portátil, Ctrl + rueda acerca). MapLibre deja `touch-action: pan-x pan-y` en el lienzo mientras los gestos son cooperativos. En pantalla completa se desactivan, porque ahí la persona ya eligió el mapa. La prueba `e2e/mapa.spec.ts` lo comprueba con un arrastre real con el dedo que empieza dentro del mapa.

## Cómo se limita el mapa (T-634)

La gente va a ampliar y arrastrar el mapa: **no puede salir del área donde se ve bien**. Los números no se escriben en el código: salen del encabezado del PMTiles en tiempo de ejecución.

| Qué                         | De dónde sale                                                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Límites** (`maxBounds`)   | `minLon/minLat/maxLon/maxLat` de la cabecera del PMTiles (`base.ts` → `coberturaDeCabecera`), metidos hacia adentro `MAPA_MARGEN_LIMITES` (2 % de cada lado) para que no se vea el borde vacío                                                                                        |
| **Zoom máximo** (`maxZoom`) | El `maxZoom` de la cabecera **+ `MAPA_SOBREZOOM`** (1). Con PMTiles manda el archivo; `MAPA_ZOOM_MAX` (18) solo se usa sin mapa base                                                                                                                                                  |
| **Zoom mínimo** (`minZoom`) | El zoom con el que el área justo llena el contenedor (`zoomMinimo`, `area.ts`): más lejos se vería el vacío de afuera. **Se recalcula** al redimensionar y al entrar o salir de pantalla completa (evento `resize` de MapLibre). Con él, el botón de alejar se desactiva en el límite |
- **Sobrezoom (+1):** el mapa es vectorial, así que ampliar la última tesela no pixela nada; pero tampoco hay más detalle que el del zoom 15. Con +1 las calles se leen con comodidad; con +2 solo quedan líneas más gruesas y vacío. Se decidió con capturas del casco urbano a los zoom 15, 16 y 17.
- **Sin PMTiles:** el mismo comportamiento con un **área por defecto de ±`MAPA_AREA_DEFECTO_GRADOS` (0,05°)** alrededor de `meta.sitio` (o de `MAPA_CENTRO_POR_DEFECTO` hasta que llegue), unos 11 × 11 km: el mismo recorte con que se genera el archivo. Sin PMTiles el zoom máximo es `MAPA_ZOOM_MAX`. Si la cabecera de un PMTiles no trae un recuadro creíble (en ceros, al revés), se trata como si no hubiera: área por defecto.
- **GS-03, el LKP nunca desaparece: la excepción obligatoria.** El LKP, el cohete, la trayectoria, la estación, la rampa y la elipse **nunca** quedan fuera del área navegable. Si alguno cae afuera (o a menos de `MAPA_MARGEN_INCLUIR_GRADOS` del borde), el área se amplía para incluirlo (`ampliarParaIncluir`), con una holgura que crece con el tamaño del conjunto (`MAPA_MARGEN_INCLUIR_FRACCION`). **Se reevalúa con cada dato nuevo**, y solo se vuelve a tocar a MapLibre cuando el área cambia. Si el LKP vuelve a caer dentro del recorte, el área vuelve a ser la del archivo.
- **"Ver todo" siempre puede mostrarlo todo.** Un área solo se puede alejar hasta que la vista la llena: si lo dibujado ocupa casi todo el área y el contenedor es más ancho (o más alto) que ella, la vista no llegaría a abarcarlo. `ampliarParaVista` suma al área la vista con la que lo dibujado cabe entero, con el relleno de "Ver todo", así que el límite no corre la cámara. "Centrar en el cohete" y "Ver todo" respetan los límites (MapLibre mueve la cámara adentro si hace falta).
- **Lo que no cambia:** los gestos cooperativos del celular (un dedo desplaza la página, dos mueven el mapa), la pantalla completa y los controles.
- **Para las pruebas,** el lienzo publica su estado en atributos `data-mapa-*`: `limites`, `vista`, `centro`, `zoom`, `zoom-min` y `zoom-max` (como `data-mapa-reposos`).
- **Limitación:** con un área de ±0,05°, si una trayectoria real ocupara casi todo el ancho del área (11 km), en un celular vertical "Ver todo" haría crecer el área hacia el norte y el sur hasta poder mostrarla. Los vuelos simulados de Deméter y Hermes recorren unos 2 km.

## El mapa base (PMTiles)

**El mapa funciona sin él**: el fondo del tema, una cuadrícula de referencia (cada 0,002°, unos 220 m), la escala y las capas de la misión. Si existe `gui/web/public/mapas/santa_fe.pmtiles`, `base.ts` lo detecta (lee su cabecera) y lo usa como base vectorial con `pmtiles://`, dibujando a mano con los tokens la tierra, el uso del suelo, el agua, las vías y los lugares. Los nombres de los lugares **no** se dibujan: las etiquetas de MapLibre necesitan fuentes de glifos (`.pbf`) y no hay un servidor propio de ellas.

### Cómo generarlo (lo corre un humano)

El archivo **no se versiona** (`public/mapas/*.pmtiles` está en `gui/web/.gitignore`): pesa unos MB y se sube al CDN (T-642, PEN-W05). Hace falta la herramienta oficial de Protomaps, el CLI `pmtiles` ([go-pmtiles](https://github.com/protomaps/go-pmtiles/releases); documentación en [docs.protomaps.com/pmtiles/cli](https://docs.protomaps.com/pmtiles/cli)). **Las órdenes de abajo no se corrieron en T-632** (la tarea no descarga binarios ni datos grandes): al ejecutarlas por primera vez, confirma las opciones con `pmtiles extract --help` y la URL vigente en [docs.protomaps.com](https://docs.protomaps.com). Con internet, desde la raíz del repo:

```
pmtiles extract https://build.protomaps.com/<AAAAMMDD>.pmtiles gui/web/public/mapas/santa_fe.pmtiles \
  --bbox=-75.873,6.532,-75.773,6.632 --maxzoom=15
```

- **`<AAAAMMDD>`:** una compilación diaria del planeta que aparezca en <https://maps.protomaps.com/builds/>. El comando descarga solo las teselas del recorte (lecturas por rango), no el planeta.
- **`--bbox`** (`oeste,sur,este,norte`): ±0,05° alrededor de `meta.sitio` (6,582, −75,823), unos 11 × 11 km. Cubre la rampa, la estación, la deriva del descenso y el casco de Santa Fe de Antioquia (unos 3 km al sur).
- **`--maxzoom=15`:** la calle se distingue y el archivo queda pequeño; el mapa amplía un nivel más (zoom 16, `MAPA_SOBREZOOM`) sin pedir más teselas. Los límites y el zoom máximo se leen de la cabecera de **este** archivo al abrir el mapa: si se genera con otro recorte o `--maxzoom`, no hay que cambiar nada en el código.
- **Meta: < 30 MB.** Antes de descargar, corre el mismo comando con `--dry-run`: dice cuántas teselas y bytes serán. Si pasa de 30 MB, baja a `--maxzoom=14` o reduce el `--bbox`. No se midió en este PR (no se descargó nada): en zona rural se espera bastante menos.
- **Comprobarlo:** `pmtiles show gui/web/public/mapas/santa_fe.pmtiles` (zoom mínimo y máximo, recuadro y número de teselas) y `npm run dev`: con el archivo en su sitio el mapa trae base y la atribución "© OpenStreetMap · Protomaps".
- **Atribución:** los datos son de OpenStreetMap (ODbL). El mapa ya muestra la atribución cuando hay base; no la quites.
- **Otra ubicación:** con `VITE_MAPA_PMTILES_URL` (por ejemplo, la URL del CDN) en lugar de `public/mapas/`. El servidor debe permitir peticiones por rango (`Range`) y CORS si es de otro origen. El **mismo archivo** sirve como mapa sin conexión del dashboard local (T-603).

## Pruebas

- **Vitest** (`pruebas/mapa_area.test.ts`): la cabecera del PMTiles (incluida la del archivo real, si está), el área por defecto, los márgenes, que el área nunca deje fuera lo dibujado (con el LKP, el cohete, la trayectoria y la estación fuera del recorte), el zoom mínimo y máximo y `ampliarParaVista`.
- **Vitest** (`pruebas/mapa.test.ts`): el GeoJSON de cada capa desde las signals reales de `api.ts`, la decisión de LKP (con `lkp_descenso`, con `pos` en `null`, con el servidor caído), la elipse, el desvanecido, el chip y que el estilo de cada tema no use ningún color que no sea un token.
- **Playwright** (`e2e/mapa.spec.ts`): la carga diferida en producción (no se pide MapLibre hasta llegar a la sección), las capas y el LKP en desarrollo (el snapshot se inyecta en `datos/api.ts` con `e2e/mapa_ayudas.ts`, armado con el acumulador del repetidor), los controles, el desplazamiento en el celular y las capturas. Con el PMTiles en `public/mapas/`, una prueba más dibuja la base vectorial.
- **Playwright** (`e2e/mapa_limites.spec.ts`): arrastrar muy lejos, alejar y acercar al máximo con la rueda y con los botones, el zoom mínimo al redimensionar y en pantalla completa, con y sin PMTiles (sin él, bloqueando la ruta del archivo), y el LKP a decenas de km del recorte, que sigue visible y alcanzable. Las capturas van a `e2e/capturas/T-634/` (no se versiona).
