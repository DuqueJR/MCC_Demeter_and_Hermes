# 2026-11-07 · Armado estable y BOOST sin armar con interruptor (D-063)

Pedido de Pablo:
- la fila "Para armar" del dashboard no dice de qué habla;
- la verificación de barómetros interrumpe el armado y no es estable;
- hay que desactivar el BOOST sin armar, o poder hacerlo con un botón.

## Qué pasaba

- **"Para armar"** estaba en el bloque de temperatura del suelo. Era la revisión de la muestra de temperatura que usa la altura barométrica (D-058), no una revisión general del armado.
- **Por qué fallaba el armado:**
  - Esa revisión sumaba dos comparaciones con las lecturas de ese momento:
    - el BMP más de 6 °C lejos de la muestra;
    - el BMP contra el BME más de 4 °C.
  - Con el cohete calentándose (electrónica, radio, la Pi, el sol), las dos suben y bajan alrededor de su umbral.
  - El "sí" exigía que los motivos fueran **exactamente** los del pedido. Si uno aparecía o desaparecía en esos 10 s, el cohete rechazaba la confirmación y el armado no se completaba.
  - Lo mismo podía pasar con "altura aumentando/disminuyendo", que sale del barómetro.

## Qué cambió

- **Firmware del cohete** (`mission.cpp`, `amb_calc.h`):
  - Al armar, la temperatura pide confirmar (`RZ_TEMP`) solo por lo que es de la muestra guardada: sin muestra, dudosa o vieja (`AB_BLOQUEA`). Las dos comparaciones en vivo quedan como avisos.
  - El "sí" vale si los motivos de ahora son los confirmados o menos. Solo un motivo nuevo obliga a preguntar otra vez.
  - Nuevo comando `OP_BOOST_TIERRA` (16), con arg 1 o 0. Activa o desactiva la detección de BOOST en TIERRA:
    - se guarda en la NVS (`tbmis/bsa`) y por defecto queda activa, como antes;
    - se ve en `TF_BOOST_TIERRA_OFF` (bit 5 de `flags`);
    - en ARMED el BOOST se detecta igual.
- **Firmware de tierra** (`gnd_cmd.cpp`): la orden `d|h boosttierra on|off`.
- **Dashboard:**
  - La fila "Para armar" pasa a "Muestra de temperatura al armar", con dos valores: "lista, no pide confirmar" o "pedirá confirmar: …".
  - Los avisos van en una fila aparte, "Aviso (no frena el armado)".
  - El historial anota solo los cambios de lo que pide confirmar, no los avisos que oscilan.
  - En Mando, por cohete: "BOOST sin armar: ACTIVADO/DESACTIVADO", con los botones Activar y Desactivar. El historial anota el cambio.
- **Contratos:** `protocolo_paquetes.md` (op 16, bit 5 de `flags`, nota del byte `arm` de `AMB`), `maquina_estados.md` (la confirmación y la orden) y D-063 en `decisiones.md`.

## Pruebas

- **En el PC** (`correr_pruebas.py`): todos los criterios se cumplen. Las tres pruebas nuevas de `prueba_mision`:
  - `boost_tierra_off`: con la detección desactivada, 7 g en TIERRA no cambian nada. Queda el bit 32 en `flags` y `tbmis/bsa = 0`; un arg 2 da ERROR. Al activarla otra vez, el BOOST sin armar vuelve a pasar a FLY.
  - `boost_tierra_off_armado`: con la detección desactivada, el BOOST armado pasa a FLY igual.
  - `confirma_menos`:
    - con la deriva del BMP presente, ARM pide confirmar solo por `RZ_TEMP`;
    - si ese motivo desaparece antes del "sí", se arma;
    - si aparece uno nuevo (LSM caído), vuelve a preguntar.
- `prueba_amb` comprueba que la máscara `AB_BLOQUEA` deja fuera los dos avisos.
- **Dashboard en modo demo:** `h boosttierra off` cambia la fila a DESACTIVADO y anota el cambio en el historial.
- **En la placa:** falta. Hay que cargar el cohete **y la estación de tierra**, porque tierra necesita la orden nueva. Luego:
  - armar con el cohete tibio;
  - probar Desactivar y Activar;
  - reiniciar y comprobar que el ajuste se conserva.

## Para el lanzamiento

Con el interruptor, decidir en la rampa si el BOOST sin armar queda activo. Si queda activo y el cohete despega sin armar, igual registra y prende el buzzer y la Pi. Si queda desactivado, un despegue sin armar no registra nada.
