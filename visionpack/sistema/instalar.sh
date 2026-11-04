#!/bin/bash
# Instala los servicios de la Pi de Demeter apuntando a la carpeta visionpack desde la que se corre.
# Uso:  sudo ./instalar.sh            (desde visionpack/sistema)
#       sudo VP=/home/admin ./instalar.sh   (otra carpeta de codigo)
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "correr con sudo"; exit 1; }
AQUI=$(cd "$(dirname "$0")" && pwd)
VP=${VP:-$(dirname "$AQUI")}
[ -f "$VP/demeter_telemetryd.py" ] && [ -f "$VP/demeter_missiond.py" ] || { echo "no encuentro los daemons en $VP"; exit 1; }
for u in demeter-telemetry demeter-mission demeter-camerasync; do
    [ -f /etc/systemd/system/$u.service ] && cp /etc/systemd/system/$u.service /etc/systemd/system/$u.service.antes
    sed "s|@VP@|$VP|g" "$AQUI/$u.service" > /etc/systemd/system/$u.service
done
grep -q '/mnt/ramcam' /etc/fstab || echo "AVISO: falta en /etc/fstab: tmpfs  /mnt/ramcam  tmpfs  defaults,size=3G,uid=1000,gid=1000,mode=0755  0  0"
grep -q '^dtparam=uart0=on' /boot/firmware/config.txt || echo "AVISO: falta dtparam=uart0=on en /boot/firmware/config.txt (UART de la LilyGo en los pines 8/10)"
# Reloj de mision con chrony (reemplaza a systemd-timesyncd)
if ! command -v chronyd >/dev/null; then
    echo "instalando chrony..."
    apt-get install -y chrony
fi
install -m 0644 "$AQUI/chrony-demeter.conf" /etc/chrony/conf.d/demeter.conf
install -d /etc/systemd/system/chrony.service.d
install -m 0644 "$AQUI/chrony-socket.conf" /etc/systemd/system/chrony.service.d/demeter.conf
systemctl daemon-reload
systemctl enable chrony >/dev/null 2>&1 || true
systemctl restart chrony
systemctl enable demeter-telemetry demeter-mission demeter-camerasync
systemctl restart demeter-camerasync demeter-telemetry demeter-mission
sleep 2
systemctl --no-pager --lines=0 status chrony demeter-telemetry demeter-mission | grep -E '●|Active'
ls -l /run/chrony.demeter.sock || echo "AVISO: chrony no creo su socket"
chronyc sources
echo "codigo desde: $VP   (las versiones anteriores quedan como .service.antes)"
