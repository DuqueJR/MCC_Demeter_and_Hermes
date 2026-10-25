// Plugin de Vite (solo build): genera AVIF/WebP redimensionados para las imágenes del HTML [T-620].
// Por qué existe: `vite-imagetools` solo actúa sobre imports de JS y CSS; en un HTML sin JS (la portada)
// Vite lee el archivo del disco e ignora el `?w=512&format=avif`. Este plugin hace lo mismo con `sharp`
// (la dependencia de imagetools) y reescribe las URL del HTML. En `npm run dev` no hace nada: ahí sí funciona imagetools.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// /src/assets/<carpeta>/<nombre>.png?w=512&format=avif
const RE_URL = /\/src\/assets\/([\w-]+)\/([\w-]+)\.png\?([^\s"')]+)/g;

/** @param {string} raiz carpeta gui/web */
export function imagenesDeHtml(raiz, paginas = ["index.html"]) {
  /** @type {Map<string, string>} URL original -> ruta publicada */
  const reescritura = new Map();
  /** @type {{ ruta: string, datos: Buffer }[]} */
  const archivos = [];
  const cache = new Map();

  async function generar(url, carpeta, nombre, consulta) {
    const params = new URLSearchParams(consulta);
    const ancho = Number(params.get("w"));
    const formato = params.get("format");
    if (!ancho || !["avif", "webp"].includes(formato)) {
      throw new Error(`imagenes-html: ${url} necesita w=<px> y format=avif|webp`);
    }
    const origen = join(raiz, "src", "assets", carpeta, `${nombre}.png`);
    if (!cache.has(origen)) cache.set(origen, readFileSync(origen));
    const salida = await sharp(cache.get(origen))
      .resize({ width: ancho, withoutEnlargement: true })
      .toFormat(formato, formato === "avif" ? { quality: 55, effort: 4 } : { quality: 80 })
      .toBuffer();
    const hash = createHash("sha1").update(salida).digest("hex").slice(0, 8);
    const ruta = `assets/${carpeta}-${nombre}-${ancho}-${hash}.${formato}`;
    archivos.push({ ruta, datos: salida });
    reescritura.set(url, `/${ruta}`);
  }

  return {
    name: "imagenes-de-html",
    apply: "build",
    async buildStart() {
      for (const pagina of paginas) {
        const html = readFileSync(join(raiz, pagina), "utf8");
        for (const m of html.matchAll(RE_URL)) {
          if (!reescritura.has(m[0])) await generar(m[0], m[1], m[2], m[3]);
        }
      }
      for (const { ruta, datos } of archivos) {
        this.emitFile({ type: "asset", fileName: ruta, source: datos });
      }
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(RE_URL, (url) => reescritura.get(url) ?? url);
      },
    },
  };
}
