---
fecha: 2026-10-23
tipo: sesion
ids: []
autor: Claude (documentador) con Juan Pablo
rama: —
---
# Arranque del proyecto

## Contexto
Juan Pablo queda a cargo del CanSat y de toda la programación del equipo Hermes, sin información previa. Comparte el material que recibió: los documentos y el código de la Pi de Demeter, la tabla de componentes y *Objetivos_Sistemas.pdf*. Pide una revisión a fondo, preguntas y el contexto armado (CLAUDE.md y documentos).

## Qué se hizo
- **Rol de Claude fijado por el usuario:** documentador, planificador y tutor. **No escribe código.**
- Se revisaron `demeter_protocol.py`, `demeter_telemetryd.py`, `demeter_missiond.py`, los dos `.docx` y la tabla de componentes.
- Se leyó el sitio del concurso (cccd.space) y el reglamento DCP 2026: fechas, ficha de la Cat 3, recuperación solo por la eyección del motor, CanSat de 250–300 g, integración en 15 minutos.
- Se creó `CLAUDE.md` y la primera ronda de preguntas (hoy en [99_archivo/ronda1_preguntas.md](../99_archivo/ronda1_preguntas.md)).
- Se hizo una guía interactiva en HTML (artefacto "Manual de Vuelo Hermes"), que hoy está desactualizada.
- **Corrección de identidad:** somos el equipo **Hermes**. Todo el material recibido es de **Demeter**; los dos equipos trabajan coordinados.

## Evidencia
- Hallazgos en el código de la Pi: el ARM siempre falla (`health_check` sin implementar); `telemetryd` ignora PREFLIGHT y START_ASCENT; se pierde el RAW si `reset_telemetry` no responde; el video del ascenso en MP4 se corrompe con un corte de energía.

## Pendiente / siguiente paso
- Las respuestas de la ronda 1.

## Documentos afectados
`CLAUDE.md`, la ronda 1 de preguntas y la guía HTML.
