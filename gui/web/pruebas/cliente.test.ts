// Cliente de datos (T-631) con un servidor falso: se controla al milímetro cuándo llega cada cosa.
// Aquí van la costura snapshot/stream, el cursor opaco, el retroceso, `Retry-After`, el silencio,
// los umbrales de `estadoPagina` al milisegundo y los casos raros. Los 6 escenarios de cada misión,
// contra el repetidor de verdad, están en `escenarios.test.ts`.
import { effect } from "@preact/signals";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backfillEjemplo,
  estacionEjemplo,
  estadoEjemplo,
  eventoEjemplo,
  eventoFaseEjemplo,
  metaEjemplo,
  saludEjemplo,
  snapshotEjemplo,
  snapshotVacioEjemplo,
} from "../src/contrato/ejemplos";
import type { Estacion, Estado, Snapshot } from "../src/contrato/tipos";
import * as api from "../src/datos/api";
import {
  type Cliente,
  esperaReconexionMs,
  iniciarCliente,
  leerEdadCacheMs,
  leerRetryAfterMs,
} from "../src/datos/cliente";
import {
  WEB_DATO_VIEJO_S,
  WEB_RECONEXION_MAX_S,
  WEB_SIN_SENAL_S,
  WEB_SSE_LATIDO_S,
} from "../src/datos/constantes";
import { interpolador } from "../src/datos/interpolacion";
import {
  BUFFER_MAX_MENSAJES,
  RESYNC_MAX_SEGUIDOS,
  RETRY_AFTER_MAX_S,
  SESION_ESTABLE_S,
  SNAPSHOT_TIMEOUT_S,
  SSE_SILENCIO_MS,
} from "../src/datos/parametros";
import {
  asentar,
  entornoDePrueba,
  limpiarEstado,
  ServidorFalso,
  sse,
  TiempoFalso,
} from "./ayuda_cliente";

const T0 = estadoEjemplo.t_ms;
const MS = 1000;
const estadoEn = (t_ms: number, extra: Partial<Estado> = {}): Estado => ({
  ...estadoEjemplo,
  t_ms,
  ...extra,
});
const estacionCon = (haceMs: number | null, utcExtra = 0): Estacion => ({
  ...estacionEjemplo,
  utc_ms: estacionEjemplo.utc_ms + utcExtra,
  ultimo_paquete_hace_ms: haceMs,
});
const sinPlano = <T>(x: T): T => JSON.parse(JSON.stringify(x));

let cliente: Cliente | null = null;
afterEach(() => {
  cliente?.detener();
  cliente = null;
  vi.useRealTimers();
});

interface Banco {
  tiempo: TiempoFalso;
  servidor: ServidorFalso;
  cliente: Cliente;
}

async function arrancar(
  snapshot: Snapshot = snapshotEjemplo,
  preparar?: (s: ServidorFalso) => void,
  aleatorio = () => 0.5,
): Promise<Banco> {
  limpiarEstado();
  const tiempo = new TiempoFalso();
  tiempo.ahora = 5000;
  const servidor = new ServidorFalso(sinPlano(snapshot));
  preparar?.(servidor);
  cliente = iniciarCliente({
    mision: "demeter",
    base: "http://relay.prueba/api/",
    entorno: entornoDePrueba(tiempo, servidor.fetch, { aleatorio }),
  });
  await asentar();
  return { tiempo, servidor, cliente };
}

describe("esperaReconexionMs, leerRetryAfterMs y leerEdadCacheMs", () => {
  it("retroceso exponencial 1, 2, 4, 8 s con tope WEB_RECONEXION_MAX_S", () => {
    const sinJitter = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => esperaReconexionMs(n, 0.999999999) / MS);
    expect(sinJitter.map(Math.round)).toEqual([1, 2, 4, 8, 15, 15, 15, 15]);
    for (const e of sinJitter) expect(e).toBeLessThanOrEqual(WEB_RECONEXION_MAX_S);
  });

  it("el jitter va de la mitad a la espera completa", () => {
    expect(esperaReconexionMs(3, 0)).toBe(2000);
    expect(esperaReconexionMs(3, 0.5)).toBe(3000);
    expect(esperaReconexionMs(100, 0)).toBe(WEB_RECONEXION_MAX_S * 500);
  });

  it("Retry-After es el piso, con un tope por si el encabezado es absurdo", () => {
    expect(esperaReconexionMs(1, 0, 7000)).toBe(7000);
    expect(esperaReconexionMs(1, 0, 100)).toBe(500);
    expect(leerRetryAfterMs("7")).toBe(7000);
    expect(leerRetryAfterMs("99999")).toBe(RETRY_AFTER_MAX_S * MS);
    expect(leerRetryAfterMs("Wed, 21 Oct 2026 07:28:00 GMT")).toBe(0);
    expect(leerRetryAfterMs(null)).toBe(0);
    expect(leerEdadCacheMs("3")).toBe(3000);
    expect(leerEdadCacheMs("x")).toBe(0);
  });
});

describe("arranque y costura snapshot/stream", () => {
  it("abre el stream, pide el snapshot, lo aplica y queda conectado", async () => {
    const { servidor } = await arrancar();
    expect(servidor.pedidosStream).toBe(1);
    expect(servidor.pedidosSnapshot).toBe(1);
    expect(servidor.conexiones[0]?.cabeceras.get("last-event-id")).toBeNull();
    expect(servidor.conexiones[0]?.cabeceras.get("accept")).toBe("text/event-stream");
    expect(api.conexion.value).toBe("conectado");
    expect(api.meta.value?.mision).toBe("demeter");
    expect(api.estado.value?.t_ms).toBe(T0);
    expect(api.serie.value.t_mas_s).toHaveLength(snapshotEjemplo.serie.t_mas_s.length);
  });

  it("antes del snapshot la página está en 'cargando' y no se aplica nada", async () => {
    const { servidor } = await arrancar(snapshotEjemplo, (s) => s.diferirSnapshot());
    servidor.ultima.escribir(sse("estado", estadoEn(T0 + 111), "1"));
    await asentar();
    expect(api.conexion.value).toBe("cargando");
    expect(api.estado.value).toBeNull();
    expect(api.estadoPagina.value.principal).toBe("cargando");
  });

  it("lo que llega mientras se pide el snapshot se reproduce solo si es posterior a él", async () => {
    let liberar = () => {};
    const { servidor, cliente: c } = await arrancar(snapshotEjemplo, (s) => {
      liberar = s.diferirSnapshot();
    });
    const flujo = servidor.ultima;
    flujo.escribir(sse("meta", metaEjemplo)); // la bienvenida, sin id
    flujo.escribir(sse("estado", estadoEn(T0 - 100), "1")); // anterior: ya está en el snapshot
    flujo.escribir(sse("estado", estadoEn(T0), "2")); // igual: es el del snapshot
    flujo.escribir(sse("estado", estadoEn(T0 + 111), "3")); // posterior
    flujo.escribir(sse("estado", estadoEn(T0 + 222), "4")); // posterior
    flujo.escribir(sse("evento", eventoEjemplo, "5")); // ya está en el snapshot
    const eyeccion = { ...eventoEjemplo, tipo: "eyeccion", valor: null, t_ms: T0 + 150 };
    flujo.escribir(sse("evento", eyeccion, "6")); // nuevo
    flujo.escribir(sse("estacion", estacionCon(40, 1000), "7")); // posterior
    flujo.escribir(sse("salud", saludEjemplo, "8")); // igual al del snapshot
    await asentar();
    liberar();
    await asentar();

    expect(api.conexion.value).toBe("conectado");
    expect(api.estado.value?.t_ms).toBe(T0 + 222);
    expect(api.eventos.value.map((e) => e.tipo)).toEqual(["apogeo", "fase", "eyeccion"]);
    expect(api.estacion.value?.ultimo_paquete_hace_ms).toBe(40);
    // la serie: la del snapshot + los dos estados posteriores
    expect(api.serie.value.t_mas_s).toHaveLength(snapshotEjemplo.serie.t_mas_s.length + 2);
    const st = c.estadisticas();
    expect(st.aplicados.estado).toBe(2);
    expect(st.aplicados.evento).toBe(1);
    expect(st.aplicados.estacion).toBe(1);
    expect(st.aplicados.salud).toBe(0);
    expect(st.ultimoId).toBe("8");
  });

  it("después del snapshot todo se aplica al llegar", async () => {
    const { servidor } = await arrancar();
    servidor.ultima.escribir(sse("estado", estadoEn(T0 + 111), "1"));
    await asentar();
    expect(api.estado.value?.t_ms).toBe(T0 + 111);
    servidor.ultima.escribir(sse("estado", estadoEn(T0 + 222), "2"));
    await asentar();
    expect(api.estado.value?.t_ms).toBe(T0 + 222);
    expect(api.serie.value.t_mas_s).toHaveLength(snapshotEjemplo.serie.t_mas_s.length + 2);
  });

  it("alimenta el interpolador con el estado del snapshot y con cada estado nuevo", async () => {
    const { servidor, tiempo } = await arrancar();
    expect(interpolador.tamano).toBe(1);
    servidor.ultima.escribir(sse("estado", estadoEn(T0 + 111), "1"));
    await asentar();
    expect(interpolador.tamano).toBe(2);
    expect(interpolador.muestrear(tiempo.ahora)).not.toBeNull();
  });

  it("el T+ de los puntos nuevos usa el despegue del snapshot", async () => {
    const tDespegue = T0 - 20_000;
    const snap: Snapshot = {
      ...snapshotEjemplo,
      eventos: [
        {
          tipo: "despegue",
          t_ms: tDespegue,
          utc_ms: null,
          t_mas_s: 0,
          valor: null,
          fase: null,
          activa: null,
        },
      ],
    };
    const { servidor } = await arrancar(snap);
    servidor.ultima.escribir(sse("estado", estadoEn(T0 + 1000), "1"));
    await asentar();
    expect(api.serie.value.t_mas_s.at(-1)).toBe(21);
  });
});

describe("cursor opaco (Last-Event-ID)", () => {
  it("guarda el último id tal cual y el meta de bienvenida (sin id) no lo mueve", async () => {
    const { servidor, cliente: c } = await arrancar();
    const flujo = servidor.ultima;
    flujo.escribir(sse("estado", estadoEn(T0 + 111), "0007-abc"));
    flujo.escribir(sse("meta", metaEjemplo)); // sin id
    await asentar();
    expect(c.estadisticas().ultimoId).toBe("0007-abc");
  });

  it("al reconectar devuelve ese id en Last-Event-ID, sin interpretarlo", async () => {
    const { servidor, tiempo } = await arrancar();
    servidor.ultima.escribir(sse("estado", estadoEn(T0 + 111), "xyz/9"));
    await asentar();
    servidor.ultima.cerrar();
    await asentar();
    expect(api.conexion.value).toBe("reconectando");
    tiempo.avanzar(1000);
    await asentar();
    expect(servidor.pedidosStream).toBe(2);
    expect(servidor.ultima.cabeceras.get("last-event-id")).toBe("xyz/9");
    expect(api.conexion.value).toBe("conectado");
  });
});

describe("reconexión con retroceso", () => {
  it("cuando el servidor cierra: 'reconectando', datos conservados y reintento tras la espera", async () => {
    const { servidor, tiempo, cliente: c } = await arrancar();
    servidor.ultima.cerrar();
    await asentar();
    expect(api.conexion.value).toBe("reconectando");
    expect(api.estadoPagina.value.principal).toBe("sin_servidor");
    expect(api.estado.value?.t_ms).toBe(T0); // los datos se mantienen (03 §4)
    expect(c.estadisticas().esperasMs).toEqual([750]); // 1 s con el jitter en 0,75
    tiempo.avanzar(749);
    await asentar();
    expect(servidor.pedidosStream).toBe(1);
    tiempo.avanzar(1);
    await asentar();
    expect(servidor.pedidosStream).toBe(2);
    expect(api.conexion.value).toBe("conectado");
  });

  it("con 503 seguidos la espera sube 1, 2, 4, 8 y se queda en el tope", async () => {
    const {
      servidor,
      tiempo,
      cliente: c,
    } = await arrancar(snapshotEjemplo, (s) => {
      s.respuestaStream = () => new Response("caído", { status: 503 });
    });
    for (let i = 0; i < 7; i++) {
      const esperas = c.estadisticas().esperasMs;
      tiempo.avanzar(esperas[esperas.length - 1] ?? 0);
      await asentar();
    }
    const esperas = c.estadisticas().esperasMs;
    expect(esperas.slice(0, 7)).toEqual([750, 1500, 3000, 6000, 11250, 11250, 11250]);
    expect(servidor.pedidosStream).toBe(8);
    expect(api.conexion.value).toBe("reconectando");
    expect(c.estadisticas().ultimoError).toContain("503");
  });

  it("nunca espera más de WEB_RECONEXION_MAX_S aun con el jitter al máximo", async () => {
    const { tiempo, cliente: c } = await arrancar(
      snapshotEjemplo,
      (s) => {
        s.respuestaStream = () => new Response("caído", { status: 503 });
      },
      () => 0.999999,
    );
    for (let i = 0; i < 9; i++) {
      const e = c.estadisticas().esperasMs;
      tiempo.avanzar(e[e.length - 1] ?? 0);
      await asentar();
    }
    for (const e of c.estadisticas().esperasMs) {
      expect(e).toBeLessThanOrEqual(WEB_RECONEXION_MAX_S * MS);
    }
  });

  it("respeta Retry-After del 503 como espera mínima", async () => {
    const {
      servidor,
      tiempo,
      cliente: c,
    } = await arrancar(snapshotEjemplo, (s) => {
      s.respuestaStream = () =>
        new Response("caído", { status: 503, headers: { "Retry-After": "7" } });
    });
    expect(c.estadisticas().esperasMs).toEqual([7000]);
    tiempo.avanzar(6999);
    await asentar();
    expect(servidor.pedidosStream).toBe(1);
    tiempo.avanzar(1);
    await asentar();
    expect(servidor.pedidosStream).toBe(2);
  });

  it("un Retry-After absurdo se limita a RETRY_AFTER_MAX_S", async () => {
    const { cliente: c } = await arrancar(snapshotEjemplo, (s) => {
      s.respuestaStream = () =>
        new Response("caído", { status: 503, headers: { "Retry-After": "86400" } });
    });
    expect(c.estadisticas().esperasMs).toEqual([RETRY_AFTER_MAX_S * MS]);
  });

  it("si es el snapshot el que responde 503, también respeta su Retry-After", async () => {
    const { cliente: c } = await arrancar(snapshotEjemplo, (s) => {
      s.respuestaSnapshot = () =>
        new Response("caído", { status: 503, headers: { "Retry-After": "9" } });
    });
    expect(c.estadisticas().esperasMs).toEqual([9000]);
    expect(api.conexion.value).toBe("reconectando");
  });

  it("un error de red también reintenta", async () => {
    const { servidor, tiempo } = await arrancar(snapshotEjemplo, (s) => {
      s.respuestaStream = () => new TypeError("fetch failed");
    });
    expect(api.conexion.value).toBe("reconectando");
    expect(api.estadoPagina.value.principal).toBe("sin_servidor");
    servidor.respuestaStream = null;
    tiempo.avanzar(750);
    await asentar();
    expect(api.conexion.value).toBe("conectado");
  });

  it("tras una sesión sana el retroceso vuelve a empezar", async () => {
    const { servidor, tiempo, cliente: c } = await arrancar();
    tiempo.avanzar((SESION_ESTABLE_S + 1) * MS);
    servidor.ultima.cerrar();
    await asentar();
    tiempo.avanzar(750);
    await asentar();
    // otra caída rápida: ahora es el segundo fallo seguido
    servidor.ultima.cerrar();
    await asentar();
    expect(c.estadisticas().esperasMs).toEqual([750, 1500]);
    tiempo.avanzar(1500);
    await asentar();
    tiempo.avanzar((SESION_ESTABLE_S + 1) * MS);
    servidor.ultima.cerrar();
    await asentar();
    expect(c.estadisticas().esperasMs.at(-1)).toBe(750);
  });

  it("una respuesta 200 que no es un stream (el HTML de un proxy mal puesto) es un error", async () => {
    const { cliente: c } = await arrancar(snapshotEjemplo, (s) => {
      s.respuestaStream = () =>
        new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
    });
    expect(c.estadisticas().ultimoError).toContain("tipo de contenido");
    expect(api.conexion.value).toBe("reconectando");
  });

  it("un snapshot con otra forma es un error, no un estado roto", async () => {
    const { cliente: c } = await arrancar(snapshotEjemplo, (s) => {
      s.snapshot = { hola: 1 };
    });
    expect(c.estadisticas().ultimoError).toContain("web-1");
    expect(api.meta.value).toBeNull();
  });

  it("si el snapshot no llega en SNAPSHOT_TIMEOUT_S, la sesión se rehace", async () => {
    const { servidor, tiempo } = await arrancar(snapshotEjemplo, (s) => s.diferirSnapshot());
    tiempo.avanzar(SNAPSHOT_TIMEOUT_S * MS - 1);
    await asentar();
    expect(api.conexion.value).toBe("cargando");
    tiempo.avanzar(1);
    await asentar();
    expect(api.conexion.value).toBe("reconectando");
    expect(servidor.conexiones[0]?.abortada).toBe(true);
  });

  it("si el stream se queda mudo SSE_SILENCIO_MS (2 latidos) se da por muerto", async () => {
    const { servidor, tiempo } = await arrancar();
    expect(SSE_SILENCIO_MS).toBe(2 * WEB_SSE_LATIDO_S * MS);
    tiempo.avanzar(SSE_SILENCIO_MS - 1000);
    servidor.ultima.escribir(": ping\n\n"); // cualquier byte cuenta
    await asentar();
    tiempo.avanzar(SSE_SILENCIO_MS - 1);
    await asentar();
    expect(api.conexion.value).toBe("conectado");
    tiempo.avanzar(1);
    await asentar();
    expect(api.conexion.value).toBe("reconectando");
    tiempo.avanzar(1000);
    await asentar();
    expect(servidor.pedidosStream).toBe(2);
    expect(api.conexion.value).toBe("conectado");
  });

  it("el búfer del snapshot tiene tope: si se desborda, la sesión se rehace", async () => {
    const { servidor } = await arrancar(snapshotEjemplo, (s) => s.diferirSnapshot());
    const grande = Array.from({ length: BUFFER_MAX_MENSAJES + 1 }, () =>
      sse("salud", saludEjemplo),
    ).join("");
    servidor.ultima.escribir(grande);
    await asentar();
    expect(api.conexion.value).toBe("reconectando");
  });
});

describe("la reconexión no duplica mensajes", () => {
  function snapshotHasta(t: number): Snapshot {
    const base = sinPlano(snapshotEjemplo);
    return { ...base, estado: estadoEn(t) };
  }

  it("lo que el servidor repite al reanudar y ya está en el snapshot no se aplica de nuevo", async () => {
    const { servidor, tiempo, cliente: c } = await arrancar();
    const f1 = servidor.ultima;
    f1.escribir(sse("estado", estadoEn(T0 + 111), "1"));
    f1.escribir(sse("evento", { ...eventoEjemplo, tipo: "eyeccion", valor: null }, "2"));
    await asentar();
    expect(api.eventos.value).toHaveLength(3);
    expect(api.serie.value.t_mas_s).toHaveLength(snapshotEjemplo.serie.t_mas_s.length + 1);

    // Cae. El snapshot del servidor ya incluye hasta T0+111 y el evento nuevo.
    f1.cerrar();
    await asentar();
    servidor.snapshot = {
      ...snapshotHasta(T0 + 111),
      eventos: [...snapshotEjemplo.eventos, { ...eventoEjemplo, tipo: "eyeccion", valor: null }],
    };
    tiempo.avanzar(750);
    await asentar();
    // Al reanudar, el servidor repite lo posterior al id "1" (el evento 2) y manda lo nuevo.
    const f2 = servidor.ultima;
    f2.escribir(sse("meta", metaEjemplo));
    f2.escribir(sse("estado", estadoEn(T0 + 111), "1"));
    f2.escribir(sse("evento", { ...eventoEjemplo, tipo: "eyeccion", valor: null }, "2"));
    f2.escribir(sse("estado", estadoEn(T0 + 222), "3"));
    await asentar();

    expect(api.estado.value?.t_ms).toBe(T0 + 222);
    expect(api.eventos.value.map((e) => e.tipo)).toEqual(["apogeo", "fase", "eyeccion"]);
    // un solo punto por estado: ninguno repetido
    const t = api.serie.value.t_mas_s;
    expect(new Set(t).size).toBe(t.length);
    expect(t).toHaveLength(snapshotEjemplo.serie.t_mas_s.length + 1);
    expect(c.estadisticas().sesiones).toBe(2);
  });

  it("en vivo, un estado, un evento, una salud o un latido repetidos se ignoran", async () => {
    const { servidor, cliente: c } = await arrancar();
    const f = servidor.ultima;
    const mensajes = [
      sse("estado", estadoEn(T0 + 111), "1"),
      sse("evento", eventoFaseEjemplo, "2"),
      sse("salud", { ...saludEjemplo, t_ms: saludEjemplo.t_ms + 1000 }, "3"),
      sse("estacion", estacionCon(10, 500), "4"),
    ];
    for (const m of mensajes) f.escribir(m);
    await asentar();
    const antes = c.estadisticas();
    for (const m of mensajes) f.escribir(m);
    await asentar();
    const despues = c.estadisticas();
    expect(despues.aplicados).toEqual({
      ...antes.aplicados,
      evento: 0, // el evento de fase ya estaba en el snapshot: nunca se aplicó
      estado: 1,
      salud: 1,
      estacion: 1,
    });
    expect(despues.duplicados).toBe(antes.duplicados + 4);
    expect(api.eventos.value).toHaveLength(2);
    const t = api.serie.value.t_mas_s;
    expect(t).toHaveLength(snapshotEjemplo.serie.t_mas_s.length + 1);
  });
});

describe("estadoPagina y edad con los umbrales WEB_* (03 §4)", () => {
  const snap = (haceMs: number | null): Snapshot => ({
    ...snapshotEjemplo,
    estacion: estacionCon(haceMs),
  });

  it("cambia justo en WEB_DATO_VIEJO_S y WEB_SIN_SENAL_S, al milisegundo del reloj local", async () => {
    const { tiempo } = await arrancar(snap(0));
    const principal = () => api.estadoPagina.value.principal;
    expect(principal()).toBe("en_vivo");
    expect(api.edad.value).toBe(0);
    tiempo.avanzar(WEB_DATO_VIEJO_S * MS - 100);
    expect(api.edad.value).toBe(WEB_DATO_VIEJO_S * MS - 100);
    expect(principal()).toBe("en_vivo");
    tiempo.avanzar(100);
    expect(api.edad.value).toBe(WEB_DATO_VIEJO_S * MS);
    expect(principal()).toBe("senal_debil");
    tiempo.avanzar((WEB_SIN_SENAL_S - WEB_DATO_VIEJO_S) * MS - 100);
    expect(principal()).toBe("senal_debil");
    tiempo.avanzar(100);
    expect(api.edad.value).toBe(WEB_SIN_SENAL_S * MS);
    expect(principal()).toBe("sin_senal");
  });

  it("un latido nuevo devuelve la página a 'en vivo' y la edad parte de su ultimo_paquete_hace_ms", async () => {
    const { servidor, tiempo } = await arrancar(snap(0));
    tiempo.avanzar(WEB_SIN_SENAL_S * MS);
    expect(api.estadoPagina.value.principal).toBe("sin_senal");
    servidor.ultima.escribir(sse("estacion", estacionCon(0, 5000), "1"));
    await asentar();
    expect(api.estadoPagina.value.principal).toBe("en_vivo");
    servidor.ultima.escribir(sse("estacion", estacionCon(1500, 6000), "2"));
    await asentar();
    expect(api.edad.value).toBe(1500);
    tiempo.avanzar(500);
    expect(api.estadoPagina.value.principal).toBe("senal_debil");
  });

  it("sin paquete del cohete (ultimo_paquete_hace_ms null) es 'sin transmisión'", async () => {
    await arrancar({ ...snapshotEjemplo, estacion: estacionCon(null) });
    expect(api.edad.value).toBeNull();
    expect(api.estadoPagina.value.principal).toBe("sin_transmision");
  });

  it("con el servidor caído manda 'sin servidor' y al volver recupera el estado del cohete", async () => {
    const { servidor, tiempo } = await arrancar(snap(0));
    servidor.ultima.cerrar();
    await asentar();
    expect(api.estadoPagina.value.principal).toBe("sin_servidor");
    tiempo.avanzar(750);
    await asentar();
    expect(api.conexion.value).toBe("conectado");
    // el snapshot nuevo trae la edad al día
    expect(["en_vivo", "senal_debil"]).toContain(api.estadoPagina.value.principal);
  });

  it("la edad no depende del reloj de pared del celular", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("1970-01-01T00:00:00Z"));
    const { tiempo } = await arrancar(snap(0));
    tiempo.avanzar(1500);
    vi.setSystemTime(new Date("2099-01-01T00:00:00Z")); // el celular cambia de hora
    expect(api.edad.value).toBe(1500);
    tiempo.avanzar(500);
    vi.setSystemTime(new Date("2001-01-01T00:00:00Z"));
    expect(api.edad.value).toBe(2000);
    expect(api.estadoPagina.value.principal).toBe("senal_debil");
  });

  it("si el snapshot vino de una caché (Age), esa edad se suma: nunca dice 'en vivo' de más", async () => {
    await arrancar(snap(0), (s) => {
      s.encabezadosSnapshot = { Age: "3" };
    });
    expect(api.edad.value).toBe(3000);
    expect(api.estadoPagina.value.principal).toBe("senal_debil");
  });

  it("al resincronizar con el MISMO latido, no lo rejuvenece: la edad sigue corriendo", async () => {
    const { servidor, tiempo } = await arrancar(snap(0));
    tiempo.avanzar(1500);
    expect(api.edad.value).toBe(1500);
    servidor.ultima.escribir(sse("backfill", { ...backfillEjemplo, completo: true }, "1"));
    await asentar(); // pide el snapshot, que trae el mismo latido
    expect(servidor.pedidosSnapshot).toBe(2);
    expect(api.edad.value).toBe(1500);
    tiempo.avanzar(500);
    expect(api.estadoPagina.value.principal).toBe("senal_debil");
  });

  it("el estado de la página sigue la fase y los avisos del snapshot", async () => {
    await arrancar({
      ...snapshotEjemplo,
      meta: { ...metaEjemplo, modo: "simulacion" },
      backfill: backfillEjemplo,
    });
    const p = api.estadoPagina.value;
    expect(p.simulacion).toBe(true);
    expect(p.reconstruyendo).toBe(true);
  });
});

describe("resincronización", () => {
  it("si el t_ms del estado retrocede (otro vuelo) vuelve a pedir el snapshot y no mezcla vuelos", async () => {
    const { servidor, cliente: c } = await arrancar();
    const nuevoVuelo: Snapshot = {
      ...snapshotVacioEjemplo,
      meta: { ...metaEjemplo, mission_id: null },
      estado: estadoEn(T0 - 600_000),
      eventos: [],
    };
    servidor.snapshot = nuevoVuelo;
    servidor.ultima.escribir(sse("estado", estadoEn(T0 - 599_000), "9"));
    await asentar();
    expect(servidor.pedidosSnapshot).toBe(2);
    expect(c.estadisticas().resincronizaciones).toBe(1);
    expect(api.eventos.value).toEqual([]); // los del vuelo anterior ya no están
    expect(api.estado.value?.t_ms).toBe(T0 - 599_000); // el que disparó, reproducido tras el snapshot
    expect(api.serie.value.t_mas_s).toHaveLength(1);
    expect(api.conexion.value).toBe("conectado");
  });

  it("si el servidor insiste en retroceder, tras RESYNC_MAX_SEGUIDOS acepta el retroceso", async () => {
    const { servidor } = await arrancar();
    for (let i = 1; i <= RESYNC_MAX_SEGUIDOS + 1; i++) {
      servidor.ultima.escribir(sse("estado", estadoEn(T0 - i * 1000), String(i)));
      await asentar();
    }
    expect(servidor.pedidosSnapshot).toBe(1 + RESYNC_MAX_SEGUIDOS);
    expect(api.estado.value?.t_ms).toBe(T0 - (RESYNC_MAX_SEGUIDOS + 1) * 1000);
  });

  it("un meta con otro mission_id (no nulo) pide el snapshot; pasar de null a un valor no", async () => {
    const { servidor } = await arrancar({
      ...snapshotEjemplo,
      meta: { ...metaEjemplo, mission_id: null },
    });
    servidor.ultima.escribir(sse("meta", { ...metaEjemplo, mission_id: 111 }, "1")); // ARM
    await asentar();
    expect(servidor.pedidosSnapshot).toBe(1);
    expect(api.meta.value?.mission_id).toBe(111);
    servidor.ultima.escribir(sse("meta", { ...metaEjemplo, mission_id: 222 }, "2")); // otra misión
    await asentar();
    expect(servidor.pedidosSnapshot).toBe(2);
  });

  it("al completarse el backfill vuelve a pedir el snapshot y reemplaza la trayectoria", async () => {
    const { servidor } = await arrancar({ ...snapshotEjemplo, backfill: backfillEjemplo });
    const completo: Snapshot = {
      ...sinPlano(snapshotEjemplo),
      backfill: { ...backfillEjemplo, recibidos: 850, progreso: 1, activo: false, completo: true },
      serie: {
        ...snapshotEjemplo.serie,
        t_mas_s: [...snapshotEjemplo.serie.t_mas_s, 21, 22, 23],
        lat: [...snapshotEjemplo.serie.lat, 1, 2, 3],
        lon: [...snapshotEjemplo.serie.lon, 1, 2, 3],
        alt_agl_m: [...snapshotEjemplo.serie.alt_agl_m, 1, 2, 3],
        vz_ms: [...snapshotEjemplo.serie.vz_ms, 1, 2, 3],
        acc_x_g: [...snapshotEjemplo.serie.acc_x_g, 1, 2, 3],
        acc_y_g: [...snapshotEjemplo.serie.acc_y_g, 1, 2, 3],
        acc_z_g: [...snapshotEjemplo.serie.acc_z_g, 1, 2, 3],
      },
    };
    servidor.snapshot = completo;
    servidor.ultima.escribir(sse("backfill", { ...backfillEjemplo, recibidos: 700 }, "1"));
    await asentar();
    expect(servidor.pedidosSnapshot).toBe(1); // en curso: no hace falta
    servidor.ultima.escribir(sse("backfill", completo.backfill, "2"));
    await asentar();
    expect(servidor.pedidosSnapshot).toBe(2);
    expect(api.serie.value.t_mas_s).toHaveLength(snapshotEjemplo.serie.t_mas_s.length + 3);
    expect(api.backfill.value?.completo).toBe(true);
    expect(api.estadoPagina.value.reconstruyendo).toBe(false);
  });
});

describe("robustez", () => {
  it("ignora lo que no es JSON o es de un tipo desconocido, y sigue", async () => {
    const { servidor, cliente: c } = await arrancar();
    servidor.ultima.escribir("event: estado\ndata: {no es json\n\n");
    servidor.ultima.escribir('event: de_otra_version\ndata: {"x":1}\n\n');
    servidor.ultima.escribir('event: estado\ndata: "texto"\n\n');
    servidor.ultima.escribir(sse("estado", estadoEn(T0 + 111), "1"));
    await asentar();
    expect(c.estadisticas().descartados).toBe(3);
    expect(api.estado.value?.t_ms).toBe(T0 + 111);
    expect(api.conexion.value).toBe("conectado");
  });

  it("detener() aborta el stream y no vuelve a conectar", async () => {
    const { servidor, tiempo, cliente: c } = await arrancar();
    c.detener();
    await asentar();
    expect(servidor.conexiones[0]?.abortada).toBe(true);
    tiempo.avanzar(120 * MS);
    await asentar();
    expect(servidor.pedidosStream).toBe(1);
    expect(tiempo.pendientes).toBe(0);
  });

  it("detener() durante la espera de la reconexión también la cancela", async () => {
    const { servidor, tiempo, cliente: c } = await arrancar();
    servidor.ultima.cerrar();
    await asentar();
    c.detener();
    tiempo.avanzar(120 * MS);
    await asentar();
    expect(servidor.pedidosStream).toBe(1);
  });

  it("reiniciarSesion() reconecta ya, sin esperar y sin mostrar 'reconectando'", async () => {
    const { servidor, cliente: c } = await arrancar();
    const vistos: string[] = [];
    const parar = effect(() => {
      vistos.push(api.conexion.value);
    });
    c.reiniciarSesion();
    await asentar();
    parar();
    expect(servidor.pedidosStream).toBe(2);
    expect(servidor.pedidosSnapshot).toBe(2);
    expect(vistos).not.toContain("reconectando");
    expect(api.conexion.value).toBe("conectado");
  });

  it("al volver a la pestaña (visibilitychange) rehace la sesión, también si estaba esperando", async () => {
    limpiarEstado();
    const tiempo = new TiempoFalso();
    const servidor = new ServidorFalso(sinPlano(snapshotEjemplo));
    let alVolver = () => {};
    cliente = iniciarCliente({
      mision: "demeter",
      base: "http://relay.prueba/api",
      entorno: entornoDePrueba(tiempo, servidor.fetch, {
        alVolverVisible: (f) => {
          alVolver = f;
          return () => {};
        },
      }),
    });
    await asentar();
    servidor.ultima.cerrar();
    await asentar();
    expect(api.conexion.value).toBe("reconectando");
    alVolver(); // sin avanzar el reloj: no espera el retroceso
    await asentar();
    expect(servidor.pedidosStream).toBe(2);
    expect(api.conexion.value).toBe("conectado");
  });

  it("construye las URL desde la base, sin barras de más", async () => {
    limpiarEstado();
    const tiempo = new TiempoFalso();
    const servidor = new ServidorFalso(sinPlano(snapshotEjemplo));
    const urls: string[] = [];
    cliente = iniciarCliente({
      mision: "hermes",
      base: "/api///",
      entorno: entornoDePrueba(tiempo, async (u, i) => {
        urls.push(String(u));
        return servidor.fetch(u, i);
      }),
    });
    await asentar();
    expect(urls.sort()).toEqual(["/api/v1/hermes/snapshot", "/api/v1/hermes/stream"]);
  });

  it("iniciar un cliente nuevo detiene al anterior", async () => {
    const { servidor, cliente: a } = await arrancar();
    const b = iniciarCliente({
      mision: "demeter",
      base: "http://relay.prueba/api",
      entorno: entornoDePrueba(new TiempoFalso(), servidor.fetch),
    });
    cliente = b;
    await asentar();
    expect(servidor.conexiones[0]?.abortada).toBe(true);
    a.detener(); // idempotente
  });

  it("las signals de lectura de api.ts no cambiaron de forma (la interfaz congelada)", () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        "alimentar",
        "backfill",
        "conexion",
        "edad",
        "estacion",
        "estadoPagina",
        "estado",
        "eventos",
        "meta",
        "salud",
        "serie",
        "vueloCompletoUrl",
      ].sort(),
    );
  });
});
