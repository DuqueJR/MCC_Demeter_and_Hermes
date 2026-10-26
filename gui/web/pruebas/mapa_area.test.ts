// Área navegable del mapa (T-634): los límites y el zoom máximo salen de la cabecera del PMTiles,
// el zoom mínimo del tamaño del contenedor, y lo dibujado (LKP, cohete, trayectoria, estación)
// nunca queda fuera del área (GS-03). Todo es lógica pura: sin MapLibre ni DOM.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bytesToHeader } from "pmtiles";
import { describe, expect, it } from "vitest";
import { snapshotEjemplo } from "../src/contrato/ejemplos";
import {
  ampliarParaIncluir,
  ampliarParaVista,
  areaPorDefecto,
  coberturaDeCabecera,
  dentroDe,
  encoger,
  mismosLimites,
  zoomMaximo,
  zoomMinimo,
} from "../src/mapa/area";
import {
  MAPA_AREA_DEFECTO_GRADOS,
  MAPA_MARGEN_INCLUIR_FRACCION,
  MAPA_MARGEN_INCLUIR_GRADOS,
  MAPA_MARGEN_LIMITES,
  MAPA_SOBREZOOM,
  MAPA_ZOOM_MAX,
} from "../src/mapa/constantes";
import {
  type Coord,
  construirCapas,
  decidirLkp,
  type EntradaMapa,
  type Limites,
  limitesDe,
} from "../src/mapa/geo";

const raiz = resolve(import.meta.dirname, "..");
const PMTILES = resolve(raiz, "public/mapas/santa_fe.pmtiles");
const SITIO = snapshotEjemplo.meta.sitio;
const CABECERA = { minLon: -75.873, minLat: 6.532, maxLon: -75.773, maxLat: 6.632, maxZoom: 15 };

describe("coberturaDeCabecera", () => {
  it("toma el recuadro y el zoom máximo de la cabecera", () => {
    expect(coberturaDeCabecera(CABECERA)).toEqual({
      limites: [-75.873, 6.532, -75.773, 6.632],
      zoomMax: 15,
    });
  });

  it("una cabecera sin recuadro creíble no limita el mapa (null)", () => {
    const malas = [
      { ...CABECERA, minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 }, // en ceros
      { ...CABECERA, minLon: -75.7, maxLon: -75.8 }, // al revés
      { ...CABECERA, maxLat: 91 }, // fuera de la Tierra
      { ...CABECERA, minLon: -181 },
      { ...CABECERA, minLat: Number.NaN },
      { ...CABECERA, maxZoom: -1 },
    ];
    for (const h of malas) expect(coberturaDeCabecera(h)).toBeNull();
  });

  // El archivo real no se versiona: sin él, solo se prueba con la cabecera de arriba.
  it.skipIf(!existsSync(PMTILES))(
    "el PMTiles de la zona: ±0,05° alrededor del sitio y zoom máximo 15 (README del módulo)",
    () => {
      const bytes = readFileSync(PMTILES);
      const h = bytesToHeader(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + 127) as ArrayBuffer,
      );
      const c = coberturaDeCabecera(h);
      expect(c).not.toBeNull();
      expect(c?.zoomMax).toBe(15);
      const [oeste, sur, este, norte] = c?.limites ?? [0, 0, 0, 0];
      expect(oeste).toBeCloseTo(SITIO.lon - 0.05, 3);
      expect(este).toBeCloseTo(SITIO.lon + 0.05, 3);
      expect(sur).toBeCloseTo(SITIO.lat - 0.05, 3);
      expect(norte).toBeCloseTo(SITIO.lat + 0.05, 3);
    },
  );
});

describe("área por defecto y márgenes", () => {
  it("sin PMTiles: un cuadrado de MAPA_AREA_DEFECTO_GRADOS a cada lado de la rampa", () => {
    const a = areaPorDefecto(SITIO);
    expect(a[0]).toBeCloseTo(SITIO.lon - MAPA_AREA_DEFECTO_GRADOS, 9);
    expect(a[1]).toBeCloseTo(SITIO.lat - MAPA_AREA_DEFECTO_GRADOS, 9);
    expect(a[2]).toBeCloseTo(SITIO.lon + MAPA_AREA_DEFECTO_GRADOS, 9);
    expect(a[3]).toBeCloseTo(SITIO.lat + MAPA_AREA_DEFECTO_GRADOS, 9);
    expect(dentroDe(a, SITIO.lon, SITIO.lat)).toBe(true);
  });

  it("encoger mete cada lado hacia adentro la fracción pedida", () => {
    const l: Limites = [-76, 6, -75, 7];
    const e = encoger(l, 0.1);
    expect(e[0]).toBeCloseTo(-75.9, 9);
    expect(e[1]).toBeCloseTo(6.1, 9);
    expect(e[2]).toBeCloseTo(-75.1, 9);
    expect(e[3]).toBeCloseTo(6.9, 9);
    const por = encoger(l);
    expect(por[0]).toBeCloseTo(l[0] + MAPA_MARGEN_LIMITES, 9);
  });
});

describe("ampliarParaIncluir (GS-03)", () => {
  const area: Limites = [-75.87, 6.53, -75.77, 6.63];

  it("si todo cabe, el área no cambia (el mismo arreglo: no hay nada que aplicar)", () => {
    expect(ampliarParaIncluir(area, [-75.83, 6.57, -75.81, 6.59])).toBe(area);
    expect(ampliarParaIncluir(area, null)).toBe(area);
  });

  it("un punto afuera amplía solo el lado que rebasa, con una holgura que crece con el conjunto", () => {
    // Norte: el conjunto mide 0,17° de alto, así que la holgura es el 15 % de eso (> el mínimo).
    const norte = ampliarParaIncluir(area, [-75.82, 6.7, -75.82, 6.7]);
    const margenNorte = Math.max(MAPA_MARGEN_INCLUIR_GRADOS, MAPA_MARGEN_INCLUIR_FRACCION * 0.17);
    expect(margenNorte).toBeGreaterThan(MAPA_MARGEN_INCLUIR_GRADOS);
    expect(norte[3]).toBeCloseTo(6.7 + margenNorte, 9);
    expect([norte[0], norte[1], norte[2]]).toEqual([area[0], area[1], area[2]]);

    const suroeste = ampliarParaIncluir(area, [-76, 6.4, -76, 6.4]);
    const margenSO = MAPA_MARGEN_INCLUIR_FRACCION * 0.23; // el conjunto mide 0,23° de ancho
    expect(suroeste[0]).toBeCloseTo(-76 - margenSO, 9);
    expect(suroeste[1]).toBeCloseTo(6.4 - margenSO, 9);
    expect([suroeste[2], suroeste[3]]).toEqual([area[2], area[3]]);
  });

  it("un punto un poco más afuera que el mínimo gana al menos el margen mínimo", () => {
    const l = ampliarParaIncluir(area, [area[2] + 0.0001, 6.58, area[2] + 0.0001, 6.58]);
    expect(l[2]).toBeGreaterThanOrEqual(area[2] + 0.0001 + MAPA_MARGEN_INCLUIR_GRADOS);
  });

  it("un punto justo en el borde o a menos del margen mínimo también amplía (no queda pegado al filo)", () => {
    const enElBorde = ampliarParaIncluir(area, [area[2], 6.58, area[2], 6.58]);
    expect(enElBorde[2]).toBeGreaterThanOrEqual(area[2] + MAPA_MARGEN_INCLUIR_GRADOS);
    const casiEnElBorde = ampliarParaIncluir(area, [area[0] + 0.005, 6.58, area[0] + 0.005, 6.58]);
    expect(casiEnElBorde[0]).toBeLessThan(area[0]);
    // Lejos del borde (más que el margen mínimo): no cambia nada.
    expect(ampliarParaIncluir(area, [area[0] + 0.02, 6.58, area[0] + 0.02, 6.58])).toBe(area);
  });

  it("propiedad: tras ampliar, cualquier punto o caja queda adentro", () => {
    let semilla = 7;
    const azar = () => {
      semilla = (semilla * 16807) % 2147483647;
      return semilla / 2147483647;
    };
    for (let i = 0; i < 500; i++) {
      const lon = -77 + azar() * 4;
      const lat = 5.5 + azar() * 2;
      const caja: Limites = [lon, lat, lon + azar() * 0.2, lat + azar() * 0.2];
      const a = ampliarParaIncluir(area, caja);
      expect(dentroDe(a, caja[0], caja[1])).toBe(true);
      expect(dentroDe(a, caja[2], caja[3])).toBe(true);
      // y el área nunca se achica
      expect(a[0]).toBeLessThanOrEqual(area[0]);
      expect(a[3]).toBeGreaterThanOrEqual(area[3]);
    }
  });

  it("con el LKP, el cohete y la trayectoria reales fuera del recorte, todo queda adentro", () => {
    const lejos: Coord = [SITIO.lon + 0.3, SITIO.lat + 0.25]; // ~33 km al noreste del recorte
    const estado = snapshotEjemplo.estado;
    if (!estado) throw new Error("el ejemplo no trae estado");
    const e: EntradaMapa = {
      sitio: SITIO,
      estado: {
        ...estado,
        pos: null,
        lkp: { lat: lejos[1], lon: lejos[0], alt_agl_m: 80, utc_ms: 1 },
      },
      estacion: snapshotEjemplo.estacion && {
        ...snapshotEjemplo.estacion,
        pos: { lat: SITIO.lat - 0.2, lon: SITIO.lon - 0.2, alt_msl_m: 500 },
      },
      serie: snapshotEjemplo.serie,
      principal: "sin_senal",
      edadMs: 60_000,
    };
    const decision = decidirLkp(e, null);
    const rastro: Coord[] = [[SITIO.lon, SITIO.lat], [SITIO.lon + 0.1, SITIO.lat + 0.1], lejos];
    const capas = construirCapas(e, decision, rastro);
    expect(capas.marcadores.lkp?.pos).toEqual(lejos);
    const base = areaPorDefecto(SITIO);
    expect(dentroDe(base, lejos[0], lejos[1])).toBe(false); // sin la excepción, el LKP quedaría afuera

    const area = ampliarParaIncluir(base, capas.limites);
    expect(dentroDe(area, lejos[0], lejos[1])).toBe(true);
    if (capas.marcadores.estacion) {
      const [lon, lat] = capas.marcadores.estacion;
      expect(dentroDe(area, lon, lat)).toBe(true);
    }
    for (const [lon, lat] of rastro) expect(dentroDe(area, lon, lat)).toBe(true);
    // Lo de adentro del recorte original sigue siendo navegable.
    expect(dentroDe(area, SITIO.lon, SITIO.lat)).toBe(true);
  });

  it("mismosLimites compara por valor", () => {
    expect(mismosLimites([1, 2, 3, 4], [1, 2, 3, 4])).toBe(true);
    expect(mismosLimites([1, 2, 3, 4], [1, 2, 3, 5])).toBe(false);
    expect(mismosLimites(null, null)).toBe(true);
    expect(mismosLimites(null, [1, 2, 3, 4])).toBe(false);
  });
});

describe("zoomMinimo", () => {
  it("el mundo entero en 512 px es el zoom 0, y cada duplicación del contenedor suma un nivel", () => {
    const mundo: Limites = [-180, -85.0511287798, 180, 85.0511287798];
    expect(zoomMinimo(mundo, 512, 512)).toBeCloseTo(0, 6);
    expect(zoomMinimo(mundo, 1024, 1024)).toBeCloseTo(1, 6);
    expect(zoomMinimo(mundo, 4096, 4096)).toBeCloseTo(3, 6);
  });

  it("un área de 0,1° en un contenedor de 390 x 844: manda el alto (más estrecho que alto)", () => {
    const a = areaPorDefecto(SITIO, 0.05);
    const z = zoomMinimo(a, 390, 844);
    // A ese zoom el área mide 512 * 2^z * (0,1 / 360) px de ancho: justo llena el alto.
    const anchoPx = 512 * 2 ** z * (0.1 / 360);
    expect(anchoPx).toBeGreaterThanOrEqual(390 - 1e-6);
    // Manda el alto (en Mercator, 0,1° de latitud mide 1/cos(lat) más que 0,1° de longitud).
    expect(anchoPx / Math.cos((SITIO.lat * Math.PI) / 180)).toBeCloseTo(844, -1);
    expect(z).toBeGreaterThan(zoomMinimo(a, 390, 390));
  });

  it("un área mayor permite alejar más; un contenedor mayor, menos", () => {
    const chica = areaPorDefecto(SITIO, 0.05);
    const grande = areaPorDefecto(SITIO, 0.5);
    expect(zoomMinimo(grande, 800, 600)).toBeLessThan(zoomMinimo(chica, 800, 600));
    expect(zoomMinimo(chica, 1440, 900)).toBeGreaterThan(zoomMinimo(chica, 390, 844) - 1);
    expect(zoomMinimo(chica, 1440, 1440)).toBeGreaterThan(zoomMinimo(chica, 390, 390));
  });

  it("nunca baja de 0 ni se rompe con un contenedor sin tamaño o un área degenerada", () => {
    expect(zoomMinimo([-180, -80, 180, 80], 100, 100)).toBe(0);
    expect(zoomMinimo(areaPorDefecto(SITIO), 0, 500)).toBe(0);
    expect(zoomMinimo(areaPorDefecto(SITIO), 500, 0)).toBe(0);
    expect(zoomMinimo([-75, 6, -75, 6], 500, 500)).toBe(0);
  });
});

describe("ampliarParaVista: 'Ver todo' siempre puede mostrar lo dibujado", () => {
  const RELLENO = 72;
  const area: Limites = areaPorDefecto(SITIO, 0.05); // cuadrado de 0,1°

  /** El zoom con el que `caja` cabe en el contenedor con `RELLENO` px de aire (cálculo aparte). */
  function zoomQueCabe(caja: Limites, ancho: number, alto: number): number {
    const mercY = (lat: number) =>
      0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
    const w = (caja[2] - caja[0]) / 360;
    const h = mercY(caja[1]) - mercY(caja[3]);
    return Math.min(
      Math.log2((ancho - 2 * RELLENO) / (512 * w)),
      Math.log2((alto - 2 * RELLENO) / (512 * h)),
    );
  }

  it("lo chico respecto al área no la cambia (el mismo arreglo)", () => {
    const caja: Limites = [SITIO.lon - 0.01, SITIO.lat - 0.01, SITIO.lon + 0.01, SITIO.lat + 0.01];
    expect(ampliarParaVista(area, caja, 1440, 900, RELLENO)).toBe(area);
    expect(ampliarParaVista(area, null, 1440, 900, RELLENO)).toBe(area);
    expect(ampliarParaVista(area, caja, 100, 100, RELLENO)).toBe(area); // contenedor sin sitio
  });

  it("un conjunto que ocupa casi toda el área, en un contenedor apaisado, crece hasta poder abarcarse", () => {
    // Casi tan alto como el área: en 1440 x 900 el área solo se ve a lo ancho y no cabe de alto.
    const caja: Limites = [
      SITIO.lon - 0.04,
      SITIO.lat - 0.048,
      SITIO.lon + 0.04,
      SITIO.lat + 0.048,
    ];
    const mayor = ampliarParaVista(area, caja, 1440, 900, RELLENO);
    expect(mayor).not.toBe(area);
    // Solo crece (nunca se achica) y sigue incluyendo la caja.
    expect(mayor[0]).toBeLessThanOrEqual(area[0]);
    expect(mayor[1]).toBeLessThanOrEqual(area[1]);
    expect(mayor[2]).toBeGreaterThanOrEqual(area[2]);
    expect(mayor[3]).toBeGreaterThanOrEqual(area[3]);
    // Ya se puede alejar hasta el zoom en que la caja cabe con su relleno.
    expect(zoomMinimo(mayor, 1440, 900)).toBeLessThanOrEqual(zoomQueCabe(caja, 1440, 900) + 1e-9);
    // Y antes no se podía: ese era el problema.
    expect(zoomMinimo(area, 1440, 900)).toBeGreaterThan(zoomQueCabe(caja, 1440, 900));
  });

  it("lo mismo en un celular vertical, a lo ancho", () => {
    const caja: Limites = [
      SITIO.lon - 0.048,
      SITIO.lat - 0.04,
      SITIO.lon + 0.048,
      SITIO.lat + 0.04,
    ];
    const mayor = ampliarParaVista(area, caja, 390, 844, RELLENO);
    expect(mayor).not.toBe(area);
    expect(zoomMinimo(mayor, 390, 844)).toBeLessThanOrEqual(zoomQueCabe(caja, 390, 844) + 1e-9);
  });

  it("propiedad: con cualquier conjunto y contenedor, el zoom de 'Ver todo' no baja del mínimo", () => {
    let semilla = 11;
    const azar = () => {
      semilla = (semilla * 16807) % 2147483647;
      return semilla / 2147483647;
    };
    for (let i = 0; i < 300; i++) {
      const ancho = 300 + azar() * 1500;
      const alto = 300 + azar() * 900;
      const lon = SITIO.lon + (azar() - 0.5) * 0.6;
      const lat = SITIO.lat + (azar() - 0.5) * 0.6;
      const caja: Limites = [lon, lat, lon + 0.002 + azar() * 0.3, lat + 0.002 + azar() * 0.3];
      const incluida = ampliarParaIncluir(area, caja);
      const total = ampliarParaVista(incluida, caja, ancho, alto, RELLENO);
      expect(zoomMinimo(total, ancho, alto)).toBeLessThanOrEqual(
        Math.max(zoomQueCabe(caja, ancho, alto), 0) + 1e-9,
      );
      expect(dentroDe(total, caja[0], caja[1])).toBe(true);
      expect(dentroDe(total, caja[2], caja[3])).toBe(true);
    }
  });
});

describe("zoomMaximo", () => {
  it("con PMTiles: el del archivo más el sobrezoom", () => {
    expect(zoomMaximo({ limites: [-75.87, 6.53, -75.77, 6.63], zoomMax: 15 })).toBe(
      15 + MAPA_SOBREZOOM,
    );
    expect(zoomMaximo({ limites: [-75.87, 6.53, -75.77, 6.63], zoomMax: 12 })).toBe(
      12 + MAPA_SOBREZOOM,
    );
  });

  it("sin PMTiles manda MAPA_ZOOM_MAX", () => {
    expect(zoomMaximo(null)).toBe(MAPA_ZOOM_MAX);
  });
});

describe("la caja de lo dibujado", () => {
  it("limitesDe de un solo punto es esa coordenada (y ampliar le da su margen)", () => {
    const l = limitesDe([[-75.5, 6.9]]);
    expect(l).toEqual([-75.5, 6.9, -75.5, 6.9]);
  });
});
