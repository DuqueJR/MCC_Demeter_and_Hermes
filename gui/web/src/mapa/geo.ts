// Lógica del mapa que no depende del navegador (T-632): arma el GeoJSON de cada capa y los
// marcadores desde las signals de `datos/api.ts`, y decide si toca LKP (GS-03).
// Todo son funciones puras: se prueban con Vitest, sin MapLibre ni DOM.
import type { Estacion, Estado, Meta, Serie } from "../contrato/tipos";
import type { EstadoPrincipal } from "../datos/estado_pagina";
import { hace, numero } from "../mision/formato";
import {
  MAPA_3D_COHETE_ANGULO_DIBUJO,
  MAPA_3D_COHETE_MIN_PX,
  MAPA_3D_EPSILON_ALT_M,
  MAPA_3D_LINEA_MAX_SEGMENTOS,
  MAPA_3D_VEL_MIN_MS,
  MAPA_CUADRICULA_PASO_GRADOS,
  MAPA_CUADRICULA_RADIO_GRADOS,
  MAPA_EPSILON_GRADOS,
  MAPA_MUNDO_PX,
  MAPA_OPACIDAD_RASTRO_MIN,
  MAPA_PASOS_ELIPSE,
  MAPA_RASTRO_MAX_PUNTOS,
  MAPA_TRAMOS_DESVANECER,
  MAPA_VEL_MIN_RUMBO_MS,
  RADIO_TIERRA_M,
} from "./constantes";

const GRADOS_VUELTA = 360;
const GRADOS_MEDIA_VUELTA = 180;
const GRADOS_POR_SECTOR = 45;
const M_POR_KM = 1000;
const CARDINALES = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"] as const;

/** Una coordenada en el orden de GeoJSON: `[longitud, latitud]`. */
export type Coord = [lon: number, lat: number];
/** `[oeste, sur, este, norte]`. */
export type Limites = [number, number, number, number];

// ---- GeoJSON mínimo, estructural: lo acepta `GeoJSONSource.setData` sin depender de @types/geojson.
export interface Caracteristica<G, P> {
  type: "Feature";
  properties: P;
  geometry: G;
}
export interface Coleccion<G, P> {
  type: "FeatureCollection";
  features: Caracteristica<G, P>[];
}
export interface Linea {
  type: "LineString";
  coordinates: Coord[];
}
export interface Poligono {
  type: "Polygon";
  coordinates: Coord[][];
}
export type ColeccionLineas = Coleccion<Linea, { op: number }>;
export type ColeccionPoligonos = Coleccion<Poligono, Record<string, never>>;

const coleccion = <G, P>(features: Caracteristica<G, P>[]): Coleccion<G, P> => ({
  type: "FeatureCollection",
  features,
});

// ---- Entrada y decisión de LKP

/** Lo que el mapa lee de `datos/api.ts`. */
export interface EntradaMapa {
  sitio: Meta["sitio"] | null;
  estado: Estado | null;
  estacion: Estacion | null;
  serie: Serie;
  principal: EstadoPrincipal;
  /** Edad del último dato del cohete (`api.edad`), en ms. */
  edadMs: number | null;
}

/** Una posición del cohete y de dónde salió. */
export interface PuntoPos {
  lat: number;
  lon: number;
  alt_agl_m: number | null;
  utc_ms: number | null;
  origen: "lkp" | "pos" | "serie";
}

export interface DecisionLkp {
  /** Toca dibujar el marcador rojo fijo en vez del cohete. */
  activo: boolean;
  /** La última posición conocida; `null` si el cohete nunca tuvo una. */
  punto: PuntoPos | null;
  /** Hace cuánto se supo de ella (para "hace X s"); `null` si no se puede saber sin el reloj del celular. */
  edadMs: number | null;
}

const SIN_LKP: DecisionLkp = { activo: false, punto: null, edadMs: null };

/** Índice del último punto de la serie con latitud y longitud. */
function ultimoIndiceConPosicion(serie: Serie): number {
  for (let i = serie.lat.length - 1; i >= 0; i--) {
    if (serie.lat[i] != null && serie.lon[i] != null) return i;
  }
  return -1;
}

/**
 * La última posición conocida del cohete: `estado.lkp` (la última con fix válido, PA-22); si el
 * servicio no la manda, `estado.pos`; y, si tampoco, el último punto de la `serie`.
 */
export function ultimaPosicionConocida(e: EntradaMapa): PuntoPos | null {
  const lkp = e.estado?.lkp;
  if (lkp) {
    return {
      lat: lkp.lat,
      lon: lkp.lon,
      alt_agl_m: lkp.alt_agl_m,
      utc_ms: lkp.utc_ms,
      origen: "lkp",
    };
  }
  const pos = e.estado?.pos;
  if (pos) {
    return {
      lat: pos.lat,
      lon: pos.lon,
      alt_agl_m: pos.alt_agl_m,
      utc_ms: e.estado?.utc_ms ?? null,
      origen: "pos",
    };
  }
  const i = ultimoIndiceConPosicion(e.serie);
  if (i < 0) return null;
  return {
    lat: e.serie.lat[i] as number,
    lon: e.serie.lon[i] as number,
    alt_agl_m: e.serie.alt_agl_m[i] ?? null,
    utc_ms: null,
    origen: "serie",
  };
}

/** Antigüedad del LKP sin usar el reloj del celular (05 §0). */
function edadDelLkp(e: EntradaMapa, punto: PuntoPos | null): number | null {
  if (e.principal === "sin_senal" || e.principal === "sin_servidor") return e.edadMs;
  const ahora = e.estado?.utc_ms;
  if (ahora != null && punto?.utc_ms != null) return Math.max(0, ahora - punto.utc_ms);
  return null;
}

/**
 * ¿Toca LKP? (03 §3.4 y §4.) Sí cuando la página está en `sin_senal` o cuando `estado.pos` llega
 * en `null`. Si ya estaba en LKP y se cae el servidor (`sin_servidor`), se conserva: no sabemos si
 * volvió el cohete, y el LKP nunca se borra por un problema de la red del celular (GS-03).
 * `previo` es la decisión anterior: si ya no hay de dónde sacar la posición, se queda la anterior.
 */
export function decidirLkp(e: EntradaMapa, previo: DecisionLkp | null): DecisionLkp {
  const sinPosicion = e.estado !== null && e.estado.pos === null;
  const retener = previo?.activo === true && e.principal === "sin_servidor";
  if (e.principal !== "sin_senal" && !sinPosicion && !retener) return SIN_LKP;
  const punto = ultimaPosicionConocida(e) ?? previo?.punto ?? null;
  return { activo: true, punto, edadMs: edadDelLkp(e, punto) };
}

// ---- Geometría local (metros <-> grados cerca de un punto)

const aRadianes = (grados: number) => (grados * Math.PI) / GRADOS_MEDIA_VUELTA;
const aGrados = (radianes: number) => (radianes * GRADOS_MEDIA_VUELTA) / Math.PI;
/** Metros por grado de latitud (y de longitud en el ecuador). */
const M_POR_GRADO = aRadianes(RADIO_TIERRA_M);

/** Desplaza `centro` `este_m` metros al este y `norte_m` al norte (plano local). */
function desplazar(centro: Coord, este_m: number, norte_m: number): Coord {
  const [lon, lat] = centro;
  return [lon + este_m / (M_POR_GRADO * Math.cos(aRadianes(lat))), lat + norte_m / M_POR_GRADO];
}

/** Elipse de impacto como polígono cerrado. `rumbo_deg` es el azimut del semieje mayor. */
export function poligonoElipse(
  el: NonNullable<Estado["calc"]["elipse"]>,
  pasos: number = MAPA_PASOS_ELIPSE,
): Poligono {
  const rumbo = aRadianes(el.rumbo_deg);
  const mayor: [number, number] = [Math.sin(rumbo), Math.cos(rumbo)]; // [este, norte]
  const menor: [number, number] = [Math.cos(rumbo), -Math.sin(rumbo)];
  const anillo: Coord[] = [];
  for (let i = 0; i < pasos; i++) {
    const t = (2 * Math.PI * i) / pasos;
    const a = el.semieje_mayor_m * Math.cos(t);
    const b = el.semieje_menor_m * Math.sin(t);
    anillo.push(
      desplazar([el.lon, el.lat], a * mayor[0] + b * menor[0], a * mayor[1] + b * menor[1]),
    );
  }
  anillo.push([...(anillo[0] as Coord)]);
  return { type: "Polygon", coordinates: [anillo] };
}

/** Azimut (0 a 360, desde el norte, horario) de `a` hacia `b`, o `null` si coinciden. */
export function rumboEntre(a: Coord, b: Coord): number | null {
  const norte = b[1] - a[1];
  const este = (b[0] - a[0]) * Math.cos(aRadianes(a[1]));
  if (Math.hypot(norte, este) < MAPA_EPSILON_GRADOS) return null;
  return (aGrados(Math.atan2(este, norte)) + GRADOS_VUELTA) % GRADOS_VUELTA;
}

/** Rumbo del cohete: el de su velocidad horizontal; si es muy lenta, el del rastro; si no, ninguno. */
export function rumboDelCohete(estado: Estado, rastro: Coord[]): number | null {
  const v = estado.vel;
  if (v && Math.hypot(v.e_ms, v.n_ms) >= MAPA_VEL_MIN_RUMBO_MS) {
    return (aGrados(Math.atan2(v.e_ms, v.n_ms)) + GRADOS_VUELTA) % GRADOS_VUELTA;
  }
  for (let i = rastro.length - 1; i > 0; i--) {
    const r = rumboEntre(rastro[i - 1] as Coord, rastro[i] as Coord);
    if (r !== null) return r;
  }
  return null;
}

// ---- Trayectoria

/** Los puntos de la `serie` que tienen posición, en orden. */
export function puntosDeSerie(serie: Serie): Coord[] {
  const puntos: Coord[] = [];
  for (let i = 0; i < serie.lat.length; i++) {
    const lat = serie.lat[i];
    const lon = serie.lon[i];
    if (lat != null && lon != null) puntos.push([lon, lat]);
  }
  return puntos;
}

/**
 * Agrega un punto al rastro vivo (los `estado` que llegan entre dos snapshots). No repite el
 * último punto y, si se pasa del máximo, conserva uno de cada dos (la forma se mantiene).
 */
export function agregarPunto(
  rastro: Coord[],
  punto: Coord,
  max: number = MAPA_RASTRO_MAX_PUNTOS,
): Coord[] {
  const ultimo = rastro[rastro.length - 1];
  if (
    ultimo &&
    Math.abs(ultimo[0] - punto[0]) < MAPA_EPSILON_GRADOS &&
    Math.abs(ultimo[1] - punto[1]) < MAPA_EPSILON_GRADOS
  ) {
    return rastro;
  }
  const nuevo = [...rastro, punto];
  if (nuevo.length <= max) return nuevo;
  return nuevo.filter((_, i) => i % 2 === 0 || i === nuevo.length - 1);
}

/**
 * La trayectoria partida en tramos de opacidad creciente: el más viejo casi se desvanece y el más
 * nuevo es opaco. Los tramos comparten su punto de unión, así que la línea no se corta.
 */
export function tramosDesvanecidos(
  coords: Coord[],
  tramos: number = MAPA_TRAMOS_DESVANECER,
  opacidadMin: number = MAPA_OPACIDAD_RASTRO_MIN,
): ColeccionLineas {
  if (coords.length < 2) return coleccion([]);
  const segmentos = coords.length - 1;
  const n = Math.min(tramos, segmentos);
  const features: Caracteristica<Linea, { op: number }>[] = [];
  for (let k = 0; k < n; k++) {
    const desde = Math.floor((k * segmentos) / n);
    const hasta = Math.floor(((k + 1) * segmentos) / n);
    features.push({
      type: "Feature",
      properties: { op: opacidadMin + ((1 - opacidadMin) * (k + 1)) / n },
      geometry: { type: "LineString", coordinates: coords.slice(desde, hasta + 1) },
    });
  }
  return coleccion(features);
}

// ---- Trayectoria y cohete en el aire (vista 3D, T-656)
// Lo dibuja la capa personalizada de `capa3d.ts`; aquí está lo que se puede probar sin WebGL: los
// puntos con altura, las coordenadas de Mercator, la altura de dibujo, el armado del búfer de la línea,
// la proyección a píxeles y el ángulo de la imagen del cohete.

/** Un punto de la trayectoria con su altura sobre el suelo (`alt_agl_m`). */
export interface PuntoAlt {
  lon: number;
  lat: number;
  alt_agl_m: number | null;
}

/** Los puntos de la `serie` que tienen posición (los mismos de `puntosDeSerie`), con su altura. */
export function puntosAltDeSerie(serie: Serie): PuntoAlt[] {
  const puntos: PuntoAlt[] = [];
  for (let i = 0; i < serie.lat.length; i++) {
    const lat = serie.lat[i];
    const lon = serie.lon[i];
    if (lat != null && lon != null)
      puntos.push({ lon, lat, alt_agl_m: serie.alt_agl_m[i] ?? null });
  }
  return puntos;
}

/** ¿Los dos puntos coinciden (en el plano y en altura)? Un ascenso vertical NO es repetir el punto. */
function mismoPunto(a: PuntoAlt, b: PuntoAlt): boolean {
  return (
    Math.abs(a.lon - b.lon) < MAPA_EPSILON_GRADOS &&
    Math.abs(a.lat - b.lat) < MAPA_EPSILON_GRADOS &&
    Math.abs((a.alt_agl_m ?? 0) - (b.alt_agl_m ?? 0)) < MAPA_3D_EPSILON_ALT_M
  );
}

/**
 * Agrega un punto al rastro con altura (los `estado` que llegan entre dos snapshots). A diferencia de
 * `agregarPunto`, un punto en la misma posición pero a otra altura SÍ cuenta: en el ascenso casi
 * vertical la posición casi no cambia y la trayectoria en el aire es justamente la altura. Si se pasa
 * del máximo, conserva uno de cada dos.
 */
export function agregarPuntoAlt(
  rastro: PuntoAlt[],
  punto: PuntoAlt,
  max: number = MAPA_RASTRO_MAX_PUNTOS,
): PuntoAlt[] {
  const ultimo = rastro[rastro.length - 1];
  if (ultimo && mismoPunto(ultimo, punto)) return rastro;
  const nuevo = [...rastro, punto];
  if (nuevo.length <= max) return nuevo;
  return nuevo.filter((_, i) => i % 2 === 0 || i === nuevo.length - 1);
}

/** Metros que mide un píxel a `zoom` (teselas de 512 px) en la latitud `latGrados`. */
export function metrosPorPixel(zoom: number, latGrados: number): number {
  const circunferencia = 2 * Math.PI * RADIO_TIERRA_M * Math.cos(aRadianes(latGrados));
  return circunferencia / (MAPA_MUNDO_PX * 2 ** zoom);
}

// ---- Coordenadas de Mercator (las de MapLibre: [0, 1] en x e y, con el norte hacia y = 0)

/** `[lon, lat]` a Mercator (`MercatorCoordinate.fromLngLat` de MapLibre, sin la altura). */
export function aMercator(lon: number, lat: number): { x: number; y: number } {
  const lat_rad = aRadianes(lat);
  return {
    x: (lon + GRADOS_MEDIA_VUELTA) / GRADOS_VUELTA,
    y: 0.5 - Math.log(Math.tan(Math.PI / 4 + lat_rad / 2)) / (2 * Math.PI),
  };
}

/** Lo que mide un metro en unidades de Mercator a esa latitud (`meterInMercatorCoordinateUnits`). */
export function metroEnMercator(latGrados: number): number {
  return 1 / (2 * Math.PI * RADIO_TIERRA_M * Math.cos(aRadianes(latGrados)));
}

/**
 * La altura (m sobre el nivel del mar, la que usa el terreno de MapLibre) a la que se dibuja un punto del
 * aire: la elevación del terreno en la rampa MÁS la altura sobre la rampa (`alt_agl_m`) por la
 * exageración. `alt_agl_m` se mide desde la rampa, así que se suma a la elevación de la rampa y no a la
 * del suelo que haya debajo de cada punto. `elevacionBaseM` ya viene multiplicada por la exageración
 * (`queryTerrainElevation` la incluye).
 */
export function alturaDeDibujo(
  elevacionBaseM: number,
  altAglM: number,
  exageracion: number,
): number {
  return elevacionBaseM + altAglM * exageracion;
}

type PuntoConAlt = PuntoAlt & { alt_agl_m: number };

/** Los puntos con altura, sin los de `alt_agl_m` nulo ni los repetidos (misma posición y altura). */
function puntosUtilesConAltura(puntos: readonly PuntoAlt[]): PuntoConAlt[] {
  const utiles: PuntoConAlt[] = [];
  for (const p of puntos) {
    if (p.alt_agl_m === null || !Number.isFinite(p.alt_agl_m)) continue;
    const ultimo = utiles[utiles.length - 1];
    if (ultimo && mismoPunto(ultimo, p)) continue;
    utiles.push(p as PuntoConAlt);
  }
  return utiles;
}

/** Conserva uno de cada `k` puntos y siempre el último, para que haya a lo sumo `maxSegmentos` segmentos. */
function diezmarSegmentos<T>(puntos: T[], maxSegmentos: number): T[] {
  const segmentos = puntos.length - 1;
  if (segmentos <= maxSegmentos) return puntos;
  const k = Math.ceil(segmentos / maxSegmentos);
  return puntos.filter((_, i) => i % k === 0 || i === puntos.length - 1);
}

/** Cuántos números lleva cada vértice del búfer de la línea: posición (3), el otro extremo (3) y 4 atributos. */
export const FLOATS_POR_VERTICE = 10;
/** Vértices por segmento: dos triángulos. */
export const VERTICES_POR_SEGMENTO = 6;

/** Lo que necesita el armado del búfer. Las posiciones salen RELATIVAS al origen, en unidades de Mercator. */
export interface ContextoLinea {
  /** El origen (la rampa) en Mercator: se resta a todo, para que `float32` no pierda precisión. */
  origen: { x: number; y: number };
  /** Lo que mide un metro en Mercator en el origen (`metroEnMercator`). */
  metroMercator: number;
  exageracion: number;
}

export interface BufferLinea {
  /** Vértices intercalados: `FLOATS_POR_VERTICE` números por vértice. */
  datos: Float32Array;
  segmentos: number;
}

/** Un vértice de un segmento: `pos` es el extremo de este vértice y `otro`, el opuesto. */
function escribirVertice(
  d: Float32Array,
  i: number,
  pos: readonly [number, number, number],
  otro: readonly [number, number, number],
  lado: number,
  f: number,
  s: number,
  extremo: number,
): void {
  d.set(pos, i);
  d.set(otro, i + 3);
  d[i + 6] = lado;
  d[i + 7] = f;
  d[i + 8] = s;
  d[i + 9] = extremo;
}

/** Los seis vértices de un segmento de `a` a `b` (un rectángulo de dos triángulos que el shader engrosa). */
function escribirSegmento(
  d: Float32Array,
  desde: number,
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  f: number,
  sA: number,
  sB: number,
): void {
  const n = FLOATS_POR_VERTICE;
  escribirVertice(d, desde, a, b, -1, f, sA, 0);
  escribirVertice(d, desde + n, a, b, 1, f, sA, 0);
  escribirVertice(d, desde + 2 * n, b, a, -1, f, sB, 1);
  escribirVertice(d, desde + 3 * n, b, a, -1, f, sB, 1);
  escribirVertice(d, desde + 4 * n, a, b, 1, f, sA, 0);
  escribirVertice(d, desde + 5 * n, b, a, 1, f, sB, 1);
}

/** Un punto del aire en Mercator relativo al origen: x, y y la altura sobre la elevación base (z). */
function relativoAlOrigen(
  lon: number,
  lat: number,
  altM: number,
  c: ContextoLinea,
): [number, number, number] {
  const m = aMercator(lon, lat);
  return [m.x - c.origen.x, m.y - c.origen.y, altM * c.exageracion * c.metroMercator];
}

/**
 * El búfer de la línea de la trayectoria en el aire: un rectángulo (dos triángulos) por segmento, que el
 * *shader* engrosa a un ancho constante en pantalla. Salta los puntos con `alt_agl_m` nulo y los repetidos
 * (misma posición Y altura: el ascenso vertical se conserva) y diezma por encima de `maxSegmentos`.
 * Cada segmento lleva `f` (0 lo más viejo, 1 lo más nuevo) para el degradado.
 */
export function construirBufferLinea(
  puntos: readonly PuntoAlt[],
  c: ContextoLinea,
  maxSegmentos: number = MAPA_3D_LINEA_MAX_SEGMENTOS,
): BufferLinea {
  const utiles = diezmarSegmentos(puntosUtilesConAltura(puntos), maxSegmentos);
  const segmentos = Math.max(0, utiles.length - 1);
  const datos = new Float32Array(segmentos * VERTICES_POR_SEGMENTO * FLOATS_POR_VERTICE);
  for (let i = 0; i < segmentos; i++) {
    const [a, b] = [utiles[i], utiles[i + 1]] as [PuntoConAlt, PuntoConAlt];
    escribirSegmento(
      datos,
      i * VERTICES_POR_SEGMENTO * FLOATS_POR_VERTICE,
      relativoAlOrigen(a.lon, a.lat, a.alt_agl_m, c),
      relativoAlOrigen(b.lon, b.lat, b.alt_agl_m, c),
      segmentos > 1 ? i / (segmentos - 1) : 1,
      0,
      0,
    );
  }
  return { datos, segmentos };
}

/**
 * La plomada: un segmento vertical del cohete (a `altM` sobre la rampa) al suelo que tiene debajo, a
 * `zSueloM` metros sobre la elevación base (negativo si el suelo queda más bajo que la rampa). Lleva en
 * `s` la distancia en metros a lo largo, para punteado. `null` si no mide casi nada.
 */
export function construirBufferPlomada(
  pos: Coord,
  altM: number,
  zSueloM: number,
  c: ContextoLinea,
): BufferLinea | null {
  const largo = altM * c.exageracion - zSueloM;
  if (!(largo > MAPA_3D_EPSILON_ALT_M)) return null;
  const m = aMercator(pos[0], pos[1]);
  const [x, y] = [m.x - c.origen.x, m.y - c.origen.y];
  const datos = new Float32Array(VERTICES_POR_SEGMENTO * FLOATS_POR_VERTICE);
  escribirSegmento(
    datos,
    0,
    [x, y, altM * c.exageracion * c.metroMercator],
    [x, y, zSueloM * c.metroMercator],
    1,
    0,
    largo,
  );
  return { datos, segmentos: 1 };
}

/**
 * Una matriz de 4 × 4 (por columnas) que pasa de Mercator RELATIVO a `origen` a espacio de recorte:
 * es la de MapLibre (Mercator a recorte) por la traslación al origen. Se calcula en doble precisión.
 */
export function matrizRelativa(
  m: ArrayLike<number>,
  origen: readonly [number, number, number],
): Float64Array {
  const r = new Float64Array(16);
  for (let i = 0; i < 12; i++) r[i] = m[i] as number;
  for (let fila = 0; fila < 4; fila++) {
    r[12 + fila] =
      (m[fila] as number) * origen[0] +
      (m[4 + fila] as number) * origen[1] +
      (m[8 + fila] as number) * origen[2] +
      (m[12 + fila] as number);
  }
  return r;
}

/** Un punto proyectado a píxeles de pantalla (CSS, con el origen arriba a la izquierda). */
export interface PuntoPantalla {
  x: number;
  y: number;
  /** Cae dentro del lienzo. */
  dentro: boolean;
}

/** Proyecta `p` con la matriz (por columnas) a píxeles; `null` si queda detrás de la cámara (`w` <= 0). */
export function proyectarAPixeles(
  m: ArrayLike<number>,
  p: readonly [number, number, number],
  ancho: number,
  alto: number,
): PuntoPantalla | null {
  const [x, y, z] = p;
  const w = (m[3] as number) * x + (m[7] as number) * y + (m[11] as number) * z + (m[15] as number);
  if (!(w > 0)) return null;
  const nx =
    ((m[0] as number) * x + (m[4] as number) * y + (m[8] as number) * z + (m[12] as number)) / w;
  const ny =
    ((m[1] as number) * x + (m[5] as number) * y + (m[9] as number) * z + (m[13] as number)) / w;
  return {
    x: ((nx + 1) / 2) * ancho,
    y: ((1 - ny) / 2) * alto,
    dentro: Math.abs(nx) <= 1 && Math.abs(ny) <= 1,
  };
}

/** Lleva un ángulo a (-180, 180]. */
function normalizarAngulo(grados: number): number {
  const g =
    (((grados % GRADOS_VUELTA) + GRADOS_VUELTA + GRADOS_MEDIA_VUELTA) % GRADOS_VUELTA) -
    GRADOS_MEDIA_VUELTA;
  return g === -GRADOS_MEDIA_VUELTA ? GRADOS_MEDIA_VUELTA : g;
}

/**
 * El giro (grados, sentido de las agujas del reloj, el `rotate()` de CSS) de la imagen del cohete para que
 * su nariz apunte hacia donde se mueve EN PANTALLA: de `p0` (el cohete) a `p1` (un punto un poco adelante,
 * ya proyectados). La imagen trae la nariz a `anguloDibujo` grados de la vertical, así que se le resta. Sin
 * los dos puntos o con un vector muy corto (`minPx`) no hay rumbo fiable y queda vertical (nariz arriba).
 */
export function anguloDeImagen(
  p0: { x: number; y: number } | null,
  p1: { x: number; y: number } | null,
  minPx: number = MAPA_3D_COHETE_MIN_PX,
  anguloDibujo: number = MAPA_3D_COHETE_ANGULO_DIBUJO,
): number {
  return anguloFiable(p0, p1, minPx, anguloDibujo) ?? normalizarAngulo(-anguloDibujo);
}

/** Como `anguloDeImagen`, pero `null` si no hay rumbo fiable (faltan puntos o el vector es muy corto). */
export function anguloFiable(
  p0: { x: number; y: number } | null,
  p1: { x: number; y: number } | null,
  minPx: number = MAPA_3D_COHETE_MIN_PX,
  anguloDibujo: number = MAPA_3D_COHETE_ANGULO_DIBUJO,
): number | null {
  if (!p0 || !p1) return null;
  const [dx, dy] = [p1.x - p0.x, p1.y - p0.y];
  if (Math.hypot(dx, dy) < minPx) return null;
  // La pantalla crece hacia abajo: "arriba" es -y, y el ángulo desde arriba crece hacia la derecha.
  return normalizarAngulo((Math.atan2(dx, -dy) * GRADOS_MEDIA_VUELTA) / Math.PI - anguloDibujo);
}

/**
 * El ángulo de la imagen del cohete con memoria: si hay rumbo fiable, ese; si no (sin velocidad fiable o
 * un vector muy corto, como justo en el apogeo), el último ángulo válido (`ultimo`), para que la imagen
 * no salte a vertical y vuelva; y si nunca hubo uno, vertical con la nariz arriba.
 */
export function anguloConMemoria(
  p0: { x: number; y: number } | null,
  p1: { x: number; y: number } | null,
  ultimo: number | null,
  minPx: number = MAPA_3D_COHETE_MIN_PX,
  anguloDibujo: number = MAPA_3D_COHETE_ANGULO_DIBUJO,
): { angulo: number; fiable: boolean } {
  const nuevo = anguloFiable(p0, p1, minPx, anguloDibujo);
  if (nuevo !== null) return { angulo: nuevo, fiable: true };
  return { angulo: ultimo ?? normalizarAngulo(-anguloDibujo), fiable: false };
}

/**
 * Acerca `actual` a `objetivo` por el camino corto (nunca da la vuelta larga) con una suavización
 * exponencial de constante `tauMs`, tras `dtMs` ms. Con `tauMs` <= 0 salta directo. Devuelve el ángulo en
 * (-180, 180]; si ya está a menos de 0,1°, el objetivo exacto.
 */
export function suavizarAngulo(
  actual: number,
  objetivo: number,
  dtMs: number,
  tauMs: number,
): number {
  const dif = normalizarAngulo(objetivo - actual);
  if (!(tauMs > 0) || Math.abs(dif) < 0.1) return objetivo;
  const factor = 1 - Math.exp(-Math.max(0, dtMs) / tauMs);
  return normalizarAngulo(actual + dif * factor);
}

/**
 * La dirección del movimiento en 3D, `[este, norte, arriba]` unitario, para orientar la imagen del cohete
 * en TODAS las fases de vuelo (también en la bajada, con la nariz hacia abajo); `null` si no hay
 * velocidad o la rapidez no es fiable (`MAPA_3D_VEL_MIN_MS`).
 */
export function direccionDeVelocidad(
  vel: { e_ms: number; n_ms: number; u_ms: number } | null,
): [number, number, number] | null {
  if (!vel) return null;
  const rapidez = Math.hypot(vel.e_ms, vel.n_ms, vel.u_ms);
  if (!(rapidez >= MAPA_3D_VEL_MIN_MS)) return null;
  return [vel.e_ms / rapidez, vel.n_ms / rapidez, vel.u_ms / rapidez];
}

/**
 * Un color CSS de un token (en hexadecimal corto o largo, o con la función de rojo, verde y azul) a `[r, g, b]` en 0 a 1 para WebGL;
 * `null` si no se entiende (no se inventa un color).
 */
export function colorARgb(css: string): [number, number, number] | null {
  const t = css.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
  if (hex) {
    const h =
      (hex[1] as string).length === 3
        ? (hex[1] as string).replace(/./g, "$&$&")
        : (hex[1] as string);
    return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
  }
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/i.exec(t);
  if (rgb)
    return [1, 2, 3].map((i) => Number.parseFloat(rgb[i] as string) / 255) as [
      number,
      number,
      number,
    ];
  return null;
}

/**
 * La caja que contiene la trayectoria vista desde `pitchDeg` grados de inclinación y con el norte
 * arriba: además de los puntos del suelo, cada punto con altura `h` se corre `h * tan(pitch)` al
 * norte, que es donde la cortina asoma por arriba en la pantalla. Es lo que "Ver todo" y el área
 * navegable deben abarcar en 3D para que la parte alta de la trayectoria no quede fuera (GS-03).
 * `null` si no hay puntos.
 */
export function limitesConAltura(puntos: readonly PuntoAlt[], pitchDeg: number): Limites | null {
  const tangente = Math.tan(aRadianes(pitchDeg));
  const coords: Coord[] = [];
  for (const p of puntos) {
    coords.push([p.lon, p.lat]);
    if (p.alt_agl_m !== null && Number.isFinite(p.alt_agl_m) && p.alt_agl_m > 0) {
      coords.push(desplazar([p.lon, p.lat], 0, p.alt_agl_m * tangente));
    }
  }
  return limitesDe(coords);
}

// ---- Etiquetas

/** `271` -> `"O"`. */
export function cardinal(azimutDeg: number): string {
  const i = Math.round(
    (((azimutDeg % GRADOS_VUELTA) + GRADOS_VUELTA) % GRADOS_VUELTA) / GRADOS_POR_SECTOR,
  );
  return CARDINALES[i % CARDINALES.length] as string;
}

/** El chip de la línea estación -> cohete: `"842 m · 271° O"`; `null` si no hay ningún dato. */
export function textoChip(distM: number | null, azimutDeg: number | null): string | null {
  const partes: string[] = [];
  if (distM !== null) {
    partes.push(distM >= M_POR_KM ? `${numero(distM / M_POR_KM, 1)} km` : `${numero(distM)} m`);
  }
  if (azimutDeg !== null) partes.push(`${numero(azimutDeg)}° ${cardinal(azimutDeg)}`);
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** El texto del LKP en dos líneas: `["Última posición", "121 m · hace 38 s"]`. */
export function lineasLkp(altM: number | null, edadMs: number | null): [string, string | null] {
  const detalle: string[] = [];
  if (altM !== null) detalle.push(`${numero(altM)} m`);
  if (edadMs !== null) detalle.push(hace(edadMs));
  return ["Última posición", detalle.length > 0 ? detalle.join(" · ") : null];
}

/** Lo mismo en una sola línea (para lectores de pantalla): "Última posición · 121 m · hace 38 s". */
export function textoLkp(altM: number | null, edadMs: number | null): string {
  const [titulo, detalle] = lineasLkp(altM, edadMs);
  return detalle ? `${titulo} · ${detalle}` : titulo;
}

/** Decimales con que se redondean las líneas de la cuadrícula (quita el ruido de `k * paso`). */
const DECIMALES_CUADRICULA = 6;

/**
 * Cuadrícula de referencia: meridianos y paralelos cada `paso` grados, alineados a múltiplos del
 * paso, en un cuadrado de `radio` grados alrededor de `centro`. Da sensación de escala y de
 * movimiento cuando el mapa no tiene base (no hay PMTiles).
 */
export function cuadricula(
  centro: { lat: number; lon: number },
  radio: number = MAPA_CUADRICULA_RADIO_GRADOS,
  paso: number = MAPA_CUADRICULA_PASO_GRADOS,
): Coleccion<Linea, Record<string, never>> {
  const redondear = (n: number) => Number(n.toFixed(DECIMALES_CUADRICULA));
  const [oeste, este] = [centro.lon - radio, centro.lon + radio];
  const [sur, norte] = [centro.lat - radio, centro.lat + radio];
  const features: Caracteristica<Linea, Record<string, never>>[] = [];
  const linea = (a: Coord, b: Coord): Caracteristica<Linea, Record<string, never>> => ({
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: [a, b] },
  });
  for (let k = Math.ceil(oeste / paso); k <= Math.floor(este / paso); k++) {
    const lon = redondear(k * paso);
    features.push(linea([lon, sur], [lon, norte]));
  }
  for (let k = Math.ceil(sur / paso); k <= Math.floor(norte / paso); k++) {
    const lat = redondear(k * paso);
    features.push(linea([oeste, lat], [este, lat]));
  }
  return coleccion(features);
}

// ---- Todas las capas

export interface Marcadores {
  rampa: Coord | null;
  estacion: Coord | null;
  /** El cohete en vivo. Es `null` en LKP: entonces se dibuja `lkp`. */
  cohete: { pos: Coord; rumbo: number | null; atenuado: boolean } | null;
  lkp: { pos: Coord; alt_agl_m: number | null; edadMs: number | null } | null;
  /** Centro de la elipse de impacto (estimado). */
  impacto: Coord | null;
  chip: { pos: Coord; texto: string } | null;
}

export interface Capas {
  trayectoria: ColeccionLineas;
  elipse: ColeccionPoligonos;
  linea: Coleccion<Linea, Record<string, never>>;
  marcadores: Marcadores;
  /** Caja que contiene todo lo dibujado (para "ver todo"); `null` si no hay nada. */
  limites: Limites | null;
}

/** La caja que contiene las coordenadas, o `null` si no hay ninguna. */
export function limitesDe(coords: Coord[]): Limites | null {
  if (coords.length === 0) return null;
  let [oeste, sur, este, norte] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of coords) {
    oeste = Math.min(oeste, lon);
    este = Math.max(este, lon);
    sur = Math.min(sur, lat);
    norte = Math.max(norte, lat);
  }
  return [oeste, sur, este, norte];
}

/** La caja más pequeña que contiene a las dos (una puede faltar). */
export function unirLimites(a: Limites | null, b: Limites | null): Limites | null {
  if (a === null) return b;
  if (b === null) return a;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/** ¿Está la coordenada fuera de la caja visible? */
export function fueraDeLimites(visibles: Limites, c: Coord): boolean {
  return c[0] < visibles[0] || c[0] > visibles[2] || c[1] < visibles[1] || c[1] > visibles[3];
}

const posAcoord = (p: { lat: number; lon: number }): Coord => [p.lon, p.lat];

/**
 * Arma las capas y los marcadores. `rastro` son los puntos de la trayectoria (la `serie` más lo
 * que llegó después); `decision` sale de `decidirLkp`.
 */
export function construirCapas(e: EntradaMapa, decision: DecisionLkp, rastro: Coord[]): Capas {
  const rampa = e.sitio ? posAcoord(e.sitio) : null;
  const estacion = e.estacion?.pos ? posAcoord(e.estacion.pos) : null;
  const pos = e.estado?.pos ?? null;

  const lkp =
    decision.activo && decision.punto
      ? {
          pos: posAcoord(decision.punto),
          alt_agl_m: decision.punto.alt_agl_m,
          edadMs: decision.edadMs,
        }
      : null;
  const cohete =
    !decision.activo && pos && e.estado
      ? {
          pos: posAcoord(pos),
          rumbo: rumboDelCohete(e.estado, rastro),
          atenuado: e.principal === "senal_debil",
        }
      : null;
  const destino = lkp?.pos ?? cohete?.pos ?? null;

  // Después de aterrizar ya no hay impacto que estimar: queda la posición final (o el LKP).
  const elipse = e.estado?.fase === "LANDED" ? null : (e.estado?.calc.elipse ?? null);
  const poligono = elipse ? poligonoElipse(elipse) : null;

  const lineaCoords: Coord[] = estacion && destino ? [estacion, destino] : [];
  const texto = e.estado ? textoChip(e.estado.calc.dist_horiz_m, e.estado.calc.azimut_deg) : null;
  const chip =
    estacion && destino && texto
      ? { pos: [(estacion[0] + destino[0]) / 2, (estacion[1] + destino[1]) / 2] as Coord, texto }
      : null;

  const todo: Coord[] = [...rastro, ...(poligono?.coordinates[0] ?? [])];
  for (const c of [rampa, estacion, destino]) if (c) todo.push(c);

  return {
    trayectoria: tramosDesvanecidos(rastro),
    elipse: coleccion(poligono ? [{ type: "Feature", properties: {}, geometry: poligono }] : []),
    linea: coleccion(
      lineaCoords.length === 2
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: lineaCoords },
            },
          ]
        : [],
    ),
    marcadores: {
      rampa,
      estacion,
      cohete,
      lkp,
      impacto: elipse ? ([elipse.lon, elipse.lat] as Coord) : null,
      chip,
    },
    limites: limitesDe(todo),
  };
}
