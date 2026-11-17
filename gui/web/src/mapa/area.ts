// El área navegable del mapa (T-634): hasta dónde se puede arrastrar y alejar. Lógica pura, sin
// DOM ni MapLibre: se prueba con Vitest. Nada de esto se escribe a mano en el código: los límites
// y el zoom máximo se leen de la cabecera del PMTiles en tiempo de ejecución (`base.ts`); sin
// PMTiles, se usa un área por defecto alrededor de `meta.sitio`.
//
// Regla de oro (GS-03, el LKP nunca desaparece): lo que se dibuja (LKP, cohete, trayectoria,
// estación, rampa, elipse) NUNCA puede quedar fuera del área navegable. Si cae afuera, el área se
// amplía para incluirlo, con margen (`ampliarParaIncluir`).
import {
  MAPA_AREA_DEFECTO_GRADOS,
  MAPA_MARGEN_INCLUIR_FRACCION,
  MAPA_MARGEN_INCLUIR_GRADOS,
  MAPA_MARGEN_LIMITES,
  MAPA_MUNDO_PX,
  MAPA_SOBREZOOM,
  MAPA_ZOOM_MAX,
} from "./constantes";
import type { Limites } from "./geo";

const GRADOS_VUELTA = 360;
const GRADOS_MEDIA_VUELTA = 180;
/** Latitud máxima de la proyección Web Mercator, en grados. */
const LAT_MERCATOR_MAX = 85.0511287798;

/** Lo que el mapa necesita saber de un PMTiles: hasta dónde llega y hasta qué zoom tiene teselas. */
export interface Cobertura {
  limites: Limites;
  zoomMax: number;
}

/** Los campos de la cabecera de un PMTiles que se usan (estructural: no depende de la biblioteca). */
export interface CabeceraPmtiles {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  maxZoom: number;
}

/**
 * La cobertura que declara la cabecera de un PMTiles, o `null` si no es creíble (un archivo con la
 * cabecera en ceros, o con el recuadro al revés, no puede limitar un mapa).
 */
export function coberturaDeCabecera(h: CabeceraPmtiles): Cobertura | null {
  const valores = [h.minLon, h.minLat, h.maxLon, h.maxLat, h.maxZoom];
  if (!valores.every(Number.isFinite)) return null;
  if (h.minLon >= h.maxLon || h.minLat >= h.maxLat) return null;
  if (h.minLon < -GRADOS_MEDIA_VUELTA || h.maxLon > GRADOS_MEDIA_VUELTA) return null;
  if (h.minLat < -LAT_MERCATOR_MAX || h.maxLat > LAT_MERCATOR_MAX) return null;
  if (h.maxZoom < 0) return null;
  return { limites: [h.minLon, h.minLat, h.maxLon, h.maxLat], zoomMax: h.maxZoom };
}

/** Sin PMTiles: un cuadrado de `MAPA_AREA_DEFECTO_GRADOS` a cada lado de `centro`. */
export function areaPorDefecto(
  centro: { lat: number; lon: number },
  semilado: number = MAPA_AREA_DEFECTO_GRADOS,
): Limites {
  return [
    centro.lon - semilado,
    centro.lat - semilado,
    centro.lon + semilado,
    centro.lat + semilado,
  ];
}

/**
 * Mete los límites hacia adentro una fracción de cada lado: la vista no llega justo al borde del
 * archivo, donde ya no hay teselas.
 */
export function encoger(l: Limites, fraccion: number = MAPA_MARGEN_LIMITES): Limites {
  const dLon = (l[2] - l[0]) * fraccion;
  const dLat = (l[3] - l[1]) * fraccion;
  return [l[0] + dLon, l[1] + dLat, l[2] - dLon, l[3] - dLat];
}

/**
 * Amplía `area` para que `caja` (lo dibujado) quede adentro con holgura. Solo se mueven los lados
 * que `caja` rebasa o a los que se acerca a menos de `margenMin`; si todo cabe, el área no cambia
 * (devuelve el mismo arreglo).
 *
 * La holgura es la mayor entre `margenMin` y una fracción del lado más largo del conjunto: así,
 * al alejar el mapa para ver todo, sigue habiendo sitio en pantalla para el marcador y su texto
 * (una holgura fija en grados se vuelve de pocos píxeles al alejarse).
 */
export function ampliarParaIncluir(
  area: Limites,
  caja: Limites | null,
  margenMin: number = MAPA_MARGEN_INCLUIR_GRADOS,
  fraccion: number = MAPA_MARGEN_INCLUIR_FRACCION,
): Limites {
  if (caja === null) return area;
  const lado = Math.max(
    Math.max(area[2], caja[2]) - Math.min(area[0], caja[0]),
    Math.max(area[3], caja[3]) - Math.min(area[1], caja[1]),
  );
  const margen = Math.max(margenMin, fraccion * lado);
  const oeste = caja[0] - margenMin < area[0] ? Math.min(area[0], caja[0] - margen) : area[0];
  const sur = caja[1] - margenMin < area[1] ? Math.min(area[1], caja[1] - margen) : area[1];
  const este = caja[2] + margenMin > area[2] ? Math.max(area[2], caja[2] + margen) : area[2];
  const norte = caja[3] + margenMin > area[3] ? Math.max(area[3], caja[3] + margen) : area[3];
  if (oeste === area[0] && sur === area[1] && este === area[2] && norte === area[3]) return area;
  return [oeste, sur, este, norte];
}

export function mismosLimites(a: Limites | null, b: Limites | null): boolean {
  return a === b || (a !== null && b !== null && a.every((v, i) => v === b[i]));
}

/** `true` si la coordenada `[lon, lat]` está dentro de la caja (los bordes cuentan como dentro). */
export function dentroDe(l: Limites, lon: number, lat: number): boolean {
  return lon >= l[0] && lon <= l[2] && lat >= l[1] && lat <= l[3];
}

/** La Y de Mercator de una latitud: 0 en el norte del mapa y 1 en el sur. */
function mercatorY(latGrados: number): number {
  const lat = Math.max(-LAT_MERCATOR_MAX, Math.min(LAT_MERCATOR_MAX, latGrados));
  const rad = (lat * Math.PI) / GRADOS_MEDIA_VUELTA;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI);
}

/** La latitud de una Y de Mercator (lo contrario de `mercatorY`). */
function latDeMercatorY(y: number): number {
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * GRADOS_MEDIA_VUELTA) / Math.PI;
  return Math.max(-LAT_MERCATOR_MAX, Math.min(LAT_MERCATOR_MAX, lat));
}

/**
 * Los zoom con los que `caja` mediría justo `anchoPx` de ancho y `altoPx` de alto (cada uno por
 * separado). El mundo mide `MAPA_MUNDO_PX * 2^zoom` px de lado. Un lado sin extensión da infinito.
 */
function zoomsPorLado(caja: Limites, anchoPx: number, altoPx: number) {
  const fraccionLon = (caja[2] - caja[0]) / GRADOS_VUELTA;
  const fraccionLat = mercatorY(caja[1]) - mercatorY(caja[3]);
  return {
    porAncho: fraccionLon > 0 ? Math.log2(anchoPx / (MAPA_MUNDO_PX * fraccionLon)) : Infinity,
    porAlto: fraccionLat > 0 ? Math.log2(altoPx / (MAPA_MUNDO_PX * fraccionLat)) : Infinity,
  };
}

/**
 * El zoom más bajo con el que el área todavía llena un contenedor de `anchoPx` x `altoPx`: con un
 * zoom menor se vería el vacío de afuera. Devuelve 0 si el contenedor no tiene tamaño (aún no se
 * pinta) o el área es degenerada.
 */
export function zoomMinimo(area: Limites, anchoPx: number, altoPx: number): number {
  if (!(anchoPx > 0 && altoPx > 0)) return 0;
  const { porAncho, porAlto } = zoomsPorLado(area, anchoPx, altoPx);
  const z = Math.max(porAncho, porAlto);
  return Number.isFinite(z) ? Math.max(0, z) : 0;
}

/**
 * Amplía `area` para que "Ver todo" pueda mostrar `caja` entera con `relleno` px de aire. Un área
 * solo puede ser alejada hasta que la vista la llena (`zoomMinimo`): si `caja` ocupa casi toda el
 * área en un lado y el contenedor es más ancho (o más alto) que ella, la vista no llegaría a
 * abarcarla. Aquí se calcula el zoom con el que `caja` cabe en el contenedor y se suma al área la
 * vista que ese zoom tiene centrada en `caja`; así la cámara puede quedar justo donde "Ver todo"
 * la pone, sin que el límite la corra. Si ya cabe, devuelve la misma área.
 */
export function ampliarParaVista(
  area: Limites,
  caja: Limites | null,
  anchoPx: number,
  altoPx: number,
  relleno: number,
): Limites {
  if (caja === null || !(anchoPx > 2 * relleno && altoPx > 2 * relleno)) return area;
  const { porAncho, porAlto } = zoomsPorLado(caja, anchoPx - 2 * relleno, altoPx - 2 * relleno);
  const zoom = Math.min(porAncho, porAlto);
  if (!Number.isFinite(zoom)) return area;
  const mundoPx = MAPA_MUNDO_PX * 2 ** zoom;
  const mediaLon = (anchoPx / mundoPx / 2) * GRADOS_VUELTA;
  const mediaY = altoPx / mundoPx / 2;
  const cLon = (caja[0] + caja[2]) / 2;
  const cY = (mercatorY(caja[1]) + mercatorY(caja[3])) / 2;
  const oeste = Math.min(area[0], cLon - mediaLon);
  const este = Math.max(area[2], cLon + mediaLon);
  const sur = Math.min(area[1], latDeMercatorY(cY + mediaY));
  const norte = Math.max(area[3], latDeMercatorY(cY - mediaY));
  if (oeste === area[0] && sur === area[1] && este === area[2] && norte === area[3]) return area;
  return [oeste, sur, este, norte];
}

/**
 * El zoom máximo: el del archivo más el sobrezoom permitido (el mapa amplía las teselas del
 * último nivel). Sin PMTiles no hay teselas que ampliar y manda `MAPA_ZOOM_MAX`.
 */
export function zoomMaximo(cobertura: Cobertura | null): number {
  return cobertura === null ? MAPA_ZOOM_MAX : cobertura.zoomMax + MAPA_SOBREZOOM;
}
