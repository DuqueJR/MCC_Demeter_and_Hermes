---
id: antena_gnss_patch_estacion
nombre: Antena GNSS activa cerámica patch L1 genérica (estación terrena)
tipo: Antena GNSS activa cerámica patch, banda L1 (genérica, sin modelo identificado)
ubicacion: Estación
fabricante: no identificado (genérica)
fuentes:
  - https://www.u-blox.com/sites/default/files/NEO-M8-FW3_DataSheet_UBX-15031086.pdf (datasheet NEO-M8N R14: sec. 1.21 LNA_EN, control del LNA o antena activa)
  - https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/blob/master/docs/en/t_beam_supreme/t_beam_supreme_hw.md (nota de LilyGO: conectar la antena antes de transmitir; sobre la Supreme, no sobre esta antena)
datasheet_pdf: no descargado (fabricante no identificado)
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# Antena GNSS patch cerámica activa L1 (estación)

## Rol en el proyecto
Antena GNSS de la estación terrena, conectada al NEO-M8N de la T-Beam V1.2. Recibe L1 para la hora y el PPS que sincronizan la estación con el TDMA del CanSat. La estación está en tierra, así que no hay requisitos de dinámica en la antena.

## Datos clave
No se encontró datasheet del modelo ni del fabricante durante esta investigación. Los datos que siguen son solo los que documenta u-blox para el NEO-M8N y el control de antena activa; ganancia, figura de ruido, tensión de alimentación y consumo de la antena concreta están **sin confirmar**.

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| Banda | L1 (1575,42 MHz), que es la señal común de GPS, Galileo y BDS B1C | Datasheet NEO-M8N (sec. de señales); antena genérica sin confirmar |
| Alimentación de la antena | Salida VCC_RF del NEO-M8N (sección RF) y control por LNA_EN (sec. 1.21) | Datasheet NEO-M8N R14 |
| Control de encendido | LNA_EN: control opcional para encender o apagar la antena activa o el LNA externo | Datasheet NEO-M8N R14, sec. 1.21 |
| Ganancia, NF, tensión y corriente de la antena | No confirmadas | Pendiente |

## Interfaz y pines
- Conector de antena: RF_IN del NEO-M8N (pin de entrada GNSS). La T-Beam V1.2 no está documentada en esta investigación en cuanto al conector concreto de la antena GNSS (SMA, u.FL u otro).
- LNA_EN: control del encendido de la antena activa, si la placa lo conecta.
- VCC_RF: salida de tensión de la sección RF del módulo (datasheet R14). La tensión y corriente máximas de VCC_RF del NEO-M8N no se pudieron leer con certeza en la extracción.

## Configuración relevante para nuestro uso
- Antena activa: la alimentación debe venir por el conector (bias) o por VCC_RF. Confirmar en el esquemático de la T-Beam V1.2 cuál de las dos opciones aplica.
- Si se usa LNA_EN para apagar la antena activa en reposo, configurar el módulo antes de usar la antena.
- Orientación: vista libre al cielo, con la cara activa hacia arriba. Es un criterio general, no de una datasheet.

## Alimentación y tiempos
- Sin datos confirmados de consumo de la antena. Pendiente de la hoja de la antena concreta.
- El tiempo de arranque de la estación depende del NEO-M8N (ver su ficha), no de la antena.

## Librerías y ejemplos oficiales
No aplica. Antena pasiva/activa sin librería.

## Trampas y notas
- Plano de tierra: una patch cerámica necesita un plano de tierra de tamaño adecuado para su ganancia y su diagrama. Sin plano, la ganancia y el patrón cambian. Criterio general de diseño de antenas patch; no viene de una datasheet consultada.
- Orientación hacia el cielo: una patch tiene ganancia máxima en la dirección normal al plano. Montarla con el plano horizontal y la cara hacia arriba. Criterio general.
- Alimentación de bias: si la antena es activa, la tensión debe ser la que pida el fabricante de esa antena, no la del módulo, hasta que se confirme la placa.
- LilyGO recomienda conectar la antena antes de transmitir, para no dañar el módulo RF (esa nota es de la Supreme y aplica al LoRa; en la estación conviene seguirla también para la antena GNSS como buena práctica).

## Incertidumbres
- Modelo y fabricante de la antena patch: no identificados.
- Ganancia, figura de ruido, rango de tensión de bias, consumo y VSWR: sin datos.
- Conector concreto de la antena en la T-Beam V1.2 y si la antena es activa o pasiva: sin confirmar.
- Dimensiones del plano de tierra necesario para el modelo concreto: sin datos.
- Comportamiento de la antena frente a la interferencia de la radio LoRa de la misma estación (distancia o aislamiento entre antenas): no investigado.
