---
id: gui_contrato_datos
estado: **contrato.** Preguntas de T-611 cerradas el 2026-10-25 (D-W18); queda congelado al integrar el PR #7 con la aprobación de Jerónimo.
version: web-1
actualizado: 2026-10-25
depende_de: [protocolo_paquetes, maquina_estados, estacion_terrena, constantes]
lo_usan: [web pública, dashboard de operación (09), servicio de tierra y CLI (C-05, DP-17)]
---
# Contrato de datos de la web (`web-1`)

Es el JSON que el **servicio de tierra** produce (decodificado y calculado), que el **reenviador** sube, que el **relay** difunde y que la **web** muestra.
**Es el único formato de salida del servicio de tierra** (DP-17 del back, [C-05](../05_plan/dos_sesiones/06_contratos/05_api_backend_tierra.md)): lo consumen igual la web pública, el dashboard de operación y la CLI. La lógica se escribe una sola vez.
- **Este documento lo mantiene el plan web.** El back propone los cambios (como hizo con PA-15 y PA-22) y no lo edita.
- **Lo que no está aquí** (comandos, paquetes crudos, diagnóstico) vive en las extensiones `/api/v1/local/` de C-05 §3. **Nunca se reenvía a internet.**

**Cambios aceptados del back** (el 2026-10-25, antes de congelar; son compatibles):
- **PA-15:** `meta.proto_version` es `2` o `3`. Con el protocolo v3 (DP-07), `salud` trae `fw_version`.
- **PA-22:** `estado.lkp`, la última posición **válida**. Así el cliente no tiene que buscarla en la `serie`.

## 0. Reglas

- **JSON UTF-8, unidades SI con decimales.** La escala de los enteros de LoRa se deshace en la estación: la web nunca ve `alt_dm` ni `q × 32767`.
- **Precisión:**
  - lat y lon, con 7 decimales;
  - metros, con 1 decimal;
  - m/s, con 2;
  - g, con 3;
  - grados, con 1.
- **`null` = sin dato.** Corresponde a los valores reservados de [protocolo_paquetes](../04_diseno/protocolo_paquetes.md) §0. Un campo nunca se omite: está o es `null`.
- **Qué campos pueden ser `null`** (D-W18). Todos los demás son obligatorios y nunca `null`.
  - `estado`: `utc_ms`, `relay_utc_ms` (siempre `null` en el servicio local, que no tiene relay), `pos` completo, `pos.alt_msl_m`, `bat_pct`, `secundario`, cada `calc.*`, cada `enlace.*` y `lkp`.
  - `salud`: las lecturas de los sensores y los contadores que el cohete no reporte (por ejemplo `temp_pi_c` en Hermes y `fw_version` con el protocolo v2).
  - `estacion`: `pos`, sin GNSS, y `ultimo_paquete_hace_ms`, mientras no haya llegado ningún paquete del cohete.
  - `evento`: `valor`, `fase` y `activa` (§2.5).
  - Snapshot: `estado`, `salud`, `estacion` y `backfill` (§3). `meta` nunca es `null`.
- **El esquema es estricto** (`additionalProperties: false`, en `gui/web/src/contrato/esquema.json`). Con él se prueban los que producen datos: el generador de T-612, el servicio de tierra y la ingesta del relay. La web no valida en tiempo de ejecución. **Un campo opcional nuevo se agrega en el mismo PR a este documento, al esquema y a los tipos.**
- **Lo que el esquema no expresa** lo comprueba `src/contrato/validacion_extra.ts` en las pruebas:
  - las 8 columnas de la `serie` con el mismo largo y como máximo `WEB_SERIE_MAX_PUNTOS`;
  - `mision` ↔ `nodo`;
  - `fase` ↔ `fase_cod`.
- **Tiempos:**
  - `t_ms`: el reloj del cohete;
  - `utc_ms`: la hora UTC estimada por el cohete (ya convertida con STATUS);
  - `rx_utc_ms`: la hora en que lo recibió la estación;
  - `relay_utc_ms`: la hora en que lo emitió el relay.
- **La edad de un dato no se calcula con el reloj del celular**, que puede estar mal. Sale de `estacion.ultimo_paquete_hace_ms` más el tiempo transcurrido localmente desde que llegó ese mensaje (§4.4).
- **Versionado:**
  - `contrato_version` es `"web-1"`;
  - agregar un campo opcional es compatible;
  - cambiar o quitar un campo exige `"web-2"` y una decisión D-W.
- **Misiones:** `"demeter"` (nodo 1) y `"hermes"` (nodo 2). **Cada stream y cada snapshot son de una sola misión** (D-W01).

## 1. Transporte

- **Stream** (`GET /api/v1/{mision}/stream`, SSE):
  - cada mensaje es un evento SSE con `id`, `event: <tipo>` y `data: <JSON>`;
  - **`id` es un contador creciente por misión del que emite el SSE** (D-W18): `seq_relay` en el relay y `seq` en el servicio local (C-05). La web lo trata como opaco y solo lo devuelve en `Last-Event-ID` para reanudar.
- **Snapshot** (`GET /api/v1/{mision}/snapshot`): §3.
- **Ingesta** (`POST /api/v1/ingesta`, solo el reenviador): `{"mensajes": [ {"tipo": "...", "mision": "...", "datos": {...}} ]}`.

## 2. Mensajes del stream

### 2.1 `meta`: al conectar y cuando cambie

```json
{ "contrato_version": "web-1", "mision": "demeter", "nodo": 1,
  "modo": "vivo",                       // "vivo" | "simulacion" | "sintetico"
  "mission_id": 1793980800,             // STATUS.mission_id; null antes de ARM
  "proto_version": 3,                   // 2 o 3 (PA-15; v3 = STATUS con fw_version, DP-07)
  "sitio": { "lat": 6.582, "lon": -75.823, "alt_msl_m": 510.0 } }
```

### 2.2 `estado`: con cada NAV recibido (en vuelo, unos 9 Hz; en tierra, el relay lo baja a 1 Hz)

```json
{ "seq": 41, "t_ms": 1234567, "utc_ms": 1793981012345, "rx_utc_ms": 1793981012360, "relay_utc_ms": 1793981012410,
  "fase": "DESCENT", "fase_cod": 7,
  "pos": { "lat": 6.5823456, "lon": -75.8231234, "alt_agl_m": 312.4, "alt_msl_m": 822.4, "fuente": "ekf" },
  "vel": { "n_ms": 0.42, "e_ms": -1.10, "u_ms": -9.21, "total_ms": 9.29 },
  "acc_g": { "x": 1.012, "y": 0.031, "z": -0.020 },
  "q": { "w": 0.998, "x": 0.012, "y": -0.051, "z": 0.020 },
  "flags": { "gnss_fix": true, "ekf_ok": true, "falla_activa": false, "eyeccion": true,
             "apogeo": true, "log_activo": true, "reanudado": false },
  "act": { "pi_pulso": true, "cam_ok": true, "buzzer": false, "wifi_ap": false, "backfill": false },
  "bat_pct": 87,
  "secundario": { "codigo": 12, "texto": "Grabando" },
  "calc": { "dist_horiz_m": 842.3, "azimut_deg": 271.4, "elevacion_deg": 20.3,
            "elipse": { "lat": 6.5830, "lon": -75.8302, "semieje_mayor_m": 120.0, "semieje_menor_m": 60.0, "rumbo_deg": 270.0 },
            "t_a_apogeo_s": null, "t_restante_s": 33.9, "siguiente_fase": "LANDED", "t_siguiente_fase_s": 33.9 },
  "enlace": { "rssi_dbm": -97, "snr_db": 6.5, "perdidos_pct_10s": 3.0 },
  "alarmas": { "descenso_rapido": false },
  "lkp": { "lat": 6.5823456, "lon": -75.8231234, "alt_agl_m": 312.4, "utc_ms": 1793981012345 } }
```

| Campo | Sale de | Notas |
| --- | --- | --- |
| `seq`, `t_ms` | NAV cabecera `seq`, `t_ms` | |
| `utc_ms` | `t_ms` convertido con el último STATUS (`utc_ms` frente a `t_ms`) | `null` si no hay hora válida |
| `fase`, `fase_cod` | NAV `fase` | Nombres de [maquina_estados](../04_diseno/maquina_estados.md) §1 |
| `pos.lat/lon` | NAV `lat_e7`, `lon_e7` / 1e7 | `fuente`: `"ekf"` si `flags.EKF_OK`, si no `"gnss"` |
| `pos.alt_agl_m` | NAV `alt_dm` / 10 | |
| `pos.alt_msl_m` | `alt_agl_m` + STATUS `alt_origen_msl_dm` / 10 | |
| `vel.*` | NAV `vel_n/e/u_cms` / 100 | `total_ms` = norma |
| `acc_g.*` | NAV `acc_x/y/z_mg` / 1000 | El marco del cuerpo, promedio de 100 ms |
| `q.*` | NAV `q_*` / 32767 | Del cuerpo a ENU. Con esto la web calcula roll, pitch y yaw. |
| `flags.*`, `act.*` | NAV `flags`, `act` (bit a bit) | |
| `bat_pct` | NAV `bat_pct` | `0xFF` → `null` |
| `secundario` | NAV `estado_sec` | Deméter: `StatusCode` de la Pi y su texto en español ([visionpack_integracion](../04_diseno/visionpack_integracion.md)). `0xFE` → `{"codigo":254,"texto":"Sin respuesta"}`. Hermes: `null`. |
| `calc.*` | **Lo calcula el servicio de tierra** (*Objetivos* §6) | Distancia, azimut y elevación en WGS84 desde la estación. La elipse, con la tasa de descenso. Los tiempos estimados son GS-13. `null` si no aplica. |
| `enlace.*` | El módem (RSSI y SNR de cada paquete) y el servicio (pérdidas por `seq`) | |
| `alarmas.descenso_rapido` | El servicio de tierra: solo en DESCENT, con `ALARMA_DESCENSO_MS` de [constantes](../02_requisitos/constantes.md) | La web no recalcula la alarma: la muestra |
| `lkp` (opcional, PA-22) | El servicio de tierra: la última `pos` con fix válido | `null` si nunca hubo posición. Si `pos` llega en `null`, la web dibuja el LKP con esto (GS-03). |

### 2.3 `salud`: con cada STATUS (1 Hz)

```json
{ "t_ms": 1234000, "utc_ms": 1793981011778, "mission_id": 1793980800, "boot_count": 3,
  "gnss": { "fix": 3, "sv": 11, "hacc_m": 1.8 },
  "bat_mv": 3980, "temp_esp_c": 41, "temp_pi_c": 55,
  "fallas": [], "fallas_bits": 0,
  "calib": { "giro": true, "mag": true, "baro": true, "origen": true, "actitud": true },
  "nav_innov_m": 0.84, "apogeo_m": 669.1, "alt_origen_msl_m": 510.0, "sd_libre_mb": 28100,
  "rssi_tierra_dbm": -88, "ultimo_cmd_seq": 7,
  "go_nogo": { "listo": true, "condiciones": [ { "id": "gnss", "nombre": "Satélites y precisión", "ok": true } ] } }
```

- `fallas`: los **nombres** de los bits activos, como en protocolo §3: `"LSM6DSO32"`, `"BMP581"`, …, `"EKF divergente"`, `"UART del VisionPack"`, `"Batería baja"`. Se acompaña de `fallas_bits`.
- `go_nogo`: lo evalúa el servicio de tierra con las condiciones de [maquina_estados](../04_diseno/maquina_estados.md) §4. Es el "checklist automático" de *Objetivos* 7.C.
- `temp_pi_c` es `null` en Hermes.
- `fw_version` (opcional, PA-15): el hash corto de git del firmware, como texto (`"a1b2c3d"`). Viene en STATUS desde el protocolo v3 (DP-07); `null` con el protocolo v2.

### 2.4 `estacion`: latido a 1 Hz, aunque no llegue nada del cohete

```json
{ "utc_ms": 1793981012500, "pos": { "lat": 6.5790, "lon": -75.8150, "alt_msl_m": 505.0 },
  "gnss_ok": true, "ultimo_paquete_hace_ms": 230 }
```

- Con `ultimo_paquete_hace_ms`, la web decide si está en vivo, con señal débil o sin señal (LKP) ([03_experiencia_y_pantallas](03_experiencia_y_pantallas.md) §4).
- **Si el latido deja de llegar**, el problema es del relay o del internet, no del cohete.
- `ultimo_paquete_hace_ms` es `null` mientras no haya llegado ningún paquete del cohete, y `pos` es `null` sin GNSS.
- El latido es de la estación, no de una misión: **cada stream de misión lleva una copia del mismo latido**, sin campo de misión (D-W18).

### 2.5 `evento`: hechos puntuales, que la web usa para la línea de fases y los objetivos

```json
{ "tipo": "apogeo", "t_ms": 1245900, "utc_ms": 1793981023678, "t_mas_s": 11.54, "valor": 669.1 }
```

- **Tipos:** `despegue` (fase → BOOST), `fin_combustion` (→ COAST), `eyeccion` (`flags.eyeccion` pasa a 1), `apogeo` (`flags.apogeo` pasa a 1, `valor` = altitud), `fase` (todo cambio de fase, con `fase`), `aterrizaje` (→ LANDED), `alarma_descenso` (`valor` = Vz, con `activa` true o false), `camaras` (`act.cam_ok` cambia; solo Deméter).
- **`t_mas_s`** es el tiempo desde el despegue (T+), que calcula el servicio de tierra.
- **`fase` y `activa` van siempre presentes** (D-W18). `fase` tiene valor solo en el tipo `fase`, y `activa` solo en `alarma_descenso`; en los demás tipos son `null`. `valor` es `null` cuando el tipo no lo usa.

### 2.6 `backfill`

```json
{ "activo": true, "recibidos": 534, "esperados": 850, "progreso": 0.63, "completo": false }
```

- Al llegar `completo: true`, la web vuelve a pedir el `snapshot`, que ya trae la trayectoria completa.
- Si además existe el vuelo de resolución completa (volcado por Wi-Fi), el snapshot trae `vuelo_completo_url`.

## 3. Snapshot

```json
{ "meta": { }, "estado": { }, "salud": { }, "estacion": { },
  "eventos": [ { } ],
  "serie": { "t_mas_s": [], "lat": [], "lon": [], "alt_agl_m": [], "vz_ms": [], "acc_x_g": [], "acc_y_g": [], "acc_z_g": [] },
  "backfill": { }, "vuelo_completo_url": null }
```

- La `serie` va **en columnas**, para ahorrar bytes. Se decima a un máximo de `WEB_SERIE_MAX_PUNTOS` (2000 (P)): en vuelo se conserva toda la resolución, y la espera en tierra se decima.
- Si la misión no ha empezado, lo que no existe es `null` y las listas van vacías.

## 4. Lo que hace la web con esto

1. Al abrir, pide el **snapshot** y dibuja con eso.
2. Abre el **stream** y agrega cada mensaje.
3. Interpola entre los `estado` para dibujar (03 §5).
4. Calcula la edad: `edad = ultimo_paquete_hace_ms + (ahora_local − llegada_local_del_latido)`.
5. Calcula roll, pitch y yaw del cuaternión (la única cuenta propia, además de la interpolación).

## 5. Datos de ejemplo

- `gui/web/dev/datos/{demeter,hermes}_*.jsonl`: una línea por mensaje del stream, `{"t_rel_ms": 0, "evento": "estado", "datos": {...}}`.
- Los genera `tools/web_datos/` desde OpenRocket (04 §7). Se validan contra `src/contrato/esquema.json` en las pruebas.
- **Escenarios mínimos** (T-612):
  - `nominal`;
  - `lkp_descenso` (se corta la señal a 120 m);
  - `descenso_rapido` (se activa la alarma);
  - `backfill`;
  - `espera_rampa` (30 min en PREFLIGHT a 1 Hz, para probar el consumo);
  - `relay_caido`.
