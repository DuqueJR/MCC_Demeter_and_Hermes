// Reproduce un JSONL como si fuera el relay de una misión: emite cada mensaje en el instante
// `t_rel_ms` de su línea, en bucle. Todo en "tiempo virtual" (ms desde que arrancó el repetidor,
// ya multiplicado por la velocidad): así las pruebas lo mueven sin esperar.
//
// El `id` de cada mensaje es un contador creciente que NO se reinicia al dar la vuelta (05 §1).
// Como la reproducción es determinista, el mensaje de un `id` se reconstruye sin guardar nada:
// el `id` k es la línea (k-1) mod N del archivo. Con eso `Last-Event-ID` se reanuda desde cualquier id.
//
// Simulación de `relay_caido` (propuesta (P) de la bitácora de T-630): un hueco del JSONL (un salto
// de `t_rel_ms` de al menos HUECO_RELAY_CAIDO_MIN_MS) es el relay caído. Entre el último mensaje
// antes del hueco y el primero después, `caido` es `true`.
import type { Mision, Snapshot, TipoMensaje } from "../../src/contrato/tipos.ts";
import { HUECO_RELAY_CAIDO_MIN_MS, PAUSA_ENTRE_VUELTAS_MS } from "./constantes.ts";
import type { Mensaje } from "./jsonl.ts";
import { Acumulador } from "./snapshot.ts";

/** Lo que ve un suscriptor (el servidor HTTP): un mensaje con su id, o la caída del relay. */
export type Emision =
  | { tipo: "mensaje"; id: number; evento: TipoMensaje; data: string }
  | { tipo: "caida" };

export interface MensajeConId {
  id: number;
  evento: TipoMensaje;
  data: string;
}

export class Reproductor {
  readonly mision: Mision;
  readonly escenario: string;
  /** Duración de una vuelta, con la pausa final (ms virtuales). */
  readonly periodoMs: number;
  private readonly mensajes: Mensaje[];
  /** `true` en el mensaje que sigue a un hueco: al emitirlo, el relay "vuelve". */
  private readonly sigueAHueco: boolean[];
  private readonly acc = new Acumulador();
  private readonly suscriptores = new Set<(e: Emision) => void>();
  private readonly metaPorDefecto;
  private vuelta = 0;
  private indice = 0;
  private _ultimoId = 0;
  private _caido = false;

  constructor(mision: Mision, escenario: string, mensajes: Mensaje[]) {
    const ultimo = mensajes[mensajes.length - 1];
    const primerMeta = mensajes.find((m) => m.linea.evento === "meta")?.linea;
    if (!ultimo || primerMeta?.evento !== "meta")
      throw new Error(`${mision}/${escenario}: sin datos`);
    this.mision = mision;
    this.escenario = escenario;
    this.mensajes = mensajes;
    this.metaPorDefecto = primerMeta.datos;
    this.periodoMs = ultimo.t_rel_ms + PAUSA_ENTRE_VUELTAS_MS;
    this.sigueAHueco = mensajes.map(
      (m, i) =>
        i > 0 && m.t_rel_ms - (mensajes[i - 1] as Mensaje).t_rel_ms >= HUECO_RELAY_CAIDO_MIN_MS,
    );
  }

  get ultimoId(): number {
    return this._ultimoId;
  }
  /** Número de vuelta del bucle (0 es la primera). */
  get numeroVuelta(): number {
    return this.vuelta;
  }
  get caido(): boolean {
    return this._caido;
  }
  get totalMensajes(): number {
    return this.mensajes.length;
  }

  suscribir(f: (e: Emision) => void): () => void {
    this.suscriptores.add(f);
    return () => this.suscriptores.delete(f);
  }

  /** Instante virtual en que toca el próximo mensaje. */
  proximoMs(): number {
    return this.vuelta * this.periodoMs + (this.mensajes[this.indice] as Mensaje).t_rel_ms;
  }

  /** Emite todo lo que ya venció a `tVirtualMs`. */
  avanzarHasta(tVirtualMs: number): void {
    while (this.proximoMs() <= tVirtualMs) this.emitirSiguiente();
  }

  private emitirSiguiente(): void {
    const m = this.mensajes[this.indice] as Mensaje;
    if (this.indice === 0) this.acc.reiniciar();
    this._caido = false;
    this.acc.aplicar(m.linea);
    this._ultimoId += 1;
    const emision: Emision = {
      tipo: "mensaje",
      id: this._ultimoId,
      evento: m.linea.evento,
      data: m.data,
    };
    for (const f of [...this.suscriptores]) f(emision);

    this.indice += 1;
    if (this.indice === this.mensajes.length) {
      this.indice = 0;
      this.vuelta += 1;
    } else if (this.sigueAHueco[this.indice]) {
      this._caido = true;
      for (const f of [...this.suscriptores]) f({ tipo: "caida" });
    }
  }

  /** El mensaje de un `id` ya emitido (o `null` si todavía no existe). */
  mensajePorId(id: number): MensajeConId | null {
    if (!Number.isInteger(id) || id < 1 || id > this._ultimoId) return null;
    const m = this.mensajes[(id - 1) % this.mensajes.length] as Mensaje;
    return { id, evento: m.linea.evento, data: m.data };
  }

  /** El `meta` vigente de la vuelta, para mandarlo al conectar. */
  metaActual() {
    return this.acc.meta ?? this.metaPorDefecto;
  }

  snapshot(serieMax?: number): Snapshot {
    return this.acc.snapshot(this.metaPorDefecto, serieMax);
  }
}
