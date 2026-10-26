// Quita el fondo plano de los íconos ilustrativos y los guarda a 512 px con transparencia [T-621].
// Script de una sola vez, repetible: se vuelve a correr si el diseñador cambia las imágenes.
//
// Uso (desde gui/web):  node scripts/iconos-transparentes.mjs [carpeta_de_originales]
//   Por defecto lee ../../generated_images/iconos/elegidos/ (no se versiona) con archivos
//   `<mision>_<parte>.png` (por ejemplo `demeter_nariz.png`) y escribe
//   `src/assets/<mision>/iconos/<parte>.png` (512×512, RGBA, PNG con paleta).
//
// Método (el fondo de los originales es un color oscuro casi plano, con un leve degradado):
//  1. Modela el fondo con un polinomio de grado 2 por canal (x, y), ajustado a los píxeles que se
//     parecen al fondo (primero el anillo del borde; luego, todos los que quedan cerca del modelo).
//  2. alfa = suavizado((distancia de color al fondo - D_MIN) / (D_MAX - D_MIN)): el borde queda suave.
//  3. Lo que queda ENCERRADO por el dibujo (un lente, el cuerpo de una lata) y se parece al fondo
//     no se vuelve transparente: solo es transparente lo que se conecta con el borde de la imagen
//     (más una franja de 2 px para el borde suave).
//  4. Quita el color del fondo mezclado en los bordes (F = (C - (1 - a)·B) / a).
//  5. Recorta al dibujo, lo centra en un cuadrado con un margen del 5 % y lo reduce a 512 px
//     (sharp premultiplica el alfa al reducir, así que no quedan halos).
import { mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_WEB = resolve(AQUI, "..");
const SALIDA_PX = 512;
// Distancia euclidiana de color (0–441): bajo D_MIN es fondo; sobre D_MAX es dibujo sólido.
const D_MIN = 10;
const D_MAX = 60;
// Un píxel "se parece al fondo" si queda a menos de esto del modelo (para ajustarlo).
const D_AJUSTE = 14;
const ANILLO = 0.07; // fracción del lado que cuenta como borde para el primer ajuste
const FRANJA_BORDE_PX = 2;
const MARGEN = 0.05; // margen alrededor del dibujo, como fracción de su lado mayor
const ALFA_DIBUJO = 64; // un píxel con alfa mayor a esto (de 255) cuenta como parte del dibujo

/** Caja que encierra los píxeles del dibujo (alfa > ALFA_DIBUJO). */
function cajaDelDibujo(rgba, ancho, alto) {
  let x0 = ancho;
  let y0 = alto;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if ((rgba[(y * ancho + x) * 4 + 3] ?? 0) > ALFA_DIBUJO) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: ancho, h: alto };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Resuelve A·x = b por eliminación gaussiana (A es n×n). */
function resolverSistema(A, b) {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

const base = (u, v) => [1, u, v, u * u, u * v, v * v];

/** Ajusta un polinomio de grado 2 por canal con los píxeles elegidos (cada `paso` píxeles). */
function ajustarFondo(rgb, ancho, alto, elegido, paso = 3) {
  const A = Array.from({ length: 6 }, () => new Array(6).fill(0));
  const b = [new Array(6).fill(0), new Array(6).fill(0), new Array(6).fill(0)];
  for (let y = 0; y < alto; y += paso) {
    for (let x = 0; x < ancho; x += paso) {
      if (!elegido(x, y)) continue;
      const f = base(x / ancho, y / alto);
      const o = (y * ancho + x) * 3;
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) A[i][j] += f[i] * f[j];
        for (let c = 0; c < 3; c++) b[c][i] += f[i] * rgb[o + c];
      }
    }
  }
  for (let i = 0; i < 6; i++) A[i][i] += 1e-6; // por si acaso
  return [0, 1, 2].map((c) => resolverSistema(A, b[c]));
}

function fondoEn(coef, x, y, ancho, alto) {
  const f = base(x / ancho, y / alto);
  return coef.map((k) => k.reduce((s, ki, i) => s + ki * f[i], 0));
}

const suavizado = (t) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

/** @returns {Promise<{ rgba: Buffer, ancho: number, alto: number, residuo: number, transparente: number }>} */
async function quitarFondo(ruta) {
  const { data, info } = await sharp(ruta)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: ancho, height: alto } = info;
  const rgb = data;

  // 1. Modelo del fondo: primero el anillo del borde, luego los píxeles cercanos al modelo.
  const mx = Math.round(ancho * ANILLO);
  const my = Math.round(alto * ANILLO);
  let coef = ajustarFondo(
    rgb,
    ancho,
    alto,
    (x, y) => x < mx || y < my || x >= ancho - mx || y >= alto - my,
  );
  const distancia = (x, y, coefs) => {
    const bg = fondoEn(coefs, x, y, ancho, alto);
    const o = (y * ancho + x) * 3;
    return Math.hypot(rgb[o] - bg[0], rgb[o + 1] - bg[1], rgb[o + 2] - bg[2]);
  };
  for (let ronda = 0; ronda < 2; ronda++) {
    const previo = coef;
    coef = ajustarFondo(rgb, ancho, alto, (x, y) => distancia(x, y, previo) < D_AJUSTE);
  }

  // 2. Alfa por distancia de color al fondo modelado.
  const alfa = new Float32Array(ancho * alto);
  const fondo = new Float32Array(ancho * alto * 3);
  let suma = 0;
  let cuenta = 0;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const bg = fondoEn(coef, x, y, ancho, alto);
      const i = y * ancho + x;
      fondo[i * 3] = bg[0];
      fondo[i * 3 + 1] = bg[1];
      fondo[i * 3 + 2] = bg[2];
      const o = i * 3;
      const d = Math.hypot(rgb[o] - bg[0], rgb[o + 1] - bg[1], rgb[o + 2] - bg[2]);
      alfa[i] = suavizado((d - D_MIN) / (D_MAX - D_MIN));
      if (d < D_AJUSTE) {
        suma += d * d;
        cuenta++;
      }
    }
  }

  // 3. Solo es fondo lo que se conecta con el borde por píxeles casi transparentes.
  const fuera = new Uint8Array(ancho * alto);
  const pila = [];
  const sembrar = (x, y) => {
    const i = y * ancho + x;
    if (!fuera[i] && alfa[i] < 0.5) {
      fuera[i] = 1;
      pila.push(i);
    }
  };
  for (let x = 0; x < ancho; x++) {
    sembrar(x, 0);
    sembrar(x, alto - 1);
  }
  for (let y = 0; y < alto; y++) {
    sembrar(0, y);
    sembrar(ancho - 1, y);
  }
  while (pila.length > 0) {
    const i = pila.pop();
    const x = i % ancho;
    const y = (i - x) / ancho;
    if (x > 0) sembrar(x - 1, y);
    if (x < ancho - 1) sembrar(x + 1, y);
    if (y > 0) sembrar(x, y - 1);
    if (y < alto - 1) sembrar(x, y + 1);
  }
  // Franja de borde: dilata `fuera` unos píxeles; ahí vale el alfa calculado. Más adentro, es dibujo.
  let zona = fuera;
  for (let k = 0; k < FRANJA_BORDE_PX; k++) {
    const siguiente = Uint8Array.from(zona);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const i = y * ancho + x;
        if (zona[i]) continue;
        if (
          (x > 0 && zona[i - 1]) ||
          (x < ancho - 1 && zona[i + 1]) ||
          (y > 0 && zona[i - ancho]) ||
          (y < alto - 1 && zona[i + ancho])
        ) {
          siguiente[i] = 1;
        }
      }
    }
    zona = siguiente;
  }

  // 4. Quita el fondo mezclado: F = (C - (1 - a)·B) / a.
  const rgba = Buffer.alloc(ancho * alto * 4);
  let transparentes = 0;
  for (let i = 0; i < ancho * alto; i++) {
    const a = zona[i] ? alfa[i] : 1;
    if (a < 0.02) transparentes++;
    for (let c = 0; c < 3; c++) {
      const v =
        a >= 0.999
          ? rgb[i * 3 + c]
          : (rgb[i * 3 + c] - (1 - a) * fondo[i * 3 + c]) / Math.max(a, 0.05);
      rgba[i * 4 + c] = Math.min(255, Math.max(0, Math.round(v)));
    }
    rgba[i * 4 + 3] = Math.round(a * 255);
  }
  return {
    rgba,
    ancho,
    alto,
    residuo: Math.sqrt(suma / Math.max(cuenta, 1)),
    transparente: transparentes / (ancho * alto),
  };
}

async function main() {
  const entrada = resolve(
    process.argv[2] ?? join(RAIZ_WEB, "..", "..", "generated_images", "iconos", "elegidos"),
  );
  const archivos = readdirSync(entrada)
    .filter((f) => /^(demeter|hermes)_[a-z]+\.png$/.test(f))
    .sort();
  if (archivos.length === 0) throw new Error(`No hay íconos <mision>_<parte>.png en ${entrada}`);
  for (const archivo of archivos) {
    const [mision, resto] = archivo.split("_");
    const parte = resto.replace(/\.png$/, "");
    const carpeta = join(RAIZ_WEB, "src", "assets", mision, "iconos");
    mkdirSync(carpeta, { recursive: true });
    const destino = join(carpeta, `${parte}.png`);
    const r = await quitarFondo(join(entrada, archivo));
    // Recorta al dibujo y lo centra en un cuadrado con un margen: a 40 px el ícono se lee más grande.
    const caja = cajaDelDibujo(r.rgba, r.ancho, r.alto);
    const lado = Math.round(Math.max(caja.w, caja.h) * (1 + 2 * MARGEN));
    // En dos pasos: sharp aplica `extend` después de `resize`, así que el cuadrado se arma primero.
    const cuadrado = await sharp(r.rgba, { raw: { width: r.ancho, height: r.alto, channels: 4 } })
      .extract({ left: caja.x, top: caja.y, width: caja.w, height: caja.h })
      .extend({
        left: Math.floor((lado - caja.w) / 2),
        right: Math.ceil((lado - caja.w) / 2),
        top: Math.floor((lado - caja.h) / 2),
        bottom: Math.ceil((lado - caja.h) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const info = await sharp(cuadrado)
      .resize({ width: SALIDA_PX, height: SALIDA_PX, kernel: "lanczos3" })
      .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
      .toFile(destino);
    console.log(
      `${mision}/iconos/${parte}.png  ${(info.size / 1000).toFixed(1)} KB  ` +
        `residuo del fondo ${r.residuo.toFixed(1)}  transparente ${(r.transparente * 100).toFixed(0)} %`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
