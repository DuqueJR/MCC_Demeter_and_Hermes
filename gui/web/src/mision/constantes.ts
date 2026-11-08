// Constantes de presentación de la página de misión (no son de `constantes.md`: no viajan al firmware).

/**
 * Fondo de escala de los visualizadores de fuerzas g (T-674): ±32 g, el rango del acelerómetro
 * principal LSM6DSO32 (`docs/02_requisitos/constantes.md`, sección de sensores: "±32 g, ±2000 °/s").
 * Un valor mayor no existe en el dato (el sensor satura): la barra queda en el borde y se avisa.
 */
export const ACC_ESCALA_G = 32;
