---
id: dos_sesiones_cambios_pendientes
estado: lista aprobada en lo que dicen DP-01 a DP-09; se aplica con T-S14 y con aprobación aparte
actualizado: 2026-10-25
depende_de: [dos_sesiones_decisiones]
---
# Cambios que hay que aplicar a los documentos existentes

**Esta carpeta no toca nada existente.** Aquí queda escrito **qué hay que cambiar, dónde y por qué**, para que una tarea posterior (**T-S14**, en su propia rama y con aprobación aparte) lo aplique de una vez.

**Columna "Tercero":** si el cambio depende de alguien externo, **primero se le consulta**. La aprobación de Jerónimo y Juan Pablo no reemplaza la suya.

## 1. DP-05: 58 B en lugar de 61

| Archivo | Cambio | Tercero |
| --- | --- | --- |
| [constantes.md](../../02_requisitos/constantes.md) §3 | `PAQUETE_SLOT_MAX`: "61 B (≤ 16 ms con SF6/BW500)" → **"58 B (15,648 ms; 59–61 B tardan 16,288 ms)"** | — |
| [enlace_lora_tdma.md](../../04_diseno/enlace_lora_tdma.md) §2 | "Con SF6/BW500 eso es **≤ 60 B** en total" → **"≤ 58 B"** | — |
| [protocolo_paquetes.md](../../04_diseno/protocolo_paquetes.md) §0 | "Tamaño máximo de un paquete en slot: 61 B" → **58 B** | — |

## 2. DP-06: el MMC5983MA se alimenta de DC1

| Archivo | Cambio | Tercero |
| --- | --- | --- |
| [pendientes.md](../pendientes.md) PEN-17 | "el MMC alimentado de A_LDO1" → **"el MMC alimentado de DC1"** | ⚠️ **Hw** ([PA-14](11_preguntas_abiertas.md)) |
| — | Las entradas de la bitácora **no se reescriben** (regla de [07_bitacora](../../07_bitacora/README.md)). La corrección queda en una entrada nueva | — |

## 3. DP-07: la versión en STATUS (PROTO_VERSION 3)

| Archivo | Cambio | Tercero |
| --- | --- | --- |
| [protocolo_paquetes.md](../../04_diseno/protocolo_paquetes.md) §1 y §3 | STATUS: nuevo campo **`fw_version` u32 en el offset 40** (hash de git corto, el mismo que muestra la OLED); **`crc16` en el offset 44**; **tamaño 46 B**. Cabecera: `version` = 3. Frontmatter: "versión de protocolo 3" | ⚠️ **Plan de la GUI** ([PA-15](11_preguntas_abiertas.md)) |
| [constantes.md](../../02_requisitos/constantes.md) §3 | `PROTO_VERSION` 2 → **3**; `LEN_STATUS` 42 → **46** | ⚠️ Ídem |
| [requisitos.md](../../02_requisitos/requisitos.md) DAT-07 | "STATUS de 42 B" → **"STATUS de 46 B"** | — |
| Los vectores del protocolo (T-502) | Generarlos ya en v3 | — |

**Comprobación:** 46 B con SF6/BW500 dan 80 símbolos de payload, es decir **13,088 ms**, lo mismo que 44 B. Cabe en el slot.

## 4. DP-08: QMC6309 en lugar del QMC6310 (después de leer el chip, T-S12)

| Archivo | Cambio | Tercero |
| --- | --- | --- |
| [componentes.md](../../03_hardware/componentes.md) | Fila QMC6310 → **QMC6309, I2C0, 0x7C (V3.1)**. Ficha nueva `componentes/qmc6309.md` | — |
| [buses_y_pines.md](../../03_hardware/buses_y_pines.md) §1 | I2C0: "OLED SH1106, QMC6310 y BME280" → **"OLED SH1106, QMC6309 (0x7C) y BME280"** | — |
| [protocolo_paquetes.md](../../04_diseno/protocolo_paquetes.md) §3, `fallas` | bit 5 "QMC6310" → **"magnetómetro de la placa (QMC6309)"** | — |
| [constantes.md](../../02_requisitos/constantes.md) §8 | `R_MONTAJE_QMC6310` → **`R_MONTAJE_QMC6309`** | — |

## 5. DP-09: el PMU es un TG28-ESP

| Archivo | Cambio | Tercero |
| --- | --- | --- |
| [componentes.md](../../03_hardware/componentes.md) | Fila AXP2101 (CanSat) → **"PMU marcado TG28-ESP; compatibilidad con el AXP2101 (XPowersLib, 0x34) por verificar (T-S12)"** | — |
| [componentes/axp2101.md](../../03_hardware/componentes/axp2101.md) | Agregar a las *Incertidumbres* el marcado TG28 y el resultado de T-S12 | — |
| [buses_y_pines.md](../../03_hardware/buses_y_pines.md) §1 | I2C1: "AXP2101 (0x34)" → **"PMU TG28-ESP (0x34, por verificar)"** | — |
| [requisitos.md](../../02_requisitos/requisitos.md) HW-02 | Nota: "PMU TG28-ESP" | — |
| Si T-S12 muestra que **no** es compatible | Revisar D-031 (bloqueo del apagado y `PWR_KEY`) con la hoja del TG28 | — |

## 6. Hardware leído en los chips (sin ID de decisión; correcciones de hecho)

| Archivo | Cambio | Tercero |
| --- | --- | --- |
| [componentes.md](../../03_hardware/componentes.md) | Fila PCF8563 → **"RTC marcado BM8563 (Belling), probablemente compatible con el PCF8563 en 0x51, con cristal de 32,768 kHz y batería de respaldo"**. Fila nueva: **PSRAM AP Memory APS6404L-3SQR, 8 MB QSPI** | — |
| [componentes.md](../../03_hardware/componentes.md) | Inconsistencias que el repo ya había anotado: BMP581 "INT 21" → **"INT sin cablear (B′)"**; QMI8658 "SPI3 con la SD" → **"deshabilitado en B′ (CS 34 en alto)"** | — |
| [pendientes.md](../pendientes.md) PEN-12 | "el mapa del conector M.2" → **"los headers PN1/PM1"** | — |
| [firmware_vuelo.md](../../04_diseno/firmware_vuelo.md) §1 | Agregar: **PSRAM en modo QSPI** en `platformio.ini`; el environment **`native`** para las pruebas en el PC | — |
| [firmware_vuelo.md](../../04_diseno/firmware_vuelo.md) §2 | `t_house`: "arma STATUS" → **"publica la energía en el estado de vuelo"**; `t_radio`: agregar **"arma NAV y STATUS"** (DP-18, C-02 §2.1) | — |
| [firmware_vuelo.md](../../04_diseno/firmware_vuelo.md) §6 | La lista de tipos de registro y lo que va en `tierra.bin` → **enlazar a C-04** (que pasa a `formato_log.md`), sin copiarlo (DP-19) | — |

## 7. Decisiones y flujo (DP-01 a DP-04, DP-15)

| Archivo | Cambio | Tercero |
| --- | --- | --- |
| [decisiones.md](../../04_diseno/decisiones.md) | Agregar D-034 en adelante con DP-01 a DP-09 y DP-15 (más las DP propuestas que se ratifiquen). **D-028 → "Reemplazada por D-0xx (DP-01)"** | — |
| [flujo_trabajo.md](../flujo_trabajo.md) | §1: el rol `revisor`. §2: ramas ≤ 1 día. §5: "mostrar" o "preguntar" según [08](08_sincronizacion_y_merge.md) §4 | — |
| [plan_maestro.md](../plan_maestro.md) | §1, punto 4: "dashboard" → **"CLI del operador (DP-15)"**. §4: enlace al reparto de DP-11 | — |
| [backlog.md](../backlog.md) | T-603, T-604 y T-605: separar **el back-end (nuestro)** de **la vista (otro plan)**. **T-605 → T-605a** (reenviador, nuestro) **+ T-640** (relay, plan web), como propone `docs/08_gui/04` §4. Agregar T-S01 a T-S15. Cambiar el responsable según DP-11. **Coordinar con la épica E10 (T-610 a T-699)** que agrega el plan web | ⚠️ Plan web (que haga sus cambios a la par, sin pisarse) |
| [estacion_terrena.md](../../04_diseno/estacion_terrena.md) §2.4 | "Contrato de la ingesta: … el mismo JSON que usa el dashboard local" → **"es `web-1` (DP-17)"** | ⚠️ Plan web |
| [requisitos.md](../../02_requisitos/requisitos.md) | Requisito nuevo **GS-15** (M): "Todas las operaciones críticas se hacen desde la CLI; el vuelo no depende de la GUI" | — |
| [riesgos.md](../riesgos.md) / [pendientes.md](../pendientes.md) | Enlazar a RP-xx y PA-xx, o copiarlos con IDs R-16 y PEN-21 en adelante | — |

## 8. Contratos nuevos: de borrador a `04_diseno/`

| Borrador | Destino propuesto | Cuándo |
| --- | --- | --- |
| [C-02](06_contratos/02_interfaces_firmware.md) | `docs/04_diseno/interfaces_firmware.md` | Al congelarse en H0 |
| [C-03](06_contratos/03_trama_usb_modem.md) | `docs/04_diseno/trama_usb_modem.md`, y enlazarlo desde [estacion_terrena](../../04_diseno/estacion_terrena.md) §2.1 | Ídem |
| [C-04](06_contratos/04_formato_log_y_replay.md) | `docs/04_diseno/formato_log.md` (el nombre que pide T-202), y enlazarlo desde [firmware_vuelo](../../04_diseno/firmware_vuelo.md) §6 | Ídem |
| [C-05](06_contratos/05_api_backend_tierra.md) | `docs/04_diseno/api_backend_tierra.md`, y enlazarlo desde [estacion_terrena](../../04_diseno/estacion_terrena.md) §2.4. **Enlaza a `web-1` (`docs/08_gui/05_contrato_datos_web.md`) sin copiarlo** (DP-17); solo se promueve cuando `docs/plan-web` esté en `develop` | Junto con `web-1` |
| — | [constantes.md](../../02_requisitos/constantes.md): nueva constante **`API_PUERTO`** (se propone 8765) | Ídem |
| — | [00_INDICE.md](../../00_INDICE.md): filas para los contratos nuevos y para esta carpeta | Ídem |

## 9. Configuración del repo (T-S10 y T-S11, con aprobación aparte)

| Archivo | Cambio |
| --- | --- |
| `.gitignore` | Agregar `.claude/worktrees/` y `CLAUDE.local.md`. ⚠️ La rama `docs/plan-web` también lo cambia (agrega `generated_images/`): el conflicto es trivial ([PA-24](11_preguntas_abiertas.md)) |
| `CLAUDE.md` | Reemplazarlo por el borrador de [15](15_CLAUDE_md_propuesto.md) §1 |
| `.claude/settings.json` | Los hooks de [15](15_CLAUDE_md_propuesto.md) §3 |
| `.claude/agents/revisor.md` | El agente de [15](15_CLAUDE_md_propuesto.md) §5 |
| `.claude/agents/desarrollador.md` | Cambiar "PR hacia `develop`" para que distinga "mostrar" y "preguntar"; agregar la lectura de las fichas de estado; actualizar el ejemplo de la línea `Co-Authored-By` al modelo que se use |
| `.claude/skills/{arranque,cierre,sync}/SKILL.md` | Ver [15](15_CLAUDE_md_propuesto.md) §6 |
| `.github/workflows/ci.yml` | Ver [15](15_CLAUDE_md_propuesto.md) §4 |
| `.github/pull_request_template.md` | Agregar el resultado del `revisor` y el modo ("mostrar" o "preguntar") |
| GitHub (configuración del repo) | La rama por defecto pasa a `develop`; proteger `main` y `develop` ([PA-18](11_preguntas_abiertas.md)) |

## 10. Bitácora

- Copiar [bitacora_2026-10-25_plan_dos_sesiones.md](bitacora_2026-10-25_plan_dos_sesiones.md) a `docs/07_bitacora/2026-10-25_sesion_plan_dos_sesiones.md`.
- Copiar [bitacora_2026-10-25_ajuste_C-05_web-1.md](bitacora_2026-10-25_ajuste_C-05_web-1.md) a `docs/07_bitacora/2026-10-25_decision_C-05_web-1.md`.
- Agregar su fila al índice de [07_bitacora/README.md](../../07_bitacora/README.md).
