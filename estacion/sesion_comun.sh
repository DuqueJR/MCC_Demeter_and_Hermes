# shellcheck shell=bash
# shellcheck disable=SC2034  # las variables las usan los scripts que cargan este archivo
# estacion/sesion_comun.sh -- funciones compartidas de iniciar_sesion.sh y detener_sesion.sh (T-672).
# Se carga con `source`; no se ejecuta solo. Compatible con el bash 3.2 de macOS.
#
# Variables que se pueden sobreescribir (para probar sin el relay real):
#   RELAY_APP        app de Fly (hermes-demeter-relay)
#   RELAY_URL        URL base del relay (https://api.eiaspice.space)
#   RELAY_MAQUINA    ID de la maquina de Fly (si no, se pregunta a `fly machine list`)
#   SITIO_URL        URL del sitio publico (https://eiaspice.space), solo para imprimirla
#   SIN_FLY=1        salta todos los pasos de Fly (para un relay local)
#   RELAY_DATOS_LOCAL  con SIN_FLY=1: carpeta de la que se copian los *.jsonl del relay local
#   SESIONES_RELAY_DIR  donde se crean las carpetas de sesion y de reinicio (estacion/sesiones_relay); T-676, para las pruebas
#   PYTHON_ESTACION  el python del dashboard (estacion/.venv/bin/python)
#   ESPERA_SALUD_S   segundos maximos esperando la salud tras prender (90)
#   NO_COLOR         si existe, sin colores

RELAY_APP="${RELAY_APP:-hermes-demeter-relay}"
RELAY_URL="${RELAY_URL:-https://api.eiaspice.space}"
RELAY_URL="${RELAY_URL%/}"
SITIO_URL="${SITIO_URL:-https://eiaspice.space}"
SITIO_URL="${SITIO_URL%/}"
SIN_FLY="${SIN_FLY:-0}"
ESPERA_SALUD_S="${ESPERA_SALUD_S:-90}"
LLAVERO_SERVICIO="hermes-relay-token"
TOKEN_LARGO=64
MISIONES="demeter hermes"
PUERTO_DEFECTO=8765

ESTACION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "$ESTACION_DIR/.." && pwd -P)"
SESIONES_RELAY_DIR="${SESIONES_RELAY_DIR:-$ESTACION_DIR/sesiones_relay}"
SESIONES_DIR="$ESTACION_DIR/sesiones"
PYTHON_ESTACION="${PYTHON_ESTACION:-$ESTACION_DIR/.venv/bin/python}"

# ---------- mensajes ----------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    C_ROJO=$'\033[31m'; C_VERDE=$'\033[32m'; C_AMARILLO=$'\033[33m'; C_AZUL=$'\033[36m'; C_NEGRITA=$'\033[1m'; C_FIN=$'\033[0m'
else
    C_ROJO=""; C_VERDE=""; C_AMARILLO=""; C_AZUL=""; C_NEGRITA=""; C_FIN=""
fi
info()  { printf '%s\n' "${C_AZUL}[..]${C_FIN} $*"; }
ok()    { printf '%s\n' "${C_VERDE}[ok]${C_FIN} $*"; }
aviso() { printf '%s\n' "${C_AMARILLO}[!!]${C_FIN} $*" >&2; }
error() { printf '%s\n' "${C_ROJO}[error]${C_FIN} $*" >&2; }
die()   { error "$1"; shift; for l in "$@"; do printf '       %s\n' "$l" >&2; done; exit 1; }

# Un cartel grande y visible (para lo que no se debe pasar por alto).
cartel() {
    local color="$1"; shift
    local linea="==============================================================================="
    printf '\n%s%s%s\n' "$color$C_NEGRITA" "$linea" "$C_FIN"
    for l in "$@"; do printf '%s  %s%s\n' "$color$C_NEGRITA" "$l" "$C_FIN"; done
    printf '%s%s%s\n\n' "$color$C_NEGRITA" "$linea" "$C_FIN"
}

interactivo() { [ -t 0 ]; }

# preguntar "texto" [s|n]  -> 0 si responde que si. Sin terminal interactiva devuelve el valor por defecto.
preguntar() {
    local texto="$1" def="${2:-n}" resp pista="[s/N]"
    [ "$def" = "s" ] && pista="[S/n]"
    if ! interactivo; then
        [ "$def" = "s" ]
        return
    fi
    printf '%s %s ' "$texto" "$pista"
    read -r resp || resp=""
    case "$resp" in
        [sSyY]*) return 0 ;;
        [nN]*)   return 1 ;;
        *)       [ "$def" = "s" ] ;;
    esac
}

# ---------- python (JSON) ----------
py() { "$PYTHON_ESTACION" -I "$@"; }

requerir_python() {
    [ -x "$PYTHON_ESTACION" ] || die "No existe $PYTHON_ESTACION" \
        "Crea el entorno (una sola vez):" \
        "  python3 -m venv estacion/.venv && estacion/.venv/bin/pip install pyserial"
    py -c "import serial" >/dev/null 2>&1 || die "El entorno de la estacion no tiene pyserial." \
        "Instalalo:  $PYTHON_ESTACION -m pip install pyserial"
}

# ---------- relay ----------
# salud_json -> imprime el JSON de /api/v1/salud (sale con error si no responde)
salud_json() { curl -fsS -m 10 "$RELAY_URL/api/v1/salud"; }

# salud_ok: lee el JSON por stdin; exito si "estado" == "ok"
salud_ok() { py -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("estado") == "ok" else 1)' 2>/dev/null; }

# salud_lineas: lee la salud por stdin; una linea por mision: "<mision> <seq_relay> <mission_id|null>"
salud_lineas() {
    py -c '
import json, sys
s = json.load(sys.stdin)
for m, e in s.get("misiones", {}).items():
    mid = e.get("mission_id")
    print(m, e.get("seq_relay", 0), "null" if mid is None else mid)
'
}

# ---------- Fly ----------
fly_disponible() { [ "$SIN_FLY" != "1" ]; }

fly_requisitos() {
    command -v fly >/dev/null 2>&1 || die "No esta instalado fly (flyctl)." \
        "Instalalo:  brew install flyctl   (o https://fly.io/docs/flyctl/install/)"
    local quien
    quien="$(fly auth whoami 2>/dev/null || true)"
    [ -n "$quien" ] || die "fly no tiene sesion iniciada." \
        "Inicia sesion con la cuenta del proyecto:  fly auth login"
    ok "fly con sesion: $quien"
}

# fly_maquina_id: imprime el ID limpio de la unica maquina de la app. `fly machine list -q` trae espacios y lineas en
# blanco: se limpia cada linea con tr -d '[:space:]' y se descartan las vacias.
fly_maquina_id() {
    if [ -n "${RELAY_MAQUINA:-}" ]; then
        printf '%s' "$RELAY_MAQUINA" | tr -d '[:space:]'
        return
    fi
    local crudo ids n
    crudo="$(fly machine list -a "$RELAY_APP" -q 2>/dev/null || true)"
    ids="$(printf '%s\n' "$crudo" | while IFS= read -r l; do printf '%s\n' "$l" | tr -d '[:space:]'; done | awk 'length($0) > 0')"
    n="$(printf '%s' "$ids" | awk 'length($0) > 0' | wc -l | tr -d '[:space:]')"
    if [ -z "$ids" ]; then
        die "No encontre ninguna maquina en la app $RELAY_APP." \
            "Revisa:  fly machine list -a $RELAY_APP   (y que fly este en la cuenta del proyecto)"
    fi
    if [ "$n" -gt 1 ]; then
        die "La app $RELAY_APP tiene mas de una maquina (el relay debe ser UNA sola: el estado esta en memoria)." \
            "Mira cual es con:  fly machine list -a $RELAY_APP" \
            "y fija la correcta con:  RELAY_MAQUINA=<id> $0"
    fi
    printf '%s' "$ids"
}

# fly_estado_maquina ID -> started | stopped | ... | desconocido
fly_estado_maquina() {
    local id="$1"
    fly machine list -a "$RELAY_APP" --json 2>/dev/null | py -c '
import json, sys
try:
    for m in json.load(sys.stdin):
        if m.get("id") == sys.argv[1]:
            print(m.get("state", "desconocido")); break
    else:
        print("desconocido")
except Exception:
    print("desconocido")
' "$id" || echo desconocido
}

# fly_aviso_trial: si en los logs recientes sale "Trial machine stopping", imprime esa linea (sin colores ANSI)
fly_aviso_trial() {
    local logs linea
    logs="$(fly logs -a "$RELAY_APP" --no-tail 2>&1 || true)"
    case "$logs" in
        *"Trial machine stopping"*)
            linea="$(printf '%s\n' "$logs" | grep 'Trial machine stopping' | tail -1 | sed $'s/\033\\[[0-9;]*m//g')"
            printf '%s' "$linea"
            ;;
    esac
}

# esperar_salud: espera hasta ESPERA_SALUD_S a que salud responda "estado": "ok". Exito = 0.
esperar_salud() {
    local limite=$((SECONDS + ESPERA_SALUD_S)) json
    printf '%s' "${C_AZUL}[..]${C_FIN} Esperando la salud del relay (hasta ${ESPERA_SALUD_S} s) "
    while [ "$SECONDS" -lt "$limite" ]; do
        if json="$(salud_json 2>/dev/null)" && printf '%s' "$json" | salud_ok; then
            printf '\n'
            return 0
        fi
        printf '.'
        sleep 2
    done
    printf '\n'
    return 1
}

dir_de_sesion_ultima() {
    local ultima=""
    if [ -d "$SESIONES_RELAY_DIR" ]; then
        ultima="$(find "$SESIONES_RELAY_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*_[0-9]*' | sort | tail -1)"
    fi
    printf '%s' "$ultima"
}
