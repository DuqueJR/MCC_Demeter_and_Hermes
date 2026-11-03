# firmware/

**Nuestro firmware de vuelo y de tierra.** Partió del de Pablo Tilano (`ptilanom/DEMETER`, snapshot `17139b2`) y desde D-045 **este repo es la fuente única**: el repo de Pablo queda como origen histórico. Los archivos se cambian como todo lo demás: una tarea del backlog, **primero el contrato** (las v2 y v3 de `docs/04_diseno/`), una rama `feature/T-xxx-*` desde `develop` y un PR a `develop`, que Pablo revisa junto con Juan Pablo o Jerónimo. Cómo trabaja Pablo desde aquí: [sincronizacion_firmware_pablo](../docs/05_plan/sincronizacion_firmware_pablo.md) §5. El único cambio sobre el snapshot hasta ahora es el parche P1: rutas relativas en los `platformio.ini` y sin `build_cache_dir`.

| Carpeta | Contenido |
| --- | --- |
| `cohete/` | Firmware de vuelo (T-Beam S3 Supreme), un proyecto PlatformIO |
| `tierra/` | Firmware de la estación de tierra (T-Beam V1.x) |
| `common/` | Encabezados compartidos (`net_proto/`) y `lilygo_local.patch` |
| `vendor/Lilygo-LoRa-Series` | Submódulo LilyGO, fijado en `1991b1e` |

## Environments

| Proyecto | Env | Qué es |
| --- | --- | --- |
| `cohete` | `demeter` | Demeter, potencia de banco (10 dBm) |
| `cohete` | `hermes` | Hermes, potencia de banco (10 dBm) |
| `cohete` | `demeter_campo` | Demeter a 22 dBm, para alcance y vuelo |
| `cohete` | `hermes_campo` | Hermes a 22 dBm, para alcance y vuelo |
| `cohete` | `hermes_sinhora` | Prueba: Hermes sin anclar la hora al GNSS. No es para vuelo |
| `tierra` | `tierra` | Estación de tierra, potencia de banco |
| `tierra` | `tierra_campo` | Estación de tierra a 22 dBm |

**Nunca transmitas sin la antena conectada.** En el banco, usa los envs de banco.

## Preparar

```
git submodule update --init firmware/vendor/Lilygo-LoRa-Series
git -C firmware/vendor/Lilygo-LoRa-Series apply ../../common/lilygo_local.patch
cp firmware/common/net_proto/secrets.h.ejemplo firmware/common/net_proto/secrets.h
```

Luego se pone la clave real en `secrets.h` (la misma en las tres placas; la custodia es de Pablo). `secrets.h` está ignorado por git: nunca se versiona. El parche del submódulo queda solo en tu copia de trabajo: no se commitea.

## Compilar y cargar

```
pio run -d firmware/cohete -e demeter -e hermes
pio run -d firmware/tierra -e tierra
pio run -d firmware/cohete -e demeter_campo -t upload --upload-port <puerto>
```

Los `upload_port` y `monitor_port` de los `platformio.ini` son los COM de la máquina de Pablo: usa `--upload-port`.

Herramientas de PC (dashboard, descarga y análisis de logs): [`estacion/`](../estacion/README.md).
