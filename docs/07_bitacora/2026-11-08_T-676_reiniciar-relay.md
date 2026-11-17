---
fecha: 2026-11-08
tipo: tarea
ids: [T-676]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-673-reiniciar-relay
---
# T-676: `estacion/reiniciar_relay.sh` (dejar el relay en ceros antes del vuelo)

## Contexto
La guía de despliegue §4 pide, antes del vuelo real, borrar los `/datos/*.jsonl` del relay y reiniciarlo (un `mission_id` de ensayo cerrado no se vuelve a abrir). Hacerlo a mano la víspera es propenso a errores (y borra sin respaldo). T-676 lo automatiza **con respaldo previo, confirmación escrita y verificación**. Reutiliza `sesion_comun.sh` de T-672.

**Renumeración:** esta tarea se dio de alta como `T-673` en el `develop` local (commit `687d356`), pero `origin/develop` ya tenía otro `T-673` ("El mapa arranca siempre en la vista 3D"). Por orden del coordinador se renumeró a **T-676** (la fila del backlog se conservó tal cual, con estado «en revisión»). La rama conserva su nombre `feature/T-673-reiniciar-relay` y los commits anteriores llevan `[T-673]` en su mensaje: son de esta tarea.

## Qué se hizo
- `estacion/reiniciar_relay.sh` (nuevo, ejecutable; bash 3.2 de macOS; mismos mensajes, carteles y estilo que `iniciar_sesion.sh`/`detener_sesion.sh`). En orden:
  1. `--ayuda` explica todo; no hay argumentos obligatorios (`--si-borrar` es opcional).
  2. **Rechaza (die) si hay un `dashboard.py` corriendo**, sin cerrarlo. Detección: `ps -axo pid=,command=` y una expresión regular que exige un `python` que **ejecuta** un `dashboard.py` (no cuenta un editor ni `less` que solo lo nombran, ni el propio script), más `lsof` al puerto 8765 (solo si ese proceso es un `dashboard.py`).
  3. Requisitos: `fly` con sesión (salvo `SIN_FLY=1`), `estacion/.venv` (basta que exista el python; no exige `pyserial` porque no abre puertos), `curl`. No pide token.
  4. Prende la máquina si está `stopped/suspended/created` y espera la salud (mismas funciones que `iniciar_sesion.sh`).
  5. Muestra `seq_relay` y `mission_id` de cada misión y un cartel rojo; pide **escribir `BORRAR`** (comparación exacta; `s`, `si`, `borrar`, `BORRAR YA`, vacío y `y` cancelan). Sin terminal interactiva: no borra y sale con 1, salvo `--si-borrar`.
  6. Crea `estacion/sesiones_relay/reinicio_AAAAMMDD_HHMMSS/` y guarda `salud_antes.json`, `snapshot_demeter.json`, `snapshot_hermes.json` y todos los `/datos/*.jsonl` (`ls -la /datos` para saber nombres y tamaños; `fly ssh sftp get` verificado por tamaño; respaldo `base64` por `fly ssh console -C`; con `SIN_FLY=1`, `cp` + `cmp` de `RELAY_DATOS_LOCAL`). **Cualquier fallo del respaldo (snapshot, listado, copia) aborta antes de borrar o mover nada.**
  7. Mueve (no borra) `estacion/cola_web.db`, `-wal` y `-shm` (los que existan) a `reinicio_.../cola_vieja/`.
  8. Borra con `fly ssh console -a APP --machine M -C "sh -c 'rm -f /datos/*.jsonl'"` (se agregó `--machine` como en `detener_sesion.sh`), comprueba con `ls /datos` que no quedó ningún `.jsonl` y hace `fly apps restart APP`. Si el `rm` falla, o el `restart` falla después de borrar, aborta con instrucciones claras (en el segundo caso: "REINICIALO YA o seguirá mostrando lo viejo"). Con `SIN_FLY=1` borra los `*.jsonl` de `RELAY_DATOS_LOCAL` y avisa que el relay local se reinicia a mano (si hay terminal, espera un Enter).
  9. **Verifica** (en un ciclo de hasta `ESPERA_SALUD_S` s, porque justo tras el `restart` el proceso viejo aún puede responder): en `demeter` y `hermes`, `seq_relay == 0`, `mission_id` null, snapshot sin `estado`, y `ingesta.lotes == 0`. Deja `salud_despues.json` y `snapshot_<m>_despues.json` como evidencia. Si no queda así, falla listando qué no es cero y recordando que lo viejo está respaldado y que no se abra la sesión del vuelo.
  10. Si queda bien: cartel verde «RELAY EN CEROS», y recuerda "refresca (Cmd+Shift+R) las pestañas abiertas" y "ahora corre `estacion/iniciar_sesion.sh`".
  11. `resumen.txt` en la carpeta (qué había, qué se respaldó con tamaños, qué cola se archivó, si se borró, la verificación y el RESULTADO). Se escribe también si el script aborta (trap `EXIT`), con el motivo.
- `SIN_FLY=1` solo se acepta con un `RELAY_URL` de bucle local (`127.0.0.1`/`localhost`/`[::1]`); con el relay real y `SIN_FLY=1` el script se niega (destructivo: no se deja una combinación sin sentido).
- `estacion/sesion_comun.sh`: `SESIONES_RELAY_DIR` ahora se puede sobrescribir por entorno (`${SESIONES_RELAY_DIR:-...}`; por defecto igual que antes). Es lo único que se tocó de T-672, para que las pruebas no ensucien `estacion/sesiones_relay/` real. `COLA_WEB_DB` (nueva, por defecto `estacion/cola_web.db`) cumple lo mismo para la cola.
- `estacion/pruebas/test_reiniciar_relay.py` (nuevo, unittest, 18 pruebas).
- Documentación: `estacion/README.md` (subsección bajo "Sesión en un comando") y `docs/08_gui/11_guia_despliegue.md` §4 (la forma recomendada, con la nota de que es **la única excepción** a "nunca borra datos del relay" de T-672).

## Evidencia
**Análisis estático:** `shellcheck 0.11.0` (`pip install shellcheck-py` en un venv temporal, fuera del repo): `shellcheck -x -s bash` sobre `reiniciar_relay.sh`, `sesion_comun.sh`, `iniciar_sesion.sh` y `detener_sesion.sh` → sin hallazgos. `bash -n` limpio. Las pruebas corrieron con `/bin/bash` = GNU bash 3.2.57 (el de macOS).

**Pruebas:** `python -m unittest test_reiniciar_relay -v` desde `estacion/pruebas/`, con el python del venv temporal con `gui/relay/requirements.txt` (`RELAY_PYTHON`): **18 pruebas, OK** (~60 s). Cada una levanta un relay local real (`gui/relay/servidor.py`, puerto libre, token de prueba de 64 hex, `WEB_RELAY_DATOS` temporal), lo llena con `alimentar.py` con `demeter_nominal` y `hermes_nominal` (seq_relay 1094 y 976; `demeter.jsonl` de 1 054 074 bytes) y corre el script. **No se tocó Fly ni `api.eiaspice.space`.**

| Caso | Resultado verificado |
| --- | --- |
| `--ayuda` y opción desconocida | sale 0 / sale 1; no toca nada |
| `dashboard.py` corriendo (un proceso falso `python .../dashboard.py`) | sale 1 con "Cierra el dashboard…"; el proceso sigue vivo; datos y cola intactos; no hay carpeta de reinicio |
| Algo que solo nombra `dashboard.py` (`sh -c ... dashboard.py`) | no bloquea |
| Sin terminal y sin `--si-borrar` | sale 1, "Sin terminal interactiva: no borro nada"; jsonl, cola y relay intactos; sin carpeta de reinicio |
| Con terminal (pty) y respuesta `s`, `si`, `borrar`, `BORRAR YA`, vacío, `y` | cada una: sale 1, "Cancelado… No se toco nada"; todo intacto |
| Respaldo que falla (un `.jsonl` ilegible, `chmod 0`) | sale 1; los jsonl **no** se borran; la cola **no** se mueve (sin `cola_vieja/`); `resumen.txt` dice ABORTADO y "Borrado: NO"; el relay sigue con sus datos |
| Camino feliz con `--si-borrar` y con terminal escribiendo `BORRAR` (SIN_FLY, relay local reiniciado "a mano" por la prueba) | sale 0, «RELAY EN CEROS»; los dos `.jsonl` copiados byte a byte; `salud_antes.json` (seq>0), snapshots; `cola_web.db`, `-wal`, `-shm` en `cola_vieja/` con su contenido y ya no en su sitio; `/datos/*.jsonl` borrados; relay en ceros (seq 0, mission_id null, snapshot sin estado, lotes 0); `resumen.txt` "RELAY EN CEROS" |
| Relay ya en ceros (sin jsonl) | sale 0 y archiva la cola |
| Nadie reinicia el relay local | sale 1 a los 4 s con "NO quedo en ceros" y la lista (`seq_relay=…`); jsonl borrados pero respaldados; `resumen.txt` "NO QUEDO EN CEROS" |
| `SIN_FLY=1` con `RELAY_URL` real, o sin `RELAY_DATOS_LOCAL` | rechaza antes de tocar nada |
| **Rama de Fly con un `fly` falso en el PATH** (imita `auth whoami`, `machine list -q/--json`, `machine start`, `ssh console` con `ls -la`/`ls`/`base64`/`rm`, `ssh sftp get`, `apps restart` y anota las llamadas) | camino feliz con máquina `stopped` (orden verificado en el registro: `machine start` → 2 `sftp get` → `rm` → `apps restart`); sftp con copia corta → respaldo `base64` (con `\r\n` como un pty) y respaldo igual al original; sftp y base64 fallan → **no** se llama a `rm` ni a `restart`; `ls -la /datos` falla → no borra; `apps restart` falla → sale 1 "REINICIALO YA" y el resumen dice que sí se borró; sin confirmación → no se hace ninguna llamada `ssh`/`apps` |

Fly real: **no se usó** (ni siquiera lectura); solo se leyeron `fly apps restart --help` y `fly ssh console --help` para confirmar que `--machine`, `-C` y `apps restart` (sus únicas opciones son `--skip-health-checks` y `--force-stop`; no se vio ninguna de confirmación, pero eso no se pudo comprobar sin ejecutarlo) son como se usan.

## Decisiones tomadas o propuestas
No se cambia ningún contrato. Decisiones de diseño, todas dentro del encargo:
- **Carpeta de la cola:** el backlog dice `estacion/sesiones_relay/cola_vieja_<fecha>/` y el encargo `reinicio_<fecha>/cola_vieja/`; se siguió el **encargo** (todo el material de un reinicio queda junto). El documentador puede ajustar el texto del backlog. Además, la carpeta se llama `reinicio_...` (no empieza con dígito) a propósito: `detener_sesion.sh` toma como "última sesión" solo carpetas `[0-9]*_[0-9]*` y así nunca confunde un reinicio con una sesión.
- Código de salida **1** también al cancelar (no se escribió BORRAR): un script que encadene este paso no debe seguir como si se hubiera borrado.
- El borrado en Fly lleva `--machine <id>` (el encargo no lo traía): evita ambigüedad si hubiera más de una máquina, igual que `detener_sesion.sh`.
- Propuesta (no aplicada): que `iniciar_sesion.sh`, en su cartel rojo "EL RELAY TIENE DATOS DE UNA SESION ANTERIOR", mencione `estacion/reiniciar_relay.sh` en vez de "Este script NO limpia nada". No se tocó para no mezclar tareas.

## Problemas y cómo se resolvieron
- **ID duplicado (resuelto).** `origin/develop` ya traía otro `T-673` (mapa 3D por defecto, rama `feature/T-673-mapa-3d-por-defecto`; T-674 depende de él). Se renumeró esta tarea a T-676, se hizo `merge` de `origin/develop` en la rama y se resolvió el conflicto de `backlog.md` conservando las filas T-673 a T-675 de origen y dejando esta como T-676 «en revisión (2026-11-08)». Los mensajes de los commits anteriores no se reescribieron (decir `[T-673]` en ellos se refiere a esta tarea).
- Sin `graphify` en esta máquina: se usó grep.
- La herramienta de la sesión impedía llamar `bash` suelto: las pruebas y el análisis se corrieron a través de `python -m unittest` y de comandos separados; no afecta al resultado.
- Primera corrida: una afirmación de la prueba del respaldo fallido buscaba un texto con otra capitalización ("NO se borro nada" vs. "No se borro NADA"); se corrigió la prueba, no el script.

## Pendiente / siguiente paso
- **Lo corre el usuario contra Fly real** (no se pudo probar aquí): con el reenviador cerrado, `estacion/reiniciar_relay.sh`. Cosas que solo se verán ahí: el formato exacto de `fly ssh console -C "ls -la /datos"` (el script usa `awk '$NF ~ /\.jsonl$/ && $5 ~ /^[0-9]+$/'`, igual que `detener_sesion.sh`), que `fly apps restart` termine y que la salud quede en ceros dentro de `ESPERA_SALUD_S` (90 s por defecto; con `ESPERA_SALUD_S=180` si hace falta).
- Si hay dudas, correr primero `estacion/reiniciar_relay.sh --ayuda` y, para ensayar sin riesgo, el relay local (`SIN_FLY=1 RELAY_URL=http://127.0.0.1:8787 RELAY_DATOS_LOCAL=<carpeta>`).

## Documentos afectados
- `estacion/README.md`, `docs/08_gui/11_guia_despliegue.md` §4 (editados en este PR).
- Por consolidar: `docs/05_plan/backlog.md` (la fila de T-676 ya quedó «en revisión» en este PR).
