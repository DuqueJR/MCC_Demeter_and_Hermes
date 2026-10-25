---
id: dos_sesiones_plan_maestro
estado: propuesta aprobada para ejecutar (2026-10-25); se ratifica con Juan Pablo en H0
actualizado: 2026-10-25
depende_de: [plan_maestro, backlog, plan_pruebas, dos_sesiones_contratos, dos_sesiones_pruebas_y_placas]
---
# Plan maestro de dos sesiones (25 de octubre – 8 de noviembre de 2026)

**Qué es:** la capa de coordinación sobre el [plan maestro existente](../plan_maestro.md).
- **Se conservan:** las fechas, las fases F0–F4, los hitos H0–H4, las rutas críticas, el backlog (T-xxx) y las pruebas (P-xx).
- **Se agregan:**
  - el reparto entre la **sesión A (Jerónimo)** y la **sesión B (Juan Pablo)**;
  - las tareas nuevas `T-S…`;
  - los contratos que faltan;
  - el uso de la placa;
  - los criterios de "hecho" por hito.

**Recordatorio de alcance:** solo el **back-end**. Las partes visuales de T-603, T-604 y T-605 son del otro plan (GUI).

## 1. El mínimo para volar (actualizado)

Lo mismo de [plan_maestro §1](../plan_maestro.md), con un cambio en el punto 4:

1. Log completo en la SD, desde el pretrigger hasta LANDED.
2. La máquina de estados correcta, con el estimador, validada con replay (P-03).
3. NAV y STATUS por TDMA desde los dos cohetes, sin colisiones.
4. **El servicio de tierra:** log crudo, decodificación, estado por cohete, y **la CLI del operador con el Go/No-Go, ARM, DISARM, FORZAR_ATERRIZADO y la LKP en texto** (T-S04). **El vuelo no depende de la GUI.**
5. El buzzer al aterrizar.
6. Demeter: los bloqueantes de la Pi corregidos, la secuencia UART y la Pi encendida antes del despegue.

**Debería estar:** EKF, Madgwick, backfill, volcado por Wi-Fi, la alarma de descenso, los cálculos de tierra completos (elipse, tiempos), la API del back-end estable para la GUI, el reenviador y la ingesta (por confirmar).

**Si da el tiempo:** pesos dinámicos, `SET_CANAL`, la hora del RTC al arrancar (T-S15).

## 2. Tareas nuevas de este plan (`T-S…`)

| ID | Tarea | Sesión | Pri | Depende de | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- |
| T-S01 | Congelar C-01 (propiedad y carpetas) | Ambos | M | — | Firmado por los dos en H0 |
| T-S02 | Congelar C-02 (interfaces internas del firmware, capa de hardware, configuración por cohete) | B redacta, A revisa | M | — | Aprobado en H0. Los encabezados los escribe el `desarrollador` en T-002 |
| T-S03 | Congelar C-03 (trama USB del módem), con vectores golden | A redacta, B revisa | M | — | Aprobado en H0, con los vectores en `tools/vectores/usb/` |
| T-S04 | **CLI del operador** sobre la API del back-end | A | M | T-602, T-S06 | Desde la CLI, contra el módem falso: Go/No-Go por cohete, ARM, DISARM, FORZAR_ATERRIZADO, PING, comandos de la Pi; LKP y fase en texto; ningún comando entra si no es local |
| T-S05 | Congelar C-04 (formato del log y del replay); adelanta T-202 | B redacta, A revisa | M | — | Aprobado en H0. Incluye los tamaños de registro y la tasa recalculada |
| T-S06 | Congelar C-05 (API del back-end) e implementar el servidor local | A | M | T-602 | Contrato aprobado en H0; servidor local que cumple los vectores de C-05 |
| T-S07 | **Módem falso** (emite tramas C-03 a partir de vuelos sintéticos de los dos cohetes) | A | M | T-S03, T-304 | T-602 corre 30 min contra él sin perder nada |
| T-S08 | Cálculos de tierra: distancia, azimut, elevación, elipse, tiempos, alarma de descenso, retención de la LKP, URL del QR | A | S | T-602 | Pruebas con casos conocidos; publicados en C-05 |
| T-S09 | Chequeo automático de que `config.h` y `constantes.py` coinciden con [constantes.md](../../02_requisitos/constantes.md) | B | M | T-002 | Falla en la integración continua si hay un nombre o valor distinto |
| T-S10 | Aplicar la integración continua especificada en [15](15_CLAUDE_md_propuesto.md) §4 | Ambos | M | **Aprobación aparte** | El workflow corre en cada PR |
| T-S11 | Aplicar los hooks, las skills y el agente `revisor` de [15](15_CLAUDE_md_propuesto.md) | Ambos | S | **Aprobación aparte** | Funcionan en las dos cuentas |
| T-S12 | **Verificar la identidad del hardware**: PMU TG28 (registro de identificación), RTC BM8563, magnetómetro (QMC6309), **radio de la V1.2**, banda de la Supreme, pull-ups de los breakouts en las líneas de 45 y 46 | Ambos (pareja) | M | — | Reporte en `estado/placa.md` y en la bitácora; actualiza RP-02, RP-04 y RP-05 |
| T-S13 | Dobles del puerto serie: **Pi falsa** (para `t_visionpack`) y **LilyGO falsa** (para T-701), por un puerto serie virtual | A | M | — | La secuencia completa de D-023 corre en el PC |
| T-S14 | Aplicar los cambios de [12_cambios…](12_cambios_a_aplicar_en_lo_existente.md) a los documentos existentes | Ambos | M | **Aprobación aparte** y las consultas a terceros | Los contratos existentes quedan coherentes con DP-05 a DP-09 |
| T-S15 | Hora UTC desde el RTC al arrancar (DP-10, propuesta) | B | C | T-106 | Los archivos de la sesión de tierra llevan la fecha real antes del fix |

## 3. Hitos y fases

**Bloques:** cada día tiene dos bloques por persona: **M** (mañana) y **T** (tarde). Cada bloque es más o menos una ventana de uso de 5 h. Las ventanas de la placa están en [07_pruebas_y_placas.md](07_pruebas_y_placas.md) §3.

### F0, H0 (25–26 de octubre): contratos y placa verificada

| | Sesión A (Jerónimo) | Sesión B (Juan Pablo) |
| --- | --- | --- |
| 25 T | Redactar C-03 y C-05 (T-S03, T-S06); vectores USB | Redactar C-02 y C-04 (T-S02, T-S05) |
| 26 M | **Pareja con la placa:** PEN-18 + T-S12 (B maneja la placa, A registra) | Ídem; T-003 |
| 26 T | T-502 (códec C y Python + vectores), T-304 (empieza), **ping LoRa T-006** con la V1.2 (ventana de placa de A) | T-002 (PlatformIO, 3 environments), T-S09 |
| Cierre | **Sincronización H0:** C-01 a C-05 congelados; D-022 cerrada (B′ o A′); el radio de la V1.2 identificado | |

**Criterio de H0:**
- compilan los 3 environments;
- P-01 en verde para lo que esté cableado;
- se intercambian paquetes LoRa SF6/BW500 con CRC correcto (T-006);
- los contratos C-01 a C-05 están aprobados;
- **T-S12 está reportado** (si el radio de la V1.2 es un SX1276, se activa el plan B de [RP-02](10_riesgos.md)).

### F1, H1 (27–29 de octubre): datos

| Sesión A | Sesión B |
| --- | --- |
| T-304 (generador sintético), T-S07 (módem falso), T-602 (servicio de tierra), T-S13 + T-701 (Pi en el PC; T-701 por confirmar), T-105 + T-005 (GNSS y PPS; ventanas de placa de la tarde), T-203 (decodificador, contra C-04) | T-004 (si el cableado de PEN-17 está listo), T-101, T-102, T-103, T-107, T-201, T-106 (ventanas de placa de la mañana); T-104 si sobra tiempo |

**Criterio de H1:**
- P-02 parcial (los sensores principales a tasa de vuelo, sin pérdidas, durante 10 min);
- NAV de la Supreme-D decodificado en el PC por el módem real;
- T-602 recibe del módem falso durante 30 min sin pérdidas;
- la secuencia de la Pi corre en el PC hasta COMPLETE (si T-701 se confirma).

### F2, H2 (30 de octubre – 1 de noviembre): inteligencia y enlace

| Sesión A | Sesión B |
| --- | --- |
| T-501 (TDMA) y T-503 (comandos, ACK), T-601 (módem real), T-S06 + T-S04 (API y CLI), T-702 (`t_visionpack`), P-09 | T-301 (estimador), T-401 (máquina de estados), T-305 (replay), P-03 en el PC, T-402 (persistencia), P-10, T-403 |

**Jornada conjunta (1 de noviembre):** P-05 con las 3 placas (Supreme-D, Supreme-R y la V1.2).

**Criterio de H2:**
- P-03, P-04, P-05, P-09 y P-10 en verde;
- **ARM y DISARM desde la CLI, de punta a punta, con la placa real.**

### F3, H3 (2–3 de noviembre): integración

| Sesión A | Sesión B |
| --- | --- |
| T-504 (backfill), T-801 (volcado), T-S08 (cálculos), P-11; reenviador e ingesta si se confirman y hay tiempo | P-02 completo con la SD de vuelo, T-302 (Madgwick) y T-303 (EKF) si hay tiempo, P-04 |

**Jornadas conjuntas (2 y 3 de noviembre):** P-06 (alcance), P-07 (integración en 15 min), P-12 (autonomía) y **dos ensayos de misión completos** con los dos cohetes y la CLI.

**Criterio de H3:** P-06, P-07, P-11 y P-12 en verde, y los dos ensayos sin improvisar.

### F4, H4 (4–5 de noviembre): congelamiento

- **4 de noviembre a las 12:00:** sale `release/v1.0.0-cccd` desde `develop` ([flujo_trabajo](../flujo_trabajo.md)). Después solo entran correcciones que tengan una prueba que las demuestre.
- **Las dos sesiones:** T-902 (procedimiento de carga, versión visible), T-901 (checklists, con la CLI), T-903 (kit de campo).
- **Carga de la versión etiquetada** en las dos Supreme y en la V1.2, con su registro en `estado/placa.md`.
- **5 de noviembre:** ensayo final.

### Campo (6–8 de noviembre)

Inspección, escaneo del canal (P-15), integración, vuelo, recuperación, volcado. **El análisis del motor (T-802) puede hacerse después del concurso:** no bloquea nada.

## 4. Dependencias entre sesiones

```
C-02 (B) ─┬─► T-501/T-503/T-702 (A) usan las interfaces de la máquina de estados y del estado de vuelo
          └─► T-301/T-401 (B)
C-03 (A) ─► T-601 (A) ↔ T-602 (A), y el módem falso (A)
C-04 (B) ─► T-201 (B), T-203 y T-304 (A) ─► T-305 (B)
C-05 (A) ─► T-S04 (A); la GUI del otro plan (fuera)
T-502 (A) ─► NAV/STATUS armados en el firmware (A, con datos de B por C-02)
T-105 (A, tiempo) ─► T-501 (A); el EKF de B (T-303) consume la posición por C-02
PEN-17 (Hw) ─► T-004 (B) ─► T-101..T-103 (B) ─► P-02
```

**Las colas sin placa** (cada sesión tiene trabajo útil aunque la placa esté ocupada):
- **A:** T-502, T-304, T-S07, T-602, T-S04, T-S06, T-S08, T-S13, T-701, T-203, y la lógica de T-501 y T-503 con reloj falso.
- **B:** C-02, C-04, T-S09, la lógica de T-301, T-401 y T-402 en el PC, T-305, el codificador de T-201 en el PC, y T-302 y T-303 en el PC.

## 5. "Hecho"

**Para una tarea:**
- [flujo_trabajo §5](../flujo_trabajo.md);
- la integración continua en verde (cuando T-S10 esté aplicada; mientras tanto, el informe del `desarrollador` con la salida de la compilación y de las pruebas);
- el informe del `revisor` sin hallazgos que afecten la corrección;
- la evidencia en el PR;
- si usó la placa, la entrada en [estado/placa.md](estado/placa.md) con el hash del firmware.

**Para un hito:** su criterio (§3) y la sincronización de hito hecha ([08](08_sincronizacion_y_merge.md)).

## 6. Recortes (en este orden, si un hito se atrasa más de medio día)

1. Reenviador e ingesta del servidor (T-605, back-end).
2. T-303 (EKF): NAV sale con el GNSS crudo y `EKF_OK = 0`, como ya está previsto.
3. T-302 (Madgwick): el cuaternión sale como "sin dato".
4. T-801 (volcado por Wi-Fi): la SD se lee a mano después de la recuperación.
5. T-504 (backfill).
6. T-S08: se quedan solo la distancia, el azimut y la LKP.
7. T-104 (sensores de respaldo), T-403, T-S15.
8. T-802 (análisis del motor): pasa a después del concurso.

**Nunca se recortan:** el mínimo del §1, P-03, P-05 y P-07.
