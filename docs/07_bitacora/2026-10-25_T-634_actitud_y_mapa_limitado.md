---
fecha: 2026-10-25
tipo: tarea
ids: [T-634, T-632, T-631, GS-03, D-007, D-W03]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-634-actitud-y-mapa-limitado
---
# T-634: Actitud 2D y mapa limitado al área del PMTiles

## Contexto
T-634 pedía la actitud 2D (horizonte artificial y brújula desde el cuaternión, `03 §3.6`). Juan Pablo decidió además que T-634 **limite el mapa** de T-632 al área que cubre el PMTiles (decisión del documentador, rama `docs/T-634-alcance-mapa`, todavía no en `develop`). Base: `origin/develop` en `7b5f9be`. Sesión web (`SESION=web`). Búsqueda: se consultó una vez el grafo de graphify de la carpeta principal (`graphify query`, funcionó) y el resto se leyó directo de los archivos que la tarea nombra. No se tocó `src/datos/`, `src/contrato/`, `src/tema/`, `package.json` ni `package-lock.json`, ni ningún contrato.

## Qué se hizo

### Parte 1 · Actitud 2D (`gui/web/src/actitud/`)

| Archivo | Qué hace |
| --- | --- |
| `angulos.ts` | **Lógica pura**: cuaternión → cabeceo, alabeo y rumbo; normaliza; `null` si es nulo o no finito; marca `cardan`; `cardinalDe` |
| `vista.ts` | **Lógica pura**: qué muestra la sección según `estadoPagina` y `ekf_ok` (sin dato, no disponible, vivo, débil, sin señal, sin servidor) |
| `Actitud.tsx`, `actitud.css` | La sección: dos instrumentos SVG (horizonte y brújula), los tres ángulos y el aviso. Solo `var(--…)` de los tokens |
| `constantes.ts` | Tolerancias y medidas del dibujo |
| `README.md` | Convención de los ángulos, de dónde sale el dato, estados y pruebas |

- **Va en el hueco `actitud`** de `src/mision/Pagina.tsx` (`<Hueco id="actitud"/>` → `<Actitud/>`), en las dos misiones, cada una con su tema. El posicionamiento (`#actitud`) ya estaba en `mision.css`.
- **Fuente del dato (agenda de H0, D9):** un `requestAnimationFrame` llama a `interpolador.muestrear(performance.now())` (el cuaternión ya viene interpolado con *slerp*: `Muestra.q`) y mueve directo los elementos del SVG. **Sin signal nueva:** no se repinta la página a 60 Hz. Si el interpolador no tiene datos (por ejemplo, un snapshot inyectado en pruebas), usa `estado.q`. El ciclo corre solo mientras la sección está en pantalla (`IntersectionObserver`). Los textos se reescriben solo cuando cambia el valor redondeado.
- **`prefers-reduced-motion`:** sin ciclo de dibujo; se pinta cada `estado` que llega, sin interpolar.
- **Sin dato o sin señal se ve claro** (como el mapa con `estadoPagina`): sin dato o `ekf_ok = false` → aro vacío, guiones y "Aún no hay datos de orientación." / "Orientación aún no disponible" (03 §3.6). Señal débil o sin servidor → atenuado al 65 % con aviso. **Sin señal → gris al 40 % y, en rojo, "Sin señal · última orientación hace X s"** (la edad sale de `edad`, no del reloj del celular).
- **Bloqueo de cardán:** con `|cabeceo| ≥ 89°` (`ACTITUD_CARDAN_DEG`) el rumbo y el alabeo no se separan: la sección muestra guiones y una nota en lugar de inventarlos. Exactamente vertical no sale `NaN`.

#### Convención de los ángulos (lo que dice el contrato y lo que no)

- **Del contrato** (`protocolo_paquetes §2 y §8`, `web-1 §2.2`): `q = (w, x, y, z)` unitario, **rota vectores del cuerpo al marco ENU**; +X del cuerpo hacia la nariz; Y y Z dextrógiro. Con eso, el **cabeceo** (elevación de la nariz) y el **rumbo** (azimut de la nariz, 0 = norte, horario) salen solo del eje X y están bien definidos.
- **Lo que el contrato no fija:** de dónde se mide el **alabeo**. Depende de cómo se monte el CanSat (`R_MONTAJE`, D-007, **pendiente de medir**). Se usó "adelante-izquierda-arriba" (X nariz, Y izquierda, Z arriba con el cohete horizontal), que es la del generador de vuelos sintéticos (`tools/web_datos/actitud.py`). Alabeo positivo = regla de la mano derecha sobre +X. Está escrito en el encabezado de `angulos.ts` y en el README del módulo. Ver "Propuestas".

### Parte 2 · Mapa limitado (`gui/web/src/mapa/`)

| Archivo | Cambio |
| --- | --- |
| `area.ts` (nuevo) | **Lógica pura**: `coberturaDeCabecera`, `areaPorDefecto`, `encoger`, `ampliarParaIncluir`, `ampliarParaVista`, `zoomMinimo`, `zoomMaximo`, `dentroDe`, `mismosLimites` |
| `base.ts` | `detectarBase` devuelve también la **cobertura** (recuadro y `maxZoom`) leída de la misma cabecera que ya leía para detectar el archivo |
| `controlador.tsx` | `maxBounds`, `minZoom` y `maxZoom` en MapLibre; se reaplican con cada dato y con `resize` (que cubre el redimensionado y la pantalla completa); el lienzo publica `data-mapa-limites`, `-vista`, `-centro`, `-zoom`, `-zoom-min` y `-zoom-max` |
| `constantes.ts` | `MAPA_SOBREZOOM`, `MAPA_MUNDO_PX`, `MAPA_MARGEN_LIMITES`, `MAPA_MARGEN_INCLUIR_GRADOS`, `MAPA_MARGEN_INCLUIR_FRACCION`, `MAPA_AREA_DEFECTO_GRADOS`; `MAPA_ZOOM_MAX` pasa a valer solo sin mapa base |
| `README.md` | Sección nueva "Cómo se limita el mapa" |

- **Nada del recorte está escrito en el código.** El encabezado del archivo real dice `minLon −75,873`, `minLat 6,532`, `maxLon −75,773`, `maxLat 6,632`, `maxZoom 15`. En ejecución, `maxBounds` sale `[−75,871; 6,534; −75,775; 6,630]` (el recuadro metido el 2 %) y `maxZoom = 16`.
- **`maxZoom` = el del archivo + 1 de sobrezoom.** Decidido con capturas del casco urbano a los zoom 15, 16 y 17 (`e2e/capturas/T-634/sobrezoom/`): el mapa es vectorial, así que ampliar no pixela, pero no hay más detalle que el del zoom 15. A +1 las calles se leen con comodidad (y es el máximo que pidió el encargo); a +2 solo quedan líneas más gruesas y vacío.
- **`minZoom`** = el zoom con el que el área justo llena el contenedor (más lejos se vería el vacío). Se recalcula con `resize` (redimensionar y pantalla completa) y desactiva el botón de alejar en el límite.
- **Sin PMTiles:** el mismo comportamiento con un área de **±0,05° alrededor de `meta.sitio`** (hasta que llegue, alrededor de `MAPA_CENTRO_POR_DEFECTO`), unos 11 × 11 km: el mismo recorte con que se genera el archivo. Zoom máximo = `MAPA_ZOOM_MAX` (18), porque sin teselas no hay nada que ampliar. Si la cabecera de un PMTiles no es creíble (en ceros, al revés), se trata como si no hubiera.
- **GS-03 (obligatorio):** el LKP, el cohete, la trayectoria, la estación, la rampa y la elipse (todo lo de `capas.limites`) **nunca** quedan fuera. Si alguno cae afuera o a menos de `MAPA_MARGEN_INCLUIR_GRADOS` del borde, el área se amplía lo justo, con una holgura que crece con el tamaño del conjunto (`MAPA_MARGEN_INCLUIR_FRACCION`, 15 %: una holgura fija en grados se vuelve de pocos píxeles al alejarse y el pin quedaba pegado al borde). Se reevalúa con cada dato y solo se toca a MapLibre si el área cambió.
- **"Ver todo" y "Centrar en el cohete" respetan los límites.** Hallazgo durante las pruebas: un área solo se puede alejar hasta que la vista la llena. Con el LKP a decenas de km y una ventana apaisada, la vista no llegaba a abarcar el conjunto y "Ver todo" dejaba el pin pegado al borde. `ampliarParaVista` suma al área la vista con la que lo dibujado cabe entero con el relleno de "Ver todo" (`MAPA_RELLENO_PX`).
- **Los gestos cooperativos del celular no se tocaron** (el test `mapa.spec.ts` de un dedo sigue en verde).

## Evidencia

**Commits** (rama `feature/T-634-actitud-y-mapa-limitado`):

| Hash | Título |
| --- | --- |
| `4cc1c42` | feat(web): calcular cabeceo, alabeo y rumbo desde el cuaternión [T-634] |
| `55947c1` | feat(web): sección Actitud 2D con horizonte y brújula [T-634] |
| `35f456b` | feat(web): limitar el mapa al área que cubre el PMTiles [T-634] |
| `79a537b` | test(web): e2e de los límites del mapa y del LKP fuera del recorte [T-634] |
| `b916c6f` | docs(web): documentar cómo se limita el mapa [T-634] |

**Resultados** (desde `gui/web/`, con la copia local de `santa_fe.pmtiles` sin versionar):

| Comando | Antes (`develop`, sin mis cambios) | Después |
| --- | --- | --- |
| `npm test` | 12 archivos, **245** pasan | 14 archivos, **298** pasan (+30 de `actitud.test.ts` y +23 de `mapa_area.test.ts`), 0 fallan, 0 saltan |
| `npm run build` | OK | OK: `tsc`, `colores.mjs` y la prueba de aislamiento (`/demeter/` y `/hermes/` no se referencian; fuentes 62 808 B y 67 268 B) |
| `npm run e2e` | **88** pasan | **115** pasan (+12 de `actitud.spec.ts` y +15 de `mapa_limites.spec.ts`), 0 fallan, 0 saltan, 28,7 s |
| `biome check .` | 3 advertencias | las mismas 3 (de `estado_pagina.ts` y `comun.css`, ajenas) |

- **Criterio de T-634** (cuaterniones conocidos con ±0,5°): 0° de cabeceo (identidad y norte), **90° de cabeceo**, **45° de alabeo** y −45°, −90° de cabeceo; barrido de rumbo (cada 15°), cabeceo (−80° a 80°) y alabeo (−175° a 175°); `q` y `−q`; norma ≠ 1 (×7,3 y ×0,31); redondeo Q15 (< 0,05°); cuaternión nulo, `NaN` e infinito → `null`; cardán en ±89°, ±90°; continuidad al pasar a la vertical exacta.
- **`mapa.spec.ts:196` (gestos con un dedo)** pasa en esta máquina, **con y sin mis cambios** (88 de 88 en la línea base): no pude reproducir el fallo que se vio en otra máquina.
- **El JS inicial** crece poco: el chunk `Pagina` (compartido por las dos misiones) pesa 18,8 KB gz. No tengo la línea base medida de la misma forma (la revisión de T-632 habla de 16,7 KB gz de JS inicial), así que estimo +2 KB gz por la actitud, sin MapLibre.
- **Capturas** (no versionadas; `e2e/capturas/` está en `.gitignore`; `test-results/` las borra Playwright en cada corrida). Copia en `/private/tmp/claude-501/-Users-juanpa-Develop-PersonalProjects-Hermes/2368270a-0993-4182-a08c-5ff60f31254b/scratchpad/T-634/`:
  - actitud: `{demeter,hermes}-vivo-{390x844,1440x900}.png` y `{demeter,hermes}-sin-senal-390x844.png`;
  - mapa alejado al máximo y arrastrado al borde, con PMTiles: `{demeter,hermes}-alejado-al-borde-{390x844,1440x900}.png`; lo más cerca que deja: `…-acercado-al-maximo-…`;
  - LKP fuera del recorte (con PMTiles y sin base): `demeter-lkp-fuera-del-recorte-{pmtiles,sin-base}-1440x900.png`;
  - sobrezoom: `sobrezoom/zoom-{15,16,17}.0.png`.

## Decisiones tomadas o propuestas

**Decisiones de implementación** (dentro de la tarea, no tocan contratos): el sobrezoom de +1; el 2 % de margen hacia adentro de los límites; la holgura de ampliación (mínimo 0,01° y 15 % del lado mayor del conjunto); el umbral de cardán de 89°; mostrar guiones (y no números inventados) en el cardán; el estado `sin-senal` con la última actitud atenuada y rotulada (en lugar de ocultarla).

**Propuestas de cambio (no aplicadas; las consolida el documentador):**

1. **Escribir en `03 §3.6` (o en `protocolo_paquetes §8`) la convención de los ángulos**: cabeceo = elevación de la nariz, rumbo = azimut de la nariz (0 = norte, horario), alabeo = giro sobre +X por la regla de la mano derecha. Y dejar explícito que **el cero del alabeo depende de `R_MONTAJE`** (D-007, pendiente): hoy se usa "adelante-izquierda-arriba". Cuando se mida el montaje, el cambio es una sola constante en `angulos.ts`.
2. **Los datos sintéticos traen un alabeo que no es real.** El generador usa la rotación mínima de +X a la nariz (OpenRocket no modela el giro), que da un alabeo ≠ 0 que depende de la dirección. En la web se verá un alabeo "inventado" durante el vuelo simulado. Si molesta, el generador (`tools/web_datos/actitud.py`) podría publicar alabeo 0 (rotación alrededor de "arriba" y luego del eje lateral). Es del área D.
3. **Una frase en `03 §3.4` o en el README del mapa de `docs/`** (el documentador decide): "el mapa no sale del área del PMTiles, salvo que el LKP, el cohete, la trayectoria o la estación caigan afuera: entonces el área se amplía" (GS-03).

## Problemas y cómo se resolvieron

- **"Ver todo" no mostraba el LKP lejano** (el pin quedaba pegado al borde superior). Causa: `minZoom` es un "cubrir" (la vista siempre ⊂ área), no un "contener"; con una ventana apaisada y el conjunto ocupando casi toda el área, no llegaba a abarcarlo. Se arregló con `ampliarParaVista` y una holgura proporcional, ambos con pruebas (incluida una de propiedad con 300 casos al azar).
- **Las pruebas de arrastre esperaban un "reposo" de MapLibre**, que no ocurre si el mapa ya está en el límite (el arrastre no mueve nada). Se cambió por esperar a que la vista y el zoom publicados se estabilicen.
- **La prueba de redimensionar** leyó el tamaño del lienzo a mitad del diseño (ancho nuevo, alto viejo). Se espera a que el alto llegue a su valor final (60 % de la ventana).
- **Visual (anterior a T-634, no lo arreglé):** cuando el LKP es el punto más al norte, el **texto** del LKP (va encima del pin) puede asomar por el borde superior tras "Ver todo" (relleno de 72 px). El pin queda a la vista. Se podría subir el relleno superior de `ajustarA`; no lo toqué para no salirme del alcance.
- **`npx biome` falló una vez** ("could not determine executable") dentro de una cadena de comandos; con `./node_modules/.bin/biome` funciona siempre.
- **`npm run e2e` reescribe** las capturas de T-621, T-622 y T-632 en `docs/07_bitacora/capturas/` (salen distintas pixel a pixel). Se revirtieron con `git checkout` antes de cada commit. Nota para el documentador: con T-634, las capturas `demeter-ejemplo-*` y `hermes-ejemplo-*` de T-622 ya muestran la sección Actitud (antes, un hueco); si se quieren actualizar, hay que regenerarlas.

## Pendiente / siguiente paso

- **Probar la actitud con un cuaternión real** de la placa cuando haya hardware; medir `R_MONTAJE` y fijar el cero del alabeo (propuesta 1).
- **Limitación conocida del mapa:** con el área de ±0,05°, si una trayectoria real ocupara casi todo el ancho del área (11 km), en un celular vertical "Ver todo" haría crecer el área hacia el norte y el sur hasta poder mostrarla. Los vuelos simulados recorren unos 2 km.
- La cuadrícula del mapa sin base (`estilo.ts`) sigue centrada en `MAPA_CENTRO_POR_DEFECTO` con ±0,05° y no acompaña a un área ampliada ni a un `meta.sitio` distinto (anterior a T-634; fuera del área navegable solo se ve el fondo).
- T-651 (actitud 3D) reemplazará esta sección en el portátil; `angulos.ts` y `vista.ts` se pueden reutilizar.

## Documentos afectados

- Código y pruebas: `gui/web/src/actitud/` (nuevo), `gui/web/src/mapa/` (`area.ts` nuevo; `base.ts`, `constantes.ts`, `controlador.tsx`, `README.md`), `gui/web/src/mision/Pagina.tsx`, `gui/web/pruebas/actitud.test.ts`, `gui/web/pruebas/mapa_area.test.ts`, `gui/web/e2e/actitud.spec.ts`, `gui/web/e2e/mapa_limites.spec.ts`.
- Para consolidar (no editados aquí): `docs/05_plan/backlog.md` (T-634), `docs/05_plan/pendientes.md` (`R_MONTAJE`, ligado a D-007) y `docs/08_gui/03_experiencia_y_pantallas.md` §3.6 (propuestas 1 y 3).
