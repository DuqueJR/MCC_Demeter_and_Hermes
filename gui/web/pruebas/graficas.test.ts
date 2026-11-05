// Gráficas (T-633): de la `serie` y los `eventos` a las columnas de uPlot, las marcas, los rangos,
// los textos, las medidas y el refresco limitado. Solo lógica pura: el lienzo se prueba en e2e.
import { describe, expect, it, vi } from "vitest";
import { snapshotDe } from "../e2e/mapa_ayudas";
import type { Evento, Mision, Serie, TipoEvento } from "../src/contrato/tipos";
import {
  columnasDe,
  finDelVuelo,
  formatoTick,
  MAGNITUDES,
  type Magnitud,
  marcasDe,
  medidasDelLienzo,
  normaAceleracion,
  puntosConValor,
  rangoX,
  rangoY,
  resumenDe,
  textoMarca,
} from "../src/graficas/columnas";
import {
  GRAFICAS_ALTO_MAX_PX,
  GRAFICAS_ALTO_MIN_PX,
  GRAFICAS_PUNTOS_MIN,
  GRAFICAS_TIEMPO_MIN_S,
} from "../src/graficas/constantes";
import { limitar } from "../src/graficas/limitador";
import { pestanaConTecla } from "../src/graficas/pestanas";
import { decidirVista, TEXTO_ANTES_DEL_DESPEGUE, TEXTO_REUNIENDO } from "../src/graficas/vista";

const magnitud = (id: string): Magnitud => MAGNITUDES.find((m) => m.id === id) as Magnitud;

const evento = (tipo: TipoEvento, t_mas_s: number | null, extra: Partial<Evento> = {}): Evento => ({
  tipo,
  t_ms: 0,
  utc_ms: null,
  t_mas_s,
  valor: null,
  fase: null,
  activa: null,
  ...extra,
});

/** Una serie con los T+ dados; las demás columnas se llenan con una función del índice. */
function serieDe(t: (number | null)[], relleno: Partial<Serie> = {}): Serie {
  const col = (f: (i: number) => number | null) => t.map((_, i) => f(i));
  return {
    t_mas_s: t,
    lat: col(() => 6.5),
    lon: col(() => -75.8),
    alt_agl_m: col((i) => i * 10),
    vz_ms: col((i) => 100 - i),
    acc_x_g: col(() => 3),
    acc_y_g: col(() => 0),
    acc_z_g: col(() => 4),
    ...relleno,
  };
}

describe("columnasDe: T+ nulo o negativo no se dibuja (agenda H0, D5)", () => {
  it("antes del despegue (el cliente pone null): no hay nada que dibujar", () => {
    const c = columnasDe(serieDe([null, null, null]), "altitud", []);
    expect(c.t).toEqual([]);
    expect(c.y).toEqual([]);
  });

  it("snapshot pedido después del despegue (negativos en la espera): se recorta a T+ >= 0", () => {
    const c = columnasDe(serieDe([-7200, -3600, -1, 0, 1, 2]), "altitud", []);
    expect(c.t).toEqual([0, 1, 2]);
    expect(c.y).toEqual([30, 40, 50]);
  });

  it("las dos formas dan la misma gráfica del vuelo", () => {
    const vuelo = [0, 0.5, 1, 1.5];
    const conNulos = columnasDe(serieDe([null, null, ...vuelo]), "altitud", []);
    const conNegativos = columnasDe(serieDe([-60, -30, ...vuelo]), "altitud", []);
    // los puntos de vuelo son los mismos; solo cambia cuántos de la espera había en la serie
    expect(conNulos.t).toEqual(vuelo);
    expect(conNegativos.t).toEqual(vuelo);
  });

  it("después del aterrizaje no sigue: la espera en tierra no aplasta el vuelo", () => {
    const eventos = [evento("aterrizaje", 3)];
    const c = columnasDe(serieDe([0, 1, 2, 3, 4, 3600, 7200]), "altitud", eventos);
    expect(c.t).toEqual([0, 1, 2, 3]);
    expect(finDelVuelo(eventos)).toBe(3);
  });

  it("sin evento de aterrizaje no se corta por arriba", () => {
    expect(columnasDe(serieDe([0, 1, 5000]), "altitud", []).t).toEqual([0, 1, 5000]);
    expect(finDelVuelo([evento("aterrizaje", null)])).toBeNull();
  });

  it("el eje X siempre crece: un T+ repetido, que retrocede, NaN o Infinity se descarta", () => {
    const c = columnasDe(
      serieDe([0, 1, 1, 0.5, 2, Number.NaN, Number.POSITIVE_INFINITY, 3]),
      "altitud",
      [],
    );
    expect(c.t).toEqual([0, 1, 2, 3]);
  });

  it("una serie vacía no rompe", () => {
    expect(columnasDe(serieDe([]), "aceleracion", [])).toEqual({ t: [], y: [] });
  });

  it("columnas de distinto largo (dato corrupto) no lanzan: lo que falta es un hueco", () => {
    const s = serieDe([0, 1, 2], { alt_agl_m: [10], vz_ms: [] });
    expect(columnasDe(s, "altitud", []).y).toEqual([10, null, null]);
    expect(columnasDe(s, "velocidad", []).y).toEqual([null, null, null]);
  });
});

describe("columnasDe: un null es un hueco, nunca un cero", () => {
  it("altitud sin fix (pos = null): hueco", () => {
    const s = serieDe([0, 1, 2, 3], { alt_agl_m: [10, null, null, 40] });
    const c = columnasDe(s, "altitud", []);
    expect(c.y).toEqual([10, null, null, 40]);
    expect(puntosConValor(c)).toBe(2);
  });

  it("velocidad vertical sin fix 3D (vel = null): hueco", () => {
    const s = serieDe([0, 1, 2], { vz_ms: [null, 5, null] });
    expect(columnasDe(s, "velocidad", []).y).toEqual([null, 5, null]);
  });

  it("una columna siempre vacía (Vz sin fix 3D todo el vuelo) no tiene valores", () => {
    const s = serieDe([0, 1, 2], { vz_ms: [null, null, null] });
    const c = columnasDe(s, "velocidad", []);
    expect(c.t).toEqual([0, 1, 2]);
    expect(puntosConValor(c)).toBe(0);
    expect(resumenDe(c, magnitud("velocidad"))).toBeNull();
  });

  it("aceleración: es la norma de los tres ejes; si falta uno, hueco", () => {
    const s = serieDe([0, 1, 2], {
      acc_x_g: [3, 3, null],
      acc_y_g: [0, 0, 0],
      acc_z_g: [4, null, 4],
    });
    expect(columnasDe(s, "aceleracion", []).y).toEqual([5, null, null]);
    expect(normaAceleracion(1, 0, 0)).toBe(1);
    expect(normaAceleracion(null, 0, 0)).toBeNull();
    expect(normaAceleracion(0, Number.NaN, 0)).toBeNull();
  });
});

describe("marcasDe: solo los eventos que existen", () => {
  it("con todos: despegue, fin de combustión, eyección y apogeo, en orden de T+", () => {
    const m = marcasDe([
      evento("fase", 0, { fase: "BOOST" }),
      evento("despegue", 0),
      evento("eyeccion", 25),
      evento("fin_combustion", 3.2),
      evento("apogeo", 21, { valor: 3000 }),
      evento("aterrizaje", 90),
    ]);
    expect(m.map((x) => x.tipo)).toEqual(["despegue", "fin_combustion", "apogeo", "eyeccion"]);
    expect(m.map((x) => x.tMasS)).toEqual([0, 3.2, 21, 25]);
    expect(m.map((x) => x.etiqueta)).toEqual([
      "Despegue",
      "Fin de la combustión",
      "Apogeo",
      "Eyección del paracaídas",
    ]);
  });

  it("cada marca lleva un rótulo corto para escribirlo sobre la gráfica", () => {
    const m = marcasDe([evento("fin_combustion", 3), evento("eyeccion", 9)]);
    expect(m.map((x) => x.rotulo)).toEqual(["Fin combustión", "Eyección"]);
  });

  it("vuelo real hoy: solo `fase` y `despegue` -> una sola marca, sin error", () => {
    const m = marcasDe([evento("fase", 0, { fase: "BOOST" }), evento("despegue", 0)]);
    expect(m).toHaveLength(1);
    expect(m[0]?.tipo).toBe("despegue");
  });

  it("sin eventos o sin despegue: ninguna marca", () => {
    expect(marcasDe([])).toEqual([]);
    expect(marcasDe([evento("fase", null, { fase: "ARMED" })])).toEqual([]);
  });

  it("un evento sin T+ o con T+ negativo no se marca; un tipo repetido vale el primero", () => {
    const m = marcasDe([
      evento("apogeo", null),
      evento("fin_combustion", -2),
      evento("despegue", 0),
      evento("despegue", 99),
    ]);
    expect(m.map((x) => [x.tipo, x.tMasS])).toEqual([["despegue", 0]]);
  });

  it("la frase de cada marca", () => {
    expect(textoMarca({ tipo: "apogeo", etiqueta: "Apogeo", rotulo: "Apogeo", tMasS: 21.5 })).toBe(
      "Apogeo: a los 21,5 s",
    );
  });
});

describe("rangos de los ejes", () => {
  it("X: del despegue al último dato, con un mínimo para los primeros instantes", () => {
    expect(rangoX({ t: [0, 1], y: [0, 1] }, [])).toEqual([0, GRAFICAS_TIEMPO_MIN_S]);
    expect(rangoX({ t: [0, 40], y: [0, 1] }, [])).toEqual([0, 40]);
    expect(rangoX({ t: [], y: [] }, [])).toEqual([0, GRAFICAS_TIEMPO_MIN_S]);
  });

  it("X incluye una marca más tardía que el último dato", () => {
    const [, max] = rangoX({ t: [0, 10], y: [0, 1] }, [
      { tipo: "apogeo", etiqueta: "Apogeo", rotulo: "Apogeo", tMasS: 12 },
    ]);
    expect(max).toBe(12);
  });

  it("Y: la altitud arranca en cero (el suelo) y deja holgura arriba", () => {
    const [min, max] = rangoY({ t: [0, 1, 2], y: [10, 500, 3000] }, magnitud("altitud"));
    expect(min).toBe(0);
    expect(max).toBeGreaterThan(3000);
  });

  it("Y: la velocidad vertical incluye el cero y las bajadas (negativas)", () => {
    const [min, max] = rangoY({ t: [0, 1, 2], y: [0, 200, -20] }, magnitud("velocidad"));
    expect(min).toBeLessThan(-20);
    expect(max).toBeGreaterThan(200);
  });

  it("Y: los huecos no cuentan y una línea plana no da un rango de ancho cero", () => {
    const [a, b] = rangoY({ t: [0, 1, 2], y: [null, 1, null] }, magnitud("aceleracion"));
    expect(b - a).toBeGreaterThan(0);
    const [c, d] = rangoY({ t: [], y: [] }, magnitud("altitud"));
    expect(d).toBeGreaterThan(c);
  });
});

describe("textos", () => {
  it("formatoTick: coma decimal, enteros sin decimales", () => {
    expect(formatoTick(20)).toBe("20");
    expect(formatoTick(2.5)).toBe("2,5");
    expect(formatoTick(0.30000000000000004)).toBe("0,3");
    expect(formatoTick(-5)).toBe("−5");
  });

  it("el resumen de cada pestaña dice el valor máximo y cuándo, con unidades", () => {
    const t = [0, 1, 2, 3];
    expect(resumenDe({ t, y: [0, 500.4, 3012, 2900] }, magnitud("altitud"))).toBe(
      "Altitud máxima: 3012 m, a los 2,0 s del despegue.",
    );
    expect(resumenDe({ t, y: [1, 9.8, 4, 1] }, magnitud("aceleracion"))).toBe(
      "Aceleración máxima: 9,80 g, a los 1,0 s del despegue.",
    );
    expect(resumenDe({ t, y: [0, 250.3, -8.1, -7] }, magnitud("velocidad"))).toBe(
      "Subida más rápida: 250,3 m/s, a los 1,0 s del despegue. Bajada más rápida: 8,1 m/s, a los 2,0 s del despegue.",
    );
  });

  it("velocidad solo de subida o solo de bajada: no inventa la otra mitad", () => {
    const t = [0, 1];
    expect(resumenDe({ t, y: [10, 20] }, magnitud("velocidad"))).toBe(
      "Subida más rápida: 20,0 m/s, a los 1,0 s del despegue.",
    );
    expect(resumenDe({ t, y: [-10, -20] }, magnitud("velocidad"))).toBe(
      "Bajada más rápida: 20,0 m/s, a los 1,0 s del despegue.",
    );
  });

  it("sin datos no hay resumen", () => {
    expect(resumenDe({ t: [], y: [] }, magnitud("altitud"))).toBeNull();
  });
});

describe("medidasDelLienzo: 390 px, horizontal y redimensionar", () => {
  it("celular vertical (390 px): el alto sigue al ancho, con mínimo legible", () => {
    expect(medidasDelLienzo(358, 844)).toEqual({ ancho: 358, alto: 269 });
    expect(medidasDelLienzo(200, 844).alto).toBe(GRAFICAS_ALTO_MIN_PX);
  });

  it("celular en horizontal: no pasa de una fracción del alto de la ventana, ni baja del mínimo", () => {
    const h = medidasDelLienzo(700, 390);
    expect(h.ancho).toBe(700);
    expect(h.alto).toBeLessThanOrEqual(Math.round(390 * 0.7));
    expect(h.alto).toBeGreaterThanOrEqual(GRAFICAS_ALTO_MIN_PX);
  });

  it("pantalla grande: el alto tiene tope", () => {
    expect(medidasDelLienzo(1200, 900).alto).toBe(GRAFICAS_ALTO_MAX_PX);
  });

  it("contenedor sin medida todavía: usa un ancho por defecto, no cero", () => {
    expect(medidasDelLienzo(0, 800).ancho).toBeGreaterThan(0);
  });
});

describe("decidirVista: el estado vacío y los avisos", () => {
  const base = { principal: "en_vivo", hayDespegue: true, puntos: 10, edadMs: null } as const;

  it("antes del despegue: estado vacío claro", () => {
    const v = decidirVista({ ...base, hayDespegue: false, puntos: 0 });
    expect(v).toEqual({
      id: "antes-del-despegue",
      mostrar: false,
      texto: TEXTO_ANTES_DEL_DESPEGUE,
    });
    expect(TEXTO_ANTES_DEL_DESPEGUE).toBe("La gráfica empieza con el despegue.");
  });

  it("recién despegó y aún no hay dos puntos: reuniendo", () => {
    const v = decidirVista({ ...base, puntos: GRAFICAS_PUNTOS_MIN - 1 });
    expect(v).toEqual({ id: "reuniendo", mostrar: false, texto: TEXTO_REUNIENDO });
  });

  it("en vuelo: se dibuja sin aviso", () => {
    expect(decidirVista(base)).toEqual({ id: "vivo", mostrar: true, texto: null });
  });

  it("señal débil, sin señal y sin servidor: se dibuja y avisa", () => {
    expect(decidirVista({ ...base, principal: "senal_debil" }).texto).toBe("Señal débil");
    const sin = decidirVista({ ...base, principal: "sin_senal", edadMs: 40_000 });
    expect(sin.id).toBe("sin-senal");
    expect(sin.texto).toBe("Sin señal · último dato hace 40 s");
    expect(decidirVista({ ...base, principal: "sin_servidor" }).id).toBe("sin-servidor");
  });

  it("sin señal y sin edad conocida: igual avisa", () => {
    expect(decidirVista({ ...base, principal: "sin_senal" }).texto).toContain("Sin señal");
  });

  it("cargando o sin transmisión pero con puntos (snapshot viejo): se muestra lo que hay", () => {
    expect(decidirVista({ ...base, principal: "cargando" }).mostrar).toBe(true);
  });
});

describe("pestanaConTecla: teclado de las pestañas", () => {
  it("flechas con vuelta, Inicio y Fin; otras teclas no hacen nada", () => {
    expect(pestanaConTecla(0, "ArrowRight", 3)).toBe(1);
    expect(pestanaConTecla(2, "ArrowRight", 3)).toBe(0);
    expect(pestanaConTecla(0, "ArrowLeft", 3)).toBe(2);
    expect(pestanaConTecla(1, "Home", 3)).toBe(0);
    expect(pestanaConTecla(1, "End", 3)).toBe(2);
    expect(pestanaConTecla(1, "Tab", 3)).toBeNull();
    expect(pestanaConTecla(0, "ArrowRight", 0)).toBeNull();
  });
});

describe("limitar: el refresco no pasa de una vez por periodo", () => {
  it("la primera llamada corre al instante; las demás se juntan en una al final de la espera", () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const l = limitar(fn, 250);
      l.llamar();
      expect(fn).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 20; i++) l.llamar(); // ~9 Hz durante 2 s no sería distinto
      expect(fn).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(250);
      expect(fn).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(250); // sin novedades: no corre
      expect(fn).toHaveBeenCalledTimes(2);
      l.llamar(); // pasó la espera: corre al instante
      expect(fn).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("2 s de llegadas a 9 Hz dan a lo sumo ~8 redibujos (el tope es 4 Hz)", () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const l = limitar(fn, 250);
      for (let ms = 0; ms < 2000; ms += 111) {
        l.llamar();
        vi.advanceTimersByTime(111);
      }
      expect(fn.mock.calls.length).toBeLessThanOrEqual(9);
      expect(fn.mock.calls.length).toBeGreaterThanOrEqual(7);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancelar descarta lo pendiente", () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const l = limitar(fn, 250);
      l.llamar();
      l.llamar();
      l.cancelar();
      vi.advanceTimersByTime(1000);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("con los escenarios reales del repetidor (los dos tienen la misma forma)", () => {
  const MISIONES: Mision[] = ["demeter", "hermes"];

  for (const mision of MISIONES) {
    it(`${mision}: el vuelo nominal da columnas crecientes, marcas y un resumen`, () => {
      const snap = snapshotDe(mision, "nominal");
      for (const m of MAGNITUDES) {
        const c = columnasDe(snap.serie, m.id, snap.eventos);
        expect(c.t.length).toBeGreaterThan(50);
        expect(c.t[0]).toBeGreaterThanOrEqual(0);
        expect(c.t.every((v, i) => i === 0 || v > (c.t[i - 1] as number))).toBe(true);
        expect(puntosConValor(c)).toBeGreaterThan(50);
        expect(resumenDe(c, m)).not.toBeNull();
      }
      const tipos = marcasDe(snap.eventos).map((x) => x.tipo);
      expect(tipos).toContain("despegue");
      expect(tipos).toContain("apogeo");
    });

    it(`${mision}: a medio camino (antes del despegue) no hay gráfica`, () => {
      const snap = snapshotDe(mision, "nominal", 1000);
      expect(columnasDe(snap.serie, "altitud", snap.eventos).t).toEqual([]);
      expect(marcasDe(snap.eventos)).toEqual([]);
    });

    it(`${mision}: solo con el evento despegue (el vuelo real de hoy) la gráfica sigue completa`, () => {
      const snap = snapshotDe(mision, "nominal");
      const soloDespegue = snap.eventos.filter((e) => e.tipo === "fase" || e.tipo === "despegue");
      const m = marcasDe(soloDespegue);
      expect(m.map((x) => x.tipo)).toEqual(["despegue"]);
      const c = columnasDe(snap.serie, "altitud", soloDespegue);
      // sin el evento de aterrizaje no se corta por arriba: la serie llega hasta el final
      expect(c.t.length).toBeGreaterThanOrEqual(
        columnasDe(snap.serie, "altitud", snap.eventos).t.length,
      );
    });
  }
});
