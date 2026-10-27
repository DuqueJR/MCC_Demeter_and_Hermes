// Sección "Salud del cohete" (03 §3.8, Objetivos 7.C, T-625): el resumen siempre visible, el chip
// maestro Go/No-Go (solo en PREFLIGHT y ARMED) y el detalle desplegable. Consume SOLO las signals de
// lectura de `datos/api.ts`; la lógica está en `vista_salud.ts`.
// El estado nunca va solo en color (02 §4): cada uno lleva ícono y palabra.
import { computed } from "@preact/signals";
import { CircleCheck, Info, OctagonX, TriangleAlert } from "lucide-preact";
import type { ComponentChildren } from "preact";
import type { Mision } from "../contrato/tipos";
import { edad, estado, meta, salud } from "../datos/api";
import { hace } from "./formato";
import "./recuperacion_salud.css";
import { type FilaBit, type NivelSalud, vistaSalud } from "./vista_salud";
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
  aviso: <TriangleAlert aria-hidden="true" />,
  falla: <OctagonX aria-hidden="true" />,
};

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

/** Una fila de bit de `fallas`: con ícono y palabra, nunca solo color. */
function FilaDeBit({ fila }: { fila: FilaBit }) {
  return (
    <Fila nombre={fila.nombre} dato={`bit-${fila.nombre}`}>
      <span
        class={`salud-estado ${fila.falla ? "salud-falla" : "salud-ok"}`}
        data-falla={fila.falla ? "si" : "no"}
      >
        {fila.falla ? <OctagonX aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
        <span>{fila.falla ? "En falla" : "Sin falla"}</span>
      </span>
    </Fila>
  );
}

export function Salud({ mision }: { mision: Mision }) {
  const v = vistaSalud(salud.value, estado.value, meta.value?.mision ?? mision);
  const esViejo = viejo.value;

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

          {esViejo && edadS.value !== null && (
            <p class="salud-edad">
              <TriangleAlert aria-hidden="true" />
              <span>Último dato {hace(edadS.value * MS_POR_S)}: puede haber cambiado.</span>
            </p>
          )}

          {v.fallas.length > 0 && (
            <ul class="salud-causas" data-salud="fallas">
              {v.fallas.map((f) => (
                <li key={f} class="salud-falla">
                  <OctagonX aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
          {v.avisos.length > 0 && (
            <ul class="salud-causas" data-salud="avisos">
              {v.avisos.map((a) => (
                <li key={a.id} class="salud-aviso" data-aviso={a.id}>
                  <TriangleAlert aria-hidden="true" />
                  <span>{a.texto}</span>
                </li>
              ))}
            </ul>
          )}

          {v.goNogo !== null && (
            <div class="salud-go" data-go={v.goNogo.listo ? "si" : "no"} data-salud="go-nogo">
              <p class={`chip-go ${v.goNogo.listo ? "chip-go-si" : "chip-go-no"}`}>
                {v.goNogo.listo ? (
                  <CircleCheck aria-hidden="true" />
                ) : (
                  <OctagonX aria-hidden="true" />
                )}
                <span>
                  {v.goNogo.listo
                    ? "GO · Listo para armar"
                    : `NO-GO · ${v.goNogo.faltan === 1 ? "falta 1 condición" : `faltan ${v.goNogo.faltan} condiciones`}`}
                </span>
              </p>
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
            </div>
          )}

          <details class="salud-detalle" data-salud="detalle">
            <summary>Ver el detalle</summary>

            <h3 class="subtitulo">Sensores</h3>
            <dl class="salud-lista">
              {v.sensores.map((f) => (
                <FilaDeBit key={f.nombre} fila={f} />
              ))}
            </dl>

            <h3 class="subtitulo">Sistemas</h3>
            <dl class="salud-lista">
              {v.sistemas.map((f) => (
                <FilaDeBit key={f.nombre} fila={f} />
              ))}
            </dl>

            <h3 class="subtitulo">Calibraciones</h3>
            <dl class="salud-lista">
              {v.calibraciones.map((c) => (
                <Fila key={c.id} nombre={c.nombre} dato={`calib-${c.id}`}>
                  <span
                    class={`salud-estado ${c.completa ? "salud-ok" : "salud-aviso"}`}
                    data-completa={c.completa ? "si" : "no"}
                  >
                    {c.completa ? (
                      <CircleCheck aria-hidden="true" />
                    ) : (
                      <TriangleAlert aria-hidden="true" />
                    )}
                    <span>{c.completa ? "Completa" : "En proceso"}</span>
                  </span>
                </Fila>
              ))}
            </dl>

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
              <Fila nombre="Placa (ESP32)" dato="temp-esp">
                <Medida valor={v.temperatura.espC} decimales={0} unidad="°C" />
              </Fila>
              {v.temperatura.mostrarPi && (
                <Fila nombre="Raspberry Pi" dato="temp-pi">
                  <Medida valor={v.temperatura.piC} decimales={0} unidad="°C" />
                </Fila>
              )}
            </dl>
          </details>
        </>
      )}
    </section>
  );
}
