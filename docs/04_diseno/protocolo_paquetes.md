---
id: protocolo_paquetes
estado: aprobado-v3 ("net_proto" de Pablo). Describe ptilanom/DEMETER @ 17139b2. Desde D-045 es nuestro contrato: primero se cambia este documento y después `firmware/common/net_proto/net_proto.h`.
actualizado: 2026-11-03
depende_de: [enlace_lora_tdma, maquina_estados, constantes, gui_contrato_datos]
decisiones: [D-039, D-041]
reemplaza: 99_archivo/diseno_v1/protocolo_paquetes.md (protocolo v2, D-005 a D-009), 05_plan/dos_sesiones/06_contratos/03_trama_usb_modem.md (C-03)
---
# Protocolo de paquetes (`net_proto`) y la interfaz USB de tierra

**Reglas generales:**
- Todos los paquetes van **empaquetados (`#pragma pack(1)`) y en little-endian**.
- El CRC es **CRC-16/CCITT-FALSE** (poly 0x1021, init 0xFFFF) sobre todos los bytes anteriores, y se guarda en little-endian al final. Esto se conserva de D-005.
- **No hay cabecera común, ni `seq`, ni byte de versión.** Un paquete se reconoce por su **longitud exacta + el byte `type` + el CRC (o el HMAC)**.
- Por eso **los tres nodos y el software de tierra deben salir del mismo commit** (A5 de la [revisión](../06_revisiones/revision_firmware_pablo.md)).

## 1. Tipos

| `type` | Nombre | Largo | De → a | Ranura | Seguridad |
| --- | --- | --- | --- | --- | --- |
| 1 | `TELEM` | 64 B | Cohete → tierra | Las propias (2 o 10 Hz), o la baliza lenta | CRC |
| 2 | `BEACON` | 18 B | Tierra → todos | 0 | HMAC de 8 B |
| 3 | `CMD` | 20 B | Tierra → un cohete | 5, 10, 15 o 20 | HMAC de 8 B |
| 4 | `CMD_RESP` | 28 B | Cohete → tierra | Las 2 propias siguientes, en lugar de TELEM | CRC |
| 5 | `LOG_INFO` | 54 B | Cohete → tierra | Una propia cada 5 s, en lugar de TELEM | CRC |
| 6 | `AMB` | 18 B | Cohete → tierra | Una propia cada 10 s, en lugar de TELEM (no justo tras un LogInfo) | CRC |
| 7 | `CAL_RES` | 60 o 54 B | Cohete → tierra | Resumen de la calibración a bordo: página 0 (estado, IMU) y 1 (magnetómetros, temperatura); ver [calibracion_nvs](calibracion_nvs.md) | CRC |

## 2. `TELEM` (64 B)

| Off. | Campo | Tipo | Unidad / significado |
| --- | --- | --- | --- |
| 0 | `type` | u8 | 1 |
| 1 | `rocket_id` | u8 | 1 = Demeter, 2 = Hermes |
| 2 | `mission_id` | u16 | `-DMISSION_ID` al compilar (hoy 0) |
| 4 | `utc_ms` | u64 | **El inicio de la ranura** en ms UTC; **0** si es la baliza lenta sin hora |
| 12 | `lat_e7`, `lon_e7` | i32, i32 | Grados × 1e7. **Del EKF a bordo (D-060)** cuando tiene origen GNSS; antes, GNSS crudo |
| 20 | `alt_cm` | i32 | MSL en cm. Con el EKF: la hMSL del origen GNSS menos la bajada del EKF, que sale de los barómetros (D-060); antes, hMSL del GNSS |
| 24 | `vn_cms`, `ve_cms`, `vd_cms` | i16 ×3 | NED, en cm/s. Del EKF con origen GNSS; antes, GNSS |
| 30 | `quat[4]` | i16 ×4 | Hamilton, escalar primero, × 32767, cuerpo FRD → NED. **Del EKF a bordo** en cuanto arranca (1,5 s quieto); identidad (32767, 0, 0, 0) mientras tanto |
| 38 | `acc_mg[3]` | i16 ×3 | mg. Con el EKF: aceleración específica **en cuerpo FRD**, del IMU virtual (0,8 LSM + 0,2 QMI) promediada a 400 Hz y sin el sesgo estimado. Antes: QMI8658 en ejes del chip |
| 44 | `gyro_01dps[3]` | i16 ×3 | 0,1 °/s. Con el EKF: en cuerpo FRD, sin sesgo ni factor de escala. Antes: QMI8658 en ejes del chip |
| 50 | `fix`, `nsv` | u8, u8 | Tipo de fix y satélites |
| 52 | `vbat_mv` | u16 | mV (PMU) |
| 54 | `temp_c[2]` | i8 ×2 | [0] = BME280; [1] reservado |
| 56 | `state` | u8 | **Estado en los bits 0–3, momento en los bits 4–7** ([maquina_estados](maquina_estados.md)) |
| 57 | `flags` | u8 | Bit 0 `TF_FLYING` (10 Hz) · 1 `TF_BOOST_SIN_ARMAR` · 2 `TF_FORZADO` · 3 `TF_LAUNCH_VENCIDO` · 4 `TF_REANUDADO` (T-411, D-052) · 5 `TF_BOOST_TIERRA_OFF`: la detección de BOOST en TIERRA está desactivada por `boosttierra off` (D-063) |
| 58 | `actuators` | u16 | Bit 0: buzzer activo · bit 1: pulso de la Pi en curso · bit 2: se envió algún pulso a la Pi desde el arranque (T-413) · **bits 3-7: motivo del error de la Pi** (`ErrorCode` de `demeter_protocol.py`: 0 ninguno, 1 sin espacio en la SD, 2 SD lenta, 3 RAM o tmpfs, 4 cámara, 5 telemetryd o UART, 6 proceso, 7 archivos, 31 otro; D-056) · **bits 8-15: estado de la Pi** por la UART (`StatusCode` de `demeter_protocol.py`; `0xFF` = desconocido, sin latido en 3 s, y siempre en Hermes) (D-054) |
| 60 | `time_flags` | u8 | Bits 0–1: **calidad** (0 = PPS reciente, 1 = error < 1 ms, 2 = error ≥ 1 ms, 3 = sin hora). Bits 2–3: **fuente** (0 = ninguna, 1 = GNSS, 2 = baliza) |
| 61 | `cmd_ack` | u8 | Bits 0–5: el contador del último comando (mod 64). Bits 6–7: su `CmdResult` |
| 62 | `crc` | u16 | |

## 3. Paquetes de tierra

**`BEACON` (18 B):**

| Off. | Campo | Tipo | Significado |
| --- | --- | --- | --- |
| 0 | `type` | u8 | 2 |
| 1 | `time_flags` | u8 | Calidad de la hora de tierra |
| 2 | `utc_ms` | u64 | El segundo entero de la ranura 0. Debe crecer (anti-repetición) |
| 10 | `tag` | u8 ×8 | HMAC de los 10 B anteriores |

**`CMD` (20 B):**

| Off. | Campo | Tipo | Significado |
| --- | --- | --- | --- |
| 0 | `type` | u8 | 3 |
| 1 | `target` | u8 | 1 o 2 |
| 2 | `op` | u8 | `Op`; **+0x80 (`OP_CONFIRM`)** si es la confirmación de un comando no apto (o del ARM) |
| 3 | `arg` | u8 | `State` o `Moment`, según `op` |
| 4 | `counter` | u32 | Creciente. **El mismo `counter` es un reintento:** no se ejecuta de nuevo, solo se repite la respuesta |
| 8 | `reasons` | u32 | En una confirmación, los motivos que se aceptan (deben coincidir con los del cohete) |
| 12 | `tag` | u8 ×8 | HMAC de los 12 B anteriores |

**Operaciones (`Op`):**

| Código | Op | Texto en tierra | Argumento |
| --- | --- | --- | --- |
| 1 | `PING` | `ping` | — |
| 2 | `ARM` | `armar` | — |
| 3 | `DISARM` | `desarmar` | — |
| 4 | `LAUNCH` | `launch` | — |
| 5 | `ABORT` | `abortar` | — |
| 6 | `SLEEP` | `dormir` | — |
| 7 | `SET_STATE` | `estado <tierra\|armed\|fly\|recovery>` | `State` |
| 8 | `SET_MOMENT` | `momento <launch\|boost\|coast\|apogeo\|caida\|paracaidas\|aterrizaje>` | `Moment` |
| 9 | `RESET` | `reiniciar` | — |
| 10 | `BUZZER` | `buzzer <on\|off>` | 1 o 0 (T-413, D-049) |
| 11 | `PI_POWER` | `pi encender` | — (solo Demeter; T-413, D-049) |
| 16 | `BOOST_TIERRA` | `boosttierra <on\|off>` | 1 o 0: detectar o no BOOST en TIERRA (BOOST sin armar). Apto en cualquier estado, sin confirmar; queda en NVS (`tbmis/bsa`, por defecto 1). En ARMED y FLY no cambia nada (D-063) |

## 4. Respuestas

**`CMD_RESP` (28 B):**

| Off. | Campo | Tipo | Significado |
| --- | --- | --- | --- |
| 0 | `type`, `rocket_id`, `op`, `arg` | u8 ×4 | Los del comando |
| 4 | `result` | u8 | `CmdResult`: 0 `OK` (ejecutado) · 1 `NO_APTO` (no ejecutado, con motivos; espera confirmación) · 2 `CONFIRMA` (apto, pero pide el segundo paso: ARM) · 3 `ERROR` (no ejecutado, sin confirmación posible) |
| 5 | `state` | u8 | Estado y momento **después** de ejecutar |
| 6 | `flags` | u8 | `TF_*` |
| 7 | `spare_pct` | u8 | % de la reserva de la SD |
| 8 | `counter` | u32 | El del comando |
| 12 | `reasons` | u32 | Bits de `Reason` (§4.1) |
| 16 | `last_counter` | u32 | El último aceptado. Con `RZ_CONTADOR`, tierra sigue desde aquí |
| 20 | `alt_dm` | i16 | Altura barométrica sobre `p0`, en dm |
| 22 | `vz_cms` | i16 | cm/s, positiva hacia arriba |
| 24 | `vbat_mv` | u16 | |
| 26 | `crc` | u16 | |

### 4.1 `Reason` (bit = valor)

| Bit | Motivo | Bit | Motivo |
| --- | --- | --- | --- |
| 0 | La transición no existe desde el estado actual | 11 | Sin aterrizaje detectado |
| 1 | Reserva incompleta | 12 | Sin BOOST detectado |
| 2 | La SD no está registrando | 13 | El cohete no está armado |
| 3 | LSM6DSO32 sin datos | 14 | No ha habido vuelo |
| 4 | BMP581 sin datos | 15 | Ya está en ese estado |
| 5 | Sin fix 3D | 16 | Hay un imán presente: despertaría al instante |
| 6 | Batería baja | 17 | RECOVERY: aún sin batería baja, el cohete debe seguir transmitiendo |
| 7 | Altura aumentando | 18 | Confirmación inválida o vencida |
| 8 | Altura disminuyendo | 19 | Contador antiguo |
| 9 | Aceleración ≠ 1 g (se mueve) | 20 | Comando desconocido |
| 10 | En vuelo: ya hubo BOOST | 21 | **No se sabe si la Pi está encendida: una pulsación podría apagarla** (T-413, D-049) |
| | | 22 | **La Pi no está lista (READY): no grabaría el vuelo.** Solo en Demeter, al armar; se puede forzar (D-055) |
| | | 23 | **Temperatura del suelo sin muestra, dudosa, vieja o lejos de la de ahora.** Al armar; se puede forzar (D-058) |
| | | 24 | **Calibración: no hay resultado listo, se está analizando o registrando, o no hay una anterior.** No se puede forzar (D-059) |
| | | 25 | **Calibración: el análisis dejó avisos.** Al aplicar; se puede forzar (D-059) |

Los textos exactos están en `reasonText()`. **El servicio de tierra los usa tal cual** para `salud.go_nogo` (§6).

**`LOG_INFO` (54 B):**

| Off. | Campo | Tipo | Significado |
| --- | --- | --- | --- |
| 0 | `type`, `rocket_id` | u8 ×2 | 5 y el ID del cohete |
| 2 | `recording` | u8 | 0 no registra · 1 registrando · 2 archivo preparado al armar |
| 3 | `pct` | u8 | % del bloque de 32 MB |
| 4 | `spare_state`, `spare_pct` | u8 ×2 | Reserva: 0 no hay · 1 creando · 2 lista; y su % |
| 6 | `name` | char ×34 | Archivo en uso o preparado (vacío si no hay) |
| 40 | `elapsed_s`, `pos`, `remain_s` | u32 ×3 | Tiempo registrado, bytes escritos y lo que aún cabe |
| 52 | `crc` | u16 | |

### 3.1 `AMB` (18 B, D-058)

Para la temperatura del suelo y para usar un cohete en tierra (por ejemplo Hermes, sin Pi) como referencia de temperatura y de presión para el otro.

| Byte | Campo | Tipo | Contenido |
| --- | --- | --- | --- |
| 0 | `type` | u8 | 6 |
| 1 | `rocket_id` | u8 | |
| 2 | `flags` | u8 | Bit 0: hay muestra · bit 1: dudosa · bits 2-3: fuente (1 sueño largo, 2 encendido, 3 a mano) · bit 4: tomándola · bit 5: BMP vivo · bit 6: BME vivo |
| 3 | `arm` | u8 | Bits de la revisión al armar: 1 sin muestra, 2 dudosa, 4 vieja (más de 12 h), 8 el BMP se alejó más de 6 °C de la muestra, 16 BMP y BME discrepan más de 4 °C. 0 = sirve. **Solo 1, 2 y 4 dan `RZ_TEMP` al armar** (`AB_BLOQUEA`, D-063); 8 y 16 son avisos para tierra |
| 4 | `press_pa` | f32 | BMP581 ahora (NaN sin él) |
| 8 | `t_bmp_cC` | i16 | BMP ahora, centésimas de °C (−32768 = sin dato) |
| 10 | `t_bme_cC` | i16 | BME ahora |
| 12 | `t_amb_cC` | i16 | La muestra del suelo, la que usa la altura barométrica |
| 14 | `edad_min` | u16 | Minutos desde la muestra (0xFFFF = sin hora) |
| 16 | `crc` | u16 | |

## 5. Interfaz USB de la estación (`firmware/tierra`, reemplaza C-03)

- **Velocidad:** 115200 baudios, 8N1, con `monitor_dtr=0` y `monitor_rts=0` (si no, abrir el puerto reinicia la placa).
- **Formato:** líneas de texto terminadas en `\n`.
  - **Las de máquina empiezan con `@`.**
  - Las demás son diagnóstico humano (`[etiqueta] k=v …`, una vez por segundo).

**Del módem al PC:**

| Línea | Cuándo | Contenido |
| --- | --- | --- |
| `@T <rssi> <snr> <hex>` | Cada TELEM válido (CRC, ID 1 o 2) | RSSI en dBm y SNR en dB con 1 decimal; los 64 B en hex minúscula |
| `@L <hex>` | Cada LogInfo válido | Los 54 B (sin RSSI; PEN-23) |
| `@A <hex>` | Cada AMB válido | Los 18 B (D-058). `web-1` no lo usa |
| `@C <hex>` | Cada CAL_RES válido | Las páginas de la calibración a bordo (D-059). `web-1` no lo usa |
| `@G <0\|1>` | Una vez por segundo | 1 si tierra tiene hora propia (puede transmitir) |
| `[cmd ] …` | Al responder un comando | **Texto:** `Demeter: NO APTO \| estado=… momento=… alt=… vz=… reserva=…% vbat=… mV`, una línea `  - <motivo>` por cada motivo, y si hace falta, `… (10 s): escribe si o no` |
| `[time] … pos(n)=<lat> <lon> <alt> m` | Una vez por segundo | **La posición promediada de la estación** (texto) |
| `[Demeter] …`, `[Hermes] …`, `[rx  ] …`, `[bcn ] …` | Una vez por segundo | Contadores: `perdidos`, `ranura_mala`, RSSI, `dispersion`, `ofs_utc`… |

**Del PC al módem** (texto, una orden por línea):
- `<d|h> <orden> [arg]`, con las órdenes de la tabla de §3;
- `si` o `no` para confirmar (dentro de 9 s);
- `reset` reinicia la estación.

**Peticiones pendientes a Pablo (PEN-23):** `@R <hex>` (CmdResp crudo), `@E <lat> <lon> <alt> <n>` (la posición de la estación), y RSSI y SNR en `@L`. Hasta entonces, el servicio de tierra parsea el texto de `[cmd ]` y `[time]`.

## 6. Correspondencia con `web-1` (para el servicio de tierra, T-602)

`web-1` ([08_gui/05](../08_gui/05_contrato_datos_web.md)) **no cambia**. El servicio de tierra traduce así:

| `web-1` | Origen | Regla |
| --- | --- | --- |
| `meta.proto_version` | — | **`4` = `net_proto`.** El esquema hoy solo admite 2 o 3, así que hay que **proponerle el valor al plan web** (PEN-24). Mientras tanto, 3 con una nota en la bitácora |
| `meta.mission_id` | `TELEM.mission_id` | |
| `estado.seq` | `utc_ms / 40` (el índice absoluto de ranura, ≈ 4,4·10¹⁰) | Con `utc_ms = 0` (baliza lenta): un contador local. No es el `seq` de 8 bits de la cabecera NAV v2 |
| `estado.t_ms`, `utc_ms` | `TELEM.utc_ms` | `null` si es 0 |
| `estado.fase`, `fase_cod` | `state`, `moment` | Tabla de [maquina_estados](maquina_estados.md) §5 |
| `pos.lat/lon` | `lat_e7`, `lon_e7` / 1e7 | `null` si `fix < 2` |
| `pos.alt_msl_m` | `alt_cm / 100` | |
| `pos.alt_agl_m` | `alt_msl_m − SITIO_ALT_MSL` (o la barométrica cuando exista, PEN-23) | `fuente = "gnss"` |
| `vel.n/e/u_ms` | `vn`, `ve`, `−vd` (cm/s → m/s) | `null` si `fix < 3` |
| `acc_g` | `acc_mg / 1000` | Ejes del chip QMI8658 |
| `q` | `quat / 32767`, **cambiado de marco** (T-675): `q_web = q_M ⊗ quat ⊗ q_F`, con `q_M = (0, 1/√2, 1/√2, 0)` (NED → ENU) y `q_F = (0, 1, 0, 0)` (FLU → FRD); luego unitario y `w ≥ 0` | `quat` es cuerpo FRD → NED y `web-1` pide cuerpo FLU → ENU (X nariz, Y izquierda, Z arriba). `flags.ekf_ok = false` mientras `quat` sea la identidad (se calcula con el `quat` crudo); entonces `q` es la identidad ya convertida (nariz al norte, nivelado) y la web no la usa |
| `flags.gnss_fix` | `fix ≥ 3` | |
| `flags.apogeo` / `eyeccion` | momento ≥ APOGEO / momento ≥ PARACAIDAS | |
| `flags.log_activo` | El último `LogInfo.recording == 1` | |
| `flags.falla_activa` | `TF_BOOST_SIN_ARMAR`, o el último `go_nogo` con motivos de sensor | |
| `flags.reanudado` | `flags & TF_REANUDADO` (bit 4, T-411) | |
| `act.*` | `actuators` (todo en `false` hasta que existan) | |
| `bat_pct` | Lineal sobre `vbat_mv` (3,3–4,2 V), o `null` | (P) |
| `secundario` | `null` (no hay UART con la Pi) | |
| `enlace.rssi_dbm`, `snr_db` | De la línea `@T` | |
| `enlace.perdidos_pct_10s` | Ranuras propias esperadas frente a recibidas (como `gnd_rx.cpp:accept`) | |
| `salud` (a 1 Hz) | TELEM (`fix`, `nsv`, `vbat`) + el último LogInfo + la última CmdResp | `hacc_m`, `temp_esp_c`, `nav_innov_m` y `fw_version` en `null`; **`boot_count` y `calib.*` en `null` (D-050)**. `temp_c[0]` (BME280) no tiene campo en `web-1` y no se publica |
| `salud.go_nogo` | Los `reasons` de la última respuesta a ARM, con `reasonText` | `listo` = sin motivos. **El dashboard le dice al traductor qué orden mandó** (`Traductor.comando()`, T-662); sin eso, el texto `[cmd ]` no dice a qué orden responde |
| `estacion.pos` | `@E` o, mientras no exista, el texto `[time] … pos(n)=` | `gnss_ok` ← `@G 1` |
| `evento` | Los cambios de `state` y `moment` | `despegue` ← momento BOOST; `apogeo` ← APOGEO; `eyeccion` ← PARACAIDAS; `aterrizaje` ← ATERRIZAJE o RECOVERY |
| `backfill` | `null` | No hay backfill: el "goteo" en RECOVERY no existe todavía |
