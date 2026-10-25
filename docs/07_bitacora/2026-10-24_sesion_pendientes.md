---
fecha: 2026-10-24
tipo: sesion
ids: []
autor: Claude (documentador) con Juan Pablo
rama: —
---
# Ronda de respuestas 1 y pendientes justificados

## Contexto
Juan Pablo responde la ronda 1 ([99_archivo/ronda1_respuestas.md](../99_archivo/ronda1_respuestas.md)) y agrega dos notas de diseño: los estados de la misión con la configuración LoRa, y los campos de la telemetría (hoy en `99_archivo/nota_original_*`).

## Qué se hizo
- **Respuestas clave:**
  - un solo software y un solo repo para los dos cohetes, desarrollado con Jerónimo (Demeter);
  - el VisionPack es un módulo solo de Demeter;
  - la estación es compartida y recibe a los dos cohetes a la vez;
  - Categoría 3 confirmada;
  - el alcance es **solo software**;
  - no habrá vuelo de prueba;
  - *Objetivos* aplica a los dos equipos (lo escribió Pablo Tilano).
- **Hallazgo:** con SF7/BW250, el paquete de 63 B tarda unos 59 ms en el aire y no cabe en un slot TDMA de 25 ms.
- Se escribió la ronda 2 de pendientes justificados ([99_archivo/ronda2_pendientes.md](../99_archivo/ronda2_pendientes.md)) y la revisión del código de la Pi para Jerónimo ([06_revisiones](../06_revisiones/revision_codigo_pi_demeter.md)).
- Se actualizó `CLAUDE.md`.

## Pendiente / siguiente paso
- Las respuestas de la ronda 2.

## Documentos afectados
`CLAUDE.md`, la ronda 2 de pendientes y la revisión de la Pi.
