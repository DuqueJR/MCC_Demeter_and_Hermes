"""Configuracion del relay: lo que sale del entorno (y de `gui/relay/.env`, ignorado por git) y los valores de
`constantes.py`. Las pruebas construyen un `Config` con valores chicos para no esperar.

Variables de entorno (el entorno gana al `.env`):
  WEB_INGESTA_TOKEN     OBLIGATORIA. Sin ella el relay no arranca.
  WEB_RELAY_DATOS       carpeta de los JSONL (por defecto `gui/relay/datos/`, ignorada por git)
  WEB_RELAY_ORIGENES    origenes CORS permitidos, separados por comas
  WEB_RELAY_ESQUEMA     ruta de `esquema.json` (por defecto el de `gui/web/src/contrato/`)
  WEB_SSE_MAX_POR_IP    streams abiertos por IP (por defecto `WEB_SSE_MAX_POR_IP` de constantes.py)
  WEB_RELAY_HOST / WEB_RELAY_PUERTO   donde escucha `servidor.py` (por defecto 127.0.0.1:8787)
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Mapping

import constantes as K

AQUI = Path(__file__).resolve().parent
ESQUEMA_DEF = AQUI.parent / "web" / "src" / "contrato" / "esquema.json"
DATOS_DEF = AQUI / "datos"
# Los origenes de desarrollo de la web (vite dev, vite preview y el servidor de e2e). En produccion los fija T-642.
ORIGENES_DEF = (
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4173", "http://127.0.0.1:4173",
    "http://localhost:5174", "http://127.0.0.1:5174",
)


class ConfigError(Exception):
    """Falta algo imprescindible: el relay no arranca."""


def leer_env(ruta: Path) -> dict[str, str]:
    """Lee un `.env` (CLAVE=VALOR, # comentarios). Sin archivo, {}."""
    salida: dict[str, str] = {}
    try:
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                linea = linea.strip()
                if not linea or linea.startswith("#") or "=" not in linea:
                    continue
                k, v = linea.split("=", 1)
                salida[k.strip()] = v.strip().strip("\"'")
    except OSError:
        pass
    return salida


def _reloj_ms() -> int:
    return int(time.time() * 1000)


@dataclass(frozen=True)
class Config:
    token: str
    datos_dir: Path = DATOS_DEF
    origenes: tuple[str, ...] = ORIGENES_DEF
    esquema: Path = ESQUEMA_DEF
    host: str = K.RELAY_HOST_DEF
    puerto: int = K.RELAY_PUERTO_DEF
    # Valores de constantes.py; las pruebas los achican.
    sse_max_por_ip: int = K.WEB_SSE_MAX_POR_IP
    tasa_tierra_hz: float = K.WEB_TASA_TIERRA_HZ
    latido_s: float = K.WEB_SSE_LATIDO_S
    serie_max_puntos: int = K.WEB_SERIE_MAX_PUNTOS
    cuerpo_max_kb: int = K.RELAY_CUERPO_MAX_KB
    lotes_recordados: int = K.RELAY_LOTES_RECORDADOS
    reanudar_max: int = K.RELAY_REANUDAR_MAX_MENSAJES
    reintento_s: int = K.RELAY_REINTENTO_S
    cola_cliente_max: int = K.RELAY_COLA_CLIENTE_MAX
    fsync: bool = True
    reloj_ms: Callable[[], int] = field(default=_reloj_ms, repr=False)

    def __post_init__(self) -> None:
        validar_token(self.token)

    def __repr__(self) -> str:                       # que el token no salga nunca en un log
        return f"Config(datos_dir={self.datos_dir}, origenes={self.origenes}, host={self.host}, puerto={self.puerto})"


def validar_token(token: str | None) -> str:
    """El mismo criterio del reenviador: no vacio, imprimible y sin espacios."""
    if not token or not token.strip():
        raise ConfigError("falta WEB_INGESTA_TOKEN: el relay no arranca sin token (variable de entorno o gui/relay/.env)")
    if not token.isprintable() or any(c.isspace() for c in token):
        raise ConfigError("WEB_INGESTA_TOKEN no es valido (con espacios o caracteres de control)")
    return token


def desde_entorno(entorno: Mapping[str, str] | None = None, ruta_env: Path | None = None) -> Config:
    env = dict(leer_env(AQUI / ".env" if ruta_env is None else ruta_env))
    env.update(os.environ if entorno is None else entorno)
    token = validar_token((env.get("WEB_INGESTA_TOKEN") or "").strip())
    extra: dict[str, object] = {}
    if env.get("WEB_RELAY_DATOS"):
        extra["datos_dir"] = Path(env["WEB_RELAY_DATOS"])
    if env.get("WEB_RELAY_ORIGENES"):
        extra["origenes"] = tuple(o.strip() for o in env["WEB_RELAY_ORIGENES"].split(",") if o.strip())
    if env.get("WEB_RELAY_ESQUEMA"):
        extra["esquema"] = Path(env["WEB_RELAY_ESQUEMA"])
    if env.get("WEB_RELAY_HOST"):
        extra["host"] = env["WEB_RELAY_HOST"]
    try:
        if env.get("WEB_SSE_MAX_POR_IP"):
            extra["sse_max_por_ip"] = int(env["WEB_SSE_MAX_POR_IP"])
            if extra["sse_max_por_ip"] < 1:  # type: ignore[operator]
                raise ValueError
        if env.get("WEB_RELAY_PUERTO"):
            extra["puerto"] = int(env["WEB_RELAY_PUERTO"])
    except ValueError as e:
        raise ConfigError("WEB_SSE_MAX_POR_IP y WEB_RELAY_PUERTO deben ser enteros positivos") from e
    return Config(token=token, **extra)  # type: ignore[arg-type]
