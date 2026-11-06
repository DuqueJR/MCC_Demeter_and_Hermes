"""Criterios 6, 10 y 11: el SSE (04 §4.2), CORS, el limite por IP y el cliente lento (04 §5).

El SSE se prueba con un uvicorn REAL en un hilo: `TestClient` se queda colgado con los streams.
"""
import asyncio
import threading
import time

import pytest

from difusion import Difusor, Reserva
from estado_mision import Emision, trama
from ayudas import ServidorReal, cfg_prueba, estado, estacion, evento, meta, salud

ORIGEN = "http://localhost:5173"
RELOJ = 1_950_000_000_000


@pytest.fixture
def srv(tmp_path):
    with ServidorReal(cfg_prueba(tmp_path, reloj_ms=lambda: RELOJ)) as s:
        yield s


def test_bienvenida_sin_id_y_cabeceras(srv):
    st = srv.abrir_stream()
    try:
        assert st.status == 200
        assert st.cabeceras["content-type"].startswith("text/event-stream")
        assert st.cabeceras["cache-control"] == "no-cache, no-transform"
        assert st.cabeceras["x-accel-buffering"] == "no"
        (id_, tipo, datos), = st.leer(1)
        assert tipo == "meta" and id_ is None                                  # el `meta` de bienvenida va SIN id (D2)
        assert datos["mision"] == "demeter" and datos["mission_id"] is None and datos["sitio"]["alt_msl_m"] == 510.0
    finally:
        st.cerrar()


def test_el_meta_vigente_es_el_de_bienvenida_y_no_mueve_el_cursor(srv):
    srv.post([meta(mission_id=5)])
    st = srv.abrir_stream()
    try:
        (id_, tipo, datos), = st.leer(1)
        assert id_ is None and datos["mission_id"] == 5
    finally:
        st.cerrar()


def test_los_ids_son_seq_relay_crecientes_y_el_stream_trae_lo_nuevo(srv):
    st = srv.abrir_stream()
    try:
        st.leer(1)
        srv.post([meta(mission_id=5), estado(1000, fase="BOOST"), salud(10), estacion(1794150000000),
                  evento("despegue", 1000), estado(1100, fase="BOOST")])
        evs = st.leer(6)
        assert [e[1] for e in evs] == ["meta", "estado", "salud", "estacion", "evento", "estado"]
        assert [e[0] for e in evs] == ["1", "2", "3", "4", "5", "6"]
        # la otra mision no recibe nada de esta
        srv.post([estado(1000, fase="BOOST", mision="hermes")])
        assert st.leer(1, segundos=0.6) == []
    finally:
        st.cerrar()


def test_relay_utc_ms_se_sobrescribe_al_emitir(srv):
    srv.post([estado(1000, fase="BOOST", relay_utc_ms=123)])
    st = srv.abrir_stream(last_id=0)
    try:
        evs = st.leer(2)                                                       # bienvenida + el reanudado
        assert evs[1][2]["relay_utc_ms"] == RELOJ
    finally:
        st.cerrar()
    st2 = srv.abrir_stream()
    try:
        st2.leer(1)
        srv.post([estado(1100, fase="BOOST", relay_utc_ms=7)])
        assert st2.leer(1)[0][2]["relay_utc_ms"] == RELOJ
    finally:
        st2.cerrar()
    snap = __import__("json").loads(srv.get("/api/v1/demeter/snapshot")[2])
    assert snap["estado"]["relay_utc_ms"] == RELOJ


def test_un_atrasado_no_sale_por_el_stream_de_verdad(srv):
    """Punta a punta por HTTP: frescos y despues viejos en el mismo lote; el cliente solo ve los frescos."""
    st = srv.abrir_stream()
    try:
        st.leer(1)
        srv.post([estado(100_000, fase="DESCENT")])
        frescos = [estado(200_000 + 100 * i, fase="DESCENT") for i in range(5)]
        viejos = [estado(100_100 + 100 * i, fase="DESCENT") for i in range(20)]
        srv.post(frescos + viejos)
        evs = st.leer(6)
        assert [e[2]["rx_utc_ms"] for e in evs] == [100_000] + [200_000 + 100 * i for i in range(5)]
        assert st.leer(1, segundos=0.5) == []
    finally:
        st.cerrar()


def test_last_event_id_reanuda_hasta_el_maximo(tmp_path):
    with ServidorReal(cfg_prueba(tmp_path, reanudar_max=5)) as s:
        s.post([estado(1000 + 100 * i, fase="BOOST") for i in range(12)])         # ids 1..12
        st = s.abrir_stream(last_id=2)                                              # faltan 3..12: solo se dan los ultimos 5
        try:
            evs = st.leer(6)
            assert [e[1] for e in evs] == ["meta"] + ["estado"] * 5
            assert [e[0] for e in evs[1:]] == ["8", "9", "10", "11", "12"]
        finally:
            st.cerrar()
        st = s.abrir_stream(last_id=10)
        try:
            assert [e[0] for e in st.leer(3, segundos=1)[1:]] == ["11", "12"]
        finally:
            st.cerrar()
        st = s.abrir_stream(last_id=12)                                             # al dia: solo la bienvenida
        try:
            assert [e[1] for e in st.leer(3, segundos=0.6)] == ["meta"]
        finally:
            st.cerrar()
        st = s.abrir_stream(last_id=999)                                            # de otro relay: tambien solo la bienvenida
        try:
            assert [e[1] for e in st.leer(3, segundos=0.6)] == ["meta"]
        finally:
            st.cerrar()


def test_last_event_id_basura_se_ignora(srv):
    srv.post([estado(1000, fase="BOOST")])
    c = srv.conexion()
    c.request("GET", "/api/v1/demeter/stream", headers={"Last-Event-ID": "no-es-un-numero"})
    r = c.getresponse()
    assert r.status == 200
    c.close()


def test_latido(tmp_path):
    with ServidorReal(cfg_prueba(tmp_path, latido_s=0.3)) as s:
        st = s.abrir_stream()
        try:
            st.leer(1)
            st.leer(1, segundos=1.2)
            assert ": ping" in st.comentarios
        finally:
            st.cerrar()


def test_el_stream_de_una_mision_desconocida_es_404(srv):
    assert srv.get("/api/v1/atlas/stream")[0] == 404


# ---- 10. CORS y limite por IP -----------------------------------------------------------------------------------------
def test_cors_orígenes_y_cabeceras(srv):
    estado_, cab, _ = srv.get("/api/v1/demeter/snapshot", {"Origin": ORIGEN})
    assert estado_ == 200 and cab["access-control-allow-origin"] == ORIGEN
    assert "retry-after" in cab["access-control-expose-headers"].lower() and "age" in cab["access-control-expose-headers"].lower()
    _, cab, _ = srv.get("/api/v1/demeter/snapshot", {"Origin": "https://sitio-ajeno.example"})
    assert "access-control-allow-origin" not in cab
    st = srv.abrir_stream(origen=ORIGEN)
    try:
        assert st.cabeceras["access-control-allow-origin"] == ORIGEN
    finally:
        st.cerrar()


def test_cors_preflight(srv):
    c = srv.conexion()
    try:
        c.request("OPTIONS", "/api/v1/demeter/stream", headers={
            "Origin": ORIGEN, "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "last-event-id, cache-control, accept"})
        r = c.getresponse()
        r.read()
        cab = {k.lower(): v for k, v in r.getheaders()}
        assert r.status == 200 and cab["access-control-allow-origin"] == ORIGEN
        permitidos = {m.strip().lower() for m in cab["access-control-allow-headers"].split(",")}
        assert {"last-event-id", "cache-control", "accept"} <= permitidos
        metodos = {m.strip() for m in cab["access-control-allow-methods"].split(",")}
        assert metodos == {"GET", "OPTIONS"}
        # POST no se permite desde un navegador
        c.request("OPTIONS", "/api/v1/ingesta", headers={"Origin": ORIGEN, "Access-Control-Request-Method": "POST"})
        r = c.getresponse()
        r.read()
        assert r.status == 400
    finally:
        c.close()


def test_429_al_pasar_el_limite_por_ip(tmp_path):
    with ServidorReal(cfg_prueba(tmp_path, sse_max_por_ip=2, reintento_s=5)) as s:
        a, b = s.abrir_stream(), s.abrir_stream()
        try:
            assert a.status == b.status == 200
            c = s.conexion()
            c.request("GET", "/api/v1/hermes/stream", headers={"Origin": ORIGEN})     # el limite es por IP, no por mision
            r = c.getresponse()
            r.read()
            cab = {k.lower(): v for k, v in r.getheaders()}
            assert r.status == 429
            assert cab["retry-after"] == "5"
            assert cab["access-control-allow-origin"] == ORIGEN and "retry-after" in cab["access-control-expose-headers"].lower()
            c.close()
            assert s.get("/api/v1/demeter/snapshot")[0] == 200                          # lo demas sigue
            # al cerrar uno, hay lugar otra vez
            a.cerrar()
            for _ in range(40):
                if s.relay.por_ip.get("127.0.0.1", 0) < 2:
                    break
                time.sleep(0.05)
            d = s.abrir_stream()
            try:
                assert d.status == 200
            finally:
                d.cerrar()
        finally:
            a.cerrar()
            b.cerrar()
        for _ in range(40):                     # y todo se libera al cerrar
            if not s.relay.por_ip:
                break
            time.sleep(0.05)
        assert s.relay.por_ip == {}


def test_el_limite_por_ip_es_configurable_por_entorno(tmp_path):
    from config import desde_entorno
    assert desde_entorno({"WEB_INGESTA_TOKEN": "t"}, ruta_env=tmp_path / "x").sse_max_por_ip == 10     # WEB_SSE_MAX_POR_IP
    assert desde_entorno({"WEB_INGESTA_TOKEN": "t", "WEB_SSE_MAX_POR_IP": "40"}, ruta_env=tmp_path / "x").sse_max_por_ip == 40


# ---- 11. Cliente lento -------------------------------------------------------------------------------------------------
def em(seq: int, tipo: str = "estado") -> Emision:
    return Emision(seq, tipo, trama(tipo, "{}", seq))


def test_la_cola_acotada_descarta_el_estado_mas_viejo_y_no_frena_a_los_demas():
    async def prueba():
        d = Difusor(cola_max=3)
        lento = d.flujo(lambda: [b"hola"], Reserva({}, "a"))
        rapido = d.flujo(lambda: [b"hola"], Reserva({}, "b"))
        assert await anext(lento) == b"hola" and await anext(rapido) == b"hola"          # ya registrados
        recibidos = []

        async def consumir():
            async for t in rapido:
                recibidos.append(t)

        tarea = asyncio.create_task(consumir())
        for i in range(1, 11):
            d.publicar(em(i))
            await asyncio.sleep(0)
        await asyncio.sleep(0.05)
        assert len(recibidos) == 10                                                       # el rapido no perdio nada
        cl_lento = next(c for c in d.clientes if c.descartados)
        assert [t for _, t in cl_lento.cola] == [em(i).trama for i in (8, 9, 10)]         # al lento le quedan los 3 ultimos
        assert cl_lento.descartados == 7
        tarea.cancel()
        await asyncio.gather(tarea, return_exceptions=True)
        await lento.aclose()
    asyncio.run(prueba())


def test_sin_estado_que_descartar_se_cierra_la_conexion():
    async def prueba():
        d = Difusor(cola_max=3)
        flujo = d.flujo(lambda: [b"hola"], Reserva({}, "a"))
        otro = d.flujo(lambda: [b"hola"], Reserva({}, "b"))
        await anext(flujo)
        await anext(otro)
        for i in range(1, 4):
            d.publicar(em(i, "evento"))
        assert len(d.clientes) == 2
        d.publicar(em(4, "evento"))                                                       # llena y no hay estado: cierra
        assert d.cerrados_por_desborde == 2 and d.clientes == set()
        with pytest.raises(StopAsyncIteration):
            await anext(flujo)                                                            # la conexion termina; el cliente
        await otro.aclose()                                                               # reconecta y pide el snapshot
    asyncio.run(prueba())


def test_el_descarte_toma_el_estado_aunque_haya_otros_tipos_antes():
    async def prueba():
        d = Difusor(cola_max=3)
        flujo = d.flujo(lambda: [b"hola"], Reserva({}, "a"))
        await anext(flujo)
        for i, t in enumerate(["evento", "estado", "salud"], 1):
            d.publicar(em(i, t))
        d.publicar(em(4, "estado"))                                                       # sale el `estado` 2; el resto se queda
        c = next(iter(d.clientes))
        assert [t for t, _ in c.cola] == ["evento", "salud", "estado"]
        assert not c.cerrado
        await flujo.aclose()
    asyncio.run(prueba())


def test_un_cliente_que_no_lee_no_frena_a_los_demas_por_http(tmp_path):
    with ServidorReal(cfg_prueba(tmp_path, cola_cliente_max=100)) as s:
        lento = s.abrir_stream()                                                          # conecta y no vuelve a leer
        rapido = s.abrir_stream()
        recibidos: list = []

        def leer():
            recibidos.extend(rapido.leer(1 + 600, segundos=20))

        hilo = threading.Thread(target=leer)
        hilo.start()
        tiempos = []
        for k in range(30):
            t0 = time.perf_counter()
            status, _ = s.post([estado(1_000_000 + 1000 * k + 50 * i, fase="BOOST") for i in range(20)])
            tiempos.append(time.perf_counter() - t0)
            assert status == 200
        hilo.join(25)
        try:
            estados = [e for e in recibidos if e[1] == "estado"]
            assert len(estados) == 600
            ids = [int(e[0]) for e in estados]
            assert ids == sorted(ids) and len(set(ids)) == 600
            assert max(tiempos) < 1.0, tiempos                                          # ingerir no espera al cliente lento
        finally:
            lento.cerrar()
            rapido.cerrar()
