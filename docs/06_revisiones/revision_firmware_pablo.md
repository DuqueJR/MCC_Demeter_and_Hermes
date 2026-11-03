---
id: revision_firmware_pablo
estado: vivo. Revisión del commit 17139b2 de ptilanom/DEMETER (2026-11-03).
actualizado: 2026-11-03
depende_de: [cambios_por_firmware_pablo, sincronizacion_firmware_pablo, maquina_estados, protocolo_paquetes]
revisa: https://github.com/ptilanom/DEMETER @ 17139b2 ("Firmware de Demeter, Hermes y tierra, con herramientas de PC")
---
# Revisión del firmware de Pablo (repo DEMETER, commit `17139b2`)

Revisión en prosa del documentador. **No se cambió código.**
- Las referencias son `archivo:línea` del repo de Pablo, con las rutas **de su repo** (`tbeam_fw/src/…`). Las rutas equivalentes en el nuestro están en [sincronizacion_firmware_pablo](../05_plan/sincronizacion_firmware_pablo.md) §2.
- Lo que Pablo validó en hardware sale de su `CLAUDE.md` y de los resúmenes de log `tbeam_fw/tools/*.BIN.txt`. **No se volvió a medir aquí:** se marca **[Pablo]**.
- Lo que sale de leer el código se marca **[código]**.

## 1. Qué hay en el repo

| Carpeta | Qué es | Líneas | Destino en nuestro repo |
| --- | --- | --- | --- |
| `tbeam_fw/` | Firmware de **los dos cohetes** (T-Beam Supreme, ESP32-S3). PlatformIO, Arduino, `espressif32@6.13.0`. Envs `demeter`, `hermes`, `demeter_campo`, `hermes_campo` (22 dBm) y `hermes_sinhora` (prueba) | ≈ 4 300 propias, más ≈ 2 100 de LilyGO (`LoRaBoards.*`, `utilities.h`) | `firmware/cohete/` |
| `tbeam_tierra/` | Firmware de **la estación** (T-Beam V1.2, ESP32, NEO-M8N). Envs `tierra` y `tierra_campo` | ≈ 670 propias, más las de LilyGO | `firmware/tierra/` |
| `common/net_proto/` | Protocolo de radio compartido: `net_proto.h`, `net_auth.h` (HMAC), `time_model.h`, `ubx.h`. **Falta `secrets.h`** (la clave; no se versiona) | ≈ 420 | `firmware/common/net_proto/` |
| `common/lilygo_local.patch` | Parche local a la librería de LilyGO (una función de lectura en `SensorQMI8658.hpp` y la limpieza de su `platformio.ini`) | 326 | `firmware/common/` |
| `Lilygo-LoRa-Series` | Submódulo de git (LilyGO, commit `1991b1e`), con RadioLib, XPowersLib y SensorLib | — | Submódulo en `firmware/vendor/` |
| `common/Simulaciones/` | Simulaciones de OpenRocket. **La de Demeter es idéntica a la nuestra** (mismo md5). **La de Hermes es nueva:** cierra PEN-07. | — | `datos/simulaciones/openrocket/` |
| `tbeam_fw/tools/` | Herramientas de PC (Python): `dashboard.py` + `dashboard.html` (dashboard local de trabajo), `tbget.py` (descarga de logs por USB), `tblog.py` (lector del log y exportación a CSV), `calib.py` (calibración guiada), `ekf.py` (prototipo del EKF), `calib_*.json` y 19 resúmenes de logs reales (`*.BIN.txt`) | ≈ 2 200 | `tools/tbeam/` y `datos/logs_referencia/` |
| `bloque2_3_src/`, `bloque4_imu/`, `bloque4b_wtm/`, `logger_bloque5/` | **Paquetes viejos** de etapas anteriores ("copiar a tbeam_fw\src"). Todos difieren de `tbeam_fw/src`, así que son versiones superadas | — | **No se importan** |
| `DATASHEETS/` | 41 MB de PDF y una página HTML guardada | — | **No se importan** (regla del repo: los PDF no se versionan) |
| `CLAUDE.md` | El estado del proyecto según Pablo: hallazgos, mediciones, decisiones y pendientes. **Es la mejor fuente de lo validado.** | 137 | `docs/fuentes/demeter_pablo/CLAUDE_17139b2.md` (como fuente, **no** como CLAUDE.md activo) |

## 2. Arquitectura en una página

```
Núcleo 1: ISR PPS, IMU interno (QMI8658), LSM6DSO32 por SPI de software, tiempo  (EKF: todavía no existe a bordo)
Núcleo 0: GNSS M10S (prio 3), in_i2c (BME280, QMC6309, MMC5983MA; prio 3), logger (prio 2),
          misión (prio 2, 50 Hz), radio TDMA (prio 4)
Productores → Latest<T> (seqlock, última muestra) + ByteRing SPSC en PSRAM por fuente → logger → SD (SPI, 10 MHz)
Tiempo: esp_timer (µs) → UTC con anclas PPS (deriva filtrada) y anclas de la baliza de tierra como respaldo
```

- **Punto de entrada:** el firmware "de vuelo" es la bandera **`TEST_CORE`** (`main.cpp` → `core_selftest.cpp`).
  - `coreSelftestBegin()` arranca todo.
  - `coreSelftestReport()` imprime una vez por segundo el estado por USB.
  - Esas líneas son las que lee la pestaña Diagnóstico de `dashboard.py`.
  - El nombre es histórico: **es el firmware de vuelo**.
- **Log:** formato `rec` autodelimitado con CRC (ver [formato_log](../04_diseno/formato_log.md)).
  - Archivos de 32 MB preasignados (`RES_xxxx.BIN`).
  - **Se registra solo en FLY** (desde LAUNCH, o con FLY forzado en el banco).
- **Radio:** TDMA de 25 ranuras de 40 ms alineadas a UTC (ver [enlace_lora_tdma](../04_diseno/enlace_lora_tdma.md)).
  - TELEM de 64 B.
  - Comandos firmados con HMAC y confirmación de los no aptos.
- **Misión:** estados TIERRA, ARMED, FLY y RECOVERY (más SLEEP), con momentos dentro de FLY (ver [maquina_estados](../04_diseno/maquina_estados.md)).

## 3. Lo que está validado en hardware [Pablo]

| Bloque | Evidencia (según su CLAUDE.md y los `*.BIN.txt`) |
| --- | --- |
| Tiempo (PPS → UTC) | Deriva de esp_timer ≈ −53 ppm, estable; fluctuación del PPS de 1–2 µs. Anclas por baliza sin GNSS: residuo de ≈ 150–200 µs |
| GNSS M10S | 10 Hz, UBX, DYNMODEL 8. Huecos de 0,4–4 % según la antena (en estudio). Arranque en caliente con VBACKUP |
| IMU interno QMI8658 | 445 Hz reales, 0,1 % de pérdidas, marcadas con `IF_GAP` |
| LSM6DSO32 (externo) | 1610 Hz reales (Demeter) y 1560 Hz (Hermes), ±32 g, ±2000 °/s, FIFO continuo, 0 tags malos |
| BMP581 (por el *sensor hub* del LSM) | 100,7 Hz; ruido de 0,5 Pa. Palabras corruptas en Hermes durante la TX (1,4 % a 10 dBm), mitigadas con una mediana de 3 |
| MMC5983MA (I2C0) | 107 Hz; SET/RESET; la TX desplaza el campo ≈ 5 mG |
| BME280 + QMC6309 | 40 y 100 Hz; el QMC a veces no arranca (sin causa conocida) |
| Log en SD | Varias corridas de 8–16 min **sin bytes perdidos**. Reintentos y reapertura ante EIO. Rotación a un archivo nuevo al llenar 32 MB |
| Descarga por USB (`tbget.py`) | 200 kB/s sin sacar la SD |
| Radio TDMA (etapas 1 y 2) | Los dos cohetes a 10 Hz en el banco a 10 dBm: `crc_mal=0`, `ranura_mala=0`. Baliza firmada a 2 Hz, sin errores |
| Comandos firmados (etapa 3) | ARM, LAUNCH, aviso a los 120 s, "estado tierra": validados en dos "vuelos estáticos" (DEM 0088/0089, HER 0018/0019) |
| Sueño profundo y *wake* por imán (IO21) | Validado, con el GNSS en caliente al despertar |
| Calibración guiada (`calib.py`) | DEM 0091 y HER 0023, **no definitivas** (hay que repetirlas a cielo abierto y con el cohete cerrado) |

**Lectura general:** el trabajo es serio y está muy medido. Cada hallazgo tiene un log que lo respalda. Lo que existe es más robusto que lo que habríamos escrito nosotros en los días que quedan. **La decisión de adoptarlo es correcta** (D-037).

## 4. Hallazgos

Prioridad: **C** = crítico para el 8 de noviembre · **A** = alto · **M** = medio · **B** = bajo.

### C1. No hay detección automática de BOOST: el vuelo solo existe si llega LAUNCH por radio [código]

- **Dónde:**
  - `mission.cpp:2` lo dice explícitamente: "hoy FLY solo se alcanza con LAUNCH".
  - `s_boosted` solo se pone en `true` con el comando `momento boost` (`mission.cpp:239-240`).
- **Consecuencias en un vuelo real:**
  1. **Si LAUNCH no llega** (enlace, operador, tierra sin hora), **el cohete no registra el vuelo**: queda en ARMED y descarta los sensores (solo guarda los últimos 8 `T_MISSION`).
  2. **Aunque LAUNCH llegue, `s_boosted` sigue en `false` durante todo el vuelo.** Con eso **quedan inactivas todas las protecciones "en vuelo"** (`RZ_EN_VUELO` en `evalTo`, `mission.cpp:131-134` y `:153`).
     - Un `d desarmar`, `d abortar` o `d estado tierra` enviado por error en pleno vuelo **se ejecuta a la primera, sin confirmación**.
     - Eso cierra el archivo del log (`setState(ST_TIERRA)` → `loggerRecord(false)`).
  3. A los `t_abort` (120 s) se levanta `TF_LAUNCH_VENCIDO`. Solo avisa: el registro sigue.
- **Mínimo indispensable:**
  - implementar la detección de BOOST que Pablo ya definió: integrar el exceso sobre 1 g con `|a| > 2 g` hasta `dv = 5 m/s`, o el salto del BMP de 10 m en 0,5 s;
  - que esa detección ponga `s_boosted = true` y pase de ARMED a FLY.
  - Los demás momentos pueden seguir manuales para el 8 de noviembre. **Sin BOOST no hay ni registro de respaldo ni protección.**
- Es la tarea **T-410** del backlog.

### C2. No hay persistencia ante un reinicio en vuelo [código]

- **Qué pasa:** el estado vive solo en RAM (`mission.cpp:32-34`). En NVS solo se guarda el contador de comandos (`mission.cpp:281`). Un brownout o un watchdog en vuelo hacen que la placa arranque en **TIERRA**:
  - sin registrar;
  - a 2 Hz;
  - con `p0` nuevo.
- **Mínimo:** guardar `estado`, `s_boosted` y los `p0` en memoria RTC, y también en NVS, al entrar a FLY. Al arrancar, retomar FLY y registrar.
  - Eso abre un archivo en vuelo, lo que Pablo evita por el riesgo del CMD13, pero es mejor que perder el resto del vuelo.
- Es nuestra D-015, que sigue vigente como requisito. Tarea **T-411**.

### C3. Nada termina el vuelo: el cohete se queda en FLY después de aterrizar [código]

- **Qué pasa:** no hay detección de aterrizaje, y RECOVERY solo llega por comando. Para aceptarlo sin forzar exige el momento ATERRIZAJE (`mission.cpp:145-146`).
- **Consecuencia:** tras aterrizar, el cohete sigue registrando a tasa completa y transmitiendo a 10 Hz.
  - Llena el archivo de 32 MB en ≈ 12,5 min y abre otro **sin reserva**, porque desde ARMED no se preasigna (`mission.cpp:213`).
  - Gasta batería durante la búsqueda.
- **Para el 8 de noviembre** basta un **procedimiento de operación**, que queda en el checklist T-901:
  1. confirmar el aterrizaje por la telemetría (GNSS quieto);
  2. `d momento aterrizaje`;
  3. `d estado recovery`.
- La detección automática es deseable (T-412), no indispensable.

### A1. Los actuadores no existen: ni buzzer (IO46) ni encendido de la Pi (IO45) [código]

- **Qué falta:** `grep` no encuentra el uso de IO45 ni de IO46. `Telem.actuators` siempre va en 0.
- **El buzzer al aterrizar** está en nuestro mínimo para volar ([plan_maestro](../05_plan/plan_maestro.md) §1.5). Tarea T-413.
- **El pulso de PWR_ON de la Pi de Demeter** también falta.
  - Pablo pide que **no** se pulse con la Pi encendida, porque podría apagarla.
  - Mientras no exista, **la Pi se enciende a mano** antes de cerrar el cohete.

### A2. La UART con la Pi de Demeter no existe [código]

- **Qué falta:** UART0 (GPIO 43/44) queda libre, porque `Serial` es el USB CDC, pero nadie la usa.
  - Pablo la dejó "de lo último" y propone mandarle el estado a la Pi a 20–50 Hz con UTC.
- **Consecuencia:** para el 8 de noviembre, **la Pi debe funcionar sola**, con sus watchdogs ([visionpack_integracion](../04_diseno/visionpack_integracion.md)) y con sus bugs bloqueantes corregidos (T-701).
- La integración por UART es T-702 y queda como "debería".

### A3. La telemetría no trae la altura barométrica, y el resto es crudo [código]

- **Qué viaja en TELEM** (`net_radio.cpp:buildTelem`):
  - `alt_cm` = **hMSL del GNSS**;
  - `acc` y `giro` del **QMI8658 en ejes del chip**, que satura a ±16 g;
  - cuaternión en identidad;
  - sin `hAcc`.
- **Consecuencias:**
  - El GNSS pierde el seguimiento en el impulso (R-06), así que **la altura en vivo y el apogeo en tierra dependen de un GNSS degradado**.
  - La altura barométrica sobre `p0` sí existe a bordo (`mission.cpp:baroStep`), pero solo sale en `CmdResp`.
- **Petición a Pablo (PEN-23):** que TELEM lleve `alt_baro_dm` (int16) y `hacc`.
  - Cuesta ≈ 3 B y ≈ 1 ms de aire; el TELEM de 64 B tarda 29,5 ms en una ranura de 40 ms.
  - La alternativa es mandar la altura barométrica en `CmdResp`/`LogInfo`, lo que solo da 1 dato cada 5 s.
- Ver la correspondencia con `web-1` en [protocolo_paquetes](../04_diseno/protocolo_paquetes.md) §6.

### A4. Falta la prueba de alcance, y la frecuencia no está verificada contra la regulación [Pablo]

- **Estado:** todo el enlace se validó a 10 dBm y a 30 cm.
  - Los envs `*_campo` (22 dBm) existen, pero no se han probado en campo.
  - Las palabras corruptas del hub en Hermes **escalan con la TX** y no se han medido a 22 dBm.
- **La frecuencia es 903,0 MHz** (BW 500: 902,75–903,25 MHz), en el borde inferior de la banda.
  - PEN-13 (la regulación de la ANE) sigue abierto.
  - Nuestro D-001 evitaba 905–915 MHz por una reserva IMT que no se confirmó.
- **Es la prueba más importante que falta antes de viajar** (P-06).

### A5. Los paquetes no llevan versión de protocolo [código]

- **Qué pasa:** solo se distinguen por `type`, longitud y CRC. Si una placa queda con un firmware de otro commit, tierra decodifica mal sin avisar.
- **Mitigación operativa:** los tres firmware, el dashboard y nuestro servicio de tierra salen **del mismo commit**, y ese hash se anota en el checklist.
  - El `FILEHDR` solo guarda la fecha de compilación (`fw=Nov  2 2026`), no el hash.
- **Petición a Pablo (PEN-23):** guardar el hash de git en el `FILEHDR`, y, si cabe, un byte de versión en BEACON/TELEM.

### A6. La clave HMAC (`secrets.h`) es un punto único de falla [código]

- **Qué pasa:** la clave no está en el repo, y debe ser idéntica en las tres placas. Si se pierde o difiere:
  - los cohetes rechazan las balizas (aunque siguen en ranuras con su propio GNSS);
  - rechazan todos los comandos: **no se puede armar**.
- **Procedimiento (T-901):**
  - una copia de la clave fuera del portátil;
  - comprobar en el banco, antes de viajar, que las tres placas aceptan un `ping`.
- El contador de comandos se resincroniza solo si se cambia la placa de tierra (`RZ_CONTADOR`, `gnd_cmd.cpp`). Está bien resuelto.

### A7. Solo se puede compilar en el PC de Pablo [código]

- **Por qué:**
  - Los `platformio.ini` usan rutas absolutas (`C:\Users\ptila\TBEAM\...`).
  - La librería de LilyGO es un submódulo con un parche local que hay que aplicar a mano.
- **Riesgo:** si algo falla en campo, nadie más puede recompilar ni cargar.
- **Lo resuelve la importación (T-007),** con rutas relativas y el procedimiento de [sincronizacion_firmware_pablo](../05_plan/sincronizacion_firmware_pablo.md) §3. Se le propone a Pablo adoptar las mismas rutas relativas.
- **Antes de viajar:** compilar y cargar los 3 firmware desde dos portátiles distintos (T-902).

### M1. Sin hora en tierra no salen comandos [código]

- **Qué pasa:** la estación solo transmite (baliza y comandos) con su propia hora del M8N (`gnd_cmd.cpp:parseLine`: "tierra sin hora").
  - Los cohetes siguen en ranuras con su GNSS, pero **no se puede armar ni mandar LAUNCH** hasta que el M8N tenga hora.
- **Procedimiento:** la estación, con su antena GNSS a cielo abierto, se enciende antes que todo.
  - En el dashboard se ve `@G 1`.

### M2. El USB de tierra no es una interfaz de máquina completa [código]

- **Qué sale por USB** (`gnd_rx.cpp:emitPacket`): solo TELEM (`@T rssi snr hex`), LogInfo (`@L hex`) y el estado de la hora (`@G 0|1`).
- **Lo que no sale en formato de máquina:**
  - **las respuestas a comandos** (`CmdResp`), que solo salen como texto `[cmd ]`;
  - **la posición de la estación**, que solo sale en el texto `[time] … pos(n)=lat lon alt`;
  - el RSSI de LogInfo.
- **Los comandos entran como texto** (`d armar`, `si`, `no`), con una confirmación interactiva de 9 s.
- **Para nuestro servicio de tierra:** se puede parsear el texto, pero **se le pide a Pablo** (PEN-23) que agregue:
  - `@R <hex>` (CmdResp crudo);
  - `@E lat lon alt n` (la posición de la estación).
- Ver [protocolo_paquetes](../04_diseno/protocolo_paquetes.md) §5.

### M3. Un solo dueño del puerto serie de tierra [inferencia]

- **El problema:** `dashboard.py` abre el puerto de tierra, y nuestro servicio (T-602) no puede abrirlo a la vez.
- **Propuesta (D-041):**
  - **en el lanzamiento, el dueño es `dashboard.py`**, que ya opera, comanda y está probado;
  - nuestro servicio lee **el archivo de sesión** que `dashboard.py` escribe línea a línea (`tools/sesiones/<fecha>_tierra.txt`, `dashboard.py:171`) y de ahí produce `web-1` para la web.
- Así, nada de lo nuestro puede tumbar la operación.

### M4. Espera activa en la radio [código]

- **Dónde:** `txSlot`/`listenSlot` (`net_radio.cpp`) hacen espera activa de hasta ≈ 4 ms antes de cada ranura, con prioridad 4 en el núcleo 0.
  - Son ≈ 15 eventos/s en vuelo, o sea ≈ 6 % del núcleo 0.
  - Pablo midió que el logger y el GNSS no pierden datos.
- **Recomendación:** no tocarlo antes del vuelo.

### M5. El `p0` queda congelado en ARMED [código]

- **Qué pasa:** en TIERRA, `p0` sigue al clima (τ = 60 s); en ARMED se congela.
  - Una espera larga en la rampa (de 30 a 60 min) con cambio de presión mete un error de unos pocos metros en la altura relativa.
- **Recomendación:** armar lo más tarde posible (checklist), o pedir que en ARMED `p0` siga al clima mientras `|a|` ≈ 1 g.

### M6. SD: el CMD13 sigue sin explicación [Pablo]

- **Estado:** hay EIO esporádicos, absorbidos por reintentos y reapertura, sin pérdidas en las últimas corridas.
  - El riesgo residual es abrir un archivo en vuelo, en la rotación o en una reanudación (C2).
- **Recomendación:** tarjetas nuevas y probadas, y el registro de vuelo en un archivo preasignado (ARM lo exige al 100 %).

### M7. Teclas de prueba por USB [código]

- **Qué hacen** (`core_selftest.cpp`):
  - `f` alterna entre 2 y 10 Hz;
  - `g` deja de anclar la hora al GNSS;
  - `s` duerme la placa;
  - la secuencia `TBDL` detiene el logger y entra al modo de descarga.
- **Riesgo:** solo con el USB conectado. **No conectar un monitor serie a un cohete armado.**

### B1. Detalles menores [código]

- El anti-repetición de la baliza (`s_lastBeaconMs`) se reinicia con cada arranque del cohete. Un atacante podría repetir balizas viejas tras un reinicio. Es irrelevante en el concurso.
- `LogInfo` (cada 5 s) y `CmdResp` (2 veces) ocupan ranuras de TELEM; tierra los descuenta de `perdidos`. Está bien.
- `Telem.temp_c[1]` está reservado y sin uso.
- El QMC6309 a veces no arranca (`inits=761`). Ya muestra `id=0xFF` y reintenta.

## 5. Lo que coincide con nuestro diseño

Pablo llegó a lo mismo en varias cosas, a veces mejor:
- **Tiempo:** `t_us` monotónico + UTC por PPS (D-019); TDMA alineado a UTC; TX a +2 ms del inicio de la ranura (D-002).
- **Formato:** little-endian empaquetado y CRC-16/CCITT-FALSE (D-005); cuaternión Q15 (x32767).
- **Firmware:** un solo binario con `ROCKET_ID` (D-016); núcleo 1 para sensores y núcleo 0 para radio, GNSS y log (D-017); el log binario con su lector en Python (D-020).
- **Eventos de vuelo:** la eyección no se dispara, solo se observa, y puede llegar antes o después del apogeo (D-014). Sin transiciones por tiempo: los fallbacks solo avisan (D-010).
- **Comandos:** confirmación de los "no aptos" y firma HMAC. Es más que nuestro D-008.

## 6. Recomendación para el 8 de noviembre

1. **Volar con el firmware de Pablo, más C1 (BOOST, T-410), C2 (persistencia, T-411), el buzzer y la Pi (T-413) y los momentos (T-412).** Desde D-045, lo hacemos nosotros en nuestro repo, y Pablo revisa.
2. **Prueba de alcance a 22 dBm** con los envs `_campo` y el cohete cerrado (A4).
3. **Operar con `dashboard.py` de Pablo, adaptado como nuestro dashboard** (D-046): él mismo produce `web-1` y le sirve a la web (T-661, T-662).
4. **Checklist** con C3, A6, M1, M5 y M7.
5. **Pi de Demeter autónoma** (A2), con T-701.
