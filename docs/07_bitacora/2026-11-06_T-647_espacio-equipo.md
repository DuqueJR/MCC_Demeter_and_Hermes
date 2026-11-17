---
fecha: 2026-11-06
tipo: tarea
ids: [T-647, T-646]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-647-espacio-equipo
---
# T-647: más espacio entre el parche y la foto en la tarjeta Equipo (escritorio)

## Contexto
Pedido del usuario sobre T-646 (PR #87), tal cual: "no me termina de convencer, la foto quedó muy cerca del logo, me gustaría a lo mejor que la foto sea ligeramente más pequeña para que esté con un buen espacio del logo y quede más estético, como que cada uno esté más de un lado". Solo escritorio (>= 1024 px); móvil y tableta no cambian. La tarea se agregó al backlog debajo de T-646.

## Qué se hizo
Todo en `gui/web/`; el TSX (`Equipo.tsx`) y los textos no se tocaron, ni `src/mapa/`.
- **`src/mision/mision.css`** (solo el bloque `@media (min-width: 1024px)`):
  - `.equipo-banda`: de `justify-content: center` con `gap: --e-6` a `justify-content: space-between`, `align-items: center`, `gap: var(--e-7)` (el hueco mínimo, 48 px, si la banda se aprieta), `max-width: calc(var(--e-8) * 16)` (1024 px) y centrada con `margin: 0 auto var(--e-5)`. El parche queda en el borde izquierdo de la banda y la foto en el derecho; la banda va centrada en la tarjeta, así que en pantallas anchas ninguno queda pegado al borde de la tarjeta.
  - Token local `--ancho-foto-equipo: calc(var(--e-8) * 8.5)` = 544 px, en vez de `calc(var(--e-8) * 11)` = 704 px (23 % menos; lo pedido era ~15-20 %, y 8,5 es el múltiplo de `--e-8` que deja la foto bajo el 45 % de la sección a 1280 px: 43,6 %). `.equipo-foto` usa `flex: 0 1 var(--ancho-foto-equipo)`, y puede encogerse.
  - El móvil y la tableta conservan sus reglas base (sin cambios).
- **`e2e/fotos_equipo.spec.ts`:**
  - Se agrega el ancho 1024 px a los de escritorio (12 pruebas en total, antes 10).
  - `verificarEquipo` recibe el ancho en vez de un booleano.
  - Nuevas aserciones en escritorio: parche y foto alineados al centro vertical (el centro del parche contra el de la `figure`, que incluye el pie, tolerancia 4 px); a 1280, 1470 y 1920 px, el hueco entre el borde derecho del parche y el izquierdo de la foto >= 64 px (`HUECO_MIN`) y la foto < 45 % del ancho de la sección (`FOTO_MAX_FRACCION`); ni el parche ni la foto se salen de la tarjeta.
  - Las aserciones anteriores (lado a lado, banda centrada, apellidos centrados y debajo) no dependían del ancho ni de la cercanía y siguen igual.
- **Backlog:** fila de T-647 debajo de T-646 (lo pidió el usuario en el encargo).

## Evidencia
Medidas (Chromium, `getBoundingClientRect`, igual en Deméter y Hermes). Ancho de la foto / hueco parche-foto / fracción de la sección:

| Viewport | Sección | Antes | Después |
| --- | --- | --- | --- |
| 1024 | 992 | 670 px / 32 px / 67,5 % | 544 px / 158 px / 54,8 % |
| 1280 | 1248 | 704 px / 32 px / 56,4 % | 544 px / 224 px / 43,6 % |
| 1470 | 1408 | 704 px / 32 px / 50,0 % | 544 px / 224 px / 38,6 % |
| 1920 | 1408 | 704 px / 32 px / 50,0 % | 544 px / 224 px / 38,6 % |

Sin desborde horizontal en ningún caso (`scrollWidth - innerWidth = 0`). A 1024 px el parche queda a 17 px del borde izquierdo de la tarjeta (el relleno de la sección) y la foto a 17 px del derecho: es el ancho disponible, no hay solape; a 1280 px quedan a 112 px de cada borde y a 1470 y 1920 px, a 192 px.

Capturas en `docs/07_bitacora/capturas/T-647/` (`<misión>_equipo_<ancho>_<antes|despues>.png`, a 1280 y 1920 px en las dos misiones, y `*_1024_despues.png`). Las revisé a mano:
- **Antes (1920 px, Deméter):** el parche y la foto forman un bloque compacto en el centro de la tarjeta, con la foto grande a 32 px del parche; los bordes de la tarjeta quedan vacíos.
- **Después (1920 px, Deméter y Hermes):** el parche queda a la izquierda y la foto a la derecha, con un hueco claro de 224 px entre ellos y un margen simétrico (192 px) a cada lado de la tarjeta. Los dos están a la misma altura media; la foto se ve más pequeña pero legible (las siete personas, el pie "El equipo de …" centrado debajo), y las tarjetas de apellidos siguen centradas debajo de ambos, sin cambio.
- **Después (1280 px, Hermes):** igual, con el parche a 112 px del borde izquierdo y la foto a 112 px del derecho; 224 px de hueco.
- **Después (1024 px, Deméter):** el parche en el borde izquierdo y la foto en el derecho, con 158 px de hueco; nada se sale de la tarjeta.

Pruebas (en `gui/web`):
- `E2E_PUERTO=4392 npx playwright test e2e/fotos_equipo.spec.ts`: **12 de 12 pasan** (1024, 1280, 1470 y 1920 px, móvil 390 y tableta 800, en las dos misiones).
- Suite completa de Playwright (con `E2E_PUERTO=4392`): **221 pasaron, 25 omitidas, 0 fallas**.
- `./node_modules/.bin/biome check src pruebas e2e`: sin errores (11 advertencias que ya estaban, ninguna en los archivos de la tarea).
- `npx tsc --noEmit`: limpio.
- `npx vitest run`: **506 pasaron, 3 omitidas** (23 archivos).
- `npm run build`: pasa (aislamiento OK, sin datos de ejemplo, fuentes de 62,8 KB y 67,3 KB, contrastes sin cambio).
- No se corrió la prueba nueva contra el CSS anterior; por la tabla "Antes", a 1280, 1470 y 1920 px habría fallado en el hueco (32 px < 64 px) y en la fracción (>= 50 % > 45 %).
- Al correr Playwright se reescribieron capturas versionadas ajenas (`docs/07_bitacora/capturas/T-621` a `T-637`); se restauraron con `git checkout`.

## Decisiones tomadas o propuestas
Ninguna que cambie contratos. Decisión de diseño: banda con `space-between` y ancho máximo en vez de dos mitades 50/50, porque deja el hueco proporcional al ancho hasta 1024 px y lo fija en 224 px en pantallas anchas sin que la foto crezca; el valor 16 × `--e-8` y el 8,5 × `--e-8` son los ajustables si se quiere más o menos separación.

## Problemas y cómo se resolvieron
- Con 9 × `--e-8` (576 px) la foto quedaba en 46,2 % de la sección a 1280 px, sobre el 45 % pedido; se bajó a 8,5 × `--e-8`.
- La figura incluye el pie de foto, así que el centro vertical del parche se compara con el de la `figure`, no con el de la `img`.

## Pendiente / siguiente paso
- Revisión visual del usuario en su pantalla (el criterio es estético). Si pide más o menos separación: ajustar `max-width` de la banda o `--ancho-foto-equipo`, ambos en `mision.css`.
- A 1024 px el hueco es de 158 px y el parche queda a 17 px del borde (relleno de la tarjeta); no se probó en un portátil real.

## Documentos afectados
`docs/05_plan/backlog.md` (fila T-647), esta entrada y `docs/07_bitacora/capturas/T-647/`.
