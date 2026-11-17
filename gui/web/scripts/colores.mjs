// Regla contra colores sueltos (06 §6, 02 §6): "los componentes solo usan tokens".
// Falla si un .css, .ts, .tsx (y .html) fuera de src/tema/ tiene un color literal.
// Uso: node scripts/colores.mjs [raiz-web]   (sale con código 1 si hay violaciones)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {{ archivo: string, linea: number, texto: string, motivo: string }} Violacion */

// Se revisan src/, dev/, demeter/, hermes/ y los .html de la raíz. `src/tema/` queda exenta.
const EXTENSIONES = new Set([".css", ".ts", ".tsx", ".html"]);
const EXENTAS = ["src/tema"];
const IGNORADAS = new Set(["node_modules", "dist", "test-results", "playwright-report", "e2e"]);

// #rgb, #rgba, #rrggbb, #rrggbbaa que no sean parte de una palabra (evita `&#123;` y similares raros).
const RE_HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const RE_FUNCION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|device-cmyk)\s*\(/gi;
// Nombres de color CSS más comunes, solo se buscan como valor en declaraciones de .css.
const NOMBRES = [
  ...["white", "black", "red", "green", "blue", "yellow", "orange", "purple", "pink", "gray"],
  ...["grey", "silver", "gold", "cyan", "magenta", "brown", "teal", "navy", "maroon", "olive"],
  ...["lime", "aqua", "fuchsia", "indigo", "violet", "crimson", "coral", "salmon", "tan"],
  ...["beige", "ivory", "khaki", "lavender", "orchid", "plum", "turquoise", "tomato", "azure"],
  ...["bisque", "wheat", "snow", "linen", "chocolate", "peru", "sienna", "orangered", "gainsboro"],
];
const RE_NOMBRE_CSS = new RegExp(`(?:^|[\\s:,(])(?:${NOMBRES.join("|")})(?=[\\s;,)!]|$)`, "i");

const aPosix = (ruta) => ruta.split(sep).join("/");

/** Quita comentarios conservando los saltos de línea (para no desplazar los números de línea). */
function sinComentarios(texto, ext) {
  let t = texto.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  if (ext === ".ts" || ext === ".tsx") t = t.replace(/(^|\s)\/\/.*$/gm, "$1");
  if (ext === ".html") t = t.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  return t;
}

function listar(raiz, rel) {
  const dir = join(raiz, rel);
  if (!existsSync(dir)) return [];
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    if (IGNORADAS.has(nombre) || nombre.startsWith(".")) continue;
    const ruta = join(dir, nombre);
    const relRuta = aPosix(join(rel, nombre));
    if (EXENTAS.includes(relRuta)) continue;
    const st = statSync(ruta);
    if (st.isDirectory()) {
      salida.push(...listar(raiz, relRuta));
    } else if (EXTENSIONES.has(nombre.slice(nombre.lastIndexOf(".")))) salida.push(ruta);
  }
  return salida;
}

/**
 * Busca colores literales fuera de src/tema/.
 * @param {string} raizWeb carpeta gui/web (o una falsa, para las pruebas)
 * @returns {Violacion[]}
 */
export function buscarColoresSueltos(raizWeb) {
  const raiz = resolve(raizWeb);
  const archivos = new Set();
  for (const carpeta of ["src", "dev", "demeter", "hermes"]) {
    for (const a of listar(raiz, carpeta)) archivos.add(a);
  }
  // HTML de la raíz (la portada) sin bajar a otras carpetas.
  for (const nombre of existsSync(raiz) ? readdirSync(raiz) : []) {
    if (nombre.endsWith(".html")) archivos.add(join(raiz, nombre));
  }
  /** @type {Violacion[]} */
  const violaciones = [];
  for (const archivo of archivos) {
    const ext = archivo.slice(archivo.lastIndexOf("."));
    const rel = aPosix(relative(raiz, archivo));
    const lineas = sinComentarios(readFileSync(archivo, "utf8"), ext).split("\n");
    lineas.forEach((texto, i) => {
      const hallazgos = [
        [texto.match(RE_HEX), "color hexadecimal"],
        [texto.match(RE_FUNCION), "color funcional (rgb, hsl, oklch…)"],
        [ext === ".css" ? texto.match(RE_NOMBRE_CSS) : null, "color con nombre"],
      ];
      for (const [coincidencias, motivo] of hallazgos) {
        if (coincidencias) {
          violaciones.push({ archivo: rel, linea: i + 1, texto: texto.trim(), motivo });
        }
      }
    });
  }
  return violaciones;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violaciones = buscarColoresSueltos(process.argv[2] ?? ".");
  if (violaciones.length > 0) {
    console.error("COLORES SUELTOS (02 §6: solo tokens fuera de src/tema/):");
    for (const v of violaciones)
      console.error(`  ${v.archivo}:${v.linea}: ${v.motivo}: ${v.texto}`);
    process.exit(1);
  }
  console.log("Colores OK: no hay colores literales fuera de src/tema/.");
}
