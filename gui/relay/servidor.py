"""Arranca el relay: `python servidor.py`. Un SOLO proceso de uvicorn (el estado esta en memoria, 04 §4.5).

Sin WEB_INGESTA_TOKEN no arranca. Detras de un proxy (T-642) se arranca con `--proxy-headers` para que el limite por IP
use la IP real: `uvicorn app:crear_app --factory --proxy-headers --forwarded-allow-ips <ip del proxy>`.
"""
import logging
import sys

import uvicorn

from app import crear_app
from config import ConfigError, desde_entorno


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        cfg = desde_entorno()
    except ConfigError as e:
        print(f"relay: no arranca: {e}", file=sys.stderr)
        return 2
    app = crear_app(cfg)
    # workers=1 a proposito: dos procesos tendrian dos estados distintos.
    uvicorn.run(app, host=cfg.host, port=cfg.puerto, workers=1, access_log=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
