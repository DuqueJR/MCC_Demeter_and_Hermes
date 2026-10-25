"""Los 12 archivos (2 misiones x 6 escenarios): contrato, criterio de aceptación de T-612
y el comportamiento propio de cada escenario.

La validación es contra lo que exige el documento 05 (campos, tipos, rangos, decimales),
NO contra `esquema.json`: ese lo entrega T-611 y esta prueba debe ampliarse entonces.
"""

from __future__ import annotations

import json
import re
import unittest
from functools import lru_cache

from .. import constantes as C
from ..generar import serializar
from ..openrocket import leer_csv
from ..simulador import generar_lineas
from ..validacion import validar_lineas, validar_mensaje


@lru_cache(maxsize=None)
def lineas(mision: str, escenario: str) -> tuple:
    return tuple(generar_lineas(mision, escenario))


def de_tipo(mision: str, escenario: str, tipo: str) -> list[dict]:
    return [l["datos"] for l in lineas(mision, escenario) if l["evento"] == tipo]


def eventos_de(mision: str, escenario: str, tipo: str) -> list[dict]:
    return [d for d in de_tipo(mision, escenario, "evento") if d["tipo"] == tipo]


class DoceArchivos(unittest.TestCase):
    def test_todos_validan_contra_el_contrato_05(self):
        for mision in C.MISIONES:
            for escenario in C.ESCENARIOS:
                with self.subTest(mision=mision, escenario=escenario):
                    errores = validar_lineas(list(lineas(mision, escenario)))
                    self.assertEqual(errores, [], errores[:5])

    def test_empiezan_con_meta_y_el_modo_esta_marcado(self):
        for escenario in C.ESCENARIOS:
            d = lineas("demeter", escenario)[0]
            h = lineas("hermes", escenario)[0]
            self.assertEqual(d["evento"], "meta")
            self.assertEqual(d["datos"]["modo"], "simulacion")
            # PEN-W04: Hermes no tiene simulación, y debe quedar marcado como sintético
            self.assertEqual(h["datos"]["modo"], "sintetico")
            self.assertEqual((d["datos"]["nodo"], h["datos"]["nodo"]), (1, 2))

    def test_determinista(self):
        for mision in C.MISIONES:
            a = serializar(generar_lineas(mision, "backfill"))
            b = serializar(generar_lineas(mision, "backfill"))
            self.assertEqual(a, b)

    def test_serializacion_jsonl(self):
        texto = serializar(list(lineas("demeter", "lkp_descenso")))
        self.assertNotIn("\r", texto)
        self.assertTrue(texto.endswith("\n"))
        for linea in texto.splitlines():
            self.assertEqual(set(json.loads(linea)), {"t_rel_ms", "evento", "datos"})
        self.assertIn("Satélites", serializar(list(lineas("demeter", "nominal"))))  # UTF-8 sin escapes

    def test_demeter_y_hermes_se_distinguen_en_secundario_y_pi(self):
        d = de_tipo("demeter", "nominal", "estado")
        h = de_tipo("hermes", "nominal", "estado")
        self.assertTrue(all(e["secundario"] is not None for e in d))
        self.assertTrue(all(e["secundario"] is None for e in h))
        self.assertTrue(all(s["temp_pi_c"] is None for s in de_tipo("hermes", "nominal", "salud")))
        self.assertEqual(eventos_de("hermes", "nominal", "camaras"), [])
        self.assertEqual(len(eventos_de("demeter", "nominal", "camaras")), 1)


class CriterioDeAceptacion(unittest.TestCase):
    """T-612: el apogeo de Deméter difiere < 1 m de la simulación y los eventos < 0,1 s."""

    @classmethod
    def setUpClass(cls):
        cls.csv = leer_csv(C.CSV_DEMETER)
        cls.alt_sim = max(cls.csv.columnas["alt"])
        cls.ev = cls.csv.eventos

    def test_apogeo_en_los_estados(self):
        alt_jsonl = max(
            e["pos"]["alt_agl_m"] for e in de_tipo("demeter", "nominal", "estado") if e["pos"]
        )
        self.assertLess(abs(alt_jsonl - self.alt_sim), 1.0, (alt_jsonl, self.alt_sim))
        self.assertLess(abs(alt_jsonl - 669.0), 1.0)  # la cifra del plan

    def test_apogeo_en_el_evento_y_en_salud(self):
        valor = eventos_de("demeter", "nominal", "apogeo")[0]["valor"]
        self.assertLess(abs(valor - self.alt_sim), 1.0)
        apogeo_salud = max(s["apogeo_m"] for s in de_tipo("demeter", "nominal", "salud"))
        self.assertLess(abs(apogeo_salud - self.alt_sim), 1.0)

    def test_tiempos_de_los_eventos(self):
        correspondencia = {
            "despegue": "LIFTOFF",
            "fin_combustion": "BURNOUT",
            "eyeccion": "EJECTION_CHARGE",
            "apogeo": "APOGEE",
            "aterrizaje": "GROUND_HIT",
        }
        t0 = None
        for tipo, nombre in correspondencia.items():
            ev = eventos_de("demeter", "nominal", tipo)
            self.assertEqual(len(ev), 1, tipo)
            # t_mas_s cuenta desde el despegue (05 §2.5): se vuelve al reloj de la simulación
            t_sim_a = ev[0]["t_mas_s"] + self.ev["LIFTOFF"]
            self.assertLess(abs(t_sim_a - self.ev[nombre]), 0.1, tipo)
            # y por el reloj del cohete, exacto al milisegundo
            if t0 is None:
                t0 = ev[0]["t_ms"] - round(self.ev["LIFTOFF"] * 1000)
            self.assertLess(abs((ev[0]["t_ms"] - t0) / 1000.0 - self.ev[nombre]), 0.001, tipo)

    def test_cambio_de_fase_en_los_estados(self):
        # La primera muestra con cada fase llega poco después del evento (<= 1 ciclo en vuelo)
        estados = de_tipo("demeter", "nominal", "estado")
        for fase, nombre in (("BOOST", "LIFTOFF"), ("COAST", "BURNOUT"), ("APOGEE", "APOGEE")):
            primera = next(e for e in estados if e["fase"] == fase)
            t_sim = (primera["t_ms"] - C.ARRANQUE_COHETE_MS - 18000) / 1000.0
            self.assertGreaterEqual(t_sim, self.ev[nombre] - 1e-9, fase)
            self.assertLess(t_sim - self.ev[nombre], 0.1 + 1e-9, fase)

    def test_eyeccion_antes_del_apogeo_y_ruta_t10(self):
        # El caso nominal de Deméter: COAST -> eyección -> APOGEE -> DESCENT, sin FREE_FALL
        fases = [e["fase"] for e in eventos_de("demeter", "nominal", "fase")]
        self.assertEqual(
            fases, ["ARMED", "BOOST", "COAST", "APOGEE", "DESCENT", "LANDED"]
        )
        ej = eventos_de("demeter", "nominal", "eyeccion")[0]["t_ms"]
        ap = eventos_de("demeter", "nominal", "apogeo")[0]["t_ms"]
        self.assertLess(ej, ap)

    def test_hermes_usa_el_retardo_del_g80(self):
        bo = eventos_de("hermes", "nominal", "fin_combustion")[0]["t_ms"]
        ej = eventos_de("hermes", "nominal", "eyeccion")[0]["t_ms"]
        self.assertLess(abs((ej - bo) / 1000.0 - C.G80_RETARDO_S), 0.002)
        apogeo = eventos_de("hermes", "nominal", "apogeo")[0]["valor"]
        self.assertLess(abs(apogeo - self.alt_sim * C.HERMES_ESCALA_ALTURA), 0.1)


class Nominal(unittest.TestCase):
    def test_tasas_en_vuelo_y_en_tierra(self):
        est = de_tipo("demeter", "nominal", "estado")
        vuelo = [e for e in est if e["fase"] in ("BOOST", "COAST", "APOGEE", "DESCENT")]
        duracion_s = (vuelo[-1]["t_ms"] - vuelo[0]["t_ms"]) / 1000.0
        self.assertAlmostEqual(len(vuelo) / duracion_s, 9.0, delta=0.2)  # ~9 Hz (05 §2.2)
        tierra = [e for e in est if e["fase"] in ("PREFLIGHT", "ARMED")]
        dt = [b["t_ms"] - a["t_ms"] for a, b in zip(tierra, tierra[1:])]
        self.assertEqual(set(dt), {1000 // C.WEB_TASA_TIERRA_HZ})  # 1 Hz
        salud = de_tipo("demeter", "nominal", "salud")
        self.assertEqual({b["t_ms"] - a["t_ms"] for a, b in zip(salud, salud[1:])}, {1000})

    def test_seq_cuenta_los_nav_emitidos(self):
        est = de_tipo("demeter", "nominal", "estado")
        vuelo = [e for e in est if e["fase"] == "COAST"]
        for a, b in zip(vuelo, vuelo[1:]):
            esperado = (b["t_ms"] - a["t_ms"]) // 100  # ciclos entre los dos
            salto = (b["seq"] - a["seq"]) % 256
            # un ciclo de STATUS en medio no cuenta como NAV
            self.assertIn(salto, (esperado, esperado - 1))

    def test_pos_nula_antes_del_fix_y_lkp(self):
        est = de_tipo("demeter", "nominal", "estado")
        antes = [e for e in est if not e["flags"]["gnss_fix"]]
        self.assertTrue(antes)
        for e in antes:
            self.assertIsNone(e["pos"])
            self.assertIsNone(e["vel"])
            self.assertIsNone(e["lkp"])
        despues = [e for e in est if e["flags"]["gnss_fix"]]
        for e in despues:
            self.assertEqual(e["lkp"]["lat"], e["pos"]["lat"])

    def test_mission_id_solo_despues_de_armar(self):
        metas = de_tipo("demeter", "nominal", "meta")
        self.assertEqual([m["mission_id"] is None for m in metas], [True, False])
        self.assertEqual(metas[1]["mission_id"], (C.UTC_INICIO_MS + 8000) // 1000)

    def test_go_nogo_pasa_a_verde_antes_de_armar(self):
        salud = de_tipo("demeter", "nominal", "salud")
        self.assertFalse(salud[0]["go_nogo"]["listo"])
        # Al armar (8 s) ya estaba en verde
        self.assertTrue(salud[7]["go_nogo"]["listo"])
        self.assertEqual(len(salud[0]["go_nogo"]["condiciones"]), 7)
        self.assertEqual(len(de_tipo("hermes", "nominal", "salud")[0]["go_nogo"]["condiciones"]), 6)

    def test_proto_y_fw_version(self):
        self.assertEqual(de_tipo("demeter", "nominal", "meta")[0]["proto_version"], 3)
        self.assertEqual(de_tipo("hermes", "nominal", "meta")[0]["proto_version"], 2)
        self.assertEqual(de_tipo("demeter", "nominal", "salud")[0]["fw_version"], "a1b2c3d")
        self.assertIsNone(de_tipo("hermes", "nominal", "salud")[0]["fw_version"])

    def test_sin_alarma_en_el_descenso_nominal(self):
        for mision in C.MISIONES:
            self.assertEqual(eventos_de(mision, "nominal", "alarma_descenso"), [])
            self.assertFalse(any(e["alarmas"]["descenso_rapido"] for e in de_tipo(mision, "nominal", "estado")))

    def test_aceleracion_y_cuaternion_en_el_despegue(self):
        # Antes del despegue el eje de la nariz marca ~1 g (con g local de la simulación)
        est = [e for e in de_tipo("demeter", "nominal", "estado") if e["fase"] == "ARMED"]
        self.assertAlmostEqual(est[0]["acc_g"]["x"], 0.997, delta=0.002)
        # y en el impulso se ven unos 10 g (perfiles_vuelo §1)
        pico = max(e["acc_g"]["x"] for e in de_tipo("demeter", "nominal", "estado") if e["fase"] == "BOOST")
        self.assertTrue(8.0 < pico < 11.5, pico)

    def test_en_el_suelo_todo_en_reposo(self):
        ult = de_tipo("demeter", "nominal", "estado")[-1]
        self.assertEqual(ult["fase"], "LANDED")
        self.assertEqual(ult["vel"]["total_ms"], 0.0)
        self.assertTrue(ult["act"]["buzzer"])


class LkpDescenso(unittest.TestCase):
    def test_se_corta_a_120_m(self):
        for mision in C.MISIONES:
            est = de_tipo(mision, "lkp_descenso", "estado")
            ultimo = est[-1]
            self.assertEqual(ultimo["fase"], "DESCENT")
            self.assertTrue(
                C.LKP_CORTE_ALT_M <= ultimo["pos"]["alt_agl_m"] < C.LKP_CORTE_ALT_M + 2.5,
                ultimo["pos"]["alt_agl_m"],
            )
            self.assertEqual(eventos_de(mision, "lkp_descenso", "aterrizaje"), [])

    def test_el_latido_sigue_y_la_edad_crece(self):
        lat = de_tipo("demeter", "lkp_descenso", "estacion")
        self.assertGreater(lat[-1]["ultimo_paquete_hace_ms"], 20_000)
        self.assertGreater(lat[-1]["ultimo_paquete_hace_ms"], C.WEB_SIN_SENAL_S * 1000)
        edades = [x["ultimo_paquete_hace_ms"] for x in lat[-10:]]
        self.assertEqual(edades, sorted(edades))
        # antes del corte el dato era fresco
        self.assertLess(lat[5]["ultimo_paquete_hace_ms"], C.WEB_DATO_VIEJO_S * 1000)

    def test_el_enlace_se_degrada_antes_del_corte(self):
        est = de_tipo("demeter", "lkp_descenso", "estado")
        self.assertLess(est[-1]["enlace"]["rssi_dbm"], est[-60]["enlace"]["rssi_dbm"] - 10)
        self.assertGreater(max(e["enlace"]["perdidos_pct_10s"] for e in est[-30:]), 0.0)

    def test_el_lkp_queda_en_el_ultimo_estado(self):
        ultimo = de_tipo("demeter", "lkp_descenso", "estado")[-1]
        self.assertEqual(ultimo["lkp"]["alt_agl_m"], ultimo["pos"]["alt_agl_m"])


class DescensoRapido(unittest.TestCase):
    def test_alarma_activa_y_se_apaga_al_aterrizar(self):
        for mision in C.MISIONES:
            al = eventos_de(mision, "descenso_rapido", "alarma_descenso")
            self.assertEqual([a["activa"] for a in al], [True, False])
            self.assertLessEqual(al[0]["valor"], -C.ALARMA_DESCENSO_MS)  # justo en el cruce
            aterrizaje = eventos_de(mision, "descenso_rapido", "aterrizaje")[0]
            self.assertEqual(al[1]["t_ms"], aterrizaje["t_ms"])

    def test_la_bandera_de_los_estados_solo_en_descent(self):
        est = de_tipo("demeter", "descenso_rapido", "estado")
        con_alarma = [e for e in est if e["alarmas"]["descenso_rapido"]]
        self.assertTrue(len(con_alarma) > 10)
        self.assertTrue(all(e["fase"] == "DESCENT" for e in con_alarma))
        self.assertLess(min(e["vel"]["u_ms"] for e in con_alarma), -C.ALARMA_DESCENSO_MS)

    def test_dura_menos_que_el_nominal(self):
        rapido = lineas("demeter", "descenso_rapido")[-1]["t_rel_ms"]
        nominal = lineas("demeter", "nominal")[-1]["t_rel_ms"]
        self.assertLess(rapido, nominal)

    def test_el_apogeo_no_cambia(self):
        a = eventos_de("demeter", "descenso_rapido", "apogeo")[0]["valor"]
        b = eventos_de("demeter", "nominal", "apogeo")[0]["valor"]
        self.assertEqual(a, b)


class Backfill(unittest.TestCase):
    def test_progreso_hasta_completo(self):
        for mision in C.MISIONES:
            bf = de_tipo(mision, "backfill", "backfill")
            self.assertGreater(len(bf), 50)
            rec = [b["recibidos"] for b in bf]
            self.assertEqual(rec, sorted(rec))
            self.assertEqual(rec[0], 0)
            self.assertTrue(bf[0]["activo"] and not bf[0]["completo"])
            self.assertTrue(bf[-1]["completo"] and not bf[-1]["activo"])
            self.assertEqual(bf[-1]["recibidos"], bf[-1]["esperados"])
            self.assertEqual(bf[-1]["progreso"], 1.0)
            self.assertEqual(sum(1 for b in bf if b["completo"]), 1)

    def test_unos_850_registros_para_deméter(self):
        esperados = de_tipo("demeter", "backfill", "backfill")[0]["esperados"]
        self.assertTrue(800 <= esperados <= 900, esperados)  # protocolo §7 y perfiles_vuelo §1

    def test_hay_huecos_en_el_estado_y_se_reflejan_en_perdidos(self):
        est = [e for e in de_tipo("demeter", "backfill", "estado") if e["fase"] in ("COAST", "DESCENT")]
        saltos = [(b["seq"] - a["seq"]) % 256 for a, b in zip(est, est[1:])]
        self.assertGreater(sum(1 for s in saltos if s > 1), 20)
        self.assertGreater(max(e["enlace"]["perdidos_pct_10s"] for e in est), 10.0)

    def test_act_backfill_coincide_con_la_transmision(self):
        est = de_tipo("demeter", "backfill", "estado")
        activo = [e for e in est if e["act"]["backfill"]]
        self.assertTrue(activo)
        self.assertTrue(all(e["fase"] == "LANDED" for e in activo))
        bf = de_tipo("demeter", "backfill", "backfill")
        self.assertFalse(est[-1]["act"]["backfill"])  # ya terminó
        self.assertTrue(bf[-1]["completo"])


class EsperaRampa(unittest.TestCase):
    def test_30_minutos_en_preflight_a_1_hz(self):
        for mision in C.MISIONES:
            est = de_tipo(mision, "espera_rampa", "estado")
            self.assertTrue(all(e["fase"] == "PREFLIGHT" for e in est))
            self.assertAlmostEqual(len(est), 1800, delta=2)
            dt = {b["t_ms"] - a["t_ms"] for a, b in zip(est, est[1:])}
            self.assertEqual(dt, {1000})
            self.assertGreaterEqual(lineas(mision, "espera_rampa")[-1]["t_rel_ms"], 1_799_000)
            self.assertEqual(eventos_de(mision, "espera_rampa", "despegue"), [])
            self.assertTrue(all(s["mission_id"] is None for s in de_tipo(mision, "espera_rampa", "salud")))

    def test_la_bateria_baja_lento(self):
        est = de_tipo("demeter", "espera_rampa", "estado")
        self.assertGreater(est[0]["bat_pct"], est[-1]["bat_pct"])
        self.assertGreater(est[-1]["bat_pct"], C.BAT_MIN_ARM_PCT)


class RelayCaido(unittest.TestCase):
    def test_hueco_de_20_s_y_meta_al_reconectar(self):
        for mision in C.MISIONES:
            ls = lineas(mision, "relay_caido")
            t = [l["t_rel_ms"] for l in ls]
            huecos = [b - a for a, b in zip(t, t[1:])]
            self.assertGreaterEqual(max(huecos), C.RELAY_CAIDO_DURACION_S * 1000 - 200)
            i = huecos.index(max(huecos))
            self.assertEqual(ls[i + 1]["evento"], "meta")
            # el latido de la estación también desaparece durante el hueco
            ini, fin = t[i], t[i + 1]
            self.assertFalse(any(ini < l["t_rel_ms"] < fin for l in ls))

    def test_el_cohete_sigue_volando_durante_el_hueco(self):
        # los seq saltan al reconectar (el relay no repite lo perdido)
        est = de_tipo("demeter", "relay_caido", "estado")
        saltos = [(b["seq"] - a["seq"]) % 256 for a, b in zip(est, est[1:])]
        self.assertGreaterEqual(max(saltos), 100)


class ValidadorPropio(unittest.TestCase):
    """El validador debe rechazar lo que el contrato prohíbe."""

    def base(self):
        return json.loads(json.dumps(de_tipo("demeter", "nominal", "estado")[20]))

    def test_acepta_un_mensaje_correcto(self):
        self.assertEqual(validar_mensaje("estado", self.base()), [])

    def test_campo_omitido(self):
        d = self.base()
        del d["lkp"]
        self.assertTrue(any("faltan" in e for e in validar_mensaje("estado", d)))

    def test_campo_extra(self):
        d = self.base()
        d["extra"] = 1
        self.assertTrue(validar_mensaje("estado", d))

    def test_tipo_incorrecto(self):
        d = self.base()
        d["seq"] = "5"
        self.assertTrue(validar_mensaje("estado", d))
        d = self.base()
        d["flags"]["gnss_fix"] = 1
        self.assertTrue(validar_mensaje("estado", d))

    def test_rango_y_decimales(self):
        d = self.base()
        d["bat_pct"] = 120
        self.assertTrue(validar_mensaje("estado", d))
        d = self.base()
        d["pos"]["lat"] = 6.58234567
        self.assertTrue(validar_mensaje("estado", d))

    def test_null_donde_no_se_permite(self):
        d = self.base()
        d["acc_g"]["x"] = None
        self.assertTrue(validar_mensaje("estado", d))

    def test_cuaternion_no_unitario(self):
        d = self.base()
        d["q"]["w"] = 0.5
        d["q"]["x"] = 0.0
        d["q"]["y"] = 0.0
        d["q"]["z"] = 0.0
        self.assertTrue(any("unitario" in e for e in validar_mensaje("estado", d)))


class ConstantesReplicadas(unittest.TestCase):
    """Las WEB_* de constantes.py deben coincidir con docs/02_requisitos/constantes.md §9."""

    def test_web_coincide_con_el_documento(self):
        texto = (C.RAIZ_REPO / "docs" / "02_requisitos" / "constantes.md").read_text(encoding="utf-8")
        seccion = texto.split("## 9.", 1)[1]
        encontradas = 0
        for nombre, valor in re.findall(r"^\| `(WEB_[A-Z_]+)` \| (\d+)", seccion, re.M):
            self.assertTrue(hasattr(C, nombre), nombre)
            self.assertEqual(getattr(C, nombre), int(valor), nombre)
            encontradas += 1
        self.assertGreaterEqual(encontradas, 9)

    def test_fases_y_numeros_de_proyecto(self):
        texto = (C.RAIZ_REPO / "docs" / "02_requisitos" / "constantes.md").read_text(encoding="utf-8")
        self.assertIn("510 m s.n.m.", texto)
        self.assertEqual(C.SITIO_ALT_MSL_M, 510.0)
        self.assertIn("| `ALARMA_DESCENSO_MS` | 10,0 |", texto)
        self.assertEqual(C.ALARMA_DESCENSO_MS, 10.0)
        self.assertIn("| `APOGEO_VZ_SALIDA_MS` | 2,0 (P) |", texto)
        self.assertEqual(C.APOGEO_VZ_SALIDA_MS, 2.0)
        self.assertIn("| `BAT_MIN_ARM_PCT` | 60 (P) |", texto)
        self.assertEqual(C.BAT_MIN_ARM_PCT, 60)
        self.assertIn("| `GO_SV_MIN` | 6 |", texto)
        self.assertEqual(C.GO_SV_MIN, 6)


class ArchivosVersionados(unittest.TestCase):
    """Los JSONL de gui/web/dev/datos/ deben ser exactamente lo que genera el código."""

    def test_coinciden_con_lo_generado(self):
        faltan = []
        for mision in C.MISIONES:
            for escenario in C.ESCENARIOS:
                ruta = C.SALIDA_POR_DEFECTO / f"{mision}_{escenario}.jsonl"
                if not ruta.exists():
                    faltan.append(ruta.name)
                    continue
                en_disco = ruta.read_bytes().replace(b"\r\n", b"\n").decode("utf-8")
                self.assertEqual(en_disco, serializar(list(lineas(mision, escenario))), ruta.name)
        self.assertEqual(faltan, [])


if __name__ == "__main__":
    unittest.main()
