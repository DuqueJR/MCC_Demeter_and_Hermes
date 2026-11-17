import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { urlDelSitio } from "../scripts/sitio-html.mjs";

// Favicons y vista previa (Open Graph) de las tres páginas (T-648), contra el dist/ servido.
// Las URL og son absolutas (https://eiaspice.space/...), como las pide WhatsApp; aquí se piden al servidor local
// con la misma ruta. Qué no se puede probar desde aquí: cómo pinta la tarjeta WhatsApp, Facebook o X.
const SITIO = urlDelSitio();
const OG_MAX_BYTES = 300 * 1024;

const PAGINAS = [
  { nombre: "portada", ruta: "/", prefijo: "", tema: "comun.css", variable: "--eia-teal" },
  {
    nombre: "hermes",
    ruta: "/hermes/",
    prefijo: "/hermes",
    tema: "hermes.css",
    variable: "--fondo",
  },
  {
    nombre: "demeter",
    ruta: "/demeter/",
    prefijo: "/demeter",
    tema: "demeter.css",
    variable: "--fondo",
  },
] as const;

const colorDelTema = (archivo: string, variable: string) => {
  const css = readFileSync(resolve(import.meta.dirname, "../src/tema", archivo), "utf8");
  return css.match(new RegExp(`${variable}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
};

for (const pagina of PAGINAS) {
  test.describe(`vista previa e íconos de ${pagina.nombre}`, () => {
    test("las etiquetas og y twitter están completas y con URL absoluta https", async ({
      page,
    }) => {
      await page.goto(pagina.ruta);
      const meta = async (atributo: "property" | "name", clave: string) =>
        page.locator(`head meta[${atributo}="${clave}"]`).getAttribute("content");

      const titulo = await page.title();
      const descripcion = await page
        .locator('head meta[name="description"]')
        .getAttribute("content");
      expect(await meta("property", "og:type")).toBe("website");
      expect(await meta("property", "og:locale")).toBe("es_CO");
      expect(await meta("property", "og:site_name")).toBeTruthy();
      expect(await meta("property", "og:title")).toBe(titulo);
      expect(await meta("property", "og:description")).toBe(descripcion);
      expect(await meta("property", "og:url")).toBe(`${SITIO}${pagina.ruta}`);
      expect(await meta("property", "og:image")).toBe(`${SITIO}${pagina.prefijo}/og.jpg`);
      expect(await meta("property", "og:image")).toMatch(/^https:\/\//);
      expect(await meta("property", "og:image:width")).toBe("1200");
      expect(await meta("property", "og:image:height")).toBe("630");
      expect(await meta("property", "og:image:alt")).toBeTruthy();
      expect(await meta("name", "twitter:card")).toBe("summary_large_image");
      expect(await meta("name", "twitter:image")).toBe(`${SITIO}${pagina.prefijo}/og.jpg`);
      // Sin marcadores sin resolver en ninguna etiqueta del head.
      const cabeza = await page.locator("head").innerHTML();
      expect(cabeza).not.toMatch(/%URL_SITIO%|%COLOR:/);
    });

    test("la imagen og responde 200, es un JPEG de 1200×630 y pesa menos de 300 KB", async ({
      page,
      request,
    }) => {
      await page.goto(pagina.ruta);
      const url = await page.locator('head meta[property="og:image"]').getAttribute("content");
      // El rastreador pide la URL absoluta; aquí se pide lo mismo al servidor de prueba.
      const respuesta = await request.get(new URL(url ?? "", SITIO).pathname);
      expect(respuesta.status()).toBe(200);
      expect(respuesta.headers()["content-type"]).toContain("image/jpeg");
      const cuerpo = await respuesta.body();
      expect(cuerpo.length).toBeLessThan(OG_MAX_BYTES);
      const { width, height, format } = await sharp(cuerpo).metadata();
      expect({ width, height, format }).toEqual({ width: 1200, height: 630, format: "jpeg" });
    });

    test("los íconos enlazados existen, miden lo que dicen y son solo de esta página", async ({
      page,
      request,
    }) => {
      await page.goto(pagina.ruta);
      const enlaces = await page
        .locator('head link[rel~="icon"], head link[rel="apple-touch-icon"]')
        .evaluateAll((nodos) =>
          nodos.map((n) => ({
            rel: n.getAttribute("rel"),
            href: n.getAttribute("href"),
            sizes: n.getAttribute("sizes"),
          })),
        );
      const png32 = enlaces.find((e) => e.rel === "icon" && e.sizes === "32x32");
      const ico = enlaces.find((e) => e.rel === "icon" && e.href?.endsWith(".ico"));
      const apple = enlaces.find((e) => e.rel === "apple-touch-icon");
      expect(png32?.href).toBe(`${pagina.prefijo}/favicon-32.png`);
      expect(ico?.href).toBe(`${pagina.prefijo}/favicon.ico`);
      expect(apple?.href).toBe(`${pagina.prefijo}/apple-touch-icon.png`);
      // Aislamiento (D-W01): cada página enlaza solo íconos de su propia carpeta (la portada, los de la raíz).
      expect(enlaces.length).toBe(3);
      for (const e of enlaces) {
        expect(e.href?.startsWith(`${pagina.prefijo}/`)).toBe(true);
        if (pagina.prefijo === "") expect(e.href).not.toMatch(/^\/(?:hermes|demeter)\//);
      }

      for (const [enlace, lado] of [
        [png32, 32],
        [apple, 180],
      ] as const) {
        const r = await request.get(enlace?.href ?? "");
        expect(r.status()).toBe(200);
        const { width, height, format } = await sharp(await r.body()).metadata();
        expect({ width, height, format }).toEqual({ width: lado, height: lado, format: "png" });
      }

      // El .ico trae 16, 32 y 48 px.
      const r = await request.get(ico?.href ?? "");
      expect(r.status()).toBe(200);
      const cuerpo = await r.body();
      expect(cuerpo.readUInt16LE(2)).toBe(1); // tipo ícono
      const cantidad = cuerpo.readUInt16LE(4);
      const tamanos = Array.from({ length: cantidad }, (_, i) => cuerpo.readUInt8(6 + 16 * i));
      expect(tamanos).toEqual([16, 32, 48]);
    });

    test("el manifiesto y sus íconos de 192 y 512 px responden 200", async ({ page, request }) => {
      await page.goto(pagina.ruta);
      const href = await page.locator('head link[rel="manifest"]').getAttribute("href");
      expect(href).toBe(`${pagina.prefijo}/site.webmanifest`);
      const respuesta = await request.get(href ?? "");
      expect(respuesta.status()).toBe(200);
      const manifiesto = (await respuesta.json()) as {
        theme_color: string;
        start_url: string;
        icons: { src: string; sizes: string }[];
      };
      expect(manifiesto.start_url).toBe(pagina.ruta);
      expect(manifiesto.theme_color).toBe(colorDelTema(pagina.tema, pagina.variable));
      expect(manifiesto.icons.map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
      for (const icono of manifiesto.icons) {
        expect(icono.src.startsWith(`${pagina.prefijo}/`)).toBe(true);
        const lado = Number.parseInt(icono.sizes, 10);
        const r = await request.get(icono.src);
        expect(r.status()).toBe(200);
        const { width, height } = await sharp(await r.body()).metadata();
        expect({ width, height }).toEqual({ width: lado, height: lado });
      }
    });

    test("theme-color es el fondo de su tema", async ({ page }) => {
      await page.goto(pagina.ruta);
      const color = await page.locator('head meta[name="theme-color"]').getAttribute("content");
      expect(color).toBe(colorDelTema(pagina.tema, pagina.variable));
    });
  });
}

test("el og, los íconos y el manifiesto de una misión no nombran a la otra", async ({
  page,
  request,
}) => {
  const OTRA = { hermes: /dem[eé]ter/i, demeter: /hermes/i } as const;
  for (const mision of ["hermes", "demeter"] as const) {
    await page.goto(`/${mision}/`);
    const textos = await page
      .locator(
        'head meta[property^="og:"], head meta[name^="twitter:"], head meta[name="theme-color"], head link[rel~="icon"], head link[rel="apple-touch-icon"], head link[rel="manifest"]',
      )
      .evaluateAll((nodos) => nodos.map((n) => n.outerHTML));
    expect(textos.length).toBeGreaterThan(10);
    for (const texto of textos) expect(texto).not.toMatch(OTRA[mision]);
    const manifiesto = await (await request.get(`/${mision}/site.webmanifest`)).text();
    expect(manifiesto).not.toMatch(OTRA[mision]);
  }
});
