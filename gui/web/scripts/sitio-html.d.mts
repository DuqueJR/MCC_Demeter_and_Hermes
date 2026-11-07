import type { Plugin } from "vite";

export const URL_SITIO_PREDETERMINADA: string;
export function urlDelSitio(env?: Record<string, string | undefined>): string;
export function colorDeTema(raiz: string, tema: string): string;
export function etiquetasDelSitio(raiz: string, url?: string): Plugin;
