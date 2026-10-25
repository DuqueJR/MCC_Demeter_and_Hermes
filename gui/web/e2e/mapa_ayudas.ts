// Ayudas de las pruebas del mapa (T-632). No es una prueba (no termina en .spec.ts).
// Arma snapshots reales con el acumulador del repetidor y los inyecta en `datos/api.ts` del
// servidor de desarrollo, sin tocar el código de la página.
import { join, resolve } from "node:path";
import type { Page } from "@playwright/test";
import { leerJsonl } from "../dev/repetidor/jsonl.ts";
import { Acumulador } from "../dev/repetidor/snapshot.ts";
import type { LineaJsonl, Mision, Snapshot } from "../src/contrato/tipos.ts";

const DATOS = resolve(import.meta.dirname, "../dev/datos");
/** El servidor de desarrollo (playwright.config.ts): el único donde se puede inyectar un snapshot. */
export const DEV = "http://localhost:5174";

/** El snapshot que serviría el repetidor tras `hastaMs` del escenario (o al final). */
export function snapshotDe(
  mision: Mision,
  escenario: string,
  hastaMs = Number.POSITIVE_INFINITY,
): Snapshot {
  const mensajes = leerJsonl(join(DATOS, `${mision}_${escenario}.jsonl`));
  const acum = new Acumulador();
  for (const m of mensajes) if (m.t_rel_ms <= hastaMs) acum.aplicar(m.linea);
  const meta = mensajes
    .map((m) => m.linea)
    .find((l): l is Extract<LineaJsonl, { evento: "meta" }> => l.evento === "meta");
  if (!meta) throw new Error("el escenario no trae meta");
  return acum.snapshot(meta.datos);
}

type Conexion = "cargando" | "conectado" | "reconectando";

/** Alimenta `datos/api.ts` de la página (el mismo módulo que usa la UI). */
export async function alimentar(
  page: Page,
  snapshot: Snapshot,
  conexion: Conexion = "conectado",
  ahoraMs = 0,
): Promise<void> {
  await page.evaluate(
    async ([s, c, ahora]) => {
      const ruta = "/src/datos/api.ts";
      const api = await import(/* @vite-ignore */ ruta);
      api.alimentar.snapshot(s, 0);
      api.alimentar.conexion(c);
      api.alimentar.reloj(ahora);
    },
    [snapshot, conexion, ahoraMs] as const,
  );
}

/** Solo cambia la conexión o el reloj local, sin tocar los datos. */
export async function moverReloj(page: Page, ahoraMs: number): Promise<void> {
  await page.evaluate(async (ahora) => {
    const ruta = "/src/datos/api.ts";
    const api = await import(/* @vite-ignore */ ruta);
    api.alimentar.reloj(ahora);
  }, ahoraMs);
}

export async function ponerConexion(page: Page, conexion: Conexion): Promise<void> {
  await page.evaluate(async (c) => {
    const ruta = "/src/datos/api.ts";
    const api = await import(/* @vite-ignore */ ruta);
    api.alimentar.conexion(c);
  }, conexion);
}

/** Cuántas veces ha terminado de dibujar el mapa (el contador que sube el controlador). */
export const reposos = (page: Page) =>
  page.evaluate(() =>
    Number(document.querySelector<HTMLElement>(".mapa-lienzo")?.dataset.mapaReposos ?? 0),
  );
