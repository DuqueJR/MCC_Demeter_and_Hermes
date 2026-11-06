// El mapa base debe cargar aunque el hosting ignore `Range` (T-638). Cloudflare Pages responde 200
// con el archivo entero a una petición con `Range`: la fuente por defecto de `pmtiles` lo rechaza y
// el mapa caía a la cuadrícula. Aquí se prueba la fuente propia con un servidor simulado que ignora
// `Range`, el archivo inexistente, el `index.html` en su lugar y que el archivo se baje UNA vez.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PMTiles, Protocol, zxyToTileId } from "pmtiles";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectarBase } from "../src/mapa/base";
import { esPmtiles, FuenteArchivoCompleto } from "../src/mapa/fuente_pmtiles";
import { comoBuffer, construirPmtiles, servidorSinRange } from "./ayuda_pmtiles";

const URL_MAPA = "https://eiaspice.space/mapas/santa_fe.pmtiles";
const SIN_ESPERA = { esperaMs: 0 };
const TESELA_0 = Uint8Array.from([1, 2, 3, 4, 5]);
// Mayor que los 16384 bytes de la primera lectura de pmtiles, como el archivo real (918 KB).
const TESELA_1 = Uint8Array.from({ length: 20_000 }, (_, i) => i % 251);
const archivo = construirPmtiles({
  teselas: [
    { id: zxyToTileId(0, 0, 0), datos: TESELA_0 },
    { id: zxyToTileId(1, 0, 0), datos: TESELA_1 },
  ],
});

afterEach(() => vi.unstubAllGlobals());

describe("la causa del fallo (la fuente por defecto de pmtiles)", () => {
  it("rechaza un 200 completo ante Range: 'content-length exceeding request'", async () => {
    const servidor = servidorSinRange(archivo);
    vi.stubGlobal("fetch", servidor.fetch);
    await expect(new PMTiles(URL_MAPA).getHeader()).rejects.toThrow(/content-length/);
    // Y confirma que sí mandó Range: el servidor simulado lo ignora, como Cloudflare.
    expect(servidor.llamadas[0]?.rango).toMatch(/^bytes=0-/);
  });
});

describe("FuenteArchivoCompleto con un servidor que ignora Range", () => {
  it("carga la cabecera y las teselas", async () => {
    const servidor = servidorSinRange(archivo);
    const pmtiles = new PMTiles(new FuenteArchivoCompleto(URL_MAPA, { fetch: servidor.fetch }));
    const cabecera = await pmtiles.getHeader();
    expect(cabecera.minLon).toBeCloseTo(-75.873, 6);
    expect(cabecera.maxLat).toBeCloseTo(6.632, 6);
    expect(cabecera.maxZoom).toBe(1);
    const cero = await pmtiles.getZxy(0, 0, 0);
    expect(Array.from(new Uint8Array(cero?.data ?? new ArrayBuffer(0)))).toEqual(
      Array.from(TESELA_0),
    );
    const uno = await pmtiles.getZxy(1, 0, 0);
    expect(Array.from(new Uint8Array(uno?.data ?? new ArrayBuffer(0)))).toEqual(
      Array.from(TESELA_1),
    );
    // Una tesela que el archivo no trae no es un error: es `undefined`.
    expect(await pmtiles.getZxy(1, 1, 1)).toBeUndefined();
    expect(servidor.llamadas).toHaveLength(1);
  });

  it("la petición es un GET simple: sin Range (y por eso sin preflight de CORS)", async () => {
    const servidor = servidorSinRange(archivo);
    await new PMTiles(new FuenteArchivoCompleto(URL_MAPA, { fetch: servidor.fetch })).getHeader();
    expect(servidor.llamadas).toEqual([{ url: URL_MAPA, rango: null }]);
  });

  it("getBytes corta el búfer y devuelve una copia", async () => {
    const fuente = new FuenteArchivoCompleto(URL_MAPA, {
      fetch: servidorSinRange(archivo).fetch,
    });
    expect(fuente.getKey()).toBe(URL_MAPA);
    const { data } = await fuente.getBytes(0, 7);
    expect(new TextDecoder().decode(data)).toBe("PMTiles");
    const final = await fuente.getBytes(archivo.length - 2, 100);
    expect(final.data.byteLength).toBe(2);
    // Es una copia: tocarla no daña lo que leen los demás.
    new Uint8Array(data).fill(0);
    expect(new TextDecoder().decode((await fuente.getBytes(0, 7)).data)).toBe("PMTiles");
  });

  it("descarga el archivo UNA sola vez aunque haya muchas lecturas simultáneas", async () => {
    const servidor = servidorSinRange(archivo);
    const fuente = new FuenteArchivoCompleto(URL_MAPA, { fetch: servidor.fetch });
    const pmtiles = new PMTiles(fuente);
    const lecturas = [
      pmtiles.getHeader(),
      pmtiles.getHeader(),
      pmtiles.getZxy(0, 0, 0),
      pmtiles.getZxy(1, 0, 0),
      ...Array.from({ length: 30 }, (_, i) => fuente.getBytes(i, 16)),
    ];
    await Promise.all(lecturas);
    // Y otra ráfaga después de que terminó la primera.
    await Promise.all(Array.from({ length: 30 }, (_, i) => pmtiles.getZxy(i % 2, 0, 0)));
    expect(servidor.llamadas).toHaveLength(1);
  });

  it("abortar una lectura no cancela la descarga que comparten las demás", async () => {
    const servidor = servidorSinRange(archivo);
    const fuente = new FuenteArchivoCompleto(URL_MAPA, { fetch: servidor.fetch });
    const control = new AbortController();
    const abortada = fuente.getBytes(0, 16, control.signal);
    control.abort();
    await expect(abortada).rejects.toThrow();
    const viva = await fuente.getBytes(0, 7);
    expect(new TextDecoder().decode(viva.data)).toBe("PMTiles");
    expect(servidor.llamadas).toHaveLength(1);
    // Con la señal ya abortada ni siquiera se empieza.
    await expect(fuente.getBytes(0, 7, AbortSignal.abort())).rejects.toThrow();
  });

  it("reintenta un fallo de red o un 5xx y luego carga", async () => {
    const servidor = servidorSinRange(archivo);
    let intentos = 0;
    const fetchInestable = async (url: string, init?: RequestInit) => {
      intentos++;
      if (intentos === 1) throw new TypeError("Failed to fetch");
      if (intentos === 2) return new Response("", { status: 503 });
      return servidor.fetch(url, init);
    };
    const fuente = new FuenteArchivoCompleto(URL_MAPA, { fetch: fetchInestable, ...SIN_ESPERA });
    const { data } = await fuente.getBytes(0, 7);
    expect(new TextDecoder().decode(data)).toBe("PMTiles");
    expect(intentos).toBe(3);
  });

  it("si agota los reintentos falla, y la próxima lectura vuelve a intentar", async () => {
    let intentos = 0;
    let caido = true;
    const servidor = servidorSinRange(archivo);
    const fuente = new FuenteArchivoCompleto(URL_MAPA, {
      fetch: async (url, init) => {
        intentos++;
        if (caido) throw new TypeError("Failed to fetch");
        return servidor.fetch(url, init);
      },
      reintentos: 1,
      ...SIN_ESPERA,
    });
    await expect(fuente.getBytes(0, 7)).rejects.toThrow("Failed to fetch");
    expect(intentos).toBe(2);
    caido = false;
    expect(new TextDecoder().decode((await fuente.getBytes(0, 7)).data)).toBe("PMTiles");
  });

  it("no reintenta un archivo que no existe (404) ni uno que no es PMTiles", async () => {
    let intentos = 0;
    const fuente404 = new FuenteArchivoCompleto(URL_MAPA, {
      fetch: async () => {
        intentos++;
        return new Response("", { status: 404 });
      },
      ...SIN_ESPERA,
    });
    await expect(fuente404.getBytes(0, 7)).rejects.toThrow("404");
    expect(intentos).toBe(1);
  });

  it("descarta un archivo que declara más bytes de los permitidos", async () => {
    const servidor = servidorSinRange(archivo);
    const fuente = new FuenteArchivoCompleto(URL_MAPA, {
      fetch: servidor.fetch,
      maxBytes: archivo.length - 1,
    });
    await expect(fuente.getBytes(0, 7)).rejects.toThrow(/máximo/);
  });

  it("esPmtiles pide el número mágico y una cabecera completa", () => {
    expect(esPmtiles(comoBuffer(archivo))).toBe(true);
    expect(esPmtiles(comoBuffer(archivo.slice(0, 126)))).toBe(false);
    expect(
      esPmtiles(comoBuffer(new TextEncoder().encode(`<!doctype html>${" ".repeat(200)}`))),
    ).toBe(false);
  });
});

describe("detectarBase", () => {
  it("con un servidor que ignora Range: encuentra la base, su cobertura y registra el archivo", async () => {
    const servidor = servidorSinRange(archivo);
    const protocolo = new Protocol();
    const detectada = await detectarBase(protocolo, { url: URL_MAPA, fetch: servidor.fetch });
    expect(detectada?.base.url).toBe(`pmtiles://${URL_MAPA}`);
    expect(detectada?.base.atribucion).toContain("OpenStreetMap");
    expect(detectada?.cobertura?.limites).toEqual([-75.873, 6.532, -75.773, 6.632]);
    expect(detectada?.cobertura?.zoomMax).toBe(1);

    // El protocolo `pmtiles://` encuentra el archivo por su URL y sirve las teselas sin otra descarga.
    expect(protocolo.get(URL_MAPA)).toBeDefined();
    const tilev4 = (
      protocolo as unknown as {
        tilev4: (
          p: { url: string; type?: string },
          c: AbortController,
        ) => Promise<{ data: unknown }>;
      }
    ).tilev4;
    const tesela = await tilev4({ url: `pmtiles://${URL_MAPA}/0/0/0` }, new AbortController());
    expect(Array.from(tesela.data as Uint8Array)).toEqual(Array.from(TESELA_0));
    const json = await tilev4(
      { url: `pmtiles://${URL_MAPA}`, type: "json" },
      new AbortController(),
    );
    expect(json.data).toMatchObject({ maxzoom: 1, bounds: [-75.873, 6.532, -75.773, 6.632] });
    expect(servidor.llamadas).toHaveLength(1);
  });

  it("devuelve null si el archivo no existe (404)", async () => {
    const protocolo = new Protocol();
    const detectada = await detectarBase(protocolo, {
      url: URL_MAPA,
      fetch: async () => new Response("no existe", { status: 404 }),
    });
    expect(detectada).toBeNull();
    expect(protocolo.get(URL_MAPA)).toBeUndefined();
  });

  it("devuelve null si el servidor responde index.html en su lugar (200, HTML)", async () => {
    const html = `<!doctype html><html><head><title>EIA</title></head><body>${"x".repeat(2000)}</body></html>`;
    const servidor = servidorSinRange(html, "text/html; charset=utf-8");
    const protocolo = new Protocol();
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await detectarBase(protocolo, { url: URL_MAPA, fetch: servidor.fetch })).toBeNull();
    expect(protocolo.get(URL_MAPA)).toBeUndefined();
    // El caso normal sin mapa base no hace ruido en la consola.
    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
  });

  it("devuelve null (y lo avisa) si la red falla aun después de los reintentos", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const detectada = await detectarBase(new Protocol(), {
      url: URL_MAPA,
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
      ...SIN_ESPERA,
    });
    expect(detectada).toBeNull();
    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });

  it("una cabecera sin recuadro creíble da base sin cobertura (área por defecto)", async () => {
    const sinRecuadro = construirPmtiles({
      teselas: [{ id: 0, datos: TESELA_0 }],
      limites: [0, 0, 0, 0],
    });
    const detectada = await detectarBase(new Protocol(), {
      url: URL_MAPA,
      fetch: servidorSinRange(sinRecuadro).fetch,
    });
    expect(detectada?.base.url).toBe(`pmtiles://${URL_MAPA}`);
    expect(detectada?.cobertura).toBeNull();
  });
});

// El archivo real (no se versiona: lo genera un humano, README del módulo). Si está, se prueba con él.
const REAL = resolve(import.meta.dirname, "../public/mapas/santa_fe.pmtiles");
describe.skipIf(!existsSync(REAL))("con el PMTiles real de la zona", () => {
  it("carga la cabecera y una tesela con un servidor que ignora Range", async () => {
    const bytes = new Uint8Array(readFileSync(REAL));
    const servidor = servidorSinRange(bytes);
    const protocolo = new Protocol();
    const detectada = await detectarBase(protocolo, { url: URL_MAPA, fetch: servidor.fetch });
    expect(detectada?.cobertura?.zoomMax).toBe(15);
    // La tesela del zoom 0 existe en cualquier extracción con `--minzoom` por defecto.
    const tesela = await protocolo.get(URL_MAPA)?.getZxy(0, 0, 0);
    expect(tesela?.data.byteLength).toBeGreaterThan(0);
    expect(servidor.llamadas).toHaveLength(1);
  });
});
