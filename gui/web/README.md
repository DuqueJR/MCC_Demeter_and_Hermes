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

| Orden                              | Qué hace                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm install`                      | Instala las dependencias (el `package.json` queda congelado en W0; una dependencia nueva va en un PR aparte, 06 §5) |
| `npm run dev`                      | Servidor de desarrollo. `/api` va por proxy a `http://localhost:8787` (repetidor, T-630)                            |
| `npm run repetidor -- demeter nominal` | El relay falso en `:8787` con los JSONL de `dev/datos/` ([dev/repetidor/README.md](dev/repetidor/README.md), T-630)       |
| `npm run build`                    | `tsc`, `vite build` y la prueba de aislamiento sobre `dist/`                                                        |
| `npm run colores`                  | Regla contra colores sueltos: falla si hay colores literales fuera de `src/tema/` (T-613)                           |
| `npm run aislamiento`              | Solo la prueba de aislamiento (D-W01) sobre `dist/`                                                                 |
| `npm test`                         | Vitest (incluye la prueba de aislamiento con un caso falso y sobre un build real)                                   |
| `npm run e2e:instalar`             | Una vez: descarga Chromium para Playwright                                                                          |
| `npm run e2e`                      | Construye y corre el humo de Playwright (390×844 y 1440×900, 3 páginas); capturas en `e2e/capturas/`                |
| `npm run lint` / `npm run formato` | Biome                                                                                                               |

Variables: ver `.env.example` (`VITE_API_BASE`).

Imágenes: `vite-imagetools` está activo. Ejemplo: `import src from "./foto.png?format=avif;webp&w=256;512&as=srcset"`.

## Tema y tokens (T-613)

Tokens en `src/tema/` (contrato, 02 §6): `comun.css` + el de la misión. Fuentes WOFF2 latinas en `src/tema/fuentes/` con sus licencias OFL.
Página de desarrollo: `npm run dev` y abrir `/dev/` (índice con todo lo que se puede ver, T-614) o `/dev/tokens.html` (`?mision=hermes`). Ninguna entra al `dist/`.
