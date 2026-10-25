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
| 2026-10-25 | [Agente desarrollador y graphify](2026-10-25_sesion_agente_y_graphify.md) | El agente crea su rama desde `origin/develop` antes de leer, prepara su entorno y abre el PR con `--base develop`; graphify instalado (skill, hooks, `.graphifyignore`) |
| 2026-10-25 | [Compatibilidad de los dos planes y dashboard de operación](2026-10-25_sesion_compatibilidad_y_operacion.md) | Carriles E y D, `web-1` con `lkp` y `fw_version`, E10 en el backlog, D-034, constantes `WEB_*`, borrador del dashboard de operación |
