// La actitud de "Desde la estación" (T-674), como la vista 3D de la ventana EKF del dashboard de Pablo
// (`draw3d`): el cohete de alambre sobre una rosa de los vientos, con la marca (−Z) en el color de aviso,
// el costado derecho (+Y) en el de información, las aletas, la línea punteada "arriba" y la flecha de
// velocidad. La cámara es fija. La escena y la conversión de marcos (FRD de Pablo -> FLU/ENU de la web)
// están en `vista_rosa.ts`; los ángulos, en `actitud/angulos.ts`. La sección "Actitud" (horizonte y
// brújula, `actitud/Actitud.tsx`) no cambia.
//
// Se repinta con cada `estado` (~9 Hz), sin interpolar: es un dibujo chico. Sin dato, sin orientación
// del EKF (`ekf_ok = false`) o con dato viejo se dice, y el cohete no se dibuja si no hay orientación.
import { TriangleAlert } from "lucide-preact";
import { angulosDeCuaternion } from "../actitud/angulos";
import { estado } from "../datos/api";
import { hace, numero } from "./formato";
import "./instrumentos.css";
import { edadS, viejo } from "./senales_telemetria";
import { armarEscena, CAMARA_FIJA, type Punto } from "./vista_rosa";

const ANCHO = 300;
const ALTO = 190;
/** Tamaño de la escena: casi la mitad del lado menor (en el dashboard de Pablo, el 42 %). */
const ESCALA = Math.min(ANCHO, ALTO) * 0.48;
const CX = ANCHO / 2;
const CY = ALTO / 2 + 24;
const DECIMALES_ANGULO = 1;
const SIN_VALOR = "—";

const sx = (p: Punto) => CX + ESCALA * p.x;
const sy = (p: Punto) => CY - ESCALA * p.arriba;
const linea = (a: Punto, b: Punto) => ({ x1: sx(a), y1: sy(a), x2: sx(b), y2: sy(b) });

/** `-0,04` con un decimal es `0,0`, no `−0,0`. */
function grados(v: number): string {
  const r = Number(v.toFixed(DECIMALES_ANGULO));
  return `${numero(r === 0 ? 0 : r, DECIMALES_ANGULO)}°`;
}

export function ActitudEstacion() {
  const e = estado.value;
  const esViejo = viejo.value;
  const ang = e === null ? null : angulosDeCuaternion(e.q);
  const sinOrientacion = e === null || ang === null || !e.flags.ekf_ok;
  // La escena se arma siempre (la rosa se ve); el cohete solo con orientación válida.
  const vel = e?.vel ?? null;
  const escena = armarEscena(
    sinOrientacion ? { w: 1, x: 0, y: 0, z: 0 } : (e as NonNullable<typeof e>).q,
    CAMARA_FIJA,
    vel === null ? null : { e: vel.e_ms, n: vel.n_ms, u: vel.u_ms },
  );

  const guinada = ang === null || ang.cardan ? SIN_VALOR : grados(ang.rumbo);
  const cabeceo = ang === null ? SIN_VALOR : grados(ang.cabeceo);
  const alabeo = ang === null || ang.cardan ? SIN_VALOR : grados(ang.alabeo);
  const estadoVista = e === null ? "sin-dato" : sinOrientacion ? "no-disponible" : "vivo";
  const descripcion =
    estadoVista === "vivo"
      ? `Actitud del cohete sobre una rosa de los vientos. Guiñada ${guinada}, cabeceo ${cabeceo}, alabeo ${alabeo}.`
      : estadoVista === "no-disponible"
        ? "Actitud del cohete: orientación aún no disponible."
        : "Actitud del cohete: sin dato.";

  return (
    <section
      class="viz actitud-estacion"
      aria-label="Actitud del cohete"
      data-actitud-estacion
      data-vista={estadoVista}
      data-viejo={esViejo ? "si" : "no"}
    >
      <h4 class="viz-titulo">Actitud</h4>
      {esViejo && edadS.value !== null && (
        <p class="telemetria-edad">
          <TriangleAlert aria-hidden="true" />
          <span>Último dato {hace(edadS.value * 1000)}</span>
        </p>
      )}

      <svg
        class="viz-svg"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label={descripcion}
        data-rosa-svg
      >
        <polyline
          class="rosa-aro"
          points={escena.aro.map((p) => `${sx(p).toFixed(1)},${sy(p).toFixed(1)}`).join(" ")}
        />
        {escena.puntos.map((d) => (
          <g key={d.letra}>
            <line
              class={d.letra === "N" ? "rosa-eje-n" : "rosa-eje"}
              {...linea(d.desde, d.hasta)}
            />
            <text
              class={d.letra === "N" ? "rosa-letra-n" : "rosa-letra"}
              x={sx(d.hasta) + 3}
              y={sy(d.hasta) - 3}
            >
              {d.letra}
            </text>
          </g>
        ))}
        <line class="rosa-arriba" {...linea(escena.arriba.desde, escena.arriba.hasta)} />
        <text class="rosa-letra" x={sx(escena.arriba.hasta) + 5} y={sy(escena.arriba.hasta) + 3}>
          arriba
        </text>

        {estadoVista === "vivo" && (
          <g class="rocket" data-cohete>
            {escena.trazos.map((t, i) => (
              <line key={i} class={`tr-${t.clase}`} stroke-width={t.ancho} {...linea(t.a, t.b)} />
            ))}
            {escena.aletas.map((f, i) => (
              <polygon
                // Las aletas son cuatro fijas y en el mismo orden; la clase se repite (dos "tenue").
                key={`${f.clase}-${i}`}
                class={`aleta-${f.clase}`}
                points={f.puntos.map((p) => `${sx(p).toFixed(1)},${sy(p).toFixed(1)}`).join(" ")}
              />
            ))}
            <text
              class="rosa-nariz"
              x={sx(escena.nariz) - 5}
              y={sy(escena.nariz) + 3}
              text-anchor="end"
            >
              nariz
            </text>
            {escena.velocidad !== null && (
              <g data-velocidad>
                <line class="rosa-vel" {...linea(escena.velocidad.desde, escena.velocidad.hasta)} />
                <text class="rosa-vel-texto" x={4} y={13}>
                  v {numero(escena.velocidad.ms, 1)} m/s
                </text>
              </g>
            )}
          </g>
        )}
      </svg>

      {estadoVista === "sin-dato" && (
        <p class="viz-sin-dato">
          <span class="sin-dato-texto">sin dato</span>
        </p>
      )}
      {estadoVista === "no-disponible" && <p class="viz-sin-dato">Orientación aún no disponible</p>}

      <dl class="rosa-angulos" data-angulos>
        <div>
          <dt>Guiñada</dt>
          <dd data-angulo="guinada">{guinada}</dd>
        </div>
        <div>
          <dt>Cabeceo</dt>
          <dd data-angulo="cabeceo">{cabeceo}</dd>
        </div>
        <div>
          <dt>Alabeo</dt>
          <dd data-angulo="alabeo">{alabeo}</dd>
        </div>
      </dl>
      {ang?.cardan === true && (
        <p class="viz-nota">Nariz casi vertical: la guiñada y el alabeo no son fiables.</p>
      )}
      <p class="viz-nota">Marca (−Z) en ámbar, costado derecho (+Y) en celeste; N en rojo.</p>
    </section>
  );
}
