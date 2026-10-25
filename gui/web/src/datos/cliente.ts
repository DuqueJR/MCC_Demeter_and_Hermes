// Cliente de datos de la web (T-631): el snapshot, el SSE con reconexión y retroceso, y la
// aplicación de cada mensaje a las signals de `api.ts`. Es el mismo para la web pública y para el
// dashboard de operación: solo cambia `VITE_API_BASE` (04 §1).
//
// Cómo funciona una sesión (05 §4, y la costura de `costura.ts`):
//   1. Abre el stream (`GET {base}/v1/{mision}/stream`, con `Last-Event-ID` si ya vio algún `id`).
//   2. Mientras tanto pide el snapshot y GUARDA los mensajes que lleguen.
//   3. Aplica el snapshot y reproduce del búfer solo lo posterior a él. Desde ahí, vivo.
//   4. Si el stream se cae o se queda mudo, reconecta con retroceso exponencial (tope
//      `WEB_RECONEXION_MAX_S`, `Retry-After` respetado). Cada reconexión repite 1 a 3.
//
// Resincronizar (volver a pedir el snapshot con el stream abierto) pasa cuando:
//   - llega `backfill.completo` (05 §2.6);
//   - el `t_ms` del `estado` retrocede (otro vuelo, o el cohete se reinició);
//   - llega un `meta` con otro `mission_id` (distinto de `null`, que es "antes de ARM").
//
// El `id` del SSE es opaco (D-W18): solo se guarda y se devuelve en `Last-Event-ID`. El `meta` de
// bienvenida llega sin `id` y no mueve el cursor.
//
// Reloj: todo lo que dependa del tiempo usa `entorno.ahoraMs()` (local y monotónico, inyectable
// para las pruebas), nunca el reloj UTC del celular (05 §0).
import { batch } from "@preact/signals";
import {
  type Estado,
  type Mision,
  type Snapshot,
  TIPOS_MENSAJE,
  type TipoMensaje,
} from "../contrato/tipos";
import { alimentar, backfill, estacion, estado, meta, salud } from "./api";
import { WEB_RECONEXION_MAX_S } from "./constantes";
import { esPosterior, type MensajeSse } from "./costura";
import { interpolador } from "./interpolacion";
import {
  BUFFER_MAX_MENSAJES,
  RECONEXION_BASE_S,
  RECONEXION_FACTOR,
  RECONEXION_JITTER_MIN,
  RELOJ_TICK_MS,
  RESYNC_MAX_SEGUIDOS,
  RETRY_AFTER_MAX_S,
  SESION_ESTABLE_S,
  SNAPSHOT_TIMEOUT_S,
  SSE_SILENCIO_MS,
} from "./parametros";
import { SerieViva } from "./serie";
import { AnalizadorSse, type EventoSse } from "./sse";

const MS_POR_S = 1000;

// ---- Lo que se inyecta (las pruebas pasan sus propios relojes y su `fetch`) ----
export interface Entorno {
  fetch: typeof fetch;
  /** Reloj LOCAL monotónico, en ms. */
  ahoraMs: () => number;
  /** Ejecuta `f` dentro de `ms`; devuelve la función que lo cancela. */
  programar: (f: () => void, ms: number) => () => void;
  /** Número al azar en [0, 1) para el jitter de la reconexión. */
  aleatorio: () => number;
  /** Llama a `f` cada vez que la página vuelve a estar visible; devuelve la función que lo quita. */
  alVolverVisible: (f: () => void) => () => void;
}

function entornoPorDefecto(): Entorno {
  return {
    fetch: (...args) => globalThis.fetch(...args),
    ahoraMs: () => performance.now(),
    programar: (f, ms) => {
      const id = setTimeout(f, ms);
      return () => clearTimeout(id);
    },
    aleatorio: () => Math.random(),
    alVolverVisible: (f) => {
      if (typeof document === "undefined") return () => {};
      const alCambiar = () => {
        if (document.visibilityState === "visible") f();
      };
      document.addEventListener("visibilitychange", alCambiar);
      return () => document.removeEventListener("visibilitychange", alCambiar);
    },
  };
}

export interface OpcionesCliente {
  mision: Mision;
  /** Base del API (sin `/v1`). Por defecto `VITE_API_BASE`, o `/api`. */
  base?: string;
  entorno?: Partial<Entorno>;
}

export interface Estadisticas {
  /** Sesiones abiertas (la primera conexión y cada reconexión). */
  sesiones: number;
  /** Veces que se volvió a pedir el snapshot con el stream abierto. */
  resincronizaciones: number;
  /** El último `id` del SSE visto (opaco). */
  ultimoId: string | null;
  /** Mensajes ignorados por repetidos (la reconexión no duplica). */
  duplicados: number;
  /** Eventos SSE ignorados por no ser JSON válido o por un tipo desconocido. */
  descartados: number;
  /** Mensajes aplicados, por tipo. */
  aplicados: Record<TipoMensaje, number>;
  /** Las últimas esperas de reconexión (ms), para verificar el retroceso. */
  esperasMs: number[];
  ultimoError: string | null;
}

export interface Cliente {
  /** Cierra todo y deja de reconectar. */
  detener(): void;
  /** Rehace la sesión ya, sin esperar (por ejemplo, al volver a la pestaña). */
  reiniciarSesion(): void;
  estadisticas(): Estadisticas;
}

// ---- Funciones puras (se prueban solas) ----

/**
 * Espera antes del reintento número `fallosSeguidos` (1 es el primero): exponencial con tope
 * `WEB_RECONEXION_MAX_S` y jitter. `Retry-After` del servidor es el piso. `aleatorio` en [0, 1).
 */
export function esperaReconexionMs(
  fallosSeguidos: number,
  aleatorio: number,
  retryAfterMs = 0,
): number {
  const sinJitterS = Math.min(
    WEB_RECONEXION_MAX_S,
    RECONEXION_BASE_S * RECONEXION_FACTOR ** (fallosSeguidos - 1),
  );
  const jitter = RECONEXION_JITTER_MIN + (1 - RECONEXION_JITTER_MIN) * aleatorio;
  return Math.max(sinJitterS * MS_POR_S * jitter, retryAfterMs);
}

/** `Retry-After` en segundos enteros -> ms, con tope. La forma de fecha HTTP se ignora (0). */
export function leerRetryAfterMs(valor: string | null): number {
  if (valor === null || !/^\d+$/.test(valor.trim())) return 0;
  return Math.min(Number(valor), RETRY_AFTER_MAX_S) * MS_POR_S;
}

/** `Age` (segundos) de una respuesta cacheada -> ms: cuánto más viejo es el snapshot de lo que parece. */
export function leerEdadCacheMs(valor: string | null): number {
  if (valor === null || !/^\d+$/.test(valor.trim())) return 0;
  return Number(valor) * MS_POR_S;
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** Comprobación mínima de la forma (la web no valida contra el esquema en tiempo de ejecución). */
function esSnapshot(x: unknown): x is Snapshot {
  return (
    esObjeto(x) &&
    esObjeto(x.meta) &&
    Array.isArray(x.eventos) &&
    esObjeto(x.serie) &&
    Array.isArray(x.serie.t_mas_s)
  );
}

class ErrorHttp extends Error {
  readonly estadoHttp: number;
  readonly retryAfterMs: number;
  constructor(estadoHttp: number, retryAfterMs: number, donde: string) {
    super(`${donde}: HTTP ${estadoHttp}`);
    this.estadoHttp = estadoHttp;
    this.retryAfterMs = retryAfterMs;
  }
}

// ---- El cliente ----
interface Sesion {
  ctl: AbortController;
  /** Por qué se abortó, si fue a propósito. */
  motivo: "voluntario" | "silencio" | "detener" | null;
  /** Hace fallar la sesión desde una tarea en segundo plano (por ejemplo, el snapshot). */
  rechazar: (e: unknown) => void;
}

let clienteActivo: Cliente | null = null;

export function iniciarCliente(opciones: OpcionesCliente): Cliente {
  clienteActivo?.detener();
  const entorno: Entorno = { ...entornoPorDefecto(), ...opciones.entorno };
  const base = String(opciones.base || import.meta.env.VITE_API_BASE || "/api").replace(/\/+$/, "");
  const urlStream = `${base}/v1/${opciones.mision}/stream`;
  const urlSnapshot = `${base}/v1/${opciones.mision}/snapshot`;

  const stats: Estadisticas = {
    sesiones: 0,
    resincronizaciones: 0,
    ultimoId: null,
    duplicados: 0,
    descartados: 0,
    aplicados: { meta: 0, estado: 0, salud: 0, estacion: 0, evento: 0, backfill: 0 },
    esperasMs: [],
    ultimoError: null,
  };
  const ESPERAS_RECORDADAS = 50;

  let detenido = false;
  let sesion: Sesion | null = null;
  let ultimaSesion: Sesion | null = null;
  /** "sincronizando": los mensajes se guardan en `buffer`; "vivo": se aplican al llegar. */
  let modo: "sincronizando" | "vivo" = "sincronizando";
  let buffer: MensajeSse[] = [];
  let resyncSeguidos = 0;
  let viva = new SerieViva();
  /** Reloj del cohete (`t_ms`) del despegue, para el T+ de cada punto de la serie. */
  let tDespegueMs: number | null = null;
  let despertar: (() => void) | null = null;
  let cancelarTick: () => void = () => {};
  /** Instante local en que llegó el latido `estacion` que se está mostrando. */
  let llegadaEstacionMs = 0;

  /** Aparte de `modo` para que TypeScript no dé por fijo un valor que otra función puede cambiar. */
  const sincronizando = () => modo === "sincronizando";

  // ---- Reloj local: mantiene vivas `edad` y `estadoPagina` ----
  const tick = () => alimentar.reloj(entorno.ahoraMs());
  const programarTick = () => {
    if (detenido) return;
    cancelarTick = entorno.programar(() => {
      tick();
      programarTick();
    }, RELOJ_TICK_MS);
  };

  // ---- Aplicar mensajes ----
  function aplicarEstado(m: Extract<MensajeSse, { tipo: "estado" }>): void {
    const e: Estado = m.datos;
    const previo = estado.value;
    if (previo !== null) {
      if (e.t_ms === previo.t_ms) {
        stats.duplicados++;
        return;
      }
      if (e.t_ms < previo.t_ms) {
        if (resyncSeguidos < RESYNC_MAX_SEGUIDOS) {
          resyncSeguidos++;
          resincronizar(m);
          return;
        }
        // El servidor insiste en retroceder: se acepta como la nueva base.
        viva = new SerieViva();
        interpolador.reiniciar();
      } else {
        resyncSeguidos = 0;
      }
    }
    viva.agregar(e, tDespegueMs);
    batch(() => {
      alimentar.estado(e);
      alimentar.serie(viva.serie());
    });
    interpolador.agregar(e, m.llegadaMs);
    stats.aplicados.estado++;
  }

  function aplicarVivo(m: MensajeSse): void {
    switch (m.tipo) {
      case "meta": {
        const actual = meta.value;
        if (
          actual !== null &&
          actual.mission_id !== null &&
          m.datos.mission_id !== actual.mission_id
        ) {
          resincronizar(m); // otro vuelo: lo que se tiene ya no es de esta misión
          return;
        }
        alimentar.meta(m.datos);
        stats.aplicados.meta++;
        return;
      }
      case "estado":
        aplicarEstado(m);
        return;
      case "salud":
        if (salud.value?.t_ms === m.datos.t_ms) {
          stats.duplicados++;
          return;
        }
        alimentar.salud(m.datos);
        stats.aplicados.salud++;
        return;
      case "estacion":
        if (estacion.value?.utc_ms === m.datos.utc_ms) {
          stats.duplicados++;
          return;
        }
        alimentar.estacion(m.datos, m.llegadaMs);
        llegadaEstacionMs = m.llegadaMs;
        stats.aplicados.estacion++;
        return;
      case "evento":
        if (!alimentar.evento(m.datos)) {
          stats.duplicados++;
          return;
        }
        if (m.datos.tipo === "despegue") tDespegueMs = m.datos.t_ms;
        stats.aplicados.evento++;
        return;
      case "backfill": {
        const previo = backfill.value;
        alimentar.backfill(m.datos);
        stats.aplicados.backfill++;
        // 05 §2.6: al completarse, la trayectoria completa está en el snapshot.
        if (m.datos.completo && previo?.completo !== true) resincronizar();
        return;
      }
    }
  }

  /** Aplica el snapshot y reproduce del búfer lo posterior a él (la costura). */
  function aplicarSnapshot(snap: Snapshot, llegadaMs: number): void {
    const pendientes = buffer.filter((m) => esPosterior(snap, m));
    buffer = [];
    // Si el snapshot trae el MISMO latido que ya se mostraba (una resincronización), se conserva
    // su instante de llegada: re-estamparlo con la hora del snapshot lo haría ver más fresco.
    const actual = estacion.value;
    const mismoLatido =
      actual !== null && snap.estacion !== null && actual.utc_ms === snap.estacion.utc_ms;
    batch(() => {
      alimentar.snapshot(snap, mismoLatido ? llegadaEstacionMs : llegadaMs);
      llegadaEstacionMs = mismoLatido ? llegadaEstacionMs : llegadaMs;
      alimentar.reloj(entorno.ahoraMs());
      viva = SerieViva.desde(snap.serie);
      tDespegueMs = snap.eventos.find((ev) => ev.tipo === "despegue")?.t_ms ?? null;
      interpolador.reiniciar();
      if (snap.estado !== null) interpolador.agregar(snap.estado, llegadaMs);
      modo = "vivo";
      for (let i = 0; i < pendientes.length; i++) {
        aplicarVivo(pendientes[i] as MensajeSse);
        if (sincronizando()) {
          // Una novedad pidió otro snapshot: lo que falta por reproducir va al búfer nuevo.
          buffer.push(...pendientes.slice(i + 1));
          break;
        }
      }
      alimentar.conexion("conectado");
    });
  }

  /** Pide el snapshot (con el stream abierto) y lo aplica. Falla la sesión si no puede. */
  async function sincronizar(s: Sesion): Promise<void> {
    const t0 = entorno.ahoraMs();
    const ctl = new AbortController();
    const alAbortar = () => ctl.abort();
    s.ctl.signal.addEventListener("abort", alAbortar);
    const cancelarTimeout = entorno.programar(() => ctl.abort(), SNAPSHOT_TIMEOUT_S * MS_POR_S);
    try {
      const resp = await entorno.fetch(urlSnapshot, {
        headers: { Accept: "application/json" },
        signal: ctl.signal,
        cache: "no-store",
      });
      if (!resp.ok) {
        void resp.body?.cancel().catch(() => {});
        throw new ErrorHttp(
          resp.status,
          leerRetryAfterMs(resp.headers.get("retry-after")),
          "snapshot",
        );
      }
      const cuerpo: unknown = await resp.json();
      if (!esSnapshot(cuerpo)) throw new Error("snapshot: la respuesta no tiene la forma de web-1");
      if (s !== sesion || s.ctl.signal.aborted) return;
      // El snapshot es, como mínimo, tan viejo como el instante en que se pidió; si vino de una
      // caché, además tiene `Age`. Sobrestimar la edad es el lado seguro: nunca dice "en vivo" de más.
      aplicarSnapshot(cuerpo, t0 - leerEdadCacheMs(resp.headers.get("age")));
    } finally {
      cancelarTimeout();
      s.ctl.signal.removeEventListener("abort", alAbortar);
    }
  }

  /** Vuelve a pedir el snapshot con el stream abierto. `disparo` es el mensaje que lo causó. */
  function resincronizar(disparo?: MensajeSse): void {
    const s = sesion;
    if (s === null) return;
    if (modo === "sincronizando") {
      if (disparo !== undefined) buffer.push(disparo);
      return; // ya viene un snapshot; el disparo se reproduce con él
    }
    modo = "sincronizando";
    buffer = disparo === undefined ? [] : [disparo];
    stats.resincronizaciones++;
    sincronizar(s).catch((e: unknown) => s.rechazar(e));
  }

  /** Un evento SSE ya separado: guarda el cursor y lo aplica o lo guarda en el búfer. */
  function recibir(ev: EventoSse, s: Sesion): void {
    if (s !== sesion) return;
    if (ev.id !== null) stats.ultimoId = ev.id; // opaco: solo se guarda y se devuelve
    if (!(TIPOS_MENSAJE as readonly string[]).includes(ev.evento)) {
      if (ev.evento !== "") stats.descartados++;
      return;
    }
    let datos: unknown;
    try {
      datos = JSON.parse(ev.datos);
    } catch {
      stats.descartados++;
      return;
    }
    if (!esObjeto(datos)) {
      stats.descartados++;
      return;
    }
    const m = { tipo: ev.evento, datos, llegadaMs: entorno.ahoraMs() } as unknown as MensajeSse;
    if (modo === "sincronizando") {
      buffer.push(m);
      if (buffer.length > BUFFER_MAX_MENSAJES) throw new Error("búfer del snapshot desbordado");
      return;
    }
    aplicarVivo(m);
  }

  /** Lee el stream hasta que termine o se caiga; vigila que no se quede mudo. */
  async function leer(body: ReadableStream<Uint8Array>, s: Sesion): Promise<void> {
    const lector = body.getReader();
    const decodificador = new TextDecoder();
    const analizador = new AnalizadorSse();
    let cancelarSilencio: () => void = () => {};
    const armar = () => {
      cancelarSilencio();
      cancelarSilencio = entorno.programar(() => {
        s.motivo ??= "silencio";
        s.ctl.abort();
      }, SSE_SILENCIO_MS);
    };
    armar();
    try {
      for (;;) {
        const { done, value } = await lector.read();
        if (done) return;
        armar(); // cualquier byte cuenta, también el `: ping`
        for (const ev of analizador.alimentar(decodificador.decode(value, { stream: true }))) {
          recibir(ev, s);
        }
      }
    } finally {
      cancelarSilencio();
      lector.cancel().catch(() => {});
    }
  }

  /** Una sesión completa; termina cuando el stream se cierra o algo falla. */
  async function correrSesion(): Promise<void> {
    const s: Sesion = { ctl: new AbortController(), motivo: null, rechazar: () => {} };
    const falla = new Promise<never>((_, rechazar) => {
      s.rechazar = rechazar;
    });
    falla.catch(() => {});
    sesion = s;
    ultimaSesion = s;
    modo = "sincronizando";
    buffer = [];
    resyncSeguidos = 0;
    stats.sesiones++;
    try {
      const cabeceras: Record<string, string> = { Accept: "text/event-stream" };
      if (stats.ultimoId !== null) cabeceras["Last-Event-ID"] = stats.ultimoId;
      const resp = await entorno.fetch(urlStream, {
        headers: cabeceras,
        signal: s.ctl.signal,
        cache: "no-store",
      });
      const tipo = resp.headers.get("content-type") ?? "";
      if (!resp.ok || resp.body === null) {
        void resp.body?.cancel().catch(() => {});
        throw new ErrorHttp(
          resp.status,
          leerRetryAfterMs(resp.headers.get("retry-after")),
          "stream",
        );
      }
      if (!tipo.includes("text/event-stream")) {
        void resp.body.cancel().catch(() => {});
        throw new Error(`stream: tipo de contenido inesperado (${tipo || "ninguno"})`);
      }
      const lectura = leer(resp.body, s);
      sincronizar(s).catch((e: unknown) => s.rechazar(e));
      await Promise.race([lectura, falla]);
    } finally {
      s.ctl.abort();
      if (sesion === s) sesion = null;
    }
  }

  function esperar(ms: number): Promise<void> {
    return new Promise((resolver) => {
      const cancelar = entorno.programar(() => {
        despertar = null;
        resolver();
      }, ms);
      despertar = () => {
        cancelar();
        despertar = null;
        resolver();
      };
    });
  }

  async function bucle(): Promise<void> {
    let fallos = 0;
    while (!detenido) {
      const inicio = entorno.ahoraMs();
      let retryAfterMs = 0;
      try {
        await correrSesion();
      } catch (e) {
        if (e instanceof ErrorHttp) retryAfterMs = e.retryAfterMs;
        stats.ultimoError = e instanceof Error ? e.message : String(e);
      }
      if (detenido) return;
      if (ultimaSesion?.motivo === "voluntario") continue; // a propósito: sin espera ni aviso
      // Se cayó o el servidor cerró: los datos se mantienen y se avisa (03 §4).
      alimentar.conexion("reconectando");
      const duro = entorno.ahoraMs() - inicio < SESION_ESTABLE_S * MS_POR_S;
      fallos = duro ? fallos + 1 : 1;
      const espera = esperaReconexionMs(fallos, entorno.aleatorio(), retryAfterMs);
      stats.esperasMs.push(espera);
      if (stats.esperasMs.length > ESPERAS_RECORDADAS) stats.esperasMs.shift();
      await esperar(espera);
    }
  }

  const cliente: Cliente = {
    detener() {
      if (detenido) return;
      detenido = true;
      cancelarTick();
      quitarVisible();
      despertar?.();
      if (sesion !== null) {
        sesion.motivo = "detener";
        sesion.ctl.abort();
      }
      if (clienteActivo === cliente) clienteActivo = null;
    },
    reiniciarSesion() {
      if (detenido) return;
      if (sesion !== null) {
        sesion.motivo = "voluntario";
        sesion.ctl.abort();
      }
      despertar?.();
    },
    estadisticas() {
      return { ...stats, aplicados: { ...stats.aplicados }, esperasMs: [...stats.esperasMs] };
    },
  };

  const quitarVisible = entorno.alVolverVisible(() => cliente.reiniciarSesion());
  clienteActivo = cliente;
  programarTick();
  void bucle();
  return cliente;
}
