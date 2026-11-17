// Lógica pura de los visualizadores de fuerzas g de "Desde la estación" (T-674), calcada del
// `drawG` de la ventana EKF del dashboard de Pablo (`estacion/dashboard_ekf.js`): el radar de la
// sección (Y, Z) con su estela de ~2 s y el eje X (nariz) con la banda mín-máx de ~10 s, con escalas
// "redondas" automáticas. La historia sale de la `serie` que ya tiene la web (`datos/serie.ts`).
import type { Serie } from "../contrato/tipos";
import {
  ACC_ESCALA_G,
  G_BANDA_S,
  G_ESCALA_HOLGURA,
  G_ESCALA_TOPE,
  G_ESCALAS,
  G_ESTELA_S,
} from "./constantes";

export interface MuestraG {
  x: number;
  y: number;
  z: number;
}

/** Un punto del radar: la sección del cohete vista desde la cola, en g. */
export interface PuntoRadar {
  y: number;
  z: number;
}

/** La escala redonda más chica que alcanza para `v` (la de Pablo: 1, 2, 3, 5, 10, 15, 20, 30, 50). */
export function escalaG(v: number): number {
  for (const s of G_ESCALAS) if (v <= s) return s;
  return G_ESCALA_TOPE;
}

export interface VentanaG {
  /** La estela: la sección (Y, Z) de los últimos `G_ESTELA_S` segundos, del más viejo al más nuevo. */
  estela: PuntoRadar[];
  /** Mínimo y máximo de X en los últimos `G_BANDA_S` segundos (incluye el valor de ahora). */
  minX: number;
  maxX: number;
  /** Lo más lejos del centro que estuvo la sección (Y, Z) en esa ventana, en g. */
  maxLateral: number;
}

const finito = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined && Number.isFinite(v);

/**
 * La estela y la banda: recorre la `serie` hacia atrás desde su último punto con T+. Antes del despegue
 * la serie no tiene T+, así que no hay historia (solo el valor de ahora). `ahora` se suma siempre a los
 * extremos para que el punto actual quede dentro de la escala.
 */
export function ventanaG(serie: Serie, ahora: MuestraG): VentanaG {
  let minX = Math.min(0, ahora.x);
  let maxX = Math.max(1, ahora.x);
  let maxLateral = Math.hypot(ahora.y, ahora.z);
  const estela: PuntoRadar[] = [];

  const t = serie.t_mas_s;
  let ultimo = t.length - 1;
  while (ultimo >= 0 && !finito(t[ultimo])) ultimo--;
  if (ultimo >= 0) {
    const tAhora = t[ultimo] as number;
    for (let i = ultimo; i >= 0; i--) {
      const ti = t[i];
      if (!finito(ti) || tAhora - ti > G_BANDA_S) break;
      const x = serie.acc_x_g[i];
      const y = serie.acc_y_g[i];
      const z = serie.acc_z_g[i];
      if (!finito(x) || !finito(y) || !finito(z)) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      maxLateral = Math.max(maxLateral, Math.hypot(y, z));
      if (tAhora - ti <= G_ESTELA_S) estela.unshift({ y, z });
    }
  }
  return { estela, minX, maxX, maxLateral };
}

export interface EscalasG {
  /** Radio del radar, en g. */
  radar: number;
  /** Extremos de la barra del eje X, en g. */
  bajo: number;
  alto: number;
}

/** Las escalas del radar y de la barra X para una ventana (las mismas cuentas que `drawG`). */
export function escalasG(v: VentanaG): EscalasG {
  return {
    radar: escalaG(v.maxLateral * G_ESCALA_HOLGURA),
    bajo: -escalaG(Math.max(1, -v.minX * G_ESCALA_HOLGURA)),
    alto: escalaG(Math.max(2, v.maxX * G_ESCALA_HOLGURA)),
  };
}

/** ¿Algún eje pasó el fondo de escala del acelerómetro (±`ACC_ESCALA_G`)? Entonces el dato satura. */
export function saturaSensor(a: MuestraG): boolean {
  return Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)) > ACC_ESCALA_G;
}
