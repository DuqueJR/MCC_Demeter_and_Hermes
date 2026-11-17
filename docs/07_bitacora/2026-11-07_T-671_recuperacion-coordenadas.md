---
fecha: 2026-11-07
tipo: tarea
ids: [T-671, D-065]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-671-recuperacion-coordenadas
---
# T-671: Recuperación y coordenadas en la web pública

## Contexto
Pedido 2 de Juan Pablo (`docs/08_gui/12_correcciones_web_vuelo.md`, D-065): el QR solo cuando el cohete ya está en tierra, y las coordenadas pequeñas dentro del mapa durante el vuelo. Antes, la sección Recuperación mostraba el bloque grande (coordenadas, Copiar, Maps y QR) desde el vuelo, con el centro de la elipse de impacto.

## Qué se hizo
- **Recuperación solo en LANDED** (`gui/web/src/mision/Recuperacion.tsx`). Antes de LANDED el bloque (coordenadas grandes, Copiar, enlace a Maps, QR y su botón) **no está en el DOM**: no se oculta con CSS, para que no quede en el árbol de accesibilidad. La sección sigue en su lugar (la navegación y el orden de la página no cambian) con una frase ("El QR y las coordenadas para recuperarlo aparecen aquí cuando el cohete aterrice. Mientras vuela, su posición está en el mapa.") y el vector "Desde la estación" (distancia, azimut y brújula). Quité la nota "no al punto estimado de impacto", que ya no tenía sentido sin el punto.
- **Etiqueta compacta en el mapa** (`gui/web/src/mapa/CoordenadasMapa.tsx`, con su CSS en `seccion.css`): arriba a la izquierda del marco, a la derecha del zoom de MapLibre y sin llegar a los botones de la derecha. Muestra **Lat, Lon y Alt** (`estado.pos.alt_msl_m`, "msnm"). Dos filas en el celular y una en escritorio.
  - Va en `SeccionMapa.tsx` (JS inicial) y no en el chunk diferido del mapa: se ve aunque MapLibre aún no haya cargado, y no toca `Mapa.tsx` ni `controlador.tsx` (los toca el PR #95).
  - No tapa el cohete: el ajuste del mapa deja 72 px de relleno (`MAPA_RELLENO_PX`) y la etiqueta cabe en esa franja. Tiene `pointer-events: none`: el dedo la atraviesa.
  - Sin posición válida: "Sin posición válida". Sin altura sobre el nivel del mar: "sin dato".
- **Lógica pura** en `vista_recuperacion.ts`: `puntoEnVuelo` y `vistaCoordenadasMapa`. La etiqueta usa la posición del cohete (`pos`), no el impacto estimado. `senales_recuperacion.ts` saca los dos `computed` que antes eran privados de `Recuperacion.tsx` para compartirlos.
- **Decisión: en LANDED la etiqueta se quita.** El bloque grande queda arriba de la página con todo; dejarla duplicaba los datos y se los repetía al lector de pantalla. Una sola fuente.
- **Accesibilidad:** la etiqueta no tiene `aria-live` ni `role="status"` (cambia varias veces por segundo). Lo que no aplica no se dibuja.
- Se documentó en `gui/web/src/mapa/README.md`.

### Con el último punto conocido (LKP)
- **Sin señal en el descenso** (`sin_senal`, antes de LANDED): la etiqueta muestra la última posición conocida en rojo, con la palabra "Última posición" y "hace X s" (el color nunca va solo). La altura sobre el nivel del mar sale de `pos` solo si el LKP es esa misma posición (lo normal, porque el estado se congela); si no, "sin dato", porque `Lkp` no trae altura sobre el nivel del mar. No se inventa sumando constantes.
- **(P) Si LANDED nunca llega pero hay LKP:** no hay QR, ni Maps, ni Copiar; solo la etiqueta del mapa con el LKP y su antigüedad (las coordenadas se pueden leer y teclear, y la insignia roja del mapa sigue). Es el comportamiento pedido ("el QR solo en LANDED"), pero deja al equipo de recuperación sin enlace si el cohete se pierde en el descenso y el estado no llega a LANDED. **Pendiente de decisión:** un enlace a Maps con el LKP (sin QR) en esa etiqueta, o un botón manual de "ya está en tierra". No lo implementé: no estaba en el pedido.
- Con LANDED y sin señal, el bloque completo sale con el LKP (como antes).

## Evidencia
Commits: `be2826d` (vista), `a655e36` (Recuperación solo en LANDED), `ad208ee` (etiqueta en el mapa).

- `npm ci && npm test`: **560 pasan, 1 omitida** (25 archivos). 10 pruebas nuevas en `pruebas/recuperacion.test.ts` (fases antes de LANDED, altura sobre el nivel del mar vs. sobre la rampa, LANDED oculta, sin posición, NaN, altura nula, LKP con y sin `pos`, caso (P)).
- `npm run build` (`tsc --noEmit`, colores, `vite build` y la prueba de aislamiento): OK. "Aislamiento OK: /demeter/ y /hermes/ no se referencian entre sí."; "Sin datos de ejemplo en el dist/ de producción"; fuentes 62 808 B y 67 268 B (< 81 920).
- `biome check` sobre los archivos tocados: 0 errores (7 avisos que ya estaban en otros archivos).
- e2e (`npm run e2e`, suite completa, 2 min): **297 pasan, 4 omitidas, 2 fallan**. Las dos fallas son `e2e/fotos_equipo.spec.ts:166` "escritorio 1024" y "escritorio 1280" de Hermes ("parche y foto al centro vertical": 31,5 px contra una tolerancia de 4). Es la sección Equipo, que no toqué. Vuelto a correr solo ese archivo: **12 de 12 pasan**, y también pasan en una copia de `origin/develop` sin mis cambios. Parece una carrera de carga de imágenes con la suite completa en paralelo; no la investigué más.
- e2e de lo tocado, por separado: `recuperacion_landed.spec.ts` (22, nueva) y `recuperacion_salud.spec.ts` (36): pasan. La primera corrida de `recuperacion_landed.spec.ts` justo después de cambiar el texto de la etiqueta falló y no guardé la causa; las cuatro siguientes (y la suite completa) pasaron 22 de 22.
- Casos que cubre la e2e nueva: sin QR ni bloque grande en cada fase antes de LANDED (Demeter y Hermes); lat, lon y altura contra `pos`; la etiqueta dentro del marco y sin desborde; sin solaparse con los botones, el zoom ni el marcador del cohete; sin `aria-live`; LKP en rojo y sin QR; sin posición; altura sin dato; paso de descenso a LANDED (el QR aparece y la etiqueta se quita del DOM) y de vuelta.
- Capturas en `docs/07_bitacora/capturas/T-671/`, a 390x844 y 1440x900: `vuelo-mapa-*`, `vuelo-recuperacion-*`, `vuelo-pagina-*`, `vuelo-lkp-*`, `landed-pagina-*`, `landed-recuperacion-*`, `landed-mapa-*`. El escenario es la simulación `nominal` de `dev/datos` por el servidor de desarrollo (`?sin_cliente`).
- La e2e de T-625 regenera sus capturas al correr: restauré las ajenas con `git checkout`; solo se agregan las de T-671.

## Decisiones tomadas o propuestas
- Decidido en esta tarea (de presentación, no cambia contratos): la etiqueta se quita en LANDED; la sección Recuperación se queda antes de LANDED con el vector y una frase, en lugar de desaparecer.
- **Propuesta (P):** qué hacer si LANDED no llega y hay LKP (ver arriba).
- Constantes nuevas, de presentación, con nombre: `DECIMALES_COORDENADA_MAPA = 5` (~1 m) y `DECIMALES_ALTURA_MSL = 0`. No hay números de `constantes.md`.

## Problemas y cómo se resolvieron
- El texto "ÚLTIMA POSICIÓN CONOCIDA HACE 38 S" en mayúsculas ocupaba tres filas en el celular y chocaba con la etiqueta propia del pin rojo del mapa. Se acortó a "Última posición" y se quitaron las mayúsculas.
- Biome pedía `<fieldset>` para `role="group"`; se quitó el rol (la etiqueta tiene su propio texto).

## Conflictos posibles con otros PR
- **PR #95 (T-656, mapa 3D):** toca `Mapa.tsx`, `controlador.tsx`, `marcadores.tsx`, `estilo.ts`, `geo.ts`, `constantes.ts` y `src/mapa/README.md`. Mi cambio **no toca ninguno de esos archivos de código**: la etiqueta vive en `SeccionMapa.tsx` y `seccion.css`. Solo coincidimos en `src/mapa/README.md` (yo agregué una fila a la tabla y la sección "Coordenadas compactas"): el conflicto, si sale, es de texto. Si el 3D agrega botones arriba a la derecha, la etiqueta está reservada para no llegar a esa columna (deja `toque-min + e-5` a cada lado); con un tercer control arriba a la izquierda habría que revisarlo. No integré ni usé el PR #95.
- **T-658 (Salud):** edita `e2e/recuperacion_salud.spec.ts` (sus pruebas de Salud). Yo cambié solo las de Recuperación y quité la línea que hacía clic en "QR" en la captura "nominal (en descenso)": un conflicto ahí sería de unas pocas líneas.

## Pendiente / siguiente paso
- Decidir el caso (P).
- Verificar con el repetidor de desarrollo o con el cohete en tierra (secciones 2 y 6 del manual) antes del corte.
- No se desplegó nada ni se hizo merge.

## Documentos afectados
- Código: `gui/web/src/mision/Recuperacion.tsx`, `vista_recuperacion.ts`, `senales_recuperacion.ts` (nuevo), `gui/web/src/mapa/CoordenadasMapa.tsx` (nuevo), `SeccionMapa.tsx`, `seccion.css`, `README.md`; pruebas `pruebas/recuperacion.test.ts`, `e2e/recuperacion_salud.spec.ts` y `e2e/recuperacion_landed.spec.ts` (nuevo).
- Para el documentador: `03_experiencia_y_pantallas.md` (§3.5 Recuperación y §3.4 Mapa) debería decir que el QR y el bloque grande son solo de LANDED y que el mapa lleva la etiqueta compacta. No lo edité.
