---
fecha: 2026-10-25
tipo: tarea
ids: [T-621, T-620, T-622, D-W01, D-W20, PEN-W10]
autor: desarrollador (Claude Sonnet)
rama: feature/T-621-assets-marca
---
# T-621: integración de los assets de marca (fondos de la portada e íconos de las partes)

## Contexto
El diseñador y el usuario ya generaron y eligieron las imágenes (`generated_images/`, fuera del repo). Esta tarea las integra en la web: los fondos de la portada (T-620) y los íconos ilustrativos de las partes del cohete en los chips del Inicio (T-622). Sesión web.

## Qué se hizo
- **Fondos de la portada.**
  - Copiados a `gui/web/src/assets/{demeter,hermes}/fondo_portada.webp` (1152×1280, tal cual).
  - Cada mitad de `index.html` lleva un `<span class="fondo">` con `<picture>`: `source` AVIF, `source` WebP e `img`, sin JS. Candidatos de 576, 768 y 1152 px (el original no pasa de 1152).
  - `scripts/imagenes-html.mjs` (el plugin de T-620) ahora acepta fuentes `.webp` y un `quality=` opcional (el mismo nombre que usa imagetools). Calidades: AVIF 20 a 576 px, 34 a 768 px y 40 a 1152 px; WebP 60.
  - **Velo con los tokens del tema** (`portada.css`): `.fondo::before` es un oscurecido general del 30 % con `--fondo`, y `.fondo::after` es un degradado con `--fondo` (arriba, para la cabecera; abajo, para el nombre y "Entrar") al 85 %. Las cifras son variables locales (`--velo-general`, `--velo-abajo`, `--velo-llega`, `--velo-arriba-llega`); no hay colores sueltos.
  - Se borró el degradado provisional de la mitad (`background: var(--fondo)` queda de color de respaldo).
- **Íconos de las partes.**
  - `scripts/iconos-transparentes.mjs` (una línea en el README): quita el fondo y guarda a 512 px en `src/assets/{demeter,hermes}/iconos/<parte>.png`. 6 de Deméter y 5 de Hermes (sin VisionPack).
  - Método y resultado, abajo.
- **Chips del Inicio.** `Parte.icono?: string` en `contenido/tipos.ts`; `contenido/demeter.ts` y `hermes.ts` importan sus íconos con `?w=96&format=webp` (imagetools); `Inicio.tsx` pinta `<img class="chip-icono">` (40 px) a la izquierda del texto, con `onError` que lo oculta; `mision.css` pone el chip en `inline-flex`.
- **Aislamiento.** `scripts/aislamiento.mjs`: una imagen alcanzable desde las dos páginas es una violación (salvo `eia_blanco-*`, lo común). Hacía falta porque imagetools nombra los archivos `<parte>-<hash>.webp` sin la misión: antes, un ícono de Deméter importado desde Hermes no lo delataba el nombre.
- **Fuentes precargadas** (`<link rel="preload" as="font">` de las tres): el primer pintado simulado baja de 1,5 s a 0,75 s. No lo pedía la tarea; salió de buscar el LCP y cuesta tres líneas.
- `docs/08_gui/07_assets_e_imagenes.md` §1: los fondos y los íconos de las partes pasan a ✅ con su origen. Se separó la fila de los íconos: **los íconos de los objetivos de la misión siguen ⏳** (no venían en las imágenes).

## Cómo se quitó el fondo de los íconos
1. Los originales (1024², PNG sin alfa) traen un fondo oscuro con un **degradado suave** (por ejemplo, de `9,61,87` en una esquina a `5,60,95` arriba al centro). Un color único de las esquinas no sirve: se **modela el fondo** con un polinomio de grado 2 por canal en (x, y), ajustado a los píxeles que se parecen al fondo (primero un anillo del 7 % del borde; luego, dos rondas con los que quedan a menos de 14 de distancia del modelo). El residuo del modelo es de 1,1 a 2,1 niveles de color.
2. Alfa = `smoothstep((d − 10) / (60 − 10))`, con `d` la distancia euclidiana de color al fondo modelado: el borde queda suave.
3. Solo es transparente lo que se **conecta con el borde** de la imagen (relleno por inundación sobre alfa < 0,5, más una franja de 2 px). Lo que el dibujo encierra y se parece al fondo (el cuerpo de la lata, el cristal de los lentes) conserva su color.
4. Se quita el fondo mezclado en los bordes (`F = (C − (1 − a)·B) / a`), se recorta al dibujo, se centra en un cuadrado con un 5 % de margen y se reduce a 512 px (lanczos3, con alfa premultiplicado por sharp). PNG con paleta (calidad 90).
- **Resultado:** 11 PNG de 16,6 a 47 KB (antes 365 a 480 KB), 512×512. Revisados sobre fondo oscuro, claro y magenta: sin halos ni cuadros. Con el fondo oscuro de las misiones se ven igual que el original. Sobre un fondo claro los trazos muy finos (los hilos del paracaídas, las líneas del motor de Deméter) se ven apagados, porque su color ya era claro; las superficies de la web son oscuras.
- Un detalle que costó un intento: `sharp` aplica `extend` **después** de `resize`, así que el primer recorte salía cortado. Ahora arma el cuadrado primero y reduce después.

## Evidencia
- `npm run build`: OK (tsc, colores, vite, aislamiento: sin referencias cruzadas; fuentes de 62,8 KB y 67,3 KB).
- `npm test`: 7 archivos, **148 pruebas OK** (4 nuevas de aislamiento con dist falso y el dist real en verde).
- `npm run e2e`: **81 pruebas OK** (nuevas: 5 de contraste, 9 de chips con ícono).
- `biome check`: 0 errores; los 3 avisos ya existían (`comun.css` ×2 y `src/datos/estado_pagina.ts`).
- **Peso de `/`: 311,2 KB** (antes 252,7 KB); presupuesto < 500 KB. HTML 6,1 + CSS 6,2 + fuentes 81,9 + AVIF de 1152 px de Deméter 35,6 y de Hermes 19,7 + parches 87,8 y 58,2 + logo 15,9. El peso se cuenta con el candidato más pesado (pantalla densa); un celular baja 164 KB (Lighthouse: "Total size was 161 KiB").
- **Lighthouse móvil** (`npx lighthouse` sobre `vite preview`, con el Chromium de Playwright, sin tocar `package.json`): **LCP 1,95 s** (simulado), FCP 0,75 s, CLS 0, rendimiento 0,99, accesibilidad 1,00. El LCP es ahora el fondo de Deméter.
  - **Está cerca del límite.** Con el AVIF de 576 px a calidad 24 (7,4 KB en vez de 6,6 KB) el LCP simulado sube a 2,03 s; con `sizes` de 100vw (el celular baja 768 px) es 2,03 a 2,10 s. Por eso `sizes` dice 70vw y la calidad de ese tamaño es 20. Está anotado en un comentario de `index.html`. Con los fondos sin optimizar, el LCP era 2,10 s.
  - El LCP simulado salta en escalones de unos 75 ms según los bytes y los píxeles del fondo; el valor observado (sin simulación) es de unos 45 ms.
- **Contraste del texto sobre el fondo** (`e2e/portada_contraste.spec.ts`, mínimo 4,5:1 para todos, también los títulos grandes). Se oculta el texto (`color: transparent`), se captura la página y, para la caja de cada texto, se toma el percentil 95 de la luminancia relativa (WCAG 2.x) del fondo; la razón es `(L_texto + 0,05) / (L_fondo + 0,05)`. Como el texto es claro, el peor caso es el fondo más claro; el percentil 95 ignora píxeles sueltos (una flor, la pluma) sin esconder una zona clara real. Resultados:

| | 390×844 | 844×390 | 1440×900 | 1440×900, cursor en Deméter | 1440×900, cursor en Hermes |
| --- | --- | --- | --- | --- | --- |
| Nombre de Deméter | 8,27 | 6,42 | 7,30 | 5,92 | 8,77 |
| Lema de Deméter | 7,43 | 6,03 | 5,17 | 5,70 | 6,04 |
| "Entrar" de Deméter | 8,29 | 7,35 | 5,58 | 6,13 | 6,49 |
| Nombre de Hermes | 8,78 | 6,13 | 7,66 | 9,16 | 6,51 |
| Lema de Hermes | 6,61 | 5,93 | 5,84 | 6,60 | 5,78 |
| "Entrar" de Hermes | 7,25 | 6,15 | 4,82 | 5,56 | 5,39 |
| Lugar y fecha (cabecera) | — (se oculta) | 7,14 | 10,43 | 10,56 | 12,04 |
| Logo de la EIA (cabecera) | 5,75 | 6,22 | 9,95 | 10,63 | 11,45 |

  - La prueba **sí detecta el problema:** con el velo del 25 % y el degradado al 70 % que pedía 07 §2, fallaba (lema de Deméter 4,04:1 a 1440×900; el logo, 4,11:1 en el celular). Por eso el velo es más fuerte que lo de 07 §2 (30 % general, 85 % abajo, y una franja arriba para la cabecera). Está en "Propuestas".
- Chips (`e2e/chips_iconos.spec.ts`), en Deméter y Hermes a 390×844 y 1440×900: la imagen cargó, mide 40×40, queda dentro del chip y a la izquierda del texto, el chip cabe en la pantalla y no hay desborde horizontal; con las peticiones de `nariz`, `cansat` y `motor` abortadas el ícono se oculta, el chip se ve y se abre su tarjeta; Hermes no pide nada de `visionpack` ni de `/assets/demeter`.
- Capturas en `docs/07_bitacora/capturas/T-621/` (se regeneran con `npm run e2e`):
  - portada: `portada-390x844.png`, `portada-844x390.png`, `portada-1440x900.png`;
  - chips: `chips-demeter-390x844.png`, `chips-demeter-1440x900.png`, `chips-hermes-390x844.png`, `chips-hermes-1440x900.png`.
- Commits: `ffa1364` (íconos sin fondo), `b21a956` (fondos), `b45c865` (chips), `a1bd589` (aislamiento).

## Decisiones tomadas o propuestas
- **Propuesta (07 §2, el velo):** los porcentajes de 07 §2 (25 % general y 0 a 70 % abajo) no alcanzan para el AA sobre estas imágenes. Se usó 30 % general, 85 % abajo y una franja oscura arriba (la cabecera cae sobre el cielo claro de Deméter). Conviene que el diseñador actualice 07 §2 con esas cifras; yo solo toqué la tabla de §1.
- **Propuesta (celular y `sizes`):** el plan decía que el celular bajara unos 768 px; con 70vw baja 576 px en un celular de densidad 1,75 (y 768 px con densidad 2, 390 px de ancho: 546 px < 576). Es un fondo bajo un velo oscuro y se ve bien (capturas), pero es el costo del LCP < 2 s. Si el diseñador prefiere 768 px, el LCP pasa de 2 s: habría que pedir otro presupuesto o achicar otra cosa (los parches de la portada pesan 59 y 88 KB).
- **Aislamiento por contenido, no por nombre:** se aceptó la regla "una imagen alcanzable desde las dos misiones es una violación, salvo lo común". Si se agrega otra imagen común (por ejemplo, un ornamento en `comun/`), hay que declararla en `IMAGENES_COMUNES` de `scripts/aislamiento.mjs`.
- No se cambió ningún contrato, token ni `package.json`.

## Problemas y cómo se resolvieron
- El LCP simulado salió en 2,10 s con los fondos a calidad 55. Se bajó la calidad, se ajustó `sizes` y se precargaron las fuentes (ver Evidencia).
- Las pruebas e2e de T-622 y T-632 reescriben sus capturas al correr; se restauraron con `git checkout` antes de commitear para que el PR solo traiga las de T-621.
- El filtro de comandos de este entorno no deja correr scripts con `heredoc` ni globs; los scripts auxiliares (contacto de íconos, recorte) se escribieron como archivos aparte, fuera del repo.

## Pendiente / siguiente paso
- Los **íconos de los objetivos de la misión** (D-W20) no venían en las imágenes entregadas: la fila queda ⏳ en 07 §1.
- La cabecera en el celular solo muestra el logo (la pregunta de T-620 sigue abierta).
- El texto "Foto pendiente" y los parches de la página de misión siguen igual (PEN-W01).
- Si cambian los íconos: `node scripts/iconos-transparentes.mjs <carpeta>` desde `gui/web/`.

## Documentos afectados
`08_gui/07_assets_e_imagenes.md` §1 (inventario); `08_gui/07` §2 (cifras del velo, propuesta); `08_gui/04` §6 (el plugin de imágenes ahora acepta `.webp` y `quality=`).
