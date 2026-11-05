// Constantes de las gráficas (T-633). Son de presentación y de rendimiento; los umbrales `WEB_*`
// salen de `src/datos/constantes.ts`. Todas son provisionales (P): ninguna es un requisito.
// Ningún otro archivo de `src/graficas/` lleva números sueltos.

// ---- Refresco (rendimiento)
/**
 * (P) Tope de redibujo de la gráfica en vuelo: el cliente publica la `serie` con cada `estado`
 * (~9 Hz), pero redibujar la serie entera a esa tasa no aporta nada a la vista y gasta batería.
 */
export const GRAFICAS_REFRESCO_MS = 250;
/** (P) Con `prefers-reduced-motion` la gráfica se actualiza más despacio: menos movimiento. */
export const GRAFICAS_REFRESCO_REDUCIDO_MS = 1000;
/** (P) La sección pide el chunk de uPlot cuando está a esta distancia de entrar en pantalla. */
export const GRAFICAS_MARGEN_CARGA_PX = 400;

// ---- Datos
/** (P) Con menos puntos que esto no hay línea que dibujar: la gráfica aún no empieza. */
export const GRAFICAS_PUNTOS_MIN = 2;
/** (P) El eje del tiempo nunca es más corto que esto (s): los primeros instantes no se ven "estirados". */
export const GRAFICAS_TIEMPO_MIN_S = 5;
/** (P) Holgura de los ejes verticales, como fracción del rango de los datos. */
export const GRAFICAS_HOLGURA_Y = 0.08;
/** (P) Rango vertical mínimo cuando los datos son una línea plana. */
export const GRAFICAS_RANGO_PLANO = 1;

// ---- Medidas del lienzo (px)
/** (P) Alto del lienzo como fracción de su ancho, con tope arriba y abajo. */
export const GRAFICAS_PROPORCION = 0.6;
export const GRAFICAS_ALTO_MIN_PX = 190;
export const GRAFICAS_ALTO_MAX_PX = 360;
/** (P) En horizontal en un celular, el lienzo no pasa de esta fracción del alto de la ventana. */
export const GRAFICAS_ALTO_MAX_VENTANA = 0.7;
/** (P) Ancho que se usa mientras el contenedor aún no tiene medida (antes de la primera lectura). */
export const GRAFICAS_ANCHO_POR_DEFECTO_PX = 320;

// ---- Dibujo del lienzo
export const GRAFICAS_ANCHO_LINEA_PX = 2;
export const GRAFICAS_TAM_TEXTO_PX = 12;
export const GRAFICAS_TAM_TEXTO_MARCA_PX = 11;
export const GRAFICAS_ANCHO_EJE_Y_PX = 52;
/** (P) Marcas de eventos: trazo discontinuo (px de raya y de hueco). */
export const GRAFICAS_MARCA_RAYA_PX = 5;
export const GRAFICAS_MARCA_HUECO_PX = 4;
/** (P) Separación mínima entre dos rótulos de marca (px): más cerca que esto, solo se rotula la primera. */
export const GRAFICAS_MARCA_SEPARACION_PX = 14;
export const GRAFICAS_MARCA_MARGEN_PX = 3;
