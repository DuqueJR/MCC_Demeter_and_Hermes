---
id: gui_vision
estado: propuesta
actualizado: 2026-10-25
depende_de: [requisitos, estacion_terrena, maquina_estados]
---
# Visión y alcance de la web pública

## 1. Qué es

**El panel de misión público de los dos cohetes de la EIA**, Hermes y Deméter, en vivo durante el CCCD 2026 (Santa Fe de Antioquia, 8 de noviembre).
Es el *Live Public Relay* de *Objetivos* §7.F: **"enrutar y retransmitir todo el flujo de telemetría [...] hacia un servidor remoto [que] alojará el panel de misión, permitiendo que jueces o público accedan a la vista en tiempo real desde cualquier navegador."**

Es el mismo panel de la estación, **sin el centro de comandos** (D-025, GS-14).

## 2. Para quién

| Público | Qué quiere | Dónde y cómo |
| --- | --- | --- |
| **Público general** (familias, otros equipos, la EIA en Medellín) | Ver su cohete subir, saber "qué está pasando" y emocionarse | **Celular**, con datos móviles débiles en el campo, al sol, con una mano. Es la mayoría. |
| **Jueces y organización** | Ver los datos reales: fase, apogeo, salud y posición | Celular o portátil |
| **El equipo de recuperación** | Coordenadas, QR a Google Maps, distancia y rumbo desde la estación | Celular, caminando por el monte |

**Hasta 500 personas a la vez** (estimado hacia arriba, dicho por el usuario). Ver [04_arquitectura_web](04_arquitectura_web.md) §5.

## 3. Qué muestra (D-W04: todo *Objetivos* §7 menos los comandos)

Cada fila dice de dónde sale el requisito y en qué sección de la página vive ([03_experiencia_y_pantallas](03_experiencia_y_pantallas.md) §3).

| *Objetivos* | Requisito | Qué muestra la web | Sección | Prioridad web |
| --- | --- | --- | --- | --- |
| 7.B | GS-13, cinemática | Altitud, velocidad (vertical y total), aceleración X, Y y Z | Telemetría | **M** |
| 7.B | Registro de apogeo | Altura máxima, fija en pantalla | Telemetría | **M** |
| 7.B | Fases | La fase actual, en palabras para el público, y la línea de fases | Barra de misión y Estado | **M** |
| 7.B | Tiempos | Tiempo de vuelo (T+), estimado a la siguiente fase y tiempo restante | Barra de misión y Estado | **M** (el transcurrido) / S (los estimados) |
| 7.A | GS-10, mapa 2D táctico | Estación, rampa, cohete, trayectoria, elipse de impacto, distancia radial y azimut | Mapa | **M** |
| 7.G | GS-03, LKP | Nunca se borra la pantalla. Se congela y se resalta **en rojo** la última posición y su altitud. | Mapa y Barra de misión | **M** |
| 7.G | GS-04, QR | Coordenadas de impacto grandes y un QR de Google Maps | Recuperación | **M** |
| 7.G | GS-02, vector de navegación | Distancia horizontal en metros y azimut desde la estación | Recuperación y Mapa | **M** |
| 7.G | GS-05, alarma de descenso | Alerta roja de despliegue fallido, **solo en DESCENT** (D-014) | Banner global | **M** |
| 7.C | GS-06, salud | Go/No-Go, sensores, calibraciones, EKF, RSSI, satélites y batería | Salud del cohete | **S** (resumen M) |
| 7.A | Actitud | Roll, pitch y yaw del cuaternión | Actitud | **S** (2D). El 3D es *could* (D-W03). |
| 7.E | GS-08, interpolación | Movimiento fluido entre paquetes de 10 Hz | Todo lo animado | **S** |
| 7.E | Backfill | Barra de "reconstruyendo el vuelo" y gráficas que se reemplazan con la resolución completa | Gráficas | **S** |
| 7.F | GS-11, gráficas | Altitud, velocidad y aceleración contra el tiempo | Gráficas | **S** (las fijas) / C (cruzar variables) |
| 7.A | GS-09, 3D | Trayectoria 3D con la predicción de la parábola | — | **C** (D-W03) |
| — | Deméter (VisionPack) | Estado de la Pi y de las cámaras, temperatura de la Pi: "Los ojos de Deméter" | Carga útil (solo Deméter) | **S** |
| — | Contexto | Fotos del cohete y del equipo, el motor, la misión y los integrantes | Inicio y Equipo | **M** |

**No se muestra:** el centro de comandos (7.D), ni ningún botón que hable con el cohete, ni el log crudo.

## 4. Prioridades de la web (MoSCoW)

- **Must (para el 8 de noviembre):**
  - la portada;
  - las dos páginas de misión con su tema;
  - la barra de misión;
  - la telemetría;
  - el mapa con LKP;
  - la recuperación (coordenadas, QR y vector);
  - la alarma de descenso;
  - los estados de la página (antes del vuelo, en vivo, sin señal y aterrizado);
  - que aguante 500 personas en el celular.
- **Should:**
  - salud del cohete detallada;
  - actitud 2D;
  - gráficas fijas;
  - "Los ojos de Deméter";
  - tiempos estimados;
  - backfill;
  - interpolación.
- **Could:**
  - el cohete en 3D (inicio, actitud y trayectoria) — ver [08_modelo_3d_futuro](08_modelo_3d_futuro.md);
  - gráficas personalizables;
  - repetición del vuelo después del evento.
- **Won't (por ahora):**
  - inglés;
  - modo claro;
  - una vista conjunta de los dos cohetes (rompe D-W01);
  - un archivo histórico de vuelos;
  - comentarios o chat.

## 5. Principios de diseño

1. **Primero el celular.** Todo se diseña a 360–430 px de ancho y luego se amplía.
2. **Se entiende sin saber de cohetes.** Las fases y los números llevan palabras humanas ("Subiendo con el motor encendido"), y el detalle técnico está a un toque.
3. **Nunca una pantalla vacía ni un error a la vista** (*Objetivos* 7.G). Sin datos se muestra el último valor con su antigüedad.
4. **Cada equipo tiene su alma; la información tiene una sola gramática.** El tema cambia el ambiente, no el significado de los colores de estado.
5. **Liviana:** quien entra a Deméter no descarga nada de Hermes (D-W01), y la página carga bien con 3G.
