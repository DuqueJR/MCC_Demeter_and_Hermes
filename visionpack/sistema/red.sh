#!/bin/bash
# Acceso de respaldo a la Pi de Demeter (NetworkManager, Raspberry Pi OS Bookworm).
# 1) Lista de wifis conocidas con prioridad.  2) Si ninguna red conecta, la Pi levanta su propia red.
# Uso (en la Pi):  sudo ./setup_red.sh            -> instala el respaldo y pregunta por las wifis
#                  sudo ./setup_red.sh agregar    -> solo agrega otra wifi a la lista
# Las claves se escriben al correrlo; no quedan en este archivo.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "correr con sudo"; exit 1; }

AP_CON=demeter-ap
AP_SSID=eyes-of-demeter
ESPERA_S=60        # tras el arranque, cuanto esperar una red conocida antes de levantar la propia
REVISA_MIN=5       # en modo propio, cada cuanto se suelta para buscar otra vez las redes conocidas

agregar_wifi() {
    while true; do
        read -rp "SSID (vacio para terminar): " ssid
        [ -z "$ssid" ] && break
        read -rsp "clave de $ssid: " clave; echo
        read -rp "prioridad (mayor gana; casa 30, hotspot 20, campo 10): " prio
        nmcli con delete "wifi-$ssid" >/dev/null 2>&1 || true
        nmcli con add type wifi con-name "wifi-$ssid" ifname wlan0 ssid "$ssid" \
            wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$clave" \
            connection.autoconnect yes connection.autoconnect-priority "${prio:-10}" >/dev/null
        echo "  agregada wifi-$ssid (prioridad ${prio:-10})"
    done
}

if [ "${1:-}" = agregar ]; then agregar_wifi; exit 0; fi

echo "== wifis conocidas"
nmcli -f NAME,TYPE,AUTOCONNECT,AUTOCONNECT-PRIORITY con show | grep -E 'wifi|NAME' || true
agregar_wifi

echo "== red propia ($AP_SSID)"
read -rsp "clave de la red propia (minimo 8 caracteres): " apclave; echo
nmcli con delete "$AP_CON" >/dev/null 2>&1 || true
nmcli con add type wifi con-name "$AP_CON" ifname wlan0 ssid "$AP_SSID" mode ap \
    802-11-wireless.band bg wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$apclave" \
    ipv4.method shared ipv4.addresses 10.42.0.1/24 ipv6.method disabled \
    connection.autoconnect no >/dev/null

cat > /usr/local/sbin/demeter-red <<EOF
#!/bin/bash
# Si no hay red (wifi conocida o cable), levanta $AP_SSID. En modo propio y sin nadie conectado, cada $REVISA_MIN min la suelta y busca otra vez.
conectado() { nmcli -t -f TYPE,STATE dev | grep -qE '^(wifi|ethernet):connected\$' && ! nmcli -t -f NAME con show --active | grep -qx "$AP_CON"; }
propia()    { nmcli -t -f NAME con show --active | grep -qx "$AP_CON"; }
sleep $ESPERA_S
while true; do
    if propia; then
        if [ -z "\$(ip neigh show dev wlan0 2>/dev/null | grep -vE 'FAILED|INCOMPLETE')" ]; then
            logger -t demeter-red "sin clientes en $AP_SSID: busco redes conocidas"
            nmcli con down "$AP_CON" >/dev/null 2>&1
            sleep 40
            conectado || { logger -t demeter-red "ninguna: vuelvo a $AP_SSID"; nmcli con up "$AP_CON" >/dev/null 2>&1; }
        fi
        sleep \$(( $REVISA_MIN * 60 ))
    elif conectado; then
        sleep 30
    else
        logger -t demeter-red "sin red conocida: levanto $AP_SSID (10.42.0.1)"
        nmcli con up "$AP_CON" >/dev/null 2>&1 || logger -t demeter-red "no pude levantar $AP_SSID"
        sleep 30
    fi
done
EOF
chmod 755 /usr/local/sbin/demeter-red

cat > /etc/systemd/system/demeter-red.service <<EOF
[Unit]
Description=Respaldo de red de la Pi de Demeter: wifis conocidas y luego red propia $AP_SSID
After=NetworkManager.service
Wants=NetworkManager.service

[Service]
ExecStart=/usr/local/sbin/demeter-red
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now demeter-red.service
systemctl enable --now ssh >/dev/null 2>&1 || true

# Ultimo recurso: consola por el conector UART de depuracion (ttyAMA10, junto al USB-C; 115200, 3.3 V).
# La LilyGo va por los pines 8/10 (ttyAMA0, dtparam=uart0=on), que quedan libres de mensajes del sistema.
CMD=/boot/firmware/cmdline.txt
if ! grep -q 'console=ttyAMA10' "$CMD"; then
    cp "$CMD" "$CMD.antes_consola"
    sed -i '1 s/^/console=ttyAMA10,115200 /' "$CMD"
    echo "consola serial en ttyAMA10 activada desde el proximo arranque (copia en $CMD.antes_consola)"
fi
sync

echo
echo "listo. Si no hay red conocida en $ESPERA_S s: conectar el laptop a $AP_SSID y entrar con  ssh $(logname 2>/dev/null || echo admin)@10.42.0.1"
echo "registro:  journalctl -t demeter-red -f"
