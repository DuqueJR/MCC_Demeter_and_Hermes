// Repetidor de desarrollo (T-630): ids crecientes, reanudación con Last-Event-ID sin duplicar,
// snapshot válido contra el esquema, decimación, relay caído y las rutas. El reloj es falso y se
// mueve a mano (`avanzar()`): las pruebas no esperan tiempo real, salvo la del latido `: ping`.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import { afterEach, describe, expect, it } from "vitest";
import { HUECO_RELAY_CAIDO_MIN_MS, PAUSA_ENTRE_VUELTAS_MS } from "../dev/repetidor/constantes";
import { leerJsonl } from "../dev/repetidor/jsonl";
import { Reproductor } from "../dev/repetidor/reproductor";
import { crearRepetidor, type Repetidor } from "../dev/repetidor/servidor";
import { decimarIndices } from "../dev/repetidor/snapshot";
import { type Mision, type Snapshot, TIPOS_MENSAJE } from "../src/contrato/tipos";
import { validarExtra } from "../src/contrato/validacion_extra";
import { WEB_SERIE_MAX_PUNTOS } from "../src/datos/constantes";

const raiz = resolve(import.meta.dirname, "..");
const datos = join(raiz, "dev", "datos");
const ruta = (mision: Mision, escenario: string) => join(datos, `${mision}_${escenario}.jsonl`);

const esquema = JSON.parse(readFileSync(join(raiz, "src/contrato/esquema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(esquema);
function errores(def: string, dato: unknown): string[] {
  const v = ajv.getSchema(`${esquema.$id}#/$defs/${def}`);
  if (!v) throw new Error(`No existe #/$defs/${def}`);
  return v(dato) ? [] : (v.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
}

const ESCENARIOS = [
  "nominal",
  "lkp_descenso",
  "descenso_rapido",
  "backfill",
  "espera_rampa",
  "relay_caido",
] as const;

// ---- utilidades de las pruebas ----

interface EventoSse {
  id: string | null;
  event: string;
  data: string;
}

/** Cliente SSE mínimo con `fetch`: junta los eventos y los comentarios (`: ping`). */
async function abrirSse(url: string, headers: Record<string, string> = {}) {
  const ctl = new AbortController();
  const res = await fetch(url, { headers, signal: ctl.signal });
  const eventos: EventoSse[] = [];
  const comentarios: string[] = [];
  let terminado = false;
  if (res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    void (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let corte = buf.indexOf("\n\n");
          while (corte >= 0) {
            const bloque = buf.slice(0, corte);
            buf = buf.slice(corte + 2);
            const ev: EventoSse = { id: null, event: "message", data: "" };
            for (const l of bloque.split("\n")) {
              if (l.startsWith(":")) comentarios.push(l);
              else if (l.startsWith("id: ")) ev.id = l.slice(4);
              else if (l.startsWith("event: ")) ev.event = l.slice(7);
              else if (l.startsWith("data: ")) ev.data += l.slice(6);
            }
            if (!bloque.split("\n").every((l) => l.startsWith(":"))) eventos.push(ev);
            corte = buf.indexOf("\n\n");
          }
        }
      } catch {
        // abort() o corte del servidor: da igual, `terminado` lo cuenta
      }
      terminado = true;
    })();
  } else {
    terminado = true;
  }
  return {
    res,
    eventos,
    comentarios,
    ids: () => eventos.filter((e) => e.id !== null).map((e) => Number(e.id)),
    terminado: () => terminado,
    cerrar: () => ctl.abort(),
  };
}

async function esperar(cond: () => boolean, ms = 3000): Promise<void> {
  const limite = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > limite) throw new Error("tiempo agotado esperando la condición");
    await new Promise((r) => setTimeout(r, 5));
  }
}

let repetidores: Repetidor[] = [];
let carpetas: string[] = [];
afterEach(async () => {
  for (const r of repetidores) await r.cerrar();
  for (const c of carpetas) rmSync(c, { recursive: true, force: true });
  repetidores = [];
  carpetas = [];
});

/** Repetidor con reloj falso, en un puerto libre. `t.ms` es el reloj. */
async function levantar(
  archivos: Parameters<typeof crearRepetidor>[0]["archivos"],
  extra: Partial<Parameters<typeof crearRepetidor>[0]> = {},
) {
  const t = { ms: 0 };
  const repetidor = crearRepetidor({
    archivos,
    reloj: () => t.ms,
    temporizador: false,
    ...extra,
  });
  repetidores.push(repetidor);
  const puerto = await repetidor.escuchar(0, "127.0.0.1");
  const base = `http://127.0.0.1:${puerto}/api/v1`;
  /** Mueve el reloj y emite lo vencido. */
  const irA = (ms: number) => {
    t.ms = ms;
    repetidor.avanzar();
  };
  return { repetidor, base, irA };
}

const nominal = { demeter: { escenario: "nominal", ruta: ruta("demeter", "nominal") } };

// ---- decimación ----

describe("decimarIndices (05 §3: WEB_SERIE_MAX_PUNTOS)", () => {
  it("si caben, devuelve todos", () => {
    expect(decimarIndices(5, 10, () => false)).toEqual([0, 1, 2, 3, 4]);
    expect(decimarIndices(WEB_SERIE_MAX_PUNTOS, WEB_SERIE_MAX_PUNTOS, () => false)).toHaveLength(
      WEB_SERIE_MAX_PUNTOS,
    );
  });

  it("respeta el máximo, queda en orden y conserva todo el vuelo", () => {
    // 3000 puntos de tierra, 700 de vuelo en el medio.
    const n = 3700;
    const enVuelo = (i: number) => i >= 1500 && i < 2200;
    const idx = decimarIndices(n, WEB_SERIE_MAX_PUNTOS, enVuelo);
    expect(idx).toHaveLength(WEB_SERIE_MAX_PUNTOS);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(new Set(idx).size).toBe(idx.length);
    for (let i = 1500; i < 2200; i++) expect(idx).toContain(i);
    expect(idx[0]).toBe(0); // la tierra conserva sus extremos
    expect(idx.at(-1)).toBe(n - 1);
  });

  it("si solo el vuelo ya excede el máximo, decima parejo todo", () => {
    const idx = decimarIndices(5000, 100, () => true);
    expect(idx).toHaveLength(100);
    expect(idx[0]).toBe(0);
    expect(idx.at(-1)).toBe(4999);
  });

  it("máximos extremos no rompen (0 y 1)", () => {
    expect(decimarIndices(10, 0, () => false)).toEqual([]);
    expect(decimarIndices(10, 1, () => false)).toEqual([9]);
  });
});

// ---- ids del SSE y Last-Event-ID ----

describe("stream SSE", () => {
  it("manda un meta al conectar y después ids crecientes de uno en uno", async () => {
    const { repetidor, base, irA } = await levantar(nominal);
    irA(2000);
    const antes = repetidor.reproductores.get("demeter")?.ultimoId ?? 0;
    expect(antes).toBeGreaterThan(5);

    const s = await abrirSse(`${base}/demeter/stream`);
    expect(s.res.status).toBe(200);
    expect(s.res.headers.get("content-type")).toContain("text/event-stream");
    await esperar(() => s.eventos.length >= 1);
    expect(s.eventos[0]?.event).toBe("meta");
    expect(s.eventos[0]?.id).toBeNull(); // el de bienvenida no mueve el cursor del cliente
    expect(JSON.parse(s.eventos[0]?.data ?? "{}").mision).toBe("demeter");

    irA(6000);
    const total = repetidor.reproductores.get("demeter")?.ultimoId ?? 0;
    await esperar(() => s.ids().length === total - antes);
    const ids = s.ids();
    expect(ids[0]).toBe(antes + 1);
    expect(ids.at(-1)).toBe(total);
    ids.forEach((id, i) => {
      if (i > 0) expect(id).toBe((ids[i - 1] as number) + 1);
    });
    // los nombres de `event:` son los de los tipos del contrato
    for (const e of s.eventos) expect(TIPOS_MENSAJE as readonly string[]).toContain(e.event);
    s.cerrar();
  });

  it("el id no se reinicia al dar la vuelta al bucle", async () => {
    const { repetidor, base, irA } = await levantar(nominal);
    const r = repetidor.reproductores.get("demeter") as Reproductor;
    irA(r.periodoMs - 1);
    const alFinal = r.ultimoId;
    expect(alFinal).toBe(r.totalMensajes);
    expect(r.numeroVuelta).toBe(1);

    const s = await abrirSse(`${base}/demeter/stream`);
    await esperar(() => s.eventos.length >= 1);
    irA(r.periodoMs + 3000); // la vuelta siguiente: llegan su meta (T = 0) y el resto
    await esperar(() => s.ids().length > 5);
    expect(s.ids()[0]).toBe(alFinal + 1);
    expect(s.eventos[1]?.event).toBe("meta"); // primer mensaje de la vuelta
    expect(s.ids().at(-1)).toBe(r.ultimoId);
    s.cerrar();
  });

  it("Last-Event-ID reanuda desde el mensaje siguiente, sin duplicar ni saltar", async () => {
    const { repetidor, base, irA } = await levantar(nominal);
    const r = repetidor.reproductores.get("demeter") as Reproductor;
    irA(2000);
    const n0 = r.ultimoId;

    // C se queda conectado todo el rato: es la referencia de "lo que debió llegar".
    const c = await abrirSse(`${base}/demeter/stream`);
    // A se conecta, ve un tramo y se cae.
    const a = await abrirSse(`${base}/demeter/stream`);
    await esperar(() => a.eventos.length >= 1 && c.eventos.length >= 1);
    irA(3000);
    const n1 = r.ultimoId;
    await esperar(() => a.ids().length === n1 - n0);
    a.cerrar();
    await esperar(() => a.terminado());

    irA(5000); // A no vio estos
    const n2 = r.ultimoId;
    expect(n2).toBeGreaterThan(n1);

    // B reanuda con el último id que vio A.
    const b = await abrirSse(`${base}/demeter/stream`, { "Last-Event-ID": String(n1) });
    await esperar(() => b.ids().length === n2 - n1);
    expect(b.eventos[0]?.event).toBe("meta");
    expect(b.eventos[0]?.id).toBeNull();
    irA(6000);
    const n3 = r.ultimoId;
    await esperar(() => b.ids().length === n3 - n1);

    const vistos = [...a.ids(), ...b.ids()];
    expect(vistos).toEqual(Array.from({ length: n3 - n0 }, (_, i) => n0 + 1 + i));
    // y el contenido de lo reanudado es el mismo que vio el que no se cayó
    await esperar(() => c.ids().length === n3 - n0);
    const deC = new Map(c.eventos.filter((e) => e.id).map((e) => [e.id, e.data]));
    for (const e of b.eventos.filter((x) => x.id)) expect(e.data).toBe(deC.get(e.id));
    c.cerrar();
    b.cerrar();
  });

  it("Last-Event-ID al día (o de otra época) no reenvía nada viejo", async () => {
    const { repetidor, base, irA } = await levantar(nominal);
    const r = repetidor.reproductores.get("demeter") as Reproductor;
    irA(3000);
    for (const visto of [String(r.ultimoId), String(r.ultimoId + 500), "abc", ""]) {
      const s = await abrirSse(`${base}/demeter/stream`, { "Last-Event-ID": visto });
      await esperar(() => s.eventos.length >= 1);
      await new Promise((res) => setTimeout(res, 30));
      expect(s.ids(), `Last-Event-ID=${visto}`).toEqual([]);
      s.cerrar();
    }
  });

  it("manda el latido ': ping' (WEB_SSE_LATIDO_S, acá acortado)", async () => {
    const { base } = await levantar(nominal, { latidoMs: 30 });
    const s = await abrirSse(`${base}/demeter/stream`);
    await esperar(() => s.comentarios.filter((c) => c === ": ping").length >= 2);
    s.cerrar();
  });
});

// ---- snapshot ----

describe("snapshot", () => {
  it("valida contra el esquema y validacion_extra en los 12 archivos, en varios instantes", () => {
    for (const mision of ["demeter", "hermes"] as const) {
      for (const esc of ESCENARIOS) {
        const r = new Reproductor(mision, esc, leerJsonl(ruta(mision, esc)));
        const instantes = [0, 9000, 25000, 60000, 100_000, r.periodoMs - 1];
        for (const t of instantes) {
          r.avanzarHasta(t);
          const s = r.snapshot();
          const donde = `${mision}/${esc} t=${t}`;
          expect(errores("snapshot", s), donde).toEqual([]);
          expect(validarExtra("snapshot", s), donde).toEqual([]);
          expect(s.vuelo_completo_url, donde).toBeNull();
        }
      }
    }
  });

  it("refleja lo emitido hasta ahora: último estado, eventos y serie", async () => {
    const lineas = leerJsonl(ruta("demeter", "nominal"));
    const { base, irA } = await levantar(nominal);
    const corte = 60_000;
    irA(corte);
    const s = (await (await fetch(`${base}/demeter/snapshot`)).json()) as Snapshot;

    const hasta = lineas.filter((m) => m.t_rel_ms <= corte);
    const ultimoEstado = hasta.filter((m) => m.linea.evento === "estado").at(-1);
    expect(s.estado).toEqual(ultimoEstado?.linea.datos);
    expect(s.salud).toEqual(hasta.filter((m) => m.linea.evento === "salud").at(-1)?.linea.datos);
    expect(s.estacion).toEqual(
      hasta.filter((m) => m.linea.evento === "estacion").at(-1)?.linea.datos,
    );
    expect(s.meta).toEqual(hasta.filter((m) => m.linea.evento === "meta").at(-1)?.linea.datos);
    expect(s.eventos).toEqual(
      hasta.filter((m) => m.linea.evento === "evento").map((m) => m.linea.datos),
    );
    expect(s.eventos.map((e) => e.tipo)).toContain("despegue");
    expect(s.eventos.map((e) => e.tipo)).not.toContain("aterrizaje");
    expect(s.backfill).toBeNull();
    expect(s.vuelo_completo_url).toBeNull();

    const nEstados = hasta.filter((m) => m.linea.evento === "estado").length;
    expect(s.serie.t_mas_s).toHaveLength(nEstados); // caben todos: sin decimar
    const largos = new Set(Object.values(s.serie).map((c) => c.length));
    expect(largos.size).toBe(1);
    // el último punto es el último estado
    expect(s.serie.alt_agl_m.at(-1)).toBe(s.estado?.pos?.alt_agl_m);
    expect(s.serie.vz_ms.at(-1)).toBe(s.estado?.vel?.u_ms);
  });

  it("antes del despegue no hay T+ (null); desde el despegue, T+ crece", async () => {
    const { base, irA } = await levantar(nominal);
    irA(60_000);
    const s = (await (await fetch(`${base}/demeter/snapshot`)).json()) as Snapshot;
    const t = s.serie.t_mas_s;
    expect(t[0]).toBeLessThan(0); // los puntos de antes del despegue quedan en T-
    expect(t.at(-1)).toBeGreaterThan(0);
    for (let i = 1; i < t.length; i++)
      expect(t[i] as number).toBeGreaterThanOrEqual(t[i - 1] as number);

    const r2 = await levantar(nominal);
    r2.irA(1000);
    const antes = (await (await fetch(`${r2.base}/demeter/snapshot`)).json()) as Snapshot;
    expect(antes.eventos).toEqual([]);
    expect(antes.serie.t_mas_s.every((x) => x === null)).toBe(true);
    expect(errores("snapshot", antes)).toEqual([]);
  });

  it("la serie respeta el máximo y conserva la resolución del vuelo", async () => {
    const max = 120;
    const { base, irA, repetidor } = await levantar(nominal, { serieMax: max });
    const r = repetidor.reproductores.get("demeter") as Reproductor;
    irA(r.periodoMs - 1);
    const completo = r.snapshot(100_000).serie; // sin decimar
    const s = (await (await fetch(`${base}/demeter/snapshot`)).json()) as Snapshot;
    expect(completo.t_mas_s.length).toBeGreaterThan(max);
    expect(s.serie.t_mas_s).toHaveLength(max);
    for (const col of Object.values(s.serie)) expect(col).toHaveLength(max);
    // lo decimado es una subsecuencia de lo completo, en orden
    let j = 0;
    for (const x of s.serie.alt_agl_m) {
      while (j < completo.alt_agl_m.length && completo.alt_agl_m[j] !== x) j++;
      expect(j).toBeLessThan(completo.alt_agl_m.length);
      j++;
    }
  });

  it("si el presupuesto alcanza para el vuelo, lo conserva entero y el apogeo sobrevive", async () => {
    const estados = leerJsonl(ruta("demeter", "nominal")).filter(
      (m) => m.linea.evento === "estado",
    );
    const enVuelo = estados.filter((m) =>
      ["BOOST", "COAST", "APOGEE", "FREE_FALL", "DESCENT"].includes(
        (m.linea.datos as { fase: string }).fase,
      ),
    ).length;
    const max = enVuelo + 10;
    expect(estados.length).toBeGreaterThan(max); // sí hay que decimar
    const { base, irA, repetidor } = await levantar(nominal, { serieMax: max });
    const r = repetidor.reproductores.get("demeter") as Reproductor;
    irA(r.periodoMs - 1);
    const completo = r.snapshot(100_000).serie;
    const s = (await (await fetch(`${base}/demeter/snapshot`)).json()) as Snapshot;
    expect(s.serie.t_mas_s).toHaveLength(max);
    expect(Math.max(...(s.serie.alt_agl_m as number[]))).toBe(
      Math.max(...(completo.alt_agl_m as number[])),
    );
  });

  it("con el máximo por defecto (WEB_SERIE_MAX_PUNTOS) nunca lo pasa", async () => {
    const r = new Reproductor(
      "demeter",
      "espera_rampa",
      leerJsonl(ruta("demeter", "espera_rampa")),
    );
    r.avanzarHasta(r.periodoMs - 1);
    expect(r.snapshot().serie.t_mas_s.length).toBeLessThanOrEqual(WEB_SERIE_MAX_PUNTOS);
    expect(r.snapshot(500).serie.t_mas_s).toHaveLength(500);
  });

  it("al dar la vuelta el snapshot se reinicia y repite el mismo vuelo", async () => {
    const r = new Reproductor("demeter", "nominal", leerJsonl(ruta("demeter", "nominal")));
    r.avanzarHasta(60_000);
    const primera = JSON.stringify(r.snapshot());
    r.avanzarHasta(r.periodoMs + 10);
    const inicio = r.snapshot();
    expect(inicio.estado).toBeNull(); // arranca otra vez desde cero
    expect(inicio.eventos).toEqual([]);
    expect(inicio.serie.t_mas_s).toEqual([]);
    r.avanzarHasta(r.periodoMs + 60_000);
    expect(JSON.stringify(r.snapshot())).toBe(primera);
  });

  it("backfill: al llegar completo el snapshot lo trae, sin vuelo completo (T-630 (P))", () => {
    const r = new Reproductor("demeter", "backfill", leerJsonl(ruta("demeter", "backfill")));
    r.avanzarHasta(150_000);
    const durante = r.snapshot().backfill;
    expect(durante?.activo).toBe(true);
    expect(durante?.completo).toBe(false);
    r.avanzarHasta(r.periodoMs - 1);
    const s = r.snapshot();
    expect(s.backfill?.completo).toBe(true);
    expect(s.vuelo_completo_url).toBeNull();
  });
});

// ---- relay caído ----

describe("relay_caido (hueco del JSONL)", () => {
  const caido = { demeter: { escenario: "relay_caido", ruta: ruta("demeter", "relay_caido") } };

  /** El primer salto de t_rel_ms del archivo: [último antes del hueco, primero después]. */
  function hueco(): [number, number] {
    const ms = leerJsonl(ruta("demeter", "relay_caido")).map((m) => m.t_rel_ms);
    const i = ms.findIndex(
      (t, k) => k > 0 && t - (ms[k - 1] as number) >= HUECO_RELAY_CAIDO_MIN_MS,
    );
    return [ms[i - 1] as number, ms[i] as number];
  }

  it("el archivo tiene un hueco de ~20 s", () => {
    const [desde, hasta] = hueco();
    expect(hasta - desde).toBeGreaterThanOrEqual(19_000);
  });

  it("cierra los streams abiertos y responde 503 al snapshot y al stream; al volver, todo normal", async () => {
    const [desde, hasta] = hueco();
    const { repetidor, base, irA } = await levantar(caido);
    irA(desde - 500);
    const s = await abrirSse(`${base}/demeter/stream`);
    await esperar(() => s.eventos.length >= 1);
    expect((await fetch(`${base}/demeter/snapshot`)).status).toBe(200);

    irA(desde); // sale el último mensaje antes del hueco, y el relay "se cae"
    await esperar(() => s.terminado());
    expect(repetidor.reproductores.get("demeter")?.caido).toBe(true);

    irA((desde + hasta) / 2);
    for (const recurso of ["snapshot", "stream"]) {
      const res = await fetch(`${base}/demeter/${recurso}`);
      expect(res.status, recurso).toBe(503);
      expect(res.headers.get("retry-after")).not.toBeNull();
      await res.body?.cancel();
    }
    // el repetidor sigue vivo: /salud contesta y dice que simula la caída
    const salud = (await (await fetch(`${base}/salud`)).json()) as {
      misiones: { demeter: { relay_caido: boolean } };
    };
    expect(salud.misiones.demeter.relay_caido).toBe(true);

    irA(hasta + 100); // el relay vuelve
    expect((await fetch(`${base}/demeter/snapshot`)).status).toBe(200);
    const b = await abrirSse(`${base}/demeter/stream`);
    expect(b.res.status).toBe(200);
    b.cerrar();
  });

  it("al volver, un cliente que reanuda con Last-Event-ID no pierde ni repite mensajes", async () => {
    const [desde, hasta] = hueco();
    const { repetidor, base, irA } = await levantar(caido);
    const r = repetidor.reproductores.get("demeter") as Reproductor;
    irA(desde - 1000);
    const a = await abrirSse(`${base}/demeter/stream`);
    await esperar(() => a.eventos.length >= 1);
    irA(desde);
    await esperar(() => a.terminado());
    const ultimo = a.ids().at(-1) as number;
    expect(ultimo).toBe(r.ultimoId); // vio todo lo que hubo antes del hueco

    irA(hasta + 2000);
    const b = await abrirSse(`${base}/demeter/stream`, { "Last-Event-ID": String(ultimo) });
    await esperar(() => b.ids().length === r.ultimoId - ultimo);
    expect(b.ids()[0]).toBe(ultimo + 1);
    expect(b.eventos[1]?.event).toBe("meta"); // el meta que el relay manda al volver
    b.cerrar();
  });
});

// ---- rutas, CORS y solo lectura ----

describe("rutas", () => {
  it("CORS abierto para GET y el preflight de OPTIONS", async () => {
    const { base } = await levantar(nominal);
    const g = await fetch(`${base}/demeter/snapshot`);
    expect(g.headers.get("access-control-allow-origin")).toBe("*");
    const o = await fetch(`${base}/demeter/stream`, { method: "OPTIONS" });
    expect(o.status).toBe(204);
    expect(o.headers.get("access-control-allow-methods")).toContain("GET");
    expect(o.headers.get("access-control-allow-headers")).toContain("Last-Event-ID");
    const sse = await abrirSse(`${base}/demeter/stream`);
    expect(sse.res.headers.get("access-control-allow-origin")).toBe("*");
    sse.cerrar();
  });

  it("no existe ninguna ruta de escritura (GS-14): todo lo que no es GET da 405", async () => {
    const { base } = await levantar(nominal);
    for (const metodo of ["POST", "PUT", "DELETE", "PATCH"]) {
      const res = await fetch(`${base}/demeter/snapshot`, { method: metodo, body: "{}" });
      expect(res.status, metodo).toBe(405);
    }
    expect((await fetch(`${base}/ingesta`, { method: "POST", body: "{}" })).status).toBe(405);
  });

  it("/salud, misión no servida y rutas inexistentes", async () => {
    const { base } = await levantar(nominal);
    const salud = await fetch(`${base}/salud`);
    expect(salud.status).toBe(200);
    expect(((await salud.json()) as { estado: string }).estado).toBe("ok");
    expect((await fetch(`${base}/hermes/snapshot`)).status).toBe(404); // solo se carga Deméter
    expect((await fetch(`${base}/apolo/stream`)).status).toBe(404);
    expect((await fetch(`${base}/demeter/otra`)).status).toBe(404);
    expect((await fetch(`${base}/demeter`)).status).toBe(404);
  });

  it("sirve las dos misiones a la vez, cada una con lo suyo (D-W01)", async () => {
    const { base } = await levantar(
      {
        demeter: { escenario: "nominal", ruta: ruta("demeter", "nominal") },
        hermes: { escenario: "nominal", ruta: ruta("hermes", "nominal") },
      },
      {},
    );
    const d = (await (await fetch(`${base}/demeter/snapshot`)).json()) as Snapshot;
    const h = (await (await fetch(`${base}/hermes/snapshot`)).json()) as Snapshot;
    expect(d.meta.mision).toBe("demeter");
    expect(h.meta.mision).toBe("hermes");
    expect(h.meta.modo).toBe("sintetico");
  });
});

// ---- lectura del JSONL ----

describe("leerJsonl", () => {
  function archivo(contenido: string): string {
    const dir = mkdtempSync(join(tmpdir(), "repetidor-"));
    carpetas.push(dir);
    const f = join(dir, "x.jsonl");
    writeFileSync(f, contenido);
    return f;
  }
  const meta = readFileSync(ruta("demeter", "nominal"), "utf8").split("\n")[0] as string;

  it("lee un archivo válido", () => {
    expect(leerJsonl(archivo(`${meta}\n`))).toHaveLength(1);
  });

  it("rechaza con el número de línea lo que no se puede reproducir", () => {
    expect(() => leerJsonl(archivo(`${meta}\nno es json\n`))).toThrow(/:2: no es JSON/);
    expect(() =>
      leerJsonl(archivo(`${meta}\n{"t_rel_ms":5,"evento":"otro","datos":{}}\n`)),
    ).toThrow(/evento desconocido/);
    expect(() =>
      leerJsonl(archivo(`${meta.replace('"t_rel_ms":0', '"t_rel_ms":9')}\n${meta}\n`)),
    ).toThrow(/retrocede/);
    expect(() => leerJsonl(archivo('{"t_rel_ms":0,"evento":"estacion","datos":{}}\n'))).toThrow(
      /ningún mensaje meta/,
    );
  });
});

describe("constantes del repetidor", () => {
  it("el periodo de una vuelta es el último t_rel_ms más la pausa", () => {
    const m = leerJsonl(ruta("demeter", "nominal"));
    const r = new Reproductor("demeter", "nominal", m);
    expect(r.periodoMs).toBe((m.at(-1)?.t_rel_ms ?? 0) + PAUSA_ENTRE_VUELTAS_MS);
  });
});
