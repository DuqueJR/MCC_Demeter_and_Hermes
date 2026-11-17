import { expect, test } from "@playwright/test";
import { apiColgada } from "./api_colgada";

// Prueba de humo (T-610): las 3 páginas cargan, sin errores y sin desborde horizontal,
// a las dos medidas de referencia (06 §6): celular y portátil.
const PAGINAS = [
  { ruta: "/", titulo: /Hermes y Deméter/, nombre: "portada" },
  { ruta: "/demeter/", titulo: /Deméter/, nombre: "demeter" },
  { ruta: "/hermes/", titulo: /Hermes/, nombre: "hermes" },
];
const MEDIDAS = [
  { ancho: 390, alto: 844, nombre: "celular" },
  { ancho: 1440, alto: 900, nombre: "portatil" },
];

for (const medida of MEDIDAS) {
  test.describe(`${medida.nombre} ${medida.ancho}x${medida.alto}`, () => {
    test.use({ viewport: { width: medida.ancho, height: medida.alto } });

    for (const pagina of PAGINAS) {
      test(`${pagina.nombre} carga sin errores`, async ({ page }) => {
        await apiColgada(page); // las páginas de misión piden /api (T-624); aquí no hay servidor
        const errores: string[] = [];
        page.on("pageerror", (e) => errores.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error") errores.push(m.text());
        });

        const respuesta = await page.goto(pagina.ruta);
        expect(respuesta?.status()).toBe(200);
        await expect(page).toHaveTitle(pagina.titulo);
        await expect(page.locator("h1")).toBeVisible();

        const desborde = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(desborde).toBe(false);
        expect(errores).toEqual([]);

        await page.screenshot({
          path: `e2e/capturas/${pagina.nombre}-${medida.ancho}x${medida.alto}.png`,
        });
      });
    }
  });
}
