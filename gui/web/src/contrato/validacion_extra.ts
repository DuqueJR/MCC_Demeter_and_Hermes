// Comprobaciones de `web-1` que JSON Schema no expresa (T-611). Funciones puras: devuelven la
// lista de errores (vacía si todo cuadra). Se usan DESPUÉS de validar con `esquema.json`.
//   - serie: las 8 columnas con el mismo largo y <= WEB_SERIE_MAX_PUNTOS (05 §3);
//   - mision <-> nodo: demeter = 1, hermes = 2 (05 §0);
//   - fase <-> fase_cod, según maquina_estados §1 (el código es el índice en FASES).
import { WEB_SERIE_MAX_PUNTOS } from "../datos/constantes";
import { FASES, type Mision, type Nodo, type TipoMensaje } from "./tipos";

const NODO_DE: Record<Mision, Nodo> = { demeter: 1, hermes: 2 };

type Obj = Record<string, unknown>;
const esObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

export function validarSerie(serie: unknown, ruta = "serie"): string[] {
  if (!esObj(serie)) return [`${ruta}: no es un objeto`];
  const errores: string[] = [];
  const largos = Object.entries(serie).map(
    ([k, v]) => [k, Array.isArray(v) ? v.length : -1] as const,
  );
  const primero = largos[0]?.[1];
  for (const [k, n] of largos) {
    if (n !== primero) errores.push(`${ruta}.${k}: largo ${n}, distinto de ${primero}`);
  }
  if (primero !== undefined && primero > WEB_SERIE_MAX_PUNTOS) {
    errores.push(
      `${ruta}: ${primero} puntos, más de WEB_SERIE_MAX_PUNTOS (${WEB_SERIE_MAX_PUNTOS})`,
    );
  }
  return errores;
}

export function validarMeta(meta: unknown, ruta = "meta"): string[] {
  if (!esObj(meta)) return [];
  const nodo = NODO_DE[meta.mision as Mision];
  return nodo !== undefined && meta.nodo !== nodo
    ? [`${ruta}: la misión ${String(meta.mision)} es el nodo ${nodo}, no ${String(meta.nodo)}`]
    : [];
}

export function validarEstado(estado: unknown, ruta = "estado"): string[] {
  if (!esObj(estado)) return [];
  const cod = FASES.indexOf(estado.fase as (typeof FASES)[number]);
  return cod >= 0 && estado.fase_cod !== cod
    ? [`${ruta}: fase ${String(estado.fase)} es el código ${cod}, no ${String(estado.fase_cod)}`]
    : [];
}

/** Comprobaciones extra de un mensaje del stream (por su tipo) o de un snapshot. */
export function validarExtra(tipo: TipoMensaje | "snapshot", datos: unknown): string[] {
  if (tipo === "meta") return validarMeta(datos);
  if (tipo === "estado") return validarEstado(datos);
  if (tipo === "snapshot" && esObj(datos)) {
    return [
      ...validarMeta(datos.meta),
      ...validarEstado(datos.estado),
      ...validarSerie(datos.serie),
    ];
  }
  return [];
}
