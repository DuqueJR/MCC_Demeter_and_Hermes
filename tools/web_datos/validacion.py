"""Validación de los mensajes contra lo que exige `05_contrato_datos_web.md` (§0 y §2).

NO es el esquema oficial: ese es `src/contrato/esquema.json` de T-611, que todavía no
existe. Esto comprueba lo que el documento 05 dice con todas sus letras:
- cada mensaje tiene exactamente los campos del contrato: ninguno se omite ni sobra
  (`null` = sin dato);
- los tipos (entero, número, texto, booleano) y los rangos físicos;
- la precisión (decimales) de §0;
- coherencias simples (fase y fase_cod, cuaternión unitario, eventos con sus campos).
Cuando T-611 entregue el esquema, las pruebas deben validar además contra él.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from . import constantes as C

TIPOS_MENSAJE = ("meta", "estado", "salud", "estacion", "evento", "backfill")
TIPOS_EVENTO = (
    "despegue",
    "fin_combustion",
    "eyeccion",
    "apogeo",
    "fase",
    "aterrizaje",
    "alarma_descenso",
    "camaras",
)
_ENTERO = int


@dataclass(frozen=True)
class Campo:
    tipo: str  # "int", "num", "str", "bool", "lista", "obj"
    nulo: bool = False
    minimo: float | None = None
    maximo: float | None = None
    decimales: int | None = None
    opciones: tuple | None = None
    interno: Any = None  # para "obj": dict de campos; para "lista": un Campo


def I(nulo=False, minimo=None, maximo=None, opciones=None):  # noqa: E743
    return Campo("int", nulo, minimo, maximo, None, opciones)


def N(decimales, nulo=False, minimo=None, maximo=None):
    return Campo("num", nulo, minimo, maximo, decimales)


def S(nulo=False, opciones=None):
    return Campo("str", nulo, opciones=opciones)


def B(nulo=False):
    return Campo("bool", nulo)


def O(interno, nulo=False):  # noqa: E741
    return Campo("obj", nulo, interno=interno)


def L(interno):
    return Campo("lista", interno=interno)


_FASES = tuple(C.FASES)
_LATLON = {
    "lat": N(C.DECIMALES_LATLON, minimo=-90, maximo=90),
    "lon": N(C.DECIMALES_LATLON, minimo=-180, maximo=180),
}
_BOOL5 = ("giro", "mag", "baro", "origen", "actitud")

ESPECIFICACION: dict[str, dict[str, Campo]] = {
    "meta": {
        "contrato_version": S(opciones=(C.CONTRATO_VERSION,)),
        "mision": S(opciones=C.MISIONES),
        "nodo": I(opciones=(C.NODO_DEMETER, C.NODO_HERMES)),
        "modo": S(opciones=("vivo", "simulacion", "sintetico")),
        "mission_id": I(nulo=True, minimo=1),
        "proto_version": I(opciones=(2, 3)),
        "sitio": O({**_LATLON, "alt_msl_m": N(C.DECIMALES_M)}),
    },
    "estado": {
        "seq": I(minimo=0, maximo=255),
        "t_ms": I(minimo=0),
        "utc_ms": I(nulo=True, minimo=0),
        "rx_utc_ms": I(minimo=0),
        "relay_utc_ms": I(minimo=0),
        "fase": S(opciones=_FASES),
        "fase_cod": I(minimo=0, maximo=9),
        "pos": O(
            {
                **_LATLON,
                "alt_agl_m": N(C.DECIMALES_M, minimo=-3276.7, maximo=3276.7),
                "alt_msl_m": N(C.DECIMALES_M),
                "fuente": S(opciones=("ekf", "gnss")),
            },
            nulo=True,
        ),
        "vel": O(
            {
                "n_ms": N(C.DECIMALES_MS, minimo=-327.67, maximo=327.67),
                "e_ms": N(C.DECIMALES_MS, minimo=-327.67, maximo=327.67),
                "u_ms": N(C.DECIMALES_MS, minimo=-327.67, maximo=327.67),
                "total_ms": N(C.DECIMALES_MS, minimo=0),
            },
            nulo=True,
        ),
        "acc_g": O({c: N(C.DECIMALES_G, minimo=-32.767, maximo=32.767) for c in "xyz"}),
        "q": O({c: N(C.DECIMALES_Q, minimo=-1, maximo=1) for c in "wxyz"}),
        "flags": O(
            {
                c: B()
                for c in (
                    "gnss_fix",
                    "ekf_ok",
                    "falla_activa",
                    "eyeccion",
                    "apogeo",
                    "log_activo",
                    "reanudado",
                )
            }
        ),
        "act": O({c: B() for c in ("pi_pulso", "cam_ok", "buzzer", "wifi_ap", "backfill")}),
        "bat_pct": I(nulo=True, minimo=0, maximo=100),
        "secundario": O({"codigo": I(minimo=0, maximo=255), "texto": S()}, nulo=True),
        "calc": O(
            {
                "dist_horiz_m": N(C.DECIMALES_M, nulo=True, minimo=0),
                "azimut_deg": N(C.DECIMALES_GRADOS, nulo=True, minimo=0, maximo=360),
                "elevacion_deg": N(C.DECIMALES_GRADOS, nulo=True, minimo=-90, maximo=90),
                "elipse": O(
                    {
                        **_LATLON,
                        "semieje_mayor_m": N(C.DECIMALES_M, minimo=0),
                        "semieje_menor_m": N(C.DECIMALES_M, minimo=0),
                        "rumbo_deg": N(C.DECIMALES_GRADOS, minimo=0, maximo=360),
                    },
                    nulo=True,
                ),
                "t_a_apogeo_s": N(1, nulo=True, minimo=0),
                "t_restante_s": N(1, nulo=True, minimo=0),
                "siguiente_fase": S(nulo=True, opciones=_FASES),
                "t_siguiente_fase_s": N(1, nulo=True, minimo=0),
            }
        ),
        "enlace": O(
            {
                "rssi_dbm": I(minimo=-150, maximo=0),
                "snr_db": N(1, minimo=-30, maximo=30),
                "perdidos_pct_10s": N(1, minimo=0, maximo=100),
            }
        ),
        "alarmas": O({"descenso_rapido": B()}),
        "lkp": O(
            {
                **_LATLON,
                "alt_agl_m": N(C.DECIMALES_M),
                "utc_ms": I(nulo=True, minimo=0),
            },
            nulo=True,
        ),
    },
    "salud": {
        "t_ms": I(minimo=0),
        "utc_ms": I(nulo=True, minimo=0),
        "mission_id": I(nulo=True, minimo=1),
        "boot_count": I(minimo=0, maximo=255),
        "gnss": O(
            {
                "fix": I(opciones=(0, 2, 3)),
                "sv": I(minimo=0, maximo=64),
                "hacc_m": N(C.DECIMALES_M, nulo=True, minimo=0),
            }
        ),
        "bat_mv": I(minimo=0, maximo=65535),
        "temp_esp_c": I(minimo=-127, maximo=127),
        "temp_pi_c": I(nulo=True, minimo=-127, maximo=127),
        "fallas": L(S()),
        "fallas_bits": I(minimo=0, maximo=0xFFFF),
        "calib": O({c: B() for c in _BOOL5}),
        "nav_innov_m": N(2, nulo=True, minimo=0),
        "apogeo_m": N(C.DECIMALES_M, minimo=0),
        "alt_origen_msl_m": N(C.DECIMALES_M),
        "sd_libre_mb": I(minimo=0, maximo=65535),
        "rssi_tierra_dbm": I(minimo=-150, maximo=0),
        "ultimo_cmd_seq": I(minimo=0, maximo=255),
        "fw_version": S(nulo=True),
        "go_nogo": O(
            {
                "listo": B(),
                "condiciones": L(O({"id": S(), "nombre": S(), "ok": B()})),
            }
        ),
    },
    "estacion": {
        "utc_ms": I(minimo=0),
        "pos": O({**_LATLON, "alt_msl_m": N(C.DECIMALES_M)}),
        "gnss_ok": B(),
        "ultimo_paquete_hace_ms": I(nulo=True, minimo=0),
    },
    "evento": {
        "tipo": S(opciones=TIPOS_EVENTO),
        "t_ms": I(minimo=0),
        "utc_ms": I(nulo=True, minimo=0),
        "t_mas_s": N(C.DECIMALES_S, nulo=True),
        "valor": N(C.DECIMALES_MS, nulo=True),
        "fase": S(nulo=True, opciones=_FASES),
        "activa": B(nulo=True),
    },
    "backfill": {
        "activo": B(),
        "recibidos": I(minimo=0),
        "esperados": I(minimo=0),
        "progreso": N(2, minimo=0, maximo=1),
        "completo": B(),
    },
}


def _es_entero(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _es_numero(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _validar_valor(v, c: Campo, ruta: str, errores: list[str]) -> None:
    if v is None:
        if not c.nulo:
            errores.append(f"{ruta}: no puede ser null")
        return
    if c.tipo == "int":
        if not _es_entero(v):
            errores.append(f"{ruta}: debe ser entero, es {v!r}")
            return
    elif c.tipo == "num":
        if not _es_numero(v):
            errores.append(f"{ruta}: debe ser número, es {v!r}")
            return
        if c.decimales is not None and isinstance(v, float) and round(v, c.decimales) != v:
            errores.append(f"{ruta}: más de {c.decimales} decimales ({v!r})")
    elif c.tipo == "str":
        if not isinstance(v, str):
            errores.append(f"{ruta}: debe ser texto, es {v!r}")
            return
    elif c.tipo == "bool":
        if not isinstance(v, bool):
            errores.append(f"{ruta}: debe ser booleano, es {v!r}")
        return
    elif c.tipo == "lista":
        if not isinstance(v, list):
            errores.append(f"{ruta}: debe ser lista")
            return
        for i, x in enumerate(v):
            _validar_valor(x, c.interno, f"{ruta}[{i}]", errores)
        return
    elif c.tipo == "obj":
        if not isinstance(v, dict):
            errores.append(f"{ruta}: debe ser objeto")
            return
        _validar_objeto(v, c.interno, ruta, errores)
        return
    if c.opciones is not None and v not in c.opciones:
        errores.append(f"{ruta}: {v!r} no está en {list(c.opciones)}")
    if c.minimo is not None and v < c.minimo:
        errores.append(f"{ruta}: {v!r} < {c.minimo}")
    if c.maximo is not None and v > c.maximo:
        errores.append(f"{ruta}: {v!r} > {c.maximo}")


def _validar_objeto(obj: dict, spec: dict[str, Campo], ruta: str, errores: list[str]) -> None:
    faltan = [k for k in spec if k not in obj]
    sobran = [k for k in obj if k not in spec]
    if faltan:
        errores.append(f"{ruta}: faltan campos {faltan}")
    if sobran:
        errores.append(f"{ruta}: campos que no están en el contrato {sobran}")
    for k, c in spec.items():
        if k in obj:
            _validar_valor(obj[k], c, f"{ruta}.{k}", errores)


def validar_mensaje(tipo: str, datos: Any) -> list[str]:
    """Errores de un mensaje del stream (`datos` según su `tipo`), con las coherencias del contrato."""
    if tipo not in ESPECIFICACION:
        return [f"tipo de mensaje desconocido: {tipo!r}"]
    errores: list[str] = []
    if not isinstance(datos, dict):
        return [f"{tipo}: debe ser objeto"]
    _validar_objeto(datos, ESPECIFICACION[tipo], tipo, errores)
    if errores:
        return errores
    if tipo == "estado":
        if C.FASES[datos["fase"]] != datos["fase_cod"]:
            errores.append("estado: fase y fase_cod no coinciden")
        q = datos["q"]
        norma = math.sqrt(sum(q[c] ** 2 for c in "wxyz"))
        if abs(norma - 1.0) > 1e-3:
            errores.append(f"estado: el cuaternión no es unitario (norma {norma:.5f})")
        if q["w"] < 0:
            errores.append("estado: el cuaternión debe salir con w >= 0 (protocolo §2)")
        if datos["pos"] is None and datos["lkp"] is not None:
            errores.append("estado: lkp sin posición")
        if datos["pos"] is not None and datos["flags"]["gnss_fix"] is False:
            errores.append("estado: hay pos pero gnss_fix es falso")
        if datos["pos"] is not None:
            esperado = "ekf" if datos["flags"]["ekf_ok"] else "gnss"
            if datos["pos"]["fuente"] != esperado:
                errores.append("estado: pos.fuente no concuerda con flags.ekf_ok")
        if datos["rx_utc_ms"] < (datos["utc_ms"] or 0) or datos["relay_utc_ms"] < datos["rx_utc_ms"]:
            errores.append("estado: utc_ms <= rx_utc_ms <= relay_utc_ms no se cumple")
    elif tipo == "evento":
        t = datos["tipo"]
        if t == "fase" and datos["fase"] is None:
            errores.append("evento: el tipo 'fase' necesita `fase`")
        if t in ("alarma_descenso", "camaras") and datos["activa"] is None:
            errores.append(f"evento: el tipo '{t}' necesita `activa`")
        if t == "apogeo" and datos["valor"] is None:
            errores.append("evento: el apogeo necesita `valor`")
        if t == "alarma_descenso" and datos["valor"] is None:
            errores.append("evento: alarma_descenso necesita `valor` (Vz)")
    elif tipo == "backfill":
        if datos["recibidos"] > datos["esperados"]:
            errores.append("backfill: recibidos > esperados")
        if datos["completo"] and datos["activo"]:
            errores.append("backfill: completo y activo a la vez")
    return errores


def validar_lineas(lineas: list[dict]) -> list[str]:
    """Valida un archivo completo (lista de `{"t_rel_ms", "evento", "datos"}`)."""
    errores: list[str] = []
    previo = -1
    for i, linea in enumerate(lineas):
        if not isinstance(linea, dict) or set(linea) != {"t_rel_ms", "evento", "datos"}:
            errores.append(f"línea {i + 1}: debe tener exactamente t_rel_ms, evento y datos")
            continue
        t_rel = linea["t_rel_ms"]
        if not _es_entero(t_rel) or t_rel < 0:
            errores.append(f"línea {i + 1}: t_rel_ms inválido ({t_rel!r})")
        elif t_rel < previo:
            errores.append(f"línea {i + 1}: t_rel_ms no es creciente ({t_rel} < {previo})")
        else:
            previo = t_rel
        for e in validar_mensaje(linea["evento"], linea["datos"]):
            errores.append(f"línea {i + 1} ({linea['evento']}): {e}")
    return errores
