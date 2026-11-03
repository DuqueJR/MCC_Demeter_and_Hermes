---
id: sincronizacion_firmware_pablo
estado: vivo (2026-11-03)
actualizado: 2026-11-03
depende_de: [cambios_por_firmware_pablo, revision_firmware_pablo, flujo_trabajo]
decisiones: [D-037, D-043, D-045]
---
# Importación del firmware de Pablo y guía para trabajar en nuestro repo

**El modelo (D-045, que reemplaza en parte a D-037):**
- **Todo vive en nuestro repo.** El firmware, la estación y las herramientas de Pablo se importaron una vez (T-007). Si Pablo tiene commits nuevos, entran en una **última importación** (T-008).
- Desde ahí, [ptilanom/DEMETER](https://github.com/ptilanom/DEMETER) queda **congelado como origen histórico**, y **Pablo trabaja aquí** (§5).
- El firmware se cambia como todo lo demás:
  1. una tarea del backlog;
  2. primero el contrato (las v2 y v3 de `04_diseno/`);
  3. el agente `desarrollador` o una persona, en una rama `feature/`;
  4. un PR a `develop`.
- **Pablo revisa los PR de firmware** porque es quien mejor lo conoce.

## 1. Snapshots

| Fecha | Commit de Pablo | Tarea | Notas |
| --- | --- | --- | --- |
| 2026-11-03 | `17139b2` | T-007 ([PR #35](https://github.com/DuqueJR/MCC_Demeter_and_Hermes/pull/35)) | Primera importación. Revisión: [revision_firmware_pablo](../06_revisiones/revision_firmware_pablo.md). **Compilación sin verificar** (sin red hacia PlatformIO en la sesión en la nube). `lilygo_local.patch` aplica con avisos de espacios en blanco |

Solo quedan dos filas posibles: T-007 y la última importación (T-008). El commit de importación lleva en el mensaje `Upstream: ptilanom/DEMETER@<hash>`.

## 2. Mapa de carpetas (D-043)

| Repo de Pablo | Nuestro repo | Cómo |
| --- | --- | --- |
| `tbeam_fw/platformio.ini` | `firmware/cohete/platformio.ini` | Copia **+ parche P1** |
| `tbeam_fw/boards/` | `firmware/cohete/boards/` | Copia |
| `tbeam_fw/src/*` | `firmware/cohete/src/` | Copia, todos los archivos |
| `tbeam_fw/.gitignore` | `firmware/cohete/.gitignore` | Copia |
| `tbeam_tierra/platformio.ini` | `firmware/tierra/platformio.ini` | Copia **+ parche P1** |
| `tbeam_tierra/src/*` | `firmware/tierra/src/` | Copia |
| `tbeam_tierra/.gitignore` | `firmware/tierra/.gitignore` | Copia |
| `common/net_proto/*.h` | `firmware/common/net_proto/` | Copia (**nunca** `secrets.h`) |
| `common/.gitignore` | `firmware/common/.gitignore` | Copia |
| `common/lilygo_local.patch` | `firmware/common/lilygo_local.patch` | Copia |
| Submódulo `Lilygo-LoRa-Series` (`1991b1e`) | Submódulo `firmware/vendor/Lilygo-LoRa-Series`, **en el mismo commit** | `git submodule add` y luego `checkout` del commit de Pablo |
| `common/Simulaciones/hermes_datos_simualción_completo.csv` | `datos/simulaciones/openrocket/hermes_G80-7T_santa-fe-antioquia_pablo.csv` | Copia **sin editar**, renombrada, con su fila en `datos/README.md` |
| `common/Simulaciones/demeter_datos_simulación_completo.csv` | — | **No se copia:** es idéntica (mismo md5) a `demeter_H135W-8_santa-fe-antioquia_sim2.csv` |
| `tbeam_fw/tools/*.py`, `dashboard.html`, `calib_*.json` | `tools/tbeam/` | Copia. Van **juntos** porque `dashboard.py` busca `tbget.py`, el HTML y las calibraciones en su propia carpeta (`HERE`) |
| `tbeam_fw/tools/*.BIN.txt` | `datos/logs_referencia/pablo/` | Copia (son los resúmenes de `tblog.py` de los logs reales, la evidencia de [Pablo]) |
| `CLAUDE.md` | `docs/fuentes/demeter_pablo/CLAUDE_<hash>.md` | Copia **renombrada**. **Nunca** como `CLAUDE.md`: Claude Code lo cargaría como instrucciones |
| `README.md` | — | Su contenido se resume en `firmware/README.md` |
| `bloque2_3_src/`, `bloque4_imu/`, `bloque4b_wtm/`, `logger_bloque5/` | — | **No se copian:** son paquetes obsoletos |
| `DATASHEETS/` | — | **No se copian** (los PDF no se versionan) |
| `.claude/launch.json`, `*/.vscode/` | — | No se copian |

**Lo que no está en el repo de Pablo y sí en el nuestro:**
- `firmware/README.md`: cómo preparar, compilar y cargar;
- `firmware/common/net_proto/secrets.h.ejemplo`: la plantilla de la clave, sin la clave real;
- las líneas del `.gitignore` raíz: `firmware/common/net_proto/secrets.h`, `tools/tbeam/sesiones/`, `tools/tbeam/mision.json`, `*.BIN`, `*_csv/` y `*_ekf.csv`.

## 3. Parches locales (lo único que difiere de Pablo)

| ID | Archivo | Cambio | Por qué | ¿Se le propone a Pablo? |
| --- | --- | --- | --- | --- |
| P1 | `firmware/{cohete,tierra}/platformio.ini` | Las rutas absolutas `C:\Users\ptila\TBEAM\…` pasan a ser relativas: `lib_extra_dirs = ../vendor/Lilygo-LoRa-Series/lib` y `../common`. Se quita `build_cache_dir` (o se usa `../.pio_cache`). **Los nombres de env, los puertos COM y las banderas no se tocan.** | Que compile en cualquier portátil (A7 de la revisión) | **Sí** (PEN-22): con la misma estructura relativa en su repo, P1 desaparece |

Si una sincronización necesita otro parche, se agrega aquí con su ID **antes** de aplicarlo.

## 4. Procedimiento de importación (T-007 y la última, T-008)

1. Clonar el upstream en una carpeta temporal y anotar el hash: `git clone --depth 1 https://github.com/ptilanom/DEMETER <tmp>`.
2. Crear la rama `feature/T-00x-sync-pablo-<hash>` desde `develop`.
3. Copiar según §2:
   - **borrar primero** el contenido de los destinos de código (`firmware/cohete/src/`, `firmware/tierra/src/`, `firmware/common/net_proto/*.h`, `tools/tbeam/*.py|html`), para que también se propaguen los archivos que Pablo borró;
   - después copiar.
4. Aplicar los parches de §3, y solo esos.
5. Revisar que `git diff` contra el snapshot anterior **solo** muestre lo que cambió Pablo, más los parches.
6. **Verificar:**
   1. inicializar el submódulo y aplicar `lilygo_local.patch`;
   2. crear un `secrets.h` de prueba desde la plantilla;
   3. `pio run -d firmware/cohete -e demeter -e hermes` y `pio run -d firmware/tierra -e tierra`;
   4. `python tools/tbeam/tblog.py --help`;
   5. `python tools/tbeam/dashboard.py --demo --no-abrir --puerto 8799` responde en `http://127.0.0.1:8799`.
   - **Si no se puede compilar** (por red o por la plataforma), se dice en la bitácora y se marca **sin verificar**.
7. Actualizar la tabla de §1, la bitácora de la tarea y el PR hacia `develop` con `Upstream: ptilanom/DEMETER@<hash>`.
8. El documentador revisa qué cambió en los contratos ([protocolo_paquetes](../04_diseno/protocolo_paquetes.md), [maquina_estados](../04_diseno/maquina_estados.md), [enlace_lora_tdma](../04_diseno/enlace_lora_tdma.md)) y los actualiza.

## 5. Guía para Pablo: trabajar desde nuestro repo (T-009)

Es lo mismo que hacías en `C:\Users\ptila\TBEAM`, con otras rutas.

**1. Clonar:**

```
git clone --recurse-submodules https://github.com/DuqueJR/MCC_Demeter_and_Hermes.git
cd MCC_Demeter_and_Hermes
git checkout develop
```

**2. La librería de LilyGO, una vez por copia** (igual que antes):

```
git -C firmware/vendor/Lilygo-LoRa-Series apply ../../common/lilygo_local.patch
```

**3. La clave:**
- Copiar `firmware/common/net_proto/secrets.h.ejemplo` a `secrets.h` y poner la clave de siempre.
- Está ignorado por git: nunca se sube.

**4. Compilar y cargar** (los mismos envs y puertos COM de antes; el `platformio.ini` ya usa rutas relativas):

| Antes (`TBEAM\`) | Ahora |
| --- | --- |
| `tbeam_fw\` | `firmware\cohete\` → `pio run -d firmware/cohete -e demeter_campo -t upload` |
| `tbeam_tierra\` | `firmware\tierra\` → `pio run -d firmware/tierra -e tierra_campo -t upload` |
| `common\net_proto\` | `firmware\common\net_proto\` |
| `tbeam_fw\tools\` | **`estacion\`** (desde T-660) → `python estacion/dashboard.py` |
| Los logs `*.BIN` y `sesiones\` | Igual, y siguen fuera del repo |

**5. Cambios:**
- Una rama por cambio (`feature/T-xxx-...` desde `develop`) y un PR a `develop`. Juan Pablo o Jerónimo lo revisan.
- **Si el cambio toca el protocolo, los estados o los pines**, primero se actualiza su documento en `docs/04_diseno/` (o se le pide al documentador).
- **Tu `CLAUDE.md`** quedó como fuente en `docs/fuentes/demeter_pablo/CLAUDE_17139b2.md`.
  - Sus hallazgos están repartidos en `docs/04_diseno/` y en la revisión.
  - **El `CLAUDE.md` de nuestro repo es el que manda** cuando trabajas con Claude aquí.
- **Lo que falta del firmware** está en el backlog, E11 (T-410 BOOST primero), y en [brechas_objetivos](brechas_objetivos.md).

## 6. Peticiones de contrato

Pasaron a ser la tarea **T-414** del backlog (ya no son peticiones: las hacemos nosotros).
