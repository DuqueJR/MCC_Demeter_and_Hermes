---
id: dos_sesiones_plan_B
estado: propuesta aprobada para ejecutar (2026-10-25); la ratifica Juan Pablo en H0
actualizado: 2026-10-25
depende_de: [dos_sesiones_plan_maestro, dos_sesiones_contratos]
---
# Sesión B: Juan Pablo. Adquisición, log y decisión

## 1. Qué posee

Las carpetas exactas están en [C-01](06_contratos/01_propiedad_y_carpetas.md).

| Área | Tareas |
| --- | --- |
| **Esqueleto del firmware** | T-002 (PlatformIO con 3 environments, librerías fijadas), T-S09 (chequeo de constantes) |
| **Arranque y verificación física** | T-003 (con PEN-18), T-004 (sensores externos y encendido por imán), T-S12 (en pareja con A) |
| **Sensores y buses** | T-101, T-102, T-103, T-104, T-107 |
| **Energía y mantenimiento** | T-106 (PMU TG28, batería, temperaturas, buzzer), T-S15 (RTC, si da el tiempo) |
| **Log** | T-201 (escritor), C-04 (formato, adelanta T-202) |
| **Estimación y decisión** | T-301 (estimador vertical), T-401 (máquina de estados), T-402 (persistencia), T-403 (eventos del motor), T-302 y T-303 (S) |
| **Replay** | T-305 |
| **Contratos que redacta** | C-02, C-04. Revisa C-03 y C-05 |

## 2. Orden de trabajo

| Día | Bloque | Tarea | ¿Placa? | Modelo |
| --- | --- | --- | --- | --- |
| 25 oct | T | C-02 y C-04 (T-S02, T-S05) | No | Opus (si Pro lo permite) |
| 26 oct | M | **Pareja con la placa:** PEN-18 + T-S12 + T-003. **B maneja la placa** | Sí (conjunta) | — |
| 26 oct | T | T-002 (PlatformIO) · T-S09 · H0 | No | Sonnet |
| 27 oct | M | T-004 (si PEN-17 está listo) · T-101 (LSM6DSO32) | Sí (ventana de la mañana) | Sonnet |
| 27 oct | T | T-201 (codificador del log en el PC, contra C-04) | No | Sonnet |
| 28 oct | M | T-102 (BMP581) · T-103 (MMC5983MA) | Sí | Sonnet |
| 28 oct | T | T-107 (tareas de bus, colas) | No → Sí | Sonnet |
| 29 oct | M | T-201 en la placa (SD por SDMMC) · P-02 parcial | Sí | Sonnet |
| 29 oct | T | T-106 (PMU, batería) · H1 | Sí (corta) | Sonnet |
| 30 oct | M+T | T-301 (estimador, en el PC con T-304 de A) | No | Opus para diseñar y revisar, Sonnet para implementar |
| 31 oct | M | T-401 (máquina de estados T1–T13, E1, Go/No-Go, en el PC) | No | Opus para revisar, Sonnet para implementar |
| 31 oct | T | T-305 (replay) · **P-03 en el PC** | No | Sonnet |
| 1 nov | M | T-402 (persistencia) · P-10 · P-04 en la placa | Sí (mañana) | Sonnet |
| 1 nov | T | **Jornada conjunta:** P-05 · H2 | Sí (conjunta) | — |
| 2 nov | M | P-02 completo con la SD de vuelo · T-403 | Sí | Sonnet |
| 2 nov | T | **Jornada conjunta:** P-06, P-07 | Sí | — |
| 3 nov | M | T-302 (Madgwick) y T-303 (EKF) si el hito va bien; si no, correcciones | No | Sonnet |
| 3 nov | T | **Jornada conjunta:** P-12 y ensayos de misión · H3 | Sí | — |
| 4 nov | M | Correcciones con prueba · congelamiento a las 12:00 | — | Sonnet |
| 4–5 nov | — | T-902 (carga y versión), T-901, ensayo final | — | — |

## 3. Qué paralelizar con subagentes

**Como mucho 2 agentes `desarrollador` a la vez.**

- **Parejas buenas:**
  - T-201 en el PC ∥ T-101 en la placa (carpetas distintas: `log/` y `sensores/`);
  - T-301 ∥ T-305 (si el banco de replay solo usa la interfaz del estimador de C-02);
  - T-302 ∥ T-303 no conviene: comparten `fusion/`.
- **No paralelizar:** T-101, T-102 y T-103 juntos en la placa. Solo hay una placa, y los tres tocan `buses/`.
- **Subagente `Explore`** para buscar en los datasheets de Bosch, ST y QST.
- **Subagente `revisor`** en cada PR (DP-02); la revisión humana la hace Jerónimo.

## 4. Dependencias con la sesión A

| Necesita de A | Para | Cuándo |
| --- | --- | --- |
| T-304 (vuelos sintéticos en el formato de C-04) | T-301, T-305, P-03 | 29 oct |
| T-105 (tiempo y GNSS) por la interfaz de tiempo de C-02 | Las marcas de tiempo del log, el origen del EKF, NAV-05 | 29 oct |
| C-03 y C-05 revisados | — | H0 |

**Mientras no esté T-304:** B prueba T-301 y T-401 con la exportación de OpenRocket remuestreada a mano en un caso simple, o con vectores mínimos escritos por el `desarrollador`.

## 5. Riesgos propios

- **R-01** (la SD en SDMMC).
- **RP-04** (el TG28).
- **RP-05** (los pines de strapping).
- **R-03** (la máquina de estados sin datos reales).
- La dependencia de **PEN-17** (el cableado del equipo de hardware).

Ver [10_riesgos.md](10_riesgos.md).
