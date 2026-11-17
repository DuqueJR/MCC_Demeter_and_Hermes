---
fecha: 2026-10-25
tipo: sesion
ids: [C-02, C-04, T-S02, T-S05, DP-18, DP-19, PA-14, D-022]
autor: Claude (documentador) con Juan Pablo
rama: docs/contratos-h0
---
# Refinamiento de los contratos C-02 y C-04 para H0

## Contexto
Juan Pablo (sesión B) es quien redacta C-02 (interfaces internas del firmware) y C-04 (formato del log y del replay). Los dos se congelan mañana en H0. Los borradores los escribió la sesión de Jerónimo. Se revisaron juntos contra `firmware_vuelo`, `constantes`, `protocolo_paquetes` y `buses_y_pines`. Juan Pablo aprobó todas las propuestas.

## Qué se hizo

**C-02:**
- **DP-18:** `t_radio` arma NAV y STATUS, y `t_house` solo publica la energía. Corrige la contradicción con `firmware_vuelo` §2.
- **§2.1 nueva:** la tabla "campo de NAV y STATUS → fuente → dueño". Tenían dueño sin escribir: `GNSS_FIX`, `boot_count`, `rssi_tierra_dbm`, `ultimo_cmd_seq` y `fw_version`, entre otros.
- **Los dueños de los bits de `calib`:** todos son de B.
- **El QMI8658 según D-022:** en B′ queda deshabilitado, su bit de falla en 0 y los respaldos son solo el BME280 y el magnetómetro de la placa.
- **§8** queda abierto a propósito hasta la sesión de la placa. La alimentación del MMC (PA-14) la pregunta Juan Pablo hoy.

**C-04 (reescrito como borrador v2):**
- **Reglas generales:** tipos, NaN y "sin dato".
- **La cabecera del bloque:** el CRC-32 estándar sobre los bytes 16 a 16383; `bloque_seq` sigue al rotar; solo se escriben bloques completos.
- **El registro:** `len` es el largo del payload; los tipos desconocidos se saltan; el archivo no está ordenado y el decodificador ordena por `t_us`.
- **El formato binario exacto (offsets) de cada tipo:** SESION (197 B), IMU, BARO y MAG en lotes, GNSS_PVT (44 B, con las unidades de UBX), PPS, ESTIMADOR, NAVEGACION, EVENTO, NAV y STATUS emitidos, PAQUETE_RX, PERDIDAS (con los IDs), RESPALDO_LOTE, PI_UART, CASA, **CALIBRACION (nuevo, 0x11)**, VERDAD_MUESTRA y VERDAD_EVENTO (0x20 y 0x21).
- **La tasa recalculada:** ≈ 53 kB/s en vuelo y ≈ 28 kB/s en tierra.
- **DP-19, el ciclo de archivos:**
  - `tierra.bin` registra todo hasta ARM;
  - en ARMED, solo lo lento, más el anillo del pretrigger;
  - en BOOST se abre `vuelo_000.bin`, con el pretrigger;
  - la rotación;
  - la vuelta a `tierra.bin` en LANDED.
- **Más vectores de prueba:** tipo desconocido, rotación y pretrigger.

**Pendientes registrados:**
- DP-18 y DP-19 en `09_decisiones.md`;
- los cambios a `firmware_vuelo` §2 y §6 en `12_cambios…` (se aplican en T-S14).

## Evidencia
- **Offsets verificados a mano:** SESION 197 B, CALIBRACION 61 B, NAVEGACION 53 B, GNSS_PVT 44 B, EVENTO 10 B y CASA 8 B.
- **Límites de los lotes:** IMU n ≤ 20, BARO n ≤ 31, MAG n ≤ 20; el magnetómetro de la placa n ≤ 41.

## Problemas y cómo se resolvieron
- En el árbol de trabajo había cambios sin commit de otra sesión (la revisión de T-610: D-035, D-W17). **No se incluyeron.** Por eso las decisiones de esta sesión van como DP-18 y DP-19, no como D-03x.

## Pendiente / siguiente paso
1. Jerónimo revisa el PR (modo "preguntar": son contratos).
2. Juan Pablo pregunta hoy al equipo de hardware: ¿el MMC5983MA va a DC1 o a A_LDO1? (PA-14)
3. Juan Pablo revisa C-03 y C-05 (de Jerónimo) antes de H0.
4. Mañana: la sesión de la placa (PEN-18, T-S12, T-003) cierra el §8 de C-02 y la opción del QMI8658. En H0 se congelan C-01 a C-05 con `web-1`.
5. Recomendado: lanzar hoy T-002 (PlatformIO), porque el firmware de prueba de T-003 lo necesita mañana en la mañana.

## Documentos afectados
- `docs/05_plan/dos_sesiones/06_contratos/02_interfaces_firmware.md`
- `docs/05_plan/dos_sesiones/06_contratos/04_formato_log_y_replay.md`
- `docs/05_plan/dos_sesiones/09_decisiones.md`
- `docs/05_plan/dos_sesiones/12_cambios_a_aplicar_en_lo_existente.md`
