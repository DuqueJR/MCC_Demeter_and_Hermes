import { expect, type Locator, type Page, test } from "@playwright/test";

// T-639: las fotos del equipo (carrusel de Inicio y sección Equipo) deben verse en escritorio y en
// móvil. En escritorio el CSS ocultaba con `display: none` todas las diapositivas menos la primera,
// así que la foto del equipo medía 0 × 0 y su `loading="lazy"` nunca la pedía.
const MISIONES = ["demeter", "hermes"] as const;
const ESCRITORIO = [1280, 1470, 1920] as const;
const MOVIL = 390;

type Medida = { ancho: number; alto: number; naturalWidth: number; completa: boolean };

async function medir(img: Locator): Promise<Medida> {
  return img.evaluate((e: HTMLImageElement) => {
    const r = e.getBoundingClientRect();
    return {
      ancho: r.width,
      alto: r.height,
      naturalWidth: e.naturalWidth,
      completa: e.complete,
    };
  });
}

// Lleva la imagen a la vista (el `loading="lazy"` solo la pide cerca del viewport) y espera a que
// el navegador la haya decodificado con tamaño propio.
async function verificarVisible(img: Locator, nombre: string) {
  await expect(img, `${nombre}: visible`).toBeVisible();
  await img.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await medir(img)).naturalWidth, { message: `${nombre}: naturalWidth` })
    .toBeGreaterThan(0);
  const m = await medir(img);
  expect(m.ancho, `${nombre}: ancho`).toBeGreaterThan(0);
  expect(m.alto, `${nombre}: alto`).toBeGreaterThan(0);
  expect(m.completa, `${nombre}: complete`).toBe(true);
}

async function irAMision(page: Page, mision: string, ancho: number) {
  await page.setViewportSize({ width: ancho, height: ancho < 600 ? 844 : 900 });
  await page.goto(`/${mision}/`);
  await expect(page.locator("#inicio .carrusel")).toBeVisible();
}

async function verificarImagenesDeEquipo(page: Page) {
  const imgs = page.locator("#equipo img");
  const n = await imgs.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await verificarVisible(imgs.nth(i), `imagen ${i} de Equipo`);
  }
}

for (const mision of MISIONES) {
  for (const ancho of ESCRITORIO) {
    test(`escritorio ${ancho}: ${mision} muestra las fotos del equipo`, async ({ page }) => {
      await irAMision(page, mision, ancho);

      const fotos = page.locator("#inicio .carrusel img.foto");
      await expect(fotos).toHaveCount(2); // el cohete y el equipo
      await verificarVisible(fotos.nth(0), "foto del cohete");
      await verificarVisible(fotos.nth(1), "foto del equipo");

      // Ninguna diapositiva queda fuera de la banda ni a medias: no hay que deslizar en escritorio.
      const dentro = await page.evaluate(() => {
        const c = document.querySelector("#inicio .carrusel")?.getBoundingClientRect();
        if (!c) return false;
        return [...document.querySelectorAll("#inicio .diapositiva")].every((d) => {
          const r = d.getBoundingClientRect();
          return r.left >= c.left - 1 && r.right <= c.right + 1;
        });
      });
      expect(dentro, "todas las diapositivas dentro de la banda").toBe(true);

      // Sección Equipo: el parche grande (y cualquier imagen que se agregue ahí).
      await verificarImagenesDeEquipo(page);
      await expect(page.locator("#equipo .integrante").first()).toBeVisible();
    });
  }

  test(`móvil ${MOVIL}: ${mision} muestra las fotos del equipo`, async ({ page }) => {
    await irAMision(page, mision, MOVIL);

    const fotos = page.locator("#inicio .carrusel img.foto");
    await expect(fotos).toHaveCount(2);
    await verificarVisible(fotos.nth(0), "foto del cohete");
    // En móvil el carrusel desliza: la foto del equipo está en la 2.ª diapositiva.
    await verificarVisible(fotos.nth(1), "foto del equipo");

    await verificarImagenesDeEquipo(page);
  });
}
