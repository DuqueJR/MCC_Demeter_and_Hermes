// Genera los datos del relieve del mapa (T-649): `npm run relieve`.
//
// Descarga una sola vez los *Terrain Tiles* públicos de AWS (formato terrarium: Mapzen/Tilezen, con
// SRTM del USGS en Colombia) que cubren el recorte del mapa más una tesela de margen, y calcula las
// curvas de nivel desde el DEM del zoom máximo. Todo queda en `public/mapas/relieve/` y SE VERSIONA
// (pesa poco): el despliegue no necesita ningún paso a mano. Detalles en `src/mapa/README.md`.
//
// Uso:
//   node scripts/generar-relieve.mjs               descarga lo que falte y recalcula las curvas
//   node scripts/generar-relieve.mjs --forzar      vuelve a descargar todas las teselas
//   node scripts/generar-relieve.mjs --comprobar   verifica lo que hay en disco, sin red
// Opciones de depuración: --destino <carpeta> --zmin <n> --zmax <n> --intervalo <m> --indice <m>
//                         --suavizado <pasadas>
//
// Es determinista: los PNG se guardan tal cual llegan y las mismas teselas dan siempre las mismas
// curvas. Sin dependencias nativas (solo `pngjs` y `d3-contour`, JS puro).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import {
  bboxDeRango,
  curvasDeNivel,
  ensamblarMosaico,
  LADO_TESELA,
  listarTeselas,
  medianaTresPorTres,
  rangoDeTeselas,
  recortar,
  suavizar,
  ventanaDe,
} from "./relieve-lib.mjs";

// ---- Parámetros (los de presentación del mapa están en `src/mapa/constantes.ts`; una prueba
// comprueba que `intervalo_m` e `indice_cada_m` de `relieve.json` coincidan con los de allí) ----

/** Recorte del mapa: ±0,05° alrededor de `meta.sitio` (6,582, -75,823); el mismo del PMTiles. */
export const BBOX = [-75.873, 6.532, -75.773, 6.632];
export const ZOOM_MIN = 10;
export const ZOOM_MAX = 12;
/** Teselas de más por cada lado del recorte (el sombreado de MapLibre las necesita). */
export const MARGEN_TESELAS = 1;
export const INTERVALO_CURVAS_M = 50;
export const INDICE_CADA_M = 250;
/** Las curvas cubren el recorte más esta holgura, en grados (unos 550 m). */
export const RELLENO_CURVAS_GRADOS = 0.005;
/** Simplificación de las curvas (Douglas-Peucker), en píxeles del DEM. */
export const TOLERANCIA_CURVAS_PX = 0.25;
/** Pasadas del promedio 3 x 3 antes de sacar las curvas. */
export const PASADAS_SUAVIZADO = 2;
export const DECIMALES_COORDENADAS = 5;
/** Presupuesto de todo `public/mapas/relieve/` (teselas, curvas y json). */
export const PRESUPUESTO_BYTES = 3 * 1024 * 1024;

const PLANTILLA_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const FUENTE =
  "AWS Terrain Tiles, formato terrarium (Mapzen/Tilezen; SRTM del USGS en la zona del mapa)";
const ATRIBUCION =
  "Relieve: Mapzen/Tilezen · SRTM y GMTED2010, cortesía del Servicio Geológico de EE. UU. (USGS)";
const URL_ATRIBUCION = "https://github.com/tilezen/joerd/blob/master/docs/attribution.md";
const ARCHIVO_CURVAS = "curvas.geojson";
const ARCHIVO_META = "relieve.json";
const CONCURRENCIA = 4;
const REINTENTOS = 3;
const ESPERA_MS = 800;
const TIMEOUT_MS = 30_000;
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const DESPLAZAMIENTO_ANCHO_IHDR = 16;

const aqui = dirname(fileURLToPath(import.meta.url));
const DESTINO_POR_DEFECTO = resolve(aqui, "../public/mapas/relieve");

// ---- Utilidades ----

const rutaTesela = (destino, { z, x, y }) => join(destino, String(z), String(x), `${y}.png`);
const urlTesela = ({ z, x, y }) =>
  PLANTILLA_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** Los bytes son un PNG de LADO_TESELA x LADO_TESELA (lee la cabecera, sin decodificar). */
function esPngValido(bytes) {
  if (bytes.length < DESPLAZAMIENTO_ANCHO_IHDR + 8) return false;
  if (!FIRMA_PNG.every((b, i) => bytes[i] === b)) return false;
  const ancho = bytes.readUInt32BE(DESPLAZAMIENTO_ANCHO_IHDR);
  const alto = bytes.readUInt32BE(DESPLAZAMIENTO_ANCHO_IHDR + 4);
  return ancho === LADO_TESELA && alto === LADO_TESELA;
}

async function descargar(tesela) {
  let ultimo;
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    try {
      const respuesta = await fetch(urlTesela(tesela), { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const bytes = Buffer.from(await respuesta.arrayBuffer());
      if (!esPngValido(bytes)) throw new Error("la respuesta no es un PNG de 256 x 256");
      return bytes;
    } catch (e) {
      ultimo = e;
      await esperar(ESPERA_MS * 2 ** intento);
    }
  }
  throw new Error(`No se pudo bajar ${urlTesela(tesela)}: ${ultimo}`);
}

/** Corre `tarea` sobre `lista` con a lo sumo `CONCURRENCIA` a la vez. */
async function enParalelo(lista, tarea) {
  let siguiente = 0;
  const trabajadores = Array.from({ length: CONCURRENCIA }, async () => {
    while (siguiente < lista.length) await tarea(lista[siguiente++]);
  });
  await Promise.all(trabajadores);
}

function parsearArgumentos(argv) {
  const opciones = {
    destino: DESTINO_POR_DEFECTO,
    zmin: ZOOM_MIN,
    zmax: ZOOM_MAX,
    intervalo: INTERVALO_CURVAS_M,
    indice: INDICE_CADA_M,
    suavizado: PASADAS_SUAVIZADO,
    forzar: false,
    comprobar: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Falta el valor de ${a}`);
      return v;
    };
    if (a === "--forzar") opciones.forzar = true;
    else if (a === "--comprobar") opciones.comprobar = true;
    else if (a === "--destino") opciones.destino = resolve(valor());
    else if (a === "--zmin") opciones.zmin = Number(valor());
    else if (a === "--zmax") opciones.zmax = Number(valor());
    else if (a === "--intervalo") opciones.intervalo = Number(valor());
    else if (a === "--indice") opciones.indice = Number(valor());
    else if (a === "--suavizado") opciones.suavizado = Number(valor());
    else throw new Error(`Opción desconocida: ${a}`);
  }
  return opciones;
}

function leerMeta(destino) {
  const ruta = join(destino, ARCHIVO_META);
  return existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")) : null;
}

const hoy = () => new Date().toISOString().slice(0, 10);

// ---- Generar ----

async function generar(o) {
  mkdirSync(o.destino, { recursive: true });
  const anterior = leerMeta(o.destino);
  const teselas = [];
  for (let z = o.zmin; z <= o.zmax; z++) {
    teselas.push(...listarTeselas(rangoDeTeselas(BBOX, z, MARGEN_TESELAS), z));
  }
  const faltan = teselas.filter((t) => o.forzar || !existsSync(rutaTesela(o.destino, t)));
  console.log(`${teselas.length} teselas en z${o.zmin}-z${o.zmax}; a descargar: ${faltan.length}`);
  await enParalelo(faltan, async (t) => {
    const bytes = await descargar(t);
    const ruta = rutaTesela(o.destino, t);
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, bytes);
  });

  // Curvas: del DEM del zoom máximo, recortado al mapa más una holgura.
  const rango = rangoDeTeselas(BBOX, o.zmax, MARGEN_TESELAS);
  const mosaico = ensamblarMosaico(rango, (x, y) =>
    PNG.sync.read(readFileSync(rutaTesela(o.destino, { z: o.zmax, x, y }))),
  );
  const ventana = ventanaDe(BBOX, rango, o.zmax, RELLENO_CURVAS_GRADOS, mosaico);
  let malla = recortar(mosaico, ventana);
  malla = medianaTresPorTres(malla);
  if (o.suavizado > 0) malla = suavizar(malla, o.suavizado);
  const curvas = curvasDeNivel(malla, {
    z: o.zmax,
    origenPx: {
      x: rango.xmin * LADO_TESELA + ventana.x0,
      y: rango.ymin * LADO_TESELA + ventana.y0,
    },
    intervaloM: o.intervalo,
    indiceCadaM: o.indice,
    toleranciaPx: TOLERANCIA_CURVAS_PX,
    decimales: DECIMALES_COORDENADAS,
  });
  writeFileSync(join(o.destino, ARCHIVO_CURVAS), JSON.stringify(curvas));

  let eleMin = Number.POSITIVE_INFINITY;
  let eleMax = Number.NEGATIVE_INFINITY;
  for (const v of malla.valores) {
    if (v < eleMin) eleMin = v;
    if (v > eleMax) eleMax = v;
  }
  const meta = {
    formato: "relieve-1",
    fuente: FUENTE,
    url_origen: PLANTILLA_URL,
    atribucion: ATRIBUCION,
    url_atribucion: URL_ATRIBUCION,
    // La fecha de la descarga: no cambia si solo se recalculan las curvas con las mismas teselas.
    fecha: faltan.length === 0 && anterior?.fecha ? anterior.fecha : hoy(),
    bbox: BBOX,
    // Lo que cubren las teselas del zoom máximo: fuera de ahí no hay datos (MapLibre no los pide).
    bounds: bboxDeRango(rango, o.zmax),
    minzoom: o.zmin,
    maxzoom: o.zmax,
    codificacion: "terrarium",
    tamano_tesela: LADO_TESELA,
    teselas: teselas.length,
    curvas: {
      archivo: ARCHIVO_CURVAS,
      intervalo_m: o.intervalo,
      indice_cada_m: o.indice,
      z_dem: o.zmax,
      suavizado_pasadas: o.suavizado,
      elevacion_min_m: Math.round(eleMin),
      elevacion_max_m: Math.round(eleMax),
      niveles: curvas.features.length,
    },
  };
  writeFileSync(join(o.destino, ARCHIVO_META), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`Listo: ${ARCHIVO_META}, ${ARCHIVO_CURVAS} (${curvas.features.length} niveles).`);
  return comprobar(o);
}

// ---- Comprobar (sin red) ----

/** Verifica lo que hay en disco. Devuelve `true` si todo está bien. */
function comprobar(o) {
  const problemas = [];
  const meta = leerMeta(o.destino);
  if (!meta) {
    console.error(`Falta ${join(o.destino, ARCHIVO_META)}. Corre: npm run relieve`);
    return false;
  }
  let total = statSync(join(o.destino, ARCHIVO_META)).size;
  const porZoom = new Map();
  for (let z = meta.minzoom; z <= meta.maxzoom; z++) {
    const lista = listarTeselas(rangoDeTeselas(meta.bbox, z, MARGEN_TESELAS), z);
    let bytesZoom = 0;
    for (const t of lista) {
      const ruta = rutaTesela(o.destino, t);
      if (!existsSync(ruta)) {
        problemas.push(`falta la tesela ${t.z}/${t.x}/${t.y}`);
        continue;
      }
      const bytes = readFileSync(ruta);
      if (!esPngValido(bytes)) problemas.push(`no es un PNG de 256 x 256: ${t.z}/${t.x}/${t.y}`);
      bytesZoom += bytes.length;
    }
    porZoom.set(z, { teselas: lista.length, bytes: bytesZoom });
    total += bytesZoom;
  }
  if (meta.teselas !== [...porZoom.values()].reduce((s, v) => s + v.teselas, 0)) {
    problemas.push("`teselas` de relieve.json no coincide con las que debería haber");
  }
  const rutaCurvas = join(o.destino, meta.curvas.archivo);
  if (!existsSync(rutaCurvas)) {
    problemas.push(`falta ${meta.curvas.archivo}`);
  } else {
    total += statSync(rutaCurvas).size;
    const curvas = JSON.parse(readFileSync(rutaCurvas, "utf8"));
    if (curvas.type !== "FeatureCollection" || curvas.features.length === 0) {
      problemas.push(`${meta.curvas.archivo} no tiene curvas`);
    }
    const tipos = new Set(curvas.features?.map((f) => f.properties?.tipo));
    if (!(tipos.has("indice") && tipos.has("intermedia"))) {
      problemas.push("las curvas no distinguen índice de intermedia");
    }
  }
  console.log(`Relieve en ${o.destino}`);
  console.log(`  fuente: ${meta.fuente}\n  fecha: ${meta.fecha}`);
  console.log(`  zooms: z${meta.minzoom}-z${meta.maxzoom}, recorte ${meta.bbox.join(", ")}`);
  for (const [z, v] of porZoom) console.log(`  z${z}: ${v.teselas} teselas, ${kb(v.bytes)}`);
  if (existsSync(rutaCurvas)) {
    console.log(
      `  curvas: cada ${meta.curvas.intervalo_m} m (índice cada ${meta.curvas.indice_cada_m} m), ` +
        `${meta.curvas.niveles} niveles, ${kb(statSync(rutaCurvas).size)}`,
    );
  }
  console.log(`  total: ${kb(total)} de ${kb(PRESUPUESTO_BYTES)} permitidos`);
  if (total > PRESUPUESTO_BYTES) problemas.push(`pasa del presupuesto (${kb(total)})`);
  for (const p of problemas) console.error(`  PROBLEMA: ${p}`);
  return problemas.length === 0;
}

// ---- Entrada ----

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opciones = parsearArgumentos(process.argv.slice(2));
  const bien = opciones.comprobar ? comprobar(opciones) : await generar(opciones);
  process.exit(bien ? 0 : 1);
}
