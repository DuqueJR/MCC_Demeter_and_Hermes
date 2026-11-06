// El reproductor de la simulación para el público (T-635): emite en el navegador, a su ritmo, los
// mensajes de un guion como lo haría el cliente de datos con un stream real, escribiendo en las
// signals de `datos/api.ts` (la UI no sabe que es una simulación, salvo por `meta.modo`).
//
// - Reloj local y monotónico (`entorno.ahoraMs`), inyectable: las pruebas lo mueven a mano.
// - Si la pestaña estuvo en segundo plano y los temporizadores se atrasaron, se aplican de una vez
//   todos los mensajes vencidos, cada uno con su instante programado (la interpolación y la edad
//   salen bien).
// - Antes del primer `estado` y del primer latido no hay "nada que mostrar": se aplican de golpe al
//   iniciar, para que la página no pase por un "sin transmisión" de medio segundo.
// - Al terminar el guion se queda en el último estado y repite el latido de la estación a 1 Hz: sin
//   eso la edad del dato crecería y la simulación terminaría diciendo "Sin señal".
import { batch } from "@preact/signals";
import type { Estacion, LineaJsonl } from "../contrato/tipos";
import { alimentar } from "../datos/api";
import type { Entorno } from "../datos/cliente";
import { WEB_TASA_TIERRA_HZ } from "../datos/constantes";
import { interpolador } from "../datos/interpolacion";
import { RELOJ_TICK_MS } from "../datos/parametros";
import { SerieViva, serieVacia } from "../datos/serie";
import type { Guion } from "./guion";

const MS_POR_S = 1000;
/** El latido de la estación que se repite al terminar el guion (05 §2.4: 1 Hz). */
const PULSO_FINAL_MS = MS_POR_S / WEB_TASA_TIERRA_HZ;

export type EntornoReproductor = Pick<Entorno, "ahoraMs" | "programar">;

function entornoPorDefecto(): EntornoReproductor {
  return {
    ahoraMs: () => performance.now(),
    programar: (f, ms) => {
      const id = setTimeout(f, ms);
      return () => clearTimeout(id);
    },
  };
}

export class Reproductor {
  private readonly guion: Guion;
  private readonly entorno: EntornoReproductor;
  private readonly viva = new SerieViva();
  private indice = 0;
  private inicioMs = 0;
  private tDespegueMs: number | null = null;
  private cancelar: () => void = () => {};
  private activo = false;
  private _terminado = false;
  private ultimoLatido: Estacion | null = null;
  private proximoPulsoMs = 0;
  private repeticiones = 0;

  constructor(guion: Guion, entorno: Partial<EntornoReproductor> = {}) {
    this.guion = guion;
    this.entorno = { ...entornoPorDefecto(), ...entorno };
  }

  /** ¿Ya se emitió todo el guion? (sigue repitiendo el latido). */
  get terminado(): boolean {
    return this._terminado;
  }

  /** Instante del guion desde el que se empieza: el primer `estado` y el primer latido ya están puestos. */
  private desdeMs(): number {
    const primero = (evento: LineaJsonl["evento"]) =>
      this.guion.lineas.find((l) => l.evento === evento)?.t_rel_ms ?? 0;
    return Math.max(primero("estado"), primero("estacion"));
  }

  /** Pone el estado inicial de la simulación y empieza a emitir. */
  iniciar(): void {
    if (this.activo) return;
    const meta = this.guion.lineas.find((l) => l.evento === "meta");
    if (meta?.evento !== "meta") throw new Error("simulación: el guion no trae `meta`");
    const ahora = this.entorno.ahoraMs();
    this.activo = true;
    this.inicioMs = ahora - this.desdeMs();
    batch(() => {
      interpolador.reiniciar();
      alimentar.snapshot(
        {
          meta: meta.datos,
          estado: null,
          salud: null,
          estacion: null,
          eventos: [],
          serie: serieVacia(),
          backfill: null,
          vuelo_completo_url: null,
        },
        ahora,
      );
      alimentar.conexion("conectado");
    });
    this.paso();
  }

  /** Deja de emitir. No toca las signals: quien detiene decide qué dejar en ellas. */
  detener(): void {
    this.activo = false;
    this.cancelar();
    this.cancelar = () => {};
  }

  private aplicar(l: LineaJsonl, llegadaMs: number): void {
    switch (l.evento) {
      case "meta":
        alimentar.meta(l.datos);
        break;
      case "estado":
        this.viva.agregar(l.datos, this.tDespegueMs);
        alimentar.estado(l.datos);
        alimentar.serie(this.viva.serie());
        interpolador.agregar(l.datos, llegadaMs);
        break;
      case "salud":
        alimentar.salud(l.datos);
        break;
      case "estacion":
        alimentar.estacion(l.datos, llegadaMs);
        this.ultimoLatido = l.datos;
        this.proximoPulsoMs = llegadaMs + PULSO_FINAL_MS;
        break;
      case "evento":
        if (alimentar.evento(l.datos) && l.datos.tipo === "despegue")
          this.tDespegueMs = l.datos.t_ms;
        break;
      case "backfill":
        alimentar.backfill(l.datos);
        break;
    }
  }

  /** Aplica lo vencido, avanza el reloj y programa el siguiente despertar. */
  private paso = (): void => {
    if (!this.activo) return;
    const ahora = this.entorno.ahoraMs();
    const t = ahora - this.inicioMs;
    const lineas = this.guion.lineas;
    batch(() => {
      while (this.indice < lineas.length && (lineas[this.indice] as LineaJsonl).t_rel_ms <= t) {
        const l = lineas[this.indice] as LineaJsonl;
        this.aplicar(l, this.inicioMs + l.t_rel_ms);
        this.indice++;
      }
      if (this.indice >= lineas.length) {
        this._terminado = true;
        this.repetirLatido(ahora);
      }
      alimentar.reloj(ahora);
    });
    const siguiente =
      this.indice < lineas.length ? (lineas[this.indice] as LineaJsonl).t_rel_ms - t : Infinity;
    this.cancelar = this.entorno.programar(
      this.paso,
      Math.max(1, Math.min(RELOJ_TICK_MS, siguiente)),
    );
  };

  /** Al terminar el guion: el mismo latido, con la hora corrida, cada segundo (la edad no crece). */
  private repetirLatido(ahora: number): void {
    const ultimo = this.ultimoLatido;
    if (ultimo === null || ahora < this.proximoPulsoMs) return;
    this.repeticiones++;
    alimentar.estacion(
      { ...ultimo, utc_ms: ultimo.utc_ms + this.repeticiones * PULSO_FINAL_MS },
      ahora,
    );
    this.proximoPulsoMs = ahora + PULSO_FINAL_MS;
  }
}
