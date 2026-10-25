---
id: dos_sesiones_pruebas_y_placas
estado: propuesta aprobada para ejecutar (2026-10-25)
actualizado: 2026-10-25
depende_de: [plan_pruebas, dos_sesiones_metodo, dos_sesiones_plan_maestro]
---
# Estrategia de pruebas y uso compartido de las placas

**Situación:**
- Hay **tres placas en total**: Supreme-D, Supreme-R y la V1.2.
- **No hay repuestos.**
- Se trabaja en el mismo lugar.
- **Supuesto:** una sola Supreme de desarrollo compartida ([PA-01](11_preguntas_abiertas.md)).

**Objetivo:** que **ninguna de las dos personas dependa de tener la placa en la mano** para avanzar, y que **ninguna placa se dañe**.

## 1. Inventario y roles de las placas

| Placa | Rol durante el desarrollo | Rol en el vuelo |
| --- | --- | --- |
| **Supreme-D** (desarrollo) | La placa de trabajo diario, con los sensores externos cableados cuando PEN-17 esté listo | Vuela en uno de los dos cohetes |
| **Supreme-R** (reservada) | **Solo en las jornadas conjuntas** (P-05, P-06, P-07, P-12, ensayos) y para verificar que el firmware corre igual en las dos | Vuela en el otro cohete |
| **V1.2** (estación) | Módem: T-006, T-601, P-05 y siguientes. Antes de cada ventana, se verifica el radio (T-S12) | Estación |

**Qué Supreme va en qué cohete lo decide el equipo antes de H4.** Se registra en `estado/placa.md`.

## 2. Qué se prueba sin placa y qué exige hardware real

| Prueba ([plan_pruebas](../plan_pruebas.md)) | Sin placa (en el PC) | Con placa |
| --- | --- | --- |
| P-01 Buses | — | Supreme-D (los dos pasan por la sesión de pareja de H0) |
| P-02 Estrés del bus y la SD | El codificador del log y los cálculos de la tasa (C-04) | Supreme-D, **con la SD de vuelo** |
| **P-03 Replay** | **Todo:** el estimador y la máquina de estados en `native` sobre OpenRocket y más de 20 sintéticos | Opcional: inyectar un vuelo en la placa |
| P-04 Manipulación | — | Supreme-D |
| **P-05 TDMA** | El calendario TDMA, la sincronía y ALOHA con reloj falso y radio falsa | **Las 3 placas** (jornada conjunta) |
| P-06 Alcance | — | Supreme-R o Supreme-D + V1.2 (jornada) |
| P-07 Integración | La CLI completa contra el módem falso | Las 3 placas (jornada) |
| P-08 Web | Del plan web, salvo el reenviador (T-605a), que es nuestro: se prueba contra el relay o el repetidor del plan web con mensajes `web-1` | — |
| **P-09 VisionPack** | **La secuencia completa con la Pi falsa y la LilyGO falsa** (T-S13) | Supreme-D + la Pi real |
| P-10 Reinicio en vuelo | La persistencia con un mapa en memoria y el modo reanudado en replay | Supreme-D |
| P-11 Volcado y backfill | El backfill con radio falsa | Supreme-D + V1.2 |
| P-12 Autonomía | — | Las dos Supreme (jornada) |
| P-13 GNSS y EKF | Replay de los registros GNSS_PVT | Supreme-D en movimiento (prioridad S) |
| P-14 Barómetro con jeringa | — | Supreme-D |
| P-15 Escaneo del canal | — | V1.2 en el sitio |

**Regla:** cualquier tarea con placa **llega a la ventana con su lógica ya probada en el PC** y con su script de prueba listo. La ventana sirve para medir, no para depurar lógica.

## 3. Calendario de ventanas de la placa (Supreme-D)

**Valores por defecto**, que se ajustan en la sincronización de cada mañana. Las reservas van en [estado/placa.md](estado/placa.md).

| Día | Mañana | Tarde |
| --- | --- | --- |
| 26 oct | **Pareja:** PEN-18 + T-S12 (B maneja la placa, A registra) | A: T-006 (ping LoRa con la V1.2) |
| 27 oct | B: T-004, T-101 | A: T-105 (GNSS) |
| 28 oct | B: T-102, T-103 | A: T-005 (PPS en las dos placas) |
| 29 oct | B: T-201 en la placa, P-02 parcial | A: T-601 (módem) · B: T-106 (ventana corta) |
| 30 oct | B: T-107 y los ajustes de P-02 | A: T-501 (TDMA) |
| 31 oct | A: T-503 (comandos) | B: P-04, P-14 |
| 1 nov | B: T-402, P-10 · A: T-702 y P-09 (ventana compartida) | **Jornada:** P-05 con 3 placas |
| 2 nov | A: T-504, P-11 · B: P-02 completo | **Jornada:** P-06, P-07 |
| 3 nov | A: T-801 · B: correcciones | **Jornada:** P-12 y ensayos de misión |
| 4 nov | Carga de la versión etiquetada en las 3 placas (en pareja) | Guardar las placas |

**Las ventanas son de unas 2 h.** Fuera de ellas, la placa la puede usar quien tenga algo urgente, avisando en la sincronización o por chat.

## 4. Entrega de la placa (checklist)

Al **recibir** la placa:
1. Leer la última entrada de `estado/placa.md`: qué firmware tiene, qué está cableado y si hay incidencias.
2. Revisar a ojo los cables y conectores (IPEX, SMA, JST) y que **la antena LoRa y la GNSS estén conectadas**.
3. Alimentar por USB. Con la batería, verificar antes su voltaje y polaridad.

Al **entregarla**:
1. Dejar cargado un firmware conocido (el último de `develop`, o el que se indique).
2. Escribir la entrada: quién, cuándo, qué firmware (hash), qué se probó, el resultado y las incidencias.
3. Dejar la placa en su lugar fijo, con su caja antiestática.

## 5. Reglas para no dañar una placa

Sin repuesto, una placa dañada es **un CanSat o la estación perdidos** ([RP-03](10_riesgos.md)).

| Regla | Por qué |
| --- | --- |
| **Una sola persona manipula la placa a la vez.** La otra observa o trabaja en su cola sin placa | Evita conexiones simultáneas y confusiones |
| **Nunca transmitir con el SX1262 sin antena.** En el banco, `LORA_TX_DBM` bajo (0–10) | Regla del agente `desarrollador` y de las [constantes](../../02_requisitos/constantes.md) |
| **Medir los pull-ups de los breakouts en las líneas que van a los GPIO 45 y 46 antes de conectarlos** (T-S12) | Si el 45 queda en alto en el arranque, la placa no arranca; el 46 en alto impide el modo de descarga ([RP-05](10_riesgos.md)) |
| **No conectar ni desconectar nada con la placa encendida** | Riesgo de picos y alimentación inversa |
| **Descarga electrostática:** tocar tierra antes; superficie no conductora | Componentes sin protección |
| **La batería solo con su protección**, y nunca la 18650 suelta con cables provisionales | Riesgo de corto |
| **Cargar el firmware solo desde una tarea que lo pida**, con la placa conectada y registrada (regla del `desarrollador`) | Que un agente no la cargue por su cuenta |
| **Supreme-R: uso mínimo** | Conserva una placa "limpia" para el vuelo |
| **El soldado sobre la placa** (el pad del SW3 para D-031; la opción A′ si llega) lo hace el equipo de hardware, con una foto antes y después | Es irreversible |

## 6. Scripts de prueba con hardware

- Cada prueba con placa es un **script** (por ejemplo, `pio test -e supreme_demeter -f test_bus_spi`) que deja su salida en un archivo.
- La persona que tiene la ventana lo corre y **pega la evidencia** en `estado/placa.md` y en el PR.
- **El registro oficial** de las pruebas es `docs/05_plan/registro_pruebas.md` ([plan_pruebas](../plan_pruebas.md)). Lo crea la primera tarea que corra una P-xx. Mientras tanto, la evidencia vive en `estado/placa.md`.
