// Los objetivos de la misión que "se encienden solos" (03 §3.2). Funciones puras: salen de `fase`,
// `flags` y `act` del último `estado` y de los `eventos` del contrato (05 §2.2 y §2.5).
// Fuera del alcance de T-624: "motor caracterizado" (no hay fuente de datos todavía).
import type { Estado, Evento, Mision, TipoEvento } from "../contrato/tipos";
import { RANGO_FASE } from "./fases";

export type ObjetivoId =
  | "despegue"
  | "fin_combustion"
  | "eyeccion"
  | "apogeo"
  | "aterrizaje"
  | "camaras";

export interface Objetivo {
  id: ObjetivoId;
  titulo: string;
  encendido: boolean;
  /** T+ (s) en que se cumplió, del evento. `null` si se cumplió pero no hay evento (o no se cumplió). */
  tMasS: number | null;
  /** Altitud (m) del apogeo, si el evento la trae. */
  altitudM: number | null;
}

const primero = (eventos: readonly Evento[], tipo: TipoEvento) =>
  eventos.find((e) => e.tipo === tipo);

/** El último evento de ese tipo: para un estado que cambia (las cámaras), el que vale ahora. */
function ultimo(eventos: readonly Evento[], tipo: TipoEvento): Evento | undefined {
  for (let i = eventos.length - 1; i >= 0; i--) {
    const e = eventos[i];
    if (e?.tipo === tipo) return e;
  }
  return undefined;
}

function objetivo(
  id: ObjetivoId,
  titulo: string,
  encendido: boolean,
  evento: Evento | undefined,
): Objetivo {
  return {
    id,
    titulo,
    encendido,
    tMasS: encendido ? (evento?.t_mas_s ?? null) : null,
    altitudM: encendido && id === "apogeo" ? (evento?.valor ?? null) : null,
  };
}

/**
 * Los objetivos en el orden de 03 §3.2. Cada uno está encendido si ya ocurrió su evento o si el
 * `estado` lo dice (`fase`, `flags`, `act`); así la lista es correcta si la página se abre a mitad
 * de vuelo. "Cámaras grabando" solo existe en Deméter y refleja `act.cam_ok` de ahora.
 */
export function calcularObjetivos(
  estado: Estado | null,
  eventos: readonly Evento[],
  mision: Mision,
): Objetivo[] {
  const rango = estado === null ? -1 : RANGO_FASE[estado.fase];
  const lista: Objetivo[] = [
    objetivo(
      "despegue",
      "Despegue detectado",
      primero(eventos, "despegue") !== undefined || rango >= RANGO_FASE.BOOST,
      primero(eventos, "despegue"),
    ),
    objetivo(
      "fin_combustion",
      "Fin de la combustión",
      primero(eventos, "fin_combustion") !== undefined || rango >= RANGO_FASE.COAST,
      primero(eventos, "fin_combustion"),
    ),
    objetivo(
      "eyeccion",
      "Eyección del paracaídas",
      primero(eventos, "eyeccion") !== undefined || estado?.flags.eyeccion === true,
      primero(eventos, "eyeccion"),
    ),
    objetivo(
      "apogeo",
      "Apogeo",
      primero(eventos, "apogeo") !== undefined || estado?.flags.apogeo === true,
      primero(eventos, "apogeo"),
    ),
    objetivo(
      "aterrizaje",
      "Aterrizaje",
      primero(eventos, "aterrizaje") !== undefined || estado?.fase === "LANDED",
      primero(eventos, "aterrizaje"),
    ),
  ];
  if (mision === "demeter") {
    lista.push(
      objetivo(
        "camaras",
        "Cámaras grabando",
        estado?.act.cam_ok === true,
        ultimo(eventos, "camaras"),
      ),
    );
  }
  return lista;
}
