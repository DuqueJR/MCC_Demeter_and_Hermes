"""Criterios 1 a 3: token, inventario de rutas y codigos de la ingesta (04 §4.1, §4.2)."""
import asyncio
import json

import pytest
from fastapi.testclient import TestClient

import servidor
from app import crear_app
from config import Config, ConfigError, desde_entorno
from ayudas import TOKEN, auth, backfill, cfg_prueba, estado, estacion, evento, meta, salud


@pytest.fixture
def app(tmp_path):
    return crear_app(cfg_prueba(tmp_path))


@pytest.fixture
def cli(app):
    return TestClient(app)


def post(cli, mensajes, **cab):
    return cli.post("/api/v1/ingesta", json={"mensajes": mensajes}, headers=cab)


# ---- 1. Token -----------------------------------------------------------------------------------------------------
def test_sin_token_o_con_token_malo_401(cli):
    m = [estado(1000)]
    assert post(cli, m).status_code == 401
    assert post(cli, m, Authorization="Bearer otro-token").status_code == 401
    assert post(cli, m, Authorization="Bearer ").status_code == 401
    assert post(cli, m, Authorization=TOKEN).status_code == 401          # sin el esquema "Bearer"
    assert post(cli, m, Authorization="Basic " + TOKEN).status_code == 401
    assert post(cli, m, Authorization=f"Bearer {TOKEN}x").status_code == 401
    assert post(cli, m, **auth()).status_code == 200


def test_el_401_sale_antes_de_leer_el_cuerpo(app):
    """Llama a la app por ASGI con un `receive` que falla si alguien lo toca: el cuerpo no se lee."""
    leidos = []

    async def receive():
        leidos.append(1)
        return {"type": "http.request", "body": b"{}", "more_body": False}

    async def correr(cabeceras):
        enviados = []

        async def send(m):
            enviados.append(m)

        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "POST", "scheme": "http",
                 "path": "/api/v1/ingesta", "raw_path": b"/api/v1/ingesta", "query_string": b"", "root_path": "",
                 "headers": cabeceras, "client": ("1.2.3.4", 1), "server": ("x", 80)}
        await app(scope, receive, send)
        return enviados[0]["status"]

    assert asyncio.run(correr([(b"content-length", b"2")])) == 401
    assert asyncio.run(correr([(b"content-length", b"2"), (b"authorization", b"Bearer malo")])) == 401
    assert leidos == []


def test_sin_token_configurado_no_arranca(tmp_path, monkeypatch):
    monkeypatch.delenv("WEB_INGESTA_TOKEN", raising=False)
    with pytest.raises(ConfigError):
        desde_entorno({}, ruta_env=tmp_path / "no_existe.env")
    with pytest.raises(ConfigError):
        desde_entorno({"WEB_INGESTA_TOKEN": "   "}, ruta_env=tmp_path / "no_existe.env")
    with pytest.raises(ConfigError):
        Config(token="")
    with pytest.raises(ConfigError):
        crear_app()                                                    # lee el entorno: sin token, nada
    monkeypatch.setattr("config.AQUI", tmp_path)                        # que no lea el .env de gui/relay
    assert servidor.main() == 2


def test_el_token_se_lee_del_entorno_o_del_env(tmp_path):
    env = tmp_path / ".env"
    env.write_text("WEB_INGESTA_TOKEN=del-archivo\nWEB_SSE_MAX_POR_IP=25\n# c\n", encoding="utf-8")
    cfg = desde_entorno({}, ruta_env=env)
    assert cfg.token == "del-archivo" and cfg.sse_max_por_ip == 25
    assert desde_entorno({"WEB_INGESTA_TOKEN": "del-entorno"}, ruta_env=env).token == "del-entorno"   # el entorno gana
    assert "del-archivo" not in repr(cfg)                                                         # el token no sale en logs
    with pytest.raises(ConfigError):
        desde_entorno({"WEB_INGESTA_TOKEN": "x", "WEB_SSE_MAX_POR_IP": "mucho"}, ruta_env=tmp_path / "n")


# ---- 2. Inventario de rutas -----------------------------------------------------------------------------------------
def test_la_unica_ruta_de_escritura_es_la_ingesta(app):
    escritura = {}
    for r in app.routes:
        metodos = getattr(r, "methods", None) or set()
        if metodos - {"GET", "HEAD", "OPTIONS"}:
            escritura[r.path] = metodos
    assert escritura == {"/api/v1/ingesta": {"POST"}}
    rutas = {r.path for r in app.routes}
    assert rutas == {"/api/v1/ingesta", "/api/v1/salud", "/api/v1/{mision}/snapshot", "/api/v1/{mision}/stream"}


def test_sin_documentacion_automatica(cli):
    for ruta in ("/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect"):
        assert cli.get(ruta).status_code == 404, ruta


@pytest.mark.parametrize("ruta", ["/api/v1/demeter/snapshot", "/api/v1/hermes/stream", "/api/v1/salud"])
@pytest.mark.parametrize("metodo", ["post", "put", "delete", "patch"])
def test_las_rutas_publicas_no_aceptan_escritura(cli, ruta, metodo):
    r = cli.request(metodo.upper(), ruta, headers=auth(), content=b"{}")
    assert r.status_code == 405
    assert "GET" in r.headers["allow"]


def test_la_ingesta_no_se_lee_y_otros_metodos_dan_405(cli):
    for metodo in ("get", "put", "delete", "patch"):
        assert getattr(cli, metodo)("/api/v1/ingesta", headers=auth()).status_code == 405


def test_no_hay_ruta_hacia_el_cohete(cli):
    for ruta in ("/api/v1/demeter/comando", "/api/v1/comando", "/api/v1/local/comandos", "/ws"):
        for metodo in (cli.get, cli.post):
            assert metodo(ruta, headers=auth()).status_code in (404, 405), ruta


def test_mision_desconocida_404(cli):
    assert cli.get("/api/v1/atlas/snapshot").status_code == 404
    assert cli.get("/api/v1/atlas/stream").status_code == 404


def test_salud_sin_rutas_ni_token(cli, tmp_path):
    r = cli.get("/api/v1/salud")
    assert r.status_code == 200 and r.json()["estado"] == "ok"
    assert TOKEN not in r.text and str(tmp_path) not in r.text


# ---- 3. Codigos -------------------------------------------------------------------------------------------------------
def test_200_con_conteos(cli):
    r = post(cli, [meta(), estado(1000), salud(5000), estacion(1794150000000), evento("despegue", 100), backfill()],
             **auth())
    assert r.status_code == 200
    assert r.json() == {"aceptados": 6, "descartados": 0}
    assert post(cli, [], **auth()).json() == {"aceptados": 0, "descartados": 0}


def test_un_mensaje_invalido_se_descarta_sin_tirar_el_lote(cli):
    malo_campo = estado(2000)
    malo_campo["datos"]["fase"] = "VUELA"
    sin_campo = estado(3000)
    del sin_campo["datos"]["acc_g"]
    extra = estado(4000)
    extra["datos"]["campo_nuevo"] = 1
    otra_mision = meta("hermes")
    otra_mision["datos"]["mision"] = "demeter"                  # la mision del mensaje no es la del meta
    nodo = meta("demeter")
    nodo["datos"]["nodo"] = 2
    fase_cod = estado(5000)
    fase_cod["datos"]["fase_cod"] = 5
    sin_tipo = {"mision": "demeter", "datos": {}}
    desconocida = {"tipo": "estado", "mision": "atlas", "datos": estado(1)["datos"]}
    mensajes = [estado(1000), malo_campo, sin_campo, extra, otra_mision, nodo, fase_cod, sin_tipo, desconocida,
                "no soy un objeto", 7, None, estado(6000)]
    r = post(cli, mensajes, **auth())
    assert r.status_code == 200
    assert r.json() == {"aceptados": 2, "descartados": 11}
    snap = cli.get("/api/v1/demeter/snapshot").json()
    assert len(snap["serie"]["t_mas_s"]) == 2
    assert snap["estado"]["rx_utc_ms"] == 6000


def test_acepta_un_lote_completo_del_reenviador(cli):
    """REENV_LOTE_MAX (100) mensajes por POST."""
    lote = [estado(1000 + 100 * i, fase="BOOST") for i in range(100)]
    r = post(cli, lote, **auth())
    assert r.status_code == 200 and r.json()["aceptados"] == 100


@pytest.mark.parametrize("cuerpo", [b"", b"{", b"no es json", b'{"mensajes": [1,}', b'\xff\xfe\x00', b'{"mensajes": [NaN]}',
                                    b'{"mensajes": [Infinity]}'])
def test_400_por_json_ilegible(cli, cuerpo):
    r = cli.post("/api/v1/ingesta", content=cuerpo, headers=auth())
    assert r.status_code == 400


@pytest.mark.parametrize("cuerpo", [{}, {"otra": []}, {"mensajes": 5}, {"mensajes": None}, {"mensajes": {"a": 1}},
                                    [], [1, 2], "texto", 5, "null"])
def test_422_por_forma_mala(cli, cuerpo):
    r = cli.post("/api/v1/ingesta", content=json.dumps(cuerpo).encode(), headers=auth())
    assert r.status_code == 422


def test_413_por_tamano(tmp_path):
    cli = TestClient(crear_app(cfg_prueba(tmp_path, cuerpo_max_kb=2)))
    grande = {"mensajes": [estado(1000)]}                           # un estado pesa ~1,1 KB: dos pasan de 2 KB
    grande["mensajes"] += [estado(2000), estado(3000)]
    r = cli.post("/api/v1/ingesta", json=grande, headers=auth())
    assert r.status_code == 413
    # sin Content-Length (chunked): se corta mientras se lee
    def trozos():
        yield json.dumps(grande).encode("utf-8")
    r = cli.post("/api/v1/ingesta", content=trozos(), headers=auth())
    assert r.status_code == 413
    assert cli.get("/api/v1/demeter/snapshot").json()["estado"] is None          # no se aplico nada
    ok = cli.post("/api/v1/ingesta", json={"mensajes": [estado(1000)]}, headers=auth())
    assert ok.status_code == 200


def test_el_413_no_cuenta_como_401(tmp_path):
    cli = TestClient(crear_app(cfg_prueba(tmp_path, cuerpo_max_kb=1)))
    r = cli.post("/api/v1/ingesta", content=b"x" * 5000, headers={"Authorization": "Bearer malo"})
    assert r.status_code == 401                                      # el token se mira primero


def test_lote_repetido_2xx_sin_reprocesar(app, cli):
    relay = app.state.relay
    r1 = post(cli, [estado(1000), estado(2000)], **auth(), **{"X-Lote-Id": "a1b2c3d4-1"})
    assert r1.status_code == 200 and r1.json()["aceptados"] == 2
    seq = relay.misiones["demeter"].seq
    r2 = post(cli, [estado(1000), estado(2000)], **auth(), **{"X-Lote-Id": "a1b2c3d4-1"})
    assert r2.status_code == 200 and r2.json() == r1.json()
    assert relay.misiones["demeter"].seq == seq
    assert relay.contadores["lotes_repetidos"] == 1
    # el mismo contenido con otro id se procesa (y sus mensajes se descartan por repetidos)
    r3 = post(cli, [estado(1000), estado(2000)], **auth(), **{"X-Lote-Id": "a1b2c3d4-2"})
    assert r3.status_code == 200
    assert relay.misiones["demeter"].contadores["descartados_repetidos"] == 2
    # un lote nuevo con el id repetido NO se reprocesa aunque traiga otros mensajes: asi lo dice el contrato
    r4 = post(cli, [estado(9000)], **auth(), **{"X-Lote-Id": "a1b2c3d4-1"})
    assert r4.status_code == 200
    assert cli.get("/api/v1/demeter/snapshot").json()["estado"]["rx_utc_ms"] == 2000


def test_solo_se_recuerdan_los_ultimos_lotes(tmp_path):
    app = crear_app(cfg_prueba(tmp_path, lotes_recordados=2))
    cli = TestClient(app)
    for n in (1, 2, 3):
        post(cli, [estado(1000 * n)], **auth(), **{"X-Lote-Id": f"aaaaaaaa-{n}"})
    assert list(app.state.relay.lotes) == ["aaaaaaaa-2", "aaaaaaaa-3"]
    post(cli, [estado(9000)], **auth(), **{"X-Lote-Id": "aaaaaaaa-1"})       # ya se olvido: se procesa
    assert cli.get("/api/v1/demeter/snapshot").json()["estado"]["rx_utc_ms"] == 9000


def test_un_lote_fallido_no_se_recuerda(app, cli):
    r = cli.post("/api/v1/ingesta", content=b"{", headers={**auth(), "X-Lote-Id": "bbbbbbbb-1"})
    assert r.status_code == 400
    assert "bbbbbbbb-1" not in app.state.relay.lotes
    assert post(cli, [estado(1000)], **auth(), **{"X-Lote-Id": "bbbbbbbb-1"}).json()["aceptados"] == 1


def test_un_error_de_disco_responde_500_y_no_pierde_el_lote(app, cli, monkeypatch):
    relay = app.state.relay
    original = relay.almacenes["demeter"].agregar
    fallos = []

    def roto(lineas):
        if not fallos:
            fallos.append(1)
            relay.almacenes["demeter"]._pendiente.extend(lineas)
            raise OSError("disco lleno")
        return original(lineas)

    monkeypatch.setattr(relay.almacenes["demeter"], "agregar", roto)
    r = post(cli, [estado(1000)], **auth())
    assert r.status_code == 500
    assert "disco" not in r.text and str(relay.cfg.datos_dir) not in r.text
    assert post(cli, [estado(2000)], **auth()).status_code == 200
    lineas = [json.loads(l) for l in (relay.cfg.datos_dir / "demeter.jsonl").read_text().splitlines()]
    assert [l["datos"]["rx_utc_ms"] for l in lineas] == [1000, 2000]         # lo del lote fallido se escribio despues
