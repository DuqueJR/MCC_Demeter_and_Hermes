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
