// El repetidor: un servidor HTTP con las MISMAS rutas de lectura del relay (04 §4, §7) y nada más.
//   GET /api/v1/{mision}/snapshot   el estado hasta ahora (05 §3)
//   GET /api/v1/{mision}/stream     SSE (05 §1): id, event y data; reanuda con Last-Event-ID
//   GET /api/v1/salud
// No hay ninguna ruta de escritura (GS-14): cualquier otro método responde 405.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { performance } from "node:perf_hooks";
import type { Mision } from "../../src/contrato/tipos.ts";
import {
  REANUDAR_MAX_MENSAJES,
  REINTENTO_503_S,
  WEB_SERIE_MAX_PUNTOS,
  WEB_SSE_LATIDO_S,
} from "./constantes.ts";
import { leerJsonl } from "./jsonl.ts";
import { type Emision, type MensajeConId, Reproductor } from "./reproductor.ts";

export interface OpcionesRepetidor {
  /** Ruta del JSONL de cada misión que se sirve. Una misión ausente responde 404. */
  archivos: Partial<Record<Mision, { escenario: string; ruta: string }>>;
  /** Factor del tiempo: 2 reproduce al doble de la velocidad real. Por defecto 1. */
  velocidad?: number;
  /** Cada cuánto va el `: ping` del SSE (ms). Por defecto `WEB_SSE_LATIDO_S`. */
  latidoMs?: number;
  /** Máximo de puntos de la `serie`. Por defecto `WEB_SERIE_MAX_PUNTOS`. */
  serieMax?: number;
  /** Reloj monotónico en ms. Las pruebas pasan uno propio y llaman a `avanzar()`. */
  reloj?: () => number;
  /** `false` en las pruebas con reloj propio: nadie avanza el tiempo salvo `avanzar()`. */
  temporizador?: boolean;
}

export interface Repetidor {
  servidor: Server;
  reproductores: Map<Mision, Reproductor>;
  /** Emite todo lo vencido a la hora del reloj. Lo llaman el temporizador y cada petición. */
  avanzar(): void;
  escuchar(puerto: number, host: string): Promise<number>;
  cerrar(): Promise<void>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Last-Event-ID, Cache-Control, Accept",
};

const esMision = (x: string | undefined): x is Mision => x === "demeter" || x === "hermes";

function json(
  res: ServerResponse,
  estado: number,
  cuerpo: unknown,
  extra: Record<string, string> = {},
) {
  res.writeHead(estado, {
    ...CORS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extra,
  });
  res.end(JSON.stringify(cuerpo));
}

/** Un evento SSE (05 §1). Sin `id` para el `meta` de bienvenida: no mueve el cursor del cliente. */
function formatoSse(evento: string, data: string, id?: number): string {
  return `${id === undefined ? "" : `id: ${id}\n`}event: ${evento}\ndata: ${data}\n\n`;
}

export function crearRepetidor(opciones: OpcionesRepetidor): Repetidor {
  const velocidad = opciones.velocidad ?? 1;
  const latidoMs = opciones.latidoMs ?? WEB_SSE_LATIDO_S * 1000;
  const serieMax = opciones.serieMax ?? WEB_SERIE_MAX_PUNTOS;
  const reloj = opciones.reloj ?? (() => performance.now());
  const inicio = reloj();

  const reproductores = new Map<Mision, Reproductor>();
  const streams = new Map<Mision, Set<ServerResponse>>();
  for (const [mision, a] of Object.entries(opciones.archivos) as [
    Mision,
    { escenario: string; ruta: string },
  ][]) {
    const r = new Reproductor(mision, a.escenario, leerJsonl(a.ruta));
    reproductores.set(mision, r);
    const clientes = new Set<ServerResponse>();
    streams.set(mision, clientes);
    r.suscribir((e: Emision) => {
      if (e.tipo === "caida") {
        // Relay caído: se cortan los streams abiertos; los clientes reconectan y reciben 503.
        for (const res of [...clientes]) res.end();
        clientes.clear();
      } else {
        const texto = formatoSse(e.evento, e.data, e.id);
        for (const res of clientes) res.write(texto);
      }
    });
  }

  const ahoraVirtual = () => (reloj() - inicio) * velocidad;
  const avanzar = () => {
    const t = ahoraVirtual();
    for (const r of reproductores.values()) r.avanzarHasta(t);
  };

  // ---- temporizador: despierta justo cuando vence el próximo mensaje de cualquier misión ----
  let temporizador: NodeJS.Timeout | undefined;
  let cerrado = false;
  const programar = () => {
    if (cerrado || opciones.temporizador === false) return;
    const proximo = Math.min(...[...reproductores.values()].map((r) => r.proximoMs()));
    const esperaMs = Math.max(1, Math.ceil((proximo - ahoraVirtual()) / velocidad));
    temporizador = setTimeout(() => {
      avanzar();
      programar();
    }, esperaMs);
  };

  // ---- latido del SSE (04 §4) ----
  const latido = setInterval(() => {
    for (const clientes of streams.values()) for (const res of clientes) res.write(": ping\n\n");
  }, latidoMs);

  function stream(
    req: IncomingMessage,
    res: ServerResponse,
    r: Reproductor,
    clientes: Set<ServerResponse>,
  ) {
    res.writeHead(200, {
      ...CORS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    // 1. meta al conectar (sin id). 2. lo que falta desde Last-Event-ID. 3. lo que vaya llegando.
    res.write(formatoSse("meta", JSON.stringify(r.metaActual())));
    const visto = String(req.headers["last-event-id"] ?? "");
    if (/^\d+$/.test(visto) && Number(visto) < r.ultimoId) {
      const desde = Math.max(Number(visto) + 1, r.ultimoId - REANUDAR_MAX_MENSAJES + 1);
      for (let id = desde; id <= r.ultimoId; id++) {
        const m = r.mensajePorId(id) as MensajeConId;
        res.write(formatoSse(m.evento, m.data, m.id));
      }
    }
    clientes.add(res);
    res.on("close", () => clientes.delete(res));
  }

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
    avanzar();
    const partes = new URL(req.url ?? "/", "http://repetidor").pathname.split("/").filter(Boolean);
    if (partes[0] !== "api" || partes[1] !== "v1") {
      json(res, 404, { error: "no existe" });
      return;
    }
    if (partes.length === 3 && partes[2] === "salud") {
      // Siempre 200: es el repetidor el que está vivo; `relay_caido` dice si simula la caída.
      json(res, 200, {
        estado: "ok",
        contrato_version: "web-1",
        repetidor: true,
        misiones: Object.fromEntries(
          [...reproductores].map(([m, r]) => [
            m,
            {
              escenario: r.escenario,
              vuelta: r.numeroVuelta,
              ultimo_id: r.ultimoId,
              relay_caido: r.caido,
              clientes_sse: streams.get(m)?.size ?? 0,
            },
          ]),
        ),
      });
      return;
    }
    const [, , mision, recurso] = partes;
    const r = esMision(mision) ? reproductores.get(mision) : undefined;
    if (
      partes.length !== 4 ||
      !r ||
      !esMision(mision) ||
      (recurso !== "snapshot" && recurso !== "stream")
    ) {
      json(res, 404, { error: "ruta o misión no servida por este repetidor" });
      return;
    }
    if (r.caido) {
      json(
        res,
        503,
        { error: "relay caído (simulado)" },
        { "Retry-After": String(REINTENTO_503_S) },
      );
      return;
    }
    if (recurso === "snapshot") {
      json(res, 200, r.snapshot(serieMax), { "Cache-Control": "public, max-age=1" });
      return;
    }
    stream(req, res, r, streams.get(mision) as Set<ServerResponse>);
  });

  return {
    servidor,
    reproductores,
    avanzar,
    escuchar(puerto, host) {
      return new Promise((resolver, rechazar) => {
        servidor.once("error", rechazar);
        servidor.listen(puerto, host, () => {
          servidor.off("error", rechazar);
          avanzar(); // el primer mensaje (T = 0) sale ya
          programar();
          resolver((servidor.address() as AddressInfo).port);
        });
      });
    },
    cerrar() {
      cerrado = true;
      clearTimeout(temporizador);
      clearInterval(latido);
      for (const clientes of streams.values()) for (const res of clientes) res.end();
      return new Promise((resolver) => {
        servidor.close(() => resolver());
        servidor.closeAllConnections();
      });
    },
  };
}
