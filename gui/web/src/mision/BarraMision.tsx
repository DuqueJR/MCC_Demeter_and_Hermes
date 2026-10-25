// Barra de misión (03 §3.0 y §4). Consume SOLO las signals de lectura de `datos/api.ts`.
import {
  CircleCheck,
  CloudOff,
  Info,
  Loader,
  MapPin,
  OctagonX,
  TriangleAlert,
} from "lucide-preact";
import type { ComponentChildren } from "preact";
import type { Contenido } from "../contenido/tipos";
import type { Estado, Evento } from "../contrato/tipos";
import type { EstadoPrincipal } from "../datos/api";
import { edad, estado, estadoPagina, eventos } from "../datos/api";
import { TITULO_FASE } from "./fases";
import { hace, numero, tMas } from "./formato";

const MS_POR_S = 1000;

interface Indicador {
  clase: string;
  texto: string;
  icono: ComponentChildren;
}

/** El indicador de conexión, con color de estado, ícono y palabra (02 §4: el color nunca va solo). */
export function indicadorDe(principal: EstadoPrincipal): Indicador {
  switch (principal) {
    case "en_vivo":
      return { clase: "ok", texto: "EN VIVO", icono: <CircleCheck aria-hidden="true" /> };
    case "senal_debil":
      return { clase: "aviso", texto: "Señal débil", icono: <TriangleAlert aria-hidden="true" /> };
    case "sin_senal":
      return { clase: "alarma", texto: "Sin señal", icono: <OctagonX aria-hidden="true" /> };
    case "sin_servidor":
      return { clase: "sin-dato", texto: "Sin servidor", icono: <CloudOff aria-hidden="true" /> };
    case "sin_transmision":
      return {
        clase: "sin-dato",
        texto: "Sin transmisión",
        icono: <CloudOff aria-hidden="true" />,
      };
    default:
      return { clase: "sin-dato", texto: "Cargando", icono: <Loader aria-hidden="true" /> };
  }
}

/**
 * T+ en segundos con el reloj del COHETE, no el del celular: `estado.t_ms` menos el `t_ms` del
 * despegue, más su `t_mas_s`. Si no hay evento `despegue`, usa el primer evento con T+ (cada uno
 * da el mismo instante de despegue: `t_ms - t_mas_s * 1000`). Sin ninguno, `null`: no se inventa.
 */
export function tMasSegundos(est: Estado | null, evs: Evento[]): number | null {
  if (est === null) return null;
  const ref =
    evs.find((e) => e.tipo === "despegue" && e.t_mas_s !== null) ??
    evs.find((e) => e.t_mas_s !== null);
  if (!ref || ref.t_mas_s === null) return null;
  const t = ref.t_mas_s + (est.t_ms - ref.t_ms) / MS_POR_S;
  return t < 0 ? null : t;
}

function textoFase(principal: EstadoPrincipal, est: Estado | null): string {
  if (principal === "sin_transmision") return "La transmisión empieza el día del lanzamiento";
  if (est === null) return "Esperando datos";
  return TITULO_FASE[est.fase];
}

export function BarraMision({ contenido }: { contenido: Contenido }) {
  const pagina = estadoPagina.value;
  const est = estado.value;
  const principal = pagina.principal;
  const ind = indicadorDe(principal);
  const edadMs = edad.value;

  // Sin posición válida (o sin señal) la altitud es la última conocida: roja, con 📍 y su antigüedad (GS-03).
  const altura = est?.pos?.alt_agl_m ?? est?.lkp?.alt_agl_m ?? null;
  const esLkp = principal === "sin_senal" || (est !== null && est.pos === null);
  const atenuado = principal === "senal_debil" || principal === "sin_servidor";

  return (
    <div class="barra" data-principal={principal}>
      <a class="barra-enlace" href="#estado" aria-label="Ir al estado de la misión">
        <img class="barra-parche" src={contenido.parcheChico} alt="" width="40" height="40" />
        <span class="barra-nombre">{contenido.nombre}</span>
        <span class="barra-estado">
          <span class={`indicador ind-${ind.clase}`}>
            {ind.icono}
            <span>{ind.texto}</span>
          </span>
          {pagina.simulacion && <span class="marca-sim">SIM</span>}
        </span>
        <span class={`barra-t${atenuado ? " atenuado" : ""}`}>
          {tMas(tMasSegundos(est, eventos.value))}
        </span>
        <span class="barra-fase" aria-live="polite">
          {textoFase(principal, est)}
        </span>
        <span class={`barra-alt${esLkp ? " lkp" : ""}${atenuado ? " atenuado" : ""}`}>
          {esLkp && altura !== null && <MapPin aria-hidden="true" />}
          {altura === null ? (
            <span class="sin-dato-texto">sin dato</span>
          ) : (
            <>
              <span class="num">{numero(altura)}</span>
              <span class="unidad">m</span>
            </>
          )}
          {esLkp && edadMs !== null && <span class="antiguedad">{hace(edadMs)}</span>}
        </span>
      </a>
      {pagina.simulacion && (
        <div class="banner banner-info" role="status">
          <Info aria-hidden="true" />
          <span>Simulación: así será el vuelo</span>
        </div>
      )}
    </div>
  );
}
