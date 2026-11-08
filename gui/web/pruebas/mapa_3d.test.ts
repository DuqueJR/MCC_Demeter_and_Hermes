// Vista 3D del mapa (T-656, D-W23): la geometría pura del tubo de la trayectoria, del cohete (con su
// plomada) y de la estaca del impacto (alturas, tamaños, puntos nulos, repetidos, diezmado, radio por
// zoom), la caja con altura, y que el estilo del 3D solo use tokens del tema y no cambie el de 2D.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Serie } from "../src/contrato/tipos";
import {
  ESTILO_3D,
  MAPA_3D_COHETE_PX,
  MAPA_3D_EPSILON_ALT_M,
  MAPA_3D_ESTACA_CABEZA_PX,
  MAPA_3D_ESTACA_PX,
  MAPA_3D_ESTACA_RADIO_PX,
  MAPA_3D_LADOS,
  MAPA_3D_PLOMADA_PX,
  MAPA_3D_TUBO_MAX_SEGMENTOS,
  MAPA_3D_TUBO_PX,
  MAPA_3D_TUBO_SUBDIV_MAX,
  MAPA_3D_ZOOM_PASO,
  MAPA_EPSILON_GRADOS,
  MAPA_MUNDO_PX,
  MAPA_RASTRO_MAX_PUNTOS,
  RADIO_TIERRA_M,
} from "../src/mapa/constantes";
import {
  CAPAS_3D,
  CAPAS_RELIEVE,
  capaCohete,
  capaEstaca,
  capaTubo,
  cielo3d,
  construirEstilo,
  FUENTE,
  fuente3dVacia,
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
  circuloPoligono,
  cohete3d,
  estaca3d,
  limitesConAltura,
  metrosPorPixel,
  type PuntoAlt,
  puntosAltDeSerie,
  puntosDeSerie,
  tuboTrayectoria,
  unirLimites,
  zoomDeDibujo,
} from "../src/mapa/geo";

const raiz = resolve(import.meta.dirname, "..");
const M_POR_GRADO = (Math.PI / 180) * RADIO_TIERRA_M;
const LAT = 6.582;
const LON = -75.823;
const COS_LAT = Math.cos((LAT * Math.PI) / 180);
/** Longitud de un paso de ~10 m hacia el este (en grados, cerca de la rampa). */
const PASO_ESTE = 10 / (M_POR_GRADO * COS_LAT);
const PRECISION_M = 0.05;
/** Radio del tubo que usan las pruebas, en metros. */
const R = 6;

/** Puntos hacia el este, cada 10 m, con las alturas dadas (null = sin altura). */
function alEste(alturas: (number | null)[], lon0 = LON): PuntoAlt[] {
  return alturas.map((alt_agl_m, i) => ({ lon: lon0 + i * PASO_ESTE, lat: LAT, alt_agl_m }));
}

/** Puntos en la misma posición (ascenso vertical) a las alturas dadas. */
const enVertical = (alturas: number[]): PuntoAlt[] =>
  alturas.map((alt_agl_m) => ({ lon: LON, lat: LAT, alt_agl_m }));

/** Distancia en metros entre dos coordenadas cercanas. */
function distanciaM(a: number[], b: number[]): number {
  const este = ((b[0] as number) - (a[0] as number)) * COS_LAT;
  const norte = (b[1] as number) - (a[1] as number);
  return Math.hypot(este, norte) * M_POR_GRADO;
}

/** El anillo exterior de un polígono (sin el cierre repetido). */
const esquinas = (f: { geometry: { coordinates: number[][][] } }): number[][] =>
  (f.geometry.coordinates[0] as number[][]).slice(0, -1);

/** Ancho y largo (m) de la caja que contiene al polígono, en este y norte. */
function medidasDe(f: { geometry: { coordinates: number[][][] } }): {
  este: number;
  norte: number;
} {
  const pts = esquinas(f);
  const lons = pts.map((p) => p[0] as number);
  const lats = pts.map((p) => p[1] as number);
  return {
    este: (Math.max(...lons) - Math.min(...lons)) * COS_LAT * M_POR_GRADO,
    norte: (Math.max(...lats) - Math.min(...lats)) * M_POR_GRADO,
  };
}

describe("tuboTrayectoria: prismas flotantes que siguen la trayectoria en el aire", () => {
  it("un tramo horizontal a altura constante: rectángulo engrosado y alargado, de la altura menos r a la altura más r", () => {
    const c = tuboTrayectoria(alEste([100, 100]), R);
    expect(c.type).toBe("FeatureCollection");
    expect(c.features).toHaveLength(1);
    const f = c.features[0] as NonNullable<(typeof c.features)[number]>;
    expect(f.properties.base).toBe(100 - R);
    expect(f.properties.height).toBe(100 + R);
    // 10 m de tramo + r de cada lado de largo, y 2r de ancho.
    const { este, norte } = medidasDe(f);
    expect(Math.abs(este - (10 + 2 * R))).toBeLessThan(PRECISION_M);
    expect(Math.abs(norte - 2 * R)).toBeLessThan(PRECISION_M);
    const anillo = f.geometry.coordinates[0] as number[][];
    expect(anillo).toHaveLength(5);
    expect(anillo[4]).toEqual(anillo[0]);
  });

  it("un ascenso vertical (misma posición) NO se pierde: cuadrados de 2r, base > 0 y prismas que se solapan", () => {
    const c = tuboTrayectoria(enVertical([0, 100, 200, 300]), R);
    expect(c.features.length).toBeGreaterThanOrEqual(3);
    for (const f of c.features) {
      const { este, norte } = medidasDe(f);
      expect(Math.abs(este - 2 * R)).toBeLessThan(PRECISION_M);
      expect(Math.abs(norte - 2 * R)).toBeLessThan(PRECISION_M);
      expect(f.properties.base).toBeGreaterThanOrEqual(0);
      expect(f.properties.height).toBeGreaterThan(f.properties.base);
    }
    // Continuo: de 0 a 300 + r, y cada prisma empieza antes de que termine el anterior.
    expect(Math.min(...c.features.map((f) => f.properties.base))).toBe(0);
    expect(Math.max(...c.features.map((f) => f.properties.height))).toBe(300 + R);
    const ordenados = [...c.features].sort((a, b) => a.properties.base - b.properties.base);
    for (let i = 1; i < ordenados.length; i++) {
      const antes = ordenados[i - 1] as NonNullable<(typeof ordenados)[number]>;
      const ahora = ordenados[i] as NonNullable<(typeof ordenados)[number]>;
      expect(ahora.properties.base).toBeLessThanOrEqual(antes.properties.height);
    }
  });

  it("la base nunca baja de 0 (despegue a ras del suelo)", () => {
    const c = tuboTrayectoria(enVertical([0, 1, 2]), R);
    for (const f of c.features) expect(f.properties.base).toBeGreaterThanOrEqual(0);
    expect(c.features[0]?.properties.base).toBe(0);
  });

  it("una deriva inclinada sigue la pendiente: se parte en varios prismas, cada uno con su rango de alturas", () => {
    // 40 m al este bajando de 400 a 0 m: se parte en MAPA_3D_TUBO_SUBDIV_MAX.
    const puntos: PuntoAlt[] = [
      { lon: LON, lat: LAT, alt_agl_m: 400 },
      { lon: LON + 4 * PASO_ESTE, lat: LAT, alt_agl_m: 0 },
    ];
    const c = tuboTrayectoria(puntos, R);
    expect(c.features).toHaveLength(MAPA_3D_TUBO_SUBDIV_MAX);
    const alturas = c.features.map((f) => f.properties.height);
    expect([...alturas].sort((a, b) => b - a)).toEqual(alturas); // baja a lo largo del tramo
    expect(alturas[0]).toBe(400 + R);
    expect(c.features[c.features.length - 1]?.properties.base).toBe(0);
  });

  it("salta los puntos con alt_agl_m nulo y une los vecinos útiles", () => {
    const c = tuboTrayectoria(alEste([0, 100, null, 300, 400]), R);
    // Tramos 0-100, 100-300 (pasando por el nulo) y 300-400.
    expect(c.features.length).toBeGreaterThanOrEqual(3);
    expect(tuboTrayectoria(alEste([null, null, null]), R).features).toEqual([]);
    expect(tuboTrayectoria(alEste([null, 50]), R).features).toEqual([]);
    expect(tuboTrayectoria([], R).features).toEqual([]);
    expect(tuboTrayectoria(alEste([100]), R).features).toEqual([]);
  });

  it("salta los puntos repetidos (misma posición Y altura) pero no los que solo cambian de altura", () => {
    const p = alEste([100, 100, 100]);
    const repetidos = [p[0], p[0], p[1], p[1]] as PuntoAlt[];
    expect(tuboTrayectoria(repetidos, R).features).toHaveLength(1);
    // Casi la misma posición y a menos de MAPA_3D_EPSILON_ALT_M: también es el mismo punto.
    const casi: PuntoAlt[] = [
      { lon: LON, lat: LAT, alt_agl_m: 10 },
      { lon: LON + MAPA_EPSILON_GRADOS / 10, lat: LAT, alt_agl_m: 10 + MAPA_3D_EPSILON_ALT_M / 2 },
      { lon: LON + PASO_ESTE, lat: LAT, alt_agl_m: 10 },
    ];
    expect(tuboTrayectoria(casi, R).features).toHaveLength(1);
    // Misma posición, 50 m más arriba: es un tramo vertical.
    expect(tuboTrayectoria(enVertical([10, 60]), R).features.length).toBeGreaterThanOrEqual(1);
    // Nada de NaN.
    for (const f of tuboTrayectoria(repetidos, R).features) {
      for (const par of esquinas(f)) expect(par.every(Number.isFinite)).toBe(true);
    }
  });

  it("f crece de lo más viejo (0) a lo más nuevo (1), para desvanecer", () => {
    const c = tuboTrayectoria(alEste(Array.from({ length: 20 }, (_, i) => i * 10)), R);
    const f = c.features.map((x) => x.properties.f);
    expect([...f].sort((a, b) => a - b)).toEqual(f);
    expect(f[0]).toBeGreaterThanOrEqual(0);
    expect(f[0]).toBeLessThan(0.1);
    expect(f[f.length - 1]).toBeGreaterThan(0.9);
    expect(f[f.length - 1]).toBeLessThanOrEqual(1);
  });

  it("factorAltura escala las alturas, no el radio (terreno exagerado)", () => {
    const [f] = tuboTrayectoria(alEste([100, 100]), R, undefined, 2).features;
    expect(f?.properties.base).toBe(200 - R);
    expect(f?.properties.height).toBe(200 + R);
    expect(medidasDe(f as NonNullable<typeof f>).norte).toBeCloseTo(2 * R, 1);
  });

  it("diezma: a lo sumo maxSegmentos tramos y siempre el último punto", () => {
    const n = 1000;
    const puntos = alEste(Array.from({ length: n }, (_, i) => 10 + i));
    const c = tuboTrayectoria(puntos, R, 50);
    // Cada tramo se parte en hasta MAPA_3D_TUBO_SUBDIV_MAX prismas.
    expect(c.features.length).toBeLessThanOrEqual(50 * MAPA_3D_TUBO_SUBDIV_MAX);
    expect(c.features.length).toBeGreaterThan(10);
    const alturas = c.features.map((f) => f.properties.height);
    expect(Math.max(...alturas)).toBe(10 + (n - 1) + R); // el último punto sigue estando
  });

  it("con la constante por defecto, el rastro más largo posible da a lo sumo maxSegmentos × subdivisiones", () => {
    const puntos = alEste(Array.from({ length: MAPA_RASTRO_MAX_PUNTOS }, (_, i) => i / 10));
    const c = tuboTrayectoria(puntos, R);
    expect(c.features.length).toBeLessThanOrEqual(
      MAPA_3D_TUBO_MAX_SEGMENTOS * MAPA_3D_TUBO_SUBDIV_MAX,
    );
    expect(c.features.length).toBeGreaterThan(0);
  });
});

describe("el radio del tubo sale del zoom (metros por píxel)", () => {
  it("metrosPorPixel: la circunferencia por el coseno de la latitud entre el mundo en píxeles", () => {
    const esperado = (2 * Math.PI * RADIO_TIERRA_M * COS_LAT) / (MAPA_MUNDO_PX * 2 ** 15);
    expect(metrosPorPixel(15, LAT)).toBeCloseTo(esperado, 9);
    // Cada nivel de zoom la mitad; a más latitud, menos metros por píxel.
    expect(metrosPorPixel(16, LAT) * 2).toBeCloseTo(metrosPorPixel(15, LAT), 9);
    expect(metrosPorPixel(15, 60)).toBeLessThan(metrosPorPixel(15, 0));
    // Ecuador, zoom 0: la circunferencia entera sobre 512 px.
    expect(metrosPorPixel(0, 0)).toBeCloseTo((2 * Math.PI * RADIO_TIERRA_M) / MAPA_MUNDO_PX, 6);
  });

  it("zoomDeDibujo redondea al paso: el tubo no se rearma en cada cuadro", () => {
    expect(MAPA_3D_ZOOM_PASO).toBeGreaterThan(0);
    expect(zoomDeDibujo(15.1)).toBe(15);
    expect(zoomDeDibujo(15.3)).toBe(15.5);
    expect(zoomDeDibujo(15.74)).toBe(15.5);
    expect(zoomDeDibujo(15.76)).toBe(16);
    // Entre dos pasos el tamaño en píxeles varía poco (el radio se fijó al zoom de dibujo).
    for (const z of [14.1, 14.6, 15.2, 15.9]) {
      const px = (MAPA_3D_TUBO_PX * metrosPorPixel(zoomDeDibujo(z), LAT)) / metrosPorPixel(z, LAT);
      expect(px).toBeGreaterThan(MAPA_3D_TUBO_PX * 0.8);
      expect(px).toBeLessThan(MAPA_3D_TUBO_PX * 1.2);
    }
  });

  it("el radio en metros = MAPA_3D_TUBO_PX por los metros por píxel: más zoom, tubo más angosto en metros", () => {
    const ancho = (zoom: number) => {
      const r = MAPA_3D_TUBO_PX * metrosPorPixel(zoom, LAT);
      const [f] = tuboTrayectoria(alEste([100, 100]), r).features;
      return medidasDe(f as NonNullable<typeof f>).norte; // 2r
    };
    expect(ancho(15)).toBeCloseTo(2 * MAPA_3D_TUBO_PX * metrosPorPixel(15, LAT), 1);
    expect(ancho(14)).toBeCloseTo(2 * ancho(15), 1);
  });
});

describe("circuloPoligono", () => {
  it("es un polígono cerrado de N lados con el radio pedido", () => {
    const p = circuloPoligono([LON, LAT], 10, 8);
    const anillo = p.coordinates[0] as number[][];
    expect(anillo).toHaveLength(9);
    expect(anillo[8]).toEqual(anillo[0]);
    for (const punto of anillo) {
      expect(Math.abs(distanciaM([LON, LAT], punto) - 10)).toBeLessThan(PRECISION_M);
    }
  });
});

describe("cohete3d: cuerpo, ojiva y plomada a la altura real", () => {
  const mpp = 2;
  const L = MAPA_3D_COHETE_PX * mpp;

  it("el cuerpo y las ojivas miden lo pedido, escalonadas y cada vez más angostas, a su altura", () => {
    const c = cohete3d([LON, LAT], 500, mpp);
    const piezas = c.features.filter((f) => f.properties.parte !== "plomada");
    expect(piezas).toHaveLength(ESTILO_3D.cohete.length);
    const [cuerpo, ...ojivas] = piezas as NonNullable<(typeof piezas)[number]>[];
    expect(cuerpo?.properties.parte).toBe("cuerpo");
    expect(ojivas.every((o) => o.properties.parte === "ojiva")).toBe(true);
    // Las alturas son sobre el suelo: el cohete va a 500 m, de 500 - 0,5 L a 500 + 0,5 L.
    expect(cuerpo?.properties.base).toBeCloseTo(500 - 0.5 * L, 6);
    expect(Math.max(...piezas.map((f) => f.properties.height))).toBeCloseTo(500 + 0.5 * L, 6);
    expect(Math.min(...piezas.map((f) => f.properties.base))).toBeCloseTo(500 - 0.5 * L, 6);
    // Radios decrecientes: cuerpo > ojiva 1 > ojiva 2 > ojiva 3.
    const radios = piezas.map((f) => medidasDe(f).norte / 2);
    for (let i = 1; i < radios.length; i++) {
      expect(radios[i] as number).toBeLessThan(radios[i - 1] as number);
    }
    expect(radios[0]).toBeCloseTo((ESTILO_3D.cohete[0]?.[1] ?? 0) * L, 0);
    // Cada pieza empieza donde acaba la anterior (el cohete es continuo).
    for (let i = 1; i < piezas.length; i++) {
      expect((piezas[i] as NonNullable<(typeof piezas)[number]>).properties.base).toBeCloseTo(
        (piezas[i - 1] as NonNullable<(typeof piezas)[number]>).properties.height,
        6,
      );
    }
  });

  it("la plomada va del suelo al cuerpo, delgada, en la misma posición", () => {
    const c = cohete3d([LON, LAT], 500, mpp);
    const plomada = c.features.find((f) => f.properties.parte === "plomada");
    expect(plomada).toBeDefined();
    expect(plomada?.properties.base).toBe(0);
    expect(plomada?.properties.height).toBeCloseTo(500 - 0.5 * L, 6);
    expect(medidasDe(plomada as NonNullable<typeof plomada>).este / 2).toBeLessThan(
      MAPA_3D_PLOMADA_PX * mpp * 1.01,
    );
    const cuerpo = c.features[0] as NonNullable<(typeof c.features)[number]>;
    expect(medidasDe(plomada as NonNullable<typeof plomada>).este).toBeLessThan(
      medidasDe(cuerpo).este / 3,
    );
  });

  it("a ras del suelo no hay plomada ni base negativa (el cohete sentado en el suelo)", () => {
    const c = cohete3d([LON, LAT], 0, mpp);
    expect(c.features.find((f) => f.properties.parte === "plomada")).toBeUndefined();
    for (const f of c.features) {
      expect(f.properties.base).toBeGreaterThanOrEqual(0);
      expect(f.properties.height).toBeGreaterThan(0);
    }
  });

  it("el tamaño sale de los píxeles: el doble de metros por píxel, el doble de cohete", () => {
    const [a, b] = [cohete3d([LON, LAT], 300, 1), cohete3d([LON, LAT], 300, 2)];
    const largo = (c: typeof a) =>
      Math.max(
        ...c.features
          .filter((f) => f.properties.parte !== "plomada")
          .map((f) => f.properties.height),
      ) -
      Math.min(
        ...c.features.filter((f) => f.properties.parte !== "plomada").map((f) => f.properties.base),
      );
    expect(largo(a)).toBeCloseTo(MAPA_3D_COHETE_PX, 6);
    expect(largo(b)).toBeCloseTo(2 * MAPA_3D_COHETE_PX, 6);
  });

  it("factorAltura escala la altura (terreno exagerado)", () => {
    const c = cohete3d([LON, LAT], 100, mpp, 2);
    expect(c.features[0]?.properties.base).toBeCloseTo(200 - 0.5 * L, 6);
  });

  it("los polígonos circulares tienen MAPA_3D_LADOS lados", () => {
    const c = cohete3d([LON, LAT], 100, mpp);
    expect(c.features[0]?.geometry.coordinates[0]).toHaveLength(MAPA_3D_LADOS + 1);
  });
});

describe("estaca3d: columna delgada con cabeza ancha", () => {
  it("la columna y la cabeza suman MAPA_3D_ESTACA_PX píxeles de alto y la cabeza es más ancha", () => {
    const mpp = 1.5;
    const c = estaca3d([LON, LAT], mpp);
    const estaca = c.features.find((f) => f.properties.parte === "estaca") as NonNullable<
      (typeof c.features)[number]
    >;
    const cabeza = c.features.find((f) => f.properties.parte === "cabeza") as NonNullable<
      (typeof c.features)[number]
    >;
    expect(estaca.properties.base).toBe(0);
    expect(cabeza.properties.height).toBeCloseTo(MAPA_3D_ESTACA_PX * mpp, 6);
    // La cabeza apoya justo sobre la columna.
    expect(cabeza.properties.base).toBeCloseTo(estaca.properties.height, 6);
    expect(cabeza.properties.height).toBeGreaterThan(cabeza.properties.base);
    expect(medidasDe(cabeza).este / 2).toBeCloseTo(MAPA_3D_ESTACA_CABEZA_PX * mpp, 0);
    expect(medidasDe(estaca).este / 2).toBeLessThan(MAPA_3D_ESTACA_RADIO_PX * mpp * 1.01);
    expect(medidasDe(cabeza).este).toBeGreaterThan(2 * medidasDe(estaca).este);
  });

  it("el tamaño sigue a los metros por píxel", () => {
    const alto = (mpp: number) =>
      Math.max(...estaca3d([LON, LAT], mpp).features.map((f) => f.properties.height));
    expect(alto(3)).toBeCloseTo(2 * alto(1.5), 6);
  });
});

describe("el rastro con altura", () => {
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

  it("agregarPuntoAlt conserva el ascenso vertical (cambia la altura, no la posición) y descarta lo repetido", () => {
    let r: PuntoAlt[] = [];
    for (const alt of [0, 0, 0.1, 5, 5, 40, 40.2, 120]) {
      r = agregarPuntoAlt(r, { lon: LON, lat: LAT, alt_agl_m: alt });
    }
    expect(r.map((p) => p.alt_agl_m)).toEqual([0, 5, 40, 120]);
    // La línea del suelo, en cambio, sigue sin repetir el punto.
    let suelo: [number, number][] = [];
    for (let i = 0; i < 8; i++) suelo = agregarPunto(suelo, [LON, LAT]);
    expect(suelo).toHaveLength(1);
  });

  it("agregarPuntoAlt diezma al pasarse del máximo y conserva el último", () => {
    let r: PuntoAlt[] = [];
    const max = 7;
    for (let i = 0; i < 40; i++) {
      r = agregarPuntoAlt(r, { lon: LON + i * PASO_ESTE, lat: LAT, alt_agl_m: i * 10 }, max);
      expect(r.length).toBeLessThanOrEqual(max);
      expect(r[r.length - 1]?.alt_agl_m).toBe(i * 10);
    }
  });
});

describe("limitesConAltura: la caja que abarca la parte alta de la trayectoria", () => {
  it("sin alturas es la caja del suelo; con altura, crece al norte en h * tan(pitch)", () => {
    const puntos: PuntoAlt[] = [
      { lon: -75.82, lat: 6.58, alt_agl_m: 0 },
      { lon: -75.81, lat: 6.59, alt_agl_m: 1000 },
    ];
    expect(limitesConAltura(puntos, 0)).toEqual([-75.82, 6.58, -75.81, 6.59]);
    const [, , , norte60] = limitesConAltura(puntos, 60) as number[];
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

/** Todas las cadenas de una expresión de MapLibre (anidada), para revisar sus colores. */
function cadenasDe(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(cadenasDe);
  return [];
}

describe("estilo de la vista 3D", () => {
  for (const mision of ["demeter", "hermes"] as const) {
    it(`${mision}: el tubo, el cohete, la estaca y el cielo solo usan colores de los tokens del tema`, () => {
      const lector = lectorDeTema(mision);
      const t = leerTokens(lector);
      const permitidos = new Set<string>(
        Object.keys(VARIABLES_TOKENS).map((c) => t[c as keyof typeof VARIABLES_TOKENS]),
      );
      for (const clave of Object.keys(VARIABLES_TOKENS)) {
        expect(lector(VARIABLES_TOKENS[clave as keyof typeof VARIABLES_TOKENS])).not.toBe("");
      }
      for (const capa of [capaTubo(t), capaCohete(t), capaEstaca(t)]) {
        const color = (capa as { paint: Record<string, unknown> }).paint["fill-extrusion-color"];
        // Los colores (los que parecen un color CSS) son todos tokens, y hay al menos uno.
        const colores = cadenasDe(color).filter((c) => /^(#|rgb|hsl)/i.test(c));
        expect(colores.length, capa.id).toBeGreaterThan(0);
        for (const c of colores) expect(permitidos.has(c), `${capa.id}: ${c}`).toBe(true);
      }
      // El tubo va del color más viejo (--linea) al más nuevo (--acento), como el rastro del suelo.
      const tubo = (capaTubo(t) as { paint: Record<string, unknown> }).paint[
        "fill-extrusion-color"
      ];
      expect(cadenasDe(tubo)).toContain(t.acento);
      expect(cadenasDe(tubo)).toContain(t.linea);

      const cielo = cielo3d(t) as Record<string, unknown>;
      const coloresCielo = Object.entries(cielo).filter(([k]) => k.endsWith("-color"));
      expect(coloresCielo.map(([k]) => k).sort()).toEqual([
        "fog-color",
        "horizon-color",
        "sky-color",
      ]);
      for (const [k, v] of coloresCielo)
        expect(permitidos.has(v as string), `${k}: ${v}`).toBe(true);
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

  it("cada capa de prismas es una fill-extrusion con altura y base de cada polígono, sobre su propia fuente", () => {
    const t = leerTokens(lectorDeTema("demeter"));
    const capas = [capaTubo(t), capaCohete(t), capaEstaca(t)] as unknown as {
      id: string;
      type: string;
      source: string;
      paint: Record<string, unknown>;
    }[];
    expect(capas.map((c) => c.id)).toEqual([...CAPAS_3D]);
    for (const capa of capas) {
      expect(capa.type).toBe("fill-extrusion");
      expect(capa.source).toBe(capa.id);
      expect(capa.paint["fill-extrusion-height"]).toEqual(["get", "height"]);
      expect(capa.paint["fill-extrusion-base"]).toEqual(["get", "base"]);
      expect(capa.paint["fill-extrusion-opacity"]).toBe(ESTILO_3D.opacidadSolidos);
    }
    expect(fuente3dVacia()).toEqual({
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
    expect(terreno.attribution).toBeUndefined();
  });

  it("el estilo de 2D no lleva nada del 3D: ni capas, ni fuentes, ni cielo ni terreno", () => {
    for (const mision of ["demeter", "hermes"] as const) {
      const t = leerTokens(lectorDeTema(mision));
      for (const relieve of [null, relieveDePrueba(mision)]) {
        const estilo = construirEstilo(t, null, relieve);
        for (const capa of CAPAS_3D) {
          expect(estilo.layers.map((l) => l.id)).not.toContain(capa);
          expect(Object.keys(estilo.sources)).not.toContain(capa);
        }
        expect(estilo.layers.some((l) => l.type === "fill-extrusion")).toBe(false);
        expect(Object.keys(estilo.sources)).not.toContain(ID_3D.fuenteTerreno);
        expect(estilo.terrain).toBeUndefined();
        expect(estilo.sky).toBeUndefined();
      }
    }
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
