import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import type { Salud, Snapshot } from "../src/contrato/tipos";
import { alimentar, DEV, snapshotDe } from "./mapa_ayudas";

// T-625: Recuperación y Salud del cohete. Se prueba en el servidor de desarrollo (:5174) con
// `?sin_cliente`, inyectando snapshots reales de los escenarios de dev/datos en `datos/api.ts`.
// No hay un escenario con fallas: se arman aquí, sobre el snapshot de un escenario real.
// Las capturas van a docs/07_bitacora/capturas/T-625.
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-625");
mkdirSync(CAPTURAS, { recursive: true });

type Mision = "demeter" | "hermes";
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;

/** Instantes (ms del escenario `nominal`): ver dev/datos/*_nominal.jsonl. */
const T_SIN_FIX = 1_000;
const T_PREFLIGHT_CON_POS = 5_000;
const T_ARMADO = 10_000;
const T_DESCENSO = 40_000;
const BIT_BMP581 = 1;
const BIT_SD = 7;
const BIT_BATERIA_BAJA = 13;

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

/** El snapshot de un escenario con `salud` cambiada. */
function conSalud(base: Snapshot, cambios: Partial<Salud>): Snapshot {
  if (base.salud === null) throw new Error("el escenario no trae salud");
  return { ...base, salud: { ...base.salud, ...cambios } };
}

/** Los snapshots que usan las pruebas, por misión. */
const nominalEn = (m: Mision, t: number) => snapshotDe(m, "nominal", t);
const aterrizado = (m: Mision) => snapshotDe(m, "nominal");

const recuperacion = (page: Page) => page.locator("section#recuperacion");
const salud = (page: Page) => page.locator("section#salud");
const resumen = (page: Page) => salud(page).locator('[data-salud="resumen"]');

test.describe("Recuperación: el punto, el botón, el QR y el vector", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("en descenso: el centro de la elipse con la etiqueta 'estimado' y el enlace de Maps", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    const snap = nominalEn("demeter", T_DESCENSO);
    const elipse = snap.estado?.calc.elipse;
    if (!elipse) throw new Error("el escenario debe traer elipse en el descenso");
    await alimentar(page, snap);

    const r = recuperacion(page);
    await expect(r.locator(".recup-rotulo")).toContainText("Punto de impacto");
    await expect(r.locator(".recup-chip")).toHaveText("estimado");
    // Coma decimal, 7 decimales (lat/lon del contrato) y el símbolo de grados.
    await expect(r.locator('[data-coord="lat"]')).toHaveText(
      `${elipse.lat.toFixed(7).replace(".", ",")}°`,
    );
    await expect(r.locator('[data-coord="lon"]')).toHaveText(
      `${elipse.lon.toFixed(7).replace(".", ",").replace("-", "−")}°`,
    );
    const url = `https://www.google.com/maps/search/?api=1&query=${elipse.lat.toFixed(7)},${elipse.lon.toFixed(7)}`;
    const enlace = r.getByRole("link", { name: "Abrir en Google Maps" });
    await expect(enlace).toHaveAttribute("href", url);
    await expect(enlace).toHaveAttribute("target", "_blank");
    await expect(enlace).toHaveAttribute("rel", /noopener/);
    await expect(r.locator("svg.qr")).toHaveAttribute("data-qr-url", url);
    // El vector: distancia, azimut y la brújula, con el norte arriba.
    await expect(r.locator('[data-vector="distancia"]')).toContainText(/\d+ m/);
    await expect(r.locator('[data-vector="azimut"]')).toContainText(/\d+°/);
    await expect(r.locator("[data-brujula]")).toHaveAttribute("aria-label", /norte arriba/);
    expect(await sinDesborde(page)).toBe(true);
    expect(errores).toEqual([]);
  });

  test("el QR del celular está detrás de un toque y se abre y se cierra", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_DESCENSO));
    const r = recuperacion(page);
    const boton = r.getByRole("button", { name: /QR/ });
    await expect(r.locator(".recup-qr")).toBeHidden();
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await boton.click();
    await expect(r.locator(".recup-qr")).toBeVisible();
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await expect(r.locator("svg.qr")).toBeVisible();
    await boton.click();
    await expect(r.locator(".recup-qr")).toBeHidden();
  });

  test("LANDED: la posición real, sin 'estimado'", async ({ page }) => {
    await abrir(page, "demeter");
    const snap = aterrizado("demeter");
    const pos = snap.estado?.pos;
    expect(snap.estado?.fase).toBe("LANDED");
    if (!pos) throw new Error("LANDED debe traer pos");
    await alimentar(page, snap);
    const r = recuperacion(page);
    await expect(r.locator(".recup-rotulo")).toContainText("Posición del cohete en tierra");
    await expect(r.locator(".recup-chip")).toHaveCount(0);
    await expect(r.locator('[data-coord="lat"]')).toHaveText(
      `${pos.lat.toFixed(7).replace(".", ",")}°`,
    );
  });

  test("sin señal: el LKP en rojo con su antigüedad, que no desaparece (GS-03)", async ({
    page,
  }) => {
    await abrir(page, "demeter");
    const snap = nominalEn("demeter", T_DESCENSO);
    // Sin señal: el último paquete llegó hace 38 s (el reloj local avanza; el estado se queda).
    await alimentar(page, snap, "conectado", 38_000);
    const r = recuperacion(page);
    const rotulo = r.locator(".recup-rotulo");
    await expect(rotulo).toContainText("Última posición conocida");
    await expect(rotulo.locator(".recup-edad")).toContainText(/hace \d+ s/);
    expect(await rotulo.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(255, 77, 94)");
    await expect(r.getByRole("link", { name: "Abrir en Google Maps" })).toBeVisible();
  });

  test("sin posición ni elipse: una frase, sin botón muerto ni QR de null,null", async ({
    page,
  }) => {
    await abrir(page, "demeter");
    // PREFLIGHT sin fix: pos, lkp y elipse son null.
    const snap = nominalEn("demeter", T_SIN_FIX);
    expect(snap.estado?.pos).toBeNull();
    await alimentar(page, snap);
    const r = recuperacion(page);
    await expect(r.locator('[data-recup="vacio"]')).toContainText("sin fix");
    await expect(r.locator("a")).toHaveCount(0);
    await expect(r.locator("svg.qr")).toHaveCount(0);
    await expect(r.getByRole("button", { name: /Copiar|QR/ })).toHaveCount(0);
    expect(await r.innerHTML()).not.toContain("null");
    // El vector, sin dato, se dice con palabras.
    await expect(r.locator('[data-vector="distancia"]')).toContainText("sin dato");
    await expect(r.locator("[data-brujula] polygon")).toHaveCount(0);
  });

  test("sin ningún dato todavía: estado vacío claro", async ({ page }) => {
    await abrir(page, "demeter");
    const r = recuperacion(page);
    await expect(r.locator('[data-recup="vacio"]')).toContainText("Todavía no hay posición");
    await expect(r.locator("a")).toHaveCount(0);
  });

  test("antes de la elipse pero con fix: la posición actual, sin hacerla pasar por estimado", async ({
    page,
  }) => {
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_PREFLIGHT_CON_POS));
    const r = recuperacion(page);
    await expect(r.locator(".recup-rotulo")).toContainText("Posición actual del cohete");
    await expect(r.locator(".recup-chip")).toContainText("sin estimado");
  });
});

test.describe("Copiar las coordenadas", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("con la API del portapapeles: copia lat,lon con punto decimal y avisa", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await abrir(page, "demeter");
    const snap = aterrizado("demeter");
    const pos = snap.estado?.pos;
    if (!pos) throw new Error("LANDED debe traer pos");
    await alimentar(page, snap);
    const r = recuperacion(page);
    await r.getByRole("button", { name: "Copiar" }).click();
    await expect(r.locator(".recup-aviso")).toHaveText("Coordenadas copiadas al portapapeles.");
    await expect(r.getByRole("button", { name: "Copiado" })).toBeVisible();
    const copiado = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiado).toBe(`${pos.lat.toFixed(7)}, ${pos.lon.toFixed(7)}`);
  });

  test("sin la API (página sin HTTPS): usa el respaldo con execCommand", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      const llamadas: string[] = [];
      (window as unknown as { __copias: string[] }).__copias = llamadas;
      document.execCommand = (orden: string) => {
        const el = document.activeElement as HTMLTextAreaElement | null;
        llamadas.push(`${orden}:${el?.value ?? ""}`);
        return true;
      };
    });
    await abrir(page, "demeter");
    const snap = aterrizado("demeter");
    const pos = snap.estado?.pos;
    if (!pos) throw new Error("LANDED debe traer pos");
    await alimentar(page, snap);
    const r = recuperacion(page);
    await r.getByRole("button", { name: "Copiar" }).click();
    await expect(r.locator(".recup-aviso")).toHaveText("Coordenadas copiadas al portapapeles.");
    const copias = await page.evaluate(
      () => (window as unknown as { __copias: string[] }).__copias,
    );
    expect(copias).toEqual([`copy:${pos.lat.toFixed(7)}, ${pos.lon.toFixed(7)}`]);
    // El `<textarea>` del respaldo no se queda en la página.
    await expect(page.locator("textarea")).toHaveCount(0);
  });

  test("si todo falla: avisa y explica cómo copiar a mano", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      document.execCommand = () => false;
    });
    await abrir(page, "demeter");
    await alimentar(page, aterrizado("demeter"));
    const r = recuperacion(page);
    await r.getByRole("button", { name: "Copiar" }).click();
    await expect(r.locator(".recup-aviso")).toContainText("No se pudo copiar solo");
    await expect(r.locator(".recup-aviso")).toContainText("a mano");
  });
});

test.describe("Aterrizado: Recuperación sube al inicio de la página", () => {
  for (const med of MEDIDAS) {
    test(`${med.ancho}x${med.alto}: primera sección del main y sobre el resto`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: med.ancho, height: med.alto });
      const errores = vigilarErrores(page);
      await abrir(page, "demeter");

      // Antes de aterrizar, Recuperación está donde dice 03 §2 (después del mapa).
      await alimentar(page, nominalEn("demeter", T_DESCENSO));
      await expect(page.locator("main.panel")).toHaveAttribute("data-aterrizado", "no");
      expect(
        await page.locator("main.panel > section").evaluateAll((s) => s.map((e) => e.id)),
      ).toEqual([
        "inicio",
        "estado",
        "telemetria",
        "mapa",
        "recuperacion",
        "actitud",
        "graficas",
        "salud",
        "ojos",
        "equipo",
      ]);

      // Con LANDED sube: primer hijo del main, y su borde superior queda sobre el de Inicio.
      await alimentar(page, aterrizado("demeter"));
      await expect(page.locator("main.panel")).toHaveAttribute("data-aterrizado", "si");
      const ids = await page.locator("main.panel > section").evaluateAll((s) => s.map((e) => e.id));
      expect(ids[0]).toBe("recuperacion");
      expect(ids).toHaveLength(10);
      const y = (id: string) =>
        page.locator(`#${id}`).evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
      expect(await y("recuperacion")).toBeLessThan(await y("inicio"));
      expect(await y("inicio")).toBeLessThan(await y("estado"));
      // Después de la cabecera: nada la tapa ni se superpone con Inicio.
      const caja = async (id: string) => page.locator(`#${id}`).boundingBox();
      const rec = await caja("recuperacion");
      const ini = await caja("inicio");
      if (!rec || !ini) throw new Error("faltan las cajas");
      expect(rec.y + rec.height).toBeLessThanOrEqual(ini.y + 1);
      // El resto de la página no se rompió: sin desborde, sin huecos que se pisen, sin errores.
      expect(await sinDesborde(page)).toBe(true);
      await expect(page.locator("section#salud")).toBeVisible();
      expect(errores).toEqual([]);
    });
  }

  test("1440x900: Recuperación a todo el ancho arriba, y Salud ocupa su lugar sin pisar nada", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page, "demeter");
    await alimentar(page, aterrizado("demeter"));
    const caja = async (id: string) => {
      const c = await page.locator(`#${id}`).boundingBox();
      if (!c) throw new Error(`sin caja: ${id}`);
      return c;
    };
    const [rec, ini, est, map, sal, act] = await Promise.all(
      ["recuperacion", "inicio", "estado", "mapa", "salud", "actitud"].map(caja),
    );
    if (!rec || !ini || !est || !map || !sal || !act) throw new Error("faltan cajas");
    // Recuperación es el ancho de Inicio.
    expect(Math.abs(rec.width - ini.width)).toBeLessThan(2);
    // Las tres columnas de la fila de datos empiezan bajo Inicio y no se superponen.
    for (const c of [est, map, sal]) expect(c.y).toBeGreaterThanOrEqual(ini.y + ini.height - 1);
    expect(est.x + est.width).toBeLessThanOrEqual(map.x + 1);
    expect(map.x + map.width).toBeLessThanOrEqual(sal.x + 1);
    // Actitud sigue en la columna 3, bajo Salud.
    expect(act.y).toBeGreaterThanOrEqual(sal.y + sal.height - 1);
  });

  test("la navegación y las anclas siguen funcionando con la sección arriba", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrir(page, "demeter");
    await alimentar(page, aterrizado("demeter"));
    const nav = page.getByRole("navigation", { name: "Secciones de la página" });
    for (const [texto, id] of [
      ["Mapa", "mapa"],
      ["Datos", "telemetria"],
      ["Equipo", "equipo"],
      ["Estado", "estado"],
    ] as const) {
      await nav.getByRole("link", { name: texto }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
  });

  test("en Hermes también", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrir(page, "hermes");
    await alimentar(page, aterrizado("hermes"));
    const ids = await page.locator("main.panel > section").evaluateAll((s) => s.map((e) => e.id));
    expect(ids[0]).toBe("recuperacion");
    expect(ids).not.toContain("ojos");
  });
});

test.describe("QR visible al lado en el portátil", () => {
  test("a 1440 px el QR se ve sin tocar nada y el botón del QR no existe a la vista", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_DESCENSO));
    const r = recuperacion(page);
    await expect(r.locator("svg.qr")).toBeVisible();
    await expect(r.getByRole("button", { name: /QR/ })).toBeHidden();
    // Es un QR de verdad: cuadrado y con módulos.
    const caja = await r.locator("svg.qr").boundingBox();
    expect(caja && Math.abs(caja.width - caja.height) < 1).toBe(true);
    expect(await r.locator("svg.qr path.qr-modulos").getAttribute("d")).toMatch(/^M\d+ \d+h\d+v1/);
  });
});

test.describe("Salud del cohete", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("sin `salud` todavía: un estado vacío claro", async ({ page }) => {
    await abrir(page, "demeter");
    await expect(resumen(page)).toContainText("Sin datos de salud todavía");
    await expect(salud(page).locator("details")).toHaveCount(0);
  });

  test("nominal: 'Todo en orden' y el detalle trae todos los grupos", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, aterrizado("demeter"));
    await expect(resumen(page)).toContainText("Todo en orden");
    await expect(salud(page)).toHaveAttribute("data-nivel", "ok");
    const detalle = salud(page).locator("details");
    await expect(detalle).not.toHaveAttribute("open", "");
    await detalle.locator("summary").click();
    await expect(detalle).toHaveAttribute("open", "");
    for (const titulo of [
      "Sensores",
      "Sistemas",
      "Calibraciones",
      "Navegación",
      "Enlace",
      "Batería",
      "Tarjeta SD",
      "Temperatura",
    ]) {
      await expect(detalle.getByRole("heading", { name: titulo })).toBeVisible();
    }
    await expect(detalle.locator('[data-fila="temp-pi"]')).toContainText("°C");
    await expect(detalle.locator('[data-fila="sd"]')).toContainText("MB");
    await expect(detalle.locator('[data-fila="bateria-v"]')).toContainText("V");
    await expect(detalle.locator('[data-fila="hacc"]')).toContainText("m");
    await expect(detalle.locator('[data-falla="si"]')).toHaveCount(0);
  });

  test("con fallas: el resumen y el detalle cambian, y vuelven cuando se arreglan", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    const base = nominalEn("demeter", T_DESCENSO);
    await alimentar(page, base);
    await expect(resumen(page)).toContainText("Todo en orden");

    // Un sensor en falla.
    await alimentar(page, conSalud(base, { fallas: ["BMP581"], fallas_bits: 1 << BIT_BMP581 }));
    await expect(resumen(page)).toContainText("Falla en un sensor");
    await expect(salud(page)).toHaveAttribute("data-nivel", "falla");
    await expect(salud(page).locator('[data-salud="fallas"]')).toContainText("BMP581");
    const detalle = salud(page).locator("details");
    await detalle.locator("summary").click();
    await expect(detalle.locator('[data-fila="bit-BMP581"] [data-falla="si"]')).toContainText(
      "En falla",
    );
    await expect(detalle.locator('[data-fila="bit-LSM6DSO32"] [data-falla="no"]')).toContainText(
      "Sin falla",
    );

    // Dos fallas.
    await alimentar(
      page,
      conSalud(base, { fallas: ["BMP581", "SD"], fallas_bits: (1 << BIT_BMP581) | (1 << BIT_SD) }),
    );
    await expect(resumen(page)).toContainText("2 fallas");
    await expect(detalle.locator('[data-falla="si"]')).toHaveCount(2);

    // Se arreglan.
    await alimentar(page, base);
    await expect(resumen(page)).toContainText("Todo en orden");
    await expect(detalle.locator('[data-falla="si"]')).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test("avisos: calibraciones sin terminar", async ({ page }) => {
    await abrir(page, "demeter");
    // El principio del escenario: el cohete en la rampa, calibrando.
    await alimentar(page, nominalEn("demeter", T_SIN_FIX));
    await expect(salud(page)).toHaveAttribute("data-nivel", "aviso");
    await expect(resumen(page)).toContainText(/\d+ avisos?/);
    await expect(salud(page).locator('[data-aviso="calibraciones"]')).toContainText(
      "Calibraciones sin terminar",
    );
    await salud(page).locator("summary").click();
    await expect(salud(page).locator('[data-completa="no"]').first()).toContainText("En proceso");
  });

  test("Go/No-Go: en PREFLIGHT y ARMED con sus condiciones; no en descenso", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_SIN_FIX));
    const chip = salud(page).locator('[data-salud="go-nogo"]');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("data-go", "no");
    await expect(chip).toContainText(/NO-GO · falta/);
    expect(await chip.locator("li").count()).toBeGreaterThan(3);
    await expect(chip.locator('li[data-ok="no"]').first()).toContainText("no cumple");

    // ARMED, ya con todo en verde (el escenario real).
    await alimentar(page, nominalEn("demeter", T_ARMADO));
    await expect(chip).toHaveAttribute("data-go", "si");
    await expect(chip).toContainText("GO · Listo para armar");

    await alimentar(page, nominalEn("demeter", T_DESCENSO));
    await expect(salud(page).locator('[data-salud="go-nogo"]')).toHaveCount(0);
  });

  test("batería baja: solo la falla del bit 13; la web no recalcula con el %", async ({ page }) => {
    await abrir(page, "demeter");
    const base = nominalEn("demeter", T_DESCENSO);
    const baja = { ...base, estado: base.estado && { ...base.estado, bat_pct: 5 } };
    await alimentar(page, baja);
    await expect(resumen(page)).toContainText("Todo en orden");
    await expect(salud(page).locator('[data-aviso="bateria"]')).toHaveCount(0);
    await salud(page).locator("summary").click();
    await expect(salud(page).locator('[data-fila="bateria-pct"]')).toContainText("5");

    await alimentar(
      page,
      conSalud(baja, { fallas: ["Batería baja"], fallas_bits: 1 << BIT_BATERIA_BAJA }),
    );
    await expect(resumen(page)).toContainText("Falla en un sistema");
    await expect(salud(page).locator('[data-salud="fallas"]')).toContainText("Batería baja");
    await expect(salud(page).locator('[data-fila="bateria-v"]')).toContainText("V");
  });

  test("Hermes: sin fila de temperatura de la Pi ni del UART del VisionPack", async ({ page }) => {
    await abrir(page, "hermes");
    await alimentar(page, aterrizado("hermes"));
    await salud(page).locator("summary").click();
    await expect(salud(page).locator('[data-fila="temp-esp"]')).toBeVisible();
    await expect(salud(page).locator('[data-fila="temp-pi"]')).toHaveCount(0);
    await expect(salud(page).locator('[data-fila="bit-UART del VisionPack"]')).toHaveCount(0);
  });

  test("datos viejos: el resumen dice hace cuánto fue el último dato", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, nominalEn("demeter", T_DESCENSO), "conectado", 20_000);
    await expect(salud(page).locator(".salud-edad")).toContainText(/Último dato hace \d+ s/);
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
        if (med.ancho < 1024) await recuperacion(page).getByRole("button", { name: /QR/ }).click();
        await recuperacion(page).scrollIntoViewIfNeeded();
        await recuperacion(page).screenshot({
          path: `${CAPTURAS}/recuperacion-nominal-${medida}.png`,
        });
        await salud(page).screenshot({ path: `${CAPTURAS}/salud-nominal-${medida}.png` });
      });

      test("fallas (incluida la batería baja, bit 13)", async ({ page }) => {
        await abrir(page, "demeter");
        const base = nominalEn("demeter", T_DESCENSO);
        await alimentar(
          page,
          conSalud(
            { ...base, estado: base.estado && { ...base.estado, bat_pct: 41 } },
            {
              fallas: ["BMP581", "SD", "Batería baja"],
              fallas_bits: (1 << BIT_BMP581) | (1 << BIT_SD) | (1 << BIT_BATERIA_BAJA),
            },
          ),
        );
        await salud(page).locator("summary").click();
        await page.waitForTimeout(300);
        await salud(page).screenshot({ path: `${CAPTURAS}/salud-fallas-${medida}.png` });
      });

      test("preflight con Go/No-Go", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, nominalEn("demeter", T_SIN_FIX));
        await page.waitForTimeout(300);
        await salud(page).screenshot({ path: `${CAPTURAS}/salud-preflight-${medida}.png` });
      });

      test("aterrizado: Recuperación arriba", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, aterrizado("demeter"));
        await page.waitForTimeout(300);
        if (med.ancho < 1024) await recuperacion(page).getByRole("button", { name: /QR/ }).click();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${CAPTURAS}/aterrizado-${medida}.png` });
        await recuperacion(page).screenshot({
          path: `${CAPTURAS}/recuperacion-aterrizado-${medida}.png`,
        });
      });

      test("sin señal: el LKP", async ({ page }) => {
        await abrir(page, "demeter");
        await alimentar(page, nominalEn("demeter", T_DESCENSO), "conectado", 38_000);
        await page.waitForTimeout(300);
        await recuperacion(page).screenshot({ path: `${CAPTURAS}/recuperacion-lkp-${medida}.png` });
      });
    });
  }
});
