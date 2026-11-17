// Constantes del repetidor de desarrollo (T-630). Las WEB_* salen de src/datos/constantes.ts
// (que replica constantes.md §9); aquí solo se reexportan. Los (P) son propios del repetidor.
//
// Los archivos de dev/repetidor/ se ejecutan con Node 22 directamente (quita los tipos, sin
// compilar): por eso los imports relativos llevan la extensión `.ts` y solo hay sintaxis borrable.
import { WEB_TASA_TIERRA_HZ } from "../../src/datos/constantes.ts";

export { WEB_SERIE_MAX_PUNTOS, WEB_SSE_LATIDO_S } from "../../src/datos/constantes.ts";

/** 06 §T-630: el repetidor escucha donde apunta el proxy de Vite (`vite.config.ts`). */
export const REPETIDOR_PUERTO = 8787;
/** Solo la máquina local. Para probar desde un celular: `--host 0.0.0.0`. */
export const REPETIDOR_HOST = "127.0.0.1";
/** (P) Silencio entre el último mensaje del JSONL y el primero de la vuelta siguiente. */
export const PAUSA_ENTRE_VUELTAS_MS = 1000;
/** (P) Un hueco del relay son tantos periodos de tierra sin mensajes. */
const HUECO_PERIODOS_DE_TIERRA = 5;
/**
 * Un salto de `t_rel_ms` de al menos esto es un "hueco del relay" (escenario `relay_caido`).
 * En tierra el relay emite a `WEB_TASA_TIERRA_HZ`, así que ningún hueco normal pasa de un periodo.
 */
export const HUECO_RELAY_CAIDO_MIN_MS = (HUECO_PERIODOS_DE_TIERRA * 1000) / WEB_TASA_TIERRA_HZ;
/** (P) Máximo de mensajes que se reenvían al reanudar con `Last-Event-ID` (una vuelta larga cabe). */
export const REANUDAR_MAX_MENSAJES = 20_000;
/** (P) `Retry-After` de las respuestas 503 mientras el relay simula estar caído. */
export const REINTENTO_503_S = 5;
