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
 * Exageración del terreno en 3D. 1 = la real: es la única con la que la altura de la trayectoria
 * (metros sobre el suelo) y el relieve están a la misma escala.
 */
export const MAPA_3D_EXAGERACION = 1;
/** Inclinación con la que se entra en 3D, en grados. */
export const MAPA_3D_PITCH = 60;
/** Inclinación máxima permitida en 3D: con más se ve mucho horizonte, fuera del área con teselas. */
export const MAPA_3D_PITCH_MAX = 70;
/**
 * Tamaños de lo que se levanta en el aire, EN PÍXELES: los prismas se arman en metros con los metros por
 * píxel del zoom de dibujo (`MAPA_3D_ZOOM_PASO`), así que se ven del mismo tamaño a cualquier zoom.
 */
/** Radio del tubo de la trayectoria (el tubo mide el doble de ancho). */
export const MAPA_3D_TUBO_PX = 3;
/** Largo del cohete en 3D (cuerpo y ojiva). */
export const MAPA_3D_COHETE_PX = 40;
/** Radio de la plomada: la columna delgada del suelo al cohete. */
export const MAPA_3D_PLOMADA_PX = 1;
/** Alto de la estaca del impacto estimado. */
export const MAPA_3D_ESTACA_PX = 64;
/** Radio de la columna de la estaca y de su cabeza. */
export const MAPA_3D_ESTACA_RADIO_PX = 1.5;
export const MAPA_3D_ESTACA_CABEZA_PX = 7;
/** Lados de los polígonos circulares (cuerpo, ojiva y cabeza) y de los finos (plomada y estaca). */
export const MAPA_3D_LADOS = 12;
export const MAPA_3D_LADOS_FINOS = 6;
/**
 * Los prismas se rearman cuando el zoom pasa a otro múltiplo de esto (al terminar el zoom), no en cada
 * cuadro. Con 0,5 niveles miden entre 0,8 y 1,2 veces lo pedido.
 */
export const MAPA_3D_ZOOM_PASO = 0.5;
/** Tramos máximos del tubo: con más puntos se diezma (uno de cada k, y siempre el último). */
export const MAPA_3D_TUBO_MAX_SEGMENTOS = 400;
/** Un tramo largo o inclinado se parte en hasta esta cantidad de prismas para que siga la pendiente. */
export const MAPA_3D_TUBO_SUBDIV_MAX = 4;
/** Dos puntos a la misma posición y a menos de esta diferencia de altura (m) son el mismo punto. */
export const MAPA_3D_EPSILON_ALT_M = 0.5;
/**
 * Cuánto se aleja el zoom al "Ver todo" en 3D, respecto al que calcula MapLibre para un plano: con la
 * inclinación, lo que está cerca de la cámara se ve más grande y se saldría de los bordes.
 */
export const MAPA_3D_ZOOM_VER_TODO_MENOS = 0.35;
/** Valor de `opacityWhenCovered` de los marcadores: 1 = nunca se atenúan (GS-03), ni detrás de un cerro. */
export const MAPA_MARCADOR_OPACIDAD_TAPADO = 1;

/** Dibujo de la vista 3D (los colores salen de los tokens del tema). */
export const ESTILO_3D = {
  /** Opacidad del tubo, el cohete y la estaca: 1, porque los prismas se solapan (con menos se verían sus costuras). */
  opacidadSolidos: 1,
  /** Borde y relleno de la elipse de impacto en 3D, más marcados que en 2D (`ESTILO_MAPA`). */
  anchoElipse: 4,
  opacidadElipse: 0.3,
  /** La cabeza de la estaca mide esto (veces su radio) de alto. */
  estacaCabezaAlto: 0.8,
  /**
   * Las piezas del cohete: `[parte, radio, desde, hasta]`, con radio, desde y hasta en fracciones de su
   * largo, medidos desde su altura (el centro). La primera es el cuerpo y las demás, la ojiva.
   */
  cohete: [
    ["cuerpo", 0.16, -0.5, 0.15],
    ["ojiva", 0.12, 0.15, 0.28],
    ["ojiva", 0.08, 0.28, 0.4],
    ["ojiva", 0.04, 0.4, 0.5],
  ] as readonly (readonly [string, number, number, number])[],
  /** Cielo y neblina (0 a 1) con que el horizonte se funde con el fondo y no deja ver el borde del DEM. */
  cieloHorizonte: 0.2,
  neblinaHorizonte: 0.6,
  neblinaSuelo: 0.35,
  atmosfera: 0.3,
} as const;
