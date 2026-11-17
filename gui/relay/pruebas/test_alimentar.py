"""`alimentar.py`: sube un JSONL de gui/web/dev/datos/ a un relay real, respetando t_rel_ms."""
import json
import time
from pathlib import Path

import pytest

from alimentar import Alimentador, mision_de
from ayudas import DATOS_DEV, TOKEN, ServidorReal, cfg_prueba


def correr(s, archivo, **kw):
    a = Alimentador(DATOS_DEV / archivo, f"http://127.0.0.1:{s.puerto}", kw.pop("token", TOKEN),
                    kw.pop("velocidad", 1000.0), kw.pop("vueltas", 1), 100)
    a.start()
    a.join(60)
    return a


def test_la_mision_sale_del_nombre_del_archivo():
    assert mision_de(Path("hermes_nominal.jsonl")) == "hermes"
    assert mision_de(Path("x/demeter_lkp_descenso.jsonl")) == "demeter"
    with pytest.raises(SystemExit):
        mision_de(Path("atlas_nominal.jsonl"))


def test_sube_un_vuelo_completo_y_el_snapshot_lo_refleja(tmp_path):
    with ServidorReal(cfg_prueba(tmp_path)) as s:
        a = correr(s, "hermes_nominal.jsonl")
        assert a.fatal is None and a.descartados == 0 and a.enviados == 976
        snap = json.loads(s.get("/api/v1/hermes/snapshot")[2])
        assert snap["meta"]["mision"] == "hermes" and snap["estado"] is not None and len(snap["eventos"]) > 5
        assert json.loads(s.get("/api/v1/demeter/snapshot")[2])["estado"] is None


def test_respeta_t_rel_ms(tmp_path):
    """Al doble de velocidad, las 20 primeras lineas (unos 10 s de datos) tardan ~5 s, no 0 s."""
    lineas = (DATOS_DEV / "demeter_nominal.jsonl").read_text(encoding="utf-8").splitlines()
    corto = tmp_path / "demeter_corto.jsonl"
    corto.write_text("\n".join(lineas[:30]) + "\n", encoding="utf-8")
    t_fin = json.loads(lineas[29])["t_rel_ms"] / 1000
    with ServidorReal(cfg_prueba(tmp_path / "r")) as s:
        a = Alimentador(corto, f"http://127.0.0.1:{s.puerto}", TOKEN, 4.0, 1, 100)
        t0 = time.time()
        a.start()
        a.join(30)
        assert t_fin / 4 * 0.8 <= time.time() - t0 <= t_fin / 4 + 2


def test_dos_vueltas_no_se_toman_por_repetidos(tmp_path):
    with ServidorReal(cfg_prueba(tmp_path)) as s:
        a = correr(s, "demeter_lkp_descenso.jsonl", vueltas=2)
        n = len((DATOS_DEV / "demeter_lkp_descenso.jsonl").read_text(encoding="utf-8").splitlines())
        assert a.enviados == 2 * n and a.descartados == 0
        st = s.relay.misiones["demeter"]
        assert st.contadores["descartados_repetidos"] <= 1          # solo el `meta`, que es igual en las dos vueltas
        assert st.contadores["guardados_atrasados"] == 0


def test_un_token_malo_aborta(tmp_path):
    with ServidorReal(cfg_prueba(tmp_path)) as s:
        a = correr(s, "demeter_lkp_descenso.jsonl", token="otro")
        assert a.fatal and "401" in a.fatal and a.enviados == 0
