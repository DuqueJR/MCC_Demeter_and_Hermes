// Servidor estático de pruebas que IGNORA `Range` (T-638). No es una prueba (no termina en
// .spec.ts). Reproduce a Cloudflare Pages: a toda petición responde 200 con el archivo entero, con
// `content-length` y sin `accept-ranges` ni `content-range`. Sirve el `dist/` ya construido.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, resolve } from "node:path";

const DIST = resolve(import.meta.dirname, "../dist");

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".pmtiles": "application/octet-stream",
};

export interface ServidorDePrueba {
  /** `http://127.0.0.1:<puerto>` */
  url: string;
  /** Cada petición que llegó: ruta y el valor de `Range` que mandó el cliente (o `null`). */
  pedidos: Array<{ ruta: string; rango: string | null }>;
  cerrar: () => Promise<void>;
}

export interface OpcionesServidor {
  /**
   * Como un hosting de página de una sola vista: una ruta que no existe responde `index.html` con
   * 200 (en lugar de 404). Con `sinPmtiles`, así responde también el PMTiles.
   */
  fallbackHtml?: boolean;
  /** Finge que el PMTiles no está desplegado. */
  sinPmtiles?: boolean;
}

export const hayDist = () => existsSync(join(DIST, "index.html"));
export const hayPmtilesEnDist = () => existsSync(join(DIST, "mapas/santa_fe.pmtiles"));

export async function servirDistSinRange(
  opciones: OpcionesServidor = {},
): Promise<ServidorDePrueba> {
  const pedidos: ServidorDePrueba["pedidos"] = [];
  const servidor: Server = createServer((req, res) => {
    const ruta = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    pedidos.push({ ruta, rango: (req.headers.range as string | undefined) ?? null });
    let archivo = normalize(join(DIST, ruta));
    if (!archivo.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(archivo) && statSync(archivo).isDirectory())
      archivo = join(archivo, "index.html");
    const oculto = opciones.sinPmtiles && ruta.endsWith(".pmtiles");
    if (oculto || !existsSync(archivo)) {
      if (opciones.fallbackHtml) {
        const html = readFileSync(join(DIST, "index.html"));
        res.writeHead(200, { "content-type": TIPOS[".html"], "content-length": html.length });
        res.end(html);
      } else {
        res.writeHead(404, { "content-type": "text/plain" }).end("no existe");
      }
      return;
    }
    const cuerpo = readFileSync(archivo);
    // Lo esencial: NO hay `accept-ranges`, no se mira `Range`, no hay 206.
    res.writeHead(200, {
      "content-type": TIPOS[extname(archivo)] ?? "application/octet-stream",
      "content-length": cuerpo.length,
    });
    res.end(cuerpo);
  });
  await new Promise<void>((listo) => servidor.listen(0, "127.0.0.1", listo));
  const { port } = servidor.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    pedidos,
    cerrar: () => new Promise<void>((listo) => servidor.close(() => listo())),
  };
}
