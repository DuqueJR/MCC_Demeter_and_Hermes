---
id: gui_pantallas
estado: propuesta
actualizado: 2026-10-25
depende_de: [gui_vision, gui_identidad, gui_contrato_datos]
---
# Experiencia y pantallas

Hay tres páginas independientes (D-W01). Las URLs son estables y cortas porque se van a compartir por WhatsApp y en un QR del evento.

| URL | Página | Qué descarga |
| --- | --- | --- |
| `/` | Portada (cubierta) | Solo HTML y CSS, los dos parches y los dos fondos. **Sin JavaScript de aplicación.** |
| `/demeter/` | Misión Deméter | El tema, las fuentes, las imágenes y los datos de Deméter |
| `/hermes/` | Misión Hermes | El tema, las fuentes, las imágenes y los datos de Hermes |

El código común (cliente de datos, componentes) se comparte en el build, pero **ningún asset de una misión aparece en la página de la otra**.

## 1. Portada (`/`): la cubierta

Una cubierta a pantalla completa (`100svh`), sin desplazamiento, con dos mitades: **Deméter** (nodo 1) y **Hermes** (nodo 2), en ese orden.

```
PORTÁTIL (≥ 768 px, horizontal)                      CELULAR (< 768 px o vertical)
┌──────────────────────┬──────────────────────┐      ┌──────────────────────┐
│ [EIA]  CCCD 2026 · Santa Fe de Antioquia · 8 nov │ │ [EIA] CCCD 2026 · 8 nov │
│                      │                      │      │  montaña, bosque     │
│   montaña, bosque,   │   nubes lavanda al   │      │      ( PARCHE )      │
│   trigo (pintado)    │   atardecer (pintado)│      │      DEMÉTER         │
│                      │                      │      │   Toca para entrar   │
│     ( PARCHE  )      │     ( PARCHE  )      │      ├──────────────────────┤
│      DEMÉTER         │       HERMES         │      │  nubes al atardecer  │
│  La tierra que mira  │   El mensajero       │      │      ( PARCHE )      │
│      Entrar →        │      Entrar →        │      │       HERMES         │
│                      │                      │      │   Toca para entrar   │
└──────────────────────┴──────────────────────┘      └──────────────────────┘
```

- **Fondo de cada mitad:** un paisaje pintado acorde con su parche ([07_assets_e_imagenes](07_assets_e_imagenes.md) §2), a sangre. Va oscurecido con un degradado hacia el `--fondo` de su tema para que el parche resalte. La unión entre las dos mitades es una línea fina de 1 px, con opacidad del 20 %.
- **El parche** va centrado en su mitad:
  - en el portátil, con un tamaño de `min(34vw, 380px)`;
  - en el celular, de `min(32svh, 68vw)`.

  Debajo lleva el nombre (en la fuente de títulos de su tema), un lema corto y "Entrar →" ("Toca para entrar" en el celular).
- **Interacción** (pedida por el usuario):
  - con el ratón (`hover`) o el foco del teclado, el parche **crece a 1,08×**, su halo se intensifica y el fondo de esa mitad se aclara un poco;
  - la otra mitad se oscurece un 15 %;
  - la duración y la curva son las de cada tema (`--dur-media`, `--curva`).
- **Clic (D-W10):** **toda la mitad** es el enlace, y el parche es el foco visual. En el celular es mucho más fácil tocar media pantalla que un círculo. Visualmente es igual a lo pedido.
- **Sin JavaScript** (el hover es CSS). Sin datos en vivo: es solo la cubierta.
- **Cabecera** (fina, superpuesta, centrada sobre la unión): el logo blanco de la EIA y "CCCD 2026 · Santa Fe de Antioquia · 8 de noviembre".
- **Accesibilidad:** dos enlaces con `aria-label="Entrar a la misión Deméter"` (y Hermes); se puede navegar con el teclado.
- **Presupuesto:** menos de 500 KB en total y LCP < 2 s en 4G (ver [04_arquitectura_web](04_arquitectura_web.md) §6).

## 2. Página de misión: estructura

La misma estructura para los dos (cambia el tema) y una sección extra en Deméter.

### 2.1 Celular (una columna)

```
┌──────────────────────────────┐
│ (p) DEMÉTER  ● EN VIVO  T+ 00:42 │  ← Barra de misión (fija arriba)
│ Bajando con paracaídas   312 m   │
├──────────────────────────────┤
│ ⛔ Descenso rápido: 14 m/s…   │  ← Banner de alarma (solo si aplica)
├──────────────────────────────┤
│ Inicio: fotos, quiénes somos │
│ Estado de la misión           │
│ Telemetría                    │
│ Mapa                          │
│ Recuperación                  │
│ Actitud                       │
│ Gráficas                      │
│ Salud del cohete              │
│ Los ojos de Deméter (solo D.) │
│ Equipo                        │
│ Pie: EIA · ← Ver Hermes       │
└──────────────────────────────┘
  [Estado][Mapa][Datos][Equipo]   ← Navegación inferior fija (anclas)
```

### 2.2 Portátil (≥ 1024 px, panel de control)

```
┌────────────────────────────────────────────────────────────────────┐
│ (p) DEMÉTER   ● EN VIVO   T+ 00:42   Bajando con paracaídas   312 m │
├────────────────────────────────────────────────────────────────────┤
│ Inicio (banda baja: foto del cohete, parche, motor, una frase)     │
├───────────────┬─────────────────────────────────┬──────────────────┤
│ Estado        │                                 │ Recuperación     │
│ Telemetría    │            MAPA                 │ Salud del cohete │
│               │                                 │ (Ojos de Deméter)│
├───────────────┴───────────────┬─────────────────┴──────────────────┤
│ Gráficas                      │ Actitud                            │
├───────────────────────────────┴────────────────────────────────────┤
│ Equipo · Pie                                                       │
└────────────────────────────────────────────────────────────────────┘
```

- **Puntos de quiebre:** < 600 px (una columna), 600–1023 px (dos columnas, con el mapa a lo ancho) y ≥ 1024 px (panel de la figura).

## 3. Secciones

### 3.0 Barra de misión (siempre visible)
- Lleva:
  - el parche pequeño y el nombre;
  - el **indicador de conexión** (§4);
  - **T+** (el tiempo de vuelo: T− no existe, porque no sabemos la hora de lanzamiento);
  - la **fase** con su título humano ([02_identidad_visual](02_identidad_visual.md) §9);
  - la **altitud actual**.
- Al tocarla se va a "Estado de la misión".
- Con LKP, la altitud se muestra en rojo con 📍 y su antigüedad.

### 3.1 Inicio (en lugar del 3D, D-W03)
- **Celular:** un carrusel deslizable de 3 a 5 fotos (el cohete, el equipo, el CanSat y, en Deméter, el VisionPack).
- **Portátil:** una banda con la foto principal.
- **Datos fijos:**
  - el nombre;
  - el lema;
  - **el motor** (Deméter, H135W-8; Hermes, G80-7T, según [constantes](../02_requisitos/constantes.md) `MOTORES`);
  - una frase de qué hace la misión.
- **Chips de "partes del cohete":** al tocar uno, se abre una tarjeta con 1 a 3 frases (nariz, CanSat, VisionPack, motor, paracaídas, aletas). Así el 3D queda reemplazado por algo útil y barato. Los textos son PEN-W03.

### 3.2 Estado de la misión
- **Línea de fases:** Rampa → Despegue → Inercia → Apogeo → Paracaídas → En tierra. Es la versión pública de los 10 estados, y FREE_FALL se muestra como un paso intermedio solo si ocurre.
  - Cada paso marca **la hora T+ en que ocurrió**.
- **T+ transcurrido** (M); **tiempo estimado a la siguiente fase** y **tiempo de vuelo restante** (S, GS-13), con la etiqueta "estimado".
- **Objetivos de la misión, que se encienden solos:**
  - despegue detectado;
  - fin de la combustión;
  - eyección del paracaídas;
  - apogeo;
  - aterrizaje;
  - Deméter: cámaras grabando;
  - después del vuelo: "motor caracterizado" (cuando el equipo lo publique).

  Es lo que más engancha al público. Sale de `flags`, `fase` y `act` del [contrato](05_contrato_datos_web.md).

### 3.3 Telemetría (*Objetivos* 7.B)
- **Celular, en una cuadrícula de 2 columnas:**
  - **Altitud** (grande, a dos columnas);
  - **Velocidad vertical** (con una flecha ↑↓);
  - **Velocidad total**;
  - **Apogeo** (fijo, con 🏔 y la hora T+ en que ocurrió);
  - **Aceleración X, Y y Z** (una fila compacta, en g).
- Cada número lleva su unidad. Si el dato tiene más de `WEB_DATO_VIEJO_S`, se pinta en `--estado-sin-dato` con su antigüedad.

### 3.4 Mapa (*Objetivos* 7.A, GS-10)
- **Capas:**
  - la base oscura con el estilo del tema;
  - la **rampa**;
  - la **estación**;
  - la **trayectoria** (línea `--acento`, que se desvanece con el tiempo);
  - el **cohete** (un punto con halo y la dirección);
  - la **elipse de impacto**;
  - la **línea estación → cohete** con su chip de distancia y azimut.
- **En LKP:** el punto pasa a 📍 rojo fijo, con la altitud y "hace X s". **Nunca se borra** (GS-03).
- **Controles:** centrar en el cohete, ver todo y pantalla completa. **En el celular, el mapa no captura el desplazamiento de la página:** hay que tocarlo para activarlo o usar dos dedos. Si no, la gente queda "atrapada" en el mapa.
- **Alto:** 60 % del alto de la pantalla en el celular, y el centro del panel en el portátil.

### 3.5 Recuperación (*Objetivos* 7.G)
- **Coordenadas** en decimal, grandes y en alto contraste, con un botón "Copiar".
- **Botón principal "Abrir en Google Maps"** (en el celular, un enlace es mejor que un QR). El **QR** va al lado en el portátil y a un toque en el celular, para escanearlo desde otro teléfono.
  - URL: `https://www.google.com/maps/search/?api=1&query=LAT,LON`.
- **Vector de navegación:** la distancia horizontal en metros y el azimut en grados desde la estación, con una flecha de brújula.
- **Antes del aterrizaje:** muestra el **punto de impacto estimado** (el centro de la elipse) con la etiqueta "estimado". **Después:** la posición real o el LKP, con su antigüedad.

### 3.6 Actitud (*Objetivos* 7.A, prioridad S)
- **Versión 2D** (D-W03):
  - un **horizonte artificial** (pitch y roll);
  - una **brújula** (yaw / rumbo);
  - los tres ángulos en grados.

  Los ángulos se calculan del cuaternión (`q`) del contrato.
- Si el EKF no está listo (`ekf_ok = false`), se muestra "Orientación aún no disponible".
- El modelo 3D que reemplaza esto está en [08_modelo_3d_futuro](08_modelo_3d_futuro.md).

### 3.7 Gráficas (GS-11, prioridad S)
- Pestañas: **Altitud**, **Velocidad vertical** y **Aceleración**, contra T+.
- Marcas verticales en los eventos (despegue, fin de la combustión, eyección y apogeo).
- **Backfill (*Objetivos* 7.E):** cuando llega, sale una barra "Reconstruyendo el vuelo con todos los datos: 63 %". Al terminar, la gráfica se reemplaza por la de máxima resolución, con un aviso.
- Las gráficas personalizables (cruzar variables) son *could*.

### 3.8 Salud del cohete (*Objetivos* 7.C, prioridad S)
- **Resumen siempre visible:** "Todo en orden ✓", "2 avisos ⚠" o "Falla en un sensor ⛔". El **Go/No-Go** se muestra como un chip maestro en PREFLIGHT y ARMED.
- **Detalle desplegable:**
  - sensores (cada bit de `fallas`, con su nombre);
  - calibraciones (en proceso o completadas);
  - navegación (EKF bien o divergente, con la innovación);
  - enlace (RSSI, SNR, satélites, precisión horizontal);
  - batería (% y V);
  - SD (MB libres);
  - temperatura.

### 3.9 Los ojos de Deméter (solo en `/demeter/`, prioridad S)
- El estado de la Pi, traducido del `StatusCode` ([visionpack_integracion](../04_diseno/visionpack_integracion.md)).
- **Cámaras grabando** (`act.CAM_OK`), el pulso de encendido enviado y la temperatura de la Pi.
- Un texto corto de qué graban las cámaras. Visualmente usa la gema-ojo (`--marca-3`).

### 3.10 Equipo
- **El parche grande**, luego una cuadrícula de integrantes (foto, nombre y rol) y el logo de la EIA. Los datos son PEN-W02.

### 3.11 Pie
- EIA, CCCD 2026 y un enlace "Ver la misión Hermes →" (o Deméter). **El enlace solo navega:** no precarga nada de la otra misión.

## 4. Estados de la página

La web distingue **dos conexiones distintas**: la del cohete con la estación y la de tu celular con el servidor. Se explican de forma diferente.

| Estado | Cuándo | Qué se ve |
| --- | --- | --- |
| **Cargando** | Antes del primer dato | El esqueleto de la página con los últimos datos del *snapshot* (sin spinners vacíos) |
| **Sin transmisión todavía** | El servidor responde pero la estación no ha mandado nada en `WEB_SIN_TRANSMISION_MIN` | "La transmisión en vivo empieza el día del lanzamiento", con el botón **"Ver la simulación del vuelo"** |
| **Simulación** | El usuario la eligió, o el servidor está en modo demo | El banner ⓘ cian "SIMULACIÓN: así será el vuelo" fijo, y la marca "SIM" en la barra. **Nunca se confunde con lo real.** |
| **En vivo** | Datos con menos de `WEB_DATO_VIEJO_S` | ● verde "EN VIVO" |
| **Señal débil** | El último dato tiene entre `WEB_DATO_VIEJO_S` y `WEB_SIN_SENAL_S` | ⚠ ámbar "Señal débil" y los números atenuados |
| **Sin señal del cohete (LKP)** | Más de `WEB_SIN_SENAL_S` sin datos del cohete, con el servidor conectado | ⛔ "Sin señal del cohete · última posición hace 38 s". Todo se congela, y la posición y la altitud quedan en rojo (GS-03). |
| **Sin conexión con el servidor** | El SSE se cayó (tu internet) | Una barra gris "Reconectando…" con reintento automático. Los datos se mantienen. **No se confunde con un problema del cohete.** |
| **Aterrizado** | `fase = LANDED` | La sección Recuperación sube al inicio. Se muestra el resumen del vuelo: apogeo, duración, velocidad máxima y deriva. |
| **Reconstruyendo** | Hay un backfill en curso | La barra de progreso en Gráficas |
| **Alarma de descenso** | `alarmas.descenso_rapido` | Un banner rojo fijo bajo la barra de misión, mientras dure y 10 s más |

**Umbrales de la web** (provisionales, `(P)`, a consolidar en [constantes](../02_requisitos/constantes.md) en una sección nueva "Web"):
- `WEB_DATO_VIEJO_S` = 2;
- `WEB_SIN_SENAL_S` = 5;
- `WEB_SIN_TRANSMISION_MIN` = 10;
- `WEB_RECONEXION_MAX_S` = 15.

## 5. Interpolación y fluidez

- Los números grandes se actualizan como mucho **10 veces por segundo**, con números tabulares.
- El punto del mapa y la actitud se **interpolan** entre paquetes (lineal para la posición y *slerp* para el cuaternión) con un retraso de presentación de 1 paquete (100 ms). Así se mueven fluido (*Objetivos* 7.E.1).
- Si la pestaña está en segundo plano, se pausa el dibujo; los datos siguen llegando.
