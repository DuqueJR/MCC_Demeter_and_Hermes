// El snapshot (05 §3) se arma con lo emitido hasta el instante actual de la vuelta: el último
// `meta`, `estado`, `salud`, `estacion` y `backfill`; los `eventos`; y la `serie` en columnas,
// decimada a `WEB_SERIE_MAX_PUNTOS`. Al dar la vuelta al bucle se reinicia (es otro "vuelo").
import type {
  Backfill,
  Estacion,
  Estado,
  Evento,
  Fase,
  LineaJsonl,
  Meta,
  Salud,
  Serie,
  Snapshot,
} from "../../src/contrato/tipos.ts";
import { WEB_SERIE_MAX_PUNTOS } from "./constantes.ts";

/** "En vuelo" para decimar (04 §4): de BOOST a DESCENT. Ahí se conserva toda la resolución. */
const FASES_EN_VUELO: readonly Fase[] = ["BOOST", "COAST", "APOGEE", "FREE_FALL", "DESCENT"];

/**
 * Elige a lo sumo `max` de `n` puntos, en orden. Todos los de vuelo se conservan (05 §3: "en vuelo
 * se conserva toda la resolución"); lo que sobra de presupuesto se reparte parejo entre los de
 * tierra, incluidos el primero y el último. Si solo el vuelo ya excede `max`, se decima parejo todo.
 */
export function decimarIndices(n: number, max: number, enVuelo: (i: number) => boolean): number[] {
  const todos = Array.from({ length: n }, (_, i) => i);
  if (n <= max) return todos;
  const vuelo = todos.filter(enVuelo);
  if (vuelo.length >= max) return repartir(todos, max);
  const tierra = todos.filter((i) => !enVuelo(i));
  const elegidos = new Set([...vuelo, ...repartir(tierra, max - vuelo.length)]);
  return [...elegidos].sort((a, b) => a - b);
}

/** `cuantos` elementos de `lista`, a intervalos parejos y con los dos extremos. */
function repartir(lista: number[], cuantos: number): number[] {
  if (cuantos <= 0) return [];
  if (cuantos >= lista.length) return lista;
  if (cuantos === 1) return [lista[lista.length - 1] as number];
  const paso = (lista.length - 1) / (cuantos - 1);
  return Array.from({ length: cuantos }, (_, k) => lista[Math.round(k * paso)] as number);
}

/** Un punto de la trayectoria, tal como llegó (sin decimar). */
interface Punto {
  t_ms: number;
  lat: number | null;
  lon: number | null;
  alt_agl_m: number | null;
  vz_ms: number | null;
  acc_x_g: number;
  acc_y_g: number;
  acc_z_g: number;
  enVuelo: boolean;
}

/** T+ con 2 decimales, como `evento.t_mas_s` (05 §2.5). */
const aSegundos2 = (ms: number) => Math.round(ms / 10) / 100;

export class Acumulador {
  meta: Meta | null = null;
  estado: Estado | null = null;
  salud: Salud | null = null;
  estacion: Estacion | null = null;
  backfill: Backfill | null = null;
  eventos: Evento[] = [];
  private puntos: Punto[] = [];
  /** Reloj del cohete (`t_ms`) del evento `despegue`; antes de él no hay T+. */
  private tDespegueMs: number | null = null;

  reiniciar(): void {
    this.meta = this.estado = this.salud = this.estacion = this.backfill = null;
    this.eventos = [];
    this.puntos = [];
    this.tDespegueMs = null;
  }

  aplicar(linea: LineaJsonl): void {
    switch (linea.evento) {
      case "meta":
        this.meta = linea.datos;
        break;
      case "estado": {
        const e = linea.datos;
        this.estado = e;
        this.puntos.push({
          t_ms: e.t_ms,
          lat: e.pos?.lat ?? null,
          lon: e.pos?.lon ?? null,
          alt_agl_m: e.pos?.alt_agl_m ?? null,
          vz_ms: e.vel?.u_ms ?? null,
          acc_x_g: e.acc_g.x,
          acc_y_g: e.acc_g.y,
          acc_z_g: e.acc_g.z,
          enVuelo: FASES_EN_VUELO.includes(e.fase),
        });
        break;
      }
      case "salud":
        this.salud = linea.datos;
        break;
      case "estacion":
        this.estacion = linea.datos;
        break;
      case "evento":
        this.eventos.push(linea.datos);
        if (linea.datos.tipo === "despegue") this.tDespegueMs = linea.datos.t_ms;
        break;
      case "backfill":
        this.backfill = linea.datos;
        break;
    }
  }

  /** La `serie` en columnas, de a lo sumo `max` puntos. `t_mas_s` es `null` antes del despegue. */
  serie(max: number = WEB_SERIE_MAX_PUNTOS): Serie {
    const idx = decimarIndices(this.puntos.length, max, (i) => this.puntos[i]?.enVuelo === true);
    const de = <T>(f: (p: Punto) => T): T[] => idx.map((i) => f(this.puntos[i] as Punto));
    const t0 = this.tDespegueMs;
    return {
      t_mas_s: de((p) => (t0 === null ? null : aSegundos2(p.t_ms - t0))),
      lat: de((p) => p.lat),
      lon: de((p) => p.lon),
      alt_agl_m: de((p) => p.alt_agl_m),
      vz_ms: de((p) => p.vz_ms),
      acc_x_g: de((p) => p.acc_x_g),
      acc_y_g: de((p) => p.acc_y_g),
      acc_z_g: de((p) => p.acc_z_g),
    };
  }

  /** `metaPorDefecto`: el primer `meta` del archivo, por si aún no se emitió ninguno. */
  snapshot(metaPorDefecto: Meta, max: number = WEB_SERIE_MAX_PUNTOS): Snapshot {
    return {
      meta: this.meta ?? metaPorDefecto,
      estado: this.estado,
      salud: this.salud,
      estacion: this.estacion,
      eventos: this.eventos,
      serie: this.serie(max),
      backfill: this.backfill,
      vuelo_completo_url: null,
    };
  }
}
