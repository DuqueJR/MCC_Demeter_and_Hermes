// Constantes del mapa (T-632). Son de presentación (zoom, relleno, desvanecido) y viven solo aquí;
// los umbrales `WEB_*` salen de `src/datos/constantes.ts`. Ningún otro archivo del mapa lleva números.
import { WEB_SERIE_MAX_PUNTOS } from "../datos/constantes";

/** Centro si aún no llegó `meta.sitio`: la zona de Santa Fe de Antioquia (05 §2.1). */
export const MAPA_CENTRO_POR_DEFECTO = { lat: 6.582, lon: -75.823 } as const;
/** Zoom con el que abre el mapa, centrado en la rampa. */
export const MAPA_ZOOM_INICIAL = 14.5;
/**
 * Zoom máximo SIN mapa base (no hay teselas que ampliar: solo la cuadrícula y las capas de la
 * misión). Con PMTiles manda el archivo: su `maxZoom` más `MAPA_SOBREZOOM` (`area.ts`).
 */
export const MAPA_ZOOM_MAX = 18;
/**
 * Niveles de zoom que se permite pasar del `maxZoom` del PMTiles (se amplía la tesela del último
 * nivel). El mapa es vectorial, así que no se pixela, pero no hay más detalle que el del último
 * nivel: con 1 nivel de más las calles se leen con comodidad; con 2 solo quedan líneas más
 * anchas y vacío (capturas de T-634 en la bitácora).
 */
export const MAPA_SOBREZOOM = 1;
/** Lado en px del mundo con zoom 0 en MapLibre (teselas de 512 px). */
export const MAPA_MUNDO_PX = 512;
/** Límites del área navegable: cuánto se meten hacia adentro del recuadro del PMTiles, como fracción de cada lado. */
export const MAPA_MARGEN_LIMITES = 0.02;
/**
 * Si lo dibujado (LKP, cohete, trayectoria, estación, elipse) cae fuera del área, o a menos de
 * esto del borde, el área se amplía para incluirlo (GS-03). Holgura mínima, en grados (unos 1,1 km).
 */
export const MAPA_MARGEN_INCLUIR_GRADOS = 0.01;
/**
 * La holgura de esa ampliación crece con el tamaño del conjunto: esta fracción de su lado más
 * largo. Al alejar el mapa para verlo todo, deja sitio para el marcador y su texto (unos 15 % de
 * la pantalla), que una holgura fija en grados no daría.
 */
export const MAPA_MARGEN_INCLUIR_FRACCION = 0.15;
/**
 * Sin PMTiles: mitad del lado del área navegable alrededor de `meta.sitio`, en grados. Es el mismo
 * recorte con que se genera el archivo (±0,05°, unos 11 × 11 km; README del módulo).
 */
export const MAPA_AREA_DEFECTO_GRADOS = 0.05;
/** Zoom máximo al ajustar la vista a todo lo dibujado (evita acercarse al infinito si todo coincide). */
export const MAPA_ZOOM_AJUSTE_MAX = 16;
/** Zoom mínimo al "centrar en el cohete": si el usuario ya está más cerca, se respeta. */
export const MAPA_ZOOM_CENTRAR = 16;
/** Relleno de la vista al ajustar, en px. */
export const MAPA_RELLENO_PX = 72;
/** El mapa se pide cuando la sección está a esta distancia de entrar en pantalla (04 §2). */
export const MAPA_MARGEN_CARGA_PX = 200;
/** Ruta del PMTiles propio, relativa a `BASE_URL`. Puede reemplazarse con `VITE_MAPA_PMTILES_URL`. */
export const MAPA_PMTILES_RUTA = "mapas/santa_fe.pmtiles";
/**
 * Tamaño máximo del PMTiles que se descarga completo (T-638). La meta del archivo es < 30 MB
 * (README del módulo): uno más grande no se baja entero en un celular; se descarta y el mapa usa
 * la cuadrícula de respaldo.
 */
export const MAPA_PMTILES_MAX_BYTES = 30 * 1024 * 1024;
/** Cuántas veces se reintenta la descarga del PMTiles si falla la red o el servidor (5xx). */
export const MAPA_PMTILES_REINTENTOS = 2;
/** Espera antes del primer reintento, en ms; se duplica en cada uno. */
export const MAPA_PMTILES_ESPERA_MS = 500;
/** Tiempo máximo de cada intento de descarga del PMTiles, en ms. */
export const MAPA_PMTILES_TIMEOUT_MS = 60_000;
/** Ancho máximo de la escala del mapa, en px. */
export const MAPA_ESCALA_MAX_PX = 96;
/** Cuadrícula de referencia (solo sin mapa base): separación entre líneas y radio, en grados. */
export const MAPA_CUADRICULA_PASO_GRADOS = 0.002;
export const MAPA_CUADRICULA_RADIO_GRADOS = 0.05;
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
  anchoCuadricula: 1,
} as const;

// ---- Relieve (T-649, D-W22): sombreado del terreno y curvas de nivel

/** Ruta de los metadatos del relieve, relativa a `BASE_URL`. Las teselas y las curvas cuelgan de su carpeta. */
export const MAPA_RELIEVE_RUTA = "mapas/relieve/relieve.json";
/** Tiempo máximo de cada petición del relieve, en ms. Si no llega, el mapa sigue sin él. */
export const MAPA_RELIEVE_TIMEOUT_MS = 20_000;
/**
 * Separación entre curvas de nivel, en metros. Es la que usa `scripts/generar-relieve.mjs`
 * (`INTERVALO_CURVAS_M`): una prueba comprueba que `relieve.json` coincida con estos valores.
 */
export const RELIEVE_CURVA_INTERVALO_M = 50;
/** Cada cuántos metros hay una curva índice (la más visible). Ídem `INDICE_CADA_M` del script. */
export const RELIEVE_CURVA_INDICE_M = 250;

export const ESTILO_RELIEVE = {
  /** Intensidad del sombreado (0 a 1): discreta, para que la trayectoria siga siendo lo más visible. */
  exageracion: 0.35,
  /** De dónde viene la luz, en grados desde el norte (315 = el noroeste, como en los mapas impresos). */
  direccionLuz: 315,
  /** Opacidad de las curvas intermedias y de las índice. */
  opacidadCurva: 0.55,
  opacidadCurvaIndice: 0.9,
  /** Ancho por zoom de las curvas intermedias y de las índice. */
  anchoCurva: [11, 0.3, 17, 0.9] as RampaZoom,
  anchoCurvaIndice: [11, 0.7, 17, 1.6] as RampaZoom,
  /** Las curvas intermedias aparecen desde este zoom; con menos, solo las índice (si no, se empastan). */
  zoomCurvaIntermedia: 13,
} as const;

// ---- Vista 3D opcional (T-656, D-W23): terreno con relieve y trayectoria en el aire

/**
 * Exageración del terreno en 3D. 1 = la real: es la única con la que la altura de la cortina de la
 * trayectoria (metros sobre el suelo) y el relieve están a la misma escala.
 */
export const MAPA_3D_EXAGERACION = 1;
/** Inclinación con la que se entra en 3D, en grados. */
export const MAPA_3D_PITCH = 60;
/** Inclinación máxima permitida en 3D: con más se ve mucho horizonte, fuera del área con teselas. */
export const MAPA_3D_PITCH_MAX = 70;
/** Ancho de la cortina de la trayectoria (cada segmento es un polígono de este ancho), en metros. */
export const MAPA_3D_ANCHO_CORTINA_M = 12;
/** Segmentos máximos de la cortina: con más puntos se diezma (se conserva uno de cada k y el último). */
export const MAPA_3D_CORTINA_MAX_SEGMENTOS = 500;
/**
 * Cuánto se aleja el zoom al "Ver todo" en 3D, respecto al que calcula MapLibre para un plano: con la
 * inclinación, lo que está cerca de la cámara se ve más grande y se saldría de los bordes.
 */
export const MAPA_3D_ZOOM_VER_TODO_MENOS = 0.35;
/** Valor de `opacityWhenCovered` de los marcadores: 1 = nunca se atenúan (GS-03), ni detrás de un cerro. */
export const MAPA_MARCADOR_OPACIDAD_TAPADO = 1;

/** Dibujo de la vista 3D (los colores salen de los tokens del tema). */
export const ESTILO_3D = {
  /** Opacidad de la cortina de la trayectoria (`fill-extrusion-opacity`: no admite datos por punto). */
  opacidadCortina: 0.55,
  /** Cielo y neblina (0 a 1) con que el horizonte se funde con el fondo y no deja ver el borde del DEM. */
  cieloHorizonte: 0.2,
  neblinaHorizonte: 0.6,
  neblinaSuelo: 0.35,
  atmosfera: 0.3,
} as const;
