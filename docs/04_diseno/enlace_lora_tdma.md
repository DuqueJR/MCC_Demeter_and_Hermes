---
id: enlace_lora_tdma
estado: aprobado-v2. Describe el firmware de Pablo (ptilanom/DEMETER @ 17139b2). Desde D-045 es nuestro contrato: un cambio se hace primero aquí y luego en `firmware/common/net_proto/net_proto.h`.
actualizado: 2026-11-03
depende_de: [protocolo_paquetes, constantes, sincronizacion_firmware_pablo]
decisiones: [D-038]
reemplaza: 99_archivo/diseno_v1/enlace_lora_tdma.md (D-001 a D-004)
---
# Enlace LoRa y TDMA (v2, el de Pablo)

**Cómo leer este documento:**
- Describe **lo que hace el firmware**. Se escribió desde el código importado (`17139b2`). Desde D-045, **primero se cambia este documento** (con una decisión) y después el código. Si se encuentra una diferencia con el código importado, se reporta y se decide cuál se corrige.
- **[Pablo]** = validado en hardware según él · **[código]** = leído del código · (V) = sin verificar.

## 1. Radio (`net_proto.h`)

| Parámetro | Valor | Nota |
| --- | --- | --- |
| Frecuencia | **903,0 MHz** | Con BW 500 ocupa 902,75–903,25 MHz. Según Pablo, otros equipos usan 918–924 MHz. La regulación de la ANE sigue sin verificar (PEN-13) |
| SF / BW / CR | **SF7 / 500 kHz / 4/5** | BW 500 es obligatorio: un TELEM de 64 B tarda 29,5 ms y cabe en la ranura de 40 ms; con BW 250 tardaría 59 ms |
| Sync word / preámbulo | 0xD3 / 8 | |
| CRC LoRa | Activado (`setCRC(2)`) | |
| Límite de corriente | 140 mA | |
| Potencia | `NET_TX_DBM` (cohete) y `GND_TX_DBM` (tierra): **10 dBm en el banco, 22 dBm con los envs `_campo`** | **No vuela un env sin `_campo`.** Va en el checklist |
| Sensibilidad (aprox.) | −117 dBm | La estimación de Pablo, (V) |

## 2. Ranuras

- **25 ranuras de 40 ms por segundo**, alineadas con **UTC**: la ranura 0 empieza en el segundo entero.
- Son 5 grupos de 200 ms con el patrón **T A B A B** (`slotOwner(s)`: `s % 5` = 0 es tierra, 1 y 3 son Demeter, 2 y 4 son Hermes):

| Ranura | Dueño | Uso |
| --- | --- | --- |
| 0 | Tierra | **Baliza** de hora firmada (`Beacon`, 18 B), cada segundo |
| 5, 10, 15, 20 | Tierra | **Comandos** (`Cmd`, 20 B), cuando hay uno pendiente |
| 1 y 13 | Demeter | **Base**: siempre activas (2 Hz) |
| 3, 6, 8, 11, 16, 18, 21, 23 | Demeter | **Extensión**: solo cuando vuela (con las base, 10 Hz) |
| 2 y 14 | Hermes | Base (2 Hz) |
| 4, 7, 9, 12, 17, 19, 22, 24 | Hermes | Extensión (10 Hz en vuelo) |

- **Vuela = `netSetFlying(true)`:** lo pone el estado FLY (y la tecla `f` en el banco).
  - El cohete que no vuela se queda a 2 Hz y escucha las ranuras de tierra.
  - **La comunicación de los cohetes nunca se apaga** (salvo en SLEEP).
- **TX:** la transmisión empieza a **+2 ms** del inicio de la ranura (`TX_OFFSET_US`).
  - `startTransmit` tarda ≈ 6,8 ms, así que se llama antes. Ese adelanto se mide y se ajusta solo.
  - Medido [Pablo]: `tarde_max` ≈ 95 µs y `fin_max` ≈ 31,8 ms (< 40 ms).
- **RX del cohete:** abre la recepción en las ranuras de tierra de −6 ms a +24 ms (`RX_OPEN_US`, `RX_CLOSE_US`). Alcanza para paquetes de tierra de hasta 32 B.
- **Qué manda un cohete en su ranura:** TELEM (64 B), salvo:
  - **CmdResp** (28 B): en las 2 ranuras propias siguientes a un comando;
  - **LogInfo** (54 B): una vez cada 5 s.
  - Tierra cuenta esas ranuras como `perdidos` y luego las descuenta.

## 3. Hora y sincronía (`time_model.h`, `core_bus`)

- **Reloj local:** `esp_timer` en µs, monotónico. El log, la fusión y las marcas de tiempo usan este reloj; **UTC es solo una etiqueta**.
- **Fuentes, en orden** (`TimeModel`, calidad 0–3):
  1. **PPS del GNSS propio** + NAV-PVT. Solo ancla con `tAcc ≤ 1000 ns`.
     - [Pablo]: deriva de esp_timer ≈ −53 ppm, estable; fluctuación de 1–2 µs.
  2. **La baliza firmada de tierra** (ranura 0): un ancla con un error base de 100 µs.
     - [Pablo]: residuo de 150–200 µs; un cohete sin GNSS entra en ranuras en ≈ 1 s.
  3. **Retención:** el error crece 1 ppm/s.
  4. Ninguna.
- **NTP no se usa.** Tierra tiene su propia hora: M8N + PPS en GPIO 37.
- **Umbral para usar ranuras:** si el error estimado es < 2 ms, se usan ranuras. Si es mayor (o no hay hora), viene la **baliza lenta**:
  - el cohete manda TELEM con `utc_ms = 0` cada 1–3 s, en un instante aleatorio, y escucha todo el tiempo a la espera de una baliza;
  - es el equivalente a nuestro ALOHA (D-004).
- **Tierra solo transmite** (baliza y comandos) **con su propia hora del M8N.** Sin ella no hay comandos (M1 de la [revisión](../06_revisiones/revision_firmware_pablo.md)).

## 4. Seguridad

- **La baliza y los comandos van firmados:** HMAC-SHA256 truncado a 8 B (`net_auth.h`), con la clave `NET_KEY` de `common/net_proto/secrets.h`.
  - La clave **no está en el repo**, y debe ser **la misma en las tres placas** (A6 de la revisión).
- **Anti-repetición:**
  - la baliza debe tener un `utc_ms` creciente;
  - el comando, un `counter` creciente, que se guarda en NVS en los dos lados. Si tierra se atrasa, se resincroniza sola con `RZ_CONTADOR`.
- **TELEM, CmdResp y LogInfo no van firmados.** Solo llevan CRC.

## 5. Ocupación del canal (en vuelo, los dos cohetes)

| Emisor | Paquete | Aire | Por segundo |
| --- | --- | --- | --- |
| Tierra | Beacon (18 B) | 12,9 ms | 1 |
| Demeter | TELEM (64 B) | 29,5 ms | 10 |
| Hermes | TELEM (64 B) | 29,5 ms | 10 |
| **Total** | | | **≈ 60 %** del tiempo, en ranuras sin solaparse |

## 6. Medido y pendiente

- [Pablo] **Banco a 10 dBm, los dos cohetes a 10 Hz:** `crc_mal=0`, `ranura_mala=0`, `saltadas=0`. La dispersión de llegada en tierra es de ≤ 100 µs.
- **Pendiente:**
  - **prueba de alcance a 22 dBm** con los cohetes cerrados (P-06, A4 de la revisión);
  - 10 Hz con la hora tomada solo de la baliza;
  - el efecto de la TX a 22 dBm en el MMC y en el hub del LSM de Hermes.
