// Navegación por anclas (03 §2.1): inferior fija en el celular; en el portátil es la fila bajo la barra.
// T-674: la telemetría ya no es una sección sino un panel dentro del mapa, así que "Datos" se quitó (su
// ancla `#telemetria` sigue existiendo) y "Resumen" aparece solo cuando el cohete aterrizó.
import { aterrizado } from "./aterrizado";

export const ENLACES_NAVEGACION = [
  { href: "#estado", texto: "Estado" },
  { href: "#mapa", texto: "Mapa" },
  { href: "#equipo", texto: "Equipo" },
] as const;

/** El enlace del Resumen del vuelo, que va antes de Equipo y solo en LANDED. */
export const ENLACE_RESUMEN = { href: "#resumen", texto: "Resumen" } as const;

export function Navegacion() {
  const enlaces = aterrizado.value
    ? [...ENLACES_NAVEGACION.slice(0, 2), ENLACE_RESUMEN, ...ENLACES_NAVEGACION.slice(2)]
    : ENLACES_NAVEGACION;
  return (
    <nav class="navegacion" aria-label="Secciones de la página">
      {enlaces.map((e) => (
        <a key={e.href} href={e.href}>
          {e.texto}
        </a>
      ))}
    </nav>
  );
}
