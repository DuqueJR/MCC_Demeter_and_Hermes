# gui/web: la web pública

Vite multipágina con TypeScript, Preact y `@preact/signals`. Entradas: `/`, `/demeter/` y `/hermes/` (`operacion/` es de T-660).
Plan: [docs/08_gui/06_plan_web.md](../../docs/08_gui/06_plan_web.md). Stack: [04 §2](../../docs/08_gui/04_arquitectura_web.md).

Solo `npm` y Node (Windows y macOS), sin bash.

## Primeros pasos (Windows y macOS)

**Atajo (T-614):** desde la raíz del repo, `npm run web:instalar` una vez y luego `npm run web` (abre `/dev/`). Ver el `README.md` de la raíz. Lo de abajo es lo mismo, corrido desde `gui/web/`.

**Las órdenes de esta tabla se corren desde `gui/web/`.**

1. Node 22 (`.nvmrc`; con nvm: `nvm use`).
2. `npm ci`
3. `npm run e2e:instalar` (una vez por máquina: descarga Chromium)
4. Luego: `npm run dev`, `npm run build`, `npm test` y `npm run e2e`.

| Orden                                  | Qué hace                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm install`                          | Instala las dependencias (el `package.json` queda congelado en W0; una dependencia nueva va en un PR aparte, 06 §5) |
| `npm run dev`                          | Servidor de desarrollo. `/api` va por proxy a `http://localhost:8787` (repetidor, T-630)                            |
| `npm run repetidor -- demeter nominal` | El relay falso en `:8787` con los JSONL de `dev/datos/` ([dev/repetidor/README.md](dev/repetidor/README.md), T-630) |
| `npm run build`                        | `tsc`, `vite build` y la prueba de aislamiento sobre `dist/`                                                        |
| `npm run colores`                      | Regla contra colores sueltos: falla si hay colores literales fuera de `src/tema/` (T-613)                           |
| `npm run aislamiento`                  | Solo la prueba de aislamiento (D-W01) sobre `dist/`                                                                 |
| `npm test`                             | Vitest (incluye la prueba de aislamiento con un caso falso y sobre un build real)                                   |
| `npm run e2e:instalar`                 | Una vez: descarga Chromium para Playwright                                                                          |
| `npm run e2e`                          | Construye y corre el humo de Playwright (390×844 y 1440×900, 3 páginas); capturas en `e2e/capturas/`                |
| `npm run lint` / `npm run formato`     | Biome                                                                                                               |

Variables: ver `.env.example` (`VITE_API_BASE`).

**`VITE_API_BASE` en producción (T-642):** el sitio publicado (un Worker de assets con Workers Builds, ver `wrangler.jsonc`) habla con el relay de otro dominio, así que en
el Worker `hermes-demeter` (Settings → Build → Variables) se define `VITE_API_BASE=https://api.eiaspice.space/api`
**antes** de construir (Vite la incrusta en el build; si se cambia después hay que volver a desplegar). Sin ella el sitio llama a
`/api` de su propio dominio, que en el Worker de assets no existe: se queda en "Sin servidor". En desarrollo no se define: `/api` pasa por el proxy
de Vite al puerto 8787 (`vite.config.ts`), y ese proxy no se toca. Guía completa: [`docs/08_gui/11_guia_despliegue.md`](../../docs/08_gui/11_guia_despliegue.md).

Imágenes: `vite-imagetools` está activo. Ejemplo: `import src from "./foto.png?format=avif;webp&w=256;512&as=srcset"`.
Íconos de las partes (T-621): `node scripts/iconos-transparentes.mjs [carpeta]` les quita el fondo plano y los deja a 512 px en `src/assets/<misión>/iconos/`; se vuelve a correr si el diseñador cambia las imágenes (cabecera del script: el método).

## Favicons y vista previa (T-648)

- Cada página tiene sus íconos y su imagen de vista previa en `public/` (la portada en la raíz; `hermes/` y `demeter/` en su carpeta), con nombres fijos sin hash: `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og.jpg` (1200×630, JPEG de ~80–130 KB) y `site.webmanifest`. Las páginas de misión enlazan **solo** los suyos (D-W01).
- Se regeneran con `node scripts/generar-iconos.mjs <carpeta>` si el diseñador cambia las fuentes (`favicon_<página>_512.png` y `og_<página>.png`, tres páginas: portada, hermes, demeter). Falla si una medida no es la esperada o si un og pesa 300 KB o más.
- El dominio base de las URL absolutas de og/twitter es `https://eiaspice.space`; se cambia al construir con `URL_SITIO=https://otro.dominio npm run build` (`scripts/sitio-html.mjs`). El `theme-color` sale de `src/tema/`, no del HTML.

## Simulación para el público (T-635, T-637)

En `/demeter/`, el estado "Sin transmisión todavía" ofrece "Ver la simulación del vuelo": el navegador reproduce el escenario `nominal` (OpenRocket, apogeo ~670 m) con el banner fijo "Simulación: así será el vuelo" y la marca SIM. Todo es del cliente: sin servidor nuevo ni cambios al relay.

En `/hermes/` el botón también está (T-637), pero **su guion es sintético, no de OpenRocket**: no existe una simulación del motor G80-7T (PEN-07, PEN-W04). Sale de `dev/datos/hermes_nominal.jsonl` (modo `sintetico`; el script lo reescribe a `simulacion` en cada `meta`). Su nota y su banner lo dicen ("vuelo de ejemplo con datos de muestra", sin "OpenRocket" ni "así será el vuelo") y no traen ninguna altura ni tiempo. Los textos de cada misión viven en `src/contenido/<misión>.ts` (`simulacion.nota` y `simulacion.banner`). Cuando exista la simulación del G80-7T, se reemplaza el JSONL de origen y se cambian esos dos textos.

- **El guion** (`src/assets/<misión>/simulacion_nominal.json`, ~350 KB el de Deméter y ~300 KB el de Hermes; ~30 KB con gzip) sale de `dev/datos/<misión>_nominal.jsonl` con `npm run simulacion:generar` (las dos misiones; `-- --mision=hermes` solo una; `scripts/generar-simulacion.mjs`: estados de vuelo a ~3 Hz, salud decimada, cola de 10 s tras el aterrizaje). La salida es determinista y una prueba la compara con el archivo versionado: si cambias el JSONL o el script, vuelve a generar y sube el resultado. `-- --comprobar` solo verifica (las dos). Biome no lo formatea (`biome.json`).
- **Carga diferida:** `entradas/demeter.tsx` y `entradas/hermes.tsx` importan el suyo con `?url`: sale como un archivo de `dist/assets/` y solo se descarga al pulsar. El paquete inicial no lo toca, y cada página solo alcanza su guion: `aislamiento.mjs` revisa también que el `.json` alcanzable no traiga `"mision"` de la otra.
- **Código:** `src/simulacion/` (`guion.ts`, `reproductor.ts`, `control.ts`, `BotonSimulacion.tsx`) y `src/datos/compuerta.ts`. Mientras corre, la compuerta hace que el cliente real no escriba en las signals; el primer dato real del cohete (o "Salir de la simulación") la corta y el cliente rehace su sesión.

## Tema y tokens (T-613)

Tokens en `src/tema/` (contrato, 02 §6): `comun.css` + el de la misión. Fuentes WOFF2 latinas en `src/tema/fuentes/` con sus licencias OFL.
Página de desarrollo: `npm run dev` y abrir `/dev/` (índice con todo lo que se puede ver, T-614) o `/dev/tokens.html` (`?mision=hermes`). Ninguna entra al `dist/`.
