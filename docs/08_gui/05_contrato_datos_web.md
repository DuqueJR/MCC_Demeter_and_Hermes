---
id: gui_contrato_datos
estado: propuesta. **Es un contrato:** se congela al cerrar W0 (T-611) con el visto bueno de Juan Pablo y Jerónimo.
version: web-1
actualizado: 2026-10-25
depende_de: [protocolo_paquetes, maquina_estados, estacion_terrena, constantes]
---
# Contrato de datos de la web (`web-1`)

Es el JSON que el **servicio de tierra** produce (decodificado y calculado), que el **reenviador** sube, que el **relay** difunde y que la **web** muestra.
Conviene que sea **el mismo que usa el dashboard local** (estacion_terrena §2.4), para escribir la lógica una sola vez.

## 0. Reglas

- **JSON UTF-8, unidades SI con decimales.** La escala de los enteros de LoRa se deshace en la estación: la web nunca ve `alt_dm` ni `q × 32767`.
- **Precisión:**
  - lat y lon, con 7 decimales;
  - metros, con 1 decimal;
  - m/s, con 2;
  - g, con 3;
  - grados, con 1.
- **`null` = sin dato.** Corresponde a los valores reservados de [protocolo_paquetes](../04_diseno/protocolo_paquetes.md) §0. Un campo nunca se omite: está o es `null`.
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
  - cada mensaje es un evento SSE con `id: <seq_relay>`, `event: <tipo>` y `data: <JSON>`;
  - `seq_relay` es creciente por misión, para reanudar con `Last-Event-ID`.
- **Snapshot** (`GET /api/v1/{mision}/snapshot`): §3.
- **Ingesta** (`POST /api/v1/ingesta`, solo el reenviador): `{"mensajes": [ {"tipo": "...", "mision": "...", "datos": {...}} ]}`.

## 2. Mensajes del stream

### 2.1 `meta`: al conectar y cuando cambie

```json
{ "contrato_version": "web-1", "mision": "demeter", "nodo": 1,
  "modo": "vivo",                       // "vivo" | "simulacion" | "sintetico"
  "mission_id": 1793980800,             // STATUS.mission_id; null antes de ARM
  "proto_version": 2,
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
  "alarmas": { "descenso_rapido": false } }
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

### 2.4 `estacion`: latido a 1 Hz, aunque no llegue nada del cohete

```json
{ "utc_ms": 1793981012500, "pos": { "lat": 6.5790, "lon": -75.8150, "alt_msl_m": 505.0 },
  "gnss_ok": true, "ultimo_paquete_hace_ms": 230 }
```

- Con `ultimo_paquete_hace_ms`, la web decide si está en vivo, con señal débil o sin señal (LKP) ([03_experiencia_y_pantallas](03_experiencia_y_pantallas.md) §4).
- **Si el latido deja de llegar**, el problema es del relay o del internet, no del cohete.

### 2.5 `evento`: hechos puntuales, que la web usa para la línea de fases y los objetivos

```json
{ "tipo": "apogeo", "t_ms": 1245900, "utc_ms": 1793981023678, "t_mas_s": 11.54, "valor": 669.1 }
```

- **Tipos:** `despegue` (fase → BOOST), `fin_combustion` (→ COAST), `eyeccion` (`flags.eyeccion` pasa a 1), `apogeo` (`flags.apogeo` pasa a 1, `valor` = altitud), `fase` (todo cambio de fase, con `fase`), `aterrizaje` (→ LANDED), `alarma_descenso` (`valor` = Vz, con `activa` true o false), `camaras` (`act.cam_ok` cambia; solo Deméter).
- **`t_mas_s`** es el tiempo desde el despegue (T+), que calcula el servicio de tierra.

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
