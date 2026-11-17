// Títulos públicos de las fases (02 §9). El código técnico va en el detalle, no aquí.
import type { Fase } from "../contrato/tipos";

export const TITULO_FASE: Record<Fase, string> = {
  BOOT: "Encendiendo",
  PREFLIGHT: "En la rampa",
  ARMED: "Listo para despegar",
  BOOST: "¡Despegue!",
  COAST: "Subiendo por inercia",
  APOGEE: "¡Apogeo!",
  FREE_FALL: "Cayendo",
  DESCENT: "Bajando con paracaídas",
  LANDED: "En tierra",
  ERROR: "Revisando en tierra",
};

// Subtítulos públicos de las fases (02 §9).
export const SUBTITULO_FASE: Record<Fase, string> = {
  BOOT: "El cohete está despertando sus sistemas",
  PREFLIGHT: "Preparando sensores y buscando satélites",
  ARMED: "Armado y esperando la ignición",
  BOOST: "Subiendo con el motor encendido",
  COAST: "El motor se apagó y sigue subiendo",
  APOGEE: "Llegó a su punto más alto",
  FREE_FALL: "Bajando antes de abrir el paracaídas",
  DESCENT: "Descenso controlado",
  LANDED: "Aterrizó. El equipo va a recuperarlo.",
  ERROR: "El equipo está resolviendo un problema antes del vuelo",
};

/**
 * Orden de las fases en un vuelo (maquina_estados §1). BOOT, PREFLIGHT, ARMED y ERROR (esta última
 * solo en tierra, D-012) son "la rampa". Sirve para saber si una fase ya se alcanzó.
 */
export const RANGO_FASE: Record<Fase, number> = {
  BOOT: 0,
  PREFLIGHT: 0,
  ARMED: 0,
  ERROR: 0,
  BOOST: 1,
  COAST: 2,
  APOGEE: 3,
  FREE_FALL: 4,
  DESCENT: 5,
  LANDED: 6,
};
