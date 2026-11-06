// La compuerta de la simulación para el público (T-635, 03 §4, D-W18).
//
// Mientras el navegador reproduce la simulación del vuelo, el cliente de datos real (T-631) sigue
// conectado al relay, pero NO debe escribir en las signals de `api.ts`: pisaría la simulación con su
// `meta` (modo "vivo"), sus latidos o el estado "reconectando". Esta compuerta es el interruptor que
// consulta el cliente:
//   - abierta (`activa()`): el cliente descarta lo que le llega, salvo para mirar si es el PRIMER dato
//     real del cohete; si lo es, avisa con `datoReal()` y la simulación se corta;
//   - al cerrarse, el cliente vuelve a pedir el snapshot (`alCerrar`) y la página vuelve al estado en vivo.
//
// Es un módulo de datos (no de interfaz): solo estado y funciones puras. Quien la abre y la cierra es
// `simulacion/control.ts`.
import { type ReadonlySignal, signal } from "@preact/signals";
import type { Snapshot } from "../contrato/tipos";
import type { MensajeSse } from "./costura";

const _activa = signal(false);
/** `true` mientras se reproduce la simulación LOCAL (no el modo demo de un servidor): la UI muestra "Salir". */
export const simulacionLocal: ReadonlySignal<boolean> = _activa;

type Oyente = () => void;
let alDatoReal: Oyente | null = null;
const alCerrar = new Set<Oyente>();

export const compuerta = {
  /** ¿Está abierta la simulación? Se consulta sin suscribirse (el cliente no es un componente). */
  activa(): boolean {
    return _activa.peek();
  },
  /** Abre la compuerta. `datoReal` se llama una vez, cuando llega el primer dato real del cohete. */
  abrir(datoReal: Oyente): void {
    alDatoReal = datoReal;
    _activa.value = true;
  },
  /** Cierra la compuerta y avisa a los suscritos (el cliente resincroniza). No hace nada si ya estaba cerrada. */
  cerrar(): void {
    if (!_activa.peek()) return;
    _activa.value = false;
    alDatoReal = null;
    for (const f of [...alCerrar]) f();
  },
  /** El cliente vio un dato real del cohete mientras la compuerta estaba abierta. */
  datoReal(): void {
    const f = alDatoReal;
    alDatoReal = null; // una sola vez, aunque lleguen varios mensajes seguidos
    f?.();
  },
  /** Suscribe a "se cerró la compuerta". Devuelve la función que quita la suscripción. */
  alCerrar(f: Oyente): () => void {
    alCerrar.add(f);
    return () => alCerrar.delete(f);
  },
};

/**
 * ¿Este mensaje del stream es un dato del COHETE? `meta` no (también lo manda un relay vacío) y un
 * latido de la estación solo si ya recibió algún paquete del cohete (`ultimo_paquete_hace_ms`). Es
 * el mismo criterio de "nunca llegó un dato" de `estado_pagina.ts`.
 */
export function esDatoRealDelCohete(m: MensajeSse): boolean {
  switch (m.tipo) {
    case "meta":
      return false;
    case "estacion":
      return m.datos.ultimo_paquete_hace_ms !== null;
    default:
      return true; // estado, salud, evento y backfill salen del cohete
  }
}

/** ¿El snapshot trae algo del cohete? (lo mismo, para el snapshot). */
export function snapshotTieneDatoReal(s: Snapshot): boolean {
  return (
    s.estado !== null ||
    s.salud !== null ||
    s.eventos.length > 0 ||
    s.backfill !== null ||
    (s.estacion !== null && s.estacion.ultimo_paquete_hace_ms !== null)
  );
}
