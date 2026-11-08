// Las lecturas que comparten la telemetría del mapa, el Resumen y los visualizadores de "Desde la
// estación" (T-674). Son `computed` de valores simples: comparan por valor y solo avisan cuando cambian,
// así que no repintan con cada tic del reloj local (10 Hz).
import { computed } from "@preact/signals";
import { edad, estadoPagina } from "../datos/api";
import { datoViejo } from "./vista_telemetria";

const MS_POR_S = 1000;

/** Solo cambia cuando cambia el estado principal. */
export const principal = computed(() => estadoPagina.value.principal);
/** Si el dato es viejo (edad >= `WEB_DATO_VIEJO_S`). */
export const viejo = computed(() => datoViejo(edad.value));
/** La antigüedad del dato en segundos enteros: se repinta una vez por segundo, no por tic. */
export const edadS = computed(() =>
  edad.value === null ? null : Math.floor(edad.value / MS_POR_S),
);
