# Sistema de la Pi de Demeter

| Archivo | Para que |
| --- | --- |
| `demeter-telemetry.service` | `demeter_telemetryd.py` en la UART de la LilyGo (`/dev/ttyAMA0`, pines 8 y 10, 115200) |
| `demeter-mission.service` | `demeter_missiond.py`, que a su vez lanza `eyes_of_demeter/demeter_ingestd.sh` |
| `demeter-camerasync.service` | Ruta multicast por `lo` para sincronizar las dos camaras sin WLAN |
| `instalar.sh` | Copia las tres unidades apuntando a esta carpeta `visionpack/` y las reinicia (`sudo ./instalar.sh`) |
| `chrony-demeter.conf`, `chrony-socket.conf` | Reloj de la Pi en hora de mision: chronyd toma la hora de la LilyGo que mide `demeter-telemetry` con cada pose (refclock SOCK `LILY`). `instalar.sh` instala chrony (reemplaza a systemd-timesyncd) y estos archivos |
| `red.sh` | Respaldo de red: wifis conocidas por prioridad y, si ninguna conecta en 60 s, red propia `eyes-of-demeter` (10.42.0.1); activa la consola en el conector de depuracion (`ttyAMA10`) |

Puertos serie de la Pi 5: `ttyAMA0` = GPIO14/15 (LilyGo, con `dtparam=uart0=on`); `ttyAMA10` = conector de depuracion de 3 pines junto al USB-C (consola de respaldo). `/dev/serial0` apunta a `ttyAMA10`: no usarlo para la LilyGo.

Los datos no van al repo: grabaciones en `/home/admin/demeter_recording`, RAM en `/mnt/ramcam` (tmpfs de 3 GB en `/etc/fstab`).

## La Pi corre desde un clon de MCC

El codigo vive en `~/MCC/visionpack` (clon de este repo); los datos siguen en `~/demeter_recording` y `/mnt/ramcam`.

```bash
cd ~/MCC && git pull                     # trae lo nuevo
sudo visionpack/sistema/instalar.sh      # solo si cambiaron las unidades; si no: sudo systemctl restart demeter-telemetry demeter-mission
```

Si cambian las fuentes de `eyes_of_demeter/src`, recompilar con `eyes_of_demeter/build.sh` (deja los binarios en `eyes_of_demeter/.build`, fuera de git).
Volver al codigo anterior de la carpeta de inicio: `sudo VP=/home/admin ~/MCC/visionpack/sistema/instalar.sh`.
