---
id: camara_imx708
nombre: Raspberry Pi Camera Module 3 (Sony IMX708)
tipo: Cámara CSI-2 para Raspberry Pi (sensor de 12 MP, autofocus PDAF)
ubicacion: Demeter (VisionPack)
fabricante: Raspberry Pi Ltd (sensor: Sony)
fuentes:
  - https://www.raspberrypi.com/documentation/accessories/camera.html
  - https://datasheets.raspberrypi.com/camera/camera-module-3-product-brief.pdf
datasheet_pdf: ../datasheets/camara_imx708.pdf
actualizado: 2026-10-24
verificacion: investigación automática (Haiku); revisar contra hardware real
---
# Raspberry Pi Camera Module 3 (IMX708)

## Rol en el proyecto

Dos cámaras del VisionPack de Demeter. Se usan para grabar el video de ascenso y el RAW de descenso con `rpicam`/libcamera.

## Datos clave

| Parámetro | Valor | Fuente |
| --- | --- | --- |
| Sensor | Sony IMX708, 11,9 MP, CMOS retroiluminado y apilado | Product brief, p. 2 |
| Resolución máxima | 4608 × 2592 píxeles | Product brief, p. 2 |
| Tamaño de píxel / diagonal | 1,4 µm × 1,4 µm / 7,4 mm | Product brief, p. 2 |
| Modos de vídeo (oficiales) | 2304 × 1296 @ 56 fps (estándar); 2304 × 1296 @ 30 fps (HDR); 1536 × 864 @ 120 fps | Doc. oficial, tabla "Video modes" |
| Vídeo común (product brief) | 1080p50, 720p100, 480p120 | Product brief, p. 2 |
| Salida | RAW10 por CSI-2 | Product brief, p. 2 |
| Control | I²C (fast mode y fast-mode plus) para el sensor y el enfoque | Product brief, p. 1 |
| Autofocus | Phase Detection Autofocus (PDAF), motorizado | Doc. oficial; product brief |
| Rango de enfoque (normal / wide) | 10 cm a ∞ / 5 cm a ∞ | Product brief, p. 4 |
| Distancia focal (normal / wide) | 4,74 mm (F1,8) / 2,75 mm (F2,2) | Product brief, p. 4 |
| Campo de visión, normal | Horizontal 66°, vertical 41°, diagonal 75° | Doc. oficial; product brief |
| Campo de visión, wide | Horizontal 102°, vertical 67°, diagonal 120° | Doc. oficial; product brief |
| HDR | Modo HDR hasta 3 MP de salida; el único modo HDR documentado es 2304 × 1296 @ 30 fps | Product brief, p. 1; doc. oficial |
| Dimensiones | 25 × 24 × 11,5 mm (12,4 mm en wide) | Product brief, p. 3 |
| Cable | 200 mm, FPC de 15 × 1 mm | Product brief, p. 3 |
| Temperatura de operación | 0 °C a 50 °C | Product brief, p. 3 |
| Filtro IR | Integrado en la variante estándar; ausente en NoIR | Product brief, p. 3 |

## Interfaz y pines

- Conector FPC de 15 × 1 mm con cable de 200 mm, conectado al conector CSI de la Pi 5 (el conector del Pi 5 admite hasta dos cámaras).
- Bus de control 2 hilos (I²C) para el sensor y el enfoque.
- Salida de datos CSI-2 (RAW10).

## Configuración relevante para nuestro uso

- **Modos de sensor y `--mode`:** la documentación oficial solo confirma la tabla de modos de vídeo. El método de selección en `rpicam-vid` (`--mode`, `--width`, `--height`, `--framerate`) no se encontró en la página leída. Hay que consultar la documentación de software de cámara (`rpicam-apps`).
- **Frames por segundo con HDR:** solo se documenta 2304 × 1296 @ 30 fps con HDR.
- **Sincronización de dos cámaras:** la documentación oficial recomienda `--frames` para que ambas capturen el mismo número de frames. Esto aparece como ejemplo `rpicam-vid --frames 300 --qt-preview -o sink.h264` en el apartado de capturas sincronizadas.
- **Ganancia y balance de blancos:** si no se fijan `--gain` y `--awbgains`, se descartan algunos frames iniciales mientras se estabilizan. La documentación recomienda fijar el obturador en modo de disparo externo.

## Alimentación y tiempos

- **Consumo:** no aparece en la documentación ni en el product brief.
- **Apagado antes de conectar:** la documentación indica apagar la Pi y desconectar la alimentación externa antes de conectar o desconectar el cable.
- **Temperatura:** operación de 0 a 50 °C. Es más restrictiva que la de la Pi 5 (0 a 70 °C). Importante para el ascenso y el descenso.

## Librerías y ejemplos oficiales

- `libcamera` y `rpicam-apps` (`rpicam-vid`, `rpicam-hello`), según la documentación oficial. La documentación de la cámara remite a la documentación de software para la configuración.

## Trampas y notas

- La resolución de 4608 × 2592 no tiene un modo de vídeo documentado. El modo completo solo aparece como resolución de sensor, no como modo de vídeo con fps.
- El modo de 2304 × 1296 @ 56 fps y el HDR a 30 fps son incompatibles en la práctica: el HDR baja el fps máximo a 30 fps (según la tabla).
- El cable FPC no debe doblarse ni tensarse (advertencia de seguridad del product brief).
- El cambio brusco de temperatura puede producir condensación y afectar a la imagen (advertencia del product brief).

## Incertidumbres

- **Modos de 4608 × 2592 @ 14 fps** (propuesto por el usuario): no confirmado. La documentación no lista un modo de vídeo a esa resolución.
- **Modos 2304 × 1296 @ 56, 1536 × 864 @ 120 y HDR 2304 × 1296 @ 30**: confirmados en la tabla de la documentación oficial.
- **Campo de visión de la variante wide** y los rangos de enfoque: confirmados en el product brief, aunque en el texto extraído aparecen mezclados con los dibujos.
- **Consumo** de la cámara: no encontrado.
- **Cómo `rpicam-vid` elige el modo** y la opción `--mode`: no confirmado en la página leída.
- **Codecs recomendados en Pi 5** (libav por software, MJPEG, H.264): no confirmado en la documentación de cámara leída.
- **Archivo local `camara_imx708.pdf`**: es el product brief de la Camera Module 3, no el datasheet del sensor IMX708.
