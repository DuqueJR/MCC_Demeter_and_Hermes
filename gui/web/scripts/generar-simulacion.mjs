// Genera el guion de la "simulación para el público" (T-635 y T-637, 03 §4, D-W18) a partir del JSONL
// `nominal` de cada misión (`tools/web_datos`), recortado y decimado para que pese unos cientos de KB
// y se pueda descargar solo cuando alguien pulsa "Ver la simulación del vuelo".
//
// De dónde sale cada guion (no es lo mismo, y la web lo dice así):
//   - Deméter: el JSONL sale de la simulación de OpenRocket (`demeter_nominal.jsonl`).
//   - Hermes (T-637): el JSONL es SINTÉTICO (`hermes_nominal.jsonl`, modo "sintetico"). NO es un
//     cálculo del motor G80-7T: no existe esa simulación (PEN-07, PEN-W04). Es un vuelo de ejemplo.
//     Su `meta.modo` se reescribe a "simulacion" al generar, para que el cargador de la web
//     (`esGuion`) lo acepte y la página muestre el banner y la marca SIM.
//
// Uso (desde gui/web/):  npm run simulacion:generar                       escribe el guion de cada misión
//                        npm run simulacion:generar -- --mision=hermes    solo esa misión
//                        npm run simulacion:generar -- --comprobar        falla si algún archivo versionado no coincide
//
// La salida es determinista: volver a generar produce los mismos bytes, y `pruebas/simulacion.test.ts`
// compara cada archivo versionado con lo que sale de aquí. Solo se versiona el resultado liviano; los
// JSONL de origen (`dev/datos/<misión>_nominal.jsonl`) ya están en el repo.
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
/** Las misiones con simulación: la primera es la de T-635 (los nombres sin sufijo siguen siendo suyos). */
export const MISIONES = ["demeter", "hermes"];
export const MISION = "demeter";
export const ESCENARIO = "nominal";
/** `meta.modo` que lleva todo guion: es lo que la web exige para no confundirlo nunca con lo real. */
export const MODO_SIMULACION = "simulacion";

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
/** De dónde se lee y adónde se escribe el guion de una misión. */
export function rutasDe(mision) {
  if (!MISIONES.includes(mision)) throw new Error(`misión desconocida: ${mision}`);
  return {
    origen: join(aqui, "..", "dev", "datos", `${mision}_${ESCENARIO}.jsonl`),
    destino: join(aqui, "..", "src", "assets", mision, "simulacion_nominal.json"),
  };
}
export const RUTA_ORIGEN = rutasDe(MISION).origen;
export const RUTA_DESTINO = rutasDe(MISION).destino;

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

/**
 * Todo `meta` del guion lleva `modo = "simulacion"`, venga de OpenRocket (ya lo trae así) o de datos
 * sintéticos (Hermes: trae "sintetico"). No se toca nada más del mensaje.
 */
function comoSimulacion(l) {
  if (l.evento !== "meta" || l.datos.modo === MODO_SIMULACION) return l;
  return { ...l, datos: { ...l.datos, modo: MODO_SIMULACION } };
}

/** El archivo completo de una misión, ya serializado (JSON compacto con salto de línea final). */
export function generarTexto(textoJsonl, mision = MISION) {
  const lineas = textoJsonl
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l));
  const origen = lineas.find((l) => l.evento === "meta");
  if (!origen || origen.datos.mision !== mision) {
    throw new Error(`el JSONL de origen no es de ${mision}: no se mezclan las misiones (D-W01)`);
  }
  const compactas = compactar(lineas).map(comoSimulacion);
  const ultima = compactas[compactas.length - 1];
  const guion = {
    formato: FORMATO_SIMULACION,
    mision,
    escenario: ESCENARIO,
    duracion_ms: ultima.t_rel_ms,
    lineas: compactas,
  };
  return `${JSON.stringify(guion)}\n`;
}

/** Genera (o comprueba) el guion de una misión. Devuelve `false` si algo falla. */
function procesar(mision, comprobar) {
  const { origen, destino } = rutasDe(mision);
  const texto = generarTexto(readFileSync(origen, "utf8"), mision);
  const bytes = Buffer.byteLength(texto);
  if (bytes > PRESUPUESTO_BYTES) {
    console.error(
      `${mision}: el guion pesa ${bytes} B y el presupuesto es ${PRESUPUESTO_BYTES} B.`,
    );
    return false;
  }
  if (comprobar) {
    const actual = existsSync(destino) ? readFileSync(destino, "utf8") : null;
    if (actual !== texto) {
      console.error(`${destino} no coincide con lo que genera el script: vuelve a generarlo.`);
      return false;
    }
    console.log(`Simulación ${mision} OK: ${bytes} B, coincide con el archivo versionado.`);
    return true;
  }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, texto);
  console.log(`${resolve(destino)}: ${bytes} B`);
  return true;
}

function principal() {
  const comprobar = process.argv.includes("--comprobar");
  const pedida = process.argv.find((a) => a.startsWith("--mision="))?.slice("--mision=".length);
  if (pedida !== undefined && !MISIONES.includes(pedida)) {
    console.error(`misión desconocida: ${pedida} (hay: ${MISIONES.join(", ")})`);
    process.exit(1);
  }
  const resultados = (pedida ? [pedida] : MISIONES).map((m) => procesar(m, comprobar));
  if (resultados.includes(false)) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
