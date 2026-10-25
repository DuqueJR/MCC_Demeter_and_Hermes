import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error módulo .mjs sin tipos; se usa también como script de Node
import { buscarEjemplosEnDist, revisarAislamiento } from "../scripts/aislamiento.mjs";

type Violacion = { pagina: string; archivo: string; motivo: string };
const revisar = revisarAislamiento as (dist: string) => Violacion[];
const buscarEjemplos = buscarEjemplosEnDist as (dist: string) => Violacion[];

const fuenteReal = (nombre: string) =>
  readFileSync(resolve(import.meta.dirname, "../src/tema/fuentes", nombre));
const MONTSERRAT = fuenteReal("montserrat-latin-800-normal.woff2");
const MARCELLUS = fuenteReal("marcellus-latin-400-normal.woff2");
const INTER = fuenteReal("inter-latin-wght-normal.woff2");

const raizTemporal = mkdtempSync(join(tmpdir(), "aislamiento-"));
afterAll(() => rmSync(raizTemporal, { recursive: true, force: true }));

function html(script: string, extra = ""): string {
  return `<!doctype html><html><head>${extra}</head><body><script type="module" src="${script}"></script></body></html>`;
}

/** Crea un dist falso con los archivos dados (ruta relativa -> contenido). */
function distFalso(nombre: string, archivos: Record<string, string | Buffer>): string {
  const dist = join(raizTemporal, nombre);
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = join(dist, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido);
  }
  return dist;
}

const BASE_LIMPIA = {
  "demeter/index.html": html(
    "/assets/demeter-aaaa1111.js",
    '<link rel="stylesheet" href="/assets/demeter-aaaa1111.css">',
  ),
  "hermes/index.html": html(
    "/assets/hermes-bbbb2222.js",
    '<link rel="stylesheet" href="/assets/hermes-bbbb2222.css">',
  ),
  "assets/demeter-aaaa1111.js": 'import{p}from"./preact-cccc3333.js";console.log(p,"Deméter");',
  "assets/hermes-bbbb2222.js": 'import{p}from"./preact-cccc3333.js";console.log(p,"Hermes");',
  "assets/preact-cccc3333.js": "export const p=1;",
  // Los archivos de fuente llevan nombres neutros: la prueba debe identificarlos por su familia real.
  "assets/demeter-aaaa1111.css":
    "@font-face{src:url(/assets/titulos-1111.woff2)}@font-face{src:url(/assets/texto-3333.woff2)}",
  "assets/hermes-bbbb2222.css":
    "@font-face{src:url(/assets/titulos-2222.woff2)}@font-face{src:url(/assets/texto-3333.woff2)}",
  "assets/titulos-1111.woff2": MARCELLUS,
  "assets/titulos-2222.woff2": MONTSERRAT,
  "assets/texto-3333.woff2": INTER,
};

describe("prueba de aislamiento (D-W01) con dist falso", () => {
  it("pasa si cada misión solo comparte el código común", () => {
    const dist = distFalso("limpio", BASE_LIMPIA);
    expect(revisar(dist)).toEqual([]);
  });

  it("FALLA si /demeter/ referencia una imagen de assets/hermes/", () => {
    const dist = distFalso("falso-imagen", {
      ...BASE_LIMPIA,
      "assets/hermes/parche.webp": "x",
      "assets/demeter-aaaa1111.css": "body{background:url(/assets/hermes/parche.webp)}",
    });
    const v = revisar(dist);
    expect(v.length).toBeGreaterThan(0);
    expect(v.every((x) => x.pagina === "demeter")).toBe(true);
  });

  it("FALLA si /demeter/ referencia hermes.css", () => {
    const dist = distFalso("falso-css", {
      ...BASE_LIMPIA,
      "demeter/index.html": html(
        "/assets/demeter-aaaa1111.js",
        '<link rel="stylesheet" href="/assets/hermes.css">',
      ),
    });
    expect(revisar(dist).some((x) => x.pagina === "demeter")).toBe(true);
  });

  it("FALLA si /hermes/ importa, de forma transitiva, un chunk de Deméter", () => {
    const dist = distFalso("falso-chunk", {
      ...BASE_LIMPIA,
      "assets/preact-cccc3333.js": 'export const p=1;import"./demeter-aaaa1111.js";',
    });
    const v = revisar(dist);
    expect(v.some((x) => x.pagina === "hermes")).toBe(true);
  });

  it("FALLA al revés: /hermes/ referencia assets/demeter/", () => {
    const dist = distFalso("falso-inverso", {
      ...BASE_LIMPIA,
      "assets/demeter/foto.avif": "x",
      "assets/hermes-bbbb2222.js":
        'import{p}from"./preact-cccc3333.js";new Image().src="/assets/demeter/foto.avif";',
    });
    expect(revisar(dist).some((x) => x.pagina === "hermes")).toBe(true);
  });

  it("FALLA si /demeter/ alcanza la fuente de títulos de Hermes, aunque el archivo tenga otro nombre", () => {
    const dist = distFalso("falso-fuente-hermes", {
      ...BASE_LIMPIA,
      "assets/demeter-aaaa1111.css": `${BASE_LIMPIA["assets/demeter-aaaa1111.css"]}@font-face{src:url(/assets/titulos-2222.woff2)}`,
    });
    const v = revisar(dist);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ pagina: "demeter", archivo: "assets/titulos-2222.woff2" });
    expect(v[0]?.motivo).toContain("Montserrat");
  });

  it("FALLA al revés: /hermes/ alcanza la fuente de títulos de Deméter", () => {
    const dist = distFalso("falso-fuente-demeter", {
      ...BASE_LIMPIA,
      "assets/hermes-bbbb2222.css": `${BASE_LIMPIA["assets/hermes-bbbb2222.css"]}@font-face{src:url(/assets/titulos-1111.woff2)}`,
    });
    const v = revisar(dist);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ pagina: "hermes", archivo: "assets/titulos-1111.woff2" });
    expect(v[0]?.motivo).toContain("Marcellus");
  });

  it("FALLA si las fuentes de una página pasan de 80 KB", () => {
    const dist = distFalso("falso-peso", {
      ...BASE_LIMPIA,
      "assets/titulos-2222.woff2": Buffer.concat([MONTSERRAT, Buffer.alloc(40 * 1024)]),
    });
    const v = revisar(dist);
    expect(v.some((x) => x.pagina === "hermes" && x.motivo.includes("presupuesto"))).toBe(true);
  });

  it("FALLA si una página no carga su propia fuente de títulos", () => {
    const dist = distFalso("falso-sin-titulos", {
      ...BASE_LIMPIA,
      "assets/hermes-bbbb2222.css": "@font-face{src:url(/assets/texto-3333.woff2)}",
    });
    expect(
      revisar(dist).some((x) => x.pagina === "hermes" && x.motivo.includes("Montserrat")),
    ).toBe(true);
  });

  it("FALLA si falta una de las páginas", () => {
    const { "hermes/index.html": _omitida, ...sinHermes } = BASE_LIMPIA;
    expect(revisar(distFalso("sin-hermes", sinHermes)).length).toBeGreaterThan(0);
  });
});

describe("datos de ejemplo fuera de producción (R-W5)", () => {
  it("pasa si el dist/ no trae valores de los ejemplos", () => {
    expect(buscarEjemplos(distFalso("sin-ejemplos", BASE_LIMPIA))).toEqual([]);
  });

  it("FALLA si un .js del dist/ trae un valor característico de los ejemplos", () => {
    const dist = distFalso("con-ejemplos", {
      ...BASE_LIMPIA,
      "assets/ejemplos-dddd4444.js": "export const m={mission_id:1793980800};",
    });
    const v = buscarEjemplos(dist);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ archivo: "assets/ejemplos-dddd4444.js" });
  });
});

describe("prueba de aislamiento sobre el build real", () => {
  const salida = join(raizTemporal, "dist-real");
  beforeAll(async () => {
    // Dentro de Vitest NODE_ENV es "test" y Vite deja import.meta.env.DEV = true: se fuerza
    // producción solo durante este build, como en `npm run build`.
    const anterior = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await build({
        root: resolve(import.meta.dirname, ".."),
        logLevel: "silent",
        mode: "production",
        build: { outDir: salida, emptyOutDir: true },
      });
    } finally {
      process.env.NODE_ENV = anterior;
    }
  });

  it("el dist/ real está aislado", () => {
    expect(revisar(salida)).toEqual([]);
  });

  it("el dist/ real no contiene los datos de ejemplo ni el cargador de desarrollo", () => {
    expect(buscarEjemplos(salida)).toEqual([]);
    const textos = readdirSync(join(salida, "assets"))
      .filter((n) => n.endsWith(".js"))
      .map((n) => readFileSync(join(salida, "assets", n), "utf8"));
    expect(textos.some((t) => t.includes("ejemplo_dev") || t.includes("?ejemplo"))).toBe(false);
  });

  it("la página de desarrollo de tokens no entra al dist/ de producción", () => {
    expect(existsSync(join(salida, "dev"))).toBe(false);
    expect(existsSync(join(salida, "tokens.html"))).toBe(false);
  });
});
