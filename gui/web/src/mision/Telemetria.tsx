// Telemetría (03 §3.3, Objetivos 7.B, T-624): altitud, velocidad vertical, velocidad total, apogeo fijo
// y aceleración X/Y/Z. Consume SOLO las signals de lectura de `datos/api.ts`.
// T-674: ya no es una sección aparte. `DatosTelemetria` (la rejilla y el aviso de dato viejo) se usa en
// el panel superpuesto del mapa (`TelemetriaMapa`, compacto, con el ancla `#telemetria`) y en el Resumen
// del vuelo (la telemetría final); las reglas y los formatos son los mismos.
// Números tabulares (los pone el `body`), coma decimal y unidad pegada al número (02 §5).
// Un dato con edad >= WEB_DATO_VIEJO_S va en `--estado-sin-dato`, con su antigüedad (03 §3.3).
import { computed } from "@preact/signals";
import { ArrowDown, ArrowUp, MapPin, Minus, Mountain, TriangleAlert } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { edad, estado, estadoPagina, eventos, salud } from "../datos/api";
import { hace, numero, tMas } from "./formato";
import "./estado.css";
import {
  DECIMALES_ACELERACION,
  DECIMALES_ALTITUD,
  DECIMALES_VELOCIDAD,
  datoViejo,
  type Sentido,
  textoONulo,
  vistaTelemetria,
} from "./vista_telemetria";

/** Solo cambia cuando cambia el estado principal: no repinta la sección con cada tic del reloj. */
const principal = computed(() => estadoPagina.value.principal);
/** Si el dato es viejo, y su antigüedad en segundos enteros: se repinta una vez por segundo, no por tic. */
const viejo = computed(() => datoViejo(edad.value));
const edadS = computed(() => (edad.value === null ? null : Math.floor(edad.value / 1000)));

const SinDato = () => <span class="sin-dato-texto">sin dato</span>;

function Valor({ texto, unidad }: { texto: string; unidad: string }) {
  return (
    <>
      <span class="num">{texto}</span>
      <span class="unidad">{unidad}</span>
    </>
  );
}

const FLECHA: Record<Sentido, { icono: ComponentChildren; texto: string }> = {
  sube: { icono: <ArrowUp aria-hidden="true" />, texto: "subiendo" },
  baja: { icono: <ArrowDown aria-hidden="true" />, texto: "bajando" },
  quieto: { icono: <Minus aria-hidden="true" />, texto: "sin movimiento vertical" },
};

/** La rejilla de datos con su aviso de "dato viejo". Es la misma en el mapa y en el Resumen. */
export function DatosTelemetria() {
  const v = vistaTelemetria(estado.value, eventos.value, salud.value, principal.value);
  const esViejo = viejo.value;
  const alt = v.altitud;
  const flecha = v.vertical.sentido === null ? null : FLECHA[v.vertical.sentido];

  return (
    <div class="telemetria-datos" data-viejo={esViejo ? "si" : "no"}>
      {esViejo && edadS.value !== null && (
        <p class="telemetria-edad">
          <TriangleAlert aria-hidden="true" />
          <span>Último dato {hace(edadS.value * 1000)}</span>
        </p>
      )}

      <dl class="rejilla">
        <div class={`celda celda-altitud${alt.lkp ? " lkp" : ""}`} data-celda="altitud">
          <dt>Altitud</dt>
          <dd>
            {alt.valor === null ? (
              <SinDato />
            ) : (
              <>
                {alt.lkp && <MapPin aria-hidden="true" />}
                <Valor texto={numero(alt.valor, DECIMALES_ALTITUD)} unidad="m" />
                {alt.lkp && <span class="altitud-nota">última conocida</span>}
              </>
            )}
          </dd>
        </div>

        <div class="celda" data-celda="vertical">
          <dt>Velocidad vertical</dt>
          <dd>
            {v.vertical.valor === null || flecha === null ? (
              <SinDato />
            ) : (
              <>
                <span class="flecha" data-sentido={v.vertical.sentido}>
                  {flecha.icono}
                  <span class="solo-lector">{flecha.texto}</span>
                </span>
                <Valor texto={numero(v.vertical.valor, DECIMALES_VELOCIDAD)} unidad="m/s" />
              </>
            )}
          </dd>
        </div>

        <div class="celda" data-celda="total">
          <dt>Velocidad total</dt>
          <dd>
            {v.total === null ? (
              <SinDato />
            ) : (
              <Valor texto={numero(v.total, DECIMALES_VELOCIDAD)} unidad="m/s" />
            )}
          </dd>
        </div>

        <div class="celda celda-apogeo" data-celda="apogeo">
          <dt>
            <Mountain aria-hidden="true" />
            <span>Apogeo</span>
          </dt>
          <dd>
            {v.apogeo.alturaM === null ? (
              <span class="sin-dato-texto">aún no</span>
            ) : (
              <>
                <Valor texto={numero(v.apogeo.alturaM, DECIMALES_ALTITUD)} unidad="m" />
                {v.apogeo.tMasS !== null && <span class="apogeo-t">{tMas(v.apogeo.tMasS)}</span>}
              </>
            )}
          </dd>
        </div>

        <div class="celda celda-aceleracion" data-celda="aceleracion">
          <dt>Aceleración</dt>
          <dd>
            {v.aceleracion === null ? (
              <SinDato />
            ) : (
              (["x", "y", "z"] as const).map((eje) => (
                <span class="eje" key={eje} data-eje={eje}>
                  <span class="eje-nombre">{eje.toUpperCase()}</span>
                  <Valor
                    texto={textoONulo(v.aceleracion?.[eje] ?? null, DECIMALES_ACELERACION)}
                    unidad="g"
                  />
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * El panel de telemetría superpuesto al mapa (T-674). Vive en el JS inicial y dentro del marco del
 * mapa, no en el módulo diferido: si MapLibre falla o aún no carga, los datos siguen a la vista.
 * No captura gestos (el dedo lo atraviesa hacia el mapa). El ancla `#telemetria` es la de siempre.
 */
export function TelemetriaMapa() {
  return (
    <section id="telemetria" class="mapa-telemetria" aria-label="Telemetría">
      <DatosTelemetria />
    </section>
  );
}
