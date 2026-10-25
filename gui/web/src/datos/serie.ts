// La `serie` viva (05 §3): la trayectoria en columnas que crece con cada `estado` del stream.
// El snapshot trae la serie decimada; después, cada `estado` agrega un punto. Al pasarse de
// `WEB_SERIE_MAX_PUNTOS` se recorta: se conserva toda la resolución del vuelo y se decima la tierra
// (la misma regla del snapshot, 05 §3). T-631.
//
// Se guarda aparte, de cada punto, si es "de tierra" (BOOT, PREFLIGHT, ARMED, LANDED, ERROR): el
// snapshot no lo dice, y sin eso la espera en la rampa se comería el vuelo al recortar. Los puntos
// que vienen del snapshot se clasifican por su `t_mas_s` (antes del despegue o sin T+ = tierra).
import type { Estado, Fase, Serie } from "../contrato/tipos";
import { WEB_SERIE_MAX_PUNTOS } from "./constantes";
import { SERIE_RECORTE_FRACCION } from "./parametros";

const MS_POR_S = 1000;
const CENTESIMAS = 100;
/** Fases en las que la trayectoria no es el vuelo: ahí se puede decimar. */
const FASES_DE_TIERRA: ReadonlySet<Fase> = new Set<Fase>([
  "BOOT",
  "PREFLIGHT",
  "ARMED",
  "LANDED",
  "ERROR",
]);

const COLUMNAS = [
  "t_mas_s",
  "lat",
  "lon",
  "alt_agl_m",
  "vz_ms",
  "acc_x_g",
  "acc_y_g",
  "acc_z_g",
] as const satisfies readonly (keyof Serie)[];

export function serieVacia(): Serie {
  return {
    t_mas_s: [],
    lat: [],
    lon: [],
    alt_agl_m: [],
    vz_ms: [],
    acc_x_g: [],
    acc_y_g: [],
    acc_z_g: [],
  };
}

/** T+ con 2 decimales (como `evento.t_mas_s`, 05 §2.5); `null` antes del despegue. */
export function tMasS(tMs: number, tDespegueMs: number | null): number | null {
  if (tDespegueMs === null) return null;
  return Math.round(((tMs - tDespegueMs) / MS_POR_S) * CENTESIMAS) / CENTESIMAS;
}

/** `cuantos` índices de `0..n-1` a intervalos parejos, con los dos extremos. */
function repartir(indices: number[], cuantos: number): number[] {
  if (cuantos >= indices.length) return indices;
  if (cuantos <= 0) return [];
  if (cuantos === 1) return [indices[indices.length - 1] as number];
  const paso = (indices.length - 1) / (cuantos - 1);
  return Array.from({ length: cuantos }, (_, k) => indices[Math.round(k * paso)] as number);
}

export class SerieViva {
  private cols: Serie = serieVacia();
  /** Paralelo a las columnas: ¿el punto es de tierra? (se puede decimar). */
  private tierra: boolean[] = [];

  /** Arma la serie viva desde la del snapshot (el T+ decide qué es tierra). */
  static desde(s: Serie): SerieViva {
    const v = new SerieViva();
    for (const c of COLUMNAS) v.cols[c] = [...s[c]];
    v.tierra = s.t_mas_s.map((t) => t === null || t < 0);
    return v;
  }

  get largo(): number {
    return this.cols.t_mas_s.length;
  }

  /** Agrega el punto de un `estado` y recorta si hace falta. */
  agregar(e: Estado, tDespegueMs: number | null, max: number = WEB_SERIE_MAX_PUNTOS): void {
    const c = this.cols;
    c.t_mas_s.push(tMasS(e.t_ms, tDespegueMs));
    c.lat.push(e.pos?.lat ?? null);
    c.lon.push(e.pos?.lon ?? null);
    c.alt_agl_m.push(e.pos?.alt_agl_m ?? null);
    c.vz_ms.push(e.vel?.u_ms ?? null);
    c.acc_x_g.push(e.acc_g.x);
    c.acc_y_g.push(e.acc_g.y);
    c.acc_z_g.push(e.acc_g.z);
    this.tierra.push(FASES_DE_TIERRA.has(e.fase));
    if (this.largo > max) this.recortar(Math.floor(max * SERIE_RECORTE_FRACCION));
  }

  /**
   * Deja `objetivo` puntos. Los de vuelo se conservan todos; el resto del cupo se reparte entre los
   * de tierra. Si solo el vuelo ya se pasa, se decima parejo todo (último recurso).
   */
  private recortar(objetivo: number): void {
    const n = this.largo;
    const todos = Array.from({ length: n }, (_, i) => i);
    const vuelo = todos.filter((i) => !this.tierra[i]);
    const elegidos =
      vuelo.length >= objetivo
        ? repartir(todos, objetivo)
        : [
            ...new Set([
              ...vuelo,
              ...repartir(
                todos.filter((i) => this.tierra[i]),
                objetivo - vuelo.length,
              ),
            ]),
          ].sort((a, b) => a - b);
    for (const c of COLUMNAS) {
      const col = this.cols[c];
      this.cols[c] = elegidos.map((i) => col[i] ?? null);
    }
    this.tierra = elegidos.map((i) => this.tierra[i] === true);
  }

  /** Una copia: lo publicado en la signal no cambia después. */
  serie(): Serie {
    const s = serieVacia();
    for (const c of COLUMNAS) s[c] = [...this.cols[c]];
    return s;
  }
}
