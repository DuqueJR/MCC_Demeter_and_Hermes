---
fecha: 2026-11-06
tipo: tarea
ids: [T-637, T-635, T-636, PEN-07, PEN-W04, D-W01, D-W18]
autor: desarrollador (Claude Sonnet 5.5)
rama: feature/T-637-simulacion-hermes
---
# T-637: botón "Ver la simulación del vuelo" también en Hermes

## Contexto
T-635 y T-636 dieron el botón solo a Deméter, con un guion decimado de la simulación de OpenRocket. Hermes no lo tenía porque no existe la simulación del motor G80-7T (PEN-07, PEN-W04). El usuario pidió explícitamente que Hermes también lo tenga. La tarea se agregó al backlog (debajo de T-636) por ese pedido.

## Qué se hizo
- **Generador** (`gui/web/scripts/generar-simulacion.mjs`): ahora recibe la misión (`rutasDe(mision)`, `generarTexto(jsonl, mision)`, `--mision=hermes`). Sin argumentos genera las dos; `--comprobar` revisa las dos; la salida sigue siendo determinista. El guion de Deméter no cambió ni un byte (356016 B).
  - El JSONL de Hermes es **sintético** (`meta.modo = "sintetico"`). El script reescribe cada `meta.modo` a `"simulacion"` (lo exige `esGuion`) y no toca nada más.
  - Se niega a generar el guion de una misión con el JSONL de la otra (D-W01).
  - Salida: `src/assets/hermes/simulacion_nominal.json`, 305166 B (presupuesto 400 KB); excluido de Biome como el de Deméter.
- **Entrada** (`entradas/hermes.tsx`): igual que Deméter, importa el guion con `?url` (carga diferida, solo al pulsar) y pasa `simulacion` a `Pagina`. Cada misión importa solo el suyo.
- **Textos por misión** (`src/contenido/tipos.ts`, `demeter.ts`, `hermes.ts`): nuevo `simulacion: { nota, banner }`. `BotonSimulacion` lee la nota de `Simulacion.nota` y `BarraMision` lee el banner de `contenido.simulacion.banner`; ya no hay texto de misión en los componentes.
  - Deméter, sin cambios: "…con un vuelo simulado de OpenRocket. No son datos reales." y "Simulación: así será el vuelo".
  - Hermes: "…con un vuelo de ejemplo hecho con datos de muestra (sintéticos). No es un cálculo del motor G80-7T y no son datos reales: las alturas y los tiempos que verás no son los de Hermes." y banner "Simulación: vuelo de ejemplo con datos de muestra". Ninguna cifra (una prueba lo exige: ningún dígito salvo el nombre del motor). Sigue la marca SIM fija y el indicador "SIMULACIÓN".
- **Aislamiento** (`scripts/aislamiento.mjs`): hallazgo de un error previo. La expresión de referencias tenía `js` antes de `json`, y una referencia a `x.json` se cortaba en `x.js`: el guion nunca se seguía desde el JS de la página. Se reordenó (`json` primero) y se agregó una revisión: el `.json` alcanzable no puede traer `"mision"` de la otra misión (el nombre de archivo, `simulacion_nominal-<hash>.json`, es el mismo en las dos y no delata nada).
- `SIMULACION_SIEMPRE_VISIBLE` aplica igual a Hermes (misma regla en `disponible.ts`, no se tocó). No se cambió web-1 ni ningún contrato.
- README de `gui/web` actualizado.

## Evidencia
- `tsc --noEmit`: sin errores. `npm run build` (tsc, colores, vite, aislamiento): OK. En `dist/assets/` hay dos guiones, `simulacion_nominal-BniBwyqI.json` (Deméter, 356016 B) y `simulacion_nominal-DPw4HV6l.json` (Hermes, 305166 B); ninguno entra a un paquete JS.
- `node scripts/generar-simulacion.mjs --comprobar`: OK para las dos misiones.
- `vitest run`: **22 archivos, 490 pruebas en verde y 2 omitidas** (antes 477 + 2 omitidas, 13 nuevas):
  - guion de Hermes: coincide con el script y es determinista (dos corridas, mismos bytes), pesa < 400 KB, es válido, todos sus `meta` en `modo = "simulacion"` y de `hermes`, sin la palabra `demeter` ni `sintetico`, con el vuelo completo y cola de 10 s; el script se niega a mezclar misiones;
  - textos: Deméter igual que antes; Hermes sin "OpenRocket" ni "así será", con "ejemplo", "sintétic", "G80-7T" y sin cifras;
  - aislamiento con dist falso: guion propio pasa; guion ajeno falla en los dos sentidos.
- Playwright (`simulacion.spec.ts`, 19 pruebas, tres corridas seguidas): todas en verde. Nuevas o cambiadas:
  - desarrollo: Hermes a 390 y 1440 px, botón con su nota, banner de Hermes, SIM, vuelo hasta "En tierra", salir;
  - `dist/` con relay (repetidor): el guion de Hermes no se pide al cargar, se pide al pulsar, es de Hermes (`"mision":"hermes"` y sin `demeter`) y el primer dato real corta la simulación; salir; y Deméter no baja el guion de Hermes;
  - `dist/` sin `/api` (404): Hermes a 390 y 1440 px, botón en "Sin servidor", simula y vuelve.
  - En `estado_telemetria.spec.ts` se cambió la afirmación de que Hermes no tiene botón.
- Suite completa de Playwright (con `:4174` para el `preview`, ver Problemas): **209 en verde y 18 omitidas**, 0 en rojo.
- **Verificación contra `dist/` estático sin relay en tiempo real** (`python3 -m http.server` sobre `dist/` y una prueba temporal de Playwright, no versionada, a 390 px): `/hermes/` queda en `sin_servidor`; el guion no se pide antes de pulsar; el botón sale con la nota de datos de muestra; al pulsar se pide `simulacion_nominal-DPw4HV6l.json`, sale el banner "SIMULACIÓN: VUELO DE EJEMPLO CON DATOS DE MUESTRA" y SIM; en pocos segundos la fase pasa a "Subiendo por inercia" (T+ 00:01, 135 m); "Salir" devuelve el botón; sin errores de página.
- Capturas en `docs/07_bitacora/capturas/T-637/` (9 PNG, 1 MB).

## Decisiones tomadas o propuestas
Ninguna toca un contrato (web-1). Para el documentador:
1. **Cifras visibles en la simulación de Hermes:** el guion sintético trae un apogeo de **502 m** (evento `apogeo`, `valor: 502.0`) y T+ de unos 10 s; la página los muestra (barra, telemetría, objetivos) porque son datos del guion. Los textos de la página no los repiten y el banner y la nota dicen que son de muestra, pero el número aparece en pantalla. Si se quiere evitarlo del todo, habría que regenerar `hermes_nominal.jsonl` (T-304, `tools/web_datos`) con valores deliberadamente genéricos o marcarlos. No lo hice porque no se pidió y cambia otra tarea.
2. **03 §4 e identidad visual §175:** el texto del banner de simulación ya no es único ("SIMULACIÓN: así será el vuelo"): el de Hermes es "vuelo de ejemplo con datos de muestra" mientras no exista la simulación del G80-7T. Cuando exista (PEN-07), cambiar el JSONL de origen y `contenido/hermes.ts`.
3. **Backlog:** la fila de T-637 la agregué yo, como pidió el usuario, con estado "hecha". T-635 sigue "pendiente" en el backlog aunque ya está en `develop` (ya lo anotó T-636).

## Problemas y cómo se resolvieron
- El `vite preview` de la carpeta principal ocupa el `:4173`, y `playwright.config.ts` usa `reuseExistingServer`: habría probado el `dist/` de otra carpeta. Se corrió con una configuración temporal (puerto `:4174` para el `preview`), borrada después; no se versionó.
- La suite completa de Playwright reescribe las capturas de otras tareas (T-621 a T-636): se restauraron con `git checkout`; solo van las de T-637.
- En una corrida de la suite completa falló una vez la prueba de Hermes contra `dist/` y relay (`simulacion.spec.ts:286`), con la máquina cargada (no pude ver el detalle porque la salida se truncó). No se repitió: tres corridas seguidas de `simulacion.spec.ts` y otra de la suite completa dieron todo en verde. Es la prueba que depende del primer dato real a los 8 s (igual que la de Deméter): puede ser sensible a la carga. Queda anotado, sin evidencia de un fallo real.
- `--repeat-each` con esas pruebas en serie da `EADDRINUSE` en `:8791` (puerto fijo del repetidor): es un artefacto de la repetición, no de la tarea.
- **Fuera de alcance, ya en `develop`:** `./node_modules/.bin/biome check .` sobre todo el proyecto da errores en `gui/web/dev/prueba_carga/` (T-643) y avisos en `src/` que ya estaban; `biome check src pruebas e2e scripts biome.json` queda con 0 errores y 11 avisos previos.

## Pendiente / siguiente paso
- Revisión humana del texto de Hermes (nota y banner) y de la propuesta 1.
- Cuando exista la simulación del G80-7T (PEN-07, PEN-W04): cambiar el origen del guion de Hermes y su texto.
- Quitar `SIMULACION_SIEMPRE_VISIBLE` con T-642 (aplica a las dos misiones).

## Documentos afectados
`docs/05_plan/backlog.md` (fila de T-637), `gui/web/README.md`.
