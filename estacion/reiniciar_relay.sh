#!/usr/bin/env bash
# estacion/reiniciar_relay.sh -- deja el relay en ceros antes del vuelo, con respaldo de todo lo que borra (T-673).
# Uso:  estacion/reiniciar_relay.sh [--si-borrar] [--ayuda]
# Es la UNICA excepcion a "nunca borra datos del relay" de los scripts de T-672 (iniciar_sesion.sh y detener_sesion.sh).
set -euo pipefail

# shellcheck source=estacion/sesion_comun.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/sesion_comun.sh"

# La cola del reenviador (sqlite); se puede fijar a otra ruta (por ejemplo, para probar sin tocar la real).
COLA_WEB_DB="${COLA_WEB_DB:-$ESTACION_DIR/cola_web.db}"
RELAY_DATOS_LOCAL="${RELAY_DATOS_LOCAL:-}"

ayuda() {
    cat <<EOF
reiniciar_relay.sh -- deja el relay en ceros antes del vuelo (guia de despliegue §4), con respaldo de lo que borra

USO
  estacion/reiniciar_relay.sh [--si-borrar]
  estacion/iniciar_sesion.sh                      (despues, para el vuelo)

ES LA UNICA EXCEPCION: iniciar_sesion.sh y detener_sesion.sh NUNCA borran datos del relay; este script SI los borra
(los /datos/*.jsonl del volumen del relay y, con ellos, el estado de las dos misiones). Antes lo respalda todo y,
si el respaldo falla, no borra nada. Usalo UNA vez, despues de los ensayos y antes de abrir la sesion del vuelo.

QUE HACE (en este orden)
  1. Rechaza si hay un dashboard.py corriendo (en cualquier puerto, o en el $PUERTO_DEFECTO): volveria a subir lo borrado
     desde su cola. NO lo cierra por su cuenta: cierralo tu (Ctrl+C en su ventana o detener_sesion.sh) y repite.
  2. Revisa: fly con sesion (salvo SIN_FLY=1) y estacion/.venv. No pide el token: no sube nada.
  3. Prende la maquina del relay si esta 'stopped'/'suspended' y espera la salud.
  4. Muestra seq_relay y mission_id de cada mision y pide que ESCRIBAS la palabra BORRAR (no un s/n).
     Cualquier otra respuesta cancela sin tocar nada. Sin terminal interactiva NO borra y sale con error,
     salvo que pases --si-borrar.
  5. Crea estacion/sesiones_relay/reinicio_AAAAMMDD_HHMMSS/ y guarda ahi: salud_antes.json, snapshot_demeter.json,
     snapshot_hermes.json y todos los /datos/*.jsonl del relay (fly ssh sftp get, con la copia verificada por tamano;
     si falla, por base64). SI EL RESPALDO FALLA, NO BORRA NADA Y SE DETIENE.
  6. Archiva la cola local del reenviador: mueve estacion/cola_web.db (y -wal, -shm) a reinicio_.../cola_vieja/
     (se mueve, no se borra).
  7. Borra: fly ssh console -C "sh -c 'rm -f /datos/*.jsonl'" y luego fly apps restart.
  8. Espera la salud y VERIFICA: seq_relay 0 y mission_id null en demeter y hermes, ingesta.lotes 0 y el snapshot de
     cada mision sin estado. Si no queda asi, falla con un mensaje claro.
  9. Escribe resumen.txt en la carpeta del reinicio (que habia, que se archivo y el resultado).

OPCIONES
  --si-borrar   salta la pregunta BORRAR (para usarlo sin terminal). Sigue respaldando y verificando.
  --ayuda, -h   esta ayuda

SALIDA
  0 = el relay quedo en ceros. 1 = cancelado, rechazado o fallo (el mensaje dice si se borro algo).

VARIABLES
  RELAY_APP=$RELAY_APP        RELAY_URL=$RELAY_URL
  RELAY_MAQUINA=<id>          fija la maquina (si no, se busca con fly)
  SIN_FLY=1                   relay LOCAL (127.0.0.1): no usa fly; hay que fijar RELAY_DATOS_LOCAL=<carpeta de datos del
                              relay>. Se borran los *.jsonl de esa carpeta y el relay local lo reinicias TU a mano.
  COLA_WEB_DB=<ruta>          la cola del reenviador (por defecto estacion/cola_web.db)
  PYTHON_ESTACION=<python>    por defecto estacion/.venv/bin/python
  ESPERA_SALUD_S=$ESPERA_SALUD_S          segundos maximos esperando la salud (al prender y tras el reinicio)

EJEMPLOS
  estacion/reiniciar_relay.sh
  estacion/reiniciar_relay.sh --si-borrar
  SIN_FLY=1 RELAY_URL=http://127.0.0.1:8787 RELAY_DATOS_LOCAL=/ruta/datos estacion/reiniciar_relay.sh
EOF
}

SI_BORRAR=0
while [ $# -gt 0 ]; do
    case "$1" in
        --ayuda|-h|--help) ayuda; exit 0 ;;
        --si-borrar) SI_BORRAR=1 ;;
        *) die "Opcion desconocida: $1" "Mira:  $0 --ayuda" ;;
    esac
    shift
done

# ---------- el resumen (se escribe siempre que exista la carpeta del reinicio, incluso si se aborta) ----------
REINICIO=""
RESULTADO="INTERRUMPIDO (el script se detuvo antes de terminar)"
RESUMEN_ESCRITO=0
SALUD_ANTES=""
ARCHIVOS_RESPALDADOS=""        # lineas "nombre tamano"
COLA_ARCHIVADA=""              # nombres
FALLOS_RESPALDO=""
N_FALLOS=0
BORRADOS=0                     # 1 cuando ya se borraron los *.jsonl
VERIFICACION=""

escribir_resumen() {
    set +e
    [ "$RESUMEN_ESCRITO" = 1 ] && return 0
    [ -n "$REINICIO" ] && [ -d "$REINICIO" ] || return 0
    {
        echo "REINICIO DEL RELAY  $(basename "$REINICIO")"
        echo "============================================================"
        echo "Hora:        $(date +%Y-%m-%dT%H:%M:%S%z)"
        echo "Relay:       $RELAY_URL   app $RELAY_APP   maquina ${MAQUINA:-?}   SIN_FLY=$SIN_FLY"
        echo
        echo "Lo que habia antes (salud_antes.json)"
        echo "------------------------------------------------------------"
        if [ -n "$SALUD_ANTES" ]; then
            printf '%s' "$SALUD_ANTES" | salud_lineas 2>/dev/null | while read -r m seq mid; do
                printf '  %-8s seq_relay=%-8s mission_id=%s\n' "$m" "$seq" "$mid"
            done
        else
            echo "  (sin salud)"
        fi
        echo
        echo "Respaldado en esta carpeta"
        echo "------------------------------------------------------------"
        if [ -n "$ARCHIVOS_RESPALDADOS" ]; then
            printf '%s' "$ARCHIVOS_RESPALDADOS" | while read -r nom tam; do
                [ -n "$nom" ] && printf '  %-24s %12s bytes\n' "$nom" "$tam"
            done
        else
            echo "  (ningun .jsonl: el relay no tenia datos en el volumen, o el respaldo no llego a hacerse)"
        fi
        for f in "$REINICIO/salud_antes.json" "$REINICIO"/snapshot_demeter.json "$REINICIO"/snapshot_hermes.json; do
            [ -f "$f" ] && printf '  %-24s %12s bytes\n' "$(basename "$f")" "$(wc -c < "$f" | tr -d '[:space:]')"
        done
        echo
        echo "Cola local del reenviador archivada (cola_vieja/)"
        echo "------------------------------------------------------------"
        if [ -n "$COLA_ARCHIVADA" ]; then
            printf '%s' "$COLA_ARCHIVADA" | while read -r nom; do [ -n "$nom" ] && echo "  $nom"; done
        else
            echo "  (no habia estacion/cola_web.db, o no se llego a ese paso)"
        fi
        echo
        echo "Borrado de /datos/*.jsonl: $([ "$BORRADOS" = 1 ] && echo SI || echo NO)"
        [ -z "$VERIFICACION" ] || { echo; echo "Verificacion"; echo "------------------------------------------------------------"; printf '%s\n' "$VERIFICACION"; }
        if [ -n "$FALLOS_RESPALDO" ]; then
            echo; echo "Fallos del respaldo"; echo "------------------------------------------------------------"
            printf '%s' "$FALLOS_RESPALDO" | sed 's/^/  - /'
        fi
        echo
        echo "RESULTADO: $RESULTADO"
    } > "$REINICIO/resumen.txt" 2>/dev/null
    RESUMEN_ESCRITO=1
    return 0
}
trap escribir_resumen EXIT

# abortar "mensaje" [lineas...]: deja el motivo en el resumen y sale con error.
abortar() {
    RESULTADO="ABORTADO: $1$([ "$BORRADOS" = 1 ] || echo ' (NO se borro nada del relay)')"
    die "$@"
}

fallo_respaldo() { aviso "$1"; N_FALLOS=$((N_FALLOS + 1)); FALLOS_RESPALDO="$FALLOS_RESPALDO$1"$'\n'; }

# ---------- 1. un dashboard corriendo lo volveria a subir todo ----------
# Los dashboards de esta maquina: "PID comando" por linea. Solo cuenta un python que ejecuta algo llamado dashboard.py
# (no un editor que lo tenga abierto ni este script).
dashboards_corriendo() {
    local re='^[^ ]*[Pp]ython[^ ]*( [^ ]+)* [^ ]*dashboard\.py( |$)' pid cmd
    ps -axo pid=,command= 2>/dev/null | while read -r pid cmd; do
        [ "$pid" = "$$" ] && continue
        if [[ "$cmd" =~ $re ]]; then printf '%s %s\n' "$pid" "$cmd"; fi
    done || true
    local p
    p="$(lsof -nP -iTCP:"$PUERTO_DEFECTO" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
    if [ -n "$p" ]; then
        cmd="$(ps -o command= -p "$p" 2>/dev/null || true)"
        case "$cmd" in *dashboard.py*) printf '%s %s\n' "$p" "$cmd" ;; esac
    fi
}
DASHBOARDS="$(dashboards_corriendo | sort -u || true)"
if [ -n "$DASHBOARDS" ]; then
    aviso "Hay un dashboard.py corriendo:"
    printf '%s\n' "$DASHBOARDS" | while read -r pid cmd; do printf '       PID %s: %s\n' "$pid" "$cmd" >&2; done
    die "Cierra el dashboard antes de reiniciar el relay: no se toco nada." \
        "Si sigue abierto, su reenviador volveria a subir lo que se borra (y la cola en disco)." \
        "Cierralo con Ctrl+C en su ventana (o estacion/detener_sesion.sh) y repite este script."
fi
ok "no hay ningun dashboard.py corriendo"

# ---------- 2. requisitos ----------
info "Revisando requisitos..."
[ -x "$PYTHON_ESTACION" ] || die "No existe $PYTHON_ESTACION" \
    "Crea el entorno (una sola vez):" \
    "  python3 -m venv estacion/.venv && estacion/.venv/bin/pip install pyserial"
ok "python: $PYTHON_ESTACION"

command -v curl >/dev/null 2>&1 || die "No esta instalado curl."

MAQUINA=""
if fly_disponible; then
    fly_requisitos
else
    aviso "SIN_FLY=1: se salta todo lo de Fly (relay local). Los *.jsonl se borran de RELAY_DATOS_LOCAL y el relay lo reinicias tu."
    case "$RELAY_URL" in
        http://127.0.0.1*|http://localhost*|"http://[::1]"*) ;;
        *) die "SIN_FLY=1 es solo para un relay local y RELAY_URL es $RELAY_URL." \
               "Para el relay real quita SIN_FLY (se usa fly) o pon RELAY_URL=http://127.0.0.1:<puerto>." ;;
    esac
    [ -n "$RELAY_DATOS_LOCAL" ] && [ -d "$RELAY_DATOS_LOCAL" ] || die "SIN_FLY=1 necesita RELAY_DATOS_LOCAL=<carpeta de datos del relay local>." \
        "Es la carpeta de WEB_RELAY_DATOS del relay (de ahi se respaldan y se borran los *.jsonl)."
    RELAY_DATOS_LOCAL="$(cd "$RELAY_DATOS_LOCAL" && pwd -P)"
fi

# ---------- 3. la maquina del relay ----------
if fly_disponible; then
    MAQUINA="$(fly_maquina_id)"
    ok "maquina del relay: $MAQUINA"
    ESTADO="$(fly_estado_maquina "$MAQUINA")"
    case "$ESTADO" in
        started)
            ok "la maquina ya esta prendida"
            ;;
        stopped|suspended|created)
            info "La maquina esta '$ESTADO': prendiendola (fly machine start)..."
            fly machine start "$MAQUINA" -a "$RELAY_APP" >/dev/null || die "No pude prender la maquina $MAQUINA. No se toco nada." \
                "Si dice 'failed to obtain lease' y no hay otro fly corriendo:  fly machine leases clear $MAQUINA -a $RELAY_APP" \
                "y repite este script."
            ;;
        *)
            aviso "Estado de la maquina: '$ESTADO'. Intento esperar la salud igual."
            ;;
    esac
fi
if ! esperar_salud; then
    die "El relay no respondio 'estado: ok' en $ESPERA_SALUD_S s ($RELAY_URL/api/v1/salud). No se toco nada." \
        "Mira:  fly status -a $RELAY_APP   y   fly logs -a $RELAY_APP" \
        "Si hace falta mas tiempo:  ESPERA_SALUD_S=180 $0"
fi
SALUD_ANTES="$(salud_json)" || die "No pude leer la salud del relay. No se toco nada."
ok "el relay responde estado: ok"

# ---------- 4. lo que se va a borrar y la confirmacion ----------
printf '\n%s\n' "${C_NEGRITA}Lo que hay ahora en el relay (${RELAY_URL})${C_FIN}"
while read -r m seq mid; do
    printf '  %-8s seq_relay=%-8s mission_id=%s\n' "$m" "$seq" "$mid"
done < <(printf '%s' "$SALUD_ANTES" | salud_lineas)

cartel "$C_ROJO" "VAS A BORRAR TODO LO QUE TIENE EL RELAY" \
    "Se borran los /datos/*.jsonl del volumen y se reinicia la maquina: las dos misiones" \
    "quedan en cero (sin estado, sin trayectoria, sin eventos, mission_id null)." \
    "Antes se respalda todo en estacion/sesiones_relay/reinicio_<fecha>/ (y si el respaldo falla, no se borra)." \
    "NO lo hagas con un vuelo en curso ni con una sesion que quieras conservar sin haberla bajado."

if [ "$SI_BORRAR" = 1 ]; then
    aviso "--si-borrar: no se pide confirmacion."
elif ! interactivo; then
    die "Sin terminal interactiva: no borro nada." \
        "Para borrar sin que te pregunte, repite con --si-borrar (solo si estas seguro)."
else
    printf '%s' "Para borrar escribe la palabra ${C_NEGRITA}BORRAR${C_FIN} (mayusculas) y Enter; cualquier otra cosa cancela: "
    RESPUESTA=""
    read -r RESPUESTA || RESPUESTA=""
    if [ "$RESPUESTA" != "BORRAR" ]; then
        die "Cancelado: no se escribio BORRAR. No se toco nada."
    fi
fi

# ---------- 5. el respaldo (si falla, NO se borra nada) ----------
REINICIO="$SESIONES_RELAY_DIR/reinicio_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$REINICIO"
ok "carpeta del reinicio: ${REINICIO#"$REPO_DIR"/}"

info "Respaldando salud y snapshots..."
printf '%s\n' "$SALUD_ANTES" > "$REINICIO/salud_antes.json"
ok "salud_antes.json"
for m in $MISIONES; do
    if curl -fsS -m 30 -o "$REINICIO/snapshot_$m.json" "$RELAY_URL/api/v1/$m/snapshot"; then
        ok "snapshot_$m.json"
    else
        rm -f "$REINICIO/snapshot_$m.json"
        fallo_respaldo "No pude bajar el snapshot de $m."
    fi
done

info "Respaldando los JSONL del relay (el volumen /datos)..."
if fly_disponible; then
    # Mismo metodo que detener_sesion.sh: ls -la para saber que archivos hay y su tamano exacto; `fly ssh sftp get`
    # (binario, sin pty); la copia se verifica por tamano y, si falla, respaldo con base64 por `fly ssh console -C`.
    LISTADO="$(fly ssh console -a "$RELAY_APP" --machine "$MAQUINA" -C "ls -la /datos" 2>/dev/null </dev/null | tr -d '\r' || true)"
    if [ -z "$LISTADO" ]; then
        fallo_respaldo "No pude listar /datos por fly ssh: no se puede saber que hay que respaldar."
    else
        printf '%s\n' "$LISTADO" > "$REINICIO/datos_listado.txt"
        NOMBRES="$(printf '%s\n' "$LISTADO" | awk '$NF ~ /\.jsonl$/ && $5 ~ /^[0-9]+$/ { print $5 " " $NF }')"
        if [ -z "$NOMBRES" ]; then
            info "El volumen /datos no tiene ningun .jsonl (el relay no habia guardado nada)."
        fi
        while read -r TAM_REMOTO NOM; do
            [ -n "${NOM:-}" ] || continue
            DEST="$REINICIO/$NOM"
            rm -f "$DEST"
            if ! fly ssh sftp get "/datos/$NOM" "$DEST" -a "$RELAY_APP" --machine "$MAQUINA" >/dev/null 2>&1 </dev/null \
               || [ "$(wc -c < "$DEST" 2>/dev/null | tr -d '[:space:]')" != "$TAM_REMOTO" ]; then
                aviso "$NOM: sftp no dejo la copia completa; pruebo con base64 por ssh..."
                rm -f "$DEST"
                fly ssh console -a "$RELAY_APP" --machine "$MAQUINA" -C "base64 /datos/$NOM" 2>/dev/null </dev/null \
                    | tr -d '\r' | py -c 'import base64,sys; sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' > "$DEST" 2>/dev/null || true
            fi
            TAM_LOCAL="$(wc -c < "$DEST" 2>/dev/null | tr -d '[:space:]' || true)"
            if [ "${TAM_LOCAL:-}" = "$TAM_REMOTO" ]; then
                ok "$NOM ($TAM_LOCAL bytes, igual que en el volumen)"
                ARCHIVOS_RESPALDADOS="$ARCHIVOS_RESPALDADOS$NOM $TAM_LOCAL"$'\n'
            else
                fallo_respaldo "$NOM: copia de ${TAM_LOCAL:-0} bytes y el volumen tiene $TAM_REMOTO."
            fi
        done <<< "$NOMBRES"
    fi
else
    for f in "$RELAY_DATOS_LOCAL"/*.jsonl; do
        [ -f "$f" ] || continue
        NOM="$(basename "$f")"
        if cp "$f" "$REINICIO/$NOM" && cmp -s "$f" "$REINICIO/$NOM"; then
            TAM_LOCAL="$(wc -c < "$REINICIO/$NOM" | tr -d '[:space:]')"
            ok "$NOM ($TAM_LOCAL bytes, copiado de RELAY_DATOS_LOCAL)"
            ARCHIVOS_RESPALDADOS="$ARCHIVOS_RESPALDADOS$NOM $TAM_LOCAL"$'\n'
        else
            fallo_respaldo "$NOM: no se pudo copiar de RELAY_DATOS_LOCAL."
        fi
    done
    [ -n "$ARCHIVOS_RESPALDADOS" ] || info "RELAY_DATOS_LOCAL no tiene ningun .jsonl."
fi

if [ "$N_FALLOS" -gt 0 ]; then
    abortar "el respaldo fallo ($N_FALLOS problema(s)): no se borro nada." \
        "No se borro NADA del relay ni se movio la cola. Lo respaldado hasta ahora esta en ${REINICIO#"$REPO_DIR"/}." \
        "Arregla el problema (fly ssh, red, espacio en disco) y repite este script." \
        "Para bajar un archivo a mano:  fly ssh sftp get /datos/demeter.jsonl -a $RELAY_APP"
fi
ok "respaldo completo y verificado"

# ---------- 6. archivar la cola local del reenviador (se mueve, nunca se borra) ----------
for sufijo in "" "-wal" "-shm"; do
    ORIGEN="$COLA_WEB_DB$sufijo"
    [ -e "$ORIGEN" ] || continue
    mkdir -p "$REINICIO/cola_vieja"
    if mv "$ORIGEN" "$REINICIO/cola_vieja/"; then
        COLA_ARCHIVADA="$COLA_ARCHIVADA$(basename "$ORIGEN")"$'\n'
        ok "cola archivada: $(basename "$ORIGEN") -> ${REINICIO#"$REPO_DIR"/}/cola_vieja/"
    else
        abortar "no pude archivar $ORIGEN: no se borro nada del relay." \
            "No se borro NADA del relay. Revisa los permisos de ${COLA_WEB_DB%/*} y repite."
    fi
done
[ -n "$COLA_ARCHIVADA" ] || info "No habia cola local ($COLA_WEB_DB): nada que archivar."

# ---------- 7. borrar y reiniciar ----------
info "Borrando los JSONL del relay..."
if fly_disponible; then
    if ! fly ssh console -a "$RELAY_APP" --machine "$MAQUINA" -C "sh -c 'rm -f /datos/*.jsonl'" </dev/null >/dev/null 2>&1; then
        abortar "fly no pudo borrar /datos/*.jsonl; el estado del relay es incierto." \
            "Los datos estan respaldados en ${REINICIO#"$REPO_DIR"/}." \
            "Revisa:  fly ssh console -a $RELAY_APP -C \"ls -la /datos\"   y repite el borrado a mano:" \
            "  fly ssh console -a $RELAY_APP -C \"sh -c 'rm -f /datos/*.jsonl'\"   y   fly apps restart $RELAY_APP"
    fi
    RESTO="$(fly ssh console -a "$RELAY_APP" --machine "$MAQUINA" -C "ls /datos" 2>/dev/null </dev/null | tr -d '\r' | grep -c '\.jsonl$' || true)"
    if [ "${RESTO:-0}" != 0 ]; then
        abortar "despues del rm todavia quedan $RESTO .jsonl en /datos." \
            "Los datos estan respaldados en ${REINICIO#"$REPO_DIR"/}. Revisa:  fly ssh console -a $RELAY_APP -C \"ls -la /datos\""
    fi
    BORRADOS=1
    ok "/datos/*.jsonl borrados"
    info "Reiniciando la maquina (fly apps restart)..."
    if ! SALIDA_RESTART="$(fly apps restart "$RELAY_APP" 2>&1 </dev/null)"; then
        abortar "los JSONL se borraron pero fly apps restart fallo: el relay sigue con el estado viejo en memoria." \
            "$SALIDA_RESTART" \
            "REINICIALO YA o seguira mostrando lo viejo:  fly apps restart $RELAY_APP" \
            "Despues verifica con:  curl -s $RELAY_URL/api/v1/salud"
    fi
    ok "maquina reiniciada"
else
    rm -f "$RELAY_DATOS_LOCAL"/*.jsonl
    BORRADOS=1
    ok "$RELAY_DATOS_LOCAL/*.jsonl borrados"
    aviso "Relay local: REINICIALO A MANO ahora (Ctrl+C a servidor.py y vuelve a lanzarlo); sigue con el estado viejo en memoria."
    if interactivo && [ "$SI_BORRAR" != 1 ]; then
        printf '%s' "Pulsa Enter cuando ya lo hayas reiniciado... "
        read -r _ || true
    fi
fi

# ---------- 8. verificar que quedo en ceros ----------
# Descarga la salud y los snapshots y revisa que todo este en cero. Imprime los problemas (uno por linea); exito si no hay.
verificar_ceros() {
    curl -fsS -m 15 -o "$REINICIO/salud_despues.json" "$RELAY_URL/api/v1/salud" 2>/dev/null || { echo "el relay no responde"; return 1; }
    local m
    for m in $MISIONES; do
        curl -fsS -m 15 -o "$REINICIO/snapshot_${m}_despues.json" "$RELAY_URL/api/v1/$m/snapshot" 2>/dev/null \
            || { echo "no pude bajar el snapshot de $m"; return 1; }
    done
    py -c '
import json, sys
carpeta, misiones = sys.argv[1], sys.argv[2].split()
mal = []
try:
    s = json.load(open(carpeta + "/salud_despues.json", encoding="utf-8"))
except Exception as e:
    print("la salud no es JSON valido (%s)" % type(e).__name__); sys.exit(1)
for m in misiones:
    e = (s.get("misiones") or {}).get(m)
    if e is None:
        mal.append("%s: la salud no trae la mision" % m); continue
    if e.get("seq_relay") != 0: mal.append("%s: seq_relay=%s (debe ser 0)" % (m, e.get("seq_relay")))
    if e.get("mission_id") is not None: mal.append("%s: mission_id=%s (debe ser null)" % (m, e.get("mission_id")))
    try:
        snap = json.load(open("%s/snapshot_%s_despues.json" % (carpeta, m), encoding="utf-8"))
    except Exception as ex:
        mal.append("%s: el snapshot no es JSON valido (%s)" % (m, type(ex).__name__)); continue
    if snap.get("estado"): mal.append("%s: el snapshot todavia trae estado" % m)
lotes = (s.get("ingesta") or {}).get("lotes")
if lotes != 0: mal.append("ingesta.lotes=%s (debe ser 0)" % lotes)
for x in mal: print(x)
sys.exit(1 if mal else 0)
' "$REINICIO" "$MISIONES"
}

info "Esperando que el relay quede en ceros (hasta ${ESPERA_SALUD_S} s)..."
LIMITE=$((SECONDS + ESPERA_SALUD_S))
PROBLEMAS=""
VERIFICADO=0
while :; do
    if PROBLEMAS="$(verificar_ceros)"; then VERIFICADO=1; break; fi
    [ "$SECONDS" -lt "$LIMITE" ] || break
    sleep 2
done
if [ "$VERIFICADO" != 1 ]; then
    VERIFICACION="FALLO: $(printf '%s' "$PROBLEMAS" | tr '\n' ';')"
    RESULTADO="LOS JSONL SE BORRARON PERO EL RELAY NO QUEDO EN CEROS: $(printf '%s' "$PROBLEMAS" | tr '\n' ';')"
    {
        printf '%s\n' "El relay no quedo en ceros en $ESPERA_SALUD_S s:"
        printf '%s\n' "$PROBLEMAS" | while read -r l; do printf '  - %s\n' "$l"; done
    } >&2
    if fly_disponible; then
        die "El relay NO quedo en ceros." \
            "Los datos viejos estan respaldados en ${REINICIO#"$REPO_DIR"/}." \
            "Si dice que el relay no responde, mira:  fly status -a $RELAY_APP   y   fly logs -a $RELAY_APP" \
            "Si sigue con datos, reinicialo:  fly apps restart $RELAY_APP   y mira:  curl -s $RELAY_URL/api/v1/salud" \
            "No abras la sesion del vuelo hasta que este en ceros. Mas tiempo:  ESPERA_SALUD_S=180 $0"
    else
        die "El relay local NO quedo en ceros." \
            "Los datos viejos estan respaldados en ${REINICIO#"$REPO_DIR"/}." \
            "Reinicia servidor.py (con WEB_RELAY_DATOS=$RELAY_DATOS_LOCAL) y mira:  curl -s $RELAY_URL/api/v1/salud"
    fi
fi
VERIFICACION="OK: seq_relay 0 y mission_id null en $MISIONES, ingesta.lotes 0 y snapshots sin estado."
RESULTADO="RELAY EN CEROS"
ok "$VERIFICACION"

# ---------- 9. resumen y siguientes pasos ----------
escribir_resumen
ok "resumen.txt"

cartel "$C_VERDE" "RELAY EN CEROS" \
    "seq_relay 0 y mission_id null en demeter y hermes; lo anterior esta en:" \
    "  ${REINICIO#"$REPO_DIR"/}/"
cat <<EOF
Siguientes pasos
  1. Refresca (Cmd+Shift+R) las pestanas abiertas de la web: tienen el estado viejo en memoria.
  2. Ahora corre estacion/iniciar_sesion.sh para la sesion del vuelo.
EOF
