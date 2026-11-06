---
fecha: 2026-11-06
tipo: tarea
ids: [T-646, T-639, D-W03]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-646-tarjeta-equipo
---
# T-646: tarjeta "Equipo" con el parche, la foto y los apellidos; la foto sale del carrusel

## Contexto
Pedido del usuario, tal cual: "Quiero que la imagen del equipo quede en la parte de abajo de la pagina web en la tarjeta de equipo. Esta tarjeta debe quedar de la siguiente manera, a un lado el parche/logo del equipo al otro lado la imagen del equipo y abajo centradas las tarjetas de los apellidos." Además: "no me gustó" la solución de T-639 (PR #86), que mostraba la foto del equipo junto a la del cohete en la banda del carrusel de Inicio en escritorio. La tarea se agregó al backlog (debajo de T-645).

## Qué se hizo
Todo en `gui/web/`:
- **Contenido** (`src/contenido/tipos.ts`, `hermes.ts`, `demeter.ts`): nuevo campo `fotoEquipo: Foto` con la foto y su pie ("El equipo de …", textos sin cambiar); `fotos` queda solo con el cohete.
- **`src/mision/Equipo.tsx`:** una banda (`.equipo-banda`) con el parche y una `figure` con la foto del equipo (`alt`, `loading="lazy"`, `width`/`height` 1200 × 800 y `aspect-ratio: 3 / 2` en el CSS, esquinas con `var(--radio)`), y debajo la lista de apellidos. Si `fotoEquipo.src` fuera `null`, sale el placeholder digno (PEN-W01), como en Inicio.
- **`src/mision/mision.css`:**
  - Escritorio (>= 1024 px): la banda es una fila `flex` centrada (parche a la izquierda, foto de hasta 704 px a la derecha, centrados alineados al medio).
  - Móvil y tableta: se apila, centrado: parche, foto, apellidos.
  - Apellidos: de `grid auto-fill` a `flex` con `flex-wrap` y `justify-content: center`, tarjetas de 128 px fijas: la última fila, incompleta, queda centrada y sin huecos (Hermes, 7; Deméter, 6).
  - Se deshizo lo de T-639 en la banda de Inicio de escritorio: `.inicio-cuerpo` vuelve a `1fr 2fr` y se quitaron el `.carrusel` en `grid` y el `flex-basis: auto`. Se **mantiene** que no haya `display: none` en las diapositivas (con varias fotos, el carrusel sigue deslizando en escritorio por rueda o gesto y cada foto carga con `lazy` al llegar). Se agregó `.diapositiva:only-child { flex-basis: 100% }`: una sola foto llena el ancho en móvil y tableta (antes dejaba 15 % o 55 % de hueco, porque la base era 85 % y 45 % para deslizar con varias).
- **`e2e/fotos_equipo.spec.ts`:** reescrita (ver Evidencia).
- Backlog: fila de T-646 debajo de T-645.
- No se tocó `src/mapa/`, ni textos, ni contratos.

## Evidencia
Capturas en `docs/07_bitacora/capturas/T-646/` (`<misión>_<inicio|equipo>_<ancho>_<antes|despues>.png`, a 1470 y 390 px, en las dos misiones). En las de 390 px, la barra de misión y la navegación fijas se superponen, porque son `position: sticky` y la captura de un elemento largo las pega encima: es un efecto de la captura, no del layout.

Antes (T-639): a 1470 px, Inicio mostraba el cohete y el equipo (353-401 px cada uno) junto al texto; Equipo, un parche suelto con los apellidos en cuadrícula `auto-fill` (que dejaba la última fila a la izquierda).

Después, a 1470 px: Inicio, el cohete (~450 × 340) junto al texto; Equipo, el parche (256 × 256) y la foto (704 × 469) en una fila centrada, y debajo los 7 o 6 apellidos en una fila centrada.

Pruebas (en `gui/web`):
- `e2e/fotos_equipo.spec.ts`: **10 de 10 pasan** (1280, 1470 y 1920 px, móvil 390 y tableta 800, en las dos misiones). Verifica:
  - en Equipo, solo dos imágenes (parche y foto), visibles, con tamaño > 0, `naturalWidth` > 0, `complete`, y la foto con `alt` y `loading="lazy"`;
  - escritorio: el parche termina a la izquierda de la foto (`parche.right <= foto.left`) y las dos cajas se solapan en vertical;
  - móvil y tableta: el parche termina antes de donde empieza la foto, y cada uno está centrado en la sección (tolerancia 4 px);
  - la banda (parche + foto) está centrada en la sección, las tarjetas están debajo de ambos, cada fila de tarjetas (también la última, incompleta) está centrada en la sección (tolerancia 4 px) y ninguna se sale de ella;
  - Inicio: un solo `img.foto` (el cohete, alt "cohete"), sin ninguna imagen ni pie del equipo; la diapositiva llena el carrusel y la foto conserva 4:3.
  - La prueba anterior de T-639 (esperaba 2 fotos en Inicio) se sustituyó. Con el diseño de T-639 la nueva falla por construcción (`toHaveCount(1)` en el carrusel y no existe `img.foto-equipo`); no se volvió a correr contra ese código.
- Suite de e2e completa (con `E2E_PUERTO=4892`): **219 pasan, 25 omitidas** (las que ya lo estaban), ninguna falla.
- `vitest run`: 506 pasan, 3 omitidas (23 archivos).
- `./node_modules/.bin/biome check src pruebas e2e`: sin errores (11 avisos que ya estaban: `!important` del CSS de movimiento reducido).
- `npm run build` (incluye `tsc --noEmit`, `scripts/colores.mjs` y `aislamiento.mjs`): sin errores; Aislamiento OK, colores OK, fuentes de 62.8 y 67.3 kB (< 80 kB).
- Las e2e reescribieron capturas versionadas de otras tareas (T-621 a T-637): se restauraron con `git checkout`.

## Decisiones tomadas o propuestas
Ninguna que cambie contratos. Decisión de diseño menor: el tamaño máximo de la foto (704 px) y el de las tarjetas (128 px) salen de la escala `--e-8` (64 px) de los tokens, sin literales nuevos.

## Problemas y cómo se resolvieron
- Primera versión de la banda en `grid` con `justify-content: center` no centraba la pareja (la columna `1fr` ocupaba todo): se pasó a `flex`, que sí la centra.
- Con una sola diapositiva el carrusel de móvil y tableta dejaba un hueco a la derecha (base de 85 % y 45 %): se resolvió con `:only-child`.

## Pendiente / siguiente paso
- Ver la tarjeta en un celular real y en pantallas de escritorio reales (solo se probó con Chromium de Playwright a los anchos pedidos).
- Si el equipo quiere los nombres completos y los roles en las tarjetas, sigue en PEN-W02.

## Documentos afectados
`docs/05_plan/backlog.md` (fila T-646). Ninguno más; `08_gui/03` puede querer actualizar el §3.10 (Equipo) con el nuevo orden: lo decide el documentador.
