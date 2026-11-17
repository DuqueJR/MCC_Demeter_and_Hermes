// Relieve del mapa (T-649, D-W22): carga los datos que generó `scripts/generar-relieve.mjs`
// (`public/mapas/relieve/`). Todo es opcional: si `relieve.json` no está o no se entiende, el mapa
// sigue exactamente como antes (sin relieve y sin ruido), y si solo faltan las curvas queda el
// sombreado. Va en el chunk diferido del mapa, no en el JS inicial.

import { MAPA_RELIEVE_RUTA, MAPA_RELIEVE_TIMEOUT_MS } from "./constantes";
import type { Coleccion } from "./geo";

/** Atribución de los *Terrain Tiles* (https://github.com/tilezen/joerd/blob/master/docs/attribution.md). */
const ATRIBUCION_RELIEVE =
  'Relieve: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Mapzen/Tilezen</a>' +
  " · SRTM y GMTED2010, cortesía del USGS";

/** Lo que se necesita de `relieve.json`. */
export interface MetaRelieve {
  /** `[oeste, sur, este, norte]` de lo que cubren las teselas del zoom máximo. */
  bounds: [number, number, number, number];
  minzoom: number;
  maxzoom: number;
  tamanoTesela: number;
  curvas: { archivo: string; intervaloM: number; indiceCadaM: number } | null;
}

export interface MultiLinea {
  type: "MultiLineString";
  coordinates: number[][][];
}
export type ColeccionCurvas = Coleccion<MultiLinea, { ele: number; tipo: "indice" | "intermedia" }>;

/** Lo que `construirEstilo` necesita para dibujar el relieve. */
export interface Relieve {
  /** URL con `{z}/{x}/{y}` de las teselas terrarium (absoluta: MapLibre pide desde un worker). */
  urlTeselas: string;
  meta: MetaRelieve;
  atribucion: string;
  /** `null` si las curvas no llegaron: queda solo el sombreado. */
  curvas: ColeccionCurvas | null;
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** `relieve.json` ya leído -> lo que usa el mapa, o `null` si no es creíble. */
export function validarMetaRelieve(crudo: unknown): MetaRelieve | null {
  if (typeof crudo !== "object" || crudo === null) return null;
  const c = crudo as Record<string, unknown>;
  const b = c.bounds;
  if (!Array.isArray(b) || b.length !== 4 || !b.every(esNumero)) return null;
  const [oeste, sur, este, norte] = b as [number, number, number, number];
  if (!(oeste < este && sur < norte)) return null;
  if (!esNumero(c.minzoom) || !esNumero(c.maxzoom) || c.minzoom > c.maxzoom) return null;
  if (c.codificacion !== "terrarium") return null;
  const lado = esNumero(c.tamano_tesela) ? c.tamano_tesela : 256;
  const k = c.curvas as Record<string, unknown> | undefined;
  const curvas =
    k && typeof k.archivo === "string" && esNumero(k.intervalo_m) && esNumero(k.indice_cada_m)
      ? { archivo: k.archivo, intervaloM: k.intervalo_m, indiceCadaM: k.indice_cada_m }
      : null;
  return {
    bounds: [oeste, sur, este, norte],
    minzoom: c.minzoom,
    maxzoom: c.maxzoom,
    tamanoTesela: lado,
    curvas,
  };
}

/** Lo mínimo para confiar en un GeoJSON de curvas. */
export function esColeccionDeCurvas(crudo: unknown): crudo is ColeccionCurvas {
  if (typeof crudo !== "object" || crudo === null) return false;
  const c = crudo as { type?: unknown; features?: unknown };
  return c.type === "FeatureCollection" && Array.isArray(c.features) && c.features.length > 0;
}

/** URL absoluta de una ruta relativa a `BASE_URL` (sin codificar las llaves de `{z}/{x}/{y}`). */
function urlAbsoluta(rutaRelativa: string): string {
  return new URL(import.meta.env.BASE_URL, location.href).href + rutaRelativa;
}

async function pedirJson(url: string): Promise<unknown> {
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(MAPA_RELIEVE_TIMEOUT_MS) });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return respuesta.json();
}

/**
 * Pide `relieve.json` y las curvas. Devuelve `null` si no hay relieve (el caso normal sin los
 * archivos); un fallo de red o un archivo que no se entiende deja un `console.warn` y también
 * `null`. Nunca lanza: el mapa no puede depender del relieve.
 */
export async function cargarRelieve(): Promise<Relieve | null> {
  const urlMeta = urlAbsoluta(MAPA_RELIEVE_RUTA);
  let meta: MetaRelieve | null;
  try {
    meta = validarMetaRelieve(await pedirJson(urlMeta));
  } catch (e) {
    // Sin archivos de relieve (404, o un `index.html` que no es JSON): el mapa queda como antes.
    console.warn("Sin relieve en el mapa:", e instanceof Error ? e.message : e);
    return null;
  }
  if (!meta) {
    console.warn("Sin relieve en el mapa: relieve.json no tiene el formato esperado");
    return null;
  }
  let curvas: ColeccionCurvas | null = null;
  if (meta.curvas) {
    try {
      const crudo = await pedirJson(new URL(meta.curvas.archivo, urlMeta).href);
      if (esColeccionDeCurvas(crudo)) curvas = crudo;
      else console.warn("Sin curvas de nivel: el archivo no tiene curvas");
    } catch (e) {
      console.warn("Sin curvas de nivel:", e instanceof Error ? e.message : e);
    }
  }
  const carpeta = urlMeta.slice(0, urlMeta.lastIndexOf("/") + 1);
  return {
    urlTeselas: `${carpeta}{z}/{x}/{y}.png`,
    meta,
    atribucion: ATRIBUCION_RELIEVE,
    curvas,
  };
}
