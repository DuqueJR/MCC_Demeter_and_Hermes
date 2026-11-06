import { expect, type Locator, type Page, test } from "@playwright/test";

// T-639 y T-646: la foto del equipo vive en la sección Equipo, junto al parche (en escritorio, uno a
// cada lado; en móvil y tableta, apilados), con las tarjetas de apellidos debajo y centradas. El
// carrusel de Inicio solo lleva la foto del cohete. (T-639: con `display: none` la foto del equipo
// medía 0 × 0 y su `loading="lazy"` nunca la pedía; sigue valiendo que todas se vean cargadas.)
const MISIONES = ["demeter", "hermes"] as const;
const ESCRITORIO = [1280, 1470, 1920] as const;
const MOVIL = 390;
const TABLETA = 800;

type Medida = { ancho: number; alto: number; naturalWidth: number; completa: boolean };

async function medir(img: Locator): Promise<Medida> {
  return img.evaluate((e: HTMLImageElement) => {
    const r = e.getBoundingClientRect();
    return {
      ancho: r.width,
      alto: r.height,
      naturalWidth: e.naturalWidth,
      completa: e.complete,
    };
  });
}

// Lleva la imagen a la vista (el `loading="lazy"` solo la pide cerca del viewport) y espera a que
// el navegador la haya decodificado con tamaño propio.
async function verificarVisible(img: Locator, nombre: string) {
  await expect(img, `${nombre}: visible`).toBeVisible();
  await img.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await medir(img)).naturalWidth, { message: `${nombre}: naturalWidth` })
    .toBeGreaterThan(0);
  const m = await medir(img);
  expect(m.ancho, `${nombre}: ancho`).toBeGreaterThan(0);
  expect(m.alto, `${nombre}: alto`).toBeGreaterThan(0);
  expect(m.completa, `${nombre}: complete`).toBe(true);
}

async function irAMision(page: Page, mision: string, ancho: number) {
  await page.setViewportSize({ width: ancho, height: ancho < 600 ? 844 : 900 });
  await page.goto(`/${mision}/`);
  await expect(page.locator("#inicio .carrusel")).toBeVisible();
}

type Caja = { left: number; right: number; top: number; bottom: number };

async function caja(loc: Locator): Promise<Caja> {
  return loc.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });
}

const centroX = (c: Caja) => (c.left + c.right) / 2;
const TOLERANCIA = 4; // px

async function verificarInicio(page: Page) {
  // El carrusel de Inicio lleva solo el cohete; la foto del equipo ya no está.
  const fotos = page.locator("#inicio .carrusel img.foto");
  await expect(fotos).toHaveCount(1);
  await verificarVisible(fotos.first(), "foto del cohete");
  await expect(fotos.first()).toHaveAttribute("alt", /cohete/i);
  await expect(page.locator("#inicio img[src*='equipo']")).toHaveCount(0);
  await expect(page.locator("#inicio .carrusel", { hasText: /El equipo de/ })).toHaveCount(0);

  // Con una sola foto no sobra hueco: ocupa todo el ancho de su columna y no se estira.
  const r = await page.evaluate(() => {
    const c = document.querySelector("#inicio .carrusel")?.getBoundingClientRect();
    const d = document.querySelector("#inicio .diapositiva")?.getBoundingClientRect();
    const i = document.querySelector("#inicio img.foto")?.getBoundingClientRect();
    return c && d && i
      ? { carrusel: c.width, diapositiva: d.width, foto: i.width, alto: i.height }
      : null;
  });
  expect(r, "carrusel con su foto").not.toBeNull();
  if (!r) return;
  expect(r.diapositiva, "la diapositiva llena el carrusel").toBeGreaterThan(r.carrusel - 2);
  expect(r.foto / r.alto, "la foto del cohete conserva su 4:3").toBeCloseTo(4 / 3, 1);
}

async function verificarEquipo(page: Page, escritorio: boolean) {
  const seccion = page.locator("#equipo");
  const parche = seccion.locator("img.parche-grande");
  const foto = seccion.locator("img.foto-equipo");
  await expect(foto).toHaveAttribute("alt", /equipo/i);
  await expect(foto).toHaveAttribute("loading", "lazy");
  await verificarVisible(parche, "parche del equipo");
  await verificarVisible(foto, "foto del equipo");
  const n = await seccion.locator("img").count();
  expect(n, "Equipo solo lleva el parche y la foto").toBe(2);

  await expect(seccion.locator(".integrante").first()).toBeVisible();
  // Todo medido tras cargar las imágenes (la altura de la banda depende de ellas).
  const s = await caja(seccion);
  const p = await caja(parche);
  const f = await caja(foto);
  const tarjetas = await seccion
    .locator(".integrante")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))
    .then((rs) => rs.map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })));
  expect(tarjetas.length, "integrantes").toBeGreaterThanOrEqual(6);

  if (escritorio) {
    // Lado a lado, en la misma banda: el parche a la izquierda de la foto.
    expect(p.right, "el parche queda a un lado de la foto").toBeLessThanOrEqual(f.left + 1);
    expect(Math.min(p.bottom, f.bottom) - Math.max(p.top, f.top), "misma banda").toBeGreaterThan(0);
  } else {
    // Apilados: parche, foto, apellidos; cada uno centrado.
    expect(p.bottom, "el parche va sobre la foto").toBeLessThanOrEqual(f.top + 1);
    expect(Math.abs(centroX(p) - centroX(s)), "parche centrado").toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(centroX(f) - centroX(s)), "foto centrada").toBeLessThanOrEqual(TOLERANCIA);
  }
  // La pareja (o la pila) de la banda queda centrada en la sección.
  const banda = { left: Math.min(p.left, f.left), right: Math.max(p.right, f.right) } as Caja;
  expect(Math.abs(centroX(banda) - centroX(s)), "banda centrada").toBeLessThanOrEqual(TOLERANCIA);

  // Las tarjetas, debajo de ambos; cada fila (también la última, incompleta) centrada en la sección.
  const finBanda = Math.max(p.bottom, f.bottom);
  for (const t of tarjetas)
    expect(t.top, "tarjeta bajo el parche y la foto").toBeGreaterThanOrEqual(finBanda - 1);
  const filas = new Map<number, Caja[]>();
  for (const t of tarjetas) {
    const k = Math.round(t.top);
    filas.set(k, [...(filas.get(k) ?? []), t]);
  }
  expect(filas.size, "las tarjetas se reparten en filas").toBeGreaterThanOrEqual(1);
  for (const [top, fila] of filas) {
    const centro =
      (Math.min(...fila.map((t) => t.left)) + Math.max(...fila.map((t) => t.right))) / 2;
    expect(Math.abs(centro - centroX(s)), `fila en y=${top} centrada`).toBeLessThanOrEqual(
      TOLERANCIA,
    );
  }
  // Ninguna tarjeta se sale de la sección.
  for (const t of tarjetas) {
    expect(t.left).toBeGreaterThanOrEqual(s.left - 1);
    expect(t.right).toBeLessThanOrEqual(s.right + 1);
  }
}

for (const mision of MISIONES) {
  for (const ancho of ESCRITORIO) {
    test(`escritorio ${ancho}: ${mision} muestra el parche y la foto del equipo lado a lado`, async ({
      page,
    }) => {
      await irAMision(page, mision, ancho);
      await verificarInicio(page);
      await verificarEquipo(page, true);
    });
  }

  test(`móvil ${MOVIL}: ${mision} apila el parche, la foto y los apellidos`, async ({ page }) => {
    await irAMision(page, mision, MOVIL);
    await verificarInicio(page);
    await verificarEquipo(page, false);
  });

  test(`tableta ${TABLETA}: ${mision} apila el parche, la foto y los apellidos`, async ({
    page,
  }) => {
    await irAMision(page, mision, TABLETA);
    await verificarEquipo(page, false);
  });
}
