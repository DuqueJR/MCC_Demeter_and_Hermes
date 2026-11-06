import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { crearRepetidor, type Repetidor } from "../dev/repetidor/servidor";
import { estacionEjemplo, estadoEjemplo, metaEjemplo } from "../src/contrato/ejemplos";
import type { LineaJsonl, Mision } from "../src/contrato/tipos";

// T-635: la simulación para el público, en un navegador de verdad.
//   - En el servidor de desarrollo (:5174), con `?ejemplo=sin_transmision` (sin cliente de datos): el
//     botón aparece en Deméter y NO en Hermes; al pulsarlo salen el banner, SIM y "Salir"; el reloj del
//     navegador se adelanta para ver el vuelo; "Salir" devuelve el estado "Sin transmisión".
//   - Contra el dist/ (:4173) y un relay de verdad (el repetidor, con un JSONL propio: un relay que
//     solo manda latidos vacíos y, a los 8 s, el primer dato real): el guion NO se pide al cargar, se
//     pide al pulsar, y el primer dato real corta la simulación y vuelve lo real.
//     El repetidor va en :8791 (el :8787 es de en_vivo.spec.ts) y la prueba redirige `/api/**` hacia él.
// Las capturas van a docs/07_bitacora/capturas/T-635.
const DEV = "http://localhost:5174";
const PUERTO_RELAY = 8791;
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-635");
mkdirSync(CAPTURAS, { recursive: true });

const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;

const BOTON = "Ver la simulación del vuelo";
const TEXTO_BANNER = "Simulación: así será el vuelo";
const MS = 1000;
/** Instante (s del guion) del despegue del escenario `nominal`: ver su JSONL. */
const T_DESPEGUE_S = 18;

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(m.text());
  });
  return errores;
}

const botonVer = (page: Page) => page.getByRole("button", { name: BOTON });
const botonSalir = (page: Page) => page.getByRole("button", { name: "Salir de la simulación" });
const banner = (page: Page) => page.locator(".banner-info");
const sinDesborde = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe("desarrollo (?ejemplo=sin_transmision)", () => {
  for (const m of MEDIDAS) {
    test(`Deméter ${m.ancho}x${m.alto}: botón, simulación, banner fijo, SIM y salir`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: m.ancho, height: m.alto });
      await page.clock.install();
      const errores = vigilarErrores(page);
      await page.goto(`${DEV}/demeter/?ejemplo=sin_transmision`);

      // Antes de pulsar: "Sin transmisión todavía", con el botón; sin banner ni SIM.
      await expect(page.locator(".estado-aviso")).toContainText("La transmisión en vivo empieza");
      await expect(botonVer(page)).toBeVisible();
      await expect(banner(page)).toHaveCount(0);
      await expect(page.locator(".marca-sim")).toHaveCount(0);
      await botonVer(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(CAPTURAS, `sin-transmision-boton-${m.ancho}.png`) });

      await botonVer(page).click();
      await expect(banner(page)).toContainText(TEXTO_BANNER);
      await expect(page.locator(".marca-sim")).toHaveText("SIM");
      await expect(botonSalir(page)).toBeVisible();
      await expect(page.locator(".barra-fase")).toContainText("En la rampa");
      // Ya no se ofrece la simulación: ahora hay una corriendo.
      await expect(botonVer(page)).toHaveCount(0);

      // Se adelanta el reloj del navegador hasta después del despegue: unos segundos corriendo (el
      // reproductor avanza con su temporizador) y luego un salto (aplica de una vez lo vencido).
      await page.clock.runFor(2 * MS);
      await page.clock.fastForward((T_DESPEGUE_S + 6) * MS);
      await expect(page.locator(".barra-fase")).toContainText("Subiendo por inercia");
      await expect(page.locator(".barra-t")).toContainText("T+");
      await expect(page.locator(".barra-alt .num")).not.toHaveText("0");
      // El banner y SIM siguen fijos (la cabecera es `sticky`) aunque se baje por la página.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(banner(page)).toBeInViewport();
      await expect(page.locator(".marca-sim")).toBeInViewport();
      expect(await sinDesborde(page)).toBe(true);
      await page.screenshot({ path: join(CAPTURAS, `simulacion-vuelo-${m.ancho}.png`) });

      // Hasta el aterrizaje: se queda en tierra, sigue siendo simulación y no pasa a "Sin señal".
      await page.clock.fastForward(120 * MS);
      await page.clock.runFor(2 * MS);
      await expect(page.locator(".barra-fase")).toContainText("En tierra");
      await expect(page.locator(".indicador")).toContainText("EN VIVO");
      await expect(banner(page)).toContainText(TEXTO_BANNER);
      await page.screenshot({ path: join(CAPTURAS, `simulacion-aterrizada-${m.ancho}.png`) });

      // Salir: vuelve "Sin transmisión todavía", sin rastros de la simulación.
      await page.evaluate(() => window.scrollTo(0, 0));
      await botonSalir(page).click();
      await expect(banner(page)).toHaveCount(0);
      await expect(page.locator(".marca-sim")).toHaveCount(0);
      await expect(page.locator(".estado-aviso")).toContainText("La transmisión en vivo empieza");
      await expect(botonVer(page)).toBeVisible();
      expect(errores).toEqual([]);
    });
  }

  test("Hermes no tiene simulación (PEN-07): el botón no aparece", async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto(`${DEV}/hermes/?ejemplo=sin_transmision`);
    await expect(page.locator(".estado-aviso")).toContainText("La transmisión en vivo empieza");
    await expect(botonVer(page)).toHaveCount(0);
    await expect(page.getByText("simulación", { exact: false })).toHaveCount(0);
    expect(errores).toEqual([]);
  });
});

// ---- Contra el dist/ y un relay (el repetidor) ----
const NODO: Record<Mision, 1 | 2> = { demeter: 1, hermes: 2 };

/** Un relay recién arrancado: latidos sin paquetes del cohete y, a los 8 s, el primer dato real. */
function jsonlDeRelay(mision: Mision): string {
  const meta = { ...metaEjemplo, mision, nodo: NODO[mision], modo: "vivo", mission_id: null };
  const lineas: LineaJsonl[] = [{ t_rel_ms: 0, evento: "meta", datos: meta as never }];
  for (let s = 0; s <= 60; s++) {
    const real = s >= 8;
    lineas.push({
      t_rel_ms: s * MS,
      evento: "estacion",
      datos: {
        ...estacionEjemplo,
        utc_ms: estacionEjemplo.utc_ms + s * MS,
        ultimo_paquete_hace_ms: real ? 40 : null,
      },
    });
    if (real) {
      lineas.push({
        t_rel_ms: s * MS + 10,
        evento: "estado",
        datos: { ...estadoEjemplo, t_ms: estadoEjemplo.t_ms + s * MS, seq: s },
      });
    }
  }
  return `${lineas.map((l) => JSON.stringify(l)).join("\n")}\n`;
}

test.describe("contra el dist/ y un relay", () => {
  test.describe.configure({ mode: "serial" });
  let carpeta: string;
  let relay: Repetidor | undefined;

  test.beforeAll(() => {
    carpeta = mkdtempSync(join(tmpdir(), "relay-sim-"));
    for (const m of ["demeter", "hermes"] as const) {
      writeFileSync(join(carpeta, `${m}.jsonl`), jsonlDeRelay(m));
    }
  });
  test.afterAll(() => rmSync(carpeta, { recursive: true, force: true }));
  test.beforeEach(async ({ page }) => {
    relay = crearRepetidor({
      archivos: {
        demeter: { escenario: "sin_transmision", ruta: join(carpeta, "demeter.jsonl") },
        hermes: { escenario: "sin_transmision", ruta: join(carpeta, "hermes.jsonl") },
      },
    });
    await relay.escuchar(PUERTO_RELAY, "127.0.0.1");
    await page.route("**/api/**", (ruta) =>
      ruta.continue({
        url: ruta
          .request()
          .url()
          .replace(/^https?:\/\/[^/]+/, `http://127.0.0.1:${PUERTO_RELAY}`),
      }),
    );
  });
  test.afterEach(async () => {
    await relay?.cerrar();
    relay = undefined;
  });

  test("el guion no se pide al cargar; se pide al pulsar; el primer dato real corta la simulación", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errores = vigilarErrores(page);
    const pedidos: string[] = [];
    page.on("request", (r) => pedidos.push(r.url()));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demeter/");

    await expect(botonVer(page)).toBeVisible();
    await expect(page.locator(".indicador")).toContainText("Sin transmisión");
    expect(pedidos.filter((u) => u.includes("simulacion_nominal"))).toEqual([]);

    const pedidoGuion = page.waitForRequest((r) => r.url().includes("simulacion_nominal"));
    await botonVer(page).click();
    await pedidoGuion;
    await expect(banner(page)).toContainText(TEXTO_BANNER);
    await expect(page.locator(".marca-sim")).toHaveText("SIM");
    await expect(page.locator(".barra-fase")).toContainText("En la rampa");
    await page.screenshot({ path: join(CAPTURAS, "dist-simulacion-390.png") });

    // El relay manda su primer dato real (a los 8 s): la simulación se corta y vuelve lo real.
    await expect(banner(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator(".marca-sim")).toHaveCount(0);
    await expect(botonSalir(page)).toHaveCount(0);
    await expect(page.locator(".barra-fase")).toContainText("Bajando con paracaídas");
    await expect(page.locator(".indicador")).toContainText("EN VIVO");
    await page.screenshot({ path: join(CAPTURAS, "dist-dato-real-390.png") });
    expect(errores).toEqual([]);
  });

  test("salir con el botón vuelve al estado en vivo del relay", async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto("/demeter/");
    await botonVer(page).click();
    await expect(banner(page)).toContainText(TEXTO_BANNER);
    await botonSalir(page).click();
    await expect(banner(page)).toHaveCount(0);
    await expect(page.locator(".indicador")).toContainText("Sin transmisión");
    await expect(botonVer(page)).toBeVisible();
    expect(errores).toEqual([]);
  });

  test("Hermes, sin transmisión, no ofrece simulación y no pide el guion", async ({ page }) => {
    const pedidos: string[] = [];
    page.on("request", (r) => pedidos.push(r.url()));
    await page.goto("/hermes/");
    await expect(page.locator(".indicador")).toContainText("Sin transmisión");
    await expect(page.locator(".estado-aviso")).toContainText("La transmisión en vivo empieza");
    await expect(botonVer(page)).toHaveCount(0);
    expect(pedidos.filter((u) => u.includes("simulacion"))).toEqual([]);
  });
});
