---
id: gui_assets
estado: propuesta
actualizado: 2026-10-25
depende_de: [gui_identidad]
---
# Assets e imágenes

## 1. Inventario

| Asset | Fuente | Estado | Dónde va en la web |
| --- | --- | --- | --- |
| Parche de Hermes | `docs/fuentes/marca/escudo_hermes.png` (2080², sin transparencia: el fondo blanco **se recorta en círculo** por CSS o en el export) | ✅ | Portada, barra de misión, Inicio, Equipo |
| Parche de Deméter | `docs/fuentes/marca/escudo_demeter.png` (2080², ídem) | ✅ | Ídem |
| Logo de la EIA, blanco | `docs/fuentes/marca/escudo_eia_sin_fondo.png` (2560×1440, transparente) | ✅ | Cabecera de la portada y pie |
| Logo de la EIA, a color | `docs/fuentes/marca/escudo_eia_con_fondo.png` (1080²) | ✅ Referencia, no se usa sobre el fondo oscuro | — |
| Fondo de la portada, Hermes | Generado (§2) | ⏳ T-621 | Portada |
| Fondo de la portada, Deméter | Generado (§2) | ⏳ T-621 | Portada |
| Fotos de cada cohete, del equipo y de los integrantes | Los equipos (§3) | ⏳ PEN-W01 | Inicio y Equipo |
| Ornamentos (alas y viento; espigas, hojas y curvas de nivel) | SVG hechos a mano o vectorizados | ⏳ Could, en T-622 o T-624 | Divisores de sección |
| **Íconos ilustrativos** (las partes del cohete: nariz, CanSat, VisionPack, motor, paracaídas y aletas; los objetivos de la misión) | **Generados con el MCP de Hugging Face** (§2, la misma paleta y el mismo trazo que el parche de cada misión) | ⏳ T-621 (necesita PEN-W08) | Chips de partes del Inicio, línea de objetivos |

- **Íconos: dos familias (D-W20).**
  - **De interfaz** (estado, navegación, flechas, alertas): `lucide-preact` (D-W17). Son vectoriales, se pintan con los tokens, pesan poco y se leen igual al sol en los dos temas.
  - **Ilustrativos** (partes del cohete, objetivos, equipo): **se generan con el MCP de Hugging Face**, como los fondos. Le dan a cada misión su identidad. Los genera el diseñador (el Claude principal) con el usuario y los guarda en `generated_images/`; los elegidos se copian a `src/assets/<misión>/iconos/` y los procesa `vite-imagetools`.
  - Los Spaces de generación están en `CLAUDE.md` (sección "Imágenes con Hugging Face"). Si no aparecen en la sesión, hay que reconectar el MCP con `/mcp`.
- **Originales:** quedan en `docs/fuentes/marca/` y **no se editan**.
- **Copias de trabajo:** en `gui/web/src/assets/{comun,demeter,hermes}/`, a resolución completa.
- **Formatos y tamaños:** el build genera AVIF y WebP en 256, 512 y 1024 px (y 1600 para los fondos) con `vite-imagetools`. Nadie exporta tamaños a mano. Se incluye en T-610.

## 2. Fondos de la portada

**Lo que pidió el usuario:** "el logo está en un fondo de naturaleza acorde con la estética de cada uno".

**Requisitos comunes:**
- **Estilo:** ilustración pintada, con trazos suaves, **parecida a la de los parches** (acuarela digital, cercana a la animación). Así el parche y el fondo parecen del mismo mundo.
- **Composición:**
  - el **centro despejado**, donde va el parche;
  - más detalle en los bordes;
  - **la parte de abajo más oscura**, para que se lean el nombre y el "Entrar".
- **Proporción:** **casi cuadrada, un poco vertical**. Sirve para la mitad del portátil (unos 960×1080) y para la mitad del celular (unos 390×420): se genera en 1152×1280 y se recorta con `object-fit: cover`.
- **Sin texto, sin personas, sin cohetes:** el parche ya tiene todo eso.
- Encima va un **degradado hacia el `--fondo` del tema** (02 §2), del 0 % arriba al 70 % abajo, y un oscurecido general del 25 %. El modo es oscuro.

| | Hermes | Deméter |
| --- | --- | --- |
| Escena | Un mar de nubes al atardecer visto desde lo alto, con picos de montaña asomando entre las nubes | Las montañas de Antioquia con bosque denso y un campo de trigo dorado en primer plano |
| Luz | Atardecer: cielo índigo arriba, lavanda en el medio y bordes de bronce en las nubes | Mañana clara: cielo azul claro y luz cálida sobre el trigo |
| Detalles | Ráfagas de viento suaves, alguna pluma flotando | Flores silvestres rosadas, espigas |
| Colores dominantes | `#362B57`, `#978ACE`, `#DFD5ED`, `#C8955A` | `#1B364A`, `#85C6F8`, `#1D3422`, `#D9A93A`, `#DA89AA` |

**Modelos (PEN-W08, cerrado el 2026-10-25).** El Space `black-forest-labs/FLUX.1-schnell` ya no aparece en el buscador de huggingface.co/settings/mcp. Están agregados cuatro Spaces, con Dynamic Spaces activado (la tabla está en `CLAUDE.md`, sección "Imágenes con Hugging Face"):
- **Borradores:** `evalstate/flux1_schnell`. Es del autor del servidor MCP de Hugging Face, está hecho para MCP y se actualizó en septiembre de 2026. Es rápido.
- **Versión final:** `black-forest-labs/FLUX.2-klein-9B`. Es el oficial de Black Forest Labs, más nuevo y de mejor calidad.
- `black-forest-labs/flux-3-image-klein` es muy reciente (18 de octubre de 2026): se prueba solo si los otros no convencen.
- `mcp-tools/Z-Image-Turbo`: otra opción rápida para borradores.
- **La API de *Inference Providers* no tiene créditos** en la cuenta gratuita: responde 402. Por eso se genera con los Spaces (ZeroGPU), no con esa API.

**Prompts** (en inglés, porque el modelo responde mejor). Se generan 4 semillas de cada uno en borrador; las 1 o 2 elegidas se rehacen en FLUX.2-klein a 1152×1280.

```
HERMES
Painterly digital illustration in soft anime-inspired watercolor style, a vast sea of soft
clouds at dusk seen from high altitude, deep indigo sky at the top fading to lavender,
warm bronze light catching the cloud edges, distant mountain peaks emerging through the
clouds, gentle wind streaks and a single floating white feather, calm and majestic,
open empty space in the center, darker towards the bottom, no people, no text, no rocket
```

```
DEMETER
Painterly digital illustration in soft anime-inspired watercolor style, lush Andean
mountains of Antioquia Colombia covered in dense green forest, a golden wheat field in
the foreground with small pink wildflowers, clear light blue sky with soft morning light,
calm and fertile atmosphere, open empty space in the center, darker towards the bottom,
no people, no text, no rocket
```

**Proceso (T-621):**
1. El diseñador (Claude principal) genera las 4 variantes de cada uno con el MCP de Hugging Face y las guarda en `generated_images/` (no se versiona).
2. El usuario elige una de cada equipo.
3. Se copian a `gui/web/src/assets/{hermes,demeter}/fondo_portada.png`.
4. Si no convence ninguna, se ajusta el prompt (máximo 3 rondas, por la cuota gratuita). Si no se logra, se usan fotos con licencia libre (Unsplash) con el mismo tratamiento.

> Para generar hace falta PEN-W08: agregar los dos Spaces de arriba en **huggingface.co/settings/mcp**. Hoy el servidor está conectado (usuario `apnauj`), pero solo expone las herramientas de búsqueda del Hub.

## 3. Fotos que hay que pedir a cada equipo (PEN-W01)

| Foto | Para | Indicaciones |
| --- | --- | --- |
| El cohete completo, vertical | Inicio (la principal) | Fondo limpio, buena luz, ≥ 2000 px de alto |
| 2 o 3 detalles | Carrusel de Inicio | La nariz, las aletas, el CanSat abierto; en Deméter, **el VisionPack y las cámaras** |
| El equipo en grupo | Inicio y Equipo | Horizontal, con el cohete si se puede |
| Un retrato de cada integrante | Equipo | Cuadrado, de los hombros hacia arriba, con el mismo fondo si se puede |
| Nombre completo y rol de cada uno | Equipo | En texto (PEN-W02) |
| **El consentimiento** de cada persona para salir en la web | Privacidad | Uno por persona |

Mientras no lleguen, se usan placeholders: el parche sobre el fondo de la portada, con el texto "Foto en camino".
