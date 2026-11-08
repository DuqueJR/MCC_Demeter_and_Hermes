import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import type { Salud, Snapshot } from "../src/contrato/tipos";
import { alimentar, DEV, snapshotDe } from "./mapa_ayudas";

// T-659: la sección de la Raspberry Pi, solo en la página de Deméter (D-065). Se prueba en el servidor de
// desarrollo (:5174) con `?sin_cliente`, inyectando snapshots reales de los escenarios de dev/datos en
// `datos/api.ts`. Los escenarios no traen `salud.pi`: se arma aquí, sobre un snapshot real.
// Las capturas van a docs/07_bitacora/capturas/T-659.
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-659");
mkdirSync(CAPTURAS, { recursive: true });

type Mision = "demeter" | "hermes";
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;

/** Instante (ms del escenario `nominal`) en pleno descenso: trae `salud` y `estado`. */
const T_DESCENSO = 40_000;

/** Los modelos de chip que no pueden salir en la web pública (D-065). */
const MODELOS = /LSM6DSO32|BMP581|MMC5983MA|QMI8658|BME280|QMC6310|ESP32/i;

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

const abrir = (page: Page, mision: Mision) => page.goto(`${DEV}/${mision}/?sin_cliente`);

const textoDe = async (el: Locator) => (await el.textContent()) ?? "";

/**
 * El snapshot real del escenario con `salud.pi` y `act.cam_ok` a gusto. El escenario trae una temperatura de
 * la Pi, pero hoy la UART no la lleva: aquí llega en `null`, como en el vuelo.
 */
function conPi(
  base: Snapshot,
  pi: NonNullable<Salud["pi"]> | null | undefined,
  camOk: boolean,
): Snapshot {
  if (base.salud === null || base.estado === null) throw new Error("el escenario no trae salud");
  const salud: Salud = { ...base.salud, temp_pi_c: null };
  if (pi === undefined) delete salud.pi;
  else salud.pi = pi;
  return {
    ...base,
    salud,
    estado: { ...base.estado, act: { ...base.estado.act, cam_ok: camOk } },
  };
}

const pi = (estado: string, motivo: string | null = null) => ({ estado, motivo, bat_pct: null });
const nominal = snapshotDe("demeter", "nominal", T_DESCENSO);

const seccion = (page: Page) => page.locator("section#pi");
const estado = (page: Page) => seccion(page).locator('[data-pi="estado"]');
const vacio = (page: Page) => seccion(page).locator('[data-pi="vacio"]');
const fila = (page: Page, id: string) => seccion(page).locator(`[data-fila="${id}"]`);

test.describe("Sección de la Raspberry Pi", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Deméter: sin `salud` todavía, un estado vacío claro", async ({ page }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    await expect(seccion(page)).toBeVisible();
    await expect(seccion(page).getByRole("heading", { name: "La Raspberry Pi" })).toBeVisible();
    await expect(vacio(page)).toContainText("Sin datos de la Pi todavía");
    await expect(seccion(page).locator('[data-pi="pasos"]')).toHaveCount(0);
    expect(await sinDesborde(page)).toBe(true);
    expect(errores).toEqual([]);
  });

  test("Deméter: con `salud` pero sin `salud.pi` (la simulación pública) se ve igual de bien", async ({
    page,
  }) => {
    await abrir(page, "demeter");
    await alimentar(page, conPi(nominal, undefined, false));
    await expect(vacio(page)).toContainText("Sin datos de la Pi todavía");
    await alimentar(page, conPi(nominal, null, false));
    await expect(vacio(page)).toBeVisible();
    expect(await sinDesborde(page)).toBe(true);
  });

  test("grabando el ascenso: estado, pasos, cámara y 'sin dato' en batería y temperatura", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    await alimentar(page, conPi(nominal, pi("ASCENT"), true));
    await expect(estado(page)).toContainText("Grabando el ascenso");
    await expect(seccion(page)).toHaveAttribute("data-nivel", "activo");
    const pasos = seccion(page).locator(".pi-paso");
    await expect(pasos).toHaveCount(5);
    await expect(pasos.nth(0)).toHaveAttribute("data-avance", "hecho");
    await expect(pasos.nth(2)).toHaveAttribute("data-avance", "actual");
    await expect(pasos.nth(3)).toHaveAttribute("data-avance", "pendiente");
    await expect(fila(page, "pi-camara")).toContainText("Grabando");
    await expect(fila(page, "pi-bateria")).toContainText("sin dato");
    await expect(fila(page, "pi-temperatura")).toContainText("sin dato");
    // Sin dato no es falla: ni rojo, ni motivo, ni la palabra "falla".
    await expect(seccion(page).locator('[data-pi="motivo"]')).toHaveCount(0);
    expect((await textoDe(seccion(page))).toLowerCase()).not.toContain("falla");
    expect(await sinDesborde(page)).toBe(true);
    expect(errores).toEqual([]);
  });

  test("cada fase de la Pi se dice en español claro y cambia sola", async ({ page }) => {
    await abrir(page, "demeter");
    const casos: [string, string][] = [
      ["BOOT", "Arrancando"],
      ["PREFLIGHT", "Preparándose"],
      ["READY", "Lista"],
      ["ARMED", "Armada"],
      ["STARTING", "Grabando el ascenso"],
      ["RECORDING", "Capturando el descenso"],
      ["INGESTING", "Procesando imágenes"],
      ["PROCESSING", "Procesando imágenes"],
      ["COMPLETE", "Misión completa"],
      ["DESCONOCIDO", "Sin señal de la Pi"],
    ];
    for (const [codigo, texto] of casos) {
      await alimentar(page, conPi(nominal, pi(codigo), codigo === "RECORDING"));
      await expect(estado(page), codigo).toContainText(texto);
    }
    await alimentar(page, conPi(nominal, pi("COMPLETE"), false));
    await expect(seccion(page).locator('.pi-paso[data-avance="hecho"]')).toHaveCount(5);
    await expect(fila(page, "pi-camara")).toContainText("Grabación terminada");
  });

  test("sin señal de la Pi: aviso discreto, sin rojo ni motivo", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, conPi(nominal, pi("DESCONOCIDO"), false));
    await expect(seccion(page)).toHaveAttribute("data-nivel", "sin_dato");
    await expect(estado(page)).toContainText("Sin señal de la Pi");
    await expect(fila(page, "pi-camara")).toContainText("sin dato");
    await expect(seccion(page).locator('[data-pi="pasos"]')).toHaveCount(0);
  });

  test("con falla: 'Con falla' y el motivo legible", async ({ page }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    await alimentar(page, conPi(nominal, pi("SD_FULL", "SD_ESPACIO"), false));
    await expect(seccion(page)).toHaveAttribute("data-nivel", "falla");
    await expect(estado(page)).toContainText("Con falla");
    await expect(seccion(page).locator('[data-pi="motivo"]')).toContainText(
      "Poco espacio en la tarjeta",
    );
    await expect(fila(page, "pi-camara")).toContainText("No disponible");
    const motivos: [string, string][] = [
      ["SD_LENTA", "demasiado lenta"],
      ["RAM", "memoria"],
      ["CAMARA", "cámara"],
      ["TELEMETRIA", "telemetría"],
      ["PROCESO", "procesamiento"],
      ["ARCHIVOS", "archivos"],
      ["OTRO", "sin identificar"],
    ];
    for (const [codigo, texto] of motivos) {
      await alimentar(page, conPi(nominal, pi("PIPELINE_ERROR", codigo), false));
      await expect(seccion(page).locator('[data-pi="motivo"]'), codigo).toContainText(texto, {
        ignoreCase: true,
      });
    }
    // Se arregla: vuelve a un estado normal y el motivo desaparece.
    await alimentar(page, conPi(nominal, pi("READY"), true));
    await expect(seccion(page).locator('[data-pi="motivo"]')).toHaveCount(0);
    await expect(seccion(page)).toHaveAttribute("data-nivel", "espera");
    expect(errores).toEqual([]);
  });

  test("datos viejos: una nota dice que la Pi puede estar en otro estado", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, conPi(nominal, pi("ASCENT"), true), "conectado", 20_000);
    await expect(seccion(page).locator('[data-pi="viejo"]')).toContainText(/último hace \d+ s/);
    await expect(seccion(page)).toHaveAttribute("data-viejo", "si");
  });

  test("ningún modelo de chip en el texto de la sección", async ({ page }) => {
    await abrir(page, "demeter");
    for (const [codigo, motivo] of [
      ["ASCENT", null],
      ["SD_FULL", "SD_LENTA"],
      ["DESCONOCIDO", null],
    ] as const) {
      await alimentar(page, conPi(nominal, pi(codigo, motivo), false));
      expect(await textoDe(seccion(page))).not.toMatch(MODELOS);
    }
  });

  test("Hermes no tiene Pi: la sección no existe, ni con `salud.pi` en los datos", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "hermes");
    await expect(page.locator("section#salud")).toBeVisible();
    await expect(page.locator("section#pi")).toHaveCount(0);
    const hermes = snapshotDe("hermes", "nominal", T_DESCENSO);
    await alimentar(page, conPi(hermes, pi("ASCENT"), true));
    await expect(page.locator("section#pi")).toHaveCount(0);
    expect((await textoDe(page.locator("main"))).toLowerCase()).not.toContain("raspberry");
    expect(errores).toEqual([]);
  });
});

test.describe("distribución del panel", () => {
  const anchos = [
    { ancho: 768, alto: 1024, nombre: "tableta" },
    { ancho: 1440, alto: 900, nombre: "portátil" },
  ];
  for (const m of anchos) {
    test(`${m.nombre}: la Pi no deja huecos ni desborda`, async ({ page }) => {
      await page.setViewportSize({ width: m.ancho, height: m.alto });
      await abrir(page, "demeter");
      await alimentar(page, conPi(nominal, pi("ASCENT"), true));
      const caja = await seccion(page).boundingBox();
      const panel = await page.locator("main.panel").boundingBox();
      if (caja === null || panel === null) throw new Error("sin caja");
      if (m.ancho >= 1024) {
        // Banda a todo el ancho del panel.
        expect(caja.width).toBeGreaterThan(panel.width - 40);
      } else {
        // Dos columnas: la Pi comparte fila con Salud.
        const salud = await page.locator("section#salud").boundingBox();
        if (salud === null) throw new Error("sin salud");
        expect(Math.abs(caja.y - salud.y)).toBeLessThan(2);
        expect(caja.x).toBeGreaterThan(salud.x);
      }
      expect(await sinDesborde(page)).toBe(true);
    });
  }
});

test.describe("capturas de la bitácora", () => {
  for (const med of MEDIDAS) {
    const medida = `${med.ancho}x${med.alto}`;
    test.describe(medida, () => {
      test.use({ viewport: { width: med.ancho, height: med.alto } });

      const capturar = async (page: Page, nombre: string) => {
        await seccion(page).scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await seccion(page).screenshot({ path: `${CAPTURAS}/pi-${nombre}-${medida}.png` });
      };

      test("vacía (sin datos de la Pi)", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, conPi(nominal, undefined, false));
        await capturar(page, "vacia");
      });

      test("preparándose", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, conPi(nominal, pi("PREFLIGHT"), false));
        await capturar(page, "preparandose");
      });

      test("grabando el ascenso", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, conPi(nominal, pi("ASCENT"), true));
        await capturar(page, "ascenso");
      });

      test("procesando imágenes", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, conPi(nominal, pi("PROCESSING"), false));
        await capturar(page, "procesando");
      });

      test("misión completa", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, conPi(nominal, pi("COMPLETE"), false));
        await capturar(page, "completa");
      });

      test("con falla", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, conPi(nominal, pi("SD_FULL", "SD_ESPACIO"), false));
        await capturar(page, "falla");
      });

      test("sin señal de la Pi", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, conPi(nominal, pi("DESCONOCIDO"), false));
        await capturar(page, "sin-senal");
      });
    });
  }
});
