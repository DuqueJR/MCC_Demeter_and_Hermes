// Constantes de la web. Replica la sección 9 "Web" de docs/02_requisitos/constantes.md
// con el MISMO nombre. Es el único archivo con estos números (06 §6: ningún número mágico).
// Los marcados (P) son provisionales: se ajustan en constantes.md y aquí a la vez.

/** D-W09: latencia máxima de punta a punta, de la estación al celular. */
export const WEB_LATENCIA_MAX_S = 2;
/** 08_gui/03 §4 (P): a partir de aquí, "señal débil". */
export const WEB_DATO_VIEJO_S = 2;
/** 08_gui/03 §4 (P): a partir de aquí, "sin señal" y LKP. */
export const WEB_SIN_SENAL_S = 5;
/** 08_gui/03 §4 (P): sin nada de la estación, "la transmisión empieza el día del lanzamiento". */
export const WEB_SIN_TRANSMISION_MIN = 10;
/** 08_gui/03 §4: el retroceso máximo de la reconexión SSE. */
export const WEB_RECONEXION_MAX_S = 15;
/** 08_gui/04 §4: tasa del relay hacia el público en BOOT, PREFLIGHT, ARMED y LANDED. */
export const WEB_TASA_TIERRA_HZ = 1;
/** 08_gui/04 §4: latido del SSE. */
export const WEB_SSE_LATIDO_S = 15;
/** 08_gui/04 §8: conexiones SSE por IP (lo aplica el relay). */
export const WEB_SSE_MAX_POR_IP = 10;
/** 08_gui/03 §4: el banner de alarma de descenso sigue 10 s más (lo usa la UI, no `estadoPagina`). */
export const WEB_ALARMA_SOSTENER_S = 10;
/** 08_gui/05 §3 (P): máximo de puntos de la `serie` del snapshot. */
export const WEB_SERIE_MAX_PUNTOS = 2000;
// WEB_INGESTA_TOKEN no va en el repo: es una variable de entorno del relay y del reenviador.
