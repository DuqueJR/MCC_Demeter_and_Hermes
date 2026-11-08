import { expect, type Page, test } from "@playwright/test";
import { apiColgada, esperarPintado } from "./api_colgada";
import {
  hayDist,
  hayPmtilesEnDist,
  type ServidorDePrueba,
  servirDistSinRange,
} from "./servidor_sin_range";

// T-638: el mapa base (PMTiles) debe cargar aunque el hosting ignore `Range`. Cloudflare Pages
// responde 200 con el archivo entero: la fuente por defecto de `pmtiles` lo rechazaba y el mapa
// caía a la cuadrícula. Aquí el `dist/` se sirve con un servidor de pruebas que ignora `Range`
// (e2e/servidor_sin_range.ts) y, además, con el servidor normal de `vite preview` (que sí lo
// atiende): el mapa base debe aparecer en los dos. Como `mapa.spec.ts`, se salta sin el PMTiles
// (public/mapas/santa_fe.pmtiles no se versiona).

test.skip(
  !hayDist() || !hayPmtilesEnDist(),
  "no hay dist/ con mapas/santa_fe.pmtiles (npm run build)",
);

const MISIONES = ["demeter", "hermes"] as const;

// T-673: el mapa arranca en 3D cuando hay relieve. Estas pruebas son del mapa en 2D (capas, LKP, controles,
// gestos y capturas del plano), así que, como `mapa_limites.spec.ts`, bloquean los archivos del relieve:
// sin ellos el mapa es el de siempre. El 3D se prueba en `mapa_3d.spec.ts` y `mapa_relieve.spec.ts`.
test.beforeEach(async ({ page }) => {
  await page.route("**/mapas/relieve/**", (ruta) => ruta.abort());
});

const CAPAS_BASE = 7; // base-tierra, uso, agua, rios, vias-menores, vias y lugares (estilo.ts)

/** Errores de consola, salvo el 404 esperado del PMTiles cuando se finge que no está. */
function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.includes(".pmtiles")) errores.push(m.text());
  });
  return errores;
}

async function abrirMapa(page: Page, url: string) {
  await apiColgada(page);
  await page.goto(url);
  await esperarPintado(page);
  await page.locator("#mapa").scrollIntoViewIfNeeded();
  await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-listo", "1");
}

/** El mapa base está puesto: capas `base-*` en el estilo y elementos de ellas ya dibujados. */
async function esperarMapaBase(page: Page) {
  const lienzo = page.locator(".mapa-lienzo");
  await expect(lienzo).toHaveAttribute("data-mapa-base", "vectorial");
  await expect(lienzo).toHaveAttribute("data-mapa-capas-base", String(CAPAS_BASE));
  // Las teselas se leyeron del PMTiles y se decodificaron: hay elementos `base-*` dibujados.
  await expect
    .poll(async () => Number(await lienzo.getAttribute("data-mapa-base-dibujada")), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");
}

test.describe("hosting que ignora Range (Cloudflare Pages)", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  let servidor: ServidorDePrueba;
  test.beforeAll(async () => {
    servidor = await servirDistSinRange();
  });
  test.afterAll(async () => {
    await servidor.cerrar();
  });
  test.beforeEach(() => {
    servidor.pedidos.length = 0;
  });

  for (const mision of MISIONES) {
    test(`${mision}: muestra el mapa base y no la cuadrícula de respaldo`, async ({ page }) => {
      const errores = vigilarErrores(page);
      await abrirMapa(page, `${servidor.url}/${mision}/`);
      await esperarMapaBase(page);
      // El archivo se bajó entero, una sola vez y con un GET simple (sin `Range`).
      const delMapa = servidor.pedidos.filter((p) => p.ruta.endsWith(".pmtiles"));
      expect(delMapa).toEqual([{ ruta: "/mapas/santa_fe.pmtiles", rango: null }]);
      expect(errores).toEqual([]);
    });
  }

  test("el archivo no se descarga hasta llegar a la sección del mapa (carga diferida)", async ({
    page,
  }) => {
    await apiColgada(page);
    await page.goto(`${servidor.url}/demeter/`);
    await esperarPintado(page);
    await expect(page.locator(".mapa-marco")).toHaveAttribute("data-mapa-fase", "esperando");
    expect(servidor.pedidos.filter((p) => p.ruta.endsWith(".pmtiles"))).toEqual([]);
    await page.locator("#mapa").scrollIntoViewIfNeeded();
    await expect(page.locator(".mapa-lienzo")).toHaveAttribute("data-mapa-base", "vectorial");
    expect(servidor.pedidos.filter((p) => p.ruta.endsWith(".pmtiles"))).toHaveLength(1);
  });
});

test.describe("hosting que ignora Range y no tiene el PMTiles", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [nombre, fallbackHtml] of [
    ["responde 404", false],
    ["responde index.html con 200", true],
  ] as const) {
    test(`${nombre}: el mapa usa la cuadrícula de respaldo, sin error`, async ({ page }) => {
      const servidor = await servirDistSinRange({ sinPmtiles: true, fallbackHtml });
      try {
        const errores = vigilarErrores(page);
        await abrirMapa(page, `${servidor.url}/demeter/`);
        const lienzo = page.locator(".mapa-lienzo");
        await expect(lienzo).toHaveAttribute("data-mapa-base", "sin-base");
        await expect(lienzo).toHaveAttribute("data-mapa-capas-base", "0");
        await expect(page.locator(".maplibregl-canvas")).toBeVisible();
        expect(errores).toEqual([]);
      } finally {
        await servidor.cerrar();
      }
    });
  }
});

test.describe("hosting normal (vite preview, sí atiende Range)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const mision of MISIONES) {
    test(`${mision}: también muestra el mapa base`, async ({ page, baseURL }) => {
      const errores = vigilarErrores(page);
      await abrirMapa(page, `${baseURL}/${mision}/`);
      await esperarMapaBase(page);
      expect(errores).toEqual([]);
    });
  }
});
