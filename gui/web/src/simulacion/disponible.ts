// ¿Se puede ofrecer (y empezar) la simulación para el público? (03 §4, D-W18, T-635 y T-636).
//
// Regla de T-635: solo en el estado principal "Sin transmisión todavía".
// Regla de T-636, con `SIMULACION_SIEMPRE_VISIBLE` (TEMPORAL, ver `datos/parametros.ts`): además en
// "Cargando" y "Sin servidor", pero solo si nunca llegó un dato real del cohete. Con el interruptor
// en `false` vale la de T-635. Nunca en en_vivo, señal débil ni sin señal (el cohete ya transmitió).
import { computed } from "@preact/signals";
import type { EstadoPrincipal } from "../datos/api";
import { backfill, estacion, estado, estadoPagina, eventos, salud } from "../datos/api";
import { SIMULACION_SIEMPRE_VISIBLE } from "../datos/parametros";

/** Lo que `simulacionDisponible` necesita saber de la página. */
export interface EntradaDisponible {
  principal: EstadoPrincipal;
  /** ¿Alguna vez llegó un dato del cohete (no solo un latido vacío de la estación)? */
  hayDatoReal: boolean;
}

/** Pura: el interruptor llega por argumento para poder probar sus dos valores. */
export function simulacionDisponible(
  e: EntradaDisponible,
  siempreVisible: boolean = SIMULACION_SIEMPRE_VISIBLE,
): boolean {
  if (e.principal === "sin_transmision") return true;
  if (!siempreVisible || e.hayDatoReal) return false;
  return e.principal === "cargando" || e.principal === "sin_servidor";
}

/**
 * ¿Hay algo del cohete en pantalla? Es el mismo criterio que `snapshotTieneDatoReal` de la compuerta:
 * `estado`, `salud`, algún evento, un backfill o un latido que ya vio un paquete del cohete.
 */
export const hayDatoReal = computed(
  () =>
    estado.value !== null ||
    salud.value !== null ||
    eventos.value.length > 0 ||
    backfill.value !== null ||
    (estacion.value !== null && estacion.value.ultimo_paquete_hace_ms !== null),
);

/** Lo que lee el botón (`EstadoMision`) y comprueba `control.ts` al terminar la descarga. */
export const simulacionOfrecida = computed(() =>
  simulacionDisponible({ principal: estadoPagina.value.principal, hayDatoReal: hayDatoReal.value }),
);
