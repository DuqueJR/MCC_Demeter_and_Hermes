// Vista 3D del mapa (T-656, D-W23): la geometría de la cortina de la trayectoria (alturas, puntos
// nulos, repetidos, diezmado), la caja con altura, y que el estilo del 3D solo use tokens del tema
// y no cambie nada del estilo de 2D.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Serie } from "../src/contrato/tipos";
import {
  ESTILO_3D,
  MAPA_3D_ANCHO_CORTINA_M,
  MAPA_3D_CORTINA_MAX_SEGMENTOS,
  MAPA_EPSILON_GRADOS,
  MAPA_RASTRO_MAX_PUNTOS,
  RADIO_TIERRA_M,
} from "../src/mapa/constantes";
import {
  CAPAS_RELIEVE,
  capaCortina,
  cielo3d,
  construirEstilo,
  FUENTE,
  fuenteCortina,
  fuenteTerreno,
  ID_3D,
  leerTokens,
  leerTokensRelieve,
  type RelieveEstilo,
  VARIABLES_TOKENS,
} from "../src/mapa/estilo";
import {
  agregarPunto,
  agregarPuntoAlt,
  cortinaTrayectoria,
  limitesConAltura,
  type PuntoAlt,
  puntosAltDeSerie,
  puntosDeSerie,
  unirLimites,
} from "../src/mapa/geo";

const raiz = resolve(import.meta.dirname, "..");
const M_POR_GRADO = (Math.PI / 180) * RADIO_TIERRA_M;
/** Longitud de un paso de ~10 m hacia el este (en grados, cerca de la rampa). */
const PASO_ESTE = 10 / (M_POR_GRADO * Math.cos((6.582 * Math.PI) / 180));
const PRECISION_M = 0.05;

/** Puntos hacia el este, cada 10 m, con las alturas dadas (null = sin altura). */
function alEste(alturas: (number | null)[], lon0 = -75.823, lat = 6.582): PuntoAlt[] {
  return alturas.map((alt_agl_m, i) => ({ lon: lon0 + i * PASO_ESTE, lat, alt_agl_m }));
}

/** Distancia en metros entre dos coordenadas cercanas. */
function distanciaM(a: number[], b: number[]): number {
  const este = ((b[0] as number) - (a[0] as number)) * Math.cos((6.582 * Math.PI) / 180);
  const norte = (b[1] as number) - (a[1] as number);
  return Math.hypot(este, norte) * M_POR_GRADO;
}

describe("cortinaTrayectoria: un polígono angosto por segmento, del suelo a la altura", () => {
  it("un polígono por segmento, con base 0 y la altura media de sus dos extremos", () => {
    const c = cortinaTrayectoria(alEste([0, 100, 300, 600]));
    expect(c.type).toBe("FeatureCollection");
    expect(c.features).toHaveLength(3);
    expect(c.features.map((f) => f.properties.height)).toEqual([50, 200, 450]);
    for (const f of c.features) {
      expect(f.type).toBe("Feature");
      expect(f.properties.base).toBe(0);
      expect(f.geometry.type).toBe("Polygon");
    }
  });

  it("cada polígono es un rectángulo cerrado del ancho pedido y del largo del segmento", () => {
    const [f] = cortinaTrayectoria(alEste([0, 100]), MAPA_3D_ANCHO_CORTINA_M).features;
    const anillo = (f as NonNullable<typeof f>).geometry.coordinates[0] as number[][];
    expect(anillo).toHaveLength(5);
    expect(anillo[4]).toEqual(anillo[0]);
    // Los lados cortos miden el ancho; los largos, el paso entre puntos (10 m).
    expect(
      Math.abs(distanciaM(anillo[0] as number[], anillo[3] as number[]) - MAPA_3D_ANCHO_CORTINA_M),
    ).toBeLessThan(PRECISION_M);
    expect(
      Math.abs(distanciaM(anillo[1] as number[], anillo[2] as number[]) - MAPA_3D_ANCHO_CORTINA_M),
    ).toBeLessThan(PRECISION_M);
    expect(Math.abs(distanciaM(anillo[0] as number[], anillo[1] as number[]) - 10)).toBeLessThan(
      PRECISION_M,
    );
    // Está centrado sobre el segmento: su centro es el punto medio.
    const lon = anillo.slice(0, 4).reduce((s, p) => s + (p[0] as number), 0) / 4;
    expect(lon).toBeCloseTo(-75.823 + PASO_ESTE / 2, 9);
  });

  it("el ancho en metros es el pedido (otro ancho, otro polígono)", () => {
    const [f] = cortinaTrayectoria(alEste([10, 20]), 40).features;
    const anillo = (f as NonNullable<typeof f>).geometry.coordinates[0] as number[][];
    expect(Math.abs(distanciaM(anillo[0] as number[], anillo[3] as number[]) - 40)).toBeLessThan(
      PRECISION_M,
    );
  });

  it("salta los puntos con alt_agl_m nulo: no hay segmento hacia ni desde ellos", () => {
    const c = cortinaTrayectoria(alEste([0, 100, null, 300, 400]));
    // 0-100 y 300-400 existen; el tramo 100 -> 300 (pasando por el nulo) une los dos puntos útiles.
    expect(c.features.map((f) => f.properties.height)).toEqual([50, 200, 350]);
    expect(cortinaTrayectoria(alEste([null, null, null])).features).toEqual([]);
    expect(cortinaTrayectoria(alEste([null, 50])).features).toEqual([]);
  });

  it("salta los puntos repetidos (misma posición que el anterior) sin partir en cero la cortina", () => {
    const p = alEste([0, 100, 100, 200]);
    const repetido: PuntoAlt[] = [
      p[0] as PuntoAlt,
      p[1] as PuntoAlt,
      { ...(p[1] as PuntoAlt), alt_agl_m: 150 },
      p[3] as PuntoAlt,
    ];
    const c = cortinaTrayectoria(repetido);
    expect(c.features).toHaveLength(2);
    // Un repetido a menos de MAPA_EPSILON_GRADOS tampoco cuenta.
    const casi: PuntoAlt[] = [
      { lon: -75.823, lat: 6.582, alt_agl_m: 0 },
      { lon: -75.823 + MAPA_EPSILON_GRADOS / 10, lat: 6.582, alt_agl_m: 5 },
      { lon: -75.822, lat: 6.582, alt_agl_m: 10 },
    ];
    expect(cortinaTrayectoria(casi).features).toHaveLength(1);
    for (const f of c.features) expect(Number.isFinite(f.properties.height)).toBe(true);
    // Todas las coordenadas son finitas (un segmento de largo cero no deja NaN).
    for (const f of c.features) {
      for (const par of (f.geometry.coordinates[0] as number[][]) ?? []) {
        expect(par.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it("con menos de dos puntos útiles no hay cortina", () => {
    expect(cortinaTrayectoria([]).features).toEqual([]);
    expect(cortinaTrayectoria(alEste([100])).features).toEqual([]);
  });

  it("una altura negativa (ruido bajo el suelo) se deja en 0", () => {
    const c = cortinaTrayectoria(alEste([-5, -3, 20]));
    expect(c.features[0]?.properties.height).toBe(0);
    expect(c.features[1]?.properties.height).toBeCloseTo(8.5, 9);
  });

  it("factorAltura escala la altura (terreno exagerado)", () => {
    const c = cortinaTrayectoria(alEste([0, 100]), undefined, undefined, 2);
    expect(c.features[0]?.properties.height).toBe(100);
  });

  it("diezma: a lo sumo maxSegmentos, conserva el primero y el último y el orden", () => {
    const n = 1000;
    const puntos = alEste(Array.from({ length: n }, (_, i) => i));
    const c = cortinaTrayectoria(puntos, 10, 100);
    expect(c.features.length).toBeLessThanOrEqual(100);
    expect(c.features.length).toBeGreaterThan(50);
    const alturas = c.features.map((f) => f.properties.height);
    expect([...alturas].sort((a, b) => a - b)).toEqual(alturas);
    // El último segmento termina en el último punto (altura media de 998.5 hasta 999).
    expect(alturas[alturas.length - 1]).toBeGreaterThan(900);
    expect(alturas[0]).toBeLessThan(20);
  });

  it("con la constante por defecto, 4000 puntos dan a lo sumo MAPA_3D_CORTINA_MAX_SEGMENTOS polígonos", () => {
    const puntos = alEste(Array.from({ length: MAPA_RASTRO_MAX_PUNTOS }, (_, i) => i / 10));
    const c = cortinaTrayectoria(puntos);
    expect(c.features.length).toBeLessThanOrEqual(MAPA_3D_CORTINA_MAX_SEGMENTOS);
    expect(c.features.length).toBeGreaterThan(0);
  });

  it("sin pasar del máximo no diezma: todos los segmentos", () => {
    const c = cortinaTrayectoria(alEste(Array.from({ length: 50 }, (_, i) => i)), 10, 100);
    expect(c.features).toHaveLength(49);
  });
});

describe("el rastro con altura sigue al rastro de la línea del suelo", () => {
  const serie = (
    lat: (number | null)[],
    lon: (number | null)[],
    alt: (number | null)[],
  ): Serie => ({
    t_mas_s: lat.map((_, i) => i),
    lat,
    lon,
    alt_agl_m: alt,
    vz_ms: lat.map(() => null),
    acc_x_g: lat.map(() => null),
    acc_y_g: lat.map(() => null),
    acc_z_g: lat.map(() => null),
  });

  it("puntosAltDeSerie toma los mismos puntos que puntosDeSerie, con su altura", () => {
    const s = serie([6.5, null, 6.6, 6.7], [-75.8, -75.8, null, -75.7], [10, 20, 30, null]);
    expect(puntosAltDeSerie(s)).toEqual([
      { lon: -75.8, lat: 6.5, alt_agl_m: 10 },
      { lon: -75.7, lat: 6.7, alt_agl_m: null },
    ]);
    expect(puntosAltDeSerie(s).map((p) => [p.lon, p.lat])).toEqual(puntosDeSerie(s));
  });

  it("agregarPuntoAlt repite y diezma igual que agregarPunto (mismos puntos siempre)", () => {
    let a: [number, number][] = [];
    let b: PuntoAlt[] = [];
    const max = 7;
    for (let i = 0; i < 40; i++) {
      // Cada tercer punto repite al anterior.
      const k = i % 3 === 2 ? i - 1 : i;
      a = agregarPunto(a, [-75.8 + k * 1e-5, 6.5], max);
      b = agregarPuntoAlt(b, { lon: -75.8 + k * 1e-5, lat: 6.5, alt_agl_m: k }, max);
      expect(b.map((p) => [p.lon, p.lat])).toEqual(a);
    }
  });
});

describe("limitesConAltura: la caja que abarca la parte alta de la cortina", () => {
  it("sin alturas es la caja del suelo; con altura, crece al norte en h * tan(pitch)", () => {
    const puntos: PuntoAlt[] = [
      { lon: -75.82, lat: 6.58, alt_agl_m: 0 },
      { lon: -75.81, lat: 6.59, alt_agl_m: 1000 },
    ];
    const [oeste, sur, este, norte] = limitesConAltura(puntos, 0) as number[];
    expect([oeste, sur, este, norte]).toEqual([-75.82, 6.58, -75.81, 6.59]);
    const [, , , norte60] = limitesConAltura(puntos, 60) as number[];
    // 1000 m * tan(60°) = 1732 m al norte de 6.59.
    expect(((norte60 as number) - 6.59) * M_POR_GRADO).toBeCloseTo(1000 * Math.tan(Math.PI / 3), 0);
    const [o2, s2, e2] = limitesConAltura(puntos, 60) as number[];
    expect([o2, s2, e2]).toEqual([-75.82, 6.58, -75.81]);
  });

  it("sin puntos, null; con altura nula o negativa, no la cuenta", () => {
    expect(limitesConAltura([], 60)).toBeNull();
    const sinAltura: PuntoAlt[] = [
      { lon: -75.82, lat: 6.58, alt_agl_m: null },
      { lon: -75.81, lat: 6.59, alt_agl_m: -10 },
    ];
    expect(limitesConAltura(sinAltura, 60)).toEqual([-75.82, 6.58, -75.81, 6.59]);
  });

  it("unirLimites junta dos cajas y deja pasar una sola", () => {
    expect(unirLimites(null, null)).toBeNull();
    expect(unirLimites([1, 2, 3, 4], null)).toEqual([1, 2, 3, 4]);
    expect(unirLimites(null, [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(unirLimites([0, 0, 2, 2], [1, -1, 3, 1])).toEqual([0, -1, 3, 2]);
  });
});

// ---- El estilo del 3D ----

function lectorDeTema(mision: "demeter" | "hermes"): (variable: string) => string {
  const css = ["comun.css", `${mision}.css`]
    .map((f) => readFileSync(join(raiz, "src", "tema", f), "utf8"))
    .join("\n");
  const variables = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    variables.set(m[1] as string, (m[2] as string).trim());
  }
  return (nombre) => variables.get(nombre) ?? "";
}

function relieveDePrueba(mision: "demeter" | "hermes"): RelieveEstilo {
  const tokens = leerTokensRelieve(lectorDeTema(mision));
  if (!tokens) throw new Error(`el tema ${mision} no define los tokens del relieve`);
  return {
    tokens,
    relieve: {
      urlTeselas: "http://localhost/mapas/relieve/{z}/{x}/{y}.png",
      atribucion: "Relieve: Mapzen",
      meta: {
        bounds: [-76, 6.4, -75.6, 6.8],
        minzoom: 10,
        maxzoom: 12,
        tamanoTesela: 256,
        curvas: null,
      },
      curvas: null,
    },
  };
}

describe("estilo de la vista 3D", () => {
  for (const mision of ["demeter", "hermes"] as const) {
    it(`${mision}: la cortina y el cielo solo usan colores de los tokens del tema`, () => {
      const lector = lectorDeTema(mision);
      const t = leerTokens(lector);
      const permitidos = new Set<string>(
        Object.keys(VARIABLES_TOKENS).map((c) => t[c as keyof typeof VARIABLES_TOKENS]),
      );
      for (const clave of Object.keys(VARIABLES_TOKENS)) {
        expect(lector(VARIABLES_TOKENS[clave as keyof typeof VARIABLES_TOKENS])).not.toBe("");
      }
      const capa = capaCortina(t);
      const colores = Object.entries((capa as { paint: Record<string, unknown> }).paint).filter(
        ([k]) => k.endsWith("-color"),
      );
      expect(colores.length).toBeGreaterThan(0);
      for (const [k, v] of colores) expect(permitidos.has(v as string), `${k}: ${v}`).toBe(true);
      // La cortina tiene el color del rastro del suelo.
      expect((capa as { paint: Record<string, unknown> }).paint["fill-extrusion-color"]).toBe(
        t.acento,
      );

      const cielo = cielo3d(t) as Record<string, unknown>;
      const coloresCielo = Object.entries(cielo).filter(([k]) => k.endsWith("-color"));
      expect(coloresCielo.map(([k]) => k).sort()).toEqual([
        "fog-color",
        "horizon-color",
        "sky-color",
      ]);
      for (const [k, v] of coloresCielo)
        expect(permitidos.has(v as string), `${k}: ${v}`).toBe(true);
      // Los demás valores del cielo son números de presentación (de constantes.ts), no colores.
      for (const [k, v] of Object.entries(cielo)) {
        if (!k.endsWith("-color")) expect(typeof v).toBe("number");
      }
    });
  }

  it("ningún color del 3D está escrito en el código del mapa (solo tokens)", () => {
    for (const archivo of ["estilo.ts", "controlador.tsx", "geo.ts", "constantes.ts", "Mapa.tsx"]) {
      const texto = readFileSync(join(raiz, "src/mapa", archivo), "utf8");
      expect(texto, archivo).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(texto, archivo).not.toMatch(/\brgba?\s*\(/i);
      expect(texto, archivo).not.toMatch(/\bhsla?\s*\(/i);
    }
  });

  it("la cortina es una fill-extrusion con altura y base de cada polígono, sobre su propia fuente", () => {
    const t = leerTokens(lectorDeTema("demeter"));
    const capa = capaCortina(t) as unknown as {
      id: string;
      type: string;
      source: string;
      paint: Record<string, unknown>;
    };
    expect(capa.type).toBe("fill-extrusion");
    expect(capa.source).toBe(ID_3D.fuenteCortina);
    expect(capa.paint["fill-extrusion-height"]).toEqual(["get", "height"]);
    expect(capa.paint["fill-extrusion-base"]).toEqual(["get", "base"]);
    expect(capa.paint["fill-extrusion-opacity"]).toBe(ESTILO_3D.opacidadCortina);
    expect(fuenteCortina()).toEqual({
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  });

  it("el terreno tiene su fuente raster-dem aparte, con las mismas teselas que el sombreado", () => {
    const r = relieveDePrueba("hermes");
    const t = leerTokens(lectorDeTema("hermes"));
    const terreno = fuenteTerreno(r.relieve) as unknown as Record<string, unknown>;
    const sombreado = construirEstilo(t, null, r).sources[FUENTE.relieve] as unknown as Record<
      string,
      unknown
    >;
    expect(ID_3D.fuenteTerreno).not.toBe(FUENTE.relieve);
    expect(terreno.type).toBe("raster-dem");
    for (const clave of ["tiles", "encoding", "tileSize", "minzoom", "maxzoom", "bounds"]) {
      expect(terreno[clave], clave).toEqual(sombreado[clave]);
    }
    // Sin atribución propia: la del relieve ya está en la fuente del sombreado.
    expect(terreno.attribution).toBeUndefined();
  });

  it("el estilo de 2D no lleva nada del 3D: ni capas, ni fuentes, ni cielo ni terreno", () => {
    for (const mision of ["demeter", "hermes"] as const) {
      const t = leerTokens(lectorDeTema(mision));
      for (const relieve of [null, relieveDePrueba(mision)]) {
        const estilo = construirEstilo(t, null, relieve);
        expect(estilo.layers.map((l) => l.id)).not.toContain(ID_3D.capaCortina);
        expect(estilo.layers.some((l) => l.type === "fill-extrusion")).toBe(false);
        expect(Object.keys(estilo.sources)).not.toContain(ID_3D.fuenteTerreno);
        expect(Object.keys(estilo.sources)).not.toContain(ID_3D.fuenteCortina);
        expect(estilo.terrain).toBeUndefined();
        expect(estilo.sky).toBeUndefined();
      }
    }
    // Y las capas del relieve siguen siendo las tres de siempre.
    const estilo = construirEstilo(
      leerTokens(lectorDeTema("demeter")),
      null,
      relieveDePrueba("demeter"),
    );
    expect(estilo.layers.filter((l) => l.id.startsWith("relieve-")).map((l) => l.id)).toEqual([
      CAPAS_RELIEVE.sombreado,
    ]);
  });
});
