---
id: bitacora
estado: vivo
actualizado: 2026-10-24
---
# Bitácora del proyecto

Aquí queda **cada paso del proceso**, con **un archivo por entrada**. Las entradas no se reescriben: si algo cambia después, se agrega una entrada nueva que enlace a la anterior.

## Nombre del archivo

`AAAA-MM-DD_<tipo>_<tema>.md`. Para las tareas: `AAAA-MM-DD_T-xxx_<slug>.md`.
Tipos: `sesion` · `T-xxx` (tarea) · `prueba` · `reunion` · `decision` · `campo`.

## Plantilla

```markdown
---
fecha: AAAA-MM-DD
tipo: sesion | tarea | prueba | reunion | decision | campo
ids: [T-xxx, P-xx, D-xxx, PEN-xx]
autor: <persona o agente>
rama: <rama git, si aplica>
---
# <Título corto>

## Contexto
Por qué se hizo esto (1–3 líneas).

## Qué se hizo
- …

## Evidencia
Cifras, salidas, hash del commit, versión del firmware, fotos o logs adjuntos.

## Decisiones tomadas o propuestas
(Las propuestas que cambian contratos no se aplican aquí: las consolida el documentador.)

## Problemas y cómo se resolvieron

## Pendiente / siguiente paso

## Documentos afectados
```

## Índice

| Fecha | Entrada | Resumen |
| --- | --- | --- |
| 2026-10-23 | [Arranque del proyecto](2026-10-23_sesion_arranque.md) | Revisión del material, primeras preguntas, CLAUDE.md, guía HTML; corrección Hermes/Demeter |
| 2026-10-24 | [Ronda de respuestas y pendientes justificados](2026-10-24_sesion_pendientes.md) | Software común a los dos equipos; hallazgo del TDMA; revisión de la Pi para Jerónimo |
| 2026-10-24 | [Investigación de componentes y diseño v1](2026-10-24_sesion_diseno_v1.md) | 23 fichas con agentes Haiku; reestructura de la documentación; contratos v1; plan |
| 2026-10-24 | [Flujo de trabajo y agente desarrollador](2026-10-24_sesion_flujo_trabajo.md) | Respuestas sobre el DRV5032, el CanSat rígido y las antenas; gitflow, worktrees, agente Sonnet, bitácora |
| 2026-10-24 | [Pines, encendido y creación del repo](2026-10-24_sesion_repo_y_pines.md) | D-022 cerrada (SPI3 compartido y el MMC en I2C0), D-031 (DRV5032 a PWR_KEY), H135W-8; repo creado y subido |
| 2026-10-24 | [Simulación de Demeter y corrección de buses](2026-10-24_sesion_sim_y_correccion_buses.md) | El M.2 es interno y D-022 se reabre (propuesta B′ con SDMMC); pull-ups revisados; la sim. de OpenRocket de Demeter organizada y analizada |
| 2026-10-24 | [Actualización del manual HTML](2026-10-24_sesion_manual_html.md) | El artifact pasa a "Manual de Vuelo Hermes + Demeter": plan, funcionamiento paso a paso y lo que falta por responsable; tres inconsistencias de documentación detectadas |
| 2026-10-24 | [Lista de pines de los headers y motores](2026-10-24_reunion_pines_y_motores.md) | El CSV confirma los headers PN1/PM1; el IO2 da pin al pulso de la Pi; los breakouts van a DC1; Hermes G80-7T, Demeter H135W-8 |
| 2026-10-25 | [Plan y diseño de la web pública](2026-10-25_sesion_plan_web.md) | `docs/08_gui/`: identidad de Hermes y Deméter, portada, páginas aisladas, `web-1`, carriles y T-610…T-654; MCP de Hugging Face; prueba de los fondos con FLUX |
| 2026-10-25 | [Plan de dos sesiones del back](../05_plan/dos_sesiones/bitacora_2026-10-25_plan_dos_sesiones.md) (en su carpeta; se copia aquí en T-S14) | Jerónimo: punto de control, método, contratos C-01 a C-05, DP-01…DP-17 |
| 2026-10-25 | [Ajuste de C-05 a `web-1`](../05_plan/dos_sesiones/bitacora_2026-10-25_ajuste_C-05_web-1.md) (ídem) | El servicio de tierra adopta `web-1` (DP-17) |
| 2026-10-25 | [Compatibilidad de los dos planes y dashboard de operación](2026-10-25_sesion_compatibilidad_y_operacion.md) | Carriles E y D, `web-1` con `lkp` y `fw_version`, E10 en el backlog, D-034, constantes `WEB_*`, borrador del dashboard de operación |
| 2026-10-25 | [Refinamiento de C-02 y C-04 para H0](2026-10-25_sesion_contratos_C-02_C-04.md) | Sesión B: interfaces internas del firmware y formato binario del log, listos para congelar en H0 (PR #5) |
| 2026-10-25 | [Andamiaje de la web (T-610)](2026-10-25_T-610_andamiaje_web.md) | El agente: Vite multipágina, stack completo, prueba de aislamiento y humo (PR #4) |
| 2026-10-25 | [Tema y tokens (T-613)](2026-10-25_T-613_tema_tokens.md) | El agente: tokens de 02 §6, fuentes autohospedadas, `dev/tokens.html`, regla contra colores sueltos y aislamiento por familia de fuente (PR #6) |
| 2026-10-25 | [Revisión de T-610 y T-613, y entorno de desarrollo](2026-10-25_revision_T-610_T-613_y_entorno.md) | Revisión de los PR #4 y #6; D-W17 (Ajv y `lucide-preact`); D-035 (Node 22 y `npm ci`, sin Docker para desarrollar); T-611 lanzada |
| 2026-10-25 | [Instalación de graphify](2026-10-25_sesion_graphify.md) | D-036: grafo de conocimiento para la búsqueda de los agentes; la skill y el hook se versionan, el grafo no; los datasheets quedan fuera |
| 2026-10-25 | [Revisión de T-611 y agenda de H0](2026-10-25_revision_T-611.md) | PR #7 (`web-1` en código): 4 hallazgos en `src/datos/` (LKP tras 10 min, `alimentar` incompleto, ejemplo en modo vivo, borde de 5 s) y las 11 preguntas con recomendación |
| 2026-10-25 | [Revisión de T-620, la portada](2026-10-25_revision_T-620.md) | PR #11: 252,7 KB, LCP 1,9 s; ajustes: selector de tema sin `:root` (sin cambiar valores) y PNG de 6,1 a 1,8 MB; pendientes del diseñador para T-621 |
| 2026-10-25 | [Integración de T-611 con T-612 y errata de `web-1`](2026-10-25_integracion_T-611_T-612.md) | Los 12 JSONL de Jerónimo fallan solo por `vel: null` antes del fix: errata D-W19 (`vel` nulable); T-614 para probar en local con npm |
| 2026-10-25 | [Ajustes al agente desarrollador](2026-10-25_sesion_ajustes_agente.md) | El agente crea su rama desde `origin/develop` antes de leer, prepara su entorno (`npm ci`), abre el PR con `--base develop` y pierde herramientas que no le tocan |
| 2026-10-25 | [Repetidor de desarrollo (T-630)](2026-10-25_T-630_repetidor_desarrollo.md) | El agente: `dev/repetidor/` en Node sin dependencias, snapshot y SSE desde los JSONL, `Last-Event-ID`, `relay_caido` con 503 (PR #18) |
| 2026-10-25 | [Consolidación de T-630](2026-10-25_sesion_consolidacion_T-630.md) | Revisión del PR #18 (27 pruebas verificadas); propuestas para H0: cursor `seq_relay` del snapshot, `meta` sin `id`, `t_mas_s` en la espera; backfill completo antes de T-633 |
| 2026-10-25 | [Armazón de la página de misión (T-622)](2026-10-25_T-622_armazon_mision.md) | El agente: barra de misión, navegación, Inicio, Equipo y Pie; `?ejemplo` solo en desarrollo y comprobado fuera del `dist/`; 5 preguntas sobre 03 (PR #17) |
| 2026-10-25 | [Revisión de T-632, el mapa](2026-10-25_revision_T-632.md) | PR #21: LKP fijo, gestos seguros en el celular y MapLibre diferido (JS inicial de 16,7 KB gz); presupuesto real en 04 §6; la elipse se oculta en LANDED; la posición interpolada se le propone a T-631 |
| 2026-10-25 | [Cliente de datos (T-631)](2026-10-25_T-631_cliente_datos.md) | El agente: snapshot y SSE con `fetch`, reconexión con retroceso y `Retry-After`, costura sin cursor, edad con reloj local, interpolación con *slerp*; 210 pruebas y primera prueba en Chromium contra el repetidor (PR #23) |
| 2026-10-25 | [Consolidación de T-631](2026-10-25_sesion_consolidacion_T-631.md) | PR #23 verificado sobre `develop` con T-632 (241 pruebas); sección D de la agenda de H0 (cursor, `meta` sin `id`, CORS, latido perdido, `t_mas_s`, backfill, `/salud`, parámetros, interpolación); la e2e de gestos de T-632 falla en `develop` |
| 2026-10-25 | [T-621: imágenes y revisión de la integración](2026-10-25_revision_T-621.md) | Los fondos `s7` aprobados; 11 íconos con FLUX schnell en Replicate (el nuevo generador; Hugging Face pasa a respaldo); PR #25: portada de 311 KB, LCP 1,95 s, contraste mínimo 4,82:1; D-W21 |
| 2026-10-25 | [Cierre de T-631, el grafo y la siguiente tarea](2026-10-25_sesion_cierre_T-631.md) | T-631 hecha (PR #23 y #24); grafo a 1690 nodos (AST y semántico); `CLAUDE.md` con el estado del código; recomendación: T-634 ya y T-624 (cierra HW1) cuando se integre el #25 de T-621 |
| 2026-10-25 | [Actitud 2D y mapa limitado (T-634)](2026-10-25_T-634_actitud_y_mapa_limitado.md) | El agente: horizonte y brújula desde el cuaternión (cabeceo, alabeo y rumbo, con cardán y sin dato claros) y el mapa limitado al área del PMTiles (límites y zoom máximo de su cabecera, sobrezoom +1, área por defecto sin PMTiles, el LKP nunca queda fuera); 298 pruebas y 115 e2e |
