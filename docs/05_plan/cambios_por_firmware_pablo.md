---
id: cambios_por_firmware_pablo
estado: vivo (2026-11-03). Lo aprobó el usuario: "el código de Pablo gana".
actualizado: 2026-11-03
depende_de: [revision_firmware_pablo, sincronizacion_firmware_pablo, decisiones, backlog]
decisiones: [D-037, D-038, D-039, D-040, D-041, D-042, D-043, D-044]
---
# Qué cambia en nuestro plan con el firmware de Pablo

**Situación al 3 de noviembre:**
- Nosotros tenemos la web (`gui/web/`, `tools/web_datos/`) y los documentos, pero **ni una línea de firmware ni de estación**.
- Pablo Tilano (el dueño de los requisitos) tiene **el firmware de los dos cohetes y el de tierra funcionando en hardware**, más un dashboard de trabajo y las herramientas de log y calibración. Está en [ptilanom/DEMETER](https://github.com/ptilanom/DEMETER) @ `17139b2`.

**Lo que decidió el usuario el 2026-11-03:**
1. **Pablo es el dueño del firmware y lo sigue desarrollando en su repo.** Nosotros traemos copias (*snapshots*) y construimos lo demás contra su contrato (D-037).
2. **Donde su implementación contradice nuestros contratos, gana la de Pablo.** Los contratos se reescriben para describir su sistema; las versiones viejas pasan a `99_archivo/diseno_v1/` y las decisiones quedan reemplazadas.
3. **El código entra copiado tal cual,** solo reordenando carpetas (D-043), con un mapa que vuelve mecánica cada sincronización ([sincronizacion_firmware_pablo](sincronizacion_firmware_pablo.md)).
4. **Nuestro trabajo:** servicio de tierra + dashboard, web pública, Pi/VisionPack y los huecos del firmware (por PR a Pablo).
5. **El lanzamiento sigue siendo el 8 de noviembre.** El `CLAUDE.md` de Pablo dice "6 nov", pero corresponde al viaje y la inspección.

La revisión de código está en [revision_firmware_pablo](../06_revisiones/revision_firmware_pablo.md).

## 1. Tabla de cambios, área por área

| Área | Nuestro plan (v1) | Lo que hay (Pablo) | Qué hacemos | Decisión |
| --- | --- | --- | --- | --- |
| **Hardware y pines** | D-022 reabierta: propuesta B′ (SD en SDMMC, SPI3 de sensores en 46/45/3, QMI deshabilitado, buzzer en 21, pulso de la Pi en IO2), DRV5032 a `PWR_KEY` (D-031) | **Ya cableado y medido:** la SD sigue en el SPI de la placa, compartido con el QMI8658, que es el IMU de respaldo. El LSM6DSO32 va por **SPI por software** (SCK 48, MOSI 3, MISO 39, CS 2, INT1 38). El BMP581 cuelga **del sensor hub del LSM**. El MMC5983MA va en I2C0. Los externos van en ALDO2. IO45 = MOSFET (Pi PWR_ON / actuadores de Hermes), IO46 = MOSFET del buzzer de 5 V, **IO21 = DRV5032 como *wake* de sueño profundo** | [buses_y_pines](../03_hardware/buses_y_pines.md) reescrito con el cableado real. **D-022 se cierra; D-031 queda reemplazada.** PEN-17 y PEN-18 cerrados | D-042 |
| **Radio** | 919 MHz, SF6, BW 500, 22 dBm (D-001) | **903,0 MHz, SF7, BW 500**, CR 4/5, sync 0xD3, preámbulo 8, CRC LoRa. 10 dBm en el banco y 22 dBm con los envs `_campo` | [enlace_lora_tdma](../04_diseno/enlace_lora_tdma.md) reescrito. La regulación (PEN-13) sigue abierta | D-038 |
| **TDMA** | Ciclo de 100 ms con 4 slots de 25 ms, slot = ID (D-002) | **25 ranuras de 40 ms/s en grupos T A B A B.** Tierra: 0 (baliza), 5, 10, 15, 20 (comandos). Demeter: base 1 y 13, más 8 de extensión. Hermes: 2 y 14, más 8. **2 Hz en tierra y 10 Hz en vuelo** | Ídem | D-038 |
| **Sincronía** | GNSS, derivada, holdover de 120 s, ALOHA (D-003, D-004) | `TimeModel`: PPS propio, luego la **baliza firmada de tierra**, luego retención (1 ppm/s) y luego ninguna. Si el error es ≥ 2 ms: **baliza lenta** (TELEM con `utc_ms=0` cada 1–3 s, en un instante aleatorio) | Ídem. Es equivalente en espíritu | D-038 |
| **Paquetes** | Protocolo v2: cabecera de 3 B, NAV de 44 B a 9 Hz, STATUS de 42 B a 1 Hz, BEACON, CMD/ACK y BACKFILL | **`net_proto`:** TELEM de 64 B (sin cabecera común ni `seq`), BEACON de 18 B firmado, CMD de 20 B firmado (HMAC-SHA256/8 B), CmdResp de 28 B y LogInfo de 54 B (cada 5 s). **No hay STATUS, ni ACK, ni BACKFILL, ni versión** | [protocolo_paquetes](../04_diseno/protocolo_paquetes.md) reescrito. La correspondencia con `web-1` está en su §6 | D-039 |
| **Comandos** | Lista de comandos con `cmd_seq`, reintentos hasta el ACK y fases permitidas (D-008) | Ops PING, ARM, DISARM, LAUNCH, ABORT, SLEEP, RESET, SET_STATE y SET_MOMENT. **Evaluación de aptitud con motivos y confirmación en 10 s.** ARM siempre en dos pasos. Contador anti-repetición en NVS | Ídem. **No existe `FORZAR_ATERRIZADO`:** su equivalente es `momento aterrizaje` + `estado recovery` | D-039 |
| **Estados** | 10 fases (BOOT…LANDED, ERROR), estimador vertical 1D, Go/No-Go, persistencia (D-010 a D-015) | **Estados** TIERRA, ARMED, FLY y RECOVERY (más SLEEP). **Momentos** dentro de FLY: LAUNCH, BOOST, COAST, APOGEO, CAIDA, PARACAIDAS y ATERRIZAJE. "Apto para ARM" = reserva al 100 %, SD, LSM, BMP, fix 3D, batería y cohete quieto. **Detección automática: no existe (C1). Persistencia: no existe (C2)** | [maquina_estados](../04_diseno/maquina_estados.md) reescrito. Lo que falta se vuelve tareas (T-410 a T-413). **D-015 sigue como requisito** | D-040 |
| **Registro (log)** | Pretrigger de 2 s, bloques de 16 KB, rotación a 64 MB, decodificador propio (D-020, C-04) | Formato `rec` (`A5 5A`, len, tipo, src, `t_us`, payload, CRC). Archivos preasignados de 32 MB. **Registra desde LAUNCH, sin pretrigger** (LAUNCH llega unos 10 s antes del despegue). Lector `tblog.py` | [formato_log](../04_diseno/formato_log.md) nuevo (era T-202). **T-201, T-202 y T-203: hechas por Pablo** | D-044 |
| **Tasas y sensores** | LSM a 3,33 kHz, BMP a 240 Hz (D-018) | LSM a ≈ 1,6 kHz (±32 g, ±2000 °/s), BMP a ≈ 100 Hz, MMC a 100 Hz, QMI a 445 Hz, BME a 40 Hz, QMC a 100 Hz y GNSS a 10 Hz | [constantes](../02_requisitos/constantes.md) §5 actualizado | D-042 |
| **Fusión** | Estimador vertical 1D (decide), Madgwick y EKF 3D (telemetría) | A bordo, **solo la altura y la Vz barométricas** (`mission.cpp`). EKF de 17 errores **en Python** (`ekf.py`), validado con logs, todavía no portado | El EKF a bordo pasa a "debería" (Pablo lo quiere para las pruebas en carro) | — |
| **Estación (firmware)** | Módem "tonto" con trama `AA 55` a 921600 (D-024, C-03) | `tbeam_tierra`: **tiene inteligencia**. Firma y reintenta comandos, interpreta CmdResp y pregunta "¿forzar?". Por USB, a 115200, **líneas de texto**: `@T rssi snr hex`, `@L hex`, `@G 0/1`, más el diagnóstico `[xxx]`. Los comandos entran como texto (`d armar`, `si`) | **C-03 queda reemplazado.** El contrato USB está en [protocolo_paquetes](../04_diseno/protocolo_paquetes.md) §5. Se le piden `@R` y `@E` a Pablo (PEN-23) | D-041 |
| **Dashboard de operación** | T-660 a T-670 (E10), CLI T-S04, servicio T-602 con la API C-05 | `dashboard.py` + `dashboard.html` de Pablo: banner de estado, comandos con confirmación, diagnóstico por sensor, descargas (tbget), condiciones de misión y calibración. **Funciona hoy** | **En el lanzamiento, operar con `dashboard.py`** (dueño del puerto de tierra). Nuestro servicio de tierra lee su archivo de sesión → `web-1`. E10 se recorta | D-041 |
| **Web pública** | `web-1` (D-034), relay T-640 | No existe en Pablo (lo deja para "el equipo de sistemas") | **Se mantiene `web-1` sin cambios.** El servicio de tierra traduce TELEM a `web-1` (§3) | D-034 sigue |
| **VisionPack (Pi)** | UART `AA 55` con comandos por transición (D-023), pulso en IO2 | Sin código. Pines: UART0 43/44 (con 1 kΩ hacia el RX de la Pi) y **PWR_ON por el MOSFET de IO45**, en paralelo al botón J2 | La Pi vuela **autónoma** el 8 de noviembre (T-701). La integración por UART (T-702) pasa a "debería", con el contrato de Pablo (estado a 20–50 Hz con UTC) | D-023 actualizada |
| **Calibración** | `R_MONTAJE` medidas en el cohete (PEN-06) | `calib.py`: guía de 6 posiciones + giro → `calib_<cohete>.json` (sesgos, escalas, `R` chip→cuerpo con det = −1 posible, elipsoides, retardo del QMI). **No viaja al cohete** | PEN-06 queda como "repetir la calibración a cielo abierto con el cohete cerrado" | — |
| **Repo** | `firmware/` con 3 envs `supreme_*` y `modem_v12` (D-032), carpetas por módulo (C-01) | Dos proyectos PlatformIO más `common/` | `firmware/cohete/`, `firmware/tierra/`, `firmware/common/`, `firmware/vendor/` y `tools/tbeam/`. **Se conservan los nombres de env de Pablo** | D-043 |
| **Simulaciones** | Falta la de Hermes (PEN-07) | Pablo tiene la de Hermes (G80-7T, 1,157 kg) | Entra a `datos/`. **PEN-07 cerrado**; PEN-08 (Hermes) se responde con ella | — |

## 2. Lo que se conserva de nuestro plan

- **`web-1` y toda la web** (D-034, E10 en la parte pública). El servicio de tierra es quien traduce.
- **C-05** (la API local y el reenviador), adaptado: la entrada pasa de C-03 a las líneas de Pablo.
- **La revisión y las correcciones de la Pi** (T-701), y la idea de la integración por UART (con un contrato nuevo).
- **Las reglas de trabajo** (D-028 a D-030, D-035, D-036). El `desarrollador` toca **nuestras** carpetas; el firmware solo se toca en las tareas de sincronización.
- **Los requisitos** ([requisitos](../02_requisitos/requisitos.md)): siguen como referencia. Donde el firmware no los cumple, hay un hallazgo o una tarea.

## 3. Traducción a `web-1` (resumen; el detalle está en protocolo §6)

| `web-1` | Sale de |
| --- | --- |
| `estado.fase` | `state` + `moment` de TELEM, según la tabla de [maquina_estados](../04_diseno/maquina_estados.md) §5 |
| `pos.lat/lon` | `lat_e7`/`lon_e7`; `fuente` = `"gnss"` |
| `pos.alt_msl_m` / `alt_agl_m` | `alt_cm`/100 (GNSS) / menos la altura del sitio. Con PEN-23, la barométrica |
| `vel` | `vn`, `ve` y `−vd` (cm/s → m/s); `null` sin fix |
| `acc_g`, `q` | `acc_mg`/1000 (QMI, ejes del chip); `quat`/32767 (identidad hasta el EKF) |
| `seq`, `utc_ms`, `t_ms` | El índice de ranura `utc_ms/40`; `utc_ms`; `utc_ms` (no hay reloj propio) |
| `salud` | Se arma con TELEM (fix, sv, vbat) y LogInfo (registro y reserva) a 1 Hz. `go_nogo` = los últimos motivos de un ARM, o `null` |
| `meta.proto_version` | **Problema:** `web-1` solo admite 2 o 3. Hay que proponerle al plan web el valor `4` = `net_proto` de Pablo (PEN-24) |

## 4. El mínimo para volar, de nuevo (reemplaza plan_maestro §1)

1. **El firmware de Pablo en los tres nodos, desde un mismo commit, con BOOST automático (T-410).**
2. **Prueba de alcance a 22 dBm** con los cohetes cerrados (P-06).
3. **Operación con `dashboard.py`** y el checklist (T-901), que cubre C3, A6, M1, M5 y M7 de la revisión.
4. **Pi de Demeter autónoma**, con los bloqueantes corregidos (T-701) y encendida a mano antes de cerrar.
5. **Calibración final** a cielo abierto con el cohete cerrado (`calib.py`).

**Debería:** persistencia en vuelo (T-411), buzzer (T-413), la web pública alimentada desde la sesión de `dashboard.py` (T-602 + T-605a + T-640), la altura barométrica en TELEM (PEN-23).
**Si da el tiempo:** detección de los demás momentos (T-412), EKF a bordo, UART con la Pi (T-702), el dashboard de operación propio (E10).

## 5. Calendario realista (hoy es el 3 de noviembre)

| Día | Qué |
| --- | --- |
| 3 nov | Revisión e importación (T-007). Se envían a Pablo las peticiones (PEN-22, PEN-23) |
| 4 nov | T-410 (BOOST) en el repo de Pablo · prueba de alcance a 22 dBm · T-602 mínimo leyendo la sesión · T-701 |
| 5 nov | Ensayo completo con los dos cohetes y `dashboard.py` · calibración final · congelamiento y sincronización final (T-008) · compilar desde dos portátiles |
| 6–7 nov | Viaje, inspección y ensayo en el sitio. Solo correcciones con evidencia |
| 8 nov | Vuelo |
