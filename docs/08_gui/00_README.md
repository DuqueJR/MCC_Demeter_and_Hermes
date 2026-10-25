---
id: gui_indice
estado: propuesta (pendiente de aprobación de Juan Pablo y Jerónimo)
actualizado: 2026-10-25
depende_de: [requisitos, estacion_terrena, protocolo_paquetes, maquina_estados]
---
# Web pública Hermes + Deméter: índice del plan

Esta carpeta es el **plan y el diseño de la web pública**: la página que ve el público en el celular durante el lanzamiento del 8 de noviembre.
Está **aparte de `05_plan/`** a propósito, para trabajarla sin chocar con quien edita el plan general. Cuando se apruebe, el documentador consolida:
- las tareas en [backlog](../05_plan/backlog.md);
- las decisiones en [decisiones](../04_diseno/decisiones.md);
- los pendientes en [pendientes](../05_plan/pendientes.md).

## Cómo leer esta carpeta

| Si vas a… | Lee |
| --- | --- |
| Entender qué se construye, para quién y qué no | [01_vision_y_alcance.md](01_vision_y_alcance.md) |
| Diseñar o programar algo visual (colores, letras, imágenes, tono) | [02_identidad_visual.md](02_identidad_visual.md) |
| Saber qué tiene cada pantalla y cómo se comporta en el celular | [03_experiencia_y_pantallas.md](03_experiencia_y_pantallas.md) |
| Saber con qué se construye y cómo aguanta 500 personas | [04_arquitectura_web.md](04_arquitectura_web.md) |
| Consumir o producir los datos de la web | [05_contrato_datos_web.md](05_contrato_datos_web.md) (**contrato**) |
| Tomar una tarea, ver los carriles y los worktrees | [06_plan_web.md](06_plan_web.md) |
| Generar, pedir u optimizar imágenes | [07_assets_e_imagenes.md](07_assets_e_imagenes.md) |
| El cohete en 3D (congelado: es un *could*) | [08_modelo_3d_futuro.md](08_modelo_3d_futuro.md) |

## Reglas de esta carpeta

1. Las mismas de [00_INDICE](../00_INDICE.md): un dato vive en un solo lugar, primero el documento y después el código, y las suposiciones se marcan con `(P)`, `(V)` o ❓.
2. **Los contratos de la web son dos:**
   - [05_contrato_datos_web.md](05_contrato_datos_web.md): el formato de los datos;
   - los **tokens de diseño** de [02_identidad_visual.md](02_identidad_visual.md) §6.

   Se congelan al cerrar la fase W0. Después solo cambian con una decisión `D-Wxx` registrada aquí (y luego consolidada en `decisiones.md`).
3. **IDs propios, para no chocar con el plan general:**
   - tareas `T-610` a `T-699` (rango reservado para la web);
   - decisiones propuestas `D-W01…`;
   - pendientes `PEN-W01…`.

   Al consolidar, las decisiones y los pendientes reciben su número definitivo (`D-0xx`, `PEN-xx`) y aquí se deja la equivalencia.
4. **La web pública nunca manda comandos** (D-025, GS-14). Es de solo lectura, sin excepción.
5. **La web nunca bloquea el vuelo.** Es prioridad S. Si el mínimo para volar ([plan_maestro](../05_plan/plan_maestro.md) §1) se atrasa, la web se pausa.

## Decisiones propuestas (D-W)

| ID | Decisión | Estado | Dónde |
| --- | --- | --- | --- |
| D-W01 | Tres páginas aisladas: portada `/`, `/demeter/` y `/hermes/`. Quien entra a una misión no descarga nada de la otra. | Aprobada por el usuario (2026-10-25) | 03 §1, 04 §2 |
| D-W02 | Solo español, solo modo oscuro | Aprobada por el usuario | 02 |
| D-W03 | El cohete en 3D (inicio, actitud y trayectoria) pasa a *could*. Mientras tanto, el inicio son fotos del cohete y del equipo, y la actitud es un indicador 2D. | Aprobada por el usuario | 01 §4, 08 |
| D-W04 | La web muestra **todo lo de *Objetivos* §7 menos el centro de comandos**, incluidas las coordenadas exactas, el QR y el vector desde la estación | Aprobada por el usuario ("lee los objetivos") | 01 §3 |
| D-W05 | Stack: Vite + TypeScript + Preact (multipágina), MapLibre GL con un PMTiles propio, uPlot y SSE | Propuesta (C) | 04 |
| D-W06 | El servidor público (*relay*) es parte del plan web. El reenviador sigue en `estacion/` (T-605 se parte en T-605a y T-640). | Aprobada por el usuario (2026-10-25). Se le comunica a Jerónimo en el PR. | 04 §4, 06 |
| D-W10 | En la portada, **toda la mitad** es el enlace y el parche es el foco visual | Aprobada por el usuario (2026-10-25) | 03 §1 |
| D-W11 | El nombre público es **"Deméter"**, con tilde, en todo texto visible; `demeter` en las URLs y el código | Aprobada por el usuario (2026-10-25) | 02, 03 |
| D-W07 | La web se construye desde ya con datos simulados (repetición de la simulación de OpenRocket) y se conecta al back en W3 | Aprobada por el usuario | 06 |
| D-W08 | Los colores de estado (OK, aviso, alarma, sin dato) son fijos e independientes de las marcas | Propuesta (C) | 02 §4 |
| D-W09 | Retraso aceptado de punta a punta en la web: < 2 s | Aprobada por el usuario | 04 §5 |

## Pendientes de la web (PEN-W)

| ID | Pendiente | Quién | Bloquea |
| --- | --- | --- | --- |
| PEN-W01 | Fotos del cohete y del equipo, en buena resolución, de cada equipo | Equipos de cohete | T-622 (en W1 se usan imágenes provisionales) |
| PEN-W02 | Nombres completos y rol de cada integrante. Los parches solo traen apellidos. | Equipos | T-623 |
| PEN-W03 | Textos de cada parte del cohete y de la misión (los escribimos nosotros y luego se ajustan) | Juan Pablo y Jerónimo | T-623 |
| PEN-W04 | Simulación de Hermes (PEN-07): mientras no exista, los datos de Hermes son sintéticos | Equipo de Hermes | Datos reales de Hermes en T-612 |
| PEN-W05 | Hosting y dominio. Se decide en W3; el diseño no depende del proveedor. | Juan Pablo y Jerónimo | T-640 |
| ~~PEN-W06~~ | ~~Que se acepte D-W06~~ | Cerrado el 2026-10-25: aprobado por el usuario | — |
| ~~PEN-W07~~ | ~~"Deméter" o "Demeter"~~ | Cerrado el 2026-10-25: **Deméter** (D-W11) | — |
| PEN-W08 | Agregar en huggingface.co/settings/mcp los Spaces `evalstate/flux1_schnell` (borradores rápidos) y `black-forest-labs/FLUX.2-klein-9B` (versión final). `black-forest-labs/FLUX.1-schnell` ya no aparece en el buscador. Ver 07 §2. | Juan Pablo | T-621 |
| ~~PEN-W09~~ | ~~El reparto de carriles~~ | Cerrado el 2026-10-25: **A (Experiencia) para Juan Pablo y B (Datos) para Jerónimo** | — |
| PEN-W10 | **Los parches en PNG con fondo transparente** (el archivo original del diseñador). Los actuales tienen el fondo blanco, y **la capa de Hermes se sale del círculo**: un recorte circular la corta. | Equipos (quien hizo los parches) | T-620 (mientras tanto se recorta a mano) |
| PEN-W11 | ¿Pagar un generador mejor? Con la cuenta gratuita funciona `evalstate/flux1_schnell`, pero `FLUX.2-klein-9B` responde con error (probablemente por la cuota de ZeroGPU gratuita, V). La opción más barata para probar es Hugging Face Pro (US$ 9/mes). | Juan Pablo | T-621 (no bloquea: schnell alcanza para la portada) |
