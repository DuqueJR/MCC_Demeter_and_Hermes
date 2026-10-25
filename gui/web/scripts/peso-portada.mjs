// Presupuesto de peso de la portada (04 §6): < 500 KB [T-620].
// Mide lo que descarga un celular de alta densidad que entiende AVIF (el peor caso razonable):
// el HTML, el CSS, las fuentes que el CSS declara y, por cada <picture>/<img>, el candidato más pesado
// del formato preferido (AVIF, o WebP si no hay AVIF). No cuenta las demás variantes (no se descargan).
// Uso: node scripts/peso-portada.mjs [dist]   (sale con código 1 si pasa de 500 KB)
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PRESUPUESTO_PORTADA_BYTES = 500 * 1000;

const tamano = (dist, ruta) => {
  const archivo = join(dist, ruta.replace(/^\//, "").split(/[?#]/)[0]);
  return existsSync(archivo) ? statSync(archivo).size : 0;
};

/** Candidatos de un srcset: [{ ruta, bytes }]. */
const candidatos = (dist, srcset) =>
  srcset
    .split(",")
    .map((c) => c.trim().split(/\s+/)[0])
    .filter(Boolean)
    .map((ruta) => ({ ruta, bytes: tamano(dist, ruta) }));

const masPesado = (lista) =>
  lista.reduce((a, b) => (b.bytes > a.bytes ? b : a), { ruta: "", bytes: 0 });

/**
 * @param {string} distRuta
 * @returns {{ total: number, partes: { ruta: string, bytes: number }[] }}
 */
export function pesoDePortada(distRuta) {
  const dist = resolve(distRuta);
  const html = readFileSync(join(dist, "index.html"), "utf8");
  /** @type {{ ruta: string, bytes: number }[]} */
  const partes = [{ ruta: "index.html", bytes: tamano(dist, "index.html") }];

  // CSS y las fuentes que declara.
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)) {
    partes.push({ ruta: m[1], bytes: tamano(dist, m[1]) });
    const css = readFileSync(join(dist, m[1].replace(/^\//, "")), "utf8");
    for (const f of css.matchAll(/url\(["']?([^)"']+\.woff2)["']?\)/g)) {
      const ruta = f[1].startsWith("/") ? f[1] : `/assets/${f[1].split("/").pop()}`;
      partes.push({ ruta, bytes: tamano(dist, ruta) });
    }
  }

  // Imágenes: por cada <picture> o <img> suelta, el candidato más pesado del mejor formato.
  const sinPicture = html.replace(/<picture>[\s\S]*?<\/picture>/g, (bloque) => {
    const avif = bloque.match(/<source[^>]*type="image\/avif"[^>]*srcset="([^"]+)"/);
    const webp = bloque.match(/<source[^>]*type="image\/webp"[^>]*srcset="([^"]+)"/);
    const elegido = avif?.[1] ?? webp?.[1];
    if (elegido) partes.push(masPesado(candidatos(dist, elegido)));
    return "";
  });
  for (const m of sinPicture.matchAll(/<img[^>]*>/g)) {
    const srcset = m[0].match(/srcset="([^"]+)"/)?.[1];
    const src = m[0].match(/\ssrc="([^"]+)"/)?.[1];
    partes.push(
      srcset ? masPesado(candidatos(dist, srcset)) : { ruta: src, bytes: tamano(dist, src) },
    );
  }

  return { total: partes.reduce((s, p) => s + p.bytes, 0), partes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { total, partes } = pesoDePortada(process.argv[2] ?? "dist");
  for (const p of partes) console.log(`  ${(p.bytes / 1000).toFixed(1).padStart(7)} KB  ${p.ruta}`);
  console.log(
    `Portada: ${(total / 1000).toFixed(1)} KB (presupuesto < ${PRESUPUESTO_PORTADA_BYTES / 1000} KB, 04 §6)`,
  );
  if (total >= PRESUPUESTO_PORTADA_BYTES) {
    console.error("PORTADA DEMASIADO PESADA");
    process.exit(1);
  }
}
