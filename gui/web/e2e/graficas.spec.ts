import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { crearRepetidor, type Repetidor } from "../dev/repetidor/servidor";
import type { Snapshot } from "../src/contrato/tipos";
import { alimentar, DEV, moverReloj, snapshotDe } from "./mapa_ayudas";

// T-633: la sección Gráficas (uPlot). Se prueba de dos maneras, las dos en el servidor de
// desarrollo (:5174):
//  - con un snapshot inyectado en `datos/api.ts` (`?sin_cliente`): estados exactos y deterministas;
//  - con el repetidor de T-630 de verdad (vuelo en vivo, vuelo repetido, solo `despegue`, recarga
//    después del despegue). Cada prueba levanta su repetidor en un puerto libre y desvía `/api` a él
//    con `page.route`, así no choca con `en_vivo.spec.ts` (que usa el 8787 del proxy de Vite).
// Las capturas propias van a docs/07_bitacora/capturas/T-633/ (nombres nuevos).
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-633");
mkdirSync(CAPTURAS, { recursive: true });
const DATOS = resolve(import.meta.dirname, "../dev/datos");

const MISIONES = ["demeter", "hermes"] as const;
type Mision = (typeof MISIONES)[number];
const CELULAR = { width: 390, height: 844 };
const HORIZONTAL = { width: 844, height: 390 };
const PORTATIL = { width: 1440, height: 900 };
const ROJO_ALARMA = "rgb(255, 77, 94)";
const TEXTO_VACIO = "La gráfica empieza con el despegue.";

const irAGraficas = (page: Page) =>
  page
    .locator("#graficas")
    .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));

const lienzo = (page: Page) => page.locator("#graficas .grafica-lienzo");
const puntos = async (page: Page) =>
  Number((await page.locator("#graficas .grafica").getAttribute("data-puntos")) ?? 0);
const marcasDibujadas = async (page: Page) =>
  Number((await lienzo(page).getAttribute("data-marcas-dibujadas")) ?? -1);
const nombresDeMarcas = (page: Page) =>
  page.locator("#graficas .graficas-marcas li").allTextContents();

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(m.text());
  });
  return errores;
}

/** Mitad del vuelo nominal: ya pasaron despegue, fin de combustión, eyección y apogeo. */
const enVuelo = (mision: Mision): Snapshot => snapshotDe(mision, "nominal", 70_000);

/** El snapshot tal como lo deja el cliente de T-631: los puntos de antes del despegue con T+ nulo. */
function comoElCliente(s: Snapshot): Snapshot {
  return {
    ...s,
    serie: { ...s.serie, t_mas_s: s.serie.t_mas_s.map((t) => (t !== null && t < 0 ? null : t)) },
  };
}

// ------------------------------------------------------------------ datos inyectados

test.describe("estados con un snapshot inyectado", () => {
  test.use({ viewport: CELULAR });

  for (const mision of MISIONES) {
    test(`${mision}: antes del despegue, un estado vacío claro y las pestañas`, async ({
      page,
    }) => {
      const errores = vigilarErrores(page);
      await page.goto(`${DEV}/${mision}/?sin_cliente`);
      await irAGraficas(page);
      await expect(page.locator("#graficas")).toHaveAttribute("data-vista", "antes-del-despegue");
      await expect(page.locator("#graficas .graficas-vacio")).toHaveText(TEXTO_VACIO);
      await expect(page.locator("#graficas canvas")).toHaveCount(0);
      await expect(page.getByRole("tab")).toHaveText([
        "Altitud",
        "Velocidad vertical",
        "Aceleración",
      ]);

      // Un snapshot de la rampa (antes del despegue, T+ nulo en todos los puntos): sigue vacío.
      await alimentar(page, snapshotDe(mision, "nominal", 1000));
      await expect(page.locator("#graficas")).toHaveAttribute("data-vista", "antes-del-despegue");
      await expect(page.locator("#graficas .graficas-vacio")).toHaveText(TEXTO_VACIO);
      expect(errores).toEqual([]);
    });

    test(`${mision}: en vuelo se dibuja la altitud con las cuatro marcas y un resumen`, async ({
      page,
    }) => {
      const errores = vigilarErrores(page);
      const snap = enVuelo(mision);
      await page.goto(`${DEV}/${mision}/?sin_cliente`);
      await irAGraficas(page);
      await alimentar(page, snap);

      await expect(page.locator("#graficas canvas")).toHaveCount(1);
      await expect(page.locator("#graficas")).toHaveAttribute("data-vista", "vivo");
      expect(await puntos(page)).toBeGreaterThan(100);
      // las cuatro marcas están en la lista y se dibujaron de verdad
      expect(await nombresDeMarcas(page)).toEqual([
        expect.stringMatching(/^Despegue: a los 0,0 s$/),
        expect.stringMatching(/^Fin de la combustión: a los \d+,\d s$/),
        expect.stringMatching(/^(Apogeo|Eyección del paracaídas): a los \d+,\d s$/),
        expect.stringMatching(/^(Apogeo|Eyección del paracaídas): a los \d+,\d s$/),
      ]);
      await expect.poll(() => marcasDibujadas(page)).toBe(4);

      // el resumen dice el máximo, y coincide con la serie (la altitud del apogeo)
      const apogeo = snap.eventos.find((e) => e.tipo === "apogeo")?.valor ?? 0;
      const resumen = (await page.locator("#graficas .graficas-resumen").textContent()) ?? "";
      expect(resumen).toMatch(/^Altitud máxima: \d+ m, a los \d+,\d s del despegue\.$/);
      const maximo = Number(/(\d+) m/.exec(resumen)?.[1]);
      expect(Math.abs(maximo - apogeo)).toBeLessThan(apogeo * 0.05);
      // el texto alternativo de la gráfica lo repite para quien no la ve
      await expect(page.locator("#graficas .grafica")).toHaveAttribute(
        "aria-label",
        /^Altitud contra el tiempo desde el despegue\. Altitud máxima: /,
      );
      await expect(page.locator("#graficas .grafica")).toHaveAttribute("role", "img");
      expect(errores).toEqual([]);
    });

    test(`${mision}: las pestañas cambian la magnitud, con ratón y con teclado`, async ({
      page,
    }) => {
      await page.goto(`${DEV}/${mision}/?sin_cliente`);
      await irAGraficas(page);
      await alimentar(page, enVuelo(mision));
      await expect(page.locator("#graficas canvas")).toHaveCount(1);

      const pestana = (nombre: string) => page.getByRole("tab", { name: nombre });
      await expect(pestana("Altitud")).toHaveAttribute("aria-selected", "true");
      await expect(pestana("Velocidad vertical")).toHaveAttribute("aria-selected", "false");
      await expect(page.getByRole("tabpanel")).toHaveAttribute(
        "aria-labelledby",
        "graficas-pestana-altitud",
      );

      await pestana("Velocidad vertical").click();
      await expect(pestana("Velocidad vertical")).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#graficas .grafica")).toHaveAttribute(
        "data-magnitud",
        "velocidad",
      );
      await expect(page.locator("#graficas .graficas-resumen")).toContainText("Subida más rápida:");
      await expect(page.locator("#graficas .graficas-resumen")).toContainText("m/s");
      await expect.poll(() => marcasDibujadas(page)).toBe(4);

      // teclado: las flechas mueven la selección y el foco; Inicio y Fin saltan a los extremos
      await pestana("Velocidad vertical").focus();
      await page.keyboard.press("ArrowRight");
      await expect(pestana("Aceleración")).toHaveAttribute("aria-selected", "true");
      await expect(pestana("Aceleración")).toBeFocused();
      await expect(page.locator("#graficas .grafica")).toHaveAttribute(
        "data-magnitud",
        "aceleracion",
      );
      await expect(page.locator("#graficas .graficas-resumen")).toContainText(
        "Aceleración máxima:",
      );
      await page.keyboard.press("ArrowRight"); // da la vuelta
      await expect(pestana("Altitud")).toBeFocused();
      await page.keyboard.press("End");
      await expect(pestana("Aceleración")).toBeFocused();
      await page.keyboard.press("Home");
      await expect(pestana("Altitud")).toHaveAttribute("aria-selected", "true");
      // una sola pestaña entra al orden del teclado (roving tabindex)
      await expect(page.getByRole("tab", { selected: true })).toHaveAttribute("tabindex", "0");
      await expect(pestana("Aceleración")).toHaveAttribute("tabindex", "-1");
    });

    test(`${mision}: T+ negativo en la espera (snapshot) o nulo (cliente) dan la misma gráfica (D5)`, async ({
      page,
    }) => {
      const errores = vigilarErrores(page);
      const conNegativos = enVuelo(mision);
      expect(conNegativos.serie.t_mas_s.some((t) => t !== null && t < 0)).toBe(true);
      await page.goto(`${DEV}/${mision}/?sin_cliente`);
      await irAGraficas(page);

      await alimentar(page, conNegativos);
      await expect(page.locator("#graficas canvas")).toHaveCount(1);
      const resumenA = await page.locator("#graficas .graficas-resumen").textContent();
      const puntosA = await puntos(page);

      await alimentar(page, comoElCliente(conNegativos));
      await expect
        .poll(() => page.locator("#graficas .graficas-resumen").textContent())
        .toBe(resumenA);
      expect(await puntos(page)).toBe(puntosA);
      // y la gráfica nunca incluye la espera: el primer punto es el despegue
      expect(puntosA).toBeLessThan(conNegativos.serie.t_mas_s.length);
      expect(errores).toEqual([]);
    });

    test(`${mision}: si solo llegan 'fase' y 'despegue', una sola marca y ningún error`, async ({
      page,
    }) => {
      const errores = vigilarErrores(page);
      const snap = enVuelo(mision);
      const soloDespegue: Snapshot = {
        ...snap,
        eventos: snap.eventos.filter((e) => e.tipo === "fase" || e.tipo === "despegue"),
      };
      await page.goto(`${DEV}/${mision}/?sin_cliente`);
      await irAGraficas(page);
      await alimentar(page, soloDespegue);
      await expect(page.locator("#graficas canvas")).toHaveCount(1);
      expect(await nombresDeMarcas(page)).toEqual(["Despegue: a los 0,0 s"]);
      await expect.poll(() => marcasDibujadas(page)).toBe(1);
      // que falte un evento no es un error ni se avisa como tal
      await expect(page.locator("#graficas .graficas-estado")).toHaveCount(0);
      await expect(page.locator("#graficas")).not.toContainText(/error|falta|no se pudo/i);
      expect(errores).toEqual([]);
    });

    test(`${mision}: columnas con huecos (null) no rompen la gráfica ni dibujan ceros`, async ({
      page,
    }) => {
      const errores = vigilarErrores(page);
      const snap = enVuelo(mision);
      const n = snap.serie.t_mas_s.length;
      // la velocidad vertical sin fix 3D la mitad del vuelo, y la altitud sin fix en un tramo
      const hueco = (col: (number | null)[], desde: number, hasta: number) =>
        col.map((v, i) => (i >= desde && i < hasta ? null : v));
      const conHuecos: Snapshot = {
        ...snap,
        serie: {
          ...snap.serie,
          vz_ms: hueco(snap.serie.vz_ms, Math.floor(n / 2), n),
          alt_agl_m: hueco(snap.serie.alt_agl_m, Math.floor(n / 3), Math.floor(n / 2)),
        },
      };
      await page.goto(`${DEV}/${mision}/?sin_cliente`);
      await irAGraficas(page);
      await alimentar(page, conHuecos);
      await expect(page.locator("#graficas canvas")).toHaveCount(1);
      await page.getByRole("tab", { name: "Velocidad vertical" }).click();
      await expect(page.locator("#graficas canvas")).toHaveCount(1);
      await expect(page.locator("#graficas .graficas-resumen")).toContainText("Subida más rápida:");

      // una columna que llega siempre vacía en vuelo: se dice, sin gráfica vacía
      await alimentar(page, {
        ...snap,
        serie: { ...snap.serie, vz_ms: snap.serie.vz_ms.map(() => null) },
      });
      await expect(page.locator("#graficas .graficas-vacio")).toHaveText(
        "Aún no hay datos de esta medida.",
      );
      await expect(page.locator("#graficas canvas")).toHaveCount(0);
      // las otras pestañas siguen con su gráfica
      await page.getByRole("tab", { name: "Altitud" }).click();
      await expect(page.locator("#graficas canvas")).toHaveCount(1);
      expect(errores).toEqual([]);
    });
  }

  test("sin señal: lo último que llegó queda atenuado y rotulado, nunca como si fuera vivo", async ({
    page,
  }) => {
    await page.goto(`${DEV}/hermes/?sin_cliente`);
    await irAGraficas(page);
    await alimentar(page, enVuelo("hermes"));
    await expect(page.locator("#graficas")).toHaveAttribute("data-vista", "vivo");
    await moverReloj(page, 40_000);
    await expect(page.locator("#graficas")).toHaveAttribute("data-vista", "sin-senal");
    await expect(page.locator("#graficas .graficas-estado")).toContainText(
      /^Sin señal · último dato hace \d+ s$/,
    );
    await expect(page.locator("#graficas .graficas-estado")).toHaveCSS("color", ROJO_ALARMA);
    await expect(page.locator("#graficas .grafica")).toHaveCSS("opacity", "0.4");
    await expect(page.locator("#graficas canvas")).toHaveCount(1);
  });

  test("con 'reducir movimiento' la gráfica se dibuja igual", async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: CELULAR, reducedMotion: "reduce" });
    const page = await contexto.newPage();
    const errores = vigilarErrores(page);
    await page.goto(`${DEV}/demeter/?sin_cliente`);
    await irAGraficas(page);
    await alimentar(page, enVuelo("demeter"));
    await expect(page.locator("#graficas canvas")).toHaveCount(1);
    await expect.poll(() => marcasDibujadas(page)).toBe(4);
    expect(errores).toEqual([]);
    await contexto.close();
  });
});

// ------------------------------------------------------------------ medidas

test.describe("medidas: 390 px, horizontal y redimensionar", () => {
  for (const mision of MISIONES) {
    test(`${mision}: cabe a 390 px, se adapta al rotar el celular y no desborda la página`, async ({
      page,
    }) => {
      await page.setViewportSize(CELULAR);
      await page.goto(`${DEV}/${mision}/?sin_cliente`);
      await irAGraficas(page);
      await alimentar(page, enVuelo(mision));
      await expect(page.locator("#graficas canvas")).toHaveCount(1);

      const medida = () =>
        page.evaluate(() => {
          const sec = document.querySelector("#graficas")?.getBoundingClientRect();
          const c = document
            .querySelector("#graficas canvas:first-of-type")
            ?.getBoundingClientRect();
          return {
            seccion: sec?.width ?? 0,
            canvas: c?.width ?? 0,
            alto: c?.height ?? 0,
            desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            ventana: window.innerHeight,
          };
        });

      const vertical = await medida();
      expect(vertical.desborda).toBe(false);
      expect(vertical.canvas).toBeLessThanOrEqual(vertical.seccion);
      expect(vertical.canvas).toBeGreaterThan(250);
      await page.screenshot({
        path: join(CAPTURAS, `T-633-${mision}-altitud-390x844.png`),
        clip: await seccion(page),
      });

      // rotar el celular: más ancho, y el alto no pasa de la fracción de la ventana
      await page.setViewportSize(HORIZONTAL);
      await irAGraficas(page);
      await expect.poll(async () => (await medida()).canvas).toBeGreaterThan(vertical.canvas + 100);
      const horizontal = await medida();
      expect(horizontal.desborda).toBe(false);
      expect(horizontal.canvas).toBeLessThanOrEqual(horizontal.seccion);
      expect(horizontal.alto).toBeLessThanOrEqual(horizontal.ventana * 0.7 + 1);
      await expect.poll(() => marcasDibujadas(page)).toBe(4);
      await page.screenshot({
        path: join(CAPTURAS, `T-633-${mision}-altitud-844x390.png`),
        clip: await seccion(page),
      });

      // y de vuelta, sin recargar
      await page.setViewportSize(CELULAR);
      await expect.poll(async () => (await medida()).canvas).toBeLessThan(horizontal.canvas - 100);
      expect((await medida()).desborda).toBe(false);

      // portátil
      await page.setViewportSize(PORTATIL);
      await irAGraficas(page);
      await expect.poll(async () => (await medida()).canvas).toBeGreaterThan(500);
      await page.screenshot({
        path: join(CAPTURAS, `T-633-${mision}-altitud-1440x900.png`),
        clip: await seccion(page),
      });
    });
  }

  test("capturas: estado vacío, velocidad vertical y aceleración", async ({ page }) => {
    await page.setViewportSize(CELULAR);
    await page.goto(`${DEV}/demeter/?sin_cliente`);
    await irAGraficas(page);
    await page.screenshot({
      path: join(CAPTURAS, "T-633-demeter-estado-vacio-390x844.png"),
      clip: await seccion(page),
    });
    await alimentar(page, enVuelo("demeter"));
    await page.getByRole("tab", { name: "Velocidad vertical" }).click();
    await expect.poll(() => marcasDibujadas(page)).toBe(4);
    await page.screenshot({
      path: join(CAPTURAS, "T-633-demeter-velocidad-390x844.png"),
      clip: await seccion(page),
    });
    await page.goto(`${DEV}/hermes/?sin_cliente`);
    await irAGraficas(page);
    await alimentar(page, enVuelo("hermes"));
    await page.getByRole("tab", { name: "Aceleración" }).click();
    await expect.poll(() => marcasDibujadas(page)).toBe(4);
    await page.screenshot({
      path: join(CAPTURAS, "T-633-hermes-aceleracion-390x844.png"),
      clip: await seccion(page),
    });
  });
});

/** El recuadro de la sección (para recortar la captura; la navegación fija no sale). */
async function seccion(page: Page) {
  const caja = await page.locator("#graficas").boundingBox();
  if (!caja) throw new Error("la sección Gráficas no tiene caja");
  const alto = page.viewportSize()?.height ?? 0;
  return {
    x: caja.x,
    y: Math.max(0, caja.y),
    width: caja.width,
    height: Math.min(caja.height, alto - Math.max(0, caja.y)),
  };
}

// ------------------------------------------------------------------ con el repetidor

/** Manda a un repetidor en `puerto` todo lo que la página pida a `/api` (sin tocar el 8787 del proxy de Vite). */
async function desviarApi(page: Page, puerto: number): Promise<void> {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    return route.continue({ url: `http://127.0.0.1:${puerto}${url.pathname}${url.search}` });
  });
}

test.describe("con el repetidor de desarrollo (T-630)", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: CELULAR });

  let repetidor: Repetidor | undefined;
  let puertoRepetidor = 0;
  test.afterEach(async () => {
    await repetidor?.cerrar();
    repetidor = undefined;
  });

  /** Levanta un repetidor en un puerto libre y manda a él lo que la página pida a `/api`. */
  async function levantar(
    page: Page,
    mision: Mision,
    ruta: string,
    velocidad: number,
  ): Promise<void> {
    repetidor = crearRepetidor({
      archivos: { [mision]: { escenario: "gráficas", ruta } },
      velocidad,
    });
    puertoRepetidor = await repetidor.escuchar(0, "127.0.0.1");
    await desviarApi(page, puertoRepetidor);
  }
  const nominal = (mision: Mision) => join(DATOS, `${mision}_nominal.jsonl`);

  /** Una copia del vuelo nominal sin los eventos que el firmware de hoy no manda (T-412 pendiente). */
  function soloDespegue(mision: Mision): string {
    const quitar = new Set(["fin_combustion", "eyeccion", "apogeo", "aterrizaje"]);
    const lineas = readFileSync(nominal(mision), "utf8")
      .split("\n")
      .filter((l) => {
        if (l.trim() === "") return false;
        const m = JSON.parse(l) as { evento: string; datos: { tipo?: string } };
        return !(m.evento === "evento" && quitar.has(m.datos.tipo ?? ""));
      });
    const dir = mkdtempSync(join(tmpdir(), "t633-"));
    const ruta = join(dir, `${mision}_solo_despegue.jsonl`);
    writeFileSync(ruta, `${lineas.join("\n")}\n`);
    return ruta;
  }

  for (const mision of MISIONES) {
    test(`${mision}: antes del despegue el estado vacío, y en vuelo la gráfica crece con sus marcas`, async ({
      page,
    }) => {
      const errores = vigilarErrores(page);
      await levantar(page, mision, nominal(mision), 4); // el despegue sale a los ~4,5 s
      await page.goto(`${DEV}/${mision}/`);
      await irAGraficas(page);
      await expect(page.locator("#graficas .graficas-vacio")).toHaveText(TEXTO_VACIO);
      await expect(page.locator("#graficas canvas")).toHaveCount(0);

      // despega: aparece la gráfica y sigue creciendo
      await expect(page.locator("#graficas canvas")).toHaveCount(1, { timeout: 15_000 });
      const primero = await puntos(page);
      await expect.poll(() => puntos(page), { timeout: 10_000 }).toBeGreaterThan(primero + 5);
      await expect.poll(() => nombresDeMarcas(page), { timeout: 15_000 }).toHaveLength(4);
      await expect.poll(() => marcasDibujadas(page)).toBe(4);
      await expect(page.locator("#graficas .graficas-resumen")).toContainText("Altitud máxima:");
      await page.screenshot({
        path: join(CAPTURAS, `T-633-${mision}-en-vivo-390x844.png`),
        clip: await seccion(page),
      });
      expect(errores).toEqual([]);
    });

    test(`${mision}: si el servidor solo manda 'fase' y 'despegue', la gráfica sigue y marca el despegue`, async ({
      page,
    }) => {
      const errores = vigilarErrores(page);
      await levantar(page, mision, soloDespegue(mision), 8);
      await page.goto(`${DEV}/${mision}/`);
      await irAGraficas(page);
      await expect(page.locator("#graficas canvas")).toHaveCount(1, { timeout: 15_000 });
      await expect.poll(() => puntos(page), { timeout: 10_000 }).toBeGreaterThan(40);
      expect(await nombresDeMarcas(page)).toEqual(["Despegue: a los 0,0 s"]);
      await expect.poll(() => marcasDibujadas(page)).toBe(1);
      await expect(page.locator("#graficas")).not.toContainText(/error|falta|no se pudo/i);
      expect(errores).toEqual([]);
    });
  }

  test("recargar después del despegue (T+ negativo en la espera) muestra el vuelo, no la rampa", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await levantar(page, "hermes", nominal("hermes"), 6); // despegue a ~3 s; a los ~10 s ya va por la eyección
    await page.goto(`${DEV}/hermes/`);
    await irAGraficas(page);
    await expect.poll(() => nombresDeMarcas(page), { timeout: 20_000 }).not.toHaveLength(0);
    await page.waitForTimeout(3000);
    // la primera sesión ya está en vuelo; un visitante nuevo pide el snapshot con la espera atrás
    const pagina2 = await page.context().newPage();
    const errores2 = vigilarErrores(pagina2);
    await desviarApi(pagina2, puertoRepetidor);
    await pagina2.goto(`${DEV}/hermes/`);
    await irAGraficas(pagina2);
    await expect(pagina2.locator("#graficas canvas")).toHaveCount(1, { timeout: 15_000 });
    expect((await nombresDeMarcas(pagina2))[0]).toBe("Despegue: a los 0,0 s");
    // ninguna de las dos gráficas incluye la espera: el primer punto es el despegue (T+ 0)
    expect(await puntos(pagina2)).toBeGreaterThan(5);
    expect(errores).toEqual([]);
    expect(errores2).toEqual([]);
  });

  test("vuelo repetido: la gráfica se vacía en cada vuelta nueva y vuelve a llenarse", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await levantar(page, "demeter", nominal("demeter"), 40); // una vuelta dura ~3 s + 1 s de pausa
    await page.goto(`${DEV}/demeter/`);
    await irAGraficas(page);
    for (let vuelta = 1; vuelta <= 3; vuelta++) {
      // llena: hasta tener las 4 marcas y más de 100 puntos
      await expect
        .poll(
          async () => ((await page.locator("#graficas canvas").count()) ? await puntos(page) : 0),
          {
            timeout: 20_000,
          },
        )
        .toBeGreaterThan(100);
      // y se vacía al empezar la vuelta siguiente (otro vuelo)
      await expect(page.locator("#graficas .graficas-vacio")).toHaveText(TEXTO_VACIO, {
        timeout: 20_000,
      });
      await expect(page.locator("#graficas canvas")).toHaveCount(0);
    }
    expect(errores).toEqual([]);
  });
});
