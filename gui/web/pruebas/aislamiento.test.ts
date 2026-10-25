import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error módulo .mjs sin tipos; se usa también como script de Node
import { revisarAislamiento } from "../scripts/aislamiento.mjs";

type Violacion = { pagina: string; archivo: string; motivo: string };
const revisar = revisarAislamiento as (dist: string) => Violacion[];

const raizTemporal = mkdtempSync(join(tmpdir(), "aislamiento-"));
afterAll(() => rmSync(raizTemporal, { recursive: true, force: true }));

function html(script: string, extra = ""): string {
  return `<!doctype html><html><head>${extra}</head><body><script type="module" src="${script}"></script></body></html>`;
}

/** Crea un dist falso con los archivos dados (ruta relativa -> contenido). */
function distFalso(nombre: string, archivos: Record<string, string>): string {
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
  "assets/demeter-aaaa1111.css": "body{color:#fff}",
  "assets/hermes-bbbb2222.css": "body{color:#eee}",
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

  it("FALLA si falta una de las páginas", () => {
    const { "hermes/index.html": _omitida, ...sinHermes } = BASE_LIMPIA;
    expect(revisar(distFalso("sin-hermes", sinHermes)).length).toBeGreaterThan(0);
  });
});

describe("prueba de aislamiento sobre el build real", () => {
  const salida = join(raizTemporal, "dist-real");
  beforeAll(async () => {
    await build({
      root: resolve(import.meta.dirname, ".."),
      logLevel: "silent",
      build: { outDir: salida, emptyOutDir: true },
    });
  });

  it("el dist/ real está aislado", () => {
    expect(revisar(salida)).toEqual([]);
  });
});
