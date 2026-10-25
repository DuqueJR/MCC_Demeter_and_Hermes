---
fecha: 2026-10-24
tipo: sesion
ids: [D-022, D-031, D-032, T-001, PEN-01, PEN-02, PEN-03, PEN-04, PEN-16, PEN-17]
autor: Claude (documentador) con Juan Pablo
rama: main / develop
---
# Pines, encendido y creación del repo

## Contexto
Juan Pablo **delega en Claude** la asignación de pines del SPI externo y la conexión del DRV5032, porque el cableado todavía no está hecho. Confirma el motor H135W-8 y pide crear el repo en `DuqueJR/MCC_Demeter_and_Hermes`, ordenarlo y subirlo.

## Respuestas registradas
- **DRV5032:** ScoutMakes (Adafruit 6051), omnipolar digital. "Define el pin que quieras."
- **Pines y cableado del SPI externo:** "lo defines tú, aún no está hecho."
- **Motor H:** sí, es el H135W perforado a 8 s.
- **Conexión del DRV5032:** "lo decides tú, aún no está montado."

## Qué se hizo
- **Revisión del esquemático V3.1:** el conector M.2 de expansión expone `SPI_SCK/MOSI/MISO` (el bus de periféricos 35/36/37), `SCL/SDA`, `PWR_KEY`, `CHIP_PU`, `U0TXD/U0RXD` y los GPIO 21, 38, 39, 45, 46 y 48. **Los GPIO 2, 15 y 16 no salen al conector.**
- **D-022 (cerrada):**
  - el LSM6DSO32 (CS 38, INT 39) y el BMP581 (CS 48, INT 21) van en SPI3, compartido con la SD y el QMI8658, con una sola tarea dueña del bus y la SD en bloques ≤ 8 ms;
  - **el MMC5983MA va a I2C0 (0x30)**, porque los GPIO expuestos no alcanzan para un tercer CS y *Objetivos* ya pone el magnetómetro en I2C0;
  - buzzer en el 46, pulso a la Pi en el 45 (los dos solo como salida, con pull-down), UART a la Pi en 43/44;
  - `cam=1` se deriva de la UART, sin GPIO.
- **D-031:** el DRV5032 va a `PWR_KEY` del AXP2101 por un diodo Schottky, alimentado por VBAT. El imán enciende la placa desde el apagado total, y el apagado por pulsación larga se bloquea desde ARMED hasta LANDED.
- Documentos actualizados: `buses_y_pines` (reescrito), constantes (pines y `SPI3_SD_MAX_MS`), firmware (`t_bus_spi3` y `t_bus_i2c0`), máquina de estados (T0 y el bloqueo del apagado), protocolo, VisionPack, requisitos HW-01/04/07, decisiones, pendientes, riesgos, backlog y el directorio de componentes.
- **El repo:**
  - la bóveda pasó de `docs/Hermes/` a `docs/`;
  - los originales pasaron a `docs/fuentes/` y el código de la Pi a `visionpack/`;
  - se crearon `firmware/`, `estacion/`, `gui/` y `tools/`, cada una con su README;
  - se agregaron un README raíz, `.gitignore`, `.gitattributes` y la plantilla de PR;
  - los PDF de los datasheets quedan fuera, porque no hay Git LFS;
  - commits semánticos en `main`, la rama `develop` creada, y las dos subidas al remoto.

## Pendiente / siguiente paso
- **PEN-17:** el equipo de hardware cablea según [buses_y_pines](../03_hardware/buses_y_pines.md) §5.
- **PEN-12:** verificar en el banco el mapa del conector M.2, VBAT y el registro de la pulsación larga.
- Proteger `main` y `develop` en GitHub.
- Se puede empezar con T-002, T-003, T-005, T-006, T-304, T-502 y T-701.

## Documentos afectados
Ver "Qué se hizo".
