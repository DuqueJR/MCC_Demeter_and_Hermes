---
fecha: 2026-11-03
tipo: tarea
ids: [T-623, PEN-W01, PEN-W02, PEN-W03, PEN-W04, PEN-07]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-623-contenido
---
# T-623: Contenido provisional de cada misión

## Contexto
Área E de la web. T-622 dejó textos mínimos en `gui/web/src/contenido/demeter.ts` y `hermes.ts`. La decisión del usuario es "tú redactas y el usuario revisa en el PR". Base: `origin/develop` en `95b20e1` (T-622, T-624 y T-625 integradas). Los textos **siguen provisionales** (`provisional: true`) hasta que se cierren PEN-W02 y PEN-W03.

## Qué se hizo
- Se reescribieron en `contenido/demeter.ts` y `contenido/hermes.ts`: la `frase`, el `texto` de cada parte (1 a 3 frases), los `pie` de las fotos y el comentario de cabecera.
- El comentario de cabecera dice de dónde sale cada cifra. En el texto de las partes no hay cifras sin respaldo.
- **No se tocó:** `tipos.ts`, `src/mision/`, los íconos, los parches, `src: null` de las fotos (PEN-W01), `provisional: true`, ni los `integrantes` (`nombre: null`, `rol: null` y los apellidos de los parches tal cual).
- `lema`, `nombre`, `motor` y los `alt` quedan igual: los lemas vienen de `02_identidad_visual` ("Hermes, el mensajero" y "Deméter, la tierra que mira"), el motor de `MOTORES`, y los `alt` ya describían la foto prevista sin afirmar nada de su contenido.
- Se cambió el `pie` de las fotos porque son la clave (`key={f.pie}`) de la diapositiva en `Inicio.tsx`; siguen siendo únicos.

## Textos: antes y después
Fuente de cada cifra: ver la tabla siguiente.

| Misión | Campo | Antes | Después |
| --- | --- | --- | --- |
| Deméter | `lema` | La tierra que mira | (sin cambio) |
| Deméter | `frase` | Un cohete que sube con una carga útil que mira: dos cámaras que graban el vuelo. | Deméter sube con dos cámaras a bordo que graban el vuelo, mientras su CanSat cuenta por radio, en vivo, cómo va. |
| Deméter | foto 1, `pie` | El cohete | El cohete Deméter |
| Deméter | foto 2, `pie` | El equipo | El equipo de Deméter |
| Deméter | foto 3, `pie` | El CanSat | El CanSat, la carga útil |
| Deméter | foto 4, `pie` | El VisionPack | El VisionPack y sus dos cámaras |
| Deméter | parte Nariz | La punta del cohete. Corta el aire al subir. | La punta del cohete. Abre paso al aire para que la subida sea más fácil. |
| Deméter | parte CanSat | La carga útil de la competencia, de 250 a 300 g. | La carga útil de la competencia: un pequeño computador de vuelo que mide la altura, el movimiento y la posición por GPS. Manda esos datos por radio a la estación en tierra. Por reglamento pesa entre 250 y 300 g. |
| Deméter | parte VisionPack | Los ojos de Deméter: las cámaras que graban el vuelo. | Los ojos de Deméter: una computadora Raspberry Pi 5 con dos cámaras. Está pensada para grabar la subida y, al llegar arriba, capturar imágenes del descenso. |
| Deméter | parte Motor | H135W-8: empuja al cohete hasta cerca de 670 m. | H135W-8: el motor que impulsa a Deméter. En la simulación empuja unos 2 segundos y el cohete sigue subiendo por inercia hasta unos 670 m sobre la rampa. |
| Deméter | parte Paracaídas | Se abre con la carga de eyección del motor. | Lo abre la carga de eyección del motor, sin electrónica de por medio. En la simulación ocurre a los 10 segundos de vuelo, un poco antes del punto más alto, y el cohete baja a unos 9 m/s. |
| Deméter | parte Aletas | Mantienen al cohete derecho mientras sube. | Mantienen al cohete derecho mientras sube, como las plumas de una flecha. |
| Hermes | `lema` | El mensajero | (sin cambio) |
| Hermes | `frase` | Un cohete que es un mensaje que sube entre las nubes y cuenta cómo va, en vivo. | Hermes sube con un CanSat que mide el vuelo y lo cuenta por radio, en vivo, mientras el cohete se eleva. |
| Hermes | foto 1, `pie` | El cohete | El cohete Hermes |
| Hermes | foto 2, `pie` | El equipo | El equipo de Hermes |
| Hermes | foto 3, `pie` | El CanSat | El CanSat, la carga útil |
| Hermes | parte Nariz | La punta del cohete. Corta el aire al subir. | La punta del cohete. Abre paso al aire para que la subida sea más fácil. |
| Hermes | parte CanSat | La carga útil de la competencia, de 250 a 300 g. | (el mismo texto que el de Deméter) |
| Hermes | parte Motor | G80-7T: empuja al cohete hacia el cielo. | G80-7T: el motor que impulsa a Hermes hacia el cielo. Cuando se le acaba el empuje, su carga de eyección es la que se encarga de abrir el paracaídas. |
| Hermes | parte Paracaídas | Se abre con la carga de eyección del motor. | Lo abre la carga de eyección del motor, sin electrónica de por medio. Así lo exige el reglamento, y es lo que baja a Hermes y a su CanSat juntos. |
| Hermes | parte Aletas | Mantienen al cohete derecho mientras sube. | Mantienen al cohete derecho mientras sube, como las plumas de una flecha. |

## Origen de cada cifra y afirmación
| Dato en el texto | Origen |
| --- | --- |
| Motor H135W-8 (Deméter) y G80-7T (Hermes) | `constantes.md`, `MOTORES` |
| "Entre 250 y 300 g" | `constantes.md`, `CANSAT_MASA_G` (rango del reglamento, no una medida; el texto dice "por reglamento") |
| "Unos 670 m sobre la rampa" | `perfiles_vuelo.md` §1: apogeo simulado de 669 m AGL |
| "Empuja unos 2 segundos" | `perfiles_vuelo.md` §1: fin de la combustión a los 2,072 s |
| "A los 10 segundos de vuelo, un poco antes del punto más alto" | `perfiles_vuelo.md` §1: eyección a los 10,072 s, 1,46 s antes del apogeo (11,536 s) |
| "Baja a unos 9 m/s" | `perfiles_vuelo.md` §1: descenso medio de -9,2 m/s en la simulación |
| Paracaídas solo por la carga de eyección, sin electrónica | `constantes.md` (recuperación), `proyecto.md` (reglas del DCP) |
| VisionPack: Raspberry Pi 5 y 2 cámaras | `proyecto.md` y `componentes.md` (2× Camera Module 3) |
| VisionPack graba la subida y captura imágenes del descenso | `visionpack_integracion.md` §2: `CMD_START_ASCENT` (video) en BOOST y `CMD_START_REC` (captura RAW del descenso) en APOGEE. **El documento está en estado "propuesta"**, por eso el texto dice "está pensada para" |
| CanSat con altura, movimiento, GPS y radio | `proyecto.md`, hardware del CanSat (BMP581, LSM6DSO32, MAX-M10S, SX1262) |
| "En vivo", "por radio" | Enlace LoRa y relay público (`01_vision_y_alcance`) |

Todas las cifras de la simulación llevan en el texto la palabra "simulación"; ninguna se presenta como medición.

## Apogeo de Hermes
**No existe.** `perfiles_vuelo.md` §2 dice "Falta la simulación (PEN-07)" y `00_README` registra PEN-W04. El texto del motor de Hermes no lleva altura ni tiempos, y el comentario de cabecera de `hermes.ts` lo deja anotado. Cuando llegue la simulación del G80-7T, se agrega la cifra con su origen.

## Evidencia
- `npx biome check src/contenido` y `npx tsc --noEmit`: sin errores.
- `npm run build`: verde (tsc, colores, vite, aislamiento OK: `/demeter/` y `/hermes/` no se referencian entre sí).
- `npm run lint` (`biome check .`): sin errores; 9 avisos que ya existían, ninguno en `src/contenido`.
- `npm test`: 19 archivos, 377 pruebas pasan, 1 omitida.
- `npx playwright test` (corrida completa): 159 pasan, 14 omitidas, **3 fallan**. Son `en_vivo.spec.ts:107` (objetivos en orden), `mapa.spec.ts:48` (MapLibre diferido) y `mapa.spec.ts:198` (gestos en el celular). En una segunda corrida de `en_vivo` y `mapa` pasaron 22 y solo falló la de gestos, que es la conocida en `develop` (T-632, ver bitácora de T-624). Las otras dos fueron intermitentes por la carga de la máquina durante la corrida completa; ninguna toca los textos de `contenido/`.
- Ninguna prueba dependía de un texto que cambió: `chips_iconos.spec.ts` usa los nombres de las partes y `mision.spec.ts:226` busca "G80-7T" en la tarjeta del motor de Hermes, que sigue en el texto. No se modificó ninguna prueba.

## Decisiones tomadas o propuestas
- Ninguna decisión nueva ni cambio de contrato.
- `lema`: se conservan los de `02_identidad_visual` en vez de reescribirlos.

## Problemas y cómo se resolvieron
- Python en Windows escribió el archivo con CRLF; se pasó a LF (el repo fuerza `eol=lf`) antes de commitear.

## Preguntas abiertas (para el usuario)
1. **Apogeo de Hermes:** no hay simulación (PEN-07, PEN-W04). El texto del motor no trae altura. ¿Se deja así hasta la simulación?
2. **PEN-W02 (nombres y roles) sigue abierto:** `integrantes` queda con `nombre: null` y `rol: null`.
3. **PEN-W03 (textos de las partes y de la misión):** estos textos son la propuesta para ese pendiente; falta que el usuario los apruebe en el PR. Hasta entonces el aviso "Textos provisionales" sigue en `Inicio`.
4. **VisionPack:** el texto dice que "está pensada para grabar la subida y capturar imágenes del descenso". Eso viene de `visionpack_integracion.md`, que está en "propuesta (validar con Jerónimo)". ¿Jerónimo confirma el cuándo y el qué de la grabación?
5. **CanSat idéntico en las dos misiones:** el texto es el mismo porque el hardware es el mismo (proyecto.md). Si cada equipo quiere destacar algo propio, lo agregan en la revisión.
6. **Posible cambio fuera de alcance:** el `alt` de las fotos hoy es un aria-label del placeholder (`Inicio.tsx`). Cuando lleguen las fotos reales (PEN-W01), cada `alt` debería describir lo que se ve. No requiere cambio de `tipos.ts`.
7. Se mencionan "Raspberry Pi 5" y "GPS" por nombre: ¿es demasiada jerga para el público general? Se pueden bajar a "una computadora pequeña" y "la ubicación".

## Pendiente / siguiente paso
- Que el usuario revise los textos en el PR (es condición para el merge, según el criterio de T-623).
- Cuando haya simulación de Hermes: cifra del motor y de la bajada en `hermes.ts`.
- PEN-W01 y PEN-W02: fotos y nombres.

## Documentos afectados
- `gui/web/src/contenido/demeter.ts` y `hermes.ts`.
- El documentador consolidará `backlog.md` (T-623) y los pendientes PEN-W02 y PEN-W03.
