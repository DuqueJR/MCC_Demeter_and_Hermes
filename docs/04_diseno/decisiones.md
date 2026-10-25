---
id: decisiones
estado: vivo. Registro de decisiones (ADR compacto).
actualizado: 2026-10-24
---
# Registro de decisiones

**Reglas:**
- Una decisión **aprobada** no se reabre sin una razón nueva. Para cambiarla se agrega una decisión nueva que diga a cuál reemplaza.
- Si una decisión está **propuesta**, el código puede avanzar, pero queda marcado para revisión.
- Quién decide: **U** = el usuario (Juan Pablo) · **PT** = Pablo Tilano · **J** = Jerónimo · **C** = propuesta de Claude que el usuario delegó o aceptó.

| ID | Decisión | Estado | Quién | Dónde |
| --- | --- | --- | --- | --- |
| D-001 | LoRa: SF6, BW 500 kHz, CR 4/5, preámbulo 8, cabecera explícita, CRC activado, sync word 0xD3, 22 dBm, canal configurable (919 MHz por defecto). Plan B: SF5. | Aprobada | C (el usuario pidió "la opción más segura") | [enlace_lora_tdma](enlace_lora_tdma.md) §1 |
| D-002 | TDMA con ciclo de 100 ms alineado a UTC y 4 slots de 25 ms (slot = ID del nodo); TX en +2 ms; tiempo en el aire ≤ 16 ms | Aprobada | U (nota original) + C (guardas) | §2 |
| D-003 | Sincronía: GNSS-PPS, luego derivada del beacon o de un paquete, luego holdover de 120 s. La estación hace de maestro libre si no tiene referencia. Hay regla anticiclos. | Aprobada | U + C | §3 |
| D-004 | Sin referencia: el cohete pasa a ALOHA a 2 Hz con un retardo aleatorio y nunca deja de transmitir. La estación nunca usa ALOHA. | Aprobada | C (delegada) | §4 |
| D-005 | Little-endian, empaquetado, saturación, valores reservados de "sin dato" y CRC-16/CCITT-FALSE propio | Aprobada | C | [protocolo_paquetes](protocolo_paquetes.md) §0 |
| D-006 | Cabecera común de 3 B: versión y tipo, origen y sync, seq | Aprobada | U | §1 |
| D-007 | NAV de 44 B a ≈ 9 Hz y STATUS de 42 B a 1 Hz. Se quita el giro del enlace. Marco ENU, cuaternión Q15, altitud AGL en dm, Vz positiva hacia arriba. | Aprobada | U ("hazlo más pequeño") + C | §2, §3, §8 |
| D-008 | Comandos con `cmd_seq`, reintentos hasta el ACK y tabla de fases permitidas | Aprobada | C | §5 |
| D-009 | El backfill reenvía todos los NAV del vuelo, uno por ciclo. Pedir rangos queda para la v2. | Aprobada | U (opción B solo para paquetes perdidos) | §7 |
| D-010 | Ninguna transición por tiempo en la LilyGO; solo ventanas de confirmación. La Pi conserva sus watchdogs. La única transición manual es `FORZAR_ATERRIZADO`. | Aprobada | PT + U | [maquina_estados](maquina_estados.md) §2 |
| D-011 | La máquina de estados decide con un estimador vertical 1D (baro + acelerómetro); el EKF 3D no decide las transiciones | Aprobada | C | §2 |
| D-012 | ERROR solo en tierra; en vuelo, las fallas son un bitmap | Aprobada | U (aceptó B3) | §2 |
| D-013 | Go/No-Go para ARM: fix GNSS 3D obligatorio, TDMA sincronizado, sensores, calibración, SD, batería y Pi (Demeter) | Aprobada | U (fix obligatorio) + C | §4 |
| D-014 | La eyección es un evento, no un estado. La máquina acepta eyecciones antes o después del apogeo. La alarma de descenso solo cuenta en DESCENT. | Aprobada | C | §5 |
| D-015 | La fase se guarda en memoria RTC y en NVS, y existe el modo reanudado | Aprobada | U (aceptó B6) | §6 |
| D-016 | PlatformIO + Arduino-ESP32, un solo binario con `ROCKET_ID` y `MODULO_VISIONPACK` | Aprobada | U (aceptó D1) | [firmware_vuelo](firmware_vuelo.md) §1 |
| D-017 | Núcleo 1 para sensores, fusión y máquina de estados; núcleo 0 para radio, GNSS, log y Wi-Fi. Cada bus tiene una sola tarea dueña. | Aprobada | C | §2 |
| D-018 | Tasas: IMU a 3,33 kHz y ±32 g en vuelo; baro a 240 Hz; mag a 100 Hz; GNSS a 10 Hz | Propuesta | C (validar con P-02) | §4 |
| D-019 | Base de tiempo única `t_us` (esp_timer) y correspondencia con UTC en cada PPS | Aprobada | C | §5 |
| D-020 | Log binario con buffer en PSRAM y pretrigger; decodificador en Python | Aprobada | C | §6 |
| D-021 | Caracterización del motor en post-proceso: empuje, impulso, combustión y retardo real | Aprobada | U (es un objetivo) + C | §7 |
| D-022 | **REABIERTA (2026-10-24).** La versión anterior suponía que el M.2 era externo, y es el conector interno entre la placa madre y la de periféricos, así que 35/36/37 no son accesibles. Propuesta B′: la SD a SDMMC de 1 bit, SPI3 por el header PN1 como bus dedicado de sensores (SCK 46, MOSI 45, MISO 3, CS 38/48, INT 39), el MMC en I2C0, el QMI8658 deshabilitado, el buzzer en el 21, **el pulso a la Pi en el IO2** (confirmado en la lista de pines del usuario) y los breakouts alimentados de DC1. Alternativa A′: soldar a R32–R34. Se cierra con PEN-18. | Abierta | C (delegada por U) | [buses_y_pines](../03_hardware/buses_y_pines.md) §0, §4 |
| D-023 | Comandos UART a la Pi según las transiciones; la Pi se enciende en PREFLIGHT con un pulso a masa | Propuesta | C (validar con J) | [visionpack_integracion](visionpack_integracion.md) |
| D-024 | El módem de la estación es "tonto": reenvía crudo por USB con la misma trama AA 55 | Propuesta | C | [estacion_terrena](estacion_terrena.md) |
| D-025 | Servicio de tierra con log crudo primero; dashboard local sin internet; web pública de solo lectura; **ningún comando desde internet**; hosting sencillo, que se elige al final | Propuesta (la regla de seguridad está aprobada) | U + C (falta conversar D3) | estacion_terrena |
| D-026 | Repo único compartido, con `firmware/`, `estacion/`, `gui/`, `visionpack/` y `docs/`. Se crea cuando la documentación esté lista. | Aprobada | U (aceptó D2) | [plan_maestro](../05_plan/plan_maestro.md) |
| D-027 | Plan de pruebas en tierra (no hay vuelo previo) | Aprobada | U (aceptó F2) | [plan_pruebas](../05_plan/plan_pruebas.md) |
| D-028 | Gitflow: `main` y `develop`; ramas `feature/T-xxx` desde `develop`, una tarea por rama y por worktree; PR obligatorio con revisión humana; merge `--no-ff`; Conventional Commits en español con el ID de la tarea | Aprobada | U | [flujo_trabajo](../05_plan/flujo_trabajo.md) |
| D-029 | Cada paso se documenta en `07_bitacora/`, un archivo por entrada. El documentador (el Claude principal) consolida el backlog, las decisiones, los pendientes y las pruebas. | Aprobada | U | flujo_trabajo §6 |
| D-031 | El DRV5032 (Adafruit 6051, omnipolar) va a `PWR_KEY` del AXP2101 por un diodo Schottky, **soldado al pad del botón PWR (SW3)**, porque `PWR_KEY` no está en los headers. Se alimenta de VBAT (PM1). El imán enciende la placa, y el apagado por pulsación larga se desactiva desde ARMED hasta LANDED. `cam=1` se deriva de la UART, sin GPIO. | Aprobada | C (delegada por U) | buses_y_pines §5 |
| D-033 | Los datos de entrada (simulaciones y logs de referencia) van en `datos/`, sin editarse, con su catálogo en `datos/README.md` y su análisis en `docs/02_requisitos/perfiles_vuelo.md` | Aprobada | C | [perfiles_vuelo](../02_requisitos/perfiles_vuelo.md) |
| D-032 | Estructura del repo: `firmware/` (PlatformIO con 3 environments, incluido el módem), `estacion/`, `gui/`, `visionpack/`, `tools/`, `docs/` (la bóveda) y `docs/fuentes/` (los documentos originales). Remoto: `github.com/DuqueJR/MCC_Demeter_and_Hermes`. | Aprobada | U + C | README del repo |
| D-030 | Agente `desarrollador` (`.claude/agents/desarrollador.md`): Sonnet, `isolation: worktree`, una tarea por invocación, sin merges ni cambios de contrato | Aprobada | U | flujo_trabajo §1 |
