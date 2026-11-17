// El contenido del mapa (T-632): el lienzo de MapLibre y sus controles. Es el módulo que se carga
// de forma diferida (`SeccionMapa.tsx` lo pide con `import()` al acercarse la sección).
import "maplibre-gl/dist/maplibre-gl.css";
import "./mapa.css";
import { Box, Expand, LocateFixed, Scan, Shrink, Square } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { estado } from "../datos/api";
import { numero } from "../mision/formato";
import { type ControlMapa, crearMapa } from "./controlador";

const DECIMALES_COORDENADA = 5;

export interface PropsMapa {
  /** La miniatura del cohete de la misión, para la vista 3D (viene de su contenido). */
  coheteMapa?: string;
  /** Pantalla completa (la maneja la sección, que es quien cambia de tamaño). */
  completa: boolean;
  alAlternarCompleta: () => void;
}

/** Plan B si el navegador no puede dibujar WebGL: al menos, la posición en texto (GS-03). */
function PosicionEnTexto() {
  const e = estado.value;
  const p = e?.lkp ?? e?.pos ?? null;
  return (
    <p class="mapa-sin-webgl" role="status">
      Este navegador no puede dibujar el mapa.{" "}
      {p
        ? `Última posición: ${numero(p.lat, DECIMALES_COORDENADA)}, ${numero(p.lon, DECIMALES_COORDENADA)}.`
        : "Aún no hay posición del cohete."}
    </p>
  );
}

export default function Mapa({ completa, alAlternarCompleta, coheteMapa }: PropsMapa) {
  const lienzo = useRef<HTMLElement>(null);
  const [control, setControl] = useState<ControlMapa | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const contenedor = lienzo.current;
    if (!contenedor) return;
    let vivo = true;
    let creado: ControlMapa | null = null;
    crearMapa(contenedor, { coheteMapa })
      .then((c) => {
        if (!vivo) return c.destruir();
        creado = c;
        setControl(c);
      })
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
      creado?.destruir();
    };
  }, []);

  // En pantalla completa el usuario ya eligió el mapa: sus gestos no compiten con el desplazamiento.
  useEffect(() => {
    if (!control) return;
    control.cooperativo(!completa);
    control.redimensionar();
  }, [control, completa]);

  const sinCohete = control !== null && !control.hayCohete.value;

  return (
    <>
      <section
        ref={lienzo}
        class="mapa-lienzo"
        aria-label="Mapa con la trayectoria del cohete"
        data-tema-fondo={control?.tokens.fondo}
      />
      {fallo && <PosicionEnTexto />}
      {control && (
        <div class="mapa-controles">
          <button
            type="button"
            class="mapa-boton"
            aria-label="Centrar en el cohete"
            title="Centrar en el cohete"
            disabled={!control.hayCohete.value}
            onClick={() => control.centrarEnCohete()}
          >
            <LocateFixed aria-hidden="true" />
          </button>
          <button
            type="button"
            class="mapa-boton"
            aria-label="Ver todo"
            title="Ver todo"
            onClick={() => control.verTodo()}
          >
            <Scan aria-hidden="true" />
          </button>
          {control.con3d && (
            <button
              type="button"
              class="mapa-boton"
              data-mapa-boton="3d"
              aria-label={control.modo3d.value ? "Vista 2D" : "Vista 3D"}
              title={control.modo3d.value ? "Vista 2D" : "Vista 3D"}
              aria-pressed={control.modo3d.value}
              onClick={() => control.alternar3d()}
            >
              {control.modo3d.value ? <Square aria-hidden="true" /> : <Box aria-hidden="true" />}
            </button>
          )}
          <button
            type="button"
            class="mapa-boton"
            aria-label={completa ? "Salir de pantalla completa" : "Pantalla completa"}
            title={completa ? "Salir de pantalla completa" : "Pantalla completa"}
            aria-pressed={completa}
            onClick={alAlternarCompleta}
          >
            {completa ? <Shrink aria-hidden="true" /> : <Expand aria-hidden="true" />}
          </button>
        </div>
      )}
      {sinCohete && (
        <p class="mapa-aviso" role="status">
          Aún no hay posición del cohete.
        </p>
      )}
    </>
  );
}
