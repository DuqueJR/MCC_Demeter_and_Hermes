// Marcadores del mapa (T-632): elementos del DOM que MapLibre coloca sobre el lienzo. Son
// componentes de Preact que leen su signal local: cuando el controlador la actualiza, solo se
// repinta ese marcador. Los colores salen de los tokens por CSS (`mapa.css`), nunca de aquí.
import type { ReadonlySignal } from "@preact/signals";
import { MapPin, Navigation2, RadioTower, Rocket, Target } from "lucide-preact";
import type { ComponentChild } from "preact";
import { lineasLkp, textoLkp } from "./geo";

export interface DatosCohete {
  /** Azimut en grados desde el norte; `null` si no hay rumbo fiable. */
  rumbo: number | null;
  /** Señal débil: el dato es viejo y se atenúa (03 §4). */
  atenuado: boolean;
}

export interface DatosLkp {
  alt_agl_m: number | null;
  edadMs: number | null;
}

/** Insignia redonda de un lugar fijo. El nombre va en la leyenda bajo el mapa (`Leyenda.tsx`) y para lectores de pantalla. */
function Insignia({
  clase,
  nombre,
  icono,
}: {
  clase: string;
  nombre: string;
  icono: ComponentChild;
}) {
  return (
    <div class={`mapa-insignia ${clase}`} role="img" aria-label={nombre} title={nombre}>
      {icono}
    </div>
  );
}

/** La rampa de lanzamiento (`meta.sitio`). */
export function MarcadorRampa() {
  return <Insignia clase="mapa-rampa" nombre="Rampa" icono={<Rocket aria-hidden="true" />} />;
}

/** La estación terrena (`estacion.pos`). */
export function MarcadorEstacion() {
  return (
    <Insignia clase="mapa-estacion" nombre="Estación" icono={<RadioTower aria-hidden="true" />} />
  );
}

/** Centro de la elipse de impacto: siempre es una estimación (03 §3.5). */
export function MarcadorImpacto() {
  return (
    <Insignia
      clase="mapa-impacto"
      nombre="Impacto estimado"
      icono={<Target aria-hidden="true" />}
    />
  );
}

/** Distancia y azimut desde la estación, en la mitad de la línea (`calc`). */
export function ChipDistancia({ texto }: { texto: ReadonlySignal<string> }) {
  return <div class="mapa-chip">{texto.value}</div>;
}

/** El cohete en vivo: un punto con halo y una flecha hacia donde va. */
export function MarcadorCohete({ datos }: { datos: ReadonlySignal<DatosCohete> }) {
  const { rumbo, atenuado } = datos.value;
  return (
    <div class={`mapa-cohete${atenuado ? " atenuado" : ""}`} role="img" aria-label="Cohete">
      <span class="cohete-halo" />
      <span class="cohete-punto" />
      {rumbo !== null && (
        <span class="cohete-rumbo" style={{ transform: `rotate(${rumbo}deg)` }}>
          <Navigation2 aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

/** La última posición conocida: pin rojo fijo con la altitud y "hace X s" (GS-03). */
export function MarcadorLkp({ datos }: { datos: ReadonlySignal<DatosLkp> }) {
  const { alt_agl_m, edadMs } = datos.value;
  const [titulo, detalle] = lineasLkp(alt_agl_m, edadMs);
  return (
    <div
      class="mapa-lkp"
      role="img"
      aria-label={`Última posición conocida del cohete. ${textoLkp(alt_agl_m, edadMs)}`}
    >
      <span class="lkp-texto">
        <span>{titulo}</span>
        {detalle && <span>{detalle}</span>}
      </span>
      <MapPin class="lkp-pin" aria-hidden="true" />
    </div>
  );
}
