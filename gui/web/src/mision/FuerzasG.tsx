// Las fuerzas g de "Desde la estación" (T-674), como en la ventana EKF del dashboard de Pablo
// (`drawG`): a la izquierda el radar de la sección (Y, Z) visto desde la cola, con la marca (−Z) arriba,
// +Y a la derecha, anillos a 25/50/75 %, la estela de ~2 s y el punto de ahora; a la derecha la barra
// del eje X (nariz) con 1 g marcado, la banda mínimo-máximo de ~10 s y el punto de ahora. Las escalas
// son automáticas y redondas (`vista_fuerzas_g.ts`).
//
// Fuente: la misma aceleración de `vistaTelemetria` (la de la telemetría). Llega de TELEM: son los ejes
// del chip, sin calibrar. La historia sale de la `serie` de `datos/api.ts`; no hay otro búfer.
// "sin dato" y dato viejo se tratan como en la telemetría. Los valores clave van en texto (el SVG tiene
// `role="img"` y `aria-label`), y el |g| total se escribe aparte.
import { TriangleAlert } from "lucide-preact";
import { estado, eventos, salud, serie } from "../datos/api";
import { ACC_ESCALA_G } from "./constantes";
import { hace, numero } from "./formato";
import "./instrumentos.css";
import { edadS, principal, viejo } from "./senales_telemetria";
import { escalasG, saturaSensor, ventanaG } from "./vista_fuerzas_g";
import { magnitudG, vistaTelemetria } from "./vista_telemetria";

const DECIMALES_G = 2;
/** El cuadro del dibujo: radar a la izquierda y barra del eje X a la derecha. */
const ANCHO = 340;
const ALTO = 204;
const RADIO = 72;
const CX = RADIO + 14;
const CY = ALTO / 2 + 9;
const X_BARRA = CX + RADIO + 40;
const ANCHO_BARRA = 18;
const Y_SUP = 22;
const Y_INF = ALTO - 28;
const PUNTO_R = 5;
const PUNTO_X_R = 6;
/** Si dos marcas de la barra quedan más cerca que esto (px), la del 0 no lleva rótulo. */
const SEPARACION_MIN_PX = 13;
const ANILLOS = [0.25, 0.5, 0.75] as const;

const g2 = (v: number) => numero(v, DECIMALES_G);
/** `+10 g`, `0 g`, `−5 g`. */
const rotulo = (v: number) => `${v > 0 ? "+" : ""}${numero(v, 0)} g`;

export function FuerzasG() {
  const v = vistaTelemetria(estado.value, eventos.value, salud.value, principal.value);
  const esViejo = viejo.value;
  const a = v.aceleracion;

  if (a === null) {
    return (
      <section class="viz fuerzas-g" aria-label="Fuerzas g" data-fuerzas-g data-viejo="no">
        <h4 class="viz-titulo">Fuerzas g</h4>
        <p class="viz-sin-dato">
          <span class="sin-dato-texto">sin dato</span>
        </p>
      </section>
    );
  }

  const ventana = ventanaG(serie.value, a);
  const esc = escalasG(ventana);
  const total = magnitudG(a);
  const lateral = Math.hypot(a.y, a.z);
  const satura = saturaSensor(a);

  // El radar: +Y a la derecha y la marca (−Z) arriba, así que +Z cae hacia abajo en la pantalla.
  const aRadar = (y: number, z: number): [number, number] => {
    const dx = (y / esc.radar) * RADIO;
    const dy = (z / esc.radar) * RADIO;
    const largo = Math.hypot(dx, dy);
    const k = largo > RADIO ? RADIO / largo : 1;
    return [CX + dx * k, CY + dy * k];
  };
  const yBarra = (g: number) => Y_INF - ((g - esc.bajo) / (esc.alto - esc.bajo)) * (Y_INF - Y_SUP);
  const yAhora = yBarra(Math.max(esc.bajo, Math.min(esc.alto, a.x)));
  const [px, py] = aRadar(a.y, a.z);
  const estela = ventana.estela.map((p) => aRadar(p.y, p.z));
  const marcas = [esc.bajo, 0, 1, esc.alto];
  const cercaDelUno = Math.abs(yBarra(1) - yBarra(0)) < SEPARACION_MIN_PX;
  const xTexto = X_BARRA + ANCHO_BARRA;

  const descripcion = `Fuerzas g. Sección (Y, Z): ${g2(lateral)} g. Eje X, la nariz: ${g2(a.x)} g. Total: ${g2(total)} g. Escala del radar: ${esc.radar} g.`;

  return (
    <section
      class="viz fuerzas-g"
      aria-label="Fuerzas g que siente el cohete"
      data-fuerzas-g
      data-viejo={esViejo ? "si" : "no"}
      data-satura={satura ? "si" : "no"}
    >
      <h4 class="viz-titulo">Fuerzas g</h4>
      {esViejo && edadS.value !== null && (
        <p class="telemetria-edad">
          <TriangleAlert aria-hidden="true" />
          <span>Último dato {hace(edadS.value * 1000)}</span>
        </p>
      )}

      <p class="g-total" data-g="total">
        <span class="g-total-nombre">Total |g|</span>
        <span class="g-total-valor">
          <span class="g-num">{g2(total)}</span>
          <span class="g-unidad">g</span>
        </span>
      </p>

      <svg
        class="viz-svg"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label={descripcion}
        data-g-svg
      >
        {/* Radar de la sección (Y, Z), visto desde la cola. */}
        <circle class="g-aro" cx={CX} cy={CY} r={RADIO} />
        {ANILLOS.map((f) => (
          <circle key={f} class="g-anillo" cx={CX} cy={CY} r={RADIO * f} />
        ))}
        <path
          class="g-cruz"
          d={`M${CX - RADIO} ${CY}H${CX + RADIO}M${CX} ${CY - RADIO}V${CY + RADIO}`}
        />
        <text class="g-t-marca" x={CX} y={CY - RADIO - 4} text-anchor="middle">
          marca
        </text>
        <text class="g-t-y" x={CX + RADIO + 3} y={CY + 4}>
          +Y
        </text>
        <text class="g-t-escala" x={CX + RADIO * 0.71 + 3} y={CY - RADIO * 0.71}>
          {esc.radar} g
        </text>
        {estela.length > 1 && (
          <polyline
            class="g-estela"
            data-g-estela
            points={estela.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
          />
        )}
        <circle class="g-punto" data-g-punto="radar" cx={px} cy={py} r={PUNTO_R} />
        <text class="g-t-valor" x={4} y={13}>
          Sección (Y, Z): {g2(lateral)} g
        </text>

        {/* El eje X (nariz arriba): aquí se ve la gravedad, el empuje y el frenado. */}
        <rect class="g-barra" x={X_BARRA} y={Y_SUP} width={ANCHO_BARRA} height={Y_INF - Y_SUP} />
        <rect
          class="g-banda"
          data-g-banda
          x={X_BARRA + 2}
          y={yBarra(ventana.maxX)}
          width={ANCHO_BARRA - 4}
          height={Math.max(1, yBarra(ventana.minX) - yBarra(ventana.maxX))}
        />
        {marcas.map((m) => (
          <g key={m}>
            <line
              class={m === 1 ? "g-uno" : "g-marca"}
              x1={X_BARRA - 4}
              x2={xTexto + 4}
              y1={yBarra(m)}
              y2={yBarra(m)}
            />
            {!(m === 0 && cercaDelUno) && (
              <text class="g-t-marca-valor" x={xTexto + 7} y={yBarra(m) + 4}>
                {rotulo(m)}
              </text>
            )}
          </g>
        ))}
        <text class="g-t-uno" x={xTexto + 40} y={yBarra(1) - 1}>
          <tspan x={xTexto + 40}>1 g: quieto,</tspan>
          <tspan x={xTexto + 40} dy="11">
            nariz arriba
          </tspan>
        </text>
        <circle
          class="g-punto-x"
          data-g-punto="x"
          cx={X_BARRA + ANCHO_BARRA / 2}
          cy={yAhora}
          r={PUNTO_X_R}
        />
        <text class="g-t-valor" x={X_BARRA - 44} y={13}>
          Eje X (nariz): {g2(a.x)} g
        </text>
        <text class="g-t-pie" x={4} y={ALTO - 5}>
          ejes del chip, sin calibrar; estela 2 s, banda 10 s
        </text>
      </svg>

      {satura && (
        <p class="g-satura" role="status">
          Fuera del rango del sensor (±{ACC_ESCALA_G} g): el dato satura.
        </p>
      )}
    </section>
  );
}
