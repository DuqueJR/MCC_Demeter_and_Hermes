---
fecha: 2026-10-24
tipo: reunion
ids: [D-022, PEN-16, PEN-18, PEN-19]
autor: Claude (documentador) con Juan Pablo
rama: (sin commit)
---
# Lista de pines de los headers y motores

## Respuestas registradas
- **Motores (confirmado):** Hermes vuela el **G80-7T**; Demeter, el **H135W-8**. Se cierra PEN-16.
- El usuario entrega `pines.csv`, con la lista de pines de los headers y una descripción de cada uno. Se movió, sin modificarlo, a `docs/fuentes/pines_headers_tbeam_supreme.csv`.

## Qué resuelve el CSV
- **Confirma el inventario de los headers** (PN1, PM1 y QWIIC) y coincide con el esquemático V3.1.
  - **Confirma que el SPI3 (35/36/37) y `PWR_KEY` no salen a los headers.** Es coherente con la corrección de que el M.2 es interno.
- **Aparece el IO2**, en el lugar de la red `RADIO_RETAIN` del esquemático. Con él quedan **8 GPIO libres**: 48, 21, 3, 2, 38, 39, 45 y 46.
  - **Le da pin al pulso de encendido de la Pi de Demeter (IO2)**, que en la propuesta B′ no tenía. Ya no hace falta mover el buzzer ni comprar un expansor.
- **Rieles en el header:**
  - DC1 (3,3 V): se decide alimentar de ahí los breakouts externos y sus pull-ups;
  - A-LDO2;
  - B-LDO2;
  - VBAT: el DRV5032;
  - VSYS, VBUS, DC4 y DC5.
- **El IO6 es la línea del PPS:** no se usa como GPIO.

## Qué no resuelve
- **D-022 sigue dependiendo de la prueba de la SD en modo SDMMC** (PEN-18, T-003).
- **Las resistencias de la placa madre** en esos pines: hay que medirlas.
- Que `RADIO_RETAIN` no use el IO2 en la variante SX1262: hay que verificarlo con el multímetro.
- Varias descripciones del CSV son interpretaciones, por ejemplo "UART1 auxiliar" en QWIIC, cuando son los mismos GPIO de la UART0. Como fuente de verdad se usa el esquemático, y el CSV como confirmación del header.

## Documentos afectados
`buses_y_pines` (§2, §3, §4 y §6), `constantes`, `decisiones` (D-022), `firmware_vuelo` (DC1 y el reset por software de los breakouts), `visionpack_integracion`, `perfiles_vuelo` y `pendientes` (PEN-16, 18 y 19).
