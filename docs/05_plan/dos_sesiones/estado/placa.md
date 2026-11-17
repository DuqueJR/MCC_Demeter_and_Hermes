---
id: estado_placa
estado: vivo. Solo se agregan entradas; no se reescriben.
actualizado: 2026-10-25
depende_de: [dos_sesiones_pruebas_y_placas]
---
# Bitácora y reservas de las placas

Las reglas de uso y el checklist de entrega están en [07_pruebas_y_placas.md](../07_pruebas_y_placas.md) §4–§5. **No hay repuestos.**

## Inventario

| Placa | Rol | Firmware cargado (hash) | Cableado | Estado físico | Cohete asignado |
| --- | --- | --- | --- | --- | --- |
| Supreme-D | Desarrollo (compartida, PA-01) | Por confirmar | Por confirmar (PEN-17) | Por confirmar | Se decide antes de H4 |
| Supreme-R | Reservada para las jornadas | Por confirmar | Por confirmar | Por confirmar | Se decide antes de H4 |
| V1.2 | Estación (módem) | Por confirmar | Antena TX915-BLG-40 + adaptador | Por confirmar (radio: RP-02) | — |

## Reservas (las ventanas del día)

Se llenan en la sincronización de la mañana. Los valores por defecto están en [07](../07_pruebas_y_placas.md) §3.

| Fecha | Ventana | Placa | Quién | Para qué (T-xxx / P-xx) |
| --- | --- | --- | --- | --- |
| 2026-10-26 | Mañana | Supreme-D + V1.2 | Pareja (B maneja, A registra) | PEN-18, T-S12, T-003 |
| 2026-10-26 | Tarde | Supreme-D + V1.2 | A | T-006 |

## Entradas de uso

**Plantilla:**

```markdown
### AAAA-MM-DD HH:MM–HH:MM · <placa> · <quién>
- Recibida con: firmware <hash>, cableado <…>, incidencias previas <…>
- Hice: <T-xxx / P-xx>, con el script <…>
- Resultado / evidencia: <cifras, salidas, enlace a la bitácora o al PR>
- Entregada con: firmware <hash>, estado <…>
- Incidencias: <ninguna | detalle>
```

### 2026-10-25 · — · —
- Todavía no hay usos registrados. El estado físico y el firmware de las tres placas están por confirmar ([PA-13](../11_preguntas_abiertas.md)).
