---
fecha: 2026-10-26
tipo: tarea
ids: [T-624, T-631, D-W17, D-W18, GS-03, GS-13, PEN-W06]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-624-estado-telemetria-alarma
---
# T-624: Estado de la misión, Telemetría y banner de alarma

## Contexto
Área E, prioridad M. Dependía de T-622 y T-631 (integradas; base `origin/develop` en `1ec4e1b`). Llena los huecos `estado` y `telemetria`, agrega el banner de alarma de descenso y **conecta el cliente de datos** a las páginas, que hasta hoy leían solo el ejemplo de desarrollo. PR #30 (borrador al empezar). Búsqueda: se consultó el grafo de graphify de la carpeta principal; el resto se leyó directo de los archivos que la tarea nombra.

## Qué se hizo

**Cliente conectado** (`src/mision/arranque.ts`, usado por `entradas/demeter.tsx` y `hermes.tsx`):
- `arrancarDatos(mision)` llama a `iniciarCliente({ mision })`.
- En producción **siempre** arranca. En desarrollo no arranca con `?ejemplo` (escribe en las mismas signals) ni con `?sin_cliente`, un interruptor nuevo solo de desarrollo para las pruebas e2e que inyectan su propio snapshot (T-632 y T-634; ver "Problemas").

**Lógica pura** (todo probado sin navegador):
- `linea_fases.ts`: Rampa → Despegue → Inercia → Apogeo → Paracaídas → En tierra; "Cayendo" (FREE_FALL) solo si ocurre (un evento `fase` con FREE_FALL, o la fase actual). Cada paso es `hecho`, `actual` o `pendiente` y lleva el T+ de su evento. Es correcta al abrir la página a mitad de vuelo (sin eventos usa la fase actual y no inventa horas). `fases.ts` gana `SUBTITULO_FASE` (02 §9) y `RANGO_FASE`.
- `objetivos.ts`: despegue, fin de la combustión, eyección, apogeo (con su altura), aterrizaje y, solo en Deméter, cámaras grabando. Se encienden por el evento **o** por el estado (`fase`, `flags.eyeccion`, `flags.apogeo`, `act.cam_ok`).
- `vista_telemetria.ts`: qué se ve en cada celda, la flecha vertical (`0,0` no tiene flecha), el dato viejo (`datoViejo`: edad ≥ `WEB_DATO_VIEJO_S`) y el apogeo fijo (del evento; si falta, de `salud.apogeo_m` cuando `flags.apogeo` ya está).
- `alarma.ts`: `SostenedorAlarma`. Al activarse se ve de inmediato; al apagarse sigue `WEB_ALARMA_SOSTENER_S` (10 s) más; si vuelve antes, el plazo se cancela. Temporizador local inyectable, nunca el reloj de pared (05 §0). La web **no recalcula** la alarma: solo lee `estado.alarmas.descenso_rapido`.

**UI** (solo tokens de `src/tema/`; estilos en `src/mision/estado.css`):
- `EstadoMision.tsx`: T+ transcurrido (el mismo cálculo de la barra, con el reloj del cohete), fase actual con su título y subtítulo, línea de fases vertical, y tarjetas de objetivos. Cada estado lleva ícono y palabra (`Logrado` / `Pendiente`, `ahora` / `pendiente`), nunca solo color. Íconos de `lucide-preact` (D-W17).
- `Telemetria.tsx`: cuadrícula de 03 §3.3 (altitud grande a dos columnas; velocidad vertical con flecha; velocidad total; apogeo con 🏔 → ícono `Mountain` y su T+; aceleración X, Y, Z en g). Coma decimal, unidad al lado, números tabulares (los hereda del `body`). Con edad ≥ `WEB_DATO_VIEJO_S`: todos los números en `--estado-sin-dato` y arriba "Último dato hace N s" (una sola línea por sección, no una por celda). Con LKP (sin posición o sin señal) la altitud va en rojo con su pin y "última conocida", igual que la barra (GS-03). `salud.apogeo_m` solo se usa como respaldo.
- `BannerAlarma.tsx`: rojo (`--estado-alarma`, texto en `--fondo`), dentro de la cabecera fija justo bajo la barra de misión. Dice "Descenso rápido · 14,2 m/s". Al apagarse, "Descenso rápido · la alarma terminó" durante el plazo. Si el dato está viejo, agrega "última lectura hace N s". `role="status"` con `aria-live="polite"` (02 §10).
- `Pagina.tsx` monta los tres; `Hueco` queda para las otras secciones. Se quitó el `min-height` de `#estado` y `#telemetria`.
- `ejemplo_dev.ts`: variante `?ejemplo=descenso_rapido`.

**Botón "Ver la simulación del vuelo": NO se puso** (suposición del documentador, caso 2). El cliente no deja que el usuario elija la simulación: hoy la decide solo el servidor (`meta.modo`) y `iniciarCliente` no recibe un modo. Sin tocar `src/datos/` quedaba un botón muerto, así que la sección muestra el texto "La transmisión en vivo empieza el día del lanzamiento" y nada más. **Lo que le faltaría al área D:** una opción del cliente (por ejemplo `iniciarCliente({ mision, modo: "simulacion" })` o una `base` de simulación), un endpoint del relay que sirva la simulación (T-640) y una signal o función para que la UI pida el cambio. Va como pregunta abierta.

## Evidencia

**Pruebas** (Node v22.22.0, Windows 11):
- `npm run build`: en verde (`tsc --noEmit`, colores, `vite build`, `Aislamiento OK`, `Sin datos de ejemplo en el dist/ de producción`). Fuentes: `/demeter/` 62 808 B y `/hermes/` 67 268 B (< 81 920).
- `npm test`: **16 archivos, 327 pasan, 1 saltada** (preexistente). Nuevas: 30 (`estado_mision.test.ts` 27: línea de fases, objetivos, telemetría, formato, sostener del banner con un programador falso; `arranque.test.ts` 3). Antes de esta tarea: 298.
- `npm run e2e`: **129 pasan, 14 saltadas y 1 falla**. La que falla es `mapa.spec.ts` "un dedo sobre el mapa desplaza la página" (la de gestos de T-632). **No es de esta tarea:** la corrí en un worktree temporal de `origin/develop` (`1ec4e1b`) con su propio `npm ci` y `npm run build`, y falla igual (ya la había reportado la [consolidación de T-631](2026-10-25_sesion_consolidacion_T-631.md)). Nuevas: 29 (25 en `estado_telemetria.spec.ts` y 4 en `en_vivo.spec.ts`).
- `npx biome check .`: sin errores; 3 advertencias que ya existían (`estado_pagina.ts` y 2 de `comun.css`).

**Qué cubre lo visible:**
- *Orden y T+ (inyectando snapshots reales de `dev/datos` y mirando la rampa, el despegue, la inercia, la eyección, el descenso y el aterrizaje, en las dos misiones)*: cada paso y cada objetivo cambia de estado en su momento, con el T+ de su evento (Deméter: apogeo T+ 00:11 y 669 m; Hermes: T+ 00:10 y 502 m).
- *En vivo*: con el repetidor a 20× y el `dist/` de producción por el proxy, un `MutationObserver` registra el orden en que se encienden los objetivos: `despegue, fin_combustion, eyeccion, apogeo, aterrizaje`, en las dos misiones, y sin errores de consola. Con `descenso_rapido` en vivo sale el banner.
- *Banner*: rojo, dentro de la cabecera fija, justo bajo la barra y no se mueve al desplazar; con el reloj del navegador detenido (`page.clock`): visible 9,9 s después de apagarse la alarma y desaparece a los 10,1 s; si vuelve a los 6 s no parpadea.
- *Telemetría*: los números coinciden con el snapshot (coma decimal, ningún punto, unidades, `tabular-nums`), el dato viejo pasa a `rgb(138, 143, 163)` con "Último dato hace 3 s" en el instante justo, y en "sin señal" la altitud queda en `rgb(255, 77, 94)` con su pin.
- *Sin transmisión*: el texto del día del lanzamiento, ningún botón de simulación y "sin dato" en las celdas.

**Capturas** (a página completa), en `docs/07_bitacora/capturas/T-624/`: `{demeter,hermes}-{nominal,descenso_rapido,sin_transmision}-{390x844,1440x900}.png` (12). `nominal` se tomó a los 40 s del escenario (descenso con paracaídas: todos los objetivos encendidos menos el aterrizaje). Las de `docs/07_bitacora/capturas/T-622/` (`*-ejemplo-*` y `barra-*`) se regeneraron.

**Commits** (rama `feature/T-624-estado-telemetria-alarma`, sobre `1ec4e1b`): `e168e07` cliente conectado y pruebas e2e; `55c68c6` lógica pura; `bd3552b` secciones y banner; `1836080` clase y `hookTimeout`; `df45e64` capturas.

## Problemas y cómo se resolvieron
- **Conectar el cliente rompe las pruebas e2e que no tienen servidor.** En producción la página ahora pide `/api/...` y el proxy de `vite preview` apunta a un puerto sin nadie. Dos casos:
  - Las pruebas de producción "sin datos" (humo, barra en "Cargando", `?ejemplo` sin efecto, chips, carga diferida del mapa) usan `apiColgada` (`e2e/api_colgada.ts`): la petición queda sin respuesta ni error, así que la página sigue en "Cargando" sin ruido en la consola.
  - Las que inyectan un snapshot en el servidor de desarrollo (`actitud`, `mapa`, `mapa_limites`: 22 `goto`) ahora abren con `?sin_cliente`. Sin eso el cliente fallaba, ponía "reconectando" y su reloj de 100 ms pisaba `moverReloj`.
  - `networkidle` nunca llega con una petición colgada o un SSE abierto, así que en dos pruebas se reemplazó por `esperarPintado` (dos cuadros de animación).
- **Choque de mayúsculas.** Mi módulo `telemetria.ts` y `Telemetria.tsx` solo se diferencian en la mayúscula: TypeScript lo rechaza (TS1149) y rompería Windows y macOS. El de lógica se llama `vista_telemetria.ts`.
- **Clase repetida.** `.antiguedad` ya era de la barra; mi nota del LKP pasó a `.altitud-nota`. Lo encontró la e2e de la barra de T-622.
- **El `beforeAll` de la prueba de aislamiento se pasaba de 10 s** (el build real tarda ~12 s por el plugin de imágenes) y fallaba al correr con las demás. `hookTimeout: 60_000` en `vite.config.ts`, igual que `testTimeout`.
- **`numero(-0.04, 1)` daba `−0,0`.** Ahora un valor que redondea a cero no lleva signo.
- `npm run e2e` vuelve a modificar las capturas de T-621, T-632 y otras (cambian bytes aunque la imagen sea la misma). Las revertí con `git checkout`; solo van las de T-622 (pedidas) y T-624.
- Las pruebas de `page.clock` necesitan `pauseAt`: sin él el reloj falso sigue al real y el plazo de 10 s vencía antes de tiempo.

## Decisiones tomadas o propuestas
Ningún contrato cambió.

1. **Botón de la simulación** (arriba): el área D necesita ofrecer cómo elegirla; hasta entonces, solo el texto. Pregunta abierta para H0.
2. **Fuera del alcance y sin hacer** (propuestas): el tiempo estimado a la siguiente fase y el tiempo de vuelo restante (GS-13, prioridad S): el contrato ya trae `calc.t_siguiente_fase_s`, `calc.siguiente_fase` y `calc.t_restante_s`, y cabrían en la sección con la etiqueta "estimado". El objetivo "motor caracterizado": no hay fuente de datos.
3. **Interruptor `?sin_cliente`** (solo desarrollo: en el `dist/` el texto sigue dentro de `debeIniciarCliente`, que en producción devuelve `true` sin mirar la URL; lo prueba `arranque.test.ts`): propongo registrarlo junto a `?ejemplo` en la documentación de desarrollo. También propongo que `?ejemplo` documentado en T-622 diga que ya no arranca el cliente.
4. **Desajuste entre el generador y 05 §2.5.** Los escenarios de `dev/datos` traen `activa: true` en los eventos `camaras`, y 05 §2.5 dice que `activa` solo aplica en `alarma_descenso` y es `null` en los demás tipos. Esta tarea no usa ese campo (las cámaras salen de `act.cam_ok`), pero el generador (T-612) o el contrato deben coincidir antes de que lo use alguien.
5. **Los tamaños de texto `--t-*`** de `mision.css` (propuesta de T-622) siguen sin ser tokens; esta tarea los reutiliza. Conviene promoverlos a `tema/comun.css`.
6. **Un solo aviso de edad por sección** ("Último dato hace N s") en vez de uno por celda. Si se prefiere por celda, es un cambio de CSS y de marcado.
7. **Frecuencia de repintado:** `estado` llega a ~9 Hz en vuelo (< 10 Hz de 03 §5), así que no se agregó un limitador propio. Si el relay alguna vez manda más rápido, hay que limitarlo en la UI.
8. **Banner con `role="status"`** (polite) por 02 §10 ("`aria-live="polite"` solo para los cambios de fase y las alarmas"). Si se quiere que interrumpa al lector de pantalla, es `role="alert"`: decisión de accesibilidad.

## Pendiente / siguiente paso
- Revisión y merge del PR #30 (lo hace un humano). Después `graphify update .` en la carpeta principal.
- `fix/T-632-*` para la prueba de gestos que falla en `develop` (sin relación con esta tarea).
- Sin probar: Safari, iOS, Firefox y un celular real (solo Chromium en e2e); el relay real (T-640); lectura con un lector de pantalla; el contraste del banner rojo medido con una herramienta (el texto `--fondo` sobre `--estado-alarma` se calculó a mano, 5,45:1 sobre el fondo de Deméter y 5,66:1 sobre el de Hermes, con la fórmula de WCAG en una línea de Node; no se probó con una herramienta externa).
- El estado activo del enlace de la navegación y T-625 (Recuperación y Salud) siguen de otras tareas.

## Documentos afectados
- Ninguno de los contratos. Para consolidar: `docs/05_plan/backlog.md` (T-624 en revisión, PR #30), `docs/08_gui/06_plan_web.md` (T-624), `docs/07_bitacora/README.md`, y las propuestas 1 a 4 de arriba.

## Ajuste tras la revisión del PR #30: e2e intermitentes
- **Reporte:** `mision.spec.ts:92` ("navegación por anclas") falló en 2 de 2 en una corrida completa y pasó en la siguiente. Hipótesis: la barra pasa a "Reconectando…", crece el alto de `.cabecera-mision` y el chequeo `sec.top >= cab.bottom - 1` falla.
- **La hipótesis del alto se descarta.** Medido con el cliente fallando (sin servidor): la cabecera mide 100,5 px a 390 y 94 px a 1440, igual al principio y 3 s después, y el `scroll-margin-top` es de 144 px. Nunca se acerca.
- **No pude reproducir la falla** del test de anclas: `--repeat-each=10` del describe (40 de 40) y una corrida completa con `--repeat-each=3` (la falla no apareció). Lo más probable, y es una **hipótesis sin confirmar**, es la carga: sin servidor el cliente reintenta cada 0,5 a 1 s y el proxy de `vite preview` registra un `ECONNREFUSED` por cada intento, en una máquina con 6 workers y MapLibre cargando al llegar a "Mapa"; el desplazamiento suave puede no terminar dentro de los 5 s del `poll`.
- **Arreglo:** esas pruebas no necesitan el cliente, así que usan `apiColgada` (la petición queda colgada, sin reintentos ni ruido). Se agregó a: el describe de anclas (`beforeEach`), los chips y el pie de `mision.spec.ts`, los chips con ícono de `chips_iconos.spec.ts` y el tema de `tokens.spec.ts`. Ninguna otra prueba abre una página de misión de producción sin `apiColgada`: las de desarrollo usan `?ejemplo` o `?sin_cliente`, y `en_vivo.spec.ts` quiere el servidor real.
- **Hallazgo propio, sí reproducido:** las dos pruebas del sostener del banner (`estado_telemetria.spec.ts`) fallaban con `clock.pauseAt: Cannot fast-forward to the past` (3 y 2 veces en la corrida con `--repeat-each=3`): tras `page.clock.install` el reloj falso sigue al real, y con la máquina cargada el margen de 1 s ya había pasado. El margen es ahora de 10 min (`MARGEN_PAUSA_MS`).
- **Lo que no es de esta tarea y sigue igual:** la e2e de gestos de T-632 (falla también en `develop`) y, bajo mucha carga, los 5 s de `data-mapa-listo` de las capturas del mapa (`mapa.spec.ts:237`) y de `mapa_limites.spec.ts:386`. No subí ningún timeout.
- **Evidencia:** dos corridas completas de `npm run e2e` después del arreglo: **129 pasan, 14 saltadas y 1 falla** (la de gestos de T-632), las dos veces. Además, `mision`, `estado_telemetria`, `chips_iconos` y `tokens` con `--repeat-each=6`: 408 de 408. Las capturas que cambian sin un cambio real se revirtieron.
- Un error de proceso mío: lancé una corrida de diagnóstico mientras corría la completa y le cerré los servidores (un `ERR_CONNECTION_REFUSED` en `en_vivo.spec.ts`); ese resultado no cuenta.
