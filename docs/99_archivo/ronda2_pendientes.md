# Pendientes justificados — Software Hermes + Demeter

Actualizado: 2026-10-24. Lanzamiento de Categoría 3: **8 de noviembre** (faltan 15 días). No hay vuelo de prueba antes.
Origen: [[respuestas_preguntas_abiertas]], [[estados_mision_principal]], [[transmision_cohete_tierra]], *Objetivos_Sistemas.pdf* y *Tabla_componentes.xlsx*.

Cada punto trae tres partes: **qué falta**, **por qué importa para el software** y **qué propongo**.
Prioridad: **P0** = sin esto no se puede escribir o probar el código · **P1** = hay que resolverlo antes de integrar · **P2** = puede esperar.
Responsable: **Nos.** = lo decidimos Jerónimo y yo · **Hw** = quien hizo el hardware o la electrónica · **PT** = Pablo Tilano, autor de *Objetivos*.

---

## A. Enlace LoRa y TDMA ([[transmision_cohete_tierra]])

### A1. El paquete de 63 bytes no cabe en un slot de 25 ms — **P0 · Nos.**

Con la configuración de la nota (SF7, BW 250 kHz, CR 4/5, preámbulo de 8, cabecera explícita y CRC), **un paquete de 63 bytes tarda unos 59 ms en el aire**.
Eso es más del doble del slot de 25 ms. El paquete de Demeter (que empieza en 25 ms) seguiría en el aire cuando arranca el de Hermes (50 ms), así que **chocan en cada ciclo**.
Aunque no hubiera slots, dos cohetes a 10 Hz ocuparían el 118 % del canal, y eso es físicamente imposible.

Tiempo en el aire calculado con la fórmula del datasheet del SX1262:

| Configuración | 63 B | 50 B | 40 B | ¿Cabe en 25 ms con margen? |
| --- | --- | --- | --- | --- |
| SF7 / BW250 (la actual) | 59,0 ms | 48,8 ms | 41,1 ms | No |
| SF7 / BW500 | 29,5 ms | 24,4 ms | 20,5 ms | Solo con ≤ 40 B |
| SF6 / BW500 | 16,9 ms | 14,4 ms | 11,8 ms | Sí |
| SF5 / BW500 | 9,7 ms | 8,1 ms | 6,9 ms | Sí, con mucho margen |
| SF5 / BW250 | 19,5 ms | 16,3 ms | 13,7 ms | Justo |

- **Por qué importa:** es la base de toda la telemetría y de la estación compartida. Si se codifica así, nada llega limpio cuando los dos cohetes están encendidos.
- **Propongo:**
  - Pasar a **SF6 o SF5 con BW 500 kHz**.
  - Dejar dentro de cada slot un margen de guarda de 2 a 3 ms, para el cambio entre TX y RX y la deriva del reloj.
  - Bajar SF y subir BW reduce el alcance. Aun así, para distancias de unos pocos km con +22 dBm y antenas de 4 y 5,5 dBi, el margen debería sobrar. Hay que **confirmarlo con una prueba de alcance en tierra**, que sí se puede hacer sin lanzar.
  - Otra opción, si no se quiere cambiar la modulación, es bajar a **5 Hz**, que *Objetivos* permite, con slots de 50 ms.

### A2. 63 bytes contra el límite de "menos de 50 bytes" de *Objetivos* — **P0 · Nos. + PT**

*Objetivos* (4.2) exige que el paquete pese menos de 50 bytes; [[transmision_cohete_tierra]] define 63. Hay que decidir cuál de los dos manda.

- **Por qué importa:** cambia el formato que tienen que entender el firmware, la estación y la GUI. Cambiarlo después obliga a tocar las tres cosas.
- **Ideas para ahorrar bytes**, sin perder información:
  - El timestamp UTC de 8 B puede ser de 4 B, contando los ms desde el inicio de la misión.
  - `mission_id` (4 B) no necesita viajar en cada paquete.
  - `rocket_id` cabe en 1 B en lugar de 2.
  - Se puede **separar en dos paquetes**: uno rápido de navegación a 10 Hz y uno lento de estado a 1 Hz con batería, temperaturas, salud de sensores, satélites, etc.

### A3. Falta un byte de tipo y versión de paquete — **P0 · Nos.**

Por el mismo canal van a pasar telemetría, comandos de subida, confirmaciones (ACK) y volcado post-vuelo. Con el struct actual, quien recibe un paquete no tiene cómo saber de cuál se trata.

- **Propongo:** una cabecera común de 1 a 2 bytes con tipo de paquete, versión del formato e ID del cohete, al inicio de **todos** los paquetes.

### A4. Escalas, unidades y campos sin definir — **P1 · Nos.**

| Campo | Problema | Hay que decidir |
| --- | --- | --- |
| `q_w..q_z` (int16) | No se dice la escala. | Por ejemplo, ×32767 (que el valor 1,0 sea 32767). |
| `gyro_*_cdegps` (int16) | En centésimas de °/s se satura en **±327 °/s**. Un cohete puede girar más rápido en roll, y el LSM6DSO32 llega a 2000 °/s. | Usar décimas de °/s (±3276 °/s). |
| `altitude_cm` | No dice si es sobre el nivel del mar o sobre la rampa (Santa Fe de Antioquia está a unos 550 m). | La referencia. |
| `latitude/longitude` | ¿Salen del GNSS crudo o del EKF? *Objetivos* pide EKF. | La fuente. |
| `nav_correction_cm` | No se define qué es. ¿La innovación INS-GNSS que aparece en el Excel? | El significado. |
| `rpi_temp_c` | Hermes no tiene Pi. | Un valor centinela para "sin dato", por ejemplo -128. |
| `crc16` | LoRa ya trae CRC por hardware (ON). | ¿Se mantiene para el volcado y la persistencia, o se ahorran esos 2 B? |
| `mission_secondary_state` | No se define. | Ver B4. |

- **Por qué importa:** si la estación interpreta mal una escala, muestra datos absurdos sin dar ningún error.

### A5. La sincronización TDMA cuando no hay fix GNSS — **P0 · Nos.**

Los slots dependen de la hora del GNSS. Hay al menos tres momentos en que puede no haber fix:
- al encender en la rampa;
- dentro del fuselaje, según el material;
- durante el impulso, porque el receptor puede perder el seguimiento con aceleraciones altas.

- **Por qué importa:** si un cohete no tiene hora, ¿no transmite nunca?, ¿o transmite cuando quiera y le pisa el slot al otro?
- **Propongo:**
  1. Que la estación transmita un **beacon en su slot 0**, y que los cohetes sin fix se sincronicen con él.
  2. Que el ESP32 mantenga los slots con su reloj local mientras el GNSS está caído. La deriva en unos segundos es despreciable.
  3. Definir qué hace el cohete si no tiene ninguna de las dos referencias.

### A6. El radio de la estación y el uplink — **P1 · Hw / Nos.**

- La T-Beam V1.2 se vende con **SX1276** o con **SX1262**. El Excel dice SX1262, pero hay que **verificarlo en la placa física**. El SX1276 no soporta SF5 ni SF6 (que es lo que propone A1) y además maneja el sync word de otra forma.
- Faltan los comandos de subida:
  - Hay que definir la lista: armar, recalibrar, encender o apagar la Pi, system check, etc.
  - Cada comando debe llevar a qué cohete va, y el cohete debe responder con un ACK en su slot.
  - Un comando no puede tardar más de 25 ms en el aire.

---

## B. Máquina de estados ([[estados_mision_principal]])

Los 10 estados de la nota reemplazan a los 4 de *Objetivos* y a los 5 de la GUI. **Pido confirmar con Pablo Tilano que esta es la definición oficial.**

### B1. Criterios de transición — **P0 · Nos.**

La lista de estados está, pero falta **cuándo se pasa de uno a otro**. Sin eso el firmware no se puede escribir, y sobre todo no se puede probar sin lanzar.
Lo que sigue es una propuesta inicial. Los umbrales concretos salen de la simulación (ver F1).

| De → A | Señal propuesta | Por definir |
| --- | --- | --- |
| BOOT → PREFLIGHT | Sensores inicializados y la SD montada | ¿Qué pasa si un sensor falla? |
| PREFLIGHT → ARMED | Comando ARM desde tierra y checklist Go/No-Go en verde | ¿Se requiere fix GNSS? |
| ARMED → BOOST | Aceleración axial mayor que un umbral durante N ms | El umbral y la ventana, que sale del empuje del motor |
| BOOST → COAST | La aceleración cae (fin del motor) | Cuánto tiempo sostenido |
| COAST → APOGEE | Vz ≈ 0 en el BMP581, verificado con la IMU (lo pide *Objetivos*) | Histéresis |
| APOGEE → FREE_FALL | Vz negativa y creciendo | — |
| FREE_FALL → DESCENT | **Choque de la eyección** (pico de aceleración) y Vz estable | Ver B2 |
| DESCENT → LANDED | Vz ≈ 0 y 1 g estático sostenido (lo pide *Objetivos*) | Cuánto tiempo |

- Para cada transición conviene también un **respaldo por tiempo**, por si el sensor falla. Por ejemplo: forzar LANDED X segundos después del despegue.

### B2. Por qué necesitamos el retardo del motor (respuesta a tu pregunta 4.3) — **P1 · Hw**

El paracaídas no lo abre nuestro software: lo abre la carga de eyección, al final del motor **más el retardo** (7 s en el G80-7T, 14 s en el H135W-14A). Eso tiene cuatro efectos directos en el código:

1. **FREE_FALL dura lo que haya entre el apogeo y la eyección.** Si el retardo es mayor que el tiempo al apogeo, el cohete cae en balística varios segundos y a buena velocidad. Si es menor, **la eyección ocurre durante COAST**, antes del apogeo. La máquina de estados tiene que aguantar los dos órdenes sin bloquearse.
2. **La alarma de descenso de la GUI** (más de 10 m/s, *Objetivos* 7.G) se activaría por error durante toda la caída libre normal. Solo debe evaluarse en DESCENT, o después del tiempo de eyección esperado.
3. **La Pi de Demeter** arranca la captura RAW en el apogeo. Si la eyección llega después, el choque cae en plena grabación: conviene saber cuándo esperarlo.
4. **Los respaldos por tiempo** de B1 se calculan con estos números.

- **Qué necesito:** el motor de cada cohete y, de la simulación, el tiempo al apogeo y el tiempo de eyección. No hay que tomar ninguna decisión de diseño: solo nos pasan los números.

### B3. ¿ERROR es un estado o un indicador? — **P1 · Nos.**

Si ERROR es un estado y algo falla en pleno BOOST, el sistema "sale" del vuelo y se pierde la noción de la fase en la que va.

- **Propongo:**
  - Que el error sea **un indicador (bitmap de fallas) aparte de la fase**: el cohete sigue en BOOST, pero reportando "BMP581 caído".
  - Dejar ERROR como estado solo para el caso "no puedo operar" en tierra, por ejemplo una falla en BOOT o en PREFLIGHT.

### B4. ¿Qué es `mission_secondary_state`? — **P1 · Nos.**

- **Propongo:** que sea el estado del módulo adicional. Para Demeter sería el `StatusCode` que reporta la Pi por UART (BOOT, READY, RECORDING…); para Hermes, 0 o "no aplica".

### B5. Qué evento le avisa a la Pi de Demeter — **P1 · Nos. (con Jerónimo)**

La Pi espera los comandos PREFLIGHT, ARM, START_ASCENT, START_REC y TOUCHDOWN por UART. Hay que fijar en qué transición los manda la LilyGO, y **cuándo se da el pulso de 1,5 s que la enciende**.

- **Por qué importa:** la Pi tarda varios segundos en arrancar. Si se enciende al detectar BOOST, no habrá video del ascenso.
- Este es el único punto del firmware que cambia entre Hermes y Demeter.

### B6. Reinicio del ESP32 en pleno vuelo — **P0 · Nos.**

Si se cae la batería un instante, o el watchdog reinicia el ESP32 en pleno vuelo, el firmware arranca en BOOT y "cree" que está en la rampa.

- **Propongo:**
  - Guardar la fase actual en memoria que sobreviva al reinicio (memoria RTC o NVS).
  - Al arrancar, revisar si veníamos volando antes de pasar a PREFLIGHT.

---

## C. Hardware que condiciona el firmware

### C1. Qué sensor va en qué bus — **P0 · Hw** (no está en los documentos)

*Objetivos* fija varias cosas:
- I2C0 (SDA 17, SCL 18) para la OLED, el magnetómetro y el barómetro;
- I2C1 (SDA 42, SCL 41) para el PMIC y el RTC;
- un SPI interno para la IMU de la placa y la SD;
- un "SPI externo aislado" para los sensores rápidos.

Pero no dice **qué sensor externo va en cuál**. Hay además un problema de fondo:
- **El ESP32-S3 tiene solo dos controladores SPI de uso general** (SPI2 y SPI3); los otros dos se usan para la flash y la PSRAM.
- En la T-Beam Supreme uno ya lo usa el LoRa y otro la IMU de la placa con la SD.
- Por eso el "SPI externo aislado" **no tiene un controlador libre**. Hay que verificarlo con el esquemático de LilyGO.

- **Por qué importa:** el LSM6DSO32 a 1–3,33 kHz casi exige SPI. Compartir bus con el LoRa o con la SD mete latencias justo en las tareas críticas.
- **Qué necesito:** el diagrama de conexiones real. ¿El LSM6DSO32, el BMP581 y el MMC5983MA van por I2C o por SPI? ¿En qué pines van sus CS y sus interrupciones?

### C2. El presupuesto de GPIO — **P1 · Hw**

Además de los buses, hacen falta pines para:
- las interrupciones del LSM6DSO32 (watermark del FIFO) y del BMP581 (FIFO), que *Objetivos* pide;
- el pulso hacia la Pi;
- la entrada de estado (cam=1);
- el PWM del buzzer.

- **Qué necesito:** el mapa de pines asignados. Si no existe, lo armamos juntos a partir del pinout de LilyGO.

### C3. El interruptor Hall DRV5032 sobre el pin EN — **P1 · Hw**

*Objetivos* dice que el imán "cerrará el circuito del pin EN". Pero:
- poner EN en bajo deja al ESP32 **en reset**, no apagado;
- el AXP2101 sigue alimentando y consumiendo;
- el DRV5032 por lo general pone su salida en bajo **cuando detecta el imán**.

- **Por qué importa:** define cuándo arranca el firmware (BOOT) y si el imán tiene que quedarse puesto o basta con pasarlo una vez.
- **Qué necesito:** saber cómo quedó conectado y qué variante del DRV5032 se compró.

### C4. La versión de la placa — **resuelto**

El Excel confirma que la T-Beam Supreme lleva **MAX-M10S**, no la versión con L76K.
Detalle menor: el Excel dice que el GNSS va por SPI, pero en la placa y en *Objetivos* va por **UART**.

### C5. El material del fuselaje y del CanSat — **P1 · Hw**

Si el cohete o la bahía son de **fibra de carbono**, o de algo con metal, **bloquean el LoRa y el GNSS**.

- **Por qué importa:** puede tumbar el enlace y la sincronización TDMA sin que haya ninguna falla de software.
- **Qué necesito:** el material, y dónde quedan las antenas (FPC de LoRa y GNSS) respecto al fuselaje.

---

## D. Herramientas y repo (las decidimos Jerónimo y yo)

### D1. El framework del firmware — **P0 · Nos.** (no está en el Excel)

- **Recomiendo PlatformIO con el core Arduino-ESP32.** Por debajo corre FreeRTOS, así que las tareas y el anclaje a núcleos que pide *Objetivos* siguen disponibles. Además ya hay librerías probadas para el SX1262 (RadioLib), el AXP2101 y los sensores.
- ESP-IDF da más control, pero con 15 días el costo de arrancar desde ahí es alto.
- La decisión es de ustedes dos.

### D2. Un repo compartido con un solo firmware — **P0 · Nos.**

- **Propongo un repo** con:
  - `firmware/`: el mismo código para los dos cohetes, configurado con `ROCKET_ID` y con el módulo VisionPack activado solo en Demeter;
  - `estacion/`: el receptor de la T-Beam V1.2;
  - `gui/`;
  - `visionpack/`: el código actual de la Pi;
  - `docs/`: esta bóveda de Obsidian.
- Hay que definir quién crea el repo, cómo se nombran las ramas y cómo se revisan los cambios entre los dos.

### D3. La tecnología de la GUI — **P1 · Nos.**

*Objetivos* pide retransmitir la telemetría por la web para jueces y público (7.F).

- **Propongo:**
  - Un backend local que lea la estación por serial y guarde todo en disco.
  - Una **interfaz web** que se sirva igual en el portátil y en el servidor remoto. Así se hace una sola interfaz, no dos.

### D4. El servidor remoto — **P2 · Nos.**

Hay dos opciones: hosteado o físico administrado por nosotros. Si es web, un hosting sencillo basta. Depende de D3.

---

## E. Volcado post-vuelo: opción A u opción B — **P1 · Nos.**

Estimación del volumen de datos:
- un vuelo de unos 2 minutos con la IMU a 1–3,3 kHz, el barómetro a 480 Hz, el magnetómetro, el GNSS y la salida del EKF genera del orden de **2 a 5 MB** en la SD;
- **los paquetes de 10 Hz del vuelo completo suman unos 75 kB.**

| | A: punto de acceso Wi-Fi | B: goteo por LoRa |
| --- | --- | --- |
| Datos completos (MB) | Segundos a minutos, de cerca | Decenas de minutos u horas, y con línea de vista |
| Rellenar los paquetes de 10 Hz que se perdieron | Sí | Viable: alrededor de un minuto |
| Si el cohete cae lejos o detrás de un obstáculo | No sirve | Sirve, si hay línea de vista |

- **Recomiendo:**
  - **A para los datos completos**, cuando se recupera el cohete.
  - **B solo para reenviar los paquetes de 10 Hz que se perdieron** en vuelo. Es lo que la GUI usaría para completar la gráfica, y cabe en un minuto.
  - Como B ocupa el canal, mientras el otro cohete vuela debería ir solo en su propio slot.

---

## F. Pruebas sin vuelo previo

### F1. Necesitamos la simulación como datos de prueba — **P0 · Hw**

No sabremos si la máquina de estados y el EKF funcionan hasta el día del concurso, **salvo que les pasemos un vuelo simulado**.

- **Qué necesito:** de OpenRocket, la exportación a CSV del vuelo de cada cohete: aceleración, altitud, velocidad y eventos contra el tiempo.
- No es para juzgar el diseño del cohete: es nuestro banco de pruebas, y de ahí salen los umbrales de B1.

### F2. Un plan de pruebas en tierra — **P1 · Nos.**

Propongo como mínimo:
1. **Reproducir el vuelo simulado** de F1 a través de la máquina de estados y el filtro.
2. **Prueba de alcance LoRa** con los dos cohetes transmitiendo al mismo tiempo, para validar A1 y A5.
3. **Prueba de integración completa** en el tiempo real de rampa: encendido con el imán, ARM desde tierra, 15 minutos de espera y batería.
4. **Volcado por Wi-Fi** después de una "misión" en el banco.
5. Con Demeter, **la Pi encendida desde la LilyGO** y la secuencia de comandos por UART.

---

## Fuera de nuestro alcance (lo llevan otros, pero lo necesitamos como dato)

- El motor y su retardo, y los tiempos simulados: B2 y F1.
- El material del fuselaje y la posición de las antenas: C5.
- El conexionado de los sensores: C1, C2 y C3.
- La masa del CanSat: no nos afecta, salvo que haya que quitar algo de electrónica.
