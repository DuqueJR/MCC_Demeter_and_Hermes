"""`validacion.py` no debe ser más estricto que `gui/web/src/contrato/esquema.json` (T-611d).

El esquema manda. Antes de T-611d el validador rechazaba mensajes válidos del servicio de tierra
(`estacion/web1.py`): `relay_utc_ms` nulo, `seq` de ranura (> 255), `lkp` con `pos` nula, `enlace.*`
nulos, `temp_esp_c`/`sd_libre_mb`/`apogeo_m`/`estacion.pos` nulos, y (D-050) `boot_count` y `calib.*` nulos.
"""

from __future__ import annotations

import copy
import json
import unittest
from functools import lru_cache

from .. import constantes as C
from ..simulador import generar_lineas
from ..validacion import ESPECIFICACION, validar_mensaje

RUTA_ESQUEMA = C.RAIZ_REPO / "gui" / "web" / "src" / "contrato" / "esquema.json"


@lru_cache(maxsize=None)
def _lineas() -> tuple:
    return tuple(generar_lineas("demeter", "nominal"))


def _base(tipo: str, indice: int = 20) -> dict:
    datos = [l["datos"] for l in _lineas() if l["evento"] == tipo]
    return copy.deepcopy(datos[min(indice, len(datos) - 1)])


class PuntosDeLaPropuesta1(unittest.TestCase):
    """Un caso por punto de la propuesta 1 de T-661 (más D-050)."""

    def assertValido(self, tipo, datos):
        self.assertEqual(validar_mensaje(tipo, datos), [])

    def test_las_bases_son_validas(self):
        for tipo in ("estado", "salud", "estacion"):
            self.assertValido(tipo, _base(tipo))

    def test_relay_utc_ms_nulo(self):
        d = _base("estado")
        d["relay_utc_ms"] = None
        self.assertValido("estado", d)
        # sigue siendo entero o null, y no negativo
        d["relay_utc_ms"] = "1"
        self.assertTrue(validar_mensaje("estado", d))
        d["relay_utc_ms"] = -1
        self.assertTrue(validar_mensaje("estado", d))

    def test_relay_antes_de_rx_sigue_siendo_incoherente(self):
        d = _base("estado")
        d["relay_utc_ms"] = d["rx_utc_ms"] - 1
        self.assertTrue(any("relay_utc_ms" in e for e in validar_mensaje("estado", d)))

    def test_seq_es_un_indice_de_ranura_sin_tope(self):
        d = _base("estado")
        for seq in (255, 256, 44_000_000_000):  # utc_ms/40 ~ 4,4e10 (protocolo §6)
            d["seq"] = seq
            self.assertValido("estado", d)
        d["seq"] = -1
        self.assertTrue(validar_mensaje("estado", d))
        d["seq"] = 1.5
        self.assertTrue(validar_mensaje("estado", d))

    def test_lkp_con_pos_nula_es_el_caso_de_uso(self):
        d = _base("estado")
        d["pos"] = None
        d["flags"]["gnss_fix"] = False
        self.assertIsNotNone(d["lkp"])
        self.assertValido("estado", d)
        d["lkp"] = None  # y nunca hubo posición
        self.assertValido("estado", d)

    def test_enlace_nulo(self):
        for campo in ("rssi_dbm", "snr_db", "perdidos_pct_10s"):
            with self.subTest(campo=campo):
                d = _base("estado")
                d["enlace"][campo] = None
                self.assertValido("estado", d)
        d = _base("estado")
        d["enlace"] = {"rssi_dbm": None, "snr_db": None, "perdidos_pct_10s": None}
        self.assertValido("estado", d)

    def test_enlace_sigue_con_rango_y_sin_omitir(self):
        d = _base("estado")
        d["enlace"]["rssi_dbm"] = 10
        self.assertTrue(validar_mensaje("estado", d))
        d = _base("estado")
        del d["enlace"]["snr_db"]
        self.assertTrue(any("faltan" in e for e in validar_mensaje("estado", d)))

    def test_pos_alt_msl_nula(self):
        d = _base("estado")
        d["pos"]["alt_msl_m"] = None
        self.assertValido("estado", d)

    def test_salud_temp_sd_apogeo_nulos(self):
        for campo in ("temp_esp_c", "sd_libre_mb", "apogeo_m"):
            with self.subTest(campo=campo):
                d = _base("salud")
                d[campo] = None
                self.assertValido("salud", d)
                d = _base("salud")
                del d[campo]  # null no es omitir
                self.assertTrue(validar_mensaje("salud", d))

    def test_estacion_pos_nula(self):
        d = _base("estacion")
        d["pos"] = None
        d["gnss_ok"] = False
        self.assertValido("estacion", d)
        d = _base("estacion")
        d["pos"]["alt_msl_m"] = None
        self.assertValido("estacion", d)
        d = _base("estacion")
        d["pos"] = {"lat": 6.5}  # incompleta: no vale
        self.assertTrue(validar_mensaje("estacion", d))

    def test_boot_count_nulo_d050(self):
        d = _base("salud")
        d["boot_count"] = None
        self.assertValido("salud", d)
        d["boot_count"] = "3"
        self.assertTrue(validar_mensaje("salud", d))

    def test_salud_pi_es_opcional_d065(self):
        """`salud.pi` (T-657 / D-065): puede faltar, ser null (Hermes) o ser {estado, motivo, bat_pct}."""
        d = _base("salud")
        d.pop("pi", None)
        self.assertValido("salud", d)  # sin `pi`: "sin dato"
        d["pi"] = None
        self.assertValido("salud", d)
        d["pi"] = {"estado": "RECORDING", "motivo": None, "bat_pct": None}
        self.assertValido("salud", d)
        d["pi"] = {"estado": "SD_FULL", "motivo": "SD_ESPACIO", "bat_pct": 80}
        self.assertValido("salud", d)
        for malo in (
            {"estado": "ARMED"},  # incompleto
            {"estado": None, "motivo": None, "bat_pct": None},  # el estado no es nulo
            {"estado": "ARMED", "motivo": None, "bat_pct": 101},
            {"estado": "ARMED", "motivo": None, "bat_pct": None, "extra": 1},
        ):
            with self.subTest(pi=malo):
                d["pi"] = malo
                self.assertTrue(validar_mensaje("salud", d))

    def test_calib_nulos_d050(self):
        d = _base("salud")
        d["calib"] = {c: None for c in ("giro", "mag", "baro", "origen", "actitud")}
        self.assertValido("salud", d)
        d = _base("salud")
        d["calib"]["mag"] = None  # mezclado
        self.assertValido("salud", d)
        d["calib"]["mag"] = 0  # no es booleano
        self.assertTrue(validar_mensaje("salud", d))
        # `calib` entero no es nulable, y sus campos no se omiten
        d = _base("salud")
        d["calib"] = None
        self.assertTrue(validar_mensaje("salud", d))
        d = _base("salud")
        del d["calib"]["giro"]
        self.assertTrue(any("faltan" in e for e in validar_mensaje("salud", d)))

    def test_lo_obligatorio_sigue_sin_aceptar_null(self):
        d = _base("estado")
        d["fase"] = None
        self.assertTrue(validar_mensaje("estado", d))
        d = _base("salud")
        d["t_ms"] = None
        self.assertTrue(validar_mensaje("salud", d))
        d = _base("estacion")
        d["gnss_ok"] = None
        self.assertTrue(validar_mensaje("estacion", d))


def _anulable(nodo: dict, defs: dict) -> bool:
    nodo = _resolver(nodo, defs)
    return "anyOf" in nodo and any(x.get("type") == "null" for x in nodo["anyOf"])


def _resolver(nodo: dict, defs: dict) -> dict:
    while "$ref" in nodo:
        nodo = defs[nodo["$ref"].rsplit("/", 1)[-1]]
    return nodo


def _sin_null(nodo: dict, defs: dict) -> dict:
    nodo = _resolver(nodo, defs)
    if "anyOf" in nodo:
        for x in nodo["anyOf"]:
            if x.get("type") != "null":
                return _resolver(x, defs)
    return nodo


class NulabilidadIgualAlEsquema(unittest.TestCase):
    """Cada campo que el validador conoce admite `null` si y solo si el esquema lo admite."""

    def test_coincide_en_todos_los_campos(self):
        esquema = json.loads(RUTA_ESQUEMA.read_text(encoding="utf-8"))
        defs = esquema["$defs"]
        diferencias: list[str] = []

        def recorrer(spec, nodo, ruta):
            props = _sin_null(nodo, defs).get("properties", {})
            for nombre, campo in spec.items():
                if nombre not in props:
                    diferencias.append(f"{ruta}.{nombre}: no está en el esquema")
                    continue
                p = props[nombre]
                if campo.nulo != _anulable(p, defs):
                    diferencias.append(
                        f"{ruta}.{nombre}: validador nulo={campo.nulo}, esquema nulo={_anulable(p, defs)}"
                    )
                if campo.tipo == "obj":
                    recorrer(campo.interno, p, f"{ruta}.{nombre}")

        for tipo, spec in ESPECIFICACION.items():
            recorrer(spec, defs[tipo], tipo)
        self.assertEqual(diferencias, [])


if __name__ == "__main__":
    unittest.main()
