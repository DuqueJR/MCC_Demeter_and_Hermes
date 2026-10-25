---
id: oled_tbeam_supreme
nombre: OLED monocromo 128×64 con controlador SH1106 (T-Beam Supreme)
tipo: Pantalla OLED monocromo 128×64, controlador SH1106, interfaz I2C
ubicacion: CanSat (ambos cohetes)
fabricante: No identificado en las fuentes (el controlador es Sino Wealth SH1106; el módulo lo fabrica LilyGO o su proveedor)
fuentes:
  - https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series (docs/en/t_beam_supreme/t_beam_supreme_hw.md, tabla de direcciones I2C y versiones V3.1)
  - https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series (examples/OLED/SH1106GraphicsTest/utilities.h, bloque T_BEAM_S3_SUPREME_SX1262)
  - https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series (examples/LoRaWAN/RadioLib_OTAA/LoRaBoards.cpp: beginDisplay, display_address, ALDO1)
  - https://github.com/olikraus/u8g2 (librería U8g2 2.34.17 en lib/U8g2 de LilyGO; U8x8lib.cpp, U8g2lib.h: setBusClock)
datasheet_pdf: no descargado (el datasheet SH1106 es de Sino Wealth; no hay dominio oficial de Sino Wealth en la lista permitida para la descarga)
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# OLED de la T-Beam Supreme (SH1106)

## Rol en el proyecto
Pantalla local de estado durante la integración y en campo (estado de sensores, batería, modo SoftAP). Comparte el bus I2C0 con el BME280 y el magnetómetro QMC6310 o QMC6309, por lo que cada refresco completo ocupa el bus y puede retrasar lecturas de esos sensores.

## Datos clave
| Parámetro | Valor | Fuente |
|---|---|---|
| Controlador | SH1106 (LilyGO lo indica explícitamente en la tabla de dispositivos I2C). La versión 3.0 y 3.1 de la placa pueden usar SH1106 | t_beam_supreme_hw.md (tabla de pines y de direcciones) |
| Resolución | 128 × 64 píxeles, monocromo | U8g2 `U8G2_SH1106_128X64_NONAME_F_HW_I2C` |
| Dirección I2C (7 bits) | 0x3C o 0x3D según versión (ver nota) | t_beam_supreme_hw.md; LoRaBoards.cpp `display_address = 0x3c // It might be 0x3D` |
| Bus | I2C0 (`Wire`), SDA 17 / SCL 18, compartido con BME280 (0x77) y magnetómetro | LilyGO `utilities.h` bloque Supreme |
| Alimentación | ALDO1 (3.3 V) | t_beam_supreme_hw.md (tabla PowerManage Channel); LoRaBoards.cpp |
| Reset | No hay `OLED_RST` en el bloque de pines de la Supreme | `utilities.h` |
| Librería usada por LilyGO | U8g2 2.34.17 (`U8G2_SH1106_128X64_NONAME_F_HW_I2C`) | lib/U8g2/library.properties |
| Velocidad I2C | No se fija en los ejemplos LilyGO (no hay `setBusClock`); queda la del `Wire` por defecto | búsqueda en examples/OLED y LoRaBoards |
| Tiempo de transferencia de un frame completo | Estimado: ~24 ms a 400 kHz (1024 bytes de datos × 9 bits + overhead de páginas y START/STOP), ~97 ms a 100 kHz. Estimación, no medida | cálculo sobre protocolo I2C (9 bits por byte con ACK) |

Nota sobre la dirección: LilyGO indica que el SH1106 usa 0x3C o 0x3D. Según su tabla de la Supreme, la dirección depende de la versión del magnetómetro (QMC6310U → pantalla 0x3C; QMC6310N → pantalla 0x3D; QMC6309 → 0x3C). En la versión 3.1 de la placa hay además una resistencia de selección entre 0x3D y 0x3C (sección "Version Note"). La relación exacta por versión no se verificó contra el esquema.

## Interfaz y pines
- I2C0 en GPIO17 (SDA) y GPIO18 (SCL). El display, el BME280 y el magnetómetro comparten bus.
- Sin pin de reset dedicado en la Supreme (`OLED_RST` no definido en el bloque de pines).
- La función de inicialización de LilyGO es `beginDisplay()`: escanea la dirección 0x3C y reporta si no encuentra la pantalla.

## Configuración relevante para nuestro uso
- Elegir la dirección (0x3C o 0x3D) según la versión de la placa y confirmarla con un escaneo I2C antes de inicializar la pantalla.
- Usar U8g2 con el constructor `U8G2_SH1106_128X64_NONAME_F_HW_I2C` (no la variante SSD1306 que aparece en otras placas de LilyGO).
- Para reducir el impacto en el bus del BME280 y del magnetómetro, refrescar la pantalla a baja frecuencia (por ejemplo, 1–2 Hz) o usar actualizaciones parciales si la librería lo permite.
- Si el bus está a 400 kHz, un frame completo ocupa unos 24 ms (estimado): compatible con refresco de 1–10 Hz, pero no con el muestreo de sensores a 1–3.33 kHz.

## Alimentación y tiempos
- Rail: ALDO1 a 3.3 V. ALDO1 también alimenta el BME280 y el magnetómetro (tabla de LilyGO).
- Tiempo de transferencia de un frame (estimado): ~24 ms a 400 kHz; ~97 ms a 100 kHz. Este valor no es una medida.
- Tiempo de encendido del controlador tras habilitar ALDO1: no documentado en lo revisado; LilyGO usa retardos de 20 ms solo en placas con reset dedicado.

## Librerías y ejemplos oficiales
- **U8g2** 2.34.17 (la copia de LilyGO). Ejemplo: `examples/OLED/SH1106GraphicsTest` (`GraphicsTest.ino` con `disp->setFont(u8g2_font_6x10_tf)`).
- **Otros ejemplos**: `SH1106FontUsage`, `SH1106IconMenu`, `SH1106PrintUTF8` (todos en el repo de LilyGO).
- LilyGO no usa `setBusClock` en sus ejemplos de la Supreme; la velocidad queda como la del `Wire` por defecto.

## Trampas y notas
- **Bus compartido**: un refresco completo de la pantalla bloquea el bus I2C0 durante decenas de milisegundos. Si el muestreo de BME280 o del magnetómetro va en la misma tarea o en el mismo bus, pueden producirse lecturas tardías o pérdidas.
- **Alimentación previa al bus**: LilyGO advierte que los dispositivos conectados a 17/18 necesitan que su rail esté encendido antes de cualquier acceso; si no, el I2C falla o se congela. Encender ALDO1 en el arranque antes de tocar I2C0.
- **Dirección**: la versión 3.1 tiene resistencia de selección, por lo que la dirección no es la misma en todas las placas.
- **Confusión de controladores**: otras placas de LilyGO usan SSD1306 (`SSD1306Wire`, `U8G2_SSD1306_128X64_NONAME_F_HW_I2C`). En la Supreme es SH1106.
- **Variante 1.44"**: existe `docs/en/t_beam_supreme/t_beam_supreme_144_hw.md`, que indica también SH1106 y 0x3C/0x3D. No se revisó si es la misma pantalla de 1.3".

## Incertidumbres
- **Tamaño de la pantalla**: LilyGO indica 128×64 y U8g2 lo confirma; el "1.3 pulgadas" del encargo no aparece literalmente en las fuentes revisadas. Confirmar con la pantalla física o con la compra.
- **Tiempo de frame real**: el 24 ms es una estimación teórica; medir con `micros()` en la placa.
- **Velocidad I2C efectiva**: no está fijada en los ejemplos; depende del `Wire` por defecto del core Arduino-ESP32. Verificar con `Wire.getClock()`.
- **Datasheet SH1106**: no descargado; el fabricante (Sino Wealth) no está en la lista de dominios permitidos para la descarga. Pendiente.
- **Dirección 0x3D frente a 0x3C**: la nota de LilyGO dice que la dirección depende del magnetómetro (QMC6310U/N o QMC6309) en la versión 3.0, y de una resistencia en la 3.1. La relación exacta no se verificó contra el esquema.
- **Tiempo de encendido del controlador**: no documentado.
