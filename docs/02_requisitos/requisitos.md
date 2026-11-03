---
id: requisitos
estado: vivo
actualizado: 2026-11-03
fuentes: [Objetivos_Sistemas.pdf (Pablo Tilano), DCP 2026, respuestas del usuario 2026-10-24]
---
# Requisitos con ID

Traducción de *Objetivos_Sistemas.pdf* y del reglamento a requisitos que se pueden verificar.
- **Prioridad:** M = obligatorio para volar · S = debería estar · C = si da el tiempo.
- **Estado:** vigente · modificado (dice por qué decisión) · fuera de alcance.
- **Qué falta para cumplir cada uno, y con qué tarea:** [brechas_objetivos](../05_plan/brechas_objetivos.md) (2026-11-03).
- Toda tarea del [backlog](../05_plan/backlog.md) y toda prueba del [plan de pruebas](../05_plan/plan_pruebas.md) se refiere a estos ID.

## Reglamento (DCP 2026) que afecta al software

| ID | Requisito | Prioridad | Estado |
| --- | --- | --- | --- |
| REG-01 | Ningún sistema electrónico despliega la recuperación ni hace control activo | M | Vigente. No hay comandos de actuadores de recuperación. |
| REG-02 | Integración en rampa en ≤ 15 min, incluido el encendido y el ARM | M | Vigente (prueba P-07) |
| REG-03 | El motor lo instala el Comité. El software no puede depender de manipular el cohete después de la integración. | M | Vigente |

## Hardware y energía (*Objetivos* 3)

| ID | Requisito | Prioridad | Estado |
| --- | --- | --- | --- |
| HW-01 | Encendido con el interruptor Hall DRV5032 | M | Modificado por D-042: el DRV5032 en IO21 despierta del sueño profundo (reemplaza D-031). Cumplido |
| HW-02 | Configurar los canales del AXP2101 en el arranque y reportar el % de batería | M | Vigente |
| HW-03 | Pulso de 1,5 s para encender la Pi y otros dispositivos | M (Demeter) | Modificado por D-042: el MOSFET de IO45, en paralelo a J2; falta el firmware (T-413) |
| HW-04 | Entrada GPIO de estado (`cam=1` o `actuador_ok`) incluida en la telemetría | S | Por UART de la Pi (T-702) |
| HW-05 | Buzzer por PWM solo al confirmar el aterrizaje | M | Vigente: falta el firmware (T-413) y la detección del aterrizaje (T-412) |
| HW-06 | I2C0 17/18 para OLED, magnetómetro y barómetro de la placa; I2C1 42/41 para PMIC y RTC; UART para el GNSS | M | Vigente |
| HW-07 | Los sensores externos no comparten el SPI de los componentes internos | M | **Cumplido (D-042):** el LSM va por un SPI por software propio, y el BMP por su hub |

## Datos y transmisión (*Objetivos* 4)

| ID | Requisito | Prioridad | Estado |
| --- | --- | --- | --- |
| DAT-01 | Procesamiento multihilo: el registro masivo va separado del enlace | M | Vigente (firmware_vuelo §2) |
| DAT-02 | Todo lo crudo y lo calculado se guarda en la SD | M | Vigente (§6) |
| DAT-03 | LSM6DSO32 a 1–3,33 kHz con IRQ de watermark y lectura en ráfaga | M | Cumplido (1,6 kHz, D-042) |
| DAT-04 | BMP581 a 240–480 Hz con IRQ del FIFO | M | **Modificado por D-042:** ≈ 100 Hz por el hub del LSM (decisión de Pablo, por la sincronía con el INS) |
| DAT-05 | MMC5983MA a 100 Hz | M | Vigente |
| DAT-06 | GNSS a 10 Hz | M | Vigente |
| DAT-07 | Telemetría LoRa a 5–10 Hz, binaria, < 50 B | M | Modificado por D-039: TELEM de 64 B a 10 Hz en vuelo y 2 Hz en tierra |
| DAT-08 | El paquete lleva lat, lon y alt del EKF, aceleración y velocidad promediadas, cuaterniones, fase, batería y estado de los subsistemas | M | Vigente: falta el EKF, la altura barométrica, la salud y la acel. promediada (T-414, T-417, T-420) |
| DAT-09 | Volcado post-vuelo | S | Modificado: descarga por USB (`tbget.py`); goteo por LoRa en RECOVERY (T-423) |
| DAT-10 | **Caracterizar el motor** (objetivo del CanSat, dicho por el usuario) | S | Nuevo (D-021) |

## Navegación (*Objetivos* 5)

| ID | Requisito | Prioridad | Estado |
| --- | --- | --- | --- |
| NAV-01 | Madgwick con IMU y magnetómetro, salida en cuaterniones | S | Modificado: lo cubre el EKF de Pablo (actitud incluida), a bordo con T-420 |
| NAV-02 | EKF que fusione la IMU (1 kHz), el baro y el GNSS (10 Hz) | S | Vigente: `ekf.py` en PC; a bordo con T-420 |
| NAV-03 | Pesos dinámicos según la fase (en el impulso, más peso a la inercial) | C | Vigente |
| NAV-04 | Apogeo por la Vz del BMP581, verificada con la IMU | M | Vigente: momento APOGEO (T-412) |
| NAV-05 | Fix GNSS obligatorio para armar y origen absoluto inicial | M | Nuevo (usuario) |

## Estación terrena (*Objetivos* 6 y 7)

| ID | Requisito | Prioridad | Estado |
| --- | --- | --- | --- |
| GS-01 | La estación recibe a los dos cohetes al mismo tiempo, sin colisiones | M | Vigente (TDMA) |
| GS-02 | Distancia, azimut y elevación desde la estación (WGS84) | M | Vigente |
| GS-03 | LKP: nunca se borra la pantalla y se resalta la última posición | M | Vigente |
| GS-04 | Coordenadas grandes y un QR de Google Maps | S | Vigente |
| GS-05 | Alarma de descenso rápido (> 10 m/s) | S | Modificado: solo en DESCENT (D-014) |
| GS-06 | Go/No-Go con el estado de los sensores, las calibraciones, el RSSI, los satélites y la batería | M | Vigente |
| GS-07 | Uplink: ARM, recalibrar, system check y encender o grabar con la Pi | M | Vigente: falta recalibrar (T-425) y la Pi (T-413, T-702) |
| GS-08 | Interpolación en vivo y reconstrucción con backfill y volcado | S | Vigente |
| GS-09 | Vista 3D de la trayectoria y de la actitud | S | Vigente |
| GS-10 | Mapa 2D con elipse de impacto | S | Vigente |
| GS-11 | Gráficas personalizables | C | Vigente |
| GS-12 | Retransmisión web pública | S | Vigente (estacion_terrena) |
| GS-13 | Tiempos estimados: al apogeo, de vuelo restante y de la siguiente fase | C | Vigente |
| GS-14 | Ningún comando desde internet | M | Nuevo (D-025) |
