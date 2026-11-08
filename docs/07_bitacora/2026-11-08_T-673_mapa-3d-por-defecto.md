---
fecha: 2026-11-08
tipo: tarea
ids: [T-673, T-656, D-W23]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-673-mapa-3d-por-defecto
---
# T-673: el mapa arranca siempre en la vista 3D

## Contexto
Pedido de Jerónimo: el mapa de `/demeter/` y `/hermes/` debe arrancar en 3D, en PC y en celular. El PR #95 (T-656) ya estaba integrado en `develop`; esta tarea sale de `develop` (`efd4e58`, después del PR #101).

## Qué se hizo
- **Arranque en 3D** (`controlador.tsx`): en `style.load`, **antes** de conectar los datos, si hay relieve (las mismas condiciones con que aparece el botón) se llama a `activar3d(true)`. Así el primer encuadre con datos ya es el de 3D. Con el parámetro `inicial`: la inclinación entra con `jumpTo` (sin animación; el centro y el zoom son los de siempre) y no se guarda la cámara de 2D (no hubo vista 2D que restaurar: "Vista 2D" solo aplana donde está). El botón sale en "Vista 2D" (`aria-pressed` verdadero). El primer encuadre de lo dibujado, cuando llegan datos, es el de siempre (animado con el tema; sin animación con `prefers-reduced-motion`).
- **Si el 3D falla, 2D sin errores:** `Capa3d.onAdd` atrapa un shader que no compila y avisa por `alFallar`; una excepción al entrar la atrapa el `try` del arranque. En los dos casos se deshace con `desactivar3d(true)` (nuevo parámetro `inmediato`, sin animación) y queda un `console.warn` ("Sin vista 3D en el mapa"), no un error. Sin relieve (o sin los tokens `--relieve-*`) nunca se intenta.
- **Nada más cambia** del 3D ni del 2D (la ruta del botón es la misma; solo gana el aviso si la capa falla).
- **Documentación:** README del mapa (frase de arranque, sección "Arranque en 3D", costo), fila D-W23 (desde T-673 arranca en 3D), 03 §3.4 y fila T-673 del backlog.

## Pruebas que se ajustaron
- `e2e/mapa_3d.spec.ts`: el ayudante `abrir()` ahora deja el mapa en 2D pulsando "Vista 2D" (parámetro `volverA2d`, por defecto sí), así las pruebas que parten del plano o entran en 3D con el botón no cambian; la prueba "con relieve aparece y el mapa arranca en 2D" pasó a "arranca en 3D con el botón en Vista 2D" (y vuelve al plano y a 3D); la de la miniatura en `dist/` ya no pulsa el botón (la imagen aparece al arrancar).
- `e2e/mapa.spec.ts` y `e2e/mapa_sin_range.spec.ts`: bloquean los archivos del relieve (`beforeEach`), como ya hacía `mapa_limites.spec.ts`: son pruebas del mapa en 2D.
- **Prueba nueva** ("el mapa arranca en 3D (T-673)", en `mapa_3d.spec.ts`): en escritorio y en celular, y en las dos misiones, con relieve `data-mapa-3d="true"` al cargar, botón en "Vista 2D", terreno activo e inclinación; sin relieve, `"false"` y sin botón. Más una prueba del fallo: con el shader de la capa fingiendo no compilar, el mapa queda en 2D, el botón dice "Vista 3D" y solo hay un aviso en consola.
- Vitest: sin cambios necesarios (643 pasan).

## Evidencia
- `npx tsc --noEmit`: **pasó**. `npm run build` (tsc, `colores.mjs`, `vite build`, `aislamiento.mjs`): **pasó** ("Colores OK", "Aislamiento OK"). `npx vitest run`: **27 archivos, 643 pasaron, 1 omitida (644)**. `biome check` de los archivos tocados: limpio.
- **e2e: una sola corrida, interrumpida a pedido de Jerónimo** (`--workers=1`, `mapa_3d.spec.ts`, `mapa.spec.ts`, `mapa_sin_range.spec.ts` y `mapa_relieve.spec.ts`). Alcanzó a correr **32 pruebas, todas de `mapa_3d.spec.ts`: 31 pasaron y 1 falló**; `mapa.spec.ts`, `mapa_sin_range.spec.ts` y `mapa_relieve.spec.ts` **no llegaron a correrse**.
  - Pasaron: las pruebas nuevas del arranque (escritorio y celular, Deméter y Hermes: con relieve `data-mapa-3d="true"`, botón en "Vista 2D"; sin relieve `"false"` y sin botón), la del fallo (con el shader fingiendo no compilar, queda en 2D, botón "Vista 3D", un aviso y ningún error), la del botón (arranca en 3D, pasa a 2D y vuelve), la de la miniatura en `dist/` y "Ver todo" y "Centrar" con la vista inclinada, entre otras.
  - **Falló** "en 2D todo queda como antes: el lienzo no cambia tras entrar y salir del 3D" (13,9 s). No se alcanzó a leer el mensaje (la corrida se cortó) ni a repetirla: **no se sabe si es un fallo real del cambio o de la prueba** (esa prueba pasaba en las rondas de T-656; ahora parte de un mapa que arranca en 3D y se aplana con "Vista 2D" en `abrir()`).
  - No se tomó la captura nueva del arranque en celular salvo la que la prueba nueva guarda en `e2e/capturas/T-673/` (no se versiona).
- No se corrió `en_vivo.spec.ts` ni la suite completa (el encargo pedía una sola corrida).

## Decisiones tomadas
- El 3D de arranque entra sin animación y sin guardar la cámara de 2D.
- El fallo del 3D se atrapa en la propia capa (no solo con `try`), porque el compilador de shaders falla de forma asíncrona respecto a `addLayer` en algunos navegadores.

## Pendiente
- El 3D ya es la vista de arranque: sigue sin medirse en un celular real. La salida rápida de antes (ocultar el botón) ya no basta; es no publicar `public/mapas/relieve/` (sin relieve no hay 3D).
