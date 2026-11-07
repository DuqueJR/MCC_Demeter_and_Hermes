// Plugin de Vite: valores del sitio que los tres `index.html` comparten [T-648].
// Dos marcadores, para no repetir a mano en cada página lo que debe tener una sola fuente:
//   %URL_SITIO%        -> el dominio base, sin barra final (para og:url, og:image y twitter:image).
//   %COLOR:<tema>%     -> el color de fondo del tema (para <meta name="theme-color">), leído de src/tema/.
//                         Así el HTML no lleva colores literales (scripts/colores.mjs) y no se desfasa del tema.
// Funciona en `npm run dev`, en el build y en `vite preview`.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Dominio por defecto: Cloudflare Pages (T-642). Se cambia con la variable de entorno `URL_SITIO` al construir. */
export const URL_SITIO_PREDETERMINADA = "https://eiaspice.space";

/**
 * Dominio base del sitio, sin barra final.
 * @param {Record<string, string | undefined>} [env]
 */
export function urlDelSitio(env = process.env) {
  const valor = (env.URL_SITIO ?? "").trim() || URL_SITIO_PREDETERMINADA;
  return valor.replace(/\/+$/, "");
}

// Tema -> archivo de src/tema/ y variable CSS de donde sale su color.
const FUENTES_DE_COLOR = {
  hermes: ["hermes.css", "--fondo"],
  demeter: ["demeter.css", "--fondo"],
  portada: ["comun.css", "--eia-teal"], // la portada pinta el verde institucional detrás de sus dos mitades
};

/**
 * Color (#rrggbb) del tema: `--fondo` de la misión, o `--eia-teal` para la portada.
 * @param {string} raiz carpeta gui/web
 * @param {string} tema hermes | demeter | portada
 */
export function colorDeTema(raiz, tema) {
  const fuente = FUENTES_DE_COLOR[tema];
  if (!fuente) throw new Error(`sitio-html: tema desconocido «${tema}»`);
  const [archivo, variable] = fuente;
  const css = readFileSync(join(raiz, "src", "tema", archivo), "utf8");
  const m = css.match(new RegExp(`${variable}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!m?.[1]) throw new Error(`sitio-html: no encontré ${variable} en src/tema/${archivo}`);
  return m[1].toLowerCase();
}

/**
 * @param {string} raiz carpeta gui/web
 * @param {string} [url] dominio base (por defecto, `urlDelSitio()`)
 */
export function etiquetasDelSitio(raiz, url = urlDelSitio()) {
  return {
    name: "etiquetas-del-sitio",
    transformIndexHtml: {
      order: "pre",
      /** @param {string} html */
      handler(html) {
        return html
          .replaceAll("%URL_SITIO%", url)
          .replace(/%COLOR:([\w-]+)%/g, (_, tema) => colorDeTema(raiz, tema));
      },
    },
  };
}
