// Entrada de Deméter (D-W01): importa solo lo suyo (tema, contenido y secciones) más lo común.
import "../tema/comun.css";
import "../tema/demeter.css";
import "../mision/mision.css";
import { render } from "preact";
import { demeter } from "../contenido/demeter";
import { arrancarDatos } from "../mision/arranque";
import { Hueco } from "../mision/Hueco";
import { Pagina } from "../mision/Pagina";

const raiz = document.getElementById("app");
if (raiz) {
  // Los ojos de Deméter (03 §3.9): sección exclusiva de esta misión. Su lógica llega con T-626.
  render(
    <Pagina contenido={demeter} extra={<Hueco id="ojos" titulo="Los ojos de Deméter" />} />,
    raiz,
  );
}

// Los datos en vivo (T-624): el cliente de T-631 alimenta las signals de `datos/api.ts`.
arrancarDatos("demeter");

// Solo en desarrollo: `?ejemplo` carga datos de ejemplo. Vite elimina este bloque del build.
if (import.meta.env.DEV) {
  void import("../mision/ejemplo_dev").then((m) => m.cargarEjemplo("demeter"));
}
