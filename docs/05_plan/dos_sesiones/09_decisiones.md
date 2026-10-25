---
id: dos_sesiones_decisiones
estado: vivo. Se consolida en docs/04_diseno/decisiones.md con T-S14.
actualizado: 2026-10-25
depende_de: [decisiones]
---
# Decisiones del plan de dos sesiones (DP-xx)

Usa el formato ADR compacto de [decisiones.md](../../04_diseno/decisiones.md): contexto, decisión, estado y consecuencias.
- **Mientras no se consoliden** en `decisiones.md` (lo hace T-S14, [12](12_cambios_a_aplicar_en_lo_existente.md)), **estas decisiones viven aquí**.
- **Al consolidarlas** reciben un ID D-0xx.

**Quiénes decidieron:**
- **J+JP:** aprobada por Jerónimo y Juan Pablo, según lo comunicó Jerónimo en la sesión del 2026-10-25.
- **J:** aprobada por Jerónimo en esa sesión.
- **Propuesta:** se ratifica en H0.

| ID | Decisión | Estado | Quién | Reemplaza | Dónde |
| --- | --- | --- | --- | --- | --- |
| DP-01 | **Flujo git de dos sesiones:** ramas `feature/` y `fix/` cortas (≤ 1 día) desde `develop`, con integración diaria. **"Preguntar"** (revisión humana previa) para el firmware y los contratos. **"Mostrar"** para `tools/`, pruebas y documentación que no sea contrato: merge con la integración continua en verde y revisión humana asíncrona en < 24 h. **Se mantiene del resto de D-028:** `main`/`develop`, `release`/`hotfix`, worktree por tarea, merge `--no-ff`, Conventional Commits en español con el ID de la tarea | **Aprobada, 2026-10-25** | J+JP | **D-028** | [08](08_sincronizacion_y_merge.md) §2 y §4 |
| DP-02 | **Agente `revisor`** (solo lectura, contexto limpio) revisa cada PR contra el contrato, el criterio de aceptación y el "hecho" **antes** de la revisión humana. Reporta solo lo que afecta la corrección o los requisitos | **Aprobada, 2026-10-25** | J+JP | — | [15](15_CLAUDE_md_propuesto.md) §5 |
| DP-03 | **Hooks e integración continua:** quedan **especificados** (`.claude/settings.json`, `.github/workflows/`). **Aplicarlos es otra tarea** (T-S10, T-S11), con aprobación aparte | **Aprobada, 2026-10-25** | J+JP | — | [15](15_CLAUDE_md_propuesto.md) §3–§4 |
| DP-04 | **El Claude principal sigue sin escribir código.** Ratifica `CLAUDE.md` y D-030 | **Aprobada, 2026-10-25** | J+JP | — | [15](15_CLAUDE_md_propuesto.md) |
| DP-05 | **`PAQUETE_SLOT_MAX` pasa de 61 a 58 B**, y en `enlace_lora_tdma` §2, de "≤ 60 B" a "≤ 58 B". **Motivo:** con SF6/BW500, CR 4/5, preámbulo 8, cabecera explícita y CRC, 58 B = 15,648 ms y 59–61 B = 16,288 ms > `TDMA_TOA_MAX_MS` | **Aprobada, 2026-10-25** | J+JP | — | [12](12_cambios_a_aplicar_en_lo_existente.md) §1 |
| DP-06 | **La alimentación del MMC5983MA se unifica en DC1** (como dicen `buses_y_pines` y `constantes`; PEN-17 y una bitácora decían A_LDO1) | **Aprobada por J+JP; ⚠️ pendiente de consultar al equipo de hardware**, que es quien cablea | J+JP | — | [12](12_cambios_a_aplicar_en_lo_existente.md) §2 · [PA-14](11_preguntas_abiertas.md) |
| DP-07 | **La versión del firmware va en STATUS:** un campo `fw_version` u32 (hash de git corto) en el offset 40; CRC en el 44; **STATUS pasa a 46 B**; **`PROTO_VERSION` = 3**. El tiempo en el aire de 46 B sigue en 13,088 ms. **Motivo:** [firmware_vuelo](../../04_diseno/firmware_vuelo.md) §9 lo exige y STATUS no tenía el campo | **Aprobada por J+JP; ⚠️ hay que avisar al plan de la GUI** (consume el protocolo) | J+JP | — | [12](12_cambios_a_aplicar_en_lo_existente.md) §3 · [PA-15](11_preguntas_abiertas.md) |
| DP-08 | **El magnetómetro de la placa en la V3.1 es un QMC6309 en 0x7C**, no el QMC6310. Se cambia el directorio, se crea su ficha y se nombra así el bit 5 de `fallas` | **Aprobada por J+JP; se aplica después de leer el chip** (T-S12) | J+JP | — | [12](12_cambios_a_aplicar_en_lo_existente.md) §4 |
| DP-09 | **El PMU es el TG28-ESP** (leído en el chip). Su compatibilidad con el AXP2101 y XPowersLib **está por verificar** (T-S12). Si no es compatible, se revisan HW-01, HW-02 y D-031 | **Aprobada por J+JP** (el registro); la compatibilidad está pendiente | J+JP | — | [12](12_cambios_a_aplicar_en_lo_existente.md) §5 |
| DP-10 | **Hora inicial del RTC BM8563 (con batería):** al arrancar, la hora del RTC nombra los archivos y la sesión de tierra antes del fix. **Nunca se usa para el TDMA** | Propuesta | — | — | [C-02](06_contratos/02_interfaces_firmware.md) §5 · T-S15 |
| DP-11 | **Reparto A/B y propiedad de carpetas:** A (Jerónimo) lleva enlace, tiempo, tierra y Pi; B (Juan Pablo), adquisición, log y decisión, según [C-01](06_contratos/01_propiedad_y_carpetas.md). Reemplaza el "reparto sugerido" de [plan_maestro](../plan_maestro.md) §4 | Aprobada con la propuesta de la Etapa 3 (J); **la ratifica JP en H0** | J | plan_maestro §4 | [03](03_plan_maestro.md), [04](04_plan_sesion_A.md), [05](05_plan_sesion_B.md) |
| DP-12 | **Contratos primero:** C-01 a C-05 se congelan en H0, con vectores de prueba compartidos. C-04 adelanta T-202 | Aprobada con la propuesta de la Etapa 3 (J); la ratifica JP en H0 | J | — | [06_contratos/](06_contratos/) |
| DP-13 | **Estado vivo por sesión:** `estado/sesion_A.md`, `estado/sesion_B.md` y `estado/placa.md`. El backlog se consolida solo en las sincronizaciones de hito, por turnos | Aprobada con la propuesta de la Etapa 3 (J); la ratifica JP en H0 | J | — | [08](08_sincronizacion_y_merge.md) §1 |
| DP-14 | **Uso de las placas:** Supreme-D para el desarrollo, Supreme-R solo en jornadas conjuntas, ventanas reservadas y reglas de manipulación | Aprobada con la propuesta de la Etapa 3 (J); depende de [PA-01](11_preguntas_abiertas.md) | J | — | [07](07_pruebas_y_placas.md) |
| DP-15 | **CLI del operador:** todas las operaciones críticas (Go/No-Go, ARM, DISARM, FORZAR_ATERRIZADO y el resto de los comandos) se hacen desde una consola de texto del servicio de tierra. **El vuelo no depende de la GUI.** La GUI (otro plan) consume `web-1` y las extensiones locales de C-05 (DP-17) | **Aprobada, 2026-10-25** | J | Reemplaza el punto 4 de [plan_maestro](../plan_maestro.md) §1 ("dashboard") | [C-05](06_contratos/05_api_backend_tierra.md) |
| DP-16 | **Modelos por tipo de tarea:** Opus (si Pro lo permite) para contratos, revisión de la lógica crítica y depuración difícil; Sonnet para implementar, probar y revisar; Explore para buscar. Como mucho 2 desarrolladores a la vez por cuenta | Propuesta (depende de [PA-03](11_preguntas_abiertas.md)) | — | — | [02](02_metodo_trabajo.md) §7 |
| DP-17 | **C-05 adopta `web-1`** (el contrato de datos del plan web, `docs/08_gui/05_contrato_datos_web.md`) como el **único formato de salida** del servicio de tierra. El servicio lo produce por misión, con las mismas rutas de lectura que el relay. C-05 solo agrega extensiones `/api/v1/local/` (comandos, paquetes crudos, diagnóstico), que **nunca se reenvían**. **El reenviador (T-605a) es nuestro; el relay y la ingesta (T-640) son del plan web.** Motivo: escribir la lógica una sola vez y que la web, el dashboard local y la CLI muestren los mismos números | Aprobada por J (2026-10-25: "haz el ajuste a C-05"). ⚠️ Se congela junto con `web-1` (T-611 del plan web), con el visto bueno de los dos | J | La versión 1 de C-05 (su propio formato JSON) | [C-05](06_contratos/05_api_backend_tierra.md) |

## Consecuencias que hay que tener presentes

- **DP-01:** "mostrar" acelera las herramientas y la documentación, pero deja pasar errores hasta la revisión asíncrona ([RP-12](10_riesgos.md)). El `revisor` (DP-02) lo compensa en parte.
- **DP-07:** cambiar el protocolo a v3 obliga a actualizar los vectores, el decodificador y C-05, **y a avisar al otro plan**. Conviene aplicarlo **antes** de T-502 (el códec), en H0, para no codificar dos veces.
- **DP-11:** las dos personas cargan la ruta crítica. **A depende del C-02 de B** (estado de vuelo y comandos) y **B depende del T-304 de A** (vuelos sintéticos). Por eso los dos contratos se congelan en H0.
- **DP-15:** la CLI es una tarea M nueva (T-S04) que antes no existía en el backlog.
- **DP-17:** el formato de salida pasa a depender de un contrato que **mantiene otro plan**. Si nos hace falta un cambio en `web-1`, hay que proponérselo; un cambio incompatible exige `web-2`. A cambio, no hay dos formatos que mantener, y el plan web puede integrar (su T-641) apuntando al servicio local o al reprocesamiento de un log crudo.
