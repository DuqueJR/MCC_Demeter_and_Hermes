import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { crearRepetidor, type Repetidor } from "../dev/repetidor/servidor";

// T-631: la web real (el visor /dev/en_vivo.html con el cliente de datos) contra el repetidor de
// T-630, a través del proxy de Vite, en un navegador de verdad. Es la primera vez que el cliente
// habla con un servidor SSE real desde un navegador.
//
// El repetidor se levanta aquí mismo, en el puerto al que apunta el proxy de Vite (vite.config.ts).
// Si ya hay uno corriendo en ese puerto (`npm run repetidor`), estas pruebas fallan: ciérralo.
const DEV = "http://localhost:5174";
const PUERTO_API = 8787;
const DATOS = join(resolve(import.meta.dirname, ".."), "dev", "datos");
/** Las pruebas aceleran el tiempo: un vuelo de 100 s dura unos 5 s. */
const VELOCIDAD = 20;

test.describe.configure({ mode: "serial" });

let repetidor: Repetidor | undefined;
test.afterEach(async () => {
  await repetidor?.cerrar();
  repetidor = undefined;
});

async function levantar(escenario: string, velocidad: number): Promise<void> {
  repetidor = crearRepetidor({
    archivos: {
      demeter: { escenario, ruta: join(DATOS, `demeter_${escenario}.jsonl`) },
      hermes: { escenario, ruta: join(DATOS, `hermes_${escenario}.jsonl`) },
    },
    velocidad,
  });
  await repetidor.escuchar(PUERTO_API, "127.0.0.1");
}

const texto = (page: Page, id: string) => page.locator(`#${id}`);

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(m.text());
  });
  return errores;
}

for (const mision of ["demeter", "hermes"] as const) {
  test(`${mision}: un vuelo nominal llega al navegador por el proxy, en orden y sin errores`, async ({
    page,
  }) => {
    await levantar("nominal", VELOCIDAD);
    const errores = vigilarErrores(page);
    await page.goto(`${DEV}/dev/en_vivo.html?mision=${mision}`);

    await expect(texto(page, "mision")).toHaveText(mision);
    await expect(texto(page, "conexion")).toHaveText("conectado");
    // simulación o sintético: nunca "vivo" (03 §4)
    await expect(texto(page, "avisos")).toContainText("simulacion");

    // la línea de fases se enciende en orden
    await expect(texto(page, "eventos")).toContainText("despegue", { timeout: 15_000 });
    await expect(texto(page, "eventos")).toContainText("apogeo", { timeout: 15_000 });
    await expect(texto(page, "fase")).toHaveText("LANDED", { timeout: 20_000 });
    await expect(texto(page, "avisos")).toContainText("aterrizado");
    const eventos = (await texto(page, "eventos").textContent()) ?? "";
    expect(eventos.indexOf("despegue")).toBeLessThan(eventos.indexOf("apogeo"));
    expect(eventos.indexOf("apogeo")).toBeLessThan(eventos.indexOf("aterrizaje"));
    expect(Number(await texto(page, "serie_n").textContent())).toBeGreaterThan(100);

    // la interpolación entrega números (el visor no corre a la velocidad real: no se mide su suavidad aquí)
    expect(await texto(page, "interp").textContent()).toMatch(/^-?\d+\.\d+ -?\d+\.\d+ -?\d+\.\d+$/);
    expect(errores).toEqual([]);
  });
}

test("relay_caido: el navegador muestra 'reconectando', respeta el 503 y se pone al día", async ({
  page,
}) => {
  await levantar("relay_caido", 10);
  const errores = vigilarErrores(page);
  await page.goto(`${DEV}/dev/en_vivo.html?mision=demeter`);
  await expect(texto(page, "conexion")).toHaveText("conectado");

  // el repetidor cierra el stream y responde 503 con Retry-After durante el hueco
  await expect(texto(page, "conexion")).toHaveText("reconectando", { timeout: 15_000 });
  await expect(texto(page, "principal")).toHaveText("sin_servidor");
  expect(Number(await texto(page, "serie_n").textContent())).toBeGreaterThan(0); // los datos se mantienen

  // vuelve, y termina el vuelo sin eventos repetidos
  await expect(texto(page, "conexion")).toHaveText("conectado", { timeout: 20_000 });
  await expect(texto(page, "fase")).toHaveText("LANDED", { timeout: 30_000 });
  const eventos = ((await texto(page, "eventos").textContent()) ?? "").split(",");
  expect(eventos.filter((e) => e === "despegue")).toHaveLength(1);
  expect(eventos.filter((e) => e === "aterrizaje")).toHaveLength(1);

  const stats = JSON.parse((await texto(page, "stats").textContent()) ?? "{}");
  expect(stats.sesiones).toBeGreaterThanOrEqual(2);
  expect(stats.esperasMs.some((ms: number) => ms >= 5000)).toBe(true); // Retry-After: 5
  // el navegador registra los 503 como errores de red en la consola: son esperados
  expect(errores.filter((e) => !e.includes("503"))).toEqual([]);
});
