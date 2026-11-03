---
id: firmware_vuelo
estado: aprobado-v2. Resume la arquitectura del firmware de Pablo (ptilanom/DEMETER @ 17139b2). El detalle y los hallazgos están en `docs/fuentes/demeter_pablo/CLAUDE_17139b2.md`.
actualizado: 2026-11-03
depende_de: [buses_y_pines, enlace_lora_tdma, protocolo_paquetes, maquina_estados, formato_log]
decisiones: [D-037, D-042, D-044]
reemplaza: 99_archivo/diseno_v1/firmware_vuelo.md (D-016 a D-021)
---
# Firmware de vuelo (v2, el de Pablo)

## 1. Proyectos y entornos (en nuestro repo, D-043)

| Proyecto | Placa | Envs | Para qué |
| --- | --- | --- | --- |
| `firmware/cohete/` | T-Beam Supreme | `demeter` (ROCKET_ID=1), `hermes` (2): 10 dBm, banco · **`demeter_campo`, `hermes_campo`: 22 dBm, alcance y vuelo** · `hermes_sinhora` (prueba sin anclas GNSS) | Los dos cohetes, **el mismo binario** salvo el ID |
| `firmware/tierra/` | T-Beam V1.2 | `tierra` (10 dBm) · **`tierra_campo` (22 dBm)** | La estación |

- **Plataforma:** `espressif32@6.13.0`, Arduino 2.0.x, **C++11**. Librerías: el submódulo de LilyGO (RadioLib, XPowersLib, SensorLib) con `lilygo_local.patch`.
- **El firmware de vuelo es la bandera `TEST_CORE`** (la que está activa). Las otras (`TEST_GNSS_PPS`, `TEST_SD_IMU`, `TEST_LORA_TX`) son pruebas viejas, y solo puede haber una activa.
- `-DMISSION_ID=<n>` va en el nombre de los logs y en TELEM.

## 2. Tareas

| Núcleo | Tarea | Prioridad | Qué hace |
| --- | --- | --- | --- |
| 1 | ISR del PPS, `in_imu` (QMI8658), `ext_lsm` (LSM + BMP por el hub) | Alta | Leen los FIFO y estiman el tiempo de cada muestra |
| 0 | `gnss` | 3 | UBX NAV-PVT a 10 Hz, anclas PPS |
| 0 | `in_i2c` | 3 | BME280 (forzado, ≈ 40 Hz), QMC6309 (100 Hz) y MMC5983MA (100 Hz) |
| 0 | `net` | 4 | TDMA ([enlace_lora_tdma](enlace_lora_tdma.md)) |
| 0 | `mission` | 2 | 50 Hz: comandos, altura y Vz barométricas, avisos ([maquina_estados](maquina_estados.md)) |
| 0 | `logger` | 2 | Anillos → SD ([formato_log](formato_log.md)) |
| — | `loop()` | 1 | Dueño de la PMU (vbat), diagnóstico USB una vez por segundo, sueño y reinicio |

- **Datos:** cada productor publica en `Latest<T>` (seqlock: la última muestra, para radio y misión) y en un `ByteRing` SPSC en PSRAM (hacia la SD).
- **Lección de Pablo:** toda tarea debe ceder CPU (`vTaskDelay`), o salta el watchdog de IDLE0.

## 3. Convenciones

- **Marcos:** NED en navegación, FRD en el cuerpo. Cuaternión Hamilton con el escalar primero, × 32767.
- **Datos crudos:** el log y TELEM guardan **ejes del chip**. Cada cohete lleva su calibración (`tools/tbeam/calib_<cohete>.json`: sesgos, escalas y una `R` chip→cuerpo que puede tener det = −1). La calibración todavía no viaja al cohete.
- **Altura:** sale de **los barómetros sobre `p0`** (un `p0` por sensor, fijado al armar). El BMP581 es el principal y el BME280 el respaldo. **El GNSS no da la altura** (decisión de Pablo).
- **EKF:** 17 errores, en Python (`tools/tbeam/ekf.py`): IMU virtual 0,8 LSM / 0,2 QMI; GNSS solo horizontal; barómetros; magnetómetros solo para el rumbo.
  - A bordo correrá unos 150 ms atrasado y llevará la salida al presente.
  - **No está portado** (se queda en "debería").

## 4. Herramientas de PC (`tools/tbeam/`; pasan a `estacion/` en T-660, D-046)

| Herramienta | Uso |
| --- | --- |
| `dashboard.py` + `dashboard.html` | `python tools/tbeam/dashboard.py` → `http://127.0.0.1:8765`. Conecta tierra, Demeter y Hermes por USB; banner de estado; comandos con confirmación; diagnóstico por sensor; descargas; calibración. `--demo` funciona sin placas. **Guarda todo lo recibido en `sesiones/<fecha>_<rol>.txt`** |
| `tbget.py` | `list`, `get`, `--ultimos N`, `--reset`, `--csv`: baja los logs por USB a 200 kB/s. **Debe ir con el firmware del mismo commit** |
| `tblog.py` | Resumen, huecos y `--csv` de un `.BIN` |
| `calib.py` | Calibración guiada (6 posiciones + giro) → `calib_<cohete>.json` |
| `ekf.py` | El EKF de PC sobre un log |

- **Dependencias:** `pip install pyserial numpy scipy`.
- **Puertos por defecto:** `COM5` tierra, `COM4` Demeter, `COM3` Hermes (Windows; en macOS se eligen en el dashboard).

## 5. Lo que falta

Ver la [revisión](../06_revisiones/revision_firmware_pablo.md) §4 y el [backlog](../05_plan/backlog.md) E4 y E11:
- BOOST (T-410) y persistencia (T-411);
- los momentos (T-412);
- buzzer y actuadores (T-413);
- la UART con la Pi (T-702);
- el EKF a bordo;
- llevar la calibración al cohete;
- la prueba de alcance.
