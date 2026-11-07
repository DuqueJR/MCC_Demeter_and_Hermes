# Imagen del relay publico (T-642, D-061). El CONTEXTO DE BUILD ES LA RAIZ DEL REPO, porque esquema.json
# vive en gui/web/src/contrato/ y se copia de ahi (una sola fuente; el relay lo valida con jsonschema).
#
#   docker build -f gui/relay/Dockerfile -t relay .          # desde la raiz del repo
#   fly deploy --config gui/relay/fly.toml --dockerfile gui/relay/Dockerfile      # idem, desde la raiz
#
# Que entra a la imagen lo decide el .dockerignore de la raiz (solo el codigo del relay y esquema.json).
ARG PYTHON_VERSION=3.12
FROM python:${PYTHON_VERSION}-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Usuario sin privilegios. /datos es la carpeta de los JSONL (en Fly, el volumen se monta ahi, ver fly.toml).
RUN useradd --system --uid 10001 --user-group --home-dir /app --shell /usr/sbin/nologin relay \
    && mkdir -p /app /datos \
    && chown relay:relay /datos

WORKDIR /app

# Dependencias primero: la capa se reutiliza mientras requirements.txt no cambie.
COPY gui/relay/requirements.txt ./
RUN pip install -r requirements.txt

# El codigo del relay (los .py de gui/relay/, sin pruebas ni herramientas) y el esquema del contrato web-1.
COPY gui/relay/*.py ./
COPY gui/web/src/contrato/esquema.json ./esquema.json
COPY gui/relay/entrypoint.sh ./entrypoint.sh
RUN chmod 0555 /app/entrypoint.sh

ENV WEB_RELAY_ESQUEMA=/app/esquema.json \
    WEB_RELAY_DATOS=/datos \
    # Quien puede poner X-Forwarded-For. Detras del proxy de Fly: "*" (ver docs/08_gui/11_guia_despliegue.md §1.3).
    # Localmente (docker run directo, sin proxy) se puede dejar en 127.0.0.1 para no creerle a nadie.
    FORWARDED_ALLOW_IPS=*

EXPOSE 8080

# El entrypoint arranca como root SOLO para dejar /datos escribible (un volumen de Fly se monta con dueno root),
# y enseguida baja a `relay` (uid 10001) con setpriv: uvicorn nunca corre como root.
ENTRYPOINT ["/app/entrypoint.sh"]
