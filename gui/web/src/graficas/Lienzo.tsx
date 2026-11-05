// El lienzo de la gráfica (T-633): uPlot dentro de un contenedor que se adapta al ancho (rotar el
// celular, redimensionar). Es el ÚNICO archivo que importa uPlot, y la sección lo pide con un
// `import()` dinámico: uPlot y su CSS van en un chunk aparte, fuera del JS inicial (04 §6).
//
// Los datos llegan ya listos por props (`columnas`, `marcas`) desde `Graficas.tsx`, que los
// limita a `GRAFICAS_REFRESCO_MS`: aquí no hay ninguna suscripción a signals ni ciclo de dibujo.
//
// Colores: salen de las variables CSS del tema, leídas en tiempo de ejecución (como el mapa); así
// Hermes y Deméter se ven con su paleta sin ningún color escrito aquí (06 §6, D-W01).
import { useEffect, useRef } from "preact/hooks";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { numero } from "../mision/formato";
import {
  type Columnas,
  EJE_TIEMPO,
  formatoTick,
  type Magnitud,
  type Marca,
  medidasDelLienzo,
  rangoX,
  rangoY,
} from "./columnas";
import {
  GRAFICAS_ALTO_EJE_X_PX,
  GRAFICAS_ANCHO_EJE_Y_PX,
  GRAFICAS_ANCHO_LINEA_PX,
  GRAFICAS_MARCA_HALO_PX,
  GRAFICAS_MARCA_HUECO_PX,
  GRAFICAS_MARCA_MARGEN_PX,
  GRAFICAS_MARCA_RAYA_PX,
  GRAFICAS_MARCA_SEPARACION_PX,
  GRAFICAS_ROTULO_EJE_PX,
  GRAFICAS_TAM_TEXTO_MARCA_PX,
  GRAFICAS_TAM_TEXTO_PX,
} from "./constantes";

export interface PropsLienzo {
  magnitud: Magnitud;
  columnas: Columnas;
  marcas: readonly Marca[];
  /** El texto alternativo de la gráfica entera. */
  etiqueta: string;
}

const LECTURA_INICIAL = "Toca o pasa el cursor para ver un valor.";

interface Tokens {
  fondo: string;
  linea: string;
  texto: string;
  texto2: string;
  acento: string;
  fuente: string;
}

/** Los colores y la fuente del tema, tal como los resuelve el navegador en este elemento. */
function leerTokens(el: HTMLElement): Tokens {
  const css = getComputedStyle(el);
  const v = (nombre: string) => css.getPropertyValue(nombre).trim();
  const texto = v("--texto") || css.color;
  return {
    fondo: v("--superficie") || css.backgroundColor,
    linea: v("--linea") || texto,
    texto,
    texto2: v("--texto-2") || texto,
    acento: v("--acento") || texto,
    fuente: css.fontFamily,
  };
}

/**
 * Las marcas verticales de los eventos: una raya discontinua y, si cabe, su nombre girado.
 * Devuelve cuántas rayas cayeron dentro de la gráfica.
 */
function dibujarMarcas(g: uPlot, marcas: readonly Marca[], t: Tokens): number {
  if (marcas.length === 0) return 0;
  const px = uPlot.pxRatio;
  const { left, top, width, height } = g.bbox;
  const { ctx } = g;
  const margen = GRAFICAS_MARCA_MARGEN_PX * px;
  const alto = GRAFICAS_TAM_TEXTO_MARCA_PX * px;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, height);
  ctx.clip();
  ctx.strokeStyle = t.texto2;
  ctx.fillStyle = t.texto;
  ctx.lineWidth = px;
  ctx.setLineDash([GRAFICAS_MARCA_RAYA_PX * px, GRAFICAS_MARCA_HUECO_PX * px]);
  ctx.font = `${alto}px ${t.fuente}`;
  let ultimoRotulo = Number.NEGATIVE_INFINITY;
  let dibujadas = 0;
  for (const m of marcas) {
    const x = Math.round(g.valToPos(m.tMasS, "x", true));
    if (x < left || x > left + width) continue;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + height);
    ctx.stroke();
    dibujadas++;
    // Dos marcas casi juntas no se rotulan las dos (se encimarían); la lista bajo la gráfica las dice todas.
    if (x - ultimoRotulo < GRAFICAS_MARCA_SEPARACION_PX * px) continue;
    ultimoRotulo = x;
    // El rótulo va a la derecha de la raya; junto al borde derecho, a la izquierda.
    const aLaDerecha = x + margen + alto <= left + width;
    ctx.save();
    ctx.translate(aLaDerecha ? x + margen : x - margen, top + margen);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = aLaDerecha ? "bottom" : "top";
    // Un contorno del color del fondo: la línea de datos no se cruza con las letras.
    ctx.lineJoin = "round";
    ctx.lineWidth = GRAFICAS_MARCA_HALO_PX * px;
    ctx.strokeStyle = t.fondo;
    ctx.setLineDash([]);
    ctx.strokeText(m.rotulo, 0, 0);
    ctx.fillText(m.rotulo, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  return dibujadas;
}

export default function Lienzo({ magnitud, columnas, marcas, etiqueta }: PropsLienzo) {
  const contenedor = useRef<HTMLDivElement>(null);
  const lectura = useRef<HTMLParagraphElement>(null);
  const grafica = useRef<uPlot | null>(null);
  // Lo que leen los hooks de uPlot: siempre lo último que llegó por props.
  const ultimos = useRef({ columnas, marcas });
  ultimos.current = { columnas, marcas };

  // La gráfica se crea una vez por magnitud (cambiar de pestaña la rehace).
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const tokens = leerTokens(el);
    const fuente = `${GRAFICAS_TAM_TEXTO_PX}px ${tokens.fuente}`;
    const ejeComun = {
      stroke: tokens.texto2,
      font: fuente,
      labelFont: fuente,
      grid: { stroke: tokens.linea, width: 1 },
      ticks: { stroke: tokens.linea, width: 1 },
    };
    const medidas = medidasDelLienzo(el.clientWidth, window.innerHeight);
    const g = new uPlot(
      {
        width: medidas.ancho,
        height: medidas.alto,
        padding: [GRAFICAS_TAM_TEXTO_PX, GRAFICAS_TAM_TEXTO_PX, 0, 0],
        legend: { show: false },
        cursor: { drag: { x: false, y: false } },
        scales: {
          x: { time: false, range: () => rangoX(ultimos.current.columnas, ultimos.current.marcas) },
          y: { range: () => rangoY(ultimos.current.columnas, magnitud) },
        },
        axes: [
          {
            ...ejeComun,
            label: EJE_TIEMPO,
            size: GRAFICAS_ALTO_EJE_X_PX,
            labelSize: GRAFICAS_ROTULO_EJE_PX,
            values: (_u, cortes) => cortes.map((c) => formatoTick(c)),
          },
          {
            ...ejeComun,
            label: magnitud.eje,
            size: GRAFICAS_ANCHO_EJE_Y_PX,
            labelSize: GRAFICAS_ROTULO_EJE_PX,
            values: (_u, cortes) => cortes.map((c) => formatoTick(c)),
          },
        ],
        series: [
          {},
          {
            label: magnitud.titulo,
            stroke: tokens.acento,
            width: GRAFICAS_ANCHO_LINEA_PX,
            spanGaps: false, // un `null` es un hueco, no un cero
          },
        ],
        hooks: {
          draw: [
            (u) => {
              const n = dibujarMarcas(u, ultimos.current.marcas, tokens);
              // Para las pruebas y para depurar: cuántas marcas se dibujaron de verdad.
              el.dataset.marcasDibujadas = String(n);
            },
          ],
          setCursor: [
            (u) => {
              const i = u.cursor.idx;
              const { t, y } = ultimos.current.columnas;
              const v = i === null || i === undefined ? null : y[i];
              const texto =
                i === null || i === undefined || v === null || v === undefined
                  ? LECTURA_INICIAL
                  : `A los ${numero(t[i] as number, 1)} s: ${numero(v, magnitud.decimales)} ${magnitud.unidad}`;
              const p = lectura.current;
              if (p && p.textContent !== texto) p.textContent = texto;
            },
          ],
        },
      },
      [ultimos.current.columnas.t, ultimos.current.columnas.y],
      el,
    );
    grafica.current = g;

    // Se adapta al ancho (rotar el celular, redimensionar); solo redibuja si la medida cambió.
    let ancho = medidas.ancho;
    let alto = medidas.alto;
    const ajustar = () => {
      const m = medidasDelLienzo(el.clientWidth, window.innerHeight);
      if (m.ancho === ancho && m.alto === alto) return;
      ancho = m.ancho;
      alto = m.alto;
      g.setSize({ width: m.ancho, height: m.alto });
    };
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(ajustar);
    observador?.observe(el);
    window.addEventListener("resize", ajustar);
    return () => {
      observador?.disconnect();
      window.removeEventListener("resize", ajustar);
      g.destroy();
      grafica.current = null;
    };
  }, [magnitud.id]);

  // Datos nuevos: uPlot recalcula los rangos con las funciones de arriba y redibuja (con las marcas).
  useEffect(() => {
    grafica.current?.setData([columnas.t, columnas.y]);
  }, [columnas, marcas]);

  return (
    <>
      <div
        class="grafica"
        role="img"
        aria-label={etiqueta}
        data-magnitud={magnitud.id}
        data-puntos={columnas.t.length}
      >
        <div ref={contenedor} class="grafica-lienzo" />
      </div>
      <p ref={lectura} class="graficas-lectura" aria-hidden="true">
        {LECTURA_INICIAL}
      </p>
    </>
  );
}
