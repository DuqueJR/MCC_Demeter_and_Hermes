# firmware/

Proyecto **PlatformIO** con Arduino-ESP32 (D-016). Lo crea la tarea **T-002**.

| Environment | Placa | Configuración |
| --- | --- | --- |
| `supreme_hermes` | T-Beam Supreme (ESP32-S3) | `ROCKET_ID=2`, `MODULO_VISIONPACK=0` |
| `supreme_demeter` | T-Beam Supreme (ESP32-S3) | `ROCKET_ID=1`, `MODULO_VISIONPACK=1` |
| `modem_v12` | T-Beam V1.2 (ESP32, SX1262) | Módem TDMA de la estación |

**Leer primero:**
- [firmware_vuelo](../docs/04_diseno/firmware_vuelo.md)
- [buses_y_pines](../docs/03_hardware/buses_y_pines.md)
- [enlace_lora_tdma](../docs/04_diseno/enlace_lora_tdma.md)
- [protocolo_paquetes](../docs/04_diseno/protocolo_paquetes.md)
- [maquina_estados](../docs/04_diseno/maquina_estados.md)
- [constantes](../docs/02_requisitos/constantes.md): se replican en `config.h` con los mismos nombres.
