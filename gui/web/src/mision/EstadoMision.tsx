// Sección "Estado de la misión" (03 §3.2, T-624): T+ transcurrido, la línea de fases pública y los
// objetivos que se encienden solos. Consume SOLO las signals de lectura de `datos/api.ts`.
//
// Fuera de T-624 (propuestas en la bitácora): el tiempo estimado a la siguiente fase y el tiempo de
// vuelo restante (GS-13, prioridad S), y el objetivo "motor caracterizado" (no hay fuente de datos).
import { computed } from "@preact/signals";
import {
  Circle,
  CircleCheck,
  CircleDot,
  Flame,
  Mountain,
  PackageOpen,
  PlaneLanding,
  Rocket,
  Video,
} from "lucide-preact";
import type { ComponentChildren } from "preact";
import type { Mision } from "../contrato/tipos";
import { estado, estadoPagina, eventos } from "../datos/api";
import { tMasSegundos } from "./BarraMision";
import { SUBTITULO_FASE, TITULO_FASE } from "./fases";
import { numero, tMas } from "./formato";
import "./estado.css";
import { construirPasos, type Paso } from "./linea_fases";
import { calcularObjetivos, type Objetivo, type ObjetivoId } from "./objetivos";

/** Solo cambia cuando cambia el estado principal: no repinta la sección con cada tic del reloj. */
const principal = computed(() => estadoPagina.value.principal);

const ICONO_OBJETIVO: Record<ObjetivoId, ComponentChildren> = {
  despegue: <Rocket aria-hidden="true" />,
  fin_combustion: <Flame aria-hidden="true" />,
  eyeccion: <PackageOpen aria-hidden="true" />,
  apogeo: <Mountain aria-hidden="true" />,
  aterrizaje: <PlaneLanding aria-hidden="true" />,
  camaras: <Video aria-hidden="true" />,
};

/** El texto de la hora de un paso: su T+, "ahora", "listo" o "pendiente" (nunca solo un color). */
export function textoPaso(p: Paso): string {
  if (p.situacion === "pendiente") return "pendiente";
  if (p.tMasS !== null) return tMas(p.tMasS);
  return p.situacion === "actual" ? "ahora" : "listo";
}

function MarcaPaso({ situacion }: { situacion: Paso["situacion"] }) {
  if (situacion === "hecho") return <CircleCheck aria-hidden="true" />;
  if (situacion === "actual") return <CircleDot aria-hidden="true" />;
  return <Circle aria-hidden="true" />;
}

function LineaFases({ pasos }: { pasos: Paso[] }) {
  return (
    <ol class="fases" aria-label="Fases del vuelo">
      {pasos.map((p) => (
        <li
          key={p.id}
          class={`paso paso-${p.situacion}`}
          data-paso={p.id}
          data-situacion={p.situacion}
          aria-current={p.situacion === "actual" ? "step" : undefined}
        >
          <MarcaPaso situacion={p.situacion} />
          <span class="paso-titulo">{p.titulo}</span>
          <span class="paso-t">{textoPaso(p)}</span>
          {p.situacion === "actual" && p.tMasS !== null && <span class="paso-ahora">ahora</span>}
        </li>
      ))}
    </ol>
  );
}

function ListaObjetivos({ objetivos }: { objetivos: Objetivo[] }) {
  return (
    <ul class="objetivos" aria-label="Objetivos de la misión">
      {objetivos.map((o) => (
        <li
          key={o.id}
          class={`objetivo ${o.encendido ? "objetivo-encendido" : "objetivo-apagado"}`}
          data-objetivo={o.id}
          data-encendido={o.encendido ? "si" : "no"}
        >
          <span class="objetivo-icono">{ICONO_OBJETIVO[o.id]}</span>
          <span class="objetivo-titulo">{o.titulo}</span>
          <span class="objetivo-estado">
            {o.encendido ? (
              <>
                <CircleCheck class="objetivo-logrado" aria-hidden="true" />
                <span>Logrado</span>
                {o.tMasS !== null && <span class="objetivo-t">{tMas(o.tMasS)}</span>}
                {o.altitudM !== null && (
                  <span class="objetivo-dato">
                    {numero(o.altitudM)} <span class="unidad">m</span>
                  </span>
                )}
              </>
            ) : (
              <>
                <Circle aria-hidden="true" />
                <span>Pendiente</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EstadoMision({ mision }: { mision: Mision }) {
  const est = estado.value;
  const evs = eventos.value;
  const sinTransmision = principal.value === "sin_transmision";

  return (
    <section id="estado" class="seccion" aria-labelledby="estado-titulo">
      <h2 id="estado-titulo">Estado de la misión</h2>

      {sinTransmision && (
        <p class="estado-aviso" data-aviso="sin-transmision">
          La transmisión en vivo empieza el día del lanzamiento
        </p>
      )}

      <div class="estado-ahora">
        <div class="estado-t">
          <span class="etiqueta">T+ transcurrido</span>
          <span class="estado-t-valor">{tMas(tMasSegundos(est, evs))}</span>
        </div>
        {est !== null && (
          <div class="estado-fase">
            <span class="estado-fase-titulo">{TITULO_FASE[est.fase]}</span>
            <span class="estado-fase-sub">{SUBTITULO_FASE[est.fase]}</span>
          </div>
        )}
      </div>

      <LineaFases pasos={construirPasos(est, evs)} />
      <h3 class="subtitulo">Objetivos de la misión</h3>
      <ListaObjetivos objetivos={calcularObjetivos(est, evs, mision)} />
    </section>
  );
}
