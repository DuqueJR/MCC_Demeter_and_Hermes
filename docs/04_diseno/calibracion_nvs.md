---
id: calibracion_nvs
estado: propuesta (2026-11-05), para decidir con Pablo. Sin código.
actualizado: 2026-11-05
depende_de: [protocolo_paquetes, enlace_lora_tdma, maquina_estados]
decisiones: [D-057, D-058]
---
# Calibración por LoRa a la NVS del cohete

Pablo decidió (D-057) que la calibración viaje al cohete por LoRa y se guarde en NVS, en vez de compilarse en el firmware. Este documento propone cómo hacerlo con lo que ya existe: TDMA, comandos firmados, confirmación en dos pasos y respuestas en lugar de TELEM.

## 1. Qué viaja

Un **blob binario** con secciones (tipo, largo, datos), así se puede mandar todo o solo una parte (por ejemplo, solo la temperatura). Todos los números van en `float32`, little endian.

| Sección | Id | Contenido (de `calib.py`, salvo donde se dice) | Floats |
| --- | --- | --- | --- |
| LSM6DSO32 | 1 | `R` (9), `sesgo_g` (3), `escala` (3) | 15 |
| QMI8658 | 2 | `R` (9), `sesgo_g` (3), `escala` (3), `ganancia_giro` (3), `retraso_ms` (1) | 19 |
| MMC5983MA | 3 | `centro` (3), `A` (9), `R` (9), `radio_G` (1) | 22 |
| QMC6309 | 4 | igual que el MMC | 22 |
| EKF | 5 | factor de escala del giro inicial (3) y su sigma (1); declinación (1) e inclinación esperada (1) del sitio | 6 |
| Temperatura | 6 | temperatura del suelo puesta a mano (1) y su vigencia en horas (1): la muestra `F_MANO` de D-058 | 2 |
| Misión | 7 | reservado: tiempos de fallback, masas, alturas (las condiciones de misión del dashboard) | — |

**Cabecera** (12 B): `'C' 'A' 'L' '1'`, versión del formato, `rocket_id`, largo total (u16) y hora UTC de la calibración (u32, s).

**Al final:** un CRC32 de todo el blob.

**Tamaño con todas las secciones (1 a 6):** unos 86 floats, más la cabecera y las secciones, unos **370 B**.

## 2. Cómo viaja

### Restricción del enlace

- El cohete escucha cada ranura de tierra de −6 a +24 ms (`RX_OPEN_US`, `RX_CLOSE_US`). Eso alcanza para paquetes de tierra de **hasta 32 B**.
- Tierra tiene 4 ranuras de comandos por segundo (5, 10, 15 y 20), compartidas entre los dos cohetes.
- Una respuesta del cohete reemplaza a un TELEM en sus ranuras propias. En TIERRA son 2 por segundo.

### Paquete nuevo: `CAL_BLK` (32 B, tierra → un cohete)

| Byte | Campo | Contenido |
| --- | --- | --- |
| 0 | `type` | 7 |
| 1 | `target` | Demeter o Hermes |
| 2 | `ses` | Sesión de carga: la abre `cal inicio` |
| 3 | `idx` | Número de bloque (0 a 31) |
| 4 | `data` | 20 B del blob |
| 24 | `tag` | HMAC-SHA256 truncado a 8 B de los 24 B anteriores, con la misma clave de los comandos |

- 370 B son **19 bloques**. Mandados uno por ranura de tierra, unos 5 s; con reintentos, menos de 10 s.

### Comandos nuevos (CMD de 20 B, firmados y con contador, como hoy)

| Orden en tierra | Op | Qué hace | Respuesta (`CmdResp`) |
| --- | --- | --- | --- |
| `<d\|h> cal inicio` | `OP_CAL_INICIO` | Abre una sesión: `arg` = `ses`; `reasons` = largo del blob y número de bloques. Borra lo recibido antes | OK, o no apto si no está en TIERRA |
| (bloques `CAL_BLK`) | — | Sin respuesta, para no gastar ranuras: el cohete los guarda en RAM | — |
| `<d\|h> cal estado` | `OP_CAL_ESTADO` | Pregunta qué bloques llegaron | `reasons` = mapa de bits de los bloques recibidos; `last_counter` = CRC32 del blob activo en NVS (0 = ninguno) |
| `<d\|h> cal aplicar` | `OP_CAL_APLICAR` | Comprueba el blob (CRC32, cabecera, rangos) y lo escribe en NVS. **Siempre en dos pasos** (como `armar`): responde CONFIRMA con los motivos y espera `si` | OK y el nuevo CRC32, o no apto con los motivos |
| `<d\|h> cal anterior` | `OP_CAL_ANTERIOR` | Vuelve a la calibración anterior (ranura B de la NVS) | OK y el CRC32 activo |

- **Flujo:** `inicio` → todos los bloques seguidos → `estado` → reenviar los que falten → `estado` → `aplicar` → `si`.
- Lo hace el dashboard de control solo, con un botón **"Enviar al cohete"** en la pestaña Calibración.

### Comprobaciones antes de aplicar (motivos de no apto)

- No está en TIERRA (en ARMED, FLY o RECOVERY nunca se cambia la calibración).
- Faltan bloques, el CRC32 no coincide, la cabecera es de otro cohete o de otra versión.
- **Rangos:**
  - cada `R` es una rotación (ortonormal, determinante ±1; el MMC puede tener −1, ver CLAUDE.local);
  - las escalas entre 0.9 y 1.1;
  - los sesgos del acelerómetro de menos de 0.2 g;
  - el factor de escala del giro de menos de 5 %;
  - `radio_G` entre 0.15 y 0.8;
  - la temperatura entre −10 y 50 °C.

## 3. En el cohete

- **NVS** (`tbcal`):
  - dos ranuras, `a` y `b`, más `act` (cuál está activa);
  - `aplicar` escribe en la inactiva, la verifica leyéndola de vuelta y solo entonces cambia `act`;
  - así un corte de energía a mitad de la escritura no deja el cohete sin calibración.
- **Arranque:** carga la activa. Si no es válida, la otra. Si ninguna lo es, queda "sin calibración": identidad, y un aviso.
- **Uso:** una copia en RAM que solo cambia en TIERRA. Los consumidores son el EKF a bordo (cuando exista) y la temperatura del suelo (sección 6, D-058).
- **Registro:** un `T_MISSION` automático con el CRC32 de la calibración aplicada, y el CRC32 activo en el `FILEHDR` de cada archivo. Con eso cada log dice con qué calibración voló.
- **Telemetría:** el CRC16 del blob activo en el paquete `AMB` (2 B más: 20 B). El dashboard lo compara con el archivo `calib_<cohete>.json` y muestra "a bordo: igual, distinta o ninguna".

## 4. En tierra

- **El firmware de tierra** recibe el blob del PC por USB, en líneas de texto:
  - `cal <d|h> <idx> <hex de 20 B>`;
  - `cal <d|h> fin <largo>`.
- Tierra lo guarda en RAM, firma cada bloque y lo transmite en sus ranuras de comandos, intercalado con los comandos normales, que tienen prioridad.
- **El dashboard** (`estacion/cal_blob.py`, nuevo):
  - arma el blob desde `calib_<cohete>.json` y las condiciones de misión;
  - lleva el flujo inicio → bloques → estado → reenvíos → aplicar;
  - muestra el progreso.
  - La confirmación de `aplicar` la da el operador, como en ARM.

## 5. Decisiones que faltan (Pablo)

1. **Tamaño del bloque:** 32 B, sin tocar el TDMA (propuesto), o ampliar la ventana de recepción solo en TIERRA para bloques de 64 B. Eso es la mitad del tiempo de carga, pero cambia el TDMA.
2. **Secciones:**
   - ¿van todas las de la tabla?
   - ¿entra ya la sección de misión (fallbacks, masas)?
   - ¿la declinación y la inclinación del sitio se dan a mano o salen de la calibración?
3. **Sin calibración a bordo:** ¿ARM sale no apto con un motivo nuevo (se puede forzar), o solo aviso?
4. **Identificación:** CRC16 en `AMB` (+2 B), o solo por `cal estado`.
