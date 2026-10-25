---
id: enlace_lora_tdma
estado: aprobado-v1
actualizado: 2026-10-24
depende_de: [protocolo_paquetes, constantes, sx1262, tbeam_supreme, tbeam_v12_estacion]
decisiones: [D-001, D-002, D-003, D-004]
---
# Enlace LoRa y TDMA

Este documento define **cómo comparten el canal los dos cohetes y la estación**: la modulación, los slots, la sincronización y qué hacer cuando no hay referencia de tiempo.
El contenido de cada paquete está en [protocolo_paquetes.md](protocolo_paquetes.md). Los números exactos están en [constantes.md](../02_requisitos/constantes.md); el código no debe repetirlos.

## 1. Configuración de radio (D-001)

| Parámetro | Valor | Antes (nota original) |
| --- | --- | --- |
| Radio | SX1262 en los tres nodos (la de la estación está confirmada) | — |
| Frecuencia | **Configurable**, por defecto `LORA_FREQ_MHZ` (919,0 MHz). Banda 902–928 MHz. | 915 MHz |
| Spreading factor | **SF6** | SF7 |
| Ancho de banda | **500 kHz** | 250 kHz |
| Coding rate | 4/5 | 4/5 |
| Preámbulo | 8 símbolos | 8 |
| Cabecera LoRa | Explícita, porque los paquetes tienen longitudes distintas | — |
| CRC LoRa | Activado | Activado |
| Sync word | 0xD3, convertido a los 2 bytes del SX126x con la función de RadioLib (ver ficha [sx1262](../03_hardware/componentes/sx1262.md)) | 0xD3 |
| Potencia TX | +22 dBm en los cohetes y en la estación (bajar en el banco de pruebas) | — |
| LowDataRateOptimize | Desactivado (no aplica con SF6 y BW 500) | — |

### Por qué SF6 con BW 500 es la opción más segura

El riesgo más grave no es el alcance, sino que **los paquetes se pisen en el tiempo**. Una colisión hace perder el paquete de los dos cohetes en cada ciclo, mientras que un enlace débil solo pierde paquetes sueltos. Por eso se ordenó así:

1. **Que sobre tiempo dentro del slot.** Un paquete NAV de 44 B tarda **13,1 ms** con SF6/BW500, y deja más de 9 ms libres en el slot de 25 ms. Las otras opciones:
   - SF7/BW500 tarda 23,1 ms con 44 B y no deja margen.
   - SF7/BW250, la configuración original, tarda 46 ms: no cabe.
2. **Que sobre margen de enlace.** Bajar de SF7 a SF6 cuesta unos 2,5 dB de sensibilidad, y pasar de BW 250 a 500 cuesta unos 3 dB.
   - Cálculo grueso: 22 dBm de TX, 4 + 5,5 dBi de antenas y 2 dB de pérdidas.
   - La pérdida en espacio libre a 3 km y 915 MHz es de unos 101 dB, así que llegan unos −72 dBm.
   - La sensibilidad con SF6/BW500 debería estar alrededor de −110 dBm. Es una estimación: **falta confirmarla con el datasheet de Semtech** (PEN-05), porque la ficha [sx1262](../03_hardware/componentes/sx1262.md) no pudo obtenerla.
   - Quedan unos 35 dB de margen para nulos de antena por la rotación del cohete y para obstáculos después del aterrizaje.
3. **Que nos afecten menos los otros equipos.** La mayoría de los ejemplos y equipos usan 915,0 MHz con SF7–SF12 y BW 125. Las señales LoRa con otro SF u otro BW son casi ortogonales: SF6/BW500 en otro canal reduce mucho las interferencias mutuas.
4. **Que encaje con la regulación.** BW 500 cumple el criterio de modulación digital de banda ancha que usan la FCC (15.247) y normas similares cuando no se hace salto de frecuencia. *Falta verificarlo contra la norma de la ANE* (ver [pendientes](../05_plan/pendientes.md)).
5. **Por qué no SF5**, aunque tarda la mitad (7,5 ms con 44 B): pierde otros ~2,5 dB de sensibilidad, y SF6 ya deja tiempo de sobra. SF5 queda como **plan B** si en la prueba de alcance el tiempo aprieta. Se cambia con una sola constante.
6. **Por qué no 5 Hz:** *Objetivos* acepta de 5 a 10 Hz, pero 10 Hz da mejor resolución en el apogeo y en la gráfica en vivo, y el canal lo permite.

### Ocupación del canal

| Emisor | Paquete típico | Tiempo en el aire | Por ciclo de 100 ms |
| --- | --- | --- | --- |
| Tierra (beacon) | 14 B | 6,7 ms | 1 |
| Demeter (NAV) | 44 B | 13,1 ms | 1 |
| Hermes (NAV) | 44 B | 13,1 ms | 1 |
| **Total** | | **≈ 33 ms (33 %)** | |

## 2. Ciclo TDMA (D-002)

- **Ciclo de 100 ms**, alineado a los múltiplos de 100 ms del **tiempo UTC del GNSS**: el ciclo empieza en el segundo exacto, en +100 ms, en +200 ms, etc.
- **4 slots de 25 ms.** El número de slot es igual al ID del nodo:

| Slot | Inicio | Nodo | ID |
| --- | --- | --- | --- |
| 0 | 0 ms | Estación terrena | 0 |
| 1 | 25 ms | Demeter | 1 |
| 2 | 50 ms | Hermes | 2 |
| 3 | 75 ms | Reserva. En vuelo nadie transmite aquí. | 3 |

- **Presupuesto de tiempo dentro del slot:**
  - se transmite en `inicio_slot + TDMA_GUARD_INICIO_MS` (2 ms);
  - el paquete tarda como máximo `TDMA_TOA_MAX_MS` (16 ms);
  - quedan al menos 7 ms de guarda al final.
- **Regla dura:** ningún paquete que vaya en un slot puede tardar más de 16 ms en el aire. Con SF6/BW500 eso es **≤ 60 B en total**. El firmware debe calcularlo con la función de RadioLib, y rechazar en compilación o en prueba cualquier tipo de paquete que lo supere.
- **Qué manda cada nodo en su slot:**
  - Un cohete manda **un solo paquete** por ciclo. Normalmente es NAV; cada 10 ciclos es STATUS, y cuando toca, ACK o BACKFILL (ver [protocolo_paquetes.md](protocolo_paquetes.md)).
  - La estación manda un BEACON, o un CMD cuando tiene un comando pendiente. El CMD también lleva la hora, así que sirve como beacon.
- **Recepción:** fuera de su propio slot, todos los nodos están en RX continuo. La estación recibe en los slots 1, 2 y 3; cada cohete escucha al menos el slot 0, para los comandos y el beacon.

## 3. Sincronización (D-003)

Cada nodo tiene una **fuente de sincronía** y la anuncia en la cabecera de todos sus paquetes (2 bits, ver [protocolo_paquetes.md](protocolo_paquetes.md)):

| Código | Fuente | Precisión esperada | Cómo se obtiene |
| --- | --- | --- | --- |
| 1 `GNSS` | PPS del propio GNSS, con hora válida | De µs a decenas de µs | El flanco del PPS marca el segundo UTC; la hora sale de UBX-NAV-PVT |
| 2 `DERIVADA` | Un paquete recibido de un nodo que está en `GNSS` | Menos de 1 ms (por validar en la prueba P-05) | inicio_ciclo = t_RxDone − ToA(paquete) − GUARD_INICIO − slot_emisor × 25 ms |
| 3 `HOLDOVER` | El reloj local (esp_timer) continúa la última fase conocida | Deriva ≤ 40 ppm, unos 4,8 ms en 120 s en el peor caso | Sin acción: se sigue contando |
| 0 `NINGUNA` | No hay referencia | — | Modo ALOHA (sección 4) |

**Prioridades:**

- **En un cohete:** `GNSS` propio, luego `DERIVADA` (de un BEACON o CMD cuya cabecera diga `GNSS` o `DERIVADA`), luego `HOLDOVER` durante un máximo de `TDMA_HOLDOVER_MAX_S` (120 s), y por último `NINGUNA`.
- **En la estación:** `GNSS` propio, luego `DERIVADA` (de un paquete de cohete que esté en `GNSS`), luego `HOLDOVER` durante 120 s.
  - Si llega a `NINGUNA`, la estación hace de **maestro libre**: define su propio ciclo y lo anuncia en sus beacons con fuente 0. Así, si ningún nodo tiene GNSS, todos siguen el reloj de la estación y el TDMA sigue funcionando.
- **Regla anticiclos:** un nodo solo se sincroniza con un paquete cuya fuente sea `GNSS` o `DERIVADA`.
  - Única excepción: un cohete **sin GNSS propio** puede seguir un beacon con fuente 0, porque en ese caso nadie tiene GNSS.
- **Cambio de referencia:** cuando un nodo pasa de una fuente peor a una mejor, ajusta su fase **entre ciclos**. Nunca recorta el slot actual.
- **Validación de la hora GNSS:** la hora del GNSS solo es válida cuando UBX-NAV-PVT la marca como válida (`validTime` y `fullyResolved`) y el fix es al menos 2D. Ver la ficha [max_m10s](../03_hardware/componentes/max_m10s.md).

> **Dependencia de hardware:** la fuente `GNSS` necesita el PPS conectado a un GPIO del ESP32 en las dos placas.
> Si no estuviera conectado, la hora del mensaje UART tiene una incertidumbre de decenas de ms y no sirve para slots de 25 ms. En ese caso los cohetes usarían `DERIVADA` del beacon, y la estación necesitaría su PPS.
> El estado de esta verificación está en [buses_y_pines.md](../03_hardware/buses_y_pines.md).

## 4. Modo sin referencia: ALOHA (D-004)

Un nodo pasa a `NINGUNA` cuando nunca tuvo referencia o cuando se le venció el holdover.

- **Un cohete en `NINGUNA`:**
  - transmite **a `ALOHA_TASA_HZ` (2 Hz), con un retardo aleatorio uniforme de 0 a 100 ms** antes de cada paquete, alternando NAV y STATUS;
  - el resto del tiempo escucha continuamente, a la espera de un beacon;
  - en cuanto vuelve a tener referencia, regresa al TDMA desde el ciclo siguiente.
- **Por qué no deja de transmitir:** perder la telemetría de un cohete en vuelo es peor que el daño que le hace al otro.
  - A 2 Hz, la probabilidad de pisar al otro cohete es baja: le haría perder ~3–5 % de sus paquetes.
  - Y el cohete en ALOHA mantiene la mayoría de los suyos.
- **Cuándo puede pasar:**
  - en la rampa antes del primer fix, pero no es grave, porque armar exige fix;
  - después de un reinicio en vuelo sin GNSS y sin beacon (ver [maquina_estados.md](maquina_estados.md), reinicio en vuelo).
  - Durante un vuelo normal no debería ocurrir, porque el holdover de 120 s cubre la pérdida de GNSS en el impulso y el beacon está disponible.
- **La estación nunca entra en ALOHA:** sin referencia hace de maestro libre (sección 3).

## 5. Recepción en la estación

- Para cada paquete recibido, la estación entrega por USB los bytes crudos, el RSSI, el SNR, el instante de RxDone y el slot estimado ([estacion_terrena.md](estacion_terrena.md)).
- Se descarta todo paquete cuyo CRC de aplicación, versión, tipo, longitud u origen no corresponda. Con esto se filtran los paquetes de otros equipos que pasen el sync word.
- Si un paquete llega en un slot que no le corresponde a su origen, **se acepta igual** y se marca para diagnóstico: puede ser un nodo en ALOHA o con la fase corrida.

## 6. Canal y operación en campo

- La frecuencia se elige de una tabla `LORA_CANALES` en [constantes.md](../02_requisitos/constantes.md), y **se fija antes de ARM**:
  - por configuración compilada;
  - o por el comando `SET_CANAL`, que solo se acepta en PREFLIGHT.
- Antes de la integración se escucha el canal con la estación durante un minuto. Si hay actividad, se cambia de canal: los tres nodos deben quedar en el mismo.
- **No se cambia de canal en vuelo.**
