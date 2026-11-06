// Genera el guion de la "simulación para el público" (T-635, 03 §4, D-W18) a partir del JSONL
// `nominal` de Deméter (OpenRocket, `tools/web_datos`), recortado y decimado para que pese unos
// cientos de KB y se pueda descargar solo cuando alguien pulsa "Ver la simulación del vuelo".
//
// Uso (desde gui/web/):  npm run simulacion:generar        escribe src/assets/demeter/simulacion_nominal.json
//                        npm run simulacion:generar -- --comprobar   falla si el archivo versionado no coincide
//
// La salida es determinista: volver a generar produce los mismos bytes, y `pruebas/simulacion.test.ts`
// compara el archivo versionado con lo que sale de aquí. Solo se versiona el resultado liviano; el
// JSONL de origen (`dev/datos/demeter_nominal.jsonl`) ya está en el repo.
//
// Qué se conserva (el contrato `web-1` no cambia: cada mensaje sigue siendo un mensaje del contrato):
//   - `meta` y `evento`: todos (son pocos y la línea de fases depende de ellos).
//   - `estacion` (latido a 1 Hz): todos.
//   - `estado`: en tierra (PREFLIGHT, ARMED, LANDED) todos, que ya van a 1 Hz; en vuelo uno de cada
//     `ESTADO_EN_VUELO_CADA` y, siempre, el primero de cada fase. La interpolación de la UI rellena el resto.
//   - `salud`: el primero, uno de cada `SALUD_CADA` y cualquiera que cambie el Go/No-Go, la calibración o las fallas.
//   - Después del aterrizaje solo se deja `COLA_TRAS_ATERRIZAJE_MS`: el reproductor se queda en LANDED.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Identifica la forma del archivo: si cambia, el cargador de la web rechaza el guion viejo. */
export const FORMATO_SIMULACION = "simulacion-1";
export const MISION = "demeter";
export const ESCENARIO = "nominal";

/** Fases en las que el cohete está quieto: ahí el relay ya baja el NAV a 1 Hz y no se decima. */
const FASES_DE_TIERRA = new Set(["BOOT", "PREFLIGHT", "ARMED", "LANDED", "ERROR"]);
/** (P) De cada tantos `estado` en vuelo (9 Hz) se deja uno: ~3 Hz. */
export const ESTADO_EN_VUELO_CADA = 3;
/** (P) De cada tantos `salud` (1 Hz) se deja uno, además de los que cambian algo. */
export const SALUD_CADA = 10;
/** (P) Cuánto se conserva del tiempo en LANDED después del evento `aterrizaje`. */
export const COLA_TRAS_ATERRIZAJE_MS = 10_000;
/** (P) Presupuesto del archivo (sin comprimir): "unos pocos cientos de KB como máximo". */
export const PRESUPUESTO_BYTES = 400 * 1024;

const aqui = dirname(fileURLToPath(import.meta.url));
export const RUTA_ORIGEN = join(aqui, "..", "dev", "datos", `${MISION}_${ESCENARIO}.jsonl`);
export const RUTA_DESTINO = join(aqui, "..", "src", "assets", MISION, "simulacion_nominal.json");

/** Lo que cambia el significado de un `salud` (la UI lo pinta distinto), sin el ruido de cada segundo. */
const firmaSalud = (s) =>
  JSON.stringify([s.go_nogo, s.calib, s.fallas_bits, s.gnss.fix, s.apogeo_m !== 0]);

/**
 * Recorta y decima las líneas de un JSONL del contrato.
 * @param {{ t_rel_ms: number, evento: string, datos: any }[]} lineas
 * @returns {{ t_rel_ms: number, evento: string, datos: any }[]}
 */
export function compactar(lineas) {
  const aterrizaje = lineas.find((l) => l.evento === "evento" && l.datos.tipo === "aterrizaje");
  if (!aterrizaje) throw new Error("el escenario no trae el evento aterrizaje");
  const fin = aterrizaje.t_rel_ms + COLA_TRAS_ATERRIZAJE_MS;

  const salida = [];
  let faseAnterior = null;
  let enVuelo = 0;
  let saludN = 0;
  let saludFirma = null;
  for (const l of lineas) {
    if (l.t_rel_ms > fin) break;
    if (l.evento === "estado") {
      const fase = l.datos.fase;
      const tierra = FASES_DE_TIERRA.has(fase);
      const cambioDeFase = fase !== faseAnterior;
      if (tierra || cambioDeFase || enVuelo % ESTADO_EN_VUELO_CADA === 0) salida.push(l);
      // El contador de vuelo se reinicia en cada fase para que el primero de cada una cuente como uno.
      enVuelo = tierra || cambioDeFase ? 1 : enVuelo + 1;
      faseAnterior = fase;
    } else if (l.evento === "salud") {
      const firma = firmaSalud(l.datos);
      if (saludN % SALUD_CADA === 0 || firma !== saludFirma) salida.push(l);
      saludFirma = firma;
      saludN += 1;
    } else {
      salida.push(l);
    }
  }
  return salida;
}

/** El archivo completo, ya serializado (JSON compacto con salto de línea final). */
export function generarTexto(textoJsonl) {
  const lineas = textoJsonl
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l));
  const compactas = compactar(lineas);
  const ultima = compactas[compactas.length - 1];
  const guion = {
    formato: FORMATO_SIMULACION,
    mision: MISION,
    escenario: ESCENARIO,
    duracion_ms: ultima.t_rel_ms,
    lineas: compactas,
  };
  return `${JSON.stringify(guion)}\n`;
}

function principal() {
  const comprobar = process.argv.includes("--comprobar");
  const texto = generarTexto(readFileSync(RUTA_ORIGEN, "utf8"));
  const bytes = Buffer.byteLength(texto);
  if (bytes > PRESUPUESTO_BYTES) {
    console.error(`El guion pesa ${bytes} B y el presupuesto es ${PRESUPUESTO_BYTES} B.`);
    process.exit(1);
  }
  if (comprobar) {
    const actual = existsSync(RUTA_DESTINO) ? readFileSync(RUTA_DESTINO, "utf8") : null;
    if (actual !== texto) {
      console.error(`${RUTA_DESTINO} no coincide con lo que genera el script: vuelve a generarlo.`);
      process.exit(1);
    }
    console.log(`Simulación OK: ${bytes} B, coincide con el archivo versionado.`);
    return;
  }
  mkdirSync(dirname(RUTA_DESTINO), { recursive: true });
  writeFileSync(RUTA_DESTINO, texto);
  console.log(`${resolve(RUTA_DESTINO)}: ${bytes} B`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
