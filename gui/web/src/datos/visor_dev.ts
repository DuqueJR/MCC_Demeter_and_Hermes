// SOLO DESARROLLO: el visor en vivo de `dev/en_vivo.html` (T-631). Arranca el cliente de datos contra
// el API (el repetidor de T-630 por el proxy de Vite, o el servicio local) y muestra las signals de
// `api.ts` y la interpolación, sin ninguna sección de la página. Ningún archivo de producción lo
// importa, así que no entra al `dist/`.
//   /dev/en_vivo.html?mision=demeter   (o hermes)
import { effect } from "@preact/signals";
import type { Mision } from "../contrato/tipos";
import * as api from "./api";
import { iniciarCliente } from "./cliente";
import { interpolador } from "./interpolacion";

const REFRESCO_INTERPOLACION_MS = 100;
const DECIMALES_POSICION = 7;
const DECIMALES_ALTURA = 1;

const parametros = new URLSearchParams(location.search);
const mision: Mision = parametros.get("mision") === "hermes" ? "hermes" : "demeter";
document.documentElement.dataset.mision = mision;

function poner(id: string, texto: string): void {
  const el = document.getElementById(id);
  if (el && el.textContent !== texto) el.textContent = texto;
}

poner("mision", mision);

effect(() => poner("conexion", api.conexion.value));
effect(() => poner("principal", api.estadoPagina.value.principal));
effect(() => {
  const p = api.estadoPagina.value;
  poner(
    "avisos",
    [
      p.simulacion && "simulacion",
      p.aterrizado && "aterrizado",
      p.reconstruyendo && "reconstruyendo",
      p.alarma_descenso && "alarma_descenso",
    ]
      .filter(Boolean)
      .join(" "),
  );
});
effect(() => poner("edad", String(api.edad.value)));
effect(() => poner("fase", api.estado.value?.fase ?? "-"));
effect(() => poner("t_ms", String(api.estado.value?.t_ms ?? "-")));
effect(() => poner("alt", String(api.estado.value?.pos?.alt_agl_m ?? "-")));
effect(() => poner("eventos", api.eventos.value.map((e) => e.tipo).join(",")));
effect(() => poner("serie_n", String(api.serie.value.t_mas_s.length)));
effect(() => {
  const b = api.backfill.value;
  poner(
    "backfill",
    b === null ? "-" : `${b.recibidos}/${b.esperados}${b.completo ? " completo" : ""}`,
  );
});

const cliente = iniciarCliente({ mision });

// La interpolación, a la cadencia con la que la dibujaría la UI.
setInterval(() => {
  const m = interpolador.muestrear(performance.now());
  poner(
    "interp",
    m === null
      ? "-"
      : `${m.lat?.toFixed(DECIMALES_POSICION)} ${m.lon?.toFixed(DECIMALES_POSICION)} ${m.alt_agl_m?.toFixed(DECIMALES_ALTURA)}`,
  );
  poner("stats", JSON.stringify(cliente.estadisticas()));
}, REFRESCO_INTERPOLACION_MS);
