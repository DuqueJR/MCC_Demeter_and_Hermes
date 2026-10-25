---
id: gui_plan
estado: aprobado (PR #1, 2026-10-25). Alineado con el plan de dos sesiones del back.
actualizado: 2026-10-25
depende_de: [gui_vision, gui_arquitectura, gui_contrato_datos, flujo_trabajo, plan_maestro, dos_sesiones_plan_maestro, C-05]
---
# Plan de la web pública y de operación: fases, áreas y worktrees

## 1. La idea en una línea

**Dos áreas de trabajo en paralelo desde el día 1, separadas por dos contratos congelados en W0:** los tokens de diseño y el contrato de datos.
- El área **E (Experiencia)** construye lo que se ve, con datos de ejemplo.
- El área **D (Datos)** construye lo que trae y mueve los datos, con el repetidor.

Se encuentran en una interfaz única, `src/datos/api.ts`, y **no tocan las mismas carpetas**. El back se conecta al final (W3) cambiando una variable (D-W07).

> **Letras E y D, no A y B (D-W12).** Son áreas de carpetas, no personas (D-W16). El [plan de dos sesiones](../05_plan/dos_sesiones/00_LEEME.md) del back ya usa **A = Jerónimo** y **B = Juan Pablo**. Para no confundir, la web usa E y D.

| Área | Carpetas |
| --- | --- |
| **E, Experiencia** | `gui/web/index.html`, `demeter/`, `hermes/`, `operacion/`, `src/tema/`, `src/portada/`, `src/entradas/`, `src/mision/`, `src/operacion/`, `src/contenido/`, `src/assets/`, `vite.config.ts` |
| **D, Datos** | `src/datos/` (menos `api.ts`, que es compartido y congelado), `src/mapa/`, `src/graficas/`, `src/actitud/`, `public/mapas/`, `dev/`, `gui/relay/`, `tools/web_datos/` |
| **Compartido y congelado en W0** | `src/contrato/`, `src/datos/api.ts`, `package.json` (dependencias) |

**Cómo se reparte (D-W16, decidido por el usuario: "repártelo como sea mejor; lo importante es trabajar coordinados"):**
- **E y D son áreas de carpetas, no personas.** Cualquiera de los dos toma cualquier tarea.
- **Tomar una tarea:**
  1. Elige la siguiente tarea **lista** (sus dependencias están hechas) de mayor prioridad: primero el mínimo de operación (S+), luego M, luego S.
  2. **La toma creando su rama y un PR en borrador** (`gh pr create --draft`) con el ID en el título, y lo dice en la sincronización de la mañana.
  3. El PR en borrador es el "candado": **nadie toma una tarea que ya tiene PR abierto.**
- **Regla de no pisarse:** **dos tareas en curso nunca tocan la misma área a la vez**, salvo que estén en subcarpetas distintas (por ejemplo, `src/mapa/` y `src/graficas/` sí pueden ir en paralelo; dos tareas en `src/mision/` no).
- **Punto de partida sugerido** (para equilibrar la carga, no es fijo): Juan Pablo empieza por E y Jerónimo por D. Como Jerónimo también lleva la sesión A del back, **Juan Pablo toma tareas de D cuando E no tenga nada listo** (R-W7).
- **Qué está en curso:** la lista de PR en borrador (`gh pr list --draft`) es la verdad. El estado del backlog se consolida en las sincronizaciones de hito, como en el back.

**Relación con el plan del back** ([dos_sesiones](../05_plan/dos_sesiones/00_LEEME.md)):
- Su contrato C-01 marca `gui/`, `docs/08_gui/` y `tools/web_datos/` como **"otro plan: no se toca"**. Su hook `no_gui.py` lo hace cumplir **salvo en las sesiones web** (variable `SESION`, ver su [15](../05_plan/dos_sesiones/15_CLAUDE_md_propuesto.md) §3).
  → **Una sesión de Claude Code que trabaje en la web se abre con `SESION=web`.**
- **Su servicio de tierra produce `web-1`** (DP-17, [C-05](../05_plan/dos_sesiones/06_contratos/05_api_backend_tierra.md)), con las mismas rutas de lectura que nuestro relay. Para la web, el servicio local, el relay y el repetidor son **intercambiables cambiando la URL base**.
- **Carga de Jerónimo:** lleva la sesión A del back (enlace, tiempo, tierra y Pi) y tareas de la web. Si se atrasa, Juan Pablo toma las tareas de D que estén listas (R-W7).

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
| **W0, Cimientos** | 26–27 oct | Andamiaje, los dos contratos congelados y los datos de ejemplo | **HW0:** `npm run build` genera las 3 páginas · la prueba de aislamiento pasa · `api.ts` y `esquema.json` aprobados por los dos · existen los 6 escenarios JSONL de cada misión · los tokens están publicados · **`web-1` congelado en la sincronización H0 (26 oct, tarde), en la misma reunión que C-05** (las mismas dos personas, [08 del back](../05_plan/dos_sesiones/08_sincronizacion_y_merge.md) §1) |
| **W1, Paralelo 1** | 27–29 oct | E: portada, armazón de la misión, inicio y equipo. D: repetidor, cliente de datos y mapa. | **HW1:** la portada terminada en celular y portátil · las páginas de misión muestran la barra en vivo **desde el repetidor** · el mapa dibuja la trayectoria y el LKP |
| **W2, Paralelo 2** | 30 oct – 1 nov | E: secciones de vuelo, recuperación y salud. D: gráficas, actitud y relay. | **HW2:** todas las secciones M y S funcionan con los 6 escenarios · el relay sirve el repetidor por ingesta |
| **W3, Integración** | 1–3 nov | Conectar el back, desplegar, cargar y pulir para el celular | **HW3:** datos reales de una placa en la web pública · P-08 (Starlink) en verde · prueba de carga de 600 SSE en verde · Lighthouse móvil ≥ 90 |
| **W4, Congelamiento** | 4 nov, 12:00 | Etiqueta, junto con el resto ([plan_maestro](../05_plan/plan_maestro.md) §2) | Después solo entran correcciones con prueba y **contenido** (fotos y textos) hasta el 6 de noviembre |

**Regla de prioridad:** si el back (el mínimo para volar) se atrasa, **la web se pausa**, en este orden: primero las tareas S, luego las M. W3 depende del back. W0 a W2, no.

## 3. Tareas (T-610 a T-699)

**Columnas:**
- **Área:** E, D o Ambos (las carpetas que toca, no quién la hace).
- **Pri:** M, S o C, como en el [backlog](../05_plan/backlog.md).
- **Leer:** siempre este plan y lo que diga la fila, con rutas relativas a `docs/`.

### W0: Cimientos

| ID | Tarea | Área | Pri | Depende de | Leer | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- | --- |
| T-610 | **Andamiaje de `gui/web/`:**<br>- Vite multipágina (`/`, `/demeter/` y `/hermes/`), TS, Preact y signals, Biome, Vitest y Playwright.<br>- **Instalar de una vez todas las dependencias del stack** (04 §2).<br>- El proxy `/api` → `localhost:8787` para el repetidor.<br>- La prueba de aislamiento del `dist/`.<br>- La prueba de humo a 390×844 y 1440×900. | E | M | — | 08_gui/04 §2–3, §6 | `npm run build`, `npm test` y `npm run e2e` pasan. La prueba de aislamiento falla si `/demeter/` referencia algo de Hermes, y al revés (comprobado con un caso falso). |
| T-611 | **Contratos en código:**<br>- `src/contrato/tipos.ts` y `esquema.json` (05 completo).<br>- `src/datos/api.ts`: las *signals* públicas que consume el área E (estado, salud, estación, eventos, serie, `estadoPagina` y `edad`), **alimentadas por un snapshot de ejemplo estático**.<br>- Un validador en las pruebas. | D | M | T-610 | 08_gui/05, 08_gui/03 §4 | Los tipos compilan; el esquema valida los JSONL de T-612; `api.ts` se puede importar y muestra datos de ejemplo. **Los dos lo aprueban en el PR: queda congelado.** |
| T-612 | **Generador de datos (`tools/web_datos/`, Python):** OpenRocket CSV → JSONL del contrato. Deméter desde la simulación real; Hermes sintético (G80, marcado). Los 6 escenarios de 05 §5. | D | M | — (paralelo a T-610) | 08_gui/05, 02_requisitos/perfiles_vuelo, datos/README | El apogeo de Deméter en el JSONL difiere < 1 m de la simulación (669 m) y los eventos < 0,1 s; los 12 archivos validan contra el esquema (cuando esté T-611) |
| T-613 | **Tema y tokens:**<br>- `tema/comun.css`, `demeter.css` y `hermes.css`, exactamente los de 02 §6.<br>- Las fuentes autohospedadas (WOFF2 con subconjunto latino).<br>- La página de desarrollo `dev/tokens.html`, con todos los tokens y estados en los dos temas. | E | M | T-610 | 08_gui/02 | La página de tokens se ve bien en los dos temas; ningún componente posterior usa colores sueltos (regla de Biome o grep en las pruebas) |

### W1: Paralelo 1

| ID | Tarea | Área | Pri | Depende de | Leer | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- | --- |
| T-620 | **Portada**, según 03 §1: dos mitades, hover y foco que hacen crecer el parche, enlaces, cabecera EIA, versiones vertical y horizontal, sin JS | E | M | T-613 (fondos provisionales hasta T-621) | 08_gui/03 §1, 02 §7 | Capturas a 390×844, 844×390 y 1440×900 · < 500 KB · LCP < 2 s (Lighthouse móvil) · se navega con el teclado |
| T-621 | **Assets de marca:**<br>- generar y elegir los fondos de la portada (07 §2);<br>- exportar los parches y el logo en AVIF y WebP, a 256, 512 y 1024 px;<br>- placeholders de las fotos. | E (**el diseñador, Claude principal, con el usuario:** no es código) | M | PEN-W08 | 08_gui/07 | Los originales en `src/assets/{comun,demeter,hermes}/`; el build los exporta dentro del presupuesto de peso. Los fondos, aprobados por el usuario. |
| T-622 | **Armazón de la misión:**<br>- `entradas/demeter.tsx` y `hermes.tsx`;<br>- la barra de misión (consume `api.ts`);<br>- la navegación inferior y el layout responsive (03 §2);<br>- las secciones **Inicio** (carrusel y chips de partes), **Equipo** y **Pie**. | E | M | T-611, T-613 | 08_gui/03 §2–3.1, §3.10–3.11 | Con los datos de ejemplo, las dos páginas se ven con su tema en los 3 puntos de quiebre; la prueba de aislamiento sigue en verde |
| T-623 | **Contenido provisional:** `contenido/demeter.ts` y `hermes.ts` (lemas, misión, motor desde las constantes, partes del cohete, integrantes por apellido) | E | M | T-622 | 08_gui/01, 03 §3.1 | Textos en español revisados por el usuario; marcados como provisionales hasta PEN-W02 y PEN-W03 |
| T-630 | **Repetidor de desarrollo** (`dev/repetidor/`, Node, sin dependencias nuevas): sirve `snapshot` y `stream` desde un JSONL, en tiempo real y en bucle; elige el escenario por parámetro | D | M | T-612 | 08_gui/04 §7, 05 §1 | `npm run repetidor -- demeter nominal` sirve en `:8787`; `curl` muestra el SSE con ids crecientes; `Last-Event-ID` reanuda |
| T-631 | **Cliente de datos** (`src/datos/`): snapshot, SSE con reconexión y retroceso, aplicar los mensajes a las signals de `api.ts`, la edad del dato, `estadoPagina` (03 §4) e interpolación (posición lineal y *slerp* del cuaternión) | D | M | T-611, T-630 | 08_gui/03 §4–5, 05 §4 | Pruebas de Vitest con los 6 escenarios: los estados de la página cambian en los tiempos de los umbrales `WEB_*`; la reconexión no duplica mensajes |
| T-632 | **Mapa** (`src/mapa/`):<br>- MapLibre diferido;<br>- PMTiles de la zona (procedimiento documentado en el README del módulo);<br>- un estilo por tema;<br>- capas de rampa, estación, trayectoria, cohete, elipse, línea a la estación y LKP;<br>- controles;<br>- gestos seguros en el celular (03 §3.4). | D | M | T-611 | 08_gui/03 §3.4, 04 §2 | Con `lkp_descenso`, el LKP queda en rojo y nunca desaparece; en el celular, la página se desplaza sin quedar atrapada; el PMTiles pesa < 30 MB y el mapa carga solo al llegar a la sección |

### W2: Paralelo 2

| ID | Tarea | Área | Pri | Depende de | Leer | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- | --- |
| T-624 | **Estado de la misión, Telemetría y banner de alarma** (03 §3.2, §3.3 y §4) | E | M | T-622, T-631 | 08_gui/03, 02 §9 | Con `nominal`: la línea de fases y los objetivos se encienden en orden con su T+. Con `descenso_rapido`: sale el banner. Los números son tabulares, con coma decimal. |
| T-625 | **Recuperación** (coordenadas, Google Maps, QR y vector) y **Salud del cohete** (resumen, Go/No-Go y detalle) (03 §3.5 y §3.8) | E | M (Recuperación) / S (Salud) | T-622, T-631 | 08_gui/03, 05 §2.3 | El QR abre la URL correcta en un celular real; con fallas simuladas, el resumen y el detalle cambian |
| T-626 | **Los ojos de Deméter** (03 §3.9), solo en `/demeter/` | E | S | T-622, T-631 | 08_gui/03 §3.9, 04_diseno/visionpack_integracion | Se ve en Deméter; la prueba de aislamiento confirma que no está en Hermes |
| T-633 | **Gráficas** con uPlot: altitud, Vz y aceleración; marcas de eventos; barra de backfill y reemplazo (03 §3.7) | D | S | T-631 | 08_gui/03 §3.7 | Con `backfill`, la barra avanza y la gráfica se reemplaza; 60 fps en un celular de gama media durante el vuelo repetido |
| T-634 | **Actitud 2D:** horizonte y brújula desde el cuaternión (03 §3.6) | D | S | T-631 | 08_gui/03 §3.6, 04_diseno/protocolo_paquetes §8 | Pruebas con cuaterniones conocidos (0°, 90° de pitch y 45° de roll) dan los ángulos correctos ± 0,5° |
| T-640 | **Relay público** (`gui/relay/`, FastAPI): ingesta con token, snapshot, SSE, baja a 1 Hz en tierra y persistencia en JSONL (04 §4). Se prueba **alimentándolo con el repetidor**: sin el back. | D | S (M si hay web en vivo) | T-611, T-630 | 08_gui/04 §4–5, 05 | La web apuntada al relay se comporta igual que con el repetidor; una petición sin token da 401; no existe ninguna ruta de escritura pública |

### W3: Integración

| ID | Tarea | Área | Pri | Depende de | Leer | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- | --- |
| T-641 | **Conectar con el back:** el reenviador de la estación (T-605a, back) postea `web-1` al relay. **Se puede probar antes sin hardware** con el reprocesamiento de un log crudo del servicio de tierra ([C-05](../05_plan/dos_sesiones/06_contratos/05_api_backend_tierra.md) §1). | Ambos | S | T-640, **T-602 y T-S06** (servicio y API local), **T-605a** | 08_gui/05, 05_plan/dos_sesiones/06_contratos/05_api_backend_tierra | Primero un log crudo reprocesado y después una placa real en el banco aparecen en la web pública con < 2 s de retraso |
| T-642 | **Despliegue:** CDN estático, relay con TLS, dominio, variables de entorno y PMTiles en el CDN (PEN-W05) | Ambos | S | T-640 | 08_gui/04 §9 | URL pública funcionando; el SSE no queda en búfer (los mensajes llegan uno a uno) |
| T-643 | **Prueba de carga:** 600 clientes SSE durante 5 min con un vuelo repetido | D | S | T-642 | 08_gui/04 §5 | p95 de la latencia del relay < 1 s; el relay sin errores; se registra la CPU y la memoria |
| T-644 | **Pulido para el celular:** Lighthouse, accesibilidad, un Android barato y un iPhone reales, legibilidad al sol | E | S | T-624, T-625 | 08_gui/02 §10, 04 §6 | Lighthouse móvil ≥ 90 en rendimiento y en accesibilidad en las 3 páginas; las capturas en la bitácora |
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
            └─► T-640 ─► T-641 (+ T-602, T-S06, T-605a del back) ─► T-642 ─► T-643, T-645, P-08
T-611 ─► T-632                                     T-624, T-625 ─► T-644
```

**Lo que se puede hacer al mismo tiempo, el primer día:** T-610 (área E) y T-612 (área D).
**Después de HW0**, en paralelo:
- T-620 y T-622 (la portada y la misión no comparten carpetas);
- T-630→T-631 y T-632.

**Orden de prioridad cuando hay varias listas** (D-W16): primero las S+ del [dashboard de operación](09_dashboard_operacion.md) §7, luego las M de la web, luego las S.

**El dashboard de operación** (T-660 en adelante) tiene su propio documento: [09_dashboard_operacion](09_dashboard_operacion.md). Reutiliza el andamiaje, el cliente de datos, el mapa y las gráficas de esta web, así que empieza **después de HW1**.

## 5. Worktrees, ramas y revisión (DP-01 del back, que reemplaza a D-028)

- **Una tarea = una rama `feature/T-6xx-<slug>` desde `develop` = un worktree. La rama dura ≤ 1 día:** si la tarea no cabe, se parte.
  - El agente `desarrollador` crea su worktree (`isolation: worktree`).
  - Un humano lo hace con: `git worktree add ../hermes-wt/T-620 -b feature/T-620-portada develop`.
- **Cada mañana**, cada rama abierta se actualiza desde `develop` (merge de `develop` hacia la rama). Nunca se rebasa una rama ajena.
- **Cada persona puede tener varias tareas en curso a la vez** (cada una en su worktree), siempre que **no compartan carpetas** con ninguna otra tarea en curso, suya o del otro (§1). Por ejemplo, T-620 y T-622 en paralelo, o T-631 y T-632.
- **Archivos que nunca se tocan sin acuerdo:**
  - `src/contrato/`, `src/datos/api.ts` y los tokens de `src/tema/` (contratos, D-W);
  - `package.json`: si hace falta una dependencia nueva, va en un PR pequeño `build(web): agregar <dep> [T-6xx]` que se integra primero.
- **Revisión** (la tabla de DP-01 aplicada a la web):

| Qué cambia | Modo | Revisión |
| --- | --- | --- |
| `web-1` (05 y `src/contrato/`), `src/datos/api.ts`, los tokens de `src/tema/` | **Preguntar** | Aprobación humana de los dos antes del merge |
| `gui/relay/` y lo que toque comandos o las rutas locales (dashboard de operación) | **Preguntar** | Revisión humana del otro antes del merge (la seguridad de GS-14 depende de esto) |
| El resto de `gui/web/`, `tools/web_datos/` y la documentación | **Mostrar** | El agente `revisor` (cuando exista, DP-02) y merge con las pruebas en verde; el otro revisa en < 24 h |

- **Merge `--no-ff`**, con Conventional Commits en español y el ID de la tarea.
- **Al cerrar cada fase:** sobre `develop` se corren el humo de Playwright y la prueba de aislamiento. El diseñador revisa las capturas contra 02 y 03 y anota en la bitácora.

## 6. "Definido como hecho" para la web (además de [flujo_trabajo](../05_plan/flujo_trabajo.md) §5)

- [ ] `npm run build`, `npm test` y `npm run e2e` en verde.
- [ ] **La prueba de aislamiento** en verde (D-W01).
- [ ] Sin colores, tamaños ni duraciones sueltas: solo tokens.
- [ ] Capturas a 390×844 y 1440×900 en la entrada de bitácora (si la tarea es visual).
- [ ] Todo texto visible en español, con coma decimal y las unidades de 02 §5.
- [ ] Ningún número mágico: los umbrales `WEB_*` vienen de un solo archivo de constantes de la web que replica [constantes](../02_requisitos/constantes.md).
- [ ] No agrega ninguna ruta, botón ni mensaje que vaya hacia un cohete (GS-14). Única excepción: el dashboard de operación, por las rutas `/api/v1/local/` y solo desde `127.0.0.1` (09 §5).
- [ ] **Los scripts funcionan en Windows y en macOS:** Jerónimo usa Windows y Juan Pablo macOS. Se usan scripts de `npm` y Node, sin bash; las rutas se arman con `path`.

## 7. Antes de lanzar el primer agente

1. ✅ Aprobar esta carpeta (PR #1, integrado el 2026-10-25) y cerrar PEN-W06, PEN-W07 y PEN-W09.
2. ✅ **Consolidar** (rama `docs/web-compatibilidad`):
   - la épica **E10, Web pública y operación** en [backlog.md](../05_plan/backlog.md), con T-610…T-679 apuntando aquí y a 09. El agente `desarrollador` **solo acepta tareas que estén en el backlog** (su §0.2);
   - D-034 en `decisiones.md` (apunta a las D-W);
   - los pendientes y riesgos de la web en `pendientes.md` y `riesgos.md`;
   - la sección 9 "Web" en `constantes.md`;
   - la división de T-605.
3. ⏳ **Congelar `web-1` en H0** (T-611), junto con C-05.

Para lanzar una tarea, en una sesión con `SESION=web`: *"Implementa T-6xx. El plan está en `docs/08_gui/06_plan_web.md`."*

## 8. Riesgos de la web

| ID | Riesgo | Prob. | Impacto | Mitigación |
| --- | --- | --- | --- | --- |
| R-W1 | Las mismas dos personas llevan el back crítico y la web | Alta | Alto | Los agentes hacen el código y los humanos revisan; la web se pausa si el back se atrasa (§2); primero las tareas M |
| R-W2 | Mala red móvil en Santa Fe de Antioquia para el público | Media | Medio | La página es útil sin el mapa; presupuestos de peso (04 §6); 1 Hz en tierra |
| R-W3 | Starlink o el relay caen en pleno vuelo | Media | Medio | El dashboard local no depende de internet; la web muestra "Reconectando" y el backfill rellena después |
| R-W4 | No llegan las fotos ni los nombres a tiempo | Media | Bajo | Placeholders dignos (parche y fondo) y contenido modificable hasta el 6 de noviembre |
| R-W5 | Se confunde la simulación con el vuelo real | Baja | Alto | Banner "SIMULACIÓN" fijo y modo marcado en `meta.modo` (03 §4) |
| R-W6 | La cuota gratuita de Hugging Face no alcanza para generar los fondos | Media | Bajo | Generar pronto (T-621 en W1); alternativa: fotos con licencia libre y el mismo tratamiento |
| R-W7 | Jerónimo queda sobrecargado: la sesión A del back más tareas de la web | Alta | Medio | Su back va primero. Como no hay dueños fijos (D-W16), Juan Pablo toma las tareas de D que estén listas |
| R-W8 | `web-1` cambia después de H0 y rompe la web, el servicio de tierra y la CLI a la vez | Baja | Alto | Congelado en H0 con C-05; solo campos opcionales sin `web-2`; los dos lados validan contra el mismo `esquema.json` |
