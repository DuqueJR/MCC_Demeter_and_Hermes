#!/usr/bin/env node
// TEST DOUBLE para la prueba de carga SSE (T-643). ¡NO es el relay!
//
// Sirve SOLO las rutas de lectura que usa la prueba de carga, con `node:http` y sin dependencias:
//   GET /api/v1/{mision}/stream     SSE: `id` creciente, `event: estado` y `data: <web-1>`
//   GET /api/v1/{mision}/snapshot   un snapshot mínimo de una sola misión
//   GET /api/v1/salud
//
// Cada mensaje `estado` lleva `relay_utc_ms` = reloj local del stub en el instante de emitirlo,
// a una tasa fija (por defecto 9 msg/s). Así el cliente de carga puede medir la latencia sin el
// relay real: en la misma máquina el reloj es el mismo y no hay sesgo de NTP.
//
// Es un doble de prueba, mínimo y a propósito incompleto frente al contrato `web-1`: NO reproduce
// la ingesta, la persistencia, la bajada a 1 Hz en tierra ni la lógica del relay (eso es T-640, en
// gui/relay/). No vive en gui/relay/ y no es una reimplementación del relay.
import { createServer } from "node:http";
import { parseArgs } from "node:util";

const DEFAULTS = {
  puerto: 8790, // distinto del repetidor (8787) para no chocar
  host: "127.0.0.1",
  mensajesPorSegundo: 9,
  latidoS: 15,
};

const AYUDA = `Test double para la prueba de carga SSE (T-643). ¡NO es el relay!

Sirve snapshot y stream (SSE) de demeter y hermes a una tasa fija, con relay_utc_ms = reloj local.
Solo rutas de lectura (GS-14): no hay ninguna ruta de escritura.

Uso: node gui/web/dev/prueba_carga/stub.mjs [opciones]

Opciones:
  --puerto N                  puerto (por defecto ${DEFAULTS.puerto})
  --host H                    dirección (por defecto ${DEFAULTS.host}; 0.0.0.0 para probar desde otra máquina)
  --mensajes-por-segundo N    tasa del estado en el stream (por defecto ${DEFAULTS.mensajesPorSegundo})
  --latido-s N                cada cuánto va el ": ping" del SSE, en segundos (por defecto ${DEFAULTS.latidoS})
  --help, -h                  esta ayuda
`;

function salir(mensaje) {
  console.error(mensaje);
  console.error();
  console.error(AYUDA);
  process.exit(2);
}

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    puerto: { type: "string" },
    host: { type: "string" },
    "mensajes-por-segundo": { type: "string" },
    "latido-s": { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  console.log(AYUDA);
  process.exit(0);
}

const entero = (nombre, valor, defecto, minimo) => {
  if (valor === undefined) return defecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < minimo) salir(`Valor no válido para --${nombre}: "${valor}".`);
  return n;
};

const puerto = entero("puerto", values.puerto, DEFAULTS.puerto, 0);
if (puerto > 65535) salir(`Puerto no válido: ${values.puerto}.`);
const host = values.host ?? DEFAULTS.host;
const mensajesPorSegundo = entero(
  "mensajes-por-segundo",
  values["mensajes-por-segundo"],
  DEFAULTS.mensajesPorSegundo,
  1,
);
const latidoS = entero("latido-s", values["latido-s"], DEFAULTS.latidoS, 1);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Last-Event-ID, Cache-Control, Accept",
};

const MISIONES = { demeter: 1, hermes: 2 };

function json(res, estado, cuerpo, extra = {}) {
  res.writeHead(estado, {
    ...CORS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extra,
  });
  res.end(JSON.stringify(cuerpo));
}

function formatoSse(evento, data, id) {
  return `${id === undefined ? "" : `id: ${id}\n`}event: ${evento}\ndata: ${data}\n\n`;
}

// ---- estado de cada misión ----
function crearMision(mision, nodo) {
  const estado = {
    id: 0, // contador creciente por misión del que emite el SSE (05 §1)
    seq: 0,
    tMs: 1_200_000,
    clientes: new Set(),
    ultimoEstado: null,
  };

  const sitio = { lat: 6.582, lon: -75.823, alt_msl_m: 510.0 };
  const meta = {
    contrato_version: "web-1",
    mision,
    nodo,
    modo: "sintetico", // test double: nunca "vivo"
    mission_id: null,
    proto_version: 3,
    sitio,
  };

  function mensajeEstado() {
    const ahora = Date.now();
    estado.seq += 1;
    estado.tMs += 100;
    // relay_utc_ms = reloj local del stub (el "relay"); utc_ms/rx_utc_ms simulan el camino
    // cohete → estación → relay con unos milisegundos de adelanto. La latencia que mide el
    // cliente es, entonces, solo el viaje por el socket (más el parseo), sin sesgo de reloj.
    const datos = {
      seq: estado.seq,
      t_ms: estado.tMs,
      utc_ms: ahora - 40,
      rx_utc_ms: ahora - 15,
      relay_utc_ms: ahora,
      fase: "PREFLIGHT",
      fase_cod: 1,
      pos: null,
      vel: null,
      acc_g: { x: 0.997, y: 0.0, z: 0.0 },
      q: { w: 0.70711, x: 0.0, y: -0.70711, z: 0.0 },
      flags: {
        gnss_fix: false,
        ekf_ok: false,
        falla_activa: false,
        eyeccion: false,
        apogeo: false,
        log_activo: true,
        reanudado: false,
      },
      act: { pi_pulso: false, cam_ok: false, buzzer: false, wifi_ap: false, backfill: false },
      bat_pct: 87,
      secundario: { codigo: 0, texto: "Arrancando" },
      calc: {
        dist_horiz_m: null,
        azimut_deg: null,
        elevacion_deg: null,
        elipse: null,
        t_a_apogeo_s: null,
        t_restante_s: null,
        siguiente_fase: "ARMED",
        t_siguiente_fase_s: null,
      },
      enlace: { rssi_dbm: -68, snr_db: 8.5, perdidos_pct_10s: 0.0 },
      alarmas: { descenso_rapido: false },
      lkp: null,
    };
    estado.ultimoEstado = datos;
    return datos;
  }

  function snapshot() {
    return {
      meta,
      estado: estado.ultimoEstado,
      salud: null,
      estacion: null,
      eventos: [],
      serie: {
        t_mas_s: [],
        lat: [],
        lon: [],
        alt_agl_m: [],
        vz_ms: [],
        acc_x_g: [],
        acc_y_g: [],
        acc_z_g: [],
      },
      backfill: null,
      vuelo_completo_url: null,
    };
  }

  function stream(res) {
    res.writeHead(200, {
      ...CORS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    // meta al conectar, sin id (como el repetidor y el relay): no mueve el cursor del cliente.
    res.write(formatoSse("meta", JSON.stringify(meta)));
    estado.clientes.add(res);
    res.on("close", () => estado.clientes.delete(res));
  }

  const intervalo = setInterval(() => {
    const datos = mensajeEstado();
    estado.id += 1;
    const texto = formatoSse("estado", JSON.stringify(datos), estado.id);
    for (const cliente of estado.clientes) cliente.write(texto);
  }, Math.round(1000 / mensajesPorSegundo));

  const latido = setInterval(() => {
    for (const cliente of estado.clientes) cliente.write(": ping\n\n");
  }, latidoS * 1000);

  return { estado, meta, snapshot, stream, cerrar: () => clearInterval(intervalo), cerrarLatido: () => clearInterval(latido) };
}

const misiones = new Map(
  Object.entries(MISIONES).map(([mision, nodo]) => [mision, crearMision(mision, nodo)]),
);

const servidor = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...CORS, "Access-Control-Max-Age": "600" });
    res.end();
    return;
  }
  if (req.method !== "GET") {
    json(res, 405, { error: "solo lectura (GET)" }, { Allow: "GET, OPTIONS" });
    return;
  }
  const partes = new URL(req.url ?? "/", `http://${host}`).pathname.split("/").filter(Boolean);
  if (partes[0] !== "api" || partes[1] !== "v1") {
    json(res, 404, { error: "no existe" });
    return;
  }
  if (partes.length === 3 && partes[2] === "salud") {
    json(res, 200, {
      estado: "ok",
      contrato_version: "web-1",
      test_double: true, // marcado a propósito: no es el relay
      misiones: Object.fromEntries(
        [...misiones].map(([m, x]) => [
          m,
          { ultimo_id: x.estado.id, clientes_sse: x.estado.clientes.size },
        ]),
      ),
    });
    return;
  }
  const [, , mision, recurso] = partes;
  const x = misiones.get(mision);
  if (!x || partes.length !== 4 || (recurso !== "snapshot" && recurso !== "stream")) {
    json(res, 404, { error: "ruta o misión no servida por este stub" });
    return;
  }
  if (recurso === "snapshot") {
    json(res, 200, x.snapshot(), { "Cache-Control": "public, max-age=1" });
    return;
  }
  x.stream(res);
});

servidor.listen(puerto, host, () => {
  console.log("Test double para la prueba de carga SSE (T-643). ¡NO es el relay!");
  console.log(
    `Sirviendo en http://${host}:${puerto}/api/v1/{demeter,hermes}/snapshot | stream · /api/v1/salud`,
  );
  console.log(`Tasa: ${mensajesPorSegundo} mensajes/s · latido: ${latidoS} s · Ctrl+C para salir.`);
});

for (const senal of ["SIGINT", "SIGTERM"]) {
  process.once(senal, () => {
    for (const x of misiones.values()) {
      x.cerrar();
      x.cerrarLatido();
      for (const cliente of x.estado.clientes) cliente.end();
    }
    servidor.close(() => process.exit(0));
  });
}
