import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { alimentar, DEV, snapshotDe } from "./mapa_ayudas";

// T-671 (D-065): el QR y el bloque grande de coordenadas solo en LANDED; durante el vuelo, las
// coordenadas (lat, lon y altura sobre el nivel del mar) van compactas dentro del mapa. Se prueba en
// el servidor de desarrollo (:5174) con `?sin_cliente`, inyectando snapshots de dev/datos.
// Las capturas van a docs/07_bitacora/capturas/T-671.
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-671");
mkdirSync(CAPTURAS, { recursive: true });

type Mision = "demeter" | "hermes";
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;

/** Instantes (ms del escenario `nominal`): ver dev/datos/*_nominal.jsonl. */
const T_SIN_FIX = 1_000;
const T_PREFLIGHT_CON_POS = 5_000;
const T_DESCENSO = 40_000;
const ROJO_ALARMA = "rgb(255, 77, 94)";

const abrir = (page: Page, mision: Mision) => page.goto(`${DEV}/${mision}/?sin_cliente`);
const nominalEn = (m: Mision, t: number) => snapshotDe(m, "nominal", t);
const aterrizado = (m: Mision) => snapshotDe(m, "nominal");

const recuperacion = (page: Page) => page.locator("section#recuperacion");
const etiqueta = (page: Page) => page.locator("section#mapa .mapa-coordenadas");

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    // El PMTiles opcional no existe en el repo: su 404 es esperado (como en mapa.spec.ts).
    if (m.type() === "error" && !m.location().url.includes(".pmtiles")) errores.push(m.text());
  });
  return errores;
}

const irAlMapa = async (page: Page) => {
  await page.locator("#mapa").scrollIntoViewIfNeeded();
  await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-listo", "1");
};

const sinDesborde = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** El texto de lat/lon como lo pinta la etiqueta: coma decimal, 5 decimales y "−" tipográfico. */
const coord = (valor: number) => `${valor.toFixed(5).replace(".", ",").replace("-", "−")}°`;

type Caja = { x: number; y: number; width: number; height: number };
const seSuperponen = (a: Caja, b: Caja) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe("sin QR ni bloque grande antes de LANDED", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const mision of ["demeter", "hermes"] as const) {
    test(`${mision}: en descenso no hay QR ni coordenadas grandes en todo el árbol`, async ({
      page,
    }) => {
      await abrir(page, mision);
      await alimentar(page, nominalEn(mision, T_DESCENSO));
      await expect(recuperacion(page)).toHaveAttribute("data-aterrizado", "no");
      // En ninguna parte de la página: ni el SVG, ni su botón, ni el enlace de Maps, ni "Copiar".
      await expect(page.locator("svg.qr")).toHaveCount(0);
      await expect(page.locator(".recup-qr")).toHaveCount(0);
      await expect(page.locator('[data-coord="lat"], [data-coord="lon"]')).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Abrir en Google Maps" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^(Copiar|Mostrar el QR)/ })).toHaveCount(0);
    });
  }

  test("en cada fase de vuelo sigue sin QR, y la etiqueta del mapa tiene la posición", async ({
    page,
  }) => {
    await abrir(page, "demeter");
    for (const t of [T_PREFLIGHT_CON_POS, 10_000, 20_000, T_DESCENSO]) {
      const snap = nominalEn("demeter", t);
      expect(snap.estado?.fase).not.toBe("LANDED");
      await alimentar(page, snap);
      await expect(page.locator("svg.qr")).toHaveCount(0);
      await expect(etiqueta(page)).toHaveAttribute("data-coords-mapa", /^(actual|lkp)$/);
    }
  });

  test("la sección solo avisa que el QR llega al aterrizar y deja el vector", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_DESCENSO));
    const r = recuperacion(page);
    await expect(r.locator('[data-recup="en-vuelo"]')).toContainText("cuando el cohete aterrice");
    await expect(r.locator('[data-vector="distancia"]')).toContainText(/\d+ m/);
  });
});

test.describe("coordenadas compactas dentro del mapa", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("lat, lon y altura sobre el nivel del mar, sobre el marco del mapa", async ({ page }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    const snap = nominalEn("demeter", T_DESCENSO);
    const pos = snap.estado?.pos;
    if (!pos || pos.alt_msl_m === null) throw new Error("el descenso debe traer pos con alt_msl_m");
    await alimentar(page, snap);
    await irAlMapa(page);

    const e = etiqueta(page);
    await expect(e).toBeVisible();
    await expect(e).toHaveAttribute("data-coords-mapa", "actual");
    await expect(e.locator('[data-coord-mapa="lat"]')).toHaveText(coord(pos.lat));
    await expect(e.locator('[data-coord-mapa="lon"]')).toHaveText(coord(pos.lon));
    // La altura sobre el nivel del mar (`alt_msl_m`), no la altura sobre la rampa.
    await expect(e.locator('[data-coord-mapa="alt"]')).toHaveText(
      `${Math.round(pos.alt_msl_m)} msnm`,
    );
    await expect(e.locator(".mapa-coordenadas-rotulo")).toContainText("Cohete");

    // Legible en el celular: no se sale del marco, ni crea desborde horizontal.
    const marco = await page.locator(".mapa-marco").boundingBox();
    const caja = await e.boundingBox();
    if (!marco || !caja) throw new Error("faltan las cajas");
    expect(caja.x).toBeGreaterThanOrEqual(marco.x);
    expect(caja.x + caja.width).toBeLessThanOrEqual(marco.x + marco.width);
    expect(caja.y).toBeGreaterThanOrEqual(marco.y);
    expect(caja.height).toBeLessThan(marco.height / 4);
    expect(
      await e
        .locator('[data-coord-mapa="lat"]')
        .evaluate((n) => parseFloat(getComputedStyle(n).fontSize)),
    ).toBeGreaterThanOrEqual(13);
    expect(await sinDesborde(page)).toBe(true);
    expect(errores).toEqual([]);
  });

  test("no tapa los controles del mapa ni el cohete", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_DESCENSO));
    await irAlMapa(page);
    const e = etiqueta(page);
    await expect(e).toBeVisible();
    await expect(page.locator(".mapa-controles")).toBeVisible();
    await expect(page.locator(".mapa-cohete")).toBeVisible();
    const caja = await e.boundingBox();
    if (!caja) throw new Error("falta la caja de la etiqueta");
    // Los botones propios (derecha), el zoom de MapLibre (izquierda) y el marcador del cohete.
    for (const selector of [
      ".mapa-controles .mapa-boton",
      ".maplibregl-ctrl-top-left .maplibregl-ctrl-group",
      ".mapa-cohete",
    ]) {
      for (const el of await page.locator(selector).all()) {
        const otra = await el.boundingBox();
        if (otra) expect(seSuperponen(caja, otra), selector).toBe(false);
      }
    }
    // No captura gestos: el mapa de abajo sigue recibiendo el dedo.
    expect(await e.evaluate((n) => getComputedStyle(n).pointerEvents)).toBe("none");
  });

  test("sin lector ruidoso: la etiqueta no es una región viva", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_DESCENSO));
    const e = etiqueta(page);
    await expect(e).toBeVisible();
    await expect(e.locator("[aria-live], [role=status], [role=alert]")).toHaveCount(0);
    expect(await e.getAttribute("aria-live")).toBeNull();
  });

  test("sin señal: el LKP en rojo, con su antigüedad y la palabra (no solo el color)", async ({
    page,
  }) => {
    await abrir(page, "demeter");
    const snap = nominalEn("demeter", T_DESCENSO);
    // El último paquete llegó hace 38 s: el reloj local avanza y el estado se queda.
    await alimentar(page, snap, "conectado", 38_000);
    const e = etiqueta(page);
    await expect(e).toHaveAttribute("data-coords-mapa", "lkp");
    await expect(e.locator(".mapa-coordenadas-rotulo")).toContainText("Última posición");
    await expect(e.locator("[data-coords-edad]")).toContainText(/hace \d+ s/);
    expect(
      await e.locator(".mapa-coordenadas-rotulo").evaluate((n) => getComputedStyle(n).color),
    ).toBe(ROJO_ALARMA);
    // (P) Sin LANDED no hay QR aunque se haya perdido la señal: ver la bitácora de T-671.
    await expect(page.locator("svg.qr")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Abrir en Google Maps" })).toHaveCount(0);
  });

  test("sin posición válida: un texto breve, sin números inventados", async ({ page }) => {
    await abrir(page, "demeter");
    const snap = nominalEn("demeter", T_SIN_FIX);
    expect(snap.estado?.pos).toBeNull();
    await alimentar(page, snap);
    const e = etiqueta(page);
    await expect(e).toHaveAttribute("data-coords-mapa", "sin_posicion");
    await expect(e).toHaveText("Sin posición válida");
    expect(await e.innerHTML()).not.toContain("null");
    expect(await e.innerHTML()).not.toContain("NaN");
  });

  test("sin ningún dato todavía: también el texto breve", async ({ page }) => {
    await abrir(page, "demeter");
    await expect(etiqueta(page)).toHaveText("Sin posición válida");
  });

  test("altura sin dato: lat y lon sí, y la altura lo dice con palabras", async ({ page }) => {
    await abrir(page, "demeter");
    const snap = nominalEn("demeter", T_DESCENSO);
    if (!snap.estado?.pos) throw new Error("el descenso debe traer pos");
    await alimentar(page, {
      ...snap,
      estado: { ...snap.estado, pos: { ...snap.estado.pos, alt_msl_m: null } },
    });
    const e = etiqueta(page);
    await expect(e.locator('[data-coord-mapa="lat"]')).toContainText("°");
    await expect(e.locator('[data-coord-mapa="alt"]')).toHaveText("sin dato");
  });

  test("Hermes también", async ({ page }) => {
    await abrir(page, "hermes");
    await alimentar(page, nominalEn("hermes", T_DESCENSO));
    await expect(etiqueta(page)).toHaveAttribute("data-coords-mapa", "actual");
    await expect(page.locator("svg.qr")).toHaveCount(0);
  });
});

test.describe("LANDED: aparece el bloque de recuperación con el QR", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("de descenso a LANDED: el QR aparece y la etiqueta del mapa se quita", async ({ page }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_DESCENSO));
    await expect(page.locator("svg.qr")).toHaveCount(0);
    await expect(etiqueta(page)).toHaveCount(1);

    const snap = aterrizado("demeter");
    const pos = snap.estado?.pos;
    expect(snap.estado?.fase).toBe("LANDED");
    if (!pos) throw new Error("LANDED debe traer pos");
    await alimentar(page, snap);

    const r = recuperacion(page);
    await expect(r).toHaveAttribute("data-aterrizado", "si");
    await expect(r.locator('[data-coord="lat"]')).toHaveText(
      `${pos.lat.toFixed(7).replace(".", ",")}°`,
    );
    await expect(r.getByRole("button", { name: "Copiar" })).toBeVisible();
    await expect(r.getByRole("link", { name: "Abrir en Google Maps" })).toBeVisible();
    // El QR está en el DOM y apunta a Maps con la posición real (en el celular, tras un toque).
    await expect(r.locator("svg.qr")).toHaveAttribute(
      "data-qr-url",
      `https://www.google.com/maps/search/?api=1&query=${pos.lat.toFixed(7)},${pos.lon.toFixed(7)}`,
    );
    await r.getByRole("button", { name: /QR/ }).click();
    await expect(r.locator("svg.qr")).toBeVisible();
    // La etiqueta compacta se quita (no queda ni oculta en el árbol de accesibilidad).
    await expect(etiqueta(page)).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test("si vuelve a vuelo (dato de otra fase), el QR desaparece del DOM", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, aterrizado("demeter"));
    await expect(page.locator("svg.qr")).toHaveCount(1);
    await alimentar(page, nominalEn("demeter", T_DESCENSO));
    await expect(page.locator("svg.qr")).toHaveCount(0);
    await expect(etiqueta(page)).toHaveCount(1);
  });
});

test.describe("capturas de la bitácora (T-671)", () => {
  for (const med of MEDIDAS) {
    const medida = `${med.ancho}x${med.alto}`;
    test.describe(medida, () => {
      test.use({ viewport: { width: med.ancho, height: med.alto } });

      test("en vuelo: el mapa con la etiqueta y la sección sin QR", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, nominalEn("demeter", T_DESCENSO));
        await irAlMapa(page);
        await page.waitForTimeout(800);
        await page
          .locator("section#mapa")
          .screenshot({ path: `${CAPTURAS}/vuelo-mapa-${medida}.png` });
        await recuperacion(page).screenshot({
          path: `${CAPTURAS}/vuelo-recuperacion-${medida}.png`,
        });
        await page.locator("#mapa").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${CAPTURAS}/vuelo-pagina-${medida}.png` });
      });

      test("en vuelo y sin señal: el LKP en la etiqueta", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, nominalEn("demeter", T_DESCENSO), "conectado", 38_000);
        await irAlMapa(page);
        await page.waitForTimeout(800);
        await page
          .locator("section#mapa")
          .screenshot({ path: `${CAPTURAS}/vuelo-lkp-${medida}.png` });
      });

      test("LANDED: el bloque de recuperación con el QR", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, aterrizado("demeter"));
        await page.waitForTimeout(500);
        if (med.ancho < 1024) await recuperacion(page).getByRole("button", { name: /QR/ }).click();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${CAPTURAS}/landed-pagina-${medida}.png` });
        await recuperacion(page).screenshot({
          path: `${CAPTURAS}/landed-recuperacion-${medida}.png`,
        });
      });

      test("LANDED: el mapa, sin la etiqueta", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, aterrizado("demeter"));
        await irAlMapa(page);
        await page.waitForTimeout(800);
        await page
          .locator("section#mapa")
          .screenshot({ path: `${CAPTURAS}/landed-mapa-${medida}.png` });
      });
    });
  }
});
