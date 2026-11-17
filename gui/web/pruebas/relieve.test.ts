// Relieve del mapa (T-649, D-W22): la decodificación terrarium, las teselas, las curvas de nivel
// sobre un DEM sintético, la carga opcional de los archivos y que el estilo del relieve solo use
// tokens del tema y no cambie nada si faltan los archivos.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BBOX,
  INDICE_CADA_M,
  INTERVALO_CURVAS_M,
  MARGEN_TESELAS,
  PRESUPUESTO_BYTES,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../scripts/generar-relieve.mjs";
import {
  bboxDeRango,
  codificarTerrarium,
  curvasDeNivel,
  decodificarTerrarium,
  ensamblarMosaico,
  LADO_TESELA,
  listarTeselas,
  medianaTresPorTres,
  pixelALonLat,
  rangoDeTeselas,
  recortar,
  simplificar,
  suavizar,
  teselaFraccionaria,
  ventanaDe,
} from "../scripts/relieve-lib.mjs";
import {
  ESTILO_RELIEVE,
  MAPA_AREA_DEFECTO_GRADOS,
  MAPA_CENTRO_POR_DEFECTO,
  RELIEVE_CURVA_INDICE_M,
  RELIEVE_CURVA_INTERVALO_M,
} from "../src/mapa/constantes";
import {
  CAPAS_RELIEVE,
  construirEstilo,
  FUENTE,
  leerTokens,
  leerTokensRelieve,
  type RelieveEstilo,
  VARIABLES_RELIEVE,
  VARIABLES_TOKENS,
} from "../src/mapa/estilo";
import {
  type ColeccionCurvas,
  cargarRelieve,
  esColeccionDeCurvas,
  validarMetaRelieve,
} from "../src/mapa/relieve";

const raiz = resolve(import.meta.dirname, "..");
const carpetaRelieve = join(raiz, "public/mapas/relieve");
const hayRelieve = existsSync(join(carpetaRelieve, "relieve.json"));

// ---- Terrarium ----

describe("decodificación terrarium", () => {
  it("decodifica los valores conocidos (nivel del mar, 1000 m, fracción en B y negativos)", () => {
    expect(decodificarTerrarium(128, 0, 0)).toBe(0);
    expect(decodificarTerrarium(131, 232, 0)).toBe(1000); // 131*256 + 232 - 32768
    expect(decodificarTerrarium(131, 232, 128)).toBe(1000.5);
    expect(decodificarTerrarium(127, 255, 0)).toBe(-1);
    expect(decodificarTerrarium(0, 0, 0)).toBe(-32768);
  });

  it("codificar y decodificar son inversas (a 1/256 m)", () => {
    for (const e of [-400, -0.25, 0, 392.5, 1234.5678, 2145, 8848]) {
      const [r, g, b] = codificarTerrarium(e);
      expect(Math.abs(decodificarTerrarium(r, g, b) - e)).toBeLessThanOrEqual(1 / 512 + 1e-9);
    }
  });
});

// ---- Teselas ----

describe("teselas del recorte", () => {
  it("la tesela de la rampa a z12 es la 1185/1972 (cuenta de la proyección Web Mercator)", () => {
    const p = teselaFraccionaria(
      MAPA_CENTRO_POR_DEFECTO.lon,
      MAPA_CENTRO_POR_DEFECTO.lat,
      ZOOM_MAX,
    );
    expect([Math.floor(p.x), Math.floor(p.y)]).toEqual([1185, 1972]);
  });

  it("el recorte del script es el área por defecto del mapa (±0,05° de la rampa)", () => {
    const { lon, lat } = MAPA_CENTRO_POR_DEFECTO;
    const d = MAPA_AREA_DEFECTO_GRADOS;
    const esperado = [lon - d, lat - d, lon + d, lat + d];
    for (const [i, v] of (BBOX as number[]).entries()) {
      expect(v).toBeCloseTo(esperado[i] as number, 9);
    }
  });

  it("cubre el recorte con el margen pedido y el rango del zoom menor contiene al del mayor", () => {
    let anterior: ReturnType<typeof bboxDeRango> | null = null;
    for (let z = ZOOM_MIN; z <= ZOOM_MAX; z++) {
      const sin = bboxDeRango(rangoDeTeselas(BBOX, z, 0), z);
      const con = bboxDeRango(rangoDeTeselas(BBOX, z, MARGEN_TESELAS), z);
      // Sin margen cubre el recorte; con margen sobra al menos una tesela por cada lado.
      expect(sin[0]).toBeLessThanOrEqual(BBOX[0]);
      expect(sin[1]).toBeLessThanOrEqual(BBOX[1]);
      expect(sin[2]).toBeGreaterThanOrEqual(BBOX[2]);
      expect(sin[3]).toBeGreaterThanOrEqual(BBOX[3]);
      const ladoGrados = 360 / 2 ** z;
      expect(sin[0] - con[0]).toBeCloseTo(ladoGrados, 9);
      expect(con[2] - sin[2]).toBeCloseTo(ladoGrados, 9);
      // `bounds` de la fuente es el del zoom máximo: todos los zooms menores lo contienen.
      if (anterior) {
        expect(anterior[0]).toBeLessThanOrEqual(con[0]);
        expect(anterior[1]).toBeLessThanOrEqual(con[1]);
        expect(anterior[2]).toBeGreaterThanOrEqual(con[2]);
        expect(anterior[3]).toBeGreaterThanOrEqual(con[3]);
      }
      anterior = con;
    }
  });

  it("lista las teselas en un orden fijo y sin repetir", () => {
    const lista = listarTeselas({ xmin: 5, xmax: 6, ymin: 8, ymax: 9 }, 12);
    expect(lista).toEqual([
      { z: 12, x: 5, y: 8 },
      { z: 12, x: 5, y: 9 },
      { z: 12, x: 6, y: 8 },
      { z: 12, x: 6, y: 9 },
    ]);
  });

  it("pixelALonLat invierte teselaFraccionaria", () => {
    const p = teselaFraccionaria(-75.823, 6.582, 12);
    const q = pixelALonLat(p.x * LADO_TESELA, p.y * LADO_TESELA, 12);
    expect(q.lon).toBeCloseTo(-75.823, 9);
    expect(q.lat).toBeCloseTo(6.582, 9);
  });
});

// ---- Curvas de nivel sobre DEM sintético ----

/** Una imagen RGBA 256 x 256 con la elevación que dé `elevacion(lon, lat)` en el centro de cada píxel. */
function teselaSintetica(
  x: number,
  y: number,
  z: number,
  elevacion: (lon: number, lat: number) => number,
) {
  const data = new Uint8Array(LADO_TESELA * LADO_TESELA * 4);
  for (let fila = 0; fila < LADO_TESELA; fila++) {
    for (let col = 0; col < LADO_TESELA; col++) {
      const { lon, lat } = pixelALonLat(
        x * LADO_TESELA + col + 0.5,
        y * LADO_TESELA + fila + 0.5,
        z,
      );
      const [r, g, b] = codificarTerrarium(elevacion(lon, lat));
      data.set([r, g, b, 255], 4 * (fila * LADO_TESELA + col));
    }
  }
  return { width: LADO_TESELA, height: LADO_TESELA, data };
}

const OPCIONES = {
  intervaloM: INTERVALO_CURVAS_M,
  indiceCadaM: INDICE_CADA_M,
  toleranciaPx: 0.5,
  decimales: 6,
};

describe("curvas de nivel", () => {
  it("un cono da anillos cerrados en el radio que toca, con índice cada 250 m", () => {
    const z = 12;
    const origen = { x: 1000, y: 1000 };
    const N = 121;
    const centro = (N - 1) / 2 + 0.5; // el píxel central, en coordenadas de d3 (centro del píxel)
    const valores = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        valores[j * N + i] = 1000 - 10 * Math.hypot(i + 0.5 - centro, j + 0.5 - centro);
      }
    }
    const curvas = curvasDeNivel(
      { ancho: N, alto: N, valores },
      { ...OPCIONES, z, origenPx: origen },
    );
    const niveles = curvas.features.map((f) => f.properties.ele);
    // De 1000 m (cima, no cruza ninguna celda) hacia abajo cada 50 m hasta que cabe en la malla.
    expect(niveles).toEqual([...niveles].sort((a, b) => a - b));
    expect(niveles).toContain(750);
    expect(niveles).toContain(800);
    for (const f of curvas.features) {
      expect(f.properties.tipo).toBe(
        f.properties.ele % INDICE_CADA_M === 0 ? "indice" : "intermedia",
      );
      expect(f.geometry.type).toBe("MultiLineString");
      // Radio esperado en px: (1000 - ele) / 10. Las coordenadas vuelven a píxeles de la malla.
      const radio = (1000 - f.properties.ele) / 10;
      if (radio >= centro - 1) continue; // los anillos que tocan el borde se recortan
      for (const linea of f.geometry.coordinates) {
        // Cerrado: el primer y el último punto coinciden (o casi: la simplificación los conserva).
        expect(linea.length).toBeGreaterThan(3);
        for (const [lon, lat] of linea) {
          const p = teselaFraccionaria(lon as number, lat as number, z);
          const dx = p.x * LADO_TESELA - origen.x - centro;
          const dy = p.y * LADO_TESELA - origen.y - centro;
          expect(Math.abs(Math.hypot(dx, dy) - radio)).toBeLessThan(0.75);
        }
      }
    }
    const indice = curvas.features.find((f) => f.properties.ele === 750);
    const intermedia = curvas.features.find((f) => f.properties.ele === 800);
    expect(indice?.properties.tipo).toBe("indice");
    expect(intermedia?.properties.tipo).toBe("intermedia");
  });

  it("georreferencia bien: un plano que sube hacia el norte da líneas a la latitud correcta, cruzando teselas", () => {
    const z = 12;
    const rango = { xmin: 1185, xmax: 1186, ymin: 1972, ymax: 1973 };
    // 1 m de altura por cada 0,0001° de latitud: la curva de 1200 m está en 6,52°.
    const elevacion = (_lon: number, lat: number) => 1000 + (lat - 6.5) * 10_000;
    const mosaico = ensamblarMosaico(rango, (x, y) => teselaSintetica(x, y, z, elevacion));
    expect(mosaico.ancho).toBe(2 * LADO_TESELA);
    const curvas = curvasDeNivel(mosaico, {
      ...OPCIONES,
      z,
      origenPx: { x: rango.xmin * LADO_TESELA, y: rango.ymin * LADO_TESELA },
    });
    const sobreLaMalla = curvas.features.filter((f) => f.properties.ele >= 1000);
    expect(sobreLaMalla.length).toBeGreaterThan(2);
    for (const f of sobreLaMalla) {
      const latEsperada = 6.5 + (f.properties.ele - 1000) / 10_000;
      for (const linea of f.geometry.coordinates) {
        // Cruza las dos teselas (de oeste a este) casi completa.
        const lons = linea.map((p) => p[0] as number);
        expect(Math.max(...lons) - Math.min(...lons)).toBeGreaterThan(0.17);
        for (const [, lat] of linea) expect(lat as number).toBeCloseTo(latEsperada, 4);
      }
    }
  });

  it("no deja tramos a lo largo del borde de la malla (el cierre de los polígonos de d3-contour)", () => {
    const N = 40;
    const valores = new Float32Array(N * N);
    // Una loma que se sale por el borde derecho: sus curvas deben quedar abiertas.
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) valores[j * N + i] = 100 + 5 * i;
    const curvas = curvasDeNivel(
      { ancho: N, alto: N, valores },
      { ...OPCIONES, intervaloM: 50, indiceCadaM: 50, z: 12, origenPx: { x: 0, y: 0 } },
    );
    expect(curvas.features.length).toBeGreaterThan(0);
    for (const f of curvas.features) {
      for (const linea of f.geometry.coordinates) {
        const xs = linea.map(
          ([lon, lat]) => teselaFraccionaria(lon as number, lat as number, 12).x * LADO_TESELA,
        );
        // Una curva de un plano inclinado hacia el este es una línea vertical: todos sus x coinciden.
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.1);
      }
    }
  });

  it("exige que el índice sea múltiplo del intervalo", () => {
    const malla = { ancho: 3, alto: 3, valores: new Float32Array(9) };
    expect(() =>
      curvasDeNivel(malla, {
        ...OPCIONES,
        intervaloM: 50,
        indiceCadaM: 120,
        z: 12,
        origenPx: { x: 0, y: 0 },
      }),
    ).toThrow(/múltiplo/);
  });

  it("es determinista: la misma malla da exactamente el mismo GeoJSON", () => {
    const N = 64;
    const valores = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++)
        valores[j * N + i] = 500 + 300 * Math.sin(i / 9) * Math.cos(j / 7);
    }
    const opciones = { ...OPCIONES, z: 12, origenPx: { x: 1_000_000, y: 1_000_000 } };
    const a = JSON.stringify(curvasDeNivel(suavizar({ ancho: N, alto: N, valores }, 2), opciones));
    const b = JSON.stringify(curvasDeNivel(suavizar({ ancho: N, alto: N, valores }, 2), opciones));
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(100);
  });

  it("simplificar quita los puntos alineados y conserva los extremos y los quiebres", () => {
    const recta = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    expect(simplificar(recta, 0.1)).toEqual([
      [0, 0],
      [3, 0],
    ]);
    const quiebre = [
      [0, 0],
      [2, 0],
      [2, 2],
    ];
    expect(simplificar(quiebre, 0.1)).toEqual(quiebre);
    expect(simplificar(recta.slice(0, 2), 0.1)).toEqual(recta.slice(0, 2));
  });

  it("la mediana quita un píxel suelto (-2 m junto a 500 m) y no toca un plano", () => {
    const N = 9;
    const lomo = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) lomo[j * N + i] = 500 + 10 * i;
    const intacto = medianaTresPorTres({ ancho: N, alto: N, valores: lomo });
    expect(intacto.valores[4 * N + 4]).toBe(540);
    const conPico = Float32Array.from(lomo);
    conPico[4 * N + 4] = -2;
    expect(medianaTresPorTres({ ancho: N, alto: N, valores: conPico }).valores[4 * N + 4]).toBe(
      540,
    );
  });

  it("suavizar deja igual un plano (lejos del borde) y baja un pico", () => {
    const N = 9;
    const plano = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) plano[j * N + i] = 10 * i;
    const s = suavizar({ ancho: N, alto: N, valores: plano }, 1);
    expect(s.valores[4 * N + 4]).toBeCloseTo(40, 4);
    const pico = new Float32Array(N * N);
    pico[4 * N + 4] = 90;
    expect(suavizar({ ancho: N, alto: N, valores: pico }, 1).valores[4 * N + 4]).toBeCloseTo(10, 4);
  });

  it("recorta una ventana del mosaico dentro de sus límites", () => {
    const rango = { xmin: 1185, xmax: 1186, ymin: 1972, ymax: 1973 };
    const mosaico = ensamblarMosaico(rango, (x, y) => teselaSintetica(x, y, 12, () => (x + y) % 7));
    const v = ventanaDe(BBOX, rango, 12, 0.005, mosaico);
    expect(v.x0).toBeGreaterThanOrEqual(0);
    expect(v.x0 + v.ancho).toBeLessThanOrEqual(mosaico.ancho);
    expect(v.y0 + v.alto).toBeLessThanOrEqual(mosaico.alto);
    const r = recortar(mosaico, v);
    expect(r.valores.length).toBe(v.ancho * v.alto);
  });
});

// ---- Los archivos generados (si están) ----

describe.skipIf(!hayRelieve)("archivos generados en public/mapas/relieve/", () => {
  const meta = hayRelieve
    ? JSON.parse(readFileSync(join(carpetaRelieve, "relieve.json"), "utf8"))
    : null;

  it("relieve.json lo entiende el mapa, y los intervalos coinciden con las constantes del mapa", () => {
    expect(validarMetaRelieve(meta)).not.toBeNull();
    expect(meta.curvas.intervalo_m).toBe(RELIEVE_CURVA_INTERVALO_M);
    expect(meta.curvas.indice_cada_m).toBe(RELIEVE_CURVA_INDICE_M);
    expect(RELIEVE_CURVA_INTERVALO_M).toBe(INTERVALO_CURVAS_M);
    expect(RELIEVE_CURVA_INDICE_M).toBe(INDICE_CADA_M);
    expect(meta.minzoom).toBe(ZOOM_MIN);
    expect(meta.maxzoom).toBe(ZOOM_MAX);
    expect(meta.codificacion).toBe("terrarium");
  });

  it("están todas las teselas (con el margen), son PNG de 256 x 256 y todo pesa menos que el presupuesto", () => {
    let total = statSync(join(carpetaRelieve, "relieve.json")).size;
    total += statSync(join(carpetaRelieve, meta.curvas.archivo)).size;
    let cuantas = 0;
    for (let z = meta.minzoom; z <= meta.maxzoom; z++) {
      for (const t of listarTeselas(rangoDeTeselas(meta.bbox, z, MARGEN_TESELAS), z)) {
        const ruta = join(carpetaRelieve, `${t.z}/${t.x}/${t.y}.png`);
        expect(existsSync(ruta), `falta ${t.z}/${t.x}/${t.y}`).toBe(true);
        const bytes = readFileSync(ruta);
        expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
        expect(bytes.readUInt32BE(16)).toBe(LADO_TESELA);
        expect(bytes.readUInt32BE(20)).toBe(LADO_TESELA);
        total += bytes.length;
        cuantas++;
      }
    }
    expect(cuantas).toBe(meta.teselas);
    expect(total).toBeLessThanOrEqual(PRESUPUESTO_BYTES);
  });

  it("las curvas son un GeoJSON con índice e intermedias dentro del recorte y de la elevación esperada", () => {
    const curvas = JSON.parse(readFileSync(join(carpetaRelieve, meta.curvas.archivo), "utf8"));
    expect(esColeccionDeCurvas(curvas)).toBe(true);
    const tipos = new Set(
      curvas.features.map((f: { properties: { tipo: string } }) => f.properties.tipo),
    );
    expect([...tipos].sort()).toEqual(["indice", "intermedia"]);
    const holgura = 0.02;
    for (const f of curvas.features) {
      expect(f.properties.ele % RELIEVE_CURVA_INTERVALO_M).toBe(0);
      expect(f.properties.tipo).toBe(
        f.properties.ele % RELIEVE_CURVA_INDICE_M === 0 ? "indice" : "intermedia",
      );
      for (const linea of f.geometry.coordinates) {
        for (const [lon, lat] of linea) {
          expect(lon).toBeGreaterThan(BBOX[0] - holgura);
          expect(lon).toBeLessThan(BBOX[2] + holgura);
          expect(lat).toBeGreaterThan(BBOX[1] - holgura);
          expect(lat).toBeLessThan(BBOX[3] + holgura);
        }
      }
    }
  });
});

// ---- Carga opcional ----

describe("validarMetaRelieve", () => {
  const bueno = {
    bounds: [-76, 6.4, -75.6, 6.8],
    minzoom: 10,
    maxzoom: 12,
    codificacion: "terrarium",
    tamano_tesela: 256,
    curvas: { archivo: "curvas.geojson", intervalo_m: 50, indice_cada_m: 250 },
  };

  it("acepta un relieve.json bueno, con o sin curvas", () => {
    expect(validarMetaRelieve(bueno)).toMatchObject({
      bounds: [-76, 6.4, -75.6, 6.8],
      minzoom: 10,
      maxzoom: 12,
      tamanoTesela: 256,
      curvas: { archivo: "curvas.geojson", intervaloM: 50, indiceCadaM: 250 },
    });
    expect(validarMetaRelieve({ ...bueno, curvas: undefined })?.curvas).toBeNull();
  });

  it("rechaza lo que no es creíble", () => {
    for (const malo of [
      null,
      "texto",
      {},
      { ...bueno, bounds: [1, 2, 3] },
      { ...bueno, bounds: [-75.6, 6.4, -76, 6.8] }, // al revés
      { ...bueno, bounds: [-76, 6.4, -75.6, Number.NaN] },
      { ...bueno, minzoom: 13 }, // minzoom mayor que maxzoom
      { ...bueno, codificacion: "mapbox" },
    ]) {
      expect(validarMetaRelieve(malo)).toBeNull();
    }
  });
});

describe("cargarRelieve (sin los archivos, el mapa queda como antes)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const respuesta = (cuerpo: string, estado = 200) => new Response(cuerpo, { status: estado });
  const metaBueno = JSON.stringify({
    bounds: [-76, 6.4, -75.6, 6.8],
    minzoom: 10,
    maxzoom: 12,
    codificacion: "terrarium",
    curvas: { archivo: "curvas.geojson", intervalo_m: 50, indice_cada_m: 250 },
  });
  const curvasBuenas = JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { ele: 750, tipo: "indice" },
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [
              [-75.8, 6.5],
              [-75.7, 6.5],
            ],
          ],
        },
      },
    ],
  });

  function simular(rutas: Record<string, () => Response>) {
    vi.stubGlobal("location", { href: "http://localhost/demeter/" });
    const pedidos: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        pedidos.push(url);
        const hacer = rutas[new URL(url).pathname];
        if (!hacer) return respuesta("no existe", 404);
        return hacer();
      }),
    );
    return pedidos;
  }

  it("con los archivos, arma la URL de las teselas sin codificar las llaves y trae las curvas", async () => {
    const pedidos = simular({
      "/mapas/relieve/relieve.json": () => respuesta(metaBueno),
      "/mapas/relieve/curvas.geojson": () => respuesta(curvasBuenas),
    });
    const r = await cargarRelieve();
    expect(r?.urlTeselas).toBe("http://localhost/mapas/relieve/{z}/{x}/{y}.png");
    expect(r?.curvas?.features).toHaveLength(1);
    expect(r?.atribucion).toMatch(/Mapzen/);
    expect(r?.atribucion).toMatch(/SRTM/);
    expect(pedidos).toEqual([
      "http://localhost/mapas/relieve/relieve.json",
      "http://localhost/mapas/relieve/curvas.geojson",
    ]);
  });

  it("con un 404, con un index.html o con la red caída devuelve null, avisa y no lanza", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    simular({});
    expect(await cargarRelieve()).toBeNull();
    simular({ "/mapas/relieve/relieve.json": () => respuesta("<!doctype html><title>x</title>") });
    expect(await cargarRelieve()).toBeNull();
    vi.stubGlobal("location", { href: "http://localhost/demeter/" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    expect(await cargarRelieve()).toBeNull();
    simular({ "/mapas/relieve/relieve.json": () => respuesta(JSON.stringify({ bounds: 1 })) });
    expect(await cargarRelieve()).toBeNull();
    expect(aviso).toHaveBeenCalledTimes(4);
  });

  it("si solo faltan las curvas, queda el sombreado (sin curvas) y se avisa", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    simular({ "/mapas/relieve/relieve.json": () => respuesta(metaBueno) });
    const r = await cargarRelieve();
    expect(r).not.toBeNull();
    expect(r?.curvas).toBeNull();
    expect(aviso).toHaveBeenCalledTimes(1);
  });
});

// ---- El estilo del relieve ----

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

const curvasDePrueba: ColeccionCurvas = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { ele: 750, tipo: "indice" },
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [
            [-75.8, 6.5],
            [-75.7, 6.5],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { ele: 800, tipo: "intermedia" },
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [
            [-75.8, 6.6],
            [-75.7, 6.6],
          ],
        ],
      },
    },
  ],
};

function relieveDePrueba(mision: "demeter" | "hermes", conCurvas = true): RelieveEstilo {
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
        curvas: { archivo: "curvas.geojson", intervaloM: 50, indiceCadaM: 250 },
      },
      curvas: conCurvas ? curvasDePrueba : null,
    },
  };
}

const BASE = { url: "pmtiles://http://x/mapa.pmtiles", atribucion: "© OSM" };

describe("estilo del relieve", () => {
  for (const mision of ["demeter", "hermes"] as const) {
    it(`${mision}: los tokens del relieve salen de su CSS y las capas no usan ningún otro color`, () => {
      const lector = lectorDeTema(mision);
      const t = leerTokens(lector);
      const r = relieveDePrueba(mision);
      for (const [clave, variable] of Object.entries(VARIABLES_RELIEVE)) {
        expect(lector(variable), `${variable} no está en el tema`).not.toBe("");
        expect(r.tokens[clave as keyof typeof r.tokens]).toBe(lector(variable));
      }
      const permitidos = new Set<string>([
        ...Object.keys(VARIABLES_TOKENS).map((c) => t[c as keyof typeof VARIABLES_TOKENS]),
        ...Object.values(r.tokens),
      ]);
      for (const base of [null, BASE]) {
        const estilo = construirEstilo(t, base, r);
        const delRelieve = estilo.layers.filter((l) => l.id.startsWith("relieve-"));
        expect(delRelieve.map((l) => l.id)).toEqual([
          CAPAS_RELIEVE.sombreado,
          CAPAS_RELIEVE.curvas,
          CAPAS_RELIEVE.curvasIndice,
        ]);
        let colores = 0;
        for (const capa of estilo.layers) {
          const paint = (capa as { paint?: Record<string, unknown> }).paint ?? {};
          for (const [clave, valor] of Object.entries(paint)) {
            if (!clave.endsWith("-color")) continue;
            colores++;
            expect(permitidos.has(valor as string), `${capa.id}: ${valor} no es un token`).toBe(
              true,
            );
          }
        }
        expect(colores).toBeGreaterThan(delRelieve.length);
      }
    });
  }

  it("los dos temas tienen colores de relieve distintos, y distintos del acento de la trayectoria", () => {
    const d = relieveDePrueba("demeter").tokens;
    const h = relieveDePrueba("hermes").tokens;
    expect(d).not.toEqual(h);
    for (const [mision, r] of [
      ["demeter", d],
      ["hermes", h],
    ] as const) {
      const acento = leerTokens(lectorDeTema(mision)).acento;
      for (const color of Object.values(r)) expect(color).not.toBe(acento);
    }
  });

  it("sin relieve el estilo es EXACTAMENTE el de antes: ni una capa ni una fuente más", () => {
    const t = leerTokens(lectorDeTema("demeter"));
    for (const base of [null, BASE]) {
      const sin = construirEstilo(t, base, null);
      expect(JSON.stringify(sin)).toBe(JSON.stringify(construirEstilo(t, base)));
      expect(Object.keys(sin.sources)).not.toContain(FUENTE.relieve);
      expect(Object.keys(sin.sources)).not.toContain(FUENTE.curvas);
      expect(sin.layers.some((l) => l.id.startsWith("relieve-"))).toBe(false);
    }
    expect(construirEstilo(t, null).layers.map((l) => l.id)).toEqual([
      "fondo",
      "cuadricula",
      "elipse-relleno",
      "elipse-borde",
      "linea-estacion",
      "trayectoria",
    ]);
  });

  it("el relieve va sobre la tierra y el uso del suelo, bajo el agua, las vías y toda la misión", () => {
    const t = leerTokens(lectorDeTema("hermes"));
    const r = relieveDePrueba("hermes");
    const idsCon = construirEstilo(t, BASE, r).layers.map((l) => l.id);
    const pos = (id: string) => idsCon.indexOf(id);
    for (const debajo of ["fondo", "base-tierra", "base-uso"]) {
      expect(pos(debajo)).toBeLessThan(pos(CAPAS_RELIEVE.sombreado));
    }
    for (const arriba of [
      "base-agua",
      "base-rios",
      "base-vias-menores",
      "base-vias",
      "base-lugares",
      "elipse-relleno",
      "elipse-borde",
      "linea-estacion",
      "trayectoria",
    ]) {
      expect(pos(arriba)).toBeGreaterThan(pos(CAPAS_RELIEVE.curvasIndice));
    }
    // Sin PMTiles: sobre el fondo y la cuadrícula, bajo la misión.
    const idsSin = construirEstilo(t, null, r).layers.map((l) => l.id);
    expect(idsSin).toEqual([
      "fondo",
      "cuadricula",
      CAPAS_RELIEVE.sombreado,
      CAPAS_RELIEVE.curvas,
      CAPAS_RELIEVE.curvasIndice,
      "elipse-relleno",
      "elipse-borde",
      "linea-estacion",
      "trayectoria",
    ]);
  });

  it("la fuente es un raster-dem terrarium acotado a lo descargado, y no hay etiquetas", () => {
    const t = leerTokens(lectorDeTema("demeter"));
    const estilo = construirEstilo(t, null, relieveDePrueba("demeter"));
    expect(estilo.sources[FUENTE.relieve]).toMatchObject({
      type: "raster-dem",
      encoding: "terrarium",
      tiles: ["http://localhost/mapas/relieve/{z}/{x}/{y}.png"],
      bounds: [-76, 6.4, -75.6, 6.8],
      minzoom: 10,
      maxzoom: 12,
      tileSize: 256,
      attribution: "Relieve: Mapzen",
    });
    expect(estilo.sources[FUENTE.curvas]).toMatchObject({ type: "geojson" });
    for (const capa of estilo.layers.filter((l) => l.id.startsWith("relieve-"))) {
      expect(capa.type).not.toBe("symbol");
    }
    // Las curvas intermedias solo aparecen desde un zoom; las índice, siempre.
    const intermedias = estilo.layers.find((l) => l.id === CAPAS_RELIEVE.curvas);
    expect(intermedias?.minzoom).toBe(ESTILO_RELIEVE.zoomCurvaIntermedia);
    expect(estilo.layers.find((l) => l.id === CAPAS_RELIEVE.curvasIndice)?.minzoom).toBeUndefined();
  });

  it("sin curvas (no llegaron) queda solo el sombreado", () => {
    const t = leerTokens(lectorDeTema("demeter"));
    const estilo = construirEstilo(t, null, relieveDePrueba("demeter", false));
    expect(Object.keys(estilo.sources)).toContain(FUENTE.relieve);
    expect(Object.keys(estilo.sources)).not.toContain(FUENTE.curvas);
    expect(estilo.layers.filter((l) => l.id.startsWith("relieve-")).map((l) => l.id)).toEqual([
      CAPAS_RELIEVE.sombreado,
    ]);
  });

  it("si el tema no define un token del relieve, leerTokensRelieve devuelve null (no se inventa un color)", () => {
    expect(leerTokensRelieve(() => "")).toBeNull();
    const lector = lectorDeTema("demeter");
    expect(leerTokensRelieve((v) => (v === "--relieve-luz" ? "" : lector(v)))).toBeNull();
  });
});
