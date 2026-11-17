import { expect, test } from "@playwright/test";
import sharp from "sharp";

// Contraste del texto sobre el fondo pintado de la portada (T-621, 02 §4: AA = 4,5:1).
//
// Método:
//  1. Se leen el color real y la caja de cada texto (nombre, lema, "Entrar", cabecera y logo).
//  2. Se oculta el texto (`color: transparent`, logo con `visibility: hidden`) y se captura la página:
//     lo que queda es el fondo tal como lo ve la persona (imagen + velo + halo del parche).
//  3. Para cada caja se toma el percentil 95 de la luminancia relativa (WCAG 2.x) de sus píxeles. El texto es
//     claro, así que el peor caso es el fondo más claro; el percentil 95 ignora píxeles sueltos (una flor, una
//     pluma) sin esconder una zona clara real.
//  4. razón = (L_texto + 0,05) / (L_fondo95 + 0,05). Se exige 4,5:1 a todos, también a los títulos grandes
//     (que según WCAG solo necesitarían 3:1). El logo es blanco y se exige lo mismo.
const CONTRASTE_AA = 4.5;
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 844, alto: 390 },
  { ancho: 1440, alto: 900 },
];
const TEXTOS = [
  { nombre: "nombre de Deméter", selector: '[data-mision="demeter"] .nombre' },
  { nombre: "lema de Deméter", selector: '[data-mision="demeter"] .lema' },
  { nombre: "entrar de Deméter", selector: '[data-mision="demeter"] .entrar' },
  { nombre: "nombre de Hermes", selector: '[data-mision="hermes"] .nombre' },
  { nombre: "lema de Hermes", selector: '[data-mision="hermes"] .lema' },
  { nombre: "entrar de Hermes", selector: '[data-mision="hermes"] .entrar' },
  { nombre: "lugar y fecha (cabecera)", selector: ".cabecera .lugar" },
  { nombre: "logo de la EIA (cabecera)", selector: ".cabecera img" },
];

const lineal = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminancia = (r: number, g: number, b: number) =>
  0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);

const ESTADOS = [
  { nombre: "reposo", hover: null },
  { nombre: "con el cursor sobre Deméter", hover: "Entrar a la misión Deméter" },
  { nombre: "con el cursor sobre Hermes", hover: "Entrar a la misión Hermes" },
];
for (const estado of ESTADOS)
  for (const medida of estado.hover ? [MEDIDAS[2] as (typeof MEDIDAS)[number]] : MEDIDAS) {
    test(`contraste AA del texto sobre el fondo, ${medida.ancho}x${medida.alto}, ${estado.nombre}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: medida.ancho, height: medida.alto });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      if (estado.hover) {
        // Con el cursor encima, el fondo de esa mitad se aclara (portada.css): también debe cumplir.
        await page.getByRole("link", { name: estado.hover }).hover();
        await page.waitForTimeout(600); // la transición dura --dur-media (320 ms)
      }
      const cajas = await page.evaluate((textos) => {
        return textos.flatMap((t) => {
          const el = document.querySelector(t.selector);
          if (!el) return [];
          const caja = el.getBoundingClientRect();
          // `.entrar` trae dos textos (clic y toca): se mide el que se ve.
          const visible = [...el.querySelectorAll("*")].find(
            (h) => getComputedStyle(h).display !== "none",
          );
          const cs = getComputedStyle(visible ?? el);
          if (caja.width === 0 || getComputedStyle(el).display === "none") return [];
          const rgb = (cs.color.match(/[\d.]+/g) ?? ["255", "255", "255"]).slice(0, 3).map(Number);
          return [{ nombre: t.nombre, x: caja.x, y: caja.y, w: caja.width, h: caja.height, rgb }];
        });
      }, TEXTOS);
      expect(cajas.length).toBeGreaterThanOrEqual(6);

      await page.addStyleTag({
        content:
          ".nombre,.lema,.entrar,.lugar{color:transparent !important}.cabecera img{visibility:hidden}",
      });
      const { data, info } = await sharp(await page.screenshot())
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const filas: string[] = [];
      for (const c of cajas) {
        const luces: number[] = [];
        const x0 = Math.max(0, Math.floor(c.x));
        const x1 = Math.min(info.width, Math.ceil(c.x + c.w));
        const y0 = Math.max(0, Math.floor(c.y));
        const y1 = Math.min(info.height, Math.ceil(c.y + c.h));
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const o = (y * info.width + x) * 3;
            luces.push(luminancia(data[o] ?? 0, data[o + 1] ?? 0, data[o + 2] ?? 0));
          }
        }
        luces.sort((a, b) => a - b);
        const fondo = luces[Math.floor(luces.length * 0.95)] ?? 0;
        const texto = luminancia(c.rgb[0] ?? 0, c.rgb[1] ?? 0, c.rgb[2] ?? 0);
        const razon = (texto + 0.05) / (fondo + 0.05);
        filas.push(`${c.nombre}: ${razon.toFixed(2)}:1`);
        expect
          .soft(razon, `${c.nombre} a ${medida.ancho}x${medida.alto}`)
          .toBeGreaterThanOrEqual(CONTRASTE_AA);
      }
      console.log(`contraste ${medida.ancho}x${medida.alto}\n  ${filas.join("\n  ")}`);
    });
  }
