---
id: verificacion_compilacion_firmware
estado: vivo
actualizado: 2026-11-05
depende_de: [sincronizacion_firmware_pablo, backlog]
decisiones: [D-045, D-060]
---
# Verificación de compilación del firmware (para Pablo)

**Para qué:** cerrar el riesgo de que el firmware no se ha compilado completo para el chip. La única compilación limpia registrada (`pio run -e hermes -e demeter`) fue en T-304 y quedó **antes** de integrar el EKF a bordo (D-060). Casi todo lo demás se validó solo en el PC con `g++` + *stubs* o en Python, con la nota "sin compilar en la placa; Pablo compila y carga". No hay CI (`docs/`, sin `.github/workflows`), así que la compilación la hace una persona a mano.

**Objetivo:** compilar los 7 environments del `develop` actual, en una máquina con red, y dejar registrados el hash, la versión de PlatformIO y el uso de RAM/flash de cada uno.

## 0. Qué hay que compilar hoy (lo que no estaba en la compilación de T-304)

- **EKF a bordo (D-060):** `firmware/cohete/src/ekf_core.cpp/.h`, `ekf_task.cpp/.h`, más cambios en `ext_lsm`, `in_imu`, `mission`, `net_radio`, `rec_format.h`, `core_bus`, `core_selftest`, `ext_pi` y `main`.
- Junto con lo que ya estaba: BOOST (T-410), buzzer/actuador (T-413), calibración a bordo (D-059), temperatura del suelo (D-058) y la UART con la Pi (D-054/055/056).

## 1. Antes de empezar

- Máquina **con internet** (PlatformIO tiene que bajar `espressif32@6.13.0`).
- PlatformIO Core 6.2.x (`pio --version`). En la nube se usó `uvx --from platformio pio`; en un portátil sirve `pip install -U platformio` o la extensión de VS Code.
- En **Windows**: `git config --global core.longpaths true` (las rutas de LilyGO son muy largas).
- Partir del `develop` más reciente y **limpio** (el hash se embebe como `FW_GIT`, con un `+` si hay cambios sin commitear):

```bash
git fetch origin
git switch develop
git pull --ff-only
git status          # debe quedar limpio
```

## 2. Preparar (una sola vez)

```bash
git submodule update --init firmware/vendor/Lilygo-LoRa-Series
git -C firmware/vendor/Lilygo-LoRa-Series apply --ignore-whitespace ../../common/lilygo_local.patch
cp firmware/common/net_proto/secrets.h.ejemplo firmware/common/net_proto/secrets.h
```

- Después se edita `secrets.h` con la **clave real de 32 bytes** (la misma en las tres placas). Para **compilar y probar en banco** sirve la de ejemplo (ceros); para **las placas de vuelo** hay que poner la real.
- El parche del submódulo y `secrets.h` son locales: **no se commitean** (están en `.gitignore`).

## 3. Matriz de environments

| Proyecto | Env | Uso |
| --- | --- | --- |
| `cohete` | `demeter` | banco (10 dBm) |
| `cohete` | `hermes` | banco (10 dBm) |
| `cohete` | `demeter_campo` | **22 dBm: alcance y vuelo** |
| `cohete` | `hermes_campo` | **22 dBm: alcance y vuelo** |
| `cohete` | `hermes_sinhora` | prueba (sin anclar la hora al GNSS; **no vuela**) |
| `tierra` | `tierra` | banco (10 dBm) |
| `tierra` | `tierra_campo` | **22 dBm: vuelo** |

Los que vuelan son los `_campo`. Los de banco y `hermes_sinhora` se compilan para confirmar que el código fuente completo queda sano, no para cargarlos ese día.

## 4. Compilar (en este orden)

```bash
# 1) Cohetes, banco (el punto de referencia: esto es lo que ya pasó en T-304)
pio run -d firmware/cohete -e demeter -e hermes

# 2) Cohetes, campo + la prueba sin hora
pio run -d firmware/cohete -e demeter_campo -e hermes_campo -e hermes_sinhora

# 3) Estación de tierra (proyecto y placa distintos: esp32dev)
pio run -d firmware/tierra -e tierra -e tierra_campo
```

Para una prueba rápida de un solo env: `pio run -d firmware/cohete -e demeter`.

## 5. Qué revisar en la salida

- Cada env termina en **`SUCCESS`**.
- Anotar **RAM %** y **Flash %** de cada uno. Referencia de T-304 (antes del EKF): Hermes RAM 16,5 %, flash 19,4 % (35 s); Demeter 41 s.
- La línea `firmware: <env> <hash>` que imprime `fw_version.py` al inicio: el `FW_GIT` debe ser el hash de `develop`, **sin `+`**.
- **Símbolos de riesgo (no verificados todavía):** que existan `gpio_hold_en`, `gpio_hold_dis`, `gpio_deep_sleep_hold_en` y `gpio_deep_sleep_hold_dis` en el framework (los usa T-413). Si no existen, saldrá un error de "not declared".
- Que `ekf_core.cpp`/`ekf_task.cpp` y la calibración a bordo (`cal_core.cpp`, `cal_onboard.cpp`) no den errores de tipos entre `float` y `double`.

## 6. Definición de "hecho"

- Los **7 envs** compilan `SUCCESS` sin errores (solo warnings aceptables, que se anotan).
- Se registra en la bitácora: hash de `develop`, versión de PlatformIO, RAM/flash de cada env, warnings y cualquier fix que haya hecho falta.
- Lo ideal es que **dos portátiles** distintos lo corran (T-902: compilar y cargar desde dos máquinas, A7).

## 7. Si algo falla

- **No arreglar en caliente y seguir:** registrar el error exacto (archivo, línea, mensaje) y abrir una tarea `fix/T-xxx-*` o avisar al documentador.
- Si falta `secrets.h` → paso 2.
- Si falla `SensorQMI8658::readFifoInterruptConfig` → falta el parche `lilygo_local.patch` (paso 2).
- Si falla al instalar la plataforma (`HTTPClientError` a `api.registry.platformio.org`) → es un problema de red/proxy, no del código; correr en una máquina con salida directa a internet.

## 8. Después de compilar (carga)

Cargar en placa usa `--upload-port` (los puertos de `platformio.ini` son los de la máquina de Pablo):

```bash
pio run -d firmware/cohete -e demeter_campo -t upload --upload-port <puerto>
pio run -d firmware/cohete -e hermes_campo  -t upload --upload-port <puerto>
pio run -d firmware/tierra  -e tierra_campo  -t upload --upload-port <puerto>
```

- **Nunca transmitir sin antena conectada.** En banco, usar los envs de banco.
- La versión visible queda en `FW_ENV`/`FW_GIT` (lo muestra el arranque y el `FILEHDR` cuando se agregue el hash, T-414).

## Documentos de referencia

- Preparación y compilación: `firmware/README.md`.
- Qué cambió y qué es de Pablo: `docs/05_plan/cambios_por_firmware_pablo.md` y `docs/05_plan/sincronizacion_firmware_pablo.md` §5.
- Evidencia de la compilación de T-304: `docs/07_bitacora/2026-11-05_T-304_vuelos-sinteticos.md`.
