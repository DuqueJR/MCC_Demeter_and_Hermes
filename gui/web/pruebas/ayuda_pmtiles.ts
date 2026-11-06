// Ayudas de las pruebas del PMTiles (T-638). No es una prueba (no termina en .test.ts).
// Arma un PMTiles v3 mínimo y válido (sin compresión, con el directorio raíz y las teselas del
// zoom 0 y 1) para no depender del archivo real, que no se versiona.

/** Bytes de la cabecera de un PMTiles v3. */
const CABECERA = 127;

function varint(n: number): number[] {
  const bytes: number[] = [];
  let resto = n;
  while (resto >= 0x80) {
    bytes.push((resto % 0x80) | 0x80);
    resto = Math.floor(resto / 0x80);
  }
  bytes.push(resto);
  return bytes;
}

export interface TeselaSintetica {
  /** Id de la tesela en el orden de Hilbert: 0 es el zoom 0; 1 a 4, el zoom 1. */
  id: number;
  datos: Uint8Array;
}

export interface OpcionesPmtiles {
  teselas: TeselaSintetica[];
  /** Grados; por defecto un recuadro de ±0,05° alrededor de la rampa de las pruebas. */
  limites?: [number, number, number, number];
  maxZoom?: number;
}

/** Construye el archivo PMTiles completo. */
export function construirPmtiles({
  teselas,
  limites = [-75.873, 6.532, -75.773, 6.632],
  maxZoom = 1,
}: OpcionesPmtiles): Uint8Array {
  const ordenadas = [...teselas].sort((a, b) => a.id - b.id);
  // Directorio raíz (spec v3): n, deltas de id, runLength, length y offset+1 (0 = contiguo).
  const dir: number[] = [...varint(ordenadas.length)];
  let previo = 0;
  for (const t of ordenadas) {
    dir.push(...varint(t.id - previo));
    previo = t.id;
  }
  for (const _ of ordenadas) dir.push(...varint(1));
  for (const t of ordenadas) dir.push(...varint(t.datos.length));
  let offset = 0;
  for (const t of ordenadas) {
    dir.push(...varint(offset + 1));
    offset += t.datos.length;
  }
  const dirBytes = Uint8Array.from(dir);
  const datosTotal = offset;
  const total = CABECERA + dirBytes.length + datosTotal;
  const archivo = new Uint8Array(total);
  const vista = new DataView(archivo.buffer);
  archivo.set(new TextEncoder().encode("PMTiles"), 0);
  vista.setUint8(7, 3);
  const u64 = (pos: number, valor: number) => vista.setBigUint64(pos, BigInt(valor), true);
  u64(8, CABECERA); // directorio raíz
  u64(16, dirBytes.length);
  u64(24, CABECERA + dirBytes.length); // metadatos JSON (vacíos)
  u64(32, 0);
  u64(40, CABECERA + dirBytes.length); // directorios de hoja (no hay)
  u64(48, 0);
  u64(56, CABECERA + dirBytes.length); // datos de las teselas
  u64(64, datosTotal);
  u64(72, ordenadas.length);
  u64(80, ordenadas.length);
  u64(88, ordenadas.length);
  vista.setUint8(96, 1); // agrupado
  vista.setUint8(97, 1); // compresión interna: ninguna
  vista.setUint8(98, 1); // compresión de teselas: ninguna
  vista.setUint8(99, 1); // MVT
  vista.setUint8(100, 0);
  vista.setUint8(101, maxZoom);
  const [oeste, sur, este, norte] = limites;
  vista.setInt32(102, Math.round(oeste * 1e7), true);
  vista.setInt32(106, Math.round(sur * 1e7), true);
  vista.setInt32(110, Math.round(este * 1e7), true);
  vista.setInt32(114, Math.round(norte * 1e7), true);
  vista.setUint8(118, 0);
  vista.setInt32(119, Math.round(((oeste + este) / 2) * 1e7), true);
  vista.setInt32(123, Math.round(((sur + norte) / 2) * 1e7), true);
  archivo.set(dirBytes, CABECERA);
  let pos = CABECERA + dirBytes.length;
  for (const t of ordenadas) {
    archivo.set(t.datos, pos);
    pos += t.datos.length;
  }
  return archivo;
}

/** Los bytes como `ArrayBuffer` exacto (sin el relleno de un `Uint8Array` con `byteOffset`). */
export function comoBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export interface ServidorSimulado {
  /** `fetch` de mentira: cuenta las llamadas y guarda las cabeceras recibidas. */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  llamadas: Array<{ url: string; rango: string | null }>;
}

/**
 * Un servidor que IGNORA `Range` (como Cloudflare Pages): responde siempre 200 con el archivo
 * entero, con `content-length` y sin `accept-ranges` ni `content-range`.
 */
export function servidorSinRange(
  cuerpo: Uint8Array | string,
  tipo = "application/octet-stream",
): ServidorSimulado {
  const llamadas: ServidorSimulado["llamadas"] = [];
  const bytes = typeof cuerpo === "string" ? new TextEncoder().encode(cuerpo) : cuerpo;
  return {
    llamadas,
    fetch: async (url, init) => {
      llamadas.push({ url, rango: new Headers(init?.headers).get("range") });
      return new Response(comoBuffer(bytes), {
        status: 200,
        headers: { "content-type": tipo, "content-length": String(bytes.length) },
      });
    },
  };
}
