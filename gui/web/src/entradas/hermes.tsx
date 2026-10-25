// Entrada de Hermes (D-W01): importa solo lo suyo (tema y contenido) más lo común.
import "../tema/comun.css";
import "../tema/hermes.css";
import "../mision/mision.css";
import { render } from "preact";
import { hermes } from "../contenido/hermes";
import { Pagina } from "../mision/Pagina";

const raiz = document.getElementById("app");
if (raiz) render(<Pagina contenido={hermes} />, raiz);

// Solo en desarrollo: `?ejemplo` carga datos de ejemplo. Vite elimina este bloque del build.
if (import.meta.env.DEV) {
  void import("../mision/ejemplo_dev").then((m) => m.cargarEjemplo("hermes"));
}
