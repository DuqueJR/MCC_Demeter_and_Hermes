// Lógica pura de las gráficas (T-633, 03 §3.7): de la `serie` (columnas) y los `eventos` a las
// columnas que dibuja uPlot, las marcas verticales, los textos y las medidas. Sin DOM ni uPlot.
//
// Reglas de los datos reales (verificadas en `estacion/web1.py`):
// - `t_mas_s` es `null` hasta el despegue (el cliente de T-631) y trae negativos en la espera si el
//   snapshot se pidió después del despegue (el repetidor y `web1.py`). Las dos formas son válidas
//   (agenda H0, D5): aquí se descartan los `null` y los T+ < 0, así la gráfica empieza en el
//   despegue en ambos casos y la rampa no aplasta el vuelo.
// - Después de aterrizar la serie sigue creciendo (la espera en tierra, a 1 Hz): se corta en el
//   evento `aterrizaje` si existe, por la misma razón.
// - `alt_agl_m` es `null` sin fix (pos = null); `vz_ms`, sin fix 3D (vel = null). `acc_*` siempre
//   viene, pero se tolera `null`. Un `null` es un hueco en la línea, nunca un cero.
import type { Evento, Serie, TipoEvento } from "../contrato/tipos";
import { numero } from "../mision/formato";
import {
  DECIMALES_ACELERACION,
  DECIMALES_ALTITUD,
  DECIMALES_VELOCIDAD,
} from "../mision/vista_telemetria";
import {
  GRAFICAS_ALTO_MAX_PX,
  GRAFICAS_ALTO_MAX_VENTANA,
  GRAFICAS_ALTO_MIN_PX,
  GRAFICAS_ANCHO_POR_DEFECTO_PX,
  GRAFICAS_HOLGURA_Y,
  GRAFICAS_PROPORCION,
  GRAFICAS_RANGO_PLANO,
  GRAFICAS_TIEMPO_MIN_S,
} from "./constantes";

export type MagnitudId = "altitud" | "velocidad" | "aceleracion";

export interface Magnitud {
  id: MagnitudId;
  /** El título de la pestaña. */
  titulo: string;
  unidad: string;
  /** Rótulo del eje vertical, con su unidad. */
  eje: string;
  decimales: number;
  /** ¿El rango vertical incluye siempre el cero? (el suelo, el reposo). */
  incluyeCero: boolean;
}

export const MAGNITUDES: readonly Magnitud[] = [
  {
    id: "altitud",
    titulo: "Altitud",
    unidad: "m",
    eje: "Altitud (m)",
    decimales: DECIMALES_ALTITUD,
    incluyeCero: true,
  },
  {
    id: "velocidad",
    titulo: "Velocidad vertical",
    unidad: "m/s",
    eje: "Velocidad vertical (m/s)",
    decimales: DECIMALES_VELOCIDAD,
    incluyeCero: true,
  },
  {
    id: "aceleracion",
    titulo: "Aceleración",
    unidad: "g",
    eje: "Aceleración (g)",
    decimales: DECIMALES_ACELERACION,
    incluyeCero: true,
  },
];

export const EJE_TIEMPO = "Segundos desde el despegue";

/** Un `number` finito o `null` (NaN, Infinity y los ausentes son huecos). */
const finito = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Aceleración total (g): la norma de los tres ejes del cuerpo; hueco si falta cualquiera. */
export function normaAceleracion(
  x: number | null | undefined,
  y: number | null | undefined,
  z: number | null | undefined,
): number | null {
  const a = finito(x);
  const b = finito(y);
  const c = finito(z);
  return a === null || b === null || c === null ? null : Math.hypot(a, b, c);
}

function valorDe(serie: Serie, i: number, m: MagnitudId): number | null {
  switch (m) {
    case "altitud":
      return finito(serie.alt_agl_m[i]);
    case "velocidad":
      return finito(serie.vz_ms[i]);
    case "aceleracion":
      return normaAceleracion(serie.acc_x_g[i], serie.acc_y_g[i], serie.acc_z_g[i]);
  }
}

// ---- Eventos

/**
 * Los eventos que llevan marca vertical (03 §3.7), con su nombre público y un rótulo corto para
 * escribir sobre la gráfica (el nombre completo va en la lista que sigue a la gráfica).
 */
export const EVENTOS_CON_MARCA: Readonly<
  Partial<Record<TipoEvento, { etiqueta: string; rotulo: string }>>
> = {
  despegue: { etiqueta: "Despegue", rotulo: "Despegue" },
  fin_combustion: { etiqueta: "Fin de la combustión", rotulo: "Fin combustión" },
  eyeccion: { etiqueta: "Eyección del paracaídas", rotulo: "Eyección" },
  apogeo: { etiqueta: "Apogeo", rotulo: "Apogeo" },
};

export interface Marca {
  tipo: TipoEvento;
  etiqueta: string;
  /** El nombre corto, para escribirlo sobre la gráfica. */
  rotulo: string;
  /** Segundos desde el despegue (>= 0). */
  tMasS: number;
}

/**
 * Las marcas de los eventos que SÍ existen, en orden de T+. Que falte alguno no es un error
 * (en vuelo real hoy solo llegan `fase` y `despegue`). Un evento sin T+, o con T+ negativo, no
 * se marca; si un tipo llega repetido, vale el primero.
 */
export function marcasDe(eventos: readonly Evento[]): Marca[] {
  const vistos = new Set<TipoEvento>();
  const marcas: Marca[] = [];
  for (const e of eventos) {
    const nombre = EVENTOS_CON_MARCA[e.tipo];
    const t = finito(e.t_mas_s);
    if (nombre === undefined || t === null || t < 0 || vistos.has(e.tipo)) continue;
    vistos.add(e.tipo);
    marcas.push({ tipo: e.tipo, ...nombre, tMasS: t });
  }
  return marcas.sort((a, b) => a.tMasS - b.tMasS);
}

/** T+ del aterrizaje, si el evento existe y tiene T+: la gráfica no pasa de ahí. */
export function finDelVuelo(eventos: readonly Evento[]): number | null {
  const e = eventos.find((x) => x.tipo === "aterrizaje");
  const t = finito(e?.t_mas_s);
  return t !== null && t >= 0 ? t : null;
}

// ---- Columnas

export interface Columnas {
  /** T+ (s), estrictamente creciente. */
  t: number[];
  /** El valor de la magnitud en cada T+, o `null` (hueco). */
  y: (number | null)[];
}

/**
 * Las columnas de una magnitud: solo los puntos con T+ válido, desde el despegue (T+ >= 0) hasta
 * el aterrizaje (si hay). Un valor `null` queda `null` en `y`: uPlot dibuja un hueco.
 */
export function columnasDe(
  serie: Serie,
  magnitud: MagnitudId,
  eventos: readonly Evento[],
): Columnas {
  const hasta = finDelVuelo(eventos);
  const t: number[] = [];
  const y: (number | null)[] = [];
  const n = serie.t_mas_s.length;
  for (let i = 0; i < n; i++) {
    const ti = finito(serie.t_mas_s[i]);
    if (ti === null || ti < 0) continue;
    if (hasta !== null && ti > hasta) break;
    // uPlot necesita el eje X creciente: un punto repetido o que retrocede se descarta.
    const previo = t[t.length - 1];
    if (previo !== undefined && ti <= previo) continue;
    t.push(ti);
    y.push(valorDe(serie, i, magnitud));
  }
  return { t, y };
}

/** Cuántos puntos tienen valor (los huecos no cuentan). */
export const puntosConValor = (c: Columnas): number =>
  c.y.reduce<number>((n, v) => n + (v === null ? 0 : 1), 0);

// ---- Rangos de los ejes

/** Rango del eje X: del despegue al último dato (o la marca más tardía), nunca menor que el mínimo. */
export function rangoX(columnas: Columnas, marcas: readonly Marca[]): [number, number] {
  const ultimo = columnas.t[columnas.t.length - 1] ?? 0;
  const ultimaMarca = marcas.reduce((m, x) => Math.max(m, x.tMasS), 0);
  return [0, Math.max(ultimo, ultimaMarca, GRAFICAS_TIEMPO_MIN_S)];
}

/** Rango del eje Y con holgura; incluye el cero si la magnitud lo pide; nunca de ancho cero. */
export function rangoY(columnas: Columnas, magnitud: Magnitud): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of columnas.y) {
    if (v === null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === Number.POSITIVE_INFINITY) return [0, GRAFICAS_RANGO_PLANO];
  if (magnitud.incluyeCero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (max - min < GRAFICAS_RANGO_PLANO) {
    const mitad = (GRAFICAS_RANGO_PLANO - (max - min)) / 2;
    min -= mitad;
    max += mitad;
  }
  const holgura = (max - min) * GRAFICAS_HOLGURA_Y;
  // Si todo está sobre el cero (altitud, aceleración), el eje arranca en cero: el suelo es el suelo.
  const piso = magnitud.incluyeCero && min >= 0 ? 0 : min - holgura;
  return [piso, max + holgura];
}

// ---- Textos

/** El número de una marca del eje: entero si lo es, un decimal si no (coma decimal, 02 §5). */
export function formatoTick(v: number): string {
  return numero(v, Number.isInteger(v) ? 0 : 1);
}

const segundos = (t: number) => `${numero(t, 1)} s`;

/** El valor más alto (`signo` 1) o más bajo (-1) y su T+ (el primero si hay empate). `null` sin datos. */
function extremo(c: Columnas, signo: 1 | -1): { valor: number; t: number } | null {
  let mejor: { valor: number; t: number } | null = null;
  for (let i = 0; i < c.y.length; i++) {
    const v = c.y[i];
    if (v === null || v === undefined) continue;
    if (mejor === null || signo * v > signo * mejor.valor) {
      mejor = { valor: v, t: c.t[i] as number };
    }
  }
  return mejor;
}

/**
 * El texto alternativo de la gráfica: lo más importante de lo que dibuja, en palabras. Sirve para
 * quien no la ve y como resumen visible para todos. `null` si la magnitud no tiene datos.
 */
export function resumenDe(columnas: Columnas, magnitud: Magnitud): string | null {
  const fmt = (v: number) => `${numero(v, magnitud.decimales)} ${magnitud.unidad}`;
  const alto = extremo(columnas, 1);
  if (alto === null) return null;
  switch (magnitud.id) {
    case "altitud":
      return `Altitud máxima: ${fmt(alto.valor)}, a los ${segundos(alto.t)} del despegue.`;
    case "aceleracion":
      return `Aceleración máxima: ${fmt(alto.valor)}, a los ${segundos(alto.t)} del despegue.`;
    case "velocidad": {
      const bajo = extremo(columnas, -1);
      const frases: string[] = [];
      if (alto.valor > 0) {
        frases.push(
          `Subida más rápida: ${fmt(alto.valor)}, a los ${segundos(alto.t)} del despegue.`,
        );
      }
      if (bajo !== null && bajo.valor < 0) {
        frases.push(
          `Bajada más rápida: ${fmt(-bajo.valor)}, a los ${segundos(bajo.t)} del despegue.`,
        );
      }
      return frases.length > 0 ? frases.join(" ") : `Velocidad vertical: ${fmt(alto.valor)}.`;
    }
  }
}

/** Un evento marcado, en una frase (para la lista bajo la gráfica). */
export function textoMarca(m: Marca): string {
  return `${m.etiqueta}: a los ${segundos(m.tMasS)}`;
}

// ---- Medidas

/**
 * Ancho y alto del lienzo para un contenedor del ancho dado. El alto sigue al ancho, con tope; en
 * horizontal en un celular (ventana baja) no pasa de una fracción del alto de la ventana, para que
 * la gráfica quepa sin desplazar (pero nunca baja del mínimo legible).
 */
export function medidasDelLienzo(
  anchoContenedor: number,
  altoVentana: number,
): { ancho: number; alto: number } {
  const ancho = Math.max(
    1,
    Math.floor(anchoContenedor > 0 ? anchoContenedor : GRAFICAS_ANCHO_POR_DEFECTO_PX),
  );
  const tope = Math.max(
    GRAFICAS_ALTO_MIN_PX,
    Math.min(GRAFICAS_ALTO_MAX_PX, altoVentana * GRAFICAS_ALTO_MAX_VENTANA),
  );
  const alto = Math.round(
    Math.max(GRAFICAS_ALTO_MIN_PX, Math.min(ancho * GRAFICAS_PROPORCION, tope)),
  );
  return { ancho, alto };
}
