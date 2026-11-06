// Equipo (03 §3.10, T-646): en escritorio, el parche a un lado y la foto del equipo al otro; debajo,
// centradas, las tarjetas de apellidos. En móvil y tableta se apilan. Nombres y roles: PEN-W02.
import type { Contenido } from "../contenido/tipos";

export function Equipo({ contenido }: { contenido: Contenido }) {
  const foto = contenido.fotoEquipo;
  return (
    <section id="equipo" class="seccion equipo" aria-labelledby="equipo-titulo">
      <h2 id="equipo-titulo">Equipo</h2>
      <div class="equipo-banda">
        <img
          class="parche-grande"
          src={contenido.parcheGrande}
          alt={`Parche de la misión ${contenido.nombre}`}
          width="512"
          height="512"
          loading="lazy"
        />
        <figure class="equipo-foto">
          {foto.src === null ? (
            // Placeholder digno (PEN-W01), como en el carrusel de Inicio.
            <div class="foto-pendiente" role="img" aria-label={foto.alt}>
              <span>Foto pendiente</span>
            </div>
          ) : (
            <img
              class="foto-equipo"
              src={foto.src}
              alt={foto.alt}
              width="1200"
              height="800"
              loading="lazy"
            />
          )}
          <figcaption>{foto.pie}</figcaption>
        </figure>
      </div>
      <ul class="integrantes">
        {contenido.integrantes.map((i) => (
          <li key={i.apellido} class="integrante">
            <span class="inicial" aria-hidden="true">
              {i.apellido.charAt(0)}
            </span>
            <span class="apellido">{i.apellido}</span>
            {i.rol && <span class="rol">{i.rol}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
