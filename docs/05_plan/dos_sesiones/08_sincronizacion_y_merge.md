---
id: dos_sesiones_sincronizacion
estado: aprobado en lo que corresponde a DP-01 y DP-02; el resto es propuesta
actualizado: 2026-10-25
depende_de: [flujo_trabajo, dos_sesiones_decisiones]
---
# Sincronización, merge y revisión cruzada

## 1. Calendario de sincronizaciones

| Sincronización | Cuándo | Duración | Quiénes | Agenda |
| --- | --- | --- | --- | --- |
| **Mañana** | Todos los días al empezar (la hora la fijan ustedes) | 15 min | Los dos, en persona | (1) Qué se terminó y qué se integró. (2) Bloqueos. (3) **Ventanas de la placa del día** (§3 de [07](07_pruebas_y_placas.md)). (4) Orden de los merges del día. (5) Cuota: `/status` de las dos cuentas. |
| **Cierre de bloque** | Al terminar cada bloque | 5 min, cada uno | Cada uno, por escrito | `/cierre`: actualizar `estado/sesion_X.md`, la bitácora, push |
| **H0** | 26 oct, tarde | 45 min | Los dos | Congelar C-01 a C-05; cerrar D-022 (B′ o A′) con la evidencia de PEN-18; resultado de T-S12 (TG28, BM8563, QMC6309, el radio de la V1.2); activar el plan B de RP-02 si aplica; ratificar DP-10 a DP-16 |
| **H1** | 29 oct, tarde | 30 min | Los dos | Resultado de P-02 parcial; la cadena NAV → PC; ¿T-701 confirmado?; recortes si hay atraso; consolidar el backlog |
| **H2** | 1 nov, después de la jornada | 30 min | Los dos | P-03, P-05, P-09 y P-10; ARM y DISARM por la CLI; ¿se activan los recortes 1–3? |
| **H3** | 3 nov, después de la jornada | 30 min | Los dos | Ensayos de misión; lista de correcciones para antes del congelamiento |
| **H4** | 4 nov, 12:00 | 30 min | Los dos | Congelamiento; `release/v1.0.0-cccd`; qué placa va en qué cohete; carga en pareja |

**En cada sincronización de hito** se consolida, a partir de las fichas de estado y de la bitácora, lo que el plan existente asigna al documentador:
- el estado del backlog;
- `registro_pruebas.md`;
- las decisiones;
- los pendientes;
- los riesgos.

Lo hace **una sola persona por hito, por turnos** (H0 A, H1 B, H2 A, H3 B, H4 A), en una rama `docs/consolidacion-Hx`, para que no haya dos ediciones del mismo archivo.

## 2. Flujo de ramas y orden de los merges

Es DP-01, que reemplaza a D-028.

- **Ramas de trabajo:** `feature/T-xxx-<slug>` o `fix/T-xxx-<slug>`, que salen de `develop`. **Duran ≤ 1 día.** Si una tarea no cabe en un día, se parte.
- **Cada mañana:** cada rama abierta se actualiza desde `develop` (merge de `develop` hacia la rama). **Nunca se rebasa una rama ajena.**
- **Orden de los merges:**
  1. contratos y vectores (C-xx, `tools/vectores/`);
  2. los tipos compartidos de `firmware/src/estado/`;
  3. productores y consumidores contra el contrato, en cualquier orden;
  4. integración en `main.cpp` (en pareja).
- **Conflictos:** **quien integra de segundo los resuelve**. Si el conflicto está en un archivo compartido, se resuelve en pareja.
- **`main`:** solo con las versiones etiquetadas. **`release/v1.0.0-cccd`:** el 4 de noviembre a las 12:00. **`hotfix/*`:** en el campo.
- **Merge a `develop` con `--no-ff`** y Conventional Commits en español con el ID de la tarea. Eso no cambia ([flujo_trabajo](../flujo_trabajo.md)).

## 3. Cambiar un contrato

Contratos son: [protocolo_paquetes](../../04_diseno/protocolo_paquetes.md), [enlace_lora_tdma](../../04_diseno/enlace_lora_tdma.md), [maquina_estados](../../04_diseno/maquina_estados.md), [visionpack_integracion](../../04_diseno/visionpack_integracion.md), [constantes](../../02_requisitos/constantes.md) y C-01 a C-05.

1. **Quien lo necesita escribe la propuesta:** qué cambia, por qué, a quién afecta y si toca a un tercero. Va en su bitácora y en una entrada `DP-xx` "propuesta" de [09_decisiones.md](09_decisiones.md).
2. **Si afecta a un tercero** (el equipo de hardware, el de visión, Pablo Tilano o el plan de la GUI), **se le consulta antes**. La aprobación de ustedes no reemplaza la suya.
3. **Aprobación de los dos** en la siguiente sincronización. Si es urgente, en persona en el momento.
4. **Primero el documento, después el código** ([00_INDICE](../../00_INDICE.md), regla 2). Si cambia el protocolo, sube `PROTO_VERSION` **y se avisa al plan de la GUI**.
5. **Se actualizan los vectores** del contrato en el mismo PR que el documento.

## 4. Revisión cruzada

Es DP-01 y DP-02.

| Qué cambia | Modo | Revisión |
| --- | --- | --- |
| **Firmware** (`firmware/`) | **Preguntar** | `revisor` y después **revisión humana del otro, antes del merge** |
| **Contratos** (los de `docs/04_diseno/`, `constantes.md`, `06_contratos/`, `firmware/src/estado/`, `config.h`, `constantes.py`) | **Preguntar** | `revisor` y después **aprobación humana de los dos** |
| **`tools/`, pruebas y documentación** que no sean contratos | **Mostrar** | `revisor`. **Merge con la integración continua en verde**, y revisión humana asíncrona del otro en **< 24 h**. Si la revisión encuentra un problema, se abre un `fix/` |
| **`estacion/` y `visionpack/`** | **Preguntar** | Son back-end crítico para el vuelo (la CLI y los comandos), así que llevan revisión previa. ⚠️ **Es una interpretación**: DP-01 solo nombra el firmware y los contratos. Confirmar en H0 ([PA-20](11_preguntas_abiertas.md)) |

**Mientras T-S10 (la integración continua) no esté aplicada,** "en verde" significa: el informe del `desarrollador` con la salida de la compilación y de las pruebas, y el `revisor` sin hallazgos de corrección.

**Tiempo de respuesta de las revisiones:** como trabajan juntos, **en el mismo día**. Las revisiones pendientes se repasan en la sincronización de la mañana.

**El `revisor` solo reporta** lo que afecta la corrección, los contratos o el "hecho" ([mejores prácticas](https://code.claude.com/docs/en/best-practices): "revisión adversaria", sin perseguir preferencias de estilo).
