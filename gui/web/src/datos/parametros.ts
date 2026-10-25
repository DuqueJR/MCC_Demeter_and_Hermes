// Parámetros del cliente de datos (T-631) que NO están en constantes.md §9.
// Todos son provisionales (P): salen de decisiones de implementación, no de un requisito. Si alguno
// resulta ser un umbral de producto, se promueve a `constantes.md` y a `constantes.ts` con el mismo
// nombre (esta lista se le entrega al documentador en la bitácora de T-631).
//
// Las constantes de 03 §4 (`WEB_*`) NO se repiten aquí: se importan de `constantes.ts`.
import { WEB_SSE_LATIDO_S, WEB_TASA_TIERRA_HZ } from "./constantes";

const MS_POR_S = 1000;

// ---- Reconexión (03 §4: retroceso con tope `WEB_RECONEXION_MAX_S`) ----
/** (P) Primera espera tras una caída, antes del jitter. */
export const RECONEXION_BASE_S = 1;
/** (P) Retroceso exponencial: cada fallo seguido duplica la espera hasta el tope. */
export const RECONEXION_FACTOR = 2;
/**
 * (P) Fracción mínima de la espera que se conserva tras el jitter: la espera real es un valor
 * al azar entre `JITTER_MIN × espera` y `espera`. Evita que 500 clientes reconecten a la vez.
 */
export const RECONEXION_JITTER_MIN = 0.5;
/** (P) Tope del `Retry-After` del servidor: un encabezado absurdo no deja la página parada. */
export const RETRY_AFTER_MAX_S = 60;
/** (P) Una sesión que duró al menos esto se considera sana: el retroceso vuelve a empezar. */
export const SESION_ESTABLE_S = 10;

// ---- Salud de la conexión ----
/** (P) Sin recibir un solo byte (ni el `: ping`) durante tantos latidos, el stream se da por muerto. */
export const SSE_SILENCIO_LATIDOS = 2;
export const SSE_SILENCIO_MS = SSE_SILENCIO_LATIDOS * WEB_SSE_LATIDO_S * MS_POR_S;
/** (P) Tiempo máximo para recibir el snapshot completo. */
export const SNAPSHOT_TIMEOUT_S = 10;
/** (P) Mensajes que se guardan mientras llega el snapshot; si se pasa, la sesión se rehace. */
export const BUFFER_MAX_MENSAJES = 10_000;
/** (P) Resincronizaciones seguidas por retroceso de `t_ms`; luego se acepta el retroceso. */
export const RESYNC_MAX_SEGUIDOS = 3;
/** (P) Cada cuánto avanza el "ahora" local que alimenta `edad` y `estadoPagina` (03 §5: 10 Hz). */
export const RELOJ_TICK_MS = 100;

// ---- Serie viva ----
/** (P) Al pasarse de `WEB_SERIE_MAX_PUNTOS`, se recorta a esta fracción para no recortar a cada punto. */
export const SERIE_RECORTE_FRACCION = 0.75;

// ---- Interpolación (03 §5) ----
/** 03 §5: retraso de presentación de 1 paquete (100 ms). */
export const INTERP_RETRASO_MS = 100;
/** (P) Más de tantos periodos de tierra entre dos paquetes: no se interpola (hueco de señal). */
export const INTERP_HUECO_PERIODOS = 2;
export const INTERP_HUECO_MAX_MS = (INTERP_HUECO_PERIODOS * MS_POR_S) / WEB_TASA_TIERRA_HZ;
/** (P) Paquetes recientes que se recuerdan para interpolar y para estimar el reloj del cohete. */
export const INTERP_HISTORIAL = 8;
/** (P) Por encima de este producto escalar de cuaterniones, *slerp* se cambia por *nlerp*. */
export const SLERP_UMBRAL_LINEAL = 0.9995;
