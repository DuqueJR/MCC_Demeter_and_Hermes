"""T-657 / D-065: `salud.pi` es opcional. El relay valida contra `esquema.json`, asi que lo acepta con y sin el campo,
lo guarda en el snapshot tal cual llega y rechaza uno mal formado."""
import copy

import pytest
from fastapi.testclient import TestClient

from app import crear_app
from ayudas import auth, cfg_prueba, meta, salud, estado

PI = {"estado": "RECORDING", "motivo": None, "bat_pct": None}


@pytest.fixture
def cli(tmp_path):
    return TestClient(crear_app(cfg_prueba(tmp_path)))


def subir(cli, mensajes):
    r = cli.post("/api/v1/ingesta", json={"mensajes": mensajes}, headers=auth())
    assert r.status_code == 200
    return r.json()


def salud_con(t_ms, **cambios):
    m = salud(t_ms)
    m["datos"].update(cambios)
    return m


def test_sin_pi_se_acepta(cli):
    m = salud(1000)
    m["datos"].pop("pi", None)
    assert subir(cli, [meta(), estado(1000), m]) == {"aceptados": 3, "descartados": 0}
    assert "pi" not in cli.get("/api/v1/demeter/snapshot").json()["salud"]


def test_con_pi_nulo_hermes(cli):
    assert subir(cli, [salud_con(1000, pi=None)])["aceptados"] == 1
    assert cli.get("/api/v1/demeter/snapshot").json()["salud"]["pi"] is None


@pytest.mark.parametrize("pi", [PI, {"estado": "SD_FULL", "motivo": "SD_ESPACIO", "bat_pct": 80},
                                {"estado": "DESCONOCIDO", "motivo": None, "bat_pct": None}])
def test_con_pi_se_acepta_y_llega_al_snapshot(cli, pi):
    assert subir(cli, [salud_con(1000, pi=copy.deepcopy(pi))])["aceptados"] == 1
    assert cli.get("/api/v1/demeter/snapshot").json()["salud"]["pi"] == pi


@pytest.mark.parametrize("malo", [{"estado": "ARMED"}, {"estado": 3, "motivo": None, "bat_pct": None},
                                  {"estado": "ARMED", "motivo": None, "bat_pct": 101},
                                  {"estado": "ARMED", "motivo": None, "bat_pct": None, "extra": 1}, "ARMED"])
def test_un_pi_mal_formado_se_descarta(cli, malo):
    r = subir(cli, [salud_con(1000, pi=malo)])
    assert r == {"aceptados": 0, "descartados": 1}
    assert cli.get("/api/v1/demeter/snapshot").json()["salud"] is None
