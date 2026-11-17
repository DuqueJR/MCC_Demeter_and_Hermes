---
id: brechas_objetivos
estado: vivo (2026-11-03). Cada requisito con su estado real y la tarea que lo cierra.
actualizado: 2026-11-03
depende_de: [requisitos, backlog, revision_firmware_pablo, cambios_por_firmware_pablo]
decisiones: [D-045, D-046]
---
# Brechas frente a los objetivos finales

**Para qué:** que **todo** lo que falta para cumplir los [requisitos](../02_requisitos/requisitos.md) (*Objetivos_Sistemas* + DCP + lo pedido por el usuario) sea una tarea del [backlog](backlog.md).

**Desde D-045, todo se hace en nuestro repo:**
- el firmware (`firmware/`);
- la estación y el dashboard (`estacion/`, desde T-660);
- la web (`gui/web/`);
- la Pi (`visionpack/`).

**Estado:** ✅ cumplido · 🟡 en parte · ❌ falta. "Pablo" = ya estaba en su código, importado con T-007.
**Prioridad de la tarea:** M = antes del 8 de noviembre, sí o sí · S = debería estar el 8 · C = si da el tiempo (no bloquea el vuelo).

## 1. Reglamento

| REQ | Estado | Qué hay | Qué falta | Tarea |
| --- | --- | --- | --- | --- |
| REG-01 Ningún despliegue electrónico | ✅ | Ningún momento dispara la recuperación (D-040) | — | — |
| REG-02 Integración ≤ 15 min | ❌ sin medir | ARM en dos pasos con aptitud | Checklist y ensayo cronometrado con los dos cohetes | T-901, T-670 (P-07) |
| REG-03 Sin manipular tras la integración | 🟡 | | **Sin BOOST automático, depende del comando LAUNCH** | **T-410** |

## 2. Hardware y energía

| REQ | Estado | Qué hay | Qué falta | Tarea |
| --- | --- | --- | --- | --- |
| HW-01 Encendido con el DRV5032 | ✅ (modificado, D-042) | *Wake* de sueño profundo por IO21 | — | — |
| HW-02 Canales del AXP y % de batería | 🟡 | Canales y `vbat_mv` | El % (PMU) en TELEM o calculado en tierra | T-417 |
| HW-03 Pulso de encendido de la Pi | ❌ | El MOSFET de IO45, cableado | El firmware (solo si la Pi consta apagada) y el comando desde tierra | **T-413** |
| HW-04 Estado `cam` en la telemetría | ❌ | | Que lo informe la Pi por UART y vaya en TELEM | T-702 |
| HW-05 Buzzer al confirmar el aterrizaje | ❌ | IO46, cableado | El firmware y la detección del aterrizaje | **T-413**, T-412 |
| HW-06 Buses I2C y UART del GNSS | ✅ | Pablo | — | — |
| HW-07 Externos sin compartir el SPI interno | ✅ | SPI por software propio (D-042) | — | — |

## 3. Datos y transmisión

| REQ | Estado | Qué hay | Qué falta | Tarea |
| --- | --- | --- | --- | --- |
| DAT-01 Multihilo: el log separado del enlace | ✅ | Pablo | — | — |
| DAT-02 Todo lo crudo **y lo calculado** en la SD | 🟡 | Lo crudo y los registros de misión | **Lo calculado:** el estado del EKF, los momentos y los eventos del motor | T-420, T-412 |
| DAT-03 LSM 1–3,33 kHz con watermark | ✅ | 1,6 kHz | — | — |
| DAT-04 BMP581 240–480 Hz | 🟡 → **modificado** | ≈ 100 Hz por el hub (decisión de Pablo: sincronía con el INS) | Aceptar la modificación (D-042) | — |
| DAT-05 MMC a 100 Hz / DAT-06 GNSS a 10 Hz | ✅ | Pablo | — | — |
| DAT-07 Telemetría a 5–10 Hz, binaria | ✅ (modificado, D-039) | TELEM de 64 B a 10 Hz | — | — |
| DAT-08 Contenido: posición y altura **del EKF**, acel. y velocidad **promediadas**, **cuaterniones**, fase, batería y **estado de los subsistemas** | 🟡 | GNSS crudo, QMI instantáneo, cuaternión identidad, estado y momento, vbat | Altura barométrica y `hacc`; acel. del LSM en el cuerpo, promediada; bitmap de salud; EKF | T-414, T-417, T-420 |
| DAT-09 Volcado post-vuelo | 🟡 | Descarga por USB con `tbget.py` | Goteo de datos por LoRa en RECOVERY (lo propuso Pablo) | T-423 |
| DAT-10 Caracterizar el motor | ❌ | Datos del LSM a ±32 g | Script de post-proceso sobre los logs `rec` | T-802 |

## 4. Navegación

| REQ | Estado | Qué hay | Qué falta | Tarea |
| --- | --- | --- | --- | --- |
| NAV-01 Actitud en cuaterniones | ❌ a bordo | El EKF en Python (`ekf.py`) | Portarlo; la calibración en el cohete | T-420, T-421 |
| NAV-02 EKF con IMU, baro y GNSS | ❌ a bordo | `ekf.py`, validado con logs | Portarlo a C++ (≈ 150 ms atrasado, salida llevada al presente) | T-420 |
| NAV-03 Pesos dinámicos por fase | ❌ | | Dentro del EKF | T-422 |
| NAV-04 Apogeo por la Vz del baro, verificado por la IMU | ❌ | Altura y Vz barométricas | La detección del momento APOGEO | **T-412** |
| NAV-05 Fix obligatorio para armar y origen absoluto | 🟡 | ARM exige fix 3D | El origen del EKF al armar | T-420 |

## 5. Estación y dashboard (D-046: el dashboard es el de Pablo, adaptado)

| REQ | Estado | Qué hay | Qué falta | Tarea |
| --- | --- | --- | --- | --- |
| GS-01 Recibir a los dos cohetes sin colisiones | ✅ | TDMA (falta probarlo a 22 dBm y a distancia) | La prueba de alcance | **T-415** |
| GS-02 Distancia, azimut y elevación | ❌ | La posición de la estación (texto) | El cálculo en el dashboard | T-661 |
| GS-03 LKP que nunca se borra | 🟡 | La web lo tiene (T-625, T-632) | Llevarlo al dashboard (las páginas de misión servidas en local) | T-661, T-662 |
| GS-04 Coordenadas grandes y QR | 🟡 | La web (T-625) | Ídem | T-662 |
| GS-05 Alarma de descenso rápido | 🟡 | El banner de la web (T-624) | El cálculo en el dashboard y la alarma sonora | T-661, T-664 |
| GS-06 Go/No-Go | 🟡 | Los motivos de ARM (`[cmd ]`), el diagnóstico por sensor | Un panel de Go/No-Go permanente (sensores, calibración, RSSI, satélites, batería, reserva, Pi) | T-663 |
| GS-07 Uplink: ARM, recalibrar, *system check*, Pi | 🟡 | ARM, LAUNCH, estados, ping | Recalibrar (sesgo del giro al armar), encender la Pi y grabar | T-425, T-413, T-702 |
| GS-08 Interpolación y reconstrucción | 🟡 | La interpolación en la web; los logs completos con `tbget` | Reconstruir la trayectoria completa del log para la web | T-633 |
| GS-09 Vista 3D | ❌ | Actitud 2D (T-634) | 3D | T-650 a T-652 (C) |
| GS-10 Mapa 2D con elipse | 🟡 | El mapa de la web | El cálculo de la elipse | T-661 |
| GS-11 Gráficas personalizables | ❌ | | | T-666 (C) |
| GS-12 Web pública | 🟡 | Las páginas de la web | Reenviador, relay y despliegue | T-605a, T-640, T-642 a T-645 |
| GS-13 Tiempos estimados | ❌ | | El cálculo en el dashboard | T-665 (C) |
| GS-14 Ningún comando desde internet | ✅ | El dashboard solo escucha en 127.0.0.1 y valida el `Host` | Mantenerlo al agregar la API local; el relay es de solo lectura | T-662, T-640 |

## 6. VisionPack (Demeter)

| Objetivo | Estado | Qué falta | Tarea |
| --- | --- | --- | --- |
| La Pi completa su misión (video del ascenso, RAW del descenso) | ❌ | Corregir los bloqueantes 1–4 y los riesgos 5, 7 y 8 de su revisión; validarla **autónoma** (encendida a mano, solo con sus watchdogs) | **T-701**, T-705 |
| Tiempo de arranque y consumo | ❌ | Medirlos | T-704 |
| Integración con la LilyGO | ❌ | La UART: estado a 20–50 Hz con UTC hacia la Pi, el estado de la Pi en TELEM y los comandos de tierra reenviados | T-702 |

## 7. Operación y pruebas

| Objetivo | Tarea |
| --- | --- |
| Que compile y cargue en cualquier portátil; versión etiquetada | T-902 |
| La última importación del repo de Pablo, si hizo cambios después de `17139b2` | T-008 |
| Guía para que Pablo trabaje desde nuestro repo | T-009 |
| Calibración final de los dos cohetes | T-416 |
| Replay en PC de la detección (sims. de OpenRocket y logs reales) | T-305 |
| Reinicio en vuelo (P-10) | T-411 |
| Manipulación sin falsos BOOST (P-04) | T-410 |
| Escaneo del canal en el sitio (P-15) y regulación (PEN-13) | T-901 |
| Supervivencia en RECOVERY por batería (requisito de Pablo) | T-424 |
| Kit de campo | T-903 |
