// Inicio (03 §3.1): carrusel de fotos, datos fijos y chips de las partes del cohete.
import { useSignal } from "@preact/signals";
import type { Contenido, Foto } from "../contenido/tipos";

function Diapositiva({ foto, parche }: { foto: Foto; parche: string }) {
  return (
    <figure class="diapositiva">
      {foto.src === null ? (
        // Placeholder digno (PEN-W01): el parche atenuado y la leyenda de que la foto está pendiente.
        <div class="foto-pendiente" role="img" aria-label={foto.alt}>
          <img src={parche} alt="" width="256" height="256" loading="lazy" />
          <span>Foto pendiente</span>
        </div>
      ) : (
        <img class="foto" src={foto.src} alt={foto.alt} loading="lazy" />
      )}
      <figcaption>{foto.pie}</figcaption>
    </figure>
  );
}

export function Inicio({ contenido }: { contenido: Contenido }) {
  const abierta = useSignal<string | null>(null);
  const parte = contenido.partes.find((p) => p.id === abierta.value);

  return (
    <section id="inicio" class="seccion inicio" aria-labelledby="inicio-titulo">
      <div class="inicio-cuerpo">
        <section class="carrusel" aria-label={`Fotos de ${contenido.nombre}`}>
          {contenido.fotos.map((f) => (
            <Diapositiva key={f.pie} foto={f} parche={contenido.parcheGrande} />
          ))}
        </section>
        <div class="inicio-texto">
          <h1 id="inicio-titulo">{contenido.nombre}</h1>
          <p class="lema">{contenido.lema}</p>
          <p class="frase">{contenido.frase}</p>
          <dl class="datos-fijos">
            <div>
              <dt>Motor</dt>
              <dd>{contenido.motor}</dd>
            </div>
          </dl>
        </div>
      </div>
      <h2 class="subtitulo">Partes del cohete</h2>
      <ul class="chips">
        {contenido.partes.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              class="chip"
              aria-expanded={abierta.value === p.id}
              aria-controls="tarjeta-parte"
              onClick={() => {
                abierta.value = abierta.value === p.id ? null : p.id;
              }}
            >
              {p.icono && (
                // Decorativo (el nombre ya está en el texto). Si el archivo no carga, se oculta y el chip queda con su texto.
                <img
                  class="chip-icono"
                  src={p.icono}
                  alt=""
                  width="40"
                  height="40"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.hidden = true;
                  }}
                />
              )}
              {p.nombre}
            </button>
          </li>
        ))}
      </ul>
      <div id="tarjeta-parte" class="tarjeta-parte" hidden={parte === undefined}>
        {parte && (
          <>
            <h3>{parte.nombre}</h3>
            <p>{parte.texto}</p>
          </>
        )}
      </div>
      {contenido.provisional && <p class="nota-provisional">Textos provisionales.</p>}
    </section>
  );
}
