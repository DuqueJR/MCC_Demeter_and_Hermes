// El botón "Ver la simulación del vuelo" del estado "Sin transmisión todavía" (03 §4, T-635), y el
// "Salir de la simulación" que va en el banner fijo. La lógica está en `control.ts`.
import { Loader, Play, X } from "lucide-preact";
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
        <span>{cargando ? "Cargando la simulación…" : "Ver la simulación del vuelo"}</span>
      </button>
      {fase === "error" && (
        <p class="sim-error" role="alert">
          No pudimos cargar la simulación. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}

/** El botón del banner de simulación: vuelve a la página en vivo. */
export function BotonSalirSimulacion() {
  return (
    <button type="button" class="sim-salir" onClick={salirDeSimulacion}>
      <X aria-hidden="true" />
      <span>Salir de la simulación</span>
    </button>
  );
}
