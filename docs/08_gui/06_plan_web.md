---
id: gui_plan
estado: propuesta
actualizado: 2026-10-25
depende_de: [gui_vision, gui_arquitectura, gui_contrato_datos, flujo_trabajo, plan_maestro]
---
# Plan de la web pública: fases, carriles y worktrees

## 1. La idea en una línea

**Dos carriles en paralelo desde el día 1, separados por dos contratos congelados en W0:** los tokens de diseño y el contrato de datos.
- El carril **A (Experiencia)** construye lo que se ve, con datos de ejemplo.
- El carril **B (Datos)** construye lo que trae y mueve los datos, con el repetidor.

Se encuentran en una interfaz única, `src/datos/api.ts`, y **no tocan las mismas carpetas**. El back se conecta al final (W3) cambiando una variable (D-W07).

| Carril | Persona propuesta | Es dueño de |
| --- | --- | --- |
| **A, Experiencia** | Juan Pablo | `gui/web/index.html`, `demeter/`, `hermes/`, `src/tema/`, `src/portada/`, `src/entradas/`, `src/mision/`, `src/contenido/`, `src/assets/`, `vite.config.ts` |
| **B, Datos** | Jerónimo | `src/datos/` (menos `api.ts`, que es compartido y congelado), `src/mapa/`, `src/graficas/`, `src/actitud/`, `public/mapas/`, `dev/`, `gui/relay/`, `tools/web_datos/` |
| **Compartido y congelado en W0** | Los dos, por decisión | `src/contrato/`, `src/datos/api.ts`, `package.json` (dependencias) |

> El reparto se puede invertir. Lo importante es que **cada carpeta tiene un solo dueño**.

## 2. Fases

```
          26 oct   27    28    29    30    31   1 nov   2     3     4 (12:00 congela)
W0 Cimientos ███████
W1 Paralelo         ████████████████
W2 Paralelo                           █████████████████
W3 Integración                                         ███████████
W4 Congelar                                                         ██
```

| Fase | Fechas | Objetivo | Hito de salida (criterio objetivo) |
| --- | --- | --- | --- |
| **W0, Cimientos** | 26–27 oct | Andamiaje, los dos contratos congelados y los datos de ejemplo | **HW0:** `npm run build` genera las 3 páginas · la prueba de aislamiento pasa · `api.ts` y `esquema.json` aprobados por los dos · existen los 6 escenarios JSONL de cada misión · los tokens están publicados |
| **W1, Paralelo 1** | 27–29 oct | A: portada, armazón de la misión, inicio y equipo. B: repetidor, cliente de datos y mapa. | **HW1:** la portada terminada en celular y portátil · las páginas de misión muestran la barra en vivo **desde el repetidor** · el mapa dibuja la trayectoria y el LKP |
| **W2, Paralelo 2** | 30 oct – 1 nov | A: secciones de vuelo, recuperación y salud. B: gráficas, actitud y relay. | **HW2:** todas las secciones M y S funcionan con los 6 escenarios · el relay sirve el repetidor por ingesta |
| **W3, Integración** | 1–3 nov | Conectar el back, desplegar, cargar y pulir para el celular | **HW3:** datos reales de una placa en la web pública · P-08 (Starlink) en verde · prueba de carga de 600 SSE en verde · Lighthouse móvil ≥ 90 |
| **W4, Congelamiento** | 4 nov, 12:00 | Etiqueta, junto con el resto ([plan_maestro](../05_plan/plan_maestro.md) §2) | Después solo entran correcciones con prueba y **contenido** (fotos y textos) hasta el 6 de noviembre |

**Regla de prioridad:** si el back (el mínimo para volar) se atrasa, **la web se pausa**, en este orden: primero las tareas S, luego las M. W3 depende del back. W0 a W2, no.

## 3. Tareas (T-610 a T-699)

**Columnas:**
- **Carril:** A, B o Ambos.
- **Pri:** M, S o C, como en el [backlog](../05_plan/backlog.md).
- **Leer:** siempre este plan y lo que diga la fila, con rutas relativas a `docs/`.

### W0: Cimientos

| ID | Tarea | Carril | Pri | Depende de | Leer | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- | --- |
| T-610 | **Andamiaje de `gui/web/`:**<br>- Vite multipágina (`/`, `/demeter/` y `/hermes/`), TS, Preact y signals, Biome, Vitest y Playwright.<br>- **Instalar de una vez todas las dependencias del stack** (04 §2).<br>- El proxy `/api` → `localhost:8787` para el repetidor.<br>- La prueba de aislamiento del `dist/`.<br>- La prueba de humo a 390×844 y 1440×900. | A | M | — | 08_gui/04 §2–3, §6 | `npm run build`, `npm test` y `npm run e2e` pasan. La prueba de aislamiento falla si `/demeter/` referencia algo de Hermes, y al revés (comprobado con un caso falso). |
| T-611 | **Contratos en código:**<br>- `src/contrato/tipos.ts` y `esquema.json` (05 completo).<br>- `src/datos/api.ts`: las *signals* públicas que consume el carril A (estado, salud, estación, eventos, serie, `estadoPagina` y `edad`), **alimentadas por un snapshot de ejemplo estático**.<br>- Un validador en las pruebas. | B | M | T-610 | 08_gui/05, 08_gui/03 §4 | Los tipos compilan; el esquema valida los JSONL de T-612; `api.ts` se puede importar y muestra datos de ejemplo. **Los dos lo aprueban en el PR: queda congelado.** |
| T-612 | **Generador de datos (`tools/web_datos/`, Python):** OpenRocket CSV → JSONL del contrato. Deméter desde la simulación real; Hermes sintético (G80, marcado). Los 6 escenarios de 05 §5. | B | M | — (paralelo a T-610) | 08_gui/05, 02_requisitos/perfiles_vuelo, datos/README | El apogeo de Deméter en el JSONL difiere < 1 m de la simulación (669 m) y los eventos < 0,1 s; los 12 archivos validan contra el esquema (cuando esté T-611) |
| T-613 | **Tema y tokens:**<br>- `tema/comun.css`, `demeter.css` y `hermes.css`, exactamente los de 02 §6.<br>- Las fuentes autohospedadas (WOFF2 con subconjunto latino).<br>- La página de desarrollo `dev/tokens.html`, con todos los tokens y estados en los dos temas. | A | M | T-610 | 08_gui/02 | La página de tokens se ve bien en los dos temas; ningún componente posterior usa colores sueltos (regla de Biome o grep en las pruebas) |

### W1: Paralelo 1

| ID | Tarea | Carril | Pri | Depende de | Leer | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- | --- |
| T-620 | **Portada**, según 03 §1: dos mitades, hover y foco que hacen crecer el parche, enlaces, cabecera EIA, versiones vertical y horizontal, sin JS | A | M | T-613 (fondos provisionales hasta T-621) | 08_gui/03 §1, 02 §7 | Capturas a 390×844, 844×390 y 1440×900 · < 500 KB · LCP < 2 s (Lighthouse móvil) · se navega con el teclado |
| T-621 | **Assets de marca:**<br>- generar y elegir los fondos de la portada (07 §2);<br>- exportar los parches y el logo en AVIF y WebP, a 256, 512 y 1024 px;<br>- placeholders de las fotos. | A (**el diseñador, Claude principal, con el usuario:** no es código) | M | PEN-W08 | 08_gui/07 | Los originales en `src/assets/{comun,demeter,hermes}/`; el build los exporta dentro del presupuesto de peso. Los fondos, aprobados por el usuario. |
| T-622 | **Armazón de la misión:**<br>- `entradas/demeter.tsx` y `hermes.tsx`;<br>- la barra de misión (consume `api.ts`);<br>- la navegación inferior y el layout responsive (03 §2);<br>- las secciones **Inicio** (carrusel y chips de partes), **Equipo** y **Pie**. | A | M | T-611, T-613 | 08_gui/03 §2–3.1, §3.10–3.11 | Con los datos de ejemplo, las dos páginas se ven con su tema en los 3 puntos de quiebre; la prueba de aislamiento sigue en verde |
| T-623 | **Contenido provisional:** `contenido/demeter.ts` y `hermes.ts` (lemas, misión, motor desde las constantes, partes del cohete, integrantes por apellido) | A | M | T-622 | 08_gui/01, 03 §3.1 | Textos en español revisados por el usuario; marcados como provisionales hasta PEN-W02 y PEN-W03 |
| T-630 | **Repetidor de desarrollo** (`dev/repetidor/`, Node, sin dependencias nuevas): sirve `snapshot` y `stream` desde un JSONL, en tiempo real y en bucle; elige el escenario por parámetro | B | M | T-612 | 08_gui/04 §7, 05 §1 | `npm run repetidor -- demeter nominal` sirve en `:8787`; `curl` muestra el SSE con ids crecientes; `Last-Event-ID` reanuda |
| T-631 | **Cliente de datos** (`src/datos/`): snapshot, SSE con reconexión y retroceso, aplicar los mensajes a las signals de `api.ts`, la edad del dato, `estadoPagina` (03 §4) e interpolación (posición lineal y *slerp* del cuaternión) | B | M | T-611, T-630 | 08_gui/03 §4–5, 05 §4 | Pruebas de Vitest con los 6 escenarios: los estados de la página cambian en los tiempos de los umbrales `WEB_*`; la reconexión no duplica mensajes |
| T-632 | **Mapa** (`src/mapa/`):<br>- MapLibre diferido;<br>- PMTiles de la zona (procedimiento documentado en el README del módulo);<br>- un estilo por tema;<br>- capas de rampa, estación, trayectoria, cohete, elipse, línea a la estación y LKP;<br>- controles;<br>- gestos seguros en el celular (03 §3.4). | B | M | T-611 | 08_gui/03 §3.4, 04 §2 | Con `lkp_descenso`, el LKP queda en rojo y nunca desaparece; en el celular, la página se desplaza sin quedar atrapada; el PMTiles pesa < 30 MB y el mapa carga solo al llegar a la sección |

### W2: Paralelo 2

| ID | Tarea | Carril | Pri | Depende de | Leer | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- | --- |
| T-624 | **Estado de la misión, Telemetría y banner de alarma** (03 §3.2, §3.3 y §4) | A | M | T-622, T-631 | 08_gui/03, 02 §9 | Con `nominal`: la línea de fases y los objetivos se encienden en orden con su T+. Con `descenso_rapido`: sale el banner. Los números son tabulares, con coma decimal. |
| T-625 | **Recuperación** (coordenadas, Google Maps, QR y vector) y **Salud del cohete** (resumen, Go/No-Go y detalle) (03 §3.5 y §3.8) | A | M (Recuperación) / S (Salud) | T-622, T-631 | 08_gui/03, 05 §2.3 | El QR abre la URL correcta en un celular real; con fallas simuladas, el resumen y el detalle cambian |
| T-626 | **Los ojos de Deméter** (03 §3.9), solo en `/demeter/` | A | S | T-622, T-631 | 08_gui/03 §3.9, 04_diseno/visionpack_integracion | Se ve en Deméter; la prueba de aislamiento confirma que no está en Hermes |
| T-633 | **Gráficas** con uPlot: altitud, Vz y aceleración; marcas de eventos; barra de backfill y reemplazo (03 §3.7) | B | S | T-631 | 08_gui/03 §3.7 | Con `backfill`, la barra avanza y la gráfica se reemplaza; 60 fps en un celular de gama media durante el vuelo repetido |
| T-634 | **Actitud 2D:** horizonte y brújula desde el cuaternión (03 §3.6) | B | S | T-631 | 08_gui/03 §3.6, 04_diseno/protocolo_paquetes §8 | Pruebas con cuaterniones conocidos (0°, 90° de pitch y 45° de roll) dan los ángulos correctos ± 0,5° |
| T-640 | **Relay público** (`gui/relay/`, FastAPI): ingesta con token, snapshot, SSE, baja a 1 Hz en tierra y persistencia en JSONL (04 §4). Se prueba **alimentándolo con el repetidor**: sin el back. | B | S (M si hay web en vivo) | T-611, T-630 | 08_gui/04 §4–5, 05 | La web apuntada al relay se comporta igual que con el repetidor; una petición sin token da 401; no existe ninguna ruta de escritura pública |

### W3: Integración

| ID | Tarea | Carril | Pri | Depende de | Leer | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- | --- |
| T-641 | **Conectar con el back:** el reenviador de la estación (T-605a, back) postea el contrato al relay | Ambos | S | T-640, **T-602**, **T-605a** | 08_gui/05, 04_diseno/estacion_terrena | Una placa real en el banco aparece en la web pública con < 2 s de retraso |
| T-642 | **Despliegue:** CDN estático, relay con TLS, dominio, variables de entorno y PMTiles en el CDN (PEN-W05) | Ambos | S | T-640 | 08_gui/04 §9 | URL pública funcionando; el SSE no queda en búfer (los mensajes llegan uno a uno) |
| T-643 | **Prueba de carga:** 600 clientes SSE durante 5 min con un vuelo repetido | B | S | T-642 | 08_gui/04 §5 | p95 de la latencia del relay < 1 s; el relay sin errores; se registra la CPU y la memoria |
| T-644 | **Pulido para el celular:** Lighthouse, accesibilidad, un Android barato y un iPhone reales, legibilidad al sol | A | S | T-624, T-625 | 08_gui/02 §10, 04 §6 | Lighthouse móvil ≥ 90 en rendimiento y en accesibilidad en las 3 páginas; las capturas en la bitácora |
| T-645 | **Guía de operación de la web el día del vuelo:** encender el relay, comprobar el stream, pasar de simulación a vivo, el QR impreso del evento y qué hacer si se cae | Ambos | S | T-642 | 08_gui/03 §4, 04 | Ensayada en P-08 |
| — | **P-08** (ya existe en el [plan de pruebas](../05_plan/plan_pruebas.md)): de punta a punta por Starlink | Ambos | S | T-641, T-642 | | En verde antes del 4 de noviembre |

### Could (solo si W2 termina antes; si no, después del evento)

| ID | Tarea | Notas |
| --- | --- | --- |
| T-650 | El cohete en 3D en el Inicio, con partes que se pueden tocar | [08_modelo_3d_futuro](08_modelo_3d_futuro.md). Necesita el archivo de OpenRocket o el CAD. |
| T-651 | Actitud 3D con el mismo modelo | Reemplaza a T-634 en el portátil |
| T-652 | Trayectoria 3D con la predicción de la parábola (GS-09) | |
| T-653 | Gráficas personalizables (GS-11) | |
| T-654 | Repetición del vuelo después del evento (la web como portafolio) | El usuario: "se mira después" |

## 4. Dependencias

```
T-610 ─┬─► T-611 ─┬─► T-622 ─┬─► T-623
       │          │          ├─► T-624 ◄─┐
       └─► T-613 ─┴─► T-620  ├─► T-625 ◄─┤
                             └─► T-626 ◄─┤
T-612 ─► T-630 ─► T-631 ─────────────────┴─► T-633, T-634
            │       ▲
            │     T-611
            └─► T-640 ─► T-641 (+ T-602, T-605a del back) ─► T-642 ─► T-643, T-645, P-08
T-611 ─► T-632                                     T-624, T-625 ─► T-644
```

**Lo que se puede hacer al mismo tiempo, el primer día:** T-610 (A) y T-612 (B).
**Después de HW0:**
- A puede llevar a la vez T-620 y T-622 (portada y misión no comparten carpetas);
- B puede llevar a la vez T-630→T-631 y T-632.

## 5. Worktrees y ramas (según [flujo_trabajo](../05_plan/flujo_trabajo.md))

- **Una tarea = una rama `feature/T-6xx-<slug>` desde `develop` = un worktree.** El agente `desarrollador` crea el suyo (`isolation: worktree`).
  - Un humano lo hace con: `git worktree add ../hermes-wt/T-620 -b feature/T-620-portada develop`.
- **Cada persona puede tener varias tareas en curso a la vez**, siempre que estén en **su carril** y **no compartan carpetas**. Por ejemplo, A con T-620 y T-622; B con T-631 y T-632.
- **Archivos que nunca se tocan sin acuerdo:**
  - `src/contrato/`, `src/datos/api.ts` y los tokens de `src/tema/` (contratos, D-W);
  - `package.json`: si hace falta una dependencia nueva, va en un PR pequeño `build(web): agregar <dep> [T-6xx]` que se integra primero.
- **Integración:** un PR a `develop` con revisión de la otra persona (así cada uno conoce el carril del otro). Se hace `--no-ff`.
- **Al cerrar cada fase:** sobre `develop` se corren el humo de Playwright y la prueba de aislamiento. El diseñador revisa las capturas contra 02 y 03 y anota en la bitácora.

## 6. "Definido como hecho" para la web (además de [flujo_trabajo](../05_plan/flujo_trabajo.md) §5)

- [ ] `npm run build`, `npm test` y `npm run e2e` en verde.
- [ ] **La prueba de aislamiento** en verde (D-W01).
- [ ] Sin colores, tamaños ni duraciones sueltas: solo tokens.
- [ ] Capturas a 390×844 y 1440×900 en la entrada de bitácora (si la tarea es visual).
- [ ] Todo texto visible en español, con coma decimal y las unidades de 02 §5.
- [ ] Ningún número mágico: los umbrales `WEB_*` vienen de un solo archivo de constantes de la web que replica [constantes](../02_requisitos/constantes.md).
- [ ] No agrega ninguna ruta, botón ni mensaje que vaya hacia un cohete (GS-14).

## 7. Antes de lanzar el primer agente (lo hace el documentador)

1. Aprobar esta carpeta (los dos) y cerrar PEN-W06 y PEN-W07.
2. **Consolidar:** agregar la épica **E10, Web pública** a [backlog.md](../05_plan/backlog.md), con T-610…T-654 apuntando a este archivo. El agente `desarrollador` **solo acepta tareas que estén en el backlog** (su §0.2). También pasar D-W a `decisiones.md`, PEN-W a `pendientes.md` y los riesgos de §8 a `riesgos.md`.
3. Dividir T-605 en T-605a (reenviador, back) y T-640 (relay, web).
4. Agregar las constantes `WEB_*` a [constantes.md](../02_requisitos/constantes.md).

Para lanzar una tarea: *"Implementa T-6xx. El plan está en `docs/08_gui/06_plan_web.md`."*

## 8. Riesgos de la web

| ID | Riesgo | Prob. | Impacto | Mitigación |
| --- | --- | --- | --- | --- |
| R-W1 | Las mismas dos personas llevan el back crítico y la web | Alta | Alto | Los agentes hacen el código y los humanos revisan; la web se pausa si el back se atrasa (§2); primero las tareas M |
| R-W2 | Mala red móvil en Santa Fe de Antioquia para el público | Media | Medio | La página es útil sin el mapa; presupuestos de peso (04 §6); 1 Hz en tierra |
| R-W3 | Starlink o el relay caen en pleno vuelo | Media | Medio | El dashboard local no depende de internet; la web muestra "Reconectando" y el backfill rellena después |
| R-W4 | No llegan las fotos ni los nombres a tiempo | Media | Bajo | Placeholders dignos (parche y fondo) y contenido modificable hasta el 6 de noviembre |
| R-W5 | Se confunde la simulación con el vuelo real | Baja | Alto | Banner "SIMULACIÓN" fijo y modo marcado en `meta.modo` (03 §4) |
| R-W6 | La cuota gratuita de Hugging Face no alcanza para generar los fondos | Media | Bajo | Generar pronto (T-621 en W1); alternativa: fotos con licencia libre y el mismo tratamiento |
