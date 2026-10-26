import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bytesToHeader } from "pmtiles";
import type { Snapshot } from "../src/contrato/tipos";
import { areaPorDefecto, dentroDe, encoger, zoomMinimo } from "../src/mapa/area";
import { MAPA_SOBREZOOM } from "../src/mapa/constantes";
import { alimentar, DEV, reposos, snapshotDe } from "./mapa_ayudas";

// T-634: el mapa no puede salir del área donde se ve bien. Los límites y el zoom máximo salen de
// la cabecera del PMTiles (aquí se leen del archivo para compararlos, no se escriben a mano); sin
// PMTiles, de un área por defecto alrededor de la rampa. El LKP, el cohete, la trayectoria y la
// estación nunca quedan fuera (GS-03). El lienzo publica su estado en `data-mapa-*`.
const CAPTURAS = resolve(import.meta.dirname, "capturas/T-634");
mkdirSync(CAPTURAS, { recursive: true });

const PMTILES = resolve(import.meta.dirname, "../public/mapas/santa_fe.pmtiles");
const hayPmtiles = existsSync(PMTILES);
const MISIONES = ["demeter", "hermes"] as const;
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;
/** Holgura al comparar grados y zoom con lo que publica el mapa. */
const EPS_GRADOS = 1e-4;
const EPS_ZOOM = 0.01;

interface EstadoMapa {
  limites: [number, number, number, number];
  vista: [number, number, number, number];
  centro: [number, number];
  zoom: number;
  zoomMin: number;
  zoomMax: number;
  ancho: number;
  alto: number;
}

const leerMapa = (page: Page): Promise<EstadoMapa> =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".mapa-lienzo");
    if (!el) throw new Error("no hay lienzo");
    const d = el.dataset;
    const lista = (t: string | undefined) => (t ?? "").split(",").map(Number);
    return {
      limites: lista(d.mapaLimites) as EstadoMapa["limites"],
      vista: lista(d.mapaVista) as EstadoMapa["vista"],
      centro: lista(d.mapaCentro) as EstadoMapa["centro"],
      zoom: Number(d.mapaZoom),
      zoomMin: Number(d.mapaZoomMin),
      zoomMax: Number(d.mapaZoomMax),
      ancho: el.clientWidth,
      alto: el.clientHeight,
    };
  });

const irAlMapa = async (page: Page) => {
  await page
    .locator("#mapa")
    .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-listo", "1");
  await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-limites", /.+/);
};

/** Espera a que MapLibre termine de dibujar después de `accion` (inercia y animaciones incluidas). */
async function dibujado(page: Page, accion: () => Promise<void>) {
  const antes = await reposos(page);
  await accion();
  await expect.poll(() => reposos(page)).toBeGreaterThan(antes);
}

/** La vista (lo que se ve) y el centro están dentro del área navegable. */
function expectDentro(e: EstadoMapa) {
  const [oeste, sur, este, norte] = e.limites;
  expect(e.vista[0]).toBeGreaterThanOrEqual(oeste - EPS_GRADOS);
  expect(e.vista[1]).toBeGreaterThanOrEqual(sur - EPS_GRADOS);
  expect(e.vista[2]).toBeLessThanOrEqual(este + EPS_GRADOS);
  expect(e.vista[3]).toBeLessThanOrEqual(norte + EPS_GRADOS);
  expect(dentroDe(e.limites, e.centro[0], e.centro[1])).toBe(true);
  expect(e.zoom).toBeGreaterThanOrEqual(e.zoomMin - EPS_ZOOM);
  expect(e.zoom).toBeLessThanOrEqual(e.zoomMax + EPS_ZOOM);
}

/**
 * Espera a que el mapa deje de moverse (inercia y animaciones): la vista y el zoom publicados no
 * cambian en dos lecturas seguidas. No sirve esperar un "reposo" de MapLibre: si el mapa ya está en
 * el límite, un arrastre no lo mueve y no dibuja nada.
 */
async function quieto(page: Page) {
  const firma = () =>
    page.evaluate(() => {
      const d = document.querySelector<HTMLElement>(".mapa-lienzo")?.dataset;
      return `${d?.mapaVista}|${d?.mapaZoom}`;
    });
  let previa = "";
  let iguales = 0;
  for (let i = 0; i < 60 && iguales < 2; i++) {
    await page.waitForTimeout(150);
    const actual = await firma();
    iguales = actual === previa ? iguales + 1 : 0;
    previa = actual;
  }
  expect(iguales).toBeGreaterThanOrEqual(2);
}

/** Arrastra con el ratón desde un punto vacío del lienzo, muy lejos, en la dirección dada. */
async function arrastrarLejos(page: Page, dx: number, dy: number) {
  const caja = await page.locator(".mapa-lienzo").boundingBox();
  if (!caja) throw new Error("el lienzo no tiene caja");
  // Cerca de una esquina: lejos de los marcadores y de los controles.
  const x = caja.x + caja.width * 0.6;
  const y = caja.y + caja.height * 0.3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const pasos = 12;
  for (let i = 1; i <= pasos; i++) {
    await page.mouse.move(x + (dx * i) / pasos, y + (dy * i) / pasos);
  }
  await page.mouse.up();
  await quieto(page);
}

/** Ctrl + rueda (los gestos cooperativos piden Ctrl para acercar con la rueda). */
async function ruedaConCtrl(page: Page, deltaY: number, veces: number) {
  const caja = await page.locator(".mapa-lienzo").boundingBox();
  if (!caja) throw new Error("el lienzo no tiene caja");
  await page.mouse.move(caja.x + caja.width * 0.6, caja.y + caja.height * 0.3);
  await page.keyboard.down("Control");
  for (let i = 0; i < veces; i++) await page.mouse.wheel(0, deltaY);
  await page.keyboard.up("Control");
  await quieto(page);
}

const sinPmtiles = (page: Page) =>
  page.route("**/mapas/santa_fe.pmtiles", (ruta) => ruta.fulfill({ status: 404, body: "" }));

/** Un snapshot del escenario `lkp_descenso` con el LKP a decenas de km del recorte. */
function conLkpLejano(mision: (typeof MISIONES)[number]): {
  snap: Snapshot;
  lon: number;
  lat: number;
} {
  const snap = snapshotDe(mision, "lkp_descenso");
  const estado = snap.estado;
  if (!estado?.lkp) throw new Error("el escenario no trae lkp");
  const lat = estado.lkp.lat + 0.25;
  const lon = estado.lkp.lon + 0.3;
  return { snap: { ...snap, estado: { ...estado, lkp: { ...estado.lkp, lat, lon } } }, lon, lat };
}

test.describe("con el PMTiles de la zona", () => {
  test.skip(!hayPmtiles, "no hay public/mapas/santa_fe.pmtiles");

  const cabecera = () => {
    const bytes = readFileSync(PMTILES);
    return bytesToHeader(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + 127) as ArrayBuffer,
    );
  };

  for (const med of MEDIDAS) {
    test(`${med.ancho}x${med.alto}: límites y zoom máximo salen del archivo; no se sale del área`, async ({
      page,
    }) => {
      const h = cabecera();
      await page.setViewportSize({ width: med.ancho, height: med.alto });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${DEV}/demeter/?sin_cliente`);
      await irAlMapa(page);
      await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-base", "vectorial");
      await dibujado(page, () => alimentar(page, snapshotDe("demeter", "nominal", 70_000)));

      // Lo que dice la cabecera del archivo, metido un poco hacia adentro.
      const esperado = encoger([h.minLon, h.minLat, h.maxLon, h.maxLat]);
      let e = await leerMapa(page);
      for (let i = 0; i < 4; i++) expect(e.limites[i]).toBeCloseTo(esperado[i] as number, 6);
      expect(e.zoomMax).toBeCloseTo(h.maxZoom + MAPA_SOBREZOOM, 6);
      expect(e.zoomMin).toBeCloseTo(zoomMinimo(e.limites, e.ancho, e.alto), 2);
      expectDentro(e);

      // Arrastrar muy lejos en las cuatro direcciones.
      for (const [dx, dy] of [
        [4000, 0],
        [-4000, 0],
        [0, 4000],
        [0, -4000],
        [3000, 3000],
        [-3000, -3000],
      ] as const) {
        await arrastrarLejos(page, dx, dy);
        e = await leerMapa(page);
        expectDentro(e);
      }

      // Alejar al máximo con la rueda: el zoom se detiene en el mínimo y la vista cabe en el área.
      await ruedaConCtrl(page, 800, 12);
      e = await leerMapa(page);
      expect(e.zoom).toBeCloseTo(e.zoomMin, 1);
      expectDentro(e);
      await expect(page.getByRole("button", { name: "Alejar" })).toBeDisabled();

      // Y arrastrar estando alejado al máximo (la dimensión más larga del área aún deja margen).
      await arrastrarLejos(page, 3000, 3000);
      expectDentro(await leerMapa(page));

      // Acercar al máximo con la rueda: se detiene en el zoom máximo del archivo + sobrezoom.
      await ruedaConCtrl(page, -800, 40);
      e = await leerMapa(page);
      expect(e.zoom).toBeCloseTo(e.zoomMax, 1);
      expectDentro(e);
      await expect(page.getByRole("button", { name: "Acercar" })).toBeDisabled();
    });
  }

  test("los botones de zoom se desactivan en el mínimo y en el máximo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${DEV}/hermes/?sin_cliente`);
    await irAlMapa(page);
    const alejar = page.getByRole("button", { name: "Alejar" });
    const acercar = page.getByRole("button", { name: "Acercar" });
    for (let i = 0; i < 20 && (await alejar.isEnabled()); i++) {
      await dibujado(page, () => alejar.click());
    }
    await expect(alejar).toBeDisabled();
    let e = await leerMapa(page);
    expect(e.zoom).toBeCloseTo(e.zoomMin, 2);
    expectDentro(e);
    for (let i = 0; i < 20 && (await acercar.isEnabled()); i++) {
      await dibujado(page, () => acercar.click());
    }
    await expect(acercar).toBeDisabled();
    e = await leerMapa(page);
    expect(e.zoom).toBeCloseTo(e.zoomMax, 2);
    expectDentro(e);
  });

  test("el zoom mínimo se recalcula al redimensionar y en pantalla completa", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${DEV}/demeter/?sin_cliente`);
    await irAlMapa(page);
    const antes = await leerMapa(page);
    expect(antes.zoomMin).toBeCloseTo(zoomMinimo(antes.limites, antes.ancho, antes.alto), 2);

    // Una ventana más angosta y más alta: otro tamaño de lienzo, otro zoom mínimo.
    await page.setViewportSize({ width: 600, height: 1000 });
    await expect.poll(async () => (await leerMapa(page)).ancho).not.toBe(antes.ancho);
    // El lienzo mide 60 % de la altura de la ventana (seccion.css): espera a que el diseño termine.
    await expect.poll(async () => (await leerMapa(page)).alto).toBeGreaterThan(550);
    await expect
      .poll(async () => {
        const e = await leerMapa(page);
        return Math.abs(e.zoomMin - zoomMinimo(e.limites, e.ancho, e.alto));
      })
      .toBeLessThan(EPS_ZOOM);
    const angosta = await leerMapa(page);
    expect(angosta.zoomMin).not.toBeCloseTo(antes.zoomMin, 2);
    expectDentro(angosta);

    // Pantalla completa: el lienzo cubre la ventana y el mínimo sigue al nuevo tamaño.
    await page.getByRole("button", { name: "Pantalla completa" }).click();
    await expect(page.locator("#mapa")).toHaveClass(/completa/);
    await expect
      .poll(async () => {
        const e = await leerMapa(page);
        return Math.abs(e.zoomMin - zoomMinimo(e.limites, e.ancho, e.alto));
      })
      .toBeLessThan(EPS_ZOOM);
    const completa = await leerMapa(page);
    expect(completa.alto).toBeGreaterThan(angosta.alto);
    expect(completa.zoomMin).toBeGreaterThan(angosta.zoomMin);
    expectDentro(completa);
    // Al salir vuelve al mínimo del lienzo chico.
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => Math.abs((await leerMapa(page)).zoomMin - angosta.zoomMin))
      .toBeLessThan(EPS_ZOOM);
  });
});

test.describe("sin PMTiles (el archivo no se encuentra)", () => {
  test("el área por defecto rodea a la rampa y no se sale de ella", async ({ page }) => {
    await sinPmtiles(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${DEV}/demeter/?sin_cliente`);
    await irAlMapa(page);
    await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-base", "sin-base");
    const snap = snapshotDe("demeter", "nominal", 70_000);
    await dibujado(page, () => alimentar(page, snap));

    const esperado = areaPorDefecto(snap.meta.sitio);
    let e = await leerMapa(page);
    for (let i = 0; i < 4; i++) expect(e.limites[i]).toBeCloseTo(esperado[i] as number, 6);
    expectDentro(e);

    for (const [dx, dy] of [
      [4000, 0],
      [0, -4000],
      [-3000, 3000],
    ] as const) {
      await arrastrarLejos(page, dx, dy);
      expectDentro(await leerMapa(page));
    }
    await ruedaConCtrl(page, 800, 12);
    e = await leerMapa(page);
    expect(e.zoom).toBeCloseTo(e.zoomMin, 1);
    expectDentro(e);
  });
});

for (const conPmtiles of [true, false]) {
  test.describe(`GS-03: el LKP fuera del recorte sigue visible y alcanzable (${
    conPmtiles ? "con" : "sin"
  } PMTiles)`, () => {
    test.skip(conPmtiles && !hayPmtiles, "no hay public/mapas/santa_fe.pmtiles");

    for (const mision of MISIONES) {
      test(`${mision}`, async ({ page }) => {
        if (!conPmtiles) await sinPmtiles(page);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`${DEV}/${mision}/?sin_cliente`);
        await irAlMapa(page);
        // Primero, un vuelo normal: el área es la del recorte.
        await dibujado(page, () => alimentar(page, snapshotDe(mision, "nominal", 70_000)));
        const normal = await leerMapa(page);

        // Se pierde la señal y el último punto conocido cae a decenas de km del recorte.
        const lejos = conLkpLejano(mision);
        expect(dentroDe(normal.limites, lejos.lon, lejos.lat)).toBe(false);
        await dibujado(page, () => alimentar(page, lejos.snap));
        const e = await leerMapa(page);
        // Los límites se ampliaron para incluirlo (y siguen incluyendo lo de antes).
        expect(dentroDe(e.limites, lejos.lon, lejos.lat)).toBe(true);
        expect(e.limites[0]).toBeLessThanOrEqual(normal.limites[0]);
        expect(e.limites[3]).toBeGreaterThanOrEqual(normal.limites[3]);
        expect(e.zoomMin).toBeLessThan(normal.zoomMin); // hay que poder alejar hasta verlo
        expectDentro(e);

        // "Ver todo": el LKP queda a la vista, dentro del marco del mapa.
        await dibujado(page, () => page.getByRole("button", { name: "Ver todo" }).click());
        const lkp = page.locator(".mapa-lkp");
        await expect(lkp).toBeVisible();
        const caja = await page.locator(".mapa-lienzo").boundingBox();
        // El pin mismo (no su texto, que va encima y puede asomar por el borde si el LKP es el
        // punto más al norte: relleno de "Ver todo", anterior a T-634).
        const pin = await lkp.locator(".lkp-pin").boundingBox();
        if (!caja || !pin) throw new Error("sin cajas");
        expect(pin.x).toBeGreaterThanOrEqual(caja.x);
        expect(pin.y).toBeGreaterThanOrEqual(caja.y);
        expect(pin.x + pin.width).toBeLessThanOrEqual(caja.x + caja.width);
        expect(pin.y + pin.height).toBeLessThanOrEqual(caja.y + caja.height);
        expectDentro(await leerMapa(page));
        if (mision === "demeter") {
          await page.locator("#mapa").screenshot({
            path: `${CAPTURAS}/demeter-lkp-fuera-del-recorte-${conPmtiles ? "pmtiles" : "sin-base"}-1440x900.png`,
          });
        }

        // Arrastrar muy lejos, hacia donde quedó el recorte, y volver al cohete: se llega al LKP.
        await arrastrarLejos(page, -4000, 4000);
        expectDentro(await leerMapa(page));
        await dibujado(page, () =>
          page.getByRole("button", { name: "Centrar en el cohete" }).click(),
        );
        await expect(lkp).toBeVisible();
        const centrado = await leerMapa(page);
        expectDentro(centrado);
        // El LKP está dentro de la vista.
        expect(dentroDe(centrado.vista, lejos.lon, lejos.lat)).toBe(true);

        // Alejar al máximo: el LKP sigue adentro de la vista (el área lo incluye).
        await ruedaConCtrl(page, 800, 12);
        const alejado = await leerMapa(page);
        expectDentro(alejado);
        expect(dentroDe(alejado.vista, lejos.lon, lejos.lat)).toBe(true);
      });
    }
  });
}

test.describe("el cohete y la trayectoria reales, con el área por defecto", () => {
  for (const mision of MISIONES) {
    test(`${mision}: lo que se dibuja en un vuelo nominal queda dentro del área`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${DEV}/${mision}/?sin_cliente`);
      await irAlMapa(page);
      await dibujado(page, () => alimentar(page, snapshotDe(mision, "nominal", 70_000)));
      await expect(page.locator(".mapa-cohete")).toBeVisible();
      await dibujado(page, () => page.getByRole("button", { name: "Ver todo" }).click());
      const e = await leerMapa(page);
      expectDentro(e);
      // Rampa, estación, cohete y elipse están dentro de la vista tras "Ver todo".
      for (const clase of [".mapa-rampa", ".mapa-estacion", ".mapa-cohete"]) {
        await expect(page.locator(clase)).toBeVisible();
      }
    });
  }
});

test.describe("capturas: alejado al máximo y arrastrado al borde (con PMTiles)", () => {
  test.skip(!hayPmtiles, "no hay public/mapas/santa_fe.pmtiles");
  for (const mision of MISIONES) {
    for (const med of MEDIDAS) {
      test(`${mision} ${med.ancho}x${med.alto}`, async ({ page }) => {
        await page.setViewportSize({ width: med.ancho, height: med.alto });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`${DEV}/${mision}/?sin_cliente`);
        await irAlMapa(page);
        await dibujado(page, () => alimentar(page, snapshotDe(mision, "nominal", 70_000)));
        await ruedaConCtrl(page, 800, 12);
        await arrastrarLejos(page, 4000, 4000);
        expectDentro(await leerMapa(page));
        await page.locator("#mapa").screenshot({
          path: `${CAPTURAS}/${mision}-alejado-al-borde-${med.ancho}x${med.alto}.png`,
        });
        // Y lo contrario: lo más cerca que deja el archivo.
        await ruedaConCtrl(page, -800, 40);
        await page.locator("#mapa").screenshot({
          path: `${CAPTURAS}/${mision}-acercado-al-maximo-${med.ancho}x${med.alto}.png`,
        });
      });
    }
  }
});
