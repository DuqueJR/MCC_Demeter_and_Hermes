// Simulación para el público (T-635): el guion versionado, el reproductor, el control (empezar,
// salir, cortar al primer dato real) y su convivencia con el cliente de datos real (T-631).
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  COLA_TRAS_ATERRIZAJE_MS,
  generarTexto,
  PRESUPUESTO_BYTES,
  RUTA_DESTINO,
  RUTA_ORIGEN,
} from "../scripts/generar-simulacion.mjs";
import {
  backfillEjemplo,
  estacionEjemplo,
  estadoEjemplo,
  metaEjemplo,
  saludEjemplo,
  snapshotEjemplo,
  snapshotVacioEjemplo,
} from "../src/contrato/ejemplos";
import type { Snapshot } from "../src/contrato/tipos";
import * as api from "../src/datos/api";
import { iniciarCliente } from "../src/datos/cliente";
import {
  compuerta,
  esDatoRealDelCohete,
  simulacionLocal,
  snapshotTieneDatoReal,
} from "../src/datos/compuerta";
import { faseSimulacion, iniciarSimulacion, salirDeSimulacion } from "../src/simulacion/control";
import { descargarGuion, esGuion, FORMATO_SIMULACION, type Guion } from "../src/simulacion/guion";
import { Reproductor } from "../src/simulacion/reproductor";
import {
  asentar,
  entornoDePrueba,
  limpiarEstado,
  ServidorFalso,
  sse,
  TiempoFalso,
} from "./ayuda_cliente";

const MS = 1000;
const textoGuion = readFileSync(RUTA_DESTINO, "utf8");
const guionReal = JSON.parse(textoGuion) as Guion;
const sinPlano = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** El instante (ms del guion) del primer mensaje que cumple `f`. */
const instante = (f: (l: Guion["lineas"][number]) => boolean) =>
  (guionReal.lineas.find(f)?.t_rel_ms ?? Number.NaN) as number;
const T_DESPEGUE = instante((l) => l.evento === "evento" && l.datos.tipo === "despegue");
const T_ATERRIZAJE = instante((l) => l.evento === "evento" && l.datos.tipo === "aterrizaje");

beforeEach(() => {
  salirDeSimulacion();
  limpiarEstado();
});
afterEach(() => {
  salirDeSimulacion();
});

describe("el guion versionado", () => {
  it("coincide con lo que genera el script desde el JSONL nominal (reproducible)", () => {
    expect(textoGuion).toBe(generarTexto(readFileSync(RUTA_ORIGEN, "utf8")));
  });

  it("pesa unos cientos de KB como máximo", () => {
    expect(Buffer.byteLength(textoGuion)).toBeLessThanOrEqual(PRESUPUESTO_BYTES);
    expect(PRESUPUESTO_BYTES).toBeLessThanOrEqual(400 * 1024);
  });

  it("es un guion válido, de Deméter, con todos sus meta en modo simulación", () => {
    expect(esGuion(guionReal)).toBe(true);
    expect(guionReal.mision).toBe("demeter");
    const metas = guionReal.lineas.filter((l) => l.evento === "meta");
    expect(metas.length).toBeGreaterThan(0);
    for (const m of metas) {
      if (m.evento === "meta") expect(m.datos.modo).toBe("simulacion");
    }
    // El aislamiento (D-W01): nada de Hermes dentro del archivo de Deméter.
    expect(textoGuion.toLowerCase()).not.toContain("hermes");
  });

  it("trae el vuelo completo de OpenRocket: despegue, apogeo de ~670 m y aterrizaje", () => {
    const eventos = guionReal.lineas.flatMap((l) => (l.evento === "evento" ? [l.datos] : []));
    const tipos = eventos.map((e) => e.tipo);
    for (const t of ["despegue", "fin_combustion", "eyeccion", "apogeo", "aterrizaje"]) {
      expect(tipos).toContain(t);
    }
    expect(eventos.find((e) => e.tipo === "apogeo")?.valor).toBeCloseTo(669.3, 0);
    const fases = guionReal.lineas.flatMap((l) => (l.evento === "estado" ? [l.datos.fase] : []));
    expect(new Set(fases)).toEqual(
      new Set(["PREFLIGHT", "ARMED", "BOOST", "COAST", "APOGEE", "DESCENT", "LANDED"]),
    );
    // Después del aterrizaje solo queda la cola (el resto se recorta).
    expect(guionReal.duracion_ms).toBeLessThanOrEqual(T_ATERRIZAJE + COLA_TRAS_ATERRIZAJE_MS);
  });

  it("en vuelo hay algunos estados por segundo y siempre el primero de cada fase", () => {
    const estados = guionReal.lineas.filter((l) => l.evento === "estado");
    const enVuelo = estados.filter(
      (l) => l.evento === "estado" && ["BOOST", "COAST"].includes(l.datos.fase),
    );
    expect(enVuelo.length).toBeGreaterThan(3);
    const primeros = new Map<string, number>();
    for (const l of estados) {
      if (l.evento === "estado" && !primeros.has(l.datos.fase)) primeros.set(l.datos.fase, 1);
    }
    expect(primeros.size).toBe(7);
  });
});

describe("esGuion", () => {
  const base = (): Guion => sinPlano(guionReal);

  it("rechaza un meta que no sea simulación: nunca puede pasar por real", () => {
    const g = base();
    const meta = g.lineas.find((l) => l.evento === "meta");
    if (meta?.evento === "meta") meta.datos.modo = "vivo";
    expect(esGuion(g)).toBe(false);
  });

  it("rechaza otro formato, tiempos que retroceden, mensajes raros y guiones sin meta", () => {
    expect(esGuion({ ...base(), formato: "otro" })).toBe(false);
    expect(esGuion(null)).toBe(false);
    expect(esGuion({ ...base(), lineas: [] })).toBe(false);
    const retrocede = base();
    const ultima = retrocede.lineas[retrocede.lineas.length - 1];
    if (ultima) ultima.t_rel_ms = 0;
    expect(esGuion(retrocede)).toBe(false);
    const raro = base();
    raro.lineas.push({ t_rel_ms: 1e9, evento: "otro", datos: {} } as never);
    expect(esGuion(raro)).toBe(false);
    const sinMeta = base();
    sinMeta.lineas = sinMeta.lineas.filter((l) => l.evento !== "meta");
    expect(esGuion(sinMeta)).toBe(false);
    expect(esGuion({ ...base(), formato: FORMATO_SIMULACION })).toBe(true);
  });

  it("descargarGuion falla con un HTTP de error o con un contenido que no es un guion", async () => {
    const respuesta = (cuerpo: string, status = 200) =>
      (async () => new Response(cuerpo, { status })) as unknown as typeof fetch;
    await expect(descargarGuion("/x.json", respuesta("{}", 404))).rejects.toThrow("HTTP 404");
    await expect(descargarGuion("/x.json", respuesta('{"formato":"x"}'))).rejects.toThrow(
      "no es un guion válido",
    );
    await expect(descargarGuion("/x.json", respuesta(textoGuion))).resolves.toMatchObject({
      mision: "demeter",
    });
  });
});

describe("esDatoRealDelCohete y snapshotTieneDatoReal", () => {
  const llegadaMs = 0;
  it("un meta o un latido sin paquetes del cohete no son datos del cohete", () => {
    expect(esDatoRealDelCohete({ tipo: "meta", datos: metaEjemplo, llegadaMs })).toBe(false);
    expect(
      esDatoRealDelCohete({
        tipo: "estacion",
        datos: { ...estacionEjemplo, ultimo_paquete_hace_ms: null },
        llegadaMs,
      }),
    ).toBe(false);
  });

  it("un estado, una salud, un evento, un backfill o un latido con paquete sí lo son", () => {
    expect(esDatoRealDelCohete({ tipo: "estado", datos: estadoEjemplo, llegadaMs })).toBe(true);
    expect(esDatoRealDelCohete({ tipo: "salud", datos: saludEjemplo, llegadaMs })).toBe(true);
    expect(esDatoRealDelCohete({ tipo: "backfill", datos: backfillEjemplo, llegadaMs })).toBe(true);
    expect(
      esDatoRealDelCohete({
        tipo: "estacion",
        datos: { ...estacionEjemplo, ultimo_paquete_hace_ms: 40 },
        llegadaMs,
      }),
    ).toBe(true);
  });

  it("el snapshot vacío no tiene datos del cohete; el de ejemplo, sí", () => {
    expect(snapshotTieneDatoReal(snapshotVacioEjemplo)).toBe(false);
    expect(
      snapshotTieneDatoReal({
        ...snapshotVacioEjemplo,
        estacion: { ...estacionEjemplo, ultimo_paquete_hace_ms: null },
      }),
    ).toBe(false);
    expect(snapshotTieneDatoReal(snapshotEjemplo)).toBe(true);
  });
});

describe("Reproductor", () => {
  function banco() {
    const tiempo = new TiempoFalso();
    tiempo.ahora = 1000;
    const r = new Reproductor(guionReal, {
      ahoraMs: () => tiempo.ahora,
      programar: tiempo.programar,
    });
    return { tiempo, r };
  }

  it("al iniciar ya hay un estado y un latido: sin pasar por 'sin transmisión'", () => {
    const { r } = banco();
    r.iniciar();
    expect(api.meta.value?.modo).toBe("simulacion");
    expect(api.estado.value?.fase).toBe("PREFLIGHT");
    expect(api.estacion.value).not.toBeNull();
    expect(api.conexion.value).toBe("conectado");
    const p = api.estadoPagina.value;
    expect(p.principal).toBe("en_vivo");
    expect(p.simulacion).toBe(true);
    r.detener();
  });

  it("emite el vuelo en orden: eventos, fases y la serie con T+ desde el despegue", () => {
    const { tiempo, r } = banco();
    r.iniciar();
    tiempo.avanzar(T_DESPEGUE + 5 * MS);
    expect(api.eventos.value.map((e) => e.tipo)).toContain("despegue");
    expect(api.estado.value?.fase).toBe("COAST");
    const s = api.serie.value;
    expect(s.t_mas_s.some((t) => t !== null && t > 0)).toBe(true);
    expect(s.t_mas_s[0]).toBeNull(); // antes del despegue no hay T+
    expect(Math.max(...s.alt_agl_m.map((a) => a ?? 0))).toBeGreaterThan(50);
    expect(r.terminado).toBe(false);
    r.detener();
  });

  it("llega al apogeo de ~670 m, aterriza y se queda en LANDED con aviso de aterrizado", () => {
    const { tiempo, r } = banco();
    r.iniciar();
    tiempo.avanzar(guionReal.duracion_ms + MS);
    expect(r.terminado).toBe(true);
    expect(api.estado.value?.fase).toBe("LANDED");
    expect(api.estadoPagina.value.aterrizado).toBe(true);
    const apogeo = Math.max(...api.serie.value.alt_agl_m.map((a) => a ?? 0));
    expect(apogeo).toBeGreaterThan(550);
    expect(apogeo).toBeLessThan(700);
    expect(api.eventos.value.map((e) => e.tipo)).toContain("aterrizaje");
    r.detener();
  });

  it("terminado, repite el latido: dos minutos después sigue 'en vivo', no 'sin señal'", () => {
    const { tiempo, r } = banco();
    r.iniciar();
    tiempo.avanzar(guionReal.duracion_ms + 120 * MS);
    expect(api.estadoPagina.value.principal).toBe("en_vivo");
    expect(api.estadoPagina.value.simulacion).toBe(true);
    expect((api.edad.value ?? Number.POSITIVE_INFINITY) < 2 * MS).toBe(true);
    r.detener();
  });

  it("aplica de una vez lo vencido si los temporizadores se atrasaron (pestaña en segundo plano)", () => {
    let ahora = 1000;
    let pendiente: (() => void) | null = null;
    const r = new Reproductor(guionReal, {
      ahoraMs: () => ahora,
      programar: (f) => {
        pendiente = f;
        return () => {};
      },
    });
    r.iniciar();
    ahora += T_ATERRIZAJE + 1;
    (pendiente as (() => void) | null)?.();
    expect(api.estado.value?.fase).toBe("LANDED");
    const tipos = api.eventos.value.map((e) => e.tipo);
    expect(tipos.indexOf("despegue")).toBeLessThan(tipos.indexOf("apogeo"));
    expect(tipos.indexOf("apogeo")).toBeLessThan(tipos.indexOf("aterrizaje"));
    r.detener();
  });

  it("detener() no deja temporizadores ni sigue escribiendo", () => {
    const { tiempo, r } = banco();
    r.iniciar();
    tiempo.avanzar(3 * MS);
    r.detener();
    const t = api.estado.value?.t_ms;
    tiempo.avanzar(30 * MS);
    expect(api.estado.value?.t_ms).toBe(t);
    expect(tiempo.pendientes).toBe(0);
  });
});

describe("control de la simulación", () => {
  let tiempo: TiempoFalso;
  const entorno = () => ({ ahoraMs: () => tiempo.ahora, programar: tiempo.programar });
  const cargarOk = async () => guionReal;

  beforeEach(() => {
    tiempo = new TiempoFalso();
    tiempo.ahora = 1000;
    // "Sin transmisión todavía": el servidor responde y nunca llegó nada del cohete.
    api.alimentar.snapshot(sinPlano(snapshotVacioEjemplo), tiempo.ahora);
    api.alimentar.conexion("conectado");
  });

  it("antes de pulsar, la página está en 'sin transmisión' y no hay simulación", () => {
    expect(api.estadoPagina.value.principal).toBe("sin_transmision");
    expect(faseSimulacion.value).toBe("inactiva");
    expect(simulacionLocal.value).toBe(false);
  });

  it("pulsar descarga, arranca y deja el banner y la marca SIM (meta.modo = simulacion)", async () => {
    const promesa = iniciarSimulacion(cargarOk, entorno());
    expect(faseSimulacion.value).toBe("cargando");
    await promesa;
    expect(faseSimulacion.value).toBe("corriendo");
    expect(simulacionLocal.value).toBe(true);
    expect(compuerta.activa()).toBe(true);
    expect(api.meta.value?.modo).toBe("simulacion");
    expect(api.estadoPagina.value.simulacion).toBe(true);
    tiempo.avanzar(T_DESPEGUE + 3 * MS);
    expect(api.estadoPagina.value.simulacion).toBe(true); // nunca desaparece mientras corre
  });

  it("pulsar dos veces seguidas no arranca dos simulaciones", async () => {
    let cargas = 0;
    const cargar = async () => {
      cargas++;
      return guionReal;
    };
    await Promise.all([iniciarSimulacion(cargar, entorno()), iniciarSimulacion(cargar, entorno())]);
    expect(cargas).toBe(1);
    expect(faseSimulacion.value).toBe("corriendo");
  });

  it("salir devuelve 'sin transmisión', sin rastros de la simulación ni temporizadores", async () => {
    await iniciarSimulacion(cargarOk, entorno());
    tiempo.avanzar(T_DESPEGUE + 3 * MS);
    expect(api.eventos.value.length).toBeGreaterThan(0);
    salirDeSimulacion();
    expect(faseSimulacion.value).toBe("inactiva");
    expect(simulacionLocal.value).toBe(false);
    expect(compuerta.activa()).toBe(false);
    expect(api.estado.value).toBeNull();
    expect(api.eventos.value).toEqual([]);
    expect(api.serie.value.t_mas_s).toEqual([]);
    expect(api.meta.value?.modo).toBe("vivo");
    expect(api.estadoPagina.value.principal).toBe("sin_transmision");
    expect(api.estadoPagina.value.simulacion).toBe(false);
    expect(tiempo.pendientes).toBe(0);
  });

  it("se puede volver a ver la simulación después de salir", async () => {
    await iniciarSimulacion(cargarOk, entorno());
    salirDeSimulacion();
    await iniciarSimulacion(cargarOk, entorno());
    expect(faseSimulacion.value).toBe("corriendo");
    expect(api.estado.value?.fase).toBe("PREFLIGHT");
  });

  it("si la descarga falla queda en 'error' y se puede reintentar", async () => {
    await iniciarSimulacion(async () => {
      throw new Error("sin red");
    }, entorno());
    expect(faseSimulacion.value).toBe("error");
    expect(compuerta.activa()).toBe(false);
    expect(api.estadoPagina.value.simulacion).toBe(false);
    await iniciarSimulacion(cargarOk, entorno());
    expect(faseSimulacion.value).toBe("corriendo");
  });

  it("si mientras descarga llega un dato real, no se simula nada", async () => {
    let liberar: () => void = () => {};
    const lenta = () =>
      new Promise<Guion>((resolver) => {
        liberar = () => resolver(guionReal);
      });
    const promesa = iniciarSimulacion(lenta, entorno());
    api.alimentar.snapshot(sinPlano(snapshotEjemplo), tiempo.ahora); // el cohete empezó a transmitir
    liberar();
    await promesa;
    expect(faseSimulacion.value).toBe("inactiva");
    expect(compuerta.activa()).toBe(false);
    expect(api.meta.value?.modo).toBe("vivo");
    expect(api.estado.value?.t_ms).toBe(snapshotEjemplo.estado?.t_ms);
  });

  it("salir mientras descarga cancela el pedido", async () => {
    let liberar: () => void = () => {};
    const lenta = () =>
      new Promise<Guion>((resolver) => {
        liberar = () => resolver(guionReal);
      });
    const promesa = iniciarSimulacion(lenta, entorno());
    salirDeSimulacion();
    liberar();
    await promesa;
    expect(faseSimulacion.value).toBe("inactiva");
    expect(compuerta.activa()).toBe(false);
    expect(api.estado.value).toBeNull();
  });

  it("un guion sin meta (inválido para el reproductor) deja 'error' y la compuerta cerrada", async () => {
    const roto: Guion = {
      ...guionReal,
      lineas: guionReal.lineas.filter((l) => l.evento !== "meta"),
    };
    await iniciarSimulacion(async () => roto, entorno());
    expect(faseSimulacion.value).toBe("error");
    expect(compuerta.activa()).toBe(false);
  });
});

describe("convive con el cliente de datos real", () => {
  let tiempo: TiempoFalso;
  let servidor: ServidorFalso;
  let cliente: ReturnType<typeof iniciarCliente>;
  const entorno = () => ({ ahoraMs: () => tiempo.ahora, programar: tiempo.programar });
  const cargarOk = async () => guionReal;
  const latidoVacio = { ...estacionEjemplo, ultimo_paquete_hace_ms: null };

  async function arrancarSinTransmision(): Promise<void> {
    tiempo = new TiempoFalso();
    tiempo.ahora = 5000;
    servidor = new ServidorFalso(sinPlano(snapshotVacioEjemplo));
    cliente = iniciarCliente({
      mision: "demeter",
      base: "http://relay.prueba/api/",
      entorno: entornoDePrueba(tiempo, servidor.fetch),
    });
    await asentar();
    expect(api.estadoPagina.value.principal).toBe("sin_transmision");
  }

  afterEach(() => {
    cliente.detener();
  });

  it("mientras corre, ni el meta en vivo ni los latidos vacíos del relay pisan la simulación", async () => {
    await arrancarSinTransmision();
    await iniciarSimulacion(cargarOk, entorno());
    tiempo.avanzar(T_DESPEGUE + 3 * MS);
    const fase = api.estado.value?.fase;
    servidor.ultima.escribir(sse("meta", { ...metaEjemplo, modo: "vivo", mission_id: null }));
    servidor.ultima.escribir(sse("estacion", latidoVacio, "1"));
    await asentar();
    expect(faseSimulacion.value).toBe("corriendo");
    expect(api.meta.value?.modo).toBe("simulacion");
    expect(api.estado.value?.fase).toBe(fase);
    expect(api.estadoPagina.value.simulacion).toBe(true);
  });

  it("una caída del stream durante la simulación no la tapa con 'Sin servidor'", async () => {
    await arrancarSinTransmision();
    await iniciarSimulacion(cargarOk, entorno());
    servidor.ultima.cerrar();
    await asentar();
    expect(api.conexion.value).toBe("conectado");
    expect(api.estadoPagina.value.principal).toBe("en_vivo");
    expect(api.estadoPagina.value.simulacion).toBe(true);
  });

  it("el primer dato real del cohete corta la simulación y vuelve lo real", async () => {
    await arrancarSinTransmision();
    await iniciarSimulacion(cargarOk, entorno());
    tiempo.avanzar(T_DESPEGUE + 3 * MS);
    expect(servidor.pedidosSnapshot).toBe(1);

    // El cohete empieza a transmitir: el relay ya lo tiene en su snapshot y lo manda por el stream.
    servidor.snapshot = sinPlano(snapshotEjemplo);
    servidor.ultima.escribir(sse("estado", estadoEjemplo, "7"));
    await asentar();

    expect(faseSimulacion.value).toBe("inactiva");
    expect(simulacionLocal.value).toBe(false);
    expect(compuerta.activa()).toBe(false);
    expect(servidor.pedidosSnapshot).toBe(2); // el cliente rehízo la sesión
    expect(api.meta.value?.modo).toBe("vivo");
    expect(api.estado.value?.t_ms).toBe(estadoEjemplo.t_ms);
    expect(api.estadoPagina.value.simulacion).toBe(false);
    expect(tiempo.pendientes).toBeGreaterThan(0); // solo los del cliente real
  });

  it("un snapshot con datos reales (tras una reconexión) también la corta", async () => {
    await arrancarSinTransmision();
    await iniciarSimulacion(cargarOk, entorno());
    servidor.snapshot = sinPlano(snapshotEjemplo);
    servidor.ultima.cerrar(); // el stream se cae; el cliente reconectará con su retroceso
    await asentar();
    tiempo.avanzar(3 * MS);
    await asentar();
    expect(faseSimulacion.value).toBe("inactiva");
    expect(api.meta.value?.modo).toBe("vivo");
    expect(api.estado.value?.t_ms).toBe(estadoEjemplo.t_ms);
  });

  it("salir con el botón rehace la sesión del cliente (snapshot nuevo)", async () => {
    await arrancarSinTransmision();
    await iniciarSimulacion(cargarOk, entorno());
    salirDeSimulacion();
    await asentar();
    expect(servidor.pedidosSnapshot).toBe(2);
    expect(api.meta.value?.modo).toBe("vivo");
    expect(api.estadoPagina.value.principal).toBe("sin_transmision");
  });

  it("sin simulación, el cliente se comporta como siempre (la compuerta está cerrada)", async () => {
    await arrancarSinTransmision();
    servidor.ultima.escribir(
      sse("estacion", { ...latidoVacio, utc_ms: latidoVacio.utc_ms + 1000 }, "1"),
    );
    await asentar();
    expect(api.estacion.value?.utc_ms).toBe(latidoVacio.utc_ms + 1000);
    const instantanea: Snapshot = sinPlano(snapshotEjemplo);
    expect(instantanea.meta.modo).toBe("vivo");
  });
});
