// Los 6 escenarios de cada misión (`dev/datos/*.jsonl`) contra el repetidor de verdad (T-631).
// El cliente real habla HTTP por un puerto local con el servidor de T-630; el tiempo es falso y se
// mueve a mano (el del repetidor y el del cliente son el mismo), así que no se espera tiempo real.
//
// En cada paso se compara el cliente con un ORÁCULO: el mismo JSONL leído aparte, sin pasar por HTTP,
// SSE ni la costura. Si coinciden en cada paso (estado, salud, latido, eventos, serie, edad y
// `estadoPagina`), los estados de la página cambian exactamente en los umbrales `WEB_*` y la
// reconexión no duplica nada.
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REINTENTO_503_S } from "../dev/repetidor/constantes";
import { leerJsonl, type Mensaje } from "../dev/repetidor/jsonl";
import { crearRepetidor, type Repetidor } from "../dev/repetidor/servidor";
import type {
  Backfill,
  Estacion,
  Estado,
  Evento,
  Meta,
  Mision,
  Salud,
} from "../src/contrato/tipos";
import * as api from "../src/datos/api";
import { type Cliente, iniciarCliente } from "../src/datos/cliente";
import { WEB_SERIE_MAX_PUNTOS } from "../src/datos/constantes";
import { claveEvento } from "../src/datos/costura";
import { calcularEstadoPagina } from "../src/datos/estado_pagina";
import { RELOJ_TICK_MS } from "../src/datos/parametros";
import {
  asentar,
  entornoDePrueba,
  esperarHasta,
  limpiarEstado,
  TiempoFalso,
} from "./ayuda_cliente";

const DATOS = join(resolve(import.meta.dirname, ".."), "dev", "datos");
const MISIONES: readonly Mision[] = ["demeter", "hermes"];
const ESCENARIOS = [
  "nominal",
  "lkp_descenso",
  "descenso_rapido",
  "backfill",
  "espera_rampa",
  "relay_caido",
] as const;
type Escenario = (typeof ESCENARIOS)[number];

const INICIO_MS = 10_000;
/** Paso del reloj en las pruebas: múltiplo de RELOJ_TICK_MS (100), para que los ticks caigan en él. */
const PASO_MS: Record<Escenario, number> = {
  nominal: 500,
  lkp_descenso: 500,
  descenso_rapido: 500,
  backfill: 500,
  espera_rampa: 2000,
  relay_caido: 500,
};

/** Último instante virtual de la vuelta que cae en un tick del reloj del cliente (RELOJ_TICK_MS). */
const ultimoPasoAlineado = (periodoMs: number) =>
  Math.floor((periodoMs - 1) / RELOJ_TICK_MS) * RELOJ_TICK_MS;

// ---- El oráculo: lo que debería mostrarse, calculado del JSONL sin pasar por el cliente ----
class Oraculo {
  vuelta = 0;
  indice = 0;
  meta: Meta | null = null;
  estado: Estado | null = null;
  salud: Salud | null = null;
  estacion: Estacion | null = null;
  /** Instante local (reloj falso) en que "llegó" el último latido. */
  llegadaEstacionMs = 0;
  backfill: Backfill | null = null;
  eventos: Evento[] = [];
  nEstados = 0;
  readonly mensajes: Mensaje[];
  readonly periodoMs: number;

  constructor(mensajes: Mensaje[], periodoMs: number) {
    this.mensajes = mensajes;
    this.periodoMs = periodoMs;
  }

  /** Aplica todo lo que el repetidor ya emitió a `virtualMs`; `ahoraLocalMs` es el reloj local. */
  avanzarA(virtualMs: number, ahoraLocalMs: number): void {
    for (;;) {
      const m = this.mensajes[this.indice] as Mensaje;
      if (this.vuelta * this.periodoMs + m.t_rel_ms > virtualMs) return;
      if (this.indice === 0) this.reiniciar();
      this.aplicar(m, ahoraLocalMs);
      this.indice++;
      if (this.indice === this.mensajes.length) {
        this.indice = 0;
        this.vuelta++;
      }
    }
  }

  private reiniciar(): void {
    this.meta = this.estado = this.salud = this.estacion = this.backfill = null;
    this.eventos = [];
    this.nEstados = 0;
  }

  private aplicar(m: Mensaje, ahoraLocalMs: number): void {
    const l = m.linea;
    switch (l.evento) {
      case "meta":
        this.meta = l.datos;
        break;
      case "estado":
        this.estado = l.datos;
        this.nEstados++;
        break;
      case "salud":
        this.salud = l.datos;
        break;
      case "estacion":
        this.estacion = l.datos;
        this.llegadaEstacionMs = ahoraLocalMs;
        break;
      case "evento":
        if (!this.eventos.some((e) => claveEvento(e) === claveEvento(l.datos))) {
          this.eventos.push(l.datos);
        }
        break;
      case "backfill":
        this.backfill = l.datos;
        break;
    }
  }

  edadMs(ahoraLocalMs: number): number | null {
    const hace = this.estacion?.ultimo_paquete_hace_ms ?? null;
    return hace === null ? null : hace + Math.max(0, ahoraLocalMs - this.llegadaEstacionMs);
  }
}

// ---- El banco: repetidor + cliente + tiempo ----
interface Banco {
  tiempo: TiempoFalso;
  rep: Repetidor;
  cliente: Cliente;
  oraculo: Oraculo;
  /** Instante virtual (ms desde el arranque del repetidor). */
  virtual: number;
  periodoMs: number;
  mision: Mision;
}

let abiertos: { rep: Repetidor; cliente: Cliente }[] = [];
afterEach(async () => {
  for (const a of abiertos) {
    a.cliente.detener();
    await a.rep.cerrar();
  }
  abiertos = [];
});

async function levantar(mision: Mision, escenario: Escenario): Promise<Banco> {
  limpiarEstado();
  const tiempo = new TiempoFalso();
  tiempo.ahora = INICIO_MS;
  const ruta = join(DATOS, `${mision}_${escenario}.jsonl`);
  const rep = crearRepetidor({
    archivos: { [mision]: { escenario, ruta } },
    reloj: () => tiempo.ahora,
    temporizador: false,
    latidoMs: 3_600_000,
  });
  const puerto = await rep.escuchar(0, "127.0.0.1");
  const periodoMs = (rep.reproductores.get(mision) as { periodoMs: number }).periodoMs;
  const cliente = iniciarCliente({
    mision,
    base: `http://127.0.0.1:${puerto}/api`,
    entorno: entornoDePrueba(tiempo, (...a) => fetch(...a)),
  });
  abiertos.push({ rep, cliente });
  const oraculo = new Oraculo(leerJsonl(ruta), periodoMs);
  oraculo.avanzarA(0, tiempo.ahora);
  await esperarHasta(() => api.conexion.value === "conectado", "la primera conexión");
  return { tiempo, rep, cliente, oraculo, virtual: 0, periodoMs, mision };
}

/** Un paso: mueve el reloj, el repetidor emite, el oráculo aplica lo mismo. */
function avanzar(b: Banco, deltaMs: number): void {
  b.tiempo.avanzar(deltaMs);
  b.virtual += deltaMs;
  b.rep.avanzar();
  b.oraculo.avanzarA(b.virtual, b.tiempo.ahora);
}

const idDelCliente = (b: Banco) => Number(b.cliente.estadisticas().ultimoId ?? 0);
const idDelServidor = (b: Banco) =>
  (b.rep.reproductores.get(b.mision) as { ultimoId: number }).ultimoId;

/** ¿El cliente ya alcanzó al oráculo? (para esperar sin asumir cuánto tarda la E/S). */
function alDia(b: Banco): boolean {
  const o = b.oraculo;
  return (
    api.conexion.value === "conectado" &&
    (api.estado.value?.t_ms ?? null) === (o.estado?.t_ms ?? null) &&
    (api.salud.value?.t_ms ?? null) === (o.salud?.t_ms ?? null) &&
    (api.estacion.value?.utc_ms ?? null) === (o.estacion?.utc_ms ?? null) &&
    (api.backfill.value?.recibidos ?? null) === (o.backfill?.recibidos ?? null) &&
    api.eventos.value.length === o.eventos.length &&
    api.serie.value.t_mas_s.length === o.nEstados
  );
}

async function esperarAlDia(b: Banco): Promise<void> {
  await esperarHasta(
    () => (idDelCliente(b) === idDelServidor(b) || idDelServidor(b) === 0) && alDia(b),
    `que el cliente alcance al repetidor en V=${b.virtual}`,
  );
}

/** Todo lo que se ve debe ser igual a lo del oráculo, incluidos la edad y `estadoPagina`. */
function compararConOraculo(b: Banco, conEdad = true): void {
  const o = b.oraculo;
  const donde = `${b.mision} V=${b.virtual}`;
  expect(api.estado.value?.t_ms ?? null, `${donde}: estado`).toBe(o.estado?.t_ms ?? null);
  expect(api.salud.value?.t_ms ?? null, `${donde}: salud`).toBe(o.salud?.t_ms ?? null);
  expect(api.estacion.value?.utc_ms ?? null, `${donde}: latido`).toBe(o.estacion?.utc_ms ?? null);
  expect(api.meta.value?.mission_id ?? null, `${donde}: mission_id`).toBe(
    o.meta?.mission_id ?? null,
  );
  expect(api.eventos.value.map(claveEvento), `${donde}: eventos`).toEqual(
    o.eventos.map(claveEvento),
  );
  expect(api.serie.value.t_mas_s.length, `${donde}: puntos de la serie`).toBe(o.nEstados);
  if (!conEdad) return;
  const edad = o.edadMs(b.tiempo.ahora);
  expect(api.edad.value, `${donde}: edad`).toBe(edad);
  expect(api.estadoPagina.value, `${donde}: estadoPagina`).toEqual(
    calcularEstadoPagina({
      conexion: "conectado",
      meta: o.meta,
      estado: o.estado,
      estacion: o.estacion,
      backfill: o.backfill,
      edadMs: edad,
    }),
  );
}

interface Recorrido {
  principales: string[];
  avisos: { simulacion: boolean; aterrizado: boolean; reconstruyendo: boolean; alarma: boolean };
  pasos: number;
}

/** Recorre una vuelta entera del escenario comparando con el oráculo en cada paso. */
async function recorrerVuelta(b: Banco, paso: number): Promise<Recorrido> {
  const principales: string[] = [];
  const avisos = { simulacion: false, aterrizado: false, reconstruyendo: false, alarma: false };
  let pasos = 0;
  const final = ultimoPasoAlineado(b.periodoMs);
  while (b.virtual < final) {
    avanzar(b, Math.min(paso, final - b.virtual));
    await esperarAlDia(b);
    compararConOraculo(b);
    const p = api.estadoPagina.value;
    if (principales[principales.length - 1] !== p.principal) principales.push(p.principal);
    avisos.simulacion ||= p.simulacion;
    avisos.aterrizado ||= p.aterrizado;
    avisos.reconstruyendo ||= p.reconstruyendo;
    avisos.alarma ||= p.alarma_descenso;
    pasos++;
  }
  return { principales, avisos, pasos };
}

describe.each(MISIONES)("escenarios de %s contra el repetidor", (mision) => {
  it("nominal: los estados de la página siguen al oráculo y la reconexión no es necesaria", async () => {
    const b = await levantar(mision, "nominal");
    const r = await recorrerVuelta(b, PASO_MS.nominal);
    const st = b.cliente.estadisticas();
    expect(st.sesiones).toBe(1);
    expect(st.resincronizaciones).toBe(0);
    expect(st.duplicados).toBe(0);
    expect(st.descartados).toBe(0);
    expect(r.avisos.aterrizado).toBe(true);
    expect(r.avisos.simulacion).toBe(true); // los JSONL son simulación o sintéticos: nunca "vivo"
    expect(r.principales).toContain("en_vivo");
    // línea de fases en orden, con el despegue antes del apogeo y el aterrizaje al final
    const tipos = api.eventos.value.map((e) => e.tipo);
    expect(tipos.indexOf("despegue")).toBeGreaterThan(-1);
    expect(tipos.indexOf("despegue")).toBeLessThan(tipos.indexOf("apogeo"));
    expect(tipos.indexOf("apogeo")).toBeLessThan(tipos.indexOf("aterrizaje"));
    // la serie es una trayectoria en orden, con T+ que empieza en el despegue
    const t = api.serie.value.t_mas_s.filter((x): x is number => x !== null);
    expect(t.length).toBeGreaterThan(100);
    expect(t).toEqual([...t].sort((x, y) => x - y));
    expect(api.serie.value.lat).toHaveLength(api.serie.value.t_mas_s.length);
  });

  it("lkp_descenso: en vivo -> señal débil -> sin señal, en los tiempos de los umbrales", async () => {
    const b = await levantar(mision, "lkp_descenso");
    const r = await recorrerVuelta(b, PASO_MS.lkp_descenso);
    expect(r.principales).toContain("senal_debil");
    expect(r.principales).toContain("sin_senal");
    const orden = (s: string) => r.principales.indexOf(s);
    expect(orden("en_vivo")).toBeLessThan(orden("senal_debil"));
    expect(orden("senal_debil")).toBeLessThan(orden("sin_senal"));
    expect(b.cliente.estadisticas().sesiones).toBe(1);
  });

  it("descenso_rapido: la alarma de descenso aparece y queda el evento", async () => {
    const b = await levantar(mision, "descenso_rapido");
    const r = await recorrerVuelta(b, PASO_MS.descenso_rapido);
    expect(r.avisos.alarma).toBe(true);
    expect(api.eventos.value.some((e) => e.tipo === "alarma_descenso" && e.activa === true)).toBe(
      true,
    );
  });

  it("backfill: 'reconstruyendo' mientras llega, y al completarse pide el snapshot y lo reemplaza", async () => {
    const b = await levantar(mision, "backfill");
    const r = await recorrerVuelta(b, PASO_MS.backfill);
    const st = b.cliente.estadisticas();
    expect(r.avisos.reconstruyendo).toBe(true);
    expect(api.backfill.value?.completo).toBe(true);
    expect(api.estadoPagina.value.reconstruyendo).toBe(false);
    expect(st.resincronizaciones).toBe(1);
    expect(st.sesiones).toBe(1);
    expect(st.duplicados).toBe(0);
  });

  it("espera_rampa: 30 min en PREFLIGHT a 1 Hz, sin romper el tope de la serie", async () => {
    const b = await levantar(mision, "espera_rampa");
    const r = await recorrerVuelta(b, PASO_MS.espera_rampa);
    expect(api.estado.value?.fase).toBe("PREFLIGHT");
    expect(api.serie.value.t_mas_s.length).toBeLessThanOrEqual(WEB_SERIE_MAX_PUNTOS);
    expect(r.pasos).toBeGreaterThan(800);
    expect(r.principales).not.toContain("sin_servidor");
    expect(b.cliente.estadisticas().sesiones).toBe(1);
  });

  it("relay_caido: reconecta con retroceso respetando Retry-After y se pone al día sin duplicar", async () => {
    const b = await levantar(mision, "relay_caido");
    const principales: string[] = [];
    const conexiones: string[] = [];
    let datosVistosCaido = false;
    const final = ultimoPasoAlineado(b.periodoMs);
    while (b.virtual < final) {
      avanzar(b, Math.min(PASO_MS.relay_caido, final - b.virtual));
      await asentar(40);
      const p = api.estadoPagina.value.principal;
      if (principales[principales.length - 1] !== p) principales.push(p);
      if (conexiones[conexiones.length - 1] !== api.conexion.value) {
        conexiones.push(api.conexion.value);
      }
      if (api.conexion.value === "reconectando" && api.estado.value !== null)
        datosVistosCaido = true;
    }
    await esperarAlDia(b);
    compararConOraculo(b, false);

    const st = b.cliente.estadisticas();
    expect(conexiones).toContain("reconectando");
    expect(conexiones[conexiones.length - 1]).toBe("conectado");
    expect(principales).toContain("sin_servidor");
    expect(datosVistosCaido, "los datos se mantienen mientras se reconecta").toBe(true);
    expect(st.sesiones).toBeGreaterThanOrEqual(2);
    // la primera espera es el retroceso base; las siguientes, al menos el Retry-After del 503
    expect(st.esperasMs[0]).toBeLessThan(REINTENTO_503_S * 1000);
    expect(st.esperasMs.slice(1).some((e) => e >= REINTENTO_503_S * 1000)).toBe(true);
    expect(st.ultimoError ?? "").toContain("503");
    // y nada repetido: ni eventos ni puntos de la trayectoria
    const claves = api.eventos.value.map(claveEvento);
    expect(new Set(claves).size).toBe(claves.length);
    const t = api.serie.value.t_mas_s.filter((x): x is number => x !== null);
    expect(new Set(t).size).toBe(t.length);
    expect(t).toEqual([...t].sort((x, y) => x - y));
  });
});

describe("el cliente y el repetidor, casos de la consolidación de T-630", () => {
  it("reanudar con Last-Event-ID: lo emitido mientras estaba caído llega una sola vez", async () => {
    const b = await levantar("demeter", "nominal");
    // hasta medio vuelo
    while (b.virtual < 30_000) {
      avanzar(b, PASO_MS.nominal);
      await esperarAlDia(b);
    }
    compararConOraculo(b);
    const antes = b.cliente.estadisticas();
    // el cliente se cae y el repetidor sigue emitiendo 4 s sin que nadie escuche
    b.cliente.reiniciarSesion();
    avanzar(b, 4000);
    await esperarAlDia(b);
    compararConOraculo(b);
    const despues = b.cliente.estadisticas();
    expect(despues.sesiones).toBe(antes.sesiones + 1);
    expect(despues.duplicados).toBe(antes.duplicados);
    // seguir normal
    while (b.virtual < 60_000) {
      avanzar(b, PASO_MS.nominal);
      await esperarAlDia(b);
      compararConOraculo(b);
    }
  });

  it("el cursor es el id del SSE: la bienvenida (meta sin id) no lo mueve", async () => {
    const b = await levantar("hermes", "nominal");
    avanzar(b, 3000);
    await esperarAlDia(b);
    const id = b.cliente.estadisticas().ultimoId;
    expect(id).toMatch(/^\d+$/);
    b.cliente.reiniciarSesion(); // el servidor manda un meta de bienvenida (sin id)
    await asentar(60);
    expect(b.cliente.estadisticas().ultimoId).toBe(id);
  });

  it("al dar la vuelta el snapshot se reinicia: el cliente se resincroniza y no mezcla las dos vueltas", async () => {
    const b = await levantar("demeter", "nominal");
    const paso = PASO_MS.nominal;
    // una vuelta entera y 20 s de la siguiente
    while (b.virtual < b.periodoMs + 20_000) {
      avanzar(b, paso);
      await esperarAlDia(b);
      compararConOraculo(b, false);
    }
    const st = b.cliente.estadisticas();
    expect(st.sesiones).toBe(1);
    expect(st.resincronizaciones).toBeGreaterThanOrEqual(1);
    // de la segunda vuelta solo hay lo de sus primeros 20 s: ni aterrizaje ni apogeo
    expect(api.eventos.value.map((e) => e.tipo)).not.toContain("aterrizaje");
    expect(api.estado.value?.fase).not.toBe("LANDED");
    expect(api.meta.value?.mission_id).toBe(b.oraculo.meta?.mission_id ?? null);
  });
});
