---
id: proyecto
estado: vivo
actualizado: 2026-10-24
---
# Contexto del proyecto

## Equipos y personas

| | |
| --- | --- |
| Universidad | EIA (Colombia) |
| Equipos | **Hermes** y **Demeter**: dos cohetes, cada uno con su CanSat |
| Software | **Juan Pablo** (Hermes, el único que programa en Hermes) y **Jerónimo** (Demeter) |
| Autor de los requisitos | **Pablo Tilano**, autor de *Objetivos_Sistemas.pdf*, que aplica a los dos equipos |
| Otros compañeros | Se encargan del cohete, la estructura, el motor, la simulación, la masa y los entregables del concurso |

- **Un solo software para los dos cohetes**, en un solo repositorio. El repo todavía no existe: se crea cuando la documentación esté lista.
- La única diferencia es el módulo VisionPack de Demeter.
- La estación terrena es compartida y recibe a los dos cohetes a la vez.

## Concurso

- **CCCD 2026** (https://cccd.space). Lo organiza SateLab/ALAS bajo Tripoli 181, con la FAC y la Aerocivil.
- Se hace en **Santa Fe de Antioquia, del 6 al 8 de noviembre de 2026**.
- Somos de la **Categoría 3 (Universitarios / "Avanzados")**, con la inscripción confirmada, y lanzamos el **8 de noviembre**.
- **No hay vuelo de prueba antes del concurso:** el software se valida con simulación y pruebas en tierra.

## Alcance del equipo de software

**Nuestro:**
- el firmware de vuelo de la T-Beam Supreme;
- el enlace LoRa y el TDMA;
- el firmware del módem de la estación;
- el servicio de tierra, el dashboard local y la web pública;
- el manejo de los datos (log, volcado, backfill y análisis post-vuelo, incluida la caracterización del motor);
- la integración con el VisionPack y la corrección de su código, junto con Jerónimo.

**No es nuestro:** el diseño y la construcción del cohete, la masa, el motor, OpenRocket y los documentos del concurso.
- **Pero necesitamos datos de esas áreas** (ver [pendientes](../05_plan/pendientes.md)): la simulación en CSV, el motor y su retardo, la masa y el Cd, el conexionado de los sensores y cómo se monta el CanSat.

## Reglas del reglamento (DCP 2026) que tocan el software

- La recuperación es **solo por la carga de eyección del motor**: no hay despliegue electrónico ni control activo.
  - El paracaídas se abre al final de la combustión más el retardo, y puede ser antes o después del apogeo.
- Todas las partes descienden juntas. El CanSat probablemente va dentro del cohete todo el vuelo.
- Integración en rampa de ≤ 15 minutos. El motor lo instala el Comité.
- Velocidad de aterrizaje de ≤ 11 m/s.
- CanSat de 250 a 300 g. Los motores de la ficha de la Cat 3 son G80-7T y H135W-14A.
- **Material del cohete:** cartón y PETG, con algunas piezas de PETG-CF (fibra de carbono), que puede atenuar la radiofrecuencia. Las antenas van **por fuera** de esas piezas.

## Hardware (resumen; el detalle está en [componentes](../03_hardware/componentes.md))

- **CanSat (los dos cohetes):**
  - LilyGO T-Beam Supreme, con ESP32-S3, SX1262, MAX-M10S, QMI8658, QMC6310, BME280, AXP2101 y PCF8563;
  - LSM6DSO32, BMP581 y MMC5983MA externos;
  - DRV5032, buzzer y batería 18650;
  - antenas TX915-FPC-8521 (LoRa) y TAN1216Q50A (GNSS).
- **VisionPack (Demeter):** Raspberry Pi 5, 2× Camera Module 3 y UPS X1200 con 2× P30B.
- **Estación:** T-Beam V1.2 con SX1262 (confirmado) y NEO-M8N, antena TX915-BLG-40, portátil, Starlink y servidor remoto.
- **Todo el hardware ya está comprado.**

## Documentos fuente (en `docs/fuentes/` y `visionpack/`)

| Archivo | Qué contiene | Traducido a |
| --- | --- | --- |
| `Objetivos_Sistemas.pdf` | Requisitos de hardware, firmware y estación | [requisitos.md](../02_requisitos/requisitos.md) |
| `Tabla_componentes.xlsx` | Especificaciones de los componentes | [componentes.md](../03_hardware/componentes.md) |
| `EYES_OF_DEMETER_VISION_PACK.docx` | Informe del VisionPack | [visionpack_integracion.md](../04_diseno/visionpack_integracion.md) |
| `Propuesta analisis de datos.docx` | Objetivos de la aviónica (Demeter) | Referencia |
| `demeter_*.py` | El plano de control de la Pi | [revision_codigo_pi_demeter.md](../06_revisiones/revision_codigo_pi_demeter.md) |
