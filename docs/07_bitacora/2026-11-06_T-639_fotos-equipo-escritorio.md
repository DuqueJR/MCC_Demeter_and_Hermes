---
fecha: 2026-11-06
tipo: tarea
ids: [T-639, T-622, D-W03]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-639-fotos-equipo-escritorio
---
# T-639: las fotos del equipo no aparecían en la web de escritorio

## Contexto
Reporte del usuario, tal cual: "en la version de escritorio no me estan apareciendo las imagenes del equipo". No se sabía cuál de las imágenes fallaba. La tarea se agregó al backlog (debajo de T-637) por este reporte.

## Causa
Era la hipótesis (a): **la foto grupal del equipo** (`src/assets/<misión>/equipo.jpg`, 2.ª diapositiva del carrusel de Inicio). Las demás imágenes (foto del cohete, parche grande de Equipo) sí se veían.

En `gui/web/src/mision/mision.css`, dentro de `@media (min-width: 1024px)`, desde T-622 había:

```css
.diapositiva:not(:first-child) { display: none; }
```

El carrusel de escritorio mostraba solo la primera diapositiva (el cohete) y escondía el resto, sin ningún control para verlas. Con `display: none` además el `loading="lazy"` del `<img>` nunca la pide: la imagen quedaba en `naturalWidth` 0.

Descartado:
- El build sí emite las dos fotos (`equipo-<hash>.webp`, `cohete-<hash>.webp`) y responden con `naturalWidth` 1400 y 1000 en móvil, donde se ven bien.
- El parche grande y la cuadrícula de Equipo se renderizan bien a todos los anchos (parche 256 × 256, `naturalWidth` 512; los integrantes son texto, no imágenes).
- Móvil (390 px) estaba bien antes y sigue bien: el carrusel desliza y la 2.ª foto mide 275 × 207.

## Qué se hizo
- `gui/web/src/mision/mision.css` (solo la regla de >= 1024 px):
  - se quitó el `display: none` de las diapositivas siguientes;
  - el `.carrusel` pasa a una fila en cuadrícula (`grid-auto-flow: column` con columnas iguales), con todas las fotos a la vista, sin deslizar (en escritorio no hay gesto);
  - `.inicio-cuerpo` pasa de `1fr 2fr` a `3fr 2fr` (fotos : texto) para que las fotos queden de ~350 px (a 1280) a ~400 px de ancho (>= 1470) y el texto siga cómodo.
  - En tableta (600-1023 px) y móvil no se tocó nada.
- `gui/web/e2e/fotos_equipo.spec.ts` (nueva): en `/demeter/` y `/hermes/`, a 1280, 1470 y 1920 px y a 390 px de ancho comprueba que las dos fotos del carrusel y toda `img` de la sección Equipo estén visibles, con alto y ancho > 0, `naturalWidth` > 0 y `complete`. En escritorio verifica además que ninguna diapositiva quede fuera de la banda (no hay que deslizar).
- Backlog: fila de T-639 debajo de T-637.
- No se tocaron `src/mapa/` (T-638), los textos ni los contratos.

## Evidencia
Se reprodujo con Playwright/Chromium contra `dist/` (`vite preview` en el puerto 4691; el 4173 es de la carpeta principal), midiendo con JS cada `img`/`figure` del carrusel y de Equipo.

Antes (la foto del equipo, a 1280, 1470 y 1920 px, en las dos misiones):

| Elemento | Ancho × alto | `display` | `naturalWidth` |
| --- | --- | --- | --- |
| `figure.diapositiva` 2 | 0 × 0 | `none` | |
| `img.foto` del equipo | 0 × 0 | `grid` (padre oculto) | **0** |

Después (a 1280 / 1470 y 1920 px; igual en Hermes):

| Elemento | Ancho × alto | `naturalWidth` |
| --- | --- | --- |
| `img.foto-contener` del cohete | 353 × 265 / 401 × 301 | 1000 |
| `img.foto` del equipo | 353 × 265 / 401 × 301 | 1400 |
| `img.parche-grande` (Equipo) | 256 × 256 | 512 |

Pruebas (todas en `gui/web`):
- La e2e nueva **falla sin el arreglo** (6 de 8: los tres anchos de escritorio de cada misión, con "foto del equipo: visible ... Received: hidden") y los dos casos móviles pasan; **con el arreglo pasan los 8**.
- Resto de e2e que tocan Inicio o el layout (`mision`, `humo`, `chips_iconos`, `portada`, `portada_contraste`, `fotos_equipo`): **65 pasan**.
- `./node_modules/.bin/biome check src pruebas e2e`: sin errores (11 avisos que ya estaban: `!important` en el CSS de movimiento reducido).
- `tsc --noEmit` y `npm run build` (tsc, colores, vite, aislamiento): OK.
- `vitest run`: 22 archivos, 490 pruebas en verde y 2 omitidas.

Capturas (`docs/07_bitacora/capturas/T-639/`):
- Antes: `antes-demeter_1470-inicio.png`, `antes-demeter_1920-inicio.png`, `antes-hermes_1280-inicio.png`.
- Después: `despues-demeter_1470-inicio.png`, `despues-demeter_1920-inicio.png`, `despues-hermes_1280-inicio.png`, `despues-demeter_390-inicio.png` (móvil) y `despues-hermes_1470-equipo.png`.

## Decisiones tomadas o propuestas
- **Propuesta de cambio al diseño** (`docs/08_gui/03_experiencia_y_pantallas.md` §3.1, línea "Portátil: una banda con la foto principal"): el diseño decía que en portátil iba solo la foto principal, y el CSS lo implementó escondiendo las demás. El usuario espera ver las fotos del equipo en escritorio, así que la banda ahora muestra todas las fotos del carrusel (hoy dos: cohete y equipo). El texto del §3.1 debería decir "Portátil: una banda con las fotos del carrusel a la vista, junto al nombre y los datos". No es un contrato de datos; lo consolida el documentador.
- Si más adelante se suman las fotos del CanSat y del VisionPack (03 §3.1 habla de 3 a 5), el carrusel de escritorio las pone todas en una fila: con 4 o más quedarían muy chicas a 1024 px y habría que pasar a dos filas o a un carrusel con flechas.

## Problemas y cómo se resolvieron
- `networkidle` no sirve en las páginas de misión (el cliente de datos reintenta el SSE sin relay), así que la reproducción espera `load` y luego mueve cada imagen a la vista.
- Las e2e existentes regeneran capturas versionadas en `docs/07_bitacora/capturas/`; se revirtieron esos cambios para no ensuciar el PR.
- Correr las e2e con el `playwright.config.ts` del repo habría reutilizado el `vite preview` del puerto 4173 de la carpeta principal (con un `dist/` viejo); se corrieron con una copia de la configuración en otros puertos (fuera del repo).

## Pendiente / siguiente paso
- No se pudo verificar en un navegador de escritorio real ni en Safari/Firefox: solo Chromium (Playwright) a 1280, 1470, 1920 y 390 px. Las propiedades usadas (`grid-auto-flow`, `grid-auto-columns`) tienen soporte amplio.
- Las e2e que dependen del repetidor o del mapa no se corrieron completas (235 en total; solo las que tocan Inicio).
- Revisar el `docs/08_gui/03` §3.1 (propuesta anterior).

## Documentos afectados
- `docs/05_plan/backlog.md` (fila T-639).
- `gui/web/src/mision/mision.css`, `gui/web/e2e/fotos_equipo.spec.ts`.
