import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { PNG } from "pngjs";
import { MAPA_3D_PITCH, MAPA_3D_PITCH_MAX } from "../src/mapa/constantes";
import { apiColgada, esperarPintado } from "./api_colgada";
import { alimentar, DEV, reposos, snapshotDe } from "./mapa_ayudas";

// T-656 (D-W23): la vista 3D opcional del mapa: terreno con relieve, trayectoria como línea fina en el
// aire y la caída estimada sobre el terreno. Arranca siempre en 2D; sin relieve el botón no aparece.
// Se prueba en el servidor de desarrollo (:5174), que deja inyectar un snapshot en `datos/api.ts`.
const RUTA_RELIEVE = resolve(import.meta.dirname, "../public/mapas/relieve/relieve.json");
const CAPTURAS = resolve(import.meta.dirname, "capturas/T-656");
mkdirSync(CAPTURAS, { recursive: true });

test.skip(!existsSync(RUTA_RELIEVE), "no hay public/mapas/relieve/ (npm run relieve)");

const MISIONES = ["demeter", "hermes"] as const;
const MEDIDAS = [
  { nombre: "celular", ancho: 390, alto: 844 },
  { nombre: "escritorio", ancho: 1440, alto: 900 },
] as const;
/** Cuántas veces se intenta guardar una captura. */
const INTENTOS_CAPTURA = 6;
/** Alto de la cabecera fija de la página de misión, para las capturas. */
const ALTO_CABECERA_PX = 140;
/** En vuelo (con trayectoria y elipse) y ya aterrizado, según el escenario nominal. */
const T_DESCENSO_MS = 70_000;
const T_ATERRIZADO_MS = 110_000;
/** Cuánto tarda MapLibre en dibujar con relieve en 3D en Chromium sin GPU (WebGL por software). */
const TIEMPO_DIBUJO_MS = 60_000;
/** Píxeles que pueden cambiar de tono entre dos capturas "iguales" (el ruido de la cámara es de ~12). */
const MAX_PIXELES_DISTINTOS = 100;
/** Cuántos píxeles distintos hay entre dos capturas PNG del mismo tamaño. */
function pixelesDistintos(a: Buffer, b: Buffer): number {
  const [pa, pb] = [PNG.sync.read(a), PNG.sync.read(b)];
  if (pa.width !== pb.width || pa.height !== pb.height) return Number.POSITIVE_INFINITY;
  let n = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    if (
      pa.data[i] !== pb.data[i] ||
      pa.data[i + 1] !== pb.data[i + 1] ||
      pa.data[i + 2] !== pb.data[i + 2]
    ) {
      n++;
    }
  }
  return n;
}
/** Cuánto puede diferir la inclinación publicada de la pedida, en grados. */
const EPS_GRADOS = 1;

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

const lienzo = (page: Page) => page.locator(".mapa-lienzo");
const boton3d = (page: Page) => page.locator('[data-mapa-boton="3d"]');
const atributo = (page: Page, nombre: string) => lienzo(page).getAttribute(nombre);
const numeroDe = async (page: Page, nombre: string) => Number(await atributo(page, nombre));

/** Abre la misión en desarrollo, llega al mapa y espera a que el relieve esté cargado. */
async function abrir(page: Page, mision: (typeof MISIONES)[number]) {
  await page.goto(`${DEV}/${mision}/?sin_cliente`);
  await page.locator("#mapa").scrollIntoViewIfNeeded();
  await expect(lienzo(page)).toHaveAttribute("data-mapa-listo", "1");
  await expect(lienzo(page)).toHaveAttribute("data-mapa-relieve", "activo");
}

/** Inyecta un tramo del escenario nominal y espera a que se dibuje. */
async function volar(page: Page, mision: (typeof MISIONES)[number], hastaMs = T_DESCENSO_MS) {
  const antes = await reposos(page);
  await alimentar(page, snapshotDe(mision, "nominal", hastaMs));
  await expect.poll(() => reposos(page), { timeout: TIEMPO_DIBUJO_MS }).toBeGreaterThan(antes);
}

/** Espera a que MapLibre termine de dibujar después de `accion`. */
async function dibujado(page: Page, accion: () => Promise<void>) {
  const antes = await reposos(page);
  await accion();
  await expect.poll(() => reposos(page), { timeout: TIEMPO_DIBUJO_MS }).toBeGreaterThan(antes);
}

/** Entra en 3D y espera a que la cámara termine de inclinarse y el mapa de dibujar. */
async function entrar3d(page: Page) {
  // El relieve ya cargado: así el primer dibujo en 3D no se mezcla con la descarga de las teselas.
  await expect(lienzo(page)).toHaveAttribute("data-mapa-relieve-cargado", "1", { timeout: 45_000 });
  await dibujado(page, () => boton3d(page).click());
  await expect(lienzo(page)).toHaveAttribute("data-mapa-3d", "true");
  await expect
    .poll(() => numeroDe(page, "data-mapa-pitch"))
    .toBeGreaterThan(MAPA_3D_PITCH - EPS_GRADOS);
  await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "activo");
  await page.waitForTimeout(1500); // las teselas del terreno y el encuadre terminan de asentarse
}

/** Deja la sección del mapa justo debajo de la cabecera fija, sin animación (la página tiene `scroll-behavior`). */
async function ponerSeccionBajoLaCabecera(page: Page) {
  await page.evaluate((alto) => {
    const arriba = (document.querySelector("#mapa")?.getBoundingClientRect().top ?? 0) + scrollY;
    scrollTo({ top: arriba - alto, behavior: "instant" });
  }, ALTO_CABECERA_PX);
}

async function capturarEn(page: Page, ruta: string) {
  await ponerSeccionBajoLaCabecera(page);
  const imagen = await page.locator("#mapa").screenshot();
  // En Windows el archivo puede estar abierto un momento por otro programa (un visor de imágenes, el
  // antivirus): se reintenta en vez de fallar la prueba por una captura.
  for (let intento = 1; ; intento++) {
    try {
      writeFileSync(ruta, imagen);
      return;
    } catch (e) {
      if (intento >= INTENTOS_CAPTURA) throw e;
      await page.waitForTimeout(500);
    }
  }
}

async function capturar(page: Page, nombre: string) {
  await capturarEn(page, resolve(CAPTURAS, `${nombre}.png`));
}

/**
 * El centro de la parte del lienzo que se ve en la ventana. El mapa puede ser más alto que la
 * ventana (en el portátil ocupa el centro del panel): el ratón solo alcanza lo que está a la vista.
 */
async function centroVisible(page: Page): Promise<[number, number]> {
  const [caja, ventana] = [await lienzo(page).boundingBox(), page.viewportSize()];
  if (!caja || !ventana) throw new Error("el mapa no tiene caja");
  const [arriba, abajo] = [Math.max(caja.y, 0), Math.min(caja.y + caja.height, ventana.height)];
  return [caja.x + caja.width / 2, (arriba + abajo) / 2];
}

/** Gira el mapa arrastrando con el botón derecho `dx` px (el ratón no necesita Ctrl para rotar). */
async function girarConRaton(page: Page, dx: number) {
  const [cx, cy] = await centroVisible(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(cx + dx, cy, { steps: 12 });
  await page.mouse.up({ button: "right" });
}

/** ¿Está el centro del elemento dentro del lienzo del mapa? */
async function estaEnPantalla(page: Page, elemento: Locator): Promise<boolean> {
  const [caja, mapa] = await Promise.all([elemento.boundingBox(), lienzo(page).boundingBox()]);
  if (!caja || !mapa) return false;
  const [x, y] = [caja.x + caja.width / 2, caja.y + caja.height / 2];
  return x >= mapa.x && x <= mapa.x + mapa.width && y >= mapa.y && y <= mapa.y + mapa.height;
}

test.describe("el botón de la vista 3D", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const mision of MISIONES) {
    test(`${mision}: con relieve aparece y el mapa arranca en 2D`, async ({ page }) => {
      const errores = vigilarErrores(page);
      await abrir(page, mision);
      const boton = boton3d(page);
      await expect(boton).toBeVisible();
      await expect(boton).toHaveAccessibleName("Vista 3D");
      await expect(boton).toHaveAttribute("aria-pressed", "false");
      await expect(lienzo(page)).toHaveAttribute("data-mapa-3d", "false");
      await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "no");
      await expect.poll(() => numeroDe(page, "data-mapa-pitch")).toBe(0);
      expect(errores).toEqual([]);
    });

    test(`${mision}: sin relieve el botón no aparece y el mapa sigue en 2D`, async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.route("**/mapas/relieve/**", (r) => r.abort());
      await page.goto(`${DEV}/${mision}/?sin_cliente`);
      await page.locator("#mapa").scrollIntoViewIfNeeded();
      await expect(lienzo(page)).toHaveAttribute("data-mapa-listo", "1");
      await expect(lienzo(page)).toHaveAttribute("data-mapa-relieve", "sin-relieve");
      await expect(page.locator(".mapa-controles")).toBeVisible();
      await expect(page.locator(".mapa-boton")).toHaveCount(3); // centrar, ver todo y pantalla completa
      await expect(boton3d(page)).toHaveCount(0);
      await expect(lienzo(page)).toHaveAttribute("data-mapa-3d", "false");
      expect(errores).toEqual([]);
    });
  }

  test("sin los tokens del relieve en el tema, el botón no aparece", async ({ page }) => {
    await page.addInitScript(() => {
      // El tema sin `--relieve-*`: el mapa avisa y no dibuja relieve (ni 3D).
      const css =
        "html{--relieve-sombra:initial!important;--relieve-luz:initial!important;--relieve-curva:initial!important;--relieve-curva-indice:initial!important}";
      addEventListener("DOMContentLoaded", () => {
        const estilo = document.createElement("style");
        estilo.textContent = css;
        document.head.append(estilo);
      });
    });
    await page.goto(`${DEV}/demeter/?sin_cliente`);
    await page.locator("#mapa").scrollIntoViewIfNeeded();
    await expect(lienzo(page)).toHaveAttribute("data-mapa-listo", "1");
    await expect(lienzo(page)).toHaveAttribute("data-mapa-relieve", "sin-relieve");
    await expect(boton3d(page)).toHaveCount(0);
  });
});

test.describe("activar y desactivar la vista 3D", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const mision of MISIONES) {
    test(`${mision}: 3D inclina y levanta el terreno; 2D lo deja como estaba`, async ({ page }) => {
      test.setTimeout(90_000);
      const errores = vigilarErrores(page);
      await abrir(page, mision);
      await volar(page, mision);
      await expect(lienzo(page)).toHaveAttribute("data-mapa-relieve-cargado", "1", {
        timeout: 15_000,
      });
      await page.waitForTimeout(1000);
      const antes = {
        zoom: await atributo(page, "data-mapa-zoom"),
        zoomMin: await atributo(page, "data-mapa-zoom-min"),
        limites: await atributo(page, "data-mapa-limites"),
      };

      await entrar3d(page);
      await expect(boton3d(page)).toHaveAccessibleName("Vista 2D");
      await expect(boton3d(page)).toHaveAttribute("aria-pressed", "true");
      // La línea de la trayectoria (capa personalizada) y la caída estimada se dibujan.
      await expect
        .poll(() => numeroDe(page, "data-mapa-linea-segmentos"), { timeout: 15_000 })
        .toBeGreaterThan(0);
      await expect
        .poll(() => numeroDe(page, "data-mapa-elipse-dibujada"), { timeout: 15_000 })
        .toBeGreaterThan(0);

      // Volver a 2D: sin terreno, plano, al norte y con los mismos límites y zoom mínimo.
      await dibujado(page, () => boton3d(page).click());
      await expect(lienzo(page)).toHaveAttribute("data-mapa-3d", "false");
      await expect(boton3d(page)).toHaveAccessibleName("Vista 3D");
      await expect(boton3d(page)).toHaveAttribute("aria-pressed", "false");
      await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "no", { timeout: 10_000 });
      await expect.poll(() => numeroDe(page, "data-mapa-pitch")).toBe(0);
      await expect.poll(() => numeroDe(page, "data-mapa-bearing")).toBe(0);
      await expect(lienzo(page)).not.toHaveAttribute("data-mapa-capa3d", /.*/);
      await expect(lienzo(page)).not.toHaveAttribute("data-mapa-linea-segmentos", /.*/);
      await expect(page.locator(".mapa-cohete-3d")).toHaveCount(0);
      expect(await atributo(page, "data-mapa-limites")).toBe(antes.limites);
      expect(await atributo(page, "data-mapa-zoom-min")).toBe(antes.zoomMin);
      expect(errores).toEqual([]);
    });
  }

  test("el 3D se puede alternar varias veces seguidas sin dejar restos", async ({ page }) => {
    test.setTimeout(90_000);
    const errores = vigilarErrores(page);
    await abrir(page, "demeter");
    await volar(page, "demeter");
    for (let i = 0; i < 3; i++) {
      await boton3d(page).click();
      await boton3d(page).click();
    }
    await expect(lienzo(page)).toHaveAttribute("data-mapa-3d", "false");
    await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "no", { timeout: 10_000 });
    await expect.poll(() => numeroDe(page, "data-mapa-pitch")).toBe(0);
    await entrar3d(page);
    expect(errores).toEqual([]);
  });

  test("con movimiento reducido (sin animación) también entra y sale", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await abrir(page, "hermes");
    await volar(page, "hermes");
    await entrar3d(page);
    await boton3d(page).click();
    await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "no", { timeout: 10_000 });
    await expect.poll(() => numeroDe(page, "data-mapa-pitch")).toBe(0);
  });

  test("en 2D todo queda como antes: el lienzo no cambia tras entrar y salir del 3D", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await abrir(page, "demeter");
    await volar(page, "demeter");
    await expect(lienzo(page)).toHaveAttribute("data-mapa-relieve-cargado", "1", {
      timeout: 15_000,
    });
    await page.waitForTimeout(1500);
    const antes = await lienzo(page).screenshot();
    await entrar3d(page);
    await dibujado(page, () => boton3d(page).click());
    await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "no", { timeout: 10_000 });
    await page.mouse.move(0, 0); // sin el ratón encima del botón (su borde cambia con el hover)
    await page.waitForTimeout(1500);
    const despues = await lienzo(page).screenshot();
    // La cámara vuelve al mismo sitio con un error de ~1e-14° (unos 12 píxeles de 943 000 cambian de tono).
    expect(pixelesDistintos(antes, despues)).toBeLessThan(MAX_PIXELES_DISTINTOS);
  });
});

test.describe("la caída estimada y la trayectoria en 3D", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const mision of MISIONES) {
    test(`${mision}: elipse e impacto sobre el terreno, también girado; desaparecen al aterrizar`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const errores = vigilarErrores(page);
      await abrir(page, mision);
      await volar(page, mision); // DESCENT, con calc.elipse
      await entrar3d(page);

      const impacto = page.locator(".mapa-pin");
      await expect(impacto).toBeVisible();
      await expect.poll(() => estaEnPantalla(page, impacto), { timeout: 20_000 }).toBe(true);
      await expect(impacto).toHaveCSS("opacity", "1");
      await expect
        .poll(() => numeroDe(page, "data-mapa-elipse-dibujada"), { timeout: 15_000 })
        .toBeGreaterThan(0);
      await expect(page.locator(".mapa-chip")).toBeVisible();
      await capturar(page, `${mision}-escritorio-3d-descenso-elipse`);

      // Girado con el ratón (botón derecho): la elipse y el impacto siguen a la vista.
      await girarConRaton(page, 160);
      await expect.poll(() => numeroDe(page, "data-mapa-bearing")).not.toBe(0);
      await page.waitForTimeout(1500);
      await expect
        .poll(() => numeroDe(page, "data-mapa-elipse-dibujada"), { timeout: 15_000 })
        .toBeGreaterThan(0);
      await expect.poll(() => estaEnPantalla(page, impacto), { timeout: 20_000 }).toBe(true);
      await expect(impacto).toHaveCSS("opacity", "1");
      await capturar(page, `${mision}-escritorio-3d-descenso-elipse-girado`);

      // Aterriza: la elipse y el impacto desaparecen, como en 2D.
      await volar(page, mision, T_ATERRIZADO_MS);
      await expect(page.locator(".mapa-pin, .mapa-impacto")).toHaveCount(0);
      await expect
        .poll(() => numeroDe(page, "data-mapa-elipse-dibujada"), { timeout: 15_000 })
        .toBe(0);
      expect(errores).toEqual([]);
    });
  }

  test("el cohete, la rampa y la estación nunca se atenúan en 3D (GS-03)", async ({ page }) => {
    test.setTimeout(90_000);
    await abrir(page, "demeter");
    await volar(page, "demeter");
    await entrar3d(page);
    for (const clase of [".mapa-rampa", ".mapa-estacion", ".mapa-cohete"]) {
      const marcador = page.locator(`.mapa-marcador:has(${clase})`);
      await expect(marcador).toHaveCount(1);
      await expect(marcador).toHaveCSS("opacity", "1");
      await expect(marcador).not.toHaveClass(/maplibregl-marker-covered/);
    }
  });

  test("lkp_descenso: el LKP sigue visible y rojo en 3D", async ({ page }) => {
    test.setTimeout(90_000);
    await abrir(page, "hermes");
    await dibujado(page, () => alimentar(page, snapshotDe("hermes", "lkp_descenso")));
    await entrar3d(page);
    const lkp = page.locator(".mapa-lkp");
    await expect(lkp).toBeVisible();
    await expect.poll(() => estaEnPantalla(page, lkp), { timeout: 20_000 }).toBe(true);
    await expect(page.locator(".mapa-marcador:has(.mapa-lkp)")).toHaveCSS("opacity", "1");
  });
});

/** Los tiempos del escenario nominal (ms) de cada misión: ascenso, apogeo y descenso. */
const TIEMPOS = {
  demeter: { ascenso: 25_000, apogeo: 29_700, descenso: 70_000 },
  hermes: { ascenso: 24_000, apogeo: 28_200, descenso: 70_000 },
} as const;

/**
 * El ángulo (grados, en el sentido de las agujas del reloj) con que se ve en pantalla la flecha del
 * cohete: la rotación `rotateZ` del marcador, que MapLibre pone en su `transform` junto con la
 * inclinación (`rotateX`, que achata el eje vertical por el coseno del pitch).
 */
const anguloDeLaFlecha = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".mapa-marcador:has(.mapa-cohete)");
    const lienzo = document.querySelector<HTMLElement>(".mapa-lienzo");
    if (!el || !lienzo) return null;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const cosPitch = Math.cos((Number(lienzo.dataset.mapaPitch) * Math.PI) / 180);
    return (Math.atan2(m.m12 / cosPitch, m.m11) * 180) / Math.PI;
  });

/** Diferencia mínima entre dos ángulos, en grados (0 a 180). */
const dif = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

/** La imagen del cohete en 3D y lo que dice de sí misma (posición y giro, que escribe el controlador). */
const imagenCohete = (page: Page) => page.locator(".mapa-cohete-3d");
const lecturaDeLaImagen = (page: Page) =>
  imagenCohete(page).evaluate((img: HTMLImageElement) => ({
    oculta: img.hidden,
    x: Number(img.dataset.x),
    y: Number(img.dataset.y),
    angulo: Number(img.dataset.angulo),
    src: img.currentSrc || img.src,
    ancho: img.naturalWidth,
    alto: img.naturalHeight,
  }));

test.describe("la línea, el cohete con su imagen y el pin del impacto en 3D (ronda 3)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const mision of MISIONES) {
    test(`${mision}: la capa personalizada dibuja la línea, no hay prismas y la imagen del cohete es la de la misión`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const errores = vigilarErrores(page);
      await abrir(page, mision);
      await volar(page, mision, TIEMPOS[mision].ascenso);
      await entrar3d(page);

      // La capa personalizada existe, tiene segmentos y dibuja cuadros; no queda ningún fill-extrusion.
      await expect(lienzo(page)).toHaveAttribute("data-mapa-capa3d", "custom");
      await expect
        .poll(() => numeroDe(page, "data-mapa-linea-segmentos"), { timeout: 20_000 })
        .toBeGreaterThan(5);
      await expect
        .poll(() => numeroDe(page, "data-mapa-cuadros3d"), { timeout: 20_000 })
        .toBeGreaterThan(0);
      await expect(lienzo(page)).toHaveAttribute("data-mapa-capas-extrusion", "0");

      // La imagen del cohete está dentro del lienzo, con la miniatura de ESTA misión, y es un webp con transparencia.
      const imagen = imagenCohete(page);
      await expect(imagen).toHaveCount(1);
      await expect(imagen).toBeVisible();
      await expect.poll(() => estaEnPantalla(page, imagen), { timeout: 20_000 }).toBe(true);
      const lectura = await lecturaDeLaImagen(page);
      expect([lectura.ancho, lectura.alto]).toEqual([128, 128]);
      const pixeles = await imagen.evaluate(async (img: HTMLImageElement) => {
        const lienzoAux = document.createElement("canvas");
        lienzoAux.width = img.naturalWidth;
        lienzoAux.height = img.naturalHeight;
        const ctx = lienzoAux.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0);
        const alfa = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3] as number;
        return { esquina: alfa(1, img.naturalHeight - 2), centro: alfa(64, 64) };
      });
      expect(pixeles?.esquina).toBe(0); // el fondo es transparente
      expect(imagen).toBeDefined();
      expect(errores).toEqual([]);
    });
  }

  test("la imagen del cohete es de cada misión: Deméter y Hermes cargan archivos distintos", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const srcs: string[] = [];
    for (const mision of MISIONES) {
      await abrir(page, mision);
      await volar(page, mision, TIEMPOS[mision].ascenso);
      await entrar3d(page);
      srcs.push((await lecturaDeLaImagen(page)).src);
    }
    expect(new Set(srcs).size).toBe(2);
  });

  test("la imagen se mueve al cambiar el dato y se gira hacia donde va; en el descenso queda vertical", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await abrir(page, "demeter");
    await volar(page, "demeter", TIEMPOS.demeter.ascenso);
    await entrar3d(page);
    await expect.poll(async () => (await lecturaDeLaImagen(page)).oculta).toBe(false);
    const ascenso = await lecturaDeLaImagen(page);
    // Subiendo con motor o por inercia: la nariz sigue la dirección del movimiento, casi hacia arriba
    // (la imagen trae la nariz a 45° y se le resta eso: casi -45°).
    expect(ascenso.angulo).toBeGreaterThan(-90);
    expect(ascenso.angulo).toBeLessThan(0);

    // Otro dato (el apogeo): la imagen se movió.
    await volar(page, "demeter", TIEMPOS.demeter.apogeo);
    await expect
      .poll(
        async () => {
          const l = await lecturaDeLaImagen(page);
          return Math.hypot(l.x - ascenso.x, l.y - ascenso.y);
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(3);

    // Descenso con paracaídas: vertical, con la nariz arriba (decisión de T-656: no cae de nariz).
    await volar(page, "demeter", TIEMPOS.demeter.descenso);
    await expect
      .poll(async () => (await lecturaDeLaImagen(page)).angulo, { timeout: 20_000 })
      .toBe(-45);
    await expect(imagenCohete(page)).toBeVisible();

    // Aterriza: la imagen se oculta (queda el marcador del suelo) y no hay plomada de un cohete en el aire.
    await volar(page, "demeter", T_ATERRIZADO_MS);
    await expect
      .poll(async () => (await lecturaDeLaImagen(page)).oculta, { timeout: 20_000 })
      .toBe(true);
    await expect(page.locator(".mapa-cohete")).toHaveCount(1);
  });

  test("en LKP no hay cohete flotante: la imagen se oculta y queda el pin del LKP en el suelo (GS-03)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await abrir(page, "hermes");
    await dibujado(page, () => alimentar(page, snapshotDe("hermes", "lkp_descenso")));
    await entrar3d(page);
    await expect(page.locator(".mapa-lkp")).toBeVisible();
    await expect(page.locator(".mapa-cohete")).toHaveCount(0);
    await expect(imagenCohete(page)).toBeHidden();
  });

  for (const mision of MISIONES) {
    test(`${mision}: el pin del impacto de pie con su anillo en DESCENT y sin ellos al aterrizar; en 2D, la diana de siempre`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await abrir(page, mision);
      // En 2D: la diana, sin pin ni anillo ni línea del cohete.
      await volar(page, mision, TIEMPOS[mision].descenso);
      await expect(page.locator(".mapa-impacto")).toBeVisible();
      await expect(page.locator(".mapa-pin, .impacto-anillo")).toHaveCount(0);

      await entrar3d(page);
      const pin = page.locator(".mapa-pin");
      await expect(pin).toBeVisible();
      await expect.poll(() => estaEnPantalla(page, pin), { timeout: 20_000 }).toBe(true);
      await expect(page.locator(".impacto-anillo")).toBeVisible();
      await expect(page.locator(".mapa-impacto")).toHaveCount(0); // la diana plana de 2D ya no está
      // De pie: de frente a la pantalla (sin matriz 3D) y anclado por abajo.
      await expect(page.locator(".mapa-marcador:has(.mapa-pin)")).not.toHaveCSS(
        "transform",
        /matrix3d/,
      );
      await expect(page.locator(".mapa-marcador:has(.impacto-anillo)")).toHaveCSS(
        "transform",
        /matrix3d/,
      );
      await expect(pin).toHaveCSS("opacity", "1");
      await expect
        .poll(() => numeroDe(page, "data-mapa-elipse-dibujada"), { timeout: 20_000 })
        .toBeGreaterThan(0);

      // Aterriza: ni el pin ni el anillo ni la elipse, como en 2D.
      await volar(page, mision, T_ATERRIZADO_MS);
      await expect(page.locator(".mapa-pin, .impacto-anillo")).toHaveCount(0);
      await expect
        .poll(() => numeroDe(page, "data-mapa-elipse-dibujada"), { timeout: 20_000 })
        .toBe(0);

      // De vuelta a 2D en pleno descenso: la diana vuelve y el pin se va.
      await volar(page, mision, TIEMPOS[mision].descenso);
      await expect(page.locator(".mapa-pin")).toBeVisible();
      await boton3d(page).click();
      await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "no", { timeout: 15_000 });
      await expect(page.locator(".mapa-impacto")).toBeVisible();
      await expect(page.locator(".mapa-pin, .impacto-anillo, .mapa-cohete-3d")).toHaveCount(0);
    });
  }

  test("la animación del anillo respeta prefers-reduced-motion", async ({ page }) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await abrir(page, "demeter");
    await volar(page, "demeter", TIEMPOS.demeter.descenso);
    await entrar3d(page);
    const anillo = page.locator(".impacto-anillo");
    await expect(anillo).toBeVisible();
    await expect(anillo).toHaveCSS("animation-name", "none");
  });

  test("en 3D no queda ninguna capa fill-extrusion y la capa personalizada se quita al volver a 2D", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await abrir(page, "hermes");
    await volar(page, "hermes", TIEMPOS.hermes.descenso);
    await entrar3d(page);
    await expect(lienzo(page)).toHaveAttribute("data-mapa-capas-extrusion", "0");
    await expect(lienzo(page)).toHaveAttribute("data-mapa-capa3d", "custom");
    await boton3d(page).click();
    await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "no", { timeout: 15_000 });
    await expect(lienzo(page)).not.toHaveAttribute("data-mapa-capa3d", /.*/);
    await expect(imagenCohete(page)).toHaveCount(0);
  });

  test("la flecha del rumbo sigue al mapa: apunta al rumbo aunque el mapa esté girado (2D y 3D)", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await abrir(page, "demeter");
    await volar(page, "demeter", TIEMPOS.demeter.descenso);
    const rumbo = () => numeroDe(page, "data-mapa-rumbo");
    await expect(lienzo(page)).toHaveAttribute("data-mapa-rumbo", /.+/);
    const esperado = async () => (await rumbo()) - (await numeroDe(page, "data-mapa-bearing"));

    // 2D, sin girar: el ángulo en pantalla es el rumbo.
    await expect.poll(() => anguloDeLaFlecha(page)).not.toBeNull();
    expect(dif((await anguloDeLaFlecha(page)) as number, await esperado())).toBeLessThan(2);

    // 2D, girado con el teclado (Mayús + flecha): la flecha gira con el mapa (antes quedaba fija en pantalla).
    await page.locator(".maplibregl-canvas").focus();
    await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(() => numeroDe(page, "data-mapa-bearing")).not.toBe(0);
    await page.waitForTimeout(800);
    expect(dif((await anguloDeLaFlecha(page)) as number, await esperado())).toBeLessThan(2);

    // 3D, tendida sobre el terreno, con el mapa girado con el ratón: sigue apuntando al rumbo.
    await entrar3d(page);
    await girarConRaton(page, 140);
    await page.waitForTimeout(1500);
    expect(Math.abs(await numeroDe(page, "data-mapa-bearing"))).toBeGreaterThan(5);
    expect(dif((await anguloDeLaFlecha(page)) as number, await esperado())).toBeLessThan(2);
    await expect(page.locator(".mapa-marcador:has(.mapa-cohete)")).toHaveCSS(
      "transform",
      /matrix3d/,
    );
  });

  test("la rampa, la estación y la sombra del cohete se tienden sobre el terreno en 3D; el chip, el pin y el LKP quedan de frente", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await abrir(page, "hermes");
    await volar(page, "hermes", TIEMPOS.hermes.descenso);
    const transformDe = (clase: string) =>
      page.locator(`.mapa-marcador:has(${clase}), .mapa-marcador${clase}`).first();
    // 2D: todo de frente (rotateX(0) no deja una matriz 3D).
    for (const clase of [".mapa-rampa", ".mapa-estacion", ".mapa-impacto", ".mapa-chip"]) {
      await expect(transformDe(clase)).not.toHaveCSS("transform", /matrix3d/);
    }
    await entrar3d(page);
    for (const clase of [".mapa-rampa", ".mapa-estacion", ".mapa-cohete"]) {
      await expect(transformDe(clase)).toHaveCSS("transform", /matrix3d/);
    }
    for (const clase of [".mapa-chip", ".mapa-pin"]) {
      await expect(transformDe(clase)).not.toHaveCSS("transform", /matrix3d/);
    }
    // Al volver a 2D, otra vez de frente.
    await boton3d(page).click();
    await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "no", { timeout: 10_000 });
    for (const clase of [".mapa-rampa", ".mapa-estacion", ".mapa-cohete"]) {
      await expect(transformDe(clase)).not.toHaveCSS("transform", /matrix3d/);
    }
  });
});

test.describe("la imagen del cohete en la producción (dist/)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("cada misión carga su miniatura webp, y no se pide hasta activar el 3D", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const srcs: string[] = [];
    for (const mision of MISIONES) {
      const pedidos: string[] = [];
      const alPedir = (r: { url(): string }) => pedidos.push(new URL(r.url()).pathname);
      page.on("request", alPedir);
      await apiColgada(page);
      await page.goto(`/${mision}/`);
      await esperarPintado(page);
      await page.locator("#mapa").scrollIntoViewIfNeeded();
      await expect(lienzo(page)).toHaveAttribute("data-mapa-listo", "1");
      await expect(lienzo(page)).toHaveAttribute("data-mapa-relieve-cargado", "1", {
        timeout: 45_000,
      });
      const antes = new Set(pedidos);
      await boton3d(page).click();
      const imagen = imagenCohete(page);
      await expect(imagen).toHaveCount(1);
      const src = (await imagen.getAttribute("src")) as string;
      expect(src).toMatch(/\/assets\/cohete-[\w-]+\.webp$/);
      const ruta = new URL(src, "http://x").pathname;
      // La miniatura no se había pedido (el archivo se descarga solo al activar el 3D)...
      expect(antes.has(ruta)).toBe(false);
      // ...y después sí.
      await expect.poll(() => pedidos.includes(ruta), { timeout: 20_000 }).toBe(true);
      srcs.push(ruta);
      page.off("request", alPedir);
    }
    // Cada misión, el suyo.
    expect(new Set(srcs).size).toBe(2);
  });
});

test.describe("los límites y los controles con la vista inclinada", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("'Ver todo' y 'Centrar en el cohete' siguen sirviendo en 3D y el cohete queda a la vista", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await abrir(page, "demeter");
    await volar(page, "demeter");
    await entrar3d(page);
    const cohete = page.locator(".mapa-cohete");
    // Se aleja y se mueve a propósito; "Ver todo" vuelve a encuadrar con la inclinación y al norte.
    await girarConRaton(page, 200);
    await expect.poll(() => numeroDe(page, "data-mapa-bearing")).not.toBe(0);

    await dibujado(page, () => page.getByRole("button", { name: "Ver todo" }).click());
    await expect.poll(() => numeroDe(page, "data-mapa-bearing")).toBe(0);
    await expect
      .poll(() => numeroDe(page, "data-mapa-pitch"))
      .toBeGreaterThan(MAPA_3D_PITCH - EPS_GRADOS);
    await page.waitForTimeout(1500);
    await expect.poll(() => estaEnPantalla(page, cohete), { timeout: 20_000 }).toBe(true);
    await expect
      .poll(() => estaEnPantalla(page, page.locator(".mapa-rampa")), { timeout: 20_000 })
      .toBe(true);
    await expect
      .poll(() => estaEnPantalla(page, page.locator(".mapa-estacion")), { timeout: 20_000 })
      .toBe(true);

    await dibujado(page, () => page.getByRole("button", { name: "Centrar en el cohete" }).click());
    await page.waitForTimeout(1200);
    await expect.poll(() => estaEnPantalla(page, cohete), { timeout: 20_000 }).toBe(true);
    await expect
      .poll(() => numeroDe(page, "data-mapa-pitch"))
      .toBeGreaterThan(MAPA_3D_PITCH - EPS_GRADOS);
  });

  test("con la cámara inclinada el centro no sale del área navegable", async ({ page }) => {
    test.setTimeout(180_000);
    await abrir(page, "hermes");
    await volar(page, "hermes");
    await entrar3d(page);
    const [cx, cy] = await centroVisible(page);
    // Arrastra muy lejos en cada dirección y aleja al máximo con la rueda.
    for (const [dx, dy] of [
      [600, 0],
      [-1200, 0],
      [0, 400],
      [0, -800],
    ] as const) {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + dx, cy + dy, { steps: 4 });
      await page.mouse.up();
    }
    await page.mouse.move(cx, cy);
    await page.keyboard.down("Control");
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
    await page.keyboard.up("Control");
    await page.waitForTimeout(1500);
    const [lon, lat] = (await atributo(page, "data-mapa-centro"))?.split(",").map(Number) ?? [];
    const limites = ((await atributo(page, "data-mapa-limites")) ?? "").split(",").map(Number);
    expect(lon).toBeGreaterThanOrEqual((limites[0] as number) - 1e-4);
    expect(lon).toBeLessThanOrEqual((limites[2] as number) + 1e-4);
    expect(lat).toBeGreaterThanOrEqual((limites[1] as number) - 1e-4);
    expect(lat).toBeLessThanOrEqual((limites[3] as number) + 1e-4);
    // Y el cohete sigue alcanzable: "Centrar en el cohete" lo trae a la vista. Con una prueba lenta el
    // reloj de la página puede pasar a "sin señal" y el cohete se vuelve el LKP (GS-03): vale cualquiera.
    await page.getByRole("button", { name: "Centrar en el cohete" }).click();
    await page.waitForTimeout(1200);
    await expect
      .poll(() => estaEnPantalla(page, page.locator(".mapa-cohete, .mapa-lkp").first()), {
        timeout: 20_000,
      })
      .toBe(true);
  });
});

test.describe("gestos en el celular con la vista 3D", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /** Un arrastre con UN dedo dentro del mapa (de abajo hacia arriba), con eventos táctiles reales. */
  async function arrastrarConUnDedo(page: Page) {
    const marco = await page.locator(".mapa-marco").boundingBox();
    if (!marco) throw new Error("el mapa no tiene caja");
    const x = Math.round(marco.x + marco.width / 2);
    const y0 = Math.round(marco.y + marco.height / 2);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
    for (let d = 20; d <= 200; d += 20) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y0 - d }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  /** Dos dedos que giran uno alrededor del otro, dentro del mapa. */
  async function girarConDosDedos(page: Page) {
    const marco = await page.locator(".mapa-marco").boundingBox();
    if (!marco) throw new Error("el mapa no tiene caja");
    const [cx, cy] = [marco.x + marco.width / 2, marco.y + marco.height / 2];
    const radio = 70;
    const puntos = (grados: number) =>
      [0, 180].map((base, i) => ({
        x: cx + radio * Math.cos(((base + grados) * Math.PI) / 180),
        y: cy + radio * Math.sin(((base + grados) * Math.PI) / 180),
        id: i,
      }));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: puntos(0) });
    for (let g = 10; g <= 90; g += 10) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: puntos(g) });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  test("un dedo no mueve el mapa ni en 2D ni en 3D: se lo deja a la página (gestos cooperativos)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await abrir(page, "demeter");
    await volar(page, "demeter");
    const contenedor = page.locator(".maplibregl-canvas-container");
    const centro = () => atributo(page, "data-mapa-centro");

    // 2D: el navegador conserva el desplazamiento vertical (touch-action) y un dedo no mueve el mapa.
    await ponerSeccionBajoLaCabecera(page);
    await expect(contenedor).toHaveCSS("touch-action", "pan-x pan-y");
    const centro2d = await centro();
    await arrastrarConUnDedo(page);
    await page.waitForTimeout(800);
    expect(await centro()).toBe(centro2d);

    // 3D: lo mismo (cooperativeGestures no cambia de modo).
    await entrar3d(page);
    await ponerSeccionBajoLaCabecera(page);
    await expect(contenedor).toHaveCSS("touch-action", "pan-x pan-y");
    const centro3d = await centro();
    await arrastrarConUnDedo(page);
    await page.waitForTimeout(800);
    expect(await centro()).toBe(centro3d);
    expect(await numeroDe(page, "data-mapa-bearing")).toBe(0);

    // De vuelta a 2D, igual.
    await boton3d(page).click();
    await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "no", { timeout: 10_000 });
    await ponerSeccionBajoLaCabecera(page);
    await expect(contenedor).toHaveCSS("touch-action", "pan-x pan-y");
    const centroDeVuelta = await centro();
    await arrastrarConUnDedo(page);
    await page.waitForTimeout(800);
    expect(await centro()).toBe(centroDeVuelta);
  });

  test("dos dedos giran el mapa solo en 3D; en 2D no (como antes)", async ({ page }) => {
    test.setTimeout(120_000);
    await abrir(page, "demeter");
    await volar(page, "demeter");

    await ponerSeccionBajoLaCabecera(page);
    await girarConDosDedos(page);
    await page.waitForTimeout(500);
    expect(await numeroDe(page, "data-mapa-bearing")).toBe(0);

    await entrar3d(page);
    await ponerSeccionBajoLaCabecera(page);
    await girarConDosDedos(page);
    await expect.poll(() => numeroDe(page, "data-mapa-bearing")).not.toBe(0);

    // De vuelta a 2D: al norte otra vez y los dos dedos ya no giran.
    await ponerSeccionBajoLaCabecera(page);
    await boton3d(page).click();
    await expect(lienzo(page)).toHaveAttribute("data-mapa-terreno", "no", { timeout: 10_000 });
    await expect.poll(() => numeroDe(page, "data-mapa-bearing")).toBe(0);
    await ponerSeccionBajoLaCabecera(page);
    await girarConDosDedos(page);
    await page.waitForTimeout(500);
    expect(await numeroDe(page, "data-mapa-bearing")).toBe(0);
  });
});

// ---- Capturas (para que las revise el usuario): 2D, 3D en escritorio y 3D en celular ----

test.describe("capturas", () => {
  for (const medida of MEDIDAS) {
    for (const mision of MISIONES) {
      test(`${mision} ${medida.nombre}: 2D y 3D en vuelo`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: medida.ancho, height: medida.alto });
        await abrir(page, mision);
        await volar(page, mision);
        await expect(lienzo(page)).toHaveAttribute("data-mapa-relieve-cargado", "1", {
          timeout: 15_000,
        });
        await page.waitForTimeout(1500);
        await capturar(page, `${mision}-${medida.nombre}-2d`);
        await entrar3d(page);
        await expect
          .poll(() => numeroDe(page, "data-mapa-linea-segmentos"), { timeout: 15_000 })
          .toBeGreaterThan(0);
        await capturar(page, `${mision}-${medida.nombre}-3d`);
        // Alejado hasta el zoom mínimo y con la inclinación máxima: así se ve el horizonte.
        const alejar = page.locator(".maplibregl-ctrl-zoom-out");
        for (let i = 0; i < 4 && (await alejar.isEnabled()); i++) {
          await dibujado(page, () => alejar.click());
        }
        await page.locator(".maplibregl-canvas").focus();
        for (let i = 0; i < 2; i++) await page.keyboard.press("Shift+ArrowUp");
        await expect
          .poll(() => numeroDe(page, "data-mapa-pitch"))
          .toBeGreaterThan(MAPA_3D_PITCH_MAX - EPS_GRADOS);
        await page.waitForTimeout(2500);
        await capturar(page, `${mision}-${medida.nombre}-3d-alejado-inclinado`);
      });
    }
  }
});

// ---- Capturas de la ronda 3: ascenso, apogeo, descenso con la elipse y vista girada ----

const CAPTURAS_R2 = resolve(CAPTURAS, "ronda3");
mkdirSync(CAPTURAS_R2, { recursive: true });

test.describe("capturas de la ronda 3", () => {
  for (const medida of MEDIDAS) {
    for (const mision of MISIONES) {
      test(`${mision} ${medida.nombre}: ascenso, apogeo, descenso con la elipse y girada`, async ({
        page,
      }) => {
        test.setTimeout(240_000);
        await page.setViewportSize({ width: medida.ancho, height: medida.alto });
        await abrir(page, mision);
        const t = TIEMPOS[mision];
        const tomar = async (nombre: string) => {
          await page.getByRole("button", { name: "Ver todo" }).click();
          await page.waitForTimeout(2500);
          await capturarEn(page, resolve(CAPTURAS_R2, `${mision}-${medida.nombre}-${nombre}.png`));
        };
        await volar(page, mision, t.ascenso);
        await expect(lienzo(page)).toHaveAttribute("data-mapa-relieve-cargado", "1", {
          timeout: 15_000,
        });
        await entrar3d(page);
        await tomar("1-ascenso");
        await volar(page, mision, t.apogeo);
        await tomar("2-apogeo");
        await volar(page, mision, t.descenso);
        await tomar("3-descenso-elipse");
        if (medida.nombre === "escritorio") {
          await girarConRaton(page, 170);
          await page.waitForTimeout(2500);
          await capturarEn(page, resolve(CAPTURAS_R2, `${mision}-${medida.nombre}-4-girada.png`));
        } else {
          // En el celular, dos dedos giran el mapa.
          const marco = await page.locator(".mapa-marco").boundingBox();
          if (!marco) throw new Error("el mapa no tiene caja");
          const [cx, cy] = [marco.x + marco.width / 2, marco.y + marco.height / 2];
          const cdp = await page.context().newCDPSession(page);
          const dedos = (g: number) =>
            [0, 180].map((base, i) => ({
              x: cx + 70 * Math.cos(((base + g) * Math.PI) / 180),
              y: cy + 70 * Math.sin(((base + g) * Math.PI) / 180),
              id: i,
            }));
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: dedos(0) });
          for (let g = 10; g <= 60; g += 10) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: dedos(g),
            });
          }
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await page.waitForTimeout(2500);
          await capturarEn(page, resolve(CAPTURAS_R2, `${mision}-${medida.nombre}-4-girada.png`));
        }
      });
    }
  }
});
