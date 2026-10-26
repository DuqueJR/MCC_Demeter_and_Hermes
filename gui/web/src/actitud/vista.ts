// Qué muestra la sección Actitud según el estado de la página (03 §3.6 y §4). T-634.
// Función pura: el instrumento no se queda congelado como si fuera vivo cuando no hay dato fresco.
import type { EstadoPrincipal } from "../datos/estado_pagina";
import { hace } from "../mision/formato";

export type VistaId =
  /** Aún no ha llegado ninguna actitud: no se dibuja el horizonte. */
  | "sin-dato"
  /** `ekf_ok = false`: la orientación no es fiable (03 §3.6). */
  | "no-disponible"
  | "vivo"
  | "debil"
  /** Sin señal del cohete: lo que se ve es la última actitud, atenuada y rotulada. */
  | "sin-senal"
  /** Se cayó el servidor del celular: puede estar desactualizada. */
  | "sin-servidor";

export interface Vista {
  id: VistaId;
  /** ¿Se dibujan el horizonte y la rosa? */
  mostrar: boolean;
  /** El aviso que va bajo los instrumentos; `null` si no hace falta. */
  texto: string | null;
}

export interface EntradaVista {
  principal: EstadoPrincipal;
  /** Hay un `estado` con cuaternión. */
  hayEstado: boolean;
  ekfOk: boolean;
  /** Edad del último dato del cohete (`api.edad`), en ms. */
  edadMs: number | null;
}

export function decidirVista(e: EntradaVista): Vista {
  if (!e.hayEstado || e.principal === "cargando" || e.principal === "sin_transmision") {
    return { id: "sin-dato", mostrar: false, texto: "Aún no hay datos de orientación." };
  }
  if (!e.ekfOk) {
    return { id: "no-disponible", mostrar: false, texto: "Orientación aún no disponible" };
  }
  switch (e.principal) {
    case "sin_senal":
      return {
        id: "sin-senal",
        mostrar: true,
        texto:
          e.edadMs === null
            ? "Sin señal · última orientación conocida"
            : `Sin señal · última orientación ${hace(e.edadMs)}`,
      };
    case "sin_servidor":
      return {
        id: "sin-servidor",
        mostrar: true,
        texto: "Reconectando… la orientación puede estar desactualizada",
      };
    case "senal_debil":
      return { id: "debil", mostrar: true, texto: "Señal débil" };
    default:
      return { id: "vivo", mostrar: true, texto: null };
  }
}
