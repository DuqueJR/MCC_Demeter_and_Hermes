// El estado de la misión en la parte de arriba (T-674; antes era la sección grande "Estado de la
// misión", 03 §3.2, T-624): solo la fase de ahora con su T+, y una tira de objetivos que se van
// chequeando. La línea de fases completa y la lista con hora y dato están en el Resumen del vuelo
// (`Resumen.tsx`). Consume SOLO las signals de lectura de `datos/api.ts`.
//
// Conserva lo que ya vivía en la sección vieja: el aviso "La transmisión en vivo empieza el día del
// lanzamiento" y la invitación a la simulación (T-635, T-637), y el ancla `#estado` (la usan la
// navegación y la barra de misión).
import { computed } from "@preact/signals";
import { Circle, CircleCheck } from "lucide-preact";
import type { Mision } from "../contrato/tipos";
import { estado, estadoPagina, eventos } from "../datos/api";
import { BotonSimulacion } from "../simulacion/BotonSimulacion";
import { simulacionOfrecida } from "../simulacion/disponible";
import type { Simulacion } from "../simulacion/guion";
import { tMasSegundos } from "./BarraMision";
import { SUBTITULO_FASE, TITULO_FASE } from "./fases";
import { tMas } from "./formato";
import "./estado.css";
import { ICONO_OBJETIVO } from "./ObjetivosFases";
import { calcularObjetivos } from "./objetivos";

/** Solo cambia cuando cambia el estado principal: no repinta el bloque con cada tic del reloj. */
const principal = computed(() => estadoPagina.value.principal);

interface Props {
  mision: Mision;
  /** La simulación de la misión (T-635, T-637); sin ella no hay botón. */
  simulacion?: Simulacion;
}

export function EstadoInicio({ mision, simulacion }: Props) {
  const est = estado.value;
  const evs = eventos.value;
  const sinTransmision = principal.value === "sin_transmision";
  // T-636: con el interruptor temporal, la simulación también se ofrece en "Cargando" y "Sin servidor".
  const ofrecerSimulacion = simulacionOfrecida.value;
  const objetivos = calcularObjetivos(est, evs, mision);

  return (
    <section id="estado" class="inicio-estado" aria-labelledby="estado-titulo">
      <h2 id="estado-titulo" class="solo-lector">
        Estado de la misión
      </h2>

      {sinTransmision && (
        <p class="estado-aviso" data-aviso="sin-transmision">
          La transmisión en vivo empieza el día del lanzamiento
        </p>
      )}
      {ofrecerSimulacion && simulacion !== undefined && <BotonSimulacion simulacion={simulacion} />}

      <div class="estado-ahora">
        {est !== null && (
          <div class="estado-fase">
            <span class="etiqueta">Fase</span>
            <span class="estado-fase-titulo">{TITULO_FASE[est.fase]}</span>
            <span class="estado-fase-sub">{SUBTITULO_FASE[est.fase]}</span>
          </div>
        )}
        <div class="estado-t">
          <span class="etiqueta">T+ transcurrido</span>
          <span class="estado-t-valor">{tMas(tMasSegundos(est, evs))}</span>
        </div>
      </div>

      <ul class="objetivos-banner" aria-label="Objetivos de la misión">
        {objetivos.map((o) => (
          <li
            key={o.id}
            class={`objetivo-chip ${o.encendido ? "objetivo-chip-logrado" : "objetivo-chip-pendiente"}`}
            data-objetivo={o.id}
            data-encendido={o.encendido ? "si" : "no"}
          >
            <span class="objetivo-chip-icono">{ICONO_OBJETIVO[o.id]}</span>
            <span class="objetivo-chip-titulo">{o.titulo}</span>
            {o.encendido ? (
              <CircleCheck class="objetivo-chip-marca" aria-hidden="true" />
            ) : (
              <Circle class="objetivo-chip-marca" aria-hidden="true" />
            )}
            <span class="solo-lector">{o.encendido ? "logrado" : "pendiente"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
