// Ayudas de las pruebas del cliente de datos (T-631): un tiempo falso que se mueve a mano y un
// servidor falso con `fetch` propio, para controlar al milímetro cuándo llega cada cosa.
import { alimentar } from "../src/datos/api";
import type { Entorno } from "../src/datos/cliente";
import { interpolador } from "../src/datos/interpolacion";

/** Reloj y temporizadores falsos: nada pasa hasta que la prueba llama a `avanzar()`. */
export class TiempoFalso {
  ahora = 0;
  private proximo = 0;
  private tareas: { id: number; en: number; f: () => void }[] = [];

  programar = (f: () => void, ms: number): (() => void) => {
    const tarea = { id: this.proximo++, en: this.ahora + ms, f };
    this.tareas.push(tarea);
    return () => {
      this.tareas = this.tareas.filter((t) => t !== tarea);
    };
  };

  /** Mueve el reloj `ms` y ejecuta, en orden, todo lo que venza en ese lapso. */
  avanzar(ms: number): void {
    const meta = this.ahora + ms;
    for (;;) {
      let sig: (typeof this.tareas)[number] | undefined;
      for (const t of this.tareas) {
        if (
          t.en <= meta &&
          (sig === undefined || t.en < sig.en || (t.en === sig.en && t.id < sig.id))
        )
          sig = t;
      }
      if (sig === undefined) break;
      this.tareas = this.tareas.filter((t) => t !== sig);
      this.ahora = Math.max(this.ahora, sig.en);
      sig.f();
    }
    this.ahora = meta;
  }

  get pendientes(): number {
    return this.tareas.length;
  }
}

/** Deja correr las promesas y la E/S pendientes (varias vueltas del bucle de eventos). */
export async function asentar(vueltas = 20): Promise<void> {
  for (let i = 0; i < vueltas; i++) await new Promise<void>((r) => setImmediate(r));
}

/** Espera (en tiempo real, con tope) a que se cumpla una condición. */
export async function esperarHasta(
  cond: () => boolean,
  descripcion = "la condición",
  topeMs = 5000,
): Promise<void> {
  const fin = Date.now() + topeMs;
  while (!cond()) {
    if (Date.now() > fin) throw new Error(`Se agotó el tiempo esperando ${descripcion}`);
    await new Promise<void>((r) => setImmediate(r));
  }
}

export function entornoDePrueba(
  tiempo: TiempoFalso,
  fetchFalso: typeof fetch,
  extra: Partial<Entorno> = {},
): Partial<Entorno> {
  return {
    fetch: fetchFalso,
    ahoraMs: () => tiempo.ahora,
    programar: tiempo.programar,
    aleatorio: () => 0.5,
    alVolverVisible: () => () => {},
    ...extra,
  };
}

/** Vuelve todo al estado inicial: las signals de `api.ts` son del módulo y se comparten. */
export function limpiarEstado(): void {
  alimentar.reiniciar();
  interpolador.reiniciar();
}

/** Texto de un evento SSE (05 §1). */
export function sse(evento: string, datos: unknown, id?: string): string {
  return `${id === undefined ? "" : `id: ${id}\n`}event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
}

export interface ConexionStream {
  cabeceras: Headers;
  escribir(texto: string): void;
  cerrar(): void;
  readonly abortada: boolean;
}

type Respuesta = Response | Error;

/**
 * Un servidor que contesta `snapshot` y `stream` a mano. Por defecto: el snapshot responde ya y el
 * stream queda abierto. La prueba cambia `respuestaSnapshot` / `respuestaStream` cuando necesita
 * otra cosa (503, snapshot tardío, contenido equivocado).
 */
export class ServidorFalso {
  snapshot: unknown;
  conexiones: ConexionStream[] = [];
  pedidosSnapshot = 0;
  pedidosStream = 0;
  cabecerasSnapshot: Headers[] = [];
  /** Si no es `null`, el snapshot espera a que se llame a lo que devuelve `diferirSnapshot()`. */
  private liberarSnapshot: (() => void) | null = null;
  private snapshotDiferido: Promise<void> | null = null;
  respuestaStream: (() => Respuesta) | null = null;
  respuestaSnapshot: (() => Respuesta) | null = null;
  /** Encabezados extra del snapshot (por ejemplo `Age`). */
  encabezadosSnapshot: Record<string, string> = {};

  constructor(snapshot: unknown) {
    this.snapshot = snapshot;
  }

  /** El próximo snapshot no responde hasta que se llame a la función devuelta. */
  diferirSnapshot(): () => void {
    this.snapshotDiferido = new Promise<void>((resolver) => {
      this.liberarSnapshot = () => {
        this.liberarSnapshot = null;
        this.snapshotDiferido = null;
        resolver();
      };
    });
    return () => this.liberarSnapshot?.();
  }

  readonly fetch: typeof fetch = async (entrada, init) => {
    const url = String(entrada instanceof Request ? entrada.url : entrada);
    const senal = init?.signal ?? undefined;
    if (senal?.aborted) throw new DOMException("abortado", "AbortError");
    const cabeceras = new Headers(init?.headers);
    if (url.endsWith("/stream")) {
      this.pedidosStream++;
      const r = this.respuestaStream?.();
      if (r instanceof Error) throw r;
      if (r) return r;
      return this.abrirStream(cabeceras, senal);
    }
    if (url.endsWith("/snapshot")) {
      this.pedidosSnapshot++;
      this.cabecerasSnapshot.push(cabeceras);
      const espera = this.snapshotDiferido;
      if (espera) {
        await Promise.race([
          espera,
          new Promise<never>((_, rechazar) =>
            senal?.addEventListener("abort", () =>
              rechazar(new DOMException("abortado", "AbortError")),
            ),
          ),
        ]);
      }
      if (senal?.aborted) throw new DOMException("abortado", "AbortError");
      const r = this.respuestaSnapshot?.();
      if (r instanceof Error) throw r;
      if (r) return r;
      return new Response(JSON.stringify(this.snapshot), {
        status: 200,
        headers: { "Content-Type": "application/json", ...this.encabezadosSnapshot },
      });
    }
    return new Response("no existe", { status: 404 });
  };

  private abrirStream(cabeceras: Headers, senal: AbortSignal | undefined): Response {
    const codificador = new TextEncoder();
    let control!: ReadableStreamDefaultController<Uint8Array>;
    let cerrada = false;
    const cuerpo = new ReadableStream<Uint8Array>({
      start(c) {
        control = c;
      },
    });
    const conexion: ConexionStream = {
      cabeceras,
      escribir(texto) {
        if (!cerrada) control.enqueue(codificador.encode(texto));
      },
      cerrar() {
        if (cerrada) return;
        cerrada = true;
        control.close();
      },
      get abortada() {
        return senal?.aborted === true;
      },
    };
    senal?.addEventListener("abort", () => {
      if (cerrada) return;
      cerrada = true;
      control.error(new DOMException("abortado", "AbortError"));
    });
    this.conexiones.push(conexion);
    return new Response(cuerpo, {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }

  /** La conexión de stream más reciente. */
  get ultima(): ConexionStream {
    const c = this.conexiones[this.conexiones.length - 1];
    if (!c) throw new Error("no hay ningún stream abierto");
    return c;
  }
}
