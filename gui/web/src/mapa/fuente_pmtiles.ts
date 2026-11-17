// Fuente de PMTiles que descarga el archivo COMPLETO una sola vez (T-638).
//
// Por qué: la fuente por defecto de `pmtiles` (`FetchSource`) pide cada trozo con `Range` y exige
// un 206 (o un 200 cuyo `content-length` no exceda lo pedido). Cloudflare Pages ignora `Range` y
// responde 200 con el archivo entero: la librería lanza "Server returned no content-length header
// or content-length exceeding request", `detectarBase` devuelve `null` y el mapa cae a la
// cuadrícula de respaldo. El archivo pesa menos de 30 MB (en la zona, unos 918 KB), así que se baja
// entero con un `GET` simple (que además no necesita preflight de CORS) y cada lectura de la
// librería se responde cortando ese búfer en memoria. Sirve igual con servidores que sí atienden
// `Range`: no hace falta distinguirlos.
import type { RangeResponse, Source } from "pmtiles";
import {
  MAPA_PMTILES_ESPERA_MS,
  MAPA_PMTILES_MAX_BYTES,
  MAPA_PMTILES_REINTENTOS,
  MAPA_PMTILES_TIMEOUT_MS,
} from "./constantes";

/** Los 7 primeros bytes de todo PMTiles. */
const MAGICO = "PMTiles";
/** Una cabecera PMTiles v3 mide 127 bytes: menos que eso no puede ser un archivo válido. */
const BYTES_CABECERA = 127;

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * El archivo no está o no es un PMTiles (404, o un `index.html` en su lugar). Es lo esperado cuando
 * el mapa base es opcional: no se reintenta y no se avisa. Cualquier otro error sí se reintenta.
 */
export class PmtilesNoDisponible extends Error {
  override name = "PmtilesNoDisponible";
}

export interface OpcionesFuente {
  /** Para las pruebas; por defecto, el `fetch` del navegador. */
  fetch?: FetchFn;
  /** Reintentos tras un fallo transitorio; por defecto `MAPA_PMTILES_REINTENTOS`. */
  reintentos?: number;
  /** Espera antes del primer reintento, en ms (se duplica); por defecto `MAPA_PMTILES_ESPERA_MS`. */
  esperaMs?: number;
  /** Tope de cada intento, en ms; por defecto `MAPA_PMTILES_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Tamaño máximo aceptado, en bytes; por defecto `MAPA_PMTILES_MAX_BYTES`. */
  maxBytes?: number;
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Cierto si el búfer empieza con "PMTiles" y alcanza para una cabecera. */
export function esPmtiles(datos: ArrayBuffer): boolean {
  if (datos.byteLength < BYTES_CABECERA) return false;
  const inicio = new Uint8Array(datos, 0, MAGICO.length);
  return MAGICO.split("").every((c, i) => inicio[i] === c.charCodeAt(0));
}

/** Una `Source` de `pmtiles` respaldada por una única descarga completa del archivo. */
export class FuenteArchivoCompleto implements Source {
  readonly url: string;
  private readonly opc: Required<OpcionesFuente>;
  /** La descarga compartida: todas las lecturas simultáneas esperan esta misma promesa. */
  private descarga: Promise<ArrayBuffer> | null = null;

  constructor(url: string, opciones: OpcionesFuente = {}) {
    this.url = url;
    this.opc = {
      fetch: opciones.fetch ?? ((u, i) => fetch(u, i)),
      reintentos: opciones.reintentos ?? MAPA_PMTILES_REINTENTOS,
      esperaMs: opciones.esperaMs ?? MAPA_PMTILES_ESPERA_MS,
      timeoutMs: opciones.timeoutMs ?? MAPA_PMTILES_TIMEOUT_MS,
      maxBytes: opciones.maxBytes ?? MAPA_PMTILES_MAX_BYTES,
    };
  }

  /** La llave con que `Protocol` busca el archivo: la misma URL de `pmtiles://<url>/z/x/y`. */
  getKey(): string {
    return this.url;
  }

  /**
   * El archivo entero, descargado una sola vez. Si falla (tras los reintentos), la promesa se
   * olvida: la próxima lectura vuelve a intentarlo en vez de heredar el error para siempre.
   */
  cargar(): Promise<ArrayBuffer> {
    if (!this.descarga) {
      const promesa = this.descargarConReintentos();
      this.descarga = promesa;
      promesa.catch(() => {
        if (this.descarga === promesa) this.descarga = null;
      });
    }
    return this.descarga;
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    _etag?: string,
  ): Promise<RangeResponse> {
    signal?.throwIfAborted();
    const datos = await esperar(this.cargar(), signal);
    // `slice` copia: la librería y MapLibre son dueños de lo que reciben. Sin `etag`: el búfer es
    // inmutable durante la sesión, así que nunca hay una versión nueva con que comparar.
    return { data: datos.slice(offset, offset + length) };
  }

  private async descargarConReintentos(): Promise<ArrayBuffer> {
    let espera = this.opc.esperaMs;
    for (let intento = 0; ; intento++) {
      try {
        return await this.descargarUnaVez();
      } catch (e) {
        if (e instanceof PmtilesNoDisponible || intento >= this.opc.reintentos) throw e;
        await dormir(espera);
        espera *= 2;
      }
    }
  }

  private async descargarUnaVez(): Promise<ArrayBuffer> {
    const respuesta = await this.opc.fetch(this.url, {
      signal: AbortSignal.timeout(this.opc.timeoutMs),
    });
    // 404 y demás 4xx: el archivo opcional no existe; reintentar no lo arregla.
    if (respuesta.status >= 400 && respuesta.status < 500) {
      throw new PmtilesNoDisponible(`El PMTiles respondió ${respuesta.status}`);
    }
    if (!respuesta.ok) throw new Error(`El PMTiles respondió ${respuesta.status}`);
    const declarado = Number(respuesta.headers.get("content-length"));
    if (declarado > this.opc.maxBytes) {
      throw new PmtilesNoDisponible(
        `El PMTiles declara ${declarado} bytes (máximo ${this.opc.maxBytes})`,
      );
    }
    const datos = await respuesta.arrayBuffer();
    if (datos.byteLength > this.opc.maxBytes) {
      throw new PmtilesNoDisponible(`El PMTiles pesa ${datos.byteLength} bytes`);
    }
    // Un servidor que responde `index.html` a una ruta que no existe contesta 200: no cuenta.
    if (!esPmtiles(datos)) throw new PmtilesNoDisponible("El archivo no es un PMTiles");
    return datos;
  }
}

/** Espera `promesa`, pero se rinde en cuanto `signal` se aborta (la descarga sigue para otros). */
function esperar<T>(promesa: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promesa;
  return new Promise<T>((resolver, rechazar) => {
    const alAbortar = () => rechazar(signal.reason);
    signal.addEventListener("abort", alAbortar, { once: true });
    promesa.then(
      (v) => {
        signal.removeEventListener("abort", alAbortar);
        resolver(v);
      },
      (e) => {
        signal.removeEventListener("abort", alAbortar);
        rechazar(e);
      },
    );
  });
}
