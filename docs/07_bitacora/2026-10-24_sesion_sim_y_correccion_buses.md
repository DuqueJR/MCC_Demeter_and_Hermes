---
fecha: 2026-10-24
tipo: sesion
ids: [D-022, D-031, D-033, PEN-07, PEN-08, PEN-16, PEN-17, PEN-18, PEN-19, PEN-20]
autor: Claude (documentador) con Juan Pablo
rama: (sin commit; pendiente de la autorización del usuario)
---
# Simulación de Demeter y corrección de buses (el M.2 es interno)

## Contexto
1. Juan Pablo pregunta qué hace falta en este momento para tener certeza. Pablo pide revisar si hay pull-ups o pull-downs (internos o en la placa) en las líneas del M.2.
2. Juan Pablo deja en la raíz la exportación de OpenRocket simulada en Santa Fe de Antioquia.

## Qué se hizo
- **Se revisaron a fondo los esquemáticos V3.1 y V3.0** (renderizados).
  - Hallazgo: el conector M.2 es el **enlace interno entre la placa madre (con el ESP32-S3) y la placa de periféricos**. La V3.0 muestra "Expansion board Interface" y "Mother board Interface".
  - Lo que se puede cablear son los headers PN1 y PM1 (13 pines) y el QWIIC.
  - **Los pines 35/36/37 (SPI3) y `PWR_KEY` no salen a ningún header.**
  - **Se reabrió D-022**, que suponía que el M.2 era externo.
- **Pull-ups y pull-downs** (la pregunta de Pablo):
  - En la placa de periféricos hay: 4,7 kΩ en I2C0 hacia A_LDO1; 10 kΩ en el CS de la SD y en IMU_INT; 100 kΩ en RTC_INT; un LED con 1 kΩ en el PPS; 22 Ω en serie en la SD; y en la V3.0, MOSFETs de cambio de nivel en la SD.
  - En los GPIO del header (48, 21, 3, 38, 39, 45, 46) no se ve ninguna resistencia, pero **la placa madre no está publicada: hay que medir**.
  - Estado interno en el reset (datasheet): los GPIO 45/46 tienen pull-down débil (strapping); los 43/44, pull-up débil; el resto queda flotante.
  - Por eso los CS necesitan pull-ups **externos**.
- **Nueva propuesta B′ para D-022:**
  - la SD pasa a SDMMC de 1 bit, y SPI3 queda dedicado a los sensores por el header (SCK 46, MOSI 45, MISO 3, CS 38/48, INT 39);
  - el BMP581 se lee por timer;
  - el MMC5983MA va en I2C0, alimentado de A_LDO1;
  - el QMI8658 queda deshabilitado.
  - La alternativa A′ es soldar a R32–R34.
  - **El pulso de la Pi se queda sin pin.** Las salidas posibles están en buses_y_pines §6.
- **D-031 ajustada:** el DRV5032 va soldado al pad del botón PWR (SW3) y se alimenta de VBAT (PM1).
- **La simulación** se movió a `datos/simulaciones/openrocket/demeter_H135W-8_santa-fe-antioquia_sim2.csv`, sin modificarla. Se escribió el catálogo `datos/README.md` y el análisis `docs/02_requisitos/perfiles_vuelo.md` (D-033).
  - Datos clave: apogeo de 669 m AGL a los 11,54 s; eyección a los 10,07 s, subiendo a 14 m/s (antes del apogeo); 129 m/s máximo; unos 10 g; 229 N·s; descenso a 9,2 m/s; 85 s de vuelo; rampa a 510 m s.n.m.
  - **Confirma que Demeter vuela el H135W-8.** Por descarte, Hermes volaría el G80-7T.
  - **Para el equipo de cohete:** estabilidad de 1,98 calibres al salir del riel (el mínimo es 2,0); masa de 1468,7 g frente al límite de 1200 g de la ficha; el paracaídas configurado "al apogeo"; una presión en el sitio que no es realista.
- Se actualizaron constantes, decisiones, requisitos (HW-07), firmware, pendientes (PEN-07, 08, 16 y 17; nuevos PEN-18, 19 y 20), riesgos (R-01), backlog (T-003, T-107, T-304), plan de pruebas (P-03), el índice, el README y CLAUDE.md.

## Pendiente / siguiente paso
- **PEN-18:** la sesión de verificación física. Cierra D-022.
- PEN-19: ¿el buzzer es activo o pasivo?
- PEN-07: la simulación de Hermes.
- Hacer commit de estos cambios en una rama `docs/` y abrir un PR a `develop`, si el usuario lo autoriza.
