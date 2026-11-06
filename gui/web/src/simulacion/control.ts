// Control de la simulación para el público (T-635, 03 §4, D-W18): empezar, cortar y salir.
//
// Todo pasa en el navegador: sin servidor nuevo y sin tocar el relay (funciona en un hosting estático).
//
//   inactiva --pulsar--> cargando --guion listo--> corriendo --salir / dato real--> inactiva
//                           \--falla--> error --pulsar--> cargando
//
// Cómo se evita confundirla con lo real:
//   - el guion lleva `meta.modo = "simulacion"`, así que `estadoPagina.simulacion` es `true` y la barra
//     muestra el banner fijo y la marca SIM (no hay forma de verla sin ellos);
//   - la compuerta (`datos/compuerta.ts`) hace que el cliente real no escriba mientras tanto;
//   - el primer dato real del cohete corta la simulación y vuelve el estado en vivo.
import { type ReadonlySignal, signal } from "@preact/signals";
import type { Backfill, Estacion, Meta } from "../contrato/tipos";
import {
  alimentar,
  backfill,
  type ConexionServidor,
  conexion,
  estacion,
  estadoPagina,
  meta,
} from "../datos/api";
import { compuerta } from "../datos/compuerta";
import { interpolador } from "../datos/interpolacion";
import { serieVacia } from "../datos/serie";
import type { Guion } from "./guion";
import { type EntornoReproductor, Reproductor } from "./reproductor";

export type FaseSimulacion = "inactiva" | "cargando" | "error" | "corriendo";

const _fase = signal<FaseSimulacion>("inactiva");
/** En qué está la simulación; la lee el botón del estado "Sin transmisión todavía". */
export const faseSimulacion: ReadonlySignal<FaseSimulacion> = _fase;

/** Lo que había en pantalla antes de empezar, para devolverlo al salir (y poder salir sin cliente). */
interface Foto {
  meta: Meta | null;
  estacion: Estacion | null;
  backfill: Backfill | null;
  conexion: ConexionServidor;
}

let reproductor: Reproductor | null = null;
let foto: Foto | null = null;
/** Número del último pedido: una descarga que ya no importa (salió, o llegó un dato real) se descarta. */
let pedido = 0;

/** Devuelve las signals a lo que había antes de la simulación, sin dejar rastros de ella. */
function restaurar(f: Foto | null): void {
  interpolador.reiniciar();
  if (f === null || f.meta === null) {
    alimentar.reiniciar();
    return;
  }
  alimentar.snapshot(
    {
      meta: f.meta,
      estado: null,
      salud: null,
      estacion: f.estacion,
      eventos: [],
      serie: serieVacia(),
      backfill: f.backfill,
      vuelo_completo_url: null,
    },
    performance.now(),
  );
  alimentar.conexion(f.conexion);
}

/** Corta la simulación y devuelve la página al estado en vivo. Seguro de llamar si no hay ninguna. */
function terminar(): void {
  pedido++;
  reproductor?.detener();
  reproductor = null;
  if (_fase.peek() === "corriendo") restaurar(foto);
  foto = null;
  _fase.value = "inactiva";
  // Al cerrarse la compuerta, el cliente real pide un snapshot nuevo y la página vuelve a lo real.
  compuerta.cerrar();
}

/**
 * Descarga el guion y reproduce la simulación. Solo arranca si la página sigue en "sin transmisión":
 * si mientras tanto llegó algo del cohete, no se simula nada.
 */
export async function iniciarSimulacion(
  cargar: () => Promise<Guion>,
  entorno: Partial<EntornoReproductor> = {},
): Promise<void> {
  if (_fase.peek() === "cargando" || _fase.peek() === "corriendo") return;
  const mio = ++pedido;
  _fase.value = "cargando";
  let guion: Guion;
  try {
    guion = await cargar();
  } catch {
    if (mio === pedido) _fase.value = "error";
    return;
  }
  if (mio !== pedido) return; // el pedido se canceló mientras se descargaba
  if (estadoPagina.peek().principal !== "sin_transmision") {
    _fase.value = "inactiva"; // llegó un dato real (o se cayó el servidor): lo real manda
    return;
  }
  foto = {
    meta: meta.peek(),
    estacion: estacion.peek(),
    backfill: backfill.peek(),
    conexion: conexion.peek(),
  };
  compuerta.abrir(terminar);
  reproductor = new Reproductor(guion, entorno);
  _fase.value = "corriendo";
  try {
    reproductor.iniciar();
  } catch {
    terminar();
    _fase.value = "error";
  }
}

/** El botón "Salir de la simulación": vuelve al estado en vivo. */
export function salirDeSimulacion(): void {
  terminar();
}
