---
id: dos_sesiones_preguntas
estado: vivo. Complementa docs/05_plan/pendientes.md (PEN-xx), que sigue vigente.
actualizado: 2026-10-25
depende_de: [pendientes]
---
# Preguntas abiertas del plan (PA-xx)

**Prioridad:**
- **P0** se responde antes de o en H0;
- **P1**, antes de integrar (H2);
- **P2**, puede esperar.

**Quién:**
- **J** = Jerónimo; **JP** = Juan Pablo;
- **Hw** = equipo de hardware; **PT** = Pablo Tilano;
- **Vis** = equipo de visión de Demeter; **GUI** = el otro plan;
- **U** = la universidad.

**Las preguntas a terceros las hacen Jerónimo y Juan Pablo.** El plan no da por hecha ninguna respuesta.

| ID | Pri | Pregunta concreta | Por qué importa | Quién | Relación |
| --- | --- | --- | --- | --- | --- |
| PA-01 | P0 | ¿Comparten **una sola** Supreme de desarrollo, o cada uno tiene la suya? ¿La otra Supreme se puede usar a diario o se reserva? | Define el calendario de ventanas y DP-14 | J + JP | [07](07_pruebas_y_placas.md) |
| PA-02 | P0 | ¿Es nuestro **T-701** (los daemons de la Pi)? **Ya resuelto en parte:** el plan web (rama `docs/plan-web`, `08_gui/04` §4) deja **el reenviador (T-605a) en el back-end, así que es nuestro**, y **el relay y la ingesta (T-640) en el plan web**. Falta que cierren su PEN-W06 | Carga de la sesión A; RP-14 | J + JP | [03](03_plan_maestro.md), DP-17 |
| PA-03 | P1 | ¿Qué modelos muestra `/model` en cada cuenta Pro? | DP-16 y la cuota | J, JP | RP-08 |
| PA-04 | P0 | ¿El radio de la V1.2 es un SX1262? (Lo que dice el módulo o el blindaje, y una lectura con RadioLib) | RP-02 | J + JP (T-S12) | D-001 |
| PA-05 | P0 | ¿Las Supreme son de 868 o de 915 MHz? (Etiqueta o SKU) | `LORA_CANALES` y las antenas | J + JP (T-S12) | — |
| PA-06 | P1 | ¿La universidad puede comprar **una Supreme de repuesto** y, si hace falta, un nodo de tierra con SX1262? ¿En cuánto tiempo? | RP-03, RP-02 | U (lo preguntan J y JP) | — |
| PA-07 | P0 | ¿Los breakouts de Adafruit LSM6DSO32 y BMP581 traen pull-ups en SDA/SCL? (Esquemático de Adafruit, más una medición) | RP-05 | J + JP (T-S12) / Hw | D-022 |
| PA-08 | P1 | ¿Qué celda lleva el CanSat y cuánto pesa el CanSat completo? | P-12, la masa de 250–300 g | Hw | — |
| PA-09 | P1 | ¿Dónde va la estación respecto a la rampa? ¿Cuánto tiempo máximo se espera en la rampa? | P-06, P-12, el alcance | PT / organización del CCCD | — |
| PA-10 | P1 | ¿Qué dice la ANE sobre la potencia en 902–928 MHz? | `LORA_TX_DBM`, `LORA_CANALES` | PT / J + JP | PEN-13 |
| PA-11 | P1 | La simulación de Hermes (G80-7T) en CSV | P-03 de Hermes | Hw (Hermes) | PEN-07 |
| PA-12 | P0 | ¿Dónde están `demeter_flight.sh`, `demeter_rec.cpp`, `demeter_ingestd.sh`, `demeter_postprocess.py` y las unidades systemd? | T-701, P-09 | Vis | — |
| PA-13 | P0 | ¿En qué estado están PEN-17 (el cableado) y PEN-18 (la verificación)? ¿Hay código escrito fuera del repo? | Hoy figuran como "por confirmar por el equipo" | J + JP | — |
| PA-14 | P0 | **Para el equipo de hardware:** ¿pueden alimentar el MMC5983MA de **DC1** (DP-06) y no de A_LDO1? | DP-06, RP-13 | Hw | PEN-17 |
| PA-15 | P1 | **Para el plan web** (`docs/08_gui/`, rama `docs/plan-web`; lo llevan las mismas dos personas): (1) el protocolo pasa a **v3** (STATUS de 46 B), y `web-1` debe publicar `meta.proto_version: 3`; (2) C-05 adopta `web-1` (DP-17): revisar juntos las extensiones locales | DP-07, DP-17, RP-10 | GUI | — |
| PA-16 | P1 | ¿En qué orden van los ángulos de Euler en la UART de la Pi? (La propuesta es ZYX) | T-702 | Vis | PEN-15 |
| PA-17 | P2 | **Para Pablo Tilano:** si el uplink falla en la rampa, ¿se acepta algún armado de respaldo? Hoy D-013 exige el ARM por comando | RP-07 | PT | D-013 |
| PA-18 | P1 | ¿Se cambia la rama por defecto de GitHub a `develop` y se protegen `main` y `develop`? (Hace falta el administrador del repo, DuqueJR) | Los worktrees de los agentes salen de la rama por defecto; la protección de ramas está pendiente desde T-001 | J | DP-01 |
| PA-19 | P1 | ¿Quién descarga a mano los datasheets del SX1262 (Semtech) y del LSM6DSO32 (ST)? | La sensibilidad, el FIFO | J o JP | PEN-05, PEN-05b |
| PA-20 | P0 | ¿`estacion/` y `visionpack/` van con "preguntar" (revisión previa)? El plan lo propone así, porque son críticos para el vuelo, pero DP-01 solo nombra el firmware y los contratos | La revisión cruzada | J + JP | [08](08_sincronizacion_y_merge.md) §4 |
| PA-21 | P2 | ¿Se sube `ALARMA_DESCENSO_MS` de 10 a 11 m/s? | GS-05 | PT | PEN-20 |
| PA-22 | P1 | **Propuesta al plan web:** agregar a `estado` de `web-1` un campo **opcional** `lkp` {lat, lon, alt_agl_m, utc_ms}, con la última posición **válida**. Hoy, si un `estado` llega con `pos` en `null` (sin fix), el cliente tiene que buscar la LKP en la `serie`. Según la regla de `web-1`, un campo opcional es compatible | GS-03 | GUI (J + JP) | C-05 §1 |
| PA-23 | P1 | **Para el plan web:** el dashboard local (T-603), ¿usará las extensiones `/api/v1/local/` de C-05 para los comandos y el diagnóstico? ¿Y la CLI le basta al operador mientras el dashboard no esté? | DP-15, DP-17 | GUI (J + JP) | C-05 §3–§4 |
| PA-24 | P2 | Los dos planes cambian `.gitignore` (el plan web agrega `generated_images/`; este propone `.claude/worktrees/` y `CLAUDE.local.md`). ¿Quién integra primero? El que integre de segundo resuelve el conflicto, que es trivial | — | J + JP | [12](12_cambios_a_aplicar_en_lo_existente.md) §9 |
