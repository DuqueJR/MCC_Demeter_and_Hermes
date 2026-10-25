---
id: firmware_vuelo
estado: aprobado-v1 (arquitectura); los detalles de los buses dependen de buses_y_pines
actualizado: 2026-10-24
depende_de: [buses_y_pines, maquina_estados, protocolo_paquetes, enlace_lora_tdma, constantes]
decisiones: [D-016, D-017, D-018, D-019, D-020, D-021]
---
# Firmware de vuelo (T-Beam Supreme, común a los dos cohetes)

## 1. Plataforma (D-016)

- **PlatformIO + Arduino-ESP32** (core 3.x sobre ESP-IDF 5.x), con FreeRTOS para las tareas y el anclaje a núcleos.
- Se puede llamar a ESP-IDF directamente cuando haga falta: GPTimer, `esp_timer`, NVS, la memoria RTC y el driver de SPI master.
- **Librerías base** (las versiones exactas se fijan en `platformio.ini` cuando exista el repo):

| Función | Librería |
| --- | --- |
| Radio | RadioLib (SX1262) |
| PMIC | XPowersLib (AXP2101) |
| GNSS | SparkFun u-blox GNSS v3, que soporta M10 y CFG-VALSET; la alternativa es un parser UBX propio y mínimo para NAV-PVT |
| LSM6DSO32 | El driver oficial de ST (`lsm6dso32_reg.c`, el *PID* de STMems_Standard_C_drivers), o Adafruit LSM6DS |
| BMP581 | Bosch BMP5 Sensor API |
| MMC5983MA | SparkFun MMC5983MA |
| Sensores de la placa (QMI8658, QMC6310) | SensorLib (de lewisxhe), la que usa LilyGO |
| BME280 | Bosch BME280 API, o Adafruit |
| OLED | U8g2, **solo en BOOT y PREFLIGHT** (ver la sección 3) |

  - Para el LSM6DSO32 y el BMP581 se prefieren los drivers del fabricante, porque dan acceso completo al FIFO.
- **Un solo binario, configurado por cohete:**
  - `ROCKET_ID` (1 = Demeter, 2 = Hermes) y `MODULO_VISIONPACK` (0 o 1) se definen en la compilación, con un *environment* de PlatformIO por cohete;
  - el resto del código es idéntico.

## 2. Tareas y núcleos (D-017)

El núcleo 1 se reserva para el tiempo real de los sensores. El núcleo 0 lleva la radio, el GNSS, la SD y la pila de Wi-Fi (que el ESP32 ya pone ahí).

| Tarea | Núcleo | Prioridad | Se dispara por | Hace |
| --- | --- | --- | --- | --- |
| `t_bus_spi3` | 1 | Máxima | IRQ del watermark del LSM6DSO32 (GPIO 39), IRQ del FIFO del BMP581 (GPIO 21), el QMI8658, y los bloques pendientes de la SD | **Es la única dueña del bus SPI3** (sensores y SD, D-022). Lee los FIFO en ráfaga, marca el tiempo de cada muestra y lo publica en dos colas, la de fusión y la del log. **Escribe la SD en bloques cortos** (≤ `SPI3_SD_MAX_MS`), intercalados entre las lecturas. |
| `t_bus_i2c0` | 1 | Media | Timer de 100 Hz | Es la dueña de I2C0: lee el MMC5983MA (100 Hz), el QMC6310 y el BME280 (los respaldos), y en tierra refresca el OLED. **En vuelo no toca el OLED.** |
| `t_fusion` | 1 | Alta | Llegada de muestras | Estimador vertical 1D, que es crítico, a la tasa del IMU decimada (500 Hz (P)) · Madgwick (500 Hz) · EKF 3D (predicción a 100 Hz, corrección con el baro a 100 Hz y con el GNSS a 10 Hz) |
| `t_fsm` | 1 | Alta | 100 Hz | Evalúa las transiciones ([maquina_estados.md](maquina_estados.md)), dispara las acciones y escribe la persistencia |
| `t_radio` | 0 | Máxima en el núcleo 0 | Timer del slot TDMA e IRQ DIO1 | Programa el TX del slot, el RX continuo y los comandos, y lleva la fuente de sincronía ([enlace_lora_tdma.md](enlace_lora_tdma.md)) |
| `t_gnss` | 0 | Alta | UART e IRQ del PPS (GPIO 6) | Parsea UBX-NAV-PVT, marca el tiempo del PPS y calcula la correspondencia entre `t_us` y UTC |
| `t_log` | 0 | Media | Llegada de registros | Serializa los registros en el buffer de PSRAM y arma los bloques de 16 KB. **No toca el bus:** se los entrega a `t_bus_spi3` para que los escriba. |
| `t_house` | 0 | Baja | 1 Hz | Batería (AXP2101) y temperaturas · arma STATUS · OLED (solo en tierra) · buzzer |
| `t_visionpack` | 0 | Media | UART de la Pi | Solo con `MODULO_VISIONPACK = 1`: el protocolo AA 55 ([visionpack_integracion.md](visionpack_integracion.md)) |
| `t_dump` | 0 | Baja | LANDED + comando | Punto de acceso Wi-Fi y servidor HTTP del volcado; el backfill lo hace `t_radio` |

**Reglas:**
- **Cada bus tiene una sola tarea dueña.** No se comparten buses entre tareas con mutex: quien necesita un dato, se lo pide al dueño por cola.
- **Las ISR no hacen nada más que marcar el tiempo** (`esp_timer_get_time()`) y despertar a su tarea.
- **Nada bloqueante en el núcleo 1.** Las colas entre núcleos son *ring buffers* sin bloqueo; si se llenan, se pierde la muestra más vieja **y se cuenta la pérdida**.

## 3. Buses (resumen; el detalle está en buses_y_pines)

Ver [buses_y_pines.md](../03_hardware/buses_y_pines.md). Ese documento tiene el estado de la verificación de cada pin y la decisión pendiente sobre el host SPI.

- **I2C0** (17/18): OLED, QMC6310 y BME280. El OLED **no se refresca en vuelo**: un frame completo bloquea el bus varios ms.
- **I2C1** (42/41): AXP2101 y PCF8563.
- **UART** (8/9) para el GNSS. **PPS en el GPIO 6.**
- **SPI de la radio** (SPI2/FSPI): solo el SX1262.
- **SPI3 (35/36/37)**: el LSM6DSO32 (CS 38), el BMP581 (CS 48), el QMI8658 (CS 34) y la SD (CS 47). Tiene una sola dueña, `t_bus_spi3` (D-022).
- **El MMC5983MA va en I2C0** (0x30), no en SPI.
- **Encendido:** el DRV5032 actúa sobre el `PWR_KEY` del AXP2101 (D-031). El firmware **desactiva el apagado por pulsación larga** al entrar en ARMED y lo reactiva en DISARM y en LANDED.

## 4. Tasas de adquisición (D-018)

| Sensor | En PREFLIGHT / ARMED | De BOOST a LANDED | Notas |
| --- | --- | --- | --- |
| LSM6DSO32 acel. (±32 g) | 1,66 kHz al buffer previo y decimado a 100 Hz en la SD | **3,33 kHz** | ±32 g porque el H135W puede pasar de 16 g y para medir el choque de la eyección |
| LSM6DSO32 giro (±2000 °/s) | 1,66 kHz | 3,33 kHz | |
| BMP581 | 50 Hz | **240 Hz** con OSR, según la tabla de la ficha [bmp581](../03_hardware/componentes/bmp581.md) | Se prefiere bajo ruido a 480 Hz con mucho ruido |
| MMC5983MA | 50 Hz | 100 Hz | |
| GNSS MAX-M10S | 10 Hz | 10 Hz | **Solo GPS + Galileo**: con la configuración de fábrica (GPS+GAL+BDS) no llega a 10 Hz. Modelo AIR4 (ver la ficha [max_m10s](../03_hardware/componentes/max_m10s.md)). |
| QMI8658, BME280, QMC6310 (respaldo) | 50 Hz | 100 Hz (si el bus lo permite) | Respaldo: no deben robarle tiempo de bus a los sensores principales |

- **Si en la prueba de estrés del bus (P-02) se pierden muestras a 3,33 kHz**, se baja a 1,66 kHz. Eso se cambia con una constante.

## 5. Tiempo (D-019)

- **Base de tiempo única: `t_us`**, que es `esp_timer` (µs desde el arranque, monotónico y de 64 bits). Todas las muestras y eventos llevan `t_us`.
  - La telemetría usa `t_ms = t_us / 1000` en 32 bits.
- **La correspondencia con UTC** se calcula en cada PPS: se registra la pareja (`t_us` del flanco, UTC de ese segundo según NAV-PVT).
  - Se guarda en la SD y se publica en STATUS.
  - Así se alinea después el log con la Pi de Demeter y con la estación.
- **Marca de tiempo de las muestras de un FIFO:**
  - el `t_us` de la IRQ del watermark corresponde a la **última** muestra;
  - las anteriores se reconstruyen hacia atrás con el periodo real del ODR;
  - ese periodo se calibra contra el PPS, porque el oscilador del sensor tiene tolerancia.
  - Si el LSM6DSO32 tiene timestamp en el FIFO, se usa ese (ver su ficha).

## 6. Log en la SD (D-020)

- **Formato binario propio**, con registros `[tipo u8][len u8][t_us u64][payload]`.
  - Tipos de registro: acel+giro, baro, mag, GNSS-PVT, PPS, salida del estimador, salida del EKF, evento de la máquina de estados, NAV emitido, STATUS emitido, paquete recibido, cabecera de sesión y contadores de pérdidas.
  - **La cabecera de sesión** lleva la versión del formato, `ROCKET_ID`, la configuración y las calibraciones.
- **Archivos:** `/M<mission_id>/vuelo_000.bin` (rotan cada `LOG_ROTAR_MB`) y `/S<boot_count>/tierra.bin` para la sesión de tierra antes de ARM.
- **Buffer en PSRAM** de `LOG_BUFFER_KB` (512 KB (P)). Absorbe los picos de latencia de escritura de la SD, que llegan a 100–250 ms.
  - Se escribe en bloques de 16 KB alineados, sobre un archivo **preasignado**.
  - Volumen de vuelo a tasa máxima: ~55 kB/s. Tres minutos dan unos 10 MB.
- **Buffer previo:** en ARMED, los últimos `PRETRIGGER_S` (2 s) a tasa completa están en PSRAM y se escriben al detectar BOOST. Así el log de alta tasa cubre la ignición completa sin escribir durante toda la espera en rampa.
- **El decodificador y el exportador a CSV van en el PC** (Python), en el repo, junto al servicio de tierra.
- **SD:** se recomiendan tarjetas A1 o A2 de marca, formateadas en FAT32 justo antes del vuelo. La prueba P-02 se hace con **la tarjeta que va a volar**.

## 7. Caracterización del motor (objetivo del CanSat) (D-021)

- **Qué se mide:** t₀ (despegue), t_bo (fin de la combustión), t_ej (eyección) y la aceleración específica axial a 3,33 kHz.
- **Qué se calcula en tierra, después del vuelo:**
  - **Empuje:** F(t) = m(t)·a_ax(t) + D(t).
    - m(t) es la masa del cohete al despegue menos el propelente consumido, que se asume proporcional al impulso acumulado.
    - D(t) es la resistencia: ½ρv²·Cd·A, con el Cd de la simulación y la velocidad del estimador.
  - **Impulso total** (∫F dt), tiempo de combustión, empuje medio y pico, y **retardo real** (t_ej − t_bo). Todo se compara con la curva publicada del motor (thrustcurve.org).
- **Qué necesitamos de otros equipos:**
  - la masa del cohete al despegue y la masa del propelente;
  - el Cd y el área de referencia;
  - **que el CanSat vaya fijo y rígido en la bahía.** Si se mueve, el acelerómetro mide su golpeteo, no el cohete. Está en [pendientes](../05_plan/pendientes.md).
- **No es crítico en vuelo:** todo se procesa en tierra. En vuelo solo importa que el log de alta tasa esté completo.

## 8. Volcado post-vuelo (decisión E aceptada)

- **Datos completos: Wi-Fi AP (opción A).**
  - Con el comando `WIFI_AP 1` en LANDED, o al recuperar el cohete, se enciende un punto de acceso con SSID `EIA-<ROCKET_ID>` y clave de la configuración.
  - Sirve un HTTP mínimo con la lista de archivos y la descarga.
  - El servicio de tierra los descarga y los reprocesa. La SD no se toca hasta tener la copia.
- **Telemetría perdida: backfill LoRa (opción B)**, solo de los registros NAV ([protocolo_paquetes.md](protocolo_paquetes.md)).
- **Mientras el Wi-Fi está encendido**, la radio LoRa sigue mandando NAV a 1 Hz para la última posición conocida (LKP).

## 9. Seguridad del software

- **Watchdog de tareas** encendido para todas las tareas. Si una se cuelga, el ESP32 se reinicia y entra en modo reanudado (D-015).
- **Brownout** activado. El pico de TX del SX1262 se cubre con la batería.
- **Ningún `printf` por USB en el lazo crítico**: el diagnóstico va al log.
- **Antes de cada vuelo se graba un número de versión** (hash de git) en la cabecera de sesión, y se muestra en el OLED y en STATUS.
