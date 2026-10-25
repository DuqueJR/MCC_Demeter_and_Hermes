---
id: C-01
estado: borrador (se congela en H0, T-S01)
actualizado: 2026-10-25
depende_de: [flujo_trabajo, firmware_vuelo, dos_sesiones_plan_maestro]
---
# C-01. Propiedad de carpetas y archivos

**Para qué:** que las dos sesiones nunca editen el mismo archivo sin acordarlo. Cada carpeta tiene **un dueño**:
- solo el dueño (y sus agentes) la edita;
- el otro revisa sus PR.

Lo **compartido** solo se cambia en una sincronización, con las dos aprobaciones ([08](../08_sincronizacion_y_merge.md)).

**Es una propuesta de estructura de carpetas.** Hoy `firmware/`, `estacion/` y `tools/` solo tienen un README. La crea el `desarrollador` en T-002 y en las primeras tareas de cada sesión.

## 1. Firmware (`firmware/`)

| Ruta | Dueño | Contenido |
| --- | --- | --- |
| `platformio.ini` | **B** | Los 3 environments (`supreme_hermes`, `supreme_demeter`, `modem_v12`), **más un `native`** para las pruebas en el PC. Librerías con versión fija. **PSRAM en modo QSPI** (APS6404L). |
| `include/config.h` | **Compartido** | Copia de [constantes.md](../../../02_requisitos/constantes.md) con los mismos nombres. El chequeo T-S09 lo verifica. |
| `src/main.cpp` | **Compartido** | Arranque y creación de tareas. Se edita en pareja o con la aprobación del otro. |
| `src/estado/` | **Compartido** | Los tipos de [C-02](02_interfaces_firmware.md): estado de vuelo, eventos de fase, comandos, tiempo y GNSS |
| `src/hal/` | **B** | Interfaces de la capa de hardware y sus implementaciones reales y falsas ([C-02](02_interfaces_firmware.md) §6) |
| `src/sensores/`, `src/buses/` | **B** | Drivers y las tareas `t_bus_sens` y `t_bus_i2c0` |
| `src/log/` | **B** | `t_log` y el codificador de [C-04](04_formato_log_y_replay.md) |
| `src/fusion/` | **B** | Estimador vertical, Madgwick, EKF |
| `src/fsm/` | **B** | Máquina de estados, Go/No-Go, persistencia |
| `src/energia/` | **B** | PMU (TG28), batería, `t_house`, buzzer, RTC |
| `src/tiempo/` | **A** | `t_gnss`, PPS, la correspondencia entre `t_us` y UTC, las fuentes de sincronía |
| `src/protocolo/` | **A** | Códec del protocolo v2 (NAV, STATUS, BEACON, CMD, ACK, BACKFILL) |
| `src/radio/` | **A** | `t_radio`, TDMA, ALOHA, despacho de comandos, backfill |
| `src/visionpack/` | **A** | `t_visionpack` (UART AA 55, pulso) |
| `src/volcado/` | **A** | `t_dump` (Wi-Fi AP y HTTP) |
| `src/modem/` | **A** | El firmware del módem (environment `modem_v12`) |
| `test/test_<modulo>/` | El dueño del módulo | Pruebas Unity en `native` y en la placa |

## 2. Tierra (`estacion/`): dueño A

| Ruta | Contenido |
| --- | --- |
| `estacion/servicio/` | Ingesta por serie ([C-03](03_trama_usb_modem.md)), log crudo, decodificación, estado por cohete, comandos con reintento |
| `estacion/api/` | El servidor local de [C-05](05_api_backend_tierra.md) |
| `estacion/cli/` | La CLI del operador (T-S04) |
| `estacion/calculos/` | Distancia, azimut, elevación, elipse, tiempos (T-S08) |
| `estacion/modem_falso/` | El doble del módem (T-S07) |
| `estacion/reenviador/` | T-605a: el reenviador de los mensajes `web-1` hacia el relay del plan web ([C-05](05_api_backend_tierra.md) §6) |
| `estacion/constantes.py` | **Compartido**: copia de `constantes.md`; T-S09 la verifica |

## 3. Herramientas (`tools/`)

| Ruta | Dueño |
| --- | --- |
| `tools/sintetico/` (T-304) | A |
| `tools/decodificador/` (T-203) | A |
| `tools/motor/` (T-802) | A |
| `tools/replay/` (T-305) | B |
| `tools/vectores/protocolo/` | A (los revisa B) |
| `tools/vectores/usb/` | A |
| `tools/vectores/log/` | B (los revisa A) |
| `tools/vectores/api/` | A |
| `tools/chequeo_constantes/` (T-S09) | B |

## 4. Otras carpetas

| Ruta | Dueño | Nota |
| --- | --- | --- |
| `visionpack/` | **A** | T-701 por confirmar. Los archivos que faltan los entrega el equipo de visión |
| `gui/` (web, relay T-640, dashboard) | **Otro plan** | **No se toca** |
| `docs/08_gui/` (incluido `web-1`), `tools/web_datos/` | **Otro plan** (rama `docs/plan-web`) | **No se toca.** Los cambios a `web-1` se le **proponen** al plan web |
| `datos/` | Nadie (solo lectura) | Los datos originales no se editan ([datos/README](../../../../datos/README.md)) |
| `docs/02_requisitos/`, `docs/04_diseno/` (contratos) | **Compartido** | Solo con una decisión aprobada ([08](../08_sincronizacion_y_merge.md) §3) |
| `docs/05_plan/dos_sesiones/estado/sesion_A.md` / `sesion_B.md` | A / B | Cada uno edita la suya |
| `docs/05_plan/dos_sesiones/estado/placa.md` | Los dos | **Solo se agregan entradas**, sin reescribir |
| `docs/07_bitacora/` | Cada autor | Un archivo por entrada (D-029) |
| `.claude/`, `.github/`, `CLAUDE.md`, `.gitignore` | **Compartido** | Cambios solo con aprobación aparte (DP-03, T-S10, T-S11) |

## 5. Reglas

1. **Una tarea toca solo las carpetas de su dueño**, más las pruebas de esas carpetas.
2. **Si una tarea necesita cambiar algo compartido**, el agente se detiene y escribe la propuesta en su entrada de bitácora (como ya exige el `desarrollador`).
3. **Los tipos compartidos de `src/estado/`** se crean en T-002, a partir de C-02, y después solo cambian con una decisión.
4. **Los hooks de [15](../15_CLAUDE_md_propuesto.md) §3** hacen cumplir estas reglas cuando se apliquen (T-S11).
