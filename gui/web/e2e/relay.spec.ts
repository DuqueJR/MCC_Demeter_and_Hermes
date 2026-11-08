import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

// T-640: la web real contra el RELAY público (gui/relay/, Python), no contra el repetidor.
//
// NO corre en la suite normal: necesita el relay levantado en el puerto al que apunta el proxy de Vite
// (:8787) y alimentado desde afuera. Con el repetidor ocupando ese puerto (en_vivo.spec.ts) chocarían.
// Se activa con la variable RELAY_E2E:
//
//   RELAY_E2E=sin_datos   el relay está recién arrancado y vacío: la página NO debe decir "en vivo".
//   RELAY_E2E=vivo        el relay recibe un vuelo nominal de las dos misiones (alimentar.py): la página se ve en vivo.
//
// Cómo (gui/relay/README.md):
//   1. WEB_INGESTA_TOKEN=... python gui/relay/servidor.py        (con una carpeta de datos vacía)
//   2. cd gui/web && npm run build
//   3. RELAY_E2E=sin_datos npx playwright test e2e/relay.spec.ts
//   4. python gui/relay/alimentar.py gui/web/dev/datos/demeter_nominal.jsonl gui/web/dev/datos/hermes_nominal.jsonl --velocidad 3 &
//      RELAY_E2E=vivo npx playwright test e2e/relay.spec.ts      (mientras alimentar.py corre)
//
// Las capturas van a docs/07_bitacora/capturas/T-640.
const MODO = process.env.RELAY_E2E;
const DEV = "http://localhost:5174";
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-640");

test.skip(!MODO, "requiere el relay en :8787 (ver el encabezado de este archivo)");
if (MODO) mkdirSync(CAPTURAS, { recursive: true });

const MISIONES = ["demeter", "hermes"] as const;
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(m.text());
  });
  return errores;
}

const barra = (page: Page) => page.locator(".barra");
// Las gráficas se montan al acercarse a la sección (diferido): hay que llegar a ella.
const irAGraficas = (page: Page) =>
  page
    .locator("#graficas")
    .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));

test.describe("relay vacío", () => {
  test.skip(MODO !== "sin_datos", "RELAY_E2E=sin_datos");
  for (const mision of MISIONES) {
    test(`${mision}: sin datos la página no dice "en vivo" y no hay errores`, async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.goto(`${DEV}/${mision}/`);
      await expect(barra(page)).toBeVisible();
      // se deja pasar un rato: con el cliente conectado y sin latido, nunca debe pasar a "en vivo"
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(1000);
        await expect(barra(page)).not.toHaveAttribute("data-principal", "en_vivo");
        await expect(barra(page)).not.toContainText("EN VIVO");
      }
      await irAGraficas(page);
      await expect(page.locator("#graficas canvas")).toHaveCount(0);
      expect(errores).toEqual([]);
      await page.screenshot({ path: resolve(CAPTURAS, `T-640-${mision}-sin-datos-1440.png`) });
    });
  }
});

test.describe("relay alimentado con el vuelo nominal", () => {
  test.skip(MODO !== "vivo", "RELAY_E2E=vivo");
  for (const mision of MISIONES) {
    test(`${mision}: se ve en vivo, con telemetría y gráficas, y sin errores de consola`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const errores = vigilarErrores(page);
      await page.goto(`${DEV}/${mision}/`);

      await expect(barra(page)).toHaveAttribute("data-principal", "en_vivo", { timeout: 30_000 });
      // los datos del vuelo nominal vienen marcados como simulación (modo del meta), y desde T-636
      // la barra lo dice con "SIMULACIÓN" en vez de "EN VIVO"
      await expect(barra(page)).toContainText("SIMULACIÓN");
      await expect(barra(page)).toContainText("SIM");
      // la telemetría llega: el T+ y la altitud tienen número
      await expect(page.locator(".barra-t")).toHaveText(/T\+/, { timeout: 90_000 });
      await expect(page.locator(".barra-alt .num")).toHaveText(/\d/, { timeout: 90_000 });
      // y las gráficas se dibujan con la serie
      await irAGraficas(page);
      await expect(page.locator("#graficas")).toHaveAttribute("data-vista", "vivo", {
        timeout: 30_000,
      });
      await expect(page.locator("#graficas canvas")).toHaveCount(1);
      await expect(page.locator("#graficas .graficas-resumen")).toContainText("Altitud máxima");

      // recargar a mitad del vuelo: el snapshot del relay trae la serie y los eventos
      await page.reload();
      await expect(barra(page)).toHaveAttribute("data-principal", "en_vivo", { timeout: 30_000 });
      await irAGraficas(page);
      await expect(page.locator("#graficas canvas")).toHaveCount(1);
      await expect(
        page.locator(`#estado [data-objetivo="despegue"][data-encendido="si"]`),
      ).toHaveCount(1);

      for (const m of MEDIDAS) {
        await page.setViewportSize({ width: m.ancho, height: m.alto });
        await expect(barra(page)).toHaveAttribute("data-principal", "en_vivo");
        await page.screenshot({
          path: resolve(CAPTURAS, `T-640-${mision}-en-vivo-${m.ancho}x${m.alto}.png`),
        });
      }
      expect(errores).toEqual([]);
    });
  }
});
