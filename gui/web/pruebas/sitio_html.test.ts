import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error módulo .mjs sin tipos de .ico; se usa también como script de Node
import { construirIco, OG_ALTO, OG_ANCHO, OG_MAX_BYTES } from "../scripts/generar-iconos.mjs";
import {
  colorDeTema,
  etiquetasDelSitio,
  URL_SITIO_PREDETERMINADA,
  urlDelSitio,
} from "../scripts/sitio-html.mjs";

const RAIZ = resolve(import.meta.dirname, "..");

describe("dominio base del sitio (T-648)", () => {
  it("por defecto es eiaspice.space", () => {
    expect(URL_SITIO_PREDETERMINADA).toBe("https://eiaspice.space");
    expect(urlDelSitio({})).toBe("https://eiaspice.space");
  });

  it("se cambia con URL_SITIO y se le quita la barra final", () => {
    expect(urlDelSitio({ URL_SITIO: "https://prueba.example/" })).toBe("https://prueba.example");
    expect(urlDelSitio({ URL_SITIO: "  " })).toBe("https://eiaspice.space");
  });
});

describe("color de tema (T-648)", () => {
  it("sale de src/tema/: --fondo de cada misión y el verde institucional de la portada", () => {
    expect(colorDeTema(RAIZ, "hermes")).toBe("#14112a");
    expect(colorDeTema(RAIZ, "demeter")).toBe("#0b1a24");
    expect(colorDeTema(RAIZ, "portada")).toBe("#014c58");
  });

  it("rechaza un tema que no existe", () => {
    expect(() => colorDeTema(RAIZ, "otro")).toThrow(/tema desconocido/);
  });
});

describe("plugin etiquetasDelSitio (T-648)", () => {
  it("reemplaza el dominio y el color en el HTML", () => {
    const plugin = etiquetasDelSitio(RAIZ, "https://prueba.example");
    const transformar = (plugin.transformIndexHtml as { handler: (h: string) => string }).handler;
    const salida = transformar(
      '<meta name="theme-color" content="%COLOR:hermes%"><meta property="og:url" content="%URL_SITIO%/hermes/"><link href="%URL_SITIO%/x">',
    );
    expect(salida).toBe(
      '<meta name="theme-color" content="#14112a"><meta property="og:url" content="https://prueba.example/hermes/"><link href="https://prueba.example/x">',
    );
  });
});

describe("construirIco (T-648)", () => {
  it("arma un ICO válido con una entrada por tamaño y sus PNG intactos", () => {
    const png16 = Buffer.from("png-de-16");
    const png32 = Buffer.from("png-de-32-bytes");
    const ico = construirIco([
      { tam: 16, datos: png16 },
      { tam: 32, datos: png32 },
    ]) as Buffer;
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    // primera entrada
    expect(ico.readUInt8(6)).toBe(16);
    expect(ico.readUInt32LE(14)).toBe(png16.length);
    const desde1 = ico.readUInt32LE(18);
    expect(ico.subarray(desde1, desde1 + png16.length).equals(png16)).toBe(true);
    // segunda entrada
    expect(ico.readUInt8(22)).toBe(32);
    const desde2 = ico.readUInt32LE(34);
    expect(desde2).toBe(desde1 + png16.length);
    expect(ico.subarray(desde2).equals(png32)).toBe(true);
  });

  it("las medidas y el límite de peso de la imagen og son los de la vista previa", () => {
    expect([OG_ANCHO, OG_ALTO]).toEqual([1200, 630]);
    expect(OG_MAX_BYTES).toBe(300 * 1024);
  });
});
