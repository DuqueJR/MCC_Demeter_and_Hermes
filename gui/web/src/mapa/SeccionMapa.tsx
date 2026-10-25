// La sección "Mapa" de la página de misión (03 §3.4, T-632). Es lo ÚNICO del mapa que va en el JS
// inicial: un cascarón pequeño que pide el mapa de verdad (`./Mapa`, con MapLibre y pmtiles) con un
// `import()` dinámico cuando la sección se acerca a la pantalla (04 §2 y §6). Hasta entonces la
// página no descarga ni una línea de MapLibre, y sin mapa sigue siendo útil.
import type { ComponentType } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { MAPA_MARGEN_CARGA_PX } from "./constantes";
import { Leyenda } from "./Leyenda";
import type { PropsMapa } from "./Mapa";
import "./seccion.css";

/** Clase que se pone en `<html>` mientras el mapa está en pantalla completa (bloquea el desplazamiento). */
const CLASE_COMPLETA_ABIERTA = "mapa-completa-abierta";

type Fase = "esperando" | "cargando" | "listo" | "fallo";

export function SeccionMapa() {
  const marco = useRef<HTMLDivElement>(null);
  const pedido = useRef(false);
  const [fase, setFase] = useState<Fase>("esperando");
  const [Mapa, setMapa] = useState<ComponentType<PropsMapa> | null>(null);
  const [completa, setCompleta] = useState(false);

  const cargar = () => {
    if (pedido.current) return;
    pedido.current = true;
    setFase("cargando");
    import("./Mapa")
      .then((modulo) => {
        setMapa(() => modulo.default); // una función en `setState` sería un "actualizador"
        setFase("listo");
      })
      .catch(() => {
        pedido.current = false;
        setFase("fallo");
      });
  };

  // Carga diferida: cuando la sección entra (o está a punto de entrar) en pantalla.
  useEffect(() => {
    const elemento = marco.current;
    if (!elemento) return;
    if (typeof IntersectionObserver === "undefined") {
      cargar();
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          observador.disconnect();
          cargar();
        }
      },
      { rootMargin: `${MAPA_MARGEN_CARGA_PX}px 0px` },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  // Pantalla completa (sin la API nativa: en iPhone no existe para elementos que no son video):
  // la sección cubre la ventana, la página detrás no se desplaza y Escape sale.
  useEffect(() => {
    document.documentElement.classList.toggle(CLASE_COMPLETA_ABIERTA, completa);
    if (!completa) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setCompleta(false);
    addEventListener("keydown", alTeclear);
    return () => removeEventListener("keydown", alTeclear);
  }, [completa]);

  return (
    <section
      id="mapa"
      class={`seccion mapa-seccion${completa ? " completa" : ""}`}
      aria-labelledby="mapa-titulo"
    >
      <h2 id="mapa-titulo">Mapa</h2>
      <div ref={marco} class="mapa-marco" data-mapa-fase={fase}>
        {Mapa ? (
          <Mapa completa={completa} alAlternarCompleta={() => setCompleta((c) => !c)} />
        ) : fase === "fallo" ? (
          <div class="mapa-espera" role="alert">
            <p>No se pudo cargar el mapa. El resto de la página sigue funcionando.</p>
            <button type="button" class="chip" onClick={cargar}>
              Reintentar
            </button>
          </div>
        ) : (
          <p class="mapa-espera" role="status">
            {fase === "cargando"
              ? "Cargando el mapa…"
              : "El mapa se carga al llegar a esta sección."}
          </p>
        )}
      </div>
      {Mapa && <Leyenda />}
    </section>
  );
}
