# Preguntas abiertas — Equipo Hermes (CCCD 2026)
Respuestas en [[respuestas_preguntas_abiertas]]

Actualizado: 2026-10-23. Lanzamiento de Categoría 3: **8 de noviembre de 2026** (faltan 16 días).
Marca `[x]` cuando tengas la respuesta y anótala debajo de la pregunta.

Prioridad: **P0** = bloquea el vuelo o el diseño · **P1** = necesario antes de escribir código · **P2** = puede esperar.

Contexto: somos **Hermes**. Todo lo que hay en el repo es del equipo **Demeter**, con el que trabajamos coordinados.

---

## 1. Hermes vs. Demeter (lo primero)

- [ ] **P0** ¿Qué tiene hoy Hermes? ¿Hardware comprado, diseño, documentos, algún código?
- [ ] **P0** ¿Hermes usa la misma base de CanSat que Demeter (T-Beam Supreme + LSM6DSO32 + BMP581 + MMC5983MA)? La tabla dice "CANSATs" en plural.
- [ ] **P0** ¿Hermes lleva cámara o Raspberry Pi, o eso es solo de Demeter?
- [ ] **P0** ¿*Objetivos_Sistemas.pdf* aplica a los dos equipos? ¿Quién lo escribió (el enlace apunta al SharePoint de Pablo Tilano)? ¿Es obligatorio o es una lista de deseos?
- [ ] **P0** ¿El firmware de vuelo y la estación terrena se hacen en conjunto con Demeter, o cada equipo hace el suyo? ¿Quién programa en Demeter?
- [ ] **P1** ¿Cada equipo tiene su propio cohete, o los dos CanSat van en el mismo? ¿Cómo se llama cada cohete?
- [ ] **P1** Si la estación es compartida, ¿cómo se distinguen los paquetes de cada CanSat (ID de equipo, frecuencias distintas)?
- [ ] **P2** ¿Le pasamos a Demeter la revisión de su código de la Pi? Tiene bugs que bloquean su vuelo.

## 2. Concurso y alcance

- [ ] **P0** ¿"Avanzados" es la Categoría 3 (Universitarios)? ¿Está confirmada la inscripción de Hermes?
- [ ] **P0** ¿Tenemos los otros documentos oficiales 2026 que cita el DCP: **NSRT, PIC, CCRD, DCR, DMP, SPP y DCE**? En la web solo está el DCP. Sobre todo necesito el que define **cómo se puntúa la carga útil (CanSat)**.
- [ ] **P0** ¿Qué entregables (informes, revisiones de diseño, simulaciones) ya envió Hermes y cuáles faltan antes del 6 de noviembre?
- [ ] **P1** ¿Qué motor vamos a volar: **G80-7T, H135W-14A** o uno en cada vuelo? (La masa máxima de 1200 g está dada para el G80-7T.)
- [ ] **P1** ¿Compramos el altímetro oficial (Jolly Logic, 9,9 g) o lo entrega la organización? ¿Dónde va montado?

## 3. Masa y arquitectura física

- [ ] **P0** ¿Qué lleva el CanSat de Hermes y cuánto pesa? Debe quedar entre **250 y 300 g**: si falta, se completa con lastre.
- [ ] **P0** ¿Existe el cohete de Hermes? ¿Quién lo construye y cuál es el diámetro interno de la bahía de carga útil?
- [ ] **P1** El reglamento exige que todas las partes desciendan juntas y que la recuperación sea solo por la eyección del motor. ¿El CanSat se queda dentro del cohete todo el vuelo?

## 4. Vuelo y tiempos

- [ ] **P0** ¿Hay simulación de **OpenRocket** del cohete de Hermes? Necesito: tiempo al apogeo, altitud de apogeo, velocidad al salir del riel (mínimo 55 km/h), margen de estabilidad (mínimo 2,0) y velocidad de descenso (máximo 11 m/s).
- [ ] **P0** ¿Habrá un vuelo de prueba antes del 8 de noviembre? Si no, ¿habrá al menos una prueba de banco completa?
- [ ] **P1** El paracaídas se abre por el **retardo del motor** (7 s en el G80-7T, 14 s en el H135W-14A). ¿Ese retardo coincide con el apogeo simulado?

## 5. Firmware de la T-Beam Supreme (si Hermes la usa)

- [ ] **P0** ¿Tenemos la placa física? ¿Qué versión exacta es? El GNSS cambia entre versiones (MAX-M10S o L76K).
- [ ] **P0** ¿Con qué framework se trabaja: Arduino, PlatformIO o ESP-IDF? ¿Igual que Demeter?
- [ ] **P1** Buses: *Objetivos_Sistemas* pone el barómetro y el magnetómetro en I2C0, pero también pide los sensores externos rápidos en un SPI aislado. ¿Qué sensor va en qué bus y en qué pines?
- [ ] **P1** ¿Están comprados el interruptor Hall DRV5032 y el buzzer?
- [ ] **P1** Máquina de estados: el firmware define 4 fases (Rampa, Ascenso, Costeo, Aterrizado), pero la interfaz de tierra muestra 5 (agrega Descenso). ¿Cuál es la definición oficial?
- [ ] **P1** ¿Qué configuración LoRa se usa (SF, BW, potencia)? Mandar 10 Hz con menos de 50 bytes exige un SF bajo, y si dos CanSat comparten canal, se duplica la ocupación.
- [ ] **P2** Para el volcado post-vuelo, ¿opción A (punto de acceso Wi-Fi) u opción B (goteo por LoRa)?

## 6. Estación terrena

- [ ] **P1** ¿Quién hace la interfaz gráfica y con qué tecnología: Python, web o Unity? ¿Es compartida con Demeter?
- [ ] **P1** ¿Tendremos portátil, Starlink y servidor remoto en Santa Fe de Antioquia? ¿Quién los aporta?

## 7. Equipo

- [ ] **P0** ¿Quiénes son los integrantes de Hermes y cuál es el rol de cada uno? ¿Quién más programa?
- [ ] **P1** ¿Hay un repositorio o carpeta compartida? Propuesta: un repositorio git de Hermes, y otro compartido con Demeter si el firmware o la estación son comunes.

## Referencia: preguntas sobre el VisionPack de Demeter

Solo importan si Hermes integra algo con la Pi de Demeter o si queremos ayudarles.

- ¿Dónde están `demeter_flight.sh`, `demeter_rec.cpp`, `demeter_ingestd.sh`, `demeter_postprocess.py` y las unidades systemd?
- ¿En qué fase se enciende su Pi? Si se enciende al detectar el despegue, no habrá video del ascenso.
- ¿Su Pi 5 + UPS + 2× 18650 cabe en su presupuesto de 250–300 g?
