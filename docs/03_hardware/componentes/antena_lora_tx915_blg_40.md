---
id: antena_lora_tx915_blg_40
nombre: EBYTE TX915-BLG-40 (antena omnidireccional de fibra de vidrio 915 MHz)
tipo: Antena exterior tipo látigo (fibra de vidrio), conector N macho
ubicacion: Estación
fabricante: Chengdu Ebyte Electronic Technology (EBYTE / CDEBYTE)
fuentes:
  - https://www.cdebyte.com/products/TX915-BLG-40
  - https://www.cdebyte.com/products/TX915-BLG-40/4#Downloads (sección de descargas; sin PDF enlazado en el texto obtenido)
datasheet_pdf: no descargado
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# EBYTE TX915-BLG-40 (antena omnidireccional de fibra de vidrio 915 MHz)

## Rol en el proyecto

Antena exterior de la estación terrena (LilyGO T-Beam V1.2 variante SX1262). Se conecta por conector N macho. Recibe la telemetría de los cohetes.

**Advertencia:** los datos salen de la página de producto de EBYTE. No se encontró datasheet PDF.

## Datos clave

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| Banda de frecuencia | 880–955 MHz | [cdebyte.com (TX915-BLG-40)](https://www.cdebyte.com/products/TX915-BLG-40) |
| Ganancia | 5,5 dBi | [cdebyte.com](https://www.cdebyte.com/products/TX915-BLG-40) |
| VSWR | ≤ 1,5 | [cdebyte.com](https://www.cdebyte.com/products/TX915-BLG-40) |
| Impedancia | 50 Ω | [cdebyte.com](https://www.cdebyte.com/products/TX915-BLG-40) |
| Conector | N macho en codo (N male elbow) | [cdebyte.com](https://www.cdebyte.com/products/TX915-BLG-40) |
| Longitud | ~400 mm | [cdebyte.com](https://www.cdebyte.com/products/TX915-BLG-40) |
| Peso | 145 ± 5 g | [cdebyte.com](https://www.cdebyte.com/products/TX915-BLG-40) |
| Tipo | Fibra de vidrio, omnidireccional (según pie de foto "Omnidirectional Fiberglass Antenna") | [cdebyte.com](https://www.cdebyte.com/products/TX915-BLG-40) |
| Polarización | No indicada | No confirmado |
| Patrón de radiación (diagrama) | No indicado; solo el texto "omnidirectional" de la foto | No confirmado |
| Diámetro | No indicado | No confirmado |
| Longitud de cable | No aplica (conector directo) | — |
| Potencia máxima admisible | No indicada | No confirmado |

## Interfaz y pines

- Conector N macho. El cable coaxial hacia la radio debe tener conector N hembra en un extremo y el otro extremo compatible con la radio (SMA/IPEX/U.FL según el módulo). Pérdida del cable no especificada.
- Antena pasiva, sin pines.

## Configuración relevante para nuestro uso

- Ganancia de 5,5 dBi frente a 4 dBi de la antena del cohete: el enlace de bajada puede tener algo más de ganancia, pero el balance depende de la potencia TX, la pérdida del cable y la sensibilidad de la radio.
- Banda 880–955 MHz cubre 902–928 MHz con margen.
- Omnidireccional: el patrón en el plano horizontal no está confirmado por diagrama.

## Alimentación y tiempos

No aplica (antena pasiva).

## Librerías y ejemplos oficiales

No aplica.

## Trampas y notas

- **No confundir con TX490-BLG-40 ni TX433-BLG-40** (otras antenas EBYTE de la misma serie, bandas distintas).
- **Pérdida del cable:** no hay dato de cable en la ficha. Cualquier cable de la estación resta dB al enlace. Medir o pedir el dato al proveedor.
- **Altura y montaje:** el largo de 400 mm es mayor que el de la antena del cohete. Revisar el espacio de montaje y la altura sobre el suelo (no hay dato oficial).

## Incertidumbres

1. **Datasheet PDF:** no encontrado. No se descargó nada.
2. **Patrón de radiación, polarización, diámetro, potencia máxima:** no indicados.
3. **Ganancia en 915 MHz:** la ficha da 5,5 dBi sobre 880–955 MHz; no hay curva por frecuencia.
4. **Resultados de distribuidores:** la búsqueda devolvió antenas parecidas (TX490-BLG-40, TX433-BLG-40, TE MA9-5N de 900 MHz). No se usaron, porque no son el mismo modelo.
