---
id: C-05
estado: borrador (lo redacta A y lo revisa B; se congela en H0, T-S06). Versión de API 1.
actualizado: 2026-10-25
depende_de: [estacion_terrena, protocolo_paquetes, maquina_estados, requisitos, dos_sesiones_C-03]
---
# C-05. API del back-end de tierra (CLI, comandos, eventos y estado)

**Para qué:**
- que **todas las operaciones críticas** se hagan desde la **CLI** (T-S04), sin depender de la GUI;
- que **la GUI del otro plan** se construya después sobre **la misma API**, sin tocar el back-end.

La CLI es el **primer consumidor** de la API. Así se garantiza que la API alcanza para operar.

## 1. Componentes del servicio de tierra (T-602)

```
módem (C-03) ─► ingesta serie ─► LOG CRUDO (siempre primero) ─► decodificador (protocolo v2)
     ─► estado por cohete ─► cálculos (T-S08) ─► publicador ─┬─► API local (WebSocket + HTTP)
                                                              │      ├─► CLI (T-S04)
                                                              │      └─► GUI (otro plan, fuera de alcance)
                                                              ├─► eventos.jsonl (disco)
                                                              └─► reenviador (por confirmar) ─► ingesta del servidor
comandos: CLI o GUI ─► API local ─► gestor de comandos (reintentos hasta el ACK) ─► TX_PEDIDO (C-03)
```

- **Log crudo:** cada trama C-03 recibida, con la hora del PC, en un archivo de **solo agregar**. Es lo primero que pasa con cada dato.
- **Reprocesamiento:** el servicio puede arrancar **desde un log crudo** en lugar del puerto serie. Sirve para las pruebas, para reproducir un vuelo y para que el otro plan desarrolle la GUI sin hardware.

## 2. Transporte y seguridad

| Punto | Regla |
| --- | --- |
| Dónde escucha | **Solo en `127.0.0.1`** por defecto. Una opción explícita permite escuchar en la red local del portátil, para una segunda pantalla de **solo lectura** |
| Comandos | **Solo se aceptan desde `127.0.0.1`** (GS-14, D-025). El reenviador **nunca** recibe comandos: su conexión es saliente y de solo envío |
| Flujo | WebSocket `ws://127.0.0.1:<API_PUERTO>/v1/flujo`: mensajes JSON (§3) |
| Consultas | HTTP `GET /v1/estado` (la foto actual de todos los cohetes y de la estación) · `GET /v1/historial?cohete=&desde=&hasta=&tipos=` · `GET /v1/go_nogo?cohete=` |
| Comandos | HTTP `POST /v1/comandos` (§4) · `GET /v1/comandos/<id>` |
| Puerto | `API_PUERTO`: una constante nueva que hay que agregar a `constantes.md` ([12](../12_cambios_a_aplicar_en_lo_existente.md)) |
| Versionado | `api_version` en cada mensaje. Agregar campos no rompe la versión; quitar o cambiar un campo **sube la versión y hay que avisar al otro plan** |

## 3. Mensajes (JSON)

Todos los mensajes llevan el mismo sobre:

```json
{ "api_version": 1, "tipo": "estado_cohete", "t_pc_utc_ms": 1793750400000,
  "cohete": "demeter", "origen": 1, "datos": { } }
```

- `cohete` vale `"demeter"` (origen 1), `"hermes"` (origen 2) o `null` (la estación).
- **La GUI usa `cohete` para separar los paneles de Demeter y Hermes.**

| `tipo` | Cuándo | `datos` (principales) |
| --- | --- | --- |
| `estado_cohete` | Cada NAV o STATUS decodificado | `fase` {código, nombre}, `t_ms`, `utc_ms_est`, `lat`, `lon`, `alt_agl_m`, `alt_msl_m`, `vel_enu_ms`, `vz_ms`, `q`, `acc_g`, `bat_pct`, `bat_mv`, `flags` (decodificados), `act` (decodificados), `estado_sec` {código, nombre}, `apogeo_m`, `gnss` {fix, sv, hacc_m}, `fallas` [lista], `calib` [lista], `sync`, `rssi_tierra_dbm`, `boot_count`, `mission_id`, `edad_ms`, **`lkp`** {lat, lon, alt_m, utc_ms} |
| `paquete` | Cada paquete recibido | `tipo_lora`, `seq`, `campos` (decodificados), `rssi_dbm`, `snr_db`, `slot`, `fuera_de_slot` |
| `evento` | Cuando pasa | `clase`: `cambio_fase` · `eyeccion` · `apogeo` · `alarma_descenso` · `enlace_perdido` · `enlace_recuperado` · `reinicio_detectado` (salta `boot_count`) · `reanudado` · `comando` (cambio de estado de un comando) · `lkp_congelada` |
| `enlace` | Cada segundo, por cohete | `paquetes_s`, `perdidos_por_seq`, `rssi_medio`, `snr_medio`, `ultimo_rx_hace_ms` |
| `estacion` | Cada segundo | `modem` (lo que trae `ESTADO_MODEM` de C-03), `posicion` {lat, lon, alt}, `sync`, `internet` (informativo) |
| `calculos` | Cada `estado_cohete` | `distancia_horizontal_m`, `azimut_deg`, `elevacion_deg`, `elipse` {centro, semiejes, rumbo}, `t_al_apogeo_s`, `t_restante_s`, `url_mapa` (`https://www.google.com/maps/search/?api=1&query=LAT,LON`) |
| `go_nogo` | Cada STATUS, y al pedirlo | `global` (bool), `condiciones` [{nombre, ok, valor, umbral}], según [maquina_estados](../../../04_diseno/maquina_estados.md) §4, más las condiciones de tierra (enlace, RSSI) |

**Reglas para la GUI y para la CLI:**
- **La LKP nunca se borra:** `lkp` siempre trae la última posición válida (GS-03). Si se pierde el enlace, `edad_ms` crece y se emite `lkp_congelada`.
- **La alarma de descenso** (GS-05) se evalúa **solo en DESCENT**, con `ALARMA_DESCENSO_MS` (la decisión sobre PEN-20 sigue abierta).

**Vectores de prueba:** en `tools/vectores/api/`, mensajes `.jsonl` esperados para un vuelo sintético conocido.

## 4. Comandos

**Pedido:**

```json
POST /v1/comandos
{ "cohete": "hermes", "cmd": "ARM", "args": [], "confirmar": true }
```

- `cmd` es el nombre de la tabla de comandos de [protocolo](../../../04_diseno/protocolo_paquetes.md) §5.
- `cohete` vale `demeter`, `hermes` o `todos` (`todos` solo para `PING`).
- **`confirmar: true` es obligatorio** para `ARM`, `DISARM`, `FORZAR_ATERRIZADO`, `SET_CANAL` y `PI_ENCENDER`.

**Respuesta:** `{ "id": "...", "cmd_seq": 17, "estado": "en_cola" }`.

**Estados del comando** (se publican como `evento` de clase `comando`):

`en_cola` → `enviado` (con el número de intento) → `confirmado` (el `resultado` del ACK: 0 OK, 1 fase, 2 condiciones, 3 desconocido, 4 argumento) **o** `sin_confirmacion` (después de `CMD_REINTENTOS_MAX`).

**El servicio rechaza** antes de enviar:
- un comando que no corresponde a la última fase conocida;
- un `SET_CANAL` si algún cohete está en ARMED o más adelante.

## 5. CLI del operador (T-S04)

Es una consola de texto. **No es GUI.** Todas las operaciones críticas se hacen aquí.

| Orden | Hace |
| --- | --- |
| `estado [cohete]` | La foto de los dos cohetes (o de uno): fase, altitud, Vz, batería, GNSS, RSSI, edad del último paquete, LKP |
| `seguir [cohete]` | Vista de texto que se actualiza sola |
| `go [cohete]` | Lista del Go/No-Go con cada condición |
| `arm <cohete>` · `disarm <cohete>` | Pide confirmación escribiendo el nombre del cohete |
| `forzar-aterrizado <cohete>` | Ídem |
| `ping [cohete\|todos]` · `check <cohete>` · `recalibrar <cohete>` | |
| `pi encender` · `pi grabar on\|off` | Solo Demeter |
| `wifi <cohete> on\|off` · `backfill <cohete> on\|off` · `buzzer <cohete> on\|off` | |
| `lkp [cohete]` | La última posición, la distancia, el azimut y la URL del mapa |
| `canal <idx>` | Solo en PREFLIGHT, con la confirmación de los dos cohetes |

**Regla:** cada comando muestra su estado hasta `confirmado` o `sin_confirmacion`. **Nunca se da por hecho un comando sin el ACK.**

## 6. Interfaces para la GUI (fuera de alcance)

**El otro plan diseña las pantallas.** Lo que el back-end le **ofrece**, y que no cambia sin subir `api_version`:
- **el flujo** de §3, con todos los tipos, etiquetados por `cohete`, para los paneles de Demeter y Hermes;
- **las consultas** `estado`, `historial` y `go_nogo`;
- **los comandos** de §4, que **solo funcionan en el portátil de la estación**;
- **el reprocesamiento** de un log crudo, para desarrollar sin hardware;
- **para la web pública:** el reenviador (por confirmar) manda un subconjunto de solo lectura (`estado_cohete`, `evento`, `calculos`) al servidor. **Desde internet no se manda ningún comando.**

**Lo que la GUI deberá hacer y el back-end NO hace:** la vista 3D, los mapas, las gráficas, la interpolación visual, el QR como imagen, las alertas visuales.
