---
id: plan_maestro
estado: vivo
actualizado: 2026-10-24
depende_de: [backlog, plan_pruebas, riesgos, pendientes]
---
# Plan maestro: del 24 de octubre al 8 de noviembre de 2026

- **Tiempo útil de desarrollo:** del 25 de octubre al 5 de noviembre (12 días). El 6 y el 7 de noviembre se va en el viaje, la inspección y el ensayo en el sitio. **El 8 de noviembre es el vuelo de la Categoría 3.**
- **Equipo:** Juan Pablo y Jerónimo, con agentes de IA. No hay vuelo de prueba.

## 1. El mínimo para volar (lo que tiene que estar sí o sí el 8 de noviembre)

Si todo se atrasa, **esto es lo único que no se negocia**. Todo lo demás se recorta antes.

1. **Log completo en la SD:** todos los sensores principales a la tasa de vuelo, sin pérdidas, desde el pretrigger hasta LANDED.
2. **Máquina de estados correcta**, con el estimador vertical: despegue, fin de la combustión, apogeo, eyección y aterrizaje. Validada con replay de vuelos (P-03).
3. **Telemetría NAV/STATUS en TDMA** desde los dos cohetes, sin colisiones, recibida por el módem.
4. **Servicio de tierra:** log crudo, decodificación, y un dashboard con números, fase, mapa con LKP, Go/No-Go y ARM/DISARM.
5. **Buzzer** al aterrizar.
6. **Demeter:** los bugs bloqueantes de la Pi corregidos, la secuencia UART completa y la Pi encendida antes del despegue.

**Debería estar:** EKF 3D, Madgwick, vista 3D, elipse de impacto, QR, web pública, backfill, volcado por Wi-Fi y alarma de descenso.
**Si da el tiempo:** pesos dinámicos del EKF, gráficas personalizables, `SET_CANAL` remoto, backfill por rangos.

## 2. Fases e hitos

| Fase | Fechas | Objetivo | Hito de salida (criterio objetivo) |
| --- | --- | --- | --- |
| **F0. Cierre de diseño y arranque** | 25–26 oct | Resolver los pendientes P0 con Pablo; crear el repo; tener la cadena de herramientas lista | **H0:** repo creado · compilan los 3 environments · P-01 en verde (cada sensor responde en su bus) · PPS medido en las dos placas · ping LoRa SF6/BW500 entre la Supreme y la V1.2 · D-022 cerrada |
| **F1. Datos** | 27–29 oct | Drivers, adquisición y log; módem y servicio de tierra básicos; bugs de la Pi | **H1:** P-02 en verde (tasas de vuelo sin pérdidas durante 10 min con la SD de vuelo) · NAV de dos placas decodificado en el PC · bloqueantes 1–4 de la Pi corregidos |
| **F2. Inteligencia** | 30 oct – 1 nov | Estimador vertical, máquina de estados, TDMA completo y comandos; dashboard mínimo; UART de la Pi | **H2:** P-03, P-04, P-05 y P-10 en verde · ARM/DISARM desde el dashboard · P-09 en verde |
| **F3. Integración** | 2–3 nov | Pruebas de sistema; EKF, Madgwick y web si vamos en tiempo | **H3:** P-06, P-07, P-11 y P-12 en verde · dos ensayos de misión completos con los dos cohetes encendidos a la vez · P-08 si está la web |
| **F4. Congelamiento** | 4–5 nov | **Se congela el código el 4 de noviembre a las 12:00.** Después, solo correcciones de bugs que tengan una prueba que los demuestre. | **H4:** versión etiquetada · placas de repuesto con el firmware cargado · checklists impresos · mapas offline · ensayo final |
| **Campo** | 6–8 nov | Inspección, escaneo del canal, ensayo en el sitio y vuelo | Vuelo, recuperación, volcado y análisis |

## 3. Rutas críticas

1. **Vuelo:** D-022 (buses) → drivers (T-101..T-104) → la tarea de sensores (T-107) → log (T-201) → P-02 → estimador (T-301) → máquina de estados (T-401) → P-03 → P-07.
2. **Enlace:** el contrato de protocolo (aprobado) → TDMA (T-501) + el módem (T-601) → el servicio de tierra (T-602) → el dashboard mínimo (T-603) → P-05 y P-06.
3. **Demeter:** las correcciones de la Pi (T-701) → la UART en la LilyGO (T-702) → el circuito de encendido (T-703) → P-09.

**Hay que desbloquear ya** (ver [pendientes](pendientes.md)) D-022 y el mapa de pines con Pablo: **sin eso no empieza la ruta 1**.

## 4. Reparto sugerido (para decidir con Jerónimo)

| Persona | Bloques del [backlog](backlog.md) |
| --- | --- |
| Juan Pablo | E1 Adquisición · E2 Log · E3 Estimación · E4 Máquina de estados · E5 Radio (lado del cohete) |
| Jerónimo | E7 VisionPack · E6 Estación (módem, servicio y dashboard) · E5 Radio (lado del módem) |
| Juntos | Mantener el contrato del protocolo, E0 Arranque, las pruebas de sistema (F3) y E9 Operación |

## 5. Cómo se trabaja con agentes

- **Cada tarea del backlog dice qué documentos leer.** El agente lee **solo esos** y [constantes.md](../02_requisitos/constantes.md).
- **Ningún agente cambia un contrato** (protocolo, constantes o máquina de estados) desde el código. Si hace falta un cambio, primero se actualiza el documento y se agrega una decisión en [decisiones.md](../04_diseno/decisiones.md).
- **Una tarea se cierra** cuando su criterio de aceptación pasa y la prueba correspondiente del [plan de pruebas](plan_pruebas.md) queda registrada.
- **Ritmo diario:** se actualizan el estado del backlog y los [pendientes](pendientes.md), y se revisan los [riesgos](riesgos.md) que cambiaron.
