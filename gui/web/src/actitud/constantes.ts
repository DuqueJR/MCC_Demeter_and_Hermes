// Constantes de la actitud 2D (T-634). Son de presentación y de tolerancia numérica; ningún otro
// archivo de `src/actitud/` lleva números. No hay umbrales de `constantes.md` aquí: la actitud solo
// dibuja lo que manda el cohete (`estado.q`).

/** A partir de este cabeceo (en valor absoluto) el rumbo y el alabeo ya no se separan (bloqueo de cardán). */
export const ACTITUD_CARDAN_DEG = 89;
/** Un cuaternión con menos norma que esto no es una actitud: se descarta. */
export const ACTITUD_NORMA_MIN = 1e-6;
/** Con la nariz tan cerca de la vertical, el rumbo se saca del eje Y del cuerpo (la nariz ya no lo da). */
export const ACTITUD_HORIZ_MIN = 1e-6;

// ---- Dibujo (unidades del `viewBox` de los instrumentos: el centro es (0, 0))

/** Radio de cada instrumento y margen que se deja alrededor (ahí va el puntero de la brújula). */
export const DIAL_RADIO = 90;
export const DIAL_MARGEN = 10;
/** Cuántas unidades se desplaza el horizonte por cada grado de cabeceo. */
export const DIAL_UNIDADES_POR_GRADO = 2;
/** Separación de las marcas de cabeceo, en grados, y el cabeceo máximo que se marca. */
export const ESCALA_PASO_CABECEO_DEG = 10;
export const ESCALA_CABECEO_MAX_DEG = 80;
/** Cada cuántos grados de cabeceo se escribe el número. */
export const ESCALA_NUMERO_CADA_DEG = 20;
/** Ancho de las marcas de cabeceo: la chica (10°, 30°…) y la grande (20°, 40°…). */
export const ESCALA_ANCHO_CHICA = 14;
export const ESCALA_ANCHO_GRANDE = 28;
/** Separación de las marcas de la rosa, y cada cuántos grados va una marca grande. */
export const ROSA_PASO_DEG = 10;
export const ROSA_PASO_GRANDE_DEG = 30;
/** Largo de las marcas de la rosa (chica y grande) y radio donde se escriben las letras. */
export const ROSA_MARCA_CHICA = 5;
export const ROSA_MARCA_GRANDE = 10;
export const ROSA_RADIO_LETRAS = 62;
/** Alto y ancho del puntero fijo de la brújula. */
export const PUNTERO_ALTO = 10;
export const PUNTERO_ANCHO = 14;
/** Ancho del cielo y la tierra: sobra para cubrir el instrumento girado y desplazado. */
export const HORIZONTE_EXTENSION = 400;

// ---- Textos

export const ACTITUD_DECIMALES_ANGULO = 1;
export const ACTITUD_DECIMALES_RUMBO = 0;
/** Grados de una vuelta y de media vuelta (para el dibujo de la rosa). */
export const GRADOS_VUELTA = 360;
export const GRADOS_MEDIA_VUELTA = 180;
/** Lo que se escribe en lugar de un ángulo cuando no hay actitud que mostrar. */
export const ACTITUD_SIN_VALOR = "—";
