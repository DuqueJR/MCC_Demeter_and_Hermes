"""Constantes del relay publico (T-640). Los nombres son los de docs/02_requisitos/constantes.md §9.

(P) = provisional, como en constantes.md. Las del final NO estan en constantes.md: son propias del relay y se
proponen en la bitacora de T-640 ("Propuestas de cambio").
"""

# --- constantes.md §1 -------------------------------------------------------------------------------------------------
SITIO = {"lat": 6.582, "lon": -75.823, "alt_msl_m": 510.0}   # Santa Fe de Antioquia, 510 m s.n.m.

# --- constantes.md §9: web publica -----------------------------------------------------------------------------------
WEB_TASA_TIERRA_HZ = 1            # tasa hacia el publico en BOOT, PREFLIGHT, ARMED y LANDED; en vuelo pasa todo
WEB_SSE_LATIDO_S = 15             # el `: ping` del SSE
WEB_SSE_MAX_POR_IP = 10           # streams abiertos por IP; mas de esto, 429
WEB_SERIE_MAX_PUNTOS = 2000       # (P) tope de puntos de la `serie` del snapshot

# --- constantes.md §9: relay ---------------------------------------------------------------------------------------
RELAY_CUERPO_MAX_KB = 512         # (P) tope del cuerpo de un lote; pasado esto, 413
RELAY_LOTES_RECORDADOS = 1000     # (P) los X-Lote-Id recientes que se recuerdan para no reprocesar
RELAY_REANUDAR_MAX_MENSAJES = 200  # (P) lo maximo que se reenvia con Last-Event-ID
RELAY_REINTENTO_S = 5             # (P) el Retry-After de las respuestas 429 y 503
RELAY_COLA_CLIENTE_MAX = 100      # (P) mensajes en espera por cliente SSE

# --- constantes.md §9: reenviador (el relay debe aceptar al menos esto por lote) ------------------------------------
REENV_LOTE_MAX = 100              # (P)

# --- Propias del relay: NO estan en constantes.md (propuestas en la bitacora de T-640) ------------------------------
RELAY_PUERTO_DEF = 8787           # (P) el puerto al que apunta el proxy de Vite (gui/web/vite.config.ts)
RELAY_HOST_DEF = "127.0.0.1"      # (P) en desarrollo solo la maquina local; en produccion lo fija T-642
RELAY_TASA_TOLERANCIA = 0.1       # (P) fraccion del periodo de tierra: un `estado` que llega hasta este margen antes
#                                   de tocarle sale igual, para que el jitter de 2 Hz no baje la tasa a ~0,67 Hz
RELAY_LOTE_ID_MAX_CHARS = 64      # (P) un X-Lote-Id mas largo se ignora (no se recuerda)

FASES = ("BOOT", "PREFLIGHT", "ARMED", "BOOST", "COAST", "APOGEE", "FREE_FALL", "DESCENT", "LANDED", "ERROR")
FASES_TIERRA = frozenset({"BOOT", "PREFLIGHT", "ARMED", "LANDED"})   # 04 §4.3: se bajan a WEB_TASA_TIERRA_HZ
FASES_EN_VUELO = frozenset({"BOOST", "COAST", "APOGEE", "FREE_FALL", "DESCENT"})   # la `serie` conserva todo aqui
NODO_DE = {"demeter": 1, "hermes": 2}
MISIONES = tuple(NODO_DE)
