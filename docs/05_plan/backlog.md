---
id: backlog
estado: vivo
actualizado: 2026-10-24
---
# Backlog

**Columnas:**
- **Pri:** M = mínimo para volar · S = debería · C = si da el tiempo.
- **Resp.:** JP = Juan Pablo · J = Jerónimo · Ambos.
- **Estado:** `pendiente` · `en curso` · `bloqueada` · `hecha`.
- **Leer:** los documentos que la tarea necesita. Las rutas son relativas a `docs/`, y siempre se lee también [constantes.md](../02_requisitos/constantes.md).

## E0. Arranque (F0)

| ID | Tarea | Pri | Resp. | Depende de | Leer | Criterio de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | Crear el repo con `firmware/`, `estacion/`, `gui/`, `visionpack/` y `docs/`; mover la bóveda y el código de la Pi; ramas `main` y `develop`; `.gitignore`; LFS para los PDF; protección de ramas y plantilla de PR (humanos) | M | Ambos | — | 00_INDICE, decisiones D-026 y D-028, 05_plan/flujo_trabajo §8 | El repo existe con `main` y `develop`; el agente `desarrollador` puede crear su worktree | hecha (2026-10-24; falta proteger las ramas en GitHub) |
| T-002 | PlatformIO con 3 environments: `supreme_hermes`, `supreme_demeter` y `modem_v12`, con las librerías fijadas | M | JP | T-001 | 04_diseno/firmware_vuelo §1 | Los 3 compilan; `ROCKET_ID` y `MODULO_VISIONPACK` aparecen en el arranque | pendiente |
| T-003 | Arranque de la Supreme: PMIC (canales), I2C0, I2C1, UART del GNSS, SD y radio | M | JP | T-002 | 03_hardware/componentes/tbeam_supreme, axp2101, buses_y_pines | El escaneo I2C encuentra las direcciones esperadas, la SD monta y el SX1262 responde | pendiente |
| T-004 | Verificar el cableado de los sensores externos según D-022 (LSM6DSO32 y BMP581 en SPI3, MMC5983MA en I2C0) y el encendido con el DRV5032 (D-031) | M | JP | PEN-17 (cableado) | buses_y_pines, lsm6dso32, bmp581, mmc5983ma, drv5032, axp2101 | P-01: los WHO_AM_I son correctos; el imán enciende la placa; el apagado está bloqueado en ARMED | pendiente |
| T-005 | Captura del PPS en las dos placas (GPIO 6 en la Supreme, GPIO 37 en la V1.2) | M | Ambos | T-003 | max_m10s, neo_m8n, tbeam_v12_estacion | Llega un PPS por segundo con fix; la marca de tiempo tiene una fluctuación < 50 µs | pendiente |
| T-006 | Ping LoRa SF6/BW500 entre la Supreme y la V1.2 | M | Ambos | T-003 | enlace_lora_tdma §1, sx1262 | Se intercambian paquetes con CRC OK; se miden el RSSI y el SNR; el ToA medido coincide con el calculado ± 0,5 ms | pendiente |

## E1. Adquisición (F1)

| ID | Tarea | Pri | Resp. | Depende de | Leer | Criterio de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-101 | Driver del LSM6DSO32: SPI, ±32 g y ±2000 °/s, ODR configurable, FIFO con watermark, IRQ y lectura en ráfaga | M | JP | T-004 | lsm6dso32, firmware_vuelo §4–5 | 3,33 kHz sostenidos sin desborde del FIFO durante 10 min; contador de muestras = ODR × t ± 0,1 % | pendiente |
| T-102 | Driver del BMP581: SPI, OSR/ODR según la ficha, FIFO e IRQ | M | JP | T-004 | bmp581 | 240 Hz estables; ruido en reposo dentro de lo que dice la ficha | pendiente |
| T-103 | Driver del MMC5983MA a 100 Hz con SET/RESET | M | JP | T-004 | mmc5983ma | 100 Hz; la magnitud del campo es coherente (unos 0,3–0,6 G) | pendiente |
| T-104 | Sensores de la placa: QMI8658, BME280 y QMC6310 como respaldo | S | JP | T-003 | qmi8658, bme280, qmc6310 | Leen a la tasa de respaldo sin afectar a T-101..T-103 | pendiente |
| T-105 | GNSS: configuración UBX (10 Hz, airborne <4g, solo NAV-PVT, baud alto), parser y correspondencia con el PPS | M | JP | T-005 | max_m10s, firmware_vuelo §5 | 10 Hz estables; hora válida; `t_us` frente a UTC con un error < 100 µs | pendiente |
| T-106 | Mantenimiento: % y mV de batería, temperaturas del ESP32 y de la Pi | M | JP | T-003 | axp2101, esp32_s3 | Valores en STATUS | pendiente |
| T-107 | Tareas `t_bus_spi3` (dueña de SPI3: sensores y escrituras de la SD en bloques ≤ `SPI3_SD_MAX_MS`) y `t_bus_i2c0` (MMC5983MA y respaldos); marcas de tiempo por muestra y colas sin bloqueo con contador de pérdidas | M | JP | T-101..T-103 | firmware_vuelo §2, §5, buses_y_pines §3 | En P-02, cero pérdidas en las colas y cero desbordes del FIFO | pendiente |

## E2. Log (F1)

| ID | Tarea | Pri | Resp. | Depende de | Leer | Criterio de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-201 | Formato y escritor del log: buffer en PSRAM, bloques de 16 KB, archivo preasignado, rotación y pretrigger | M | JP | T-107 | firmware_vuelo §6 | P-02 en verde | pendiente |
| T-202 | Especificación escrita del formato del log (`docs/04_diseno/formato_log.md`) | M | JP | T-201 | firmware_vuelo §6 | El documento existe y el decodificador lo sigue | pendiente |
| T-203 | Decodificador en Python y exportación a CSV y Parquet | M | Ambos | T-202 | formato_log | Se decodifica un log de 10 min sin errores, con todos los tipos de registro | pendiente |

## E3. Estimación (F2)

| ID | Tarea | Pri | Resp. | Depende de | Leer | Criterio de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-301 | Estimador vertical 1D: Kalman de h, Vz y bias, con baro y acelerómetro axial, y bloqueo del baro tras la eyección | M | JP | T-107 | maquina_estados §2–3, firmware_vuelo §2 | En P-03, el error de apogeo es < 1 m y el tiempo de apogeo tiene un error < 0,3 s frente a la referencia | pendiente |
| T-302 | Madgwick, con la IMU y el magnetómetro | S | JP | T-107 | requisitos NAV-01 | En reposo, deriva < 1°/min; la alineación inicial es coherente con el norte | pendiente |
| T-303 | EKF 3D con IMU, baro y GNSS; origen en ARM | S | JP | T-301, T-105 | requisitos NAV-02, protocolo §8 | En una prueba en carro (P-13), la posición sigue al GNSS; sin GNSS, deriva de forma acotada | pendiente |
| T-304 | Generador de vuelos sintéticos en Python: perfiles G80-7T y H135W con las curvas de thrustcurve.org, ruido de los sensores, eyección antes o después del apogeo | M | Ambos | — | maquina_estados §5, constantes | Genera archivos de replay con el formato del log | pendiente |
| T-305 | Banco de replay: corre el estimador y la máquina de estados sobre logs o sintéticos (en el PC, o inyectando en la placa) | M | JP | T-304, T-301, T-401 | plan_pruebas P-03 | Un reporte automático con las fases y los tiempos de cada vuelo | pendiente |

## E4. Máquina de estados (F2)

| ID | Tarea | Pri | Resp. | Depende de | Leer | Criterio de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-401 | Máquina de estados T1–T13, el evento E1 y el Go/No-Go | M | JP | T-301 | maquina_estados | P-03 y P-04 en verde | pendiente |
| T-402 | Persistencia en RTC y NVS, y modo reanudado | M | JP | T-401 | maquina_estados §6, esp32_s3 | P-10 en verde | pendiente |
| T-403 | Eventos para el motor (t₀, t_bo, t_ej) en el log | S | JP | T-401 | firmware_vuelo §7 | Aparecen en el log y en el replay | pendiente |

## E5. Radio (F1–F2)

| ID | Tarea | Pri | Resp. | Depende de | Leer | Criterio de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-501 | Programador TDMA y fuentes de sincronía (GNSS, derivada, holdover, ALOHA) | M | JP | T-005, T-006 | enlace_lora_tdma | P-05 en verde | pendiente |
| T-502 | Codificador y decodificador de los paquetes v2, con vectores de prueba compartidos en C y Python | M | Ambos | — | protocolo_paquetes | Los mismos vectores pasan en el firmware y en Python | pendiente |
| T-503 | Manejo de comandos y ACK en el cohete | M | JP | T-502, T-401 | protocolo_paquetes §5–6 | ARM/DISARM/PING funcionan, con deduplicación por `cmd_seq` | pendiente |
| T-504 | Backfill | S | JP | T-503 | protocolo_paquetes §7 | P-11 en verde | pendiente |

## E6. Estación (F1–F3)

| ID | Tarea | Pri | Resp. | Depende de | Leer | Criterio de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-601 | Firmware del módem V1.2: maestro del TDMA, beacon y CMD, RX con destino al USB | M | J | T-005, T-006, T-502 | estacion_terrena §2.1, tbeam_v12_estacion | P-05 en verde, del lado de la estación | pendiente |
| T-602 | Servicio de tierra: serial, log crudo, decodificación, estado por cohete y comandos con reintento | M | J | T-601, T-502 | estacion_terrena §2.2 | Recibe dos cohetes durante 30 min sin perder nada en el PC | pendiente |
| T-603 | Dashboard local mínimo: números, fase, mapa offline con LKP, Go/No-Go, ARM/DISARM/FORZAR_ATERRIZADO | M | J | T-602 | estacion_terrena §2.3, requisitos GS-01..07 | Usable en P-07 | pendiente |
| T-604 | Dashboard completo: 3D, elipse, QR, alarma, tiempos estimados y gráficas | S | J | T-603 | requisitos GS-04..13 | Revisión visual | pendiente |
| T-605 | Reenviador, servidor de ingesta y frontend público | S | J | T-602, D3 | estacion_terrena §2.4 | P-08 en verde | pendiente |

## E7. VisionPack (F1–F2)

| ID | Tarea | Pri | Resp. | Depende de | Leer | Criterio de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-701 | Corregir los bloqueantes 1–4 y los riesgos 5, 7 y 8 de la revisión de la Pi | M | J | — | 06_revisiones/revision_codigo_pi_demeter | La secuencia completa simulada por UART llega a COMPLETE | pendiente |
| T-702 | Tarea `t_visionpack` en la LilyGO, según la tabla de visionpack_integracion §2 | M | J o JP | T-401 | visionpack_integracion | P-09 en verde | pendiente |
| T-703 | Circuito del pulso de encendido (drenador abierto) y entrada `cam=1` | M | Hardware de Demeter | PEN-10 | visionpack_integracion §3, raspberry_pi_5 | La Pi arranca con el comando `PI_ENCENDER` | pendiente |
| T-704 | Medir el tiempo de arranque de la Pi y su consumo con las cámaras | M | J | T-703 | raspberry_pi_5 | Cifras en constantes | pendiente |

## E8. Post-vuelo (F3)

| ID | Tarea | Pri | Resp. | Depende de | Leer | Criterio de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-801 | Wi-Fi AP con HTTP de descarga en LANDED, y el cliente en el servicio de tierra | S | JP | T-201 | firmware_vuelo §8 | Un log de 10 MB se descarga y se verifica (hash) | pendiente |
| T-802 | Script de análisis del motor: empuje, impulso y retardo | S | Ambos | T-203 | firmware_vuelo §7 | Con un vuelo sintético, recupera el impulso con un error < 5 % | pendiente |

## E9. Operación (F4)

| ID | Tarea | Pri | Resp. | Depende de | Leer | Criterio de aceptación | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-901 | Checklists de campo: preparación, integración en 15 min, Go/No-Go, recuperación y volcado | M | Ambos | P-07 | maquina_estados §4, requisitos REG-02 | Probados en el ensayo final | pendiente |
| T-902 | Procedimiento de carga del firmware, versión visible y placas de repuesto | M | JP | T-002 | firmware_vuelo §9 | Las placas de repuesto arrancan con la versión etiquetada | pendiente |
| T-903 | Kit de campo: mapas offline, cables, adaptador de antena de N a la placa, baterías y lector de SD | M | Ambos | PEN-12 | estacion_terrena | Inventario revisado | pendiente |
