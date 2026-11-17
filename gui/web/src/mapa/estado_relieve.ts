// Si el mapa tiene relieve (T-649). Lo escribe el controlador (chunk diferido) y lo lee la leyenda
// (JS inicial): la leyenda solo nombra el relieve cuando de verdad se dibuja, así que si faltan los
// archivos no dice nada que el mapa no muestre. Es un módulo aparte para que la leyenda no importe
// MapLibre.
import { signal } from "@preact/signals";

export const relieveActivo = signal(false);
