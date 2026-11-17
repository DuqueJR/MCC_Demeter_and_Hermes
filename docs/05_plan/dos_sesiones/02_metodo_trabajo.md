---
id: dos_sesiones_metodo
estado: aprobado en lo que dicen DP-01 a DP-04; el resto es propuesta
actualizado: 2026-10-25
depende_de: [flujo_trabajo, decisiones]
---
# Método de trabajo en pareja con agentes (Etapa 2)

**El problema:** dos personas (Jerónimo y Juan Pablo), **en el mismo lugar**, cada una con su **cuenta Pro** de Claude Code, desarrollan casi todo con agentes, en paralelo, con **una placa de desarrollo compartida y sin repuestos**, y con 10 días de código.

**Este documento recoge:**
- qué práctica se adopta y por qué;
- qué se descarta y por qué;
- las fuentes.

## 1. Evitar bloqueos y conflictos

| Práctica | Evidencia | Qué se adopta |
| --- | --- | --- |
| **Propiedad de módulos** | Una rama de trabajo debe ser "producto de una sola persona" y durar poco ([trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/); [Fowler, *Patterns for Managing Source Code Branches*](https://martinfowler.com/articles/branching-patterns.html)) | **Cada sesión es dueña de carpetas que no se cruzan** ([C-01](06_contratos/01_propiedad_y_carpetas.md)). Lo compartido (contratos, constantes, `main`) solo se cambia en una sincronización, con las dos aprobaciones. Con dos personas basta una tabla de propiedad: CODEOWNERS obligatorio no hace falta ([GitHub, code owners](https://docs.github.com/en/enterprise/2.18/user/articles/about-code-owners)). |
| **Contratos primero** | Con contratos guiados por el consumidor, cada lado prueba contra el contrato y contra dobles que lo respetan, sin esperar al otro ([Microsoft Engineering Playbook, CDC](https://microsoft.github.io/code-with-engineering-playbook/automated-testing/cdc-testing/)) | **C-01 a C-05 se fijan en H0.** Cada uno lleva **vectores de prueba compartidos** (archivos golden que validan los dos lados). No se usa Pact: es demasiado para 10 días. |
| **Worktrees** | Cada sesión o subagente en su worktree evita que las ediciones choquen ([Claude Code, worktrees](https://code.claude.com/docs/en/worktrees.md)) | **Ya está:** `isolation: worktree` en el agente `desarrollador`. **Dos detalles que hay que cuidar:** (a) los worktrees de los subagentes salen de **la rama por defecto del remoto (hoy `main`)**, no de `develop`. El agente lo corrige creando su rama desde `origin/develop`, pero conviene cambiar la rama por defecto de GitHub a `develop` o fijar `worktree.baseRef` ([PA-18](11_preguntas_abiertas.md)). (b) Agregar `.claude/worktrees/` al `.gitignore` ([12_cambios…](12_cambios_a_aplicar_en_lo_existente.md)). |
| **Trunk-based o ramas por hito** | Integrar seguido, con ramas de horas o, como mucho, un par de días. "Las revisiones lentas debilitan la integración continua" (Fowler) | **Ramas `feature/T-xxx` cortas (≤ 1 día) hacia `develop`**, con integración diaria ([DP-01](09_decisiones.md)). Se descartan las ramas largas por persona o por hito. |
| **Orden de los merges** | — | Primero los contratos y sus vectores. Después, productores y consumidores contra el contrato, en cualquier orden. Al final, la integración. **Quien integra de segundo resuelve los conflictos.** Cada uno actualiza su rama desde `develop` todos los días ([08_sincronizacion…](08_sincronizacion_y_merge.md)). |

## 2. Hitos, fases y sesiones

- **Cortar el trabajo por las costuras de los contratos, no por cohete.** El hardware es idéntico: un solo firmware, y la diferencia entre cohetes es solo configuración ([C-02](06_contratos/02_interfaces_firmware.md) §6).
- **Cada persona tiene dos colas:** una **sin placa** (lógica en el PC, Python, simulación, dobles) y otra **con placa**. Si la placa está ocupada o el otro se atrasa, siempre hay trabajo en la primera cola.
- **Una tarea `T-xxx` por invocación del agente.** Es la recomendación de Anthropic para agentes largos: "una funcionalidad a la vez", y al empezar cada sesión leer el git log, las notas de progreso y la lista de tareas, y correr una prueba básica ([Effective harnesses for long-running agents, 26 de noviembre de 2025](https://anthropic.com/engineering/effective-harnesses-for-long-running-agents)).
- **Hitos con criterios objetivos** (H0–H4) y **una lista de recortes**: lo "debería" se recorta primero ([03_plan_maestro](03_plan_maestro.md)).

## 3. Puntos de sincronización (en el mismo lugar)

| Sincronización | Cuándo | Qué se acuerda |
| --- | --- | --- |
| **De la mañana**, en persona | Todos los días, 15 min, a una hora fija | Bloqueos; **ventanas de la placa del día**; orden de los merges; estado de la cuota (`/status`) |
| **Asíncrona** (escrita) | Al cerrar cada bloque | Cada uno actualiza **su** ficha de estado (hecho, siguiente, bloqueos, qué necesita del otro) y hace push. **Se mantiene aunque estén juntos:** los agentes necesitan la memoria escrita. |
| **Sesiones de pareja** | Las ventanas de placa conjuntas | Una persona maneja la placa y la otra revisa la evidencia y registra en `estado/placa.md` |
| **De hito** | H0–H4, 30–45 min | Congelar o cambiar contratos, recortar alcance, riesgos, consolidar el backlog y las decisiones |
| **De emergencia** | Cuando aparece un cambio de contrato | Nunca se cambia uno en solitario: propuesta escrita, aprobación de los dos y registro como decisión |

El detalle está en [08_sincronizacion_y_merge.md](08_sincronizacion_y_merge.md).

## 4. Las mismas reglas en las dos cuentas

| Mecanismo | Evidencia | Uso |
| --- | --- | --- |
| **CLAUDE.md** | Corto (por debajo de unas 200 líneas), solo lo que no se puede deducir, versionado; `CLAUDE.local.md` es personal y no se versiona; las reglas por ruta van en `.claude/rules/` ([memoria](https://code.claude.com/docs/en/memory.md); [mejores prácticas](https://code.claude.com/docs/en/best-practices)) | **Un CLAUDE.md compartido y neutral respecto a la sesión** (el actual está escrito desde Juan Pablo). Cada persona pone en su `CLAUDE.local.md` quién es y qué sesión lleva. Borrador en [15_CLAUDE_md_propuesto.md](15_CLAUDE_md_propuesto.md). |
| **Subagentes** | Versionados en `.claude/agents/`; el campo `model` controla el costo; **consumen los mismos límites** de uso ([subagentes](https://code.claude.com/docs/en/sub-agents.md)) | Se mantiene `desarrollador` (Sonnet). Se agrega **`revisor`** (solo lectura, contexto limpio) antes de la revisión humana ([DP-02](09_decisiones.md)). Es el patrón "escritor/revisor" y la "revisión adversaria" de las mejores prácticas. |
| **Hooks** | "Son deterministas", a diferencia de CLAUDE.md, que es consultivo; un `PreToolUse` que termina con código 2 bloquea la acción; `SessionStart` inyecta contexto ([hooks](https://code.claude.com/docs/en/hooks-guide.md)) | Especificados en [15_CLAUDE_md_propuesto.md](15_CLAUDE_md_propuesto.md) §3: proteger los contratos, respetar la propiedad por sesión e inyectar el estado al arrancar. **En Python**, porque los dos usan Windows. Se aplican después ([DP-03](09_decisiones.md)). |
| **Skills (comandos)** | Flujos repetibles, invocados con `/nombre` (mejores prácticas) | `/arranque`, `/cierre` y `/sync`. Nada más. |
| **Integración continua** | El "hecho" debe ser una verificación que se pueda correr ([mejores prácticas](https://code.claude.com/docs/en/best-practices)) | GitHub Actions: compila los 3 environments, corre las pruebas del firmware en el PC y pytest. Especificada en el §4 del borrador; se aplica después (DP-03). |

## 5. Contexto y continuidad entre sesiones

- **Una ficha de estado por sesión** ([estado/sesion_A.md](estado/sesion_A.md), [estado/sesion_B.md](estado/sesion_B.md)) y **una bitácora de la placa** ([estado/placa.md](estado/placa.md)). Cada uno edita solo la suya, así que no hay conflictos de merge. Es la misma lógica de la bitácora de un archivo por entrada (D-029).
- **El estado de las tareas va en las fichas, no en `backlog.md`.** Así ninguno de los dos edita el backlog en paralelo; se consolida en cada sincronización de hito. Anthropic sugiere JSON para estas listas, porque el modelo lo reescribe menos que el Markdown. Queda como opción; el repo ya está en Markdown.
- **Decisiones en formato ADR:** contexto, decisión, estado y consecuencias ([Nygard, 2011](https://faq.arc42.org/questions/C-9-3/)). Hasta consolidarse en `decisiones.md`, las decisiones de este plan viven en [09_decisiones.md](09_decisiones.md).
- **`/clear` entre tareas:** "una sesión limpia con un mejor prompt casi siempre supera a una sesión larga con correcciones acumuladas" ([mejores prácticas](https://code.claude.com/docs/en/best-practices)).
- **Handoff al cerrar cada bloque:** con `/cierre`, que actualiza la ficha y la bitácora y hace push.

## 6. Verificar el trabajo de los agentes con una placa compartida

**Principio:** "dale a Claude una verificación que pueda correr" ([mejores prácticas](https://code.claude.com/docs/en/best-practices)). En embebidos, las pruebas en el PC sirven para las capas **por encima del hardware**; las de los drivers bare-metal "suelen ser más trabajo del que valen" ([Memfault, *Interrupt*](https://interrupt.memfault.com/blog/unit-test-mocking)).

| Nivel | Qué cubre | Herramienta | ¿Placa? |
| --- | --- | --- | --- |
| 1. Pruebas unitarias en el PC | Códec, CRC, calendario TDMA con reloj falso, estimador, máquina de estados, Go/No-Go, deduplicación de comandos, codificador del log | PlatformIO `env:native` + Unity ([unit testing](https://dokk.org/documentation/platformio/v5.1.1/plus/unit-testing/)); pytest | No |
| 2. Replay en el PC | El estimador y la máquina de estados sobre OpenRocket y más de 20 variantes sintéticas (P-03) | T-304 + T-305 + [C-04](06_contratos/04_formato_log_y_replay.md) | No |
| 3. Pruebas de contrato | Los mismos vectores en C y en Python | Archivos golden | No |
| 4. Dobles de los enlaces | Módem falso; Pi falsa y LilyGO falsa por un puerto serie virtual | Python | No |
| 5. Hardware en el lazo | Drivers, tiempos de bus, tiempo en el aire, PPS, TDMA, alcance | `pio test` en la placa, por scripts | **Sí** (en las ventanas) |

El detalle está en [07_pruebas_y_placas.md](07_pruebas_y_placas.md).

**Lo que se descarta, y por qué:**
- **QEMU de Espressif para el ESP32-S3:** emula la CPU y algunos periféricos, pero no la radio ni los sensores ([Espressif](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32s3/api-guides/tools/qemu.html)).
- **Wokwi:** no tiene nuestros periféricos, necesita un token en CI y no hay un ejemplo verificado con PlatformIO ([Wokwi](https://docs.wokwi.com/vscode/platformio)).
- **Un banco HIL con runner propio** ([guía](https://industrialmonitordirect.com/blogs/knowledgebase/configuring-github-actions-for-embedded-hil-testing)): no cabe en 10 días.

**"Hecho"** = el checklist de [flujo_trabajo](../flujo_trabajo.md) §5, más tres condiciones:
1. la integración continua en verde;
2. la evidencia pegada en el PR (salidas y cifras, no afirmaciones);
3. para lo que depende del hardware, la prueba P-xx registrada con el hash del firmware y la entrada en `estado/placa.md`.

## 7. Equilibrio y cuota de dos cuentas Pro

**Lo que está documentado:**
- Pro tiene un **límite por sesión de 5 h y otro semanal**, **compartidos entre Claude y Claude Code**; se monitorean con `/status` ([soporte de Anthropic](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan)).
- Los subagentes consumen el mismo límite ([subagentes](https://code.claude.com/docs/en/sub-agents.md)).
- **Qué modelos permite Pro en Claude Code no lo dice la fuente oficial:** se verifica con `/model` ([PA-03](11_preguntas_abiertas.md)).

**Propuesta ([DP-16](09_decisiones.md)):**

| Tipo de tarea | Modelo |
| --- | --- |
| Contratos, plan, revisión de la lógica crítica de vuelo (estimador, máquina de estados, TDMA), depurar fallos difíciles con la placa | **Opus**, si Pro lo permite; si no, Sonnet con prompts más acotados |
| Implementación (`desarrollador`), pruebas, Python, consolidar la documentación, `revisor` | **Sonnet** |
| Exploración, búsquedas en datasheets | Subagente **Explore** de solo lectura |

**Reglas:**
- como mucho **2 agentes desarrolladores a la vez por cuenta**;
- `/clear` entre tareas;
- no leer datasheets completos;
- nada de conversaciones de chat largas en los días críticos.

**Relevo de cuota:** como están en el mismo lugar, cuando una cuenta llega al límite, esa persona revisa los PR, prueba en la placa u opera la CLI mientras los agentes de la otra cuenta siguen.

**Equilibrio:**
- **Las dos personas cargan la ruta crítica del vuelo.** A lleva el enlace y la sincronía; B, la adquisición y la decisión.
- **La placa se alterna:** B la usa más en H0–H1, A en H2.
- **El Python y la simulación** (donde los agentes iteran mucho y gastan cuota) se reparten.

## 8. Resumen

**Se adopta:**
1. contratos primero, con vectores de prueba;
2. propiedad de carpetas disjunta por sesión;
3. ramas cortas, integradas a diario;
4. fichas de estado por sesión y bitácora de la placa;
5. ADR;
6. capa de abstracción del hardware, con pruebas en el PC y replay;
7. dobles de los enlaces;
8. ventanas de placa y sesiones de pareja;
9. hooks;
10. agente `revisor`;
11. integración continua;
12. Sonnet para implementar.

**Se descarta:**
- ramas por hito o por persona;
- Pact;
- CODEOWNERS obligatorio;
- *Agent teams* (experimental) y la mensajería entre sesiones (pensada para sesiones en una misma máquina);
- QEMU, Wokwi y un banco HIL automatizado;
- *feature flags*: `ROCKET_ID` y `MODULO_VISIONPACK` ya cubren eso.
