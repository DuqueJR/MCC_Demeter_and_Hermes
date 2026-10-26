import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { apiColgada } from "./api_colgada";

// T-622: armazón de la página de misión. La producción (vite preview, :4173) arranca sin datos
// (D-W18); el servidor de desarrollo (:5174) acepta `?ejemplo` para ver la barra con datos.
const DEV = "http://localhost:5174";
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-622");
mkdirSync(CAPTURAS, { recursive: true });

const MISIONES = [
  { id: "demeter", nombre: "Deméter", otra: "/hermes/" },
  { id: "hermes", nombre: "Hermes", otra: "/demeter/" },
] as const;
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 768, alto: 1024 },
  { ancho: 1440, alto: 900 },
] as const;
const SECCIONES_DE_DATOS = [
  "estado",
  "telemetria",
  "mapa",
  "recuperacion",
  "actitud",
  "graficas",
  "salud",
];

const sinDesborde = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(m.text());
  });
  return errores;
}

for (const m of MISIONES) {
  for (const med of MEDIDAS) {
    const medida = `${med.ancho}x${med.alto}`;

    test.describe(`${m.id} ${medida}`, () => {
      test.use({ viewport: { width: med.ancho, height: med.alto } });

      test("producción, sin datos: barra en 'Cargando' y sin desborde", async ({ page }) => {
        await apiColgada(page); // el cliente (T-624) pide /api y no responde nadie: sigue "Cargando"
        const errores = vigilarErrores(page);
        await page.goto(`/${m.id}/`);
        await expect(page.locator("h1")).toHaveText(m.nombre);
        await expect(page.locator(".indicador")).toContainText("Cargando");
        await expect(page.locator(".banner")).toHaveCount(0);
        // Cada sección de datos existe como hueco, con su título y su ancla.
        for (const id of SECCIONES_DE_DATOS)
          await expect(page.locator(`section#${id}`)).toHaveCount(1);
        await expect(page.locator("section#ojos")).toHaveCount(m.id === "demeter" ? 1 : 0);
        expect(await sinDesborde(page)).toBe(true);
        expect(errores).toEqual([]);
      });

      test("con ?ejemplo (desarrollo): barra con datos, tema propio y capturas", async ({
        page,
      }) => {
        const errores = vigilarErrores(page);
        await page.goto(`${DEV}/${m.id}/?ejemplo`);
        await expect(page.locator(".indicador")).toContainText("EN VIVO");
        await expect(page.locator(".barra-fase")).toHaveText("Bajando con paracaídas");
        // T+ con el reloj del cohete: el estado de ejemplo va 42 s después del despegue.
        await expect(page.locator(".barra-t")).toHaveText("T+ 00:42");
        await expect(page.locator(".barra-alt .num")).toHaveText("312");
        await expect(page.locator(".barra-nombre")).toHaveText(m.nombre);
        // El tema de cada misión: el fondo es el token --fondo de su archivo de tema.
        const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(fondo).toBe(m.id === "demeter" ? "rgb(11, 26, 36)" : "rgb(20, 17, 42)");
        expect(await sinDesborde(page)).toBe(true);
        expect(errores).toEqual([]);
        await page.screenshot({
          path: `${CAPTURAS}/${m.id}-ejemplo-${medida}.png`,
          fullPage: true,
        });
      });
    });
  }
}

test.describe("navegación por anclas", () => {
  // El cliente (T-624) no debe interferir: sin servidor reintenta a cada rato y carga el hilo de la página.
  test.beforeEach(async ({ page }) => apiColgada(page));

  for (const med of [MEDIDAS[0], MEDIDAS[2]]) {
    test(`${med.ancho}x${med.alto}: cada enlace lleva a su sección`, async ({ page }) => {
      await page.setViewportSize({ width: med.ancho, height: med.alto });
      await page.goto("/demeter/");
      const nav = page.getByRole("navigation", { name: "Secciones de la página" });
      await expect(nav).toBeVisible();
      for (const [texto, id] of [
        ["Mapa", "mapa"],
        ["Datos", "telemetria"],
        ["Equipo", "equipo"],
        ["Estado", "estado"],
      ] as const) {
        await nav.getByRole("link", { name: texto }).click();
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        // La sección queda visible y no tapada por la cabecera fija.
        await expect
          .poll(async () =>
            page.evaluate((i) => {
              const sec = document.getElementById(i)?.getBoundingClientRect();
              const cab = document.querySelector(".cabecera-mision")?.getBoundingClientRect();
              if (!sec || !cab) return false;
              return sec.top >= cab.bottom - 1 && sec.top < window.innerHeight;
            }, id),
          )
          .toBe(true);
      }
    });
  }

  test("en el celular la navegación es inferior y fija; en el portátil, bajo la barra", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/hermes/");
    let caja = await page.locator(".navegacion").boundingBox();
    expect(caja && Math.round(caja.y + caja.height)).toBe(844);
    await page.setViewportSize({ width: 1440, height: 900 });
    caja = await page.locator(".navegacion").boundingBox();
    const cabecera = await page.locator(".barra").boundingBox();
    expect(caja && cabecera && caja.y >= cabecera.y + cabecera.height - 1).toBe(true);
  });

  test("tocar la barra va al Estado de la misión", async ({ page }) => {
    await page.goto("/hermes/");
    await page.locator(".barra-enlace").click();
    await expect(page).toHaveURL(/#estado$/);
  });
});

test.describe("la barra en cada estado (desarrollo, ?ejemplo=...)", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const ESTADOS = [
    { v: "senal_debil", ind: "Señal débil", clase: "ind-aviso" },
    { v: "sin_senal", ind: "Sin señal", clase: "ind-alarma" },
    { v: "sin_transmision", ind: "Sin transmisión", clase: "ind-sin-dato" },
    { v: "reconectando", ind: "Sin servidor", clase: "ind-sin-dato" },
    { v: "simulacion", ind: "EN VIVO", clase: "ind-ok" },
  ];
  for (const e of ESTADOS) {
    test(`${e.v}`, async ({ page }) => {
      await page.goto(`${DEV}/demeter/?ejemplo=${e.v}`);
      await expect(page.locator(".indicador")).toContainText(e.ind);
      await expect(page.locator(".indicador")).toHaveClass(new RegExp(e.clase));
      if (e.v === "sin_senal") {
        // GS-03: altitud roja, con su antigüedad.
        await expect(page.locator(".barra-alt")).toHaveClass(/lkp/);
        await expect(page.locator(".antiguedad")).toHaveText("hace 38 s");
      }
      if (e.v === "simulacion") {
        await expect(page.locator(".banner")).toContainText("Simulación: así será el vuelo");
        await expect(page.locator(".marca-sim")).toHaveText("SIM");
      } else {
        await expect(page.locator(".banner")).toHaveCount(0);
      }
      expect(await sinDesborde(page)).toBe(true);
      await page.screenshot({ path: `${CAPTURAS}/barra-${e.v}-390x844.png` });
    });
  }
});

// El estado de la conexión nunca se recorta: es lo que el público lee al sol (T-622).
test.describe("el texto del estado no se recorta", () => {
  const VARIANTES = [
    { v: "en_vivo", texto: "EN VIVO" },
    { v: "senal_debil", texto: "Señal débil" },
    { v: "sin_senal", texto: "Sin señal" },
    { v: "reconectando", texto: "Sin servidor" },
    { v: "sin_transmision", texto: "Sin transmisión" },
    { v: "simulacion", texto: "EN VIVO" },
  ];
  for (const ancho of [360, 390]) {
    for (const mision of ["demeter", "hermes"]) {
      test(`${mision} a ${ancho} px`, async ({ page }) => {
        await page.setViewportSize({ width: ancho, height: 844 });
        for (const e of VARIANTES) {
          await page.goto(`${DEV}/${mision}/?ejemplo=${e.v}`);
          const ind = page.locator(".indicador");
          await expect(ind).toContainText(e.texto);
          const medidas = await page.evaluate(() => {
            const el = document.querySelector(".indicador") as HTMLElement;
            const hijos = [el, ...Array.from(el.querySelectorAll("span"))] as HTMLElement[];
            const caja = el.getBoundingClientRect();
            return {
              recortado: hijos.some((h) => h.scrollWidth > h.clientWidth),
              derecha: caja.right,
              ancho: document.documentElement.clientWidth,
            };
          });
          expect(medidas.recortado, `${mision} ${e.v} a ${ancho}`).toBe(false);
          expect(medidas.derecha, `${mision} ${e.v} a ${ancho}`).toBeLessThanOrEqual(medidas.ancho);
          expect(await sinDesborde(page)).toBe(true);
        }
      });
    }
  }
});

test("producción: ?ejemplo no hace nada (los ejemplos no existen en el dist/)", async ({
  page,
}) => {
  await apiColgada(page);
  await page.goto("/demeter/?ejemplo");
  await expect(page.locator(".indicador")).toContainText("Cargando");
  await expect(page.locator(".barra-alt")).toContainText("sin dato");
});

test("los chips de partes abren y cierran su tarjeta", async ({ page }) => {
  await apiColgada(page);
  await page.goto("/hermes/");
  const tarjeta = page.locator("#tarjeta-parte");
  await expect(tarjeta).toBeHidden();
  await page.getByRole("button", { name: "Motor" }).click();
  await expect(tarjeta).toContainText("G80-7T");
  await page.getByRole("button", { name: "Motor" }).click();
  await expect(tarjeta).toBeHidden();
});

test("el pie solo enlaza a la otra misión, sin precargarla", async ({ page }) => {
  await apiColgada(page);
  for (const m of MISIONES) {
    await page.goto(`/${m.id}/`);
    await expect(page.locator(".pie-enlace")).toHaveAttribute("href", m.otra);
    await expect(page.locator(`link[href*="${m.otra.replaceAll("/", "")}"]`)).toHaveCount(0);
  }
});
