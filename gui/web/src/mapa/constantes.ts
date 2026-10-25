// Constantes del mapa (T-632). Son de presentación (zoom, relleno, desvanecido) y viven solo aquí;
// los umbrales `WEB_*` salen de `src/datos/constantes.ts`. Ningún otro archivo del mapa lleva números.
import { WEB_SERIE_MAX_PUNTOS } from "../datos/constantes";

/** Centro si aún no llegó `meta.sitio`: la zona de Santa Fe de Antioquia (05 §2.1). */
export const MAPA_CENTRO_POR_DEFECTO = { lat: 6.582, lon: -75.823 } as const;
/** Zoom con el que abre el mapa, centrado en la rampa. */
export const MAPA_ZOOM_INICIAL = 14.5;
/** Zoom máximo de la interfaz (el PMTiles llega a `MAPA_ZOOM_MAX_TEJAS`; lo demás es ampliación). */
export const MAPA_ZOOM_MAX = 18;
/** Zoom máximo al ajustar la vista a todo lo dibujado (evita acercarse al infinito si todo coincide). */
export const MAPA_ZOOM_AJUSTE_MAX = 16;
/** Zoom mínimo al "centrar en el cohete": si el usuario ya está más cerca, se respeta. */
export const MAPA_ZOOM_CENTRAR = 16;
/** Relleno de la vista al ajustar, en px. */
export const MAPA_RELLENO_PX = 56;
/** El mapa se pide cuando la sección está a esta distancia de entrar en pantalla (04 §2). */
export const MAPA_MARGEN_CARGA_PX = 200;
/** Ruta del PMTiles propio, relativa a `BASE_URL`. Puede reemplazarse con `VITE_MAPA_PMTILES_URL`. */
export const MAPA_PMTILES_RUTA = "mapas/santa_fe.pmtiles";
/** Tramos en que se parte la trayectoria para desvanecerla con el tiempo. */
export const MAPA_TRAMOS_DESVANECER = 8;
/** Opacidad del tramo más viejo de la trayectoria (el más nuevo es 1). */
export const MAPA_OPACIDAD_RASTRO_MIN = 0.15;
/** Vértices con que se dibuja la elipse de impacto. */
export const MAPA_PASOS_ELIPSE = 64;
/** Por debajo de esta velocidad horizontal el cohete no tiene un rumbo fiable. */
export const MAPA_VEL_MIN_RUMBO_MS = 0.5;
/** Puntos que guarda el rastro vivo (los `estado` recibidos entre dos snapshots). */
export const MAPA_RASTRO_MAX_PUNTOS = WEB_SERIE_MAX_PUNTOS * 2;
/** Dos posiciones más cerca que esto (en grados) se consideran la misma. */
export const MAPA_EPSILON_GRADOS = 1e-7;
/** Radio medio de la Tierra, para pasar metros a grados cerca de un punto (la elipse y el rumbo). */
export const RADIO_TIERRA_M = 6_371_008.8;
/** Respaldo de la duración de las animaciones si el tema no define `--dur-media`. */
export const MAPA_DUR_RESPALDO_MS = 300;

// ---- Dibujo (valores de presentación del estilo; los colores salen de los tokens del tema)

/** Una rampa por zoom: `[zoomMin, valorMin, zoomMax, valorMax]`. */
export type RampaZoom = readonly [number, number, number, number];

export const ESTILO_MAPA = {
  /** Opacidad del uso del suelo (parques, bosques). */
  opacidadUso: 0.5,
  /** Opacidad de las vías principales. */
  opacidadVias: 0.45,
  anchoRios: [10, 1, 16, 4] as RampaZoom,
  anchoViasMenores: [12, 0.5, 18, 5] as RampaZoom,
  anchoVias: [8, 0.75, 18, 8] as RampaZoom,
  radioLugar: 3,
  bordeLugar: 1,
  opacidadElipse: 0.12,
  anchoElipse: 2,
  guionElipse: [2, 2] as readonly number[],
  anchoLinea: 1.5,
  guionLinea: [3, 3] as readonly number[],
  anchoRastro: [10, 2, 18, 5] as RampaZoom,
} as const;
