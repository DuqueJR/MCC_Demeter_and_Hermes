---
id: gui_identidad
estado: propuesta. Los tokens de §6 son contrato desde el cierre de W0.
actualizado: 2026-10-25
depende_de: [gui_vision]
fuentes: [docs/fuentes/marca/escudo_hermes.png, escudo_demeter.png, escudo_eia_con_fondo.png, escudo_eia_sin_fondo.png]
---
# Identidad visual: un sistema, dos almas

## 1. La idea

Los dos parches comparten la misma estructura:
- **un aro azul muy oscuro**;
- **letras blancas** con los apellidos del equipo;
- **una ilustración pintada** de un dios griego;
- **un cohete pequeño subiendo**.

Esa estructura es el sistema común: **"control de misión EIA de noche"**. Lo que cambia es el alma de cada equipo.

| | **Hermes, el mensajero** | **Deméter, la tierra que mira** |
| --- | --- | --- |
| Lo que cuenta el parche | Hermes sentado en las nubes, con casco alado de bronce y capa roja al viento, mira su cohete de franjas cobrizas subir | Deméter con corona de flores, ojos cerrados y una gema verde en la frente; montañas, bosque y espigas. El cohete sube en arco sobre la montaña. |
| Concepto | **Velocidad y cielo.** El cohete es un mensaje que sube entre las nubes. | **Tierra y mirada.** El cohete nace de la montaña, y su carga útil son "los ojos de Deméter" (las cámaras del VisionPack). La gema de la frente es el ojo. |
| Atmósfera | Atardecer lavanda sobre un mar de nubes, viento | Montaña antioqueña, bosque y trigo bajo cielo claro; de noche, curvas de nivel |
| Movimiento | Rápido, en diagonal, como ráfagas | Pausado, de abajo hacia arriba, como algo que crece |
| Formas | Esquinas más rectas (radio de 6 px), cortes diagonales, alas | Esquinas suaves (radio de 14 px), curvas orgánicas, hojas y espigas |
| Motivo decorativo | Líneas de viento, plumas de ala, franjas de bronce como las del cohete | Curvas de nivel del terreno real de Santa Fe de Antioquia, espigas de trigo, hojas |

## 2. Paletas

Los colores de marca salen de muestrear los escudos (`docs/fuentes/marca/`). Los fondos y textos están **calculados para el modo oscuro**: todos los textos de abajo cumplen WCAG AA (≥ 4,5:1) sobre su fondo y su superficie, verificado.

### 2.1 Hermes (`data-mision="hermes"`)

| Rol | Color | Uso | Contraste sobre el fondo |
| --- | --- | --- | --- |
| Fondo | `#14112A` | Fondo de la página: el índigo del aro, llevado a noche | — |
| Superficie | `#1E1A3A` | Tarjetas | — |
| Superficie 2 | `#2A2450` | Tarjetas elevadas, la barra de misión | — |
| Línea | `#3D3566` | Bordes y divisores | — |
| Texto | `#F3EEF8` | Texto principal y números | 16,1 |
| Texto 2 | `#B9B0D6` | Etiquetas y unidades | 9,0 |
| **Acento de datos** | `#B4A7F5` (lavanda) | Líneas de las gráficas, la trayectoria, el realce de lo seleccionado | 8,6 |
| Marca 1 | `#362B57` (aro) | Aros de los parches, bloques de color | — |
| Marca 2 | `#C8955A` (bronce) | Ornamentos, franjas, títulos de sección | 6,9 |
| Marca 3 | `#C92D34` (capa) | **Solo ilustración y decoración** (cintas, fondos). **Nunca en texto ni en datos**: se confunde con la alarma y no tiene contraste (3,4). | ❌ 3,4 |
| Nube | `#DFD5ED` | Brillos y degradados del fondo | — |

### 2.2 Deméter (`data-mision="demeter"`)

| Rol | Color | Uso | Contraste sobre el fondo |
| --- | --- | --- | --- |
| Fondo | `#0B1A24` | Fondo: el azul petróleo del aro, llevado a noche | — |
| Superficie | `#10222F` | Tarjetas | — |
| Superficie 2 | `#18324A` | Tarjetas elevadas, la barra de misión | — |
| Línea | `#24435C` | Bordes y divisores | — |
| Texto | `#F2F0ED` | Texto principal y números (el crema del vestido) | 15,6 |
| Texto 2 | `#A9C1D1` | Etiquetas y unidades | 9,5 |
| **Acento de datos** | `#85C6F8` (cielo) | Gráficas, trayectoria, selección | 9,6 |
| Marca 1 | `#1B364A` (aro) | Aros y bloques | — |
| Marca 2 | `#D9A93A` (trigo) | **Solo ornamentos** (espigas, divisores, títulos de sección). Nunca en un indicador: se confunde con el ámbar de aviso. | 8,2 |
| Marca 3 | `#2E9E62` (gema, aclarada para el modo oscuro) | La gema-ojo, los detalles de "Los ojos de Deméter". **Nunca como "OK".** | 5,2 |
| Bosque | `#1D3422` | Degradados del fondo y montañas | — |
| Flor | `#DA89AA` | Pequeños acentos ilustrados (máximo uno por pantalla) | — |

### 2.3 EIA (común)

| Rol | Color | Uso |
| --- | --- | --- |
| Teal EIA | `#014C58` | Pie de página, sello "Universidad EIA" |
| Cian EIA | `#6BC6D1` | Detalles institucionales y estado "info" (ver §4) |
| Logo | `escudo_eia_sin_fondo.png` (blanco) | Siempre la versión blanca sobre fondo oscuro, con un alto mínimo de 24 px |

## 3. La regla de oro: la marca no da significado

**Los colores de marca crean el ambiente. Los colores de estado cuentan lo que pasa.** Nunca se mezclan (D-W08).
- El rojo de la capa de Hermes **no** es una alarma.
- El verde esmeralda de Deméter **no** es un "GO".
- El trigo **no** es un aviso.

Quien pase de Hermes a Deméter lee los estados exactamente igual.

## 4. Colores de estado (iguales en los dos temas)

| Estado | Color | Siempre acompañado de | Ejemplos |
| --- | --- | --- | --- |
| OK / GO | `#3DD68C` | ícono ✓ y una palabra ("Listo", "GO") | Sensor bien, Go/No-Go en verde |
| Aviso | `#F5B83D` | ícono ⚠ y una palabra | Pocos satélites, batería media, datos con retraso |
| Alarma / falla / LKP | `#FF4D5E` | ícono ⛔ o 📍, una palabra y, si es crítica, un banner | Descenso rápido, sensor en falla, **última posición conocida** (*Objetivos* 7.G pide rojo) |
| Sin dato / sin señal | `#8A8FA3` | el texto "sin dato" o la antigüedad ("hace 12 s") | Campo vacío, enlace perdido |
| Info | `#6BC6D1` (cian EIA) | ícono ⓘ | "Simulación", "Reconstruyendo el vuelo" |

Todos tienen contraste ≥ 5:1 sobre los fondos y las superficies de los dos temas (verificado). **El color nunca es la única señal:** siempre va con un ícono o una palabra (accesibilidad y sol directo).

## 5. Tipografía

| Uso | Hermes | Deméter | Por qué |
| --- | --- | --- | --- |
| Títulos y nombre de la misión | **Montserrat** 700–800, en mayúsculas, con espaciado de 0,08 em | **Marcellus**, en mayúsculas, con espaciado de 0,06 em | Hermes: es geométrica, como las letras del parche. Deméter: es clásica y con remates suaves, como "DEMÉTER" y el aro de nombres. |
| Texto, etiquetas y **números** | **Inter**, variable | **Inter**, variable | Excelente en pantallas pequeñas; con `font-variant-numeric: tabular-nums` los números no "bailan" al cambiar 10 veces por segundo |

- Todas son de Google Fonts y se **autohospedan** (WOFF2, solo el subconjunto latino). Cada página carga **solo su fuente de títulos** más Inter (D-W01).
- **Tamaños en el celular:**
  - texto 16 px;
  - etiquetas 13 px en mayúsculas;
  - **números principales 40–56 px** (se leen al sol);
  - números secundarios 24 px.
- **Unidades:** van siempre en Texto 2, más pequeñas y pegadas al número: `669` `m`. Se usa **coma decimal** (español): `9,2 m/s`.

## 6. Tokens de diseño (contrato desde W0)

Variables CSS en `:root[data-mision="…"]`. Cada página carga solo `tema/comun.css` y el archivo de su misión. **Los componentes solo usan tokens, nunca colores sueltos.**

| Token | Hermes | Deméter |
| --- | --- | --- |
| `--fondo` | `#14112A` | `#0B1A24` |
| `--superficie` | `#1E1A3A` | `#10222F` |
| `--superficie-2` | `#2A2450` | `#18324A` |
| `--linea` | `#3D3566` | `#24435C` |
| `--texto` | `#F3EEF8` | `#F2F0ED` |
| `--texto-2` | `#B9B0D6` | `#A9C1D1` |
| `--acento` | `#B4A7F5` | `#85C6F8` |
| `--marca-1` | `#362B57` | `#1B364A` |
| `--marca-2` | `#C8955A` | `#D9A93A` |
| `--marca-3` | `#C92D34` | `#2E9E62` |
| `--fuente-display` | `"Montserrat"` | `"Marcellus"` |
| `--radio` / `--radio-tarjeta` | `4px` / `6px` | `10px` / `14px` |
| `--dur-rapida` / `--dur-media` | `120ms` / `180ms` | `200ms` / `320ms` |
| `--curva` | `cubic-bezier(.2,.8,.2,1)` (sale disparada) | `cubic-bezier(.4,0,.2,1)` (crece) |

**Comunes** (`tema/comun.css`):
- `--estado-ok`, `--estado-aviso`, `--estado-alarma`, `--estado-sin-dato` y `--estado-info` (§4);
- `--eia-teal` y `--eia-cian`;
- `--fuente-texto: "Inter"`;
- la escala de espacios `--e-1` a `--e-8`: 4, 8, 12, 16, 24, 32, 48 y 64 px;
- `--toque-min: 44px`.

## 7. Imágenes e ilustración

- **Los parches son el centro.** Siempre circulares y completos, nunca recortados ni deformados, con un tamaño mínimo de 96 px.
  - Sobre el fondo oscuro llevan un halo suave del color `--acento`.
  - Se exportan en WebP y AVIF, en 256, 512 y 1024 px.
- **Los fondos de la portada** son paisajes **pintados**, del mismo estilo de ilustración de los parches, oscurecidos hacia el color `--fondo` con un degradado para que el parche resalte. Se especifican en [07_assets_e_imagenes](07_assets_e_imagenes.md).
- **Las fotos reales** (el cohete y el equipo) se tratan con un leve duotono del tema solo en los fondos, y **a color en su sección**: la gente quiere ver a su familiar tal como es.
- **Íconos:** Lucide (MIT, se importan solo los usados), con trazo de 1,75 y en `--texto-2`.

## 8. Movimiento

- Hermes entra en **diagonal** (de abajo a la izquierda hacia arriba a la derecha) y rápido. Deméter **sube y aparece** despacio.
- **Los números en vivo no se animan con efectos.** Cambian en su lugar, con números tabulares, y la interpolación los hace fluidos.
- Con `prefers-reduced-motion` se apagan todas las transiciones decorativas.

## 9. Voz y tono (solo español, D-W02)

- Se tutea, en un tono cercano y emocionante, pero **los números son exactos** y llevan su unidad.
- **Nombres de las fases para el público.** El código de [maquina_estados](../04_diseno/maquina_estados.md) va en el detalle técnico.

| Código | Título | Subtítulo |
| --- | --- | --- |
| BOOT | Encendiendo | El cohete está despertando sus sistemas |
| PREFLIGHT | En la rampa | Preparando sensores y buscando satélites |
| ARMED | Listo para despegar | Armado y esperando la ignición |
| BOOST | ¡Despegue! | Subiendo con el motor encendido |
| COAST | Subiendo por inercia | El motor se apagó y sigue subiendo |
| APOGEE | ¡Apogeo! | Llegó a su punto más alto |
| FREE_FALL | Cayendo | Bajando antes de abrir el paracaídas |
| DESCENT | Bajando con paracaídas | Descenso controlado |
| LANDED | En tierra | Aterrizó. El equipo va a recuperarlo. |
| ERROR | Revisando en tierra | El equipo está resolviendo un problema antes del vuelo |

- **Mensajes de estado de la conexión:**
  - "En vivo";
  - "Señal débil: los datos llegan con retraso";
  - "Sin señal del cohete: última posición hace 12 s";
  - "Simulación: así será el vuelo".

## 10. Accesibilidad

- Contraste AA verificado (§2 y §4). Los números principales son grandes.
- Objetivos táctiles de ≥ 44 px. El texto se puede ampliar al 200 % sin romper el diseño.
- El estado nunca se comunica solo con color (§4).
- Las regiones en vivo usan `aria-live="polite"` solo para los cambios de fase y las alarmas, no para los números de 10 Hz.
- Los parches y fotos llevan texto alternativo.
