---
id: sincronizacion_firmware_pablo
estado: vivo (2026-11-03)
actualizado: 2026-11-03
depende_de: [cambios_por_firmware_pablo, revision_firmware_pablo, flujo_trabajo]
decisiones: [D-037, D-043]
---
# Sincronización con el repo de Pablo (ptilanom/DEMETER)

**El modelo (D-037):**
- **Pablo es el dueño del firmware** y lo desarrolla en [ptilanom/DEMETER](https://github.com/ptilanom/DEMETER) (el *upstream*).
- **Nuestro `firmware/` es una copia** que solo cambia en las **tareas de sincronización** (T-007 la primera vez, T-008 las siguientes).
- **No se edita a mano:** un cambio que hagamos se le propone a Pablo (§5) y vuelve con la siguiente sincronización.

**Regla de oro:** los archivos fuente se copian **byte a byte**. La única excepción son los parches locales de §3, que son pocos y están listados, y que se le proponen a Pablo para que desaparezcan.

## 1. Snapshots

| Fecha | Commit de Pablo | Tarea | Notas |
| --- | --- | --- | --- |
| 2026-11-03 | `17139b2` | T-007 ([PR #35](https://github.com/DuqueJR/MCC_Demeter_and_Hermes/pull/35)) | Primera importación. Revisión: [revision_firmware_pablo](../06_revisiones/revision_firmware_pablo.md). **Compilación sin verificar** (sin red hacia PlatformIO en la sesión en la nube). `lilygo_local.patch` aplica con avisos de espacios en blanco |

Cada sincronización agrega una fila. El commit de importación lleva en el mensaje `Upstream: ptilanom/DEMETER@<hash>`.

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

## 4. Procedimiento de sincronización (T-007 / T-008)

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

## 5. Cómo le llegan a Pablo nuestros cambios

- **Camino preferido:** un *fork* de ptilanom/DEMETER y un PR hacia su `main`, con el mismo estilo de su código (C++11 y comentarios en español).
  - Esta sesión de Claude **no puede hacer push** a su repo (no tiene permiso).
  - Lo hace una persona, o se le da acceso al GitHub App de Claude.
- **Si Pablo prefiere otro camino** (por ejemplo, un parche por correo), se anota aquí. **Lo decide él** (PEN-22).
- **Mientras tanto, ningún cambio de firmware vuela si no está en el repo de Pablo.** Así se evita que existan dos versiones del firmware de vuelo.

## 6. Peticiones a Pablo (PEN-23)

El "contrato de interfaz" que su `CLAUDE.md` dice que le debe al resto del equipo. Por orden:

1. **Detección de BOOST** (C1 de la revisión), con persistencia en vuelo (C2). Si él no puede, lo hacemos nosotros por PR.
2. **Por el USB de tierra:**
   - `@R <hex>` con cada CmdResp;
   - `@E <lat> <lon> <alt_msl> <n>` a 1 Hz (la posición promediada de la estación);
   - RSSI y SNR también en `@L`.
3. **TELEM:** la altura barométrica sobre `p0` (`alt_baro_dm`, int16) y `hacc` (u8, en m). Si no caben, se usa `temp_c[1]` (reservado) o se cambia el tamaño, con una nueva constante.
4. **Versión:** el hash de git en el `FILEHDR` y, si se puede, un byte de versión en BEACON/TELEM.
5. **Rutas relativas** en los `platformio.ini` (P1).
6. **Confirmar los pines y el circuito** del buzzer (IO46, activo de 5 V) y de PWR_ON (IO45), para la tarea del buzzer.
