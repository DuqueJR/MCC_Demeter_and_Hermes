---
fecha: 2026-10-25
tipo: sesion
ids: [T-634, T-632, T-631, GS-03]
autor: documentador (Claude Opus 5.5)
rama: docs/T-634-alcance-mapa
---
# Lanzamiento de T-634 (actitud 2D) y del mapa limitado

## Contexto
El usuario pidió implementar T-634 del plan web ([06_plan_web](../08_gui/06_plan_web.md) §3, W2). La tarea estaba lista: T-631 está integrada. Además, **Juan Pablo decidió (2026-10-25) que T-634 incluya limitar el mapa** de T-632 al área que cubre el PMTiles. Ya existe `gui/web/public/mapas/santa_fe.pmtiles` (918 KB), generado por él. La gente va a ampliar y arrastrar el mapa, y no debe poder salir del área donde se ve bien.

## Qué se hizo
- **Backlog:** la fila de T-634 ahora dice que incluye el mapa limitado, con su criterio extra, y pasa a `en curso`.
- **Alcance que se le da al agente `desarrollador`** (un solo agente, una sola rama `feature/T-634-*`):
  1. **Actitud 2D** (`src/actitud/`): horizonte y brújula desde el cuaternión, según [03 §3.6](../08_gui/03_experiencia_y_pantallas.md) y [protocolo_paquetes §8](../04_diseno/protocolo_paquetes.md). Va en el hueco `actitud` de la página de misión. Criterio: con cuaterniones conocidos (0°, 90° de pitch y 45° de roll), los ángulos salen bien con ±0,5°.
  2. **Mapa limitado** (`src/mapa/`):
     - los límites (`minLon`, `minLat`, `maxLon`, `maxLat`) y el `maxZoom` **se leen del encabezado del PMTiles en tiempo de ejecución**, con la biblioteca `pmtiles`; no se escriben en el código;
     - en MapLibre: `maxBounds` con esos límites y un margen pequeño hacia adentro; un `minZoom` que no deje alejar más allá del área; `maxZoom` igual al del archivo, con un nivel de sobrezoom como mucho;
     - sin PMTiles, el mismo comportamiento con un área por defecto alrededor de `meta.sitio` (en `src/mapa/constantes.ts`);
     - **excepción obligatoria (GS-03):** el LKP, el cohete, la trayectoria y la estación nunca quedan fuera del área navegable; si alguno cae fuera, los límites se amplían para incluirlo;
     - "centrar en el cohete" y "ver todo" respetan los límites; los gestos cooperativos del celular no cambian.
- **Fuera del alcance:** `src/contrato/`, `src/datos/` (solo se lee), los tokens y `package.json`. El PMTiles no se versiona: el agente lo lee con su ruta absoluta en la carpeta principal, o lo copia a su worktree solo para las pruebas, sin commitearlo.

## Decisiones tomadas o propuestas
- **De dónde sale el cuaternión (suposición del documentador):** la [agenda de H0, D9](../08_gui/10_agenda_H0_web-1.md) recomienda que el mapa y la actitud llamen a `interpolador.muestrear(performance.now())` en su `requestAnimationFrame`, sin una signal nueva. Así que la actitud **importa el interpolador de `src/datos/interpolacion.ts` sin modificarlo**. Si la muestra no trae el cuaternión, usa `estado.q` de `api.ts`.
- **Áreas por defecto:** el recorte del PMTiles es de ±0,05° alrededor de `meta.sitio` (ver `src/mapa/README.md`). El área por defecto sin PMTiles debería ser parecida, pero la elige el agente y la deja documentada en el README.

## Pendiente / siguiente paso
- Revisar el PR del agente con las capturas (la actitud y el mapa en su límite) y con `npm run build`, `npm test` y `npm run e2e`.
- Sigue abierta la falla de la e2e `mapa.spec.ts:196` (gestos) en la máquina de Jerónimo. Las pruebas del mapa que ya existen deben seguir en verde en la máquina del agente.

## Documentos afectados
- [backlog](../05_plan/backlog.md) (la fila de T-634)

## Revisión del PR #28 (mismo día)
El agente abrió el **PR #28** (`feature/T-634-actitud-y-mapa-limitado`, 6 commits `[T-634]`, desde `7b5f9be`), sin merge. El detalle técnico está en su [entrada](2026-10-25_T-634_actitud_y_mapa_limitado.md), que llega con el PR.

- **Alcance respetado:** el diff no toca `src/datos/`, `src/contrato/`, `src/tema/` ni `package.json`. Archivos nuevos: `src/actitud/` y `src/mapa/area.ts`; cambios en `base.ts`, `constantes.ts`, `controlador.tsx` y `README.md` del mapa, y en `Pagina.tsx`. GitHub lo marca como `MERGEABLE`.
- **Verificación del documentador**, en el worktree del agente y con la copia local del PMTiles:
  - `npm test`: **298 de 298** (antes eran 245);
  - `npm run build`: OK, con la prueba de aislamiento y sin datos de ejemplo en el `dist/`;
  - `npm run e2e`: **115 de 115**, sin saltadas, incluida `mapa.spec.ts:196` (gestos). Las capturas de T-622 que reescribió la corrida se revirtieron.
- **Capturas revisadas:**
  - la actitud en Deméter (390×844) y Hermes (1440×900): cada una con su tema, el horizonte con la escala de cabeceo y la brújula;
  - el mapa alejado al máximo y arrastrado al borde: no se ve borde vacío y el botón "−" queda desactivado;
  - el LKP fuera del recorte: el pin rojo y su texto siguen visibles, con la línea a la estación.
- **Lo que quedó decidido en el código:**
  - los límites salen de la cabecera del PMTiles: `maxBounds` ≈ [−75,871; 6,534; −75,775; 6,630];
  - el zoom máximo es **16**: el 15 del archivo más **un nivel de sobrezoom**, elegido con capturas a 15, 16 y 17;
  - sin PMTiles, el área por defecto es de ±0,05° alrededor de `meta.sitio`.
- **Observación del documentador:** la brújula gira con el rumbo (el rumbo queda arriba; con 90° la E queda arriba y la N a la izquierda). 03 §3.6 no dice si debe tener el norte arriba o el rumbo arriba. Se acepta así; si se prefiere el norte arriba, es un ajuste pequeño.

### Propuestas del agente (abiertas, no aplicadas)
| # | Propuesta | Quién o dónde |
| --- | --- | --- |
| 1 | Escribir en 03 §3.6 la convención del alabeo (adelante-izquierda-arriba) y que su cero depende de `R_MONTAJE` (D-007) | Documentador, cuando se mida `R_MONTAJE` |
| 2 | El generador sintético inventa un alabeo ≠ 0 (rotación mínima de +X a la nariz) | `tools/web_datos/actitud.py`, área D |
| 3 | El texto del LKP puede asomar por el borde superior después de "Ver todo" cuando es el punto más al norte (ya pasaba antes de T-634; el pin sí se ve) | `fix/T-632-*` menor |
| 4 | Si una trayectoria real ocupa casi todo el recorte, "Ver todo" amplía el área en un celular vertical | Aceptado: los vuelos simulados recorren unos 2 km |
| 5 | La cuadrícula sin PMTiles sigue centrada en `MAPA_CENTRO_POR_DEFECTO` y no acompaña a un área ampliada | Menor, sin tarea |
| 6 | Regenerar las capturas `*-ejemplo-*` de T-622, que ya muestran la sección Actitud | Junto con T-624 |
| 7 | El chunk `Pagina` pesa 18,8 KB gz (unos +2 KB por la actitud) | Medirlo en T-644 |

### Siguiente paso
- Juan Pablo hizo el merge del PR #28 (`b3994f2`). T-634 pasa a `hecha` en el backlog, `CLAUDE.md` la cuenta en el código integrado y se corre `graphify update .` en la carpeta principal.
