---
id: formato_log
estado: aprobado (describe `rec_format.h` de Pablo @ 17139b2; en nuestro repo, `firmware/cohete/src/rec_format.h`). Era la tarea T-202.
actualizado: 2026-11-03
depende_de: [firmware_vuelo]
decisiones: [D-044]
reemplaza: 05_plan/dos_sesiones/06_contratos/04_formato_log_y_replay.md (C-04), en la parte del formato
---
# Formato del log en la SD (`rec`)

**Lectores:**
- `tools/tbeam/tblog.py` lo lee: resumen, huecos, `--csv`.
- `tools/tbeam/tbget.py` lo baja por USB sin sacar la SD.
- **El EKF en PC** (`ekf.py`) y la calibración (`calib.py`) parten de este mismo formato.

## 1. Registro

```
[A5 5A][len u16][type u8][src u8][t_us i64][payload (len − 16)][crc16 u16]     little-endian
```

- `len` = el total del registro (≤ 512).
- `t_us` = el reloj local monotónico (esp_timer), en µs. **No es UTC:** la correspondencia sale de los registros `PPS` y `PVT`.
- `crc16` = CCITT-FALSE sobre la cabecera y el payload.
- **El flujo se autodelimita:** si se corrompe un tramo, se busca el siguiente `A5 5A` con el CRC válido (`tblog` cuenta `bytes_saltados` y `resync`).

## 2. Tipos (`rec::Type`) y fuentes (`rec::Src`)

| `type` | Nombre | Payload |
| --- | --- | --- |
| 1 | `PVT` | La trama UBX NAV-PVT cruda (92 B) |
| 2 | `PPS` | `PpsRec`: flanco local, segundo UTC, si se usó, fix y tAcc |
| 3 | `LINK` | `LinkRec`: TX o RX, ranura, largo, RSSI, SNR, retraso y tiempo en el aire. **Sirve para excluir las muestras del MMC durante la TX** |
| 4 | `HEARTBEAT` | `HbRec`, una vez por segundo: descartes por anillo, escritura y flush máximos, bytes, `time_flags` y reserva |
| 5 | `FILEHDR` | El primero de cada archivo: `TBLG`, versión, cohete, misión, arranque, índice, UTC y `fw` (hoy la fecha de compilación; PEN-23 pide el hash) |
| 6 | `IMU` | `ImuRec` + el lote del FIFO del QMI8658: `cnt × 6 × i16` (ax ay az gx gy gz), ejes del chip; `IF_GAP` si hubo pérdidas |
| 7 | `MAG` | `MagRec`: QMC6309 crudo |
| 8 / 9 | `BAR` / `BARCAL` | BME280 crudo y compensado / su calibración |
| 10 | `EXT_LSM` | `ExtLsmRec` + palabras del FIFO del LSM6DSO32 de 7 B (tag + 6): acel., giro, marca del chip y **BMP581 por el hub** (crudo, con las palabras malas) |
| 11 | `EXT_MMC` | `ExtMmcRec`: MMC5983MA, 16384 cuentas/G, ejes del chip |
| 12 | `MISSION` | `MissionRec`: comando atendido o cambio de estado (`op`, `arg`, `result`, `from`, `to`, `moment`, `flags`, `reasons`, `counter`). **Automáticos (`op = 0`):** el aviso de `t_abort` (`reasons` = `RZ_SIN_BOOST`); **BOOST detectado (T-410):** `arg` = 1 inercial o 2 barométrico, y `counter` = el `dv` en cm/s o el salto en cm; **reanudado tras reinicio (T-411):** `arg` = 3, y `from`/`to` = el estado guardado |
| 250 | `EVENT` | `EventRec`: incidentes de la SD (fallo de escritura o reapertura, errno, duración) |

**Fuentes (`src`):** 0 QMI · 1 QMC · 2 BME · 3 GNSS · 4 RTC · 5 PMU · 6 LSM · 7 BMP · 8 MMC · 15 sistema.

## 3. Archivos

- **Nombre:** `DEM_M00_20261101_174832_0054.BIN`, es decir, cohete, `MISSION_ID`, fecha y hora local de inicio, e índice.
  - Sin hora: `SINFECHA`. Al tener hora, se renombra.
- **Reserva:** `RES_xxxx.BIN` de 32 MB preasignada en segundo plano. **ARM exige la reserva al 100 %.**
- **Escritura:** bloques de 4 KB, flush cada 16 bloques, `open/write/fsync`. Si hay un error, reintenta 3 veces y repone el sector incompleto al reabrir.
- **Solo se registra en FLY** (y `t_post` después de RECOVERY).
