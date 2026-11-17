// QR en el navegador con `uqr` (04 §2): sin servicio externo. Funciones puras; las dibuja `Qr.tsx`.
import { encode } from "uqr";

/** Módulos de margen blanco alrededor (la "zona silenciosa" de la norma del QR: 4). */
export const MARGEN_QR_MODULOS = 4;

export interface DatosQr {
  /** Módulos por lado, sin el margen. */
  lado: number;
  /** El trazo de los módulos oscuros, en unidades de módulo, ya desplazado por el margen. */
  trazo: string;
}

/**
 * Codifica `texto` y devuelve el trazo SVG de los módulos oscuros: una raya por cada racha horizontal,
 * así el SVG pesa poco. Nivel de corrección M (15 %): sobra para una URL corta y deja el QR chico.
 */
export function datosQr(texto: string): DatosQr {
  const { size, data } = encode(texto, { ecc: "M", border: 0 });
  const trazos: string[] = [];
  data.forEach((fila, y) => {
    let x = 0;
    while (x < size) {
      if (!fila[x]) {
        x++;
        continue;
      }
      const inicio = x;
      while (x < size && fila[x]) x++;
      trazos.push(
        `M${inicio + MARGEN_QR_MODULOS} ${y + MARGEN_QR_MODULOS}h${x - inicio}v1h-${x - inicio}z`,
      );
    }
  });
  return { lado: size, trazo: trazos.join("") };
}
