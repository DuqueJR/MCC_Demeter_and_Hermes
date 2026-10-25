// Lógica del mapa que no depende del navegador (T-632): arma el GeoJSON de cada capa y los
// marcadores desde las signals de `datos/api.ts`, y decide si toca LKP (GS-03).
// Todo son funciones puras: se prueban con Vitest, sin MapLibre ni DOM.
import type { Estacion, Estado, Meta, Serie } from "../contrato/tipos";
import type { EstadoPrincipal } from "../datos/estado_pagina";
import { hace, numero } from "../mision/formato";
import {
  MAPA_EPSILON_GRADOS,
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

/** "Última posición conocida · 121 m · hace 38 s", con lo que se sepa. */
export function textoLkp(altM: number | null, edadMs: number | null): string {
  const partes = ["Última posición"];
  if (altM !== null) partes.push(`${numero(altM)} m`);
  if (edadMs !== null) partes.push(hace(edadMs));
  return partes.join(" · ");
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

  const elipse = e.estado?.calc.elipse ?? null;
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
