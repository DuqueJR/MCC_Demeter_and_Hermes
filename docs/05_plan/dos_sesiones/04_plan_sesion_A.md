---
id: dos_sesiones_plan_A
estado: propuesta aprobada para ejecutar (2026-10-25)
actualizado: 2026-10-25
depende_de: [dos_sesiones_plan_maestro, dos_sesiones_contratos]
---
# Sesión A: Jerónimo. Enlace, tiempo, tierra y Pi

## 1. Qué posee

Las carpetas exactas están en [C-01](06_contratos/01_propiedad_y_carpetas.md).

| Área | Tareas |
| --- | --- |
| **Tiempo y GNSS** (firmware) | T-105, T-005 (el PPS de las dos placas) |
| **Protocolo** (C y Python) | T-502 |
| **Radio y TDMA** (firmware del cohete) | T-006, T-501, T-503, T-504 |
| **Módem V1.2** | T-601 |
| **VisionPack** | T-702 (`t_visionpack`), T-701 (**por confirmar**), T-704, T-S13 |
| **Volcado** | T-801 (el lado del cohete y el cliente de tierra) |
| **Servicio de tierra** | T-602, T-S04 (CLI), T-S06 (API, C-05), T-S07 (módem falso), T-S08 (cálculos), T-605a (reenviador hacia el relay del plan web). El relay y la ingesta (T-640) son del plan web |
| **Herramientas** | T-304 (generador sintético), T-203 (decodificador), T-802 (motor, después del concurso si hace falta) |
| **Contratos que redacta** | C-03, C-05. Revisa C-02 y C-04 |

## 2. Orden de trabajo

| Día | Bloque | Tarea | ¿Placa? | Modelo |
| --- | --- | --- | --- | --- |
| 25 oct | T | C-03 y C-05 (T-S03, T-S06), con vectores USB. **C-05 alineado con `web-1`**: revisar `docs/08_gui/05_contrato_datos_web.md` (rama `docs/plan-web`) y llevar las propuestas PA-22 y PA-23 al plan web | No | Opus (si Pro lo permite) |
| 26 oct | M | **Pareja con la placa:** PEN-18 + T-S12. A registra y verifica la V1.2 | Sí (conjunta) | — |
| 26 oct | T | T-502 (códec y vectores) · **T-006 ping LoRa** (ventana corta) · H0 | Sí (corta) | Sonnet |
| 27 oct | M | T-304 (generador) · T-S07 (módem falso) | No | Sonnet |
| 27 oct | T | T-105 (GNSS: UBX, 10 Hz, AIR4) | Sí (ventana de la tarde) | Sonnet |
| 28 oct | M | T-602 (servicio de tierra contra el módem falso) | No | Sonnet |
| 28 oct | T | T-005 (PPS en la Supreme-D y la V1.2) · T-203 (decodificador, C-04) | Sí / No | Sonnet |
| 29 oct | M | T-S13 + T-701 (Pi en el PC; si no se confirma, solo T-S13 y T-702 en el PC) | No | Sonnet |
| 29 oct | T | T-601 (módem real, primera versión) · H1 | Sí | Sonnet |
| 30 oct | M+T | T-501 (TDMA: lógica en el PC con reloj falso, luego en la placa) | Sí (tarde) | Opus para revisar, Sonnet para implementar |
| 31 oct | M | T-503 (comandos y ACK, contra la API de comandos de C-02) | No → Sí | Sonnet |
| 31 oct | T | T-S06 (servidor de la API) + T-S04 (CLI) | No | Sonnet |
| 1 nov | M | T-702 (`t_visionpack`) + P-09 con la Pi falsa y después la real | Sí | Sonnet |
| 1 nov | T | **Jornada conjunta:** P-05 con 3 placas · H2 | Sí (conjunta) | — |
| 2 nov | M | T-504 (backfill) · T-S08 (cálculos) | No → Sí | Sonnet |
| 2 nov | T | **Jornada conjunta:** P-06, P-07 | Sí | — |
| 3 nov | M | T-801 (volcado) · P-11 | Sí | Sonnet |
| 3 nov | T | **Jornada conjunta:** P-12 y ensayos de misión · H3 | Sí | — |
| 4 nov | M | Correcciones con prueba · T-901 (checklist con la CLI) · congelamiento a las 12:00 | — | Sonnet |
| 4–5 nov | — | T-902, T-903, ensayo final | — | — |

## 3. Qué paralelizar con subagentes

**Como mucho 2 agentes `desarrollador` a la vez**, en tareas sin archivos comunes.

- **Parejas buenas:**
  - T-304 ∥ T-S07, si el módem falso solo consume archivos de T-304 ya generados;
  - T-602 ∥ T-203;
  - T-S13 ∥ T-702;
  - T-S08 ∥ T-504.
- **No paralelizar:**
  - T-501 con T-503 (comparten `firmware/src/radio/`);
  - T-S04 con T-S06 (la CLI consume la API).
- **Subagente `Explore`** (solo lectura) para buscar en los manuales de u-blox y en la ficha del SX1262 sin cargar el contexto principal.
- **Subagente `revisor`** en cada PR (DP-02); la revisión humana la hace Juan Pablo.

## 4. Dependencias con la sesión B

| Necesita de B | Para | Cuándo |
| --- | --- | --- |
| C-02 aprobado (estado de vuelo, eventos de fase, API de comandos hacia la máquina de estados) | T-501, T-503, T-702, armar NAV y STATUS | H0 |
| C-04 aprobado | T-203, T-304 | H0 |
| T-002 (esqueleto de PlatformIO) | Todo el firmware de A | 26 oct |
| La máquina de estados en `develop` (T-401) | La prueba de punta a punta de ARM y DISARM | 1 nov |

**Mientras no esté T-401:** A prueba T-503 contra un **doble de la máquina de estados** que respeta C-02.

## 5. Riesgos propios

- **RP-02** (el radio de la V1.2).
- La regulación (PEN-13).
- **R-13** (el PPS de la V1.2).
- **T-701** depende de los archivos que faltan de la Pi y del equipo de visión.

Ver [10_riesgos.md](10_riesgos.md).
