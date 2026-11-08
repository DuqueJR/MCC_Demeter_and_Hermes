import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import type { CondicionGoNogo, Estado, Salud, Snapshot } from "../src/contrato/tipos";
import { alimentar, DEV, snapshotDe } from "./mapa_ayudas";

// T-658: Salud del cohete simplificada (D-065). Se prueba en el servidor de desarrollo (:5174) con
// `?sin_cliente`, inyectando snapshots reales de los escenarios de dev/datos en `datos/api.ts`.
// No hay un escenario con fallas ni con el armado negado: se arman aquí, sobre un snapshot real.
// Las capturas van a docs/07_bitacora/capturas/T-658.
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-658");
mkdirSync(CAPTURAS, { recursive: true });

type Mision = "demeter" | "hermes";
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;

/** Instantes (ms del escenario `nominal`): ver dev/datos/*_nominal.jsonl. */
const T_PREFLIGHT_CON_POS = 5_000;
const T_DESCENSO = 40_000;
const BIT_BMP581 = 1;
const BIT_SD = 7;
const BIT_BATERIA_BAJA = 13;

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

function conSalud(base: Snapshot, cambios: Partial<Salud> & Record<string, unknown>): Snapshot {
  if (base.salud === null) throw new Error("el escenario no trae salud");
  return { ...base, salud: { ...base.salud, ...cambios } };
}

function conEstado(base: Snapshot, cambios: Partial<Estado>): Snapshot {
  if (base.estado === null) throw new Error("el escenario no trae estado");
  return { ...base, estado: { ...base.estado, ...cambios } };
}

function conFlags(base: Snapshot, flags: Partial<Estado["flags"]>): Snapshot {
  if (base.estado === null) throw new Error("el escenario no trae estado");
  return conEstado(base, { flags: { ...base.estado.flags, ...flags } });
}

/** Lo que `web1.py` manda antes de que el cohete responda a un armado: solo gnss, bateria y reserva. */
const ANTES_DE_ARMAR: CondicionGoNogo[] = [
  { id: "gnss", nombre: "Fix 3D del GNSS", ok: true },
  { id: "bateria", nombre: "Bateria suficiente", ok: true },
  { id: "reserva", nombre: "Reserva de la SD completa", ok: false },
];
/** La respuesta a un armado: el checklist completo, con los modelos de chip como los manda el servicio. */
const CHECKLIST_ARMADO: CondicionGoNogo[] = [
  { id: "reserva", nombre: "Reserva de la SD completa", ok: true },
  { id: "sd", nombre: "SD registrando", ok: true },
  { id: "lsm", nombre: "LSM6DSO32 con datos", ok: false },
  { id: "bmp", nombre: "BMP581 con datos", ok: true },
  { id: "gnss", nombre: "Fix 3D del GNSS", ok: true },
  { id: "bateria", nombre: "Bateria suficiente", ok: true },
  { id: "movimiento", nombre: "Cohete quieto (1 g)", ok: true },
];

const conGo = (base: Snapshot, listo: boolean, condiciones: CondicionGoNogo[]) =>
  conSalud(base, { go_nogo: { listo, condiciones } });

const nominalEn = (m: Mision, t: number) => snapshotDe(m, "nominal", t);
const aterrizado = (m: Mision) => snapshotDe(m, "nominal");
/** PREFLIGHT con fix y todo lo demás en verde, para las pruebas del armado. */
const enPreflight = (m: Mision) => {
  const base = nominalEn(m, T_PREFLIGHT_CON_POS);
  if (base.estado?.fase !== "PREFLIGHT") throw new Error("el escenario debe estar en PREFLIGHT");
  return conFlags(base, { gnss_fix: true, ekf_ok: true });
};

/** Todo el texto de un elemento, también el que solo lee un lector de pantalla. */
const textoDe = async (el: Locator) => (await el.textContent()) ?? "";

const salud = (page: Page) => page.locator("section#salud");
const resumen = (page: Page) => salud(page).locator('[data-salud="resumen"]');
const chipGo = (page: Page) => salud(page).locator('[data-salud="go-nogo"]');

test.describe("Salud del cohete simplificada", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("sin `salud` todavía: un estado vacío claro", async ({ page }) => {
    await abrir(page, "demeter");
    await expect(resumen(page)).toContainText("Sin datos de salud todavía");
    await expect(salud(page).locator("details")).toHaveCount(0);
  });

  test("nominal: 'Sin fallas reportadas'; el detalle no trae sensores, sistemas ni calibraciones", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_DESCENSO));
    await expect(resumen(page)).toContainText("Sin fallas reportadas");
    await expect(salud(page)).toHaveAttribute("data-nivel", "ok");
    const detalle = salud(page).locator("details");
    await detalle.locator("summary").click();
    for (const titulo of ["Navegación", "Enlace", "Batería", "Tarjeta SD", "Temperatura"]) {
      await expect(detalle.getByRole("heading", { name: titulo })).toBeVisible();
    }
    for (const titulo of ["Sensores", "Sistemas", "Calibraciones"]) {
      await expect(detalle.getByRole("heading", { name: titulo })).toHaveCount(0);
    }
    await expect(detalle.locator('[data-fila="sd"]')).toContainText("MB");
    await expect(detalle.locator('[data-fila="bateria-v"]')).toContainText("V");
    await expect(detalle.locator('[data-fila="hacc"]')).toContainText("m");
    await expect(detalle.locator('[data-fila="temp-pi"]')).toHaveCount(0);
    await expect(detalle.locator('[data-fila="temp-placa"]')).toBeVisible();
    const texto = (await textoDe(salud(page))).toLowerCase();
    expect(texto).not.toMatch(MODELOS);
    expect(texto).not.toContain("raspberry");
    expect(texto).not.toContain("calibra");
    expect(await sinDesborde(page)).toBe(true);
    expect(errores).toEqual([]);
  });

  test("con fallas nombradas por el servicio con el modelo: salen genéricas, y se arreglan", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    const base = nominalEn("demeter", T_DESCENSO);
    await alimentar(page, base);
    await expect(resumen(page)).toContainText("Sin fallas reportadas");

    await alimentar(page, conSalud(base, { fallas: ["BMP581"], fallas_bits: 1 << BIT_BMP581 }));
    await expect(resumen(page)).toHaveText("Falla: Barómetro");
    await expect(salud(page)).toHaveAttribute("data-nivel", "falla");

    await alimentar(
      page,
      conSalud(base, {
        fallas: ["BMP581", "SD", "Batería baja"],
        fallas_bits: (1 << BIT_BMP581) | (1 << BIT_SD) | (1 << BIT_BATERIA_BAJA),
      }),
    );
    await expect(resumen(page)).toContainText("3 fallas");
    const lista = salud(page).locator('[data-salud="fallas"] li');
    await expect(lista).toHaveCount(3);
    await expect(lista.first()).toContainText("Barómetro");
    expect((await textoDe(salud(page))).toLowerCase()).not.toMatch(MODELOS);

    await alimentar(page, base);
    await expect(resumen(page)).toContainText("Sin fallas reportadas");
    await expect(salud(page).locator('[data-salud="fallas"]')).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test("con lo que sí llega: falla_activa, EKF y GNSS (las fallas nombradas van vacías)", async ({
    page,
  }) => {
    await abrir(page, "demeter");
    const base = nominalEn("demeter", T_DESCENSO);
    expect(base.salud?.fallas).toEqual([]);
    await alimentar(page, conFlags(base, { falla_activa: true }));
    await expect(resumen(page)).toHaveText("Falla: El cohete reporta una falla");
    await alimentar(page, conFlags(base, { ekf_ok: false }));
    await expect(resumen(page)).toHaveText("Falla: Navegación del cohete no lista");
    await alimentar(page, conFlags(base, { gnss_fix: false }));
    await expect(resumen(page)).toHaveText("Falla: Sin fix del GNSS");
    await alimentar(page, conFlags(base, { gnss_fix: false, ekf_ok: false }));
    await expect(resumen(page)).toContainText("2 fallas");
  });

  test("la Pi en un estado de error es falla; sin `salud.pi` no pasa nada", async ({ page }) => {
    await abrir(page, "demeter");
    const base = nominalEn("demeter", T_DESCENSO);
    await alimentar(
      page,
      conSalud(base, { pi: { estado: "SD_FULL", motivo: "SD_ESPACIO", bat_pct: null } }),
    );
    await expect(resumen(page)).toContainText("Falla: Cámara: tarjeta SD llena");
    await alimentar(
      page,
      conSalud(base, { pi: { estado: "RECORDING", motivo: null, bat_pct: null } }),
    );
    await expect(resumen(page)).toContainText("Sin fallas reportadas");
    await alimentar(page, conSalud(base, { pi: null }));
    await expect(resumen(page)).toContainText("Sin fallas reportadas");
  });

  test("datos viejos: la fila dice que hace tiempo que no hay datos", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_DESCENSO), "conectado", 20_000);
    await expect(resumen(page)).toContainText(
      /Falla: Sin datos recientes del cohete \(último hace \d+ s\)/,
    );
  });

  test("antes de armar: 'Esperando armado' con las condiciones, nunca 'No Go'", async ({
    page,
  }) => {
    await abrir(page, "demeter");
    await alimentar(page, conGo(enPreflight("demeter"), false, ANTES_DE_ARMAR));
    await expect(chipGo(page)).toHaveAttribute("data-go", "esperando");
    await expect(chipGo(page)).toContainText("Esperando armado");
    await expect(chipGo(page)).not.toContainText(/NO-GO|No Go/i);
    await expect(chipGo(page).locator("li")).toHaveCount(3);
    await expect(chipGo(page).locator('li[data-ok="no"]').first()).toContainText("no cumple");
    // Esperar no es una falla.
    await expect(resumen(page)).toContainText("Sin fallas reportadas");
  });

  test("el cohete negó el armado: 'NO-GO' y los modelos de chip salen genéricos", async ({
    page,
  }) => {
    await abrir(page, "demeter");
    await alimentar(page, conGo(enPreflight("demeter"), false, CHECKLIST_ARMADO));
    await expect(chipGo(page)).toHaveAttribute("data-go", "nogo");
    await expect(chipGo(page)).toContainText("NO-GO · falta 1 condición");
    await expect(chipGo(page).locator('li[data-condicion="lsm"]')).toContainText(
      "Acelerómetro y giróscopo con datos",
    );
    await expect(chipGo(page).locator('li[data-condicion="bmp"]')).toContainText(
      "Barómetro con datos",
    );
    expect((await textoDe(salud(page))).toLowerCase()).not.toMatch(MODELOS);
  });

  test("el cohete respondió APTO: 'GO'; y en descenso el chip desaparece", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(
      page,
      conGo(
        enPreflight("demeter"),
        true,
        CHECKLIST_ARMADO.map((c) => ({ ...c, ok: true })),
      ),
    );
    await expect(chipGo(page)).toHaveAttribute("data-go", "go");
    await expect(chipGo(page)).toContainText("GO · Listo para armar");
    await alimentar(page, nominalEn("demeter", T_DESCENSO));
    await expect(chipGo(page)).toHaveCount(0);
  });

  test("Hermes: la misma sección, sin fila de la Pi", async ({ page }) => {
    await abrir(page, "hermes");
    await alimentar(page, aterrizado("hermes"));
    await expect(resumen(page)).toContainText("Sin fallas reportadas");
    await salud(page).locator("summary").click();
    await expect(salud(page).locator('[data-fila="temp-placa"]')).toBeVisible();
    await expect(salud(page).locator('[data-fila="temp-pi"]')).toHaveCount(0);
    expect((await textoDe(salud(page))).toLowerCase()).not.toMatch(MODELOS);
  });

  test("el detalle se maneja con el teclado (summary enfocable)", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, aterrizado("demeter"));
    const resumenDetalle = salud(page).locator("summary");
    await resumenDetalle.focus();
    await page.keyboard.press("Enter");
    await expect(salud(page).locator("details")).toHaveAttribute("open", "");
    const alto = await resumenDetalle.evaluate((e) => e.getBoundingClientRect().height);
    expect(alto).toBeGreaterThanOrEqual(44);
  });
});

test.describe("la web pública no muestra ningún modelo de chip", () => {
  for (const med of MEDIDAS) {
    test(`${med.ancho}x${med.alto}: ni en el texto de la página ni en el HTML (Demeter y Hermes)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: med.ancho, height: med.alto });
      for (const mision of ["demeter", "hermes"] as const) {
        await abrir(page, mision);
        const base = enPreflight(mision);
        // El peor caso: el servicio manda los modelos en las fallas y en las condiciones.
        await alimentar(
          page,
          conSalud(conGo(base, false, CHECKLIST_ARMADO), {
            fallas: ["LSM6DSO32", "QMC6310", "BME280"],
            fallas_bits: 0b11,
          }),
        );
        await salud(page).locator("summary").click();
        expect(await textoDe(page.locator("main"))).not.toMatch(MODELOS);
        expect(await page.locator("main").innerHTML()).not.toMatch(MODELOS);
      }
    });
  }
});

test.describe("capturas de la bitácora", () => {
  for (const med of MEDIDAS) {
    const medida = `${med.ancho}x${med.alto}`;
    test.describe(medida, () => {
      test.use({ viewport: { width: med.ancho, height: med.alto } });

      test("nominal (en descenso)", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, nominalEn("demeter", T_DESCENSO));
        await salud(page).locator("summary").click();
        await page.waitForTimeout(300);
        await salud(page).screenshot({ path: `${CAPTURAS}/salud-nominal-${medida}.png` });
      });

      test("fallas", async ({ page }) => {
        await abrir(page, "demeter");
        const base = conEstado(nominalEn("demeter", T_DESCENSO), { bat_pct: 41 });
        await alimentar(
          page,
          conFlags(
            conSalud(base, {
              fallas: ["BMP581", "SD", "Batería baja"],
              fallas_bits: (1 << BIT_BMP581) | (1 << BIT_SD) | (1 << BIT_BATERIA_BAJA),
            }),
            { gnss_fix: false },
          ),
        );
        await page.waitForTimeout(300);
        await salud(page).screenshot({ path: `${CAPTURAS}/salud-fallas-${medida}.png` });
      });

      test("una falla", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, conFlags(nominalEn("demeter", T_DESCENSO), { ekf_ok: false }));
        await page.waitForTimeout(300);
        await salud(page).screenshot({ path: `${CAPTURAS}/salud-una-falla-${medida}.png` });
      });

      test("esperando armado", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, conGo(enPreflight("demeter"), false, ANTES_DE_ARMAR));
        await page.waitForTimeout(300);
        await salud(page).screenshot({ path: `${CAPTURAS}/salud-esperando-armado-${medida}.png` });
      });

      test("el cohete negó el armado", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, conGo(enPreflight("demeter"), false, CHECKLIST_ARMADO));
        await page.waitForTimeout(300);
        await salud(page).screenshot({ path: `${CAPTURAS}/salud-no-go-${medida}.png` });
      });

      test("el cohete respondió APTO", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(
          page,
          conGo(
            enPreflight("demeter"),
            true,
            CHECKLIST_ARMADO.map((c) => ({ ...c, ok: true })),
          ),
        );
        await page.waitForTimeout(300);
        await salud(page).screenshot({ path: `${CAPTURAS}/salud-go-${medida}.png` });
      });
    });
  }
});
