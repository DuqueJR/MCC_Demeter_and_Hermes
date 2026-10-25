// Prueba de aislamiento del dist/ (D-W01, 04 §3).
// Ningún archivo alcanzable desde /demeter/ puede referenciar nada de Hermes, y al revés.
// Uso: node scripts/aislamiento.mjs [dist]   (sale con código 1 si hay violaciones)
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync } from "node:zlib";

/** @typedef {{ pagina: string, archivo: string, motivo: string }} Violacion */

const PAGINAS = ["demeter", "hermes"];
const EXT_TEXTO = new Set([".html", ".js", ".mjs", ".css"]);
const EXT_RECURSO = "js|mjs|css|avif|webp|png|jpe?g|svg|woff2?|json|pmtiles";
const RE_REFERENCIA = new RegExp(
  `["'(=\\s]([^"'()\\s<>]+\\.(?:${EXT_RECURSO}))(?:[?#][^"'()\\s<>]*)?`,
  "g",
);

// Fuente de títulos de cada misión, por su nombre real dentro del archivo de fuente (02 §5, D-W01).
// Inter es común y no está aquí.
const FAMILIA_DE = { hermes: "Montserrat", demeter: "Marcellus" };
/** ¿El nombre real del archivo es esa familia? ("Montserrat Thin" cuenta como Montserrat). */
const esFamilia = (nombre, familia) =>
  nombre !== null && (nombre === familia || nombre.startsWith(`${familia} `));
// Presupuesto de fuentes por página (04 §6): < 80 KB.
export const PRESUPUESTO_FUENTES_BYTES = 80 * 1024;

const aPosix = (ruta) => ruta.split(sep).join("/");
const extension = (ruta) => {
  const i = ruta.lastIndexOf(".");
  return i < 0 ? "" : ruta.slice(i);
};

// Etiquetas de las tablas conocidas de WOFF2 (spec WOFF2 §5.1), por índice de 0 a 62.
const TABLAS_WOFF2 = [
  ...["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf"],
  ...["loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT"],
  ...["VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT"],
  ...["CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar"],
  ...["fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd"],
  ...["prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"],
];

/**
 * Nombre real de la familia (nameID 16 o 1) de un archivo WOFF2, leído de su tabla `name`.
 * Devuelve null si no es un WOFF2 legible.
 * @param {Buffer} buf
 * @returns {string | null}
 */
export function familiaDeWoff2(buf) {
  try {
    if (buf.toString("latin1", 0, 4) !== "wOF2") return null;
    const numTablas = buf.readUInt16BE(12);
    const tamComprimido = buf.readUInt32BE(20);
    let pos = 48;
    const base128 = () => {
      let valor = 0;
      for (let i = 0; i < 5; i++) {
        const b = buf[pos++];
        valor = valor * 128 + (b & 0x7f);
        if ((b & 0x80) === 0) return valor;
      }
      throw new Error("UIntBase128 inválido");
    };
    const tablas = [];
    for (let i = 0; i < numTablas; i++) {
      const flags = buf[pos++];
      const indice = flags & 0x3f;
      const version = flags >> 6;
      let etiqueta;
      if (indice === 63) {
        etiqueta = buf.toString("latin1", pos, pos + 4);
        pos += 4;
      } else etiqueta = TABLAS_WOFF2[indice];
      const original = base128();
      const glifos = etiqueta === "glyf" || etiqueta === "loca";
      const transformada = glifos ? version !== 3 : version !== 0;
      const tamano = transformada ? base128() : original;
      tablas.push({ etiqueta, tamano });
    }
    const datos = brotliDecompressSync(buf.subarray(pos, pos + tamComprimido));
    let desplazamiento = 0;
    for (const t of tablas) {
      if (t.etiqueta === "name") {
        const n = datos.subarray(desplazamiento, desplazamiento + t.tamano);
        const cantidad = n.readUInt16BE(2);
        const almacen = n.readUInt16BE(4);
        /** @type {Record<number, string>} */
        const nombres = {};
        for (let i = 0; i < cantidad; i++) {
          const r = 6 + i * 12;
          const plataforma = n.readUInt16BE(r);
          const id = n.readUInt16BE(r + 6);
          const largo = n.readUInt16BE(r + 8);
          const inicio = almacen + n.readUInt16BE(r + 10);
          if (nombres[id] !== undefined || (id !== 1 && id !== 16)) continue;
          const crudo = n.subarray(inicio, inicio + largo);
          nombres[id] =
            plataforma === 3 || plataforma === 0
              ? Buffer.from(crudo).swap16().toString("utf16le")
              : crudo.toString("latin1");
        }
        return nombres[16] ?? nombres[1] ?? null;
      }
      desplazamiento += t.tamano;
    }
  } catch (e) {
    if (process.env.DEPURAR) console.error(e);
    return null;
  }
  return null;
}

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
 * Fuentes WOFF2 alcanzables desde una página, con su familia real y su peso.
 * @param {string} distRuta
 * @param {string} pagina
 * @returns {{ archivo: string, familia: string | null, bytes: number }[]}
 */
export function fuentesDePagina(distRuta, pagina) {
  const dist = resolve(distRuta);
  return [...alcanzables(dist, pagina)]
    .filter((a) => extension(a) === ".woff2")
    .map((a) => ({
      archivo: aPosix(relative(dist, a)),
      familia: familiaDeWoff2(readFileSync(a)),
      bytes: statSync(a).size,
    }));
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
      if (extension(archivo) === ".woff2") {
        // Aislamiento por familia real: el nombre del archivo no basta (una fuente renombrada colaría).
        const familia = familiaDeWoff2(readFileSync(archivo));
        if (esFamilia(familia, FAMILIA_DE[otra])) {
          violaciones.push({
            pagina,
            archivo: rel,
            motivo: `fuente de títulos de ${otra} (${familia}) alcanzable desde ${pagina}`,
          });
        }
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
    const fuentes = fuentesDePagina(dist, pagina);
    const total = fuentes.reduce((suma, f) => suma + f.bytes, 0);
    if (total >= PRESUPUESTO_FUENTES_BYTES) {
      violaciones.push({
        pagina,
        archivo: "(fuentes)",
        motivo: `las fuentes pesan ${total} B y el presupuesto es < ${PRESUPUESTO_FUENTES_BYTES} B (04 §6)`,
      });
    }
    if (!fuentes.some((f) => esFamilia(f.familia, FAMILIA_DE[pagina]))) {
      violaciones.push({
        pagina,
        archivo: "(fuentes)",
        motivo: `no carga su fuente de títulos (${FAMILIA_DE[pagina]})`,
      });
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
  for (const pagina of PAGINAS) {
    const fuentes = fuentesDePagina(process.argv[2] ?? "dist", pagina);
    const total = fuentes.reduce((suma, f) => suma + f.bytes, 0);
    const detalle = fuentes.map((f) => `${f.familia} ${f.bytes} B`).join(", ");
    console.log(`  /${pagina}/ fuentes: ${total} B (< ${PRESUPUESTO_FUENTES_BYTES}): ${detalle}`);
  }
}
