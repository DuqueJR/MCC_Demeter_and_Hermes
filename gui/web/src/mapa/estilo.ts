// Estilo del mapa por tema (T-632). MapLibre pinta en un lienzo WebGL y necesita colores literales,
// pero la regla de 06 §6 los prohíbe fuera de `src/tema/`. Por eso el estilo se arma EN TIEMPO DE
// EJECUCIÓN con los tokens del tema, leídos de las variables CSS (`getComputedStyle`): un estilo
// por misión sale solo de sus tokens, y aquí no hay ningún color escrito.
import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { ESTILO_MAPA as E, MAPA_DUR_RESPALDO_MS, type RampaZoom } from "./constantes";

const MS_POR_S = 1000;

/** Los tokens que usa el mapa (02 §6), ya como cadenas CSS listas para MapLibre. */
export interface Tokens {
  fondo: string;
  superficie: string;
  superficie2: string;
  linea: string;
  texto: string;
  texto2: string;
  acento: string;
  marca1: string;
  /** Color de estado de la alarma (LKP). */
  alarma: string;
  /** Duración de las animaciones del tema, en ms (`--dur-media`). */
  duracionMs: number;
}

type ClaveColor = Exclude<keyof Tokens, "duracionMs">;

/** Nombre de la variable CSS de cada token de color. */
export const VARIABLES_TOKENS: Record<ClaveColor, string> = {
  fondo: "--fondo",
  superficie: "--superficie",
  superficie2: "--superficie-2",
  linea: "--linea",
  texto: "--texto",
  texto2: "--texto-2",
  acento: "--acento",
  marca1: "--marca-1",
  alarma: "--estado-alarma",
};
const VARIABLE_DURACION = "--dur-media";

/** `"320ms"` -> 320, `"0.3s"` -> 300; el respaldo si el valor no se entiende. */
export function duracionEnMs(valor: string): number {
  const m = /^\s*(\d*\.?\d+)\s*(ms|s)\s*$/i.exec(valor);
  if (!m) return MAPA_DUR_RESPALDO_MS;
  const n = Number.parseFloat(m[1] as string);
  return (m[2] as string).toLowerCase() === "s" ? n * MS_POR_S : n;
}

/**
 * Lee los tokens con `leer(nombreDeVariable)`. En el navegador `leer` es
 * `getComputedStyle(document.documentElement).getPropertyValue`. Si falta un token de color, falla
 * en voz alta: un mapa con un color inventado sería peor que no tener mapa.
 */
export function leerTokens(leer: (variable: string) => string): Tokens {
  const colores = {} as Record<ClaveColor, string>;
  for (const [clave, variable] of Object.entries(VARIABLES_TOKENS)) {
    const valor = leer(variable).trim();
    if (valor === "") throw new Error(`Falta el token ${variable} del tema`);
    colores[clave as ClaveColor] = valor;
  }
  return { ...colores, duracionMs: duracionEnMs(leer(VARIABLE_DURACION)) };
}

/** Tokens del documento actual (el tema de la misión está en `<html data-mision>`). */
export function leerTokensDelDocumento(): Tokens {
  const estilo = getComputedStyle(document.documentElement);
  return leerTokens((variable) => estilo.getPropertyValue(variable));
}

/** Ids de las fuentes del estilo, para actualizarlas desde el componente. */
export const FUENTE = {
  trayectoria: "trayectoria",
  elipse: "elipse",
  linea: "linea-estacion",
  base: "base",
} as const;

const vacia = { type: "FeatureCollection", features: [] } as const;

/** Interpolación lineal por zoom: `[zoomMin, valorMin, zoomMax, valorMax]`. */
function porZoom([z0, v0, z1, v1]: RampaZoom): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], z0, v0, z1, v1];
}

/** Filtro: el `kind` de la entidad (esquema de Protomaps) es uno de estos. */
const tipos = (...kinds: string[]): FilterSpecification => [
  "in",
  ["get", "kind"],
  ["literal", kinds],
];

/** Las capas del mapa base de Protomaps (agua, tierra, vías y lugares), a mano y con tokens. */
function capasBase(t: Tokens): LayerSpecification[] {
  const fuente = FUENTE.base;
  return [
    {
      id: "base-tierra",
      type: "fill",
      source: fuente,
      "source-layer": "earth",
      paint: { "fill-color": t.superficie },
    },
    {
      id: "base-uso",
      type: "fill",
      source: fuente,
      "source-layer": "landuse",
      paint: { "fill-color": t.superficie2, "fill-opacity": E.opacidadUso },
    },
    {
      id: "base-agua",
      type: "fill",
      source: fuente,
      "source-layer": "water",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": t.marca1 },
    },
    {
      id: "base-rios",
      type: "line",
      source: fuente,
      "source-layer": "water",
      filter: ["==", ["geometry-type"], "LineString"],
      paint: { "line-color": t.marca1, "line-width": porZoom(E.anchoRios) },
    },
    {
      id: "base-vias-menores",
      type: "line",
      source: fuente,
      "source-layer": "roads",
      filter: tipos("minor_road", "other", "path"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": t.linea, "line-width": porZoom(E.anchoViasMenores) },
    },
    {
      id: "base-vias",
      type: "line",
      source: fuente,
      "source-layer": "roads",
      filter: tipos("highway", "major_road", "medium_road"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": t.texto2,
        "line-opacity": E.opacidadVias,
        "line-width": porZoom(E.anchoVias),
      },
    },
    {
      id: "base-lugares",
      type: "circle",
      source: fuente,
      "source-layer": "places",
      filter: tipos("locality", "neighbourhood"),
      paint: {
        "circle-color": t.texto2,
        "circle-radius": E.radioLugar,
        "circle-stroke-color": t.fondo,
        "circle-stroke-width": E.bordeLugar,
      },
    },
  ];
}

/** Las capas propias de la misión, encima del mapa base. */
function capasMision(t: Tokens): LayerSpecification[] {
  return [
    {
      id: "elipse-relleno",
      type: "fill",
      source: FUENTE.elipse,
      paint: { "fill-color": t.texto, "fill-opacity": E.opacidadElipse },
    },
    {
      id: "elipse-borde",
      type: "line",
      source: FUENTE.elipse,
      paint: {
        "line-color": t.texto,
        "line-width": E.anchoElipse,
        "line-dasharray": [...E.guionElipse],
      },
    },
    {
      id: "linea-estacion",
      type: "line",
      source: FUENTE.linea,
      paint: {
        "line-color": t.texto2,
        "line-width": E.anchoLinea,
        "line-dasharray": [...E.guionLinea],
      },
    },
    {
      id: "trayectoria",
      type: "line",
      source: FUENTE.trayectoria,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": t.acento,
        "line-opacity": ["get", "op"],
        "line-width": porZoom(E.anchoRastro),
      },
    },
  ];
}

export interface BaseVectorial {
  /** URL del tilejson: `pmtiles://<url del archivo>`. */
  url: string;
  atribucion: string;
}

/** El estilo completo. Sin `base`, el mapa es solo el fondo del tema y las capas de la misión. */
export function construirEstilo(t: Tokens, base: BaseVectorial | null): StyleSpecification {
  return {
    version: 8,
    sources: {
      ...(base
        ? {
            [FUENTE.base]: {
              type: "vector" as const,
              url: base.url,
              attribution: base.atribucion,
            },
          }
        : {}),
      [FUENTE.trayectoria]: { type: "geojson", data: vacia },
      [FUENTE.elipse]: { type: "geojson", data: vacia },
      [FUENTE.linea]: { type: "geojson", data: vacia },
    },
    layers: [
      { id: "fondo", type: "background", paint: { "background-color": t.fondo } },
      ...(base ? capasBase(t) : []),
      ...capasMision(t),
    ],
  };
}
