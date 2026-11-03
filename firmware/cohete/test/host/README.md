# test/host: pruebas en el PC de la detección de BOOST (T-410), los actuadores (T-413) y la persistencia en vuelo (T-411)

Corren con `g++` y Python. **No necesitan PlatformIO, ESP32 ni placa.** Compilan el código de vuelo tal cual (`boost_detect.cpp`, `mission.cpp`, `ext_act.cpp` y el `gnd_cmd.cpp` de tierra) y lo alimentan con las simulaciones de OpenRocket y con casos de manipulación.

## Cómo correrlas

```
python3 firmware/cohete/test/host/correr_pruebas.py            # todo, con 30 min de reposo
python3 firmware/cohete/test/host/correr_pruebas.py --reposo-min 2   # más rápido
```

Requisitos: `g++` (probado con 13.3), `python3` y `numpy`. Sale con código 0 si se cumplen todos los criterios. Escribe en `entradas/` (los archivos generados, unos 35 MB con el reposo de 30 min) y en `build/`; los dos están ignorados por git.

## Qué hay

| Archivo | Qué hace |
| --- | --- |
| `correr_pruebas.py` | Genera las entradas, compila y corre todo, e imprime una tabla con OK/FALLA/INFO |
| `prueba_boost.cpp` | Arnés del módulo puro `src/boost_detect.cpp`: lee un archivo binario y reporta las detecciones. Modos `inercial` (3 columnas, pasa por el gancho `boostLsmSample` con cuentas `int16` del LSM) y `baro` (1 columna, a 50 Hz) |
| `prueba_mision.cpp` | Compila el `src/mission.cpp` **real** contra los stubs y corre su tarea con un reloj virtual de 20 ms por paso. Un escenario por proceso: `tierra`, `armado`, `launch_sin_boost`, `baro`, `qmi_con_lsm`, `qmi_sin_lsm` (T-410); de T-413, `buzzer_patron`, `buzzer_aterrizaje`, `buzzer_recovery`, `pi_demeter`, `pi_vuelo`, `pi_hermes`, `sueno` y `protocolo`; y de T-411, `d051` y los de persistencia `a_*` (escriben) y `b_*` (arrancan con lo guardado), que `correr_pruebas.py` encadena (ver abajo). Registra cada `digitalWrite` de IO45 e IO46 con la hora virtual y cuenta los `gpio_hold_*` |
| `prueba_tierra.cpp` | Compila el `firmware/tierra/src/gnd_cmd.cpp` **real**, le escribe líneas por un `Serial` falso y mira el `Cmd` que sale: `<d\|h> buzzer on\|off`, `<d\|h> pi encender`, los errores de formato y el ciclo NO_APTO → `si` con el motivo 21 |
| `stubs/` | Cabeceras mínimas de Arduino/FreeRTOS/ESP32 (también `driver/gpio.h`, `RadioLib.h`, `mbedtls/md.h`, `esp_sleep.h`, `secrets.h` de mentira), solo para compilar en el PC. También sirven para `g++ -fsyntax-only` de `ext_lsm.cpp`, `in_imu.cpp`, `ext_act.cpp`, `core_sleep.cpp`, `net_radio.cpp`, `core_selftest.cpp` y `gnd_cmd.cpp` |

Formato del archivo de entrada: `double fs_hz`, `int32 ncol`, `int32 nfilas` y luego `nfilas × ncol` `float32`.

## Qué prueba

- **Positivas inerciales:** las dos simulaciones de `datos/simulaciones/openrocket/`, convertidas a fuerza específica (`|a|` = aceleración cinemática vertical + 1 g), remuestreadas a 1600 Hz y a 1666,67 Hz (la del LSM real), con ruido σ = 0,01 g por eje, 2 s de reposo antes del despegue y 5 semillas de ruido. Criterio: BOOST en < 0,2 s desde el despegue (se suma el peor caso de 20 ms de la tarea de misión, que lee la bandera a 50 Hz).
- **Negativas inerciales (cero detecciones):** golpe de 10 g y 20 ms; impacto de 20 g y 10 ms (los dos rectangulares, el peor caso); 30 min de reposo con ruido; y el barrido de la sacudida de ±3 g durante 5 s, de 3 a 20 Hz, en el eje vertical (|a| = |1 + 3·sen|) y en uno horizontal (|a| = √(1 + 9·sen²)). Criterio con el decaimiento de dv (D-048).
- **Informativas:** la sacudida de ±3 g a 1 y 2 Hz solo reporta el dv máximo: mueve el cohete más de un metro, es movimiento real.
- **Barométricas:** el perfil de altura de las sims. a 100 Hz (y decimado a 50 Hz, la tasa de la tarea de misión) con ruido de 0,05 m; negativas: 30 min de reposo con deriva de clima, un dato malo de un solo cuadro (+15 m) y un portazo (+12 m, 60 ms).
- **Misión:** el gancho por estado (TIERRA, ARMED, LAUNCH sin BOOST), el `T_MISSION` automático, `s_boosted` (las protecciones en vuelo dejan de ser nulas), el QMI como respaldo y el BOOST barométrico.
- **Actuadores (T-413):** con el patrón de buzzer de 500/1500 ms y el pulso de la Pi de 1500 ms medidos con el reloj virtual (valores escritos a mano en la prueba, no tomados de las constantes); el buzzer automático en RECOVERY y en ATERRIZAJE (sin reiniciar el patrón) y apagado en TIERRA; `pi encender` → NO_APTO con el motivo 21 y, confirmado, el pulso; en FLY con BOOST, además `RZ_EN_VUELO`; en Hermes, `RZ_OP` y IO45 nunca sube; los bits de `actuators`; `extActSleep()` (pines en bajo, `gpio_hold`, nada los reactiva) y las órdenes de texto de tierra.
- **D-051 (T-411):** un op desconocido, un estado, un momento o un buzzer fuera de rango, y `pi encender` en Hermes dan `CR_ERROR` con `RZ_OP`; confirmarlos (con sus mismos motivos) también da `CR_ERROR`, no ejecuta y no levanta `TF_FORZADO`.
- **Persistencia en vuelo (T-411, `maquina_estados.md` §8):** un "reinicio" es otro proceso. La RTC es la sección `rtc_noinit_host` (el stub `stubs/esp_attr.h` define `RTC_NOINIT_ATTR` con ella), que el arnés vuelca a un archivo al terminar y recarga al empezar; la NVS es un mapa espacio/clave → bytes (`stubs/Preferences.h`) que también pasa por un archivo. `correr_pruebas.py` encadena las fases `a_*` → `b_*` con los mismos archivos y las opciones `--sin-rtc` (corte de energía), `--sin-nvs` y `--corromper=rtc|nvs|ambas` (cambia un byte del registro, y el CRC deja de cuadrar). Casos: FLY con BOOST (mismo momento, `p0`, `s_boosted` y UTC del BOOST; registra sin reserva a 10 Hz; `TF_REANUDADO` y el `T_MISSION` con `arg = 3`), FLY con BOOST sin armar y sin hora, FLY forzado, RECOVERY (buzzer, sin registrar, `t_post` no se repite), ARMED y TIERRA (arranque normal, nada escrito), RTC inválida con NVS válida, CRC corrupto, `estado tierra` tras reanudar (invalida) y una NVS con un FLY viejo frente a una RTC con TIERRA (se limpia). También cuenta las escrituras de la NVS (solo en las transiciones) y mantiene el contador de comandos (si no, tierra recibe `RZ_CONTADOR`).
- **Sintaxis:** `g++ -std=gnu++11 -fsyntax-only` de `boost_detect.cpp`, `mission.cpp`, `ext_lsm.cpp`, `in_imu.cpp`, `ext_act.cpp`, `core_sleep.cpp`, `net_radio.cpp`, `core_selftest.cpp` y `tierra/gnd_cmd.cpp` con los stubs.

## Qué NO prueba

- La sincronización entre núcleos en el chip, la tasa real del FIFO ni los tiempos de CPU. Eso va en el banco (P-04) y con el IMU en una mesa.
- La respuesta real del LSM (su filtro pasa-bajas) ni la vibración del motor.
- Los demás momentos (T-412).
- **Que `RTC_NOINIT_ATTR` sobreviva en el chip** a cada tipo de reinicio (`ESP.restart()`, watchdog, brownout, reset por el pin EN o por el USB), ni lo que tarda una escritura a la NVS (frena el flash). Eso va en el banco (P-10).
- **Los pines reales (T-413):** que IO45 e IO46 salgan en bajo, que `gpio_hold_en` los retenga en el sueño profundo y que `gpio_hold_dis` los libere al despertar solo se ve en el chip, con un multímetro u osciloscopio. El PC solo comprueba que el código los pide en el orden correcto. Tampoco corre `net_radio.cpp` (solo se revisa que asigne `p.actuators`).
