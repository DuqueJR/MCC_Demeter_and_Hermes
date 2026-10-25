// Interpolación (T-631): posición lineal y slerp del cuaternión, con retraso de presentación.
import { describe, expect, it } from "vitest";
import { estadoEjemplo } from "../src/contrato/ejemplos";
import type { Estado } from "../src/contrato/tipos";
import {
  type Cuaternion,
  Interpolador,
  interpolarEstados,
  lineal,
  type Muestra,
  slerp,
} from "../src/datos/interpolacion";
import { INTERP_HUECO_MAX_MS, INTERP_RETRASO_MS } from "../src/datos/parametros";

const RAD = Math.PI / 180;
/** Rotación de `grados` alrededor del eje Z. */
const rotZ = (grados: number): Cuaternion => ({
  w: Math.cos((grados * RAD) / 2),
  x: 0,
  y: 0,
  z: Math.sin((grados * RAD) / 2),
});
/** Ángulo (grados) de una rotación alrededor de Z. */
const anguloZ = (q: Cuaternion) => (2 * Math.atan2(q.z, q.w)) / RAD;
const norma = (q: Cuaternion) => Math.hypot(q.w, q.x, q.y, q.z);

function est(t_ms: number, lat: number, alt: number, q: Cuaternion): Estado {
  return {
    ...estadoEjemplo,
    t_ms,
    pos: { lat, lon: -75, alt_agl_m: alt, alt_msl_m: null, fuente: "ekf" },
    q,
  };
}

describe("slerp", () => {
  it("los extremos devuelven a y b", () => {
    expect(anguloZ(slerp(rotZ(0), rotZ(90), 0))).toBeCloseTo(0, 6);
    expect(anguloZ(slerp(rotZ(0), rotZ(90), 1))).toBeCloseTo(90, 6);
  });

  it("a la mitad de 0 a 90 grados da 45 grados, y a un cuarto, 22,5", () => {
    expect(anguloZ(slerp(rotZ(0), rotZ(90), 0.5))).toBeCloseTo(45, 6);
    expect(anguloZ(slerp(rotZ(0), rotZ(90), 0.25))).toBeCloseTo(22.5, 6);
  });

  it("la velocidad angular es constante (a diferencia de la lineal normalizada)", () => {
    const pasos = [0.1, 0.2, 0.3, 0.4, 0.5].map((f) => anguloZ(slerp(rotZ(0), rotZ(120), f)));
    for (let i = 1; i < pasos.length; i++) {
      expect((pasos[i] as number) - (pasos[i - 1] as number)).toBeCloseTo(12, 6);
    }
  });

  it("toma el camino corto: q y -q son la misma actitud", () => {
    const menosQ = (q: Cuaternion): Cuaternion => ({ w: -q.w, x: -q.x, y: -q.y, z: -q.z });
    const r = slerp(rotZ(10), menosQ(rotZ(50)), 0.5);
    expect(Math.abs(anguloZ(r))).toBeCloseTo(30, 6);
  });

  it("siempre devuelve norma 1, también con cuaterniones casi iguales o idénticos", () => {
    const pares: [Cuaternion, Cuaternion][] = [
      [rotZ(0), rotZ(0)],
      [rotZ(0), rotZ(0.001)],
      [rotZ(0), rotZ(179)],
      [rotZ(33), rotZ(300)],
    ];
    for (const [a, b] of pares) {
      for (const f of [0, 0.3, 0.5, 1]) expect(norma(slerp(a, b, f))).toBeCloseTo(1, 9);
    }
  });
});

describe("interpolarEstados", () => {
  it("interpola lineal la posición y mezcla la actitud", () => {
    const a = est(1000, 6.0, 100, rotZ(0));
    const b = est(1100, 6.2, 300, rotZ(90));
    const m = interpolarEstados(a, b, 0.25);
    expect(m.lat).toBeCloseTo(6.05, 9);
    expect(m.alt_agl_m).toBeCloseTo(150, 9);
    expect(m.t_ms).toBeCloseTo(1025, 9);
    expect(anguloZ(m.q)).toBeCloseTo(22.5, 6);
    expect(lineal(0, 10, 0.3)).toBeCloseTo(3, 12);
  });

  it("sin posición en alguno de los dos no inventa una: queda la anterior o ninguna", () => {
    const a = est(1000, 6.0, 100, rotZ(0));
    const sinPos: Estado = { ...est(1100, 6.2, 300, rotZ(0)), pos: null };
    expect(interpolarEstados(a, sinPos, 0.5).lat).toBe(6.0);
    expect(interpolarEstados(sinPos, a, 0.5).lat).toBeNull();
  });
});

describe("Interpolador (retraso de presentación de 1 paquete, 03 §5)", () => {
  const muestra = (m: Muestra | null): Muestra => {
    if (m === null) throw new Error("se esperaba una muestra");
    return m;
  };
  // 9 Hz: un paquete cada 111 ms, llegando justo a tiempo (sin retraso de red).
  function nueve(): Interpolador {
    const it = new Interpolador();
    for (let k = 0; k < 5; k++) {
      it.agregar(est(1000 + k * 111, 6 + k, k * 10, rotZ(k * 10)), 5000 + k * 111);
    }
    return it;
  }

  it("sin datos devuelve null", () => {
    expect(new Interpolador().muestrear(0)).toBeNull();
  });

  it("dibuja un instante antes del último paquete, entre los dos de en medio", () => {
    const it = nueve();
    // Justo cuando llega el último (k = 4): objetivo = t_último - retraso
    const m = muestra(it.muestrear(5000 + 4 * 111));
    const objetivo = 1000 + 4 * 111 - INTERP_RETRASO_MS;
    expect(m.t_ms).toBeCloseTo(objetivo, 6);
    // entre k=3 (t=1333) y k=4 (t=1444)
    const f = (objetivo - (1000 + 3 * 111)) / 111;
    expect(m.lat).toBeCloseTo(6 + 3 + f, 9);
    expect(anguloZ(m.q)).toBeCloseTo(30 + f * 10, 6);
  });

  it("avanza parejo con el reloj local entre un paquete y el siguiente", () => {
    const it = nueve();
    const a = muestra(it.muestrear(5000 + 4 * 111));
    const b = muestra(it.muestrear(5000 + 4 * 111 + 10));
    expect(b.t_ms - a.t_ms).toBeCloseTo(10, 6);
  });

  it("no extrapola: pasado el último paquete se queda en él", () => {
    const m = muestra(nueve().muestrear(60_000));
    expect(m.lat).toBe(10);
    expect(m.t_ms).toBe(1000 + 4 * 111);
  });

  it("antes del primer paquete se queda en el primero", () => {
    expect(muestra(nueve().muestrear(0)).lat).toBe(6);
  });

  it("el jitter de la red no hace retroceder lo que se dibuja", () => {
    const it = new Interpolador();
    let previo = Number.NEGATIVE_INFINITY;
    // Llegadas con retrasos alternos de 0 y 80 ms
    for (let k = 0; k < 40; k++) {
      const llegada = 10_000 + k * 111 + (k % 2 === 0 ? 0 : 80);
      it.agregar(est(2000 + k * 111, k, k, rotZ(k)), llegada);
      for (let dt = 0; dt < 111; dt += 5) {
        const t = muestra(it.muestrear(llegada + dt)).t_ms;
        expect(t).toBeGreaterThanOrEqual(previo);
        previo = t;
      }
    }
  });

  it("no interpola a través de un hueco de señal: espera en el último hasta llegar al siguiente", () => {
    const it = new Interpolador();
    it.agregar(est(1000, 6, 0, rotZ(0)), 0);
    const hueco = INTERP_HUECO_MAX_MS + 1;
    it.agregar(est(1000 + hueco, 7, 0, rotZ(0)), hueco); // el siguiente llega tras el hueco
    expect(muestra(it.muestrear(hueco)).lat).toBe(6);
    expect(muestra(it.muestrear(hueco + INTERP_RETRASO_MS + 1)).lat).toBe(7);
  });

  it("si el t_ms retrocede (otro vuelo) reinicia el historial; los repetidos se ignoran", () => {
    const it = new Interpolador();
    it.agregar(est(5000, 1, 0, rotZ(0)), 0);
    it.agregar(est(5000, 9, 0, rotZ(0)), 5);
    expect(it.tamano).toBe(1);
    it.agregar(est(100, 2, 0, rotZ(0)), 10);
    expect(it.tamano).toBe(1);
    expect(muestra(it.muestrear(10)).lat).toBe(2);
  });
});
