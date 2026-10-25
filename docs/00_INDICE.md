---
id: indice
actualizado: 2026-10-24
---
# Índice de la documentación: software Hermes + Demeter (CCCD 2026)

Esta carpeta es una bóveda de Obsidian. **Los enlaces son de Markdown estándar y relativos** (`[texto](ruta.md)`), para que funcionen igual en Obsidian, en GitHub y para agentes de IA. **No uses `[[wikilinks]]`.**

## Por dónde empezar

| Si vas a… | Lee primero |
| --- | --- |
| Entender el proyecto | [01_contexto/proyecto.md](01_contexto/proyecto.md) |
| Saber qué hay que construir | [02_requisitos/requisitos.md](02_requisitos/requisitos.md) |
| Saber cómo vuela cada cohete (simulación) | [02_requisitos/perfiles_vuelo.md](02_requisitos/perfiles_vuelo.md) y [../datos/README.md](../datos/README.md) |
| Usar un número (umbral, tasa, tamaño, ID) | [02_requisitos/constantes.md](02_requisitos/constantes.md): **es la única fuente** |
| Trabajar con hardware o drivers | [03_hardware/componentes.md](03_hardware/componentes.md) y [03_hardware/buses_y_pines.md](03_hardware/buses_y_pines.md) |
| Radio, TDMA o sincronización | [04_diseno/enlace_lora_tdma.md](04_diseno/enlace_lora_tdma.md) |
| El formato de los paquetes y los comandos | [04_diseno/protocolo_paquetes.md](04_diseno/protocolo_paquetes.md) |
| Las fases de vuelo | [04_diseno/maquina_estados.md](04_diseno/maquina_estados.md) |
| La arquitectura del firmware, el log o la caracterización del motor | [04_diseno/firmware_vuelo.md](04_diseno/firmware_vuelo.md) |
| La estación, el dashboard o la web | [04_diseno/estacion_terrena.md](04_diseno/estacion_terrena.md) |
| La Pi de Demeter | [04_diseno/visionpack_integracion.md](04_diseno/visionpack_integracion.md) y [06_revisiones/revision_codigo_pi_demeter.md](06_revisiones/revision_codigo_pi_demeter.md) |
| Por qué se decidió algo | [04_diseno/decisiones.md](04_diseno/decisiones.md) |
| Qué hacer hoy | [05_plan/plan_maestro.md](05_plan/plan_maestro.md) → [05_plan/backlog.md](05_plan/backlog.md) |
| Probar algo | [05_plan/plan_pruebas.md](05_plan/plan_pruebas.md) |
| Lo que falta por responder | [05_plan/pendientes.md](05_plan/pendientes.md) |
| Riesgos | [05_plan/riesgos.md](05_plan/riesgos.md) |
| Cómo se trabaja (roles, gitflow, worktrees, commits, definido como hecho) | [05_plan/flujo_trabajo.md](05_plan/flujo_trabajo.md) |
| Qué pasó y cuándo | [07_bitacora/README.md](07_bitacora/README.md) (el índice de entradas) |

## Estructura

```
00_INDICE.md            este archivo
01_contexto/            quiénes somos, el concurso, el alcance y las reglas que tocan el software
02_requisitos/          requisitos con ID y constantes (la fuente única de los números)
03_hardware/            directorio de componentes, fichas, buses y pines, y datasheets (PDF y algunos .md)
04_diseno/              contratos y diseño: enlace, protocolo, estados, firmware, estación, VisionPack y decisiones
05_plan/                plan maestro, backlog, pruebas, riesgos y pendientes
06_revisiones/          revisiones de código
07_bitacora/            un archivo por paso: sesiones, tareas, pruebas y reuniones (D-029)
99_archivo/             histórico: rondas de preguntas y notas originales. No es la fuente vigente.
```

## Reglas de la documentación (para humanos y agentes)

1. **Cada dato vive en un solo lugar.** Los números están en `constantes.md`; los formatos, en `protocolo_paquetes.md`; las transiciones, en `maquina_estados.md`. Los demás documentos **enlazan, no copian**.
2. **Primero el documento, después el código.** Un contrato no cambia desde el código. El cambio se hace en el documento, se registra como decisión en `decisiones.md` y después se programa.
3. **Cada documento tiene un frontmatter** con `id`, `estado` (borrador, propuesta, aprobado o vivo), `actualizado` y `depende_de`.
4. **Hechos frente a suposiciones.** Lo que no está verificado se marca: `(P)` provisional, `(V)` por verificar, ⚠️ o ❓. Las fichas de hardware tienen su sección de *Incertidumbres*.
5. **IDs estables:** REQ (`REG-`, `HW-`, `DAT-`, `NAV-`, `GS-`), decisiones (`D-`), tareas (`T-`), pruebas (`P-`), riesgos (`R-`) y pendientes (`PEN-`). Se citan por ID.
6. **`99_archivo/` no se lee para tomar decisiones**: solo sirve de historia.
