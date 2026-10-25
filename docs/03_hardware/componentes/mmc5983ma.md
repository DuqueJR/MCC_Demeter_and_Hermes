---
id: mmc5983ma
nombre: MMC5983MA (breakout genérico)
tipo: Magnetómetro triaxial AMR, 18 bit, ±8 G, sin FIFO
ubicacion: CanSat (ambos cohetes) — bus SPI externo
fabricante: MEMSIC
fuentes:
  - https://www.memsic.com/Public/Uploads/uploadfile/files/20220119/MMC5983MADatasheetRevA.pdf (datasheet Rev A, formal release 4/3/2019)
  - https://www.memsic.com/magnetometer-5 (página de producto MEMSIC)
  - https://github.com/sparkfun/SparkFun_MMC5983MA_Magnetometer_Arduino_Library (librería SparkFun; vista por búsqueda, no abierta)
datasheet_pdf: ../datasheets/mmc5983ma.pdf
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# MMC5983MA (breakout genérico)

Datasheet verificado: MEMSIC MMC5983MA Rev A (20 páginas), leído completo. Dirección de registros y valores de reset tomados de ese documento.

## Rol en el proyecto

- Magnetómetro para orientación del CanSat durante el vuelo y, si aplica, para el análisis de rotación.
- Requisito del equipo: 100 Hz.
- Comparte bus SPI con LSM6DSO32 y BMP581.

## Datos clave

| Parámetro | Valor | Fuente |
|---|---|---|
| Rango de campo | ±8 G por eje | MEMSIC Rev A, p.2 |
| Resolución de salida | 18 bit (modo 16 bit también disponible) | MEMSIC p.2 |
| Ruido total RMS | 0.4 mG (BW=00); 0.6 mG (BW=01); 0.8 mG (BW=10); 1.2 mG (BW=11) | MEMSIC p.2 |
| Sensibilidad | 16384 cuentas/G (18 bit); 4096 cuentas/G (16 bit) | MEMSIC p.2 |
| Campo nulo (offset digital) | 131072 cuentas (18 bit); 32768 (16 bit) | MEMSIC p.2 |
| Tasa máxima de salida (ODR) según BW | 50 Hz (BW=00); 100 Hz (BW=01); 225 Hz (BW=10); 580 Hz (BW=11); 1000 Hz con CM_Freq=111 y BW=11 | MEMSIC p.2 (ver Incertidumbres: contradicción con registro Ctrl2) |
| Tiempo de medición (Ctrl1 BW) | 8 ms (BW=00); 4 ms (BW=01); 2 ms (BW=10); 0.5 ms (BW=11) | MEMSIC p.15 |
| Alimentación VDD | 2.8–3.6 V (3.0 V típ.) | MEMSIC p.2 |
| Alimentación VDDIO | 2.8–3.6 V (I2C e INT) | MEMSIC p.2 |
| Corriente | 450 µA típ. a 7 medidas/s y BW=00; 225 µA (BW=01); 112.5 µA (BW=10); 32 µA (BW=11). Consumo proporcional al número de medidas/s | MEMSIC p.2, p.12 |
| Corriente en power-down | 1.0 µA | MEMSIC p.2 |
| Rango de temperatura | -40 … 105 °C | MEMSIC p.2 |
| Temperatura interna (Tout) | 8 bit, ~0.8 °C/LSB, 0x00 = -75 °C; rango -75…125 °C | MEMSIC p.13 |
| Tiempo de encendido (power-on) | 10 ms (tras reset por software) | MEMSIC p.15 |
| Tiempo de subida de alimentación | ≤ 5 ms | MEMSIC p.2 |
| Encapsulado | LGA 3.0 × 3.0 × 1.0 mm, 16 pines | MEMSIC p.2 y p.9 |
| Certificación | AEC-Q100 Grado 2 (según brochure MEMSIC; no verificado en datasheet) | búsqueda |
| Interfaces | I2C (hasta 400 kHz, fast mode); SPI (hasta 10 MHz) | MEMSIC p.2 |
| FIFO | **No tiene** | — |

## Interfaz y pines

**Pines** (MEMSIC p.9, LGA16, vista superior):

| Pin | Nombre | Función |
|---|---|---|
| 1 | SCL/SPI_SCK | Reloj I2C o SPI |
| 2 | VDD | Alimentación ASIC |
| 3 | NC | |
| 4 | SPI_CS | Chip select SPI (activo en bajo). **Conectar a VDDIO para I2C.** |
| 5 | SPI_SDO | Salida de datos SPI (MISO) |
| 6–8 | NC | |
| 9 | GND | |
| 10 | CAP | Capacitor 10 µF para bobina SET/RESET (VDD y CAP unidos internamente) |
| 11 | GND | |
| 12 | NC | |
| 13 | VDDIO | Alimentación interfaz digital e INT |
| 14 | NC | |
| 15 | INT | Interrupción, activa en alto; alta impedancia hasta activar la interrupción |
| 16 | SDA/SPI_SDI | Datos I2C o MOSI SPI |

- Esquemas recomendados: conexión SPI con VDD y VDDIO unidos (single supply) o separados (dual supply, MEMSIC p.10–11). CAP con 10 µF de baja ESR cerca del pin.
- En modo SPI, 4 hilos: CS, SCK, SDI (MOSI), SDO (MISO).
- En modo 3 hilos: bit Spi_3w (registro 0x0C, bit 6). Lectura de 3 hilos sigue el mismo formato; la escritura también.

**Protocolo SPI** (MEMSIC p.5–8):

- Cada transacción tiene 16 pulsos de reloj para lectura/escritura simple. En multibyte se añaden bloques de 8 pulsos.
- Bit 0 = RW: 1 = lectura, 0 = escritura. Bit 1 = don't care. Bits 2–7 = dirección AD(5:0). Bits 8–15 = datos (MSB primero).
- Lectura: el chip conduce SDO desde el inicio del bit 8.
- Modo SPI (CPOL/CPHA): el datasheet dice que SCK queda en alto cuando CS está en alto, y que los datos se ponen en el flanco de bajada y se capturan en el de subida. Esto corresponde al modo 3 (CPOL=1, CPHA=1). **Ver Incertidumbres: la librería SparkFun usa modo 0 en la práctica.**
- Tiempos SPI (MEMSIC p.4): periodo mínimo de SCK 100 ns; frecuencia máxima 10 MHz (garantizada por caracterización, no probada en producción); CS setup 6 ns y hold 8 ns; SDI setup 5 ns y hold 15 ns; SDO válido ≤ 50 ns; retención SDO ≥ 9 ns; SDO deshabilitado ≤ 50 ns.

**Breakout genérico**: no hay documentación de pines del fabricante del breakout. Los nombres de pines son los del chip.

## Registros clave

Dirección y valores de reset del datasheet MEMSIC Rev A (p.13–17).

| Dirección | Nombre | Bits / función |
|---|---|---|
| 0x00 | Xout0 | Xout[17:10] (lectura) |
| 0x01 | Xout1 | Xout[9:2] |
| 0x02 | Yout0 | Yout[17:10] |
| 0x03 | Yout1 | Yout[9:2] |
| 0x04 | Zout0 | Zout[17:10] |
| 0x05 | Zout1 | Zout[9:2] |
| 0x06 | XYZout2 | Xout[1:0], Yout[1:0], Zout[1:0] |
| 0x07 | Tout | Temperatura, 8 bit |
| 0x08 | Status | Meas_M_Done (bit 0), Meas_T_Done (bit 1), OTP_Read_Done (bit 4). Escribir 1 limpia la interrupción. |
| 0x09 | Control 0 (escritura) | TM_M (bit 0): iniciar medición de campo, se auto-limpia. TM_T (bit 1): medición de temperatura (no con TM_M simultáneo). INT_meas_done_en (bit 2). SET (bit 3, 500 ns). RESET (bit 4, 500 ns). Auto_SR_en (bit 5). OTP_Read (bit 6). Reset value 0x00. |
| 0x0A | Control 1 | SW_RST (bit 7): reinicio tipo power-up, 10 ms. X_inhibit (bit 3? ver Incertidumbres). YZ_inhibit. BW1:BW0 (bits 1:0). |
| 0x0B | Control 2 | En_prd_set (bit 7). Prd_set[2:0] (bits 6:4). Cmm_en (bit 3). CM_Freq[2:0] (bits 2:0). |
| 0x0C | Control 3 | Spi_3w (bit 6). St_enp / St_enm (test de saturación). |
| 0x2F | Product ID 1 | Valor de reset 0x30 (bits 0011 0000). Identificador de chip. |

Notas de bits:

- BW1:BW0 de Control 1 (0x0A): 00 = 8 ms / 100 Hz; 01 = 4 ms / 200 Hz; 10 = 2 ms / 400 Hz; 11 = 0.5 ms / 800 Hz. Son parámetros de ancho de banda del filtro de decimación, no de ODR directo (MEMSIC p.15).
- CM_Freq (Control 2): 001 = 1 Hz; 010 = 10 Hz; 011 = 20 Hz; 100 = 50 Hz; 101 = 100 Hz; 110 = 200 Hz (requiere BW=01); 111 = 1000 Hz (requiere BW=11). La tabla asume BW=00 como base (MEMSIC p.16).
- Prd_set (Control 2): número de medidas entre SET automáticos: 000 = 1; 001 = 25; 010 = 75; 011 = 100; 100 = 250; 101 = 500; 110 = 1000; 111 = 2000.
- Cmm_en (Control 2) = 1 activa el modo continuo. CM_Freq no puede ser 000 en ese caso.

## Configuración relevante para nuestro uso

Propuesta basada en datasheet, a validar. Objetivo: 100 Hz.

- **Modo:** continuo (Cmm_en = 1) con CM_Freq = 101 (100 Hz), o medición única (TM_M) disparada por el ESP32 a 100 Hz. Modo continuo deja el sensor autónomo y evita jitter de la tarea.
- **Ancho de banda:** BW = 01 (4 ms por medición, ruido 0.6 mG). Es la opción que cumple 100 Hz en ambas tablas (máximo 100 Hz en la tabla de ODR de la especificación y CM_Freq 101 válido). BW=00 (0.4 mG) también sirve si la tabla de CM_Freq se toma como válida, pero su tabla de especificación da solo 50 Hz máximo (ver Incertidumbres).
- **Resolución:** 18 bit (sin bit de modo a 16 bit: la salida ya es 18 bit por defecto).
- **Set/Reset:** Auto_SR_en = 1 para compensación de offset (cada medición). Periodic SET (En_prd_set) necesita Auto_SR_en y Cmm_en a 1. Prd_set = 100 (100 mediciones) es una propuesta razonable a 100 Hz (un SET por segundo) para compensar deriva térmica y magnetización residual tras golpes. Confirmar.
- **Interrupción:** INT_meas_done_en = 1 habilita INT (activo en alto) al finalizar medición. Conectar INT a un GPIO del ESP32-S3 o leer Status (0x08) por SPI.
- **Lectura:** burst de 0x00 a 0x06 (7 bytes) para leer X, Y, Z y los 2 bits extra en una transacción. Usar bit 0 = 1 de lectura y auto-incremento (el datasheet describe la dirección que avanza por byte en I2C; en SPI, la lectura en múltiplos de 8 pulsos sigue el mismo principio).
- **Temperatura:** Tout tiene resolución de 0.8 °C; útil solo como referencia de deriva térmica.

## Alimentación y tiempos

- VDD: 2.8–3.6 V. VDDIO: 2.8–3.6 V. Pueden unirse (single supply) o separarse (dual supply).
- Tiempo de power-on tras encendido o reset por software: 10 ms. Tras subir la alimentación, esperar ese tiempo antes de la primera transacción (MEMSIC p.15, SW_RST).
- Tiempo de subida de alimentación máximo: 5 ms.
- Corriente: ver tabla. Con BW=01 a 100 Hz, el consumo de medición es proporcional al número de medidas; el datasheet da 450 µA típ. a 7 medidas/s con BW=00, por lo que a 100 Hz el consumo será mayor. No verificado a 100 Hz.

## Librerías y ejemplos oficiales

| Librería | SPI | FIFO | Notas |
|---|---|---|---|
| SparkFun MMC5983MA Magnetometer Arduino Library (v1.1.4, 2023-11-30) | Sí, con limitaciones: los ejemplos SPI son para la placa SparkX; la placa Qwiic Micro no tiene SPI | No aplica (sin FIFO) | Repositorio: sparkfun/SparkFun_MMC5983MA_Magnetometer_Arduino_Library. Un usuario reporta que el SPI funciona en modo 0, no en modo 3 como dice el datasheet. |
| 7Semi MMC5983MA (Arduino, 2026) | No mencionado | No aplica | Se describe con soporte I2C. No verificado en detalle. |
| Driver oficial de MEMSIC | No encontrado | No aplica | No localizado en la búsqueda. |

Recomendación: partir del datasheet MEMSIC para registros y secuencia. Tomar la librería SparkFun solo como referencia de secuencia SPI, comprobando el modo con un analizador lógico.

## Trampas y notas

1. **Modo SPI**: el datasheet indica modo 3; la práctica documentada en la librería SparkFun es modo 0. Como el bus es compartido con otros dispositivos, fijar el modo del MMC por medición de SCK y CS con analizador lógico antes de integrar.
2. **Sin FIFO**: el sensor entrega un solo resultado por medición. A 100 Hz, el host debe leer antes de la siguiente medición o perderá la muestra.
3. **CS a VDDIO para I2C**: en SPI, CS no debe quedar flotando. Si CS queda sin conectar, el chip puede quedar en I2C o en estado indefinido.
4. **Campo fuera de rango**: campos externos mayores de 10 G pueden invertir la polaridad del sensor; hay que ejecutar SET/RESET después. Los motores y las partes magnéticas del cohete deben estar lejos del sensor (MEMSIC p.12).
5. **Separación magnética**: no colocar cerca de altavoces, bobinas, inductores o imanes permanentes (MEMSIC p.12). Esto incluye el buzzer del CanSat si es magnético.
6. **Bobina CAP**: el capacitor de 10 µF es obligatorio para el pulso de SET/RESET. Sin él, SET/RESET falla.
7. **Auto-SET y campo externo**: SET en cada medición (Auto_SR_en) elimina el offset del puente, pero no protege contra campos mayores de 10 G.
8. **Reflow**: MSL3, 260 °C máximo 10 s, máximo 3 ciclos SMT (MEMSIC p.19). Relevante si se suelda la placa.
9. **Temperatura de operación**: -40 a 105 °C. Relevante para el ascenso y la caída con variaciones de temperatura.

## Incertidumbres

- **Contradicción de ODR**: la tabla de especificación da 50 Hz máximo a BW=00 y 100 Hz máximo a BW=01. La tabla de Control 2 da 100 Hz a CM_Freq=101 (con BW=00 como base) y 200 Hz a CM_Freq=110 con BW=01. La propuesta de BW=01 + CM_Freq=101 evita la contradicción, pero debe medirse a 100 Hz real.
- **Consumo a 100 Hz**: el datasheet da corriente a 7 medidas/s. Con 100 Hz el consumo sube. Medir.
- **Modo SPI**: datasheet (modo 3) vs práctica de la librería SparkFun (modo 0). Verificar con analizador lógico.
- **Bits exactos de Control 1 (X_inhibit, bits 3 y 4)**: el texto de la tabla de bits está desordenado en la conversión. Confirmar posiciones de X_inhibit y YZ_inhibit.
- **Ruido**: la nota de la tabla de especificaciones y la de la lista de características no coinciden en algunas versiones de terceros (0.4 mG vs 2 mG). El datasheet MEMSIC Rev A da 0.4 mG a BW=00 y 1.2 mG a BW=11. Usar el valor del datasheet.
- **Bit de lectura SPI**: el bit 0 = 1 es lectura, según el datasheet (confirmado). Pero no se encontró el nivel de lógica del bit 0 en los ejemplos de SparkFun; confirmar con analizador.
- **Modo de 3 hilos**: el bit Spi_3w (0x0C, bit 6) aparece en el texto de SPI y en la tabla de registros. Confirmar que la posición es bit 6 en la tabla de registros.
- **Datasheet de terceros**: los enlaces de Digi-Key y LCSC no se usaron. La revisión oficial es Rev A (2019); no se encontró revisión posterior en memsic.com.
- **Ruido de medición a 100 Hz**: el ruido total RMS depende de BW; a BW=01 es 0.6 mG. No medido.
