// El banner de alarma de descenso rápido (03 §4, D-W18): rojo y fijo mientras `alarmas.descenso_rapido`
// esté activa y `WEB_ALARMA_SOSTENER_S` más. La web NO recalcula la alarma: solo la lee del contrato.
// El sostener es de presentación (por eso no vive en `estadoPagina`): evita que el banner parpadee
// si la alarma se apaga un instante, y deja que el público alcance a leerlo.
import { type ReadonlySignal, signal } from "@preact/signals";
import { WEB_ALARMA_SOSTENER_S } from "../datos/constantes";

const MS_POR_S = 1000;

/** Programa `f` dentro de `ms` y devuelve la función que lo cancela. Inyectable para las pruebas. */
export type Programar = (f: () => void, ms: number) => () => void;

const programarPorDefecto: Programar = (f, ms) => {
  const id = setTimeout(f, ms);
  return () => clearTimeout(id);
};

/**
 * Decide si el banner se ve. Se avisa con `actualizar(activa)` cada vez que cambia la alarma:
 * - al activarse, se ve de inmediato;
 * - al apagarse, sigue visible `sostenerMs` más; si se reactiva antes, el plazo se cancela.
 * Usa un temporizador local, no el reloj del celular (05 §0).
 */
export class SostenedorAlarma {
  private readonly _visible = signal(false);
  private readonly _sosteniendo = signal(false);
  private readonly sostenerMs: number;
  private readonly programar: Programar;
  private cancelar: (() => void) | null = null;
  private activa = false;

  constructor(
    sostenerMs: number = WEB_ALARMA_SOSTENER_S * MS_POR_S,
    programar: Programar = programarPorDefecto,
  ) {
    this.sostenerMs = sostenerMs;
    this.programar = programar;
  }

  /** `true` mientras el banner debe verse (alarma activa o en el plazo de sostener). */
  get visible(): ReadonlySignal<boolean> {
    return this._visible;
  }

  /** `true` si la alarma ya se apagó y el banner solo se sostiene. */
  get sosteniendo(): ReadonlySignal<boolean> {
    return this._sosteniendo;
  }

  actualizar(activa: boolean): void {
    if (activa === this.activa) return;
    this.activa = activa;
    this.cancelar?.();
    this.cancelar = null;
    if (activa) {
      this._visible.value = true;
      this._sosteniendo.value = false;
      return;
    }
    if (!this._visible.value) return;
    this._sosteniendo.value = true;
    this.cancelar = this.programar(() => {
      this.cancelar = null;
      this._visible.value = false;
      this._sosteniendo.value = false;
    }, this.sostenerMs);
  }

  /** Cancela el plazo pendiente (al desmontar). */
  detener(): void {
    this.cancelar?.();
    this.cancelar = null;
  }
}
