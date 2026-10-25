// Equipo (03 §3.10): el parche grande y la cuadrícula de integrantes. Nombres y roles: PEN-W02.
import type { Contenido } from "../contenido/tipos";

export function Equipo({ contenido }: { contenido: Contenido }) {
  return (
    <section id="equipo" class="seccion equipo" aria-labelledby="equipo-titulo">
      <h2 id="equipo-titulo">Equipo</h2>
      <img
        class="parche-grande"
        src={contenido.parcheGrande}
        alt={`Parche de la misión ${contenido.nombre}`}
        width="512"
        height="512"
        loading="lazy"
      />
      <ul class="integrantes">
        {contenido.integrantes.map((i) => (
          <li key={i.apellido} class="integrante">
            <span class="inicial" aria-hidden="true">
              {i.apellido.charAt(0)}
            </span>
            <span class="apellido">{i.apellido}</span>
            <span class="rol">{i.rol ?? "Nombre y rol por confirmar"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
