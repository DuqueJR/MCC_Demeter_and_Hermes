// La sección "Gráficas" de la página de misión (03 §3.7, GS-11, T-633): altitud, velocidad vertical
// y aceleración contra T+, con marcas verticales en los eventos que existan.
//
// Es un cascarón pequeño: las pestañas, los textos y la lógica de qué mostrar. uPlot vive en
// `Lienzo.tsx` y se pide con `import()` cuando la sección se acerca a la pantalla (04 §2 y §6).
//
// Cómo se actualiza (agenda H0 D9: nada a 60 Hz): NO lee `serie.value` al pintar (el cliente la
// republica con cada `estado`, ~9 Hz, y repintaría la página). Un `effect` se suscribe a `serie` y
// `eventos` y, a lo más cada `GRAFICAS_REFRESCO_MS`, recalcula las columnas de la pestaña activa y
// se las pasa al lienzo. Con la sección lejos de la pantalla no calcula nada.
import { computed, effect } from "@preact/signals";
import type { ComponentType } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { edad, estadoPagina, eventos, serie } from "../datos/api";
import {
  type Columnas,
  columnasDe,
  MAGNITUDES,
  type Magnitud,
  type MagnitudId,
  type Marca,
  marcasDe,
  puntosConValor,
  resumenDe,
  textoMarca,
} from "./columnas";
import {
  GRAFICAS_MARGEN_CARGA_PX,
  GRAFICAS_REFRESCO_MS,
  GRAFICAS_REFRESCO_REDUCIDO_MS,
} from "./constantes";
import "./graficas.css";
import type { PropsLienzo } from "./Lienzo";
import { limitar } from "./limitador";
import { pestanaConTecla } from "./pestanas";
import { decidirVista, TEXTO_SIN_VALORES } from "./vista";

/** Solo cambia cuando cambia el estado principal: no repinta la sección con cada tic del reloj. */
const principal = computed(() => estadoPagina.value.principal);
/** La edad en segundos enteros, y solo si hace falta (sin señal): se repinta una vez por segundo. */
const edadMs = computed(() =>
  estadoPagina.value.principal === "sin_senal" && edad.value !== null
    ? Math.floor(edad.value / 1000) * 1000
    : null,
);

type FaseChunk = "esperando" | "cargando" | "listo" | "fallo";

interface Datos {
  columnas: Columnas;
  marcas: Marca[];
  hayDespegue: boolean;
  resumen: string | null;
  /** Cuántos puntos tienen valor en esta magnitud (puede haber T+ pero no, por ejemplo, Vz sin fix 3D). */
  conValor: number;
}

const VACIO: Datos = {
  columnas: { t: [], y: [] },
  marcas: [],
  hayDespegue: false,
  resumen: null,
  conValor: 0,
};

const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function calcular(magnitud: Magnitud): Datos {
  const evs = eventos.peek();
  const columnas = columnasDe(serie.peek(), magnitud.id, evs);
  return {
    columnas,
    marcas: marcasDe(evs),
    hayDespegue: evs.some((e) => e.tipo === "despegue"),
    resumen: resumenDe(columnas, magnitud),
    conValor: puntosConValor(columnas),
  };
}

export function Graficas() {
  const raiz = useRef<HTMLElement>(null);
  const [activa, setActiva] = useState<MagnitudId>("altitud");
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [fase, setFase] = useState<FaseChunk>("esperando");
  const [Lienzo, setLienzo] = useState<ComponentType<PropsLienzo> | null>(null);
  const pedido = useRef(false);
  /** ¿La sección está cerca de la pantalla? Lejos, no se recalcula nada. */
  const cerca = useRef(typeof IntersectionObserver === "undefined");
  const refrescar = useRef<() => void>(() => {});

  const magnitud = MAGNITUDES.find((m) => m.id === activa) ?? (MAGNITUDES[0] as Magnitud);

  const cargar = () => {
    if (pedido.current) return;
    pedido.current = true;
    setFase("cargando");
    import("./Lienzo")
      .then((modulo) => {
        setLienzo(() => modulo.default); // una función en `setState` sería un "actualizador"
        setFase("listo");
      })
      .catch(() => {
        pedido.current = false;
        setFase("fallo");
      });
  };

  // Carga diferida de uPlot y, mientras la sección está lejos, sin recalcular.
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      cargar();
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        const estaba = cerca.current;
        cerca.current = entradas.some((e) => e.isIntersecting);
        if (cerca.current) {
          cargar();
          if (!estaba) refrescar.current(); // se puso al día de lo que llegó mientras estaba lejos
        }
      },
      { rootMargin: `${GRAFICAS_MARGEN_CARGA_PX}px 0px` },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // Los datos de la pestaña activa, a lo más cada `GRAFICAS_REFRESCO_MS`.
  useEffect(() => {
    const limitador = limitar(
      () => {
        if (cerca.current) setDatos(calcular(magnitud));
      },
      sinMovimiento() ? GRAFICAS_REFRESCO_REDUCIDO_MS : GRAFICAS_REFRESCO_MS,
    );
    refrescar.current = limitador.llamar;
    const parar = effect(() => {
      // Solo la suscripción: el cálculo lee con `peek()`, y es el limitador el que decide cuándo.
      void serie.value;
      void eventos.value;
      limitador.llamar();
    });
    return () => {
      parar();
      limitador.cancelar();
      refrescar.current = () => {};
    };
  }, [magnitud]);

  const vista = decidirVista({
    principal: principal.value,
    hayDespegue: datos.hayDespegue,
    puntos: datos.columnas.t.length,
    edadMs: edadMs.value,
  });
  const hayLinea = vista.mostrar && datos.conValor > 0;
  const etiqueta =
    `${magnitud.titulo} contra el tiempo desde el despegue. ${datos.resumen ?? ""}`.trim();

  /** Cambia de pestaña y calcula sus datos en el mismo cuadro: no se ve la magnitud vieja con la nueva. */
  const elegir = (m: Magnitud) => {
    setActiva(m.id);
    setDatos(calcular(m));
  };

  const alTeclear = (e: KeyboardEvent, indice: number) => {
    const destino = pestanaConTecla(indice, e.key, MAGNITUDES.length);
    if (destino === null) return;
    e.preventDefault();
    const m = MAGNITUDES[destino] as Magnitud;
    elegir(m);
    document.getElementById(`graficas-pestana-${m.id}`)?.focus();
  };

  return (
    <section
      id="graficas"
      ref={raiz}
      class="seccion graficas"
      data-vista={vista.id}
      aria-labelledby="graficas-titulo"
    >
      <h2 id="graficas-titulo">Gráficas</h2>
      <div class="graficas-pestanas" role="tablist" aria-label="Qué medida graficar">
        {MAGNITUDES.map((m, i) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            id={`graficas-pestana-${m.id}`}
            aria-selected={m.id === activa}
            aria-controls="graficas-panel"
            tabIndex={m.id === activa ? 0 : -1}
            onClick={() => elegir(m)}
            onKeyDown={(e) => alTeclear(e, i)}
          >
            {m.titulo}
          </button>
        ))}
      </div>
      <div
        id="graficas-panel"
        class="graficas-panel"
        role="tabpanel"
        aria-labelledby={`graficas-pestana-${activa}`}
        // Sin nada interactivo adentro: el panel entra al orden del teclado (patrón WAI-ARIA de pestañas).
        // biome-ignore lint/a11y/noNoninteractiveTabindex: lo pide el patrón de pestañas de WAI-ARIA
        tabIndex={0}
      >
        {hayLinea && (
          <>
            {Lienzo ? (
              <Lienzo
                magnitud={magnitud}
                columnas={datos.columnas}
                marcas={datos.marcas}
                etiqueta={etiqueta}
              />
            ) : (
              <p class="graficas-nota" role="status">
                {fase === "fallo" ? (
                  <>
                    No se pudo cargar la gráfica.{" "}
                    <button type="button" class="graficas-reintentar" onClick={cargar}>
                      Reintentar
                    </button>
                  </>
                ) : (
                  "Cargando la gráfica…"
                )}
              </p>
            )}
            {datos.resumen && <p class="graficas-resumen">{datos.resumen}</p>}
            {datos.marcas.length > 0 && (
              <ul class="graficas-marcas" aria-label="Momentos del vuelo">
                {datos.marcas.map((m) => (
                  <li key={m.tipo}>{textoMarca(m)}</li>
                ))}
              </ul>
            )}
          </>
        )}
        {vista.mostrar && datos.conValor === 0 && (
          <p class="graficas-vacio" role="status">
            {TEXTO_SIN_VALORES}
          </p>
        )}
        {!vista.mostrar && (
          <p class="graficas-vacio" role="status">
            {vista.texto}
          </p>
        )}
      </div>
      {vista.mostrar && vista.texto && (
        <p class="graficas-estado" role="status">
          {vista.texto}
        </p>
      )}
    </section>
  );
}
