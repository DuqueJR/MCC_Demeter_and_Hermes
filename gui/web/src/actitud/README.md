# Actitud 2D (T-634)

La sección "Actitud" de `/demeter/` y `/hermes/` ([03 §3.6](../../../../docs/08_gui/03_experiencia_y_pantallas.md)): un **horizonte artificial** (cabeceo y alabeo), una **brújula** (rumbo) y los tres ángulos en grados, todos calculados del cuaternión `estado.q`. El modelo 3D que la reemplazará en el portátil es T-651.

## Cómo está armado

| Archivo | Qué hace |
| --- | --- |
| `angulos.ts` | **Lógica pura** (sin DOM ni signals): del cuaternión a cabeceo, alabeo y rumbo, y el rumbo en vientos (`N`, `NE`… `O`) |
| `vista.ts` | **Lógica pura**: qué muestra la sección según `estadoPagina` y `ekf_ok` |
| `Actitud.tsx` | La sección: dos instrumentos SVG, los tres ángulos y el aviso de estado |
| `actitud.css` | Estilos, solo con los tokens del tema (`scripts/colores.mjs` vigila que no haya colores sueltos) |
| `constantes.ts` | Tolerancias numéricas y medidas del dibujo (ningún número mágico en los demás archivos) |

## Convención de los ángulos

El contrato fija que `q = (w, x, y, z)` es unitario y **rota vectores del cuerpo al marco ENU** (protocolo_paquetes §2, §8). Con eso:

| Ángulo | Definición | Rango |
| --- | --- | --- |
| **Cabeceo** | Elevación de la nariz (+X del cuerpo) sobre el horizonte. +90° = nariz arriba | −90° a +90° |
| **Rumbo** | Azimut de la nariz proyectada en el horizonte. 0° = norte, sentido horario | 0° a 360° |
| **Alabeo** | Giro alrededor del eje de la nariz, regla de la mano derecha sobre +X. 0° con Y horizontal y Z hacia arriba | −180° a +180° |

**El cero del alabeo no sale del contrato.** Depende de cómo se monte el CanSat (`R_MONTAJE`, D-007, pendiente de medir). Aquí se usa el cuerpo "adelante-izquierda-arriba" (X nariz, Y izquierda, Z arriba con el cohete horizontal), que es el del generador de vuelos sintéticos (`tools/web_datos/actitud.py`). El cabeceo y el rumbo salen solo del eje X y no dependen de ello. Cuando se mida `R_MONTAJE`, solo cambia el cero del alabeo.

**Con los datos sintéticos** (OpenRocket no modela el giro) el alabeo que se ve es el de la rotación mínima que usa el generador, no un giro real.

### Bloqueo de cardán

Con la nariz casi vertical (`|cabeceo| >= 89°`, `ACTITUD_CARDAN_DEG`) el rumbo y el alabeo giran casi alrededor del mismo eje y solo su combinación es una medida fiable. `angulosDeCuaternion` devuelve `cardan: true` y la sección **no los muestra** (guiones y una nota) en lugar de inventar un rumbo. Exactamente vertical, el rumbo se saca del eje Y del cuerpo con alabeo 0, así que nunca sale `NaN`.

## De dónde sale el dato y cómo se dibuja

- Con animación: un `requestAnimationFrame` llama a `interpolador.muestrear(performance.now())` (`src/datos/interpolacion.ts`, el cuaternión ya con *slerp*; agenda H0 D9) y mueve directo los elementos del SVG. **No hay una signal a 60 Hz**: repintaría toda la página. Si el interpolador no tiene datos, se usa el último `estado.q`. El ciclo corre solo mientras la sección está en pantalla (`IntersectionObserver`).
- Con `prefers-reduced-motion: reduce` **no hay ciclo de dibujo**: se pinta cada `estado` que llega, sin interpolar.
- Los textos solo se reescriben cuando cambia el valor redondeado.
- Este módulo **solo lee** `datos/api.ts` y `datos/interpolacion.ts`; no modifica nada en `src/datos/`.

## Estados (que nunca parezca vivo lo que no lo está)

| `data-vista` | Cuándo | Qué se ve |
| --- | --- | --- |
| `sin-dato` | Sin `estado`, `cargando` o `sin_transmision` | Solo el aro vacío, guiones y "Aún no hay datos de orientación." |
| `no-disponible` | `ekf_ok = false` | Igual, con "Orientación aún no disponible" (03 §3.6) |
| `vivo` | `en_vivo` | Los instrumentos y los ángulos |
| `debil` | `senal_debil` | Atenuado (65 %) y "Señal débil" |
| `sin-servidor` | Se cayó el servidor del celular | Atenuado y "Reconectando… la orientación puede estar desactualizada" |
| `sin-senal` | `sin_senal` | Gris y al 40 %, en rojo: "Sin señal · última orientación hace X s" (la antigüedad sale de `edad`, no del reloj del celular) |

## Pruebas

- **Vitest** (`pruebas/actitud.test.ts`): los ángulos con cuaterniones conocidos (0°, 90° de cabeceo, 45° de alabeo, con ±0,5°), un barrido de rumbo, cabeceo y alabeo, `q` y `−q`, un cuaternión sin normalizar, el redondeo Q15 del enlace, el bloqueo de cardán y las decisiones de `vista.ts`.
- **Playwright** (`e2e/actitud.spec.ts`): los números de la pantalla contra el cálculo puro con los escenarios del repetidor, cada estado, el movimiento con el interpolador, el movimiento reducido, el cardán y las capturas (en `e2e/capturas/T-634/`, ignorada por git).
