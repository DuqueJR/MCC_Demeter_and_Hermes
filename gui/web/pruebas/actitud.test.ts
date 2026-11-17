// Actitud 2D (T-634): del cuaternión cuerpo -> ENU a cabeceo, alabeo y rumbo, y qué se muestra
// según el estado de la página. Los cuaterniones de entrada se arman aquí con una composición
// de giros independiente del código de `src/actitud/angulos.ts`.
import { describe, expect, it } from "vitest";
import { angulosDeCuaternion, type Cuaternion, cardinalDe } from "../src/actitud/angulos";
import { ACTITUD_CARDAN_DEG } from "../src/actitud/constantes";
import { decidirVista } from "../src/actitud/vista";

const TOLERANCIA_DEG = 0.5; // criterio de T-634
const aRad = (g: number) => (g * Math.PI) / 180;

const producto = (a: Cuaternion, b: Cuaternion): Cuaternion => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});
const alrededorDe = (eje: "x" | "y" | "z", grados: number): Cuaternion => {
  const m = aRad(grados) / 2;
  return { w: Math.cos(m), x: 0, y: 0, z: 0, [eje]: Math.sin(m) };
};

/**
 * La actitud con ese rumbo (horario desde el norte), cabeceo (nariz arriba positivo) y alabeo
 * (regla de la mano derecha sobre la nariz). Con el cuerpo "adelante-izquierda-arriba", la
 * identidad es una nariz hacia el este; rumbo 0 es girar 90° a la izquierda alrededor de "arriba".
 */
function actitud(rumbo: number, cabeceo: number, alabeo: number): Cuaternion {
  return producto(
    producto(alrededorDe("z", 90 - rumbo), alrededorDe("y", -cabeceo)),
    alrededorDe("x", alabeo),
  );
}

/** Diferencia angular más corta entre dos rumbos o alabeos, en grados. */
const dif = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

function esperar(q: Cuaternion, rumbo: number, cabeceo: number, alabeo: number) {
  const a = angulosDeCuaternion(q);
  expect(a).not.toBeNull();
  if (!a) return;
  expect(a.cabeceo).toBeCloseTo(cabeceo, 1);
  expect(dif(a.rumbo, rumbo)).toBeLessThan(TOLERANCIA_DEG);
  expect(dif(a.alabeo, alabeo)).toBeLessThan(TOLERANCIA_DEG);
}

describe("angulosDeCuaternion: los casos del criterio de T-634", () => {
  it("la identidad: nariz horizontal hacia el este, sin alabeo", () => {
    esperar({ w: 1, x: 0, y: 0, z: 0 }, 90, 0, 0);
  });

  it("0° de cabeceo, apuntando al norte", () => {
    esperar({ w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 }, 0, 0, 0);
  });

  it("90° de cabeceo: nariz hacia arriba (es el cuaternión de dar -90° sobre Y)", () => {
    const a = angulosDeCuaternion({ w: Math.SQRT1_2, x: 0, y: -Math.SQRT1_2, z: 0 });
    expect(a?.cabeceo).toBeCloseTo(90, 5);
    expect(a?.cardan).toBe(true);
  });

  it("45° de alabeo (ala derecha abajo), con el cuaternión escrito a mano", () => {
    const m = aRad(45) / 2;
    esperar({ w: Math.cos(m), x: Math.sin(m), y: 0, z: 0 }, 90, 0, 45);
  });

  it("-45° de alabeo", () => {
    esperar(actitud(0, 0, -45), 0, 0, -45);
  });

  it("-90° de cabeceo: nariz hacia abajo", () => {
    const a = angulosDeCuaternion(actitud(0, -90, 0));
    expect(a?.cabeceo).toBeCloseTo(-90, 5);
    expect(a?.cardan).toBe(true);
  });
});

describe("angulosDeCuaternion: combinaciones", () => {
  const casos: [string, number, number, number][] = [
    ["norte, nivelado", 0, 0, 0],
    ["este, 30° arriba", 90, 30, 0],
    ["sur, 60° arriba, 20° de alabeo", 180, 60, 20],
    ["oeste, 10° abajo, -35° de alabeo", 270, -10, -35],
    ["rumbo 350°, 80° arriba (despegue inclinado)", 350, 80, 5],
    ["alabeo 170°", 45, 20, 170],
    ["alabeo -170°", 45, 20, -170],
    ["rumbo 1°, cabeceo 88° (justo antes del cardán)", 1, 88, 10],
  ];
  for (const [nombre, rumbo, cabeceo, alabeo] of casos) {
    it(nombre, () => esperar(actitud(rumbo, cabeceo, alabeo), rumbo, cabeceo, alabeo));
  }

  it("barrido: recupera rumbo, cabeceo y alabeo a ±0,5° mientras el cabeceo está lejos de la vertical", () => {
    for (let rumbo = 0; rumbo < 360; rumbo += 15) {
      for (let cabeceo = -80; cabeceo <= 80; cabeceo += 10) {
        for (let alabeo = -175; alabeo <= 175; alabeo += 25) {
          esperar(actitud(rumbo, cabeceo, alabeo), rumbo, cabeceo, alabeo);
        }
      }
    }
  });

  it("q y -q son la misma actitud", () => {
    const q = actitud(123, 34, -56);
    const a = angulosDeCuaternion(q);
    const b = angulosDeCuaternion({ w: -q.w, x: -q.x, y: -q.y, z: -q.z });
    expect(b).toEqual(a);
  });

  it("el rumbo siempre sale en [0, 360)", () => {
    for (let r = -720; r <= 720; r += 7) {
      const a = angulosDeCuaternion(actitud(r, 15, 0));
      expect(a?.rumbo).toBeGreaterThanOrEqual(0);
      expect(a?.rumbo).toBeLessThan(360);
    }
  });
});

describe("angulosDeCuaternion: casos borde", () => {
  it("un cuaternión sin normalizar da lo mismo que el normalizado", () => {
    const q = actitud(200, 40, 15);
    const grande = { w: q.w * 7.3, x: q.x * 7.3, y: q.y * 7.3, z: q.z * 7.3 };
    const chico = { w: q.w * 0.31, x: q.x * 0.31, y: q.y * 0.31, z: q.z * 0.31 };
    const a = angulosDeCuaternion(q);
    for (const otro of [grande, chico]) {
      const b = angulosDeCuaternion(otro);
      expect(b?.cabeceo).toBeCloseTo(a?.cabeceo ?? Number.NaN, 6);
      expect(b?.rumbo).toBeCloseTo(a?.rumbo ?? Number.NaN, 6);
      expect(b?.alabeo).toBeCloseTo(a?.alabeo ?? Number.NaN, 6);
    }
  });

  it("el redondeo a Q15 del enlace (error de 1/32767) no mueve los ángulos más de 0,05°", () => {
    const q = actitud(75, 50, -20);
    const q15 = (v: number) => Math.round(v * 32767) / 32767;
    const a = angulosDeCuaternion(q);
    const b = angulosDeCuaternion({ w: q15(q.w), x: q15(q.x), y: q15(q.y), z: q15(q.z) });
    expect(Math.abs((b?.cabeceo ?? 0) - (a?.cabeceo ?? 0))).toBeLessThan(0.05);
    expect(dif(b?.rumbo ?? 0, a?.rumbo ?? 0)).toBeLessThan(0.05);
    expect(dif(b?.alabeo ?? 0, a?.alabeo ?? 0)).toBeLessThan(0.05);
  });

  it("un cuaternión nulo o no finito no es una actitud", () => {
    expect(angulosDeCuaternion({ w: 0, x: 0, y: 0, z: 0 })).toBeNull();
    expect(angulosDeCuaternion({ w: Number.NaN, x: 0, y: 0, z: 1 })).toBeNull();
    expect(angulosDeCuaternion({ w: 1, x: Number.POSITIVE_INFINITY, y: 0, z: 0 })).toBeNull();
  });

  it("cerca de la vertical (bloqueo de cardán) marca `cardan` y los ángulos siguen siendo finitos", () => {
    for (const cabeceo of [89, 89.5, 89.99, 90, -89, -90]) {
      const a = angulosDeCuaternion(actitud(40, cabeceo, 25));
      expect(a?.cardan).toBe(true);
      expect(Number.isFinite(a?.rumbo)).toBe(true);
      expect(Number.isFinite(a?.alabeo)).toBe(true);
      expect(a?.cabeceo).toBeCloseTo(cabeceo, 1);
    }
    expect(angulosDeCuaternion(actitud(40, ACTITUD_CARDAN_DEG - 1, 25))?.cardan).toBe(false);
  });

  it("exactamente vertical: alabeo 0 y un rumbo definido que no salta", () => {
    // Nariz arriba con Y hacia el oeste (alabeo 0 si el rumbo fuera norte).
    const a = angulosDeCuaternion({ w: Math.SQRT1_2, x: 0, y: -Math.SQRT1_2, z: 0 });
    expect(a?.alabeo).toBe(0);
    expect(a?.cardan).toBe(true);
    // Y del cuerpo apunta al norte: rumbo 90° (Y es la izquierda de quien mira al este).
    expect(a?.rumbo).toBeCloseTo(90, 5);
    // Continuidad: un poco antes de la vertical, rumbo + alabeo da casi lo mismo que en la vertical.
    const casi = angulosDeCuaternion(actitud(90, 89.99, 0));
    expect(dif(casi?.rumbo ?? 0, a?.rumbo ?? 0)).toBeLessThan(0.1);
  });

  it("ángulos pequeños: sin ruido numérico en el nivelado", () => {
    const a = angulosDeCuaternion(actitud(0, 0, 0));
    expect(Math.abs(a?.cabeceo ?? 1)).toBeLessThan(1e-9);
    expect(Math.abs(a?.alabeo ?? 1)).toBeLessThan(1e-9);
    expect(dif(a?.rumbo ?? 1, 0)).toBeLessThan(1e-9);
  });
});

describe("cardinalDe", () => {
  it("los ocho vientos, con la O de oeste", () => {
    expect([0, 45, 90, 135, 180, 225, 270, 315].map(cardinalDe)).toEqual([
      "N",
      "NE",
      "E",
      "SE",
      "S",
      "SO",
      "O",
      "NO",
    ]);
  });

  it("359° es el norte y -90° es el oeste", () => {
    expect(cardinalDe(359)).toBe("N");
    expect(cardinalDe(-90)).toBe("O");
  });
});

describe("decidirVista", () => {
  const base = { principal: "en_vivo", hayEstado: true, ekfOk: true, edadMs: 300 } as const;

  it("en vivo: se dibuja y no lleva aviso", () => {
    expect(decidirVista(base)).toEqual({ id: "vivo", mostrar: true, texto: null });
  });

  it("sin estado, cargando o sin transmisión: no se dibuja el horizonte", () => {
    expect(decidirVista({ ...base, hayEstado: false }).mostrar).toBe(false);
    expect(decidirVista({ ...base, principal: "cargando" }).id).toBe("sin-dato");
    expect(decidirVista({ ...base, principal: "sin_transmision" }).id).toBe("sin-dato");
  });

  it("EKF no listo: 'Orientación aún no disponible' (03 §3.6), aun sin señal", () => {
    const v = decidirVista({ ...base, ekfOk: false });
    expect(v).toEqual({
      id: "no-disponible",
      mostrar: false,
      texto: "Orientación aún no disponible",
    });
    expect(decidirVista({ ...base, ekfOk: false, principal: "sin_senal" }).id).toBe(
      "no-disponible",
    );
  });

  it("sin señal: se ve la última actitud, rotulada con su antigüedad", () => {
    const v = decidirVista({ ...base, principal: "sin_senal", edadMs: 38_000 });
    expect(v.id).toBe("sin-senal");
    expect(v.mostrar).toBe(true);
    expect(v.texto).toBe("Sin señal · última orientación hace 38 s");
    expect(decidirVista({ ...base, principal: "sin_senal", edadMs: null }).texto).toMatch(
      /Sin señal/,
    );
  });

  it("señal débil y sin servidor: se ve, con aviso", () => {
    expect(decidirVista({ ...base, principal: "senal_debil" }).id).toBe("debil");
    expect(decidirVista({ ...base, principal: "sin_servidor" }).id).toBe("sin-servidor");
  });
});
