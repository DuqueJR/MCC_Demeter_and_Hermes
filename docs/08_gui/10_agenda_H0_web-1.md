---
id: gui_agenda_h0
estado: **decidida** el 2026-10-25 por el documentador, con delegación del usuario (D-W18). Jerónimo aprueba al integrar el PR #7.
actualizado: 2026-10-25
depende_de: [gui_contrato_datos, gui_experiencia, C-05, T-611]
---
# Agenda de H0: congelar `web-1` (PR #7, T-611)

**Quiénes:** Juan Pablo y Jerónimo, en la misma reunión que C-05 ([08 del back](../05_plan/dos_sesiones/08_sincronizacion_y_merge.md) §1).
**Qué se decide:** si el PR #7 se integra y `web-1` queda congelado. Después, solo entran campos opcionales sin pasar a `web-2` (R-W8).
> **Resultado (2026-10-25):** Juan Pablo delegó las decisiones ("decide tú; Jerónimo hará el merge"). Se aplicaron **todas las recomendaciones**, con dos ajustes:
> - **A1** quedó así: "sin transmisión" aplica si nunca llegó un dato del cohete, o si la última fase es BOOT, PREFLIGHT o ERROR y pasaron `WEB_SIN_TRANSMISION_MIN` (para que las pruebas de banco no muestren alarma de LKP). Desde ARMED, nunca.
> - **A2** quedó en la opción (b): solo se congela el lado de lectura.
>
> El agente aplica las correcciones en el PR #7. Los documentos (05, 03 §4, `constantes.md` §9 y C-05) ya están actualizados.

**Cómo leer esto:** cada punto trae una recomendación. Si los dos están de acuerdo, se marca ✅ y el documentador la pasa a [05](05_contrato_datos_web.md), a [03](03_experiencia_y_pantallas.md) o a [constantes](../02_requisitos/constantes.md).

## A. Lo que hay que corregir antes de congelar (revisión del documentador)

El PR cumple su criterio: los tipos y el esquema dicen lo mismo, el validador rechaza los casos falsos y las tres órdenes pasan. Pero hay cuatro problemas en `src/datos/`, que es justo lo que se congela.

| # | Gravedad | Problema | Propuesta |
| --- | --- | --- | --- |
| A1 | **Alta** | **Tras 10 min sin señal del cohete, la página pasa de "sin señal (LKP)" a "la transmisión empieza el día del lanzamiento"** (`estado_pagina.ts`). Hay dos fallas:<br>- 03 §4 define "sin transmisión" por **la estación**, no por el cohete.<br>- En plena recuperación, el público y el equipo perderían el aviso del LKP. Eso contradice GS-03 y el criterio de T-632: "el LKP nunca desaparece". | `sin_transmision` solo si **nunca** llegó un dato del cohete en esta misión **y** la estación lleva `WEB_SIN_TRANSMISION_MIN` callada (o no hay latido). Si ya hubo datos del cohete, la página se queda en `sin_senal` con el LKP, sin límite de tiempo. |
| A2 | **Alta** | **`alimentar` solo tiene `snapshot`, `conexion` y `reloj`.** El cliente de T-631 necesita aplicar los mensajes del SSE uno a uno: `meta`, `estado`, `salud`, `estacion` (con su hora de llegada, que es la que alimenta `edad`), `evento` (agregar) y `backfill`. Si `api.ts` se congela así, T-631 tiene que romper el congelamiento. | Una de dos:<br>(a) agregar ya esos métodos a `alimentar`;<br>(b) declarar que **solo se congela el lado de lectura** y que `alimentar` es interno del área D.<br>Recomiendo **(b)**: el contrato entre E y D son las *signals*, no cómo se llenan. |
| A3 | Media | **El snapshot de ejemplo es de Deméter, con `modo: "vivo"`, y se carga solo al importar `api.ts`.** Cuando T-622 importe `api.ts` desde `/hermes/`, pasa esto:<br>- la página de Hermes trae datos de Deméter (D-W01), y la prueba de aislamiento no lo detecta porque busca rutas, no textos;<br>- cualquier página muestra "EN VIVO" con datos inventados. Si se despliega antes de T-631, el público vería un vuelo falso como real (R-W5). | Que `api.ts` arranque **vacío** (`cargando`) en producción. El ejemplo se carga solo en desarrollo (`import.meta.env.DEV`) o desde las pruebas, y con `modo: "sintetico"`, para que salga el banner de simulación. |
| A4 | Baja | **El borde de 5 s.** "A partir de `WEB_SIN_SENAL_S`" debería dar `sin_senal` con edad ≥ 5 s, pero el código da `senal_debil` hasta 5 s incluido. Con `WEB_DATO_VIEJO_S` sí usa "a partir de". | `edad < WEB_SIN_SENAL_S` → señal débil, y `≥` → sin señal. Con una prueba en el borde exacto. |

## B. Las 11 preguntas del agente sobre 05 y C-05

| # | Pregunta | Recomendación |
| --- | --- | --- |
| 1 | 05 dice que "un campo nunca se omite", pero no marca cuáles pueden ser `null` | Aceptar la lista del agente (`pos`, `pos.alt_msl_m`, `utc_ms`, `relay_utc_ms`, `bat_pct`, `secundario`, cada `calc.*`, `enlace.*`, `lkp`, y en `salud` los sensores y contadores) y **escribirla en 05** con una columna "¿`null`?". Así el back la genera igual. |
| 2 | `estacion.ultimo_paquete_hace_ms` y `estacion.pos` en `null` | Sí: `null` si todavía no llega ningún paquete, y `null` sin GNSS. Se escribe en 05. |
| 3 | `evento.fase` y `evento.activa` son opcionales según el tipo de evento | **Siempre presentes, con `null` cuando no aplican.** Así se cumple "nunca se omite" y el generador queda más simple. |
| 4 | `additionalProperties: false` | **Mantenerlo.** El esquema es la prueba de los productores (T-612, el servicio de tierra y la ingesta del relay). La web no valida en tiempo de ejecución, así que un campo nuevo no la rompe. Un campo opcional nuevo se agrega en el mismo PR al esquema, a los tipos y a 05. |
| 5 | Snapshot: `meta` es obligatorio y lo demás puede ser `null` | Aceptar. |
| 6 | Las columnas de la `serie` deben tener el mismo largo, y `WEB_SERIE_MAX_PUNTOS` | Aceptar que el esquema no lo exprese. Se agrega una **función de validación extra** en las pruebas: mismo largo en las 8 columnas y como máximo `WEB_SERIE_MAX_PUNTOS`. La usan T-612 y las pruebas del back. |
| 7 | `mision` ↔ `nodo` y `fase` ↔ `fase_cod` no se cruzan | Lo mismo: se cruzan en esa función extra. |
| 8 | `estadoPagina` como un estado principal más avisos | Aceptar el modelo, **con las correcciones A1 y A4**. Además, el "10 s más" del banner de alarma (03 §4) necesita una constante: **`WEB_ALARMA_SOSTENER_S = 10`** en `constantes.md` §9, porque el "definido como hecho" (06 §6) prohíbe números sueltos. `simulacion = modo ≠ "vivo"`: aceptar. |
| 9 | El reloj de `edad` es local y monotónico, inyectado | Aceptar. |
| 10 | C-05 usa `id: <seq>` y 05 usa `id: <seq_relay>`; `relay_utc_ms` en el servicio local | Escribir en 05 y en C-05: **"`id` es un contador monotónico del que emite el SSE"** (`seq_relay` en el relay, `seq` en el servicio local). La web lo trata como opaco (`Last-Event-ID`). En local, `relay_utc_ms` es `null`. |
| 11 | El latido de `estacion` es de la estación, pero el stream es por misión | Sin cambio: cada stream de misión lleva una copia del mismo latido, sin campo de misión. Se aclara en C-05 §1. |

## C. Qué pasa después de H0
1. Las correcciones A1 a A4 (o A1, A3 y A4 si se elige A2-b) van en el mismo PR #7, con el agente `desarrollador`.
2. El documentador pasa a 05, 03, C-05 y `constantes.md` lo que se haya aprobado. **No se toca el contrato desde el código.**
3. Los dos aprueban el PR #7 en GitHub, se integra y se marca T-611 como hecha. Desde ahí, `web-1` queda congelado.
4. T-612 (Jerónimo) valida sus 12 JSONL con el esquema. La prueba de T-611 los toma de `gui/web/dev/datos/`. **Conviene que T-612 escriba ahí.**

## D. Propuestas posteriores al congelamiento (T-630, T-631 y T-632)

> **Estado: abierta** (2026-10-25). Las recogen las consolidaciones de [T-630](../07_bitacora/2026-10-25_sesion_consolidacion_T-630.md) y de [T-631](../07_bitacora/2026-10-25_sesion_consolidacion_T-631.md), y la [revisión de T-632](../07_bitacora/2026-10-25_revision_T-632.md). `web-1` está congelado: **solo entran campos opcionales o aclaraciones de texto** (R-W8). Ninguna obliga a cambiar el cliente de T-631, salvo D5 y D9 si se eligen las opciones que lo dicen.

| # | Bloquea | Propuesta | Recomendación |
| --- | --- | --- | --- |
| D1 | T-640 | **Cursor del snapshot.** T-631 une el snapshot y el stream sin cursor: abre primero el stream, guarda en un búfer y reproduce lo posterior al snapshot. La ventana de error es cero si el snapshot se genera en la petición. Si el relay lo cachea 1 s (04 §4), un `evento` de ese segundo puede no verse hasta el siguiente snapshot. Opciones:<br>(a) campo opcional `seq_relay` en el snapshot;<br>(b) que el relay de T-640 sirva el snapshot sin caché de tiempo. | **(b)**, sin cambio de contrato. El relay ya tiene el snapshot en memoria: basta con invalidar su JSON serializado con cada mensaje nuevo (a 9 Hz es barato). Se escribe en 04 §4 que "cacheable 1 s" pasa a "se regenera con cada mensaje". Si T-643 muestra que no aguanta, se agrega (a), que es compatible |
| D2 | — | **El `meta` de bienvenida va sin `id`**, para no mover `Last-Event-ID`. | Aceptar y escribir la excepción en 05 §1. El repetidor y el cliente ya lo hacen |
| D3 | T-640 | **CORS del relay real**, si la web y el API están en orígenes distintos: permitir el encabezado `Last-Event-ID` y exponer `Retry-After` y `Age`. Sin eso, el navegador no deja leerlos. | Aceptar y escribirlo en 04 §4 |
| D4 | — | **Se deja de recibir el latido de la estación** con el stream vivo. Hoy la página dice "señal débil" y "sin señal", como si el problema fuera el cohete. La causa probable es el relay o la estación. | **Decide el área E** en 03 §4. Sugerencia: si el stream sigue vivo (llegan los `: ping` de `WEB_SSE_LATIDO_S`) pero no llega un latido `estacion` en `WEB_LATIDO_PERDIDO_S` (constante nueva en `constantes.md` §9, por ejemplo 5 (P): cinco latidos de 1 Hz), mostrar el aviso de servidor y no el de LKP. Mientras tanto, se queda como está |
| D5 | **T-633** | **`serie.t_mas_s` antes del despegue.** El cliente pone `null` hasta el despegue. El snapshot del repetidor, después del despegue, pone negativos en los puntos de la espera. Al recargar, la serie cambia de forma. | Una sola regla en 05 §3: **`null` mientras no haya despegue; después, todos los puntos relativos al despegue** (negativos en la espera). El cliente debe recalcular los puntos anteriores cuando llegue el despegue: es un `fix/T-631-*` pequeño, y C-05 hace lo mismo |
| D6 | **T-633** | **Backfill completo** (propuesta 3 de T-630). Con `backfill.completo: true`, el snapshot trae la serie con huecos y `vuelo_completo_url: null`. | Elegir: un segundo JSONL de T-612 con la serie completa, o que el repetidor la tome de `{mision}_nominal.jsonl`. Recomiendo **lo segundo** (sin datos nuevos que mantener) |
| D7 | T-640 | **Forma de `/api/v1/salud`.** | Fijar en 04 §4 lo mínimo: `{"estado": "ok"}`. Lo demás es libre y la web no lo lee |
| D8 | — | **15 parámetros `(P)` del cliente** en `src/datos/parametros.ts`: retroceso, silencio, timeouts, búfer, reloj e interpolación. | Pasarlos a `constantes.md` §9 en un bloque "parámetros internos del cliente", con los mismos nombres y valores. Así se cumple que los números salgan de `constantes.md`. `INTERP_RETRASO_MS` ya está en 03 §5 |
| D9 | T-624, T-632 | **Posición interpolada.** La revisión de T-632 propuso una signal nueva en `api.ts`. T-631 la dejó como `interpolador.muestrear(performance.now())`, que se llama en el ciclo de dibujo. | **Mantener `muestrear`** sin signal nueva: una signal a 60 Hz haría que Preact vuelva a pintar toda la página en cada cuadro. El mapa y la actitud (T-634) la llaman en su `requestAnimationFrame`. Sin cambio de contrato |

**Informativa:** `Retry-After` en forma de fecha HTTP no se interpreta (se usa el retroceso base). Con segundos enteros, que es lo que mandan el repetidor y lo que debe mandar T-640, funciona.
