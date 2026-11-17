---
id: gui_modelo_3d
estado: congelado (could, D-W03). Se retoma solo si W2 termina antes o después del evento.
actualizado: 2026-10-25
depende_de: [gui_pantallas]
---
# El cohete en 3D (congelado)

**Qué sería:**
- en el **Inicio**, el cohete girando, con partes que se pueden tocar para ver qué son (T-650);
- el mismo modelo **orientado con el cuaternión real** en la Actitud (T-651);
- la trayectoria 3D (T-652).

**Mientras tanto:** el Inicio usa fotos y chips de partes, y la Actitud es 2D (03 §3.1 y §3.6).

## 1. Lo que hace falta para construirlo

| # | Qué | Detalle |
| --- | --- | --- |
| 1 | **El archivo** | El usuario cree que los cohetes están en **OpenRocket** (`.ork`). Las versiones recientes de OpenRocket (23.09 o posterior) exportan **OBJ por componente** (V: confirmarlo con su versión). Si existe un CAD (Fusion, SolidWorks u Onshape), es mejor un **STEP** o un **glTF**. |
| 2 | **Una pieza por parte que se pueda tocar, con nombre** | Nariz, tubo superior, bahía del CanSat, CanSat, VisionPack y cámaras (solo Deméter), acoplador, tubo inferior, aletas, motor (G80 o H135), paracaídas y botones de riel |
| 3 | **Los textos de cada parte** | De 1 a 3 frases, los mismos de los chips de Inicio (PEN-W03) |
| 4 | **Las medidas reales** | Largo, diámetro (Deméter: 8 cm, según la simulación), número de aletas y la posición del CanSat |
| 5 | **Fotos o materiales** | Cartón, PETG y PETG-CF, y los colores reales |
| 6 | **¿Interior visible?** | Para mostrar el CanSat o la Pi por dentro se necesita un corte o una vista explotada, y esas piezas modeladas |

## 2. Lo que hacemos nosotros

- **Blender:** limpiar el modelo, nombrar las piezas y asignar materiales PBR sencillos.
- **glTF 2.0 binario (`.glb`):**
  - el eje del cohete en +Y, con la nariz arriba;
  - en metros;
  - menos de 30 000 triángulos en total;
  - comprimido con meshopt o Draco a < 2–3 MB.
- **three.js**, cargado diferido solo en la página de su misión (D-W01). Con selección por pieza (*raycasting*) y una tarjeta inferior como la de los chips.
- **En el celular de gama baja:** si el dispositivo no da 30 fps, se muestra la foto (el respaldo es la versión actual).
