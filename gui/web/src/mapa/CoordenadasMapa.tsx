// La etiqueta compacta de coordenadas del mapa (T-671, D-065): mientras el cohete vuela (hasta LANDED)
// da su latitud, longitud y altura sobre el nivel del mar, legibles en el celular. El QR y el bloque
// grande de coordenadas son solo de LANDED (`mision/Recuperacion.tsx`); en LANDED esta etiqueta se quita.
//
// Va en el JS inicial (`SeccionMapa.tsx` la pone sobre el marco) y no en el módulo diferido del mapa:
// así se ve aunque MapLibre aún no haya cargado o falle. Sin `aria-live`: cambia varias veces por
// segundo y un lector de pantalla no debe leerla en cada cambio. Quien la quiera, la lee al llegar.
import { MapPin } from "lucide-preact";
import { estado } from "../datos/api";
import { hace } from "../mision/formato";
import { edadS, MS_POR_S, principal } from "../mision/senales_recuperacion";
import { vistaCoordenadasMapa } from "../mision/vista_recuperacion";

export function CoordenadasMapa() {
  const v = vistaCoordenadasMapa(
    estado.value,
    principal.value,
    edadS.value === null ? null : edadS.value * MS_POR_S,
  );
  // En LANDED no se dibuja: ni oculta con CSS, para que no quede en el árbol de accesibilidad.
  if (v.oculta) return null;
  const { punto } = v;
  if (punto === null) {
    return (
      <div class="mapa-coordenadas" data-coords-mapa="sin_posicion">
        <p class="mapa-coordenadas-vacio">Sin posición válida</p>
      </div>
    );
  }
  return (
    <div class="mapa-coordenadas" data-coords-mapa={punto.origen}>
      <p class="mapa-coordenadas-rotulo">
        <MapPin aria-hidden="true" />
        <span>{punto.origen === "lkp" ? "Última posición" : "Cohete"}</span>
        {punto.origen === "lkp" && punto.edadMs !== null && (
          <span data-coords-edad>{hace(punto.edadMs)}</span>
        )}
      </p>
      <dl class="mapa-coordenadas-datos">
        <div>
          <dt>Lat</dt>
          <dd data-coord-mapa="lat">{v.lat}°</dd>
        </div>
        <div>
          <dt>Lon</dt>
          <dd data-coord-mapa="lon">{v.lon}°</dd>
        </div>
        <div>
          <dt>Alt</dt>
          <dd data-coord-mapa="alt">{v.altMsl === null ? "sin dato" : `${v.altMsl} msnm`}</dd>
        </div>
      </dl>
    </div>
  );
}
