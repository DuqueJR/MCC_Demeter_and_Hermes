// La cuadrícula de Telemetría (03 §3.3, Objetivos 7.B). Funciones puras: del último `estado`, los
// `eventos` y `salud` sacan lo que se muestra. El formato (coma decimal, unidades) está en `formato.ts`.
import type { Estado, Evento, Salud } from "../contrato/tipos";
import type { EstadoPrincipal } from "../datos/api";
import { WEB_DATO_VIEJO_S } from "../datos/constantes";
import { numero } from "./formato";

const MS_POR_S = 1000;

/** Decimales con que se muestra cada magnitud (el contrato trae más; 02 §5 pide números legibles). */
export const DECIMALES_ALTITUD = 0;
export const DECIMALES_VELOCIDAD = 1;
export const DECIMALES_ACELERACION = 2;

export type Sentido = "sube" | "baja" | "quieto";

export interface VistaTelemetria {
  /** Altitud sobre el suelo (m). Sin posición válida es la última conocida (`lkp`), en rojo (GS-03). */
  altitud: { valor: number | null; lkp: boolean };
  /** Velocidad vertical (m/s) con su sentido: positiva sube. */
  vertical: { valor: number | null; sentido: Sentido | null };
  /** Velocidad total (m/s). */
  total: number | null;
  /** El apogeo queda fijo cuando ocurre: su altura y el T+ en que ocurrió. */
  apogeo: { alturaM: number | null; tMasS: number | null };
  /** Aceleración en el marco del cuerpo (g). */
  aceleracion: { x: number; y: number; z: number } | null;
}

/** ¿Hacia dónde va? Un valor que se muestra como cero (`0,0`) no tiene flecha. */
export function sentidoVertical(velUMs: number): Sentido {
  const mostrado = Number(velUMs.toFixed(DECIMALES_VELOCIDAD));
  return mostrado > 0 ? "sube" : mostrado < 0 ? "baja" : "quieto";
}

/** ¿El dato es viejo? (edad >= `WEB_DATO_VIEJO_S`: a partir de ahí "señal débil", 03 §4). */
export function datoViejo(edadMs: number | null): boolean {
  return edadMs !== null && edadMs >= WEB_DATO_VIEJO_S * MS_POR_S;
}

/**
 * Qué mostrar en cada celda. Sin `estado` todo es `null` (la sección lo pinta como "sin dato").
 * El apogeo sale del evento (altitud y T+); si falta, de `salud.apogeo_m` cuando `flags.apogeo` ya está.
 */
export function vistaTelemetria(
  estado: Estado | null,
  eventos: readonly Evento[],
  salud: Salud | null,
  principal: EstadoPrincipal,
): VistaTelemetria {
  const vacia: VistaTelemetria = {
    altitud: { valor: null, lkp: false },
    vertical: { valor: null, sentido: null },
    total: null,
    apogeo: { alturaM: null, tMasS: null },
    aceleracion: null,
  };
  if (estado === null) return vacia;

  // Como la barra (03 §3.0): sin posición válida, o sin señal, la altitud es la última conocida.
  const alturaActual = estado.pos?.alt_agl_m ?? estado.lkp?.alt_agl_m ?? null;
  const lkp = principal === "sin_senal" || estado.pos === null;

  const eventoApogeo = eventos.find((e) => e.tipo === "apogeo");
  const apogeoDeSalud = estado.flags.apogeo ? (salud?.apogeo_m ?? null) : null;

  return {
    altitud: { valor: alturaActual, lkp },
    vertical: {
      valor: estado.vel?.u_ms ?? null,
      sentido: estado.vel === null ? null : sentidoVertical(estado.vel.u_ms),
    },
    total: estado.vel?.total_ms ?? null,
    apogeo: {
      alturaM: eventoApogeo?.valor ?? apogeoDeSalud,
      tMasS: eventoApogeo?.t_mas_s ?? null,
    },
    aceleracion: { x: estado.acc_g.x, y: estado.acc_g.y, z: estado.acc_g.z },
  };
}

/** El texto de un número o el guion de "sin dato". */
export function textoONulo(valor: number | null, decimales: number): string {
  return valor === null ? "—" : numero(valor, decimales);
}
