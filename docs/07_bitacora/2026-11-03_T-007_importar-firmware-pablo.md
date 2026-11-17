---
fecha: 2026-11-03
tipo: tarea
ids: [T-007, D-037, D-043]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-007-importar-firmware-pablo
---
# T-007: importar el snapshot 17139b2 del firmware de Pablo

## Contexto
Pablo (ptilanom/DEMETER) tiene el firmware de vuelo y de tierra. Se importa su snapshot `17139b2` a nuestro repo sin tocar su código (D-037), con un único parche de rutas (P1). La especificación del documentador (`docs/05_plan/sincronizacion_firmware_pablo.md`) todavía no estaba en `origin/claude/trusting-dirac-k7vp9e` al empezar; se trabajó con la especificación del encargo.

## Qué se hizo
- Rama `feature/T-007-importar-firmware-pablo` desde `origin/develop` (`a567f35`), en su propio worktree.
- Origen: clon de solo lectura `/home/user/demeter`, `HEAD = 17139b2827d3d89a26bec1ceffc8d65f16c17e60`.
- Mapa aplicado:
  - `tbeam_fw/{platformio.ini,boards/,src/,.gitignore}` a `firmware/cohete/`
  - `tbeam_tierra/{platformio.ini,src/,.gitignore}` a `firmware/tierra/`
  - `common/net_proto/*.h`, `common/.gitignore`, `common/lilygo_local.patch` a `firmware/common/`
  - Submódulo LilyGO en `firmware/vendor/Lilygo-LoRa-Series`, gitlink en `1991b1ed70915d4f246b841f99f6027166ea7330`
  - Simulación de Hermes a `datos/simulaciones/openrocket/hermes_G80-7T_santa-fe-antioquia_pablo.csv`, con su fila en `datos/README.md`
  - La simulación de Demeter de Pablo NO se copió: su md5 (`f00556cf877de065d6a7e6c594d21bf8`) es idéntico al de `demeter_H135W-8_santa-fe-antioquia_sim2.csv`
  - `tbeam_fw/tools/*.py`, `dashboard.html`, `calib_*.json` a `tools/tbeam/`
  - 19 `*.BIN.txt` (15 DEM y 4 HER) a `datos/logs_referencia/pablo/`
  - `CLAUDE.md` de Pablo a `docs/fuentes/demeter_pablo/CLAUDE_17139b2.md`
- No copiados: `bloque2_3_src/`, `bloque4_imu/`, `bloque4b_wtm/`, `logger_bloque5/`, `DATASHEETS/`, `.claude/`, `*/.vscode/`, `README.md`. No existe `secrets.h` en el origen.
- Archivos nuevos nuestros: `firmware/common/net_proto/secrets.h.ejemplo`, `firmware/README.md` (reemplaza el anterior), `tools/tbeam/README.md`, `datos/logs_referencia/README.md`, y 8 líneas de `.gitignore` (`secrets.h`, `tools/tbeam/sesiones/`, `tools/tbeam/mision.json`, `*.BIN`, `*.BIN.part`, `*_csv/`, `*_ekf.csv`, `pio_cache/`).
- Commits: `d70dffb` (firmware y submódulo), `aa36322` (herramientas), `9823ac4` (datos), `3d71e2d` (README, CLAUDE de Pablo y .gitignore).

### Parche P1 (diff exacto, único cambio a archivos de Pablo)

`firmware/cohete/platformio.ini`:
```
2d1
< build_cache_dir = C:\Users\ptila\TBEAM\pio_cache
20,21c19,20
<     C:\Users\ptila\TBEAM\Lilygo-LoRa-Series\lib
<     C:\Users\ptila\TBEAM\common
---
>     ../vendor/Lilygo-LoRa-Series/lib
>     ../common
```

`firmware/tierra/platformio.ini`:
```
2d1
< build_cache_dir = C:\Users\ptila\TBEAM\pio_cache
18,19c17,18
<     C:\Users\ptila\TBEAM\Lilygo-LoRa-Series\lib
<     C:\Users\ptila\TBEAM\common
---
>     ../vendor/Lilygo-LoRa-Series/lib
>     ../common
```

## Evidencia
1. **`diff -r` origen contra destino: sin diferencias** en `src/` de cohete y de tierra, `boards/`, los `.gitignore`, `lilygo_local.patch`, `net_proto/*.h`, `CLAUDE.md` (renombrado), el CSV de Hermes, `tools/` (todos los `.py`, `dashboard.html`, `calib_*.json`) y los 19 `*.BIN.txt` (`cmp` uno a uno). Las únicas diferencias son P1 en los dos `platformio.ini` y los archivos nuevos nuestros (`secrets.h.ejemplo`, `tools/tbeam/README.md`).
2. **Compilación: SIN VERIFICAR.** `pip install platformio` funcionó (6.2.0); se aplicó `lilygo_local.patch` al submódulo solo en el worktree y se creó un `secrets.h` temporal; `pio run -d firmware/cohete -e demeter -e hermes` y `pio run -d firmware/tierra -e tierra` fallaron en el primer paso, "Platform Manager: Installing espressif32 @ 6.13.0", con `HTTPClientError`. La causa es de red: el proxy del entorno responde `403` al CONNECT a `api.registry.platformio.org`. No es un error del código. Queda pendiente compilar en una máquina con red (Pablo, Juan Pablo o Jerónimo).
3. **Herramientas:** `python3 tools/tbeam/tblog.py --help` funciona; `python3 tools/tbeam/dashboard.py --demo --no-abrir --puerto 8799` respondió **HTTP 200** en `http://127.0.0.1:8799/` (proceso terminado al final). Se instaló `pyserial` (3.5), `numpy` y `scipy`.
4. **No se commitea lo que no debe:** el `secrets.h` temporal se borró tras la prueba (`git check-ignore` confirma que está ignorado); el parche se revirtió en el submódulo (`git ls-files -s` muestra el gitlink en `1991b1e`); no hay `.pio/` ni `sesiones/` en el árbol. Los `*.BIN.txt` de `datos/logs_referencia/pablo/` no quedan ignorados (`git check-ignore` sin coincidencia).

## Decisiones tomadas o propuestas
- Ninguna propuesta de cambio a contratos. No se comparó el protocolo de `net_proto` contra los contratos en esta tarea.

## Problemas y cómo se resolvieron
- La especificación de la rama del documentador no estaba disponible (`sincronizacion_firmware_pablo.md` no existía en `origin/claude/trusting-dirac-k7vp9e`); se siguió la especificación del encargo.
- Sin acceso al registro de PlatformIO desde el entorno: compilación sin verificar (arriba).
- `lilygo_local.patch` aplica con avisos de espacios en blanco (3 errores de espacios, 8 líneas); modifica `lib/SensorLib/src/SensorQMI8658.hpp` y `platformio.ini` del submódulo.

## Pendiente / siguiente paso
- Compilar `demeter`, `hermes` y `tierra` con red y registrar el resultado.
- Verificar que el `secrets.h` real (clave de Pablo) esté en las tres placas.
- El PR depende de la especificación de la rama `claude/trusting-dirac-k7vp9e`, que llega por su propio PR.

## Documentos afectados
- Nuevos: `firmware/README.md` (reemplaza), `tools/tbeam/README.md`, `datos/logs_referencia/README.md`, `docs/fuentes/demeter_pablo/CLAUDE_17139b2.md`, esta bitácora.
- Modificados: `datos/README.md` (fila de Hermes), `.gitignore`.
- Para el documentador: backlog (T-007), índice de la bitácora, y revisar `docs/00_INDICE.md` y el mapa de CLAUDE.md por el cambio de estructura de `firmware/`.
