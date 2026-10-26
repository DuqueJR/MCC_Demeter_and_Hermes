import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { apiColgada, esperarPintado } from "./api_colgada";

// T-621: cada chip de "Partes del cohete" lleva el ícono ilustrativo de su misión a la izquierda del texto.
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-621");
mkdirSync(CAPTURAS, { recursive: true });

const MISIONES = [
  { id: "demeter", partes: ["Nariz", "CanSat", "VisionPack", "Motor", "Paracaídas", "Aletas"] },
  { id: "hermes", partes: ["Nariz", "CanSat", "Motor", "Paracaídas", "Aletas"] },
] as const;
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;

const sinDesborde = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

for (const m of MISIONES) {
  for (const med of MEDIDAS) {
    test.describe(`chips con ícono, ${m.id} ${med.ancho}x${med.alto}`, () => {
      test.use({ viewport: { width: med.ancho, height: med.alto } });
      test.beforeEach(async ({ page }) => apiColgada(page)); // sin servidor (T-624)

      test("cada chip trae su ícono (40 px) a la izquierda del texto, sin desborde", async ({
        page,
      }) => {
        await page.goto(`/${m.id}/`);
        const chips = page.locator("#inicio .chip");
        await expect(chips).toHaveCount(m.partes.length);
        await chips.first().scrollIntoViewIfNeeded();
        await expect(chips).toHaveText(m.partes.map((p) => new RegExp(`^${p}$`)));
        for (let i = 0; i < m.partes.length; i++) {
          const chip = chips.nth(i);
          const icono = chip.locator("img.chip-icono");
          await expect(icono).toHaveCount(1);
          await icono.scrollIntoViewIfNeeded();
          // La imagen cargó de verdad (no solo existe la etiqueta).
          await expect
            .poll(() => icono.evaluate((n: HTMLImageElement) => n.complete && n.naturalWidth > 0))
            .toBe(true);
          const cajaIcono = await icono.boundingBox();
          const cajaChip = await chip.boundingBox();
          expect(cajaIcono && cajaChip).toBeTruthy();
          if (cajaIcono && cajaChip) {
            expect(cajaIcono.width).toBeCloseTo(40, 0);
            expect(cajaIcono.height).toBeCloseTo(40, 0);
            // A la izquierda del texto y dentro del chip.
            expect(cajaIcono.x).toBeGreaterThanOrEqual(cajaChip.x);
            expect(cajaIcono.y).toBeGreaterThanOrEqual(cajaChip.y);
            expect(cajaIcono.y + cajaIcono.height).toBeLessThanOrEqual(
              cajaChip.y + cajaChip.height,
            );
            // El chip cabe en la pantalla.
            expect(cajaChip.x).toBeGreaterThanOrEqual(0);
            expect(cajaChip.x + cajaChip.width).toBeLessThanOrEqual(med.ancho);
          }
          // El texto del chip empieza a la derecha del ícono.
          const textoX = await chip.evaluate((n) => {
            const r = document.createRange();
            const t = [...n.childNodes].find((c) => c.nodeType === Node.TEXT_NODE);
            if (!t) return -1;
            r.selectNodeContents(t);
            return r.getBoundingClientRect().x;
          });
          if (cajaIcono) expect(textoX).toBeGreaterThanOrEqual(cajaIcono.x + cajaIcono.width - 1);
        }
        expect(await sinDesborde(page)).toBe(true);
        await page.locator("#inicio .chips").scrollIntoViewIfNeeded();
        await page.locator("#inicio").screenshot({
          path: `${CAPTURAS}/chips-${m.id}-${med.ancho}x${med.alto}.png`,
        });
      });

      test("el chip sigue entero y se abre aunque el ícono no cargue", async ({ page }) => {
        await page.route(/\/assets\/(nariz|cansat|motor)-[^/]+\.webp$/, (r) => r.abort());
        await page.goto(`/${m.id}/`);
        const chip = page.locator("#inicio .chip", { hasText: "Nariz" });
        await chip.scrollIntoViewIfNeeded();
        // El ícono roto se oculta; el texto queda y el chip se puede tocar.
        await expect(chip.locator("img.chip-icono")).toBeHidden();
        await expect(chip).toBeVisible();
        await chip.click();
        await expect(chip).toHaveAttribute("aria-expanded", "true");
        await expect(page.locator("#tarjeta-parte h3")).toHaveText("Nariz");
        expect(await sinDesborde(page)).toBe(true);
      });
    });
  }
}

test("Hermes no trae VisionPack ni ningún ícono de Deméter (D-W01)", async ({ page }) => {
  const pedidas: string[] = [];
  page.on("request", (r) => pedidas.push(r.url()));
  await apiColgada(page);
  await page.goto("/hermes/");
  await page.locator("#inicio .chips").scrollIntoViewIfNeeded();
  await esperarPintado(page);
  expect(pedidas.filter((u) => /visionpack/i.test(u))).toEqual([]);
  expect(pedidas.filter((u) => /\/assets\/demeter/i.test(u))).toEqual([]);
  await expect(page.locator("#inicio .chip", { hasText: "VisionPack" })).toHaveCount(0);
});
