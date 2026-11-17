---
fecha: 2026-11-07
tipo: tarea
ids: [T-672]
autor: agente desarrollador (Claude Sonnet 5.5)
rama: feature/T-672-scripts-sesion
---
# T-672: scripts de sesión (prender el relay, abrir el dashboard, detener y guardar)

## Contexto
La víspera del lanzamiento, Juan Pablo repite a mano (manual local §0, §6 y §7) las variables de la terminal, el token del Llavero, prender la máquina de Fly, esperar la salud, abrir el dashboard con `--web-relay` y, al final, parar todo. Dos scripts de macOS lo hacen en un comando y guardan en local lo que se transmitió. **T-672 no está en el backlog**: la pidió el Claude principal con urgencia; el documentador debe darla de alta.

## Qué se hizo
Tres scripts nuevos y dos archivos editados:

- `estacion/iniciar_sesion.sh`: requisitos, máquina, salud, carpeta de la sesión y dashboard.
- `estacion/detener_sesion.sh`: cierra el dashboard, guarda salud, snapshots, JSONL, sesión cruda de tierra y `resumen.txt`.
- `estacion/sesion_comun.sh`: funciones compartidas (se carga con `source`). Se separó para no duplicar el manejo de Fly, de la salud y de los mensajes.
- `.gitignore`: `estacion/sesiones_relay/`.
- `estacion/README.md`: sección "Sesión en un comando (T-672)".

### Decisiones de diseño (todas dentro del encargo; ninguna toca contratos)
- **Primer plano con `exec`.** `iniciar_sesion.sh` termina en `exec dashboard.py ...`, o sea que **el PID del script es el del dashboard** y `inicio.json` guarda `$$` sin carreras. `Ctrl+C` lo cierra como siempre, se ve su salida y no hay procesos de fondo que olvidar. Contra: el script no puede imprimir nada después de que el dashboard termina, por eso los "siguientes pasos" salen antes de abrirlo. (En un `&` de un script no interactivo bash ignora SIGINT, así que el fondo habría complicado el cierre elegante.)
- **Token.** Se lee con `security find-generic-password -s hermes-relay-token -w` a una variable de shell (nunca a un archivo ni a un argumento de otro proceso), se mide (64 caracteres) y **solo se exporta en el entorno del `exec` del dashboard** (`WEB_INGESTA_TOKEN="$TOKEN" exec ...`). Se hace `unset WEB_INGESTA_TOKEN` antes de llamar a `fly`, `curl` o python, para que no lo hereden. Si `WEB_INGESTA_TOKEN` ya estaba en el entorno, se usa esa (así se pueden probar los scripts con un token falso y es lo mismo que pide el manual); el mensaje solo dice el origen y la longitud.
- **ID de máquina.** `fly machine list -a APP -q` se limpia **línea por línea** con `tr -d '[:space:]'` y se descartan las vacías (con una sola máquina da lo mismo que `tr` sobre todo, pero con dos máquinas no pega los IDs). Si hay más de una, el script se detiene y pide `RELAY_MAQUINA=<id>`. Verificado con el `fly` real: `-q` devuelve `"   811d3e5bdde578   \n\n"` (visto con `od -c`).
- **Estado de la máquina** con `fly machine list --json` (`state`): `stopped`/`suspended`/`created` se prende; luego se espera la salud hasta `ESPERA_SALUD_S` (90 s).
- **Bajar los JSONL del volumen: `fly ssh sftp get` + verificación por tamaño + respaldo `base64`.**
  - Primero `fly ssh console -C "ls -la /datos"` (texto corto): dice qué archivos hay y **su tamaño exacto**, y permite distinguir "esa misión no recibió nada" de un fallo.
  - `sftp get` es binario, no usa pty y no convierte `\n`; es lo más robusto para varios MB. `fly ssh console -C "cat archivo" > local` no se usa porque, con un pty, puede cambiar `\n` por `\r\n` o recortar el final, y el JSONL se corrompería sin avisar.
  - Se compara el tamaño local con el del `ls`. Si `sftp` falla o la copia no coincide, **respaldo**: `fly ssh console -C "base64 /datos/x.jsonl"` (texto puro, inmune al pty) decodificado en local con python. Si tampoco coincide, queda como fallo en el resumen, con el comando manual.
- **`--demo` y `--reproducir`** se rechazan contra un relay que no sea de bucle local, salvo con `--permitir-ensayo` (que no se pasa al dashboard). Se detectan también las abreviaturas de `argparse` (`--repro`, `--dem`). `--web-relay` no se acepta: la URL sale de `RELAY_URL`, para que el token no pueda ir a otro servidor por un descuido.
- **El script no limpia ni borra nada** del relay. Solo avisa en grande si `seq_relay` > 0 y recuerda la guía §4.
- **Aviso `Trial machine stopping`:** se busca en `fly logs --no-tail` (con los colores ANSI quitados) al iniciar, y también en `detener_sesion.sh` si el relay ya no responde. Ojo: el buffer de logs puede traer un aviso viejo; el cartel dice que se mire la hora.
- **Extra no pedido, pequeño:** `detener_sesion.sh` abre en solo lectura `estacion/cola_web.db` (o el `--web-cola` de `inicio.json`) y dice cuántos mensajes quedaron **sin subir** al relay. Esos mensajes no están en el JSONL del relay y, si no se vuelve a abrir el dashboard, no llegan nunca.
- **Si el relay no responde al detener** (por ejemplo, Fly lo apagó), ofrece prender la máquina (por defecto sí) para poder bajar los datos; los datos del volumen no se pierden al apagar.
- **Código de salida:** `detener_sesion.sh` sigue juntando lo que pueda aunque un paso falle, anota los fallos en `resumen.txt` y sale con 1 al final.
- Compatible con el **bash 3.2 de macOS** (`/bin/bash`): sin arreglos asociativos ni `mapfile`, y con el idioma `${arr[@]+"${arr[@]}"}` para arreglos vacíos con `set -u`.

## Evidencia
Todo se probó **contra un relay local** (`gui/relay/servidor.py` en `127.0.0.1:8787`, token de prueba de 64 hex, en un venv fuera del repo) y contra un **`fly` falso** (un script en el PATH que imita la salida real de `fly` y registra sus llamadas); **no se tocó ningún recurso remoto**.

Solo lectura contra Fly real (permitida): `fly auth whoami` → `alzatejuanpablo25@gmail.com`; `fly machine list -a hermes-demeter-relay -q` y `--json` (máquina `811d3e5bdde578`, `"state": "stopped"`); `fly logs --no-tail` (sin el aviso de prueba en el buffer); `fly ssh sftp get --help` (confirma `fly ssh sftp get <remoto> [local]` y `--machine`). `curl` a la salud pública no respondió (la máquina está apagada, como dice la guía §7).

**Análisis estático:** `shellcheck 0.11.0` (instalado con `pip install shellcheck-py` en un venv temporal, no global): `shellcheck -x -s bash estacion/iniciar_sesion.sh estacion/detener_sesion.sh estacion/sesion_comun.sh` → sin hallazgos. `bash -n` limpio.

**Pruebas de `iniciar_sesion.sh`** (salida real, sin colores):
```
$ estacion/iniciar_sesion.sh --demo            # con el relay real por defecto: se rechaza antes de tocar nada
[error] --demo y --reproducir suben datos que NO son del vuelo al relay real (https://api.eiaspice.space).
$ estacion/iniciar_sesion.sh --repro algo.txt  # abreviatura de argparse: igual
$ estacion/iniciar_sesion.sh --web-relay http://x
[error] --web-relay no se acepta aqui.
$ WEB_INGESTA_TOKEN=abc estacion/iniciar_sesion.sh
[error] El token (origen: el entorno (WEB_INGESTA_TOKEN)) tiene 3 caracteres y se esperaban 64.
```
Con el relay local y el token **del Llavero real** (sin `WEB_INGESTA_TOKEN` en el entorno; solo habló con `127.0.0.1`, el relay local lo rechazaba con 401):
```
[ok] token cargado (origen: el Llavero de macOS, 64 caracteres)
[ok] puerto 8798 libre
[ok] el relay responde estado: ok
  demeter  seq_relay=0   mission_id=null
  hermes   seq_relay=0   mission_id=null
[ok] relay limpio: seq_relay 0 en las dos misiones
[ok] sesion: estacion/sesiones_relay/20261107_232719  (inicio.json guardado, PID del dashboard 50698)
```
`ps` del dashboard: la línea de comandos tiene `dashboard.py --web-relay http://127.0.0.1:8787 --no-abrir --puerto 8798` y ningún token. `inicio.json` trae hora, `relay_url`, `maquina_id`, `salud_inicial` (JSON), `pid_dashboard`, puerto, `ensayo`, `sin_fly` y `args_dashboard`.

Con datos previos en el relay (`seq_relay` 1094 y 976): salió el cartel rojo "EL RELAY TIENE DATOS DE UNA SESION ANTERIOR ... NO limpia nada". Con `--demo --permitir-ensayo` contra el relay local, el dashboard subió datos (`seq_relay` de demeter pasó de 1094 a 1121 en 20 s).

Puerto ocupado: una segunda instancia sin terminal interactiva → `[error] Puerto 8798 ocupado: no se toco nada.` (muestra el PID y la línea del dashboard viejo). Con un pseudo-terminal que responde `s` a "Cerrar ese dashboard?": el dashboard viejo salió con 130 (SIGINT), el nuevo arrancó.
Relay caído: `[error] El relay no respondio 'estado: ok' en 3 s ... fly logs ...`.

Con el `fly` falso (máquina `stopped`, ID con espacios y líneas en blanco): `maquina del relay: 811d3e5bdde578`, `La maquina esta 'stopped': prendiendola (fly machine start)`, salud ok y, con `FAKE_TRIAL=1`, el cartel `FLY AVISO: 'Trial machine stopping'` con la línea del log sin colores. Llamadas registradas: `auth whoami`, `machine list -q`, `machine list --json`, `machine start`, `logs --no-tail`.

**Pruebas de `detener_sesion.sh`** (relay local alimentado con `gui/relay/alimentar.py ... demeter_nominal.jsonl hermes_nominal.jsonl --velocidad 60`: `1095 aceptados, 0 descartados` y `976 aceptados, 0 descartados`):
```
[ok] dashboard cerrado                                  (SIGINT al PID de inicio.json; el dashboard salió con 130)
[ok] salud_final.json   [ok] snapshot_demeter.json   [ok] snapshot_hermes.json
[ok] demeter.jsonl (copiado de RELAY_DATOS_LOCAL, 1054074 bytes)
[ok] hermes.jsonl  (copiado de RELAY_DATOS_LOCAL, 898918 bytes)
DEMETER  seq_relay: inicio 0 -> final 1094 | mensajes en el JSONL: 1095 (estacion=133, estado=814, evento=12, meta=2, salud=134)
         ultimo 's' del JSONL: 1094 | snapshot final: estado SI, 12 eventos, 814 puntos de serie
HERMES   seq_relay: inicio 0 -> final 976  | mensajes en el JSONL: 976 ...      | snapshot final: estado SI, 11 eventos, 718 puntos de serie
Fallos: ninguno      (exit 0)
```
Notas de lectura: el JSONL puede tener más líneas que `seq_relay` (las líneas con `s: null` son lo "guardado atrasado" que el relay no emite); el `s` máximo sí coincide con `seq_relay`.
- Sesión cruda: con archivos `*_tierra.txt` falsos en `estacion/sesiones/` (`..._000000`, `..._232800`, `..._232900`), la sesión `232719` copió solo el `232800` y la `232851` solo el `232900` (rango: desde su inicio hasta el inicio de la siguiente). El modo `--demo` no crea `*_tierra.txt` (no abre el puerto serie), por eso en las demás pruebas dice que no hay.
- Otra sesión pasada por nombre corto (`detener_sesion.sh 20261107_232719`) y sesión ya cerrada (`el dashboard ya estaba cerrado`) funcionan.
- **Con el `fly` falso:** `ls -la /datos` → `sftp get` → `demeter.jsonl (1145012 bytes, igual que en el volumen)`. Con `sftp` que falla (`FAKE_SFTP_FALLA=1`) y con `sftp` que deja la copia cortada (`FAKE_SFTP_CORTA=1`): `sftp no dejo la copia completa; pruebo con base64 por ssh...` y la copia queda igual de grande que la del volumen. Sin `hermes.jsonl` en el volumen: `el relay no tiene /datos/hermes.jsonl (esa mision no recibio nada)`. Con `--apagar`: ejecuta `fly machine stop 811d3e5bdde578 -a hermes-demeter-relay` sin preguntar; sin la opción y sin terminal: no apaga y dice cómo.
- Relay caído al detener: ofrece prender (por defecto sí), espera, y como no vuelve, anota el fallo, igual escribe `resumen.txt` y sale con `exit 1`.
- La cola del reenviador: `cola del reenviador vacia: todo lo que genero el dashboard ya subio` (0 mensajes).
- Corridas con `/bin/bash` 3.2.57 (`iniciar_sesion.sh` con relay caído y con `--demo`, y `detener_sesion.sh` completo): sin errores.
- Se ejecuta desde otra carpeta (resuelve la raíz con `BASH_SOURCE`).

## Decisiones tomadas o propuestas
- Propuesta para el documentador (no se aplicó, por instrucción): dar de alta T-672 en el backlog y enlazar los scripts desde `docs/08_gui/11_guia_despliegue.md` §8 ("Desde otro PC"). **No se propone ningún cambio a contratos.**

## Problemas y cómo se resolvieron
- `fly machine list -q` trae espacios y líneas en blanco: se limpia por línea (ver arriba).
- Mi `fly` falso tenía un error propio (`${*##...}` aplica el recorte a cada parámetro por separado): lo destapó la prueba del respaldo `base64` y se corrigió en el falso, no en los scripts.
- No se pudo comprobar en el pty de `script(1)` la pregunta interactiva (envía EOF); se resolvió con un pequeño arnés de python (`pty`) fuera del repo.

## Pendiente / siguiente paso
**No se pudo probar contra Fly real** (prohibido en esta tarea, y la máquina está apagada):
1. **Prender la máquina** con `fly machine start` y la espera real de la salud (solo se probó con el `fly` falso y un relay local que ya estaba arriba).
2. **`fly ssh console -C "ls -la /datos"`, `fly ssh sftp get` y el respaldo `base64`** contra el volumen de Fly: el formato de `ls -la` (el tamaño en la columna 5 y el nombre al final) se supone el de Debian/coreutils de la imagen `python:*-slim-bookworm`; si cambiara, la verificación por tamaño avisa de un fallo falso y el respaldo sigue ahí. La orden `fly ssh sftp get ... --machine` se verificó solo con `--help`.
3. **`fly machine stop`** (y el mensaje de `failed to obtain lease`).
4. El aviso `Trial machine stopping` con un log real de ese tipo (el buffer actual no lo tiene).
5. La lectura de la contraseña del Llavero **sí** se probó (64 caracteres, sin pedir clave), pero solo contra un relay local.
Recomendación: la primera vez, correr `iniciar_sesion.sh` y `detener_sesion.sh` con la máquina real **antes** del vuelo, con una sesión corta (`--demo --permitir-ensayo`) y hacer después la limpieza de la guía §4.

## Documentos afectados
- `estacion/README.md` (sección nueva).
- `.gitignore` (`estacion/sesiones_relay/`).
- Sin cambios en contratos, backlog, decisiones ni `docs/08_gui/` (por instrucción).
