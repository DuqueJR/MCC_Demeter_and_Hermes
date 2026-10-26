import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { alimentar, DEV, snapshotDe } from "./mapa_ayudas";

// T-624: Estado de la misión, Telemetría y banner de alarma. Se prueba en el servidor de desarrollo
// (:5174) con `?sin_cliente`, inyectando snapshots reales de los escenarios de dev/datos en
// `datos/api.ts` (el reloj local lo mueve la prueba). Las pruebas contra el repetidor en vivo están
// en en_vivo.spec.ts, que comparte el puerto del repetidor.
// Las capturas van a docs/07_bitacora/capturas/T-624.
const CAPTURAS = resolve(import.meta.dirname, "../../../docs/07_bitacora/capturas/T-624");
mkdirSync(CAPTURAS, { recursive: true });

const MISIONES = ["demeter", "hermes"] as const;
type Mision = (typeof MISIONES)[number];
const MEDIDAS = [
  { ancho: 390, alto: 844 },
  { ancho: 1440, alto: 900 },
] as const;

/** Instantes (ms del escenario `nominal`) que importan: ver dev/datos/*_nominal.jsonl. */
const T_ARMADO = 10_000;
const T_DESPEGUE = 19_000;
const T_INERCIA = 25_000;
/** Después de la eyección (T+ ~9-10 s) y antes del apogeo; el de Hermes es más corto. */
const T_ANTES_DEL_APOGEO = { demeter: 29_000, hermes: 27_500 } as const;
const T_DESCENSO = 40_000;
/** Del escenario `descenso_rapido`: la alarma se activa en t_rel 30,1 s y se apaga al aterrizar. */
const T_ALARMA_ACTIVA = 40_000;

const ROJO_ALARMA = "rgb(255, 77, 94)";
const GRIS_SIN_DATO = "rgb(138, 143, 163)";

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

/**
 * Abre la página con el reloj del navegador detenido: los temporizadores (el sostener del banner)
 * solo avanzan cuando la prueba lo manda con `page.clock.runFor`. Sin esto el reloj sigue al real.
 */
const INICIO_RELOJ = new Date("2026-11-08T12:00:00Z");
const MARGEN_PAUSA_MS = 10 * 60 * 1000;
async function abrirConRelojFijo(page: Page, mision: Mision) {
  await page.clock.install({ time: INICIO_RELOJ });
  await abrir(page, mision);
  // Un margen grande: tras `install` el reloj sigue al real y, con la máquina cargada, un margen de
  // 1 s ya había pasado ("Cannot fast-forward to the past").
  await page.clock.pauseAt(new Date(INICIO_RELOJ.getTime() + MARGEN_PAUSA_MS));
}

/** Los objetivos como `[id, encendido]`, en el orden de la página. */
const objetivos = (page: Page) =>
  page
    .locator("#estado .objetivo")
    .evaluateAll((els) =>
      els.map((e) => [e.getAttribute("data-objetivo"), e.getAttribute("data-encendido") === "si"]),
    );
/** Los pasos de la línea de fases como `[id, situación]`. */
const pasos = (page: Page) =>
  page
    .locator("#estado .paso")
    .evaluateAll((els) =>
      els.map((e) => [e.getAttribute("data-paso"), e.getAttribute("data-situacion")]),
    );
const horaDe = (page: Page, id: string) => page.locator(`#estado .paso[data-paso="${id}"] .paso-t`);
const objetivoDe = (page: Page, id: string) =>
  page.locator(`#estado .objetivo[data-objetivo="${id}"]`);

test.describe("el vuelo nominal enciende la línea de fases y los objetivos en orden", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const mision of MISIONES) {
    test(`${mision}: de la rampa al aterrizaje, cada uno con su T+`, async ({ page }) => {
      const errores = vigilarErrores(page);
      await abrir(page, mision);

      // Sin datos: todo pendiente.
      await expect(page.locator("#estado .estado-t-valor")).toHaveText("T+ --:--");
      expect((await pasos(page)).every(([, s]) => s === "pendiente")).toBe(true);
      expect((await objetivos(page)).every(([, on]) => on === false)).toBe(true);

      // En la rampa (ARMED): la rampa es el paso actual y no hay objetivos.
      await alimentar(page, snapshotDe(mision, "nominal", T_ARMADO));
      expect(await pasos(page)).toEqual([
        ["rampa", "actual"],
        ["despegue", "pendiente"],
        ["inercia", "pendiente"],
        ["apogeo", "pendiente"],
        ["paracaidas", "pendiente"],
        ["tierra", "pendiente"],
      ]);
      expect((await objetivos(page)).every(([, on]) => on === false)).toBe(true);
      await expect(page.locator("#estado .estado-fase-titulo")).toHaveText("Listo para despegar");

      // Despegue: se enciende el despegue (y, en Deméter, las cámaras), con T+ 00:00.
      await alimentar(page, snapshotDe(mision, "nominal", T_DESPEGUE));
      expect((await pasos(page)).slice(0, 3)).toEqual([
        ["rampa", "hecho"],
        ["despegue", "actual"],
        ["inercia", "pendiente"],
      ]);
      await expect(horaDe(page, "despegue")).toHaveText("T+ 00:00");
      await expect(objetivoDe(page, "despegue")).toHaveAttribute("data-encendido", "si");
      await expect(objetivoDe(page, "despegue").locator(".objetivo-t")).toHaveText("T+ 00:00");
      await expect(objetivoDe(page, "fin_combustion")).toHaveAttribute("data-encendido", "no");

      // Fin de la combustión (inercia).
      await alimentar(page, snapshotDe(mision, "nominal", T_INERCIA));
      await expect(horaDe(page, "inercia")).toHaveText(/^T\+ 00:0[12]$/);
      await expect(objetivoDe(page, "fin_combustion")).toHaveAttribute("data-encendido", "si");
      await expect(objetivoDe(page, "eyeccion")).toHaveAttribute("data-encendido", "no");

      // Eyección del paracaídas, antes del apogeo.
      await alimentar(page, snapshotDe(mision, "nominal", T_ANTES_DEL_APOGEO[mision]));
      await expect(objetivoDe(page, "eyeccion")).toHaveAttribute("data-encendido", "si");
      await expect(objetivoDe(page, "eyeccion").locator(".objetivo-t")).toHaveText(
        /^T\+ 00:(08|09|10)$/,
      );
      await expect(objetivoDe(page, "apogeo")).toHaveAttribute("data-encendido", "no");

      // Descenso con paracaídas: apogeo hecho, con su altura y su T+.
      await alimentar(page, snapshotDe(mision, "nominal", T_DESCENSO));
      expect(await pasos(page)).toEqual([
        ["rampa", "hecho"],
        ["despegue", "hecho"],
        ["inercia", "hecho"],
        ["apogeo", "hecho"],
        ["paracaidas", "actual"],
        ["tierra", "pendiente"],
      ]);
      await expect(horaDe(page, "apogeo")).toHaveText(/^T\+ 00:1[01]$/);
      await expect(objetivoDe(page, "apogeo").locator(".objetivo-dato")).toContainText(
        mision === "demeter" ? "669" : "502",
      );
      await expect(objetivoDe(page, "aterrizaje")).toHaveAttribute("data-encendido", "no");
      await expect(page.locator("#estado .estado-fase-titulo")).toHaveText(
        "Bajando con paracaídas",
      );

      // Aterrizaje: todo encendido y la línea completa.
      await alimentar(page, snapshotDe(mision, "nominal"));
      expect((await pasos(page)).map(([, s]) => s)).toEqual([
        "hecho",
        "hecho",
        "hecho",
        "hecho",
        "hecho",
        "actual",
      ]);
      expect((await objetivos(page)).every(([, on]) => on === true)).toBe(true);
      await expect(horaDe(page, "tierra")).toHaveText(/^T\+ 01:(1[0-9]|2[0-9])$/);

      expect(await sinDesborde(page)).toBe(true);
      expect(errores).toEqual([]);
    });
  }

  test("'Cámaras grabando' solo está en Deméter", async ({ page }) => {
    await abrir(page, "hermes");
    await alimentar(page, snapshotDe("hermes", "nominal", T_DESCENSO));
    expect((await objetivos(page)).map(([id]) => id)).toEqual([
      "despegue",
      "fin_combustion",
      "eyeccion",
      "apogeo",
      "aterrizaje",
    ]);
    await abrir(page, "demeter");
    await alimentar(page, snapshotDe("demeter", "nominal", T_DESCENSO));
    expect((await objetivos(page)).map(([id]) => id)).toEqual([
      "despegue",
      "fin_combustion",
      "eyeccion",
      "apogeo",
      "aterrizaje",
      "camaras",
    ]);
    await expect(objetivoDe(page, "camaras")).toHaveAttribute("data-encendido", "si");
  });

  test("el estado de cada objetivo se dice con palabras, no solo con color", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, snapshotDe("demeter", "nominal", T_INERCIA));
    await expect(objetivoDe(page, "despegue").locator(".objetivo-estado")).toContainText("Logrado");
    await expect(objetivoDe(page, "apogeo").locator(".objetivo-estado")).toContainText("Pendiente");
    await expect(page.locator("#estado .paso[data-paso='tierra'] .paso-t")).toHaveText("pendiente");
  });
});

test.describe("sin transmisión todavía", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const mision of MISIONES) {
    test(`${mision}: dice que la transmisión empieza el día del lanzamiento, sin botón muerto`, async ({
      page,
    }) => {
      await abrir(page, mision);
      await alimentar(page, snapshotDe(mision, "nominal", 0));
      await expect(page.locator(".indicador")).toContainText("Sin transmisión");
      await expect(page.locator("#estado .estado-aviso")).toHaveText(
        "La transmisión en vivo empieza el día del lanzamiento",
      );
      // La simulación solo la decide el servidor (meta.modo): no hay un botón que no pueda funcionar.
      await expect(page.getByRole("button", { name: /simulación/i })).toHaveCount(0);
      await expect(page.locator("#telemetria [data-celda='altitud'] dd")).toHaveText("sin dato");
      await expect(page.locator("#telemetria [data-celda='aceleracion'] dd")).toHaveText(
        "sin dato",
      );
      await expect(page.locator("#telemetria .telemetria-edad")).toHaveCount(0);
      expect(await sinDesborde(page)).toBe(true);
    });
  }
});

test.describe("telemetría", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("cada número con su unidad, coma decimal y números tabulares", async ({ page }) => {
    const snap = snapshotDe("demeter", "nominal", T_DESCENSO);
    const est = snap.estado;
    if (!est?.vel) throw new Error("el escenario no trae estado con velocidad");
    await abrir(page, "demeter");
    await alimentar(page, snap);

    const celda = (c: string) => page.locator(`#telemetria [data-celda='${c}']`);
    const esperado = (v: number, d: number) => v.toFixed(d).replace(".", ",").replace("-", "−");
    await expect(celda("altitud").locator(".num")).toHaveText(esperado(est.pos?.alt_agl_m ?? 0, 0));
    await expect(celda("altitud").locator(".unidad")).toHaveText("m");
    await expect(celda("vertical").locator(".num")).toHaveText(esperado(est.vel.u_ms, 1));
    await expect(celda("vertical").locator(".unidad")).toHaveText("m/s");
    await expect(celda("total").locator(".num")).toHaveText(esperado(est.vel.total_ms, 1));
    await expect(celda("aceleracion").locator("[data-eje='x'] .num")).toHaveText(
      esperado(est.acc_g.x, 2),
    );
    await expect(celda("aceleracion").locator("[data-eje='z'] .unidad")).toHaveText("g");
    // Apogeo fijo, con su T+.
    await expect(celda("apogeo").locator(".num")).toHaveText("669");
    await expect(celda("apogeo").locator(".apogeo-t")).toHaveText(/^T\+ 00:1[01]$/);
    // Cae: flecha hacia abajo.
    await expect(celda("vertical").locator(".flecha")).toHaveAttribute("data-sentido", "baja");

    // Coma decimal siempre: ningún número de la sección usa punto.
    const textos = await page.locator("#telemetria .num").allTextContents();
    expect(textos.every((t) => !t.includes("."))).toBe(true);
    // Tabulares: lo pone el body (comun.css) y todos los números lo heredan.
    const tabular = await page
      .locator("#telemetria .num")
      .first()
      .evaluate((el) => getComputedStyle(el).fontVariantNumeric);
    expect(tabular).toContain("tabular-nums");
  });

  test("antes del apogeo, el apogeo dice 'aún no'", async ({ page }) => {
    await abrir(page, "hermes");
    await alimentar(page, snapshotDe("hermes", "nominal", T_INERCIA));
    await expect(page.locator("#telemetria [data-celda='apogeo'] dd")).toHaveText("aún no");
    await expect(page.locator("#telemetria [data-celda='vertical'] .flecha")).toHaveAttribute(
      "data-sentido",
      "sube",
    );
  });

  test("dato con edad >= WEB_DATO_VIEJO_S: gris de 'sin dato' y su antigüedad", async ({
    page,
  }) => {
    await abrir(page, "demeter");
    const snap = snapshotDe("demeter", "nominal", T_DESCENSO);
    const color = (sel: string) =>
      page
        .locator(sel)
        .first()
        .evaluate((el) => getComputedStyle(el).color);

    // Fresco (< 2 s): colores normales y sin aviso.
    await alimentar(page, snap, "conectado", 1000);
    await expect(page.locator("#telemetria")).toHaveAttribute("data-viejo", "no");
    await expect(page.locator("#telemetria .telemetria-edad")).toHaveCount(0);
    expect(await color("#telemetria [data-celda='total'] .num")).not.toBe(GRIS_SIN_DATO);

    // Con 3 s de antigüedad (señal débil): todo en gris y con la antigüedad.
    await alimentar(page, snap, "conectado", 3000);
    await expect(page.locator("#telemetria")).toHaveAttribute("data-viejo", "si");
    await expect(page.locator("#telemetria .telemetria-edad")).toContainText(
      "Último dato hace 3 s",
    );
    expect(await color("#telemetria [data-celda='total'] .num")).toBe(GRIS_SIN_DATO);
    expect(await color("#telemetria [data-celda='altitud'] .num")).toBe(GRIS_SIN_DATO);
    expect(await color("#telemetria [data-celda='aceleracion'] .num")).toBe(GRIS_SIN_DATO);
  });

  test("sin señal: la altitud queda en rojo con su pin y el resto, en gris", async ({ page }) => {
    await abrir(page, "demeter");
    await alimentar(page, snapshotDe("demeter", "nominal", T_DESCENSO), "conectado", 38_000);
    await expect(page.locator(".indicador")).toContainText("Sin señal");
    const alt = page.locator("#telemetria [data-celda='altitud']");
    await expect(alt).toHaveClass(/lkp/);
    await expect(alt.locator("svg")).toHaveCount(1); // el pin
    await expect(alt.locator(".altitud-nota")).toHaveText("última conocida");
    expect(await alt.locator(".num").evaluate((el) => getComputedStyle(el).color)).toBe(
      ROJO_ALARMA,
    );
    await expect(page.locator("#telemetria .telemetria-edad")).toContainText("hace 3");
  });
});

test.describe("banner de alarma de descenso", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("sale con descenso_rapido, fijo bajo la barra, y no sale en el vuelo nominal", async ({
    page,
  }) => {
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    await alimentar(page, snapshotDe("demeter", "nominal", T_DESCENSO));
    await expect(page.locator(".banner-alarma")).toHaveCount(0);

    await alimentar(page, snapshotDe("demeter", "descenso_rapido", T_ALARMA_ACTIVA));
    const banner = page.locator(".banner-alarma");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Descenso rápido");
    await expect(banner).toContainText("m/s");
    await expect(banner).toHaveAttribute("role", "status");
    expect(await banner.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(ROJO_ALARMA);

    // Está dentro de la cabecera fija, justo bajo la barra de misión, y no se va al desplazar.
    const caja = async () => ({
      barra: await page.locator(".barra").boundingBox(),
      banner: await banner.boundingBox(),
    });
    const antes = await caja();
    expect(
      antes.barra && antes.banner && antes.banner.y >= antes.barra.y + antes.barra.height - 1,
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 1500));
    const despues = await caja();
    expect(despues.banner?.y).toBe(antes.banner?.y);
    expect(await sinDesborde(page)).toBe(true);
    expect(errores).toEqual([]);
  });

  test("sigue WEB_ALARMA_SOSTENER_S (10 s) después de que la alarma se apaga", async ({ page }) => {
    await abrirConRelojFijo(page, "demeter");
    await alimentar(page, snapshotDe("demeter", "descenso_rapido", T_ALARMA_ACTIVA));
    await expect(page.locator(".banner-alarma")).toBeVisible();

    // La alarma se apaga (misma situación, `descenso_rapido: false`).
    const apagada = snapshotDe("demeter", "nominal", T_DESCENSO);
    await alimentar(page, apagada);
    await expect(page.locator(".banner-alarma")).toBeVisible();
    await expect(page.locator(".banner-alarma")).toContainText("la alarma terminó");

    await page.clock.runFor(9_900);
    await expect(page.locator(".banner-alarma")).toBeVisible();
    await page.clock.runFor(200);
    await expect(page.locator(".banner-alarma")).toHaveCount(0);
  });

  test("si la alarma vuelve antes del plazo, el banner no parpadea ni se va", async ({ page }) => {
    await abrirConRelojFijo(page, "demeter");
    const activa = snapshotDe("demeter", "descenso_rapido", T_ALARMA_ACTIVA);
    await alimentar(page, activa);
    await alimentar(page, snapshotDe("demeter", "nominal", T_DESCENSO));
    await page.clock.runFor(6_000);
    await alimentar(page, activa);
    await expect(page.locator(".banner-alarma")).not.toContainText("la alarma terminó");
    await page.clock.runFor(30_000);
    await expect(page.locator(".banner-alarma")).toBeVisible();
  });
});

test.describe("capturas de T-624", () => {
  for (const mision of MISIONES) {
    for (const med of MEDIDAS) {
      const medida = `${med.ancho}x${med.alto}`;
      test.describe(`${mision} ${medida}`, () => {
        test.use({ viewport: { width: med.ancho, height: med.alto } });

        const capturar = async (page: Page, nombre: string) => {
          await page.screenshot({
            path: `${CAPTURAS}/${mision}-${nombre}-${medida}.png`,
            fullPage: true,
          });
        };

        test("nominal: objetivos encendidos en orden", async ({ page }) => {
          await abrir(page, mision);
          await alimentar(page, snapshotDe(mision, "nominal", T_DESCENSO));
          await expect(objetivoDe(page, "apogeo")).toHaveAttribute("data-encendido", "si");
          expect(await sinDesborde(page)).toBe(true);
          await capturar(page, "nominal");
        });

        test("descenso_rapido: banner de alarma", async ({ page }) => {
          await abrir(page, mision);
          await alimentar(page, snapshotDe(mision, "descenso_rapido", T_ALARMA_ACTIVA));
          await expect(page.locator(".banner-alarma")).toBeVisible();
          expect(await sinDesborde(page)).toBe(true);
          await capturar(page, "descenso_rapido");
        });

        test("sin transmisión todavía", async ({ page }) => {
          await abrir(page, mision);
          await alimentar(page, snapshotDe(mision, "nominal", 0));
          await expect(page.locator("#estado .estado-aviso")).toBeVisible();
          expect(await sinDesborde(page)).toBe(true);
          await capturar(page, "sin_transmision");
        });
      });
    }
  }
});
