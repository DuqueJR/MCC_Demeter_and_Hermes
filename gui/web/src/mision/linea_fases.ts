// La línea de fases pública (03 §3.2): Rampa → Despegue → Inercia → Apogeo → Paracaídas → En tierra.
// Es la versión pública de los 10 estados; FREE_FALL ("Cayendo") entra como un paso intermedio
// solo si ocurre. Funciones puras: reciben el último `estado` y los `eventos` y devuelven los pasos.
import type { Estado, Evento, Fase, TipoEvento } from "../contrato/tipos";
import { RANGO_FASE } from "./fases";

export type PasoId =
  | "rampa"
  | "despegue"
  | "inercia"
  | "apogeo"
  | "caida"
  | "paracaidas"
  | "tierra";
export type SituacionPaso = "hecho" | "actual" | "pendiente";

export interface Paso {
  id: PasoId;
  titulo: string;
  situacion: SituacionPaso;
  /** T+ (s) en que ocurrió, del evento. `null` si no hay (la rampa no lo tiene: es antes del despegue). */
  tMasS: number | null;
}

interface DefinicionPaso {
  id: PasoId;
  titulo: string;
  /** La fase que marca el paso. */
  fase: Fase;
  /** Evento puntual que también lo marca (además del evento `fase` de esa fase). */
  evento: TipoEvento | null;
}

const PASOS: readonly DefinicionPaso[] = [
  { id: "rampa", titulo: "Rampa", fase: "PREFLIGHT", evento: null },
  { id: "despegue", titulo: "Despegue", fase: "BOOST", evento: "despegue" },
  { id: "inercia", titulo: "Inercia", fase: "COAST", evento: "fin_combustion" },
  { id: "apogeo", titulo: "Apogeo", fase: "APOGEE", evento: "apogeo" },
  { id: "caida", titulo: "Cayendo", fase: "FREE_FALL", evento: null },
  { id: "paracaidas", titulo: "Paracaídas", fase: "DESCENT", evento: null },
  { id: "tierra", titulo: "En tierra", fase: "LANDED", evento: "aterrizaje" },
];

/** El primer evento que marca este paso: el cambio a su fase, o su evento puntual. */
function eventoDelPaso(def: DefinicionPaso, eventos: readonly Evento[]): Evento | undefined {
  return (
    eventos.find((e) => e.tipo === "fase" && e.fase === def.fase) ??
    (def.evento === null ? undefined : eventos.find((e) => e.tipo === def.evento))
  );
}

/**
 * Los pasos de la línea con su situación. Un paso está `hecho` si ya hubo un evento suyo o si la
 * fase actual es posterior; `actual` si es la fase de ahora; `pendiente` si no. Así la línea es
 * correcta aunque la página se abra a mitad de vuelo (el snapshot trae los eventos).
 */
export function construirPasos(estado: Estado | null, eventos: readonly Evento[]): Paso[] {
  const rangoActual = estado === null ? -1 : RANGO_FASE[estado.fase];
  const pasos: Paso[] = [];
  for (const def of PASOS) {
    const evento = eventoDelPaso(def, eventos);
    // "Cayendo" solo aparece si ocurre (no todos los vuelos pasan por FREE_FALL).
    if (def.id === "caida" && evento === undefined && estado?.fase !== "FREE_FALL") continue;
    const rango = RANGO_FASE[def.fase];
    const situacion: SituacionPaso =
      estado !== null && rango === rangoActual
        ? "actual"
        : rango < rangoActual || evento !== undefined
          ? "hecho"
          : "pendiente";
    pasos.push({
      id: def.id,
      titulo: def.titulo,
      situacion,
      tMasS: def.id === "rampa" ? null : (evento?.t_mas_s ?? null),
    });
  }
  // Si algo posterior ya ocurrió, la rampa quedó atrás aunque aún no haya un `estado`.
  const [rampa, ...resto] = pasos;
  if (rampa && rampa.situacion === "pendiente" && resto.some((p) => p.situacion !== "pendiente")) {
    rampa.situacion = "hecho";
  }
  return pasos;
}
