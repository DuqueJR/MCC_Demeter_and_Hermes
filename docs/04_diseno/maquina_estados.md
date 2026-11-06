---
id: maquina_estados
estado: aprobado-v2 (los estados y momentos de Pablo). Describe ptilanom/DEMETER @ 17139b2 (`mission.cpp`, `mission_config.h`, `net_proto.h`) y marca lo que falta.
actualizado: 2026-11-03
depende_de: [protocolo_paquetes, constantes, revision_firmware_pablo]
decisiones: [D-040, D-015]
reemplaza: 99_archivo/diseno_v1/maquina_estados.md (D-010 a D-014)
---
# Estados y momentos de la misión (v2, la de Pablo)

**Marcas:** ✅ implementado · 🟡 escrito sin validar [Pablo] · ❌ no existe (con su tarea).
**Igual para los dos cohetes;** cambian la configuración (`mission_config.h`) y el uso de IO45: el encendido de la Pi en Demeter; en Hermes queda sin uso (D-053). El buzzer (IO46) va en los dos.

## 1. Estados de la LilyGO (`State`, bits 0–3 de `TELEM.state`)

| Código | Estado | Qué hace | |
| --- | --- | --- | --- |
| — | **SLEEP** | Sueño profundo: cierra los logs, corta los rieles menos DC1 y **despierta con el imán en IO21** (equivale a un arranque). Sin radio | ✅ (comando `dormir` o tecla `s`) |
| 1 | **TIERRA** | Preparación: sensores, radio, SD y reserva de 32 MB. `p0` sigue al clima (τ = 60 s). No registra (solo los últimos 8 `T_MISSION`). 2 Hz | ✅ (estado de arranque) |
| 2 | **ARMED** | En la rampa: congela `p0`, **prepara el archivo** (la primera escritura) y no crea reservas. 2 Hz | ✅ |
| 3 | **FLY** | Todo el vuelo: **registra en la SD y transmite a 10 Hz** | ✅ |
| 4 | **RECOVERY** | Aterrizado: 2 Hz con la posición. Sigue registrando `t_post` (60 s) y luego para | ✅ (solo por comando) |

**Momentos dentro de FLY** (`Moment`, bits 4–7):

| Código | Momento | Cómo se detecta (lo definió Pablo) | Estado |
| --- | --- | --- | --- |
| 1 | LAUNCH | **Comando `launch`**, unos 10 s antes del despegue (la cuenta regresiva). Al entrar a FLY | ✅ |
| 2 | BOOST | Exceso sobre 1 g integrado con `\|a\| > 2 g` hasta `boost_dv_mps` (5 m/s), **o** un salto del BMP de `jump_m` (10 m) en `jump_s` (0,5 s), sostenido 5 muestras. **Fallback de LAUNCH:** desde ARMED, BOOST obliga a pasar a FLY | ❌ **T-410 (crítica)** |
| 3 | COAST | `\|a\| < 2 g` durante 200 ms; fallback `t_burn_max` | ❌ T-412 |
| 4 | APOGEO | Inercial (los IMU) + absoluto (los barómetros). **Sin GNSS.** La bajada debe ser sostenida (que no la engañe el pulso de la eyección). No antes de `t_apogeo_min` | ❌ T-412 |
| 5 | CAIDA | Después del apogeo, sin paracaídas (puede no existir) | ❌ T-412 |
| 6 | PARACAIDAS | **El choque de apertura** en la aceleración. **No** con la velocidad vertical. Puede llegar antes o después del apogeo | ❌ T-412 |
| 7 | ATERRIZAJE | Altura estable + componente inercial | ❌ T-412 |

- **Hoy los momentos 2 a 7 solo se ponen con el comando `momento <x>`.**
- **La eyección la hace el motor:** la LilyGO solo observa. Ningún momento dispara nada.

## 2. Transiciones por comando (`mission.cpp: evaluate / execute`)

| Comando | Desde | Hacia | Apto si… (si no, `NO_APTO` con motivos y confirmación) |
| --- | --- | --- | --- |
| `armar` | TIERRA | ARMED | **Siempre en dos pasos** (`CONFIRMA`, y luego `si`). Antes, sin motivos de "listo": reserva al 100 %, SD bien, LSM y BMP con datos, fix 3D, `vbat ≥ vbat_arm_mv` (3700 mV (P)), `\|a\|` en 1 ± 0,25 g y `\|Vz\| ≤ 2 m/s`; en Demeter, además, la Pi en READY o ARMED (`RZ_PI_NO_LISTA`, D-055) |
| `desarmar` | ARMED | TIERRA | Siempre |
| `desarmar` / `estado tierra` | FLY | TIERRA | Sin BOOST: apto (es abortar en el banco). **Con BOOST: no apto (en vuelo)** |
| `launch` | ARMED | FLY (momento LAUNCH) | Apto. Desde TIERRA: no apto ("no armado"), pero con confirmación entra a FLY **forzado**, que es como se registra en el banco |
| `abortar` | FLY | ARMED | Sin BOOST: apto. Con BOOST: no apto |
| `estado recovery` | FLY | RECOVERY | Exige el momento ATERRIZAJE y que el cohete esté quieto. Si no, motivos |
| `momento <x>` | FLY | — | `x > BOOST` exige que haya habido BOOST; `aterrizaje` exige quietud |
| `dormir` | TIERRA | SLEEP | No apto con el imán presente, ni en ARMED o FLY (RECOVERY: no apto mientras haya batería) |
| `reiniciar` | TIERRA | (reinicio) | No apto fuera de TIERRA |
| `ping` | Cualquiera | — | Siempre |

- **Confirmación:** vale **10 s** (`CONFIRM_WINDOW_MS`, y 9 s en tierra), y solo si el comando y los motivos **no cambiaron**.
  - Lo forzado prende `TF_FORZADO` y queda en el log (`T_MISSION`).
- ⚠️ **Mientras no exista T-410, nunca hay "BOOST"** en un vuelo real. Las protecciones "en vuelo" no actúan: un `desarmar` en pleno vuelo se ejecuta y cierra el log (C1 de la [revisión](../06_revisiones/revision_firmware_pablo.md)).
  - Hasta entonces, **el operador manda `momento boost` apenas vea el despegue**. Va en el checklist.

## 3. Lo que pasa solo (sin comando)

| Qué | Cuándo | |
| --- | --- | --- |
| Aviso `TF_LAUNCH_VENCIDO` | `t_abort` (120 s) en FLY desde ARMED sin BOOST. **Solo avisa:** el registro sigue | 🟡 |
| Fin del registro en RECOVERY | `t_post` (60 s) después de entrar | ✅ |
| Rotación del archivo | Al llenar 32 MB (≈ 12,5 min). En vuelo, el siguiente archivo **no** tiene reserva | ✅ |
| Persistencia del estado ante un reinicio | Nuestra D-015: requisito vigente | ❌ **T-411** |
| Bandera `TF_BOOST_SIN_ARMAR` y actuadores por cohete | BOOST detectado sin estar armado (Demeter: PWR_ON solo si la Pi consta apagada) | ❌ (con T-410 y T-413) |
| Buzzer al aterrizar | | ❌ T-413 |

## 4. Configuración por cohete (`mission_config.h`)

Se cambia **solo recompilando:** ningún comando la altera en campo. La base son las simulaciones; los márgenes son provisionales (P).

| Campo | Demeter (H135W-8, 1,469 kg) | Hermes (G80-7T, 1,157 kg) | Uso |
| --- | --- | --- | --- |
| `boost_dv_mps` | 5 | 5 | BOOST |
| `jump_m` / `jump_s` | 10 / 0,5 | 10 / 0,5 | BOOST por el BMP |
| `t_burn_max` | 3,0 s | 2,7 s | Fallback de COAST (sim.: 2,07 / 1,81) |
| `t_apogeo_min` / `max` | 7,0 / 16,0 s | 5,5 / 13,0 s | Ventana del apogeo (sim.: 11,54 / 9,26) |
| `t_para_max` | 13,0 s | 12,0 s | Aviso si no hubo apertura (carga en la sim.: 10,07 / 8,81) |
| `t_vuelo_max` | 210 s | 140 s | ATERRIZAJE a más tardar (sim.: 85 / 56) |
| `t_abort` | 120 s | 120 s | Aviso de LAUNCH sin BOOST |
| `t_post` | 60 s | 60 s | Registro después de RECOVERY |
| `vbat_arm_mv` | 3700 | 3700 | ARM |

**Regla de Pablo para los fallbacks:**
- al llegar al tiempo esperado **se notifica** y se sigue esperando la detección real (lo que ocurra primero);
- **un fallback nunca anula el registro ni impide el funcionamiento autónomo.**
- Coincide con nuestra D-010.

## 5. Correspondencia con las fases de `web-1`

`web-1` usa los nombres y códigos de la v1. **El servicio de tierra traduce así** (T-602):

| `state` | `moment` | `web-1` `fase` (`fase_cod`) |
| --- | --- | --- |
| 0 (sin estado) | — | `BOOT` (0) |
| TIERRA | — | `PREFLIGHT` (1) |
| ARMED | — | `ARMED` (2) |
| FLY | LAUNCH | `ARMED` (2). La cuenta regresiva: todavía en la rampa, pero registrando |
| FLY | BOOST | `BOOST` (3) |
| FLY | COAST | `COAST` (4) |
| FLY | APOGEO | `APOGEE` (5) |
| FLY | CAIDA | `FREE_FALL` (6) |
| FLY | PARACAIDAS | `DESCENT` (7) |
| FLY | ATERRIZAJE | `LANDED` (8) |
| RECOVERY | — | `LANDED` (8) |

- `ERROR` (9) no se usa.
- La alarma de descenso rápido (`web-1`) se evalúa en `DESCENT`, es decir, en el momento PARACAIDAS.

## 6. Especificación de la detección de BOOST (T-410)

Los criterios son de Pablo (§1). Lo marcado con (P) lo fijó el documentador para poder implementar, y **lo revisa Pablo en el PR**.

**Entradas:**
- **Aceleración:** la norma `|a|` en g de **cada muestra** del LSM6DSO32 (±32 g).
  - Si el LSM no tiene datos frescos (`FRESH_US`), se usa el QMI8658 (±16 g).
  - **Se usa la norma, no un eje:** no depende de la orientación ni de la calibración, que todavía no está en el cohete.
- **Altura:** la barométrica sobre `p0` que ya calcula `mission.cpp` (el BMP581, o el BME280 de respaldo).

**Integrador de velocidad (criterio inercial):**
1. Mientras `|a| > BOOST_ACC_MIN_G` (2,0): `dv += (|a| − 1) · 9,80665 · dt`, con el `dt` real entre muestras (las marcas de `t_us`).
2. **Mientras `|a| ≤ BOOST_ACC_MIN_G`, dv decae:** `dv −= BOOST_DV_DECAY_G · 9,80665 · dt`, sin bajar de 0 (D-048).
   - Sin esto, una sacudida de ±3 g a 5 Hz en un eje horizontal llegaba a 52 m/s, porque sus bajadas de 39 ms nunca alcanzaban el reinicio de 50 ms (T-410).
   - Con el decaimiento, el dv máximo es ≤ 1,8 m/s de 5 a 20 Hz en los dos ejes.
   - En el despegue real no influye: `|a|` se mantiene > 2 g durante la combustión.
   - Si `|a| ≤ BOOST_ACC_MIN_G` durante más de `BOOST_RESET_MS` (50 ms (P)) seguidos: `dv = 0`.
3. **BOOST** cuando `dv ≥ boost_dv_mps` (5 m/s, `mission_config.h`).
4. **Huecos entre muestras** (D-048): un `dt` mayor que `BOOST_DT_MAX_US` (5 ms) no se integra, y un hueco mayor que `BOOST_RESET_MS` reinicia `dv`. Sin esto, una muestra suelta de 20 g tras un hueco de 40 ms sumaría 7,5 m/s de golpe.
5. **Muestras saturadas** (6 nov): una muestra con algún eje en el tope de la escala (±32767) no se integra ni reinicia nada: es el chip saturado o un dato basura. El motor no satura ninguno de los dos IMU (LSM ±32 g, QMI ±16 g).
6. **Primer lote del QMI al encender** (6 nov): se registra, pero no va a BOOST ni al EKF. En Demeter traía x = −32768 durante 16 muestras, que solas sumaban 5,5 m/s; como el LSM aún no estaba listo, BOOST usaba el QMI y pasaba a BOOST sin armar en cada arranque.
5. Después de disparar, el integrador vuelve a 0 y puede volver a disparar (la misión ignora los BOOST repetidos). Así no hay estado que sincronizar entre núcleos.
6. **Respaldo del QMI:** su aviso vale solo si, cuando la misión lo lee, el LSM no tiene una muestra fresca (`FRESH_US`).
7. Se evalúa **a la tasa del IMU**, sin submuestrear a 50 Hz. Lo recomendado:
   - un módulo puro (`boost_detect.h/.cpp`, C++11, sin dependencias de ESP32) alimentado desde el consumidor del FIFO del LSM;
   - el resultado pasa a la tarea de misión por una bandera atómica.

**Criterio barométrico (respaldo):**
- BOOST si `alt(t) − alt(t − jump_s) ≥ jump_m` (10 m en 0,5 s) en `BOOST_BARO_EVAL` (5 (P)) evaluaciones seguidas de la tarea de misión (50 Hz).
- **Usa la altura sin filtrar** (el filtro de `ALT_TAU_S` la atrasaría) y se reinicia al cambiar de sensor (D-048).
- **Limitación conocida:** un pulso de presión de +12 m que dure 120 ms o más sí dispara (5 evaluaciones × 20 ms).

**Cuándo está activa y qué hace:**

| Estado al detectar | Acción |
| --- | --- |
| ARMED | → FLY con momento BOOST; `s_boosted = true`; registra (el archivo ya está preparado); 10 Hz |
| FLY, momento LAUNCH | Momento BOOST; `s_boosted = true`; se apaga el aviso de `t_abort` |
| TIERRA | `TF_BOOST_SIN_ARMAR` (se mantiene hasta un reinicio o hasta pasar a TIERRA con "estado tierra") + FLY + BOOST + registra (sin reserva). Un falso positivo en TIERRA cuesta SD y batería, pero no se pierde un vuelo real |
| FLY ya en BOOST o después, o RECOVERY | Nada |

- **Siempre** queda un `T_MISSION` automático (`op = 0`) con el criterio que disparó (inercial o barométrico) y el `dv` o el salto.
- **Los actuadores por BOOST sin armar** (el pulso de la Pi en Demeter) son de T-413, no de esta tarea.

**Pruebas en el PC** (con `g++`; no hace falta PlatformIO):
- **Positivas:**
  - las sims. de OpenRocket de Demeter y Hermes (`datos/simulaciones/openrocket/`), pasadas a fuerza específica (`|a|` = la aceleración cinemática + 1 g en la vertical), remuestreadas a 1600 Hz, con el ruido del LSM en reposo (σ ≈ 0,01 g);
  - **criterio: BOOST en < 0,2 s desde el despegue** (la referencia de Pablo es dv = 5 m/s a 0,074 y 0,084 s).
- **Negativas (cero detecciones):**
  - golpes de 10 g durante 20 ms;
  - impacto de una caída de 1 m (20 g, 10 ms);
  - sacudida de ±3 g a 5 Hz durante 5 s;
  - 30 min de reposo con ruido.

## 7. Especificación de los actuadores: buzzer y encendido de la Pi (T-413)

Las marcas (P) las fijó el documentador; se pueden ajustar en la revisión del PR.

**Buzzer** (IO46, activo de 5 V por MOSFET: nivel alto = suena):
- **Se enciende solo** al entrar a RECOVERY y al pasar al momento ATERRIZAJE.
- Patrón `BUZZER_ON_MS` / `BUZZER_OFF_MS` = 500 / 1500 ms (P).
- **Se apaga** al pasar a TIERRA (`desarmar`, `estado tierra`), al dormir y con el comando `buzzer off`.
- El comando `buzzer on|off` (`OP_BUZZER`, `arg` 1 o 0) es apto en cualquier estado. Sirve para probar en el banco y para buscar el cohete.

**Encendido de la Pi** (IO45, MOSFET en paralelo a J2 de la Pi; **solo Demeter**):
- **Pulso:** `PI_PULSO_MS` (1500 ms) en alto.
- **Comando `pi encender`** (`OP_PI_POWER`):
  - Mientras no exista la UART con la Pi (T-702), **no se sabe si la Pi está encendida**, y una pulsación podría apagarla. Por eso la respuesta es siempre `NO_APTO` con el motivo nuevo `RZ_PI_DESCONOCIDA`, y solo se ejecuta con la confirmación.
  - En FLY con BOOST, además, `RZ_EN_VUELO`.
  - En Hermes, `RZ_OP` (no aplica).
- **Automático por BOOST sin armar: no se hace** mientras no exista T-702. La Pi se enciende a mano antes de cerrar el cohete, y un pulso automático la apagaría.
- **En Hermes, IO45 queda sin usar:** no hay actuadores mecánicos (D-053).

**`TELEM.actuators`:**
- bit 0: el buzzer está activo (el patrón corre);
- bit 1: el pulso de la Pi está en curso;
- bit 2: se envió algún pulso a la Pi desde el arranque.

## 8. Especificación de la persistencia en vuelo (T-411, D-015 y D-052)

Las marcas (P) las fijó el documentador; se pueden ajustar en la revisión del PR.

**Qué se guarda** (un registro con `magic`, versión y CRC):
- el estado y el momento;
- `s_boosted` y `flags` (`TF_BOOST_SIN_ARMAR`, `TF_FORZADO`);
- los `p0` de cada barómetro y cuál era válido;
- el UTC del BOOST (ms), si había hora;
- el `boot_count`.

**Dónde:**
- en **memoria RTC sin inicializar** (`RTC_NOINIT_ATTR`): sobrevive a reinicios por software, por watchdog y por brownout;
- **y** en NVS (`Preferences`, espacio `tbmis`, el mismo del contador): sobrevive a un corte de energía.
- Al arrancar, primero se lee la RTC (si es válida) y si no, la NVS.

**Cuándo se escribe:** solo en las transiciones:
- al entrar a FLY;
- en cada cambio de momento;
- al entrar a RECOVERY;
- al salir a TIERRA o ARMED, donde se **invalida**.
- Nunca periódicamente: NVS se desgasta.

**Al arrancar con un registro válido:**

| Estado guardado | Qué hace |
| --- | --- |
| FLY | Vuelve a FLY con el mismo momento, `s_boosted` y `p0`; registra (archivo nuevo, sin reserva); 10 Hz; levanta **`TF_REANUDADO`** |
| RECOVERY | Vuelve a RECOVERY: 2 Hz, buzzer (T-413); el registro de `t_post` no se repite; `TF_REANUDADO` |
| Cualquier otro, o registro inválido | Arranque normal en TIERRA |

**Además:**
- Queda un `T_MISSION` automático: `op = 0`, `arg = 3` (reanudado), `from` y `to` = el estado guardado.
- **Para salir de un estado reanudado en el banco:** `estado tierra`, que con BOOST pide confirmación (§2). Eso invalida el registro.
- **D-051:** en esta misma tarea, un comando con `RZ_OP` responde `CR_ERROR` y no se puede confirmar.

**TELEM:** `flags` bit 4 = `TF_REANUDADO` (16). Se mantiene hasta el siguiente reinicio o hasta pasar a TIERRA.
