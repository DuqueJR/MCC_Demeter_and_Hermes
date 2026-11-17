---
fecha: 2026-11-07
tipo: sesión
ids: [T-642, T-655, D-062, D-063, D-064, D-065, T-657, T-658, T-659, T-671]
autor: Claude principal (documentador), con Juan Pablo
---
# Noche del 7 de noviembre: pruebas en tierra con los cohetes, ajustes de despliegue y plan de correcciones de la web

## Contexto
La víspera del lanzamiento. Se probó la cadena completa desde el Mac de Juan Pablo: los cohetes por LoRa, la estación, el dashboard con el reenviador, el relay en Fly y la web pública.

## Qué pasó y cómo se resolvió
1. **Workers Builds conectado (T-655):**
   - Jerónimo conectó el Worker `hermes-demeter` al repo; su rol de Cloudflare se subió a Administrator, porque "Individual Workers Admin" no tiene `Workers CI Write`.
   - Se corrigió la variable mal escrita (`VITE_BASE_API` → `VITE_API_BASE`), se agregó `NODE_VERSION=22` y las rutas vigiladas en `gui/web/*`, y se apagaron las vistas previas.
   - El primer build se lanzó a mano y salió bien: versión `39c6c58b`, los dos dominios propios conservados y `api.eiaspice.space` incrustado en el JS.
   - **Jerónimo sigue de Administrator:** el token del build parece suyo. Se revisa después del evento.
2. **El relay se apagaba a los 5 minutos:**
   - El log de Fly decía `Trial machine stopping. To run for longer than 5m0s, add a credit card`.
   - Juan Pablo agregó una tarjeta y el relay volvió a funcionar. Falta comprobar que pase de 5 minutos prendido sin el aviso en `fly logs`. Sin la tarjeta, el relay se habría apagado en pleno evento.
3. **Firmware:**
   - Se cargó desde este Mac (PlatformIO) el firmware de `develop` (`ead1223`, con el #94 de Pablo) en las tres placas, **en los envs de banco** (`demeter`, `hermes`, `tierra`, a 10 dBm), por decisión del equipo.
   - El submódulo de LilyGO no estaba inicializado (error `U8g2lib.h`): se inicializó y se aplicó su parche.
   - La estación (CH9102) no cargaba a 921600 baudios: se cargó a 115200, cambiando el `upload_speed` solo en la copia local.
4. **Verificación con el dashboard:**
   - las tres placas comparten la clave (`crc_mal=0`, `ajeno=0`);
   - pérdidas de paquetes entre 0,1 % y 0,4 %;
   - comandos sin errores;
   - Demeter con GNSS de 13 a 15 satélites.
5. **GPS de Hermes:**
   - el módulo respondía bien (`init=OK`, 10 PVT/s, `ckerr=0`) pero con 0 satélites; ganaba 8 y los perdía todos de golpe al moverlo;
   - el equipo confirmó que era el **conector de la antena de GNSS de Hermes**.
   - Riesgo para el vuelo: la vibración, si no se asegura el conector.
6. **Raspberry Pi de Demeter:**
   - estaba en `ERROR`: 3,8 GB libres cuando pedía al menos 21,2 GB para 95 s de captura y revelado;
   - se borraron las grabaciones de `~/demeter_recording/scientific_rec/{raw,jpeg,png}` y `normal_rec/*.mp4`, y pasó a `READY`.
7. **Streaming de punta a punta con Demeter real en tierra:**
   - el relay aceptó 532 mensajes en 282 lotes, con 0 inválidos;
   - la web mostró a Demeter en PREFLIGHT con GPS.
   - "No Go" con las condiciones en verde es intencional (`web1.py`: el Go solo sale con la respuesta APTO al armar), pero confunde → D-065.
8. **Manual local** `manual_pruebas.local.html` (ignorado por git, `*.local.*`): los comandos de la máquina, la verificación, la simulación, la carga, los cohetes en tierra, la limpieza y el día del vuelo, para macOS.

## Hallazgos que llevaron a D-064 y D-065
- **Altura de 40 m en la rampa:** `web1.py` restaba 510 m fijos a la altura sobre el nivel del mar del TELEM. El firmware mide la altura de misión sobre `p0`: sigue al clima en TIERRA (τ = 60 s) y se congela al armar, con la temperatura del suelo. Pero esa altura no viaja en el TELEM.
- `fallas` siempre vacío, calibraciones siempre `null`, y `act.*` siempre en falso aunque `TELEM.actuators` trae el buzzer, el pulso de la Pi, el estado de la Pi y el motivo del error.
- La batería y la temperatura de la Pi no viajan: `PAYLOAD_STATUS` tiene 2 bytes.
- Plan completo: [12_correcciones_web_vuelo](../08_gui/12_correcciones_web_vuelo.md).

## Decisiones
- **D-064:** altura de misión desde la rampa, replicando el `p0` del firmware en `web1.py`.
- **D-065:** contenido de la web (sin chips ni calibraciones, una sección de fallas, la Pi aparte, QR solo en LANDED) y `salud.pi` opcional.

## Pendientes y riesgos para el 8 de noviembre
- **Potencia:** las tres placas están a 10 dBm (banco). El `firmware/README.md` indica los `*_campo` (22 dBm) para el vuelo: decisión del equipo con Pablo.
- **"BOOST sin armar":** debe quedar ACTIVADO en los dos cohetes antes del vuelo (Demeter estaba DESACTIVADO).
- **Asegurar el conector de GNSS de Hermes.**
- **Revisar la Pi:** pasó a "desconocido" (sin latido) a las 22:05; debe estar encendida y en `READY`.
- Integrar T-657, T-658, T-671 y T-659 esta noche, en el orden del plan (el relay se redespliega después de T-657), y después la **limpieza del relay**.
- El PR #95 de Jero (mapa 3D) toca el mapa: no se integra el día del vuelo.
