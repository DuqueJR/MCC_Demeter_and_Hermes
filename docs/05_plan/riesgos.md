---
id: riesgos
estado: vivo
actualizado: 2026-10-24
---
# Registro de riesgos

Probabilidad (P) e impacto (I) en escala B/M/A. Se revisa a diario.

| ID | Riesgo | P | I | Mitigación | Prueba / tarea |
| --- | --- | --- | --- | --- | --- |
| R-01 | **No hay un host SPI libre** para los sensores externos, y compartir el bus con la SD provoca pérdida de muestras | M | A | D-022 aprobada: un solo dueño del bus, la SD en bloques ≤ 8 ms, el MMC en I2C0, los FIFO como colchón; si falla, bajar la IMU a 1,66 kHz y luego el plan B con SDMMC. **Hay que correr P-02 cuanto antes.** | P-01, P-02 |
| R-02 | Latencia de escritura de la SD (100–250 ms) | M | A | Buffer de 512 KB en PSRAM, archivo preasignado, bloques de 16 KB, tarjeta A1/A2 probada | P-02 |
| R-03 | Sin vuelo previo, las transiciones de la máquina de estados fallan con datos reales | M | A | Estimador vertical simple (D-011), replay de más de 20 vuelos, prueba de manipulación, umbrales conservadores | P-03, P-04, P-14 |
| R-04 | El EKF 3D no está listo o diverge | A | M | No decide transiciones; es "debería"; la telemetría cae al GNSS crudo con `EKF_OK = 0` | P-13 |
| R-05 | Interferencia de otros equipos en 915 MHz | M | M | SF6/BW500 en un canal distinto de 915,0; CRC propio con validación de cabecera; escaneo del canal en el sitio | P-15 |
| R-06 | El GNSS pierde el seguimiento en el impulso (AIR4 solo garantiza < 4 g, y el impulso llega a 5–20 g) | A | B | Holdover de 120 s; el EKF sigue desde el origen; AIR4; solo GPS+GAL para recuperar rápido a 10 Hz | P-05, P-13 |
| R-07 | Reinicio del ESP32 en vuelo (brownout o watchdog) | B | A | Modo reanudado con la fase persistida | P-10 |
| R-08 | La Pi no está lista al despegue o su software no completa la misión (bugs conocidos) | A | A (Demeter) | Corregir los bloqueantes (T-701); encenderla en PREFLIGHT; Go/No-Go exige READY | P-09 |
| R-09 | El pico de presión de la eyección engaña al barómetro | M | M | Bloquear el baro 300 ms después del evento E1; el apogeo se confirma con la IMU | P-03 (sintético) |
| R-10 | Las piezas de PETG-CF atenúan el LoRa o el GNSS | B | M | Antenas por fuera de esas piezas (confirmado por el usuario) | P-06 con el cohete armado |
| R-11 | El CanSat no va rígido en la bahía, lo que invalida la caracterización del motor | B | M | **Mitigado:** el usuario confirmó el 2026-10-24 que va rígido. Falta la orientación de montaje. | PEN-06 |
| R-12 | Calendario: 12 días hábiles, dos programadores | A | A | El mínimo para volar (plan_maestro §1); congelar el código el 4 de noviembre; recortar primero lo "debería" | Hitos H0–H4 |
| R-13 | El PPS de la estación (V1.2, GPIO 37) no está cableado como dice el esquemático | B | M | Plan B: la estación se sincroniza con los paquetes de los cohetes, que están en `GNSS` (regla D-003) | T-005 |
| R-14 | El imán apaga la placa en la rampa o en vuelo (pulsación larga del PMIC), o el DRV5032 no enciende la placa | B | A | D-031: el diodo hacia `PWR_KEY`; el apagado por pulsación larga se desactiva desde ARMED; verificarlo en P-07 | P-07, PEN-12 |
| R-15 | Falta el adaptador de antena (de conector N a la V1.2) el día del concurso | B | A | **Cerrado:** los cables de antena ya están listos (2026-10-24). Solo queda incluirlos en el kit de campo. | T-903 |
