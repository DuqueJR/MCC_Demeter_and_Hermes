import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { apiColgada, esperarPintado } from "./api_colgada";
import { alimentar, DEV, reposos, snapshotDe } from "./mapa_ayudas";

// T-649 (D-W22): el mapa topográfico. Las capas de relieve (sombreado y curvas de nivel) se
// dibujan en las dos misiones, y si los archivos de `public/mapas/relieve/` faltan o fallan, el mapa
// carga igual que antes. La producción (vite preview, :4173) prueba la carga; el servidor de
// desarrollo (:5174) deja inyectar un snapshot y se usa para las capturas con la trayectoria.
const RUTA_RELIEVE = resolve(import.meta.dirname, "../public/mapas/relieve/relieve.json");
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-649");
mkdirSync(CAPTURAS, { recursive: true });

test.skip(!existsSync(RUTA_RELIEVE), "no hay public/mapas/relieve/ (npm run relieve)");

const MISIONES = ["demeter", "hermes"] as const;
const MEDIDAS = [
  { nombre: "celular", ancho: 390, alto: 844 },
  { nombre: "escritorio", ancho: 1440, alto: 900 },
] as const;
const CAPAS_RELIEVE = 3; // relieve-sombreado, relieve-curvas y relieve-curvas-indice (estilo.ts)
const TEXTO_LEYENDA = "Relieve y curvas de nivel cada 50 m";
/** Alto de la cabecera fija de la página de misión, para las capturas. */
const ALTO_CABECERA_PX = 140;
const RUTA_RELIEVE_URL = "**/mapas/relieve/**";

/**
 * Errores de consola, salvo los de red de lo que la prueba bloquea a propósito: el PMTiles
 * opcional y los archivos del relieve (el navegador escribe "Failed to load resource" por ellos).
 */
function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    const url = m.location().url;
    if (m.type() === "error" && !url.includes(".pmtiles") && !url.includes("/mapas/relieve/")) {
      errores.push(m.text());
    }
  });
  return errores;
}

async function abrirMapa(page: Page, url: string) {
  await page.goto(url);
  await esperarPintado(page);
  await page.locator("#mapa").scrollIntoViewIfNeeded();
  await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-listo", "1");
}

test.describe("relieve en producción (vite preview)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const mision of MISIONES) {
    test(`${mision}: dibuja el sombreado y las curvas de nivel, con su atribución y su leyenda`, async ({
      page,
    }) => {
      const errores = vigilarErrores(page);
      const pedidos: string[] = [];
      page.on("request", (r) => pedidos.push(new URL(r.url()).pathname));
      await apiColgada(page);
      await page.goto(`/${mision}/`);
      await esperarPintado(page);
      // El relieve es del chunk del mapa: no se pide nada hasta llegar a la sección.
      expect(pedidos.filter((p) => p.includes("/mapas/relieve/"))).toEqual([]);
      await page.locator("#mapa").scrollIntoViewIfNeeded();
      const lienzo = page.locator(".mapa-lienzo");
      await expect(lienzo).toHaveAttribute("data-mapa-listo", "1");

      await expect(lienzo).toHaveAttribute("data-mapa-relieve", "activo");
      await expect(lienzo).toHaveAttribute("data-mapa-capas-relieve", String(CAPAS_RELIEVE));
      // Las teselas del sombreado llegaron y hay curvas de nivel dibujadas.
      await expect(lienzo).toHaveAttribute("data-mapa-relieve-cargado", "1", { timeout: 15_000 });
      await expect
        .poll(async () => Number(await lienzo.getAttribute("data-mapa-curvas-dibujadas")), {
          timeout: 15_000,
        })
        .toBeGreaterThan(0);
      // Teselas terrarium y el GeoJSON de curvas: pedidos solo al crear el mapa.
      expect(pedidos.some((p) => /\/mapas\/relieve\/\d+\/\d+\/\d+\.png$/.test(p))).toBe(true);
      expect(pedidos.filter((p) => p.endsWith("/mapas/relieve/curvas.geojson"))).toHaveLength(1);
      // Atribución del relieve (Mapzen/Tilezen y SRTM), junto a la existente del mapa base.
      const atribucion = page.locator(".maplibregl-ctrl-attrib");
      await expect(atribucion).toContainText("Mapzen");
      await expect(atribucion).toContainText("SRTM");
      if ((await lienzo.getAttribute("data-mapa-base")) === "vectorial") {
        await expect(atribucion).toContainText("OpenStreetMap");
      }
      await expect(page.locator(".mapa-leyenda")).toContainText(TEXTO_LEYENDA);
      expect(errores).toEqual([]);
    });
  }

  test("el sombreado cambia los píxeles del lienzo (no es solo una capa declarada)", async ({
    page,
  }) => {
    await apiColgada(page);
    const lienzo = page.locator(".mapa-lienzo");
    const captura = async () => {
      await abrirMapa(page, "/demeter/");
      await expect(lienzo).toHaveAttribute("data-mapa-reposos", /.+/);
      if ((await lienzo.getAttribute("data-mapa-relieve")) === "activo") {
        await expect(lienzo).toHaveAttribute("data-mapa-relieve-cargado", "1", { timeout: 15_000 });
      }
      const antes = await reposos(page);
      await expect.poll(() => reposos(page)).toBeGreaterThanOrEqual(antes);
      await page.waitForTimeout(500);
      return lienzo.screenshot();
    };
    const con = await captura();
    await page.route(RUTA_RELIEVE_URL, (r) => r.abort());
    const sin = await captura();
    expect(await lienzo.getAttribute("data-mapa-relieve")).toBe("sin-relieve");
    expect(con.equals(sin)).toBe(false);
  });
});

test.describe("sin los archivos del relieve, el mapa queda como antes", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const FALLOS = {
    "no hay red (aborta)": (page: Page) => page.route(RUTA_RELIEVE_URL, (r) => r.abort()),
    "404": (page: Page) =>
      page.route(RUTA_RELIEVE_URL, (r) => r.fulfill({ status: 404, body: "no existe" })),
    "index.html con 200 (hosting de una sola vista)": (page: Page) =>
      page.route(RUTA_RELIEVE_URL, (r) =>
        r.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>x</title>",
        }),
      ),
  } as const;

  for (const mision of MISIONES) {
    for (const [nombre, bloquear] of Object.entries(FALLOS)) {
      test(`${mision}: ${nombre}`, async ({ page }) => {
        const errores = vigilarErrores(page);
        const avisos: string[] = [];
        page.on("console", (m) => m.type() === "warning" && avisos.push(m.text()));
        await apiColgada(page);
        await bloquear(page);
        await abrirMapa(page, `/${mision}/`);
        const lienzo = page.locator(".mapa-lienzo");
        await expect(page.locator(".maplibregl-canvas")).toBeVisible();
        await expect(lienzo).toHaveAttribute("data-mapa-relieve", "sin-relieve");
        // El mapa dibujó (reposo) y no tiene ni una capa de relieve.
        await expect.poll(() => reposos(page)).toBeGreaterThan(0);
        await expect(lienzo).toHaveAttribute("data-mapa-capas-relieve", "0");
        await expect(lienzo).toHaveAttribute("data-mapa-curvas-dibujadas", "0");
        // La leyenda no nombra un relieve que no se ve.
        await expect(page.locator(".mapa-leyenda")).not.toContainText("Relieve");
        await expect(page.locator(".mapa-leyenda li")).toHaveCount(3);
        await expect(page.locator(".maplibregl-ctrl-attrib")).not.toContainText("Mapzen");
        // Solo un aviso (`console.warn`), ningún error.
        expect(avisos.some((a) => a.includes("relieve"))).toBe(true);
        expect(errores).toEqual([]);
      });
    }
  }

  test("si llega relieve.json pero no las teselas, el mapa carga y solo avisa", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await apiColgada(page);
    await page.route("**/mapas/relieve/*/*/*.png", (r) => r.abort());
    await abrirMapa(page, "/hermes/");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-relieve", "activo");
    await expect
      .poll(async () =>
        Number(await page.locator(".mapa-lienzo").getAttribute("data-mapa-curvas-dibujadas")),
      )
      .toBeGreaterThan(0); // las curvas no dependen de las teselas
    expect(errores).toEqual([]);
  });

  test("si faltan solo las curvas, queda el sombreado", async ({ page }) => {
    const errores = vigilarErrores(page);
    await apiColgada(page);
    await page.route("**/mapas/relieve/curvas.geojson", (r) => r.fulfill({ status: 404 }));
    await abrirMapa(page, "/demeter/");
    const lienzo = page.locator(".mapa-lienzo");
    await expect(lienzo).toHaveAttribute("data-mapa-relieve", "activo");
    await expect(lienzo).toHaveAttribute("data-mapa-capas-relieve", "1");
    await expect(lienzo).toHaveAttribute("data-mapa-relieve-cargado", "1", { timeout: 15_000 });
    await expect(lienzo).toHaveAttribute("data-mapa-curvas-dibujadas", "0");
    expect(errores).toEqual([]);
  });
});

// ---- Capturas con la trayectoria (para que las revise el usuario) ----

test.describe("capturas (desarrollo)", () => {
  for (const medida of MEDIDAS) {
    for (const mision of MISIONES) {
      for (const conBase of [true, false]) {
        test(`${mision} ${medida.nombre} ${conBase ? "con" : "sin"} PMTiles`, async ({ page }) => {
          test.setTimeout(90_000);
          await page.setViewportSize({ width: medida.ancho, height: medida.alto });
          if (!conBase) await page.route("**/*.pmtiles", (r) => r.fulfill({ status: 404 }));
          await page.goto(`${DEV}/${mision}/?sin_cliente`);
          await page.locator("#mapa").scrollIntoViewIfNeeded();
          const lienzo = page.locator(".mapa-lienzo");
          await expect(lienzo).toHaveAttribute("data-mapa-listo", "1");
          await expect(lienzo).toHaveAttribute("data-mapa-relieve", "activo");
          const antes = await reposos(page);
          await alimentar(page, snapshotDe(mision, "nominal", 70_000));
          await expect.poll(() => reposos(page)).toBeGreaterThan(antes);
          await expect(lienzo).toHaveAttribute("data-mapa-relieve-cargado", "1", {
            timeout: 15_000,
          });
          await page.waitForTimeout(1200); // el encuadre y las teselas terminan de asentarse
          const seccion = page.locator("#mapa");
          const tomar = async (que: string) => {
            // La cabecera de la página es fija: se deja la sección justo debajo de ella.
            await seccion.evaluate((e) => e.scrollIntoView({ block: "start" }));
            await page.evaluate((alto) => window.scrollBy(0, -alto), ALTO_CABECERA_PX);
            await seccion.screenshot({
              path: join(
                CAPTURAS,
                `${mision}-${medida.nombre}-${conBase ? "con" : "sin"}-pmtiles-${que}.png`,
              ),
            });
          };
          // El encuadre del vuelo (con la trayectoria) y una vista amplia, donde se ve el terreno.
          await tomar("vuelo");
          const alejar = page.locator(".maplibregl-ctrl-zoom-out");
          for (let i = 0; i < 2 && (await alejar.isEnabled()); i++) {
            const previo = await reposos(page);
            await alejar.click();
            await expect.poll(() => reposos(page)).toBeGreaterThan(previo);
          }
          await page.waitForTimeout(1200);
          await tomar("amplio");
        });
      }
    }
  }
});
