---
id: lsm6dso32
nombre: LSM6DSO32 (breakout Adafruit P4692)
tipo: IMU 6 ejes (acelerómetro ±4…±32 g, giroscopio ±125…±2000 dps), FIFO
ubicacion: CanSat — bus SPI externo, compartido con BMP581 y MMC5983MA
fabricante: STMicroelectronics (breakout: Adafruit)
fuentes:
  - [D1] Driver oficial ST: https://github.com/STMicroelectronics/lsm6dso32-pid (archivos lsm6dso32_reg.h y lsm6dso32_reg.c, rama master; leídos con raw.githubusercontent.com; no ejecutados)
  - [D2] Ejemplo oficial ST: https://github.com/STMicroelectronics/STMems_Standard_C_drivers/tree/master/lsm6dso32_STdC/examples (lsm6dso32_multi_read_fifo.c, leído; README con lista de ejemplos)
  - [A1] Guía Adafruit "LSM6DSOX, ISM330DHC, & LSM6DSO32 6 DoF IMUs", pinouts: https://learn.adafruit.com/lsm6dsox-and-ism330dhc-6-dof-imu/pinouts (leída; página "edited March 08, 2024")
  - [A2] Producto Adafruit: https://www.adafruit.com/product/4692
  - [ST-PG] Página de producto ST: https://www.st.com/en/mems-and-sensors/lsm6dso32.html (solo vista en búsqueda previa)
  - Datasheet ST https://www.st.com/resource/en/datasheet/lsm6dso32.pdf: NO descargado. Descarga bloqueada (curl HTTP/2 error, curl HTTP/1.1 timeout, WebFetch timeout en 2 intentos). Las fuentes de Adafruit enlazan solo su propio PDF de guía (cdn-learn.adafruit.com/downloads/pdf/lsm6dsox-and-ism330dhc-6-dof-imu.pdf), que NO es el datasheet de ST, así que no se descargó nada.
datasheet_pdf: no descargado (ver Incertidumbres)
actualizado: 2026-10-24
verificacion: fase 2 (Haiku). Registros, bits, enumeraciones, sensibilidades y FIFO-tags verificados contra el driver oficial ST [D1]. Pines del breakout verificados con [A1]. Datos de FIFO en bytes, SPI, tiempos, consumo y filtros SIGUEN sin confirmar: requieren el datasheet PDF.
---
# LSM6DSO32 (breakout Adafruit P4692)

**Estado:** los registros, enumeraciones, sensibilidades y etiquetas del FIFO están verificados contra el driver oficial de ST [D1] (no se ejecutó nada). Lo que depende del datasheet PDF (tamaño real del FIFO, modo SPI, velocidad SPI, arranque, consumo, filtros) sigue en Incertidumbres.

## Rol en el proyecto

- Acelerómetro de alto rango (±32 g) para caracterizar la curva de empuje del motor (aceleraciones esperadas 5–20 g, vibración fuerte).
- Requisito del equipo: 3.33 kHz acel+giro, con FIFO, interrupción de watermark por INT1 y lectura en ráfaga.
- Comparte bus SPI con BMP581 y MMC5983MA. Según [A1], varios LSM6DSO32 pueden compartir SDI, DO y SCK y tener cada uno su CS.

## Datos clave

| Parámetro | Valor | Fuente |
|---|---|---|
| WHO_AM_I (registro 0x0F) | **0x6C** (`LSM6DSO32_ID`) | [D1] `lsm6dso32_reg.h` |
| Acelerómetro, escalas | ±4, ±8, ±16, ±32 g | [D1] enum `lsm6dso32_fs_xl_t` |
| Giroscopio, escalas | ±250, ±125, ±500, ±1000, ±2000 dps | [D1] enum `lsm6dso32_fs_g_t` |
| Sensibilidad acel. ±32 g | **0.976 mg/LSB** | [D1] `lsm6dso32_from_fs32_to_mg` |
| Sensibilidad giro ±2000 dps | **70 mdps/LSB** | [D1] `lsm6dso32_from_fs2000_to_mdps` |
| Sensibilidad acel. ±4 / ±8 / ±16 g | 0.122 / 0.244 / 0.488 mg/LSB | [D1] |
| Sensibilidad giro 125…1000 dps | 4.375 / 8.75 / 17.5 / 35 mdps/LSB | [D1] |
| Temperatura | LSB/256 + 25 °C | [D1] `lsm6dso32_from_lsb_to_celsius` |
| Timestamp | **25 µs por LSB** (32 bits) | [D1] `lsm6dso32_from_lsb_to_nsec` (25000 ns/LSB) |
| ODR acel./giro, modo alta performance | 1667, 3333, 6667 Hz (valores de enum 0x08, 0x09, 0x0A) | [D1] |
| ODR acel. para 3333 Hz | Solo modo HIGH_PERF (los modos LOW_PW/NORMAL_MD llegan a 208 Hz) | [D1] enumeración |
| BDR FIFO a 3333 Hz | `LSM6DSO32_XL_BATCHED_AT_3333Hz` = 9; `LSM6DSO32_GY_BATCHED_AT_3333Hz` = 9 | [D1] |
| Entrada del FIFO | 1 byte de TAG + 6 bytes de datos = **7 bytes** | [D1] (`lsm6dso32_fifo_out_raw_get` lee 6 bytes desde 0x79; tag en 0x78) y comentario de [D2] |
| Alimentación analógica | 1.71–3.6 V | [ST-PG] (no verificado en PDF) |
| Interfaces | SPI, I2C, MIPI I3C | [ST-PG] y [D1] (driver tiene `i3c_disable`) |
| Encapsulado | LGA 2.5 × 3 × 0.83 mm | [ST-PG] |
| Breakout: alimentación | Vin 3–5 V (level shifting), regulador 3.3 V | [A1] |

Nota sobre rangos: el driver incluye el aviso "STRONG, VERY_STRONG, AGGRESSIVE, XTREME: not available for data rate > 1667 Hz" en el filtro de acel. (`lsm6dso32_ftype_t`). A 3333 Hz solo sirven VERY_LIGHT, LIGHT y MEDIUM [D1].

## Interfaz y pines

**Pines del breakout** [A1] (verificados en la guía):

- SPI: **SCK** (entrada), **SDA** (= SDI, entrada de datos desde el MCU), **DO (Bottom)** (= SDO, salida de datos), **CS (Bottom)** (activo bajo, entrada).
- Alimentación: Vin (3–5 V), 3Vo (3.3 V, hasta 100 mA), GND. Todos los pines tienen level shifting.
- INT1 e INT2: interrupciones; el enrutamiento se configura por registro.
- D0 (Bottom): bit de dirección I2C. Por defecto 0x6A; con D0 a alto o con el puente de soldadura, 0x6B [A1]. Según [D1], las direcciones de 8 bits son 0xD5 (0x6A) y 0xD7 (0x6B).
- SCX, SDX, Aux CS, DO (Top): para conectar otro sensor. No usado.
- Para varios sensores en un bus: compartir SDI, DO y SCK; cada uno con su CS único [A1].

**Selección SPI vs I2C:**

- No hay jumper ni pin de selección en la guía. La interfaz se elige por código (`begin_SPI` o `begin_I2C` en Adafruit).
- Para desactivar I2C en un bus SPI: bit **I2C_disable** de CTRL4_C (bit 2) [D1]. Ver nota de la sección Trampas.
- Lectura SPI en el ejemplo de ST: el bit 7 de la dirección de registro se pone a 1 para leer (`reg |= 0x80`); escritura sin ese bit [D2]. Esto es lo que hace el ejemplo, no una cita directa del datasheet.
- Modo SPI (CPOL/CPHA) y 3 hilos: no confirmados en fuentes leídas (ver Incertidumbres).

## Registros clave

Direcciones y campos verificados contra `lsm6dso32_reg.h` [D1]. Bits en orden LSB → MSB según el driver (little endian).

| Registro | Dirección | Campos relevantes (bit) |
|---|---|---|
| FIFO_CTRL1 | 0x07 | WTM[7:0] (parte baja del watermark) |
| FIFO_CTRL2 | 0x08 | WTM[8] (bit 0); STOP_ON_WTM (bit 7) |
| FIFO_CTRL3 | 0x09 | BDR_XL[3:0]; BDR_GY[7:4] |
| FIFO_CTRL4 | 0x0A | FIFO_MODE[2:0]; ODR_T_BATCH[5:4]; ODR_TS_BATCH[7:6] |
| COUNTER_BDR_REG1/2 | 0x0B / 0x0C | contador de BDR (no usado) |
| INT1_CTRL | 0x0D | INT1_DRDY_XL (0); INT1_DRDY_G (1); INT1_BOOT (2); **INT1_FIFO_TH (3)**; INT1_FIFO_OVR (4); INT1_FIFO_FULL (5); INT1_CNT_BDR (6); DEN_DRDY_FLAG (7) |
| INT2_CTRL | 0x0E | análogo a INT1 |
| WHO_AM_I | 0x0F | 0x6C |
| CTRL1_XL | 0x10 | LPF2_XL_EN (bit 1); FS_XL[3:2]; ODR_XL[7:4] |
| CTRL2_G | 0x11 | FS_G[3:1] (incluye bit FS_125); ODR_G[7:4] |
| CTRL3_C | 0x12 | **SW_RESET (0)**; IF_INC (2); SIM (3); PP_OD (4); H_LACTIVE (5); **BDU (6)**; BOOT (7) |
| CTRL4_C | 0x13 | LPF1_SEL_G (1); **I2C_DISABLE (2)**; DRDY_MASK (3); INT2_ON_INT1 (5); SLEEP_G (6) |
| CTRL6_C | 0x15 | FTYPE[2:0] (ancho de banda del LPF2 de acel.); XL_HM_MODE (4) |
| CTRL8_XL | 0x17 | LOW_PASS_ON_6D (0); HP_SLOPE_XL_EN (2); FASTSETTL_MODE_XL (3); HP_REF_MODE_XL (4); HPCF_XL[7:5] |
| CTRL9_XL | 0x18 | **I3C_DISABLE (1)**; DEN_LH (2); DEN_XL_G[4:3]; DEN_Z/Y/X (5/6/7) |
| FIFO_STATUS1 | 0x3A | DIFF_FIFO[7:0] (parte baja del nivel) |
| FIFO_STATUS2 | 0x3B | DIFF_FIFO[1:0] (parte alta); FIFO_FULL_IA (5); FIFO_OVR_IA (6); FIFO_WTM_IA (7) |
| TIMESTAMP0..3 | 0x40–0x43 | contador de 32 bits, 25 µs/LSB |
| OUT_TEMP_L/H | 0x20 / 0x21 | temperatura |
| OUTX_L_G … | 0x22… | salida directa de giro (no usada con FIFO) |
| OUTX_L_A … | 0x28… | salida directa de acel. (no usada con FIFO) |
| FIFO_DATA_OUT_TAG | 0x78 | TAG_PARITY (0); TAG_CNT[2:1]; TAG_SENSOR[7:3] |
| FIFO_DATA_OUT_X_L … Z_H | 0x79 … 0x7E | 6 bytes de datos (X_L, X_H, Y_L, Y_H, Z_L, Z_H) |

Nota: el driver tiene un bit SW_RESET en CTRL3_C (bit 0) y la función `lsm6dso32_reset_set`. El ejemplo de ST resetea el sensor y espera a que el bit vuelva a 0 antes de configurar [D2].

### Enumeraciones útiles

- **ODR acel. (CTRL1_XL, HIGH_PERF):** 1667 Hz = 0x08; 3333 Hz = 0x09; 6667 Hz = 0x0A. ODR_OFF = 0x00.
- **ODR giro (CTRL2_G, HIGH_PERF):** 1667 Hz = 0x08; 3333 Hz = 0x09; 6667 Hz = 0x0A.
- **FS_XL (CTRL1_XL):** ±4 g = 0x00; ±32 g = 0x01; ±8 g = 0x02; ±16 g = 0x03.
- **FS_G (CTRL2_G):** ±250 dps = 0; ±125 = 1; ±500 = 2; ±1000 = 4; ±2000 = 6.
- **FIFO_MODE (FIFO_CTRL4):** BYPASS = 0; FIFO = 1 (se detiene al llenarse); STREAM_TO_FIFO = 3; BYPASS_TO_STREAM = 4; **STREAM = 6** (buffer circular: sobrescribe lo más viejo); BYPASS_TO_FIFO = 7.
- **BDR FIFO (FIFO_CTRL3):** NOT_BATCHED = 0; 12.5 = 1; 26 = 2; 52 = 3; 104 = 4; 208 = 5; 417 = 6; 833 = 7; 1667 = 8; **3333 = 9**; 6667 = 10; 6.5 = 11. Los mismos códigos sirven para XL y para giro.
- **ODR_TS_BATCH (FIFO_CTRL4):** NO_DECIMATION = 0; DEC_1 = 1; DEC_8 = 2; DEC_32 = 3. Significado exacto de DEC_1/8/32 no confirmado (ver Incertidumbres).
- **ODR_T_BATCH (FIFO_CTRL4):** NOT_BATCHED = 0; 1.6 Hz = 1; 12.5 Hz = 2; 52 Hz = 3.
- **Tags del FIFO (TAG_SENSOR):** GYRO = 1; XL = 2; TEMPERATURE = 3; TIMESTAMP = 4; CFG_CHANGE = 5. El resto (compresión 2XC/3XC, sensor hub, contador de pasos, NACK) no lo usamos. Fuente [D1].
- **Filtro LPF2 de acel.:** FTYPE de CTRL6_C: VERY_LIGHT = 1; LIGHT = 2; MEDIUM = 3; STRONG = 4; VERY_STRONG = 5; AGGRESSIVE = 6; XTREME = 7. Los cuatro últimos no están disponibles a ODR > 1667 Hz [D1]. Ancho de banda en Hz respecto al ODR: no confirmado (datasheet).

## Configuración relevante para nuestro uso

Propuesta, con los valores ya confirmados por el driver. Los valores marcados (?) dependen del datasheet.

- **WHO_AM_I:** leer 0x0F y exigir 0x6C antes de configurar [D1, D2].
- **Reset y arranque:** SW_RESET (CTRL3_C bit 0) y esperar a que se limpie [D2]. Tiempo de espera: no confirmado (?).
- **Interfaz:** BDU = 1 (CTRL3_C bit 6) para que no se mezclen bytes de un mismo dato [D1, D2]. I2C_DISABLE = 1 (CTRL4_C bit 2) y I3C_DISABLE = 1 (CTRL9_XL bit 1) en el bus SPI compartido [D1, D2]. El ejemplo de ST desactiva I3C pero no I2C_DISABLE; el uso de I2C_DISABLE en nuestro caso es decisión propia.
- **Rango:** acel. ±32 g (FS_XL = 0x01): 0.976 mg/LSB. Giro ±2000 dps (FS_G = 6): 70 mdps/LSB [D1]. Con 0.976 mg/LSB, el rango completo ±32 g cubre 32 000 mg en 16 bits; la resolución fina (~1 mg) es la que da el sensor a este rango.
- **ODR:** acel. y giro a 3333 Hz (código 0x09) en modo HIGH_PERF [D1].
- **FIFO:** FIFO_MODE = STREAM (6) si preferimos conservar los datos más recientes (buffer circular). FIFO_MODE = FIFO (1) si preferimos conservar los primeros datos y detener la captura al llenarse. Decidir según el perfil de la misión (ver Trampas).
- **BDR FIFO:** XL y GY a 3333 Hz (código 9 en ambos campos de FIFO_CTRL3) [D1].
- **Watermark:** WTM de 9 bits (FIFO_CTRL1 bits 0–7 + FIFO_CTRL2 bit 0), rango 0–511 [D1]. Unidad: el comentario de ST dice "número de datos sin leer (TAG + 6 bytes)", es decir, entradas de 7 bytes [D2]. Watermark sugerido: 200 entradas (≈30 ms a 6666 entradas/s); confirmar la unidad en el datasheet antes de fijarlo (?).
- **INT1:** INT1_FIFO_TH = 1 (bit 3 de INT1_CTRL) para interrupción de watermark [D1]. Activo alto o bajo y push-pull u open-drain: PP_OD y H_LACTIVE de CTRL3_C, por defecto push-pull y activo alto [D1, pendiente de confirmar valor por defecto].
- **Lectura del FIFO:** leer FIFO_STATUS1/2 para el nivel (10 bits DIFF_FIFO), luego leer cada entrada: TAG en 0x78 y 6 bytes en 0x79–0x7E. Con IF_INC = 1 (por defecto en el driver, bit 2 de CTRL3_C) se puede hacer lectura en ráfaga sin repetir dirección [D1].
- **Timestamp:** habilitarlo (ODR_TS_BATCH distinto de 0) solo si se necesita; cada entrada TIMESTAMP ocupa 7 bytes en el FIFO [D1]. Con DEC no confirmado, usar el registro TIMESTAMP (0x40–0x43, 25 µs/LSB) para sincronizar al leer.
- **Temperatura:** no necesaria para el perfil de motor; no batchear para ahorrar FIFO (ODR_T_BATCH = 0) [D1].
- **Giroscopio:** se mantiene a 3333 Hz si se usa para orientación; si no, BDR_GY = 0 reduce el volumen a la mitad.
- **LPF2 de acel.:** lpf2_xl_en y FTYPE (CTRL1_XL bit 1 y CTRL6_C bits 2:0) para limitar vibración. Valor a elegir con datos de banco; a 3333 Hz no usar STRONG o más [D1].

## Alimentación y tiempos

- **Turn-on / arranque:** no confirmado (?). El driver tiene BOOT (CTRL3_C bit 7) pero no da el tiempo.
- **Tiempo de estabilización tras cambiar ODR:** no confirmado (?).
- **Consumo** a 3333 Hz en alta performance: no confirmado (?).
- **Resolución del timestamp:** 25 µs por LSB, confirmada por el driver [D1].
- **Rango de alimentación:** 1.71–3.6 V analógica [ST-PG, no verificado en PDF]. Breakout acepta Vin de 3–5 V con regulador 3.3 V [A1].

## Librerías y ejemplos oficiales

| Recurso | Qué ofrece | Estado |
|---|---|---|
| Driver ST `lsm6dso32-pid` (`lsm6dso32_reg.h/.c`) | Acceso a todos los registros, FIFO, timestamp, conversiones de sensibilidad. Independiente de plataforma: se le dan funciones de lectura y escritura [D1] | Fuente principal. Leído, no ejecutado |
| Ejemplo ST `lsm6dso32_multi_read_fifo.c` | Configura FIFO en modo STREAM, watermark, BDR, lectura por TAG cuando hay watermark (`lsm6dso32_fifo_wtm_flag_get`, `fifo_data_level_get`, `fifo_sensor_tag_get`, `fifo_out_raw_get`) [D2] | Referencia de flujo. Usa placa MKI109 y HAL; no es código para Hermes |
| Ejemplo ST `lsm6dso32_read_data_polling.c` y `lsm6dso32_self_test.c` | Lectura por polling y autotest [D2] | No leído en detalle |
| Guía Adafruit (pinouts) | Pines del breakout y uso de SPI/I2C [A1] | Leída |
| Adafruit LSM6DS (Arduino/CircuitPython) | Librería de alto nivel; soporte de FIFO no confirmado | No verificado. Revisar antes de usar |

Recomendación: usar el driver ST como referencia de registros y del flujo de FIFO [D1, D2]; la capa SPI la escribe el equipo.

## Trampas y notas

1. **Tamaño del FIFO sin resolver.** La ficha anterior citaba "768 muestras (3 KB)" de la tabla del equipo y "9 kbytes" de la página de ST. El driver no da el tamaño. Con entradas de 7 bytes: 3 KB ≈ 438 entradas; 9 KB ≈ 1316 entradas; 768 entradas = 5376 bytes (no cuadra con 3 KB). Hay que leer el datasheet antes de dimensionar.
2. **Unidad del watermark.** Según [D2] es número de entradas (TAG+6). El datasheet puede decir palabras de 16 bits. Confirmar antes de fijar el valor.
3. **Modo STREAM vs FIFO.** STREAM (6) sobrescribe lo más viejo; si el sistema se atrasa se pierden datos antiguos (y se activa FIFO_OVR). Modo FIFO (1) conserva los datos iniciales, pero deja de guardar al llenarse. Elegir según qué queremos conservar durante el ascenso (?).
4. **Filtros a 3333 Hz.** STRONG o más no están disponibles por encima de 1667 Hz [D1].
5. **I2C activo en bus compartido.** Sin I2C_DISABLE, el pin CS podría dar falsos accesos I2C. Activar el bit en el arranque [D1, decisión propia del equipo].
6. **Lectura SPI del bit 7.** En el ejemplo de ST, leer requiere poner el bit 7 de la dirección a 1 [D2]. Verificar con el datasheet que es el mismo para este chip; el driver no lo impone (el usuario implementa read/write).
7. **Pull-up de SDA y niveles.** Adafruit [A1] indica level shifting en todos los pines. No se confirmó pull-up en SDA; pendiente de inspección en placa.
8. **Revisión del breakout.** La guía tiene fecha de marzo de 2024; confirmar la revisión de la placa P4692 comprada.

## Volumen de datos

Base: entrada de FIFO = 1 byte TAG + 6 bytes de datos = **7 bytes** [D1, D2]. Las fuentes de la columna de FIFO (3 KB, 9 KB) son hipótesis sin confirmar (ver Incertidumbres).

| Concepto | Cálculo | Resultado |
|---|---|---|
| Bytes por entrada de FIFO | 1 + 6 | **7 B** |
| Entradas/s, acel + giro a 3333 Hz | 3333 + 3333 | **6666 entradas/s** |
| Bytes/s, acel + giro | 6666 × 7 | **46 662 B/s** (≈ 46.7 kB/s) |
| Entradas/s, solo acel. a 3333 Hz | 3333 | 3333 entradas/s (23 331 B/s) |
| Entradas/s con timestamp a 3333 Hz (escenario pesimista) | 6666 + 3333 | 9999 entradas/s (69 993 B/s) |
| Capacidad FIFO, hipótesis 3 KB | 3072 / 7 | 438 entradas completas |
| Capacidad FIFO, hipótesis 9 KB | 9216 / 7 | 1316 entradas completas |
| Margen con FIFO lleno, acel + giro, 3 KB | 438 / 6666 s | **≈ 65.7 ms** |
| Margen con FIFO lleno, acel + giro, 9 KB | 1316 / 6666 s | **≈ 197 ms** |
| Margen, acel + giro, hipótesis 768 entradas | 768 / 6666 s | ≈ 115 ms |
| Margen, solo acel. 3333 Hz, 3 KB / 9 KB | 438 / 3333; 1316 / 3333 | ≈ 131 ms / ≈ 395 ms |
| Margen con timestamp a 3333 Hz, 3 KB / 9 KB | 438 / 9999; 1316 / 9999 | ≈ 44 ms / ≈ 132 ms |
| Watermark de ejemplo: 200 entradas | 200 / 6666 s | cada ≈ 30 ms; burst de 1400 bytes |
| Tiempo para leer antes de llenarse con WTM = 200, 3 KB / 9 KB | (438 − 200) / 6666; (1316 − 200) / 6666 | ≈ 36 ms / ≈ 167 ms |

Lectura: con el FIFO de 3 KB (hipótesis), hay unos 35 ms para vaciarlo tras cada interrupción con WTM = 200. Con 9 KB, unos 167 ms. Esto depende del tamaño real del FIFO y de la unidad del watermark, que no se confirmaron.

## Incertidumbres

- **Datasheet ST no leído.** Intentos: curl HTTP/2 (error de stream), curl HTTP/1.1 (timeout 60 s), WebFetch (timeout 60 s). Pendiente: descargar a mano desde navegador y guardarlo en `docs/03_hardware/datasheets/lsm6dso32.pdf`. El PDF de la guía de Adafruit no sirve (es el PDF de la guía, no el de ST).
- **Tamaño real del FIFO:** 3 KB o 9 KB; no confirmado. Por tanto los márgenes de la tabla son hipótesis.
- **Unidad del watermark** (entradas o palabras de 16 bits) y su máximo práctico: no confirmado. Driver: 9 bits (0–511).
- **Modo SPI (CPOL/CPHA), velocidad máxima de SPI y soporte de 3 hilos:** no confirmados. El ejemplo de ST no lo fija (usa HAL del MCU de prueba).
- **Turn-on / boot time, tiempo de estabilización tras cambiar ODR:** no confirmados.
- **Consumo a 3333 Hz (alta performance):** no confirmado.
- **Ancho de banda de LPF1 y LPF2 respecto al ODR, y densidad de ruido:** no confirmados. El driver da nombres de FTYPE, no anchos de banda.
- **Significado de ODR_TS_BATCH (DEC_1, DEC_8, DEC_32)** y resolución exacta del timestamp en FIFO (el driver da 25 µs por LSB para el registro TIMESTAMP): no confirmado para el FIFO.
- **Polaridad y tipo por defecto de INT1** (PP_OD, H_LACTIVE): no confirmado.
- **Sensibilidades y registros:** verificados contra el driver ST [D1]. Coherencia con el datasheet: pendiente.
- **Dirección I2C por DO:** 0x6A/0x6B confirmado por [A1] y por las direcciones de 8 bits 0xD5/0xD7 del driver [D1].
- **Pines del breakout:** verificados con [A1]; coincidencia con la placa física: pendiente de inspección.
- **Alimentación 1.71–3.6 V y encapsulado:** fuente [ST-PG], no verificado en PDF.
- **Librería Adafruit:** soporte de FIFO y firma de funciones SPI sin verificar; no usar sin revisión.
