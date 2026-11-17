#!/bin/sh
# Arranque del relay en el contenedor (T-642). UN SOLO worker: el estado esta en memoria (04 §4.5).
#
# Variables: WEB_INGESTA_TOKEN (obligatoria, va por `fly secrets set`), WEB_RELAY_DATOS (por defecto /datos),
# FORWARDED_ALLOW_IPS (quien puede poner X-Forwarded-For; por defecto "*", ver la guia §1.3) y PUERTO (por defecto 8080).
# Si se le pasan argumentos (`docker run imagen python -V`), ejecuta eso en vez del relay.
set -eu

DATOS="${WEB_RELAY_DATOS:-/datos}"
mkdir -p "$DATOS"

if [ "$#" -eq 0 ]; then
    set -- uvicorn app:crear_app --factory \
        --proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}" \
        --host 0.0.0.0 --port "${PUERTO:-8080}" \
        --workers 1 --no-access-log --timeout-graceful-shutdown 5
fi

# Como root: el volumen de Fly llega con dueno root; se le da al usuario `relay` y se baja de privilegios.
if [ "$(id -u)" = "0" ]; then
    chown -R relay:relay "$DATOS"
    set -- setpriv --reuid=relay --regid=relay --init-groups -- "$@"
fi

exec "$@"
