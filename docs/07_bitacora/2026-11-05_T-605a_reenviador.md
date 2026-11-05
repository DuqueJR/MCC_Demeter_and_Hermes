---
fecha: 2026-11-05
tipo: tarea
ids: [T-605a, T-661, T-662, T-640, D-046, D-W06]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-605a-reenviador
---
# T-605a: reenviador de `web-1` al relay

## Contexto
El dashboard de operación (`estacion/dashboard.py`) ya produce los mensajes `web-1` (T-661, T-662). T-605a los sube al relay público (`POST /api/v1/ingesta`) sin afectar nada local. El relay (T-640) **no existe todavía** y `gui/relay/` tampoco: por orden del usuario se construyó contra el contrato y se probó con un servidor HTTP falso. **No se crearon `gui/relay/` ni el relay.**

**Estado honesto de la tarea:** el criterio del backlog ("una sesión reproducida llega a la web pública") **no se puede cumplir aún**: falta T-640. Lo que sí se cumplió es el criterio sustituto: una sesión reproducida con `dashboard.py --reproducir` llega **completa, en orden y con el formato correcto** al servidor falso. T-605a no debe darse por terminada hasta probarla contra el relay real.

## Qué se hizo
- `estacion/reenviador.py` (nuevo, solo biblioteca estándar):
  - **Apagado por defecto.** Sin URL (`--web-relay` o `WEB_RELAY_URL`) y sin token (`WEB_INGESTA_TOKEN`, o `estacion/.env`) no hay hilo ni archivos. URL sin token: un solo evento que lo dice y nada más.
  - `publicar(mision, tipo, datos_json)` es lo único que corre en el hilo del dashboard (dentro de `tr_lock`): un `append` a una cola en memoria acotada (`REENV_MEM_MAX` = 5000) con un candado propio que nunca se mantiene durante E/S, y que cuenta lo que pierde. Nunca lanza.
  - Un **hilo aparte** (daemon) hace todo lo demás: vacía la memoria a una cola **sqlite** en disco (`estacion/cola_web.db`), compone los lotes y hace el POST con `http.client` (conexión persistente, tiempo límite de 5 s, TLS con verificación por defecto).
  - Cola en disco: sobrevive a reiniciar; acotada a `REENV_COLA_MAX` = 50 000 (descarta lo más viejo y lo cuenta). Si no se puede abrir o falla el disco (lleno, bloqueado), sigue con una cola solo en memoria y lo avisa en los eventos.
  - Solo de salida: no abre puertos. Solo mensajes de `demeter` y `hermes`; cualquier otra misión se ignora.
  - El token nunca sale: ni en los argumentos, ni en los eventos, ni en `estado()` (se reemplaza por `***` aun en los mensajes de excepción). Rechaza tokens con espacios o caracteres de control. Con `http://` a otra máquina avisa que el token viaja sin cifrar.
  - Estado visible en los **eventos** del dashboard: `reenviador activo hacia <host>`, `CONECTADO (recuperado)`, `SIN CONEXION (<motivo>)`, `RECHAZADO (token)`, y mientras esté caído una línea por minuto con los mensajes en cola y los perdidos. Cada transición se avisa una vez, no en cada reintento.
- `estacion/dashboard.py`, **+10 líneas** (para no chocar con #64 y #65): `import reenviador`, `envio = None`, dos líneas en `web_publicar`, `--web-relay` y `--web-cola`, `global envio`, la creación y el `iniciar()`. El arranque va **después** de reservar el puerto: un segundo dashboard (que sale por puerto ocupado) no abre la misma cola.
- `estacion/.env.example` (versionado), `.gitignore` (`estacion/cola_web.db*`; `.env` ya estaba ignorado), sección propia al final de `estacion/README.md`.
- `estacion/pruebas/test_reenviador.py`: 35 pruebas.

## Orden de envío (la decisión de diseño)
Problema: tras una caída de internet hay un atraso en la cola, y el vuelo en curso debe seguir llegando con latencia baja (`WEB_LATENCIA_MAX_S` = 2 s). Si se vacía en orden estricto, lo más nuevo espera minutos detrás del atraso. Si se envía solo lo nuevo, el público pierde la trayectoria.

Elegido (lo más simple que cumple): **cada lote = hasta `REENV_ATRASO_POR_LOTE` (50) mensajes viejos en orden + todo lo "fresco" (publicado hace menos de `REENV_FRESCO_S` = 5 s) en orden, hasta `REENV_LOTE_MAX` (100)**. Lo que pasa ahora viaja en el primer lote disponible; el atraso se vacía a ≥ 50 mensajes por POST, en paralelo, sin hacer esperar a lo nuevo. Con cola vacía o sin atraso es el orden normal. Si hay más de 100 frescos, salen en lotes seguidos sin esperar (hasta 20 POST por ciclo).

Costo: **el relay puede recibir mensajes viejos después de otros más nuevos**. Está en los requisitos de T-640.

Un lote que falla por red, timeout o 5xx se guarda y se **reintenta idéntico, con el mismo `X-Lote-Id`, antes que cualquier otro** (no se sabe si el relay lo recibió). Después se recompone normalmente. Tras reiniciar el dashboard los pendientes se reenvían con lotes nuevos: un duplicado es posible si el relay recibió un lote cuya respuesta se perdió justo antes del reinicio.

## Requisitos para T-640 (el relay)
1. **Ruta:** `POST /api/v1/ingesta`, `Authorization: Bearer <WEB_INGESTA_TOKEN>`, `Content-Type: application/json; charset=utf-8`, cuerpo `{"mensajes": [{"tipo","mision","datos"}]}` con `datos` ya en formato `web-1`. Soportar conexión persistente (keep-alive).
2. **Tamaño:** aceptar **al menos 100 mensajes por lote** (`REENV_LOTE_MAX`; ≈ 130 KB con `estado` de ~1,3 KB). Recomendado: tope de cuerpo ≥ 512 KB. Si rechaza por tamaño debe ser **413**: el reenviador parte el lote a la mitad y reintenta.
3. **Códigos que el reenviador entiende:**
   - **2xx** (200 o 204; el cuerpo se ignora): lote aceptado; se borra de la cola.
   - **401 o 403**: token inválido. El reenviador avisa una vez y reintenta cada 60 s. El relay **no debe** dar 401 por otra causa.
   - **400, 413 o 422**: el lote (o un mensaje) es inválido. El reenviador lo parte hasta aislar el mensaje, lo **descarta** y lo cuenta (tope: 20 descartes seguidos, luego trata el rechazo como falla y espera). Para que un solo mensaje malo no tire el lote, conviene que el relay valide y descarte lo malo y responda 2xx con el resto; si no, esto lo resuelve el reenviador.
   - **408, 429, 5xx, timeout o corte**: transitorio; retroceso de 0,5 s a 8 s; nada se descarta.
   - Responder en menos de **5 s** (`REENV_TIMEOUT_S`).
4. **Idempotencia:** el mismo `X-Lote-Id` (cabecera, formato `<8 hex>-<n>`) puede llegar **más de una vez** (reintento tras un timeout con el lote ya recibido). El relay debe responder 2xx sin reprocesar. Recomendado recordar los últimos ~1000 ids. Además, tras reiniciar el dashboard pueden repetirse mensajes con otro lote: el relay debe tolerar duplicados sin fallar (por ejemplo, descartar un `estado` con el mismo `mision` y `t_ms`, y un `evento` idéntico).
5. **Orden:** pueden llegar mensajes **viejos después de nuevos** (ver arriba), también sin repetirse. Por eso: ordenar la trayectoria/`serie` por `t_ms`, que el "último estado" del snapshot sea el de mayor `t_ms` (no el último recibido), y asignar `seq_relay` al llegar (es el `id` del SSE). Para bajar a 1 Hz en tierra (`WEB_TASA_TIERRA_HZ`) usar el tiempo del propio mensaje (`rx_utc_ms`/`utc_ms`), **no** el de llegada: tras una caída, el atraso llega de golpe.
6. **Ritmo:** hasta ~20 mensajes/s por misión en vuelo y ráfagas de cientos al recuperarse una caída.
7. El reenviador manda **todos** los tipos (`meta`, `estado`, `salud`, `estacion`, `evento`, `backfill`) de las dos misiones y nada más.

## Constantes propuestas (todas `(P)`, definidas en `reenviador.py`; `constantes.md` no se tocó)
| Nombre | Valor | Para qué |
| --- | --- | --- |
| `REENV_LOTE_MAX` | 100 | mensajes por POST |
| `REENV_ATRASO_POR_LOTE` | 50 | viejos que viajan junto a los frescos en cada lote |
| `REENV_FRESCO_S` | 5 | un mensaje es "fresco" si se publicó hace menos de esto |
| `REENV_CICLO_S` | 0,2 | cada cuánto se vacía la memoria y se envía (aporta ≤ 0,2 s a la latencia) |
| `REENV_LOTES_POR_CICLO` | 20 | POST seguidos antes de volver a vaciar la memoria |
| `REENV_TIMEOUT_S` | 5 | conectar y cada lectura/escritura de la red |
| `REENV_BACKOFF_INI_S` / `REENV_BACKOFF_MAX_S` | 0,5 / 8 | retroceso de reintentos (se duplica; recuperar se nota en ≤ 8 s) |
| `REENV_AUTH_REINTENTO_S` | 60 | reintento con 401 o 403 |
| `REENV_RESUMEN_S` | 60 | línea de estado en los eventos mientras esté caído |
| `REENV_COLA_MAX` | 50 000 | mensajes en disco (~65 MB; ≈ 2 h de espera en la rampa a unos 6 mensajes/s) |
| `REENV_MEM_MAX` | 5000 | mensajes en memoria esperando al hilo |
| `REENV_RECHAZOS_MAX` | 20 | descartes seguidos antes de creer que el relay rechaza todo |

`WEB_LATENCIA_MAX_S` (= 2, de `constantes.md`) se replica con el mismo nombre; hoy solo documenta el objetivo.

## Evidencia
- Suite completa de la estación: `python -m unittest discover -s estacion/pruebas` → **132 pruebas OK, 2 omitidas** (97 de `develop` + 35 nuevas; las 2 omitidas son las mismas de antes). Las 35 nuevas, repetidas 3 veces más: estables (≈ 22 s cada corrida).
- Cobertura de `test_reenviador.py` (relay falso en 127.0.0.1):
  - entrega: formato exacto del cuerpo, ruta, `Authorization`, `Content-Type`, `X-Lote-Id`, UTF-8, solo las dos misiones, URL con o sin ruta;
  - caída: 503 y recuperación (20 de 20, en orden, 0 perdidos, un solo aviso), retroceso con tope (4 a 14 intentos en 1,5 s), 300 viejos + 1 nuevo (el nuevo sale en el segundo lote, el atraso en orden, sin pérdidas ni repetidos), lote sin respuesta reintentado idéntico con el mismo `X-Lote-Id`, conexión ociosa cerrada por el servidor, servidor sin escuchar;
  - persistencia: reinicio (5 de 5), vaciado final al apagar, cola llena (se pierden 15, quedan los 10 más nuevos), memoria acotada, disco inutilizable;
  - rechazos: 401 y 403 (un aviso, sin el token, ≤ 6 intentos en 1 s, se recupera al rotar el token), 413 (se parte hasta que cabe, 0 descartes), mensaje malo (se descarta 1 y el resto llega), relay que rechaza todo (el descarte se detiene en 20 y la cola no se vacía);
  - **servidor colgado:** con el relay sin responder, 10 000 llamadas a `publicar` tardaron < 3 s en total y la peor < 50 ms (límites de la prueba); medido aparte: ≈ 2,5 µs por llamada, incluida la serialización de la prueba;
  - apagado por defecto: sin configuración no se crea ningún hilo ni archivo (probado en la API y con el dashboard de verdad en `--demo`);
  - punta a punta (dashboard real con `--reproducir` a 500x): los `estado` de las dos misiones llegan **completos, en orden y con los mismos `t_ms`** que produce el traductor sin red; todos los mensajes válidos contra el esquema; ningún lote repetido; el despegue llegó. Con el relay en 503 mientras corre la sesión, el snapshot local sigue sano y, al volver, llega todo en orden.
- Mediciones con relay local a 18 mensajes/s: 90 mensajes en 26 POST; la edad del lote al entregarse fue 0,2 s (≈ `REENV_CICLO_S`).
- Hashes: `949bc52` (módulo), `607ac26` (dashboard y pruebas), `f776cba` (README).

## Decisiones tomadas o propuestas
- **Propuesta (para el documentador): agregar las constantes `REENV_*` a `constantes.md`** como (P), y la cabecera `X-Lote-Id` y los requisitos 1 a 7 de arriba a `08_gui/04_arquitectura_web.md` §4 / `05_api_backend_tierra.md` §6. La cabecera es un detalle de transporte, no cambia `web-1` ni el cuerpo.
- **Propuesta: `meta.modo` en demo y reproducción.** `dashboard.py` crea `web1.Traductor()` con `modo="vivo"` también con `--demo` y `--reproducir`. Con el reenviador activo, esos datos llegarían al público marcados como `vivo`. Como remedio de esta tarea solo se emite un aviso en los eventos. Propuesta: que el dashboard use `modo='sintetico'` con `--demo` y `'simulacion'` con `--reproducir` (una línea en `dashboard.py`; no se hizo aquí para no ampliar el alcance ni chocar con #64 y #65).
- **Propuesta (T-640):** que el relay rechace o ignore mensajes de `modo` distinto de `vivo` cuando se configure como "producción", como segunda barrera.

## Problemas y cómo se resolvieron
- La coherencia `utc_ms <= rx_utc_ms <= relay_utc_ms` de `tools/web_datos/validacion.py` falla con `--reproducir` a 500x (el reloj local no coincide con el de la sesión). Es un efecto de la reproducción rápida, no del reenviador: la prueba punta a punta ignora solo ese error y valida todo lo demás.
- Primera versión: los pasos de partir el lote contaban para el tope de descartes, y se detenía en 14 en vez de 20. Corregido para contar solo los descartes.
- Un 400/413/422 con un solo mensaje solo se descarta si el relay ya aceptó algo en esta sesión del dashboard (`_hubo_exito`); si no, es más probable una URL o relay mal configurados y la cola se conserva (retroceso). Consecuencia: tras reiniciar, hasta el primer éxito, un mensaje venenoso bloquea la cola con reintentos de 8 s en vez de descartarse.

## Pendiente / siguiente paso
- **T-640 (el relay)**: aplicar los requisitos de arriba y repetir la prueba punta a punta contra el relay real. Solo entonces se cumple el criterio del backlog ("una sesión reproducida llega a la web pública") y T-605a puede cerrarse.
- Probar con internet real (TLS, DNS) y con el token real: no se hizo (no hay relay).
- Opcional: mostrar la línea de estado del reenviador en `dashboard.html` (hoy solo en los eventos; `Reenviador.estado()` ya entrega `estado`, `en_cola`, `perdidos`, `enviados`, `lat_ult_s`).
- Los contadores de perdidos no se guardan entre reinicios.
- Un servidor que gotea bytes lentamente puede retener al hilo del reenviador más de 5 s (el tiempo límite es por operación, no total). Solo afecta al reenviador, no al dashboard.

## Documentos afectados
- Nuevos: `estacion/reenviador.py`, `estacion/.env.example`, `estacion/pruebas/test_reenviador.py`.
- Modificados: `estacion/dashboard.py` (+10 líneas), `estacion/README.md` (sección al final), `.gitignore`.
- Por actualizar por el documentador: backlog (T-605a: código listo, falta T-640), `constantes.md` (`REENV_*`), `08_gui/04` §4 y `05_api_backend_tierra.md` §6 (requisitos para el relay).
