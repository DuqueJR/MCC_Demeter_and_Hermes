"""Criterios 4, 5 y 8: la tasa hacia el publico (04 §4.3), los mensajes atrasados y repetidos (§4.4, D-060) y las misiones
(§4.5). Se prueba la logica pura (`EstadoMision`): es la que decide que sale por el stream y que solo se guarda.
"""
import pytest

from estado_mision import EstadoMision
from ayudas import backfill, estacion, estado, evento, meta, salud

AHORA = 1_900_000_000_000


def aplicar(e: EstadoMision, m: dict):
    return e.aplicar(m["tipo"], m["datos"], AHORA)


def emitidos(e: EstadoMision, mensajes: list[dict], tipo: str = "estado") -> list[dict]:
    """Los `datos` de los mensajes que SALEN por el stream."""
    salida = []
    for m in mensajes:
        r = aplicar(e, m)
        if r.emision is not None and r.emision.tipo == tipo:
            salida.append(m["datos"])
    return salida


@pytest.fixture
def e():
    return EstadoMision("demeter")


# ---- 4. Tasa -------------------------------------------------------------------------------------------------------
def test_en_tierra_sale_1_hz_medido_con_rx_aunque_lleguen_de_golpe(e):
    """100 `estado` separados 100 ms en `rx_utc_ms` (10 s) que llegan todos juntos: salen ~1 por segundo."""
    lote = [estado(10_000 + 100 * i, fase="PREFLIGHT") for i in range(100)]
    salio = emitidos(e, lote)
    rx = [d["rx_utc_ms"] for d in salio]
    assert 10 <= len(salio) <= 11
    assert all(b - a >= 900 for a, b in zip(rx, rx[1:])), rx          # nunca mas rapido que 1 Hz (con la tolerancia)
    assert (rx[-1] - rx[0]) / (len(rx) - 1) == pytest.approx(1000, rel=0.1)
    # la serie y el snapshot usan TODO lo recibido
    assert len(e.serie()["lat"]) == 100
    assert e.estado["rx_utc_ms"] == 10_000 + 99 * 100
    assert e.contadores["estados_bajados_de_tasa"] == 100 - len(salio)


def test_la_hora_de_llegada_al_relay_no_cuenta(e):
    """El ritmo se mide con `rx_utc_ms`: tras una caida todo llega junto pero espaciado 1 s en rx, y todo pasa."""
    salio = emitidos(e, [estado(50_000 + 1000 * i) for i in range(20)])
    assert len(salio) == 20


def test_2_hz_con_jitter_da_1_hz_y_no_menos(e):
    """net_proto manda a 2 Hz en tierra; el jitter de la llegada (+-15 ms) no debe bajar la tasa a ~0,67 Hz."""
    jitter = [0, -15, 12, -8, 15, -12, 5, -15, 10, -5]
    lote = [estado(20_000 + 500 * i + jitter[i % 10]) for i in range(60)]          # 30 s
    salio = emitidos(e, lote)
    assert 29 <= len(salio) <= 31, len(salio)


def test_el_primer_estado_tras_un_cambio_de_fase_pasa(e):
    lote = [estado(1000 + 100 * i, fase="PREFLIGHT") for i in range(5)]
    lote += [estado(1500 + 100 * i, fase="ARMED") for i in range(5)]               # cambia a los 50 ms de la ultima
    salio = emitidos(e, lote)
    fases = [d["fase"] for d in salio]
    assert fases == ["PREFLIGHT", "ARMED"]
    assert salio[1]["rx_utc_ms"] == 1500                                           # el primero de ARMED


def test_en_vuelo_pasa_todo_y_error_tambien(e):
    for fase in ("BOOST", "COAST", "APOGEE", "FREE_FALL", "DESCENT", "ERROR"):
        e2 = EstadoMision("demeter")
        salio = emitidos(e2, [estado(1000 + 100 * i, fase=fase) for i in range(30)])
        assert len(salio) == 30, fase
    # se baja en BOOT, PREFLIGHT, ARMED y LANDED
    for fase in ("BOOT", "PREFLIGHT", "ARMED", "LANDED"):
        e2 = EstadoMision("demeter")
        assert len(emitidos(e2, [estado(1000 + 100 * i, fase=fase) for i in range(30)])) < 5, fase


def test_la_tasa_vuelve_a_bajar_al_aterrizar(e):
    vuelo = [estado(1000 + 100 * i, fase="DESCENT") for i in range(20)]
    tierra = [estado(3000 + 100 * i, fase="LANDED") for i in range(20)]
    salio = emitidos(e, vuelo + tierra)
    assert len([d for d in salio if d["fase"] == "DESCENT"]) == 20
    assert len([d for d in salio if d["fase"] == "LANDED"]) <= 3


def test_la_tasa_es_configurable():
    e2 = EstadoMision("demeter", tasa_tierra_hz=2)
    assert len(emitidos(e2, [estado(1000 + 100 * i) for i in range(50)])) in range(9, 12)       # 5 s a 2 Hz


def test_los_otros_tipos_siempre_pasan_aunque_sea_tierra(e):
    aplicar(e, estado(1000))
    for i in range(1, 6):
        assert aplicar(e, salud(1000 * i)).emision is not None
        assert aplicar(e, estacion(1794150000000 + i)).emision is not None
        assert aplicar(e, backfill(i)).emision is not None
        assert aplicar(e, evento("fase", i, fase="ARMED")).emision is not None


# ---- 5. Atrasados y repetidos (el caso clave) ---------------------------------------------------------------------------
def llenar(e, n=10, rx0=100_000, fase="DESCENT"):
    """`n` estados en vuelo, uno cada 100 ms; los pares de tiempos (rx, t_ms) siguen la misma recta."""
    for i in range(n):
        aplicar(e, estado(rx0 + 100 * i, t_ms=5000 + 100 * i, fase=fase))


def test_un_estado_atrasado_no_sale_por_el_stream_y_entra_a_la_serie_en_orden(e):
    llenar(e, 10)
    ultimo = e.estado
    seq = e.seq
    huecos = [estado(100_000 + 100 * i + 50, t_ms=5000 + 100 * i + 50, fase="DESCENT") for i in (2, 5, 7)]
    for m in huecos:
        r = aplicar(e, m)
        assert r.accion == "guardado" and r.emision is None and r.persistir
    assert e.seq == seq                                                           # nada salio por el stream
    assert e.estado is ultimo                                                     # el snapshot sigue con el ultimo
    assert e.estado["rx_utc_ms"] == 100_900
    serie = e.serie()
    assert len(serie["lat"]) == 13
    # en orden de rx_utc_ms: el T+ no existe sin despegue, asi que se mira el orden por el acelerometro que lleva el t_ms
    assert [k for k in e._claves] == sorted(e._claves)
    assert (100_250, 5250) in e._claves and e._claves.index((100_250, 5250)) == e._claves.index((100_200, 5200)) + 1


def test_el_orden_lo_decide_rx_y_no_t_ms(e):
    """`t_ms` puede retroceder sin que el mensaje sea viejo (reloj del portatil -> GNSS): con rx nuevo, SALE."""
    llenar(e, 5)
    r = aplicar(e, estado(100_500, t_ms=1_000, fase="DESCENT"))                  # t_ms retrocede, rx avanza
    assert r.accion == "emitido" and r.emision.tipo == "estado"
    assert e.estado["t_ms"] == 1_000 and e.estado["rx_utc_ms"] == 100_500
    # y al reves: t_ms mayor pero rx menor es un atraso
    r = aplicar(e, estado(100_100, t_ms=999_999, fase="DESCENT"))
    assert r.accion == "guardado" and r.emision is None
    assert e.estado["t_ms"] == 1_000


def test_mismo_rx_se_desempata_con_t_ms(e):
    aplicar(e, estado(100_000, t_ms=5000, fase="BOOST"))
    assert aplicar(e, estado(100_000, t_ms=5001, fase="BOOST")).accion == "emitido"      # mayor: nuevo
    assert aplicar(e, estado(100_000, t_ms=4999, fase="BOOST")).accion == "guardado"     # menor: atrasado
    assert aplicar(e, estado(100_000, t_ms=5001, fase="BOOST")).accion == "descartado"   # igual: repetido


def test_un_estado_repetido_se_descarta(e):
    llenar(e, 6)
    seq = e.seq
    n = len(e.serie()["lat"])
    for i in (0, 3, 5):                                                          # el ultimo y dos que ya estan en la serie
        r = aplicar(e, estado(100_000 + 100 * i, t_ms=5000 + 100 * i, fase="DESCENT"))
        assert r.accion == "descartado" and not r.persistir
    assert e.seq == seq and len(e.serie()["lat"]) == n
    assert e.contadores["descartados_repetidos"] == 3


def test_tras_una_caida_los_viejos_intercalados_no_salen_por_el_stream(e):
    """Lo que hace el reenviador (T-605a): lote = [viejos pendientes] + [frescos]."""
    aplicar(e, estado(100_000, t_ms=5000, fase="DESCENT"))
    frescos = [estado(200_000 + 100 * i, t_ms=105_000 + 100 * i, fase="DESCENT") for i in range(10)]
    viejos = [estado(100_100 + 100 * i, t_ms=5100 + 100 * i, fase="DESCENT") for i in range(50)]
    salio = emitidos(e, frescos + viejos[:25] + viejos[25:])
    assert [d["rx_utc_ms"] for d in salio] == [200_000 + 100 * i for i in range(10)]     # solo los frescos
    assert len(e.serie()["lat"]) == 1 + 10 + 50                                          # pero la serie los tiene todos
    assert e.estado["rx_utc_ms"] == 200_900


def test_salud_y_estacion_viejos_no_salen(e):
    assert aplicar(e, salud(5000)).emision is not None
    assert aplicar(e, estacion(1000)).emision is not None
    for t in (5000, 4000, 0):
        r = aplicar(e, salud(t))
        assert r.accion == "descartado" and r.emision is None and not r.persistir
    for u in (1000, 999, 0):
        assert aplicar(e, estacion(u)).accion == "descartado"
    assert e.salud["t_ms"] == 5000 and e.estacion["utc_ms"] == 1000
    assert aplicar(e, salud(5001)).emision is not None
    assert aplicar(e, estacion(1001)).emision is not None


def test_un_evento_nuevo_atrasado_sale_y_su_duplicado_no(e):
    for t in (1000, 3000):
        aplicar(e, evento("fase", t, fase="BOOST" if t == 1000 else "COAST"))
    tarde = evento("apogeo", 2000, valor=669.1)                                  # t_ms menor que el ultimo: llega tarde
    r = aplicar(e, tarde)
    assert r.accion == "emitido" and r.emision.tipo == "evento"                  # un evento nuevo siempre sale
    assert [x["t_ms"] for x in e.eventos] == [1000, 2000, 3000]                   # y se guarda ordenado por t_ms
    seq = e.seq
    r = aplicar(e, evento("apogeo", 2000, valor=669.1))
    assert r.accion == "descartado" and e.seq == seq
    assert aplicar(e, evento("apogeo", 2000, valor=670.0)).accion == "descartado"        # la clave no incluye el valor
    assert len(e.eventos) == 3


def test_la_clave_del_evento_es_la_de_costura_ts(e):
    """`tipo|t_ms|fase|activa`: la misma `fase` con otra `activa` o con otro `t_ms` es otro evento."""
    assert aplicar(e, evento("alarma_descenso", 5000, activa=True)).emision is not None
    assert aplicar(e, evento("alarma_descenso", 5000, activa=False)).emision is not None
    assert aplicar(e, evento("alarma_descenso", 5000, activa=True)).accion == "descartado"
    assert aplicar(e, evento("fase", 5000, fase="COAST")).emision is not None
    assert aplicar(e, evento("fase", 5000, fase="APOGEE")).emision is not None
    assert aplicar(e, evento("fase", 5001, fase="COAST")).emision is not None


def test_el_t_mas_s_es_null_antes_del_despegue_y_sale_del_despegue_despues(e):
    llenar(e, 4, fase="ARMED")
    assert e.serie()["t_mas_s"] == [None] * 4
    aplicar(e, evento("despegue", 5100))
    assert e.serie()["t_mas_s"] == [-0.1, 0.0, 0.1, 0.2]


def test_la_decimacion_conserva_el_vuelo():
    e2 = EstadoMision("demeter", serie_max_puntos=50)
    for i in range(100):
        aplicar(e2, estado(10_000 + 1000 * i, fase="PREFLIGHT"))
    for i in range(30):
        aplicar(e2, estado(200_000 + 100 * i, fase="BOOST"))
    serie = e2.serie()
    assert len(serie["lat"]) == 50
    # los 30 de vuelo se conservan; los 20 restantes se reparten entre los 100 de tierra (con ambos extremos)
    aplicar(e2, evento("despegue", 200_000))
    t = e2.serie()["t_mas_s"]
    assert sum(1 for x in t if x is not None and x >= 0) == 30


# ---- 8. Misiones (04 §4.5) ---------------------------------------------------------------------------------------------
def test_de_null_a_un_valor_conserva_lo_acumulado(e):
    aplicar(e, meta(mission_id=None))
    llenar(e, 5)
    aplicar(e, evento("despegue", 5000))
    seq = e.seq
    r = aplicar(e, meta(mission_id=111))
    assert r.accion == "emitido" and r.emision.seq == seq + 1
    assert len(e.serie()["lat"]) == 5 and len(e.eventos) == 1 and e.estado is not None
    assert e.meta["mission_id"] == 111 and e.cerrados == set()


def test_otro_mission_id_inicia_otra_mision_y_seq_sigue_creciendo(e):
    aplicar(e, meta(mission_id=111))
    llenar(e, 5)
    aplicar(e, evento("despegue", 5000))
    aplicar(e, salud(5000))
    aplicar(e, estacion(1794150000000))
    seq = e.seq
    r = aplicar(e, meta(mission_id=222))
    assert r.accion == "emitido" and r.emision.seq == seq + 1                      # seq_relay sigue
    assert e.eventos == [] and e.serie()["lat"] == []
    assert e.estado is None and e.salud is None and e.backfill is None
    assert e.estacion is not None                                                  # el latido es de la estacion
    assert e.meta["mission_id"] == 222 and e.cerrados == {111}
    # el snapshot de la mision nueva es valido y vacio
    snap = e.snapshot()
    assert snap["estado"] is None and snap["eventos"] == []


def test_un_mission_id_cerrado_no_se_reabre(e):
    aplicar(e, meta(mission_id=111))
    llenar(e, 3)
    aplicar(e, meta(mission_id=222))
    llenar(e, 3, rx0=900_000)
    seq = e.seq
    r = aplicar(e, meta(mission_id=111))                                           # llega tarde: es atraso
    assert r.accion == "descartado" and r.emision is None and not r.persistir
    assert e.seq == seq and e.meta["mission_id"] == 222 and len(e.serie()["lat"]) == 3 and e.cerrados == {111}


def test_un_estado_anterior_al_inicio_de_la_mision_se_descarta(e):
    aplicar(e, meta(mission_id=111))
    llenar(e, 5, rx0=100_000)                                                      # el ultimo rx de la mision 111: 100_400
    aplicar(e, meta(mission_id=222))
    for rx in (100_000, 100_200, 100_400):                                         # atrasos de la mision anterior
        r = aplicar(e, estado(rx, fase="DESCENT"))
        assert r.accion == "descartado" and not r.persistir
    assert e.contadores["descartados_mision_anterior"] == 3
    assert e.serie()["lat"] == []
    assert aplicar(e, estado(100_500, fase="DESCENT")).accion == "emitido"          # la mision nueva sigue
    assert len(e.serie()["lat"]) == 1


def test_el_meta_repetido_no_sale_otra_vez_pero_uno_distinto_si(e):
    aplicar(e, meta(mission_id=111))
    seq = e.seq
    assert aplicar(e, meta(mission_id=111)).accion == "descartado"
    assert e.seq == seq
    assert aplicar(e, meta(mission_id=111, modo="simulacion")).accion == "emitido"      # mismo vuelo, otro dato
    assert e.meta["modo"] == "simulacion" and e.cerrados == set()


def test_un_meta_sin_mission_id_tras_uno_con_valor_es_un_atraso(e):
    """Hueco del contrato (ver la bitacora): el `meta` previo al ARM puede llegar tarde y no debe borrar la mision."""
    aplicar(e, meta(mission_id=111))
    llenar(e, 3)
    r = aplicar(e, meta(mission_id=None))
    assert r.accion == "descartado" and len(e.serie()["lat"]) == 3 and e.meta["mission_id"] == 111


def test_las_dos_misiones_son_independientes():
    d, h = EstadoMision("demeter"), EstadoMision("hermes")
    aplicar(d, meta(mission_id=1))
    aplicar(h, meta("hermes", mission_id=5))
    llenar(d, 3)
    aplicar(d, meta(mission_id=2))
    assert h.meta["mission_id"] == 5 and h.seq == 1 and d.seq > 3
