
Prioridad: **P0** = bloquea el vuelo o el diseño · **P1** = necesario antes de escribir código · **P2** = puede esperar.
Contexto: somos **Hermes**. Todo lo que hay en el repo es del equipo **Demeter**, con el que trabajamos coordinados.

---

  

## 1. Hermes vs. Demeter (lo primero)

  

- [x] **P0** ¿Qué tiene hoy Hermes? ¿Hardware comprado, diseño, documentos, algún código?
Ya el hardware y todo lo de diseno del cohete esta nosotros nos debemos de enfocar en hacer toda la parte de como se gestiona el software los datos y dzemas.

- [x] **P0** ¿Hermes usa la misma base de CanSat que Demeter (T-Beam Supreme + LSM6DSO32 + BMP581 + MMC5983MA)? La tabla dice "CANSATs" en plural.
Si exacto, se usa la misma estructura basica y el vision pack es un modulo adicional que se debe de integrar, que seria el software que lleva demeter. Lo que dice Cansats es porque lo
llevan los dos, es la base. El visionpack es adicional para demeter. Lo que hay en tierra sera una estacion compartida para ambos.

- [x] **P0** ¿Hermes lleva cámara o Raspberry Pi, o eso es solo de Demeter?
Eso es solo de demeter, sin embargo como te digo la base del software será la misma.

- [x] **P0** ¿*Objetivos_Sistemas.pdf* aplica a los dos equipos? ¿Quién lo escribió (el enlace apunta al SharePoint de Pablo Tilano)? ¿Es obligatorio o es una lista de deseos?
Si eso lo escribio pablo tilano, efectivamente aplica para ambos equipos pues trabajamos en la misma categoria y nuestra base de cohete y software sera la misma.

- [x] **P0** ¿El firmware de vuelo y la estación terrena se hacen en conjunto con Demeter, o cada equipo hace el suyo? ¿Quién programa en Demeter?
Se hace todo en conjunto, nosotros estaremos trabajando con otro companero que es de demeter, pero a fin de cuentas el software que vamos a crear es el mismo, trabajaremos sobre el
mismo repo y demas.

- [x] **P1** ¿Cada equipo tiene su propio cohete, o los dos CanSat van en el mismo? ¿Cómo se llama cada cohete?
Cada equipo tiene su propio cohete. Un cohete es hermes y otro demeter.

- [x] **P1** Si la estación es compartida, ¿cómo se distinguen los paquetes de cada CanSat (ID de equipo, frecuencias distintas)?
Si la estacion de tierra debe de ser capaz de recibir de ambos cohetes al tiempo, esto por diseno ya que los dos coehtes van a poder estar encendidos al tiempo y asi evitamos
colisiones, lee: [[estados_mision_principal]] y [[transmision_cohete_tierra]]

- [x] **P2** ¿Le pasamos a Demeter la revisión de su código de la Pi? Tiene bugs que bloquean su vuelo.
SI en eso también debemos de trabajar.
  

## 2. Concurso y alcance

  

- [x] **P0** ¿"Avanzados" es la Categoría 3 (Universitarios)? ¿Está confirmada la inscripción de Hermes?
Si confiramada

- [x] **P0** ¿Tenemos los otros documentos oficiales 2026 que cita el DCP: **NSRT, PIC, CCRD, DCR, DMP, SPP y DCE**? En la web solo está el DCP. Sobre todo necesito el que define **cómo se puntúa la carga útil (CanSat)**.
No lo se pero eso no es nuestro problema, nuestro foco es el software, por mas que hagamos parte del concurso hay otros compañeros liderando que estan más enfocados en eso.

- [x] **P0** ¿Qué entregables (informes, revisiones de diseño, simulaciones) ya envió Hermes y cuáles faltan antes del 6 de noviembre?
No lo se pero eso no es nuestro problema, nuestro foco es el software, por mas que hagamos parte del concurso hay otros compañeros liderando que estan más enfocados en eso.

- [x] **P1** ¿Qué motor vamos a volar: **G80-7T, H135W-14A** o uno en cada vuelo? (La masa máxima de 1200 g está dada para el G80-7T.)
No lo se pero eso no es nuestro problema, nuestro foco es el software, por mas que hagamos parte del concurso hay otros compañeros liderando que estan más enfocados en eso.

- [x] **P1** ¿Compramos el altímetro oficial (Jolly Logic, 9,9 g) o lo entrega la organización? ¿Dónde va montado?
El altimetro es el que diga nuestra documentación la verdad no lo sé. Creo que nos lo da la organización, pero no es algo que nos importe.

  

## 3. Masa y arquitectura física

  

- [x] **P0** ¿Qué lleva el CanSat de Hermes y cuánto pesa? Debe quedar entre **250 y 300 g**: si falta, se completa con lastre.
Tu lo puedes revisar de acuerdo a los componentes que hay sin embargo esto no es tanto nuestro problema, somos mas que todo software.

- [x] **P0** ¿Existe el cohete de Hermes? ¿Quién lo construye y cuál es el diámetro interno de la bahía de carga útil?
SI seguramente existe pero de nuevo no es cosa nuestra

- [x] **P1** El reglamento exige que todas las partes desciendan juntas y que la recuperación sea solo por la eyección del motor. ¿El CanSat se queda dentro del cohete todo el vuelo?
Si probablemente, pero de nuevo esto no es nuestro problema somo software.

  

## 4. Vuelo y tiempos

  

- [x] **P0** ¿Hay simulación de **OpenRocket** del cohete de Hermes? Necesito: tiempo al apogeo, altitud de apogeo, velocidad al salir del riel (mínimo 55 km/h), margen de estabilidad (mínimo 2,0) y velocidad de descenso (máximo 11 m/s).
De nuevo no nos importa, nosotros somos los que programamos que todo este conectado, si aterriza o no no nos preocupa. Se hará simulación y pruebas físicas pero no lanzamiento.

- [x] **P0** ¿Habrá un vuelo de prueba antes del 8 de noviembre? Si no, ¿habrá al menos una prueba de banco completa?
De nuevo no nos importa, nosotros somos los que programamos que todo este conectado, si aterriza o no no nos preocupa. Pero no no se va a lanzar antes.

- [x] **P1** El paracaídas se abre por el **retardo del motor** (7 s en el G80-7T, 14 s en el H135W-14A). ¿Ese retardo coincide con el apogeo simulado?
Esto puede quedar como pendiente si me justificas para que se necesita saber


  

## 5. Firmware de la T-Beam Supreme (si Hermes la usa)

  

- [x] **P0** ¿Tenemos la placa física? ¿Qué versión exacta es? El GNSS cambia entre versiones (MAX-M10S o L76K).
Esto esta en el excel de componentes

- [x] **P0** ¿Con qué framework se trabaja: Arduino, PlatformIO o ESP-IDF? ¿Igual que Demeter?
Esta en el excel de componentes

- [x] **P1** Buses: *Objetivos_Sistemas* pone el barómetro y el magnetómetro en I2C0, pero también pide los sensores externos rápidos en un SPI aislado. ¿Qué sensor va en qué bus y en qué pines?
Si no puedes encontrar en los docs esta respuesta dejala en una nueva lista de pendientes mejor justificadas y explicadas.

- [x] **P1** ¿Están comprados el interruptor Hall DRV5032 y el buzzer?
Si todo ya esta comprado.

- [x] **P1** Máquina de estados: el firmware define 4 fases (Rampa, Ascenso, Costeo, Aterrizado), pero la interfaz de tierra muestra 5 (agrega Descenso). ¿Cuál es la definición oficial?
Dejala en pendiente para justificarmela mejor en la nueva lista

- [x] **P1** ¿Qué configuración LoRa se usa (SF, BW, potencia)? Mandar 10 Hz con menos de 50 bytes exige un SF bajo, y si dos CanSat comparten canal, se duplica la ocupación.
Segun las otras preguntas lo mismo que las anteriores, si aun no quedo resuelto quiero que 

- [x] **P2** Para el volcado post-vuelo, ¿opción A (punto de acceso Wi-Fi) u opción B (goteo por LoRa)?
Lo debemos de decidir nosotros

  

## 6. Estación terrena

  

- [x] **P1** ¿Quién hace la interfaz gráfica y con qué tecnología: Python, web o Unity? ¿Es compartida con Demeter?
Nosotros y si es compartida con demeter

- [x] **P1** ¿Tendremos portátil, Starlink y servidor remoto en Santa Fe de Antioquia? ¿Quién los aporta?
Tendremos portatil, starlink y el servidor remoto pues lo podemos hostear donde sea mas facil, aunque existe la alternativa de uno fisico administrado por nosotros mismos.

  

## 7. Equipo

  

- [x] **P0** ¿Quiénes son los integrantes de Hermes y cuál es el rol de cada uno? ¿Quién más programa?
Solo yo programo y mi compañero de Demeter es Jeronimo.

- [x] **P1** ¿Hay un repositorio o carpeta compartida? Propuesta: un repositorio git de Hermes, y otro compartido con Demeter si el firmware o la estación son comunes.
No aun no hay repo

  

## Referencia: preguntas sobre el VisionPack de Demeter

  

Solo importan si Hermes integra algo con la Pi de Demeter o si queremos ayudarles.

  

- ¿Dónde están `demeter_flight.sh`, `demeter_rec.cpp`, `demeter_ingestd.sh`, `demeter_postprocess.py` y las unidades systemd?

- ¿En qué fase se enciende su Pi? Si se enciende al detectar el despegue, no habrá video del ascenso.

- ¿Su Pi 5 + UPS + 2× 18650 cabe en su presupuesto de 250–300 g?