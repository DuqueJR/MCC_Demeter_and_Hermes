// Interpolación para dibujar (03 §5, Objetivos 7.E.1). T-631.
// La posición se interpola lineal y el cuaternión con *slerp*, con un retraso de presentación de
// 1 paquete (`INTERP_RETRASO_MS`): se dibuja un instante un poco anterior al último paquete, así
// siempre hay un paquete "adelante" hacia el cual moverse y el movimiento sale fluido.
//
// No es una signal de `api.ts` (esa interfaz está congelada). La UI la llama en su propio ciclo de
// dibujo: `interpolador.muestrear(ahoraLocalMs)` (con el mismo reloj monotónico del cliente).
//
// El reloj del cohete (`t_ms`) se relaciona con el local con el desfase MÍNIMO reciente
// (`llegada − t_ms`): el paquete menos retrasado por la red define la correspondencia, y el
// retraso de los demás (jitter) no hace retroceder el dibujo. Además, el instante que se dibuja
// nunca retrocede.
import type { Estado } from "../contrato/tipos";
import {
  INTERP_HISTORIAL,
  INTERP_HUECO_MAX_MS,
  INTERP_RETRASO_MS,
  SLERP_UMBRAL_LINEAL,
} from "./parametros";

export interface Cuaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

/** Lo que dibuja la UI: la posición y la actitud en un instante. */
export interface Muestra {
  /** `null` si en ese instante no hay posición (sin fix): la UI dibuja el LKP (GS-03). */
  lat: number | null;
  lon: number | null;
  alt_agl_m: number | null;
  q: Cuaternion;
  /** Reloj del cohete (ms) al que corresponde la muestra. */
  t_ms: number;
}

/** Interpolación lineal de `a` a `b`, con `f` de 0 a 1. */
export function lineal(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

function normalizar(q: Cuaternion): Cuaternion {
  const n = Math.hypot(q.w, q.x, q.y, q.z);
  return n === 0 ? { w: 1, x: 0, y: 0, z: 0 } : { w: q.w / n, x: q.x / n, y: q.y / n, z: q.z / n };
}

/**
 * *Slerp* por el camino corto: `q` y `-q` son la misma actitud, así que si el producto escalar es
 * negativo se invierte uno. Con cuaterniones casi iguales se usa *nlerp* (el *slerp* divide entre
 * un seno casi cero). El resultado siempre tiene norma 1.
 */
export function slerp(a: Cuaternion, b: Cuaternion, f: number): Cuaternion {
  let dot = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  const signo = dot < 0 ? -1 : 1;
  dot *= signo;
  const bw = b.w * signo;
  const bx = b.x * signo;
  const by = b.y * signo;
  const bz = b.z * signo;
  let ka: number;
  let kb: number;
  if (dot > SLERP_UMBRAL_LINEAL) {
    ka = 1 - f;
    kb = f;
  } else {
    const theta = Math.acos(dot);
    const seno = Math.sin(theta);
    ka = Math.sin((1 - f) * theta) / seno;
    kb = Math.sin(f * theta) / seno;
  }
  return normalizar({
    w: a.w * ka + bw * kb,
    x: a.x * ka + bx * kb,
    y: a.y * ka + by * kb,
    z: a.z * ka + bz * kb,
  });
}

function muestraDe(e: Estado): Muestra {
  return {
    lat: e.pos?.lat ?? null,
    lon: e.pos?.lon ?? null,
    alt_agl_m: e.pos?.alt_agl_m ?? null,
    q: e.q,
    t_ms: e.t_ms,
  };
}

/** Interpola entre dos estados (puro; `f` de 0 a 1). Sin posición en alguno de los dos, se queda en `a`. */
export function interpolarEstados(a: Estado, b: Estado, f: number): Muestra {
  const base = muestraDe(a);
  const q = slerp(a.q, b.q, f);
  const t_ms = lineal(a.t_ms, b.t_ms, f);
  if (a.pos === null || b.pos === null) return { ...base, q, t_ms };
  return {
    lat: lineal(a.pos.lat, b.pos.lat, f),
    lon: lineal(a.pos.lon, b.pos.lon, f),
    alt_agl_m: lineal(a.pos.alt_agl_m, b.pos.alt_agl_m, f),
    q,
    t_ms,
  };
}

interface Entrada {
  estado: Estado;
  llegadaMs: number;
}

export interface OpcionesInterpolador {
  retrasoMs?: number;
  huecoMaxMs?: number;
  historial?: number;
}

export class Interpolador {
  private readonly retrasoMs: number;
  private readonly huecoMaxMs: number;
  private readonly historial: number;
  private entradas: Entrada[] = [];
  /** Desfase mínimo reciente `llegada − t_ms` de los paquetes recordados. */
  private desfaseMs = 0;
  private objetivoPrevio = Number.NEGATIVE_INFINITY;

  constructor(opciones: OpcionesInterpolador = {}) {
    this.retrasoMs = opciones.retrasoMs ?? INTERP_RETRASO_MS;
    this.huecoMaxMs = opciones.huecoMaxMs ?? INTERP_HUECO_MAX_MS;
    this.historial = opciones.historial ?? INTERP_HISTORIAL;
  }

  get tamano(): number {
    return this.entradas.length;
  }

  reiniciar(): void {
    this.entradas = [];
    this.desfaseMs = 0;
    this.objetivoPrevio = Number.NEGATIVE_INFINITY;
  }

  /** Registra un `estado` con el instante local (monotónico) de su llegada. */
  agregar(e: Estado, llegadaMs: number): void {
    const ultimo = this.entradas[this.entradas.length - 1];
    if (ultimo !== undefined) {
      if (e.t_ms === ultimo.estado.t_ms) return; // repetido
      if (e.t_ms < ultimo.estado.t_ms) this.reiniciar(); // otro vuelo, o el cohete se reinició
    }
    this.entradas.push({ estado: e, llegadaMs });
    if (this.entradas.length > this.historial) this.entradas.shift();
    this.desfaseMs = Math.min(...this.entradas.map((x) => x.llegadaMs - x.estado.t_ms));
  }

  /**
   * La muestra a dibujar en `ahoraMs` (reloj local monotónico), o `null` si aún no hay datos.
   * Se queda en el último paquete si no hay uno posterior (no extrapola) y no interpola a través de
   * un hueco de señal (`huecoMaxMs`).
   */
  muestrear(ahoraMs: number): Muestra | null {
    const primero = this.entradas[0];
    const ultimo = this.entradas[this.entradas.length - 1];
    if (primero === undefined || ultimo === undefined) return null;
    const objetivo = Math.max(this.objetivoPrevio, ahoraMs - this.desfaseMs - this.retrasoMs);
    this.objetivoPrevio = objetivo;

    if (objetivo >= ultimo.estado.t_ms) return muestraDe(ultimo.estado);
    if (objetivo <= primero.estado.t_ms) return muestraDe(primero.estado);
    for (let i = 1; i < this.entradas.length; i++) {
      const b = (this.entradas[i] as Entrada).estado;
      if (objetivo > b.t_ms) continue;
      const a = (this.entradas[i - 1] as Entrada).estado;
      if (b.t_ms - a.t_ms > this.huecoMaxMs) return muestraDe(a);
      return interpolarEstados(a, b, (objetivo - a.t_ms) / (b.t_ms - a.t_ms));
    }
    return muestraDe(ultimo.estado);
  }
}

/** El interpolador de la página: lo alimenta el cliente de datos y lo consulta la UI. */
export const interpolador = new Interpolador();
