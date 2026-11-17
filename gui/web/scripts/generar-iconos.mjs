// Genera los favicons y las imágenes de vista previa (Open Graph) de `public/` a partir de las fuentes del diseñador [T-648].
// Uso: node scripts/generar-iconos.mjs <carpeta-de-fuentes>
//   La carpeta trae, por cada página (portada, hermes, demeter): `favicon_<página>_512.png` (512×512) y
//   `og_<página>.png` (1200×630). Las fuentes no se versionan; solo se versiona lo que sale a `public/`.
// Salida (nombres fijos, sin hash: los rastreadores y los navegadores piden estas URL tal cual):
//   portada -> public/<archivo>      hermes -> public/hermes/<archivo>      demeter -> public/demeter/<archivo>
//   favicon.ico (16/32/48), favicon-32.png, apple-touch-icon.png (180), icon-192.png, icon-512.png, og.jpg
// Usa `sharp`, que ya viene con vite-imagetools: no hay dependencias nuevas.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { colorDeTema } from "./sitio-html.mjs";

export const PAGINAS = ["portada", "hermes", "demeter"];
export const OG_ANCHO = 1200;
export const OG_ALTO = 630;
export const OG_CALIDAD = 82;
/** WhatsApp descarta las imágenes de vista previa muy pesadas: el límite práctico es ~300 KB. */
export const OG_MAX_BYTES = 300 * 1024;
const TAMANOS_ICO = [16, 32, 48];

/**
 * Arma un .ico con un PNG por tamaño (formato admitido por todos los navegadores desde Vista).
 * @param {{ tam: number, datos: Buffer }[]} imagenes
 * @returns {Buffer}
 */
export function construirIco(imagenes) {
  const cabecera = Buffer.alloc(6 + 16 * imagenes.length);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // tipo 1 = ícono
  cabecera.writeUInt16LE(imagenes.length, 4);
  let desplazamiento = cabecera.length;
  imagenes.forEach(({ tam, datos }, i) => {
    const e = 6 + 16 * i;
    cabecera.writeUInt8(tam >= 256 ? 0 : tam, e); // ancho (0 = 256)
    cabecera.writeUInt8(tam >= 256 ? 0 : tam, e + 1); // alto
    cabecera.writeUInt8(0, e + 2); // colores de la paleta (0 = sin paleta)
    cabecera.writeUInt8(0, e + 3);
    cabecera.writeUInt16LE(1, e + 4); // planos
    cabecera.writeUInt16LE(32, e + 6); // bits por píxel
    cabecera.writeUInt32LE(datos.length, e + 8);
    cabecera.writeUInt32LE(desplazamiento, e + 12);
    desplazamiento += datos.length;
  });
  return Buffer.concat([cabecera, ...imagenes.map((i) => i.datos)]);
}

const aPng = (origen, tam) =>
  sharp(origen).resize(tam, tam, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();

/** #rrggbb -> { r, g, b } */
const aRgb = (hex) => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16),
});

/**
 * Ícono para iOS (180×180): iOS rellena de negro lo transparente, así que se aplana sobre el fondo del tema.
 * La portada ya trae su propio fondo oscuro con esquinas redondeadas: se aplana sobre el color de su borde.
 */
async function iconoApple(origen, pagina, raiz) {
  const base = sharp(origen);
  if (pagina === "portada") {
    const borde = await sharp(origen)
      .extract({ left: 256, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    const fondo = { r: borde[0], g: borde[1], b: borde[2] };
    return base
      .flatten({ background: fondo })
      .resize(180, 180)
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
  // Los parches son círculos: se dejan al 88 % para que iOS no los recorte contra su máscara.
  const fondo = aRgb(colorDeTema(raiz, pagina));
  const lado = Math.round(180 * 0.88);
  const parche = await base.resize(lado, lado, { kernel: "lanczos3" }).png().toBuffer();
  return sharp({ create: { width: 180, height: 180, channels: 3, background: fondo } })
    .composite([{ input: parche, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * @param {string} fuentes carpeta con las imágenes del diseñador
 * @param {string} raizWeb carpeta gui/web
 * @returns {Promise<{ archivo: string, bytes: number }[]>} lo escrito, con su peso
 */
export async function generarIconos(fuentes, raizWeb) {
  const escrito = [];
  for (const pagina of PAGINAS) {
    const destino = join(raizWeb, "public", pagina === "portada" ? "" : pagina);
    mkdirSync(destino, { recursive: true });
    const guardar = (nombre, datos) => {
      writeFileSync(join(destino, nombre), datos);
      escrito.push({
        archivo: join("public", pagina === "portada" ? "" : pagina, nombre),
        bytes: datos.length,
      });
    };

    const icono = readFileSync(join(fuentes, `favicon_${pagina}_512.png`));
    const { width, height } = await sharp(icono).metadata();
    if (width !== 512 || height !== 512) {
      throw new Error(`favicon_${pagina}_512.png mide ${width}×${height}, no 512×512`);
    }
    guardar("favicon-32.png", await aPng(icono, 32));
    guardar("icon-192.png", await aPng(icono, 192));
    guardar("icon-512.png", await aPng(icono, 512));
    guardar("apple-touch-icon.png", await iconoApple(icono, pagina, raizWeb));
    guardar(
      "favicon.ico",
      construirIco(
        await Promise.all(TAMANOS_ICO.map(async (tam) => ({ tam, datos: await aPng(icono, tam) }))),
      ),
    );

    const og = readFileSync(join(fuentes, `og_${pagina}.png`));
    const meta = await sharp(og).metadata();
    if (meta.width !== OG_ANCHO || meta.height !== OG_ALTO) {
      throw new Error(
        `og_${pagina}.png mide ${meta.width}×${meta.height}, no ${OG_ANCHO}×${OG_ALTO}`,
      );
    }
    const jpeg = await sharp(og)
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .jpeg({ quality: OG_CALIDAD, progressive: false, chromaSubsampling: "4:2:0" })
      .toBuffer();
    if (jpeg.length >= OG_MAX_BYTES) {
      throw new Error(
        `og de ${pagina} pesa ${jpeg.length} B (límite ${OG_MAX_BYTES} B): bajar la calidad o simplificar`,
      );
    }
    guardar("og.jpg", jpeg);
  }
  return escrito;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fuentes = process.argv[2];
  if (!fuentes) {
    console.error("Uso: node scripts/generar-iconos.mjs <carpeta-de-fuentes>");
    process.exit(1);
  }
  const raizWeb = resolve(import.meta.dirname, "..");
  const escrito = await generarIconos(resolve(fuentes), raizWeb);
  for (const { archivo, bytes } of escrito) {
    console.log(`${archivo}  ${(bytes / 1024).toFixed(1)} KB`);
  }
  const total = escrito.reduce((suma, e) => suma + e.bytes, 0);
  console.log(`${escrito.length} archivos en public/ (${(total / 1024).toFixed(0)} KB en total)`);
}
