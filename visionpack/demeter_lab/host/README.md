# Configuración de host para Demeter

Plantillas no secretas de servicios y montajes de misión. Revisar rutas, usuario
y permisos antes de instalar en otra Raspberry Pi.

## Sincronización de cámaras

`systemd/demeter-sync.service` activa multicast en `lo` y enruta
`239.255.255.250/32` por loopback para libcamera `rpi.sync`. No implementa
comunicación con LilyGO ni telemetría.

Instalación en el host validado:

```sh
sudo install -m 0644 systemd/demeter-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now demeter-sync.service
ip route get 239.255.255.250
```

El montaje de RAM observado en `/etc/fstab` es:

```fstab
tmpfs /mnt/ramcam tmpfs defaults,size=3G,uid=1000,gid=1000,mode=0755 0 0
```

No se archiva `/etc/fstab` completo: contiene configuración específica de
particiones. El host de referencia tenía `/mnt/ramcam` montado como `tmpfs`.
No se encontraron servicios activos de misión para telemetría, LilyGO,
transmisión de estado o monitorización continua de recursos.