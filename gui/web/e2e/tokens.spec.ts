import { expect, test } from "@playwright/test";
import { apiColgada } from "./api_colgada";

// T-613: el tema se aplica en las páginas de misión y la página de tokens se ve en los dos temas.
// Valores esperados: 02_identidad_visual §6.
const TEMAS = [
  { mision: "hermes", fondo: "#14112a", acento: "#b4a7f5", display: "Montserrat" },
  { mision: "demeter", fondo: "#0b1a24", acento: "#85c6f8", display: "Marcellus" },
] as const;
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
];

for (const tema of TEMAS) {
  test(`/${tema.mision}/ aplica su tema y carga su fuente de títulos`, async ({ page }) => {
    await apiColgada(page); // sin servidor (T-624)
    await page.goto(`/${tema.mision}/`);
    const leido = await page.evaluate(() => {
      const estilo = getComputedStyle(document.documentElement);
      return {
        fondo: estilo.getPropertyValue("--fondo").trim(),
        acento: estilo.getPropertyValue("--acento").trim(),
        pintado: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(leido.fondo).toBe(tema.fondo);
    expect(leido.acento).toBe(tema.acento);
    expect(leido.pintado).not.toBe("rgba(0, 0, 0, 0)");
    await page.evaluate(() => document.fonts.ready);
    const cargadas = await page.evaluate(() =>
      [...document.fonts]
        .filter((f) => f.status === "loaded")
        .map((f) => f.family.replace(/"/g, "")),
    );
    expect(cargadas).toContain(tema.display);
    expect(cargadas).toContain("Inter");
  });
}

for (const tema of TEMAS) {
  for (const medida of MEDIDAS) {
    test.describe(`tokens ${tema.mision} ${medida.ancho}x${medida.alto}`, () => {
      test.use({ viewport: { width: medida.ancho, height: medida.alto } });

      test("la página de desarrollo se ve y no desborda", async ({ page }) => {
        const errores: string[] = [];
        page.on("pageerror", (e) => errores.push(e.message));
        // El servidor de desarrollo (puerto 5174) sirve /dev/tokens.html; el dist/ no la tiene.
        await page.goto(`http://localhost:5174/dev/tokens.html?mision=${tema.mision}`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("#colores .muestra")).toHaveCount(10);
        const desborde = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(desborde).toBe(false);
        expect(errores).toEqual([]);
        await page.screenshot({
          path: `e2e/capturas/tokens-${tema.mision}-${medida.ancho}x${medida.alto}.png`,
          fullPage: true,
        });
      });
    });
  }
}
