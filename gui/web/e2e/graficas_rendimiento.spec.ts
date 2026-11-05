import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { crearRepetidor } from "../dev/repetidor/servidor";

// T-633, criterio "60 fps en un celular de gama media durante el vuelo repetido": una MEDIDA, no un
// requisito duro. Se corre con el dist/ de producción (el servidor de `vite preview`, :4173), un
// vuelo a velocidad real del repetidor (~9 Hz de `estado`) y la CPU frenada 4 veces (la regla
// habitual para "gama media"). Se mide el mismo tramo de vuelo dos veces: con la sección Gráficas
// a la vista y con ella oculta (`display: none`: deja de recalcular y de dibujar), así la
// diferencia es lo que cuesta la gráfica y no el resto de la página.
//
// Es sensible a la carga de la máquina: para una cifra fiable, correrla sola:
//   npx playwright test e2e/graficas_rendimiento.spec.ts --workers=1
// Con GRAFICAS_FPS_MIN=<n> exige ese mínimo de cuadros por segundo a la gráfica a la vista.
const DATOS = resolve(import.meta.dirname, "../dev/datos");
const VENTANA_MS = 6000;
const FRENO_CPU = 4;

interface Medida {
  fps: number;
  /** El cuadro más largo, en ms. */
  peorMs: number;
  /** Tareas largas (> 50 ms) del hilo principal en la ventana. */
  largas: number;
}

const medir = (page: Page, ventanaMs: number): Promise<Medida> =>
  page.evaluate(
    (ventana) =>
      new Promise<Medida>((resolver) => {
        const inicio = performance.now();
        let cuadros = 0;
        let peorMs = 0;
        let largas = 0;
        let ultimo = inicio;
        const po = new PerformanceObserver((lista) => {
          largas += lista.getEntries().length;
        });
        po.observe({ entryTypes: ["longtask"] });
        const paso = (t: number) => {
          cuadros++;
          peorMs = Math.max(peorMs, t - ultimo);
          ultimo = t;
          if (t - inicio < ventana) {
            requestAnimationFrame(paso);
            return;
          }
          po.disconnect();
          resolver({ fps: (cuadros * 1000) / (t - inicio), peorMs, largas });
        };
        requestAnimationFrame(paso);
      }),
    ventanaMs,
  );

test("con la CPU 4 veces más lenta, cuánto cuesta la gráfica durante el vuelo", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  // vuelo nominal de Deméter a velocidad real: despega a los ~18 s
  const repetidor = crearRepetidor({
    archivos: { demeter: { escenario: "rendimiento", ruta: join(DATOS, "demeter_nominal.jsonl") } },
    velocidad: 1,
  });
  const puerto = await repetidor.escuchar(0, "127.0.0.1");
  try {
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      return route.continue({ url: `http://127.0.0.1:${puerto}${url.pathname}${url.search}` });
    });
    await page.goto("/demeter/");
    await page
      .locator("#graficas")
      .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect(page.locator("#graficas canvas")).toHaveCount(1, { timeout: 40_000 });
    // unos segundos de vuelo para que la serie tenga cuerpo
    await page.waitForTimeout(3000);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: FRENO_CPU });
    const puntosAntes = Number(
      await page.locator("#graficas .grafica").getAttribute("data-puntos"),
    );
    const conGrafica = await medir(page, VENTANA_MS);
    const puntosDespues = Number(
      await page.locator("#graficas .grafica").getAttribute("data-puntos"),
    );

    await page.addStyleTag({ content: "#graficas { display: none !important; }" });
    const sinGrafica = await medir(page, VENTANA_MS);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    const resultado = {
      frenoCpu: FRENO_CPU,
      ventanaMs: VENTANA_MS,
      puntosAntes,
      puntosDespues,
      conGrafica,
      sinGrafica,
    };
    console.log(`[T-633 rendimiento] ${JSON.stringify(resultado)}`);
    test.info().annotations.push({ type: "medida", description: JSON.stringify(resultado) });

    // la gráfica sí se estaba actualizando mientras se midió
    expect(puntosDespues).toBeGreaterThan(puntosAntes);
    const minimo = Number(process.env.GRAFICAS_FPS_MIN ?? 0);
    if (minimo > 0) expect(conGrafica.fps).toBeGreaterThanOrEqual(minimo);
  } finally {
    await repetidor.cerrar();
  }
});
