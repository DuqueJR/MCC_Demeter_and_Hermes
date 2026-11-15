// El botón "Ver la simulación del vuelo" del estado "Sin transmisión todavía" (03 §4, T-635), y el
// "Salir de la simulación" que va en el banner fijo. La lógica está en `control.ts`.
import { Loader, Play, X } from "lucide-preact";
import { meta } from "../datos/api";
import { faseSimulacion, iniciarSimulacion, salirDeSimulacion } from "./control";
import type { Simulacion } from "./guion";
import "./simulacion.css";

/**
 * Invitación a ver la simulación. Solo se pinta si la misión tiene una (`simulacion`) y mientras no
 * esté corriendo: durante la simulación el estado de la página ya no es "sin transmisión".
 */
export function BotonSimulacion({ simulacion }: { simulacion: Simulacion }) {
  const fase = faseSimulacion.value;
  if (fase === "corriendo") return null;
  const cargando = fase === "cargando";
  // El vuelo real reconstruido (T-681) usa el mismo reproductor, con sus propios textos.
  const real = simulacion.reconstruccion === true;
  const texto = real
    ? { boton: "Ver el vuelo real", cargando: "Cargando el vuelo…", error: "No pudimos cargar el vuelo." }
    : {
        boton: "Ver la simulación del vuelo",
        cargando: "Cargando la simulación…",
        error: "No pudimos cargar la simulación.",
      };
  return (
    <div class="sim-invitacion" data-sim={fase}>
      <p class="sim-nota">{simulacion.nota}</p>
      <button
        type="button"
        class="boton boton-principal sim-boton"
        disabled={cargando}
        aria-busy={cargando}
        onClick={() => void iniciarSimulacion(simulacion.cargar)}
      >
        {cargando ? <Loader aria-hidden="true" /> : <Play aria-hidden="true" />}
        <span>{cargando ? texto.cargando : texto.boton}</span>
      </button>
      {fase === "error" && (
        <p class="sim-error" role="alert">
          {texto.error} Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}

/** El botón del banner de simulación (o de la repetición del vuelo real): vuelve a la página en vivo. */
export function BotonSalirSimulacion() {
  const real = meta.value?.modo === "reconstruccion";
  return (
    <button type="button" class="sim-salir" onClick={salirDeSimulacion}>
      <X aria-hidden="true" />
      <span>{real ? "Salir de la repetición" : "Salir de la simulación"}</span>
    </button>
  );
}
