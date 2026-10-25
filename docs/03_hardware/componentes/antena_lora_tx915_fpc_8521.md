---
id: antena_lora_tx915_fpc_8521
nombre: EBYTE TX915-FPC-8521 (antena FPC interna 915 MHz)
tipo: Antena interna FPC (PCB flexible), conector IPEX
ubicacion: CanSat (ambos cohetes)
fabricante: Chengdu Ebyte Electronic Technology (EBYTE / CDEBYTE)
fuentes:
  - https://www.cdebyte.com/products/TX915-FPC-8521
  - https://www.cdebyte.com/products/TX915-FPC-8521/4#Downloads (sección de descargas; sin PDF enlazado en el texto obtenido)
datasheet_pdf: no descargado
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# EBYTE TX915-FPC-8521 (antena FPC interna 915 MHz)

## Rol en el proyecto

Antena de la radio LoRa del CanSat (LilyGO T-Beam Supreme), conectada por IPEX-1 (IPEX-I según la ficha de EBYTE). Es la antena interna del cohete, en ambos cohetes según el brief.

**Advertencia:** los datos salen de la página de producto de EBYTE. No se encontró datasheet PDF, así que muchos campos quedan sin confirmar (ver Incertidumbres).

## Datos clave

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| Banda de frecuencia | 860–940 MHz | [cdebyte.com (TX915-FPC-8521)](https://www.cdebyte.com/products/TX915-FPC-8521) |
| Ganancia | 4 dBi | [cdebyte.com](https://www.cdebyte.com/products/TX915-FPC-8521) |
| VSWR | ≤ 1,5 | [cdebyte.com](https://www.cdebyte.com/products/TX915-FPC-8521) |
| Impedancia | 50 Ω | [cdebyte.com](https://www.cdebyte.com/products/TX915-FPC-8521) |
| Tipo | FPC con antena integrada | [cdebyte.com](https://www.cdebyte.com/products/TX915-FPC-8521) |
| Conector | IPEX (descrito como IPEX-I) | [cdebyte.com](https://www.cdebyte.com/products/TX915-FPC-8521) |
| Dimensiones | 85 mm × 21 mm | [cdebyte.com](https://www.cdebyte.com/products/TX915-FPC-8521) |
| Polarización | No indicada | No confirmado |
| Patrón de radiación | No indicado (la URL y el título dicen "omnidirectional", pero no hay diagrama) | No confirmado |
| Peso | No indicado | No confirmado |
| Longitud de cable | No indicada (es FPC montada, sin cable declarado) | No confirmado |
| Potencia máxima admisible | No indicada | No confirmado |

## Interfaz y pines

- Conector IPEX / IPEX-I hacia la radio. Confirmar que el T-Beam Supreme usa IPEX-1 (u otro) en el esquemático.
- Antena FPC: la señal se conecta por el conector y la antena es el propio PCB flexible. No tiene pines.

## Configuración relevante para nuestro uso

- Banda de 860–940 MHz cubre 902–928 MHz, pero no hay curva de ganancia por frecuencia. Verificar la eficiencia en 915 MHz con medida (VNA) si es posible.
- Con VSWR ≤ 1,5, la pérdida por desadaptación es moderada. Medir el VSWR en el montaje final.
- No confundir con **TX915-FPC-4510** (otra antena FPC de EBYTE, 868–915 MHz, 2 dBi, según un distribuidor). Sus datos no aplican a la 8521.

## Alimentación y tiempos

No aplica (antena pasiva).

## Librerías y ejemplos oficiales

No aplica.

## Trampas y notas

- **Montaje FPC (recomendación general, no confirmada en la ficha de EBYTE):** una antena FPC rinde peor cerca de metal, baterías, fibra de carbono o planos de masa grandes. Conviene montarla sobre un soporte no metálico y con espacio libre alrededor. El fabricante no lo indica en la ficha consultada.
- Estructura del cohete: si el cuerpo es de fibra de carbono (blindaje RF), la antena FPC interna quedará muy atenuada. Revisar con el diseño mecánico.
- El tiempo de vida del adhesivo y la rigidez del FPC no están documentados.

## Incertidumbres

1. **Datasheet PDF:** no encontrado. La página de descargas no contiene un PDF enlazado en el texto obtenido. No se descargó nada.
2. **Patrón de radiación, polarización, peso, potencia máxima:** no indicados.
3. **Ganancia de 4 dBi a 915 MHz:** la ficha da 4 dBi sobre 860–940 MHz; no hay valor por frecuencia.
4. **Conector:** la ficha dice "IPEX-I"; el brief dice IPEX-1. Son probablemente el mismo conector (IPEX/U.FL), pero hay que confirmarlo en el T-Beam Supreme.
5. **Búsqueda en distribuidores:** los resultados de eBay y Hubtronics no aportaron especificaciones del modelo 8521.
