---
id: dos_sesiones_punto_de_control
estado: vivo (foto al 2026-10-25; base 6c649f3 de develop)
actualizado: 2026-10-25
depende_de: [proyecto, requisitos, constantes, componentes, buses_y_pines, decisiones, plan_maestro, backlog, pendientes, riesgos]
---
# Punto de control (Etapa 1)

**Qué es:** la foto completa del proyecto al 2026-10-25, antes de planear el trabajo de dos sesiones.

**Base:** el commit `6c649f3`, que es igual en `develop` y en `main`. En GitHub no hay issues ni PR.

**Cómo se hizo:**
- **Lectura completa:** `CLAUDE.md`, `README.md`, el agente `desarrollador`, la plantilla de PR, todo `docs/` (00 a 07), los README de cada carpeta y las fuentes originales (`Objetivos_Sistemas.pdf`, los dos `.docx`, el `.xlsx` y el CSV de pines).
- **Por muestreo:** el código de la Pi, para confirmar los bugs de la revisión.
- **Con búsquedas puntuales:** `docs/99_archivo/` (es historia, regla 6 del índice) y los datasheets.
- **Hardware y viabilidad:** con dos subagentes de solo lectura.
- **Tiempo en el aire:** recalculado a mano.

**Etiquetas:** **[repo]** = está en el repo (con la ruta) · **[inferencia]** = lo dedujo el planificador · **[por verificar]** = sin fuente confirmada.

## 0. Resumen

1. **Quedan 14 días y no hay código.**
   - El vuelo es el 8 de noviembre y el código se congela el 4 de noviembre a las 12:00, así que quedan unos 10 días de desarrollo ([plan_maestro](../plan_maestro.md)).
   - Solo está hecha T-001, la creación del repo ([backlog](../backlog.md)).
2. **El diseño v1 es sólido.** Hay contratos aprobados de protocolo, TDMA, máquina de estados y UART de la Pi. El plan de dos sesiones se monta **sobre el backlog existente**.
3. **Sin ARM no hay vuelo útil.**
   - La máquina de estados solo pasa a BOOST desde ARMED ([maquina_estados](../../04_diseno/maquina_estados.md), T4 y T6).
   - El único medio previsto para mandar ARM era el dashboard (T-603).
   - **Resuelto:** el servicio de tierra tiene una **consola de texto (CLI)** que hace todas las operaciones críticas. La GUI la hace otro plan, sobre la API del back-end.
4. **Hay dudas de hardware que pueden tumbar partes del diseño:**
   - el radio de la V1.2 (SX1262 o SX1276);
   - el PMU marcado **TG28-ESP** (¿compatible con el AXP2101?);
   - el magnetómetro de la V3.1 (**QMC6309**).
5. **D-022 sigue abierta.** El bus de sensores y la SD dependen de una sesión física con la placa (PEN-18), y de esa sesión dependen el cableado y la ruta crítica del firmware.

## 1. Datos de partida (respuestas del equipo, 2026-10-25)

| Tema | Lo que hay |
| --- | --- |
| Personas | **Jerónimo** (sesión A) y **Juan Pablo** (sesión B). Trabajan **en el mismo lugar**, de forma síncrona o asíncrona. Las dos cuentas son **Pro**. |
| Hardware | **Dos CanSat iguales**, cada uno con una **T-Beam Supreme V3.1** (una por cohete), y **una sola estación** con una **T-Beam V1.2** para los dos cohetes. **No hay placas de repuesto.** |
| Placa de desarrollo | Supuesto, sin confirmar: **una Supreme de desarrollo compartida (Supreme-D)**. La otra (**Supreme-R**) se usa solo en las jornadas conjuntas. Ver [PA-01](11_preguntas_abiertas.md). |
| Lista de hardware | Sale de **leer los chips**: ESP32-S3FN8, SX1262, MAX-M10S, **PMU TG28-ESP**, QMI8658, BME280, **RTC Belling BM8563** (cristal de 32,768 kHz y batería de respaldo) y **PSRAM AP Memory APS6404L-3SQR**. Es evidencia física fuerte de **qué** chip hay, no de cómo está conectado ni de qué driver lo soporta. |
| Qué cambia entre cohetes | Solo la configuración: `ROCKET_ID` (que fija el slot TDMA), `MODULO_VISIONPACK` y la etiqueta de cohete en tierra. **Los tres nodos usan el mismo canal**: los cohetes se separan por slot ([enlace_lora_tdma](../../04_diseno/enlace_lora_tdma.md) §2 y §6). |
| Alcance | **Solo el back-end.** La GUI y el dashboard los lleva otro plan. |
| Estado de PEN-17 (cableado), PEN-18 (verificación física) y código fuera del repo | **Por confirmar por el equipo.** Se toma el repo como única fuente. |

## 2. Inventario

| Ruta | Qué es | Para qué sirve |
| --- | --- | --- |
| [`CLAUDE.md`](../../../CLAUDE.md) | Reglas para Claude | El Claude principal documenta y **no escribe código**. El agente `desarrollador` (Sonnet) programa una tarea por worktree. |
| [`.claude/agents/desarrollador.md`](../../../.claude/agents/desarrollador.md) | Agente desarrollador | Gitflow, commits, bitácora; prohibido cambiar contratos |
| [`.github/pull_request_template.md`](../../../.github/pull_request_template.md) | Plantilla de PR | Checklist de "definido como hecho" |
| [`docs/00_INDICE.md`](../../00_INDICE.md) | Mapa de la bóveda | Reglas de la documentación |
| [`docs/01_contexto/proyecto.md`](../../01_contexto/proyecto.md) | Contexto y alcance | Define qué es del equipo de software |
| [`docs/02_requisitos/`](../../02_requisitos/) | Requisitos, constantes (la única fuente de números) y perfiles de vuelo | Base de verificación |
| [`docs/03_hardware/`](../../03_hardware/componentes.md) | Directorio de componentes, 26 fichas, buses y pines, 19 datasheets en `.md` | Drivers y cableado |
| [`docs/04_diseno/`](../../04_diseno/decisiones.md) | Contratos (protocolo, enlace, máquina de estados, UART de la Pi), diseño (firmware, estación) y decisiones D-001 a D-033 | Lo que se implementa |
| [`docs/05_plan/`](../plan_maestro.md) | Plan maestro, backlog (unas 45 tareas), pruebas P-01 a P-15, riesgos R-01 a R-15, pendientes PEN-xx, flujo de trabajo | Plan v1, sin coordinación entre sesiones |
| [`docs/06_revisiones/`](../../06_revisiones/revision_codigo_pi_demeter.md) | Revisión del código de la Pi | 4 bloqueantes y 4 riesgos altos |
| [`docs/07_bitacora/`](../../07_bitacora/README.md) | 8 entradas del 23 y 24 de octubre | Historia |
| `docs/99_archivo/` | Rondas de preguntas y notas originales | Solo historia |
| `docs/fuentes/` | `Objetivos_Sistemas.pdf`, `Tabla_componentes.xlsx`, dos `.docx`, CSV de pines | Originales |
| [`datos/`](../../../datos/README.md) | Simulación de OpenRocket de **Demeter** (H135W-8) | Replay y umbrales. **Falta la de Hermes** |
| `firmware/`, `estacion/`, `gui/`, `tools/` | Solo un README cada una | Vacías |
| [`visionpack/`](../../../visionpack/README.md) | 3 scripts de Python de la Pi | Con bugs. Faltan `demeter_flight.sh`, `demeter_rec.cpp`, `demeter_ingestd.sh`, `demeter_postprocess.py` y las unidades systemd |

## 3. Mapa de sistemas

La frontera sale de [proyecto.md](../../01_contexto/proyecto.md), sección "Alcance del equipo de software", y la confirmó el equipo el 2026-10-25.

| # | Sistema | Qué hace | Requisitos | Estado | ¿Nuestro? |
| --- | --- | --- | --- | --- | --- |
| S1 | Computadora de vuelo (firmware de la Supreme) | Adquisición, log, estimación, máquina de estados, armado de la telemetría | HW-02/05/06/07, DAT-01..06, DAT-10, NAV-01..05 | Diseño aprobado v1; D-022 abierta; sin código | **Sí** |
| S2 | Enlace LoRa y TDMA (las dos puntas) | Ciclo de 100 ms, 4 slots, sincronía por PPS, protocolo v2 | DAT-07/08, GS-01, GS-07 | Contrato aprobado; sin código | **Sí** |
| S3 | Firmware del módem (V1.2) | Maestro del TDMA, beacon y CMD, reenvío crudo por USB | GS-01, GS-07 | Propuesta (D-024); **la trama USB no está definida** | **Sí** |
| S4 | Servicio de tierra (back-end) | Log crudo, decodificación, estado por cohete, comandos con reintento, cálculos, **CLI**, **API para la GUI**, reenviador | GS-02, 03, 05, 06, 07, 08, 13, 14 (la lógica) | Sin código | **Sí** |
| S5 | GUI, dashboard y frontend público, más el relay público (T-640) | Visualización y difusión | GS-04, 09, 10, 11, 12 (lo visual) | Plan propio en la rama `docs/plan-web` (`docs/08_gui/`), con su contrato de datos `web-1` | **No: otro plan** |
| S6 | Energía y encendido | PMIC, % de batería, encendido por imán, bloqueo del apagado | HW-01, HW-02 | D-031 aprobada; cableado de Hw | **Firmware sí, cableado no** |
| S7 | Integración con el VisionPack (Demeter) | UART AA 55, pulso de encendido, comandos por fase; daemons de la Pi | HW-03, HW-04 | D-023 en propuesta; la Pi tiene bugs | **Sí.** T-701 es back-end de la Pi: nuestro **por confirmar** |
| S8 | Datos y post-vuelo | Decodificador del log, volcado por Wi-Fi, backfill, motor, generador sintético, replay | DAT-09, DAT-10, GS-08 | Sin código | **Sí** |
| S9 | Recuperación | La eyección del motor abre el paracaídas | REG-01 | Fuera del software. Solo se **detecta** E1 | **No** |
| S10 | Cohete, estructura, motor, masa, OpenRocket | — | — | Lo da otro equipo | **No** (pero dependemos de sus datos) |
| S11 | Operación de campo | Checklists, integración en ≤ 15 min, kit | REG-02, REG-03 | Sin hacer (T-901..903) | Compartido |

**Por confirmar** ([PA-02](11_preguntas_abiertas.md)):
- **T-701:** nuestro según el criterio de back-end, pero sin confirmar.
- **El reenviador:** el plan web (rama `docs/plan-web`) lo deja en el back-end como **T-605a**, así que es **nuestro**.
- **La ingesta y el relay:** el plan web los toma como **T-640**, así que **no son nuestros**.
- Los dos últimos esperan que el plan web cierre su PEN-W06.

## 4. Mapa de hardware (T-Beam Supreme V3.1)

### 4.1 La lista leída en los chips frente al repo

| Chip leído | El repo dice | Veredicto |
| --- | --- | --- |
| ESP32-S3FN8 | Igual ([componentes](../../03_hardware/componentes.md)) | ✅ El FN8 **no trae PSRAM dentro del chip** (datasheet `esp32_s3.md`), así que la PSRAM es externa. |
| SX1262 | Igual | ✅ **La banda (868 o 915 MHz) está por verificar.** El repo da por hecho 915. |
| MAX-M10S | Igual | ✅ Falta UBX-MON-VER (PEN-12). |
| **PMU TG28-ESP** | **AXP2101** en todo el repo; XPowersLib; I2C1, 0x34 | ❌ **No se encontró ninguna fuente** que diga que el TG28 es un AXP2101 remarcado o compatible en registros [por verificar]. **Afecta a HW-01, HW-02 y D-031.** |
| QMI8658 | Igual (QMI8658A) | ✅ El esquemático también dibuja un U5 "MPU-6886" sin conectar. |
| BME280 | Igual (0x77, o 0x76 con un puente) | ✅ |
| **RTC BM8563** con batería de respaldo | **PCF8563** en 0x51 (el esquemático V3.1 también dice PCF8563) | ⚠️ El BM8563 usa 0x51 y es probablemente compatible con el PCF8563 [por verificar]. **La batería de respaldo es evidencia física**; el repo no le da ningún uso. |
| **PSRAM APS6404L-3SQR** | "8 MB QSPI" sin nombrar el chip | ✅ Es una PSRAM **QSPI de 8 MB** [por verificar con la hoja de AP Memory]. Eso resuelve la contradicción del wiki de LilyGO ("OPI") a favor de **QSPI**. **Los GPIO 35, 36 y 37 quedan libres de PSRAM**, así que B′ sigue siendo viable en ese punto. Hay que compilar con QSPI. |
| *(no listado)* magnetómetro de la placa | **QMC6310** (0x1C o 0x3C) | ❌ LilyGO documenta que **la V3.1 trae un QMC6309 en 0x7C** ([hardware de la T-Beam Supreme](https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/blob/master/docs/en/t_beam_supreme/t_beam_supreme_hw.md)), y el esquemático V3.1 dice QMC6309. **Hay que leer el chip.** |
| *(no listado)* OLED SH1106, microSD, botones, LED de PPS, QWIIC, PN1/PM1 | En el repo | La SD es crítica; la OLED solo se usa en tierra |

### 4.2 Buses, pines y direcciones

La fuente es [buses_y_pines](../../03_hardware/buses_y_pines.md); este cuadro lo resume y no lo reemplaza.

| Bus | Pines | Dispositivos | Notas |
| --- | --- | --- | --- |
| I2C0 | SDA 17, SCL 18 (pull-ups a A_LDO1) | OLED 0x3C/0x3D · BME280 0x77 · magnetómetro de la placa (QMC6310: 0x1C/0x3C; **QMC6309: 0x7C**) · **MMC5983MA externo, 0x30** | La 0x7C cae en el rango reservado del I2C: hay que confirmar que el escáner la recorra [inferencia] |
| I2C1 | SDA 42, SCL 41 | PMU 0x34 · RTC 0x51 | IRQ del PMU en el 40; INT del RTC en el 14 |
| SPI2 | 12/11/13, CS 10, RST 5, BUSY 4, DIO1 1 | SX1262 | Solo la radio |
| SPI3 interno | 36/35/37 | SD (CS 47) + QMI8658 (CS 34, INT 33) | **No sale a ningún header** |
| SPI de sensores (B′, provisional) | SCK 46, MOSI 45, MISO 3, CS 38/48, INT 39 | LSM6DSO32 + BMP581 | Depende de PEN-18 |
| UART GNSS | TX 8, RX 9, **PPS 6**, EN 7 | MAX-M10S | |
| UART0 | 43/44 | Pi de Demeter | ⚠️ Es la UART donde la ROM imprime los mensajes de arranque |
| Salidas | 21 buzzer · 2 pulso a la Pi | | El IO2 comparte lugar con la red `RADIO_RETAIN`: hay que medirlo |

**Conflictos y riesgos de conexión:**
- **Pines de strapping 45 y 46** [por verificar, riesgo alto]:
  - En SPI, MOSI y SCK de los breakouts son sus pines SDA y SCL.
  - Los breakouts de Adafruit suelen traer pull-ups de unos 10 kΩ en esas líneas.
  - Si los traen, el **45 queda en alto en el arranque** y fija la flash a 1,8 V: **la placa no arranca** (datasheet `esp32_s3.md`, strapping). Hay que medirlo antes de conectar.
- **UART0 hacia la Pi** [inferencia]: la Pi va a recibir los mensajes de arranque de la ROM cada vez que la placa arranque. El decodificador AA 55 debería descartarlos; hay que probarlo en P-09.
- **Contradicciones internas sobre la alimentación:**
  - El CSV de pines dice que A-LDO2 alimenta el QMI8658 y el BME280; LilyGO dice que es ALDO1.
  - El MMC5983MA va a DC1 según `buses_y_pines` y `constantes`, pero a A_LDO1 según PEN-17 y una bitácora. Corrección aprobada: [DP-06](09_decisiones.md), que hay que consultar con el equipo de hardware.

### 4.3 Componente → sistema → requisito

| Componente | Sistema | Requisitos | ¿Se aprovecha? |
| --- | --- | --- | --- |
| ESP32-S3 | S1, S8 | DAT-01, DAT-09 | Sí. BLE no se usa |
| SX1262 | S2 | DAT-07, GS-01, GS-07 | Sí |
| MAX-M10S | S1, S2 (PPS) | DAT-06, NAV-05, D-003 | Sí. El *batching* interno del GNSS no se usa |
| PMU TG28-ESP | S6 | HW-01, HW-02 | Sí, **si es compatible** |
| QMI8658 | S1 (respaldo) | — | **No en B′**: queda deshabilitado |
| BME280 | S1 (respaldo) | — | Respaldo; la humedad no se usa |
| Magnetómetro de la placa | S1 (respaldo) | — | Respaldo (QMC6309) |
| **RTC BM8563 con batería** | — | Ninguno | **No tiene papel en el diseño.** Con batería podría dar la hora UTC desde el arranque, antes del fix, para nombrar los archivos y la sesión de tierra [inferencia]. Ver [DP-10](09_decisiones.md). |
| PSRAM | S1 | DAT-02, D-020 | Sí: buffer de 512 KB y pretrigger |
| microSD | S1 | DAT-02 | Sí (crítica) |
| LSM6DSO32, BMP581, MMC5983MA (externos) | S1 | DAT-03/04/05, NAV-01/04 | Son los sensores principales |
| DRV5032, buzzer | S6, S1 | HW-01, HW-05 | Sí |

**Requisitos que no tienen hardware que los cubra:**
- **HW-04** (GPIO `cam=1`): se reemplazó por un estado derivado de la UART (D-031).
- **"Control mecánico"** (*Objetivos* 7.D): fuera por REG-01.

## 5. Viabilidad frente a las condiciones de vuelo

**Lo que exige el vuelo:** sale de la simulación de Demeter ([perfiles_vuelo](../../02_requisitos/perfiles_vuelo.md)):
- unos 10,1 g de pico;
- 129 m/s;
- apogeo de 669 m AGL a los 11,5 s;
- eyección a los 10,07 s, **antes del apogeo**;
- descenso a 9,2 m/s;
- 85 s de vuelo.

**Hermes no tiene simulación** (PEN-07): todo lo suyo queda por verificar.

| Componente | Soporta (fuente) | Exige | Veredicto | Qué validar en el banco |
| --- | --- | --- | --- | --- |
| QMI8658 | ±16 g, ±2048 °/s, hasta unos 7,2 kHz (datasheet `qmi8658.md`) | 10,1 g más el choque de la eyección (no modelado) | ⚠️ 1,6× de margen sobre la sim; la eyección no está acotada. Va deshabilitado en B′ | Golpe calibrado para ver si satura |
| LSM6DSO32 | ±32 g, 3,33 y 6,66 kHz (ficha; el datasheet de ST no está descargado, PEN-05b) | Igual | ✅ 3,2× de margen. El tamaño del FIFO está por verificar | P-02 durante 10 min |
| BME280 | 300–1100 hPa; ±1 hPa; unos 157–182 Hz como máximo (datasheet `bme280.md`) | De unos 955 a unos 880 hPa [inferencia: la presión de la sim está mal fijada]; unos 14 hPa/s [inferencia] | ✅ Como respaldo a 100 Hz, con el IIR apagado | Retardo con IIR |
| BMP581 | 30–125 kPa; 240 Hz en NORMAL (datasheet `bmp581.md`) | Igual | ✅ | P-14 |
| MAX-M10S | Aerotransportado **≤ 4 g**; 80 000 m; 500 m/s; **10 Hz solo con GPS+Galileo**; TTFF en frío 28 s y en caliente 1 s (datasheet `max_m10s.md`) | 10,1 g en el impulso; 1179 m s.n.m.; 129 m/s | ⚠️ Riesgo aceptado (R-06): pierde la solución en BOOST. ⚠️ Si VBACKUP está apagado (el código de LilyGO lo apaga), **cada arranque es en frío (unos 28 s)** [inferencia] | CFG-VALGET; TTFF real; recuperación después de un golpe |
| SX1262, tiempo en el aire | **Recalculado** con la fórmula del SX126x para SF6: **14 B = 6,688 ms; 44 B = 13,088 ms; 58 B = 15,648 ms; 59–61 B = 16,288 ms** | `PAQUETE_SLOT_MAX` = 61 B en ≤ 16 ms ([constantes](../../02_requisitos/constantes.md) §3) | ❌ **Error en un contrato: el máximo que cabe en 16 ms es 58 B.** No afecta a ningún paquete actual. Corrección aprobada: [DP-05](09_decisiones.md) | `calculateTimeOnAir` de RadioLib; ToA medido en T-006 |
| SX1262, SF6 con cabecera explícita | El SX126x lo permite (el SX127x no) | Los 3 nodos con SX1262 | ⚠️ **Depende de que la V1.2 tenga un SX1262** ([RP-02](10_riesgos.md)) | T-006 |
| SX1262, alcance | Unos 35 dB de margen a 3 km con una sensibilidad supuesta de −110 dBm ([enlace_lora_tdma](../../04_diseno/enlace_lora_tdma.md) §1) | Distancia oblicua de unos 674 m si la estación está junto a la rampa [inferencia]; **la ubicación real no está en el repo** | ✅ Si se confirma la sensibilidad (PEN-05) | P-06 |
| SX1262, regulación | 902–928 MHz de uso libre (Res. ANE 105/2020); 905–915 reservado para IMT (Res. 648/2023), según la ficha `sx1262.md` | Unos 26 dBm de PIRE [inferencia] | ❓ Por verificar (PEN-13) | — |
| Energía | DC1 de 2 A; LDO de 300 mA (ficha axp2101, **si el TG28 es equivalente**) | Unos 150 mA promedio [inferencia] | ✅ Con una 18650 alcanzan unas 17 h. ⚠️ **No está definida la celda del CanSat** ni su masa. ⚠️ Riesgo de brownout en los picos | P-12; caída de tensión en el TX de 22 dBm |
| PSRAM y SD | 8 MB QSPI (APS6404L); SDMMC de 1 bit, del orden de MB/s [inferencia] | Buffer de 512 KB a unos 55 kB/s | ✅ ⚠️ **Los 55 kB/s no están justificados:** con un registro por muestra solo la IMU da unos 73 kB/s, y el total unos 80 kB/s [inferencia]. Lo define [C-04](06_contratos/04_formato_log_y_replay.md) | P-02 con la tarjeta de vuelo |
| Tiempo | PPS de 30 ns RMS; el RTC tiene unos ±5 ppm (datasheet `pcf8563.md`, a confirmar para el BM8563) | Slots de 25 ms | ✅ Nominal. ⚠️ Con **dos** cohetes en HOLDOVER, la deriva relativa en el peor caso es de 9,6 ms, contra unos 9,9 ms de guarda [inferencia] | P-05 |

## 6. Sistemas que nos corresponden

### Telemetría de extremo a extremo

```
SENSORES ─► t_bus_sens (núcleo 1) ─┬─► t_fusion (estimador vertical, Madgwick, EKF) ─► t_fsm (T1–T13, E1)
                                   └─► t_log (PSRAM → SD por SDMMC)
t_fsm/t_fusion/t_house ─► estado de vuelo ─► NAV 44 B (≈ 9 Hz) / STATUS 42 B (1 Hz)
   ─► t_radio (slot = ROCKET_ID) ─► LoRa SF6/BW500 ─► módem V1.2 (slot 0: BEACON o CMD)
   ─► USB [C-03] ─► servicio de tierra: log crudo → decodificar → estado por cohete → cálculos
         ├─► CLI del operador (Go/No-Go, ARM, DISARM, FORZAR_ATERRIZADO)
         ├─► API del back-end [C-05], que emite web-1 ─► (dashboard y web del otro plan: fuera de alcance)
         └─► reenviador (T-605a) ─► relay del plan web (T-640)
Post-vuelo: LANDED → backfill de NAV + Wi-Fi AP → decodificador [C-04] → análisis del motor
```

- **A bordo:**
  - **Objetivo:** log completo y fases correctas.
  - **Restricciones:** sin transiciones por tiempo (D-010); el EKF no decide las fases (D-011); ERROR solo en tierra (D-012); el ARM exige el Go/No-Go (D-013); modo reanudado (D-015).
- **Radio:** TDMA con sincronía GNSS → derivada → holdover → ALOHA. Los comandos usan `cmd_seq`, ACK y fases permitidas.
- **Estación:**
  - el módem es "tonto";
  - el servicio de tierra guarda todo en crudo antes de cualquier otra cosa;
  - **desde internet no se puede mandar ningún comando** (GS-14).
- **Almacenamiento:** log binario a bordo; log crudo de solo agregar en tierra; descarga por Wi-Fi con hash.
- **Procesamiento:**
  - a bordo: el estimador (crítico), Madgwick y el EKF ("debería");
  - en tierra: distancia, azimut y elevación, la elipse de impacto, los tiempos y la caracterización del motor.

### Energía y encendido (firmware)

- **Encendido:** un imán sobre el DRV5032 actúa sobre `PWR_KEY` (D-031).
- **Apagado:** se bloquea la pulsación larga desde ARMED hasta LANDED.
- **Arranque:** los breakouts reciben un reset por software.
- **Riesgo nuevo:** que el TG28 no sea compatible con el AXP2101 ([RP-04](10_riesgos.md)).

### VisionPack (Demeter)

- **Enlace:** UART a 115200 con trama AA 55, más un pulso a masa desde el IO2.
- **Comandos por fase:** según D-023.
- **Hoy la Pi no completa una misión:**
  - `demeter_telemetryd.py:39` solo mapea 4 comandos;
  - `health_check` no tiene manejador (`:210`), así que el ARM siempre falla.

## 7. Interacciones entre sistemas

| Interfaz | Qué cruza | Contrato | Lados | Estado |
| --- | --- | --- | --- | --- |
| Cohete ↔ módem | NAV, STATUS, BEACON, CMD, ACK, BACKFILL | [protocolo_paquetes](../../04_diseno/protocolo_paquetes.md) v2 + [enlace_lora_tdma](../../04_diseno/enlace_lora_tdma.md) | S1/S2 ↔ S3 | ✅ Aprobado (con la corrección a 58 B) |
| Módem ↔ PC | Paquetes crudos más sus metadatos; pedidos de TX | **[C-03](06_contratos/03_trama_usb_modem.md)** (nuevo) | S3 ↔ S4 | Borrador |
| Servicio de tierra ↔ GUI y servidor | Estado, eventos (y comandos, solo en local) | **`web-1`** (lo define el plan web) + **[C-05](06_contratos/05_api_backend_tierra.md)** (lo adopta y agrega las extensiones locales) | S4 → GUI y relay (otro plan) | Borradores; se congelan el mismo día |
| Firmware ↔ SD ↔ PC | Registros binarios; archivos de replay | **[C-04](06_contratos/04_formato_log_y_replay.md)** (nuevo; adelanta T-202) | S1 → S8 | Borrador |
| Módulos del firmware entre sí | Estado de vuelo, eventos de fase, comandos hacia la máquina de estados, tiempo, capa de hardware | **[C-02](06_contratos/02_interfaces_firmware.md)** (nuevo) | Sesión A ↔ sesión B | Borrador |
| LilyGO ↔ Pi | UART AA 55, pulso | [visionpack_integracion](../../04_diseno/visionpack_integracion.md) | S1 ↔ equipo de visión | ⚠️ Falta el orden de Euler (PEN-15) y la Pi tiene bugs |
| PMU y DRV5032 ↔ firmware | Energía y encendido | D-031 | Hw → S6 | ⚠️ Falta el cableado (PEN-17) y verificar el TG28 |
| CanSat ↔ cohete | Montaje y orientación | `R_MONTAJE` (PEN-06) | Hw → S1 | ⚠️ |
| Equipo de cohete → nosotros | Simulaciones, masas, Cd | [datos/README](../../../datos/README.md) | Hw → S8 | Falta Hermes (PEN-07) |

## 8. Requisitos consolidados

**Tipos:** F = funcional · NF = no funcional · R = restricción del concurso, la normativa o el diseño impuesto.

**Fuentes:** OS = `Objetivos_Sistemas.pdf` · DCP = reglamento, según [proyecto](../../01_contexto/proyecto.md) · U = respuesta del usuario registrada en [requisitos](../../02_requisitos/requisitos.md).

| # | ID | Requisito | Tipo | Fuente | Alcance |
| --- | --- | --- | --- | --- | --- |
| 1 | REG-01 | Nada electrónico despliega la recuperación | R | DCP | Cumplirlo |
| 2 | REG-02 | Integración en ≤ 15 min, incluido el ARM | R | DCP | Nuestro |
| 3 | REG-03 | No depender de manipular el cohete después de la integración | R | DCP | Nuestro |
| 4 | — | CanSat de 250–300 g; aterrizaje ≤ 11 m/s | R | DCP | Restricción para el hardware |
| 5 | HW-01 | Encendido por el DRV5032 (D-031) | F | OS 3.1 | Firmware |
| 6 | HW-02 | Configurar el PMIC; % de batería | F | OS 3.1 | Firmware (⚠️ TG28) |
| 7 | HW-03 | Pulso a la Pi (D-023) | F | OS 3.1 | Demeter |
| 8 | HW-04 | Bit `cam` por UART (D-031) | F | OS 3.1 | Demeter |
| 9 | HW-05 | Buzzer al aterrizar | F | OS 3.1 | Firmware |
| 10 | HW-06 | I2C0, I2C1, UART del GNSS | R | OS 3.1 | Firmware |
| 11 | HW-07 | Sensores externos fuera del SPI interno | R | OS 3.1 | Firmware + Hw (D-022) |
| 12 | DAT-01 | Multihilo: el log va separado del enlace | NF | OS 4 | Firmware |
| 13 | DAT-02 | Todo en la SD | F | OS 4.1 | Firmware |
| 14 | DAT-03 | LSM6DSO32 a 1–3,33 kHz, watermark | NF | OS 4.1 | Firmware |
| 15 | DAT-04 | BMP581 a 240–480 Hz | NF | OS 4.1 | Firmware |
| 16 | DAT-05 | MMC5983MA a 100 Hz | NF | OS 4.1 | Firmware |
| 17 | DAT-06 | GNSS a 10 Hz | NF | OS 4.1 | Firmware |
| 18 | DAT-07 | LoRa a 5–10 Hz, binario, < 50 B | NF/R | OS 4.2 | Enlace |
| 19 | DAT-08 | Contenido del paquete | F | OS 4.2 | Enlace |
| 20 | DAT-09 | Volcado post-vuelo | F | OS 4.3 | Firmware + tierra |
| 21 | DAT-10 | Caracterizar el motor | F | U | Post-vuelo |
| 22 | NAV-01 | Madgwick con cuaterniones | F | OS 5 | Firmware |
| 23 | NAV-02 | EKF (no decide las fases) | F | OS 5 | Firmware |
| 24 | NAV-03 | Pesos dinámicos | F (C) | OS 5 | Firmware |
| 25 | NAV-04 | Apogeo por el BMP581, verificado con la IMU | F | OS 5 | Firmware |
| 26 | NAV-05 | Fix GNSS para armar | F | U | Firmware |
| 27 | GS-01 | Dos cohetes sin colisiones | F/NF | OS 6 | Enlace + módem |
| 28 | GS-02 | Distancia, azimut, elevación | F | OS 6 | **Cálculo**: nuestro; **pantalla**: GUI |
| 29 | GS-03 | LKP que nunca se borra | F | OS 7.G | **Retener el dato**: nuestro; **mostrarlo**: GUI |
| 30 | GS-04 | Coordenadas grandes y QR | F | OS 7.G | GUI (fuera); la URL la entrega la API |
| 31 | GS-05 | Alarma de descenso > 10 m/s, solo en DESCENT | F | OS 7.G | **Lógica**: nuestra; **alerta visual**: GUI |
| 32 | GS-06 | Go/No-Go | F | OS 7.C | **Datos y CLI**: nuestros; **panel**: GUI |
| 33 | GS-07 | Uplink de comandos | F | OS 7.D | Nuestro (CLI + API) |
| 34 | GS-08 | Interpolación y reconstrucción | F | OS 7.E | **Reconstrucción**: nuestra; **interpolación visual**: GUI |
| 35 | GS-09 | Vista 3D | F | OS 7.A | GUI (fuera) |
| 36 | GS-10 | Mapa 2D con elipse | F | OS 7.A | **Cálculo de la elipse**: nuestro; **mapa**: GUI |
| 37 | GS-11 | Gráficas personalizables | F | OS 7.F | GUI (fuera) |
| 38 | GS-12 | Retransmisión web | F | OS 7.F | **Reenviador (T-605a)**: nuestro; **relay e ingesta (T-640)** y **frontend**: plan web |
| 39 | GS-13 | Tiempos estimados | F | OS 6, 7.B | **Cálculo**: nuestro |
| 40 | GS-14 | Ningún comando desde internet | R | U (D-025) | Nuestro |
| 41 | — | Vuelo el 8 de noviembre, sin vuelo de prueba | R | constantes §1 | Calendario |
| 42 | — | Banda 902–928 MHz (con la posible reserva IMT) | R | ficha sx1262 (PEN-13) | Enlace |
| 43 | — | Prohibido el texto en el enlace | R | OS 4.2 | Se cumple |
| 44 | — | **Todas las operaciones críticas desde la CLI; el vuelo no depende de la GUI** | R | Equipo, 2026-10-25 | Nuestro (T-S04) |

## 9. Estado

| Área | Definido | A medias | No existe |
| --- | --- | --- | --- |
| Contratos | Protocolo v2, TDMA, máquina de estados, UART de la Pi, constantes | D-018, D-023, D-024, D-025 en propuesta | C-01 a C-05 (esta carpeta los propone) |
| Hardware | Fichas, buses y pines | D-022 abierta, PEN-18, PEN-17 | Verificar el TG28, el BM8563, el QMC6309 y el radio de la V1.2 |
| Firmware | Arquitectura de tareas y núcleos | — | Todo: `platformio.ini`, `config.h`, drivers |
| Estación | Arquitectura | — | Todo el código; la CLI y la API |
| Herramientas | Lista | — | Generador, replay, decodificador, vectores |
| VisionPack | Protocolo UART | 3 scripts con bugs | 4 archivos más systemd |
| Pruebas | P-01 a P-15 | — | `registro_pruebas.md` y cualquier prueba ejecutada |
| Proceso | Gitflow, agente, bitácora | Proteger las ramas | La coordinación entre dos sesiones (esta carpeta) |

## 10. Qué no está conectado

1. **El ARM depende de una interfaz de operador.** Se resuelve con la CLI (T-S04) sobre la API (C-05).
2. **La trama USB del módem no tiene tipos** ([estacion_terrena](../../04_diseno/estacion_terrena.md) §2.1). Se resuelve con C-03.
3. **El servicio de tierra no tiene contrato de salida.** Se resuelve con C-05.
4. **El formato del log se escribiría después del escritor** (T-202 depende de T-201). C-04 lo adelanta como contrato.
5. **El replay en el PC necesita lógica separada del hardware.** C-02 define la capa de abstracción.
6. **[firmware_vuelo](../../04_diseno/firmware_vuelo.md) §9 dice que la versión va en STATUS, pero STATUS no tiene ese campo.** Corrección aprobada: DP-07.
7. **El RTC no tiene papel en el diseño.** Propuesta: DP-10.
8. **El Go/No-Go de Demeter exige que la Pi esté en READY, y hoy la Pi falla al recibir ARM.** Lo resuelve T-701.
9. **Falta la simulación de Hermes**, así que P-03 solo cubre a Demeter.
10. **P-12 pide 2 h de autonomía, pero la celda del CanSat no está definida.**
11. **El reparto anterior estaba desbalanceado** (toda la ruta crítica del firmware en una sola persona). Se corrige en [03_plan_maestro](03_plan_maestro.md).
12. **Hay inconsistencias que el repo ya anotó y no corrigió** (`componentes.md`: INT del BMP581 en el 21 y QMI8658 en SPI3; PEN-12: "mapa del conector M.2"). Están en [12_cambios…](12_cambios_a_aplicar_en_lo_existente.md).

## 11. Contradicciones y supuestos peligrosos

**Contradicciones:**
1. **61 B "≤ 16 ms" es falso:** el máximo es 58 B (DP-05).
2. **Alimentación del MMC:** DC1 frente a A_LDO1 (DP-06, consultar con Hw).
3. **Tasa del log:** 55 kB/s frente a unos 80 kB/s [inferencia] (C-04).
4. **Chips leídos frente al repo:** TG28/AXP2101, BM8563/PCF8563, QMC6309/QMC6310 (DP-08, DP-09).
5. **El reparto por cohete del `CLAUDE.md`** no coincide con el reparto por subsistema del `plan_maestro`.
6. **La elipse:** *Objetivos* 6 la calcula con un descenso de unos 5 m/s; la simulación da 9,2 m/s.
7. **"Propuesta análisis de datos.docx"** habla de BMP390, LSM6DSOX, CSV en la SD, 1 kg y 700 m. Es solo referencia, pero puede confundir a un agente.
8. **El criterio de apogeo de P-03** ("< 0,3 s") no coincide con el de T-301 ("< 1 m y < 0,3 s").

**Supuestos peligrosos:**
- **(Crítico)** que la V1.2 tenga un SX1262 ([RP-02](10_riesgos.md));
- que la SD funcione en SDMMC (R-01);
- que los breakouts no tengan pull-ups hacia los pines 45 y 46 ([RP-05](10_riesgos.md));
- que el TG28 sea compatible con el AXP2101 ([RP-04](10_riesgos.md));
- que la sensibilidad sea de −110 dBm y que 22 dBm cumplan la regulación;
- que 3,33 kHz sea sostenible (P-02);
- que la Pi arranque a tiempo (P-09).

## 12. Información que falta

Está en [11_preguntas_abiertas.md](11_preguntas_abiertas.md), con la pregunta concreta y quién debe responder.

## 13. Riesgos, ordenados por impacto

Están en [10_riesgos.md](10_riesgos.md). Los principales:
- el calendario;
- **el daño a una placa sin repuesto**;
- la placa compartida como cuello de botella;
- el radio de la V1.2;
- el ARM y el uplink;
- los pines de strapping;
- el TG28;
- la Pi;
- la SD;
- la regulación;
- la cuota de las cuentas Pro;
- el GNSS.

## 14. Dependencias externas

- **Equipo de hardware:** cableado (PEN-17), orientación (PEN-06), celda, circuito de la Pi (PEN-10), buzzer (PEN-19), **la alimentación del MMC (DP-06)**.
- **Pablo Tilano:** requisitos, regulación, alarma de descenso (PEN-20).
- **Equipo de Hermes:** la simulación (PEN-07).
- **Equipo de visión de Demeter:** el código y los archivos de la Pi.
- **El otro plan (GUI, rama `docs/plan-web`):**
  - define `web-1`, que C-05 adopta (DP-17);
  - consume el protocolo: **hay que avisarle de PROTO_VERSION 3** (DP-07);
  - lo llevan **las mismas dos personas** ([RP-15](10_riesgos.md)).
- **CCCD:** del 6 al 8 de noviembre; la ubicación de la estación.
- **ANE:** la regulación.
- **LilyGO, Semtech, ST, AP Memory:** documentación.
- **La universidad:** posible compra de una placa de repuesto ([PA-06](11_preguntas_abiertas.md)).

## 15. Insights para planear

1. **No hace falta un plan nuevo**: hace falta coordinación (propiedad, contratos que faltan, sincronización y la placa).
2. **Los cuatro contratos que faltan** (C-02 a C-05) permiten trabajar en paralelo sin placa.
3. **Una buena parte del mínimo para volar se prueba sin hardware:** el protocolo, el generador, el estimador y la máquina de estados en replay, el servicio de tierra con un módem falso, la Pi con un puerto serie virtual.
4. **Las dos personas deben cargar la ruta crítica.** La que más usa la placa al principio (B, con los drivers) se alterna con la que más la usa después (A, con la radio y el GNSS).
5. **Hay correcciones baratas de alto valor** (DP-05 a DP-09), descritas en [12_cambios…](12_cambios_a_aplicar_en_lo_existente.md).
6. **El RTC con batería puede dar hora UTC antes del fix** (DP-10, propuesta).
