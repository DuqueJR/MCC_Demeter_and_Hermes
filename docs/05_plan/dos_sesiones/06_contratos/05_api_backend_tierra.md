---
id: C-05
estado: borrador v2 (lo redacta A y lo revisa B). Se alinea con el contrato web-1 del plan web; se congela en H0 (T-S06), el mismo día que web-1 (T-611 del plan web).
actualizado: 2026-10-25
depende_de: [estacion_terrena, protocolo_paquetes, maquina_estados, requisitos, dos_sesiones_C-03, gui_contrato_datos (web-1)]
---
# C-05. API del back-end de tierra (alineada con `web-1`)

**Para qué:**
- que **todas las operaciones críticas** se hagan desde la **CLI** (T-S04), sin depender de la GUI (DP-15);
- que el servicio de tierra produzca **un único formato de datos**, el contrato **`web-1`** del plan web, que consumen igual la web pública, el dashboard local (los dos del otro plan) y nuestra CLI. Así la lógica se escribe una sola vez (DP-17).

## 0. Relación con `web-1`

- **`web-1` lo define el plan web** en `docs/08_gui/05_contrato_datos_web.md`. Hoy está en la rama `docs/plan-web` y todavía no está en `develop`.
- **Este contrato no lo copia ni lo modifica:** lo **adopta** como el modelo de salida del servicio de tierra. Eso incluye:
  - los mensajes `meta`, `estado`, `salud`, `estacion`, `evento` y `backfill`;
  - el `snapshot`;
  - las reglas de unidades, precisión, `null` y tiempos;
  - el versionado.
- **Lo que este contrato agrega** es solo lo que `web-1` no cubre, porque la web no lo necesita o porque nunca debe llegar a internet:
  1. el servicio local que **produce** `web-1` (§1);
  2. las rutas locales de lectura, **idénticas a las del relay** (§2);
  3. las **extensiones locales**: comandos, paquetes crudos y diagnóstico, que **nunca se reenvían** (§3, §4);
  4. la CLI (§5);
  5. el reenviador (§6).
- **Quién responde por qué:**
  - **los cálculos de `web-1`** (`calc`, `go_nogo`, `alarmas`, `enlace`, `t_mas_s`, la `serie` del snapshot): el servicio de tierra, es decir, nosotros (T-602 y T-S08);
  - **la ingesta pública, el relay y las pantallas**: el plan web.
- **Cambios en `web-1`:** si nos hace falta uno, se le **propone al plan web** (su regla: agregar un campo opcional es compatible; cambiar uno exige `web-2`). No se edita su documento.

## 1. Servicio de tierra (T-602): de C-03 a `web-1`

```
módem (C-03) ─► ingesta serie ─► LOG CRUDO (siempre primero) ─► decodificador (protocolo v2/v3)
   ─► estado por misión ─► cálculos (T-S08) ─► mensajes web-1 por misión ─┬─► API local (§2): CLI, dashboard local
                                                                          ├─► web1_<mision>.jsonl en disco
                                                                          └─► reenviador (§6) ─► relay del plan web
   extensiones locales (§3) ─► /api/v1/local/* (solo en el portátil; nunca se reenvían)
comandos: CLI o dashboard local ─► POST /api/v1/local/comandos ─► gestor (reintentos hasta el ACK) ─► TX_PEDIDO (C-03)
```

**Equivalencias entre el protocolo LoRa y `web-1`** (el detalle campo por campo está en la tabla de `web-1` §2.2–§2.3):

| Entra | Sale en `web-1` |
| --- | --- |
| Cada NAV | Un `estado`, con `calc`, `enlace` y `alarmas` calculados aquí |
| Cada STATUS | Un `salud`, con `go_nogo` evaluado aquí según [maquina_estados](../../../04_diseno/maquina_estados.md) §4 |
| `ESTADO_MODEM` (C-03) a 1 Hz | Un `estacion`, en cada flujo de misión, aunque no llegue nada del cohete |
| Cambios de fase y de flags | Un `evento` (`despegue`, `fin_combustion`, `eyeccion`, `apogeo`, `fase`, `aterrizaje`, `alarma_descenso`, `camaras`), con `t_mas_s` |
| Los BACKFILL recibidos | Un `backfill` con el progreso; al completarse, el `snapshot` trae la trayectoria completa |
| Al arrancar, al cambiar `mission_id` y al cambiar `proto_version` | Un `meta`. **`proto_version` = 3 cuando se aplique DP-07** (hay que avisarle al plan web) |

**Reglas que se cumplen aquí:**
- **La LKP nunca se borra (GS-03):** el `snapshot` siempre conserva el último `estado` con posición válida, y la `serie` toda la trayectoria. Si un `estado` llega con `pos` en `null` (sin fix), se publica tal cual, como pide `web-1`. Ver la propuesta de [PA-22](../11_preguntas_abiertas.md).
- **La alarma de descenso (GS-05):** solo en DESCENT, con `ALARMA_DESCENSO_MS`. La web la muestra; no la recalcula.
- **Reprocesamiento:** el servicio puede arrancar **desde un log crudo** en lugar del puerto serie, y emite exactamente los mismos mensajes `web-1`. Sirve para nuestras pruebas y para que el plan web valide la integración (su T-641) sin hardware.

## 2. Rutas locales de lectura (las mismas del relay)

- **Dónde escucha:** en `127.0.0.1:<API_PUERTO>`. La constante nueva va a [12](../12_cambios_a_aplicar_en_lo_existente.md).
- **Las rutas de lectura son las mismas del relay de `web-1`.** Por eso el dashboard local y la web pueden apuntar al servicio local o al relay **cambiando solo la URL base**.

| Ruta | Contenido |
| --- | --- |
| `GET /api/v1/{mision}/snapshot` | El `snapshot` de `web-1` §3. `mision` es `demeter` o `hermes` |
| `GET /api/v1/{mision}/stream` | SSE con los mensajes de `web-1` §2, con `id: <seq>` y `Last-Event-ID`. **A diferencia del relay, en local no hay que bajar a 1 Hz en tierra:** sale todo lo que llega |
| `GET /api/v1/salud` | Salud del servicio (puerto serie, módem, disco, reenviador) |

- **Opción para una segunda pantalla de solo lectura** en la red local del portátil: abre **solo** estas rutas, nunca las de §3.

## 3. Extensiones locales (`/api/v1/local/…`; solo en `127.0.0.1`, nunca se reenvían)

| Ruta | Contenido |
| --- | --- |
| `POST /api/v1/local/comandos` | Pedido de comando (§4) |
| `GET /api/v1/local/comandos/{id}` | Estado de un comando |
| `GET /api/v1/local/stream` | SSE de **los dos cohetes** con los mensajes locales: `comando` (cambios de estado de un comando), `paquete` (cada paquete decodificado con su RSSI, SNR, slot y la marca `fuera_de_slot`), `modem` (todo `ESTADO_MODEM`, incluidos los contadores de errores), `diagnostico` (salto de `boot_count`, `REANUDADO`, pérdidas por `seq`, paquetes inválidos) |
| `GET /api/v1/local/historial?mision=&desde=&hasta=&tipos=` | Lectura del log decodificado, para el análisis en el campo |

- **Mismo sobre en todos los mensajes locales:** `{ "local_version": 1, "tipo": "...", "mision": "demeter" | "hermes" | null, "datos": { ... } }`.
- **Estos mensajes nunca llegan al reenviador.**
- **Por qué van separados de `web-1`:** así los flujos que la web consume quedan **exactamente** como dice su contrato, sin tipos que no conoce.

## 4. Comandos (solo desde el portátil de la estación: GS-14, D-025)

**Pedido:**

```json
POST /api/v1/local/comandos
{ "mision": "hermes", "cmd": "ARM", "args": [], "confirmar": true }
```

- `cmd` es el nombre de la tabla de [protocolo](../../../04_diseno/protocolo_paquetes.md) §5.
- `mision` vale `demeter`, `hermes` o `todos` (`todos` solo para `PING`).
- **`confirmar: true` es obligatorio** para `ARM`, `DISARM`, `FORZAR_ATERRIZADO`, `SET_CANAL` y `PI_ENCENDER`.

**Respuesta:** `{ "id": "...", "cmd_seq": 17, "estado": "en_cola" }`.

**Estados del comando** (mensaje local `comando`):

`en_cola` → `enviado` (con el número de intento) → `confirmado` (el `resultado` del ACK: 0 OK, 1 fase, 2 condiciones, 3 desconocido, 4 argumento) **o** `sin_confirmacion` (después de `CMD_REINTENTOS_MAX`).

**El servicio rechaza** antes de enviar:
- un comando que no corresponde a la última fase conocida;
- `SET_CANAL` si algún cohete está en ARMED o más adelante;
- cualquier pedido que no llegue desde `127.0.0.1`.

**`web-1` no tiene comandos**, y así debe quedarse: el relay "ni siquiera conoce el formato de los comandos" (arquitectura del plan web §4).

## 5. CLI del operador (T-S04)

Es una consola de texto. **No es GUI.**
- **Lee:** `GET /api/v1/{mision}/snapshot` y `/stream` de los dos cohetes, más `/api/v1/local/stream`.
- **Manda:** `POST /api/v1/local/comandos`.
- Todas las operaciones críticas se hacen aquí.

| Orden | Hace |
| --- | --- |
| `estado [mision]` | La foto de los dos cohetes (o de uno): fase, altitud, Vz, batería, GNSS, RSSI, edad del dato (`estacion.ultimo_paquete_hace_ms`), última posición válida |
| `seguir [mision]` | Vista de texto que se actualiza sola |
| `go [mision]` | `salud.go_nogo`, con cada condición |
| `arm <mision>` · `disarm <mision>` · `forzar-aterrizado <mision>` | Piden confirmación escribiendo el nombre de la misión |
| `ping [mision\|todos]` · `check <mision>` · `recalibrar <mision>` | |
| `pi encender` · `pi grabar on\|off` | Solo Demeter |
| `wifi <mision> on\|off` · `backfill <mision> on\|off` · `buzzer <mision> on\|off` | |
| `lkp [mision]` | La última posición válida, `calc.dist_horiz_m`, `calc.azimut_deg` y el enlace a Google Maps |
| `canal <idx>` | Solo en PREFLIGHT, con la confirmación de los dos cohetes |

**Regla:** cada comando muestra su estado hasta `confirmado` o `sin_confirmacion`. **Nunca se da por hecho un comando sin el ACK.**

## 6. Reenviador (T-605a, back-end: nuestro según el plan web)

El plan web divide T-605 en dos ([PA-02](../11_preguntas_abiertas.md)):
- **T-605a, el reenviador:** se queda en `estacion/`, así que es nuestro;
- **T-640, el relay:** es del plan web.

**El reenviador:**
- toma los mensajes **`web-1`** de los dos cohetes (nunca los de §3);
- los manda en lotes a `POST /api/v1/ingesta` del relay, con `Authorization: Bearer <WEB_INGESTA_TOKEN>`, en el formato de `web-1` §1: `{"mensajes": [{"tipo", "mision", "datos"}]}`;
- usa una **cola en disco** con reintentos: si se cae internet, no se afecta nada local;
- **la conexión es solo de salida:** no escucha nada ni recibe comandos;
- toma el token de una variable de entorno o de un archivo ignorado (`.env`), con su `.example` versionado.

**Bajar a 1 Hz en tierra** lo hace el relay (plan web), no el reenviador.

## 7. Vectores de prueba

- **Dónde:** `tools/vectores/api/`. Son entradas C-03 (o un log crudo) de un vuelo sintético de T-304 y los **mensajes `web-1` esperados**.
- **Validación:** se validan contra el `esquema.json` de `web-1` (T-611 del plan web) cuando exista. Mientras tanto, contra los ejemplos de su documento.
- **Comandos:** casos de §4, con sus estados esperados.

## 8. Interfaces para la GUI (fuera de alcance)

**Las pantallas son del otro plan.** Lo que el back-end le **ofrece**:
- **`web-1` completo**, producido por el servicio de tierra, por misión, en las mismas rutas que el relay (§2);
- **el reprocesamiento** de un log crudo, para integrar sin hardware;
- **para el dashboard local** (T-603, también del otro plan): las extensiones de §3 y **los comandos de §4, solo en el portátil de la estación**;
- **para la web pública:** el reenviador (§6) hacia su relay. **Desde internet no se manda ningún comando.**

**Lo que la GUI hace y el back-end NO hace:**
- la interpolación visual (posición y *slerp*);
- roll, pitch y yaw para mostrar;
- la edad del dato en el cliente;
- los mapas, las gráficas, la vista 3D y el QR como imagen.
