---
id: buzzer_piezo
nombre: Buzzer piezoeléctrico (genérico, pasivo / activo)
tipo: Transductor piezoeléctrico sonoro
ubicacion: CanSat (ambos cohetes)
fabricante: genérico (sin fabricante concreto definido)
fuentes:
  - https://www.diodes.com (AN1176, nota de aplicación sobre buzzers, citada en resultados de búsqueda)
  - https://www.pericom.com/assets/App-Note-Files/Design-Considerations-for-Driving-Piezoelectric-Buzzers.pdf (nota de aplicación, resultados de búsqueda)
  - https://wiki.elecfreaks.com/en/pico/picoed/circuit-design/picoed-starter-kit/case-09 (guía de transistor, resultados de búsqueda)
  - https://zbotic.in/piezoelectric-buzzer-active-vs-passive-and-how-to-drive-them/ (guía no oficial, resultados de búsqueda)
  - https://tinkered.ai/components/piezo-buzzer (guía no oficial, resultados de búsqueda)
datasheet_pdf: no descargado
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# Buzzer piezoeléctrico (genérico)

## Rol en el proyecto

Buzzer de búsqueda tras el aterrizaje en los CanSat. Se maneja con PWM desde el ESP32 a través de un transistor.

## Datos clave

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| Tipo pasivo | Necesita una señal de frecuencia (PWM); el tono lo define la frecuencia de la señal | AN1176 (Diodes), citado en búsqueda |
| Tipo activo | Tiene oscilador interno; se alimenta con DC y emite a su frecuencia de resonancia | Guías no oficiales (zbotic) |
| Frecuencia de resonancia típica (pasivo pequeño) | Del orden de 2 kHz (ejemplo: módulo KY-006 con ~2 kHz) | Guía de módulo, citada en búsqueda |
| Rango orientativo | 2 a 4 kHz (hipótesis del equipo) | Por confirmar con la hoja de datos del buzzer concreto |
| Nivel sonoro (dB a una distancia dada) | No encontrado en fuentes oficiales | — |

## Interfaz y pines

- Dos terminales. Se conecta entre la alimentación y el colector de un transistor (o MOSFET de nivel lógico), con el emisor a masa y la base/puerta a un pin PWM del ESP32 a través de una resistencia.
- Hay que decidir el tipo (pasivo o activo) antes de cablear. Un activo con PWM emite a su frecuencia fija y solo se puede apagar o encender.

## Configuración relevante para nuestro uso

- **Frecuencia de resonancia:** conduce a máxima presión sonora. Un pasivo piezo puede tener varios picos de resonancia (nota de Pericom). El pico exacto debe salir de la hoja de datos del buzzer o de un barrido de frecuencia.
- **Excitación con PWM:** un buzzer de dos terminales excitado con PWM emite a la frecuencia del PWM, con menos presión sonora fuera de resonancia (AN1176).
- **LEDC del ESP32:** el control de frecuencia y ciclo de trabajo del PWM con LEDC no se ha verificado en esta investigación (no consultado en la documentación de Espressif durante la sesión).

## Alimentación y tiempos

- **Corriente:** no investigada. Depende del buzzer concreto y de la alimentación del CanSat.

## Librerías y ejemplos oficiales

- No consultados en esta investigación.

## Trampas y notas

- Las fuentes no están de acuerdo sobre si un piezo puede conectarse directamente a un pin del MCU: una guía dice que la corriente del pin es demasiado débil y recomienda un transistor (Elecfreaks); otra dice que puede alimentarse directamente (Tinkered). Para un sonido fuerte, usar transistor.
- El PWM del ESP32 a 3,3 V da menos presión sonora que una alimentación de 5 V. Esto no se ha medido.
- La resonancia puede variar con la temperatura y con el montaje mecánico del buzzer dentro del CanSat.

## Incertidumbres

- **Frecuencia de resonancia exacta** del buzzer que se compre: no confirmada.
- **Nivel sonoro en dB** a una distancia dada: no encontrado en fuentes oficiales.
- **Consumo y corriente** a 3,3 V o 5 V: no investigado.
- **Pasivo vs activo** del buzzer elegido: decisión pendiente.
- **Fuentes**: ninguna fuente es oficial de un fabricante de buzzers. Las notas de aplicación citadas vienen de resultados de búsqueda y no se abrieron en su totalidad.
