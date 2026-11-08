// Lógica del mapa que no depende del navegador (T-632): arma el GeoJSON de cada capa y los
// marcadores desde las signals de `datos/api.ts`, y decide si toca LKP (GS-03).
// Todo son funciones puras: se prueban con Vitest, sin MapLibre ni DOM.
import type { Estacion, Estado, Meta, Serie } from "../contrato/tipos";
import type { EstadoPrincipal } from "../datos/estado_pagina";
import { hace, numero } from "../mision/formato";
import {
  ESTILO_3D,
  MAPA_3D_COHETE_PX,
  MAPA_3D_EPSILON_ALT_M,
  MAPA_3D_ESTACA_CABEZA_PX,
  MAPA_3D_ESTACA_PX,
  MAPA_3D_ESTACA_RADIO_PX,
  MAPA_3D_LADOS,
  MAPA_3D_LADOS_FINOS,
  MAPA_3D_PLOMADA_PX,
  MAPA_3D_TUBO_MAX_SEGMENTOS,
  MAPA_3D_TUBO_SUBDIV_MAX,
  MAPA_3D_ZOOM_PASO,
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

// ---- Trayectoria, cohete y estaca en el aire (vista 3D, T-656)

/** Un punto de la trayectoria con su altura sobre el suelo (`alt_agl_m`). */
export interface PuntoAlt {
  lon: number;
  lat: number;
  alt_agl_m: number | null;
}

/**
 * Propiedades de cada prisma (`fill-extrusion-base` y `-height`, en metros sobre el suelo). `f` va de 0
 * (lo más viejo) a 1 (lo más nuevo), para desvanecer la trayectoria; `parte` nombra la pieza.
 */
export interface PropsTubo {
  base: number;
  height: number;
  f: number;
}
export interface PropsPieza {
  base: number;
  height: number;
  parte: string;
}
export type ColeccionTubo = Coleccion<Poligono, PropsTubo>;
export type ColeccionPiezas = Coleccion<Poligono, PropsPieza>;

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

/**
 * El zoom "de dibujo" del 3D: el zoom real redondeado a `paso` niveles. Los prismas se arman con los
 * metros por píxel de este zoom, así que se rearman cuando cambia (al terminar el zoom), no en cada
 * cuadro; entre dos pasos miden entre 0,8 y 1,2 veces lo pedido.
 */
export function zoomDeDibujo(zoom: number, paso: number = MAPA_3D_ZOOM_PASO): number {
  return Math.round(zoom / paso) * paso;
}

type PuntoConAlt = PuntoAlt & { alt_agl_m: number };

/** Los puntos con altura, sin los de `alt_agl_m` nulo ni los repetidos (misma posición y altura). */
function puntosUtilesDelTubo(puntos: readonly PuntoAlt[]): PuntoConAlt[] {
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

/** Un polígono regular de `lados` lados y `radioM` metros de radio alrededor de `centro`. */
export function circuloPoligono(
  centro: Coord,
  radioM: number,
  lados: number = MAPA_3D_LADOS,
): Poligono {
  const anillo: Coord[] = [];
  for (let i = 0; i < lados; i++) {
    const t = (2 * Math.PI * i) / lados;
    anillo.push(desplazar(centro, radioM * Math.sin(t), radioM * Math.cos(t)));
  }
  anillo.push([...(anillo[0] as Coord)]);
  return { type: "Polygon", coordinates: [anillo] };
}

/** El rectángulo de `a` a `b` engrosado `radioM` a cada lado y alargado `radioM` en cada extremo. */
function rectanguloEngrosado(
  a: Coord,
  b: Coord,
  dirEste: number,
  dirNorte: number,
  radioM: number,
): Poligono {
  const [e, n] = [dirEste * radioM, dirNorte * radioM];
  const pa = desplazar(a, -e, -n);
  const pb = desplazar(b, e, n);
  const esquinas: Coord[] = [
    desplazar(pa, -n, e),
    desplazar(pb, -n, e),
    desplazar(pb, n, -e),
    desplazar(pa, n, -e),
  ];
  esquinas.push([...(esquinas[0] as Coord)]);
  return { type: "Polygon", coordinates: [esquinas] };
}

/** El cuadrado de lado `2 * radioM` centrado en `c` (para un tramo casi vertical). */
function cuadradoEn(c: Coord, radioM: number): Poligono {
  const esquinas: Coord[] = [
    desplazar(c, -radioM, -radioM),
    desplazar(c, radioM, -radioM),
    desplazar(c, radioM, radioM),
    desplazar(c, -radioM, radioM),
  ];
  esquinas.push([...(esquinas[0] as Coord)]);
  return { type: "Polygon", coordinates: [esquinas] };
}

/**
 * La trayectoria como un TUBO en el aire: prismas flotantes (`fill-extrusion` con `base` > 0) de
 * `radioM` metros de radio, uno por tramo (los largos o muy inclinados se parten en hasta
 * `MAPA_3D_TUBO_SUBDIV_MAX` para que sigan la pendiente).
 * - Tramo con desplazamiento horizontal: su huella es el tramo engrosado `radioM` a cada lado y
 *   alargado `radioM` en los extremos (así la deriva del descenso queda continua).
 * - Tramo casi vertical (el ascenso): un cuadrado de `2 * radioM` de lado en su punto medio.
 * - `base` = la altura menor menos `radioM`, `height` = la mayor más `radioM` (la base nunca baja de
 *   0): los prismas vecinos se solapan y la columna es continua.
 * Los puntos con `alt_agl_m` nulo y los repetidos se saltan; con más de `maxSegmentos` se diezma.
 * `factorAltura` escala las alturas con el terreno exagerado. `f` (0 a 1) crece de lo viejo a lo nuevo.
 */
export function tuboTrayectoria(
  puntos: readonly PuntoAlt[],
  radioM: number,
  maxSegmentos: number = MAPA_3D_TUBO_MAX_SEGMENTOS,
  factorAltura = 1,
): ColeccionTubo {
  const utiles = diezmarSegmentos(puntosUtilesDelTubo(puntos), maxSegmentos);
  const segmentos = utiles.length - 1;
  const features: Caracteristica<Poligono, PropsTubo>[] = [];
  for (let i = 1; i < utiles.length; i++) {
    const a = utiles[i - 1] as PuntoConAlt;
    const b = utiles[i] as PuntoConAlt;
    const este = (b.lon - a.lon) * Math.cos(aRadianes(a.lat)) * M_POR_GRADO;
    const norte = (b.lat - a.lat) * M_POR_GRADO;
    const largo = Math.hypot(este, norte);
    const dz = b.alt_agl_m - a.alt_agl_m;
    const partes = Math.min(
      MAPA_3D_TUBO_SUBDIV_MAX,
      Math.max(1, Math.ceil(Math.max(largo, Math.abs(dz)) / (2 * radioM))),
    );
    for (let k = 0; k < partes; k++) {
      const [t0, t1] = [k / partes, (k + 1) / partes];
      const p0: Coord = [a.lon + (b.lon - a.lon) * t0, a.lat + (b.lat - a.lat) * t0];
      const p1: Coord = [a.lon + (b.lon - a.lon) * t1, a.lat + (b.lat - a.lat) * t1];
      const [z0, z1] = [a.alt_agl_m + dz * t0, a.alt_agl_m + dz * t1];
      const huella =
        largo < radioM
          ? cuadradoEn([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], radioM)
          : rectanguloEngrosado(p0, p1, este / largo, norte / largo, radioM);
      features.push({
        type: "Feature",
        properties: {
          base: Math.max(0, Math.min(z0, z1) * factorAltura - radioM),
          height: Math.max(0, Math.max(z0, z1) * factorAltura + radioM),
          f: segmentos > 1 ? (i - 1 + (k + 0.5) / partes) / segmentos : 1,
        },
        geometry: huella,
      });
    }
  }
  return coleccion(features);
}

/**
 * El cohete en 3D, a su altura real: un cuerpo cilíndrico y una ojiva de discos escalonados cada vez
 * más angostos (`fill-extrusion`), centrado en `pos` a `altM` metros sobre el suelo, más una
 * "plomada" delgada del suelo al cohete para que se lea dónde está sobre el terreno. Mide
 * `MAPA_3D_COHETE_PX` píxeles de largo con `mPorPx` metros por píxel.
 */
export function cohete3d(
  pos: Coord,
  altM: number,
  mPorPx: number,
  factorAltura = 1,
): ColeccionPiezas {
  const largo = MAPA_3D_COHETE_PX * mPorPx;
  const alt = altM * factorAltura;
  const features: Caracteristica<Poligono, PropsPieza>[] = [];
  for (const [parte, radioRel, desdeRel, hastaRel] of ESTILO_3D.cohete) {
    features.push({
      type: "Feature",
      properties: {
        parte,
        base: Math.max(0, alt + desdeRel * largo),
        height: Math.max(0, alt + hastaRel * largo),
      },
      geometry: circuloPoligono(pos, radioRel * largo),
    });
  }
  const [, , cuerpoDesde] = ESTILO_3D.cohete[0] ?? ["cuerpo", 0, 0, 0];
  const bajoElCuerpo = Math.max(0, alt + cuerpoDesde * largo);
  if (bajoElCuerpo > 0) {
    features.push({
      type: "Feature",
      properties: { parte: "plomada", base: 0, height: bajoElCuerpo },
      geometry: circuloPoligono(pos, MAPA_3D_PLOMADA_PX * mPorPx, MAPA_3D_LADOS_FINOS),
    });
  }
  return coleccion(features);
}

/**
 * La estaca del impacto estimado: una columna delgada de `MAPA_3D_ESTACA_PX` píxeles de alto con una
 * cabeza más ancha, para que se vea de lejos y con la vista inclinada.
 */
export function estaca3d(pos: Coord, mPorPx: number): ColeccionPiezas {
  const alto = MAPA_3D_ESTACA_PX * mPorPx;
  const radioCabeza = MAPA_3D_ESTACA_CABEZA_PX * mPorPx;
  const altoCabeza = radioCabeza * ESTILO_3D.estacaCabezaAlto;
  return coleccion<Poligono, PropsPieza>([
    {
      type: "Feature",
      properties: { parte: "estaca", base: 0, height: alto - altoCabeza },
      geometry: circuloPoligono(pos, MAPA_3D_ESTACA_RADIO_PX * mPorPx, MAPA_3D_LADOS_FINOS),
    },
    {
      type: "Feature",
      properties: { parte: "cabeza", base: alto - altoCabeza, height: alto },
      geometry: circuloPoligono(pos, radioCabeza),
    },
  ]);
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
