---
fecha: 2026-11-06
tipo: sesion
ids: [PEN-W01, PEN-W02, PEN-W03, D-W20]
autor: Claude (documentador) con Juan Pablo
rama: feature/web-contenido-final
---
# Contenido final de la web: parches, cohetes y fotos de equipo

## Contexto
El usuario entregó las imágenes reales (parches, foto de cada cohete y foto grupal de cada equipo) y pidió dejar la web sin marcas de provisional, lista para subir `dist/` a Cloudflare.

## Qué se hizo
- Parches reales de Hermes y Deméter en `gui/web/src/assets/<misión>/parche.png` (1024 px).
- Carrusel de Inicio: foto del cohete (completa, `contener`) y foto del equipo. Se quitaron las diapositivas sin foto (CanSat, VisionPack) para que no salga "Foto pendiente".
- Equipo: solo apellidos; ya no sale "Nombre y rol por confirmar".
- Se eliminó todo lo provisional: el campo `provisional`, el aviso "Textos provisionales." y su CSS.

## Evidencia
`tsc`, `npm run build` (colores y aislamiento OK) y `npm test` (429 pruebas) pasan. No queda la palabra "provisional" en `dist/`.

## Decisiones tomadas o propuestas
- PEN-W01 (fotos) y PEN-W02 (nombres y roles) se dan por cerradas para la web: se publican solo apellidos.
- PEN-W03 (textos): el usuario los acepta como definitivos.

## Pendiente / siguiente paso
- Fotos del CanSat y del VisionPack, si se quieren agregar al carrusel.
- Hermes sigue sin altura ni tiempos de vuelo en el texto hasta tener la simulación del G80-7T (PEN-07, PEN-W04).
- Actualizar `05_plan/pendientes.md` (PEN-21) con el cierre de PEN-W01 a W03.

## Documentos afectados
`gui/web/src/contenido/*`, `gui/web/src/mision/Inicio.tsx`, `Equipo.tsx`, `mision.css`.
