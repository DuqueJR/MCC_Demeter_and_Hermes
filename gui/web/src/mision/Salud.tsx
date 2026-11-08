// Sección "Salud del cohete" (03 §3.8, Objetivos 7.C, T-625; simplificada en T-658): una sola fila de
// estado general ("Sin fallas reportadas" o "Falla: ..."), el chip maestro Go/No-Go (solo en PREFLIGHT y
// ARMED) y el detalle desplegable (navegación, enlace, batería, SD y temperatura de la placa). Sin
// modelos de chip, sin lista de sensores y sin calibraciones. Consume SOLO las signals de lectura de
// `datos/api.ts`; la lógica está en `vista_salud.ts`.
// El estado nunca va solo en color (02 §4): cada uno lleva ícono y palabra.
import { computed } from "@preact/signals";
import { CircleCheck, Hourglass, Info, OctagonX, TriangleAlert } from "lucide-preact";
import type { ComponentChildren } from "preact";
import type { Mision } from "../contrato/tipos";
import { edad, estado, meta, salud } from "../datos/api";
import "./recuperacion_salud.css";
import { type EstadoGoNogo, type NivelSalud, vistaSalud } from "./vista_salud";
import { datoViejo, textoONulo } from "./vista_telemetria";

const MS_POR_S = 1000;
const DECIMALES_VOLTIOS = 2;
const DECIMALES_INNOVACION = 2;
const DECIMALES_RSSI = 0;
const DECIMALES_SNR = 1;
const DECIMALES_PORCENTAJE = 1;
const DECIMALES_HACC = 1;

/** Si el dato es viejo, y su antigüedad en segundos enteros: se repinta una vez por segundo, no por tic. */
const viejo = computed(() => datoViejo(edad.value));
const edadS = computed(() => (edad.value === null ? null : Math.floor(edad.value / MS_POR_S)));

const ICONO_NIVEL: Record<NivelSalud, ComponentChildren> = {
  sin_dato: <Info aria-hidden="true" />,
  ok: <CircleCheck aria-hidden="true" />,
  falla: <OctagonX aria-hidden="true" />,
};

/** El chip maestro: el estado nunca va solo en color, lleva ícono y palabra. */
const ICONO_GO: Record<EstadoGoNogo, ComponentChildren> = {
  esperando: <Hourglass aria-hidden="true" />,
  go: <CircleCheck aria-hidden="true" />,
  nogo: <OctagonX aria-hidden="true" />,
};
const CLASE_GO: Record<EstadoGoNogo, string> = {
  esperando: "chip-go-espera",
  go: "chip-go-si",
  nogo: "chip-go-no",
};

function textoGo(go: { estado: EstadoGoNogo; faltan: number; armado: boolean }): string {
  if (go.estado === "esperando") return "Esperando armado";
  if (go.estado === "go") return go.armado ? "GO · Cohete armado" : "GO · Listo para armar";
  return `NO-GO · ${go.faltan === 1 ? "falta 1 condición" : `faltan ${go.faltan} condiciones`}`;
}

const SinDato = () => <span class="sin-dato-texto">sin dato</span>;

/** Un valor con su unidad, o "sin dato". */
function Medida({
  valor,
  decimales,
  unidad,
}: {
  valor: number | null;
  decimales: number;
  unidad: string;
}) {
  if (valor === null) return <SinDato />;
  return (
    <>
      <span class="num">{textoONulo(valor, decimales)}</span>
      <span class="unidad"> {unidad}</span>
    </>
  );
}

function Fila({
  nombre,
  dato,
  children,
}: {
  nombre: string;
  dato?: string;
  children: ComponentChildren;
}) {
  return (
    <div class="salud-fila" data-fila={dato}>
      <dt>{nombre}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function Salud({ mision }: { mision: Mision }) {
  const esViejo = viejo.value;
  const edadMs = edadS.value === null ? null : edadS.value * MS_POR_S;
  const v = vistaSalud(salud.value, estado.value, meta.value?.mision ?? mision, edadMs, esViejo);

  return (
    <section
      id="salud"
      class="seccion salud"
      aria-labelledby="salud-titulo"
      data-nivel={v.nivel}
      data-viejo={esViejo ? "si" : "no"}
    >
      <h2 id="salud-titulo">Salud del cohete</h2>

      {v.nivel === "sin_dato" ? (
        <p class="salud-resumen" data-nivel="sin_dato" data-salud="resumen">
          {ICONO_NIVEL.sin_dato}
          <span>
            {v.resumen}. El cohete envía su estado de salud una vez por segundo cuando transmite.
          </span>
        </p>
      ) : (
        <>
          <p class="salud-resumen" data-nivel={v.nivel} data-salud="resumen" aria-live="polite">
            {ICONO_NIVEL[v.nivel]}
            <span>{v.resumen}</span>
          </p>

          {v.causas.length > 1 && (
            <ul class="salud-causas" data-salud="fallas">
              {v.causas.map((c) => (
                <li key={c} class="salud-falla">
                  <OctagonX aria-hidden="true" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}

          {v.goNogo !== null && (
            <div class="salud-go" data-go={v.goNogo.estado} data-salud="go-nogo">
              <p class={`chip-go ${CLASE_GO[v.goNogo.estado]}`}>
                {ICONO_GO[v.goNogo.estado]}
                <span>{textoGo(v.goNogo)}</span>
              </p>
              {v.goNogo.estado === "esperando" && (
                <p class="salud-go-nota">
                  El cohete confirma el Go cuando responde al armado. Estas son las condiciones que
                  ya se ven.
                </p>
              )}
              {v.goNogo.condiciones.length > 0 && (
                <ul class="salud-condiciones">
                  {v.goNogo.condiciones.map((c) => (
                    <li key={c.id} data-condicion={c.id} data-ok={c.ok ? "si" : "no"}>
                      {c.ok ? (
                        <CircleCheck class="salud-ok" aria-hidden="true" />
                      ) : (
                        <OctagonX class="salud-falla" aria-hidden="true" />
                      )}
                      <span>{c.nombre}</span>
                      <span class="solo-lector">{c.ok ? ": cumple" : ": no cumple"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <details class="salud-detalle" data-salud="detalle">
            <summary>Ver el detalle</summary>

            <h3 class="subtitulo">Navegación</h3>
            <dl class="salud-lista">
              <Fila nombre="EKF" dato="ekf">
                {v.navegacion.ekfListo === null ? (
                  <SinDato />
                ) : (
                  <span
                    class={`salud-estado ${v.navegacion.ekfListo ? "salud-ok" : "salud-aviso"}`}
                  >
                    {v.navegacion.ekfListo ? (
                      <CircleCheck aria-hidden="true" />
                    ) : (
                      <TriangleAlert aria-hidden="true" />
                    )}
                    <span>{v.navegacion.ekfListo ? "Listo" : "No está listo"}</span>
                  </span>
                )}
              </Fila>
              <Fila nombre="Innovación" dato="innovacion">
                <Medida
                  valor={v.navegacion.innovacionM}
                  decimales={DECIMALES_INNOVACION}
                  unidad="m"
                />
              </Fila>
            </dl>

            <h3 class="subtitulo">Enlace</h3>
            <dl class="salud-lista">
              <Fila nombre="RSSI en la estación" dato="rssi">
                <Medida valor={v.enlace.rssiDbm} decimales={DECIMALES_RSSI} unidad="dBm" />
              </Fila>
              <Fila nombre="SNR" dato="snr">
                <Medida valor={v.enlace.snrDb} decimales={DECIMALES_SNR} unidad="dB" />
              </Fila>
              <Fila nombre="Paquetes perdidos (10 s)" dato="perdidos">
                <Medida valor={v.enlace.perdidosPct} decimales={DECIMALES_PORCENTAJE} unidad="%" />
              </Fila>
              <Fila nombre="RSSI en el cohete" dato="rssi-cohete">
                <Medida valor={v.enlace.rssiCohetePDbm} decimales={DECIMALES_RSSI} unidad="dBm" />
              </Fila>
              <Fila nombre="Satélites" dato="satelites">
                <span class="num">{v.enlace.satelites}</span>
                <span class="unidad">
                  {" "}
                  {v.enlace.fix === 3 ? "(fix 3D)" : v.enlace.fix === 2 ? "(fix 2D)" : "(sin fix)"}
                </span>
              </Fila>
              <Fila nombre="Precisión horizontal" dato="hacc">
                <Medida valor={v.enlace.haccM} decimales={DECIMALES_HACC} unidad="m" />
              </Fila>
            </dl>

            <h3 class="subtitulo">Batería</h3>
            <dl class="salud-lista">
              <Fila nombre="Carga" dato="bateria-pct">
                <Medida valor={v.bateria.pct} decimales={0} unidad="%" />
              </Fila>
              <Fila nombre="Voltaje" dato="bateria-v">
                <Medida valor={v.bateria.voltios} decimales={DECIMALES_VOLTIOS} unidad="V" />
              </Fila>
            </dl>

            <h3 class="subtitulo">Tarjeta SD</h3>
            <dl class="salud-lista">
              <Fila nombre="Espacio libre" dato="sd">
                <Medida valor={v.sdLibreMb} decimales={0} unidad="MB" />
              </Fila>
            </dl>

            <h3 class="subtitulo">Temperatura</h3>
            <dl class="salud-lista">
              <Fila nombre="Placa de vuelo" dato="temp-placa">
                <Medida valor={v.temperatura.placaC} decimales={0} unidad="°C" />
              </Fila>
            </dl>
          </details>
        </>
      )}
    </section>
  );
}
