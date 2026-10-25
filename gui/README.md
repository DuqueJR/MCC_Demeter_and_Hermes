# gui/

**La web pública** (`web/`, con las páginas `/`, `/demeter/` y `/hermes/`), **el dashboard de operación** (`web/operacion/`) y **el relay público** (`relay/`).

**Leer primero:**
- [docs/08_gui/00_README.md](../docs/08_gui/00_README.md): el índice, las decisiones (D-W) y los pendientes (PEN-W);
- [docs/08_gui/06_plan_web.md](../docs/08_gui/06_plan_web.md): las tareas T-6xx, los carriles E y D, y los worktrees;
- [docs/08_gui/05_contrato_datos_web.md](../docs/08_gui/05_contrato_datos_web.md): el contrato `web-1`.

**Reglas:**
- **Desde internet no se puede mandar ningún comando** (D-025, GS-14). Solo el dashboard de operación manda comandos, por `/api/v1/local/` y desde `127.0.0.1` (C-05).
- Las sesiones de Claude Code que trabajan aquí se abren con `SESION=web` (el hook `no_gui.py` del plan del back).
