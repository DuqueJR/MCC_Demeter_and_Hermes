## Tarea

`T-xxx`: <título de la tarea en el backlog>

## Qué cambia y por qué

## Cómo se probó

Pruebas `P-xx`, con su evidencia (cifras, salidas). Lo que no se pudo probar también se dice.

## Definido como hecho ([flujo_trabajo §5](../docs/05_plan/flujo_trabajo.md))

- [ ] Cumple el criterio de aceptación del backlog
- [ ] Compila en los environments afectados, o las pruebas de Python pasan
- [ ] Ningún número mágico: todo sale de `constantes.md`, con el mismo nombre
- [ ] No cambia ningún contrato, o hay una decisión aprobada que lo autoriza
- [ ] Pruebas corridas y registradas en la bitácora
- [ ] Commits atómicos con el formato `<tipo>(<ámbito>): <resumen> [T-xxx]`
- [ ] Ni secretos ni binarios pesados
- [ ] Entrada de bitácora: `docs/07_bitacora/AAAA-MM-DD_T-xxx_<slug>.md`

## Propuestas de cambio a contratos (si hay)
