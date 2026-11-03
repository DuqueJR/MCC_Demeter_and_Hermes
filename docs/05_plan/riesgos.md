---
id: riesgos
estado: vivo
actualizado: 2026-11-03
---
# Registro de riesgos

Probabilidad (P) e impacto (I) en escala B/M/A. Se revisa a diario.

| ID | Riesgo | P | I | Mitigación | Prueba / tarea |
| --- | --- | --- | --- | --- | --- |
| R-01 | **No hay un host SPI libre**, y los pines 35/36/37 no son accesibles porque el M.2 es interno. La SD en SDMMC podría no funcionar (no hay pull-ups en CMD y D0; en la V3.0 hay MOSFETs de cambio de nivel). | A | A | **Cerrado (2026-11-03, D-042):** Pablo resolvió los buses con un SPI por software y el hub del LSM. | P-01, P-02, T-003 |
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
| R-14 | El imán apaga la placa en la rampa o en vuelo (pulsación larga del PMIC), o el DRV5032 no enciende la placa | B | A | **Cerrado (2026-11-03, D-042):** el imán solo despierta del sueño profundo (IO21); ya no actúa sobre `PWR_KEY`. | P-07, PEN-12 |
| R-15 | Falta el adaptador de antena (de conector N a la V1.2) el día del concurso | B | A | **Cerrado:** los cables de antena ya están listos (2026-10-24). Solo queda incluirlos en el kit de campo. | T-903 |
| R-16 | **La web y el dashboard de operación compiten por el tiempo del back crítico** (las mismas dos personas; Jerónimo con la sesión A del back y el carril D) | A | M | La web se pausa si el back se atrasa; la operación crítica está en la CLI (DP-15); los agentes escriben y los humanos revisan. El detalle está en R-W1 a R-W8 de [08_gui/06](../08_gui/06_plan_web.md) §8. | — |
| R-17 | **No hay detección de BOOST:** si LAUNCH no llega, no se registra el vuelo, y en vuelo las protecciones de los comandos no actúan (C1 de la [revisión](../06_revisiones/revision_firmware_pablo.md)) | M | A | T-410 antes del congelamiento; mientras tanto, el operador manda `momento boost` al ver el despegue (checklist) | T-410 |
| R-18 | **Dos versiones del firmware de vuelo** (la de Pablo y nuestra copia), o placas cargadas desde commits distintos. Sin byte de versión, tierra decodifica mal sin avisar | M | A | D-045: una sola fuente (nuestro repo) después de T-008; un hash único para los tres firmware; el hash anotado en el checklist; PEN-23 (hash en `FILEHDR`) | T-008, T-902 |
| R-19 | **Pablo es el único que conoce el firmware** que ahora mantenemos nosotros: un cuello de botella a 5 días del vuelo | A | A | T-007 (que compile en cualquier portátil); T-902 (dos portátiles); que Juan Pablo y Jerónimo operen `dashboard.py` en el ensayo del 5 de noviembre; Pablo revisa los PR de firmware (T-410 a T-413) | T-007, T-902 |
| R-20 | **Enlace sin probar a 22 dBm ni a distancia;** 903 MHz sin verificar contra la regulación | M | A | T-415 el 4 de noviembre; escanear el canal en el sitio con la estación | T-415, PEN-13 |
| R-21 | **Se pierde o difiere la clave HMAC** entre las placas: no se puede armar | B | A | PEN-26; un `ping` a los dos cohetes en el checklist | T-901 |
| R-22 | **Demasiado alcance para 5 días:** [brechas_objetivos](brechas_objetivos.md) pone todo en el plan, pero no todo cabe antes del 8 de noviembre | A | A | Orden estricto por prioridad (M → S → C); lo C no bloquea el vuelo; se recorta a diario en la sincronización | backlog E10–E12 |
