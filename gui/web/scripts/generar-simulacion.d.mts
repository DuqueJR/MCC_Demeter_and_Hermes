export const FORMATO_SIMULACION: string;
export const MISIONES: string[];
export const MISION: string;
export const MODO_SIMULACION: string;
export const ESCENARIO: string;
export const ESTADO_EN_VUELO_CADA: number;
export const SALUD_CADA: number;
export const COLA_TRAS_ATERRIZAJE_MS: number;
export const PRESUPUESTO_BYTES: number;
export const RUTA_ORIGEN: string;
export const RUTA_DESTINO: string;

export interface LineaCruda {
  t_rel_ms: number;
  evento: string;
  datos: unknown;
}

export function compactar(lineas: LineaCruda[]): LineaCruda[];
export function rutasDe(mision: string): { origen: string; destino: string };
export function generarTexto(textoJsonl: string, mision?: string): string;
