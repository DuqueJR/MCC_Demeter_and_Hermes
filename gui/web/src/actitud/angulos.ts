// Actitud: del cuaternión a cabeceo, alabeo y rumbo (03 §3.6, protocolo_paquetes §2 y §8). T-634.
// Lógica pura, sin DOM ni signals: se prueba con Vitest.
//
// Lo que dice el contrato (no se supone nada más):
// - `q = (w, x, y, z)` es un cuaternión unitario que rota vectores del CUERPO al marco ENU
//   (protocolo_paquetes §2, NAV `q_w`..`q_z`; web-1 `estado.q`).
// - ENU: Este, Norte, Arriba. Cuerpo: +X hacia la nariz; Y y Z completan un sistema dextrógiro
//   (protocolo_paquetes §8).
//
// Lo que el contrato NO fija (D-007: la matriz `R_MONTAJE` está pendiente) y se define aquí:
// el sentido de Y y Z respecto al horizonte, es decir, de dónde se mide el alabeo. Se usa la
// convención "adelante-izquierda-arriba" (X nariz, Y izquierda, Z arriba cuando el cohete va
// horizontal), que es la que ya publica el generador de vuelos sintéticos
// (`tools/web_datos/actitud.py`). Cuando se mida `R_MONTAJE`, el cero del alabeo puede cambiar
// por una constante; el cabeceo y el rumbo salen solo del eje X y no dependen de ella.
//
// Convención de los tres ángulos (secuencia rumbo -> cabeceo -> alabeo):
// - cabeceo (pitch): elevación de la nariz sobre el horizonte, de −90 a +90; +90 = nariz arriba.
// - rumbo (yaw): azimut de la nariz proyectada en el horizonte, 0 = norte, horario, de 0 a 360.
// - alabeo (roll): giro alrededor del eje de la nariz, de −180 a +180; positivo por la regla de la
//   mano derecha sobre +X (la izquierda sube: ala derecha abajo). 0 con Y horizontal y Z hacia arriba.
import { ACTITUD_CARDAN_DEG, ACTITUD_HORIZ_MIN, ACTITUD_NORMA_MIN } from "./constantes";

export interface Cuaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

export interface Angulos {
  /** Elevación de la nariz, −90..90 grados. */
  cabeceo: number;
  /** Giro alrededor de la nariz, −180..180 grados. */
  alabeo: number;
  /** Azimut de la nariz, 0..360 grados (0 = norte). */
  rumbo: number;
  /**
   * Con la nariz casi vertical (`|cabeceo| >= ACTITUD_CARDAN_DEG`) el rumbo y el alabeo giran
   * casi alrededor del mismo eje: solo su combinación es una medida fiable. La interfaz no debe
   * presentarlos como dos medidas separadas.
   */
  cardan: boolean;
}

const GRADOS_MEDIA_VUELTA = 180;
const GRADOS_VUELTA = 360;
const aGrados = (rad: number) => (rad * GRADOS_MEDIA_VUELTA) / Math.PI;

/** Lleva un ángulo a [0, 360). */
export function normalizarRumbo(grados: number): number {
  const r = ((grados % GRADOS_VUELTA) + GRADOS_VUELTA) % GRADOS_VUELTA;
  // Un valor negativo diminuto da 360 por redondeo: ese valor es el 0.
  return r >= GRADOS_VUELTA ? 0 : r;
}

/**
 * Cabeceo, alabeo y rumbo de un cuaternión cuerpo -> ENU. Acepta un cuaternión que no esté
 * normalizado (lo normaliza: en el enlace llega en Q15 y trae un error de redondeo) y devuelve
 * `null` si no es una actitud válida (no finito o de norma casi nula).
 */
export function angulosDeCuaternion(q: Cuaternion): Angulos | null {
  const norma = Math.hypot(q.w, q.x, q.y, q.z);
  if (!Number.isFinite(norma) || norma < ACTITUD_NORMA_MIN) return null;
  const w = q.w / norma;
  const x = q.x / norma;
  const y = q.y / norma;
  const z = q.z / norma;

  // Columnas de la matriz de rotación cuerpo -> ENU: la nariz (+X) y el eje Y del cuerpo, en ENU.
  const nE = 1 - 2 * (y * y + z * z);
  const nN = 2 * (x * y + w * z);
  const nU = 2 * (x * z - w * y);
  const yE = 2 * (x * y - w * z);
  const yN = 1 - 2 * (x * x + z * z);
  const yU = 2 * (y * z + w * x);

  const cabeceo = aGrados(Math.asin(Math.max(-1, Math.min(1, nU))));
  const cardan = Math.abs(cabeceo) >= ACTITUD_CARDAN_DEG;
  const horiz = Math.hypot(nE, nN);

  if (horiz < ACTITUD_HORIZ_MIN) {
    // Vertical exacta: la nariz no da rumbo. Con alabeo 0, Y apunta a la izquierda del rumbo.
    return { cabeceo, alabeo: 0, rumbo: normalizarRumbo(aGrados(Math.atan2(yN, -yE))), cardan };
  }

  const rumbo = normalizarRumbo(aGrados(Math.atan2(nE, nN)));
  // Ejes "sin alabeo" para ese rumbo y cabeceo: l0 (izquierda, horizontal) y u0 (arriba de la nariz).
  const l0E = -nN / horiz;
  const l0N = nE / horiz;
  const u0E = (-nU * nE) / horiz;
  const u0N = (-nU * nN) / horiz;
  const u0U = horiz;
  const alabeo = aGrados(Math.atan2(yE * u0E + yN * u0N + yU * u0U, yE * l0E + yN * l0N));
  return { cabeceo, alabeo, rumbo, cardan };
}

const SECTORES = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"] as const;

/** `271` -> `"O"` (los ocho vientos, con la O de oeste como en el mapa). */
export function cardinalDe(rumbo: number): string {
  const sector = GRADOS_VUELTA / SECTORES.length;
  return SECTORES[Math.round(normalizarRumbo(rumbo) / sector) % SECTORES.length] as string;
}
