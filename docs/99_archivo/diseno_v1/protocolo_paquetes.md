---
id: protocolo_paquetes
estado: aprobado-v1 (versión de protocolo 2)
actualizado: 2026-10-24
depende_de: [enlace_lora_tdma, maquina_estados, constantes]
decisiones: [D-005, D-006, D-007, D-008, D-009]
reemplaza: 99_archivo/nota_original_estados_y_enlace.md (TelemetryV1, 63 B)
---
# Protocolo de paquetes LoRa (versión 2)

Este documento es el **contrato** entre el firmware de vuelo, el firmware de la estación, el servicio de tierra y la GUI.
Cualquier cambio sube `PROTO_VERSION` y debe actualizar este documento **antes** que el código.

## 0. Reglas generales (D-005)

- **Orden de bytes:** little-endian, igual que el ESP32 y el PC.
- **Estructura:** empaquetada, sin relleno. Los offsets se cuentan en bytes desde el inicio del paquete.
- **Enteros con signo:** complemento a dos.
- **Saturación:** un valor fuera de rango se recorta al máximo o mínimo representable, y nunca da la vuelta.
  - En los tipos con signo, el mínimo absoluto (−32768 en int16, −128 en int8, −2³¹ en int32) queda **reservado como "sin dato"**.
  - Por eso la saturación recorta a ±32767, ±127 y ±(2³¹−1).
- **"Sin dato":**
  - int: el mínimo reservado;
  - uint16: `0xFFFF`;
  - uint8: `0xFF`, salvo que el campo diga otra cosa.
- **Integridad:** CRC-16/CCITT-FALSE (polinomio 0x1021, valor inicial 0xFFFF, sin reflexión y sin xorout).
  - Es el mismo algoritmo del protocolo UART de la Pi.
  - Se calcula sobre todos los bytes anteriores al CRC y se guarda en little-endian.
  - Ojo: el protocolo UART lo guarda en big-endian. Es la única diferencia y es intencional, porque aquí todo es little-endian.
- **Motivo del CRC propio**, si LoRa ya trae CRC por hardware: filtra los paquetes de otros equipos que pasen el sync word y protege los registros del backfill. Cuesta 2 B.
- **Tamaño máximo de un paquete en slot:** 61 B, para que tarde ≤ 16 ms con SF6/BW500 (ver [enlace_lora_tdma.md](enlace_lora_tdma.md)).
- **Validación al recibir:** el paquete debe coincidir en `version`, `tipo`, longitud exacta para ese tipo, `origen` válido y CRC. Si algo falla, se descarta y se cuenta como inválido.

## 1. Cabecera común: 3 bytes (D-006)

| Offset | Campo | Tipo | Contenido |
| --- | --- | --- | --- |
| 0 | `ver_tipo` | u8 | Bits 7–4: `version` (= 2). Bits 3–0: `tipo` (ver tabla). |
| 1 | `origen_sync` | u8 | Bits 3–0: `origen`, es decir, el ID del nodo (0 tierra, 1 Demeter, 2 Hermes). Bits 5–4: `sync`, la fuente de sincronía (0 ninguna, 1 GNSS, 2 derivada, 3 holdover). Bits 7–6: reservados, en 0. |
| 2 | `seq` | u8 | Contador por nodo y por tipo de paquete. Sube en 1 con cada paquete emitido y da la vuelta en 255. Sirve para detectar pérdidas. |

| `tipo` | Nombre | Emisor | Cuándo | Tamaño total |
| --- | --- | --- | --- | --- |
| 0x1 | NAV | Cohete | Su slot, en 9 de cada 10 ciclos (≈ 9 Hz) | **44 B** |
| 0x2 | STATUS | Cohete | Su slot, 1 de cada 10 ciclos (1 Hz) | **42 B** |
| 0x3 | BEACON | Tierra | Slot 0, en cada ciclo sin comando pendiente | **14 B** |
| 0x4 | CMD | Tierra | Slot 0, en lugar del BEACON | **17–25 B** |
| 0x5 | ACK | Cohete | Su slot, el ciclo siguiente al CMD (en lugar de NAV/STATUS) | **12 B** |
| 0x6 | BACKFILL | Cohete | Su slot, solo en LANDED y cuando se pide | **44 B** |
| 0x7–0xF | Reservados | | | |

**Calendario del slot de un cohete.** Sea `c = floor(utc_ms / 100) mod 10` el número de ciclo:
- Si hay un ACK pendiente, se manda el ACK.
- Si no, con `c == 0` se manda STATUS.
- Si no, en LANDED con backfill activo y `c ≠ 5`, se manda BACKFILL.
- En cualquier otro caso, NAV.

En ALOHA se alterna NAV y STATUS.

## 2. NAV (tipo 0x1): 44 B, navegación rápida (D-007)

| Offset | Campo | Tipo | Unidad / escala | Rango | Notas |
| --- | --- | --- | --- | --- | --- |
| 0 | cabecera | 3 B | | | |
| 3 | `t_ms` | u32 | ms desde el arranque del ESP32 (monotónico) | 49 días | La hora UTC sale de STATUS (`utc_ms` frente a `t_ms`). |
| 7 | `lat_e7` | i32 | grados × 1e7 | ±90° | Salida del EKF. Si el EKF no está listo, sale del GNSS crudo (`flags.EKF_OK = 0`). Sin posición: −2³¹. |
| 11 | `lon_e7` | i32 | grados × 1e7 | ±180° | Ídem. |
| 15 | `alt_dm` | i16 | decímetros **AGL**, sobre el origen del EKF (la rampa, fijado en ARM) | ±3276,7 m | Antes de ARM, el origen es provisional. Ver `alt_origen_msl_dm` en STATUS. |
| 17 | `vel_n_cms` | i16 | cm/s, hacia el norte | ±327 m/s | Marco ENU. |
| 19 | `vel_e_cms` | i16 | cm/s, hacia el este | ±327 m/s | |
| 21 | `vel_u_cms` | i16 | cm/s, **positivo hacia arriba** | ±327 m/s | Es la Vz que usa la máquina de estados. |
| 23 | `q_w` | i16 | Q15: valor = q × 32767 | ±1 | Cuaternión unitario que rota vectores del cuerpo al marco ENU. Se publica con `q_w ≥ 0` (forma canónica). |
| 25 | `q_x` | i16 | Q15 | ±1 | |
| 27 | `q_y` | i16 | Q15 | ±1 | |
| 29 | `q_z` | i16 | Q15 | ±1 | |
| 31 | `acc_x_mg` | i16 | mg, fuerza específica en el cuerpo, **promedio de los 100 ms del ciclo** | ±32,767 g | En reposo, el eje vertical marca +1000. |
| 33 | `acc_y_mg` | i16 | mg | ±32,767 g | |
| 35 | `acc_z_mg` | i16 | mg | ±32,767 g | |
| 37 | `fase` | u8 | código de la máquina de estados | 0–9 | Ver [maquina_estados.md](maquina_estados.md). |
| 38 | `estado_sec` | u8 | estado del módulo secundario | | Demeter: `StatusCode` de la Pi. `0xFE`: módulo sin respuesta. `0xFF`: no aplica (Hermes). |
| 39 | `flags` | u8 | bits | | Ver la tabla de flags. |
| 40 | `act` | u8 | bits de actuadores y salidas | | Ver la tabla de act. |
| 41 | `bat_pct` | u8 | % de batería (fuel gauge del AXP2101) | 0–100 | `0xFF`: sin dato. |
| 42 | `crc16` | u16 | | | |

**`flags`:**
- bit 0 `GNSS_FIX`: fix 3D válido;
- bit 1 `EKF_OK`;
- bit 2 `FALLA_ACTIVA`: algún bit de `fallas` está en 1, y el detalle va en STATUS;
- bit 3 `EYECCION`: ya se detectó la eyección;
- bit 4 `APOGEO`: ya se detectó el apogeo;
- bit 5 `LOG_ACTIVO`: la SD está escribiendo;
- bit 6 `REANUDADO`: el nodo arrancó en medio de un vuelo;
- bit 7: reservado.

**`act`:**
- bit 0 `PI_PULSO`: ya se envió el pulso de encendido a la Pi;
- bit 1 `CAM_OK`: la Pi reporta por UART un StatusCode de grabación. Lo deriva el firmware: no hay GPIO de entrada (D-031);
- bit 2 `BUZZER`;
- bit 3 `WIFI_AP`;
- bit 4 `BACKFILL`: hay un backfill en curso;
- bits 5–7: reservados.

**Lo que se quitó respecto a TelemetryV1, y por qué:**
- **El giroscopio:** la actitud ya va en el cuaternión, y la SD guarda el giro a tasa completa. *Objetivos* no lo pide en la telemetría.
- **`mission_id`, la hora UTC de 8 B, las temperaturas y `nav_correction`:** cambian lento, así que pasan a STATUS a 1 Hz.
- **`rocket_id` de 2 B:** queda en 4 bits de la cabecera.

**Resultado:** 63 B pasan a 44 B, es decir, de 59 ms a 13 ms en el aire. El límite de 50 B de *Objetivos* se cumple.

## 3. STATUS (tipo 0x2): 42 B, estado lento, a 1 Hz

| Offset | Campo | Tipo | Unidad | Notas |
| --- | --- | --- | --- | --- |
| 0 | cabecera | 3 B | | |
| 3 | `t_ms` | u32 | ms desde el arranque | El mismo reloj de NAV. |
| 7 | `utc_ms` | u64 | ms UTC (época Unix) en el instante `t_ms` | 0 si no hay hora válida. Permite pasar cualquier `t_ms` a UTC. |
| 15 | `mission_id` | u32 | segundos UTC (época Unix) en el momento del ARM | 0 antes de ARM. Es único y se puede ordenar. |
| 19 | `boot_count` | u8 | arranques del ESP32 (se guarda en NVS) | Si salta en pleno vuelo, el ESP32 se reinició. |
| 20 | `gnss_fix` | u8 | 0 sin fix, 2 fix 2D, 3 fix 3D | |
| 21 | `gnss_sv` | u8 | satélites usados | |
| 22 | `gnss_hacc_dm` | u8 | precisión horizontal, en dm | Satura en 254. `0xFF`: sin dato. |
| 23 | `bat_mv` | u16 | mV de batería | |
| 25 | `temp_esp_c` | i8 | °C del sensor interno del ESP32 | |
| 26 | `temp_pi_c` | i8 | °C de la Pi | −128 en Hermes o si no hay dato. |
| 27 | `fallas` | u16 | bitmap | Ver la tabla de fallas. |
| 29 | `calib` | u8 | bitmap | Ver la tabla de calib. |
| 30 | `nav_innov_cm` | u16 | magnitud de la innovación de posición GNSS en el EKF, en cm | `0xFFFF`: no aplica. Mide la salud del EKF. |
| 32 | `apogeo_dm` | i16 | altitud AGL máxima registrada, en dm | La GUI la muestra fija. |
| 34 | `alt_origen_msl_dm` | i16 | altitud sobre el nivel del mar del origen del EKF, en dm | Con esto, `alt_dm` se puede pasar a MSL. |
| 36 | `sd_libre_mb` | u16 | MB libres en la SD | |
| 38 | `rssi_tierra_dbm` | i8 | RSSI del último BEACON o CMD recibido de la estación | Calidad del uplink. |
| 39 | `ultimo_cmd_seq` | u8 | `cmd_seq` del último comando ejecutado | |
| 40 | `crc16` | u16 | | |

**`fallas` (u16):** el bit en 1 significa que el componente está en falla en este momento.
- 0 LSM6DSO32
- 1 BMP581
- 2 MMC5983MA
- 3 QMI8658
- 4 BME280
- 5 QMC6310
- 6 GNSS sin datos, que no es lo mismo que sin fix
- 7 SD
- 8 PMIC
- 9 radio (fallo de TX)
- 10 EKF divergente
- 11 UART del VisionPack
- 12 RTC
- 13 batería baja (menos de `BAT_MIN_ARM_PCT`)
- 14–15 reservados

**`calib` (u8):**
- 0 bias del giro, calculado
- 1 magnetómetro calibrado
- 2 referencia barométrica fijada
- 3 origen del EKF fijado (posición inicial GNSS)
- 4 alineación inicial de la actitud
- 5–7 reservados

## 4. BEACON (tipo 0x3): 14 B, desde tierra

| Offset | Campo | Tipo | Notas |
| --- | --- | --- | --- |
| 0 | cabecera | 3 B | `origen = 0`. `sync` dice si la hora de la estación es GNSS, derivada, holdover o libre. |
| 3 | `utc_ms` | u64 | Hora UTC del **inicio del ciclo** al que pertenece este beacon (múltiplo de 100). Si la estación es maestro libre, es su hora local. |
| 11 | `gs_flags` | u8 | bit 0: la estación tiene GNSS. bit 1: hay internet hacia el servidor (informativo). bits 2–7: reservados. |
| 12 | `crc16` | u16 | |

Para sincronizarse, el receptor calcula: inicio_del_ciclo_local = t_RxDone − ToA(14 B) − `TDMA_GUARD_INICIO_MS`.

## 5. CMD (tipo 0x4): de 17 a 25 B, desde tierra (D-008)

| Offset | Campo | Tipo | Notas |
| --- | --- | --- | --- |
| 0 | cabecera | 3 B | `origen = 0` |
| 3 | `utc_ms` | u64 | Igual que en BEACON. Un CMD también sirve para sincronizar. |
| 11 | `destino` | u8 | ID del cohete. `0x0F` = todos, y solo se acepta en `PING`. |
| 12 | `cmd_seq` | u8 | Sube con cada comando **nuevo**. Los reintentos repiten el mismo valor. |
| 13 | `cmd_id` | u8 | Ver la tabla de comandos. |
| 14 | `arg_len` | u8 | De 0 a 8. |
| 15 | `args` | `arg_len` B | |
| 15+n | `crc16` | u16 | |

**Fiabilidad:**
- La estación repite el mismo CMD en cada slot 0 hasta recibir el ACK, con un máximo de `CMD_REINTENTOS_MAX` (10, es decir, 1 s). Si no llega, la GUI muestra "sin confirmación".
- El cohete ejecuta cada `cmd_seq` **una sola vez**: los duplicados solo vuelven a recibir el ACK.

### Tabla de comandos (v1)

| `cmd_id` | Nombre | Argumentos | Fases en que se acepta | Efecto |
| --- | --- | --- | --- | --- |
| 0x01 | `PING` | — | Todas | Responde con ACK. |
| 0x10 | `ARM` | — | PREFLIGHT | Si el Go/No-Go está en verde, pasa a ARMED. Si no, ACK con código 2. |
| 0x11 | `DISARM` | — | ARMED | Vuelve a PREFLIGHT. |
| 0x12 | `RECALIBRAR` | — | PREFLIGHT | Recalcula el bias del giro, la alineación inicial y la referencia barométrica. Necesita el cohete quieto. |
| 0x13 | `SYSTEM_CHECK` | — | PREFLIGHT, ARMED | Corre las verificaciones y adelanta el siguiente STATUS. |
| 0x14 | `SET_CANAL` | u8 índice en `LORA_CANALES` | PREFLIGHT | El cohete manda el ACK y cambia de canal 2 s después. Si en 10 s no escucha beacon en el canal nuevo, **vuelve al anterior**. *(Debería tenerse; no es obligatorio.)* |
| 0x20 | `PI_ENCENDER` | — | PREFLIGHT, ARMED (solo Demeter) | Pulso de encendido de 1,5 s. |
| 0x21 | `PI_GRABAR` | u8 (1 = iniciar, 0 = detener) | PREFLIGHT, ARMED, LANDED (solo Demeter) | Mando manual de la grabación. La equivalencia con los comandos UART está en [visionpack_integracion.md](visionpack_integracion.md). |
| 0x30 | `FORZAR_ATERRIZADO` | — | FREE_FALL, DESCENT | El operador, mirando la telemetría, declara el aterrizaje. Es la única transición manual en vuelo. |
| 0x31 | `WIFI_AP` | u8 (1 = encender, 0 = apagar) | LANDED | Punto de acceso para el volcado completo. |
| 0x32 | `BACKFILL` | u8 (1 = iniciar, 0 = detener) | LANDED | Reenvía los registros NAV del vuelo. |
| 0x33 | `BUZZER` | u8 (1 = encender, 0 = apagar) | PREFLIGHT (prueba), LANDED | |

No hay comandos de actuadores de recuperación: el DCP prohíbe el despliegue electrónico. *Objetivos* menciona un "control mecánico", pero queda fuera.

## 6. ACK (tipo 0x5): 12 B

| Offset | Campo | Tipo | Notas |
| --- | --- | --- | --- |
| 0 | cabecera | 3 B | |
| 3 | `t_ms` | u32 | |
| 7 | `cmd_seq` | u8 | |
| 8 | `cmd_id` | u8 | |
| 9 | `resultado` | u8 | 0 OK · 1 rechazado por la fase · 2 rechazado porque no se cumplen las condiciones (el detalle va en `fallas` del siguiente STATUS) · 3 comando desconocido · 4 argumento inválido |
| 10 | `crc16` | u16 | |

## 7. BACKFILL (tipo 0x6): 44 B (D-009)

- **Estructura:** la misma de NAV, con `tipo = 0x6`. El cuerpo, del offset 3 al 41, es **un registro NAV guardado**: el mismo que se transmitió, o que se intentó transmitir, en vuelo.
- **Qué se guarda:** el cohete conserva en RAM (PSRAM) y en la SD todos los registros NAV, desde `BOOST − PRETRIGGER_S` hasta LANDED.
- **Qué hace el cohete:** al recibir `BACKFILL 1`, los envía en orden en su slot, uno por ciclo, intercalados con NAV y STATUS (ver el calendario). Un vuelo de 3 minutos son unos 1800 registros, unos 3,5 minutos de envío.
- **Qué hace la estación:** combina los registros por `t_ms` y descarta los que ya tiene. La versión 1 manda todo, sin pedir rangos, por simplicidad. Pedir solo los rangos faltantes queda para la v2.
- Los **datos completos** (MB) se descargan por **Wi-Fi AP**: ver [firmware_vuelo.md](firmware_vuelo.md), volcado.

## 8. Marcos de referencia (D-007)

- **Marco de navegación:** ENU local (Este, Norte, Arriba), tangente en el origen del EKF. El origen se fija en ARM con la posición GNSS promediada en PREFLIGHT y la referencia barométrica.
- **Marco del cuerpo:**
  - X sobre el eje longitudinal del cohete, positivo hacia la nariz;
  - Y y Z completan un sistema dextrógiro, según cómo se monte el CanSat;
  - **la orientación física del montaje está pendiente** de medir y queda en [constantes.md](../02_requisitos/constantes.md) como la matriz `R_MONTAJE`.
- Toda la telemetría sale **en el marco del cuerpo del cohete**, no en el de los ejes de cada sensor. La matriz de montaje de cada sensor se aplica en el firmware.
