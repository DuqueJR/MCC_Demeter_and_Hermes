import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { angulosDeCuaternion } from "../src/actitud/angulos";
import type { Snapshot } from "../src/contrato/tipos";
import { alimentar, DEV, moverReloj, ponerConexion, snapshotDe } from "./mapa_ayudas";

// T-634: la actitud 2D. Se prueba en el servidor de desarrollo (:5174), donde se puede inyectar un
// snapshot real (escenarios de dev/datos) en `datos/api.ts`. Las capturas van a e2e/capturas/
// (carpeta ignorada por git; `test-results/` la borra Playwright en cada corrida).
const CAPTURAS = resolve(import.meta.dirname, "capturas/T-634");
mkdirSync(CAPTURAS, { recursive: true });

const MISIONES = ["demeter", "hermes"] as const;
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;
const ROJO_ALARMA = "rgb(255, 77, 94)";
/** Tolerancia al comparar lo que se lee en pantalla (se redondea a 0,1°). */
const TOL_DEG = 0.06;

const irAActitud = async (page: Page) => {
  // Al centro de la ventana: la navegación fija de abajo no tapa la sección.
  await page
    .locator("#actitud")
    .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
};

/** Los números que muestra la sección, como texto. */
const leer = async (page: Page) => ({
  cabeceo: (await page.locator('[data-angulo="cabeceo"]').textContent()) ?? "",
  alabeo: (await page.locator('[data-angulo="alabeo"]').textContent()) ?? "",
  rumbo: (await page.locator('[data-angulo="rumbo"]').textContent()) ?? "",
});
const aNumero = (texto: string) => Number.parseFloat(texto.replace("−", "-").replace(",", "."));
const transformacion = (page: Page, parte: "horizonte" | "rosa") =>
  page.locator(`[data-parte="${parte}"]`).getAttribute("transform");

/** El snapshot nominal con el cohete en el descenso (EKF listo, actitud inclinada). */
const enVuelo = (mision: (typeof MISIONES)[number]): Snapshot =>
  snapshotDe(mision, "nominal", 70_000);

test.describe("los ángulos que se leen salen del cuaternión del contrato", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const mision of MISIONES) {
    test(`${mision}: cabeceo, alabeo y rumbo coinciden con el cálculo puro`, async ({ page }) => {
      const snap = enVuelo(mision);
      const q = snap.estado?.q;
      if (!q) throw new Error("el escenario no trae estado");
      const esperado = angulosDeCuaternion(q);
      if (!esperado) throw new Error("el cuaternión del escenario no es válido");

      await page.goto(`${DEV}/${mision}/`);
      await irAActitud(page);
      // Sin datos: guiones y sin horizonte (el instrumento no finge estar vivo).
      await expect(page.locator("#actitud")).toHaveAttribute("data-vista", "sin-dato");
      await expect(page.locator('[data-angulo="cabeceo"]')).toHaveText("—");
      await expect(page.locator("#actitud .actitud-estado")).toHaveText(
        "Aún no hay datos de orientación.",
      );
      await expect(page.locator('#actitud [data-parte="horizonte"]')).toBeHidden();

      await alimentar(page, snap);
      await expect(page.locator("#actitud")).toHaveAttribute("data-vista", "vivo");
      await expect(page.locator("#actitud .actitud-estado")).toHaveCount(0);
      await expect(page.locator('[data-angulo="cabeceo"]')).not.toHaveText("—");
      const v = await leer(page);
      expect(Math.abs(aNumero(v.cabeceo) - esperado.cabeceo)).toBeLessThan(TOL_DEG);
      expect(Math.abs(aNumero(v.alabeo) - esperado.alabeo)).toBeLessThan(TOL_DEG);
      expect(Math.abs(aNumero(v.rumbo) - Math.round(esperado.rumbo))).toBeLessThan(TOL_DEG);
      expect(v.rumbo).toMatch(/^\d+° (N|NE|E|SE|S|SO|O|NO)$/);
      // El horizonte se desplazó (cabeceo ≠ 0) y la rosa giró (rumbo ≠ 0).
      expect(await transformacion(page, "horizonte")).toMatch(/^rotate\(.*\) translate\(0 .*\)$/);
      expect(await transformacion(page, "rosa")).toMatch(/^rotate\(.*\)$/);
    });
  }
});

test.describe("estados de la página", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("EKF no listo: 'Orientación aún no disponible' y sin horizonte", async ({ page }) => {
    const snap = enVuelo("demeter");
    if (!snap.estado) throw new Error("sin estado");
    const sinEkf: Snapshot = {
      ...snap,
      estado: { ...snap.estado, flags: { ...snap.estado.flags, ekf_ok: false } },
    };
    await page.goto(`${DEV}/demeter/`);
    await irAActitud(page);
    await alimentar(page, sinEkf);
    await expect(page.locator("#actitud")).toHaveAttribute("data-vista", "no-disponible");
    await expect(page.locator("#actitud .actitud-estado")).toHaveText(
      "Orientación aún no disponible",
    );
    await expect(page.locator('[data-angulo="rumbo"]')).toHaveText("—");
    await expect(page.locator('#actitud [data-parte="horizonte"]')).toBeHidden();
  });

  test("sin señal: la última actitud queda atenuada y rotulada, nunca como si fuera viva", async ({
    page,
  }) => {
    await page.goto(`${DEV}/demeter/`);
    await irAActitud(page);
    await alimentar(page, enVuelo("demeter"));
    await expect(page.locator("#actitud")).toHaveAttribute("data-vista", "vivo");
    // Pasan 40 s sin paquetes del cohete: `estadoPagina` pasa a sin_senal.
    await moverReloj(page, 40_000);
    await expect(page.locator("#actitud")).toHaveAttribute("data-vista", "sin-senal");
    await expect(page.locator("#actitud .actitud-estado")).toContainText(
      /^Sin señal · última orientación hace \d+ s$/,
    );
    await expect(page.locator("#actitud .actitud-estado")).toHaveCSS("color", ROJO_ALARMA);
    await expect(page.locator("#actitud .actitud-instrumentos")).toHaveCSS("opacity", "0.4");
    await expect(page.locator('[data-angulo="cabeceo"]')).not.toHaveText("—");
  });

  test("señal débil y sin servidor: se atenúa y avisa", async ({ page }) => {
    await page.goto(`${DEV}/hermes/`);
    await irAActitud(page);
    await alimentar(page, enVuelo("hermes"));
    await ponerConexion(page, "reconectando");
    await expect(page.locator("#actitud")).toHaveAttribute("data-vista", "sin-servidor");
    await expect(page.locator("#actitud .actitud-estado")).toContainText("Reconectando");
    await expect(page.locator("#actitud .actitud-instrumentos")).toHaveCSS("opacity", "0.65");
    await ponerConexion(page, "conectado");
    await expect(page.locator("#actitud")).toHaveAttribute("data-vista", "vivo");
  });
});

test.describe("movimiento", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("el horizonte sigue la muestra interpolada del cliente de datos", async ({ page }) => {
    const snap = enVuelo("demeter");
    if (!snap.estado) throw new Error("sin estado");
    await page.goto(`${DEV}/demeter/`);
    await irAActitud(page);
    await alimentar(page, snap);
    await expect(page.locator("#actitud")).toHaveAttribute("data-vista", "vivo");

    // Dos estados de la misma misión, con cabeceos distintos (alejados 1 s): el interpolador
    // (el mismo módulo que usa la UI) los reproduce con slerp y el dibujo pasa por los intermedios.
    const cabeceos = await page.evaluate(
      async ([e, desdeQ, hastaQ]) => {
        const ruta = "/src/datos/interpolacion.ts";
        const { interpolador } = await import(/* @vite-ignore */ ruta);
        interpolador.reiniciar();
        const ahora = performance.now();
        interpolador.agregar({ ...e, t_ms: 1_000_000, q: desdeQ }, ahora);
        interpolador.agregar({ ...e, t_ms: 1_001_000, q: hastaQ }, ahora + 1000);
        const lecturas: number[] = [];
        const leerCabeceo = () => {
          const t = document.querySelector('[data-parte="horizonte"]')?.getAttribute("transform");
          const m = t?.match(/translate\(0 (-?[\d.]+)\)/);
          return m ? Number(m[1]) : Number.NaN;
        };
        for (let i = 0; i < 8; i++) {
          await new Promise((r) => setTimeout(r, 150));
          lecturas.push(leerCabeceo());
        }
        return lecturas;
      },
      [
        snap.estado,
        { w: 0.9998, x: 0, y: -0.0175, z: 0 }, // ~2° arriba
        { w: 0.9063, x: 0, y: -0.4226, z: 0 }, // ~50° arriba
      ] as const,
    );
    // Los valores cambian de un cuadro a otro (no es un salto) y crecen hacia el destino.
    const distintos = new Set(cabeceos.map((c) => c.toFixed(1)));
    expect(distintos.size).toBeGreaterThan(3);
    expect(cabeceos.every(Number.isFinite)).toBe(true);
    expect(cabeceos[cabeceos.length - 1]).toBeGreaterThan(cabeceos[0] as number);
  });

  test("con movimiento reducido no hay ciclo de dibujo: se pinta cada estado que llega", async ({
    browser,
  }) => {
    const contexto = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await contexto.newPage();
    await page.goto(`${DEV}/demeter/`);
    await irAActitud(page);
    const snap = enVuelo("demeter");
    await alimentar(page, snap);
    await expect.poll(() => transformacion(page, "horizonte")).not.toBeNull();
    const antes = await transformacion(page, "horizonte");
    await page.waitForTimeout(400);
    expect(await transformacion(page, "horizonte")).toBe(antes);
    // Llega otro estado con otra actitud: se pinta enseguida.
    const e = snap.estado;
    if (!e) throw new Error("sin estado");
    await page.evaluate(
      async ([estado, q]) => {
        const ruta = "/src/datos/api.ts";
        const api = await import(/* @vite-ignore */ ruta);
        api.alimentar.estado({ ...estado, q });
      },
      [e, { w: 0.9063, x: 0, y: -0.4226, z: 0 }] as const,
    );
    await expect.poll(() => transformacion(page, "horizonte")).not.toBe(antes);
    await contexto.close();
  });
});

test.describe("casi vertical (bloqueo de cardán)", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("a 90° de cabeceo no se inventan el rumbo ni el alabeo", async ({ page }) => {
    const snap = enVuelo("demeter");
    if (!snap.estado) throw new Error("sin estado");
    await page.goto(`${DEV}/demeter/`);
    await irAActitud(page);
    // La nariz exactamente arriba (así se publica en el escenario antes del despegue).
    await alimentar(page, {
      ...snap,
      estado: { ...snap.estado, q: { w: Math.SQRT1_2, x: 0, y: -Math.SQRT1_2, z: 0 } },
    });
    await expect(page.locator('[data-angulo="cabeceo"]')).toHaveText("90,0°");
    await expect(page.locator('[data-angulo="alabeo"]')).toHaveText("—");
    await expect(page.locator('[data-angulo="rumbo"]')).toHaveText("—");
    await expect(page.locator(".actitud-cardan")).toBeVisible();
  });
});

test.describe("capturas de la sección", () => {
  for (const mision of MISIONES) {
    for (const med of MEDIDAS) {
      const medida = `${med.ancho}x${med.alto}`;
      test(`${mision} ${medida}`, async ({ page }) => {
        await page.setViewportSize({ width: med.ancho, height: med.alto });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`${DEV}/${mision}/`);
        await irAActitud(page);
        await alimentar(page, enVuelo(mision));
        await expect(page.locator("#actitud")).toHaveAttribute("data-vista", "vivo");
        await page
          .locator("#actitud")
          .screenshot({ path: `${CAPTURAS}/${mision}-vivo-${medida}.png` });
        if (med.ancho === 390) {
          await moverReloj(page, 40_000);
          await expect(page.locator("#actitud")).toHaveAttribute("data-vista", "sin-senal");
          await page
            .locator("#actitud")
            .screenshot({ path: `${CAPTURAS}/${mision}-sin-senal-${medida}.png` });
        }
      });
    }
  }
});
