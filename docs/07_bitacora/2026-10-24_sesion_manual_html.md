---
fecha: 2026-10-24
tipo: sesion
ids: [PEN-10, PEN-12, D-022, D-023]
autor: Claude (documentador) con Juan Pablo
rama: (sin commit)
---
# Actualización del manual HTML para el equipo

## Contexto
La guía HTML del 2026-10-23 ("Manual de Vuelo Hermes") estaba desactualizada: decía que Hermes partía de cero, usaba SF7/BW250 y no incluía los contratos v1, D-022 ni la simulación de Demeter. Juan Pablo pidió actualizarla con el plan, lo que tenemos, cómo se interconecta el sistema y lo que falta.

## Qué se hizo
- Se reescribió el artifact (misma URL: https://claude.ai/artifact/93Xnu4EppSFnWyhAcSKVDE) como **"Manual de Vuelo Hermes + Demeter"**, para todo el equipo.
- Respuestas de Juan Pablo: la audiencia es todo el equipo; no hay novedades fuera del repo; se conservan las pestañas didácticas, actualizadas; "Qué falta" incluye a los otros equipos, agrupado por responsable.
- Pestañas: Inicio, Plan (cronograma, hitos, rutas críticas, backlog filtrable), Cómo funciona (diagrama del sistema, el vuelo en 12 pasos, el perfil de la sim. de Demeter a escala y el ciclo TDMA a escala), Hardware (opción B′ y A′), Software, Qué falta, Concurso, Cohetería 101, Masa y Glosario.
- Todo sale de `docs/`. No se agregaron datos nuevos.

## Problemas encontrados (inconsistencias en la documentación, sin corregir)
1. `04_diseno/visionpack_integracion.md` §1 y §3 dicen que el pulso de la Pi sale del **GPIO 45** y que la UART va por "QWIIC o M.2". Con B′, el 45 es el MOSI de los sensores y el pulso no tiene pin (buses_y_pines §6). PEN-10 repite el GPIO 45.
2. `03_hardware/componentes.md` pone el INT del BMP581 en el **21** y el QMI8658 en SPI3. Con B′, ese INT no se cablea, el 21 es el buzzer y el QMI8658 queda deshabilitado.
3. PEN-12 habla del "mapa del conector M.2"; el M.2 es interno y lo que se verifica son el PN1 y el PM1.

## Pendiente / siguiente paso
- Corregir las tres inconsistencias, si el usuario lo autoriza.
- El artifact es privado: hay que compartirlo desde su menú Share para que el equipo lo vea.

## Documentos afectados
- Ninguno del repo, salvo esta entrada y el índice de la bitácora.
