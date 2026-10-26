import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { apiColgada, esperarPintado } from "./api_colgada";
import { alimentar, DEV, moverReloj, ponerConexion, reposos, snapshotDe } from "./mapa_ayudas";

// T-632: el mapa. La producción (vite preview, :4173) no tiene datos de ejemplo (D-W18): ahí se
// prueba la carga diferida. El servidor de desarrollo (:5174) deja inyectar un snapshot real en
// `datos/api.ts` (escenarios de dev/datos), y con eso se prueban las capas, el LKP y los gestos.
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-632");
mkdirSync(CAPTURAS, { recursive: true });

const MISIONES = ["demeter", "hermes"] as const;
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;
/** Estados de color del 02 §4 (alarma), tal como los resuelve el navegador. */
const ROJO_ALARMA = "rgb(255, 77, 94)";
const FONDO_TEMA = { demeter: "#0b1a24", hermes: "#14112a" } as const;

/** Errores de consola, salvo el 404 esperado del PMTiles opcional (no existe en el repo). */
function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.includes(".pmtiles")) errores.push(m.text());
  });
  return errores;
}

const irAlMapa = async (page: Page) => {
  await page.locator("#mapa").scrollIntoViewIfNeeded();
  await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-listo", "1");
};

/** Espera a que MapLibre termine de dibujar después de `accion`. */
async function dibujado(page: Page, accion: () => Promise<void>) {
  const antes = await reposos(page);
  await accion();
  await expect.poll(() => reposos(page)).toBeGreaterThan(antes);
}

test.describe("carga diferida (producción)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const mision of MISIONES) {
    test(`${mision}: MapLibre no se descarga hasta llegar a la sección`, async ({ page }) => {
      const errores = vigilarErrores(page);
      const pedidos: string[] = [];
      page.on("request", (r) => pedidos.push(new URL(r.url()).pathname));
      const delMapa = () => pedidos.filter((p) => /\/assets\/(Mapa|maplibre)/.test(p));

      await apiColgada(page);
      await page.goto(`/${mision}/`);
      await expect(page.locator("h1")).toBeVisible();
      await esperarPintado(page);
      // En la parte alta de la página, el mapa está lejos: no se pidió nada de MapLibre.
      await expect(page.locator(".mapa-marco")).toHaveAttribute("data-mapa-fase", "esperando");
      expect(delMapa()).toEqual([]);
      await expect(page.locator(".maplibregl-map")).toHaveCount(0);

      // Al llegar a la sección se pide el chunk del mapa y su worker, y se dibuja.
      await irAlMapa(page);
      await expect(page.locator(".mapa-marco")).toHaveAttribute("data-mapa-fase", "listo");
      expect(delMapa().some((p) => /Mapa-.*\.js$/.test(p))).toBe(true);
      expect(delMapa().some((p) => /maplibre-gl-worker-.*\.mjs$/.test(p))).toBe(true);
      await expect(page.locator(".maplibregl-canvas")).toBeVisible();
      // Sin datos (D-W18): la rampa por defecto no existe y se avisa en lugar de inventar.
      await expect(page.locator(".mapa-aviso")).toHaveText("Aún no hay posición del cohete.");
      await expect(page.locator(".mapa-cohete, .mapa-lkp")).toHaveCount(0);
      expect(errores).toEqual([]);
    });
  }
});

test.describe("capas y LKP (desarrollo)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const mision of MISIONES) {
    test(`${mision}: el estilo toma el fondo de los tokens de su tema`, async ({ page }) => {
      await page.goto(`${DEV}/${mision}/?sin_cliente`);
      await irAlMapa(page);
      await expect(page.locator(".mapa-lienzo")).toHaveAttribute(
        "data-tema-fondo",
        FONDO_TEMA[mision],
      );
    });
  }

  test("en vuelo: rampa, estación, cohete con rumbo, elipse y chip de distancia", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await page.goto(`${DEV}/demeter/?sin_cliente`);
    await irAlMapa(page);
    await dibujado(page, () => alimentar(page, snapshotDe("demeter", "nominal", 70_000)));
    await expect(page.locator(".mapa-rampa")).toBeVisible();
    await expect(page.locator(".mapa-estacion")).toBeVisible();
    await expect(page.locator(".mapa-cohete")).toBeVisible();
    await expect(page.locator(".mapa-lkp")).toHaveCount(0);
    await expect(page.locator(".mapa-chip")).toContainText(/\d+ m · \d+° [NSEO]+/);
    await expect(page.locator(".mapa-aviso")).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test("lkp_descenso: marcador rojo fijo con altitud y 'hace X s'; nunca desaparece", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await page.goto(`${DEV}/demeter/?sin_cliente`);
    await irAlMapa(page);
    await dibujado(page, () => alimentar(page, snapshotDe("demeter", "lkp_descenso")));

    const lkp = page.locator(".mapa-lkp");
    await expect(lkp).toBeVisible();
    await expect(lkp.locator(".lkp-texto")).toContainText("Última posición");
    await expect(lkp.locator(".lkp-texto")).toContainText(/121 m · hace 4\d s/);
    await expect(lkp.locator(".lkp-texto")).toHaveCSS("color", ROJO_ALARMA);
    await expect(lkp.locator(".lkp-pin")).toHaveCSS("color", ROJO_ALARMA);
    await expect(page.locator(".mapa-cohete")).toHaveCount(0);

    // Pasan 10 minutos sin señal: el LKP sigue, con la antigüedad que corresponde.
    await moverReloj(page, 600_000);
    await expect(lkp).toContainText("hace 10 min");
    // Se cae el servidor (el celular pierde la red): el LKP tampoco se borra.
    await ponerConexion(page, "reconectando");
    await expect(page.locator(".mapa-lkp")).toBeVisible();
    await ponerConexion(page, "conectado");
    await expect(page.locator(".mapa-lkp")).toBeVisible();
    // Vuelve el cohete: el pin rojo da paso al punto en vivo.
    await alimentar(page, snapshotDe("demeter", "nominal", 70_000));
    await expect(page.locator(".mapa-cohete")).toBeVisible();
    await expect(page.locator(".mapa-lkp")).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test("controles: centrar, ver todo y pantalla completa", async ({ page }) => {
    await page.goto(`${DEV}/hermes/?sin_cliente`);
    await irAlMapa(page);
    const centrar = page.getByRole("button", { name: "Centrar en el cohete" });
    await expect(centrar).toBeDisabled();
    await expect(page.getByRole("button", { name: "Ver todo" })).toBeEnabled();
    await dibujado(page, () => alimentar(page, snapshotDe("hermes", "nominal", 70_000)));
    await expect(centrar).toBeEnabled();
    await dibujado(page, () => centrar.click());
    await dibujado(page, () => page.getByRole("button", { name: "Ver todo" }).click());

    // Pantalla completa: la sección cubre la ventana, la página no se desplaza y Escape sale.
    await page.getByRole("button", { name: "Pantalla completa" }).click();
    await expect(page.locator("#mapa")).toHaveClass(/completa/);
    const caja = await page.locator("#mapa").boundingBox();
    expect(caja).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
    await expect(page.locator("html")).toHaveClass(/mapa-completa-abierta/);
    await page.keyboard.press("Escape");
    await expect(page.locator("#mapa")).not.toHaveClass(/completa/);
    await expect(page.locator("html")).not.toHaveClass(/mapa-completa-abierta/);
  });
});

// Solo si existe public/mapas/santa_fe.pmtiles (lo genera un humano, README del módulo): el archivo
// no está en el repo, así que sin él la prueba se salta y el mapa funciona sin base (más arriba).
const PMTILES = resolve(import.meta.dirname, "../public/mapas/santa_fe.pmtiles");
test.describe("con el PMTiles de la zona", () => {
  test.skip(!existsSync(PMTILES), "no hay public/mapas/santa_fe.pmtiles");
  for (const mision of MISIONES) {
    for (const med of MEDIDAS) {
      test(`${mision} ${med.ancho}x${med.alto}: dibuja la base vectorial con los colores del tema`, async ({
        page,
      }) => {
        const errores = vigilarErrores(page);
        await page.setViewportSize({ width: med.ancho, height: med.alto });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`${DEV}/${mision}/?sin_cliente`);
        await irAlMapa(page);
        await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-base", "vectorial");
        await dibujado(page, () => alimentar(page, snapshotDe(mision, "nominal", 70_000)));
        await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");
        const n = await reposos(page);
        await page.getByRole("button", { name: "Ver todo" }).click();
        await expect.poll(() => reposos(page)).toBeGreaterThan(n);
        await page.locator("#mapa").screenshot({
          path: `${CAPTURAS}/${mision}-base-vectorial-${med.ancho}x${med.alto}.png`,
        });
        expect(errores).toEqual([]);
      });
    }
  }
});

test.describe("gestos en el celular", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("un dedo sobre el mapa desplaza la página: no queda atrapada", async ({ page }) => {
    await page.goto(`${DEV}/demeter/?sin_cliente`);
    await irAlMapa(page);
    await alimentar(page, snapshotDe("demeter", "nominal", 70_000));
    await expect(page.locator(".mapa-cohete")).toBeVisible();
    // MapLibre deja pasar el desplazamiento vertical al navegador (cooperativeGestures).
    await expect(page.locator(".maplibregl-canvas-container")).toHaveCSS(
      "touch-action",
      "pan-x pan-y",
    );

    const marco = await page.locator(".mapa-marco").boundingBox();
    if (!marco) throw new Error("el mapa no tiene caja");
    await page.evaluate(() => window.scrollTo(0, window.scrollY));
    const antes = await page.evaluate(() => window.scrollY);
    // Un arrastre real con el dedo, de abajo hacia arriba, que empieza DENTRO del mapa.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.synthesizeScrollGesture", {
      x: Math.round(marco.x + marco.width / 2),
      y: Math.round(Math.min(marco.y + marco.height - 40, 800)),
      yDistance: -300,
      gestureSourceType: "touch",
      speed: 1200,
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(antes + 100);
  });
});

test.describe("capturas de la sección", () => {
  for (const mision of MISIONES) {
    for (const med of MEDIDAS) {
      const medida = `${med.ancho}x${med.alto}`;
      test.describe(`${mision} ${medida}`, () => {
        test.use({ viewport: { width: med.ancho, height: med.alto }, reducedMotion: "reduce" });

        for (const [nombre, escenario, hasta] of [
          ["vivo", "nominal", 70_000],
          ["lkp", "lkp_descenso", undefined],
        ] as const) {
          test(`${nombre}`, async ({ page }) => {
            await page.goto(`${DEV}/${mision}/?sin_cliente`);
            await irAlMapa(page);
            await dibujado(page, () => alimentar(page, snapshotDe(mision, escenario, hasta)));
            await expect(
              page.locator(nombre === "vivo" ? ".mapa-cohete" : ".mapa-lkp"),
            ).toBeVisible();
            await page.locator("#mapa").scrollIntoViewIfNeeded();
            // Un reposo más: el encuadre animado y los marcadores ya están en su sitio.
            const n = await reposos(page);
            await page.getByRole("button", { name: "Ver todo" }).click();
            await expect.poll(() => reposos(page)).toBeGreaterThan(n);
            await page.locator("#mapa").screenshot({
              path: `${CAPTURAS}/${mision}-${nombre}-${medida}.png`,
            });
            // Lo que ve la persona: la ventana con la sección en su lugar del panel.
            if (nombre === "lkp") {
              await page.screenshot({ path: `${CAPTURAS}/${mision}-pagina-lkp-${medida}.png` });
            }
          });
        }
      });
    }
  }
});
