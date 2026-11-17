# Gráficas de la misión (T-633)

La sección "Gráficas" de `/demeter/` y `/hermes/` ([03 §3.7](../../../../docs/08_gui/03_experiencia_y_pantallas.md)): **Altitud**, **Velocidad vertical** y **Aceleración** contra T+, con marcas verticales en los eventos que existan. uPlot dibuja; no hay backfill (D-039).

## Cómo está armado

| Archivo         | Qué hace                                                                                                                                                                           | Va en                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `Graficas.tsx`  | El cascarón: título, pestañas (roles ARIA y teclado), estado vacío, resumen y lista de momentos. Se suscribe a `serie` y `eventos` con un `effect` y pide el lienzo con `import()` | JS inicial (pequeño) |
| `graficas.css`  | Pestañas, panel y estados (solo tokens del tema)                                                                                                                                   | CSS inicial          |
| `Lienzo.tsx`    | uPlot dentro de un contenedor adaptable (ResizeObserver) y el dibujo de las marcas. **Es el único archivo que importa uPlot**                                                      | **Chunk diferido**   |
| `columnas.ts`   | Lógica pura: de `serie` y `eventos` a columnas, marcas, rangos, textos y medidas. **Sin DOM ni uPlot**                                                                             | JS inicial           |
| `vista.ts`      | Lógica pura: qué se muestra según el estado de la página y los datos (vacío, reuniendo, vivo, débil, sin señal, sin servidor)                                                      | JS inicial           |
| `limitador.ts`  | El tope de refresco (`GRAFICAS_REFRESCO_MS`)                                                                                                                                       | JS inicial           |
| `pestanas.ts`   | Las teclas de las pestañas                                                                                                                                                         | JS inicial           |
| `constantes.ts` | Presentación y rendimiento (todas `(P)`)                                                                                                                                           | JS inicial           |

## Reglas de los datos (verificadas en `estacion/web1.py`)

- **Sin T+ no hay punto.** `serie.t_mas_s` es `null` antes del despegue (el cliente de T-631) y trae **negativos** si el snapshot se pidió después del despegue (el repetidor y `web1.py`): agenda H0, D5, abierta. Los dos casos dan la misma gráfica: se descartan los `null` y los T+ < 0, y la gráfica **empieza en el despegue**. Antes del despegue se lee "La gráfica empieza con el despegue."
- **Termina en el aterrizaje** si existe el evento `aterrizaje`: la espera en tierra (a 1 Hz, hasta que se recupere) no aplasta el vuelo.
- **Un `null` es un hueco**, nunca un cero. `alt_agl_m` es `null` sin fix y `vz_ms` sin fix 3D; `acc_*` siempre llegan. Una magnitud sin ningún valor dice "Aún no hay datos de esta medida."
- **Aceleración = la norma de los tres ejes** (g): no depende de qué eje del cuerpo lleve el eje del cohete.
- **Marcas solo de los eventos que llegaron** (`despegue`, `fin_combustion`, `eyeccion`, `apogeo`). Que falte alguno no es un error ni se avisa: hoy el firmware solo tiene BOOST automático (T-412 pendiente) y llegan `fase` y `despegue`.

## Rendimiento

- uPlot (y su CSS) no está en el JS inicial: se pide cuando la sección está a `GRAFICAS_MARGEN_CARGA_PX` de entrar en pantalla.
- **Sin signal a 60 Hz** (D9): el componente no lee `serie.value` al pintar. Un `effect` recalcula las columnas de la pestaña activa a lo más cada `GRAFICAS_REFRESCO_MS` (4 Hz; 1 Hz con `prefers-reduced-motion`) y **nada mientras la sección está lejos de la pantalla**.
- Medida con la CPU 4 veces más lenta: `e2e/graficas_rendimiento.spec.ts` (ver la bitácora de T-633).

## Colores

Los de uPlot y las marcas salen de las variables CSS del tema (`--acento`, `--texto`, `--texto-2`, `--linea`, `--superficie`), leídas en tiempo de ejecución con `getComputedStyle`: Hermes y Deméter se ven con su paleta sin ningún color escrito aquí (`scripts/colores.mjs` lo vigila).

## Pruebas

`pruebas/graficas.test.ts` (lógica pura, con los escenarios reales del repetidor) y `e2e/graficas.spec.ts` (estados, pestañas, medidas y repetidor).
