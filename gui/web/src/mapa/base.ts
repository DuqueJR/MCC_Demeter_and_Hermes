// Mapa base opcional (T-632): el PMTiles propio de la zona (README del módulo). Si el archivo no
// existe, el mapa funciona igual, sin base: el fondo del tema y las capas de la misión.
import { PMTiles, type Protocol } from "pmtiles";
import { type Cobertura, coberturaDeCabecera } from "./area";
import { MAPA_PMTILES_RUTA } from "./constantes";
import type { BaseVectorial } from "./estilo";

/** Atribución obligatoria de los datos de OpenStreetMap (ODbL) y de Protomaps. */
const ATRIBUCION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>' +
  ' · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>';

/**
 * URL absoluta del PMTiles: `VITE_MAPA_PMTILES_URL` (por ejemplo, el CDN, T-642) o, por defecto,
 * `public/mapas/santa_fe.pmtiles` servido desde el mismo origen.
 */
export function urlDelPmtiles(): string {
  const configurada = import.meta.env.VITE_MAPA_PMTILES_URL as string | undefined;
  const relativa = configurada || `${import.meta.env.BASE_URL}${MAPA_PMTILES_RUTA}`;
  return new URL(relativa, location.href).href;
}

/** El mapa base que se encontró y hasta dónde llega (lo dice su cabecera). */
export interface BaseDetectada {
  base: BaseVectorial;
  /** `null` si la cabecera no trae un recuadro creíble: el mapa usa el área por defecto. */
  cobertura: Cobertura | null;
}

/**
 * Comprueba que el archivo existe y es un PMTiles (la cabecera lleva su número mágico): un servidor
 * que responde `index.html` a una ruta que no existe no cuenta. De la misma cabecera salen los
 * límites y el zoom máximo con que se limita el mapa (`area.ts`): no se escriben en el código.
 * Devuelve `null` si no hay base.
 */
export async function detectarBase(protocolo: Protocol): Promise<BaseDetectada | null> {
  const url = urlDelPmtiles();
  try {
    const archivo = new PMTiles(url);
    const cabecera = await archivo.getHeader();
    protocolo.add(archivo);
    return {
      base: { url: `pmtiles://${url}`, atribucion: ATRIBUCION },
      cobertura: coberturaDeCabecera(cabecera),
    };
  } catch {
    return null;
  }
}
