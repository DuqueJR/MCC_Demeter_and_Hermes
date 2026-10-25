"""Constantes del generador de datos de la web (T-612).

Las secciones 1 a 3 replican, con el MISMO NOMBRE, las constantes de
`docs/02_requisitos/constantes.md` (la fuente única) y los valores del contrato
`docs/08_gui/05_contrato_datos_web.md`. Si un valor cambia, se cambia primero allí.
La sección 4 son parámetros propios del generador: no son constantes del
proyecto, solo describen cómo se fabrican los datos de ejemplo, y todos son
provisionales (P).
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

# --------------------------------------------------------------------------- #
# 1. Proyecto (constantes.md §1 a §4)
# --------------------------------------------------------------------------- #
SITIO_LAT = 6.582  # Santa Fe de Antioquia (SITIO)
SITIO_LON = -75.823
SITIO_ALT_MSL_M = 510.0

NODO_DEMETER = 1
NODO_HERMES = 2

TDMA_CICLO_MS = 100  # D-002: un ciclo cada 100 ms
STATUS_CADA_CICLOS = 10  # protocolo §1: STATUS 1 de cada 10 ciclos, NAV en los otros 9
Q15_ESCALA = 32767  # la precisión del cuaternión en el aire (1/32767)

# Máquina de estados (códigos de `fase`, maquina_estados §1)
FASES = {
    "BOOT": 0,
    "PREFLIGHT": 1,
    "ARMED": 2,
    "BOOST": 3,
    "COAST": 4,
    "APOGEE": 5,
    "FREE_FALL": 6,
    "DESCENT": 7,
    "LANDED": 8,
    "ERROR": 9,
}
APOGEO_VZ_SALIDA_MS = 2.0  # (P) APOGEE -> DESCENT cuando Vz < -2 m/s
ALARMA_DESCENSO_MS = 10.0  # se evalúa solo en DESCENT (PEN-20 propone 11)
GO_HACC_MAX_M = 5.0  # (P)
GO_SV_MIN = 6
BAT_MIN_ARM_PCT = 60  # (P)
SD_MIN_LIBRE_MB = 500
ESTADO_SEC_NO_APLICA = 0xFF
ESTADO_SEC_SIN_RESPUESTA = 0xFE

FECHA_LANZAMIENTO_CAT3 = "2026-11-08"

# --------------------------------------------------------------------------- #
# 2. Web (constantes.md §9)
# --------------------------------------------------------------------------- #
WEB_LATENCIA_MAX_S = 2
WEB_DATO_VIEJO_S = 2  # (P)
WEB_SIN_SENAL_S = 5  # (P)
WEB_SIN_TRANSMISION_MIN = 10  # (P)
WEB_RECONEXION_MAX_S = 15
WEB_TASA_TIERRA_HZ = 1  # el relay baja a 1 Hz en BOOT, PREFLIGHT, ARMED y LANDED
WEB_SSE_LATIDO_S = 15
WEB_SSE_MAX_POR_IP = 10
WEB_SERIE_MAX_PUNTOS = 2000  # (P)

# --------------------------------------------------------------------------- #
# 3. Contrato web-1 (05_contrato_datos_web.md §0)
# --------------------------------------------------------------------------- #
CONTRATO_VERSION = "web-1"
DECIMALES_LATLON = 7
DECIMALES_M = 1
DECIMALES_MS = 2
DECIMALES_G = 3
DECIMALES_GRADOS = 1
DECIMALES_Q = 5  # el contrato no fija los del cuaternión: 1/Q15_ESCALA pide 5
DECIMALES_S = 2  # `t_mas_s`, como en el ejemplo del contrato (11,54)

# --------------------------------------------------------------------------- #
# 4. Parámetros propios del generador (P): no vienen de constantes.md
# --------------------------------------------------------------------------- #
# Física y geodesia (datos físicos, no del proyecto)
GRAVEDAD_ESTANDAR_MS2 = 9.80665  # g0: el acelerómetro se expresa en múltiplos de g0
WGS84_A_M = 6378137.0
WGS84_F = 1.0 / 298.257223563

# Línea de tiempo común de un archivo (todo se alinea a la rejilla de 100 ms)
UTC_INICIO_MS = int(
    datetime.fromisoformat(FECHA_LANZAMIENTO_CAT3 + "T15:00:00")
    .replace(tzinfo=timezone.utc)
    .timestamp()
    * 1000
)  # el archivo empieza el día del lanzamiento a las 10:00 hora local (15:00 UTC)
ARRANQUE_COHETE_MS = 1_200_000  # el reloj del cohete (t_ms) lleva 20 min desde el arranque
FIX_GNSS_S = 3.0  # el GNSS engancha 3 s después del inicio
HORA_VALIDA_S = 2.0  # la hora y el TDMA quedan válidos
PI_ENCENDIDA_S = 1.0  # Deméter: pulso de encendido enviado
PI_LISTA_S = 4.0  # Deméter: la Pi pasa a READY
ARM_S = 8.0  # el operador arma 8 s después del inicio
ARMADO_S = 10.0  # tiempo en ARMED hasta que se enciende el motor
POST_ATERRIZAJE_S = 30.0  # tiempo en LANDED al final del archivo
ESPERA_RAMPA_S = 1800.0  # 30 min en PREFLIGHT (escenario espera_rampa)
FASE_TIERRA_CICLO = 5  # en tierra el estado va 1 Hz, en el ciclo 5 de cada 10
LATIDO_CICLO = 7  # el latido de la estación va 1 Hz, en el ciclo 7 de cada 10
LATIDO_DESFASE_MS = 40  # dentro del ciclo
RX_RETRASO_MS = 15  # del instante del cohete a la recepción en la estación
RELAY_RETRASO_MS = 50  # de la recepción a la emisión del relay
SEMILLA = 612  # semilla del ruido determinista de los enlaces y las pérdidas

# Estación terrena (desfase en ENU respecto a la rampa)
ESTACION_ESTE_M = 200.0
ESTACION_NORTE_M = -150.0
ESTACION_ALT_MSL_M = SITIO_ALT_MSL_M + 1.5

# Enlace (pérdida en espacio libre, simplificada y SIMULADA)
RSSI_REF_DBM = -60.0  # a RSSI_DIST_REF_M
RSSI_DIST_REF_M = 100.0
RSSI_RUIDO_DB = 1.5
SNR_PISO_DBM = -111.0  # piso de ruido aproximado de LoRa SF6/BW500
SNR_MAX_DB = 10.0
RSSI_UPLINK_DESFASE_DB = -3.0

# Batería, SD, temperaturas, GNSS
BAT_INICIAL_PCT = 87.0
BAT_DESCARGA_PCT_H_DEMETER = 20.0  # la Pi consume
BAT_DESCARGA_PCT_H_HERMES = 8.0
BAT_MV_BASE = 3300.0
BAT_MV_POR_PCT = 7.8
SD_LIBRE_INICIAL_MB = 28100.0
SD_MB_S_TIERRA = 0.005
SD_MB_S_VUELO = 0.055
TEMP_ESP_INICIAL_C = 35.0
TEMP_ESP_SUBE_C_MIN = 0.5
TEMP_ESP_MAX_C = 48.0
TEMP_PI_SOBRE_ESP_C = 12.0
GNSS_HACC_INICIAL_M = 3.8
GNSS_HACC_FINAL_M = 1.8
GNSS_HACC_TAU_S = 20.0
GNSS_SV_INICIAL = 8
GNSS_SV_FINAL = 11
GNSS_SV_PASO_S = 10.0

# Cálculos de tierra SIMULADOS (05 §2.2 `calc`; los reales son de T-S08)
ELIPSE_MIN_M = 10.0
ELIPSE_FRAC_DERIVA = 0.15
ELIPSE_RELACION_EJES = 0.5

# Hermes sintético (PEN-W04): la forma de Deméter escalada al motor G80-7T
G80_RETARDO_S = 7.0  # el "7" de G80-7T
HERMES_ESCALA_ALTURA = 0.75  # el apogeo de Hermes es 0,75 el de Deméter (~502 m)

# Escenarios
DESCENSO_RAPIDO_FACTOR = 1.6  # el paracaídas "falla": se desciende 1,6 veces más rápido
LKP_CORTE_ALT_M = 120.0  # `lkp_descenso`: se corta la señal a 120 m
LKP_DEBILITAMIENTO_S = 3.0  # el RSSI cae durante los 3 s previos al corte
LKP_RSSI_CORTE_DBM = -118.0
LKP_PERDIDA_MAX_FRAC = 0.6  # pérdida de NAV justo antes del corte
BACKFILL_PERDIDA_FRAC = 0.25  # fracción de los NAV que se pierden en vuelo
BACKFILL_REG_POR_S = 8  # protocolo §1: BACKFILL en 8 de cada 10 ciclos
BACKFILL_INICIO_S = 5.0  # el operador lo pide 5 s después de aterrizar
RELAY_CAIDO_INICIO_S = 20.0  # `relay_caido`: desde T+20 s ...
RELAY_CAIDO_DURACION_S = 20.0  # ... y durante 20 s no sale nada del relay

# Rutas (con pathlib, sin separadores a mano)
RAIZ_REPO = Path(__file__).resolve().parents[2]
CSV_DEMETER = (
    RAIZ_REPO
    / "datos"
    / "simulaciones"
    / "openrocket"
    / "demeter_H135W-8_santa-fe-antioquia_sim2.csv"
)
SALIDA_POR_DEFECTO = RAIZ_REPO / "gui" / "web" / "dev" / "datos"

MISIONES = ("demeter", "hermes")
ESCENARIOS = (
    "nominal",
    "lkp_descenso",
    "descenso_rapido",
    "backfill",
    "espera_rampa",
    "relay_caido",
)

# Textos del StatusCode de la Pi (códigos de visionpack/demeter_protocol.py)
PI_BOOT = 0x00
PI_PREFLIGHT = 0x01
PI_READY = 0x02
PI_ARMED = 0x03
PI_ASCENT = 0x08
PI_RECORDING = 0x30
STATUS_PI_TEXTO = {
    PI_BOOT: "Arrancando",
    PI_PREFLIGHT: "Preparando",
    PI_READY: "Lista",
    PI_ARMED: "Armada",
    0x04: "Iniciando",
    PI_ASCENT: "Grabando el ascenso",
    PI_RECORDING: "Grabando el descenso",
    0x05: "Guardando",
    0x06: "Procesando",
    0x07: "Completa",
    0xE0: "Abortada",
    0xE1: "SD llena",
    0xE2: "Tasa reducida",
    0xE3: "Telemetría perdida",
    0xE4: "Aborto pedido",
    0xE5: "Reloj sin sincronizar",
    0xEF: "Error de proceso",
    ESTADO_SEC_SIN_RESPUESTA: "Sin respuesta",
}
