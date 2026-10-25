# gui/web: la web pública

Vite multipágina con TypeScript, Preact y `@preact/signals`. Entradas: `/`, `/demeter/` y `/hermes/` (`operacion/` es de T-660).
Plan: [docs/08_gui/06_plan_web.md](../../docs/08_gui/06_plan_web.md). Stack: [04 §2](../../docs/08_gui/04_arquitectura_web.md).

Requisitos: Node 20 o superior. Solo `npm` y Node (Windows y macOS), sin bash.

| Orden                              | Qué hace                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm install`                      | Instala las dependencias (el `package.json` queda congelado en W0; una dependencia nueva va en un PR aparte, 06 §5) |
| `npm run dev`                      | Servidor de desarrollo. `/api` va por proxy a `http://localhost:8787` (repetidor, T-630)                            |
| `npm run build`                    | `tsc`, `vite build` y la prueba de aislamiento sobre `dist/`                                                        |
| `npm run aislamiento`              | Solo la prueba de aislamiento (D-W01) sobre `dist/`                                                                 |
| `npm test`                         | Vitest (incluye la prueba de aislamiento con un caso falso y sobre un build real)                                   |
| `npm run e2e:instalar`             | Una vez: descarga Chromium para Playwright                                                                          |
| `npm run e2e`                      | Construye y corre el humo de Playwright (390×844 y 1440×900, 3 páginas); capturas en `e2e/capturas/`                |
| `npm run lint` / `npm run formato` | Biome                                                                                                               |

Variables: ver `.env.example` (`VITE_API_BASE`).

Imágenes: `vite-imagetools` está activo. Ejemplo: `import src from "./foto.png?format=avif;webp&w=256;512&as=srcset"`.
