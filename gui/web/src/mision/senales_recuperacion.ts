// Las dos lecturas que comparten la sección Recuperación y la etiqueta de coordenadas del mapa (T-671).
// `estadoPagina` y `edad` cambian en cada tic del reloj local (10 Hz): un `computed` de un valor simple
// compara por valor y solo avisa cuando cambia, así que no repinta de más.
import { computed } from "@preact/signals";
import { edad, estadoPagina } from "../datos/api";

export const MS_POR_S = 1000;

/** Solo cambia cuando cambia el estado principal: no repinta con cada tic del reloj. */
export const principal = computed(() => estadoPagina.value.principal);
/** La edad del dato en segundos enteros: se repinta una vez por segundo, no por tic. */
export const edadS = computed(() =>
  edad.value === null ? null : Math.floor(edad.value / MS_POR_S),
);
