// Lectura de los JSONL de dev/datos/ (05 §5): una línea por mensaje del stream,
// `{"t_rel_ms": 0, "evento": "estado", "datos": {...}}`. `t_rel_ms` es el instante en que lo
// emite el relay (T-612). No valida contra el esquema (eso lo hacen las pruebas): solo que la
// línea se pueda reproducir.
import { readFileSync } from "node:fs";
import { type LineaJsonl, TIPOS_MENSAJE } from "../../src/contrato/tipos.ts";

/** Una línea ya leída, con el `data:` del SSE serializado una sola vez. */
export interface Mensaje {
  t_rel_ms: number;
  linea: LineaJsonl;
  /** `JSON.stringify(datos)`, en una línea (así va en `data:`). */
  data: string;
}

export function leerJsonl(ruta: string): Mensaje[] {
  const texto = readFileSync(ruta, "utf8");
  const mensajes: Mensaje[] = [];
  let anterior = 0;
  for (const [i, bruta] of texto.split("\n").entries()) {
    if (bruta.trim() === "") continue;
    const donde = `${ruta}:${i + 1}`;
    let linea: LineaJsonl;
    try {
      linea = JSON.parse(bruta) as LineaJsonl;
    } catch {
      throw new Error(`${donde}: no es JSON`);
    }
    if (typeof linea.t_rel_ms !== "number" || !Number.isFinite(linea.t_rel_ms)) {
      throw new Error(`${donde}: falta t_rel_ms numérico`);
    }
    if (!(TIPOS_MENSAJE as readonly string[]).includes(linea.evento)) {
      throw new Error(`${donde}: evento desconocido "${String(linea.evento)}"`);
    }
    if (typeof linea.datos !== "object" || linea.datos === null) {
      throw new Error(`${donde}: falta datos`);
    }
    if (linea.t_rel_ms < anterior) {
      throw new Error(`${donde}: t_rel_ms retrocede (${linea.t_rel_ms} < ${anterior})`);
    }
    anterior = linea.t_rel_ms;
    mensajes.push({ t_rel_ms: linea.t_rel_ms, linea, data: JSON.stringify(linea.datos) });
  }
  if (!mensajes.some((m) => m.linea.evento === "meta")) {
    throw new Error(`${ruta}: no trae ningún mensaje meta (el snapshot lo necesita)`);
  }
  return mensajes;
}
