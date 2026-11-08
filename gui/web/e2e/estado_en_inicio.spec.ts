import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { alimentar, DEV, snapshotDe } from "./mapa_ayudas";

// T-674: el estado de la misión (fase, T+ y la tira de objetivos) va en la parte de arriba, dentro de
// Inicio; la telemetría, superpuesta al mapa; y al aterrizar aparece el Resumen del vuelo bajo
// Recuperación. Se prueba en el servidor de desarrollo (:5174) con `?sin_cliente`, inyectando snapshots
// de los escenarios de dev/datos. Las capturas del PR van a docs/08_gui/capturas/T-674.
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/08_gui/capturas/T-674");
mkdirSync(CAPTURAS, { recursive: true });

const MISIONES = ["demeter", "hermes"] as const;
type Mision = (typeof MISIONES)[number];
/** Escenario nominal: con el paracaídas abierto (apogeo hecho; faltan el aterrizaje y, en Deméter, nada más). */
const T_DESCENSO_MS = 40_000;
/** Cuánto se espera a que se dibuje el mapa (WebGL por software en Chromium sin GPU). */
const TIEMPO_MAPA_MS = 60_000;
/** Alto de la cabecera fija de la página de misión (barra, banner y navegación), para las capturas. */
const ALTO_CABECERA_PX = 130;

// El mapa con relieve en 3D tarda en dibujar sin GPU: un margen amplio para cada prueba.
test.describe.configure({ timeout: 150_000 });

const sinDesborde = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** Errores de consola, salvo los de red del PMTiles opcional y de los archivos del relieve. */
function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    const url = m.location().url;
    if (m.type() === "error" && !url.includes(".pmtiles") && !url.includes("/mapas/relieve/")) {
      errores.push(m.text());
    }
  });
  return errores;
}

async function abrir(page: Page, mision: Mision, hastaMs?: number) {
  await page.goto(`${DEV}/${mision}/?sin_cliente`);
  await alimentar(page, snapshotDe(mision, "nominal", hastaMs));
}

const caja = async (page: Page, selector: string) => {
  const c = await page.locator(selector).boundingBox();
  if (!c) throw new Error(`sin caja: ${selector}`);
  return c;
};

/** Espera a que el mapa esté listo y a que termine el primer dibujo. */
async function esperarMapa(page: Page) {
  await page.locator("#mapa").scrollIntoViewIfNeeded();
  await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-listo", "1", {
    timeout: TIEMPO_MAPA_MS,
  });
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Number(document.querySelector<HTMLElement>(".mapa-lienzo")?.dataset.mapaReposos ?? 0),
        ),
      { timeout: TIEMPO_MAPA_MS },
    )
    .toBeGreaterThan(0);
}

/** Desplaza la página hasta que el mapa queda justo bajo la cabecera fija. */
const verMapa = (page: Page) =>
  page.evaluate((cabecera) => {
    const r = document.querySelector("#mapa")?.getBoundingClientRect();
    if (r) window.scrollBy(0, r.top - cabecera);
  }, ALTO_CABECERA_PX);

/** Oculta la cabecera fija y la navegación inferior: no deben tapar una captura de un elemento. */
const ocultarFijos = (page: Page) =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(".cabecera-mision, .navegacion")) {
      el.style.visibility = "hidden";
    }
  });

/** Captura la página desde arriba hasta el borde inferior del Resumen del vuelo. */
async function capturarHastaResumen(page: Page, ruta: string) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    // La navegación inferior del celular es fija: en una captura larga quedaría a media página.
    const nav = document.querySelector<HTMLElement>(".navegacion");
    if (nav && getComputedStyle(nav).position === "fixed") nav.style.visibility = "hidden";
  });
  // El desplazamiento es suave (html { scroll-behavior: smooth }): hay que esperar a llegar arriba.
  await page.waitForFunction(() => window.scrollY === 0);
  const resumen = await caja(page, "#resumen");
  await page.screenshot({
    path: ruta,
    fullPage: true,
    clip: {
      x: 0,
      y: 0,
      width: page.viewportSize()?.width ?? 0,
      height: Math.ceil(resumen.y + resumen.height + 16),
    },
  });
}

const solapan = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const mision of MISIONES) {
  test.describe(`${mision}: el estado arriba y la telemetría en el mapa`, () => {
    test.describe("portátil 1440x900, en vuelo", () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test("el estado llena el hueco de Inicio y el mapa ocupa el lugar del Estado y la Telemetría", async ({
        page,
      }) => {
        const errores = vigilarErrores(page);
        await abrir(page, mision, T_DESCENSO_MS);

        // El estado vive dentro de Inicio, junto al texto, y conserva su ancla.
        const estado = page.locator("#inicio #estado");
        await expect(estado).toHaveCount(1);
        await expect(estado.locator(".estado-fase-titulo")).toHaveText("Bajando con paracaídas");
        await expect(estado.locator(".estado-t-valor")).toHaveText(/^T\+ \d\d:\d\d$/);
        const chips = estado.locator("[data-objetivo]");
        await expect(chips).toHaveCount(mision === "demeter" ? 6 : 5);
        await expect(estado.locator("[data-objetivo][data-encendido='si']")).not.toHaveCount(0);
        await expect(estado.locator("[data-objetivo='aterrizaje']")).toHaveAttribute(
          "data-encendido",
          "no",
        );
        // Cada objetivo dice con palabras si está logrado o pendiente (no solo con color).
        await expect(estado.locator("[data-objetivo='apogeo'] .solo-lector")).toHaveText("logrado");
        await expect(estado.locator("[data-objetivo='aterrizaje'] .solo-lector")).toHaveText(
          "pendiente",
        );

        // La sección grande de Estado y la de Telemetría ya no están en el flujo.
        const ids = await page
          .locator("main.panel > section")
          .evaluateAll((s) => s.map((e) => e.id));
        expect(ids.slice(0, 2)).toEqual(["inicio", "mapa"]);
        expect(ids).not.toContain("estado");
        expect(ids).not.toContain("telemetria");
        await expect(page.locator("#resumen")).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Resumen" })).toHaveCount(0);

        // El mapa queda justo bajo Inicio, más ancho que antes (2 de 4 partes) y casi tan alto como la ventana.
        const inicio = await caja(page, "#inicio");
        const mapa = await caja(page, "#mapa");
        const panel = await caja(page, "main.panel");
        expect(mapa.y).toBeGreaterThanOrEqual(inicio.y + inicio.height - 1);
        expect(mapa.width).toBeGreaterThan(panel.width * 0.6);
        expect(mapa.height).toBeGreaterThan(560);
        // Recuperación y Salud siguen a su derecha, sin pisarlo.
        const salud = await caja(page, "#salud");
        expect(mapa.x + mapa.width).toBeLessThanOrEqual(salud.x + 1);

        expect(await sinDesborde(page)).toBe(true);
        expect(errores).toEqual([]);
        await page.screenshot({
          path: `${CAPTURAS}/${mision}-portatil-vuelo-arriba.png`,
        });
        await esperarMapa(page);
        await verMapa(page);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `${CAPTURAS}/${mision}-portatil-vuelo-mapa.png`,
        });
      });

      test("la telemetría va dentro del marco del mapa, sin tapar sus controles", async ({
        page,
      }) => {
        const errores = vigilarErrores(page);
        await abrir(page, mision, T_DESCENSO_MS);
        await esperarMapa(page);

        const marco = await caja(page, ".mapa-marco");
        const tel = await caja(page, "#telemetria");
        expect(tel.x).toBeGreaterThanOrEqual(marco.x);
        expect(tel.y).toBeGreaterThanOrEqual(marco.y);
        expect(tel.x + tel.width).toBeLessThanOrEqual(marco.x + marco.width + 1);
        expect(tel.y + tel.height).toBeLessThanOrEqual(marco.y + marco.height + 1);
        // Los mismos datos que la sección vieja.
        for (const c of ["altitud", "vertical", "total", "apogeo", "aceleracion"])
          await expect(page.locator(`#telemetria [data-celda='${c}']`)).toBeVisible();
        await expect(page.locator("#telemetria [data-celda='apogeo'] .num")).toHaveText(
          mision === "demeter" ? "669" : "502",
        );

        // No tapa los controles: zoom, botones propios, coordenadas, escala ni atribución.
        for (const otro of [
          ".maplibregl-ctrl-top-left",
          ".mapa-controles",
          ".mapa-coordenadas",
          ".maplibregl-ctrl-scale",
          ".maplibregl-ctrl-attrib",
        ]) {
          const c = await page.locator(otro).first().boundingBox();
          if (c) expect(solapan(tel, c), `${otro} bajo la telemetría`).toBe(false);
        }

        expect(await sinDesborde(page)).toBe(true);
        expect(errores).toEqual([]);
      });

      test("en pantalla completa la telemetría se ve", async ({ page }) => {
        const errores = vigilarErrores(page);
        await abrir(page, mision, T_DESCENSO_MS);
        await esperarMapa(page);
        await page.getByRole("button", { name: "Pantalla completa" }).click();
        await expect(page.locator("#mapa")).toHaveClass(/completa/);
        await expect(page.locator("#telemetria")).toBeInViewport();
        const ventana = page.viewportSize();
        const marco = await caja(page, ".mapa-marco");
        // La sección a pantalla completa tiene su relleno: el marco casi llena la ventana.
        expect(marco.width).toBeGreaterThanOrEqual((ventana?.width ?? 0) - 48);
        const tel = await caja(page, "#telemetria");
        expect(tel.y + tel.height).toBeLessThanOrEqual((ventana?.height ?? 0) + 1);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `${CAPTURAS}/${mision}-portatil-mapa-pantalla-completa.png`,
        });
        await page.getByRole("button", { name: "Salir de pantalla completa" }).click();
        expect(errores).toEqual([]);
      });
    });

    test.describe("celular 390x844, en vuelo", () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test("el estado cabe sin desborde, los objetivos se envuelven y la telemetría queda sobre el mapa", async ({
        page,
      }) => {
        const errores = vigilarErrores(page);
        await abrir(page, mision, T_DESCENSO_MS);
        await expect(page.locator("#estado [data-objetivo]")).toHaveCount(
          mision === "demeter" ? 6 : 5,
        );
        expect(await sinDesborde(page)).toBe(true);
        // La tira no se sale del ancho de la pantalla.
        const tira = await caja(page, ".objetivos-banner");
        expect(tira.x + tira.width).toBeLessThanOrEqual(391);
        // La captura deja la tira de objetivos a la vista, sobre la navegación inferior.
        await page.evaluate(() => {
          const r = document.querySelector("#estado")?.getBoundingClientRect();
          if (r) window.scrollBy(0, r.bottom - (window.innerHeight - 90));
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${CAPTURAS}/${mision}-celular-vuelo-estado.png` });

        await esperarMapa(page);
        const marco = await caja(page, ".mapa-marco");
        const tel = await caja(page, "#telemetria");
        expect(tel.y).toBeGreaterThanOrEqual(marco.y);
        expect(tel.y + tel.height).toBeLessThanOrEqual(marco.y + marco.height + 1);
        expect(tel.width).toBeGreaterThan(marco.width * 0.9);
        // La franja no se come más de la mitad del mapa.
        expect(tel.height).toBeLessThan(marco.height / 2);
        await verMapa(page);
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${CAPTURAS}/${mision}-celular-vuelo-mapa.png` });
        expect(await sinDesborde(page)).toBe(true);
        expect(errores).toEqual([]);
      });
    });

    test.describe("aterrizado", () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test("Recuperación y, debajo, el Resumen del vuelo con todo", async ({ page }) => {
        const errores = vigilarErrores(page);
        await abrir(page, mision);
        await expect(page.locator("main.panel")).toHaveAttribute("data-aterrizado", "si");
        const ids = await page
          .locator("main.panel > section")
          .evaluateAll((s) => s.map((e) => e.id));
        expect(ids.slice(0, 3)).toEqual(["recuperacion", "resumen", "inicio"]);

        const resumen = page.locator("section#resumen");
        await expect(resumen.getByRole("heading", { name: "Resumen del vuelo" })).toBeVisible();
        await expect(resumen.locator(".paso")).toHaveCount(6);
        await expect(resumen.locator(".objetivo")).toHaveCount(mision === "demeter" ? 6 : 5);
        await expect(resumen.locator("[data-celda]")).toHaveCount(5);
        await expect(resumen.locator("[data-objetivo='apogeo'] .objetivo-dato")).toContainText(
          mision === "demeter" ? "669" : "502",
        );
        // "Resumen" aparece en la navegación y lleva a la sección.
        const nav = page.getByRole("navigation", { name: "Secciones de la página" });
        await nav.getByRole("link", { name: "Resumen" }).click();
        await expect(page).toHaveURL(/#resumen$/);
        await expect(page.locator("#resumen")).toBeInViewport();

        expect(await sinDesborde(page)).toBe(true);
        expect(errores).toEqual([]);
        // Las capturas van desde arriba hasta el final del Resumen: Recuperación y, debajo, el Resumen.
        await capturarHastaResumen(page, `${CAPTURAS}/${mision}-portatil-aterrizado.png`);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(500);
        await capturarHastaResumen(page, `${CAPTURAS}/${mision}-celular-aterrizado.png`);
        expect(await sinDesborde(page)).toBe(true);
      });
    });
  });
}

/**
 * Escenario nominal justo después del fin de la combustión: la banda de X de los últimos 10 s abarca el
 * empuje de ~10 g, el cohete va a 85° de cabeceo (se ve inclinado) y todavía sube a ~100 m/s.
 */
const T_ASCENSO_MS = 20_300;

test.describe("actitud y fuerzas g en 'Desde la estación' (ajuste de T-674)", () => {
  const g = (page: Page) => page.locator("#recuperacion .fuerzas-g");
  const actitud = (page: Page) => page.locator("#recuperacion .actitud-estacion");

  test("portátil: la rosa con el cohete y los dos medidores de fuerzas g", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errores = vigilarErrores(page);
    await page.goto(`${DEV}/demeter/?sin_cliente`);
    // Sin datos: "sin dato" en las dos y ningún cohete dibujado.
    await expect(g(page)).toContainText("sin dato");
    await expect(actitud(page)).toContainText("sin dato");
    await expect(page.locator("[data-cohete]")).toHaveCount(0);

    await alimentar(page, snapshotDe("demeter", "nominal", T_ASCENSO_MS));
    // Fuerzas g: el total en texto, el radar con su estela, la banda del eje X y los dos rótulos.
    await expect(g(page).locator("[data-g='total'] .g-num")).toHaveText(/^\d,\d\d$/);
    await expect(g(page).locator("[data-g-svg]")).toContainText("Sección (Y, Z):");
    await expect(g(page).locator("[data-g-svg]")).toContainText("Eje X (nariz):");
    await expect(g(page).locator("[data-g-svg]")).toContainText("1 g: quieto,");
    await expect(g(page).locator("[data-g-svg]")).toContainText("ejes del chip, sin calibrar");
    await expect(g(page).locator("[data-g-estela]")).toHaveCount(1);
    await expect(g(page).locator("[data-g-banda]")).toHaveCount(1);
    await expect(g(page).locator("[data-g-svg]")).toHaveAttribute("role", "img");
    // El punto del radar está dentro del círculo y el de X, dentro de la barra.
    const aro = await caja(page, "#recuperacion .g-aro");
    const punto = await caja(page, "[data-g-punto='radar']");
    expect(punto.x).toBeGreaterThanOrEqual(aro.x);
    expect(punto.x + punto.width).toBeLessThanOrEqual(aro.x + aro.width + 1);
    const barra = await caja(page, "#recuperacion .g-barra");
    const puntoX = await caja(page, "[data-g-punto='x']");
    expect(puntoX.y + puntoX.height / 2).toBeGreaterThanOrEqual(barra.y - 1);
    expect(puntoX.y + puntoX.height / 2).toBeLessThanOrEqual(barra.y + barra.height + 1);

    // Actitud: el cohete (con su marca y su costado), la flecha de velocidad y los tres ángulos en texto.
    await expect(actitud(page)).toHaveAttribute("data-vista", "vivo");
    await expect(actitud(page).locator("[data-cohete] .tr-marca")).toHaveCount(1);
    await expect(actitud(page).locator("[data-cohete] .tr-costado")).toHaveCount(1);
    await expect(actitud(page).locator("[data-cohete] .aleta-marca")).toHaveCount(1);
    await expect(actitud(page).locator("[data-velocidad]")).toHaveCount(1);
    await expect(actitud(page).locator("[data-angulo='cabeceo']")).toHaveText(/^8\d,\d°$/);
    await expect(actitud(page).locator("[data-angulo='guinada']")).toHaveText(/^\d+,\d°$/);
    await expect(actitud(page).locator("[data-rosa-svg]")).toHaveAttribute("role", "img");
    // La rosa y el radar cuelgan de la columna: sin desborde.
    expect(await sinDesborde(page)).toBe(true);
    expect(errores).toEqual([]);

    // Sin orientación del EKF: la rosa queda, el cohete no.
    const sinEkf = snapshotDe("demeter", "nominal", T_ASCENSO_MS);
    if (!sinEkf.estado) throw new Error("el escenario no trae estado");
    sinEkf.estado = { ...sinEkf.estado, flags: { ...sinEkf.estado.flags, ekf_ok: false } };
    await alimentar(page, sinEkf);
    await expect(actitud(page)).toHaveAttribute("data-vista", "no-disponible");
    await expect(actitud(page)).toContainText("Orientación aún no disponible");
    await expect(page.locator("[data-cohete]")).toHaveCount(0);

    // Dato viejo: el mismo gris y la antigüedad que la telemetría, en las dos.
    await alimentar(page, snapshotDe("demeter", "nominal", T_ASCENSO_MS), "conectado", 3000);
    await expect(g(page)).toHaveAttribute("data-viejo", "si");
    await expect(actitud(page)).toHaveAttribute("data-viejo", "si");
    await expect(g(page).locator(".telemetria-edad")).toContainText("Último dato hace 3 s");
    await alimentar(page, snapshotDe("demeter", "nominal", T_ASCENSO_MS));

    // Capturas: "Desde la estación" entero (brújula, actitud y fuerzas g), y solo las fuerzas g.
    await ocultarFijos(page);
    await page.locator("#recuperacion .recup-vector").screenshot({
      path: `${CAPTURAS}/demeter-portatil-estacion-actitud-g.png`,
    });
    await g(page).screenshot({ path: `${CAPTURAS}/demeter-portatil-estacion-g.png` });
  });

  test("celular: cabe sin desborde y se lee", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errores = vigilarErrores(page);
    await abrir(page, "demeter", T_ASCENSO_MS);
    await expect(g(page).locator("[data-g='total'] .g-num")).toHaveText(/^\d,\d\d$/);
    expect(await sinDesborde(page)).toBe(true);
    for (const sel of ["#recuperacion .actitud-estacion", "#recuperacion .fuerzas-g"]) {
      const c = await caja(page, sel);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(391);
    }
    await ocultarFijos(page);
    await page.locator("#recuperacion .estacion-instrumentos").screenshot({
      path: `${CAPTURAS}/demeter-celular-estacion-actitud-g.png`,
    });
    await g(page).screenshot({ path: `${CAPTURAS}/demeter-celular-estacion-g.png` });
    expect(errores).toEqual([]);
  });

  test("fuera del rango del sensor: lo dice con texto", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${DEV}/demeter/?sin_cliente`);
    const snap = snapshotDe("demeter", "nominal", T_ASCENSO_MS);
    if (!snap.estado) throw new Error("el escenario no trae estado");
    snap.estado = { ...snap.estado, acc_g: { x: -40, y: 0, z: 0 } };
    await alimentar(page, snap);
    await expect(g(page)).toHaveAttribute("data-satura", "si");
    await expect(g(page).locator(".g-satura")).toContainText("Fuera del rango del sensor");
    // El punto queda en el borde de la barra (la escala llega a −50 g, no se sale).
    const barra = await caja(page, "#recuperacion .g-barra");
    const puntoX = await caja(page, "[data-g-punto='x']");
    expect(puntoX.y + puntoX.height / 2).toBeLessThanOrEqual(barra.y + barra.height + 1);
  });
});

test("si el mapa no carga, la telemetría sigue visible dentro del marco", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // El módulo diferido del mapa falla: SeccionMapa muestra su aviso y la telemetría se queda.
  await page.route("**/src/mapa/Mapa.tsx*", (ruta) => ruta.abort());
  await page.goto(`${DEV}/demeter/?sin_cliente`);
  await alimentar(page, snapshotDe("demeter", "nominal", T_DESCENSO_MS));
  await page.locator("#mapa").scrollIntoViewIfNeeded();
  await expect(page.getByText("No se pudo cargar el mapa")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".mapa-marco #telemetria")).toBeVisible();
  await expect(page.locator("#telemetria [data-celda='altitud'] .num")).toHaveText(/\d/);
});
