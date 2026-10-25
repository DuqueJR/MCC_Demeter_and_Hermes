---
id: molicel_p30b
nombre: Molicel INR-18650-P30B
tipo: Celda Li-ion cilíndrica 18650 de alta descarga
ubicacion: Demeter (VisionPack) — también candidata para las LilyGO del CanSat (por confirmar)
fabricante: E-One Moli Energy (Molicel)
fuentes:
  - https://www.molicel.com (no accesible: las páginas de producto devolvieron HTTP 404)
  - https://fsaeonline.com/content/INR-18650-P30B-80111.pdf (copia en tercero del product data sheet v1.0; no es la fuente oficial)
  - https://www.akkuteile.de/en/lithium-ionen-battery/size-18650/molicel/molicel-inr18650-p30b-3000mah-10a-lithium-ion-battery-3-6v-3-7v_100865_3464 (tienda, referencia)
datasheet_pdf: no descargado
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# Molicel INR-18650-P30B

## Rol en el proyecto

Celdas del UPS X1200 del VisionPack de Demeter (2 celdas). El cargador de la X1200 y su gestión de protección no están verificados. Las celdas no tienen protección integrada (ver Trampas).

## Datos clave

Valores del product data sheet v1.0 (copia en tercero, fsaeonline.com). Molicel oficial no accesible.

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| Capacidad típica | 3000 mAh (10,8 Wh) | Data sheet v1.0, "Cell characteristics" |
| Capacidad mínima | 2900 mAh (10,4 Wh) | Data sheet v1.0 |
| Tensión nominal | 3,6 V | Data sheet v1.0 |
| Tensión de carga | 4,2 V | Data sheet v1.0 |
| Tensión de corte de descarga | 2,5 V | Data sheet v1.0 |
| Corriente de carga estándar / máxima | 3 A / 9 A (corte a 60 °C en la máxima) | Data sheet v1.0 |
| Tiempo de carga estándar | 1,5 h | Data sheet v1.0 |
| Corriente de descarga continua | 30 A (corte a 80 °C) | Data sheet v1.0 |
| Impedancia AC | 8 mΩ (30 % SOC) | Data sheet v1.0 |
| Impedancia DC | 17 mΩ (50 % SOC) | Data sheet v1.0 |
| Peso | 47 g (máximo) | Data sheet v1.0, "Physical characteristics" |
| Diámetro / altura | 18,6 mm / 65,2 mm (máximos) | Data sheet v1.0 |
| Energía específica | 234 Wh/kg (gravimétrica); 631 Wh/l (volumétrica) | Data sheet v1.0 |
| Temperatura de carga | 0 °C a 60 °C | Data sheet v1.0 |
| Temperatura de descarga | −40 °C a 60 °C | Data sheet v1.0 |
| Corriente de descarga máxima (retailers) | 36 A (dato de tienda, no del data sheet) | Tiendas (no oficial) |

## Interfaz y pines

- No aplica. Es una celda cilíndrica de 2 terminales. La conexión depende del soporte (UPS X1200).

## Configuración relevante para nuestro uso

- Hay que tomar 30 A (data sheet) como límite de diseño para la descarga continua, no 36 A (dato de tienda).
- La celda sin protección necesita un BMS o circuito de protección externo (según el resumen de búsqueda del data sheet y de las tiendas). La X1200 debería cubrir esto; hay que confirmarlo.

## Alimentación y tiempos

- **Peso:** 47 g por celda (máximo). Dos celdas: hasta 94 g. El peso de la X1200 más las celdas no está calculado.
- **Energía:** 2 × 10,8 Wh típicos = 21,6 Wh a nivel de celda (sin pérdidas del convertidor de la X1200).
- **Autonomía:** no calculada. Requiere consumo real de la Pi 5 y las dos cámaras.

## Librerías y ejemplos oficiales

- No aplica.

## Trampas y notas

- Las cifras de 36 A y 80 °C de corte de descarga se mezclan en las tiendas. El data sheet solo confirma 30 A continuos con corte a 80 °C.
- Las tiendas dan 47 g ± 1 g y dimensiones distintas (18,45 mm × 65,0 mm). El data sheet indica máximos de 18,6 mm × 65,2 mm y 47 g.
- Las celdas no tienen protección integrada. No conectar directamente a la Pi ni a la LilyGO sin protección.

## Incertidumbres

- **No se ha verificado en molicel.com** (HTTP 404 en la página de producto). Los datos vienen de una copia del data sheet v1.0 alojada en un tercero (fsaeonline.com). Hay que confirmar la versión vigente con Molicel.
- **Corriente máxima de descarga** (36 A): solo en tiendas, no confirmada.
- **Rango de temperatura de descarga:** el data sheet da −40 °C a 60 °C; una tienda cita corte a 80 °C para 30 A. No queda claro si son la misma condición.
- **Protección (BMS)** de la X1200: no confirmada.
