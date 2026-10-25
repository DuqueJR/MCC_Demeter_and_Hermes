---
id: maquina_estados
estado: aprobado-v1 (umbrales provisionales hasta la simulación)
actualizado: 2026-10-24
depende_de: [constantes, protocolo_paquetes, firmware_vuelo]
decisiones: [D-010, D-011, D-012, D-013, D-014, D-015]
reemplaza: las 4 fases de Objetivos 4.2 y las 5 de la GUI (Objetivos 7.B)
---
# Máquina de estados de la misión principal (LilyGO)

Es la misma para los dos cohetes. La única diferencia está en las acciones del módulo VisionPack, que solo existen en Demeter.

## 1. Estados y códigos (`fase` en NAV)

| Código | Estado | Significado |
| --- | --- | --- |
| 0 | `BOOT` | Inicializa el hardware: PMIC, buses, sensores, SD, radio y GNSS. |
| 1 | `PREFLIGHT` | En tierra: calibración, adquisición del fix, telemetría y espera del ARM. |
| 2 | `ARMED` | Listo para detectar el despegue. El origen del EKF ya está fijado. |
| 3 | `BOOST` | El motor está empujando. |
| 4 | `COAST` | El motor se apagó y el cohete sigue subiendo. |
| 5 | `APOGEE` | Estado de evento: se acaba de detectar el apogeo. |
| 6 | `FREE_FALL` | Cae después del apogeo, sin paracaídas todavía (antes de la eyección). |
| 7 | `DESCENT` | Desciende con el paracaídas abierto. |
| 8 | `LANDED` | En el suelo: buzzer, volcado y backfill. |
| 9 | `ERROR` | **Solo en tierra:** BOOT o PREFLIGHT no pueden operar. |

## 2. Principios (D-010)

1. **No hay transiciones por tiempo en la LilyGO (decisión de Pablo).** Si no hay sensores, tampoco hay telemetría que valga, así que cambiar de estado por reloj no aporta.
   - Toda transición se basa en **señales medidas**, con una **ventana de confirmación**: la condición debe sostenerse N ms. Esa ventana es un filtro contra el ruido, no un respaldo por tiempo.
   - La Pi de Demeter **sí** conserva sus propios watchdogs por tiempo: si pierde la comunicación con la LilyGO, no debe perder la grabación.
2. **La única transición manual en vuelo** es `FORZAR_ATERRIZADO`, que manda el operador mirando la telemetría.
3. **ERROR no es una fase de vuelo (D-012):**
   - Las fallas en vuelo se reportan en el bitmap `fallas` y en `flags.FALLA_ACTIVA`, y la máquina sigue en la fase física en que está.
   - Al estado ERROR solo se llega desde BOOT o desde PREFLIGHT.
4. **Las decisiones salen del estimador vertical, no del EKF completo (D-011):**
   - La máquina de estados usa un **estimador vertical 1D**: un Kalman de altitud, velocidad vertical y bias de la aceleración, que fusiona el BMP581 con la aceleración axial del LSM6DSO32. También usa la aceleración cruda.
   - El EKF 3D completo, con el GNSS y Madgwick, sirve para la telemetría y la posición, pero **no decide las transiciones**.
   - Así, un error en el EKF no puede cambiar la fase de vuelo. Es el requisito de *Objetivos* 5 ("apogeo por la Vz del BMP581, verificado por la IMU"), implementado de la forma más robusta.
5. **Reinicio en vuelo (D-015):** la fase se guarda en memoria que sobrevive al reinicio. Ver la sección 6.

## 3. Transiciones

Los nombres en `MAYÚSCULAS` son constantes de [constantes.md](../02_requisitos/constantes.md). Los valores marcados con `(P)` son provisionales y se ajustan con la simulación o con los perfiles sintéticos (prueba P-03).
`a_ax` es la aceleración específica sobre el eje longitudinal del cohete (+X hacia la nariz). `|a|` es la norma de la aceleración, en g. `Vz` y `h` vienen del estimador vertical (h es AGL).

| # | De → A | Condición (todas deben cumplirse) | Acciones al entrar |
| --- | --- | --- | --- |
| T0 | (apagado) → BOOT | Imán ~1 s sobre el DRV5032: el PMIC enciende la placa (D-031) | Inicializa el PMIC, los rieles y los buses. Si hay un registro de persistencia válido, pasa a modo reanudado (§6). |
| T1 | BOOT → PREFLIGHT | Sensores **críticos** (LSM6DSO32, BMP581) responden con el ID correcto · SD montada · radio inicializada | Abre el log de la sesión · arranca la telemetría |
| T2 | BOOT → ERROR | Falla un sensor crítico, la SD o la radio | Reporta ERROR con el código en `fallas`. Si la radio funciona, transmite. |
| T3 | ERROR → PREFLIGHT | El operador lo resuelve y reinicia (solo con un reinicio físico) | — |
| T4 | PREFLIGHT → ARMED | Comando `ARM`, **y además el Go/No-Go en verde** (sección 4) | Fija el origen del EKF (la posición GNSS promediada en `ORIGEN_PROMEDIO_S` y la referencia barométrica) · genera `mission_id` · activa el buffer previo (*pretrigger*) · **desactiva el apagado del PMIC por pulsación larga** (D-031) · Demeter: envía `CMD_ARM` por UART (ver [visionpack_integracion.md](visionpack_integracion.md)) |
| T5 | ARMED → PREFLIGHT | Comando `DISARM` | Cierra la misión · reactiva el apagado por pulsación larga |
| T6 | ARMED → BOOST | `a_ax > LAUNCH_ACC_G` (3,0 g (P)) sostenida durante `LAUNCH_VENTANA_MS` (100 ms (P)) | Guarda en la SD el buffer previo (`PRETRIGGER_S` = 2 s) · pasa a la tasa de log máxima · marca el **t₀ del despegue** |
| T7 | BOOST → COAST | `a_ax < BURNOUT_ACC_G` (0,5 g (P)) sostenida durante `BURNOUT_VENTANA_MS` (100 ms (P)) | Marca el fin de la combustión (t_bo), que sirve para caracterizar el motor |
| T8 | COAST → APOGEE | `Vz ≤ 0` sostenida durante `APOGEO_VENTANA_MS` (100 ms (P)) **y** `h < h_max − APOGEO_CAIDA_M` (0,5 m (P)) **y** la verificación de la IMU (la `a_ax` no muestra empuje: `a_ax < 0,5 g`) | Registra `apogeo_dm` y t_apo · Demeter: `CMD_START_REC` |
| T9 | APOGEE → FREE_FALL | `Vz < −APOGEO_VZ_SALIDA` (−2 m/s (P)) **y** no se ha detectado la eyección | — |
| T10 | APOGEE → DESCENT | `Vz < −APOGEO_VZ_SALIDA` **y** la eyección ya se detectó (la eyección llegó antes del apogeo: sección 5) | — |
| T11 | FREE_FALL → DESCENT | Se detecta la eyección (E1) **o** el paracaídas está estable: `\|a\|` entre 0,7 y 1,3 g y `Vz` estable (con `\|dVz/dt\| < 2 m/s²`) durante `DESCENSO_VENTANA_MS` (1000 ms (P)) | — |
| T12 | DESCENT → LANDED | `\|Vz\| < LANDED_VZ` (0,5 m/s) **y** `\|a\|` en 1 ± 0,05 g **y** el giro < 5 °/s, todo sostenido durante `LANDED_VENTANA_S` (5 s (P)) | Buzzer · baja la tasa del log · reactiva el apagado por pulsación larga · cierra los archivos de vuelo · Demeter: `CMD_TOUCHDOWN` · deja listo el backfill/Wi-Fi a la espera de comando |
| T13 | FREE_FALL o DESCENT → LANDED | Comando `FORZAR_ATERRIZADO` | Igual que T12 |

**E1 (evento de eyección)** es un **indicador**, no un estado: `flags.EYECCION`. Se detecta con un pico de `|a| > EYECCION_ACC_G` (4 g (P)) en una ventana de 20 ms, **después de T7** (fin de la combustión).
- Al detectarlo se registra t_ej, que da el **retardo real del motor** (t_ej − t_bo).
- Durante `EYECCION_BLOQUEO_BARO_MS` (300 ms (P)) después del evento, **no se usa el barómetro** en el estimador vertical: la carga de eyección produce un pico de presión dentro de la bahía.

Las transiciones solo van **hacia adelante**: no se vuelve de COAST a BOOST, por ejemplo. La única excepción es T5 (DISARM).

## 4. Go/No-Go para ARM (D-013)

ARM se rechaza (ACK con código 2) si falla cualquiera de estas condiciones:

| Condición | Valor |
| --- | --- |
| **Fix GNSS 3D válido** con `hAcc < GO_HACC_MAX_M` (5 m (P)) y al menos `GO_SV_MIN` satélites (6) | **Obligatorio.** El EKF necesita la posición absoluta inicial para seguir estimando si se pierde el GNSS en vuelo. |
| Hora válida y TDMA en `GNSS` o `DERIVADA` | Evita pisar al otro cohete. |
| LSM6DSO32 y BMP581 sin falla, y los respaldos reportados | |
| Bias del giro calibrado y cohete quieto (`\|a\|` en 1 ± 0,05 g, giro < 2 °/s durante 2 s) | |
| SD con más de `SD_MIN_LIBRE_MB` libres y el log escribiendo | |
| Batería ≥ `BAT_MIN_ARM_PCT` | |
| Demeter: la Pi responde (`estado_sec` ≠ `0xFE`) y está en READY | Solo en Demeter |

La GUI muestra cada condición con su propio indicador: es el "checklist automático" de *Objetivos* 7.C.

## 5. Retardo del motor y orden de los eventos (D-014)

**Motores declarados por el equipo:** G80-7T y H135W con retardo de 8 s.
> **Confirmado por el usuario el 2026-10-24:** es el **H135W con el retardo perforado a 8 s** (H135W-8). Falta saber qué cohete vuela cada motor.

- La eyección ocurre en **t_bo + retardo**.
- Según el cohete, puede llegar **antes** del apogeo (en COAST), **cerca** de él, o **después** (en FREE_FALL). La máquina de estados acepta los tres casos:
  - **Antes del apogeo:** COAST, luego E1 (el paracaídas se abre y la Vz cae rápido), T8, y T10 directo a DESCENT. FREE_FALL no se usa.
  - **Después del apogeo:** COAST, T8, T9 (FREE_FALL), E1 y T11.
- **Alarma de descenso rápido** (de la GUI): se evalúa **solo en DESCENT**. En FREE_FALL es normal caer rápido.
- **Caracterización del motor** (objetivo del CanSat): con t₀, t_bo, t_ej y la aceleración a tasa completa durante BOOST se obtienen la curva de empuje, el impulso total, el tiempo de combustión y el retardo real. Ver [firmware_vuelo.md](firmware_vuelo.md), caracterización del motor.

## 6. Reinicio en vuelo (D-015)

- **Qué se guarda:** en cada transición se escribe un registro de persistencia con:
  - un valor mágico y la versión;
  - la fase, `mission_id`, `boot_count` y `t0_utc_ms`;
  - el origen del EKF (lat, lon, altitud MSL y referencia barométrica);
  - `h_max` y los eventos ya ocurridos (t_bo, t_apo, t_ej).
- **Dónde:** en **memoria RTC**, que sobrevive a los reinicios de software, watchdog y brownout según la ficha [esp32_s3](../03_hardware/componentes/esp32_s3.md), y en **NVS** (flash), que también sobrevive a un corte de alimentación.
- **Al arrancar:**
  - Si hay un registro válido con una fase entre BOOST y DESCENT, y `mission_id ≠ 0`, el nodo entra en **modo reanudado** (`flags.REANUDADO = 1`):
    - si venía de BOOST o COAST, continúa en COAST;
    - si venía de APOGEE, FREE_FALL o DESCENT, continúa en DESCENT;
    - reutiliza el origen y no exige Go/No-Go.
  - Si la fase era LANDED, continúa en LANDED.
  - En cualquier otro caso, arranca normal en BOOT.
- **El registro se invalida** en DISARM y al confirmar el volcado (o con un comando de mantenimiento en PREFLIGHT). Así, un arranque en la mesa no se confunde con un reinicio en vuelo.

## 7. Qué cambia entre Hermes y Demeter

Solo las acciones del VisionPack: envíos UART en T4, T6, T8 y T12, y el pulso de encendido.
Esas acciones se activan con la configuración `MODULO_VISIONPACK = 1` (solo en Demeter). La equivalencia está en [visionpack_integracion.md](visionpack_integracion.md).
