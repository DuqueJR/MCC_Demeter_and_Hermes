// Qué muestra la sección Gráficas según los datos y el estado de la página (03 §3.7 y §4). T-633.
// Función pura: la gráfica no finge estar viva cuando no hay dato fresco, y antes del despegue
// no se dibuja nada (hay un estado vacío que lo explica).
import type { EstadoPrincipal } from "../datos/estado_pagina";
import { hace } from "../mision/formato";
import { GRAFICAS_PUNTOS_MIN } from "./constantes";

export type VistaId =
  /** Todavía no hay despegue: no hay gráfica que dibujar. */
  | "antes-del-despegue"
  /** Hubo despegue pero aún no hay dos puntos para trazar una línea. */
  | "reuniendo"
  | "vivo"
  | "debil"
  /** Sin señal del cohete: lo que se ve es lo último que llegó, atenuado y rotulado. */
  | "sin-senal"
  /** Se cayó el servidor del celular: puede estar desactualizada. */
  | "sin-servidor";

export interface Vista {
  id: VistaId;
  /** ¿Se dibuja la gráfica? */
  mostrar: boolean;
  /** El aviso que va bajo la gráfica o en su lugar; `null` si no hace falta. */
  texto: string | null;
}

export interface EntradaVista {
  principal: EstadoPrincipal;
  /** Hay un evento `despegue`. */
  hayDespegue: boolean;
  /** Puntos de la serie desde el despegue (ver `columnasDe`). */
  puntos: number;
  /** Edad del último dato del cohete (`api.edad`), en ms. */
  edadMs: number | null;
}

export const TEXTO_ANTES_DEL_DESPEGUE = "La gráfica empieza con el despegue.";
export const TEXTO_REUNIENDO = "Reuniendo los primeros datos del vuelo…";
export const TEXTO_SIN_VALORES = "Aún no hay datos de esta medida.";

export function decidirVista(e: EntradaVista): Vista {
  if (e.puntos < GRAFICAS_PUNTOS_MIN) {
    return e.hayDespegue
      ? { id: "reuniendo", mostrar: false, texto: TEXTO_REUNIENDO }
      : { id: "antes-del-despegue", mostrar: false, texto: TEXTO_ANTES_DEL_DESPEGUE };
  }
  switch (e.principal) {
    case "sin_senal":
      return {
        id: "sin-senal",
        mostrar: true,
        texto:
          e.edadMs === null
            ? "Sin señal · la gráfica llega hasta el último dato recibido"
            : `Sin señal · último dato ${hace(e.edadMs)}`,
      };
    case "sin_servidor":
      return {
        id: "sin-servidor",
        mostrar: true,
        texto: "Reconectando… la gráfica puede estar desactualizada",
      };
    case "senal_debil":
      return { id: "debil", mostrar: true, texto: "Señal débil" };
    default:
      return { id: "vivo", mostrar: true, texto: null };
  }
}
