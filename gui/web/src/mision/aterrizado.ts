// `fase = LANDED` como un booleano que solo notifica cuando cambia (T-625).
// `estadoPagina` devuelve un objeto nuevo en cada tic del reloj local (10 Hz); leerlo directo en
// `Pagina` la volvería a dibujar entera (mapa, Inicio, Equipo, Actitud...) 10 veces por segundo.
// Un `computed` de un booleano compara por valor y no avisa mientras siga igual.
import { computed } from "@preact/signals";
import { estadoPagina } from "../datos/api";

export const aterrizado = computed(() => estadoPagina.value.aterrizado);
