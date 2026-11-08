// Vista 3D del mapa (T-656): lo que se puede probar sin WebGL ni navegador. La altura de dibujo, las
// coordenadas de Mercator, el armado del búfer de la línea y de la plomada (nulos, repetidos, ascenso
// vertical, diezmado), la matriz relativa y la proyección a píxeles, el ángulo de la imagen del cohete
// (vertical, descenso, sin velocidad), la dirección de la velocidad, los colores de los tokens y que el
// estilo del 3D no use prismas ni colores sueltos y no cambie el de 2D.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Serie } from "../src/contrato/tipos";
import {
  ESTILO_3D,
  MAPA_3D_COHETE_ANGULO_DIBUJO,
  MAPA_3D_COHETE_MIN_PX,
  MAPA_3D_EPSILON_ALT_M,
  MAPA_3D_LINEA_MAX_SEGMENTOS,
  MAPA_3D_LINEA_PX,
  MAPA_3D_VEL_MIN_MS,
  MAPA_EPSILON_GRADOS,
  MAPA_MUNDO_PX,
  MAPA_RASTRO_MAX_PUNTOS,
  RADIO_TIERRA_M,
} from "../src/mapa/constantes";
import {
  cielo3d,
  construirEstilo,
  FUENTE,
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
  alturaDeDibujo,
  aMercator,
  anguloConMemoria,
  anguloDeImagen,
  anguloFiable,
  colorARgb,
  construirBufferLinea,
  construirBufferPlomada,
  direccionDeVelocidad,
  FLOATS_POR_VERTICE,
  limitesConAltura,
  matrizRelativa,
  metroEnMercator,
  metrosPorPixel,
  type PuntoAlt,
  proyectarAPixeles,
  puntosAltDeSerie,
  puntosDeSerie,
  suavizarAngulo,
  unirLimites,
  VERTICES_POR_SEGMENTO,
} from "../src/mapa/geo";

const raiz = resolve(import.meta.dirname, "..");
const M_POR_GRADO = (Math.PI / 180) * RADIO_TIERRA_M;
const LAT = 6.582;
const LON = -75.823;
const COS_LAT = Math.cos((LAT * Math.PI) / 180);
/** Longitud de un paso de ~10 m hacia el este (en grados, cerca de la rampa). */
const PASO_ESTE = 10 / (M_POR_GRADO * COS_LAT);
const ORIGEN = aMercator(LON, LAT);
const METRO = metroEnMercator(LAT);
const CONTEXTO = { origen: ORIGEN, metroMercator: METRO, exageracion: 1 };
const N = FLOATS_POR_VERTICE;

/** Puntos hacia el este, cada 10 m, con las alturas dadas (null = sin altura). */
function alEste(alturas: (number | null)[]): PuntoAlt[] {
  return alturas.map((alt_agl_m, i) => ({ lon: LON + i * PASO_ESTE, lat: LAT, alt_agl_m }));
}

/** Puntos en la misma posición (ascenso vertical) a las alturas dadas. */
const enVertical = (alturas: number[]): PuntoAlt[] =>
  alturas.map((alt_agl_m) => ({ lon: LON, lat: LAT, alt_agl_m }));

/** Los números de un vértice del búfer. */
const vertice = (datos: Float32Array, i: number) => ({
  pos: [...datos.slice(i * N, i * N + 3)],
  otro: [...datos.slice(i * N + 3, i * N + 6)],
  lado: datos[i * N + 6] as number,
  f: datos[i * N + 7] as number,
  s: datos[i * N + 8] as number,
  extremo: datos[i * N + 9] as number,
});

describe("altura de dibujo y Mercator", () => {
  it("alturaDeDibujo: la elevación de la rampa más la altura por la exageración", () => {
    expect(alturaDeDibujo(510, 0, 1)).toBe(510);
    expect(alturaDeDibujo(510, 669, 1)).toBe(1179);
    // Con el terreno exagerado, `queryTerrainElevation` ya trae la exageración; la altura sobre la rampa se multiplica.
    expect(alturaDeDibujo(1020, 669, 2)).toBe(1020 + 1338);
    expect(alturaDeDibujo(0, 100, 1)).toBe(100);
  });

  it("aMercator da lo mismo que MapLibre: (0,0) en el centro y el norte hacia y = 0", () => {
    expect(aMercator(0, 0)).toEqual({ x: 0.5, y: 0.5 });
    expect(aMercator(-180, 0).x).toBe(0);
    expect(aMercator(180, 0).x).toBe(1);
    const m = aMercator(LON, LAT);
    expect(m.x).toBeCloseTo((LON + 180) / 360, 12);
    // y = 0,5 - atanh(sen(lat)) / 2π (la forma cerrada de la proyección).
    expect(m.y).toBeCloseTo(0.5 - Math.atanh(Math.sin((LAT * Math.PI) / 180)) / (2 * Math.PI), 12);
    expect(aMercator(0, 40).y).toBeLessThan(aMercator(0, 10).y); // más al norte, menos y
  });

  it("metroEnMercator: un metro en unidades de Mercator, mayor lejos del ecuador", () => {
    expect(metroEnMercator(0)).toBeCloseTo(1 / (2 * Math.PI * RADIO_TIERRA_M), 20);
    expect(metroEnMercator(60)).toBeCloseTo(2 * metroEnMercator(0), 18);
    // Es consistente con metrosPorPixel: el mundo mide MAPA_MUNDO_PX * 2^zoom píxeles.
    expect(metrosPorPixel(15, LAT) * METRO * MAPA_MUNDO_PX * 2 ** 15).toBeCloseTo(1, 9);
  });

  it("metrosPorPixel: la mitad por cada nivel de zoom", () => {
    expect(metrosPorPixel(16, LAT) * 2).toBeCloseTo(metrosPorPixel(15, LAT), 9);
    expect(metrosPorPixel(0, 0)).toBeCloseTo((2 * Math.PI * RADIO_TIERRA_M) / MAPA_MUNDO_PX, 6);
  });
});

describe("construirBufferLinea: la línea en el aire", () => {
  it("un segmento = dos triángulos de seis vértices, con el ancho a cargo del shader", () => {
    const b = construirBufferLinea(alEste([0, 100]), CONTEXTO);
    expect(b.segmentos).toBe(1);
    expect(b.datos).toBeInstanceOf(Float32Array);
    expect(b.datos.length).toBe(VERTICES_POR_SEGMENTO * N);
    // Los lados son -1 y +1, y los extremos 0 (el principio) y 1 (el final).
    const v = Array.from({ length: 6 }, (_, i) => vertice(b.datos, i));
    expect(v.map((x) => x.lado).sort()).toEqual([-1, -1, -1, 1, 1, 1]);
    expect(v.filter((x) => x.extremo === 0)).toHaveLength(3);
    expect(v.filter((x) => x.extremo === 1)).toHaveLength(3);
  });

  it("las posiciones son relativas a la rampa, en unidades de Mercator, con la altura en z", () => {
    const b = construirBufferLinea(alEste([0, 100]), CONTEXTO);
    const [a, e] = [vertice(b.datos, 0), vertice(b.datos, 2)];
    // El primer punto está en el origen (la rampa) a altura 0; el segundo, 10 m al este y 100 m más arriba.
    expect(a.pos[0]).toBeCloseTo(0, 12);
    expect(a.pos[1]).toBeCloseTo(0, 12);
    expect(a.pos[2]).toBeCloseTo(0, 12);
    expect(e.pos[0]).toBeCloseTo(10 * METRO * (1 / COS_LAT) * COS_LAT * 1, 10);
    expect(e.pos[1]).toBeCloseTo(0, 10);
    expect(e.pos[2]).toBeCloseTo(100 * METRO, 10);
    // Cada vértice trae también el otro extremo del segmento.
    expect(a.otro).toEqual(e.pos);
    expect(e.otro).toEqual(a.pos);
  });

  it("la exageración escala la altura y nada más", () => {
    const [uno, dos] = [
      construirBufferLinea(alEste([0, 100]), CONTEXTO),
      construirBufferLinea(alEste([0, 100]), { ...CONTEXTO, exageracion: 2 }),
    ];
    expect(vertice(dos.datos, 2).pos[2]).toBeCloseTo(
      2 * (vertice(uno.datos, 2).pos[2] as number),
      9,
    );
    expect(vertice(dos.datos, 2).pos[0]).toBeCloseTo(vertice(uno.datos, 2).pos[0] as number, 9);
  });

  it("el ascenso vertical NO se pierde: misma posición, otra altura, es un segmento (la línea sube)", () => {
    const b = construirBufferLinea(enVertical([0, 100, 200, 300]), CONTEXTO);
    expect(b.segmentos).toBe(3);
    const alturas = [0, 6, 12].map((i) => (vertice(b.datos, i).pos[2] as number) / METRO);
    expect(alturas[0]).toBeCloseTo(0, 6);
    // Cada segmento empieza donde acabó el anterior.
    expect(alturas[1]).toBeCloseTo(100, 4);
    expect(alturas[2]).toBeCloseTo(200, 4);
    expect(vertice(b.datos, 14).pos[2] as number).toBeCloseTo(300 * METRO, 9);
    // Y la posición en el plano no cambia.
    for (let i = 0; i < b.segmentos * VERTICES_POR_SEGMENTO; i++) {
      expect(vertice(b.datos, i).pos[0]).toBeCloseTo(0, 12);
    }
  });

  it("salta los puntos con alt_agl_m nulo y une los vecinos útiles", () => {
    expect(construirBufferLinea(alEste([0, 100, null, 300, 400]), CONTEXTO).segmentos).toBe(3);
    expect(construirBufferLinea(alEste([null, null]), CONTEXTO).segmentos).toBe(0);
    expect(construirBufferLinea(alEste([null, 50]), CONTEXTO).segmentos).toBe(0);
    expect(construirBufferLinea([], CONTEXTO).segmentos).toBe(0);
    expect(construirBufferLinea([], CONTEXTO).datos).toHaveLength(0);
    expect(construirBufferLinea(alEste([100]), CONTEXTO).segmentos).toBe(0);
  });

  it("salta los repetidos (misma posición Y altura, o casi) pero no los que solo cambian de altura", () => {
    const p = alEste([100, 100]);
    expect(construirBufferLinea([p[0], p[0], p[1], p[1]] as PuntoAlt[], CONTEXTO).segmentos).toBe(
      1,
    );
    const casi: PuntoAlt[] = [
      { lon: LON, lat: LAT, alt_agl_m: 10 },
      { lon: LON + MAPA_EPSILON_GRADOS / 10, lat: LAT, alt_agl_m: 10 + MAPA_3D_EPSILON_ALT_M / 2 },
      { lon: LON + PASO_ESTE, lat: LAT, alt_agl_m: 10 },
    ];
    expect(construirBufferLinea(casi, CONTEXTO).segmentos).toBe(1);
    expect(
      construirBufferLinea(enVertical([10, 10 + 2 * MAPA_3D_EPSILON_ALT_M]), CONTEXTO).segmentos,
    ).toBe(1);
    // Nada de NaN en los números del búfer.
    for (const n of construirBufferLinea(casi, CONTEXTO).datos)
      expect(Number.isFinite(n)).toBe(true);
  });

  it("el degradado crece de lo más viejo (0) a lo más nuevo (1)", () => {
    const b = construirBufferLinea(alEste(Array.from({ length: 12 }, (_, i) => i * 10)), CONTEXTO);
    const f = Array.from(
      { length: b.segmentos },
      (_, i) => vertice(b.datos, i * VERTICES_POR_SEGMENTO).f,
    );
    expect(f[0]).toBe(0);
    expect(f[f.length - 1]).toBe(1);
    expect([...f].sort((a, c) => a - c)).toEqual(f);
    // Con un solo segmento, el más nuevo.
    expect(vertice(construirBufferLinea(alEste([0, 10]), CONTEXTO).datos, 0).f).toBe(1);
  });

  it("diezma: a lo sumo maxSegmentos, y el último punto sigue estando", () => {
    const n = 1000;
    const b = construirBufferLinea(
      alEste(Array.from({ length: n }, (_, i) => 10 + i)),
      CONTEXTO,
      50,
    );
    expect(b.segmentos).toBeLessThanOrEqual(50);
    expect(b.segmentos).toBeGreaterThan(20);
    const ultimo = vertice(b.datos, b.segmentos * VERTICES_POR_SEGMENTO - 1);
    expect(ultimo.pos[2] as number).toBeCloseTo((10 + n - 1) * METRO, 9);
  });

  it("con las constantes por defecto, el rastro más largo posible cabe en MAPA_3D_LINEA_MAX_SEGMENTOS", () => {
    const b = construirBufferLinea(
      alEste(Array.from({ length: MAPA_RASTRO_MAX_PUNTOS }, (_, i) => i / 10)),
      CONTEXTO,
    );
    expect(b.segmentos).toBeLessThanOrEqual(MAPA_3D_LINEA_MAX_SEGMENTOS);
    expect(b.segmentos).toBeGreaterThan(0);
    expect(b.datos.length).toBe(b.segmentos * VERTICES_POR_SEGMENTO * N);
  });

  it("las constantes del dibujo son píxeles razonables", () => {
    expect(MAPA_3D_LINEA_PX).toBeGreaterThan(0);
    expect(MAPA_3D_LINEA_PX).toBeLessThanOrEqual(4); // una línea fina, no una cinta
  });
});

describe("construirBufferPlomada: del cohete al suelo", () => {
  it("un segmento vertical del cohete (arriba) al suelo, con la distancia para el punteado", () => {
    const b = construirBufferPlomada([LON, LAT], 500, 0, CONTEXTO);
    expect(b).not.toBeNull();
    const [arriba, abajo] = [
      vertice((b as { datos: Float32Array }).datos, 0),
      vertice((b as { datos: Float32Array }).datos, 2),
    ];
    expect(arriba.pos[2] as number).toBeCloseTo(500 * METRO, 9);
    expect(abajo.pos[2]).toBeCloseTo(0, 12);
    expect(arriba.pos[0]).toBeCloseTo(0, 12);
    expect(abajo.s).toBeCloseTo(500, 3); // la distancia, en metros
    expect(arriba.s).toBe(0);
  });

  it("si el suelo bajo el cohete está más alto o más bajo que la rampa, la plomada llega hasta él", () => {
    const sobre = construirBufferPlomada([LON, LAT], 500, 40, CONTEXTO);
    expect(vertice((sobre as { datos: Float32Array }).datos, 2).s).toBeCloseTo(460, 3);
    const bajo = construirBufferPlomada([LON, LAT], 500, -30, CONTEXTO);
    expect(vertice((bajo as { datos: Float32Array }).datos, 2).s).toBeCloseTo(530, 3);
    expect(vertice((bajo as { datos: Float32Array }).datos, 2).pos[2] as number).toBeCloseTo(
      -30 * METRO,
      9,
    );
  });

  it("sin altura sobre el suelo no hay plomada", () => {
    expect(construirBufferPlomada([LON, LAT], 0, 0, CONTEXTO)).toBeNull();
    expect(construirBufferPlomada([LON, LAT], 5, 10, CONTEXTO)).toBeNull();
  });
});

describe("matrizRelativa y proyectarAPixeles", () => {
  /** Una proyección en perspectiva sencilla, por columnas: mira hacia -z desde z = 3. */
  const perspectiva = (): number[] => {
    const f = 2;
    // x' = f x; y' = f y; w = 3 - z  (la cámara está en z = 3 mirando al origen)
    return [f, 0, 0, 0, 0, f, 0, 0, 0, 0, 0, -1, 0, 0, 0, 3];
  };

  it("proyectar relativo al origen = proyectar la suma (no se pierde nada al restar el origen)", () => {
    const m = perspectiva();
    const origen = [0.2, -0.1, 0.5] as const;
    const rel = matrizRelativa(m, origen);
    const p = [0.05, 0.03, -0.4] as const;
    const a = proyectarAPixeles(rel, p, 800, 600);
    const b = proyectarAPixeles(
      m,
      [origen[0] + p[0], origen[1] + p[1], origen[2] + p[2]],
      800,
      600,
    );
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.x).toBeCloseTo(b?.x as number, 9);
    expect(a?.y).toBeCloseTo(b?.y as number, 9);
  });

  it("el centro del recorte es el centro del lienzo, y arriba es -y en pantalla", () => {
    const m = perspectiva();
    const c = proyectarAPixeles(m, [0, 0, 0], 800, 600);
    expect(c).toMatchObject({ x: 400, y: 300, dentro: true });
    const arriba = proyectarAPixeles(m, [0, 0.1, 0], 800, 600);
    expect((arriba?.y as number) < 300).toBe(true);
    const derecha = proyectarAPixeles(m, [0.1, 0, 0], 800, 600);
    expect((derecha?.x as number) > 400).toBe(true);
  });

  it("detrás de la cámara (w <= 0) no hay proyección; fuera del lienzo, dentro = false", () => {
    const m = perspectiva();
    expect(proyectarAPixeles(m, [0, 0, 3], 800, 600)).toBeNull();
    expect(proyectarAPixeles(m, [0, 0, 5], 800, 600)).toBeNull();
    const lejos = proyectarAPixeles(m, [2, 0, 0], 800, 600);
    expect(lejos?.dentro).toBe(false);
  });
});

describe("anguloDeImagen: hacia dónde apunta la nariz en pantalla", () => {
  const base = MAPA_3D_COHETE_ANGULO_DIBUJO;
  const desde = { x: 100, y: 100 };

  it("vertical (nariz arriba): resta los grados del dibujo", () => {
    expect(base).toBe(45);
    // Hacia arriba en pantalla (y disminuye): la imagen se gira -45° para que su nariz diagonal apunte arriba.
    expect(anguloDeImagen(desde, { x: 100, y: 40 })).toBeCloseTo(-base, 9);
  });

  it("hacia la diagonal arriba-derecha: el dibujo ya apunta ahí, sin girar", () => {
    expect(anguloDeImagen(desde, { x: 160, y: 40 })).toBeCloseTo(0, 9);
  });

  it("hacia la derecha, abajo y a la izquierda", () => {
    expect(anguloDeImagen(desde, { x: 160, y: 100 })).toBeCloseTo(90 - base, 9);
    // El descenso (nariz hacia abajo, si se sigue la velocidad): 180° - 45°.
    expect(anguloDeImagen(desde, { x: 100, y: 160 })).toBeCloseTo(180 - base, 9);
    expect(anguloDeImagen(desde, { x: 40, y: 100 })).toBeCloseTo(-90 - base, 9);
  });

  it("siempre en (-180, 180]", () => {
    for (const grados of [-170, -135, -90, 0, 45, 90, 135, 179]) {
      const t = (grados * Math.PI) / 180;
      const a = anguloDeImagen(desde, { x: 100 + 50 * Math.sin(t), y: 100 - 50 * Math.cos(t) });
      expect(a).toBeGreaterThan(-180);
      expect(a).toBeLessThanOrEqual(180);
    }
    // Abajo-izquierda: 225° - 45° = 180°, y no -180°.
    expect(anguloDeImagen(desde, { x: 50, y: 150 })).toBeCloseTo(180, 9);
  });

  it("sin los dos puntos o con un vector muy corto no hay rumbo: vertical", () => {
    expect(anguloDeImagen(null, { x: 1, y: 1 })).toBe(-base);
    expect(anguloDeImagen(desde, null)).toBe(-base);
    expect(anguloDeImagen(null, null)).toBe(-base);
    expect(anguloDeImagen(desde, { x: 100 + MAPA_3D_COHETE_MIN_PX / 2, y: 100 })).toBe(-base);
    expect(anguloDeImagen(desde, desde)).toBe(-base);
    expect(anguloDeImagen(desde, { x: 100 + MAPA_3D_COHETE_MIN_PX * 2, y: 100 })).toBeCloseTo(
      90 - base,
      9,
    );
  });
});

describe("direccionDeVelocidad", () => {
  const vel = (e: number, n: number, u: number) => ({ e_ms: e, n_ms: n, u_ms: u });

  it("subiendo es el vector unitario [este, norte, arriba]", () => {
    const d = direccionDeVelocidad(vel(3, 4, 12));
    expect(d).not.toBeNull();
    expect(Math.hypot(...(d as [number, number, number]))).toBeCloseTo(1, 9);
    expect(d?.[2]).toBeCloseTo(12 / 13, 9);
  });

  it("bajando también hay dirección (la nariz sigue el movimiento en todas las fases): hacia abajo y con la deriva", () => {
    const d = direccionDeVelocidad(vel(1, 1, -9)) as [number, number, number];
    expect(d).not.toBeNull();
    expect(Math.hypot(...d)).toBeCloseTo(1, 9);
    expect(d[2]).toBeLessThan(-0.9); // casi recto hacia abajo
    expect(d[0]).toBeGreaterThan(0); // y se inclina con la deriva hacia el este y el norte
    expect(d[1]).toBeGreaterThan(0);
  });

  it("sin velocidad o con una rapidez no fiable, no hay dirección", () => {
    expect(direccionDeVelocidad(null)).toBeNull();
    expect(direccionDeVelocidad(vel(0, 0, MAPA_3D_VEL_MIN_MS / 2))).toBeNull();
    expect(direccionDeVelocidad(vel(0, 0, -MAPA_3D_VEL_MIN_MS / 2))).toBeNull();
    expect(direccionDeVelocidad(vel(0, 0, MAPA_3D_VEL_MIN_MS * 2))).not.toBeNull();
    expect(direccionDeVelocidad(vel(0, 0, -MAPA_3D_VEL_MIN_MS * 2))).not.toBeNull();
  });
});

describe("el ángulo de la imagen con memoria y suavizado", () => {
  const desde = { x: 100, y: 100 };

  it("anguloFiable: null sin los dos puntos o con un vector corto", () => {
    expect(anguloFiable(null, desde)).toBeNull();
    expect(anguloFiable(desde, null)).toBeNull();
    expect(anguloFiable(desde, { x: 100, y: 100 + MAPA_3D_COHETE_MIN_PX / 2 })).toBeNull();
    expect(anguloFiable(desde, { x: 100, y: 40 })).toBeCloseTo(-45, 9);
  });

  it("la bajada, boca abajo: la nariz hacia abajo en pantalla, con la deriva (135° ± lo que se inclina)", () => {
    // Cayendo recto: 180° - 45° = 135° (la imagen se gira para que su nariz diagonal apunte abajo).
    expect(anguloFiable(desde, { x: 100, y: 160 })).toBeCloseTo(135, 9);
    // Con deriva hacia la derecha, la nariz se inclina hacia la derecha: el ángulo baja de 135°.
    const conDeriva = anguloFiable(desde, { x: 110, y: 160 }) as number;
    expect(conDeriva).toBeLessThan(135);
    expect(conDeriva).toBeGreaterThan(90);
  });

  it("con rumbo fiable usa ese y lo marca como válido", () => {
    expect(anguloConMemoria(desde, { x: 100, y: 160 }, -45)).toEqual({ angulo: 135, fiable: true });
  });

  it("sin rumbo fiable (justo en el apogeo) conserva el último ángulo válido en vez de saltar a vertical", () => {
    const sinRumbo = anguloConMemoria(desde, { x: 100.5, y: 100 }, 20);
    expect(sinRumbo).toEqual({ angulo: 20, fiable: false });
    expect(anguloConMemoria(null, null, 135)).toEqual({ angulo: 135, fiable: false });
    // Si nunca hubo uno, vertical con la nariz arriba.
    expect(anguloConMemoria(desde, desde, null)).toEqual({ angulo: -45, fiable: false });
    expect(anguloConMemoria(null, null, null)).toEqual({ angulo: -45, fiable: false });
  });

  it("anguloDeImagen sigue dando vertical sin rumbo (compatibilidad)", () => {
    expect(anguloDeImagen(null, null)).toBe(-45);
  });

  it("suavizarAngulo: avanza hacia el objetivo por el camino corto y no se pasa", () => {
    const a = suavizarAngulo(0, 90, 100, 150);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(90);
    // Con el tiempo se acerca; con mucho tiempo llega (a menos de 0,1°: el objetivo exacto).
    expect(suavizarAngulo(a, 90, 100, 150)).toBeGreaterThan(a);
    let x = 0;
    for (let i = 0; i < 100; i++) x = suavizarAngulo(x, 90, 16, 150);
    expect(x).toBe(90);
  });

  it("suavizarAngulo da la vuelta corta: de 170° a -170° pasa por 180°, no por 0°", () => {
    const a = suavizarAngulo(170, -170, 100, 150);
    expect(a > 170 || a <= -170).toBe(true);
    // Y de -45° (nariz arriba) a 135° (nariz abajo) es media vuelta: en un cuadro no salta de golpe.
    const medio = suavizarAngulo(-45, 135, 16, 150);
    expect(Math.abs(medio - -45)).toBeLessThan(30);
  });

  it("suavizarAngulo sin constante de tiempo (movimiento reducido) salta directo", () => {
    expect(suavizarAngulo(-45, 135, 16, 0)).toBe(135);
    expect(suavizarAngulo(10, 10, 16, 150)).toBe(10);
  });
});

describe("colorARgb: los tokens a colores de WebGL", () => {
  it("lee #rgb, #rrggbb y rgb()", () => {
    expect(colorARgb("#ffffff")).toEqual([1, 1, 1]);
    expect(colorARgb("#000")).toEqual([0, 0, 0]);
    expect(colorARgb(" #f00 ")).toEqual([1, 0, 0]);
    const c = colorARgb("#0b1a24") as number[];
    expect(c[0]).toBeCloseTo(11 / 255, 9);
    expect(c[2]).toBeCloseTo(36 / 255, 9);
    expect(colorARgb("rgb(255, 128, 0)")).toEqual([1, 128 / 255, 0]);
  });

  it("si no lo entiende, null (no se inventa un color)", () => {
    expect(colorARgb("")).toBeNull();
    expect(colorARgb("azul")).toBeNull();
    expect(colorARgb("#12")).toBeNull();
  });

  it("entiende todos los colores de los tokens que usa la capa", () => {
    for (const mision of ["demeter", "hermes"] as const) {
      const t = leerTokens(lectorDeTema(mision));
      for (const css of [t.linea, t.acento, t.texto2]) expect(colorARgb(css), css).not.toBeNull();
    }
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
    it(`${mision}: el cielo solo usa colores de los tokens del tema`, () => {
      const lector = lectorDeTema(mision);
      const t = leerTokens(lector);
      const permitidos = new Set<string>(
        Object.keys(VARIABLES_TOKENS).map((c) => t[c as keyof typeof VARIABLES_TOKENS]),
      );
      for (const clave of Object.keys(VARIABLES_TOKENS)) {
        expect(lector(VARIABLES_TOKENS[clave as keyof typeof VARIABLES_TOKENS])).not.toBe("");
      }
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
    for (const archivo of [
      "estilo.ts",
      "controlador.tsx",
      "geo.ts",
      "constantes.ts",
      "capa3d.ts",
      "Mapa.tsx",
    ]) {
      const texto = readFileSync(join(raiz, "src/mapa", archivo), "utf8");
      expect(texto, archivo).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(texto, archivo).not.toMatch(/\brgba?\s*\(/i);
      expect(texto, archivo).not.toMatch(/\bhsla?\s*\(/i);
    }
  });

  it("no hay prismas (fill-extrusion) en el 3D: la línea y el cohete no son bloques", () => {
    for (const archivo of ["estilo.ts", "capa3d.ts", "geo.ts"]) {
      const texto = readFileSync(join(raiz, "src/mapa", archivo), "utf8");
      expect(
        texto.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""),
        archivo,
      ).not.toContain("fill-extrusion");
    }
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

  it("el estilo de 2D no lleva nada del 3D: ni la capa personalizada, ni prismas, ni cielo ni terreno", () => {
    for (const mision of ["demeter", "hermes"] as const) {
      const t = leerTokens(lectorDeTema(mision));
      for (const relieve of [null, relieveDePrueba(mision)]) {
        const estilo = construirEstilo(t, null, relieve);
        expect(estilo.layers.map((l) => l.id)).not.toContain(ID_3D.capa);
        expect(estilo.layers.some((l) => (l.type as string) === "custom")).toBe(false);
        expect(estilo.layers.some((l) => l.type === "fill-extrusion")).toBe(false);
        expect(Object.keys(estilo.sources)).not.toContain(ID_3D.fuenteTerreno);
        expect(estilo.terrain).toBeUndefined();
        expect(estilo.sky).toBeUndefined();
      }
    }
  });

  it("la presentación del 3D sale de constantes: opacidades entre 0 y 1", () => {
    for (const o of [
      ESTILO_3D.opacidadLinea,
      ESTILO_3D.opacidadPlomada,
      ESTILO_3D.opacidadElipse,
    ]) {
      expect(o).toBeGreaterThan(0);
      expect(o).toBeLessThanOrEqual(1);
    }
    expect(ESTILO_3D.anchoElipse).toBeLessThanOrEqual(2); // un borde fino, no el de 4 px de la ronda 2
  });
});
