---
id: estacion_terrena
estado: propuesta para conversar (D3). El contrato con la radio y la seguridad del uplink están aprobados; la tecnología de la interfaz está abierta.
actualizado: 2026-10-24
depende_de: [enlace_lora_tdma, protocolo_paquetes, tbeam_v12_estacion]
decisiones: [D-024, D-025]
---
# Estación terrena, dashboard local y web pública

Lo que pide el usuario: **recibir los datos de los cohetes, enviarlos a un servidor con un frontend público y tener en local nuestro propio dashboard.**

## 1. Arquitectura propuesta

```
 Cohete Demeter ─┐  LoRa SF6/BW500, TDMA
 Cohete Hermes  ─┼──────────────────► T-Beam V1.2 "módem" ──USB serial──► Portátil: servicio de tierra
                 │  ◄── BEACON / CMD ──          (tonto)                      │  ├─ log crudo en disco (siempre)
                                                                              │  ├─ decodificación + estado por cohete
                                                                              │  ├─ dashboard local (web, offline) ◄── operador
                                                                              │  └─ reenviador ──Starlink──► Servidor remoto
                                                                              │                               ├─ ingesta autenticada
                                                                              │                               └─ frontend público (solo lectura)
```

## 2. Componentes

### 2.1 Firmware del módem (T-Beam V1.2) (D-024)

El módem es **tonto a propósito**: no interpreta el contenido de los paquetes, solo sus cabeceras, para el TDMA.

- Es el **maestro del TDMA:** manda un BEACON en el slot 0, o un CMD si el PC le pasó uno. Su sincronía viene del GNSS NEO-M8N con PPS (la placa enruta el TIME_PULSE al GPIO 37; **hay que verificarlo**).
- **Al recibir un paquete** con CRC LoRa válido, lo manda al PC con: bytes crudos, RSSI, SNR, `t_us` del RxDone, UTC estimada y slot estimado.
- **Al recibir un comando del PC**, lo guarda y lo transmite en el siguiente slot 0. Los reintentos los decide el PC.
- **Protocolo por USB:** la misma trama de la Pi, `AA 55 | tipo | len | payload | CRC16`, para reutilizar el decodificador. Los tipos se definen al implementar: `RX_PAQUETE`, `TX_PEDIDO`, `ESTADO_MODEM` y `LOG`.
  - La velocidad depende del chip USB-serial. Hay una contradicción entre CP2104 y CH9102 que se resuelve mirando la placa, pero 921600 baudios funcionan en los dos.
- Ventaja: si se cambia el formato de un paquete, **el módem no se toca**.

### 2.2 Servicio de tierra (portátil)

- **Python**, porque el equipo ya escribe en Python (el código de la Pi) y el decodificador del log de la SD también va en Python.
  - Propuesta: `pyserial` y un servidor asíncrono con WebSocket, por ejemplo FastAPI.
- **Siempre**, antes de cualquier otra cosa, guarda todo lo recibido en un **log crudo** que solo se agrega. Si algo falla después, los datos están.
- Decodifica según [protocolo_paquetes.md](protocolo_paquetes.md) y mantiene el estado de cada cohete:
  - último paquete, LKP, apogeo, pérdidas por `seq`;
  - el RSSI y el SNR de cada paquete.
- Hace los cálculos de *Objetivos* 6: distancia, azimut y elevación desde la estación; elipse de impacto; tiempos estimados.
- **Comandos:** recibe la orden del dashboard local, construye el CMD, lo reintenta hasta el ACK y avisa el resultado.
- **Reenviador:** manda el estado decodificado al servidor remoto por una conexión saliente (WebSocket o HTTPS).
  - Tiene una cola en disco y reintentos.
  - **Si se cae internet, no se afecta nada local.**

### 2.3 Dashboard local (operación)

- Una aplicación web servida por el servicio local. Funciona **sin internet**, así que los mapas deben ir **precargados**: hay que bajar los tiles de Santa Fe de Antioquia antes de viajar.
- Tiene todo lo de *Objetivos* 7: 3D, mapa 2D, LKP, QR, alarmas, Go/No-Go, centro de comandos, gráficas y backfill.

### 2.4 Servidor remoto y frontend público (D-025, parcial)

- **Ingesta** autenticada con un token compartido, que solo acepta datos del servicio de tierra.
- **Difusión** a los navegadores del público por WebSocket o SSE.
- El frontend público es **de solo lectura**: un subconjunto del dashboard con mapa, altitud, fase y gráficas de los dos cohetes.
- **Regla de seguridad (aprobada):** **desde internet no se puede mandar ningún comando a los cohetes.** El uplink solo nace en el dashboard local.
- **Hosting (D4):** no es urgente.
  - Lo único que sí hay que definir pronto es el **contrato de la ingesta**: el formato de los mensajes del reenviador, que conviene que sea el mismo JSON que usa el dashboard local.
  - El proveedor se elige en la semana final. Lo que no puede faltar es **una prueba de punta a punta por Starlink antes del cierre** (prueba P-08).

## 3. Temas para la conversación (D3)

1. ¿Una sola base de código del frontend con dos modos (operación y público), o dos aplicaciones? **Recomiendo una sola**, con las funciones de operación desactivadas en la versión pública.
2. ¿Qué *framework* web saben usar? Para la interfaz se puede usar algo simple: Leaflet para el mapa, three.js para la actitud 3D, y uPlot o Chart.js para las gráficas.
3. ¿Cuántos operadores habrá y en qué pantallas? (Por ejemplo, un portátil para los dos cohetes, o una pestaña por cohete.)
4. ¿El público ve los dos cohetes a la vez? ¿Los jueces necesitan alguna vista especial?
5. ¿Qué latencia aceptamos en la web pública? Propongo menos de 2 s.
6. ¿Se guardan los vuelos en el servidor para verlos después?

## 4. Fuera de alcance de la v1

- La recepción directa de la Pi o de Wi-Fi a la web. Todo pasa por el servicio de tierra.
- Que una misma estación tenga más de un módem.
