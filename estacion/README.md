# estacion/

**Servicio de tierra** en Python (T-602):
- lee el módem T-Beam V1.2 por USB y guarda el log crudo;
- decodifica el protocolo v2 y mantiene el estado de cada cohete;
- envía comandos con reintentos;
- reenvía los datos al servidor remoto.

El firmware del módem está en `firmware/` (environment `modem_v12`).

**Leer primero:**
- [estacion_terrena](../docs/04_diseno/estacion_terrena.md)
- [protocolo_paquetes](../docs/04_diseno/protocolo_paquetes.md)
- [constantes](../docs/02_requisitos/constantes.md): se replican en `constantes.py`.
