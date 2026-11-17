// El QR de la URL de Google Maps (03 §3.5), dibujado como SVG con los colores del tema:
// módulos en `--fondo` sobre `--texto` (oscuro sobre claro, que es lo que los lectores esperan).
import { useMemo } from "preact/hooks";
import { datosQr, MARGEN_QR_MODULOS } from "./datos_qr";

export function Qr({ texto, descripcion }: { texto: string; descripcion: string }) {
  const { lado, trazo } = useMemo(() => datosQr(texto), [texto]);
  const total = lado + 2 * MARGEN_QR_MODULOS;
  return (
    <svg
      class="qr"
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={descripcion}
      shape-rendering="crispEdges"
      data-qr-url={texto}
    >
      <rect class="qr-fondo" width={total} height={total} />
      <path class="qr-modulos" d={trazo} />
    </svg>
  );
}
