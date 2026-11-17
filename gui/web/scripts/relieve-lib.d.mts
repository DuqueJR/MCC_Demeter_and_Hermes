export type Bbox = [number, number, number, number];

export interface RangoTeselas {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export interface Tesela {
  z: number;
  x: number;
  y: number;
}

export interface ImagenRgba {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface Malla {
  ancho: number;
  alto: number;
  valores: Float32Array;
}

export interface Ventana {
  x0: number;
  y0: number;
  ancho: number;
  alto: number;
}

export interface OpcionesCurvas {
  z: number;
  origenPx: { x: number; y: number };
  intervaloM: number;
  indiceCadaM: number;
  toleranciaPx: number;
  decimales: number;
}

export interface FeatureCurva {
  type: "Feature";
  properties: { ele: number; tipo: "indice" | "intermedia" };
  geometry: { type: "MultiLineString"; coordinates: number[][][] };
}

export interface ColeccionCurvas {
  type: "FeatureCollection";
  features: FeatureCurva[];
}

export const LADO_TESELA: number;
export function teselaFraccionaria(lon: number, lat: number, z: number): { x: number; y: number };
export function rangoDeTeselas(bbox: Bbox, z: number, margen?: number): RangoTeselas;
export function pixelALonLat(px: number, py: number, z: number): { lon: number; lat: number };
export function bboxDeRango(rango: RangoTeselas, z: number): Bbox;
export function listarTeselas(rango: RangoTeselas, z: number): Tesela[];
export function decodificarTerrarium(r: number, g: number, b: number): number;
export function codificarTerrarium(elevacion: number): [number, number, number];
export function elevacionesDeImagen(imagen: ImagenRgba): Float32Array;
export function ensamblarMosaico(
  rango: RangoTeselas,
  obtener: (x: number, y: number) => ImagenRgba,
): Malla;
export function ventanaDe(
  bbox: Bbox,
  rango: RangoTeselas,
  z: number,
  relleno: number,
  mosaico: Malla,
): Ventana;
export function recortar(mosaico: Malla, ventana: Ventana): Malla;
export function medianaTresPorTres(malla: Malla): Malla;
export function suavizar(malla: Malla, pasadas?: number): Malla;
export function simplificar(linea: number[][], tolerancia: number): number[][];
export function curvasDeNivel(malla: Malla, opciones: OpcionesCurvas): ColeccionCurvas;
