// Constantes de presentación de la página de misión (no son de `constantes.md`: no viajan al firmware).

/**
 * Fondo de escala del acelerómetro principal LSM6DSO32: ±32 g (`docs/02_requisitos/constantes.md`, sección
 * de sensores: "±32 g, ±2000 °/s"). Un dato mayor no existe: el sensor satura. T-674.
 */
export const ACC_ESCALA_G = 32;

/** Las escalas "redondas" de los visualizadores de fuerzas g: las de `niceG` del dashboard de Pablo. */
export const G_ESCALAS: readonly number[] = [1, 2, 3, 5, 10, 15, 20, 30, 50];
/** Si nada alcanza la última escala, la de Pablo es 100 g. */
export const G_ESCALA_TOPE = 100;
/** Cuánto sobra la escala respecto del máximo visto (15 %, como en el dashboard de Pablo). */
export const G_ESCALA_HOLGURA = 1.15;
/** Cuánto dura la estela del radar, en segundos. */
export const G_ESTELA_S = 2;
/** Cuánto dura la banda mínimo-máximo del eje X, en segundos. */
export const G_BANDA_S = 10;
