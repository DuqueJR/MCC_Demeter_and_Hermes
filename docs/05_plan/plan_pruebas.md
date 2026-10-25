---
id: plan_pruebas
estado: aprobado (D-027)
actualizado: 2026-10-24
---
# Plan de pruebas en tierra

**No habrá vuelo previo.** Todo lo que se pueda romper el 8 de noviembre se prueba aquí antes.

**Cómo se registra cada prueba:** fecha, versión del firmware (hash), hardware usado, resultado y el log adjunto. El registro va en `05_plan/registro_pruebas.md`, que se crea con la primera prueba.

| ID | Prueba | Valida | Cómo | Criterio de éxito |
| --- | --- | --- | --- | --- |
| P-01 | Arranque de los buses | D-022, HW-06, HW-07 | Leer el ID de cada sensor en su bus definitivo, en frío y después de 100 reinicios | 100 % de las lecturas correctas |
| P-02 | Estrés de bus y SD | DAT-02..05, D-018 | Todos los sensores a tasa de vuelo, más la radio en TDMA y el log, durante 10 min, **con la SD de vuelo** | 0 desbordes del FIFO, 0 pérdidas en las colas; latencia máxima de escritura < 50 % del buffer |
| P-03 | Replay de vuelos | NAV-04, D-010..D-014 | Correr el estimador y la máquina de estados sobre **la sim. de OpenRocket de Demeter** (`datos/simulaciones/openrocket/`, eyección 1,46 s antes del apogeo), sobre la de Hermes cuando llegue, y sobre al menos 20 variantes sintéticas (T-304): G80 y H135W, eyección antes, en y después del apogeo, ruido ×1 y ×3 | Secuencia de fases correcta en el 100 % de los casos; error de apogeo < 0,3 s; cero transiciones falsas |
| P-04 | Manipulación | T6 | Golpes, caídas desde 1 m sobre espuma, sacudidas y transporte en carro, en ARMED | Nunca se dispara BOOST |
| P-05 | TDMA | GS-01, D-002..D-004 | Dos cohetes y la estación durante 30 min; quitar el GNSS de un cohete; apagar y prender la estación | 0 colisiones (ningún paquete fuera de su slot); recuperación de la sincronía < 2 s; ALOHA y holdover se comportan como se especificó |
| P-06 | Alcance | D-001 | Con línea de vista, a 1, 2 y 3 km (o lo máximo posible), con la antena del cohete en varias orientaciones, a 22 dBm | PER < 5 % a 2 km; margen de SNR documentado |
| P-07 | Ensayo de integración | REG-02, D-013 | Cronometrado: imán → BOOT → PREFLIGHT → Go/No-Go → ARM, con los dos cohetes | ≤ 15 min; el checklist se cumple sin improvisar |
| P-08 | Web de punta a punta | GS-12 | Estación → Starlink (o red móvil) → servidor → navegador externo | Latencia < 2 s; si se corta internet, lo local no se afecta |
| P-09 | VisionPack | D-023 | Comando `PI_ENCENDER`, la secuencia UART completa con los eventos simulados, y la pérdida de la UART en pleno "vuelo" | La Pi llega a COMPLETE; sus watchdogs actúan solo si se pierde la LilyGO |
| P-10 | Reinicio en vuelo | D-015 | Reiniciar el ESP32 (por watchdog y por corte de energía) durante un replay, en COAST y en DESCENT | Entra en modo reanudado con la fase correcta y sin pedir Go/No-Go |
| P-11 | Volcado y backfill | DAT-09 | Después de una misión en el banco: backfill LoRa completo y descarga por Wi-Fi | El backfill completa los huecos; el hash del archivo descargado coincide |
| P-12 | Autonomía | — | Cohete en ARMED hasta llegar a `BAT_MIN_ARM_PCT`; Demeter con la Pi encendida | Al menos 2 h de espera en rampa (P) |
| P-13 | GNSS y EKF en movimiento | NAV-02, T-105 | Carro o dron, con el GNSS a 10 Hz y el EKF | El EKF sigue al GNSS; sin GNSS, la deriva queda acotada |
| P-14 | Barómetro con presión variable | NAV-04 | Frasco sellado con una jeringa (o un ascensor): subida y bajada de presión | El estimador detecta el "apogeo" en el máximo de altitud equivalente |
| P-15 | Escaneo del canal en el sitio | D-001 §6 | Escuchar los canales durante 1 min antes de la integración | Se elige un canal sin actividad |
