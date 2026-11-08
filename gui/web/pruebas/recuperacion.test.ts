import { describe, expect, it } from "vitest";
import { estadoEjemplo } from "../src/contrato/ejemplos";
import type { Estado, Fase } from "../src/contrato/tipos";
import type { EstadoPrincipal } from "../src/datos/api";
import { datosQr, MARGEN_QR_MODULOS } from "../src/mision/datos_qr";
import {
  coordenadaValida,
  puntoCardinal,
  puntoDeRecuperacion,
  puntoEnVuelo,
  textoCoordenadas,
  urlGoogleMaps,
  vistaCoordenadasMapa,
  vistaRecuperacion,
} from "../src/mision/vista_recuperacion";

const estadoEn = (fase: Fase, resto: Partial<Estado> = {}): Estado => ({
  ...estadoEjemplo,
  fase,
  ...resto,
});
const ELIPSE = estadoEjemplo.calc.elipse;
const POS = estadoEjemplo.pos;
if (ELIPSE === null || POS === null) throw new Error("el ejemplo debe traer elipse y pos");

describe("URL de Google Maps (03 §3.5)", () => {
  it("usa el formato api=1&query=LAT,LON con punto decimal y 7 decimales", () => {
    expect(urlGoogleMaps(6.5823456, -75.8231234)).toBe(
      "https://www.google.com/maps/search/?api=1&query=6.5823456,-75.8231234",
    );
    expect(urlGoogleMaps(6.58, -75.8)).toBe(
      "https://www.google.com/maps/search/?api=1&query=6.5800000,-75.8000000",
    );
  });

  it("nunca arma una URL con coordenadas que no existen", () => {
    expect(urlGoogleMaps(Number.NaN, 1)).toBeNull();
    expect(urlGoogleMaps(1, Number.POSITIVE_INFINITY)).toBeNull();
    expect(urlGoogleMaps(91, 0)).toBeNull();
    expect(urlGoogleMaps(0, -181)).toBeNull();
    expect(coordenadaValida(-90, 180)).toBe(true);
  });

  it("el texto a copiar es lat,lon con punto decimal (pegable en Maps)", () => {
    expect(textoCoordenadas(6.5823456, -75.8231234)).toBe("6.5823456,-75.8231234");
  });
});

describe("el punto que se le da al equipo de recuperación", () => {
  const punto = (e: Estado, p: EstadoPrincipal = "en_vivo", edadMs: number | null = 230) =>
    puntoDeRecuperacion(e, p, edadMs);

  it("antes del aterrizaje: el centro de la elipse, 'estimado'", () => {
    const p = punto(estadoEn("DESCENT"));
    expect(p).toEqual({ lat: ELIPSE.lat, lon: ELIPSE.lon, origen: "estimado", edadMs: null });
  });

  it("LANDED: la posición real, no la elipse", () => {
    const p = punto(estadoEn("LANDED"));
    expect(p).toEqual({ lat: POS.lat, lon: POS.lon, origen: "real", edadMs: null });
  });

  it("LANDED sin pos: el LKP, con su antigüedad (la de su hora frente a la del estado)", () => {
    const e = estadoEn("LANDED", {
      pos: null,
      utc_ms: 1_000_060_000,
      lkp: { lat: 6.5, lon: -75.5, alt_agl_m: 0, utc_ms: 1_000_000_000 },
    });
    const p = punto(e, "en_vivo", 1000);
    expect(p).toEqual({ lat: 6.5, lon: -75.5, origen: "lkp", edadMs: 61_000 });
  });

  it("sin señal: el LKP con la edad del último paquete, aunque haya elipse (GS-03)", () => {
    const p = punto(estadoEn("DESCENT"), "sin_senal", 38_000);
    expect(p?.origen).toBe("lkp");
    expect(p?.lat).toBe(estadoEjemplo.lkp?.lat);
    // lkp.utc_ms == estado.utc_ms en el ejemplo: toda la antigüedad es la del último paquete.
    expect(p?.edadMs).toBe(38_000);
  });

  it("sin señal y sin lkp: la última pos hace de LKP", () => {
    const p = punto(estadoEn("DESCENT", { lkp: null }), "sin_senal", 12_000);
    expect(p).toMatchObject({ lat: POS.lat, lon: POS.lon, origen: "lkp", edadMs: 12_000 });
  });

  it("sin señal en tierra: gana el LKP sobre la posición real", () => {
    const p = punto(estadoEn("LANDED"), "sin_senal", 40_000);
    expect(p?.origen).toBe("lkp");
  });

  it("sin elipse antes del aterrizaje: la posición actual, que no se hace pasar por estimado", () => {
    const e = estadoEn("PREFLIGHT", { calc: { ...estadoEjemplo.calc, elipse: null } });
    expect(punto(e)).toMatchObject({ origen: "actual", lat: POS.lat });
  });

  it("sin elipse ni pos: el LKP; sin nada, `null`", () => {
    const sinElipse = { ...estadoEjemplo.calc, elipse: null };
    expect(punto(estadoEn("DESCENT", { pos: null, calc: sinElipse }))?.origen).toBe("lkp");
    expect(punto(estadoEn("DESCENT", { pos: null, lkp: null, calc: sinElipse }))).toBeNull();
    expect(punto(estadoEn("LANDED", { pos: null, lkp: null }))).toBeNull();
  });

  it("descarta coordenadas inválidas (NaN) en vez de mostrarlas", () => {
    const e = estadoEn("LANDED", {
      pos: { ...POS, lat: Number.NaN },
      lkp: { lat: 1, lon: 2, alt_agl_m: 0, utc_ms: null },
    });
    expect(punto(e)).toMatchObject({ origen: "lkp", lat: 1, lon: 2 });
  });

  it("LKP sin ninguna hora conocida: la edad es `null`, no un número inventado", () => {
    const e = estadoEn("LANDED", {
      pos: null,
      utc_ms: null,
      lkp: { lat: 6.5, lon: -75.5, alt_agl_m: 0, utc_ms: null },
    });
    expect(punto(e, "en_vivo", null)?.edadMs).toBeNull();
  });
});

describe("vista de la sección", () => {
  it("sin estado: todo en null, con un texto claro y sin URL", () => {
    const v = vistaRecuperacion(null, "cargando", null);
    expect(v.punto).toBeNull();
    expect(v.urlMaps).toBeNull();
    expect(v.textoCopia).toBeNull();
    expect(v.lat).toBeNull();
    expect(v.sinPunto).toContain("Todavía no hay posición");
    expect(v.vector).toEqual({ distanciaM: null, azimutDeg: null, cardinal: null });
    expect(v.aterrizado).toBe(false);
  });

  it("sin posición alguna: explica que falta el fix y no arma URL", () => {
    const e = estadoEn("DESCENT", {
      pos: null,
      lkp: null,
      calc: { ...estadoEjemplo.calc, elipse: null },
    });
    const v = vistaRecuperacion(e, "en_vivo", 200);
    expect(v.punto).toBeNull();
    expect(v.urlMaps).toBeNull();
    expect(v.sinPunto).toContain("sin fix");
  });

  it("formatea con coma decimal y copia con punto", () => {
    const v = vistaRecuperacion(estadoEn("LANDED"), "en_vivo", 200);
    expect(v.lat).toBe("6,5823456");
    expect(v.lon).toBe("−75,8231234");
    expect(v.textoCopia).toBe("6.5823456, -75.8231234");
    expect(v.urlMaps).toBe("https://www.google.com/maps/search/?api=1&query=6.5823456,-75.8231234");
    expect(v.aterrizado).toBe(true);
  });

  it("el vector sale de `calc` y trae el punto cardinal", () => {
    const v = vistaRecuperacion(estadoEn("DESCENT"), "en_vivo", 200);
    expect(v.vector).toEqual({ distanciaM: 842.3, azimutDeg: 271.4, cardinal: "O" });
  });

  it("con el vector en null no inventa nada", () => {
    const calc = { ...estadoEjemplo.calc, dist_horiz_m: null, azimut_deg: null };
    const v = vistaRecuperacion(estadoEn("DESCENT", { calc }), "en_vivo", 200);
    expect(v.vector).toEqual({ distanciaM: null, azimutDeg: null, cardinal: null });
  });
});

describe("la etiqueta compacta de coordenadas del mapa (T-671)", () => {
  const FASES_DE_VUELO: Fase[] = ["PREFLIGHT", "ARMED", "BOOST", "COAST", "APOGEE", "DESCENT"];

  it("en cada fase antes de LANDED muestra lat, lon y la altura sobre el nivel del mar", () => {
    for (const fase of FASES_DE_VUELO) {
      const v = vistaCoordenadasMapa(estadoEn(fase), "en_vivo", 200);
      expect(v.oculta, fase).toBe(false);
      expect(v.punto?.origen, fase).toBe("actual");
      expect(v.lat, fase).toBe("6,58235");
      expect(v.lon, fase).toBe("−75,82312");
      // `pos.alt_msl_m` (822,4), no la altura sobre la rampa (312,4).
      expect(v.altMsl, fase).toBe("822");
    }
  });

  it("es la posición del cohete, no el centro de la elipse de impacto", () => {
    const e = estadoEn("DESCENT", {
      calc: { ...estadoEjemplo.calc, elipse: { ...ELIPSE, lat: 7, lon: -76 } },
    });
    expect(puntoEnVuelo(e, "en_vivo", 200)).toMatchObject({ lat: POS.lat, lon: POS.lon });
  });

  it("en LANDED se quita: ahí manda el bloque grande de Recuperación", () => {
    const v = vistaCoordenadasMapa(estadoEn("LANDED"), "en_vivo", 200);
    expect(v).toEqual({ oculta: true, punto: null, lat: null, lon: null, altMsl: null });
  });

  it("sin estado o sin posición válida: sin punto y sin números inventados", () => {
    const sinPunto = { oculta: false, punto: null, lat: null, lon: null, altMsl: null };
    expect(vistaCoordenadasMapa(null, "cargando", null)).toEqual(sinPunto);
    const sinNada = estadoEn("PREFLIGHT", { pos: null, lkp: null });
    expect(vistaCoordenadasMapa(sinNada, "en_vivo", 200)).toEqual(sinPunto);
    const nan = estadoEn("DESCENT", { pos: { ...POS, lat: Number.NaN }, lkp: null });
    expect(vistaCoordenadasMapa(nan, "en_vivo", 200)).toEqual(sinPunto);
  });

  it("altura sin dato (`alt_msl_m` null): lat y lon sí, la altura queda en null", () => {
    const e = estadoEn("DESCENT", { pos: { ...POS, alt_msl_m: null } });
    const v = vistaCoordenadasMapa(e, "en_vivo", 200);
    expect(v.lat).toBe("6,58235");
    expect(v.altMsl).toBeNull();
  });

  it("sin señal: el LKP con su antigüedad; la altura sale de `pos` si es la misma posición", () => {
    const v = vistaCoordenadasMapa(estadoEn("DESCENT"), "sin_senal", 38_000);
    expect(v.punto).toMatchObject({ origen: "lkp", edadMs: 38_000 });
    expect(v.altMsl).toBe("822");
  });

  it("LKP distinto de `pos` (o sin `pos`): no hay altura sobre el nivel del mar que mostrar", () => {
    const lkp = { lat: 6.5, lon: -75.5, alt_agl_m: 100, utc_ms: 1_000_000_000 };
    const distinto = vistaCoordenadasMapa(estadoEn("DESCENT", { lkp }), "sin_senal", 5_000);
    expect(distinto.punto).toMatchObject({ lat: 6.5, lon: -75.5, origen: "lkp" });
    expect(distinto.altMsl).toBeNull();
    const sinPos = vistaCoordenadasMapa(estadoEn("DESCENT", { pos: null, lkp }), "en_vivo", 5_000);
    expect(sinPos.punto?.origen).toBe("lkp");
    expect(sinPos.altMsl).toBeNull();
  });

  it("sin señal y sin LKP: la última `pos` hace de LKP", () => {
    const v = vistaCoordenadasMapa(estadoEn("DESCENT", { lkp: null }), "sin_senal", 12_000);
    expect(v.punto).toMatchObject({ lat: POS.lat, origen: "lkp", edadMs: 12_000 });
  });

  it("(P) sin señal y sin LANDED: el bloque grande y el QR no aparecen, la etiqueta sigue con el LKP", () => {
    const e = estadoEn("DESCENT");
    const bloque = vistaRecuperacion(e, "sin_senal", 90_000);
    expect(bloque.aterrizado).toBe(false);
    expect(vistaCoordenadasMapa(e, "sin_senal", 90_000).punto?.origen).toBe("lkp");
  });
});

describe("puntos cardinales", () => {
  it("la rosa de 8 vientos, norte arriba y sentido horario", () => {
    expect(puntoCardinal(0)).toBe("N");
    expect(puntoCardinal(44)).toBe("NE");
    expect(puntoCardinal(90)).toBe("E");
    expect(puntoCardinal(180)).toBe("S");
    expect(puntoCardinal(271.4)).toBe("O");
    expect(puntoCardinal(315)).toBe("NO");
  });

  it("el norte cubre de 337,5° a 22,5°; y los negativos o de más de una vuelta se normalizan", () => {
    expect(puntoCardinal(359.9)).toBe("N");
    expect(puntoCardinal(337.5)).toBe("N");
    expect(puntoCardinal(22.4)).toBe("N");
    expect(puntoCardinal(-90)).toBe("O");
    expect(puntoCardinal(450)).toBe("E");
  });
});

describe("QR (uqr, en el navegador)", () => {
  const URL_MAPS = "https://www.google.com/maps/search/?api=1&query=6.5823456,-75.8231234";

  it("genera un trazo no vacío y es determinista", () => {
    const a = datosQr(URL_MAPS);
    expect(a.trazo.length).toBeGreaterThan(100);
    expect(a.lado).toBeGreaterThanOrEqual(21);
    expect(datosQr(URL_MAPS)).toEqual(a);
  });

  it("el trazo cabe en el lienzo (lado + 2 márgenes) y empieza dentro del margen", () => {
    const { lado, trazo } = datosQr(URL_MAPS);
    const total = lado + 2 * MARGEN_QR_MODULOS;
    for (const m of trazo.matchAll(/M(\d+) (\d+)h(\d+)v1/g)) {
      const [x, y, largo] = [Number(m[1]), Number(m[2]), Number(m[3])];
      expect(x).toBeGreaterThanOrEqual(MARGEN_QR_MODULOS);
      expect(y).toBeGreaterThanOrEqual(MARGEN_QR_MODULOS);
      expect(x + largo).toBeLessThanOrEqual(total - MARGEN_QR_MODULOS);
      expect(y + 1).toBeLessThanOrEqual(total - MARGEN_QR_MODULOS);
    }
  });

  it("cambia si cambia la URL", () => {
    expect(datosQr(`${URL_MAPS}1`).trazo).not.toBe(datosQr(URL_MAPS).trazo);
  });
});
