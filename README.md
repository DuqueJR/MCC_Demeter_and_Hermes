# MCC Demeter & Hermes: software de los CanSat · Universidad EIA · CCCD 2026

Software compartido de los dos cohetes de la Universidad EIA, **Hermes** y **Demeter**, para el Concurso Colombiano de Cohetería Deportiva 2026 (Categoría 3). El lanzamiento es el **8 de noviembre de 2026** en Santa Fe de Antioquia.

Incluye:
- el firmware de vuelo de la LilyGO T-Beam Supreme (ESP32-S3);
- el enlace LoRa con TDMA;
- la estación terrena compartida (módem T-Beam V1.2, servicio de tierra, dashboard local y web pública);
- la integración con el VisionPack de Demeter (Raspberry Pi 5).

## Estructura

| Carpeta | Contenido |
| --- | --- |
| [`firmware/`](firmware/) | Proyecto PlatformIO: `supreme_hermes`, `supreme_demeter` y `modem_v12` |
| [`estacion/`](estacion/) | Servicio de tierra (Python) |
| [`gui/`](gui/) | Dashboard local y frontend público |
| [`visionpack/`](visionpack/) | El plano de control de la Pi de Demeter |
| [`datos/`](datos/README.md) | Simulaciones de OpenRocket y datos de referencia |
| [`tools/`](tools/) | Simulación, decodificación del log y análisis post-vuelo |
| [`docs/`](docs/00_INDICE.md) | **Toda la documentación.** Se empieza por [`docs/00_INDICE.md`](docs/00_INDICE.md). |

## Probar la web en local

Igual en Windows y en macOS, desde la raíz del repo. Se necesita **Node 22** y **Python 3** (solo para `npm run datos`).

1. `npm run web:instalar` (una vez por máquina: instala las dependencias de `gui/web/` y el Chromium de Playwright).
2. `npm run web`: abre la página de desarrollo (`/dev/`), con enlaces a la portada, a las páginas de cada misión, a los tokens y a los escenarios de ejemplo.

Otras órdenes: `repetidor` (el relay falso en `:8787`; `npm run repetidor -- demeter nominal`), `web:build`, `web:test`, `web:e2e`, `web:preview`, `datos` (regenera los JSONL de ejemplo) y `datos:validar`.

## Cómo se trabaja

- **Flujo** ([`docs/05_plan/flujo_trabajo.md`](docs/05_plan/flujo_trabajo.md)):
  - gitflow con `main` y `develop`;
  - una rama `feature/T-xxx-<slug>` por tarea del [backlog](docs/05_plan/backlog.md), cada una en su propio worktree;
  - PR hacia `develop` con revisión;
  - Conventional Commits en español.
- **Los contratos** (protocolo, enlace, máquina de estados y constantes) se cambian primero en `docs/` y se registran en [`decisiones.md`](docs/04_diseno/decisiones.md).
- **Cada paso** queda en [`docs/07_bitacora/`](docs/07_bitacora/README.md).
- **Agente de desarrollo:** [`.claude/agents/desarrollador.md`](.claude/agents/desarrollador.md), que corre en Sonnet, en un worktree por tarea.

## Equipo

Software: Juan Pablo Alzate (Hermes) y Jerónimo (Demeter). Requisitos: Pablo Tilano.
