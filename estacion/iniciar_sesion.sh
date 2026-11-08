#!/usr/bin/env bash
# estacion/iniciar_sesion.sh -- prende el relay, carga el token y abre el dashboard con el reenviador (T-672).
# Uso:  estacion/iniciar_sesion.sh [--permitir-ensayo] [--ayuda] [opciones del dashboard...]
set -euo pipefail

# shellcheck source=estacion/sesion_comun.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/sesion_comun.sh"

ayuda() {
    cat <<EOF
iniciar_sesion.sh -- prepara y abre una sesion de la estacion con el relay publico

USO
  estacion/iniciar_sesion.sh [--permitir-ensayo] [OPCIONES DEL DASHBOARD...]
  estacion/detener_sesion.sh                      (al terminar)

QUE HACE
  1. Revisa: fly con sesion, estacion/.venv con pyserial, el token en el Llavero (64 caracteres, sin mostrarlo)
     y el puerto del dashboard libre (si hay un dashboard viejo, pregunta antes de cerrarlo).
  2. Busca el ID de la maquina del relay, la prende si esta 'stopped' y espera la salud.
  3. Muestra seq_relay y mission_id de cada mision. Si seq_relay > 0 avisa en grande (NO limpia: guia §4).
  4. Crea estacion/sesiones_relay/AAAAMMDD_HHMMSS/ con inicio.json (hora, maquina, salud inicial, PID).
  5. Abre el dashboard con --web-relay y el token SOLO en su entorno. Queda en PRIMER PLANO: Ctrl+C lo cierra.
     (Es el mismo proceso del script: el PID guardado en inicio.json es el del dashboard.)

OPCIONES
  --permitir-ensayo   deja usar --demo o --reproducir contra el relay REAL (lo que suba NO es del vuelo y habra
                      que limpiar). Sin esta opcion se rechazan. Con un relay local (127.0.0.1) no hace falta.
  --ayuda, -h         esta ayuda
  Cualquier otra opcion se pasa al dashboard:  --no-abrir  --puerto N  --demo  --reproducir SESION  --velocidad X ...
  --web-relay no se acepta: la URL sale de RELAY_URL (asi el token no puede ir a otro sitio por error).

VARIABLES
  RELAY_APP=$RELAY_APP        RELAY_URL=$RELAY_URL
  RELAY_MAQUINA=<id>          fija la maquina (si no, se busca con fly)
  SIN_FLY=1                   salta los pasos de Fly (relay local)
  WEB_INGESTA_TOKEN=...       si ya esta en el entorno se usa; si no, se lee del Llavero (hermes-relay-token)
  PYTHON_ESTACION=<python>    por defecto estacion/.venv/bin/python
  ESPERA_SALUD_S=$ESPERA_SALUD_S          segundos maximos esperando la salud

EJEMPLOS
  estacion/iniciar_sesion.sh
  estacion/iniciar_sesion.sh --no-abrir --puerto 8799
  RELAY_URL=http://127.0.0.1:8787 SIN_FLY=1 estacion/iniciar_sesion.sh --demo --no-abrir
EOF
}

# argparse acepta abreviaturas (--repro, --dem): se detectan igual, con al menos 3 caracteres ("--x").
es_opcion() {
    local largo="$1" nombre="${2%%=*}"
    case "$nombre" in --*) ;; *) return 1 ;; esac
    [ "${#nombre}" -ge 3 ] && [ "${largo#"$nombre"}" != "$largo" ]
}

# ---------- argumentos ----------
PERMITIR_ENSAYO=0
ES_DEMO=0
ES_REPRODUCIR=0
PUERTO="$PUERTO_DEFECTO"
EXTRA=()
while [ $# -gt 0 ]; do
    a="$1"
    case "$a" in
        --ayuda|-h|--help) ayuda; exit 0 ;;
        --permitir-ensayo) PERMITIR_ENSAYO=1; shift; continue ;;
    esac
    if es_opcion --web-relay "$a" && [ "${#a}" -ge 7 ]; then
        die "--web-relay no se acepta aqui." "La URL del relay sale de RELAY_URL ($RELAY_URL); asi el token no viaja a otro servidor por error." \
            "Para otro relay:  RELAY_URL=https://... $0"
    fi
    if es_opcion --demo "$a"; then ES_DEMO=1; fi
    if es_opcion --reproducir "$a"; then ES_REPRODUCIR=1; fi
    if es_opcion --puerto "$a"; then
        case "$a" in
            *=*) PUERTO="${a#*=}"; EXTRA+=("$a"); shift ;;
            *)   [ $# -ge 2 ] || die "$a necesita un numero de puerto."
                 PUERTO="$2"; EXTRA+=("$a" "$2"); shift 2 ;;
        esac
        continue
    fi
    EXTRA+=("$a")
    shift
done
case "$PUERTO" in ''|*[!0-9]*) die "Puerto invalido: '$PUERTO'." ;; esac

# ---------- 0. ensayo contra el relay real ----------
RELAY_LOCAL=0
case "$RELAY_URL" in
    http://127.0.0.1*|http://localhost*|"http://[::1]"*) RELAY_LOCAL=1 ;;
esac
if { [ "$ES_DEMO" = 1 ] || [ "$ES_REPRODUCIR" = 1 ]; } && [ "$RELAY_LOCAL" = 0 ]; then
    if [ "$PERMITIR_ENSAYO" != 1 ]; then
        die "--demo y --reproducir suben datos que NO son del vuelo al relay real ($RELAY_URL)." \
            "Si de verdad es un ensayo, repite con --permitir-ensayo (y despues habra que hacer la limpieza, guia §4)." \
            "Para probar sin tocar el relay real, usa uno local:  RELAY_URL=http://127.0.0.1:8787 SIN_FLY=1 $0 --demo"
    fi
    cartel "$C_AMARILLO" "ENSAYO CONTRA EL RELAY REAL" \
        "Con --demo o --reproducir lo que se sube NO es del vuelo." \
        "El meta.modo seguira diciendo 'vivo'. Despues hay que limpiar el relay (guia §4)."
fi

# ---------- 1. requisitos ----------
info "Revisando requisitos..."
requerir_python
ok "estacion/.venv con pyserial"

TOKEN=""
if [ -n "${WEB_INGESTA_TOKEN:-}" ]; then
    TOKEN="$WEB_INGESTA_TOKEN"
    TOKEN_ORIGEN="el entorno (WEB_INGESTA_TOKEN)"
else
    command -v security >/dev/null 2>&1 || die "No existe el comando 'security' (esto es para macOS)." \
        "En otro sistema, exporta WEB_INGESTA_TOKEN antes de correr el script."
    TOKEN="$(security find-generic-password -s "$LLAVERO_SERVICIO" -w 2>/dev/null || true)"
    [ -n "$TOKEN" ] || die "No encontre el token en el Llavero (entrada '$LLAVERO_SERVICIO')." \
        "Pidele el token a Juan Pablo por un gestor de contrasenas y guardalo:" \
        "  security add-generic-password -s $LLAVERO_SERVICIO -a \"\$USER\" -w     (te lo pide sin mostrarlo)" \
        "macOS puede pedir la contrasena del Mac para abrir el Llavero: es normal."
    TOKEN_ORIGEN="el Llavero de macOS"
fi
unset WEB_INGESTA_TOKEN                 # que ni fly ni curl ni los ayudantes lo hereden
[ "${#TOKEN}" -eq "$TOKEN_LARGO" ] || die "El token (origen: $TOKEN_ORIGEN) tiene ${#TOKEN} caracteres y se esperaban $TOKEN_LARGO." \
    "Probablemente esta incompleto o con espacios. No se muestra por seguridad." \
    "Vuelve a guardarlo en el Llavero (ver arriba) o revisa la variable de entorno."
ok "token cargado (origen: $TOKEN_ORIGEN, ${#TOKEN} caracteres)"

if fly_disponible; then
    fly_requisitos
else
    aviso "SIN_FLY=1: se salta todo lo de Fly (relay local)."
fi

# puerto del dashboard
PID_PUERTO="$(lsof -nP -iTCP:"$PUERTO" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
if [ -n "$PID_PUERTO" ]; then
    CMD_PUERTO="$(ps -o command= -p "$PID_PUERTO" 2>/dev/null || true)"
    case "$CMD_PUERTO" in
        *dashboard.py*)
            aviso "El puerto $PUERTO ya lo usa un dashboard viejo (PID $PID_PUERTO):"
            printf '       %s\n' "$CMD_PUERTO" >&2
            aviso "Si esta subiendo una sesion, cierrala con estacion/detener_sesion.sh en vez de esto."
            if preguntar "Cerrar ese dashboard (Ctrl+C elegante)?" n; then
                kill -INT "$PID_PUERTO" 2>/dev/null || true
                for _ in 1 2 3 4 5 6 7 8 9 10; do
                    kill -0 "$PID_PUERTO" 2>/dev/null || break
                    sleep 1
                done
                if kill -0 "$PID_PUERTO" 2>/dev/null; then
                    die "El dashboard viejo (PID $PID_PUERTO) no se cerro en 10 s." "Cierralo a mano (Ctrl+C en su ventana) y repite."
                fi
                ok "dashboard viejo cerrado"
            else
                die "Puerto $PUERTO ocupado: no se toco nada." "Cierra el dashboard viejo (Ctrl+C en su ventana) o usa otro puerto:  $0 --puerto 8766"
            fi
            ;;
        *)
            die "El puerto $PUERTO lo usa otro programa (PID $PID_PUERTO):" "  $CMD_PUERTO" \
                "No es un dashboard, asi que no lo cierro. Usa otro puerto:  $0 --puerto 8766"
            ;;
    esac
fi
ok "puerto $PUERTO libre"

# ---------- 2. la maquina del relay ----------
MAQUINA=""
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
            fly machine start "$MAQUINA" -a "$RELAY_APP" >/dev/null || die "No pude prender la maquina $MAQUINA." \
                "Si dice 'failed to obtain lease' y no hay otro fly corriendo:  fly machine leases clear $MAQUINA -a $RELAY_APP" \
                "y repite este script."
            ;;
        *)
            aviso "Estado de la maquina: '$ESTADO'. Intento esperar la salud igual."
            ;;
    esac
fi

if ! esperar_salud; then
    die "El relay no respondio 'estado: ok' en $ESPERA_SALUD_S s ($RELAY_URL/api/v1/salud)." \
        "Mira:  fly status -a $RELAY_APP   y   fly logs -a $RELAY_APP" \
        "Si hace falta mas tiempo:  ESPERA_SALUD_S=180 $0"
fi
SALUD_INICIAL="$(salud_json)"
ok "el relay responde estado: ok"

if fly_disponible; then
    TRIAL="$(fly_aviso_trial)"
    if [ -n "$TRIAL" ]; then
        cartel "$C_ROJO" "FLY AVISO: 'Trial machine stopping'" \
            "En los logs recientes: $TRIAL" \
            "Una cuenta de prueba apaga la maquina a los 5 minutos. Mira la hora del aviso: si es de ahora," \
            "pon un metodo de pago en Fly o el relay se caera a mitad de la sesion."
    fi
fi

# ---------- 3. resumen de la salud ----------
printf '\n%s\n' "${C_NEGRITA}Salud del relay (${RELAY_URL})${C_FIN}"
HAY_DATOS=0
while read -r m seq mid; do
    printf '  %-8s seq_relay=%-8s mission_id=%s\n' "$m" "$seq" "$mid"
    if [ "$seq" -gt 0 ]; then HAY_DATOS=1; fi
done < <(printf '%s' "$SALUD_INICIAL" | salud_lineas)
if [ "$HAY_DATOS" = 1 ]; then
    cartel "$C_ROJO" "EL RELAY TIENE DATOS DE UNA SESION ANTERIOR (seq_relay > 0)" \
        "La web publica mostrara esos datos mezclados con lo nuevo, y un mission_id" \
        "cerrado no se vuelve a abrir. ANTES DE UN VUELO HAY QUE LIMPIAR (guia §4)." \
        "Este script NO limpia nada. Si esto es un ensayo, ignora este aviso."
else
    ok "relay limpio: seq_relay 0 en las dos misiones"
fi

# ---------- 4. carpeta de la sesion ----------
SESION="$SESIONES_RELAY_DIR/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$SESION"
# El dashboard se lanza con `exec` desde este mismo proceso, asi que su PID sera el de este script ($$).
py -c '
import json, sys, time
(hora, relay_url, app, maq, salud, pid, puerto, ensayo, sin_fly, args) = sys.argv[1:11]
print(json.dumps({
    "hora_inicio": hora,
    "hora_inicio_epoch": int(time.time()),
    "relay_url": relay_url,
    "relay_app": app,
    "maquina_id": maq or None,
    "salud_inicial": json.loads(salud),
    "pid_dashboard": int(pid),
    "puerto_dashboard": int(puerto),
    "ensayo": ensayo == "1",
    "sin_fly": sin_fly == "1",
    "args_dashboard": json.loads(args),
}, indent=2, ensure_ascii=False))
' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$RELAY_URL" "$RELAY_APP" "$MAQUINA" "$SALUD_INICIAL" "$$" "$PUERTO" \
  "$([ "$ES_DEMO" = 1 ] || [ "$ES_REPRODUCIR" = 1 ] && echo 1 || echo 0)" "$SIN_FLY" \
  "$(py -c 'import json,sys; print(json.dumps(sys.argv[1:]))' ${EXTRA[@]+"${EXTRA[@]}"})" > "$SESION/inicio.json"
ok "sesion: ${SESION#"$REPO_DIR"/}  (inicio.json guardado, PID del dashboard $$)"

if [ ! -d "$REPO_DIR/gui/web/dist" ]; then
    aviso "No existe gui/web/dist: las pestanas 'Vuelo' del dashboard no mostraran la web. (Opcional: npm run web:build)"
fi

# ---------- 5. siguientes pasos y dashboard ----------
cat <<EOF

${C_NEGRITA}Siguientes pasos${C_FIN}
  1. En el dashboard (http://127.0.0.1:$PUERTO), barra de arriba: elige el puerto de la estacion
     (/dev/cu.usbserial-... o /dev/cu.wchusbserial...) en "tierra" y pulsa Conectar.
  2. En los eventos debe salir:  web: reenviador CONECTADO
  3. Web publica:  $SITIO_URL/demeter/   y   $SITIO_URL/hermes/
  4. Al terminar: Ctrl+C aqui y luego  estacion/detener_sesion.sh  (guarda todo lo transmitido).

Abriendo el dashboard en primer plano (Ctrl+C para cerrarlo)...
EOF

# El token va solo en el entorno del dashboard: no en la linea de comandos de nadie.
WEB_INGESTA_TOKEN="$TOKEN" exec "$PYTHON_ESTACION" "$ESTACION_DIR/dashboard.py" --web-relay "$RELAY_URL" ${EXTRA[@]+"${EXTRA[@]}"}
