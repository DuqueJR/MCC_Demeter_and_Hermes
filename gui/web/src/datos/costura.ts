// La costura entre el snapshot y el stream, sin cursor en el contrato (T-631).
//
// Estrategia (bitácora de T-631): se abre el stream PRIMERO y todo lo que llega mientras se pide el
// snapshot se guarda en un búfer. Con el snapshot aplicado, del búfer solo se reproduce lo que es
// POSTERIOR a él. Qué es "posterior" sale de los campos que `web-1` ya tiene, uno por tipo:
//
//   estado    `t_ms` mayor que el del `estado` del snapshot. `t_ms` es el reloj del cohete: crece sin
//             saltos dentro de un vuelo. `seq` no sirve: es u8 y da la vuelta en 255 (protocolo §1).
//   salud     `t_ms` mayor que el de la `salud` del snapshot (el mismo reloj).
//   estacion  `utc_ms` mayor que el de la `estacion` del snapshot (es la hora de la estación).
//   evento    que no esté ya en `snapshot.eventos`, por clave (tipo + t_ms + fase + activa). No se
//             compara el tiempo: un evento perdido en el hueco que el búfer sí alcanzó se conserva.
//   backfill  mayor progreso: (completo, recibidos) estrictamente mayor que el del snapshot.
//   meta      siempre: `aplicarVivo` decide si es una novedad o el inicio de otro vuelo.
import type { Backfill, DatosPorTipo, Evento, Snapshot, TipoMensaje } from "../contrato/tipos";

/** Un mensaje del stream con el instante LOCAL (monotónico, ms) en que llegó. */
export type MensajeSse = {
  [T in TipoMensaje]: { tipo: T; datos: DatosPorTipo[T]; llegadaMs: number };
}[TipoMensaje];

/** Identidad de un evento: no se repite en la lista (la reconexión no duplica hechos). */
export function claveEvento(e: Evento): string {
  return `${e.tipo}|${e.t_ms}|${e.fase ?? ""}|${e.activa === null ? "" : e.activa}`;
}

/** Orden del progreso de un backfill: completo gana a cualquier cuenta; luego, `recibidos`. */
function ordenBackfill(b: Backfill): number {
  return (b.completo ? Number.MAX_SAFE_INTEGER : 0) + b.recibidos;
}

/** ¿Este mensaje del búfer es posterior al snapshot? (ver el criterio de cada tipo arriba). */
export function esPosterior(snap: Snapshot, m: MensajeSse): boolean {
  switch (m.tipo) {
    case "meta":
      return true;
    case "estado":
      return snap.estado === null || m.datos.t_ms > snap.estado.t_ms;
    case "salud":
      return snap.salud === null || m.datos.t_ms > snap.salud.t_ms;
    case "estacion":
      return snap.estacion === null || m.datos.utc_ms > snap.estacion.utc_ms;
    case "evento": {
      const clave = claveEvento(m.datos);
      return !snap.eventos.some((e) => claveEvento(e) === clave);
    }
    case "backfill":
      return snap.backfill === null || ordenBackfill(m.datos) > ordenBackfill(snap.backfill);
  }
}
