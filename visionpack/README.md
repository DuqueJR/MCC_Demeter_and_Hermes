# visionpack/ (solo Demeter)

Es el plano de control de la Raspberry Pi 5 del VisionPack de Demeter, importado tal cual lo entregó ese equipo:

| Archivo | Función |
| --- | --- |
| `demeter_protocol.py` | Trama UART `AA 55 · tipo · len · payload · CRC16-CCITT-FALSE`, con sus tipos y StatusCode |
| `demeter_telemetryd.py` | Recibe por UART de la LilyGO, guarda la telemetría y sincroniza el reloj |
| `demeter_missiond.py` | La máquina de estados de la misión de la Pi y la supervisión de la grabación |

> ⚠️ **Tiene bugs bloqueantes:** el ARM siempre falla, ignora PREFLIGHT y START_ASCENT, y se pierde el RAW si el reset no responde.
> Ver [revision_codigo_pi_demeter](../docs/06_revisiones/revision_codigo_pi_demeter.md) y la tarea T-701.
>
> Faltan en el repo: `demeter_flight.sh`, `demeter_rec.cpp`, `demeter_ingestd.sh`, `demeter_postprocess.py` y las unidades systemd.

**Integración con la LilyGO:** [visionpack_integracion](../docs/04_diseno/visionpack_integracion.md).
