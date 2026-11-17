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

## Ajuste: fuerzas g en "Desde la estación" (mismo PR, pedido posterior del usuario)
- **Qué:** bajo la brújula y la distancia del bloque "Desde la estación" (`Recuperacion.tsx`) hay ahora un visualizador de las fuerzas g: una barra por eje X, Y y Z, centrada en 0 (a la izquierda es negativo), con su valor en texto a la derecha (coma decimal, `DECIMALES_ACELERACION` = 2), y la magnitud total |g| destacada arriba, con su barra de 0 a la escala. Está en `FuerzasG` (`Telemetria.tsx`), con su CSS en `estado.css`. En LANDED el bloque sigue visible: ahí las barras no pasan de 28 rem de ancho.
- **Fuente:** la misma aceleración de `vistaTelemetria` (`.aceleracion`), sin recalcularla. Lo nuevo y puro está junto a esa vista: `magnitudG` (√(x²+y²+z²)) y `posicionBarra` (fracción −1..1 y si saturó).
- **Escala: ±32 g** (`ACC_ESCALA_G` en el nuevo `src/mision/constantes.ts`). Sale de `docs/02_requisitos/constantes.md` (sección de sensores): el LSM6DSO32 principal mide "±32 g". Un dato mayor no existe (el sensor satura): la barra queda en el borde, pasa al color de aviso y el visualizador dice "fuera de escala". El costo es que un empuje típico de BOOST (~9 g) llena solo el 28 % de la barra; se eligió no inventar una escala menor.
- **Dato viejo y sin dato:** igual que la telemetría (gris de "sin dato" y "Último dato hace X s"); sin aceleración, cada eje y el total dicen "sin dato" y no hay barras. Todo valor va también en texto: el color nunca va solo.
- **Pruebas:** `tsc`, `colores.mjs`, `biome` sobre los archivos tocados (0 errores y 0 avisos nuevos), `npm run build` y 6 pruebas unitarias nuevas en `pruebas/estado_mision.test.ts` (33 en el archivo, todas verdes). Sin e2e ni suite completa. La spec de capturas `estado_en_inicio.spec.ts` (mi spec de este PR, 14 pruebas, todas verdes) se corrió solo como generador de las 16 capturas; ahora incluye 3 pruebas de las fuerzas g (sin dato, valores y posición de la barra, dato viejo, fuera de escala y celular sin desborde).
- **Capturas:** se regeneraron las 14 y se agregaron `demeter-portatil-estacion-g.png` y `demeter-celular-estacion-g.png` (en BOOST, t = 19,2 s del escenario nominal: X = 9,10 g).
- **Detalle de las capturas largas:** al regenerarlas, la de "aterrizado" salió con un desplazamiento a medias porque la página tiene `scroll-behavior: smooth`; el helper ahora espera a `scrollY === 0` antes de medir.

## Segundo ajuste: la rosa de actitud y las fuerzas g "como en la ventana EKF" de Pablo
Pedido posterior del usuario: en "Desde la estación" las fuerzas g y la actitud se ven como en `estacion/dashboard_ekf.js` (`drawG` y `draw3d`). Esto **reemplaza** las barras X/Y/Z del ajuste anterior (la magnitud |g| total se conserva). Todo en SVG, sin dependencias nuevas, con colores solo de los tokens del tema.
- **Fuerzas g (`FuerzasG.tsx`, lógica en `vista_fuerzas_g.ts`):**
  - Radar de la sección (Y, Z) visto desde la cola: +Y a la derecha, la marca (−Z) arriba, anillos al 25/50/75 %, cruz, estela de ~2 s, punto actual y la etiqueta de escala.
  - Barra del eje X (nariz) con ticks en bajo, 0, +1 y alto, la línea de 1 g marcada "1 g: quieto, nariz arriba", la banda mínimo-máximo de ~10 s y el punto actual.
  - Textos "Sección (Y, Z): x,xx g" y "Eje X (nariz): x,xx g", y el pie "ejes del chip, sin calibrar; estela 2 s, banda 10 s". Más el |g| total en texto grande arriba.
  - Escalas automáticas como `niceG` (1, 2, 3, 5, 10, 15, 20, 30, 50; 100 si nada alcanza), con 15 % de holgura: radar = escala de (máximo lateral × 1,15); barra X de `−escala(max(1, −mín × 1,15))` a `escala(max(2, máx × 1,15))`. Los números salen de `constantes.ts` (`G_ESCALAS`, `G_ESCALA_HOLGURA`, `G_ESTELA_S`, `G_BANDA_S`).
  - La saturación del sensor se conserva con otro sentido: con las escalas automáticas el punto no se sale, pero si algún eje pasa de ±32 g (`ACC_ESCALA_G`, el rango del LSM6DSO32) sale la nota "Fuera del rango del sensor". Se quitó `posicionBarra` (ya sin uso).
- **De dónde sale la historia de la estela y la banda:** de la `serie` de `datos/api.ts` (columnas `t_mas_s`, `acc_x_g`, `acc_y_g`, `acc_z_g`), la misma que usan las gráficas. No hay otro búfer. Se recorre hacia atrás desde el último punto con T+. Dos consecuencias: antes del despegue la serie no trae T+ (no hay historia: solo el punto de ahora) y, si la web se abre a mitad de vuelo, la historia llega con la resolución decimada del snapshot hasta que se acumulen los `estado` en vivo.
- **Actitud (`ActitudEstacion.tsx`, escena en `vista_rosa.ts`):** la rosa de los vientos en el plano horizontal (N en rojo), la línea punteada "arriba", el cohete de alambre con anillos, la punta "nariz", la franja de la marca (−Z) en el color de aviso (el naranja de Pablo) y la del costado derecho (+Y) en el de información (el azul de Pablo), las aletas, la flecha de velocidad con su texto si hay velocidad > 0,3 m/s, y debajo guiñada/cabeceo/alabeo en texto. Cámara fija (los mismos −0,7 y 0,35 rad de Pablo); el arrastre para orbitar no se hizo (era opcional). La sección "Actitud" de siempre no cambia.
- **Conversión de marcos (lo delicado):**
  - Pablo dibuja el cohete en cuerpo FRD (X nariz, Y derecha, Z abajo) con un cuaternión cuerpo→NED. La web recibe `estado.q`, que rota del cuerpo **FLU** (X nariz, Y izquierda, Z arriba con el cohete horizontal; `actitud/README.md` y `angulos.ts`) al marco **ENU**.
  - FRD y FLU solo difieren en un giro de 180° alrededor de la nariz: `(x, y, z)_FRD = (x, −y, −z)_FLU`. Cada punto de la geometría de Pablo (que sigue en FRD: la marca en −Z, el costado en +Y) se pasa a FLU invirtiendo Y y Z, se rota con la matriz de `q` a ENU y se proyecta con la fórmula de Pablo cambiando solo la entrada: `e = este, n = norte, u = arriba`. Con `q = identidad`, la nariz mira al este, la marca queda arriba y el costado derecho, al sur: es lo esperado mirando al este.
  - El radar de las fuerzas g usa `acc_g` tal cual llega de TELEM (ejes del chip, sin calibrar), con el mismo convenio de Pablo: +Y a la derecha, −Z arriba. No se aplicó ninguna conversión, y por eso el pie dice "sin calibrar".
  - Sigue valiendo el aviso de `actitud/README.md`: el cero del alabeo depende de `R_MONTAJE` (D-007, pendiente de medir). El contrato no se tocó.
- **Estados:** sin dato ("sin dato" y sin cohete), `ekf_ok = false` ("Orientación aún no disponible", sin cohete: el cuaternión llega en identidad) y dato viejo (gris de "sin dato" y "Último dato hace X s", como la telemetría). Accesibilidad: los dos dibujos son `role="img"` con `aria-label` con los valores, y los números clave también están en texto. Con el cohete casi vertical (cardán) la guiñada y el alabeo salen como "—" con una nota, igual que la sección Actitud.
- **Ubicación:** en "Desde la estación", bajo la brújula y la distancia: primero Actitud y luego Fuerzas g; lado a lado si hay ancho (aterrizado, que ocupa todo el ancho) y uno bajo otro en la columna 3 del portátil y en el celular. Los dibujos no pasan de 28 rem.
- **Pruebas (solo básicas):** `tsc`, `colores.mjs`, `biome` sobre los archivos tocados (0 errores y ningún aviso nuevo), `npm run build` y 44 pruebas unitarias en 2 archivos (`pruebas/estacion_instrumentos.test.ts` nuevo y `estado_mision.test.ts`). Casos de marcos: cuaternión identidad, nariz arriba (cabeceo 90°) y nariz al norte inclinada 45° (la nariz va a (0; 0,71; 0,71) y la marca queda perpendicular y hacia arriba), además de la proyección y de la escena. Sin la suite e2e: Playwright solo como generador de las capturas, corriendo la spec de este PR (14 pruebas verdes, con las de la rosa y el radar).
- **Capturas:** se regeneraron todas (16) y se agregaron `demeter-portatil-estacion-actitud-g.png` y `demeter-celular-estacion-actitud-g.png` (justo después del fin de la combustión, t = 20,3 s: cabeceo 85°, 122 m/s, la banda de X abarca el empuje de ~10 g).

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
