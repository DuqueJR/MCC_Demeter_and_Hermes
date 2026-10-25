---
id: C-03
estado: borrador (lo redacta A y lo revisa B; se congela en H0, T-S03)
actualizado: 2026-10-25
depende_de: [estacion_terrena, protocolo_paquetes, enlace_lora_tdma, visionpack_integracion, constantes]
completa: estacion_terrena §2.1 ("los tipos se definen al implementar")
---
# C-03. Trama USB entre el módem (T-Beam V1.2) y el servicio de tierra

**Para qué:** que el firmware del módem (T-601) y el servicio de tierra (T-602) se desarrollen por separado, y que exista un **módem falso** (T-S07) para probar todo el servicio de tierra sin la V1.2.

## 1. Trama

- **La misma de la Pi** (D-024, [visionpack_integracion](../../../04_diseno/visionpack_integracion.md) §1): `AA 55 | tipo u8 | len u8 | payload (len B) | CRC16`.
- **CRC-16/CCITT-FALSE** sobre `tipo`, `len` y `payload`, guardado en **big-endian**, como en `demeter_protocol.py`. **Los campos del payload van en little-endian.**
- Payload máximo: 255 B.
- **Velocidad:** `MODEM_USB_BAUD` (921600).
- **Resincronización:** se busca `AA 55`. Una trama con CRC inválido o una longitud imposible se descarta y **se cuenta**.
- **Texto:** solo en el tipo `LOG`. La prohibición de texto de *Objetivos* 4.2 aplica al enlace LoRa, no al USB.

## 2. Del módem al PC

| Tipo | Nombre | Cuándo | Payload (offset: campo, tipo) |
| --- | --- | --- | --- |
| 0x01 | `RX_PAQUETE` | Cada paquete LoRa con el CRC de LoRa correcto | 0: `t_us_rx` u64 (RxDone, reloj del módem) · 8: `utc_ms_rx` u64 (0 si no hay hora) · 16: `rssi_dbm` i16 · 18: `snr_cuartos_db` i8 (SNR × 4) · 19: `slot_estimado` u8 (0–3; 0xFF si no se sabe) · 20: `n` u8 · 21: `paquete` (n B, **los bytes LoRa tal cual**, ≤ 58) |
| 0x02 | `TX_HECHO` | Después de cada transmisión en el slot 0 | 0: `t_us_tx` u64 · 8: `utc_ciclo_ms` u64 · 16: `tipo_lora` u8 (0x3 BEACON / 0x4 CMD) · 17: `cmd_seq` u8 (0xFF si es un BEACON) |
| 0x03 | `ESTADO_MODEM` | A 1 Hz, y en respuesta a `PING_MODEM` | 0: `t_us` u64 · 8: `utc_ms` u64 · 16: `sync` u8 (0–3) · 17: `gnss_fix` u8 · 18: `gnss_sv` u8 · 19: `lat_e7` i32 · 23: `lon_e7` i32 · 27: `alt_msl_cm` i32 · 31: `canal_idx` u8 · 32: `cmd_pendiente` u8 · 33: `rx_ok` u32 · 37: `rx_err_crc` u32 · 41: `usb_err` u32 · 45: `version` u32 (hash de git corto) |
| 0x04 | `LOG` | Diagnóstico | Texto ASCII (≤ 255 B) |

**La posición de la estación** (`lat_e7`, `lon_e7`, `alt_msl_cm`) sale del NEO-M8N y alimenta GS-02 (distancia, azimut y elevación).

## 3. Del PC al módem

| Tipo | Nombre | Payload | Efecto |
| --- | --- | --- | --- |
| 0x81 | `TX_PEDIDO` | 0: `destino` u8 · 1: `cmd_seq` u8 · 2: `cmd_id` u8 · 3: `arg_len` u8 (0–8) · 4: `args` | El módem **arma el CMD** ([protocolo](../../../04_diseno/protocolo_paquetes.md) §5) con su `utc_ms` del ciclo y su CRC, y lo manda **en el siguiente slot 0** en lugar del BEACON. Responde con `TX_HECHO`. |
| 0x82 | `TX_CANCELAR` | 0: `cmd_seq` u8 | Quita el pedido si todavía no salió |
| 0x83 | `PING_MODEM` | — | Responde con `ESTADO_MODEM` |
| 0x84 | `SET_CANAL_MODEM` | 0: `canal_idx` u8 | Solo para el procedimiento de `SET_CANAL` y para el escaneo del sitio (P-15). **Nunca en vuelo**: el servicio lo bloquea si algún cohete está en ARMED o más adelante. |

**Los reintentos los decide el PC** ([estacion_terrena](../../../04_diseno/estacion_terrena.md) §2.1). El módem guarda **un solo** pedido pendiente: un pedido nuevo reemplaza al anterior.

> **Nota sobre D-024:** el módem sigue sin interpretar el contenido de los paquetes que **recibe**. Pero, para poner la hora del ciclo en el CMD, **arma** el CMD con los campos que le pasa el PC. Es un matiz de D-024 que la sincronización de H0 debe aceptar.

## 4. Vectores de prueba

- **Dónde:** `tools/vectores/usb/`. Cada caso es un archivo JSON con `descripcion`, los campos y `hex` (la trama completa).
- **Casos mínimos:**
  - un `RX_PAQUETE` con un NAV real tomado de los vectores del protocolo;
  - un `RX_PAQUETE` con un STATUS;
  - un `ESTADO_MODEM` sin GNSS;
  - un `TX_PEDIDO` ARM;
  - una trama con CRC malo (se descarta);
  - dos tramas pegadas, más basura antes de `AA 55`.
- **Pasan los mismos vectores en el firmware del módem (Unity, `native`), en el servicio de tierra (pytest) y en el módem falso.**

## 5. Módem falso (T-S07)

- **Qué es:** un proceso en Python que expone un puerto serie virtual y habla C-03.
- **De dónde saca los datos:** de los vuelos sintéticos de T-304 ([C-04](04_formato_log_y_replay.md)), **de los dos cohetes a la vez**, cada uno en su slot.
- **Qué simula:** pérdidas, RSSI y SNR configurables, y la recepción de comandos con su ACK, para probar la CLI de punta a punta.
