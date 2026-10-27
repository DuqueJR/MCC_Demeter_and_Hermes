// Sección "Recuperación" (03 §3.5, Objetivos 7.G, T-625): las coordenadas a donde ir, el botón de
// Google Maps, el QR y el vector desde la estación. Consume SOLO las signals de lectura de
// `datos/api.ts`; la lógica está en `vista_recuperacion.ts`.
// Los datos que faltan se dicen con una frase: nunca un botón muerto ni un QR de `null,null`.
import { computed } from "@preact/signals";
import { Check, Copy, ExternalLink, MapPin, QrCode, Target, TriangleAlert } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { edad, estado, estadoPagina } from "../datos/api";
import { copiarTexto, type ResultadoCopia } from "./copiar";
import { hace, numero } from "./formato";
import { Qr } from "./Qr";
import "./recuperacion_salud.css";
import {
  DECIMALES_AZIMUT,
  DECIMALES_DISTANCIA,
  type OrigenPunto,
  type PuntoCardinal,
  type PuntoRecuperacion,
  vistaRecuperacion,
} from "./vista_recuperacion";

/** Cuánto se queda el aviso "copiado" visible. */
const AVISO_COPIA_MS = 2500;
const MS_POR_S = 1000;

/** Solo cambia cuando cambia el estado principal: no repinta con cada tic del reloj. */
const principal = computed(() => estadoPagina.value.principal);
/** La edad del dato en segundos enteros: se repinta una vez por segundo, no por tic. */
const edadS = computed(() => (edad.value === null ? null : Math.floor(edad.value / MS_POR_S)));

/** El nombre de cada punto cardinal, para quien usa lector de pantalla. */
const NOMBRE_CARDINAL: Record<PuntoCardinal, string> = {
  N: "norte",
  NE: "noreste",
  E: "este",
  SE: "sureste",
  S: "sur",
  SO: "suroeste",
  O: "oeste",
  NO: "noroeste",
};

function Rotulo({ punto }: { punto: PuntoRecuperacion }) {
  const textos: Record<OrigenPunto, string> = {
    estimado: "Punto de impacto",
    real: "Posición del cohete en tierra",
    lkp: "Última posición conocida",
    actual: "Posición actual del cohete",
  };
  return (
    <p class="recup-rotulo" data-origen={punto.origen}>
      {punto.origen === "estimado" ? <Target aria-hidden="true" /> : <MapPin aria-hidden="true" />}
      <span>{textos[punto.origen]}</span>
      {punto.origen === "estimado" && <span class="recup-chip">estimado</span>}
      {punto.origen === "actual" && <span class="recup-chip">aún sin estimado de impacto</span>}
      {punto.origen === "lkp" && punto.edadMs !== null && (
        <span class="recup-edad">{hace(punto.edadMs)}</span>
      )}
    </p>
  );
}

/** La flecha de brújula: FIJA con el norte arriba (no usa la orientación del dispositivo). */
function Brujula({
  azimutDeg,
  cardinal,
}: {
  azimutDeg: number | null;
  cardinal: PuntoCardinal | null;
}) {
  const etiqueta =
    azimutDeg === null || cardinal === null
      ? "Brújula sin dato"
      : `Brújula con el norte arriba: el cohete está hacia el ${NOMBRE_CARDINAL[cardinal]}, a ${numero(azimutDeg, DECIMALES_AZIMUT)} grados`;
  return (
    <svg class="brujula" viewBox="0 0 100 100" role="img" aria-label={etiqueta} data-brujula>
      <circle class="brujula-aro" cx="50" cy="50" r="46" />
      <text class="brujula-norte" x="50" y="19" text-anchor="middle">
        N
      </text>
      <text class="brujula-punto" x="50" y="94" text-anchor="middle">
        S
      </text>
      <text class="brujula-punto" x="9" y="55" text-anchor="middle">
        O
      </text>
      <text class="brujula-punto" x="91" y="55" text-anchor="middle">
        E
      </text>
      {azimutDeg !== null && (
        <g transform={`rotate(${azimutDeg} 50 50)`} data-azimut={azimutDeg}>
          <polygon class="brujula-flecha" points="50,24 60,56 50,49 40,56" />
        </g>
      )}
    </svg>
  );
}

export function Recuperacion() {
  const v = vistaRecuperacion(
    estado.value,
    principal.value,
    edadS.value === null ? null : edadS.value * MS_POR_S,
  );
  const [copia, setCopia] = useState<ResultadoCopia | null>(null);
  const [qrAbierto, setQrAbierto] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current);
    },
    [],
  );

  async function copiar() {
    if (v.textoCopia === null) return;
    const resultado = await copiarTexto(v.textoCopia);
    setCopia(resultado);
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    // El aviso de falla se queda: hay que leer cómo copiar a mano. El de "copiado" se va solo.
    if (resultado === "copiado")
      temporizador.current = setTimeout(() => setCopia(null), AVISO_COPIA_MS);
  }

  const { vector } = v;
  const conMapa = v.punto !== null && v.urlMaps !== null;

  return (
    <section
      id="recuperacion"
      class="seccion recuperacion"
      aria-labelledby="recuperacion-titulo"
      data-aterrizado={v.aterrizado ? "si" : "no"}
      data-origen={v.punto?.origen ?? "ninguno"}
    >
      <h2 id="recuperacion-titulo">Recuperación</h2>

      {v.punto === null || !conMapa ? (
        <p class="recup-vacio" data-recup="vacio">
          <TriangleAlert aria-hidden="true" />
          <span>{v.sinPunto ?? "No hay una posición válida del cohete."}</span>
        </p>
      ) : (
        <div class="recup-cuerpo">
          <div class="recup-coords" data-recup="coordenadas">
            <Rotulo punto={v.punto} />
            <dl class="recup-datos">
              <div>
                <dt>Latitud</dt>
                <dd data-coord="lat">{v.lat}°</dd>
              </div>
              <div>
                <dt>Longitud</dt>
                <dd data-coord="lon">{v.lon}°</dd>
              </div>
            </dl>
            <button type="button" class="boton boton-copiar" onClick={copiar}>
              {copia === "copiado" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              <span>{copia === "copiado" ? "Copiado" : "Copiar"}</span>
            </button>
            <p class="recup-aviso" role="status" aria-live="polite" data-copia={copia ?? "nada"}>
              {copia === "copiado" && "Coordenadas copiadas al portapapeles."}
              {copia === "fallo" &&
                "No se pudo copiar solo. Toca las coordenadas para seleccionarlas y cópialas a mano."}
            </p>
          </div>

          <div class="recup-mapa">
            <a
              class="boton boton-principal"
              href={v.urlMaps ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              data-recup="maps"
            >
              <ExternalLink aria-hidden="true" />
              <span>Abrir en Google Maps</span>
            </a>
            <button
              type="button"
              class="boton boton-qr"
              aria-expanded={qrAbierto}
              aria-controls="recuperacion-qr"
              onClick={() => setQrAbierto(!qrAbierto)}
            >
              <QrCode aria-hidden="true" />
              <span>{qrAbierto ? "Ocultar el QR" : "Mostrar el QR"}</span>
            </button>
            <div id="recuperacion-qr" class="recup-qr" data-abierto={qrAbierto ? "si" : "no"}>
              <Qr texto={v.urlMaps ?? ""} descripcion="Código QR con la ubicación en Google Maps" />
              <p class="recup-qr-nota">Escanéalo desde otro teléfono.</p>
            </div>
          </div>
        </div>
      )}

      <div class="recup-vector" data-recup="vector">
        <h3 class="subtitulo">Desde la estación</h3>
        <div class="recup-vector-cuerpo">
          <Brujula azimutDeg={vector.azimutDeg} cardinal={vector.cardinal} />
          <dl class="recup-datos recup-datos-vector">
            <div>
              <dt>Distancia</dt>
              <dd data-vector="distancia">
                {vector.distanciaM === null ? (
                  <span class="sin-dato-texto">sin dato</span>
                ) : (
                  <>
                    <span class="num">{numero(vector.distanciaM, DECIMALES_DISTANCIA)}</span>
                    <span class="unidad"> m</span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Azimut</dt>
              <dd data-vector="azimut">
                {vector.azimutDeg === null || vector.cardinal === null ? (
                  <span class="sin-dato-texto">sin dato</span>
                ) : (
                  <>
                    <span class="num">{numero(vector.azimutDeg, DECIMALES_AZIMUT)}°</span>
                    <span class="unidad"> {vector.cardinal}</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>
        {v.punto?.origen === "estimado" && (
          <p class="recup-nota">
            Distancia y rumbo al cohete en este momento, no al punto estimado de impacto.
          </p>
        )}
      </div>
    </section>
  );
}
