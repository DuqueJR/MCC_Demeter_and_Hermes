---
id: pendientes
estado: vivo. Solo lo abierto: lo resuelto pasa a decisiones.md.
actualizado: 2026-10-24
historial: 99_archivo/ronda1_*.md, 99_archivo/ronda2_pendientes.md, 07_bitacora/
---
# Pendientes abiertos

**P0** bloquea el arranque del desarrollo (F0) · **P1** se necesita antes de integrar (F2–F3) · **P2** puede esperar.
**Quién responde:** PT = Pablo Tilano · Hw = equipo de hardware o estructura · J = Jerónimo · U = Juan Pablo.

**Resueltos el 2026-10-24** (ver la [bitácora](../07_bitacora/2026-10-24_sesion_repo_y_pines.md)):
- PEN-01 y PEN-02 → D-022 (pines y buses). **D-022 se reabrió el mismo día:** el M.2 es interno (ver PEN-18);
- PEN-03 → D-031 (DRV5032);
- PEN-04 → el motor H135W-8;
- PEN-06 (en parte): el CanSat va rígido;
- PEN-11 (en parte): los cables de antena están listos.

| ID | Pri | Pendiente | Por qué importa | Quién | Bloquea |
| --- | --- | --- | --- | --- | --- |
| PEN-05 | P1 | **El datasheet oficial del SX1262** (Semtech pide registro): la sensibilidad por SF/BW, los tiempos de conmutación TX/RX y la errata. Bajarlo de semtech.com a `03_hardware/datasheets/sx1262.pdf`. | Confirmar el margen de enlace (D-001) y las guardas del TDMA | U | — |
| PEN-05b | P1 | **El datasheet oficial del LSM6DSO32** (st.com): el modo y el reloj SPI, **el tamaño real del FIFO (3 o 9 KB)**, la unidad del watermark y el tiempo de encendido | El margen del bus compartido (66 o 197 ms) | U | P-02 |
| PEN-06 | P1 | **La orientación de montaje** de la placa y de cada breakout respecto al eje del cohete. Se mide en el CanSat armado. | Las matrices `R_MONTAJE` | Hw | T-302, T-802 |
| PEN-07 | P1 | **La simulación de OpenRocket de Hermes** en CSV. La de Demeter ya llegó: [perfiles_vuelo](../02_requisitos/perfiles_vuelo.md). Exportarla igual que la de Demeter ([datos/README](../../datos/README.md)). | Replay de P-03 con el perfil real de Hermes | Hw (Hermes) | — |
| PEN-08 | P1 | **Demeter: lo da la sim.** (1468,7 g al despegue, 82 g de propelente, área de referencia de 50,27 cm² y el Cd por instante). **Hermes: falta** (llega con PEN-07). | El cálculo del empuje (D-021) | Hw (Hermes) | T-802 |
| PEN-09 | P1 | **Conversación sobre la GUI (D3):** [estacion_terrena](../04_diseno/estacion_terrena.md) §3 | La tecnología del dashboard | U + J | T-603, T-605 |
| PEN-10 | P1 | **El encendido de la Pi:** el circuito desde el IO2 (J2, GLOBAL_EN o el X1200), el tiempo de arranque y el consumo | D-023 | J / Hw de Demeter | T-703, P-09 |
| PEN-11 | P2 | **El chip USB de la V1.2** (CP2104 o CH9102) | El driver en el portátil | U | T-601 |
| PEN-12 | P1 | **Verificar en el banco:** el mapa del conector M.2 frente a [buses_y_pines](../03_hardware/buses_y_pines.md) §2 y §5; dónde tomar VBAT para el DRV5032; el registro del AXP2101 que desactiva el apagado por pulsación larga; el PPS de la V1.2 en el GPIO 37; el modelo del GNSS (UBX-MON-VER); qué hace el GPIO 7; la PSRAM QSPI de 8 MB; si la memoria RTC se conserva en cada tipo de reset | Las fichas tienen esas incertidumbres | U | T-003, T-004, T-005, T-402 |
| PEN-13 | P1 | **La regulación de la ANE** en 902–928 MHz | `LORA_CANALES` y la potencia | U / PT | — |
| PEN-14 | P2 | **El hosting de la web (D4).** Se decide en la semana final. | | U + J | T-605 |
| PEN-15 | P2 | **El orden de los ángulos de Euler** para la UART de la Pi (propuesta: ZYX) | El contrato con el VisionPack | J | T-702 |
| ~~PEN-16~~ | — | **Resuelto (2026-10-24):** Hermes vuela el G80-7T y Demeter el H135W-8. | | | |
| PEN-17 | P0 | **El cableado espera a PEN-18.** Después de la verificación, el equipo de hardware cablea según la opción elegida en [buses_y_pines](../03_hardware/buses_y_pines.md) §4: pull-ups de 10 kΩ en los CS, el MMC alimentado de A_LDO1, el diodo del DRV5032 en el pad del SW3, y transistores con pull-down | Sin el cableado no hay P-01 | Hw | T-004 |
| PEN-18 | P0 | **Sesión de verificación física de la placa** (1–2 h, [buses_y_pines](../03_hardware/buses_y_pines.md) §7). Ya se tiene la lista de pines de los headers (`docs/fuentes/pines_headers_tbeam_supreme.csv`). Falta: versión V3.0 o V3.1, continuidad de PN1/PM1 (y del **IO2 frente a `RADIO_RETAIN`**), resistencias de pull en la placa madre (sin alimentación, de cada GPIO del header a 3V3 y a GND) y el firmware de prueba de T-003 (**la SD en SDMMC**, PSRAM, GNSS, PMIC) | **Cierra D-022.** El M.2 resultó ser interno, así que 35/36/37 no son accesibles | U (+ PT) | T-004, PEN-17 |
| PEN-19 | P2 | **¿El buzzer es activo (con oscilador) o pasivo?** Ya no bloquea la asignación de pines: el pulso de la Pi va en el IO2. Define si el GPIO 21 se maneja con PWM (pasivo) o con un nivel fijo (activo). | El firmware del buzzer | Hw | T-106 |
| PEN-20 | P2 | **¿Se sube `ALARMA_DESCENSO_MS` de 10 a 11 m/s, con una ventana de 2 s?** El descenso nominal de Demeter es de 9,2 m/s. | Evitar falsas alarmas | U + PT | T-604 |
