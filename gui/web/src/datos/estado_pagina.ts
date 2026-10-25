// Funciones puras de la edad del dato y del estado de la página (03 §4, 05 §4.4). T-611.
// No tocan signals ni el reloj: reciben todo por argumento, para probarlas con tiempos exactos.
import type { Backfill, Estacion, Estado, Fase, Meta } from "../contrato/tipos";
import { WEB_DATO_VIEJO_S, WEB_SIN_SENAL_S, WEB_SIN_TRANSMISION_MIN } from "./constantes";

const MS_POR_S = 1000;
const MS_POR_MIN = 60 * MS_POR_S;
/** Fases en tierra previas al ARM (maquina_estados §1). */
const FASES_DE_BANCO: ReadonlySet<Fase> = new Set<Fase>(["BOOT", "PREFLIGHT", "ERROR"]);

/** La conexión de ESTE navegador con el servidor (no la del cohete con la estación). */
export type ConexionServidor = "cargando" | "conectado" | "reconectando";

/** El estado principal de la página: mutuamente excluyente (03 §4). */
export type EstadoPrincipal =
  | "cargando"
  | "sin_transmision"
  | "en_vivo"
  | "senal_debil"
  | "sin_senal"
  | "sin_servidor";

/**
 * El estado de la página completo. `principal` es excluyente; el resto son avisos que se
 * superponen (03 §4 los lista como estados, pero pueden coincidir: p. ej. simulación + señal débil).
 */
export interface EstadoPagina {
  principal: EstadoPrincipal;
  /** `meta.modo` distinto de "vivo": el banner de simulación va fijo, nunca se confunde con lo real. */
  simulacion: boolean;
  /** `fase = LANDED`. */
  aterrizado: boolean;
  /** Hay un backfill en curso. */
  reconstruyendo: boolean;
  /** `alarmas.descenso_rapido` (la UI sostiene el banner 10 s más; eso es de presentación). */
  alarma_descenso: boolean;
}

/**
 * Edad del dato en ms (05 §0 y §4.4): `ultimo_paquete_hace_ms` del último latido más el tiempo
 * local transcurrido desde que llegó ese latido. Nunca usa el reloj de pared del celular.
 * `null` si la estación aún no ha recibido ningún paquete del cohete.
 */
export function calcularEdadMs(
  ultimoPaqueteHaceMs: number | null,
  llegadaLatidoLocalMs: number,
  ahoraLocalMs: number,
): number | null {
  if (ultimoPaqueteHaceMs === null) return null;
  return ultimoPaqueteHaceMs + Math.max(0, ahoraLocalMs - llegadaLatidoLocalMs);
}

export interface EntradaEstadoPagina {
  conexion: ConexionServidor;
  meta: Meta | null;
  estado: Estado | null;
  estacion: Estacion | null;
  backfill: Backfill | null;
  edadMs: number | null;
}

/** Decide el estado de la página con los umbrales `WEB_*` (03 §4). */
export function calcularEstadoPagina(e: EntradaEstadoPagina): EstadoPagina {
  return {
    principal: calcularPrincipal(e),
    simulacion: e.meta !== null && e.meta.modo !== "vivo",
    aterrizado: e.estado?.fase === "LANDED",
    reconstruyendo: e.backfill !== null && e.backfill.activo && !e.backfill.completo,
    alarma_descenso: e.estado?.alarmas.descenso_rapido === true,
  };
}

function calcularPrincipal(e: EntradaEstadoPagina): EstadoPrincipal {
  // La caída del SSE no se confunde con un problema del cohete; los datos se mantienen.
  if (e.conexion === "reconectando") return "sin_servidor";
  // Antes del primer dato del servidor: esqueleto con lo que haya del snapshot.
  if (e.conexion === "cargando" || e.estacion === null) return "cargando";
  // Nunca llegó un dato del cohete en esta misión.
  if (e.estado === null || e.edadMs === null) return "sin_transmision";
  // Banco antes del vuelo: BOOT, PREFLIGHT o ERROR sin nada por mucho tiempo no es una alarma de LKP.
  // Desde ARMED en adelante nunca se pasa a "sin_transmision": el LKP no desaparece (GS-03).
  if (FASES_DE_BANCO.has(e.estado.fase) && e.edadMs >= WEB_SIN_TRANSMISION_MIN * MS_POR_MIN) {
    return "sin_transmision";
  }
  if (e.edadMs < WEB_DATO_VIEJO_S * MS_POR_S) return "en_vivo";
  if (e.edadMs < WEB_SIN_SENAL_S * MS_POR_S) return "senal_debil";
  return "sin_senal";
}
