"""Criterios 7 y 9: el snapshot (04 §4.2) y la reconstruccion tras un reinicio (04 §4.5)."""
import json

import pytest
from fastapi.testclient import TestClient

from app import crear_app
from validacion import Validador
from ayudas import DATOS_DEV, RAIZ, auth, backfill, cfg_prueba, estado, estacion, evento, meta, salud

ESQUEMA = Validador(RAIZ / "web" / "src" / "contrato" / "esquema.json")


def cargar(nombre: str, mision: str) -> list[dict]:
    return [{"tipo": o["evento"], "mision": mision, "datos": o["datos"]}
            for o in map(json.loads, (DATOS_DEV / nombre).read_text(encoding="utf-8").splitlines())]


def subir(cli, mensajes, lote=100):
    for i in range(0, len(mensajes), lote):
        r = cli.post("/api/v1/ingesta", json={"mensajes": mensajes[i:i + lote]}, headers=auth())
        assert r.status_code == 200, r.text


# ---- 9. Sin datos y validez ----------------------------------------------------------------------------------------
@pytest.mark.parametrize("mision,nodo", [("demeter", 1), ("hermes", 2)])
def test_sin_datos_el_snapshot_es_200_y_valido(tmp_path, mision, nodo):
    cli = TestClient(crear_app(cfg_prueba(tmp_path)))
    r = cli.get(f"/api/v1/{mision}/snapshot")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    s = r.json()
    assert ESQUEMA.errores_snapshot(s) == []
    assert s["meta"] == {"contrato_version": "web-1", "mision": mision, "nodo": nodo, "modo": "vivo",
                         "mission_id": None, "proto_version": 4,
                         "sitio": {"lat": 6.582, "lon": -75.823, "alt_msl_m": 510.0}}
    assert (s["estado"], s["salud"], s["estacion"], s["backfill"], s["vuelo_completo_url"]) == (None,) * 5
    assert s["eventos"] == []
    assert s["serie"] == {k: [] for k in ("t_mas_s", "lat", "lon", "alt_agl_m", "vz_ms", "acc_x_g", "acc_y_g", "acc_z_g")}


@pytest.mark.parametrize("archivo", sorted(p.name for p in DATOS_DEV.glob("*.jsonl")))
def test_todo_snapshot_generado_valida_contra_el_esquema(tmp_path, archivo):
    """Cada escenario de gui/web/dev/datos/ se sube completo; el snapshot final y los intermedios validan."""
    mision = archivo.split("_")[0]
    cli = TestClient(crear_app(cfg_prueba(tmp_path)))
    mensajes = cargar(archivo, mision)
    for i in range(0, len(mensajes), 150):
        subir(cli, mensajes[i:i + 150])
        s = cli.get(f"/api/v1/{mision}/snapshot").json()
        assert ESQUEMA.errores_snapshot(s) == [], (archivo, i)
    assert len(s["serie"]["t_mas_s"]) <= 2000


def test_el_snapshot_es_el_del_repetidor(tmp_path):
    """Con un vuelo completo, el snapshot tiene el ultimo `estado` por rx, los eventos y la serie en columnas."""
    cli = TestClient(crear_app(cfg_prueba(tmp_path)))
    mensajes = cargar("demeter_nominal.jsonl", "demeter")
    subir(cli, mensajes)
    s = cli.get("/api/v1/demeter/snapshot").json()
    estados = [m["datos"] for m in mensajes if m["tipo"] == "estado"]
    assert s["estado"]["rx_utc_ms"] == max(d["rx_utc_ms"] for d in estados)
    assert s["estado"]["relay_utc_ms"] is not None and s["estado"]["relay_utc_ms"] != estados[-1]["relay_utc_ms"]
    eventos = [m["datos"] for m in mensajes if m["tipo"] == "evento"]
    assert len(s["eventos"]) == len({(e["tipo"], e["t_ms"], e["fase"], e["activa"]) for e in eventos})
    assert [e["t_ms"] for e in s["eventos"]] == sorted(e["t_ms"] for e in eventos)
    assert s["meta"] == [m["datos"] for m in mensajes if m["tipo"] == "meta"][-1]
    assert len(s["serie"]["t_mas_s"]) == len(estados)


def test_el_snapshot_se_regenera_con_cada_mensaje_nuevo(tmp_path):
    cli = TestClient(crear_app(cfg_prueba(tmp_path)))
    subir(cli, [estado(1000)])
    a = cli.get("/api/v1/demeter/snapshot").content
    assert cli.get("/api/v1/demeter/snapshot").content == a
    subir(cli, [estado(2000)])
    assert cli.get("/api/v1/demeter/snapshot").content != a


# ---- 7. Reinicio -------------------------------------------------------------------------------------------------------
def vuelo_de_prueba():
    m = [meta(mission_id=77)]
    m += [estado(1_000_000 + 1000 * i, fase="PREFLIGHT") for i in range(8)]       # algunos bajados de tasa
    m += [estado(1_010_000 + 100 * i, fase="BOOST") for i in range(10)]
    m += [evento("despegue", 1_010_000), salud(10), estacion(1794150000000), backfill(3)]
    m += [estado(1_010_050, fase="BOOST")]                                         # atrasado: solo a la serie
    return m


def test_reinicio_reconstruye_el_estado_y_seq_no_se_repite(tmp_path):
    cfg = cfg_prueba(tmp_path)
    app1 = crear_app(cfg)
    cli = TestClient(app1)
    subir(cli, vuelo_de_prueba())
    antes = cli.get("/api/v1/demeter/snapshot").content
    seq1 = app1.state.relay.misiones["demeter"].seq
    em1 = [e.seq for e in app1.state.relay.misiones["demeter"].reanudar]
    app1.state.relay.cerrar()

    app2 = crear_app(cfg)                                                           # el relay reinicia
    cli2 = TestClient(app2)
    est2 = app2.state.relay.misiones["demeter"]
    assert cli2.get("/api/v1/demeter/snapshot").content == antes                    # mismo snapshot, byte a byte
    assert est2.seq == seq1
    assert [e.seq for e in est2.reanudar] == em1                                    # y Last-Event-ID sigue sirviendo
    subir(cli2, [estado(1_011_000, fase="BOOST"), salud(11)])
    assert est2.seq == seq1 + 2                                                     # sigue creciendo, sin repetirse
    # los atrasados y repetidos siguen descartandose despues de reiniciar
    subir(cli2, [estado(1_010_050, fase="BOOST"), salud(10)])
    assert est2.seq == seq1 + 2


def test_reinicio_varias_veces_nunca_retrocede_seq(tmp_path):
    cfg = cfg_prueba(tmp_path)
    vistos: list[int] = []
    rx = 1_000_000
    for ronda in range(4):
        app = crear_app(cfg)
        cli = TestClient(app)
        est = app.state.relay.misiones["demeter"]
        antes = est.seq
        assert antes == (vistos[-1] if vistos else 0)
        lote = [estado(rx + 100 * i, fase="BOOST") for i in range(5)] + [salud(ronda * 10 + 1)]
        rx += 1000
        subir(cli, lote)
        vistos.append(est.seq)
        app.state.relay.cerrar()
    assert vistos == sorted(set(vistos)) and vistos[-1] == 24


def test_tolera_una_ultima_linea_cortada(tmp_path):
    cfg = cfg_prueba(tmp_path)
    app1 = crear_app(cfg)
    subir(TestClient(app1), vuelo_de_prueba())
    est1 = app1.state.relay.misiones["demeter"]
    seq1, n1 = est1.seq, len(est1.serie()["lat"])
    app1.state.relay.cerrar()
    ruta = cfg.datos_dir / "demeter.jsonl"
    with open(ruta, "ab") as f:
        f.write(b'{"s":9999,"tipo":"estado","datos":{"seq":1,"t_ms"')              # el proceso murio a media escritura

    app2 = crear_app(cfg)                                                           # arranca igual
    est2 = app2.state.relay.misiones["demeter"]
    assert est2.seq == seq1 and len(est2.serie()["lat"]) == n1
    assert ruta.read_bytes().endswith(b"\n")                                        # recortada: lo siguiente no se pega
    subir(TestClient(app2), [estado(1_020_000, fase="BOOST")])
    app2.state.relay.cerrar()

    app3 = crear_app(cfg)                                                           # y la linea nueva se leyo bien
    est3 = app3.state.relay.misiones["demeter"]
    assert est3.seq == seq1 + 1 and len(est3.serie()["lat"]) == n1 + 1
    assert est3.estado["rx_utc_ms"] == 1_020_000
    for l in ruta.read_text(encoding="utf-8").splitlines():
        json.loads(l)                                                               # todas las lineas son JSON completo


def test_una_linea_mala_en_el_medio_no_impide_arrancar(tmp_path):
    cfg = cfg_prueba(tmp_path)
    app1 = crear_app(cfg)
    subir(TestClient(app1), [estado(1000, fase="BOOST"), estado(1100, fase="BOOST")])
    app1.state.relay.cerrar()
    ruta = cfg.datos_dir / "demeter.jsonl"
    lineas = ruta.read_bytes().split(b"\n")
    ruta.write_bytes(lineas[0] + b"\nesto no es json\n" + lineas[1] + b"\n")
    est = crear_app(cfg).state.relay.misiones["demeter"]
    assert len(est.serie()["lat"]) == 2 and est.seq == 2


def test_sin_archivo_arranca_vacio_y_crea_la_carpeta(tmp_path):
    cfg = cfg_prueba(tmp_path / "nueva" / "carpeta")
    app = crear_app(cfg)
    assert cfg.datos_dir.is_dir()
    assert app.state.relay.misiones["hermes"].seq == 0


def test_cada_mensaje_se_escribe_antes_de_responder(tmp_path):
    cfg = cfg_prueba(tmp_path)
    cli = TestClient(crear_app(cfg))
    r = cli.post("/api/v1/ingesta", json={"mensajes": [estado(1000, mision="hermes"), estado(2000)]}, headers=auth())
    assert r.status_code == 200
    # ya en disco al llegar la respuesta, sin cerrar nada
    assert len((cfg.datos_dir / "hermes.jsonl").read_text().splitlines()) == 1
    assert len((cfg.datos_dir / "demeter.jsonl").read_text().splitlines()) == 1


def test_la_carpeta_de_datos_no_se_versiona():
    """`gui/relay/.gitignore` ignora la carpeta de datos, el venv y el .env."""
    texto = (RAIZ / "relay" / ".gitignore").read_text(encoding="utf-8")
    assert "datos/" in texto
