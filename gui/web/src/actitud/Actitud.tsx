// La sección "Actitud" de la página de misión (03 §3.6, T-634): horizonte artificial (cabeceo y
// alabeo), brújula (rumbo) y los tres ángulos en grados, todo calculado del cuaternión `estado.q`.
//
// Cómo se actualiza: NO con una signal a 60 Hz (haría repintar la página entera, agenda H0 D9).
// Un `requestAnimationFrame` pide `interpolador.muestrear(performance.now())` (el cuaternión ya
// interpolado con slerp) y mueve directo los elementos del SVG; los textos solo se reescriben si
// cambia el valor redondeado. El ciclo corre solo mientras la sección está en pantalla. Con
// `prefers-reduced-motion` no hay ciclo de dibujo: se pinta cada `estado` que llega, sin
// interpolar. Lo que aparece (vivo, atenuado, sin señal…) lo decide `vista.ts` con `estadoPagina`.
import { effect } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { edad, estado, estadoPagina } from "../datos/api";
import { interpolador } from "../datos/interpolacion";
import { numero } from "../mision/formato";
import "./actitud.css";
import {
  type Angulos,
  angulosDeCuaternion,
  type Cuaternion,
  cardinalDe,
  normalizarRumbo,
} from "./angulos";
import {
  ACTITUD_DECIMALES_ANGULO,
  ACTITUD_DECIMALES_RUMBO,
  ACTITUD_SIN_VALOR,
  DIAL_MARGEN,
  DIAL_RADIO,
  DIAL_UNIDADES_POR_GRADO,
  ESCALA_ANCHO_CHICA,
  ESCALA_ANCHO_GRANDE,
  ESCALA_CABECEO_MAX_DEG,
  ESCALA_NUMERO_CADA_DEG,
  ESCALA_PASO_CABECEO_DEG,
  GRADOS_MEDIA_VUELTA,
  GRADOS_VUELTA,
  HORIZONTE_EXTENSION,
  PUNTERO_ALTO,
  PUNTERO_ANCHO,
  ROSA_MARCA_CHICA,
  ROSA_MARCA_GRANDE,
  ROSA_PASO_DEG,
  ROSA_PASO_GRANDE_DEG,
  ROSA_RADIO_LETRAS,
} from "./constantes";
import { decidirVista } from "./vista";

/** El cuadro de los instrumentos: el círculo y su margen, centrado en (0, 0). */
const VIEWBOX = `${-DIAL_RADIO - DIAL_MARGEN} ${-DIAL_RADIO - DIAL_MARGEN} ${2 * (DIAL_RADIO + DIAL_MARGEN)} ${2 * (DIAL_RADIO + DIAL_MARGEN)}`;

const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const fijo = (n: number) => n.toFixed(2);

/** `-0,04` con un decimal es `0,0`, no `−0,0`. */
function angulo(valor: number, decimales: number): string {
  const redondeado = Number(valor.toFixed(decimales));
  return numero(redondeado === 0 ? 0 : redondeado, decimales);
}

/** Las marcas de cabeceo: por encima del horizonte (y negativo) positivas, por debajo negativas. */
const MARCAS_CABECEO: number[] = [];
for (let g = ESCALA_PASO_CABECEO_DEG; g <= ESCALA_CABECEO_MAX_DEG; g += ESCALA_PASO_CABECEO_DEG) {
  MARCAS_CABECEO.push(g, -g);
}

/** Las marcas de la rosa, con su letra cada 90°. */
const LETRAS: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "O" };
const MARCAS_ROSA: number[] = [];
for (let g = 0; g < GRADOS_VUELTA; g += ROSA_PASO_DEG) MARCAS_ROSA.push(g);

/** Un punto de la circunferencia de radio `r`; 0° arriba y creciendo en sentido horario. */
const enRosa = (grados: number, r: number) => {
  const a = (grados * Math.PI) / GRADOS_MEDIA_VUELTA;
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
};

function Horizonte() {
  const ex = HORIZONTE_EXTENSION;
  return (
    <svg class="dial" viewBox={VIEWBOX} role="img" aria-label="Horizonte artificial">
      <defs>
        <clipPath id="actitud-recorte">
          <circle r={DIAL_RADIO} />
        </clipPath>
      </defs>
      <circle class="dial-fondo" r={DIAL_RADIO} />
      <g class="dial-contenido" clip-path="url(#actitud-recorte)">
        <g data-parte="horizonte">
          <rect class="cielo" x={-ex} y={-ex} width={2 * ex} height={ex} />
          <rect class="tierra" x={-ex} y="0" width={2 * ex} height={ex} />
          <line class="linea-horizonte" x1={-ex} x2={ex} y1="0" y2="0" />
          {MARCAS_CABECEO.map((g) => {
            const y = -g * DIAL_UNIDADES_POR_GRADO;
            const medio =
              (Math.abs(g) % (2 * ESCALA_PASO_CABECEO_DEG) === 0
                ? ESCALA_ANCHO_GRANDE
                : ESCALA_ANCHO_CHICA) / 2;
            return (
              <g key={g}>
                <line class="marca-cabeceo" x1={-medio} x2={medio} y1={y} y2={y} />
                {Math.abs(g) % ESCALA_NUMERO_CADA_DEG === 0 && (
                  <text class="numero-cabeceo" x={medio + 3} y={y} dominant-baseline="middle">
                    {Math.abs(g)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </g>
      <circle class="dial-aro" r={DIAL_RADIO} />
      {/* El símbolo fijo del cohete: lo que no se mueve es el cohete, el horizonte se mueve a su alrededor. */}
      <path class="simbolo-cohete" d="M-34 0H-12M12 0H34M0 -12V-4M-12 0A12 12 0 0 0 12 0" />
      <circle class="centro-cohete" r="2.5" />
    </svg>
  );
}

function Brujula() {
  return (
    <svg class="dial" viewBox={VIEWBOX} role="img" aria-label="Brújula">
      <circle class="dial-fondo" r={DIAL_RADIO} />
      <g class="dial-contenido">
        <g data-parte="rosa">
          {MARCAS_ROSA.map((g) => {
            const grande = g % ROSA_PASO_GRANDE_DEG === 0;
            const a = enRosa(g, DIAL_RADIO);
            const b = enRosa(g, DIAL_RADIO - (grande ? ROSA_MARCA_GRANDE : ROSA_MARCA_CHICA));
            return (
              <line
                key={g}
                class={grande ? "marca-rosa grande" : "marca-rosa"}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
              />
            );
          })}
          {Object.entries(LETRAS).map(([g, letra]) => {
            const p = enRosa(Number(g), ROSA_RADIO_LETRAS);
            // La letra gira con la rosa pero se mantiene derecha (se contra-gira sobre sí misma).
            return (
              <text
                key={g}
                class={g === "0" ? "letra-rosa norte" : "letra-rosa"}
                x={p.x}
                y={p.y}
                dominant-baseline="middle"
                text-anchor="middle"
              >
                {letra}
              </text>
            );
          })}
        </g>
      </g>
      <circle class="dial-aro" r={DIAL_RADIO} />
      {/* El puntero fijo arriba: hacia donde apunta la nariz del cohete. */}
      <path
        class="puntero"
        d={`M${-PUNTERO_ANCHO / 2} ${-DIAL_RADIO - PUNTERO_ALTO} h${PUNTERO_ANCHO} l${-PUNTERO_ANCHO / 2} ${PUNTERO_ALTO} z`}
      />
      <path class="simbolo-cohete" d="M0 -22L8 14L0 8L-8 14Z" />
    </svg>
  );
}

/** Pinta un cuaternión (o su ausencia) en los instrumentos. */
function crearPintor(raiz: HTMLElement) {
  const q = <T extends Element>(sel: string) => raiz.querySelector<T>(sel);
  const horizonte = q<SVGGElement>('[data-parte="horizonte"]');
  const rosa = q<SVGGElement>('[data-parte="rosa"]');
  const letras = [...raiz.querySelectorAll<SVGTextElement>(".letra-rosa")];
  const textoCabeceo = q<HTMLElement>('[data-angulo="cabeceo"]');
  const textoAlabeo = q<HTMLElement>('[data-angulo="alabeo"]');
  const textoRumbo = q<HTMLElement>('[data-angulo="rumbo"]');
  const notaCardan = q<HTMLElement>(".actitud-cardan");

  const escribir = (el: HTMLElement | null, texto: string) => {
    if (el && el.textContent !== texto) el.textContent = texto;
  };
  const poner = (el: Element | null, nombre: string, valor: string) => {
    if (el && el.getAttribute(nombre) !== valor) el.setAttribute(nombre, valor);
  };

  return (cuaternion: Cuaternion | null) => {
    const a: Angulos | null = cuaternion ? angulosDeCuaternion(cuaternion) : null;
    if (!a) {
      escribir(textoCabeceo, ACTITUD_SIN_VALOR);
      escribir(textoAlabeo, ACTITUD_SIN_VALOR);
      escribir(textoRumbo, ACTITUD_SIN_VALOR);
      if (notaCardan) notaCardan.hidden = true;
      return;
    }
    // Casi vertical, el alabeo y el rumbo no se separan: no se presentan como medidas (angulos.ts).
    const alabeo = a.cardan ? 0 : a.alabeo;
    const rumbo = a.cardan ? 0 : a.rumbo;
    // El horizonte se corre hacia abajo al subir la nariz y gira al revés que el cohete.
    poner(
      horizonte,
      "transform",
      `rotate(${fijo(-alabeo)}) translate(0 ${fijo(a.cabeceo * DIAL_UNIDADES_POR_GRADO)})`,
    );
    poner(rosa, "transform", `rotate(${fijo(-rumbo)})`);
    // Las letras giran con la rosa, pero se leen derechas.
    for (const letra of letras) {
      const x = Number(letra.getAttribute("x"));
      const y = Number(letra.getAttribute("y"));
      poner(letra, "transform", `rotate(${fijo(rumbo)} ${x} ${y})`);
    }
    escribir(textoCabeceo, `${angulo(a.cabeceo, ACTITUD_DECIMALES_ANGULO)}°`);
    if (a.cardan) {
      escribir(textoAlabeo, ACTITUD_SIN_VALOR);
      escribir(textoRumbo, ACTITUD_SIN_VALOR);
    } else {
      escribir(textoAlabeo, `${angulo(a.alabeo, ACTITUD_DECIMALES_ANGULO)}°`);
      // 359,6° se escribe 0° (no 360°).
      const rumbo = normalizarRumbo(Number(a.rumbo.toFixed(ACTITUD_DECIMALES_RUMBO)));
      escribir(textoRumbo, `${angulo(rumbo, ACTITUD_DECIMALES_RUMBO)}° ${cardinalDe(rumbo)}`);
    }
    if (notaCardan) notaCardan.hidden = !a.cardan;
  };
}

export function Actitud() {
  const raiz = useRef<HTMLElement>(null);
  const pagina = estadoPagina.value;
  const est = estado.value;
  const vista = decidirVista({
    principal: pagina.principal,
    hayEstado: est !== null,
    ekfOk: est?.flags.ekf_ok === true,
    edadMs: pagina.principal === "sin_senal" ? edad.value : null,
  });

  const mostrar = vista.mostrar;
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const pintar = crearPintor(el);
    if (!mostrar) {
      pintar(null);
      return;
    }

    // Sin animación: cada `estado` que llega se pinta tal cual, sin interpolar.
    if (sinMovimiento()) {
      return effect(() => pintar(estado.value?.q ?? null));
    }

    // Con animación: un ciclo de dibujo mientras la sección esté en pantalla.
    let visible = true;
    let cuadro = 0;
    const ciclo = () => {
      // La muestra interpolada; si el interpolador no tiene datos (por ejemplo, un snapshot
      // inyectado en pruebas), el último `estado`.
      pintar(interpolador.muestrear(performance.now())?.q ?? estado.peek()?.q ?? null);
      cuadro = requestAnimationFrame(ciclo);
    };
    const arrancar = () => {
      if (cuadro === 0 && visible) cuadro = requestAnimationFrame(ciclo);
    };
    const parar = () => {
      cancelAnimationFrame(cuadro);
      cuadro = 0;
    };
    const observador =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entradas) => {
            visible = entradas.some((e) => e.isIntersecting);
            if (visible) arrancar();
            else parar();
          });
    observador?.observe(el);
    arrancar();
    return () => {
      observador?.disconnect();
      parar();
    };
  }, [mostrar]);

  return (
    <section
      id="actitud"
      ref={raiz}
      class="seccion actitud"
      data-vista={vista.id}
      aria-labelledby="actitud-titulo"
    >
      <h2 id="actitud-titulo">Actitud</h2>
      <div class="actitud-instrumentos">
        <figure class="actitud-figura">
          <Horizonte />
          <figcaption>Horizonte</figcaption>
        </figure>
        <figure class="actitud-figura">
          <Brujula />
          <figcaption>Brújula</figcaption>
        </figure>
      </div>
      <dl class="actitud-angulos">
        <div>
          <dt>Cabeceo</dt>
          <dd data-angulo="cabeceo">{ACTITUD_SIN_VALOR}</dd>
        </div>
        <div>
          <dt>Alabeo</dt>
          <dd data-angulo="alabeo">{ACTITUD_SIN_VALOR}</dd>
        </div>
        <div>
          <dt>Rumbo</dt>
          <dd data-angulo="rumbo">{ACTITUD_SIN_VALOR}</dd>
        </div>
      </dl>
      {vista.texto && (
        <p class="actitud-estado" role="status">
          {vista.texto}
        </p>
      )}
      <p class="actitud-cardan" role="status" hidden>
        Casi vertical: el rumbo y el alabeo no se separan, por eso no se muestran.
      </p>
    </section>
  );
}
