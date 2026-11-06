// Entrada de Hermes (D-W01): importa solo lo suyo (tema y contenido) más lo común.
import "../tema/comun.css";
import "../tema/hermes.css";
import "../mision/mision.css";
import { render } from "preact";
// La simulación de Hermes (T-637, `?url`): igual que la de Deméter, el archivo sale a `dist/assets/`
// y se descarga SOLO al pulsar "Ver la simulación del vuelo". Ojo: es un vuelo SINTÉTICO de ejemplo,
// no un cálculo del motor G80-7T (PEN-07, PEN-W04); su texto lo dice (`contenido/hermes.ts`).
import guionDeSimulacion from "../assets/hermes/simulacion_nominal.json?url";
import { hermes } from "../contenido/hermes";
import { arrancarDatos } from "../mision/arranque";
import { Pagina } from "../mision/Pagina";
import { descargarGuion } from "../simulacion/guion";

const simulacion = {
  nota: hermes.simulacion.nota,
  cargar: () => descargarGuion(guionDeSimulacion),
};

const raiz = document.getElementById("app");
if (raiz) render(<Pagina contenido={hermes} simulacion={simulacion} />, raiz);

// Los datos en vivo (T-624): el cliente de T-631 alimenta las signals de `datos/api.ts`.
arrancarDatos("hermes");

// Solo en desarrollo: `?ejemplo` carga datos de ejemplo. Vite elimina este bloque del build.
if (import.meta.env.DEV) {
  void import("../mision/ejemplo_dev").then((m) => m.cargarEjemplo("hermes"));
}
