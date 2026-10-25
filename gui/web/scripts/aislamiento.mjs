// Prueba de aislamiento del dist/ (D-W01, 04 §3).
// Ningún archivo alcanzable desde /demeter/ puede referenciar nada de Hermes, y al revés.
// Uso: node scripts/aislamiento.mjs [dist]   (sale con código 1 si hay violaciones)
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {{ pagina: string, archivo: string, motivo: string }} Violacion */

const PAGINAS = ["demeter", "hermes"];
const EXT_TEXTO = new Set([".html", ".js", ".mjs", ".css"]);
const EXT_RECURSO = "js|mjs|css|avif|webp|png|jpe?g|svg|woff2?|json|pmtiles";
const RE_REFERENCIA = new RegExp(
  `["'(=\\s]([^"'()\\s<>]+\\.(?:${EXT_RECURSO}))(?:[?#][^"'()\\s<>]*)?`,
  "g",
);

const aPosix = (ruta) => ruta.split(sep).join("/");
const extension = (ruta) => {
  const i = ruta.lastIndexOf(".");
  return i < 0 ? "" : ruta.slice(i);
};

/** Patrones de contenido que delatan una referencia a la otra misión. */
function patronesDeContenido(otra) {
  return [
    new RegExp(`assets/${otra}/`, "i"),
    new RegExp(`${otra}\\.css`, "i"),
    new RegExp(`entradas/${otra}`, "i"),
    new RegExp(`(?:^|[^\\w])${otra}-[\\w-]{4,}\\.(?:${EXT_RECURSO})`, "i"),
  ];
}

/** Ruta (relativa al dist) que delata a un archivo de la otra misión. */
function rutaDeLaOtra(rutaRel, otra) {
  return new RegExp(`(^|/)${otra}([-./]|$)`, "i").test(rutaRel);
}

/**
 * Archivos alcanzables desde la página: el HTML y, siguiendo referencias, sus JS, CSS y recursos.
 * @returns {Set<string>} rutas absolutas
 */
function alcanzables(dist, pagina) {
  const inicio = join(dist, pagina, "index.html");
  const visitados = new Set();
  const pendientes = [inicio];
  while (pendientes.length > 0) {
    const archivo = pendientes.pop();
    if (visitados.has(archivo) || !existsSync(archivo) || !statSync(archivo).isFile()) continue;
    visitados.add(archivo);
    if (!EXT_TEXTO.has(extension(archivo))) continue;
    const texto = readFileSync(archivo, "utf8");
    for (const m of texto.matchAll(RE_REFERENCIA)) {
      const ref = m[1];
      if (ref.startsWith("http:") || ref.startsWith("https:") || ref.startsWith("//")) continue;
      const candidatos = ref.startsWith("/")
        ? [join(dist, ref)]
        : [join(dirname(archivo), ref), join(dist, ref)];
      const destino = candidatos.find((c) => existsSync(c) && c.startsWith(dist));
      if (destino) pendientes.push(destino);
    }
  }
  return visitados;
}

/**
 * Revisa el aislamiento de un dist/.
 * @param {string} distRuta
 * @returns {Violacion[]}
 */
export function revisarAislamiento(distRuta) {
  const dist = resolve(distRuta);
  /** @type {Violacion[]} */
  const violaciones = [];
  for (const pagina of PAGINAS) {
    if (!existsSync(join(dist, pagina, "index.html"))) {
      violaciones.push({
        pagina,
        archivo: `${pagina}/index.html`,
        motivo: "la página no existe en el dist",
      });
      continue;
    }
    const otra = PAGINAS.find((p) => p !== pagina);
    const patrones = patronesDeContenido(otra);
    for (const archivo of alcanzables(dist, pagina)) {
      const rel = aPosix(relative(dist, archivo));
      if (rutaDeLaOtra(rel, otra)) {
        violaciones.push({
          pagina,
          archivo: rel,
          motivo: `archivo de ${otra} alcanzable desde ${pagina}`,
        });
        continue;
      }
      if (!EXT_TEXTO.has(extension(archivo))) continue;
      const texto = readFileSync(archivo, "utf8");
      for (const patron of patrones) {
        if (patron.test(texto)) {
          violaciones.push({ pagina, archivo: rel, motivo: `referencia a ${otra}: ${patron}` });
          break;
        }
      }
    }
  }
  return violaciones;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violaciones = revisarAislamiento(process.argv[2] ?? "dist");
  if (violaciones.length > 0) {
    console.error("AISLAMIENTO ROTO (D-W01):");
    for (const v of violaciones) console.error(`  /${v.pagina}/ -> ${v.archivo}: ${v.motivo}`);
    process.exit(1);
  }
  console.log("Aislamiento OK: /demeter/ y /hermes/ no se referencian entre sí.");
}
