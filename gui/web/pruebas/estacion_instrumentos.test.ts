import { describe, expect, it } from "vitest";
import { angulosDeCuaternion, type Cuaternion } from "../src/actitud/angulos";
import type { Serie } from "../src/contrato/tipos";
import { serieVacia } from "../src/datos/serie";
import { escalaG, escalasG, saturaSensor, ventanaG } from "../src/mision/vista_fuerzas_g";
import {
  armarEscena,
  CAMARA_FIJA,
  frdAEnu,
  matrizDeCuaternion,
  proyectar,
  type V3,
} from "../src/mision/vista_rosa";

// T-674: las funciones puras de los visualizadores de "Desde la estación" (fuerzas g y rosa de actitud).

const cerca = (a: V3, b: V3) => {
  for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i] as number, 6);
};
/** Giro de `grados` alrededor de un eje cardinal (x, y o z). */
const giro = (eje: "x" | "y" | "z", grados: number): Cuaternion => {
  const m = (grados * Math.PI) / 360;
  return { w: Math.cos(m), x: 0, y: 0, z: 0, [eje]: Math.sin(m) };
};
const producto = (a: Cuaternion, b: Cuaternion): Cuaternion => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});

describe("escalas de las fuerzas g (las de niceG de Pablo)", () => {
  it("redondea hacia arriba a 1, 2, 3, 5, 10, 15, 20, 30, 50 o 100", () => {
    expect(escalaG(0)).toBe(1);
    expect(escalaG(1)).toBe(1);
    expect(escalaG(1.01)).toBe(2);
    expect(escalaG(4.6)).toBe(5);
    expect(escalaG(10.5)).toBe(15);
    expect(escalaG(45)).toBe(50);
    expect(escalaG(51)).toBe(100);
  });

  it("el radar y la barra X se escalan con 15 % de holgura", () => {
    const e = escalasG({ estela: [], minX: -1.36, maxX: 9.1, maxLateral: 4 });
    expect(e).toEqual({ radar: 5, bajo: -2, alto: 15 });
    // En reposo: la barra va de −1 a +2 y el radar a 1 g.
    expect(escalasG({ estela: [], minX: 0, maxX: 1, maxLateral: 0 })).toEqual({
      radar: 1,
      bajo: -1,
      alto: 2,
    });
  });

  it("satura cuando un eje pasa del rango del sensor (±32 g)", () => {
    expect(saturaSensor({ x: 32, y: -32, z: 0 })).toBe(false);
    expect(saturaSensor({ x: 0, y: -32.5, z: 0 })).toBe(true);
  });
});

describe("la historia: estela de 2 s y banda de 10 s, de la serie de la web", () => {
  const serieDe = (n: number): Serie => {
    const s = serieVacia();
    for (let t = 0; t < n; t++) {
      s.t_mas_s.push(t);
      s.acc_x_g.push(t); // 0, 1, 2, …
      s.acc_y_g.push(t / 10);
      s.acc_z_g.push(0);
    }
    return s;
  };

  it("la estela son los últimos 2 s y la banda, los últimos 10 s", () => {
    const v = ventanaG(serieDe(21), { x: 20, y: 2, z: 0 });
    expect(v.estela).toEqual([
      { y: 1.8, z: 0 },
      { y: 1.9, z: 0 },
      { y: 2, z: 0 },
    ]);
    expect(v.maxX).toBe(20);
    expect(v.minX).toBe(0); // el 0 de la escala: la banda siempre incluye el 0 y el 1 g
    expect(v.maxLateral).toBeCloseTo(2, 6);
  });

  it("la banda solo mira 10 s atrás (lo anterior no cuenta)", () => {
    const s = serieDe(21);
    s.acc_x_g[0] = -50; // hace 20 s
    s.acc_y_g[0] = 40;
    const v = ventanaG(s, { x: 20, y: 2, z: 0 });
    expect(v.minX).toBe(0);
    expect(v.maxLateral).toBeCloseTo(2, 6);
  });

  it("sin T+ (antes del despegue) no hay historia: solo el valor de ahora", () => {
    const s = serieVacia();
    s.t_mas_s.push(null, null);
    s.acc_x_g.push(1, 1);
    s.acc_y_g.push(0, 0);
    s.acc_z_g.push(0, 0);
    const v = ventanaG(s, { x: 1.02, y: 0.03, z: 0.04 });
    expect(v.estela).toEqual([]);
    expect(v.maxX).toBe(1.02);
    expect(v.maxLateral).toBeCloseTo(0.05, 6);
  });

  it("ignora los puntos sin aceleración", () => {
    const s = serieDe(5);
    s.acc_x_g[3] = null;
    const v = ventanaG(s, { x: 4, y: 0.4, z: 0 });
    expect(v.estela).toEqual([
      { y: 0.2, z: 0 },
      { y: 0.4, z: 0 },
    ]);
  });
});

describe("marcos de la rosa de actitud: FRD de Pablo -> FLU/ENU de la web", () => {
  it("cuerpo = ENU (cuaternión identidad): la nariz mira al este y la marca (−Z FRD) queda arriba", () => {
    const m = matrizDeCuaternion({ w: 1, x: 0, y: 0, z: 0 });
    cerca(frdAEnu(m, [1, 0, 0]), [1, 0, 0]); // nariz -> este
    cerca(frdAEnu(m, [0, 0, -1]), [0, 0, 1]); // marca -> arriba
    cerca(frdAEnu(m, [0, 1, 0]), [0, -1, 0]); // costado derecho -> sur (mirando al este)
  });

  it("nariz arriba: la nariz FRD va a +arriba y el cabeceo es +90°", () => {
    const q = giro("y", -90);
    const m = matrizDeCuaternion(q);
    cerca(frdAEnu(m, [1, 0, 0]), [0, 0, 1]);
    expect(angulosDeCuaternion(q)?.cabeceo).toBeCloseTo(90, 4);
  });

  it("nariz al norte inclinada 45°: la nariz va a (0, 0,71, 0,71) y la marca, perpendicular y hacia arriba", () => {
    const q = producto(giro("z", 90), giro("y", -45)); // cuerpo -> inclinar 45° -> girar al norte
    const m = matrizDeCuaternion(q);
    const k = Math.SQRT1_2;
    cerca(frdAEnu(m, [1, 0, 0]), [0, k, k]);
    cerca(frdAEnu(m, [0, 0, -1]), [0, -k, k]);
    const ang = angulosDeCuaternion(q);
    expect(ang?.cabeceo).toBeCloseTo(45, 4);
    expect(ang?.rumbo).toBeCloseTo(0, 4);
  });

  it("un cuaternión no válido se toma como la identidad", () => {
    const m = matrizDeCuaternion({ w: 0, x: 0, y: 0, z: 0 });
    cerca(frdAEnu(m, [1, 0, 0]), [1, 0, 0]);
  });
});

describe("proyección ortográfica y escena", () => {
  it("con la cámara sin acimut ni elevación: el este va a la derecha y arriba, arriba", () => {
    const cam = { az: 0, el: 0 };
    expect(proyectar([1, 0, 0], cam)).toMatchObject({ x: 1, arriba: 0 });
    expect(proyectar([0, 0, 1], cam)).toMatchObject({ x: 0, arriba: 1 });
    expect(proyectar([0, 1, 0], cam).prof).toBeCloseTo(-1, 9); // el norte queda lejos
  });

  it("la escena trae la marca, el costado, las cuatro aletas y los trazos de lejos a cerca", () => {
    const e = armarEscena({ w: 1, x: 0, y: 0, z: 0 }, CAMARA_FIJA, null);
    expect(e.trazos.filter((t) => t.clase === "marca")).toHaveLength(1);
    expect(e.trazos.filter((t) => t.clase === "costado")).toHaveLength(1);
    expect(e.aletas).toHaveLength(4);
    expect(e.puntos.map((p) => p.letra)).toEqual(["N", "E", "S", "O"]);
    for (let i = 1; i < e.trazos.length; i++) {
      const a = e.trazos[i - 1];
      const b = e.trazos[i];
      expect((a?.a.prof ?? 0) + (a?.b.prof ?? 0)).toBeLessThanOrEqual(
        (b?.a.prof ?? 0) + (b?.b.prof ?? 0) + 1e-9,
      );
    }
  });

  it("la flecha de velocidad solo sale con más de 0,3 m/s", () => {
    const q = { w: 1, x: 0, y: 0, z: 0 };
    expect(armarEscena(q, CAMARA_FIJA, null).velocidad).toBeNull();
    expect(armarEscena(q, CAMARA_FIJA, { e: 0, n: 0.1, u: 0.1 }).velocidad).toBeNull();
    const v = armarEscena(q, CAMARA_FIJA, { e: 0, n: 3, u: 4 }).velocidad;
    expect(v?.ms).toBeCloseTo(5, 9);
  });
});
