---
fecha: 2026-10-24
tipo: sesion
ids: [D-001..D-027]
autor: Claude (documentador) con Juan Pablo; investigación con 9 agentes Haiku
rama: —
---
# Investigación de componentes y diseño v1

## Contexto
Juan Pablo responde la ronda 2. Le da libertad a Claude para decidir: "elige la opción más segura y explica por qué". Trae las respuestas de Pablo Tilano sobre la máquina de estados y los buses, y pide:
- un directorio de componentes con fichas y datasheets, investigado con **subagentes Haiku**;
- reorganizar toda la documentación para trabajar con agentes de IA;
- el plan completo.

## Qué se hizo
- **Respuestas que se registraron:**
  - el límite de 50 B es flexible, pero hay que optimizar;
  - cabecera común, sí;
  - sincronización TDMA con beacon, holdover y un modo sin referencia (a decisión de Claude);
  - la radio de la estación es **SX1262**;
  - **Pablo:** nada de transiciones por tiempo en la LilyGO ("si no tengo la telemetría, ¿de qué me sirve que cambie de estado por tiempo?"); la Pi sí conserva sus watchdogs; todos los sensores van en el mismo SPI;
  - el fix GNSS es obligatorio para armar;
  - motores G80-7T y "H135H 8t";
  - **caracterizar el motor es un objetivo del CanSat**;
  - se aceptan B3, B4, B6, D1, D2, E y F2; F1 queda pendiente;
  - D3: hay que conversarlo;
  - D4: el hosting se decide al final;
  - C5: el cohete es de cartón y PETG con partes de PETG-CF, y las antenas van por fuera.
- **Investigación:** 9 agentes Haiku produjeron **23 fichas** en `03_hardware/componentes/` y bajaron 19 datasheets oficiales, convertidos a `.md`.
  - No se pudieron bajar: SX1262 (Semtech), LSM6DSO32 (ST), QMC6310, SH1106, las antenas EBYTE, el X1200 y el P30B.
- **Hallazgos de la investigación:**
  - el ESP32-S3 tiene solo 2 hosts SPI y los dos están ocupados;
  - el PPS está en el GPIO 6 de la Supreme (y probablemente en el GPIO 37 de la V1.2);
  - el MAX-M10S solo llega a 10 Hz con GPS+Galileo, y el modelo AIR4 está limitado a < 4 g;
  - el DRV5032 baja su salida con el imán;
  - la Pi 5 se enciende llevando un pin a masa, no con 3,3 V;
  - el BMP581 cambia a SPI de forma irreversible si su CS baja en el arranque;
  - el FIFO del LSM6DSO32 da unos 66 ms de margen a 3,33 kHz en el peor caso.
- **Reestructura** de `docs/` en carpetas numeradas (00–07, 99), con enlaces Markdown relativos y frontmatter. Lo anterior pasó a `99_archivo/`.
- **Contratos v1:** el enlace (SF6/BW500), el protocolo v2 (NAV de 44 B y STATUS de 42 B), la máquina de estados (T1–T13 y el evento de eyección), el firmware, la estación, el VisionPack, las constantes y los requisitos con ID.
- **Plan:** el plan maestro con el mínimo para volar, un backlog de unas 45 tareas, 15 pruebas, 15 riesgos y los pendientes.

## Decisiones tomadas o propuestas
De D-001 a D-027, en [decisiones.md](../04_diseno/decisiones.md). La que sigue abierta es **D-022** (el host SPI y los pines de los sensores externos).

## Pendiente / siguiente paso
PEN-01 a PEN-15 en [pendientes.md](../05_plan/pendientes.md).

## Documentos afectados
Toda `docs/` y `CLAUDE.md`.
