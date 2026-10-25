---
id: antena_gnss_tan1216q50a
nombre: Antena GNSS quadrifilar helix TAN1216Q50A (equipo) - datos de la MAN1216Q50 de Megsine (equivalencia no confirmada)
tipo: Antena GNSS activa multibanda, quadrifilar helix (QHA), RHCP, con LNA integrado y bias-tee por SMA
ubicacion: CanSat (ambos cohetes)
fabricante: Shenzhen Megsine Technology Co., Ltd (fabricante de la MAN1216Q50; TAN1216Q50A no confirmado como equivalente)
fuentes:
  - https://cdn.sparkfun.com/assets/c/4/1/f/c/MAN1216Q50-Updated-Dec2025.pdf (copia alojada por SparkFun de la datasheet "MAN1216Q50" de Megsine, Rev0 Preliminary 2025/10/17; no es copia del fabricante)
  - https://littlebirdelectronics.com.au/products/gnss-multi-band-l1-l2-l5-helical-antenna-locking-sma (listado de venta que cita la misma datasheet)
datasheet_pdf: no descargado (la copia disponible está alojada por SparkFun, no por el fabricante; no se descargó por la regla de fuentes)
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# Antena GNSS TAN1216Q50A (equipo) / MAN1216Q50 (Megsine)

## Rol en el proyecto
Antena GNSS del CanSat, conectada al MAX-M10S de la T-Beam Supreme. Su función es recibir las señales de satélite con cobertura en el horizonte para mantener fix y hora durante el vuelo (rocket hasta unos 2 km, 5–20 g durante unos 2 s).

## Identificación y limitación importante
- No se encontró ninguna datasheet con el número de parte "TAN1216Q50A" (búsqueda de 3 consultas, sin resultado oficial).
- El único documento técnico encontrado es la datasheet "MAN1216Q50" de Shenzhen Megsine Technology (Rev0, Preliminary, 2025/10/17). Por el prefijo, el tamaño y las bandas similares, puede ser el mismo producto con otra referencia de venta, pero **no está confirmado**.
- Los datos de la tabla siguiente son de la MAN1216Q50. Usarlos solo como referencia hasta que el fabricante confirme la equivalencia.

## Datos clave
Datos de la MAN1216Q50 (Megsine). Todos son valores típicos a Ta = +25 ± 5 °C salvo indicación.

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| Bandas | GPS L1, L2, L5; GLONASS G1, G2; BeiDou B1, B2, B3; Galileo E1, E5, E6; banda L | Datasheet MAN1216Q50 (SparkFun) |
| Ganancia típica por banda (dBi) | GPS L1 1,5; L2 2,5; L5 2. GLO G1 1; G2 1,5. BDS B1 2; B2a 2; B2b 3; B3i 0. GAL E1 1,5; E5a 2; E5b 3; E6 −0,5. Banda L 1 | Datasheet MAN1216Q50, tabla de características de antena |
| Polarización | RHCP | Datasheet MAN1216Q50 |
| Cobertura angular | 360° | Datasheet MAN1216Q50 |
| Impedancia | 50 Ω (nominal) | Datasheet MAN1216Q50 |
| VSWR de salida | máx. 2:1 | Datasheet MAN1216Q50 |
| Relación axial | máx. 3 dB | Datasheet MAN1216Q50 |
| Ganancia del LNA | 28 dB típ. | Datasheet MAN1216Q50, tabla de amplificador |
| Figura de ruido | 1,5 dB típ.; máx. 2 dB | Datasheet MAN1216Q50, tabla de amplificador |
| VSWR de la salida del LNA | máx. 2:1 | Datasheet MAN1216Q50, tabla de amplificador |
| Tensión de alimentación (bias por SMA) | 3,0 V mín.; 16 V máx. | Datasheet MAN1216Q50, tabla de amplificador |
| Corriente de alimentación | 15 mA típ.; 20 mA máx. | Datasheet MAN1216Q50, tabla de amplificador |
| Conector | SMA único: RF y alimentación DC (bias-tee) por el mismo SMA | Datasheet MAN1216Q50, características |
| Dimensiones | 42,16 mm de alto × Φ 50 mm | Datasheet MAN1216Q50, dibujo de dimensiones |
| Peso | 25 g (tabla); "menos de 30 g" (características) | Datasheet MAN1216Q50 |
| Temperatura de operación | −40 °C a +85 °C | Datasheet MAN1216Q50 |
| Temperatura de almacenamiento | −40 °C a +85 °C | Datasheet MAN1216Q50 |
| Protección | IP67 | Datasheet MAN1216Q50 |
| Nivel de sensibilidad a la humedad | MSL 3 | Datasheet MAN1216Q50 |

## Interfaz y pines
- Conector único SMA: RF y DC de bias por el mismo cable (bias-tee). No hay pines separados.
- Cable y conexión al MAX-M10S: la documentación del receptor indica RF_IN (pin 11) y LNA_EN (pin 13) para activar la antena (ver ficha del MAX-M10S). Para la alimentación del LNA, el VCC_RF del M10 da VCC − 0,1 V con hasta 50 mA (ver ficha del MAX-M10S), pero la conexión concreta de la placa no está confirmada.

## Configuración relevante para nuestro uso
- Alimentación del bias: el LNA funciona entre 3,0 y 16 V. Con VCC_RF de 3,3 V el margen es mínimo (3,2 V, muy cerca del mínimo de 3,0 V). Considerar un suministro dedicado en el diseño, o confirmar que la placa lo tiene.
- Consumo: 15 mA típ., 20 mA máx. (a la tensión de bias). Usar 20 mA como peor caso.
- Orientación: la datasheet consultada no da una orientación de montaje recomendada. Con cobertura de 360° y RHCP, el criterio general es dejar el helix con vista libre al cielo (criterio general, no de la datasheet).
- Montaje: el peso (25–30 g) y la protección IP67 son relevantes para la ubicación en el CanSat.

## Alimentación y tiempos
- Tensión del bias: 3,0–16 V.
- Corriente: 15 mA típ., 20 mA máx.
- Potencia aproximada del LNA (cálculo propio): 3,0 V × 0,02 A = 60 mW máx. a 3,0 V; 3,3 V × 0,02 A ≈ 66 mW.

## Librerías y ejemplos oficiales
No aplica. Es un componente pasivo/activo sin librería.

## Trampas y notas
- Al ser un helix multibanda con LNA, la ganancia en L1 (1,5 dBi típ.) es baja comparada con una antena patch. La ventaja es la cobertura de baja elevación y la polarización RHCP.
- La datasheet está marcada como "Preliminary" (Rev0). Valores pueden cambiar.
- VSWR 2:1 y relación axial 3 dB son máximos; la datasheet no da el valor típico de VSWR ni de relación axial.
- Montar lejos de metal grande y de otras antenas es un criterio general de diseño, no un dato de la datasheet; medir con el CanSat ya montado.
- Comprobar que la antena del proyecto tiene la misma referencia que la de la datasheet (la etiqueta física debe coincidir con MAN1216Q50 o TAN1216Q50A).

## Incertidumbres
- Equivalencia TAN1216Q50A = MAN1216Q50: no confirmada. Pedir al fabricante o al proveedor de la antena una datasheet con el número de parte exacto.
- Fabricante de la TAN1216Q50A: no identificado. El único documento técnico encontrado es de Megsine. Puede ser otro fabricante.
- Datasheet "Preliminary" Rev0 de 2025-10-17: los datos pueden cambiar.
- Mínimos y máximos de ganancia por banda: solo se da el valor típico.
- Compatibilidad de bias con el M10: VCC_RF (VCC − 0,1 V, 50 mA) frente a 3,0–16 V del LNA. Confirmar en el esquemático de la T-Beam Supreme.
- Dimensiones y peso reales de la antena montada (conector incluido): no confirmados.
- Respuesta del helix a 5–20 g durante el vuelo (vibración y choque): no hay datos del fabricante.
