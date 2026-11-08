// Sección de la Raspberry Pi (solo Deméter; T-659, D-065): el estado de su misión, el motivo de la falla si
// llega, la cámara, la batería y la temperatura. Hermes no tiene Pi: esta sección solo se monta en la
// entrada de Deméter. Consume SOLO las signals de lectura de `datos/api.ts`; la lógica está en `vista_pi.ts`.
// El estado nunca va solo en color (02 §4): cada uno lleva ícono y palabra. La batería y la temperatura de
// la Pi hoy llegan en `null` (la UART no las trae): se muestran como "sin dato", sin que parezca una falla.
import { computed } from "@preact/signals";
import {
  Camera,
  CircleCheck,
  CircleDashed,
  Cpu,
  Info,
  LoaderCircle,
  OctagonX,
  Radio,
  TriangleAlert,
  Video,
} from "lucide-preact";
import type { ComponentChildren } from "preact";
import { edad, estado, salud } from "../datos/api";
import "./pi.css";
import "./recuperacion_salud.css";
import { type CamaraPi, type NivelPi, vistaPi } from "./vista_pi";
import { datoViejo, textoONulo } from "./vista_telemetria";

const MS_POR_S = 1000;

/** Si el dato es viejo, y su antigüedad en segundos enteros: se repinta una vez por segundo, no por tic. */
const viejo = computed(() => datoViejo(edad.value));
const edadS = computed(() => (edad.value === null ? null : Math.floor(edad.value / MS_POR_S)));

const ICONO_NIVEL: Record<NivelPi, ComponentChildren> = {
  sin_dato: <Info aria-hidden="true" />,
  espera: <CircleDashed aria-hidden="true" />,
  activo: <Video aria-hidden="true" />,
  procesando: <LoaderCircle aria-hidden="true" />,
  completo: <CircleCheck aria-hidden="true" />,
  falla: <OctagonX aria-hidden="true" />,
};

const TEXTO_CAMARA: Record<CamaraPi, string> = {
  sin_dato: "sin dato",
  grabando: "Grabando",
  lista: "Lista",
  no_lista: "Aún no está lista",
  terminada: "Grabación terminada",
  falla: "No disponible",
};

const TEXTO_AVANCE = { hecho: ": hecho", actual: ": en curso", pendiente: ": pendiente" } as const;

const SinDato = () => <span class="sin-dato-texto">sin dato</span>;

function Camara({ camara }: { camara: CamaraPi }) {
  if (camara === "sin_dato") return <SinDato />;
  const clase =
    camara === "falla"
      ? "salud-falla"
      : camara === "grabando" || camara === "lista"
        ? "salud-ok"
        : "pi-neutro";
  return (
    <span class={`salud-estado ${clase}`} data-camara={camara}>
      {camara === "falla" ? <TriangleAlert aria-hidden="true" /> : <Camera aria-hidden="true" />}
      <span>{TEXTO_CAMARA[camara]}</span>
    </span>
  );
}

function Fila({
  nombre,
  dato,
  children,
}: {
  nombre: string;
  dato: string;
  children: ComponentChildren;
}) {
  return (
    <div class="salud-fila" data-fila={dato}>
      <dt>{nombre}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Una medida con su unidad, o "sin dato" (discreto: no es una falla). */
function Medida({ valor, unidad }: { valor: number | null; unidad: string }) {
  if (valor === null) return <SinDato />;
  return (
    <>
      <span class="num">{textoONulo(valor, 0)}</span>
      <span class="unidad"> {unidad}</span>
    </>
  );
}

export function SeccionPi() {
  const esViejo = viejo.value;
  const edadMs = edadS.value === null ? null : edadS.value * MS_POR_S;
  const v = vistaPi(salud.value, estado.value, edadMs, esViejo);

  return (
    <section
      id="pi"
      class="seccion pi"
      aria-labelledby="pi-titulo"
      data-nivel={v.nivel}
      data-viejo={esViejo && v.hayDato ? "si" : "no"}
    >
      <h2 id="pi-titulo">La Raspberry Pi</h2>

      <div class="pi-cuerpo">
        <div class="pi-columna" data-pi="columna-estado">
          <p
            class="pi-estado"
            data-nivel={v.nivel}
            data-pi={v.hayDato ? "estado" : "vacio"}
            aria-live="polite"
          >
            {ICONO_NIVEL[v.nivel]}
            <span class="pi-estado-texto">
              <span class="pi-estado-titulo">{v.titulo}</span>
              <span class="pi-estado-detalle">{v.detalle}</span>
            </span>
          </p>

          {v.motivo !== null && (
            <p
              class={`pi-motivo ${v.motivo.vigente ? "salud-falla" : "salud-aviso"}`}
              data-pi="motivo"
              data-vigente={v.motivo.vigente ? "si" : "no"}
            >
              <TriangleAlert aria-hidden="true" />
              <span>
                <span class="pi-motivo-rotulo">{v.motivo.vigente ? "Motivo" : "Último aviso"}</span>
                {": "}
                {v.motivo.texto}
              </span>
            </p>
          )}

          {v.hayDato && esViejo && (
            <p class="pi-nota" data-pi="viejo">
              <Radio aria-hidden="true" />
              <span>
                Sin datos recientes del cohete
                {v.edadS === null ? "" : ` (último hace ${v.edadS} s)`}: la Pi puede estar en otro
                estado.
              </span>
            </p>
          )}
        </div>

        {v.hayDato && (
          <div class="pi-columna">
            {v.pasos !== null && (
              <ol class="pi-pasos" aria-label="Avance de la misión de la Pi" data-pi="pasos">
                {v.pasos.map((p) => (
                  <li key={p.id} class="pi-paso" data-avance={p.avance}>
                    <span class="pi-paso-marca" aria-hidden="true" />
                    <span class="pi-paso-nombre">{p.nombre}</span>
                    <span class="solo-lector">{TEXTO_AVANCE[p.avance]}</span>
                  </li>
                ))}
              </ol>
            )}

            <h3 class="subtitulo pi-subtitulo">
              <Cpu aria-hidden="true" />
              Equipo
            </h3>
            <dl class="salud-lista">
              <Fila nombre="Cámara" dato="pi-camara">
                <Camara camara={v.camara} />
              </Fila>
              <Fila nombre="Batería" dato="pi-bateria">
                <Medida valor={v.bateriaPct} unidad="%" />
              </Fila>
              <Fila nombre="Temperatura" dato="pi-temperatura">
                <Medida valor={v.temperaturaC} unidad="°C" />
              </Fila>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
