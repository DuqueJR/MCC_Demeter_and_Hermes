// Mapa (T-632): la lógica que no depende del navegador. Arma el GeoJSON de cada capa desde las
// signals reales de `datos/api.ts`, decide si toca LKP y comprueba que el estilo sale de los tokens
// de cada tema. Los escenarios son los JSONL de dev/datos, reproducidos con el mismo acumulador del
// repetidor (T-630): lo que ve la prueba es lo que serviría el relay.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { leerJsonl } from "../dev/repetidor/jsonl";
import { Acumulador } from "../dev/repetidor/snapshot";
import { snapshotEjemplo } from "../src/contrato/ejemplos";
import type { Estado, LineaJsonl, Mision, Serie, Snapshot } from "../src/contrato/tipos";
import * as api from "../src/datos/api";
import { WEB_SERIE_MAX_PUNTOS } from "../src/datos/constantes";
import {
  MAPA_OPACIDAD_RASTRO_MIN,
  MAPA_PASOS_ELIPSE,
  MAPA_RASTRO_MAX_PUNTOS,
  MAPA_TRAMOS_DESVANECER,
  RADIO_TIERRA_M,
} from "../src/mapa/constantes";
import {
  construirEstilo,
  duracionEnMs,
  FUENTE,
  leerTokens,
  type Tokens,
  VARIABLES_TOKENS,
} from "../src/mapa/estilo";
import {
  agregarPunto,
  type Coord,
  cardinal,
  construirCapas,
  decidirLkp,
  type EntradaMapa,
  fueraDeLimites,
  limitesDe,
  poligonoElipse,
  puntosDeSerie,
  rumboDelCohete,
  rumboEntre,
  textoChip,
  textoLkp,
  tramosDesvanecidos,
  ultimaPosicionConocida,
} from "../src/mapa/geo";

const raiz = resolve(import.meta.dirname, "..");

// ---- Escenarios reproducidos con el acumulador del repetidor ----

/** El snapshot que serviría el repetidor tras `hastaMs` del escenario (o al final). */
function snapshotDe(
  mision: Mision,
  escenario: string,
  hastaMs = Number.POSITIVE_INFINITY,
): Snapshot {
  const mensajes = leerJsonl(join(raiz, "dev", "datos", `${mision}_${escenario}.jsonl`));
  const acum = new Acumulador();
  for (const m of mensajes) if (m.t_rel_ms <= hastaMs) acum.aplicar(m.linea);
  const meta = mensajes
    .map((m) => m.linea)
    .find((l): l is Extract<LineaJsonl, { evento: "meta" }> => l.evento === "meta");
  if (!meta) throw new Error("el escenario no trae meta");
  return acum.snapshot(meta.datos);
}

/** Alimenta `api.ts` y arma lo que el mapa lee de él, igual que `controlador.tsx`. */
function entradaDe(s: Snapshot, conexion: "conectado" | "reconectando" = "conectado"): EntradaMapa {
  api.alimentar.snapshot(s, 0);
  api.alimentar.conexion(conexion);
  return {
    sitio: api.meta.value?.sitio ?? null,
    estado: api.estado.value,
    estacion: api.estacion.value,
    serie: api.serie.value,
    principal: api.estadoPagina.value.principal,
    edadMs: api.edad.value,
  };
}

const serieDe = (lat: (number | null)[], lon: (number | null)[]): Serie => ({
  t_mas_s: lat.map(() => 0),
  lat,
  lon,
  alt_agl_m: lat.map(() => 100),
  vz_ms: lat.map(() => -9),
  acc_x_g: lat.map(() => 1),
  acc_y_g: lat.map(() => 0),
  acc_z_g: lat.map(() => 0),
});

const entradaBase = (extra: Partial<EntradaMapa> = {}): EntradaMapa => ({
  sitio: snapshotEjemplo.meta.sitio,
  estado: snapshotEjemplo.estado,
  estacion: snapshotEjemplo.estacion,
  serie: serieDe([], []),
  principal: "en_vivo",
  edadMs: 230,
  ...extra,
});

/** Distancia horizontal aproximada (m) entre dos coordenadas cercanas. */
function metros(a: Coord, b: Coord): number {
  const rad = Math.PI / 180;
  const norte = (b[1] - a[1]) * rad * RADIO_TIERRA_M;
  const este = (b[0] - a[0]) * rad * RADIO_TIERRA_M * Math.cos(a[1] * rad);
  return Math.hypot(este, norte);
}

describe("LKP (03 §3.4 y §4, GS-03)", () => {
  beforeEach(() => api.alimentar.snapshot(snapshotEjemplo, 0));

  it("lkp_descenso: sin señal, el cohete pasa al marcador rojo en estado.lkp, con altitud y edad", () => {
    const s = snapshotDe("demeter", "lkp_descenso");
    const e = entradaDe(s);
    expect(e.principal).toBe("sin_senal");
    expect(e.estado?.lkp).toBeTruthy();

    const d = decidirLkp(e, null);
    expect(d.activo).toBe(true);
    expect(d.punto).toMatchObject({
      origen: "lkp",
      lat: e.estado?.lkp?.lat,
      lon: e.estado?.lkp?.lon,
      alt_agl_m: e.estado?.lkp?.alt_agl_m,
    });
    // "hace X s" sale de la edad de la API (sin el reloj del celular): el último paquete del escenario.
    expect(d.edadMs).toBe(e.edadMs);
    expect(d.edadMs).toBeGreaterThan(5_000);

    const capas = construirCapas(e, d, puntosDeSerie(e.serie));
    expect(capas.marcadores.cohete).toBeNull(); // el punto en vivo se reemplaza por el LKP
    expect(capas.marcadores.lkp).toMatchObject({
      pos: [e.estado?.lkp?.lon, e.estado?.lkp?.lat],
      alt_agl_m: e.estado?.lkp?.alt_agl_m,
    });
    expect(textoLkp(120.6, 42_925)).toBe("Última posición · 121 m · hace 42 s");
  });

  it("nominal en pleno vuelo: no toca LKP y el cohete se dibuja en estado.pos", () => {
    const s = snapshotDe("demeter", "nominal", 40_000);
    const e = entradaDe(s);
    expect(e.principal).toBe("en_vivo");
    const d = decidirLkp(e, null);
    expect(d.activo).toBe(false);
    const capas = construirCapas(e, d, puntosDeSerie(e.serie));
    expect(capas.marcadores.lkp).toBeNull();
    expect(capas.marcadores.cohete?.pos).toEqual([e.estado?.pos?.lon, e.estado?.pos?.lat]);
  });

  it("con pos en null (sin fix) toca LKP con la última posición válida, aunque haya señal", () => {
    const e = entradaBase({
      estado: {
        ...(snapshotEjemplo.estado as Estado),
        pos: null,
        vel: null,
        utc_ms: 1_793_981_050_000,
      },
    });
    const d = decidirLkp(e, null);
    expect(d.activo).toBe(true);
    expect(d.punto?.origen).toBe("lkp");
    // Con señal, la edad sale de la hora del cohete: utc del estado - utc del LKP.
    expect(d.edadMs).toBe(1_793_981_050_000 - (snapshotEjemplo.estado?.lkp?.utc_ms as number));
  });

  it("sin estado.lkp usa estado.pos y, si tampoco hay, el último punto de la serie", () => {
    const base = snapshotEjemplo.estado as Estado;
    const sinLkp = entradaBase({ principal: "sin_senal", estado: { ...base, lkp: null } });
    expect(ultimaPosicionConocida(sinLkp)).toMatchObject({ origen: "pos", lat: base.pos?.lat });

    const soloSerie = entradaBase({
      principal: "sin_senal",
      estado: { ...base, lkp: null, pos: null },
      serie: serieDe([6.5, 6.6, null], [-75.8, -75.9, null]),
    });
    expect(ultimaPosicionConocida(soloSerie)).toMatchObject({
      origen: "serie",
      lat: 6.6,
      lon: -75.9,
    });
  });

  it("si el cohete nunca tuvo posición no hay marcador (pero el LKP queda activo)", () => {
    const base = snapshotEjemplo.estado as Estado;
    const e = entradaBase({ estado: { ...base, pos: null, lkp: null } });
    const d = decidirLkp(e, null);
    expect(d).toMatchObject({ activo: true, punto: null });
    expect(construirCapas(e, d, []).marcadores.lkp).toBeNull();
  });

  it("nunca se borra: se conserva si cae el servidor (sin_servidor) y si ya no hay de dónde sacarlo", () => {
    const sinSenal = entradaDe(snapshotDe("demeter", "lkp_descenso"));
    const d1 = decidirLkp(sinSenal, null);
    expect(d1.activo).toBe(true);

    // El navegador pierde al servidor: el estado principal pasa a sin_servidor, el LKP sigue.
    const reconectando = { ...sinSenal, principal: "sin_servidor" as const, edadMs: 60_000 };
    const d2 = decidirLkp(reconectando, d1);
    expect(d2.activo).toBe(true);
    expect(d2.punto).toEqual(d1.punto);
    expect(d2.edadMs).toBe(60_000);

    // Aunque el estado, el lkp y la serie desaparecieran, queda el último punto conocido.
    const vacio = entradaBase({ principal: "sin_senal", estado: null, serie: serieDe([], []) });
    const d3 = decidirLkp(vacio, d2);
    expect(d3.activo).toBe(true);
    expect(d3.punto).toEqual(d1.punto);
  });

  it("sin_servidor sin LKP previo no inventa uno; al volver la señal, el LKP se va y el cohete reaparece", () => {
    const enVivo = entradaBase({ principal: "sin_servidor" });
    expect(decidirLkp(enVivo, null).activo).toBe(false);

    const lkp = decidirLkp(entradaBase({ principal: "sin_senal", edadMs: 38_000 }), null);
    expect(lkp.activo).toBe(true);
    const vuelve = decidirLkp(entradaBase({ principal: "en_vivo" }), lkp);
    expect(vuelve.activo).toBe(false);
  });

  it("señal débil: el cohete sigue en vivo, atenuado", () => {
    const e = entradaBase({ principal: "senal_debil", edadMs: 3_000 });
    const capas = construirCapas(e, decidirLkp(e, null), []);
    expect(capas.marcadores.cohete?.atenuado).toBe(true);
    expect(capas.marcadores.lkp).toBeNull();
  });

  it("antes de despegar (cargando, sin transmisión) no hay cohete ni LKP", () => {
    const e = entradaBase({ principal: "sin_transmision", estado: null, edadMs: null });
    const capas = construirCapas(e, decidirLkp(e, null), []);
    expect(capas.marcadores.cohete).toBeNull();
    expect(capas.marcadores.lkp).toBeNull();
    expect(capas.marcadores.rampa).toEqual([e.sitio?.lon, e.sitio?.lat]);
  });
});

describe("capas (03 §3.4)", () => {
  it("rampa, estación, elipse y línea estación -> cohete con su chip de distancia y azimut", () => {
    const e = entradaBase();
    const capas = construirCapas(e, decidirLkp(e, null), []);
    const m = capas.marcadores;
    const est = snapshotEjemplo.estacion?.pos;
    const calc = snapshotEjemplo.estado?.calc;
    expect(m.rampa).toEqual([-75.823, 6.582]);
    expect(m.estacion).toEqual([est?.lon, est?.lat]);
    expect(m.impacto).toEqual([calc?.elipse?.lon, calc?.elipse?.lat]);
    expect(capas.linea.features[0]?.geometry.coordinates).toEqual([m.estacion, m.cohete?.pos]);
    expect(m.chip?.texto).toBe("842 m · 271° O"); // calc.dist_horiz_m 842.3 y azimut_deg 271.4
    expect(capas.elipse.features).toHaveLength(1);
    expect(capas.limites).not.toBeNull();
  });

  it("la línea y el chip siguen al LKP cuando no hay señal", () => {
    const e = entradaBase({ principal: "sin_senal", edadMs: 38_000 });
    const d = decidirLkp(e, null);
    const capas = construirCapas(e, d, []);
    expect(capas.linea.features[0]?.geometry.coordinates[1]).toEqual(capas.marcadores.lkp?.pos);
    expect(capas.marcadores.chip?.texto).toBe("842 m · 271° O");
  });

  it("sin estación, sin elipse o sin calc: esas capas quedan vacías, sin inventar nada", () => {
    const base = snapshotEjemplo.estado as Estado;
    const calcVacio = { ...base.calc, dist_horiz_m: null, azimut_deg: null, elipse: null };
    const e = entradaBase({ estacion: null, estado: { ...base, calc: calcVacio } });
    const capas = construirCapas(e, decidirLkp(e, null), []);
    expect(capas.linea.features).toEqual([]);
    expect(capas.elipse.features).toEqual([]);
    expect(capas.marcadores).toMatchObject({ estacion: null, impacto: null, chip: null });
  });

  it("el chip pasa a kilómetros desde 1000 m y trae el punto cardinal", () => {
    expect(textoChip(1234, 45)).toBe("1,2 km · 45° NE");
    expect(textoChip(999.6, null)).toBe("1000 m");
    expect(textoChip(null, 359.6)).toBe("360° N");
    expect(textoChip(null, null)).toBeNull();
    expect(cardinal(0)).toBe("N");
    expect(cardinal(135)).toBe("SE");
    expect(cardinal(270)).toBe("O");
    expect(cardinal(-90)).toBe("O");
  });
});

describe("trayectoria que se desvanece", () => {
  const recta = (n: number): Coord[] =>
    Array.from({ length: n }, (_, i) => [-75.8 + i * 1e-4, 6.5]);

  it("parte la línea en tramos de opacidad creciente y el último es opaco", () => {
    const c = tramosDesvanecidos(recta(100));
    expect(c.features).toHaveLength(MAPA_TRAMOS_DESVANECER);
    const ops = c.features.map((f) => f.properties.op);
    expect(ops).toEqual([...ops].sort((a, b) => a - b));
    expect(ops[0]).toBeGreaterThan(MAPA_OPACIDAD_RASTRO_MIN);
    expect(ops.at(-1)).toBe(1);
  });

  it("los tramos se tocan: no hay huecos y se cubren todos los puntos", () => {
    const puntos = recta(57);
    const c = tramosDesvanecidos(puntos);
    for (let i = 1; i < c.features.length; i++) {
      const anterior = c.features[i - 1]?.geometry.coordinates.at(-1);
      expect(c.features[i]?.geometry.coordinates[0]).toEqual(anterior);
    }
    expect(c.features[0]?.geometry.coordinates[0]).toEqual(puntos[0]);
    expect(c.features.at(-1)?.geometry.coordinates.at(-1)).toEqual(puntos.at(-1));
  });

  it("con pocos puntos no pide más tramos que segmentos; con menos de 2 no dibuja nada", () => {
    expect(tramosDesvanecidos(recta(3)).features).toHaveLength(2);
    expect(tramosDesvanecidos(recta(1)).features).toEqual([]);
    expect(tramosDesvanecidos([]).features).toEqual([]);
  });

  it("puntosDeSerie descarta las muestras sin posición (BOOT, PREFLIGHT)", () => {
    const s = serieDe([null, 6.5, 6.6], [null, -75.8, -75.9]);
    expect(puntosDeSerie(s)).toEqual([
      [-75.8, 6.5],
      [-75.9, 6.6],
    ]);
  });

  it("agregarPunto no repite el último, y recorta sin perder los extremos", () => {
    const uno: Coord[] = [[-75.8, 6.5]];
    expect(agregarPunto(uno, [-75.8, 6.5])).toBe(uno);
    expect(agregarPunto(uno, [-75.8, 6.6])).toHaveLength(2);

    const largo = recta(21);
    const recortado = agregarPunto(largo, [-75.7, 6.6], 20);
    expect(recortado.length).toBeLessThanOrEqual(20);
    expect(recortado[0]).toEqual(largo[0]);
    expect(recortado.at(-1)).toEqual([-75.7, 6.6]);
    expect(MAPA_RASTRO_MAX_PUNTOS).toBe(WEB_SERIE_MAX_PUNTOS * 2);
  });

  it("con la serie de lkp_descenso dibuja toda la trayectoria", () => {
    const e = entradaDe(snapshotDe("demeter", "lkp_descenso"));
    const puntos = puntosDeSerie(e.serie);
    expect(puntos.length).toBeGreaterThan(100);
    const c = tramosDesvanecidos(puntos);
    expect(
      c.features.map((f) => f.geometry.coordinates.length - 1).reduce((a, b) => a + b, 0),
    ).toBe(puntos.length - 1);
  });
});

describe("elipse de impacto y rumbo", () => {
  const elipse = {
    lat: 6.583,
    lon: -75.83,
    semieje_mayor_m: 120,
    semieje_menor_m: 60,
    rumbo_deg: 270,
  };

  it("es un polígono cerrado cuyos semiejes miden lo que dice el contrato", () => {
    const anillo = poligonoElipse(elipse).coordinates[0] as Coord[];
    expect(anillo).toHaveLength(MAPA_PASOS_ELIPSE + 1);
    expect(anillo[0]).toEqual(anillo.at(-1));
    const centro: Coord = [elipse.lon, elipse.lat];
    const distancias = anillo.slice(0, -1).map((p) => metros(centro, p));
    expect(Math.max(...distancias)).toBeCloseTo(120, 0);
    expect(Math.min(...distancias)).toBeCloseTo(60, 0);
  });

  it("el semieje mayor apunta al rumbo (270° = hacia el oeste) y no queda desplazada", () => {
    const anillo = poligonoElipse(elipse).coordinates[0] as Coord[];
    const centro: Coord = [elipse.lon, elipse.lat];
    const punta = anillo[0] as Coord; // t = 0: la punta del semieje mayor
    expect(metros(centro, punta)).toBeCloseTo(120, 0);
    expect(punta[0]).toBeLessThan(centro[0]); // al oeste
    expect(punta[1]).toBeCloseTo(centro[1], 6);
    const promedio = anillo.slice(0, -1).reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    expect(promedio[0] / MAPA_PASOS_ELIPSE).toBeCloseTo(centro[0], 6);
    expect(promedio[1] / MAPA_PASOS_ELIPSE).toBeCloseTo(centro[1], 6);
  });

  it("rumboEntre da azimutes de brújula", () => {
    const o: Coord = [-75.8, 6.5];
    expect(rumboEntre(o, [-75.8, 6.6])).toBeCloseTo(0, 3);
    expect(rumboEntre(o, [-75.7, 6.5])).toBeCloseTo(90, 3);
    expect(rumboEntre(o, [-75.8, 6.4])).toBeCloseTo(180, 3);
    expect(rumboEntre(o, [-75.9, 6.5])).toBeCloseTo(270, 3);
    expect(rumboEntre(o, o)).toBeNull();
  });

  it("el rumbo del cohete sale de su velocidad; si es lenta, del rastro; si no, ninguno", () => {
    const base = snapshotEjemplo.estado as Estado;
    const rapido = { ...base, vel: { n_ms: 0, e_ms: -2, u_ms: -9, total_ms: 9.2 } };
    expect(rumboDelCohete(rapido, [])).toBeCloseTo(270, 6);
    const quieto = { ...base, vel: { n_ms: 0.1, e_ms: 0.1, u_ms: 0, total_ms: 0.14 } };
    expect(
      rumboDelCohete(quieto, [
        [-75.8, 6.5],
        [-75.8, 6.6],
      ]),
    ).toBeCloseTo(0, 3);
    expect(rumboDelCohete({ ...base, vel: null }, [])).toBeNull();
  });

  it("limites y fueraDeLimites", () => {
    expect(limitesDe([])).toBeNull();
    const l = limitesDe([
      [-75.9, 6.5],
      [-75.7, 6.7],
      [-75.8, 6.6],
    ]);
    expect(l).toEqual([-75.9, 6.5, -75.7, 6.7]);
    expect(fueraDeLimites(l as NonNullable<typeof l>, [-75.8, 6.6])).toBe(false);
    expect(fueraDeLimites(l as NonNullable<typeof l>, [-75.6, 6.6])).toBe(true);
  });
});

// ---- El estilo sale de los tokens de cada tema (06 §6) ----

/** Lee las variables CSS declaradas en los archivos de tema, como lo haría `getComputedStyle`. */
function lectorDeTema(mision: Mision): (variable: string) => string {
  const css = ["comun.css", `${mision}.css`]
    .map((f) => readFileSync(join(raiz, "src", "tema", f), "utf8"))
    .join("\n");
  const variables = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    variables.set(m[1] as string, (m[2] as string).trim());
  }
  return (nombre) => variables.get(nombre) ?? "";
}

/** El `paint` de una capa del estilo, por su id. */
function pinturaDe(
  estilo: ReturnType<typeof construirEstilo>,
  id: string,
): Record<string, unknown> {
  const capa = estilo.layers.find((l) => l.id === id) as { paint?: Record<string, unknown> };
  return capa.paint ?? {};
}

/** Todos los valores de color de un estilo (paint de los tipos con color). */
function coloresDelEstilo(estilo: ReturnType<typeof construirEstilo>): string[] {
  const colores: string[] = [];
  for (const capa of estilo.layers) {
    const paint = (capa as { paint?: Record<string, unknown> }).paint ?? {};
    for (const [clave, valor] of Object.entries(paint)) {
      if (clave.endsWith("-color") && typeof valor === "string") colores.push(valor);
    }
  }
  return colores;
}

describe("estilo por tema", () => {
  const colores = Object.keys(VARIABLES_TOKENS);

  for (const mision of ["demeter", "hermes"] as const) {
    it(`${mision}: los tokens salen de su CSS y el estilo no usa ningún otro color`, () => {
      const lector = lectorDeTema(mision);
      const t = leerTokens(lector);
      expect(t.fondo).toBe(lector("--fondo"));
      expect(t.acento).toBe(lector("--acento"));
      expect(t.alarma).toBe(lector("--estado-alarma"));
      const permitidos = new Set(colores.map((c) => t[c as keyof typeof VARIABLES_TOKENS]));

      for (const base of [null, { url: "pmtiles://http://x/mapa.pmtiles", atribucion: "x" }]) {
        const usados = coloresDelEstilo(construirEstilo(t, base));
        expect(usados.length).toBeGreaterThan(0);
        for (const c of usados) expect(permitidos.has(c), `${c} no es un token`).toBe(true);
        // El fondo del mapa es el `--fondo` del tema, y la trayectoria usa `--acento`.
        const estilo = construirEstilo(t, base);
        expect(pinturaDe(estilo, "fondo")["background-color"]).toBe(lector("--fondo"));
        expect(pinturaDe(estilo, "trayectoria")["line-color"]).toBe(lector("--acento"));
      }
    });
  }

  it("Hermes y Deméter dan estilos distintos", () => {
    const a = construirEstilo(leerTokens(lectorDeTema("demeter")), null);
    const b = construirEstilo(leerTokens(lectorDeTema("hermes")), null);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("sin base solo trae las capas de la misión; con base agrega la fuente y las capas base", () => {
    const t = leerTokens(lectorDeTema("demeter"));
    const sin = construirEstilo(t, null);
    expect(Object.keys(sin.sources)).not.toContain(FUENTE.base);
    expect(sin.layers.map((l) => l.id)).toEqual([
      "fondo",
      "elipse-relleno",
      "elipse-borde",
      "linea-estacion",
      "trayectoria",
    ]);

    const con = construirEstilo(t, { url: "pmtiles://http://x/mapa.pmtiles", atribucion: "© OSM" });
    expect(con.sources[FUENTE.base]).toMatchObject({
      type: "vector",
      url: "pmtiles://http://x/mapa.pmtiles",
    });
    const ids = con.layers.map((l) => l.id);
    expect(ids.indexOf("base-tierra")).toBeLessThan(ids.indexOf("trayectoria")); // la base va debajo
    expect(ids).toEqual(expect.arrayContaining(["base-agua", "base-vias", "base-lugares"]));
  });

  it("falla en voz alta si falta un token, y entiende las duraciones del tema", () => {
    expect(() => leerTokens(() => "")).toThrow(/--fondo/);
    expect(duracionEnMs("320ms")).toBe(320);
    expect(duracionEnMs("0.3s")).toBe(300);
    expect(duracionEnMs("")).toBeGreaterThan(0);
    expect(leerTokens(lectorDeTema("demeter")).duracionMs).toBe(320);
    expect(leerTokens(lectorDeTema("hermes")).duracionMs).toBe(180);
    const completo: Tokens = leerTokens(lectorDeTema("hermes"));
    expect(Object.keys(completo)).toEqual([...colores, "duracionMs"]);
  });
});
