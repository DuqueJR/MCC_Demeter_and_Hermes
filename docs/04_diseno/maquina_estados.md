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
**Igual para los dos cohetes;** cambian la configuración (`mission_config.h`) y los actuadores (IO45: la Pi en Demeter, actuadores mecánicos en Hermes).

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
| `armar` | TIERRA | ARMED | **Siempre en dos pasos** (`CONFIRMA`, y luego `si`). Antes, sin motivos de "listo": reserva al 100 %, SD bien, LSM y BMP con datos, fix 3D, `vbat ≥ vbat_arm_mv` (3700 mV (P)), `\|a\|` en 1 ± 0,25 g y `\|Vz\| ≤ 2 m/s` |
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
