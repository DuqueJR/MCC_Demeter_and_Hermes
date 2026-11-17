import { expect, test } from "@playwright/test";
// @ts-expect-error: módulo .mjs de Node sin tipos
import { PRESUPUESTO_PORTADA_BYTES, pesoDePortada } from "../scripts/peso-portada.mjs";

// Portada (T-620, 03 §1): dos enlaces accesibles, teclado, sin JS, sin desborde y bajo presupuesto.
const CAPTURAS = "../../docs/07_bitacora/capturas/T-621";
const MEDIDAS = [
  { ancho: 390, alto: 844, nombre: "celular-vertical" },
  { ancho: 844, alto: 390, nombre: "celular-horizontal" },
  { ancho: 1440, alto: 900, nombre: "portatil" },
];
const ENLACES = [
  { nombre: "Entrar a la misión Deméter", href: "/demeter/" },
  { nombre: "Entrar a la misión Hermes", href: "/hermes/" },
];

for (const medida of MEDIDAS) {
  test.describe(`portada ${medida.ancho}x${medida.alto}`, () => {
    test.use({ viewport: { width: medida.ancho, height: medida.alto } });

    test("sin desborde, a una pantalla, y captura", async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const medidas = await page.evaluate(() => ({
        ancho: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        alto: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      }));
      expect(medidas.ancho).toBeLessThanOrEqual(0);
      expect(medidas.alto).toBeLessThanOrEqual(0);
      // Los dos parches caben completos en su mitad (no se recortan, 02 §7).
      for (const enlace of ENLACES) {
        const mitad = await page.getByRole("link", { name: enlace.nombre }).boundingBox();
        const parche = await page
          .getByRole("link", { name: enlace.nombre })
          .locator(".parche")
          .boundingBox();
        expect(mitad && parche).toBeTruthy();
        if (mitad && parche) {
          expect(parche.x).toBeGreaterThanOrEqual(mitad.x);
          expect(parche.y).toBeGreaterThanOrEqual(mitad.y);
          expect(parche.x + parche.width).toBeLessThanOrEqual(mitad.x + mitad.width);
          expect(parche.y + parche.height).toBeLessThanOrEqual(mitad.y + mitad.height);
        }
      }
      await page.screenshot({ path: `${CAPTURAS}/portada-${medida.ancho}x${medida.alto}.png` });
    });
  });
}

test.describe("portada: enlaces, teclado y sin JS", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("cada mitad es un enlace con nombre accesible y ocupa toda la mitad", async ({ page }) => {
    await page.goto("/");
    for (const enlace of ENLACES) {
      const el = page.getByRole("link", { name: enlace.nombre });
      await expect(el).toHaveAttribute("href", enlace.href);
      const caja = await el.boundingBox();
      expect(caja?.width).toBeCloseTo(720, 0);
      expect(caja?.height).toBeCloseTo(900, 0);
    }
    // Un clic en una esquina de la mitad (lejos del parche) entra a la misión.
    await page.mouse.click(30, 450);
    await expect(page).toHaveURL(/\/demeter\/$/);
  });

  test("con Tab se llega a los dos enlaces y se ve el foco", async ({ page }) => {
    await page.goto("/");
    for (const enlace of ENLACES) {
      await page.keyboard.press("Tab");
      const el = page.getByRole("link", { name: enlace.nombre });
      await expect(el).toBeFocused();
      const estilo = await el.evaluate((nodo) => {
        const e = getComputedStyle(nodo);
        const p = getComputedStyle(nodo.querySelector(".parche") as Element);
        return {
          contorno: e.outlineStyle,
          ancho: parseFloat(e.outlineWidth),
          transformacion: p.transform,
        };
      });
      expect(estilo.contorno).not.toBe("none");
      expect(estilo.ancho).toBeGreaterThan(0);
      await expect
        .poll(async () =>
          el.locator(".parche").evaluate((n) => new DOMMatrix(getComputedStyle(n).transform).a),
        )
        .toBeCloseTo(1.08, 2);
    }
  });

  test("el hover hace crecer el parche y oscurece la otra mitad", async ({ page }) => {
    await page.goto("/");
    const demeter = page.getByRole("link", { name: "Entrar a la misión Deméter" });
    const hermes = page.getByRole("link", { name: "Entrar a la misión Hermes" });
    await demeter.hover();
    await expect
      .poll(async () =>
        demeter.locator(".parche").evaluate((n) => new DOMMatrix(getComputedStyle(n).transform).a),
      )
      .toBeCloseTo(1.08, 2);
    await expect
      .poll(async () => hermes.evaluate((n) => getComputedStyle(n).filter))
      .toContain("brightness(0.85)");
  });

  test("no hay scripts en /", async ({ page }) => {
    const pedidos: string[] = [];
    page.on("request", (r) => pedidos.push(r.url()));
    const respuesta = await page.goto("/");
    const html = (await respuesta?.text()) ?? "";
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(await page.locator("script").count()).toBe(0);
    expect(pedidos.filter((u) => /\.m?js(\?|$)/.test(u))).toEqual([]);
  });

  test("la portada no pide imágenes en PNG (solo AVIF o WebP)", async ({ page }) => {
    const pedidos: string[] = [];
    page.on("request", (r) => pedidos.push(r.url()));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(pedidos.filter((u) => /\.png(\?|$)/.test(u))).toEqual([]);
    expect(pedidos.some((u) => u.endsWith(".avif"))).toBe(true);
  });
});

test("el peso de / en el dist es menor de 500 KB (04 §6)", () => {
  const { total, partes } = pesoDePortada("dist");
  console.log(
    `peso de /: ${(total / 1000).toFixed(1)} KB`,
    partes.map((p: { ruta: string }) => p.ruta),
  );
  expect(total).toBeLessThan(PRESUPUESTO_PORTADA_BYTES);
});
