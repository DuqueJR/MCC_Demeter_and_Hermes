---
id: estado_sesion_A
estado: vivo. Solo lo edita la sesión A (Jerónimo).
actualizado: 2026-10-25
---
# Estado de la sesión A (Jerónimo): enlace, tiempo, tierra y Pi

**Cómo se usa:**
- La entrada más reciente va **arriba**.
- Se actualiza con `/cierre` al terminar cada bloque.
- Las entradas viejas no se reescriben.

## Ahora

| Campo | Valor |
| --- | --- |
| Hito actual | H0 (26 de octubre) |
| Tarea en curso | — |
| Siguiente | Refinar C-03 y C-05 ([06_contratos](../06_contratos/); C-05 ya adopta `web-1`, DP-17); revisar C-02 y C-04; llevar PA-22 y PA-23 al plan web |
| Ramas abiertas | — |
| PR esperando revisión de B | — |
| Bloqueos | — |
| Necesito de B | C-02 y C-04 en borrador para revisarlos; T-002 (el esqueleto de PlatformIO) para empezar el firmware |
| Placa: mi próxima ventana | 26 oct, tarde (T-006, ping LoRa con la V1.2) |
| Cuota (`/status`) | — |

## Entradas

### 2026-10-25, noche

- **Hecho:** C-05 v2 alineado con `web-1` del plan web (DP-17). PR #2 actualizado.
- **Siguiente:** revisar C-05 v2 junto con `web-1` antes de H0; llevar PA-22 (campo `lkp` opcional) y PA-23 (el dashboard local usa `/api/v1/local/`) al plan web.
- **Bloqueos:** `web-1` todavía no está en `develop` (rama `docs/plan-web`).

### 2026-10-25, tarde (plantilla inicial)

- **Hecho:** se creó el plan de dos sesiones (`docs/05_plan/dos_sesiones/`, rama `docs/plan-doble-sesion`).
- **Siguiente:** C-03, C-05 y la preparación de T-S12 (qué medir de la V1.2).
- **Bloqueos:** ninguno.
- **Supuestos vigentes:** PA-01 (placa compartida) y PA-02 (T-701 nuestro), sin confirmar.
