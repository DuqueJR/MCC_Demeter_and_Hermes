// Entrada de Deméter (D-W01): importa solo lo suyo (tema, contenido y secciones) más lo común.
import "../tema/comun.css";
import "../tema/demeter.css";
import "../mision/mision.css";
import { render } from "preact";
// La simulación de Deméter (T-635, `?url`): el archivo sale a `dist/assets/` y se descarga SOLO al
// pulsar "Ver la simulación del vuelo"; no entra al paquete inicial de la página. Cada misión
// importa solo el suyo (D-W01); el de Hermes es otro archivo y otra entrada (T-637).
import guionDeSimulacion from "../assets/demeter/simulacion_nominal.json?url";
import { demeter } from "../contenido/demeter";
import { arrancarDatos } from "../mision/arranque";
import { Hueco } from "../mision/Hueco";
import { Pagina } from "../mision/Pagina";
import { SeccionPi } from "../mision/SeccionPi";
import { descargarGuion } from "../simulacion/guion";

const simulacion = {
  nota: demeter.simulacion.nota,
  cargar: () => descargarGuion(guionDeSimulacion),
};

const raiz = document.getElementById("app");
if (raiz) {
  // Secciones exclusivas de esta misión (Hermes no tiene Pi): la Raspberry Pi (T-659, D-065) y
  // Los ojos de Deméter (03 §3.9), cuya lógica llega con T-626.
  render(
    <Pagina
      contenido={demeter}
      extra={
        <>
          <SeccionPi />
          <Hueco id="ojos" titulo="Los ojos de Deméter" />
        </>
      }
      simulacion={simulacion}
    />,
    raiz,
  );
}

// Los datos en vivo (T-624): el cliente de T-631 alimenta las signals de `datos/api.ts`.
arrancarDatos("demeter");

// Solo en desarrollo: `?ejemplo` carga datos de ejemplo. Vite elimina este bloque del build.
if (import.meta.env.DEV) {
  void import("../mision/ejemplo_dev").then((m) => m.cargarEjemplo("demeter"));
}
