// Lógica pura del relieve del mapa (T-649): teselas, decodificación terrarium y curvas de nivel.
// Sin red ni disco: la usan `generar-relieve.mjs` (el script) y las pruebas (`pruebas/relieve.test.ts`).
// Las pruebas la alimentan con un DEM sintético, así que nada de aquí depende de AWS.
import { contours } from "d3-contour";

/** Lado en px de una tesela terrarium. */
export const LADO_TESELA = 256;
const GRADOS_POR_VUELTA = 360;
const MEDIA_VUELTA = 180;
/** Desplazamiento de la codificación terrarium: `elev = R*256 + G + B/256 - 32768`. */
const BASE_TERRARIUM = 32768;
const BYTE = 256;

// ---- Teselas (esquema XYZ de Web Mercator) ----

/** Coordenadas fraccionarias de tesela (x hacia el este, y hacia el sur) de un punto a un zoom. */
export function teselaFraccionaria(lon, lat, z) {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / MEDIA_VUELTA;
  return {
    x: ((lon + MEDIA_VUELTA) / GRADOS_POR_VUELTA) * n,
    y: ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n,
  };
}

/**
 * Rango de teselas que cubre un recuadro `[oeste, sur, este, norte]` a un zoom, más `margen`
 * teselas por cada lado (el sombreado de MapLibre necesita las vecinas para no marcar los bordes).
 */
export function rangoDeTeselas(bbox, z, margen = 0) {
  const [oeste, sur, este, norte] = bbox;
  const n = 2 ** z;
  const noroeste = teselaFraccionaria(oeste, norte, z);
  const sureste = teselaFraccionaria(este, sur, z);
  const limitar = (v) => Math.min(n - 1, Math.max(0, v));
  return {
    xmin: limitar(Math.floor(noroeste.x) - margen),
    xmax: limitar(Math.floor(sureste.x) + margen),
    ymin: limitar(Math.floor(noroeste.y) - margen),
    ymax: limitar(Math.floor(sureste.y) + margen),
  };
}

/** Longitud y latitud (grados) de un punto en píxeles globales de un zoom (origen: noroeste del mundo). */
export function pixelALonLat(px, py, z) {
  const mundo = LADO_TESELA * 2 ** z;
  return {
    lon: (px / mundo) * GRADOS_POR_VUELTA - MEDIA_VUELTA,
    lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / mundo))) * MEDIA_VUELTA) / Math.PI,
  };
}

/** El recuadro `[oeste, sur, este, norte]` que cubre un rango de teselas. */
export function bboxDeRango(rango, z) {
  const noroeste = pixelALonLat(rango.xmin * LADO_TESELA, rango.ymin * LADO_TESELA, z);
  const sureste = pixelALonLat((rango.xmax + 1) * LADO_TESELA, (rango.ymax + 1) * LADO_TESELA, z);
  return [noroeste.lon, sureste.lat, sureste.lon, noroeste.lat];
}

/** Todas las teselas `{z, x, y}` de un rango, en un orden fijo (z, x, y). */
export function listarTeselas(rango, z) {
  const lista = [];
  for (let x = rango.xmin; x <= rango.xmax; x++) {
    for (let y = rango.ymin; y <= rango.ymax; y++) lista.push({ z, x, y });
  }
  return lista;
}

// ---- Terrarium ----

/** Elevación en metros de un píxel terrarium. */
export function decodificarTerrarium(r, g, b) {
  return r * BYTE + g + b / BYTE - BASE_TERRARIUM;
}

/** Inversa de `decodificarTerrarium` (para armar teselas sintéticas en las pruebas). */
export function codificarTerrarium(elevacion) {
  const v = Math.round((elevacion + BASE_TERRARIUM) * BYTE);
  return [Math.floor(v / (BYTE * BYTE)), Math.floor(v / BYTE) % BYTE, v % BYTE];
}

/** Elevaciones (m) de una imagen RGBA ya decodificada, `Float32Array` de `ancho * alto`. */
export function elevacionesDeImagen({ width, height, data }) {
  const salida = new Float32Array(width * height);
  for (let i = 0; i < salida.length; i++) {
    salida[i] = decodificarTerrarium(data[4 * i], data[4 * i + 1], data[4 * i + 2]);
  }
  return salida;
}

/**
 * Une las teselas de un rango en una sola malla. `obtener(x, y)` devuelve la imagen RGBA decodificada
 * de la tesela (`{width, height, data}`). Todas deben medir `LADO_TESELA`.
 */
export function ensamblarMosaico(rango, obtener) {
  const columnas = rango.xmax - rango.xmin + 1;
  const filas = rango.ymax - rango.ymin + 1;
  const ancho = columnas * LADO_TESELA;
  const alto = filas * LADO_TESELA;
  const valores = new Float32Array(ancho * alto);
  for (let ty = 0; ty < filas; ty++) {
    for (let tx = 0; tx < columnas; tx++) {
      const imagen = obtener(rango.xmin + tx, rango.ymin + ty);
      if (imagen.width !== LADO_TESELA || imagen.height !== LADO_TESELA) {
        throw new Error(
          `La tesela ${rango.xmin + tx}/${rango.ymin + ty} no mide ${LADO_TESELA} px`,
        );
      }
      const elevaciones = elevacionesDeImagen(imagen);
      for (let fila = 0; fila < LADO_TESELA; fila++) {
        const destino = (ty * LADO_TESELA + fila) * ancho + tx * LADO_TESELA;
        valores.set(elevaciones.subarray(fila * LADO_TESELA, (fila + 1) * LADO_TESELA), destino);
      }
    }
  }
  return { ancho, alto, valores };
}

/**
 * La ventana (en px del mosaico) que cubre `bbox` más `relleno` grados por cada lado. Se limita al
 * mosaico: nunca sale de lo que hay descargado.
 */
export function ventanaDe(bbox, rango, z, relleno, mosaico) {
  const [oeste, sur, este, norte] = bbox;
  const a = teselaFraccionaria(oeste - relleno, norte + relleno, z);
  const b = teselaFraccionaria(este + relleno, sur - relleno, z);
  const x0 = Math.max(0, Math.floor((a.x - rango.xmin) * LADO_TESELA));
  const y0 = Math.max(0, Math.floor((a.y - rango.ymin) * LADO_TESELA));
  const x1 = Math.min(mosaico.ancho, Math.ceil((b.x - rango.xmin) * LADO_TESELA));
  const y1 = Math.min(mosaico.alto, Math.ceil((b.y - rango.ymin) * LADO_TESELA));
  return { x0, y0, ancho: x1 - x0, alto: y1 - y0 };
}

/** Copia una ventana de la malla. */
export function recortar(mosaico, { x0, y0, ancho, alto }) {
  const valores = new Float32Array(ancho * alto);
  for (let fila = 0; fila < alto; fila++) {
    const origen = (y0 + fila) * mosaico.ancho + x0;
    valores.set(mosaico.valores.subarray(origen, origen + ancho), fila * ancho);
  }
  return { ancho, alto, valores };
}

/**
 * Mediana de 3 x 3 (los bordes repiten su vecino). Quita los píxeles sueltos que trae el SRTM en
 * los cantiles (hay de -2 m o de 184 m junto a uno de 638 m): sin esto, cada uno deja su
 * circulito de curvas. Un promedio no sirve para eso, porque reparte el error en vez de quitarlo.
 */
export function medianaTresPorTres(malla) {
  const { ancho, alto, valores } = malla;
  const salida = new Float32Array(valores.length);
  const ventana = new Float32Array(9);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(alto - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(ancho - 1, Math.max(0, x + dx));
          ventana[k++] = valores[yy * ancho + xx];
        }
      }
      ventana.sort();
      salida[y * ancho + x] = ventana[4];
    }
  }
  return { ancho, alto, valores: salida };
}

/**
 * Suavizado por promedio de 3 x 3 (los bordes repiten su vecino). El SRTM trae escalones de unos
 * metros en las zonas planas; sin esto, las curvas salen con dientes.
 */
export function suavizar(malla, pasadas = 1) {
  let actual = malla.valores;
  const { ancho, alto } = malla;
  for (let p = 0; p < pasadas; p++) {
    const nuevo = new Float32Array(actual.length);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        let suma = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = Math.min(alto - 1, Math.max(0, y + dy));
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(ancho - 1, Math.max(0, x + dx));
            suma += actual[yy * ancho + xx];
          }
        }
        nuevo[y * ancho + x] = suma / 9;
      }
    }
    actual = nuevo;
  }
  return { ancho, alto, valores: actual };
}

// ---- Curvas de nivel ----

/** Distancia de un punto al segmento `a-b`. */
function distanciaASegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const largo2 = dx * dx + dy * dy;
  const t =
    largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker iterativo (sin recursión: una curva puede tener miles de vértices). */
export function simplificar(linea, tolerancia) {
  if (linea.length < 3) return linea;
  const conservar = new Uint8Array(linea.length);
  conservar[0] = 1;
  conservar[linea.length - 1] = 1;
  const pila = [[0, linea.length - 1]];
  while (pila.length > 0) {
    const [i0, i1] = pila.pop();
    let maxDist = 0;
    let indice = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = distanciaASegmento(linea[i], linea[i0], linea[i1]);
      if (d > maxDist) {
        maxDist = d;
        indice = i;
      }
    }
    if (indice >= 0 && maxDist > tolerancia) {
      conservar[indice] = 1;
      pila.push([i0, indice], [indice, i1]);
    }
  }
  return linea.filter((_, i) => conservar[i] === 1);
}

/**
 * Parte los anillos de d3-contour en líneas abiertas, quitando los vértices que están en el borde
 * de la malla: d3-contour cierra cada polígono por el borde, y ese tramo no es una curva real.
 */
function lineasDeAnillos(multiPoligono, ancho, alto) {
  const lineas = [];
  for (const poligono of multiPoligono.coordinates) {
    for (const anillo of poligono) {
      let actual = [];
      const cerrar = () => {
        if (actual.length >= 2) lineas.push(actual);
        actual = [];
      };
      for (const [x, y] of anillo) {
        const enBorde = x <= 0 || y <= 0 || x >= ancho || y >= alto;
        if (enBorde) cerrar();
        else actual.push([x, y]);
      }
      cerrar();
    }
  }
  return lineas;
}

/**
 * Curvas de nivel de una malla de elevaciones como GeoJSON.
 *
 * @param malla `{ancho, alto, valores}` (Float32Array en metros)
 * @param opciones
 *   - `z`: zoom de los píxeles de la malla
 *   - `origenPx`: `{x, y}` píxel global (de ese zoom) de la esquina noroeste de la malla
 *   - `intervaloM`: separación entre curvas, en metros
 *   - `indiceCadaM`: cada cuántos metros hay una curva índice (múltiplo de `intervaloM`)
 *   - `toleranciaPx`: tolerancia de la simplificación, en píxeles de la malla
 *   - `decimales`: decimales de las coordenadas (5 son ~1 m)
 */
export function curvasDeNivel(malla, opciones) {
  const { z, origenPx, intervaloM, indiceCadaM, toleranciaPx, decimales } = opciones;
  if (indiceCadaM % intervaloM !== 0) {
    throw new Error("indiceCadaM debe ser múltiplo de intervaloM");
  }
  let minimo = Number.POSITIVE_INFINITY;
  let maximo = Number.NEGATIVE_INFINITY;
  for (const v of malla.valores) {
    if (v < minimo) minimo = v;
    if (v > maximo) maximo = v;
  }
  const niveles = [];
  for (let n = Math.ceil(minimo / intervaloM) * intervaloM; n <= maximo; n += intervaloM) {
    niveles.push(n);
  }
  const factor = 10 ** decimales;
  const redondear = (v) => Math.round(v * factor) / factor;
  const generador = contours().size([malla.ancho, malla.alto]).thresholds(niveles);
  const features = [];
  for (const piso of generador(malla.valores)) {
    const lineas = lineasDeAnillos(piso, malla.ancho, malla.alto)
      .map((l) => simplificar(l, toleranciaPx))
      .filter((l) => l.length >= 2)
      .map((l) =>
        l.map(([x, y]) => {
          const { lon, lat } = pixelALonLat(origenPx.x + x, origenPx.y + y, z);
          return [redondear(lon), redondear(lat)];
        }),
      );
    if (lineas.length === 0) continue;
    features.push({
      type: "Feature",
      properties: {
        ele: piso.value,
        tipo: piso.value % indiceCadaM === 0 ? "indice" : "intermedia",
      },
      geometry: { type: "MultiLineString", coordinates: lineas },
    });
  }
  return { type: "FeatureCollection", features };
}
