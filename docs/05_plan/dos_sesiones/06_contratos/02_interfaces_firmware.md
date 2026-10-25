---
id: C-02
estado: borrador (lo redacta B y lo revisa A; se congela en H0, T-S02)
actualizado: 2026-10-25
depende_de: [firmware_vuelo, maquina_estados, protocolo_paquetes, enlace_lora_tdma, buses_y_pines, constantes]
---
# C-02. Interfaces internas del firmware, capa de hardware y configuración por cohete

**Para qué:** que los módulos de la sesión A (tiempo, radio, Pi, volcado) y los de la sesión B (sensores, log, fusión, máquina de estados, energía) se conecten **sin editar el código del otro**, y que la lógica se pruebe **en el PC** sin placa.

**Lo que no repite:**
- las tareas, núcleos y prioridades: [firmware_vuelo](../../../04_diseno/firmware_vuelo.md) §2;
- las transiciones: [maquina_estados](../../../04_diseno/maquina_estados.md);
- los formatos del enlace: [protocolo_paquetes](../../../04_diseno/protocolo_paquetes.md).

Aquí se definen **los datos que cruzan entre módulos**, no su codificación.

**Convenciones:**
- unidades SI y `float` dentro del firmware;
- tiempo en `t_us` (u64, `esp_timer`, D-019);
- marco ENU para la navegación y marco del cuerpo según [protocolo_paquetes](../../../04_diseno/protocolo_paquetes.md) §8;
- los nombres de los tipos y campos los fija el `desarrollador` en T-002, respetando estas tablas.

## 1. Propiedad de las tareas (quién escribe cada una)

| Tarea ([firmware_vuelo](../../../04_diseno/firmware_vuelo.md) §2) | Sesión | Bus que posee |
| --- | --- | --- |
| `t_bus_sens` | B | SPI de sensores (D-022) |
| `t_bus_i2c0` | B | I2C0 (MMC5983MA, BME280, magnetómetro de la placa, OLED) |
| `t_fusion`, `t_fsm` | B | — |
| `t_log` | B | SD (SDMMC en B′) |
| `t_house` | B | **I2C1** (PMU TG28 y RTC BM8563), buzzer |
| `t_gnss` | **A** | UART del GNSS y PPS (GPIO 6) |
| `t_radio` | **A** | SPI2 (SX1262) |
| `t_visionpack` | **A** | UART0 (43/44), pulso (IO2) |
| `t_dump` | **A** | Wi-Fi |

**Regla de [firmware_vuelo](../../../04_diseno/firmware_vuelo.md) §2:** cada bus tiene una sola tarea dueña, y quien necesita un dato se lo pide por cola. Por ejemplo, A pide el RTC a `t_house` y no toca I2C1.

## 2. Estado de vuelo (lo escribe B, lo leen A y el log)

Es un registro único que se publica a 100 Hz (`FSM_HZ`). Cada grupo de campos tiene **un solo escritor**. La lectura se hace con una copia consistente (por ejemplo, doble buffer o seqlock: lo decide T-002).

| Grupo | Campos | Escritor | Lectores |
| --- | --- | --- | --- |
| Fase | `fase` (código 0–9), `t_fase_us`, `flags` (EYECCION, APOGEO, REANUDADO, FALLA_ACTIVA), `mission_id`, `h_max_m` | `t_fsm` (B) | `t_radio` (NAV/STATUS), `t_visionpack`, `t_log` |
| Vertical | `h_agl_m`, `vz_ms`, `bias_acc`, `valido` | `t_fusion` (B) | `t_fsm`, `t_radio` |
| Navegación | `lat_deg`, `lon_deg`, `alt_agl_m`, `vel_enu_ms[3]`, `q[4]` (cuerpo → ENU), `ekf_ok`, `innov_pos_m` | `t_fusion` (B). Si no hay EKF, copia del GNSS crudo con `ekf_ok = 0` | `t_radio`, `t_visionpack` (convierte a Euler, PEN-15) |
| Aceleración promedio | `acc_cuerpo_mg[3]`, promedio de la ventana de 100 ms del ciclo TDMA | `t_fusion` (B). La ventana la marca la señal de ciclo de A (§4) | `t_radio` |
| Salud | `fallas` (bitmap de [protocolo](../../../04_diseno/protocolo_paquetes.md) §3), `calib` | Cada dueño escribe **sus** bits (tabla abajo) | `t_radio`, Go/No-Go |
| Energía | `bat_pct`, `bat_mv`, `temp_esp_c`, `sd_libre_mb`, `log_activo` | `t_house` y `t_log` (B) | `t_radio` |
| Origen | `origen_lat`, `origen_lon`, `alt_origen_msl_m`, `ref_baro_pa` | `t_fsm` (B) en ARM | `t_radio`, `t_log` |
| Módulo secundario | `estado_sec` (StatusCode de la Pi, 0xFE o 0xFF), `act` (PI_PULSO, CAM_OK, WIFI_AP, BACKFILL), `temp_pi_c` | `t_visionpack`, `t_dump` y `t_radio` (A); BUZZER lo escribe `t_house` (B) | `t_radio` |

**Bits de `fallas`, por dueño:**
- **B:** LSM6DSO32, BMP581, MMC5983MA, QMI8658, BME280, magnetómetro de la placa, SD, PMIC, EKF, RTC, batería baja.
- **A:** GNSS sin datos, radio, UART del VisionPack.

## 3. Eventos de fase (los emite B y los consumen A y B)

Es una cola de eventos con el mismo formato para todos.

| Campo | Contenido |
| --- | --- |
| `t_us` | Instante de la transición |
| `tipo` | `TRANSICION` · `EYECCION` (E1) · `APOGEO_REGISTRADO` · `REANUDADO` |
| `fase_anterior`, `fase_nueva` | Códigos de [maquina_estados](../../../04_diseno/maquina_estados.md) §1 |
| `transicion` | T0–T13 |
| `causa` | Código corto (condición cumplida, comando, reanudación) |

**Quién lo consume:**
- `t_visionpack` (A): manda los comandos de D-023 según la transición;
- `t_radio` (A): adelanta un STATUS;
- `t_log` (B): registro de evento ([C-04](04_formato_log_y_replay.md));
- `t_house` (B): buzzer en T12 y T13; bloquear o reactivar el apagado por pulsación larga en T4, T5, T12 y T13.

## 4. Comandos de tierra (A los despacha; B decide los que son de la máquina de estados)

`t_radio` (A) recibe un CMD válido y **deduplica por `cmd_seq`** ([protocolo](../../../04_diseno/protocolo_paquetes.md) §5). Después:
1. revisa la **tabla de fases permitidas** del protocolo (la aplica A, leyendo `fase` del estado de vuelo);
2. **enruta** el comando a su dueño;
3. el dueño responde con un `resultado` (los mismos códigos 0–4 del ACK);
4. A arma el ACK.

| Comando | Dueño | Interfaz |
| --- | --- | --- |
| `PING`, `SET_CANAL`, `BACKFILL` | A (`t_radio`) | Interna |
| `ARM`, `DISARM`, `RECALIBRAR`, `SYSTEM_CHECK`, `FORZAR_ATERRIZADO` | **B (`t_fsm`)** | **Pedido de comando a la máquina de estados:** `{cmd_id, args}` → `resultado`. En ARM, B evalúa el Go/No-Go y responde 2 si falla, con el detalle en `fallas` |
| `PI_ENCENDER`, `PI_GRABAR` | A (`t_visionpack`) | Interna |
| `WIFI_AP` | A (`t_dump`) | Interna |
| `BUZZER` | B (`t_house`) | Pedido a `t_house` → `resultado` |

**Señal de ciclo TDMA** (de A hacia B): en cada inicio de ciclo, A marca `t_us_ciclo`, para que B cierre la ventana de promedio de la aceleración que va en el NAV de ese ciclo.

## 5. Tiempo y GNSS (los publica A; los usan B y el log)

| Interfaz | Contenido | Uso |
| --- | --- | --- |
| **Tiempo** | `utc_desde_t_us(t_us)` → (`utc_ms`, `valido`); `fuente_sync` (0–3 según [enlace_lora_tdma](../../../04_diseno/enlace_lora_tdma.md) §3); la última pareja del PPS (`t_us_flanco`, `utc_s`) | Marcas UTC del log, `mission_id`, `PREFLIGHT_SYNC` de la Pi, Go/No-Go ("hora válida y TDMA en GNSS o DERIVADA") |
| **PVT del GNSS** (10 Hz) | `t_us` (llegada), `itow_ms`, `fix` (0/2/3), `sv`, `lat_deg`, `lon_deg`, `alt_msl_m`, `vel_ned_ms[3]`, `hacc_m`, `vacc_m`, `sacc_ms`, `valid_time`, `fully_resolved` | El EKF (B), el Go/No-Go (fix 3D, `hAcc`, satélites), el origen en ARM (promedio de `ORIGEN_PROMEDIO_S`), el log, STATUS |
| **Hora inicial del RTC** (DP-10, propuesta) | B lee el BM8563 al arrancar y se la pasa a A como `utc_inicial` con `valido = RTC`. **Nunca se usa para el TDMA**, solo para nombrar archivos y para la sesión de tierra | Opcional (T-S15) |

## 6. Capa de abstracción del hardware (para probar en el PC)

**Regla:** los módulos de lógica **no llaman a drivers**; dependen de estas interfaces. Cada interfaz tiene una implementación **real** (la placa) y una **falsa** (el environment `native`).

| Interfaz | Real | Falsa (en el PC) | La usan |
| --- | --- | --- | --- |
| Reloj (`t_us`, temporizadores) | `esp_timer` | Reloj controlado por la prueba | Todo |
| Fuente de muestras de la IMU, el baro y el magnetómetro | Drivers + FIFO | **Lector de archivos [C-04](04_formato_log_y_replay.md)** (replay) | `t_fusion`, `t_fsm` |
| GNSS | UART + UBX + PPS | Lector de los registros GNSS_PVT y PPS de C-04 | `t_gnss` y lo que viene después |
| Radio | SX1262 (RadioLib) | Canal simulado en memoria (pérdidas, retardos, RSSI configurables) | `t_radio`, módem |
| Almacenamiento | SD (SDMMC/FAT) | Archivo del PC | `t_log` |
| UART de la Pi | UART0 | Puerto serie virtual (T-S13) | `t_visionpack` |
| Persistencia | Memoria RTC + NVS | Mapa en memoria | `t_fsm` (D-015, P-10) |

**Lo que se compila en `native`:**
- el protocolo;
- el calendario TDMA (con reloj falso);
- el estimador;
- la máquina de estados y el Go/No-Go;
- el codificador del log;
- el despacho de comandos.

Los drivers **no** se prueban en el PC ([02_metodo](../02_metodo_trabajo.md) §6).

## 7. Configuración por cohete

El hardware es idéntico. **Lo único que cambia** se fija en la compilación, con el environment de PlatformIO:

| Parámetro | Demeter | Hermes | Efecto |
| --- | --- | --- | --- |
| `ROCKET_ID` | 1 | 2 | ID del nodo = **slot TDMA** = campo `origen` |
| `MODULO_VISIONPACK` | 1 | 0 | Activa `t_visionpack`, el pulso y el Go/No-Go de la Pi; `estado_sec = 0xFF` en Hermes |
| Canal LoRa | `LORA_FREQ_MHZ` | **El mismo** | **Los tres nodos comparten el canal** ([enlace_lora_tdma](../../../04_diseno/enlace_lora_tdma.md) §6). Los cohetes se separan por el slot |
| SSID del volcado | `EIA-1` | `EIA-2` | `WIFI_AP_SSID` |

- **En tierra**, el "panel Demeter o Hermes" es responsabilidad de la GUI (otro plan). La API lo facilita con un flujo `web-1` por misión (`demeter` / `hermes`) ([C-05](05_api_backend_tierra.md)).
- **Al arrancar**, el firmware publica `ROCKET_ID`, `MODULO_VISIONPACK` y **la versión (hash de git)**, en el log, en la OLED (solo en tierra) y en STATUS (DP-07, que espera a que se aplique [12](../12_cambios_a_aplicar_en_lo_existente.md)).

## 8. Buses y pines

**La fuente es [buses_y_pines](../../../03_hardware/buses_y_pines.md) más [constantes](../../../02_requisitos/constantes.md) §7.** Aquí solo están las diferencias con lo que se leyó en los chips, que se confirman en T-S12:

| Tema | Lo que dicen los documentos existentes | Lo que se espera (V3.1, chips leídos) | Acción |
| --- | --- | --- | --- |
| PMU | AXP2101 en 0x34 (XPowersLib) | **TG28-ESP**; dirección y registros por verificar | T-S12 lee el registro de identificación. Si no es compatible, B propone un driver mínimo y DP-09 se revisa |
| RTC | PCF8563 en 0x51 | **BM8563** en 0x51 (probablemente compatible) | T-S12: leer la hora y escribirla |
| Magnetómetro de la placa | QMC6310 (0x1C/0x3C) | **QMC6309 en 0x7C** | T-S12: escaneo de I2C0. Ver DP-08 |
| PSRAM | 8 MB, modo sin especificar | **APS6404L, QSPI** | `platformio.ini` en QSPI; `psramFound()` en T-003 |
| Pines 45/46 | "Nunca ponerles un pull-up" | Los breakouts **pueden** traer pull-ups en SDA/SCL (= MOSI/SCK) | T-S12 mide **antes** de conectar ([RP-05](../10_riesgos.md)) |
| Alimentación del MMC5983MA | DC1 en `buses_y_pines`; A_LDO1 en PEN-17 | DC1 (DP-06) | **Consultar con el equipo de hardware** ([PA-14](../11_preguntas_abiertas.md)) |
