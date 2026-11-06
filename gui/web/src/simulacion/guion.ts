// El guion de la simulación para el público (T-635): los mensajes del contrato `web-1` de un vuelo
// simulado, con el instante `t_rel_ms` en que los emitiría el relay. Lo genera
// `scripts/generar-simulacion.mjs` desde el JSONL `nominal` de OpenRocket y se descarga SOLO al
// pulsar "Ver la simulación del vuelo" (no está en el paquete inicial de la página).
import { type LineaJsonl, TIPOS_MENSAJE } from "../contrato/tipos";

/** Debe decir lo mismo que `FORMATO_SIMULACION` de `scripts/generar-simulacion.mjs`. */
export const FORMATO_SIMULACION = "simulacion-1";

export interface Guion {
  formato: typeof FORMATO_SIMULACION;
  mision: string;
  escenario: string;
  /** El `t_rel_ms` del último mensaje. */
  duracion_ms: number;
  lineas: LineaJsonl[];
}

/** Lo que una misión entrega a la página para ofrecer su simulación; sin él, no hay botón (Hermes). */
export interface Simulacion {
  /** Descarga y valida el guion. Se llama solo al pulsar el botón. */
  cargar: () => Promise<Guion>;
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/**
 * Comprobación del guion que llega por la red. Lo importante es que NUNCA pueda pasar por real:
 * cada `meta` debe traer `modo = "simulacion"`, y los tiempos deben ir en orden.
 */
export function esGuion(x: unknown): x is Guion {
  if (!esObjeto(x) || x.formato !== FORMATO_SIMULACION) return false;
  if (typeof x.duracion_ms !== "number" || !Array.isArray(x.lineas) || x.lineas.length === 0) {
    return false;
  }
  let anterior = 0;
  let hayMeta = false;
  for (const l of x.lineas as unknown[]) {
    if (!esObjeto(l) || typeof l.t_rel_ms !== "number" || !Number.isFinite(l.t_rel_ms))
      return false;
    if (l.t_rel_ms < anterior) return false;
    anterior = l.t_rel_ms;
    if (!(TIPOS_MENSAJE as readonly string[]).includes(l.evento as string)) return false;
    if (!esObjeto(l.datos)) return false;
    if (l.evento === "meta") {
      if (l.datos.modo !== "simulacion") return false;
      hayMeta = true;
    }
  }
  return hayMeta;
}

/** Descarga un guion de `url` y lo valida. Lanza si la red falla o el contenido no es un guion. */
export async function descargarGuion(
  url: string,
  buscar: typeof fetch = (...args) => globalThis.fetch(...args),
): Promise<Guion> {
  const resp = await buscar(url);
  if (!resp.ok) throw new Error(`simulación: HTTP ${resp.status}`);
  const cuerpo: unknown = await resp.json();
  if (!esGuion(cuerpo)) throw new Error("simulación: el archivo no es un guion válido");
  return cuerpo;
}
