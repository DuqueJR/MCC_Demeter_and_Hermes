#!/usr/bin/env bash
# estacion/detener_sesion.sh -- cierra el dashboard y guarda en local todo lo transmitido en la sesion (T-672).
# Uso:  estacion/detener_sesion.sh [--apagar] [--ayuda] [CARPETA_DE_SESION]
# NUNCA borra datos del relay.
set -euo pipefail

# Lo que el usuario fijo a mano gana a lo que dice inicio.json.
URL_DEL_ENTORNO="${RELAY_URL:-}"
APP_DEL_ENTORNO="${RELAY_APP:-}"
SINFLY_DEL_ENTORNO="${SIN_FLY:-}"

# shellcheck source=estacion/sesion_comun.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/sesion_comun.sh"

ayuda() {
    cat <<EOF
detener_sesion.sh -- cierra el dashboard y guarda lo transmitido en la sesion

USO
  estacion/detener_sesion.sh [--apagar] [CARPETA_DE_SESION]

QUE HACE
  1. Ubica la sesion: la ultima carpeta de estacion/sesiones_relay/, o la que le pases (ruta o solo el nombre).
  2. Cierra el dashboard de ESA sesion (SIGINT al PID de inicio.json; solo si ese PID sigue siendo un dashboard.py)
     y espera. No toca ningun otro proceso.
  3. Guarda en la carpeta de la sesion:
       salud_final.json, snapshot_demeter.json, snapshot_hermes.json   (curl, solo lectura)
       demeter.jsonl, hermes.jsonl                                     (del volumen /datos del relay, por fly ssh sftp)
       *_tierra.txt                                                    (la sesion cruda de estacion/sesiones/ de esta sesion)
       resumen.txt                                                     (conteos, seq_relay final, tamanos y fallos)
  4. Pregunta si apagar la maquina del relay (por defecto NO). Con --apagar la apaga sin preguntar.
  5. NUNCA borra datos del relay. La limpieza antes del vuelo es aparte (guia §4).

OPCIONES
  --apagar      apaga la maquina del relay al final (fly machine stop), sin preguntar
  --ayuda, -h   esta ayuda

VARIABLES
  RELAY_URL, RELAY_APP, SIN_FLY   por defecto salen de inicio.json; si las fijas, ganan
  RELAY_MAQUINA=<id>              fija la maquina
  RELAY_DATOS_LOCAL=<carpeta>     con SIN_FLY=1: de aqui se copian los *.jsonl (relay local)
  PYTHON_ESTACION=<python>        por defecto estacion/.venv/bin/python

EJEMPLOS
  estacion/detener_sesion.sh
  estacion/detener_sesion.sh --apagar
  estacion/detener_sesion.sh estacion/sesiones_relay/20261107_221455
EOF
}

APAGAR=0
RUTA=""
while [ $# -gt 0 ]; do
    case "$1" in
        --ayuda|-h|--help) ayuda; exit 0 ;;
        --apagar) APAGAR=1 ;;
        -*) die "Opcion desconocida: $1" "Mira:  $0 --ayuda" ;;
        *) [ -z "$RUTA" ] || die "Solo se admite una carpeta de sesion." "Mira:  $0 --ayuda"
           RUTA="$1" ;;
    esac
    shift
done

FALLOS=()
fallo() { aviso "$1"; FALLOS+=("$1"); }

# ---------- 1. ubicar la sesion ----------
requerir_python
if [ -z "$RUTA" ]; then
    SESION="$(dir_de_sesion_ultima)"
    [ -n "$SESION" ] || die "No hay sesiones en estacion/sesiones_relay/." "Primero corre estacion/iniciar_sesion.sh (o pasa la carpeta como argumento)."
else
    if [ -d "$RUTA" ]; then
        SESION="$(cd "$RUTA" && pwd -P)"
    elif [ -d "$SESIONES_RELAY_DIR/$RUTA" ]; then
        SESION="$(cd "$SESIONES_RELAY_DIR/$RUTA" && pwd -P)"
    else
        die "No existe la carpeta de sesion: $RUTA"
    fi
fi
[ -f "$SESION/inicio.json" ] || die "$SESION no tiene inicio.json: no parece una sesion de iniciar_sesion.sh."
NOMBRE_SESION="$(basename "$SESION")"
ok "sesion: $NOMBRE_SESION"

{
    IFS= read -r PID_DASH
    IFS= read -r MAQUINA
    IFS= read -r URL_INICIO
    IFS= read -r APP_INICIO
    IFS= read -r SINFLY_INICIO
} < <(py -c '
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for v in (d.get("pid_dashboard"), d.get("maquina_id"), d.get("relay_url"), d.get("relay_app"), "1" if d.get("sin_fly") else "0"):
    print("" if v is None else v)
' "$SESION/inicio.json")
[ -n "$URL_DEL_ENTORNO" ] || { [ -z "$URL_INICIO" ] || RELAY_URL="${URL_INICIO%/}"; }
[ -n "$APP_DEL_ENTORNO" ] || { [ -z "$APP_INICIO" ] || RELAY_APP="$APP_INICIO"; }
[ -n "$SINFLY_DEL_ENTORNO" ] || SIN_FLY="$SINFLY_INICIO"
[ -z "${RELAY_MAQUINA:-}" ] || MAQUINA="$RELAY_MAQUINA"
info "relay: $RELAY_URL   app: $RELAY_APP   maquina: ${MAQUINA:-?}   SIN_FLY=$SIN_FLY"

if fly_disponible; then
    command -v fly >/dev/null 2>&1 || die "No esta instalado fly (flyctl)." "Instalalo:  brew install flyctl"
    fly auth whoami >/dev/null 2>&1 || die "fly no tiene sesion iniciada." "Inicia sesion:  fly auth login"
    [ -n "$MAQUINA" ] || MAQUINA="$(fly_maquina_id)"
fi

# ---------- 2. detener el dashboard ----------
DASHBOARD_ESTADO=""
if [ -z "$PID_DASH" ] || ! kill -0 "$PID_DASH" 2>/dev/null; then
    DASHBOARD_ESTADO="ya no estaba corriendo (PID ${PID_DASH:-?})"
    ok "el dashboard ya estaba cerrado"
else
    CMD_DASH="$(ps -o command= -p "$PID_DASH" 2>/dev/null || true)"
    case "$CMD_DASH" in
        *dashboard.py*)
            info "Cerrando el dashboard (PID $PID_DASH, SIGINT)..."
            kill -INT "$PID_DASH" 2>/dev/null || true
            for _ in $(seq 1 15); do
                kill -0 "$PID_DASH" 2>/dev/null || break
                sleep 1
            done
            if kill -0 "$PID_DASH" 2>/dev/null; then
                aviso "No se cerro en 15 s: SIGTERM..."
                kill -TERM "$PID_DASH" 2>/dev/null || true
                for _ in 1 2 3 4 5; do
                    kill -0 "$PID_DASH" 2>/dev/null || break
                    sleep 1
                done
            fi
            if kill -0 "$PID_DASH" 2>/dev/null; then
                DASHBOARD_ESTADO="NO se pudo cerrar (PID $PID_DASH)"
                fallo "El dashboard (PID $PID_DASH) sigue corriendo: cierralo a mano (Ctrl+C en su ventana)."
            else
                DASHBOARD_ESTADO="cerrado por este script (PID $PID_DASH)"
                ok "dashboard cerrado"
                sleep 2                         # que el ultimo lote llegue al relay
            fi
            ;;
        *)
            DASHBOARD_ESTADO="el PID $PID_DASH ya es de otro programa: no se toco"
            aviso "El PID $PID_DASH ahora es otro programa ($CMD_DASH): no lo toco. El dashboard de la sesion ya no corre."
            ;;
    esac
fi

# La cola en disco del reenviador (sqlite, solo lectura): si quedo algo sin subir, el relay NO lo tiene todavia.
COLA_PENDIENTE="$(py -c '
import json, os, sqlite3, sys
ini = json.load(open(sys.argv[1], encoding="utf-8"))
args = ini.get("args_dashboard") or []
ruta = os.path.join(sys.argv[2], "cola_web.db")
for i, a in enumerate(args):
    if a == "--web-cola" and i + 1 < len(args): ruta = args[i + 1]
    elif a.startswith("--web-cola="): ruta = a.split("=", 1)[1]
if not os.path.exists(ruta):
    print("sin cola en disco"); sys.exit(0)
try:
    con = sqlite3.connect("file:" + ruta + "?mode=ro", uri=True, timeout=3)
    print(con.execute("SELECT COUNT(*) FROM cola").fetchone()[0])
except Exception as e:
    print("no se pudo leer la cola (%s)" % type(e).__name__)
' "$SESION/inicio.json" "$ESTACION_DIR" 2>/dev/null || echo "no se pudo leer la cola")"
case "$COLA_PENDIENTE" in
    ''|*[!0-9]*) info "Cola del reenviador: $COLA_PENDIENTE" ;;
    0) ok "cola del reenviador vacia: todo lo que genero el dashboard ya subio" ;;
    *) aviso "Quedan $COLA_PENDIENTE mensajes en la cola del reenviador SIN subir al relay (siguen en cola_web.db; se suben al proximo arranque con --web-relay)." ;;
esac

# ---------- 3. lo transmitido ----------
HORA_FIN="$(date +%Y-%m-%dT%H:%M:%S%z)"
RELAY_VIVO=0

# Si el relay no responde (por ejemplo, Fly lo apago), se ofrece prenderlo para poder bajar los datos.
if salud_json >/dev/null 2>&1; then
    RELAY_VIVO=1
else
    aviso "El relay no responde en $RELAY_URL."
    if fly_disponible; then
        ESTADO="$(fly_estado_maquina "$MAQUINA")"
        TRIAL="$(fly_aviso_trial)"
        [ -z "$TRIAL" ] || aviso "Fly dijo: $TRIAL (una cuenta de prueba apaga la maquina a los 5 min)."
        if [ "$ESTADO" != "started" ] && preguntar "La maquina esta '$ESTADO'. Prenderla para bajar los datos (los datos del volumen no se pierden)?" s; then
            if fly machine start "$MAQUINA" -a "$RELAY_APP" >/dev/null && esperar_salud; then
                RELAY_VIVO=1
            fi
        fi
    fi
    [ "$RELAY_VIVO" = 1 ] || fallo "El relay no respondio: no hay salud, snapshot ni JSONL de esta sesion. Los datos siguen en el volumen /datos."
fi

if [ "$RELAY_VIVO" = 1 ]; then
    info "Guardando salud y snapshots..."
    if curl -fsS -m 30 -o "$SESION/salud_final.json" "$RELAY_URL/api/v1/salud"; then
        ok "salud_final.json"
    else
        rm -f "$SESION/salud_final.json"; fallo "No pude bajar la salud final."
    fi
    for m in $MISIONES; do
        if curl -fsS -m 30 -o "$SESION/snapshot_$m.json" "$RELAY_URL/api/v1/$m/snapshot"; then
            ok "snapshot_$m.json"
        else
            rm -f "$SESION/snapshot_$m.json"; fallo "No pude bajar el snapshot de $m."
        fi
    done

    info "Guardando los JSONL del relay (el volumen /datos)..."
    if fly_disponible; then
        # Lo mas robusto para varios MB: `fly ssh sftp get` (binario, sin pty, sin conversiones). Antes se lista /datos con
        # `ls -la` (por ssh, texto corto): dice que archivos existen y su tamano, y con eso se verifica la copia. Si sftp
        # falla, respaldo: `base64 /datos/x.jsonl` por `fly ssh console -C` (texto puro, inmune a un pty que cambie \n por \r\n
        # o recorte el final) y se decodifica aqui. `cat` directo no se usa: es lo que se corrompe con un pty.
        LISTADO="$(fly ssh console -a "$RELAY_APP" --machine "$MAQUINA" -C "ls -la /datos" 2>/dev/null | tr -d '\r' || true)"
        if [ -z "$LISTADO" ]; then
            fallo "No pude listar /datos por fly ssh: no se bajaron los JSONL. A mano:  fly ssh sftp get /datos/demeter.jsonl -a $RELAY_APP --machine $MAQUINA"
        else
            printf '%s\n' "$LISTADO" > "$SESION/datos_listado.txt"
            for m in $MISIONES; do
                TAM_REMOTO="$(printf '%s\n' "$LISTADO" | awk -v f="$m.jsonl" '$NF == f { print $5 }' | head -1)"
                if [ -z "$TAM_REMOTO" ]; then
                    info "$m: el relay no tiene /datos/$m.jsonl (esa mision no recibio nada)"
                    continue
                fi
                DEST="$SESION/$m.jsonl"
                rm -f "$DEST"
                if ! fly ssh sftp get "/datos/$m.jsonl" "$DEST" -a "$RELAY_APP" --machine "$MAQUINA" >/dev/null 2>&1 \
                   || [ "$(wc -c < "$DEST" 2>/dev/null | tr -d '[:space:]')" != "$TAM_REMOTO" ]; then
                    aviso "$m: sftp no dejo la copia completa; pruebo con base64 por ssh..."
                    rm -f "$DEST"
                    fly ssh console -a "$RELAY_APP" --machine "$MAQUINA" -C "base64 /datos/$m.jsonl" 2>/dev/null \
                        | tr -d '\r' | py -c 'import base64,sys; sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' > "$DEST" 2>/dev/null || true
                fi
                TAM_LOCAL="$(wc -c < "$DEST" 2>/dev/null | tr -d '[:space:]' || true)"
                if [ "${TAM_LOCAL:-}" = "$TAM_REMOTO" ]; then
                    ok "$m.jsonl ($TAM_LOCAL bytes, igual que en el volumen)"
                else
                    fallo "$m.jsonl: copia de ${TAM_LOCAL:-0} bytes y el volumen tiene $TAM_REMOTO. Reintenta o bajalo a mano: fly ssh sftp get /datos/$m.jsonl -a $RELAY_APP --machine $MAQUINA"
                fi
            done
        fi
    fi
    if ! fly_disponible; then
        if [ -n "${RELAY_DATOS_LOCAL:-}" ] && [ -d "$RELAY_DATOS_LOCAL" ]; then
            for m in $MISIONES; do
                if [ -f "$RELAY_DATOS_LOCAL/$m.jsonl" ]; then
                    cp "$RELAY_DATOS_LOCAL/$m.jsonl" "$SESION/$m.jsonl"
                    ok "$m.jsonl (copiado de RELAY_DATOS_LOCAL, $(wc -c < "$SESION/$m.jsonl" | tr -d '[:space:]') bytes)"
                else
                    info "$m: no hay $m.jsonl en RELAY_DATOS_LOCAL"
                fi
            done
        else
            aviso "SIN_FLY=1 y sin RELAY_DATOS_LOCAL: no se copian los JSONL del relay (el snapshot y la salud si)."
        fi
    fi
fi

# La sesion cruda del dashboard: los *_tierra.txt creados desde el inicio de esta sesion (y antes de la siguiente, si hay).
info "Copiando la sesion cruda de tierra..."
SIGUIENTE="$(find "$SESIONES_RELAY_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*_[0-9]*' 2>/dev/null | sort \
    | awk -v n="$NOMBRE_SESION" '{ k = $0; sub(/.*\//, "", k); if (k > n) { print k; exit } }')"
COPIADOS_TIERRA=0
for f in "$SESIONES_DIR"/*_tierra.txt; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    marca="${base%_tierra.txt}"
    if [ "$marca" \< "$NOMBRE_SESION" ]; then continue; fi
    if [ -n "$SIGUIENTE" ] && [ ! "$marca" \< "$SIGUIENTE" ]; then continue; fi
    cp -p "$f" "$SESION/$base"
    ok "$base"
    COPIADOS_TIERRA=$((COPIADOS_TIERRA + 1))
done
if [ "$COPIADOS_TIERRA" = 0 ]; then
    aviso "No hay ningun *_tierra.txt en estacion/sesiones/ creado despues del inicio (no se conecto la estacion de tierra?)."
fi

# ---------- resumen ----------
info "Escribiendo resumen.txt..."
py - "$SESION" "$HORA_FIN" "$DASHBOARD_ESTADO" "${MAQUINA:-}" "$RELAY_URL" "$COLA_PENDIENTE" ${FALLOS[@]+"${FALLOS[@]}"} <<'PYEOF'
import json, os, sys, time
sesion, hora_fin, dash, maq, url, cola = sys.argv[1:7]
fallos = sys.argv[7:]
L = []
def p(s=""): L.append(s)
def tam(r):
    try: return os.path.getsize(os.path.join(sesion, r))
    except OSError: return None
def leer(r):
    try:
        with open(os.path.join(sesion, r), encoding="utf-8") as f: return json.load(f)
    except (OSError, ValueError): return None

ini = leer("inicio.json") or {}
p("RESUMEN DE LA SESION  " + os.path.basename(sesion))
p("=" * 60)
p("Inicio:      " + str(ini.get("hora_inicio", "?")))
p("Detencion:   " + hora_fin)
if "hora_inicio_epoch" in ini:
    s = int(time.time()) - int(ini["hora_inicio_epoch"])
    p("Duracion:    %d min %02d s (hasta que se corrio detener_sesion.sh)" % (s // 60, s % 60))
p("Relay:       " + url + "   app " + str(ini.get("relay_app", "?")) + "   maquina " + (maq or "?"))
p("Dashboard:   " + dash)
p("Cola del reenviador al cerrar: " + (cola + " mensajes sin subir" if cola.isdigit() else cola))
if ini.get("ensayo"):
    p("OJO: sesion de ENSAYO (--demo o --reproducir): lo subido no es del vuelo.")
p()
sal_i = (ini.get("salud_inicial") or {}).get("misiones", {})
sal_f = (leer("salud_final.json") or {}).get("misiones", {})
p("Por mision")
p("-" * 60)
for m in ("demeter", "hermes"):
    si, sf = sal_i.get(m, {}), sal_f.get(m, {})
    p("%s" % m.upper())
    p("  seq_relay:    inicio %s -> final %s" % (si.get("seq_relay", "?"), sf.get("seq_relay", "no hay salud final")))
    p("  mission_id:   %s" % sf.get("mission_id", "?"))
    n = None
    tipos = {}
    smax = None
    try:
        with open(os.path.join(sesion, m + ".jsonl"), encoding="utf-8") as f:
            n = 0
            for ln in f:
                if not ln.strip(): continue
                try: o = json.loads(ln)
                except ValueError:
                    tipos["(ilegible)"] = tipos.get("(ilegible)", 0) + 1; continue
                n += 1
                tipos[o.get("tipo", "?")] = tipos.get(o.get("tipo", "?"), 0) + 1
                if isinstance(o.get("s"), int): smax = o["s"] if smax is None else max(smax, o["s"])
    except OSError:
        pass
    if n is None:
        p("  mensajes en el JSONL del relay: (no se bajo %s.jsonl)" % m)
    else:
        p("  mensajes en el JSONL del relay: %d   (%s)" % (n, ", ".join("%s=%d" % kv for kv in sorted(tipos.items())) or "vacio"))
        p("  ultimo 's' del JSONL: %s" % smax)
    snap = leer("snapshot_%s.json" % m)
    if snap is None:
        p("  snapshot final: (no se bajo)")
    else:
        serie = snap.get("serie") or {}
        npts = max((len(v) for v in serie.values() if isinstance(v, list)), default=0)
        p("  snapshot final: estado %s, %d eventos, %d puntos de serie" % ("SI" if snap.get("estado") else "no", len(snap.get("eventos") or []), npts))
    p()
p("Sesion cruda de tierra (estacion/sesiones/*_tierra.txt)")
p("-" * 60)
tierras = sorted(f for f in os.listdir(sesion) if f.endswith("_tierra.txt"))
for f in tierras:
    with open(os.path.join(sesion, f), "rb") as fh: lineas = sum(1 for _ in fh)
    p("  %s  %d lineas, %d bytes" % (f, lineas, tam(f)))
if not tierras: p("  (ninguna)")
p()
p("Archivos de la carpeta")
p("-" * 60)
for f in sorted(os.listdir(sesion)):
    if f != "resumen.txt": p("  %-32s %12d bytes" % (f, tam(f)))
p()
p("Fallos")
p("-" * 60)
if fallos:
    for x in fallos: p("  - " + x)
else:
    p("  ninguno")
p()
p("Este script NO borra datos del relay. La limpieza antes del vuelo es aparte (guia 11_guia_despliegue §4).")
open(os.path.join(sesion, "resumen.txt"), "w", encoding="utf-8").write("\n".join(L) + "\n")
PYEOF
ok "resumen.txt"
printf '\n'
cat "$SESION/resumen.txt"

# ---------- 4. apagar la maquina ----------
if fly_disponible; then
    if [ "$APAGAR" = 1 ] || preguntar "Apagar la maquina del relay ($MAQUINA)? Los datos quedan en el volumen y la web mostrara que no hay servidor." n; then
        info "Apagando la maquina $MAQUINA..."
        if fly machine stop "$MAQUINA" -a "$RELAY_APP" >/dev/null; then
            ok "maquina apagada (la prendes con estacion/iniciar_sesion.sh)"
        else
            aviso "No pude apagarla. Si dice 'failed to obtain lease' y no hay otro fly corriendo:  fly machine leases clear $MAQUINA -a $RELAY_APP  y repite."
            FALLOS+=("No se pudo apagar la maquina $MAQUINA")
        fi
    else
        info "La maquina sigue prendida (por defecto no se apaga). Para apagarla:  fly machine stop $MAQUINA -a $RELAY_APP"
    fi
fi

cartel "$C_AZUL" "Datos guardados en: ${SESION#"$REPO_DIR"/}" \
    "Este script NO borro nada del relay." \
    "La limpieza antes del vuelo es aparte: guia 11_guia_despliegue §4 (apagar el reenviador, rm /datos/*.jsonl y reiniciar)."

if [ "${#FALLOS[@]}" -gt 0 ]; then
    error "Termino con ${#FALLOS[@]} problema(s): revisa resumen.txt."
    exit 1
fi
