#!/usr/bin/env node
// Prueba de carga SSE para la web pública (T-643).
//
// Abre N conexiones SSE contra <url-base>/api/v1/{mision}/stream durante un tiempo dado y
// reporta, en español, la latencia (p50/p95/p99, mínimo y máximo) y el desglose de errores.
// Solo usa módulos built-in de Node (node:http, node:https, node:url, node:util, node:perf_hooks):
// funciona en Windows y macOS, sin dependencias y sin bash.
//
// Mide por cada mensaje del stream: latencia = reloj local al recibir − `relay_utc_ms` del
// mensaje (o `utc_ms` si no hay `relay_utc_ms`). Esto supone relojes sincronizados entre el
// cliente y el relay (NTP); en la misma máquina (el stub) no hay sesgo. Ver el README.md.
//
// GS-14: la prueba de carga SOLO hace GET de lectura (snapshot/stream). Nunca manda comandos
// ni abre rutas de escritura.
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";

const MISIONES = ["demeter", "hermes"];

const DEFAULTS = {
  conexiones: 600,
  duracion: 300,
  mision: "demeter",
  tiempoEspera: 1000, // ms para que responda el servidor al conectar
  reconexionMs: 1000, // ms de espera antes de volver a conectar tras un corte o error
  snapshot: 0, // 0 = no medir el snapshot; S = medirlo cada S segundos
  progreso: 30, // 0 = sin progreso; S = una línea de progreso cada S segundos
};

const AYUDA = `Prueba de carga SSE de la web pública (T-643).

Abre conexiones SSE de SOLO lectura (GS-14) contra <url-base>/api/v1/{mision}/stream durante un
tiempo dado y reporta latencia (p50/p95/p99) y errores. Funciona contra el stub de esta carpeta,
contra el repetidor de desarrollo y contra el relay real cuando exista.

Uso: node gui/web/dev/prueba_carga/main.mjs <url-base> [opciones]

Opciones:
  --conexiones N            conexiones SSE que abrir (por defecto ${DEFAULTS.conexiones})
  --duracion S              duración de la prueba, en segundos (por defecto ${DEFAULTS.duracion} = 5 min)
  --mision <demeter|hermes> misión a probar (por defecto ${DEFAULTS.mision})
  --limite-conexiones N     conexiones abiertas a la vez durante la subida (por defecto: igual que --conexiones)
  --tiempo-espera MS        tiempo límite para conectar, en ms (por defecto ${DEFAULTS.tiempoEspera})
  --reconexion-ms MS        espera antes de reconectar tras un corte o error (por defecto ${DEFAULTS.reconexionMs})
  --snapshot S              además, medir la latencia del snapshot cada S segundos (0 = no; por defecto ${DEFAULTS.snapshot})
  --progreso S              línea de progreso cada S segundos (0 = no; por defecto ${DEFAULTS.progreso})
  --help, -h                esta ayuda

Ejemplo (caso corto contra el stub local):
  node gui/web/dev/prueba_carga/stub.mjs &
  node gui/web/dev/prueba_carga/main.mjs http://127.0.0.1:8790 --conexiones 20 --duracion 10 --mision demeter
`;

function salirUso(mensaje) {
  console.error(mensaje);
  console.error();
  console.error(AYUDA);
  process.exit(2);
}

function parsearArgs(argv) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      conexiones: { type: "string" },
      duracion: { type: "string" },
      mision: { type: "string" },
      "limite-conexiones": { type: "string" },
      "tiempo-espera": { type: "string" },
      "reconexion-ms": { type: "string" },
      snapshot: { type: "string" },
      progreso: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(AYUDA);
    process.exit(0);
  }

  const [urlBase] = positionals;
  if (!urlBase) salirUso("Falta la URL base.");

  const entero = (nombre, valor, defecto, minimo) => {
    if (valor === undefined) return defecto;
    const n = Number(valor);
    if (!Number.isFinite(n) || n < minimo || !Number.isInteger(n)) {
      salirUso(`Valor no válido para --${nombre}: "${valor}" (entero >= ${minimo}).`);
    }
    return n;
  };

  const conexiones = entero("conexiones", values.conexiones, DEFAULTS.conexiones, 1);
  const duracion = entero("duracion", values.duracion, DEFAULTS.duracion, 1);
  const mision = values.mision ?? DEFAULTS.mision;
  if (!MISIONES.includes(mision)) salirUso(`Misión no válida: "${mision}" (demeter o hermes).`);
  const limiteConexiones = entero(
    "limite-conexiones",
    values["limite-conexiones"],
    conexiones,
    1,
  );
  const tiempoEspera = entero("tiempo-espera", values["tiempo-espera"], DEFAULTS.tiempoEspera, 0);
  const reconexionMs = entero("reconexion-ms", values["reconexion-ms"], DEFAULTS.reconexionMs, 0);
  const snapshot = entero("snapshot", values.snapshot, DEFAULTS.snapshot, 0);
  const progreso = entero("progreso", values.progreso, DEFAULTS.progreso, 0);

  return {
    urlBase,
    conexiones,
    duracion,
    mision,
    limiteConexiones,
    tiempoEspera,
    reconexionMs,
    snapshot,
    progreso,
  };
}

/** Percentil por interpolación lineal sobre la lista YA ordenada (método R-7 de numpy). */
function percentil(ordenados, p) {
  const n = ordenados.length;
  if (n === 0) return null;
  const pos = (p / 100) * (n - 1);
  const base = Math.floor(pos);
  const frac = pos - base;
  if (base + 1 < n) return ordenados[base] + (ordenados[base + 1] - ordenados[base]) * frac;
  return ordenados[base];
}

function resumenLatencia(muestras) {
  if (muestras.length === 0) return null;
  const ordenados = [...muestras].sort((a, b) => a - b);
  return {
    n: ordenados.length,
    minimo: ordenados[0],
    p50: percentil(ordenados, 50),
    p95: percentil(ordenados, 95),
    p99: percentil(ordenados, 99),
    maximo: ordenados[ordenados.length - 1],
  };
}

const ms = (x) => (x === null ? "—" : `${x.toFixed(2)} ms`);

async function main() {
  const op = parsearArgs(process.argv.slice(2));

  let base;
  try {
    base = new URL(op.urlBase);
  } catch {
    salirUso(`URL base no válida: "${op.urlBase}"`);
  }
  const mod = base.protocol === "https:" ? https : http;
  const streamUrl = new URL(`/api/v1/${op.mision}/stream`, base);
  const snapshotUrl = new URL(`/api/v1/${op.mision}/snapshot`, base);

  const stats = {
    mensajes: 0,
    muestras: [],
    conexionesFallidas: 0,
    timeouts: 0,
    respuestasNo200: 0,
    cortes: 0,
    reconexiones: 0,
    activas: 0,
    maxActivas: 0,
    establecidas: 0,
    snapshot: { peticiones: 0, exitos: 0, no200: 0, timeouts: 0, errores: 0, muestras: [] },
  };

  const inicio = Date.now();
  const fin = inicio + op.duracion * 1000;
  const abort = new AbortController();

  const erroresTotales = () =>
    stats.conexionesFallidas +
    stats.timeouts +
    stats.respuestasNo200 +
    stats.cortes +
    stats.snapshot.timeouts +
    stats.snapshot.no200 +
    stats.snapshot.errores;

  console.log("Prueba de carga SSE (T-643)");
  console.log(`  URL base: ${base.href}`);
  console.log(`  Misión: ${op.mision} → ${streamUrl.href}`);
  console.log(`  Conexiones: ${op.conexiones} · duración: ${op.duracion} s`);
  if (op.snapshot > 0) console.log(`  Snapshot medido cada ${op.snapshot} s → ${snapshotUrl.href}`);
  console.log();

  // ---- semáforo: limita las conexiones abiertas a la vez durante la subida ----
  function crearSemaforo(maximo) {
    let disponibles = maximo;
    const espera = [];
    return {
      async obtener() {
        if (disponibles <= 0) await new Promise((r) => espera.push(r));
        disponibles--;
      },
      liberar() {
        disponibles++;
        const siguiente = espera.shift();
        if (siguiente) siguiente();
      },
    };
  }
  const semaforo = crearSemaforo(op.limiteConexiones);

  function dormir(milis) {
    return new Promise((resolver) => {
      const t = setTimeout(() => resolver(), milis);
      abort.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          resolver();
        },
        { once: true },
      );
    });
  }

  /** Parse de un bloque SSE (id / event / data) ya separado por "\\n\\n". */
  function procesarEvento(bruto) {
    let data = null;
    for (const linea of bruto.split("\n")) {
      if (linea.startsWith("data:")) {
        const trozo = linea.slice(5).replace(/^ /, "");
        data = data === null ? trozo : `${data}\n${trozo}`;
      }
      // id, event y los comentarios (: ping) no hacen falta para la latencia.
    }
    if (data === null) return;
    stats.mensajes++;
    let datos;
    try {
      datos = JSON.parse(data);
    } catch {
      return; // un evento con `data` que no es JSON no cuenta como mensaje medible
    }
    if (typeof datos !== "object" || datos === null) return;
    const marca =
      typeof datos.relay_utc_ms === "number"
        ? datos.relay_utc_ms
        : typeof datos.utc_ms === "number"
          ? datos.utc_ms
          : null;
    if (marca !== null) stats.muestras.push(Date.now() - marca);
  }

  /** Una conexión SSE: resuelve `false` cuando termina (falla, corte o fin de la prueba). */
  function intentarConectar() {
    return new Promise((resolver) => {
      semaforo.obtener().then(() => {
        if (abort.signal.aborted || Date.now() >= fin) {
          semaforo.liberar();
          resolver(false);
          return;
        }
        let mano = false; // la respuesta ya llegó (el handshake terminó)
        let huboTimeout = false;
        let soltado = false;
        const soltar = () => {
          if (!soltado) {
            soltado = true;
            semaforo.liberar();
          }
        };

        const req = mod.get(
          streamUrl,
          { agent: false, headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" } },
          (res) => {
            mano = true;
            req.setTimeout(0); // el stream es largo: sin límite de inactividad
            soltar();
            if (res.statusCode !== 200) {
              stats.respuestasNo200++;
              res.resume();
              let cerrado = false;
              const terminar = () => {
                if (cerrado) return;
                cerrado = true;
                resolver(false);
              };
              res.on("end", terminar);
              res.on("close", terminar);
              res.on("error", terminar);
              return;
            }
            stats.activas++;
            stats.maxActivas = Math.max(stats.maxActivas, stats.activas);
            stats.establecidas++;
            leerStream(res, resolver);
          },
        );

        req.setTimeout(op.tiempoEspera, () => {
          huboTimeout = true;
          req.destroy(new Error("tiempo de espera al conectar"));
        });
        req.on("error", () => {
          if (mano) return; // el corte lo cuenta leerStream por el socket del stream
          soltar();
          if (abort.signal.aborted) {
            resolver(false);
            return;
          }
          if (huboTimeout) stats.timeouts++;
          else stats.conexionesFallidas++;
          resolver(false);
        });

        const alAbortar = () => req.destroy();
        if (abort.signal.aborted) alAbortar();
        else abort.signal.addEventListener("abort", alAbortar, { once: true });
      });
    });
  }

  function leerStream(res, resolver) {
    let buffer = "";
    let inesperado = false;
    let terminado = false;
    const terminar = () => {
      if (terminado) return;
      terminado = true;
      stats.activas = Math.max(0, stats.activas - 1);
      if (inesperado && !abort.signal.aborted && Date.now() < fin) stats.cortes++;
      resolver(false);
    };
    res.on("data", (chunk) => {
      buffer += chunk.toString("utf8").replace(/\r\n/g, "\n");
      let i;
      while ((i = buffer.indexOf("\n\n")) !== -1) {
        const bruto = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        procesarEvento(bruto);
      }
    });
    res.on("end", () => {
      inesperado = true;
    });
    res.on("error", () => {
      inesperado = true;
    });
    res.on("close", terminar);
  }

  /** Un cliente: mantiene su conexión viva durante la prueba y reconecta si se cae. */
  async function cliente() {
    let esPrimerIntento = true;
    while (!abort.signal.aborted && Date.now() < fin) {
      if (!esPrimerIntento) {
        await dormir(op.reconexionMs);
        if (abort.signal.aborted || Date.now() >= fin) break;
        stats.reconexiones++;
      }
      esPrimerIntento = false;
      await intentarConectar();
    }
  }

  // ---- snapshot opcional ----
  async function medirSnapshot() {
    return new Promise((resolver) => {
      const t0 = performance.now();
      let huboTimeout = false;
      const req = mod.get(
        snapshotUrl,
        { agent: false, headers: { Accept: "application/json", "Cache-Control": "no-cache" } },
        (res) => {
          let cuerpo = "";
          res.on("data", (c) => {
            cuerpo += c;
          });
          res.on("end", () => {
            stats.snapshot.peticiones++;
            if (res.statusCode !== 200) stats.snapshot.no200++;
            else {
              stats.snapshot.exitos++;
              stats.snapshot.muestras.push(performance.now() - t0);
            }
            resolver();
          });
          res.on("error", () => {
            stats.snapshot.peticiones++;
            stats.snapshot.errores++;
            resolver();
          });
        },
      );
      req.setTimeout(op.tiempoEspera, () => {
        huboTimeout = true;
        req.destroy(new Error("tiempo de espera al conectar"));
      });
      req.on("error", () => {
        stats.snapshot.peticiones++;
        if (abort.signal.aborted) resolver();
        else if (huboTimeout) {
          stats.snapshot.timeouts++;
          resolver();
        } else {
          stats.snapshot.errores++;
          resolver();
        }
      });
      const alAbortar = () => req.destroy();
      if (abort.signal.aborted) alAbortar();
      else abort.signal.addEventListener("abort", alAbortar, { once: true });
    });
  }

  async function bucleSnapshot() {
    if (op.snapshot <= 0) return;
    await medirSnapshot();
    while (!abort.signal.aborted && Date.now() < fin) {
      await dormir(op.snapshot * 1000);
      if (abort.signal.aborted || Date.now() >= fin) break;
      await medirSnapshot();
    }
  }

  // ---- progreso periódico ----
  let idProgreso;
  if (op.progreso > 0) {
    idProgreso = setInterval(() => {
      if (abort.signal.aborted) return;
      const t = ((Date.now() - inicio) / 1000).toFixed(1);
      console.log(
        `[progreso] t=${t}s  activas=${stats.activas}  mensajes=${stats.mensajes}  errores=${erroresTotales()}`,
      );
    }, op.progreso * 1000);
  }

  // ---- arranque ----
  const tareas = [];
  for (let i = 0; i < op.conexiones; i++) tareas.push(cliente());
  tareas.push(bucleSnapshot());

  const finPrueba = setTimeout(() => abort.abort(), op.duracion * 1000);
  await Promise.all(tareas);
  clearTimeout(finPrueba);
  if (idProgreso) clearInterval(idProgreso);

  // ---- reporte ----
  const lat = resumenLatencia(stats.muestras);
  const latSnapshot = resumenLatencia(stats.snapshot.muestras);
  const duracionReal = (Date.now() - inicio) / 1000;

  console.log("── Resultados ──────────────────────────────────────────");
  console.log(`Duración real:                 ${duracionReal.toFixed(1)} s`);
  console.log(`Conexiones pedidas:            ${op.conexiones}`);
  console.log(`Conexiones que llegaron a 200: ${stats.establecidas}`);
  console.log(`Pico de conexiones a la vez:   ${stats.maxActivas}`);
  console.log(`Mensajes recibidos (eventos):  ${stats.mensajes}`);
  console.log(`Muestras de latencia:          ${stats.muestras.length}`);
  console.log("── Latencia (reloj local − relay_utc_ms | utc_ms) ───────");
  if (lat) {
    console.log(`  mínimo: ${ms(lat.minimo)}`);
    console.log(`  p50:    ${ms(lat.p50)}`);
    console.log(`  p95:    ${ms(lat.p95)}`);
    console.log(`  p99:    ${ms(lat.p99)}`);
    console.log(`  máximo: ${ms(lat.maximo)}`);
  } else {
    console.log("  (sin muestras)");
  }
  console.log("── Errores ─────────────────────────────────────────────");
  console.log(`  Conexiones fallidas (DNS/rechazada): ${stats.conexionesFallidas}`);
  console.log(`  Timeouts al conectar:                ${stats.timeouts}`);
  console.log(`  Respuestas no 200:                   ${stats.respuestasNo200}`);
  console.log(`  Streams cortados a mitad:            ${stats.cortes}`);
  console.log(`  Reconexiones:                        ${stats.reconexiones}`);
  if (op.snapshot > 0) {
    console.log("── Snapshot ────────────────────────────────────────────");
    console.log(`  Peticiones: ${stats.snapshot.peticiones}`);
    console.log(`  Éxitos:     ${stats.snapshot.exitos}`);
    console.log(`  No 200:     ${stats.snapshot.no200}`);
    console.log(`  Timeouts:   ${stats.snapshot.timeouts}`);
    console.log(`  Errores:    ${stats.snapshot.errores}`);
    if (latSnapshot) {
      console.log(
        `  Latencia:   mín ${ms(latSnapshot.minimo)} · p50 ${ms(latSnapshot.p50)} · p95 ${ms(latSnapshot.p95)} · p99 ${ms(latSnapshot.p99)} · máx ${ms(latSnapshot.maximo)}`,
      );
    }
  }
  console.log("────────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
