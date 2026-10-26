// Lógica de la sección Recuperación (03 §3.5, Objetivos 7.G, T-625). Funciones puras, sin Preact:
// del último `estado` deciden QUÉ punto se le da al equipo de recuperación, con qué etiqueta, y arman
// la URL de Google Maps y el texto a copiar. T-668 (dashboard de operación) la reutiliza.
//
// Qué punto (03 §3.5 y §4, GS-03):
//   - sin señal del cohete: el LKP (o la última `pos`), con su antigüedad. Nunca desaparece desde ARMED;
//   - aterrizado (`LANDED`): la posición real (`pos`) o, si no hay, el LKP;
//   - antes del aterrizaje: el centro de la elipse de impacto, con la etiqueta "estimado". Sin elipse se
//     muestra la posición actual del cohete (aclarando que no es un estimado), o el LKP si no hay `pos`.
import type { Estado } from "../contrato/tipos";
import type { EstadoPrincipal } from "../datos/api";
import { numero } from "./formato";

export const DECIMALES_COORDENADA = 7;
export const DECIMALES_DISTANCIA = 0;
export const DECIMALES_AZIMUT = 0;

const LAT_MAX = 90;
const LON_MAX = 180;
const GRADOS_VUELTA = 360;
/** Los 8 puntos de la rosa de los vientos, de 45° cada uno (norte = 0°, sentido horario). */
const PUNTOS_CARDINALES = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"] as const;
const GRADOS_POR_PUNTO = GRADOS_VUELTA / PUNTOS_CARDINALES.length;

export type PuntoCardinal = (typeof PUNTOS_CARDINALES)[number];

/** De dónde sale el punto que se muestra. */
export type OrigenPunto =
  /** El centro de la elipse de impacto, antes del aterrizaje. */
  | "estimado"
  /** La posición real del cohete (`pos`) en tierra. */
  | "real"
  /** La última posición conocida, con su antigüedad (GS-03). */
  | "lkp"
  /** La posición actual del cohete, en vuelo y sin elipse: NO es un estimado de impacto. */
  | "actual";

export interface PuntoRecuperacion {
  lat: number;
  lon: number;
  origen: OrigenPunto;
  /** Solo en `lkp`: cuánto hace que se conoce esa posición (ms), o `null` si no se puede saber. */
  edadMs: number | null;
}

export interface VistaRecuperacion {
  /** El punto a recuperar, o `null` (entonces `sinPunto` dice por qué). */
  punto: PuntoRecuperacion | null;
  /** Texto para cuando no hay punto. Siempre presente si `punto` es `null`. */
  sinPunto: string | null;
  /** Latitud y longitud ya formateadas (coma decimal, 7 decimales). `null` si no hay punto. */
  lat: string | null;
  lon: string | null;
  /** Lo que se copia al portapapeles, con punto decimal para pegarlo en Google Maps. */
  textoCopia: string | null;
  /** La URL de Google Maps (y del QR). `null` si no hay punto: nunca una URL con `null`. */
  urlMaps: string | null;
  /** Vector de navegación desde la estación (de `calc`, lo calcula el servicio de tierra). */
  vector: { distanciaM: number | null; azimutDeg: number | null; cardinal: PuntoCardinal | null };
  /** `fase = LANDED`. */
  aterrizado: boolean;
}

/** ¿Son coordenadas que Google Maps entiende? Descarta `NaN`, infinitos y fuera de rango. */
export function coordenadaValida(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= LAT_MAX &&
    Math.abs(lon) <= LON_MAX
  );
}

/** `lat,lon` con punto decimal y 7 decimales (la precisión del contrato, 05 §0). */
export function textoCoordenadas(lat: number, lon: number): string {
  return `${lat.toFixed(DECIMALES_COORDENADA)},${lon.toFixed(DECIMALES_COORDENADA)}`;
}

/** La URL de búsqueda de Google Maps (03 §3.5). Solo con coordenadas válidas. */
export function urlGoogleMaps(lat: number, lon: number): string | null {
  if (!coordenadaValida(lat, lon)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${textoCoordenadas(lat, lon)}`;
}

/** El punto cardinal más cercano a un azimut (0° = norte, 90° = este, sentido horario). */
export function puntoCardinal(azimutDeg: number): PuntoCardinal {
  const normal = ((azimutDeg % GRADOS_VUELTA) + GRADOS_VUELTA) % GRADOS_VUELTA;
  const indice = Math.round(normal / GRADOS_POR_PUNTO) % PUNTOS_CARDINALES.length;
  return PUNTOS_CARDINALES[indice] ?? "N";
}

/**
 * Cuánto hace que se conoce el LKP: lo que ya tenía cuando llegó el último paquete (su hora frente a
 * la del `estado`, ambas del cohete) más la edad de ese paquete. `null` si no hay ninguna de las dos.
 */
function edadDelLkp(estado: Estado, edadMs: number | null): number | null {
  const lkpUtc = estado.lkp?.utc_ms ?? null;
  const previa =
    estado.utc_ms !== null && lkpUtc !== null ? Math.max(0, estado.utc_ms - lkpUtc) : null;
  if (previa === null && edadMs === null) return null;
  return (previa ?? 0) + (edadMs ?? 0);
}

type Coord = { lat: number; lon: number } | null | undefined;
const sirve = (c: Coord): c is { lat: number; lon: number } =>
  c !== null && c !== undefined && coordenadaValida(c.lat, c.lon);

/** Decide el punto a mostrar. Ver el encabezado del archivo. */
export function puntoDeRecuperacion(
  estado: Estado,
  principal: EstadoPrincipal,
  edadMs: number | null,
): PuntoRecuperacion | null {
  const lkp = (c: { lat: number; lon: number }): PuntoRecuperacion => ({
    lat: c.lat,
    lon: c.lon,
    origen: "lkp",
    edadMs: edadDelLkp(estado, edadMs),
  });
  const pos = sirve(estado.pos) ? estado.pos : null;
  const ultima = sirve(estado.lkp) ? estado.lkp : null;

  // Sin señal: todo se congela y el LKP manda (03 §4, GS-03).
  if (principal === "sin_senal") {
    const c = ultima ?? pos;
    if (c !== null) return lkp(c);
  }

  if (estado.fase === "LANDED") {
    if (pos !== null) return { lat: pos.lat, lon: pos.lon, origen: "real", edadMs: null };
    return ultima === null ? null : lkp(ultima);
  }

  // Antes del aterrizaje: el centro de la elipse, que es lo único que sirve para ir a buscarlo.
  const elipse = estado.calc.elipse;
  if (sirve(elipse)) return { lat: elipse.lat, lon: elipse.lon, origen: "estimado", edadMs: null };
  if (pos !== null) return { lat: pos.lat, lon: pos.lon, origen: "actual", edadMs: null };
  return ultima === null ? null : lkp(ultima);
}

/** El texto de la sección cuando no hay punto. */
export function textoSinPunto(estado: Estado | null): string {
  if (estado === null) {
    return "Todavía no hay posición del cohete. Aparecerá aquí cuando empiece a transmitir.";
  }
  return "El cohete aún no reporta una posición válida (sin fix GNSS). Apenas la tenga, aparecerá aquí.";
}

/** Todo lo que pinta la sección Recuperación. Sin `estado`, todo es "sin dato". */
export function vistaRecuperacion(
  estado: Estado | null,
  principal: EstadoPrincipal,
  edadMs: number | null,
): VistaRecuperacion {
  const punto = estado === null ? null : puntoDeRecuperacion(estado, principal, edadMs);
  const azimut = estado?.calc.azimut_deg ?? null;
  const aterrizado = estado?.fase === "LANDED";
  const vector = {
    distanciaM: estado?.calc.dist_horiz_m ?? null,
    azimutDeg: azimut,
    cardinal: azimut === null ? null : puntoCardinal(azimut),
  };
  if (punto === null) {
    return {
      punto: null,
      sinPunto: textoSinPunto(estado),
      lat: null,
      lon: null,
      textoCopia: null,
      urlMaps: null,
      vector,
      aterrizado,
    };
  }
  return {
    punto,
    sinPunto: null,
    lat: numero(punto.lat, DECIMALES_COORDENADA),
    lon: numero(punto.lon, DECIMALES_COORDENADA),
    textoCopia: `${punto.lat.toFixed(DECIMALES_COORDENADA)}, ${punto.lon.toFixed(DECIMALES_COORDENADA)}`,
    urlMaps: urlGoogleMaps(punto.lat, punto.lon),
    vector,
    aterrizado,
  };
}
