---
id: gui_correcciones_web_vuelo
estado: en curso (2026-11-07, noche): T-657, T-658 y T-671 lanzadas; T-659 espera a T-657
actualizado: 2026-11-07
depende_de: [gui_contrato_datos_web, D-064, D-065, maquina_estados, visionpack_integracion]
---
# Correcciones de la web antes del vuelo (pedido del usuario, 2026-11-07)

Pedido de Juan Pablo, la víspera del lanzamiento, después de probar el streaming con Demeter en tierra:

1. Que la web no muestre la referencia exacta de los sensores, sino qué es cada uno (acelerómetro, magnetómetro…).
2. Que el QR salga solo cuando el cohete ya está en tierra, para recuperarlo. Que las coordenadas sean pequeñas y vayan dentro del mapa durante el vuelo, hasta la recuperación.
3. Que no se muestre cada sistema por separado: una sola sección que diga si hay fallas o no.
4. Que no aparezcan las calibraciones.
5. Que la información de la Pi tenga su propia sección: batería, temperatura y estado de la misión, como en el dashboard.
6. Revisar que lo que muestra la web coincida con el firmware. En la base de lanzamiento la web marcaba **40 m** cuando debía marcar **0 m**.

## 1. Lo que se encontró (revisión firmware → `web1.py` → web)

| # | Qué muestra la web | Qué pasa de verdad | Dónde |
| --- | --- | --- | --- |
| A1 | Altura de 40 m en la rampa | `web1.py` resta una **constante** de 510 m (`SITIO_ALT_MSL_M`) a la altura sobre el nivel del mar que manda el TELEM. El firmware sí tiene su cero: `p0` en la rampa | `estacion/web1.py` (`alt_agl = alt_msl - self.sitio[2]`) |
| A2 | Cada sensor y sistema "en verde" | `fallas` y `fallas_bits` **siempre van vacíos**: `net_proto` v2 no trae la salud de cada sensor. Los verdes no están respaldados por ningún dato | `web1.py` (`"fallas": []`) |
| A3 | Pi, cámara y buzzer apagados | `act.*` va **siempre en falso**, aunque `TELEM.actuators` trae el buzzer (bit 0), el pulso de la Pi (bits 1 y 2), el **motivo** del error (bits 3 a 7) y el **estado de la Pi** (bits 8 a 15) | `web1.py` (`"act": {...False}`) |
| A4 | Calibraciones "sin dato" | `net_proto` no trae la calibración (D-050): son siempre `null` | `web1.py` |
| A5 | `reanudado` siempre en falso | El TELEM trae `TF_REANUDADO` (bit 4 de `flags`) y no se traduce | `web1.py` |
| A6 | Temperatura de la placa: sin dato | El TELEM trae `temp_c[0]`, la temperatura del barómetro, y no se usa | `web1.py` |
| A7 | "No Go" con todas las condiciones en verde | Es a propósito: el Go solo sale cuando el cohete responde APTO al armar (`web1.py`, `go_nogo`). Pero el texto confunde antes de armar | `web1.py`, `mision/vista_salud.ts` |

**Cómo maneja el firmware la altura** (`firmware/cohete/src/mission.cpp` y `ekf_task.cpp`):
- **Barómetro de misión:** un `p0` por sensor (BMP581 y BME280). En TIERRA, `p0` sigue al clima con τ = 60 s (`REF_TAU_S`). Al salir de TIERRA, es decir al armar, se **congela**. La altura de misión es `amb::altura(p, p0, T_suelo)`, con la temperatura del suelo (D-058). Viaja solo en `CmdResp.alt_dm`, la respuesta a un comando.
- **EKF:** su origen NED es el primer GNSS bueno (`h0`). Al armar rehace el reposo en la rampa: sesgos, `p0`, actitud y temperatura del suelo. Su altura sobre `p0` es `alt_baro_m`, que **no viaja** por LoRa.
- **TELEM:** `alt_cm` = `h0 − p_down` del EKF (si tiene origen) o la `hMSL` del GNSS. Es altura **sobre el nivel del mar**, no altura de misión.

## 2. Decisiones (detalle en `04_diseno/decisiones.md`)

- **D-064, altura de misión en la web:** `web1.py` replica la regla de `p0` del firmware sobre la altura del EKF.
  - **Referencia:** mientras el cohete está en TIERRA, un filtro exponencial de τ = 60 s sobre `alt_msl` (solo con muestras del EKF, si las hay). En ARMED sigue con τ = 5 s (P): al armar, el firmware rehace el reposo del EKF y su altura puede saltar unos metros. Se **congela** en FLY con el último valor de ARMED. Si se desarma, vuelve a τ = 60 s.
  - **Cálculo:** `pos.alt_agl_m` = `alt_msl − referencia`. `pos.alt_msl_m` = la altura del EKF tal cual (se muestra). `salud.alt_origen_msl_m` = la referencia.
  - No hay constantes del sitio, ni altura fijada a mano, ni el GNSS como cero.
  - **Límite:** sigue siendo la altura del EKF (que fusiona el barómetro), no la `s_alt` de misión. Para que la web muestre exactamente la altura barométrica del cohete, el TELEM debe llevar `alt_baro_m`. Eso es un cambio de protocolo, para después del vuelo, con Pablo.
- **D-065, contrato y web:**
  - `salud.pi`, **opcional**, `null` en Hermes: `{estado, motivo, bat_pct}`. `estado` es el `StatusCode` de `demeter_protocol.py` (o `DESCONOCIDO` sin latido en 3 s). `motivo` es el `ErrorCode` (`SD_ESPACIO`…), o `null`. `bat_pct` es `null` por ahora: la UART no la trae. La temperatura de la Pi sigue en `salud.temp_pi_c`, que también es `null` por ahora.
  - `act.buzzer`, `act.pi_pulso` y `act.cam_ok` salen de `TELEM.actuators`. `cam_ok` = la Pi está en READY, ARMED, STARTING, ASCENT o RECORDING.
  - En la web: nombres genéricos de los sensores; una sola sección de fallas, honesta con lo que llega; sin calibraciones; la Pi en su propia sección (solo Demeter); QR solo en LANDED; coordenadas compactas dentro del mapa hasta LANDED.

## 3. Tareas

| Tarea | Qué | Archivos | Depende de |
| --- | --- | --- | --- |
| **T-657** | Datos fieles: la altura (D-064), los `act.*`, `reanudado`, la temperatura y `salud.pi` (D-065). El contrato (`esquema.json`, `tipos.ts`, `ejemplos.ts`) y las pruebas de `web1.py` y del relay | `estacion/web1.py`, `gui/web/src/contrato/`, `gui/relay/` (solo pruebas) | — |
| **T-658** | Salud simplificada: nombres genéricos, una sección de fallas, sin calibraciones, sin la fila de la Pi, un texto claro antes de armar | `gui/web/src/mision/vista_salud.ts`, `Salud.tsx` y su CSS | — |
| **T-671** | Recuperación: QR y bloque grande solo en LANDED; coordenadas y altura sobre el nivel del mar compactas dentro del mapa durante el vuelo | `gui/web/src/mision/Recuperacion.tsx`, `vista_recuperacion.ts`, el mapa | — |
| **T-659** | La sección de la Pi (solo Demeter): estado, motivo, batería y temperatura (estas dos, "sin dato" con el protocolo actual) | Un componente nuevo en `gui/web/src/mision/` | T-657 en `develop` |

### Criterios de aceptación
- **T-657:**
  - con el cohete quieto en TIERRA, `alt_agl_m` queda en ±2 m después de 60 s, y `alt_msl_m` = la altura del EKF;
  - un salto de unos metros al armar se absorbe en ARMED, y la referencia se congela en FLY;
  - en un vuelo reproducido el apogeo se mide desde la rampa;
  - sin `SITIO_ALT_MSL_M` en el cálculo;
  - `act.buzzer`, `act.pi_pulso`, `act.cam_ok`, `flags.reanudado` y `salud.pi` salen del TELEM;
  - `esquema.json` acepta mensajes **con y sin** `salud.pi`;
  - pasan las pruebas de `estacion/pruebas` y las del relay;
  - si el dashboard se reinicia con el cohete armado, la referencia no se pierde (se persiste en `estacion/`, ignorada por git), o se documenta el límite.
- **T-658:**
  - no aparece ningún modelo de chip;
  - una sola fila de estado general ("Sin fallas reportadas" / "Falla: …"), construida con lo que sí llega: `flags.falla_activa`, el EKF, el GNSS, la batería, el enlace y la Pi;
  - no aparecen las calibraciones;
  - antes de armar no dice "No Go", sino algo como "Esperando armado", con las condiciones.
- **T-671:**
  - antes de LANDED no hay QR ni bloque grande de coordenadas;
  - las coordenadas (lat, lon y altura sobre el nivel del mar) van compactas sobre el mapa;
  - en LANDED aparece el bloque de recuperación con el QR y el botón de copiar.
- **Las cuatro:** `npm run build` (con la prueba de aislamiento), `npm test` y la e2e de lo tocado pasan; capturas en celular y escritorio en la bitácora.

### Orden para integrar esta noche
1. Merge de **T-658** y **T-671**, en cualquier orden. Cada merge publica la web sola (Workers Builds).
2. Merge de **T-657**. Luego **redesplegar el relay** desde la raíz: `fly deploy . --config gui/relay/fly.toml --dockerfile gui/relay/Dockerfile --ha=false`, porque su imagen trae `esquema.json`. Solo después, reiniciar el dashboard con el `web1.py` nuevo. Al revés, el relay viejo rechazaría `salud.pi`.
3. **T-659** desde el `develop` que ya tenga T-657. Merge.
4. Verificación de punta a punta con un cohete en tierra (manual, secciones 2 y 6), y la **limpieza** del relay.
5. **Corte:** lo que no esté verificado a la hora que fije el equipo no se integra. El 8 de noviembre no hay merges de `gui/web/`.

**Ojo:** el PR #95 de Jero (T-656, mapa 3D) está abierto y toca el mapa, igual que T-671. Si se integra esta noche, debe ser antes de T-671 o resolviendo el conflicto. Mañana, no.

## 4. Después del vuelo
- Que el TELEM lleve la altura barométrica de misión (`alt_baro_m` o `s_alt`), para que la web muestre exactamente la del cohete (con Pablo, cambio de protocolo).
- La batería y la temperatura de la Pi por la UART y LoRa (con Jerónimo y Pablo).
- La salud por sensor en el protocolo, si se quiere volver a mostrar el detalle.
