// Lógica pura de la rosa de actitud de "Desde la estación" (T-674), calcada del `draw3d` de la ventana EKF
// del dashboard de Pablo (`estacion/dashboard_ekf.js`): el cohete de alambre sobre una rosa de los
// vientos, en proyección ortográfica. Aquí solo se arma la escena (puntos y trazos); el SVG la pinta.
//
// MARCOS (lo delicado de este archivo):
// - Pablo dibuja el cohete en cuerpo FRD (X nariz, Y derecha, Z abajo) y rota con un cuaternión
//   cuerpo FRD -> NED. La marca (franja naranja) va en −Z y el costado derecho (azul) en +Y.
// - La web recibe `estado.q`: un cuaternión que rota vectores del cuerpo al marco ENU, con el cuerpo
//   "adelante-izquierda-arriba" (FLU: X nariz, Y izquierda, Z arriba; `actitud/README.md`, `angulos.ts`).
// - FRD y FLU solo difieren en un giro de 180° alrededor de la nariz: (x, y, z)_FRD = (x, −y, −z)_FLU.
//   Entonces un punto del dibujo en FRD se pasa a FLU invirtiendo Y y Z, y se rota con `q` a ENU. La marca
//   (−Z FRD) queda hacia +Z FLU: arriba con el cohete horizontal, como en el dashboard de Pablo.
// - La proyección es la de Pablo con la entrada ya en ENU (este, norte, arriba).
// Esto no cambia el contrato: solo es la forma de leer `q`. El cero del alabeo sigue sin estar medido (D-007).
import type { Cuaternion } from "../actitud/angulos";

export type V3 = [number, number, number];
export type Matriz = [V3, V3, V3];

/** La cámara: acimut y elevación, en radianes (los de Pablo: −0,7 y 0,35). */
export interface Camara {
  az: number;
  el: number;
}

export const CAMARA_FIJA: Camara = { az: -0.7, el: 0.35 };

/** Un punto proyectado: `x` a la derecha, `arriba` hacia arriba de la pantalla (ambos en unidades de la escena) y `prof` (más grande, más cerca del observador). */
export interface Punto {
  x: number;
  arriba: number;
  prof: number;
}

const NORMA_MIN = 1e-9;

/** La matriz de rotación cuerpo (FLU) -> ENU del cuaternión (lo normaliza); la identidad si no es válido. */
export function matrizDeCuaternion(q: Cuaternion): Matriz {
  const n = Math.hypot(q.w, q.x, q.y, q.z);
  if (!Number.isFinite(n) || n < NORMA_MIN) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }
  const [w, x, y, z] = [q.w / n, q.x / n, q.y / n, q.z / n];
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ];
}

const porVector = (m: Matriz, v: V3): V3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

/** Un punto del cuerpo FRD (el del dashboard de Pablo) en el cuerpo FLU de la web. */
export const frdAFlu = (p: V3): V3 => [p[0], -p[1], -p[2]];

/** Un punto del cuerpo FRD, ya girado por `m` (cuerpo FLU -> ENU): sus coordenadas (este, norte, arriba). */
export const frdAEnu = (m: Matriz, p: V3): V3 => porVector(m, frdAFlu(p));

/** La proyección ortográfica de un punto ENU (la de `draw3d`, con la entrada en ENU). */
export function proyectar(enu: V3, cam: Camara): Punto {
  const [e, n, u] = enu;
  const [ca, sa, ce, se] = [Math.cos(cam.az), Math.sin(cam.az), Math.cos(cam.el), Math.sin(cam.el)];
  const x1 = e * ca - n * sa;
  const y1 = e * sa + n * ca;
  return { x: x1, arriba: u * ce + y1 * se, prof: u * se - y1 * ce };
}

export type ClaseTrazo = "cuerpo" | "punta" | "tenue" | "marca" | "costado";

export interface Trazo {
  a: Punto;
  b: Punto;
  clase: ClaseTrazo;
  ancho: number;
}

export interface Aleta {
  puntos: Punto[];
  clase: "marca" | "costado" | "tenue";
}

export interface Escena {
  /** El círculo de la rosa en el plano horizontal. */
  aro: Punto[];
  /** Las cuatro direcciones, desde el centro. */
  puntos: { letra: "N" | "E" | "S" | "O"; desde: Punto; hasta: Punto }[];
  /** La línea punteada "arriba". */
  arriba: { desde: Punto; hasta: Punto };
  /** Los trazos del cohete, del más lejano al más cercano. */
  trazos: Trazo[];
  aletas: Aleta[];
  /** La punta, para poner la etiqueta "nariz". */
  nariz: Punto;
  /** La flecha de velocidad, si hay velocidad apreciable. */
  velocidad: { desde: Punto; hasta: Punto; ms: number } | null;
}

// Geometría del cohete en FRD, igual a la del dashboard: largo 1,3 y radio 0,07.
const L0 = -0.6;
const L1 = 0.45;
const PUNTA = 0.75;
const R = 0.07;
const LADOS = 12;
const RADIO_ROSA = 0.95;
const PASOS_ARO = 48;
const ALTO_ARRIBA = 0.9;
/** Por debajo de esta velocidad (m/s) no se dibuja la flecha. */
export const VEL_FLECHA_MIN_MS = 0.3;
const LARGO_FLECHA = 0.6;
const LARGO_ALETA = 0.22;
const SALIDA_ALETA = 0.16;
const RETROCESO_ALETA = 0.04;

/** Arma la escena para el cuaternión `q` (cuerpo FLU -> ENU), la cámara y la velocidad ENU (m/s) si hay. */
export function armarEscena(
  q: Cuaternion,
  cam: Camara,
  vel: { e: number; n: number; u: number } | null,
): Escena {
  const m = matrizDeCuaternion(q);
  const P = (p: V3) => proyectar(p, cam);
  const B = (p: V3) => P(frdAEnu(m, p));
  const aro: Punto[] = [];
  for (let k = 0; k <= PASOS_ARO; k++) {
    const a = (k / PASOS_ARO) * 2 * Math.PI;
    aro.push(P([Math.sin(a) * RADIO_ROSA, Math.cos(a) * RADIO_ROSA, 0]));
  }
  const origen = P([0, 0, 0]);
  // Este (x), norte (y): N = (0, 1), E = (1, 0), S = (0, −1), O = (−1, 0).
  const puntos = (
    [
      ["N", 0, 1],
      ["E", 1, 0],
      ["S", 0, -1],
      ["O", -1, 0],
    ] as const
  ).map(([letra, e, n]) => ({
    letra,
    desde: origen,
    hasta: P([e * RADIO_ROSA, n * RADIO_ROSA, 0]),
  }));

  const anillo = (x: number): Punto[] => {
    const pts: Punto[] = [];
    for (let k = 0; k <= LADOS; k++) {
      const a = (k / LADOS) * 2 * Math.PI;
      pts.push(B([x, R * Math.cos(a), R * Math.sin(a)]));
    }
    return pts;
  };
  const r0 = anillo(L0);
  const r1 = anillo(L1);
  const nariz = B([PUNTA, 0, 0]);
  const trazos: Trazo[] = [];
  for (let k = 0; k < LADOS; k++) {
    trazos.push({ a: r0[k] as Punto, b: r0[k + 1] as Punto, clase: "cuerpo", ancho: 1 });
    trazos.push({ a: r1[k] as Punto, b: r1[k + 1] as Punto, clase: "cuerpo", ancho: 1 });
    trazos.push({ a: r1[k] as Punto, b: nariz, clase: "punta", ancho: 1 });
  }
  for (let k = 0; k < LADOS; k += 2) {
    trazos.push({ a: r0[k] as Punto, b: r1[k] as Punto, clase: "tenue", ancho: 1 });
  }
  // La marca (−Z) y el costado derecho (+Y), a lo largo del fuselaje.
  trazos.push({ a: B([L0, 0, -R]), b: B([L1, 0, -R]), clase: "marca", ancho: 3 });
  trazos.push({ a: B([L0, R, 0]), b: B([L1, R, 0]), clase: "costado", ancho: 3 });
  trazos.sort((p, q2) => p.a.prof + p.b.prof - (q2.a.prof + q2.b.prof));

  const aleta = (dy: number, dz: number, clase: Aleta["clase"]): Aleta => ({
    puntos: [
      B([L0, dy * R, dz * R]),
      B([L0 + LARGO_ALETA, dy * R, dz * R]),
      B([L0, dy * (R + SALIDA_ALETA), dz * (R + SALIDA_ALETA)]),
      B([L0 - RETROCESO_ALETA, dy * (R + SALIDA_ALETA), dz * (R + SALIDA_ALETA)]),
    ],
    clase,
  });
  const aletas = [
    aleta(0, -1, "marca"),
    aleta(1, 0, "costado"),
    aleta(0, 1, "tenue"),
    aleta(-1, 0, "tenue"),
  ];

  let velocidad: Escena["velocidad"] = null;
  if (vel !== null) {
    const ms = Math.hypot(vel.e, vel.n, vel.u);
    if (ms > VEL_FLECHA_MIN_MS) {
      const k = LARGO_FLECHA / ms;
      velocidad = { desde: origen, hasta: P([vel.e * k, vel.n * k, vel.u * k]), ms };
    }
  }
  return {
    aro,
    puntos,
    arriba: { desde: origen, hasta: P([0, 0, ALTO_ARRIBA]) },
    trazos,
    aletas,
    nariz,
    velocidad,
  };
}
