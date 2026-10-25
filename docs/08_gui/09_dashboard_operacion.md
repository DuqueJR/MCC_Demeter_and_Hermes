---
id: gui_operacion
estado: borrador para refinar (preguntas en §9). Sale de *Objetivos* §7 y de C-05.
actualizado: 2026-10-25
depende_de: [requisitos, estacion_terrena, protocolo_paquetes, maquina_estados, gui_contrato_datos, C-05, gui_identidad, gui_arquitectura]
decisiones: [D-025, DP-15, DP-17, D-W14]
---
# Dashboard de operación (estación terrena)

Es **nuestro panel de control y de datos** en la estación: el *Ground Station Dashboard* de *Objetivos* §7. A diferencia de la web pública:
- **es más funcional que bonito**, aunque usa el mismo lenguaje visual;
- **muestra todas las variables**, sin esconder nada;
- **manda comandos**, solo desde el portátil de la estación;
- **funciona sin internet**.

Reemplaza a T-603 y T-604 en su parte visual. El back-end que lo alimenta es del [plan de dos sesiones](../05_plan/dos_sesiones/00_LEEME.md) ([C-05](../05_plan/dos_sesiones/06_contratos/05_api_backend_tierra.md)).

## 1. Principios

1. **El vuelo no depende del dashboard (DP-15).** Toda operación crítica también existe en la CLI. Si el dashboard falla, se opera por la CLI sin perder nada.
2. **Ver todo, siempre.** Cada campo de NAV, STATUS, ACK, BEACON y del módem es visible, con su unidad, su edad y su valor crudo (§4.3).
3. **Nunca se borra la pantalla** (GS-03). Sin datos, se muestra el último valor con su antigüedad.
4. **Ningún comando se da por hecho sin ACK.** Cada comando muestra su estado hasta `confirmado` o `sin_confirmacion` (C-05 §4).
5. **Los comandos solo desde `127.0.0.1`** (GS-14, D-025). El dashboard se sirve desde el servicio local. Ni el relay ni la web pública pueden mandar nada.
6. **Los dos cohetes a la vez** (GS-01). La regla de aislamiento de la web pública (D-W01) **no aplica aquí**.
7. **Legible al sol** en un portátil al aire libre (ver §9, pregunta 5).

## 2. Arquitectura

```
Servicio de tierra (estacion/, C-05) en 127.0.0.1:<API_PUERTO>
  ├─ GET /api/v1/{demeter,hermes}/snapshot y /stream   ← web-1 (los dos cohetes)
  ├─ GET /api/v1/local/stream                          ← paquete, modem, diagnostico, comando
  ├─ GET /api/v1/local/historial                       ← lectura del log decodificado
  ├─ POST /api/v1/local/comandos                       ← los comandos (solo 127.0.0.1)
  └─ archivos estáticos: gui/web/dist/operacion/       ← este dashboard (❓ §9, pregunta 12)
```

- **Es una cuarta entrada de la misma app**, `gui/web/operacion/index.html`. Reutiliza el cliente de datos (`src/datos/`), el mapa (`src/mapa/`), las gráficas (`src/graficas/`), la actitud (`src/actitud/`) y los tokens.
- **Sin dependencias externas en tiempo de ejecución:**
  - las fuentes van autohospedadas;
  - el mapa es el **mismo PMTiles** de Santa Fe de Antioquia que usa la web, servido localmente (estacion_terrena §2.3 pedía mapas precargados);
  - no se usa ningún CDN.
- **Para desarrollar sin hardware:**
  - el repetidor de la web (T-630) para `web-1`;
  - el módem falso (T-S07) y el reprocesamiento de un log crudo (C-05 §1) para las extensiones locales y los comandos.

## 3. Pantallas

**Tamaño objetivo:** un portátil de 1366×768 o más, con un segundo monitor opcional (§9, pregunta 2). No se diseña para el celular: si alguien quiere ver desde el celular, para eso está la web pública.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ESTACIÓN  UTC 14:02:31 · TDMA GNSS ✓ · Módem ✓ 921600 · GNSS est. ✓ · Reenviador ✓ · Web 312 │
│ [D] DEMÉTER  DESCENT 312 m ↓9,2  edad 0,2 s  RSSI −97 │ [H] HERMES  ARMED  GO ✓  edad 0,4 s │
│ ⛔ ALARMAS: (ninguna)                                                       [Reconocer] │
├──────────┬─────────────────────────────────────────────────────────────────────────────┤
│ Vuelo    │                                                                             │
│ Preparar │                    (contenido de la pestaña activa)                         │
│ Variables│                                                                             │
│ Gráficas │                                                                             │
│ Enlace   │                                                                             │
│ Recuperar│                                                                             │
│ Comandos │                                                                             │
│ Post-vuelo│                                                                            │
└──────────┴─────────────────────────────────────────────────────────────────────────────┘
```

- **La barra superior siempre está visible:**
  - el estado de la estación (hora UTC, fuente de sincronía del TDMA, módem, GNSS de la estación, reenviador y conexiones a la web pública);
  - un resumen de cada cohete: fase, altitud, Vz, edad del dato, RSSI y Go/No-Go;
  - **la banda de alarmas**.
- Cada cohete se identifica con **su parche pequeño y su color de acento** (lavanda para Hermes, cielo para Deméter, 02 §2). Los colores de estado son los mismos de la web (02 §4).

### 3.1 Vuelo (*Objetivos* 7.A y 7.B)
- **El mapa táctico conjunto:**
  - la estación, la rampa, los dos cohetes con su trayectoria;
  - las elipses de impacto;
  - las líneas a la estación con la distancia radial y el azimut;
  - el LKP en rojo.
- **Un panel por cohete:**
  - la línea de fases con la hora T+ de cada evento;
  - altitud, Vz, velocidad total y aceleración X, Y y Z;
  - **el apogeo fijo**;
  - el tiempo de vuelo, el estimado a la siguiente fase y el tiempo restante;
  - la actitud (horizonte y brújula, con roll, pitch y yaw numéricos);
  - la calidad del enlace.
- **Perfil de altitud** de los dos cohetes contra T+, en una sola gráfica.
- **El 3D** (*Objetivos* 7.A: la trayectoria con la parábola predicha y el modelo con la actitud) va **como *could*, igual que en la web** (D-W03). Ver §9, pregunta 9.

### 3.2 Preparar: Go/No-Go y comandos de rampa (*Objetivos* 7.C y 7.D)
- **Por cohete, el checklist automático** de [maquina_estados](../04_diseno/maquina_estados.md) §4 (`salud.go_nogo`):
  - cada condición con su valor real (por ejemplo, "satélites 11 ≥ 6 ✓", "hAcc 1,8 m ≤ 5 ✓");
  - el **indicador maestro GO / NO-GO**.
- **Sensores y calibraciones:** cada bit de `fallas` y de `calib` ("en proceso" o "completada"), la salud del EKF (`nav_innov_m`), la batería en % y V, la SD libre y las temperaturas.
- **Comandos de rampa:** PING, SYSTEM_CHECK, RECALIBRAR, ARM y DISARM; en Deméter, PI_ENCENDER y PI_GRABAR; BUZZER (prueba); SET_CANAL.
  - **Cada botón está habilitado solo en las fases que acepta** la tabla de [protocolo](../04_diseno/protocolo_paquetes.md) §5. Si no, se ve deshabilitado con el motivo.
  - **ARM está deshabilitado mientras el Go/No-Go no esté en verde.**
- **Lo que no se hace:** el "control mecánico" de *Objetivos* 7.D. Está prohibido por el reglamento (REG-01).

### 3.3 Variables: el inspector ("revisar todas las variables sin ningún problema")
- **Una tabla con TODOS los campos**, agrupada por fuente:
  - `estado` (NAV y los cálculos);
  - `salud` (STATUS);
  - el último ACK;
  - `estacion`;
  - el módem (`ESTADO_MODEM` con sus contadores);
  - el diagnóstico (pérdidas por `seq`, `boot_count`, `REANUDADO`, paquetes inválidos).
- **Columnas:**
  - el nombre (el mismo del contrato y del protocolo);
  - el valor en unidades SI, con coma decimal;
  - la unidad;
  - el **valor crudo** (el entero del paquete y el bitmap en binario);
  - la **edad**;
  - el mínimo y el máximo de la sesión;
  - una mini gráfica de los últimos 30 s.
- **Herramientas:**
  - buscar por nombre;
  - fijar filas arriba;
  - congelar la tabla;
  - **"graficar"**, que manda la variable a la pestaña Gráficas;
  - copiar el valor.
- **Vista "paquete crudo":** el último paquete de cada tipo en hexadecimal, con los campos decodificados al lado (útil para depurar el protocolo con T-502).
- **Exportar a CSV** la sesión o un rango de tiempo, desde `GET /api/v1/local/historial`.

### 3.4 Gráficas (*Objetivos* 7.F, GS-11)
- **Gráficas personalizables:** cualquier variable contra el tiempo **o contra otra variable** (por ejemplo, "Aceleración Z contra el tiempo" o "Altitud contra la velocidad vertical", los ejemplos de *Objetivos*).
  - Varios paneles, con un cursor sincronizado entre ellos;
  - marcas verticales en los eventos;
  - zoom y desplazamiento.
- **Backfill y volcado (*Objetivos* 7.E):**
  - una barra de progreso;
  - al completarse, las gráficas **se reemplazan automáticamente** por los datos de mayor resolución, primero con el backfill LoRa y después con el volcado por Wi-Fi de la SD, con un aviso.

### 3.5 Enlace y diagnóstico (*Objetivos* 7.C, calidad de los enlaces)
- **Tabla de paquetes en vivo** (mensaje local `paquete`): la hora, el cohete, el tipo, `seq`, el RSSI, el SNR, el slot, la marca `fuera_de_slot` y el CRC.
- **Por cohete:** el % de pérdidas (10 s y desde el inicio), el RSSI y el SNR en gráfica, `rssi_tierra_dbm` (el uplink), los satélites y `hAcc`, y la fuente de sincronía.
- **El módem:** los contadores y los errores.
- **Avisos de diagnóstico:** si salta el `boot_count` en vuelo, si llega `REANUDADO` y si hay paquetes inválidos.

### 3.6 Recuperación (*Objetivos* 7.G)
- **Por cohete:**
  - las coordenadas de impacto (o el LKP), grandes y en alto contraste;
  - el **QR de Google Maps** en grande, para escanearlo desde el teléfono del equipo de recuperación;
  - el **vector de navegación**: la distancia horizontal y el azimut desde la estación, con una flecha;
  - la elipse.
- Es la misma lógica de la web (03 §3.5), pero con los dos cohetes y **más grande**.

### 3.7 Comandos (historial)
- Cada comando enviado, con quién y cuándo, el `cmd_seq`, los intentos, el estado (`en_cola`, `enviado`, `confirmado` con el `resultado`, o `sin_confirmacion`) y el código de rechazo traducido.

### 3.8 Post-vuelo (*Objetivos* 7.E)
- **WIFI_AP** y **BACKFILL**, con su progreso.
- **La descarga del volcado completo**, verificada con su hash (T-801).
- **El resumen del vuelo:** apogeo, tiempos de los eventos, velocidad máxima, deriva y el retardo real del motor (t_ej − t_bo).
- **Un enlace al análisis del motor** (T-802).

## 4. Seguridad de los comandos

| Comando | Confirmación propuesta (❓ §9, pregunta 4) |
| --- | --- |
| PING, SYSTEM_CHECK | Un clic |
| RECALIBRAR, BUZZER, PI_GRABAR, WIFI_AP, BACKFILL | Clic y luego "Confirmar" en un diálogo propio de la página (no `alert()` del navegador) |
| **ARM, DISARM, FORZAR_ATERRIZADO, SET_CANAL, PI_ENCENDER** | **Escribir el nombre de la misión** (igual que la CLI, C-05 §5) **o mantener presionado 2 s** |

- **El servicio rechaza** antes de enviar cualquier pedido que no venga de `127.0.0.1`, y los comandos fuera de fase (C-05 §4). El dashboard **además** deshabilita los botones fuera de fase.
- **FORZAR_ATERRIZADO** solo aparece en FREE_FALL y DESCENT, en rojo, con el texto de [maquina_estados](../04_diseno/maquina_estados.md) T13.

## 5. Alarmas

| Alarma | Cuándo | Visual | Sonora (❓ §9, pregunta 6) |
| --- | --- | --- | --- |
| Descenso rápido (GS-05) | `alarmas.descenso_rapido` (solo en DESCENT) | Banda roja y el panel del cohete en rojo | Sí |
| Sin señal en vuelo | Edad > `WEB_SIN_SENAL_S` entre BOOST y DESCENT | Banda roja; LKP | Sí |
| Falla activa | `flags.falla_activa` | Banda ámbar con el nombre de la falla | En vuelo |
| Comando sin confirmación | El estado `sin_confirmacion` | Banda ámbar | Sí |
| Batería baja | El bit 13 de `fallas` | Banda ámbar | No |
| `boot_count` saltó en vuelo | Diagnóstico | Banda roja | Sí |

- Una alarma queda en la banda **hasta que el operador la reconoce**, aunque la condición ya haya pasado. Así no se pierde nada.

## 6. Estética

- **El mismo sistema de la web** (02), en una variante **"consola"**:
  - más densa (texto de 13–14 px y números tabulares);
  - un tema neutro de control de misión con el teal de la EIA en la interfaz;
  - **el acento de cada cohete solo para identificarlo** (lavanda o cielo).
- **Sin decoración en el área de datos.** Los parches solo en la barra superior.
- Modo oscuro por defecto, y **❓ un "modo sol"** de alto contraste para el aire libre (§9, pregunta 5).

## 7. Prioridad y tareas (borrador: se ajusta con las respuestas de §9)

**Mínimo de operación (prioridad S alta):** la barra superior y las alarmas, Vuelo, Preparar (con los comandos), Variables y Recuperación.
**Después (S):** Gráficas personalizables, Enlace, Comandos (historial) y Post-vuelo.
**Could:** el 3D (con T-650 a T-652).

| ID | Tarea | Carril | Depende de |
| --- | --- | --- | --- |
| T-660 | Entrada `operacion/`, tema "consola", el layout con pestañas y la barra superior | E | T-610, T-613 |
| T-661 | Cliente local: los dos streams `web-1`, `/api/v1/local/stream` y el cliente de comandos | D | T-631, C-05 congelado |
| T-662 | Banda de alarmas, visual y sonora, con reconocimiento | E | T-660, T-661 |
| T-663 | Vuelo: el mapa conjunto y los paneles por cohete (reutiliza T-624, T-632 y T-634) | E | T-661, T-632 |
| T-664 | Preparar: Go/No-Go y el **centro de comandos** con confirmación (modo "preguntar") | E | T-661 |
| T-665 | Variables: el inspector, el paquete crudo y la exportación a CSV | D | T-661 |
| T-666 | Gráficas personalizables (sube T-653 a S) | D | T-633 |
| T-667 | Enlace y diagnóstico | D | T-661 |
| T-668 | Recuperación (reutiliza T-625) | E | T-625, T-661 |
| T-669 | Post-vuelo: backfill, Wi-Fi y la descarga | D | T-661, T-801 |
| T-670 | Ensayo completo con el módem falso y en P-07 (integración en 15 min) | Ambos | T-662 a T-665, T-S07 |

**Calendario tentativo:** después de HW1 (29 de octubre), en paralelo con W2 y W3. **Es mucho para la misma gente:** ver §9, pregunta 1.

## 8. Cómo cubre *Objetivos* §7

| *Objetivos* | Dónde |
| --- | --- |
| A. Mapa 3D, actitud y mapa 2D táctico | Vuelo (el 3D es *could*) |
| B. Cinemática, apogeo, fases y tiempos | Vuelo y barra superior |
| C. Salud, calibraciones, enlaces y checklist | Preparar, Enlace y Variables |
| D. Centro de comandos | Preparar, Comandos y Post-vuelo (sin "control mecánico", REG-01) |
| E. Interpolación y volcado | Todo lo animado; Gráficas y Post-vuelo |
| F. Gráficas personalizables y relay web | Gráficas; el estado del reenviador en la barra |
| G. QR, LKP, vector y alarma de descenso | Recuperación y Alarmas |

## 9. Preguntas para refinar

1. **Prioridad:** con la misma gente, ¿qué va primero: el **mínimo de operación** o la **web pública**? Propongo el mínimo de operación primero, porque es el que se usa en la rampa y en la recuperación; la web después.
2. **Puesto de la estación:** ¿cuántos portátiles, pantallas y operadores? ¿Uno solo para los dos cohetes, o uno por cohete? ¿Hay segundo monitor?
3. **¿Comandos desde el dashboard?** *Objetivos* 7.D lo pide; DP-15 deja la CLI como la vía obligatoria. Propongo las dos, con la CLI de respaldo.
4. **Confirmación de los comandos críticos:** ¿escribir el nombre de la misión (como en la CLI), mantener presionado, o que lo confirme una segunda persona?
5. **Sol:** ¿operan al aire libre? ¿Agregamos un "modo sol" claro y de alto contraste?
6. **¿Alarmas sonoras?**
7. **Mapa:** ¿basta el mapa vectorial offline, o necesitan **imagen satelital offline** para guiar la recuperación en el monte?
8. **"Todas las variables":** ¿incluye el hexadecimal de los paquetes y los contadores del módem (propuesto)? ¿Exportar a CSV en el campo?
9. **El 3D en operación:** *Objetivos* 7.A pide la trayectoria 3D y el modelo con actitud. ¿Lo dejamos como *could*, igual que en la web, con la actitud 2D y el perfil de altitud como respaldo?
10. **¿Se lanzan los dos cohetes casi al mismo tiempo, o con minutos de diferencia?** Cambia si la vista principal muestra los dos lado a lado o uno grande y el otro pequeño.
11. **¿Quién lo construye?** Propongo los mismos carriles: E (tú) la parte visual y los comandos, y D (Jerónimo) los datos, el inspector y el diagnóstico. Jerónimo ya va cargado (R-W7).
12. **¿Quién sirve el dashboard?** Propongo que el servidor local de C-05 (Jerónimo) sirva `gui/web/dist/operacion/` como archivos estáticos. Hay que acordarlo con él.
