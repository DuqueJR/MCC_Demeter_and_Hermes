import math
from pathlib import Path
import unittest

import demeter_pose as dp

CAMS = dp.load_cameras(Path(__file__).resolve().parent / "eyes_of_demeter" / "calibration" / "camaras.json")
NOSE_DOWN = [math.cos(math.radians(-45)), 0.0, math.sin(math.radians(-45)), 0.0]     # pitch -90: X del cuerpo hacia abajo


def row(t_s, q, flags=dp.F_EKF | dp.F_ATT | dp.F_POS | dp.F_ALT | dp.F_TIME):
    payload = dp.encode_pose(int(t_s * 1e6), int(t_s * 50), flags, 6.5560, -75.8270, 250.0, 510.0,
                             (1.2, -0.4, 8.9), q, (0.0, 0.0, 180.0), 1.2, 2.5, 0.4)
    return dict(dp.decode_pose(payload), pi_ts=t_s)


class PoseTests(unittest.TestCase):
    def test_roundtrip(self):
        r = row(10.0, NOSE_DOWN)
        self.assertEqual(r["alt_msl"], 760.0)
        self.assertAlmostEqual(r["q"][2], -0.7071, places=3)
        self.assertTrue(dp.decode_flags(r["flags"])["hora"])
        self.assertEqual(dp.POSE_STRUCT.size, 54)

    def test_sd_sin_estimar_es_none(self):
        # La LilyGo sin EKF manda 0xFFFF en sd_actitud y sd_alt: no son 655.35 grados ni metros
        payload = dp.encode_pose(10_000_000, 1, dp.F_POS | dp.F_TIME, 6.5, -75.8, 1.0, 1590.0, (0, 0, 0), [1, 0, 0, 0], (0, 0, 0),
                                 None, 7.28, None)
        r = dict(dp.decode_pose(payload), pi_ts=10.0)
        self.assertIsNone(r["sd_actitud_deg"])
        self.assertIsNone(r["sd_alt_m"])
        self.assertAlmostEqual(r["sd_pos_m"], 7.28)
        p = dp.interpolate_pose([r, dict(r, utc_us=10_020_000, seq=2)], 10_010_000, max_gap_s=0.1)
        if p is not None:
            self.assertIsNone(p["sd_alt_m"])
            self.assertAlmostEqual(p["sd_pos_m"], 7.28)

    def test_cameras_30_deg_from_nadir_nose_down(self):
        for cam in CAMS.values():
            c = dp.camera_in_ned({"q_cuerpo_a_ned": NOSE_DOWN}, cam)
            self.assertAlmostEqual(c["angulo_desde_nadir_deg"], 30.0, places=4)
        # opuestas: rumbos a 180 grados
        r0 = dp.camera_in_ned({"q_cuerpo_a_ned": NOSE_DOWN}, CAMS[0])["rumbo_eje_deg"]
        r1 = dp.camera_in_ned({"q_cuerpo_a_ned": NOSE_DOWN}, CAMS[1])["rumbo_eje_deg"]
        self.assertAlmostEqual((r0 - r1) % 360, 180.0, places=4)

    def test_cameras_60_deg_above_horizon_nose_up(self):
        nose_up = [math.cos(math.radians(45)), 0.0, math.sin(math.radians(45)), 0.0]
        for cam in CAMS.values():
            axis = dp.camera_in_ned({"q_cuerpo_a_ned": nose_up}, cam)["eje_optico_ned"]
            self.assertAlmostEqual(math.degrees(math.asin(-axis[2])), 60.0, places=4)

    def test_image_horizontal_is_horizontal_when_vertical(self):
        for cam in CAMS.values():
            q = dp.q_mul(NOSE_DOWN, cam["q_camara_cuerpo"])
            self.assertAlmostEqual(dp.q_rotate(q, [1.0, 0.0, 0.0])[2], 0.0, places=6)

    def test_clock_residual_and_mission_time(self):
        # la Pi va 3.000 ms atrasada respecto a la mision; cada trama llega con 0.2-2 ms de latencia de lectura
        baud = 115200
        samples = []
        for i in range(200):
            t = 100.0 + i * 0.02
            r = row(t, NOSE_DOWN)
            r["pi_ts"] = t + dp.frame_seconds(baud) - 0.003 + (0.0002 if i % 7 == 0 else 0.002)
            samples.append(r)
        resid = dp.mission_offset_at(samples, 102.0, baud)
        self.assertAlmostEqual(resid * 1e3, 2.8, places=3)       # 3 ms menos la latencia minima (0.2 ms)
        rec = dp.frame_record({"frame_wallclock_ns": int(101.0e9), "exposure_time_us": 2000, "width": 4608, "height": 2592},
                              0, CAMS, samples, baud, 0.5)
        self.assertTrue(rec["pose"]["valida"])
        self.assertTrue(rec["tiempo"]["hora_de_mision"])
        self.assertAlmostEqual(rec["camara_en_ned"]["angulo_desde_nadir_deg"], 30.0, places=3)

    def test_chrony_feeder_sends_best_of_window(self):
        import socket, tempfile, struct
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "c.sock"
            srv = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
            srv.bind(str(path))
            f = dp.ChronyFeeder(path, window_s=0.1)
            for i, o in enumerate([0.0010, 0.0030, 0.0020, 0.0025]):
                f.add(o, 50.0 + i * 0.04)
            sec, usec, off, pulse, leap, pad, magic = dp.ChronyFeeder.SAMPLE.unpack(srv.recv(64))
            self.assertEqual(magic, dp.ChronyFeeder.MAGIC)
            self.assertAlmostEqual(off, 0.0030)
            self.assertEqual(sec, 50)
            f.close()
            srv.close()


if __name__ == "__main__":
    unittest.main()


class ErrorCodeTests(unittest.TestCase):
    """Motivo del error de la Pi hacia la LilyGo (D-056): los textos reales de missiond."""

    def test_motivos(self):
        from demeter_protocol import ErrorCode, error_code
        casos = {
            "espacio SD insuficiente para captura+revelado al límite de 95s: libres=1": ErrorCode.SD_ESPACIO,
            "SD/tmpfs no sostiene ni 1 FPS durante 95s": ErrorCode.SD_LENTA,
            "RAM disponible insuficiente para el backlog proyectado": ErrorCode.RAM,
            "/mnt/ramcam no es un montaje tmpfs": ErrorCode.RAM,
            "telemetryd no confirmó que el puerto serial está abierto": ErrorCode.TELEMETRIA,
            "rpicam-vid terminó durante ascenso con estado 1": ErrorCode.CAMARA,
            "touchdown; demeter_ingestd exit=2: x": ErrorCode.PROCESO,
            "directorio de grabaciones no escribible: /x": ErrorCode.ARCHIVOS,
            "fallo interno en ARM: KeyError: 3": ErrorCode.OTRO,
        }
        for texto, esperado in casos.items():
            self.assertEqual(error_code(texto), esperado, texto)
        self.assertEqual(error_code(None), ErrorCode.NINGUNO)
        self.assertTrue(all(int(c) < 32 for c in ErrorCode))      # cabe en los 5 bits de TELEM.actuators


class MontajeV2Tests(unittest.TestCase):
    """camaras.json v2 (Pablo, 2026-11-05): cam0 en la cara de la marca (-Z), cam1 en la opuesta (+Z), rotadas 180 grados."""

    def test_lados_y_rotacion(self):
        for idx, lado in ((0, -1.0), (1, 1.0)):
            q = CAMS[idx]["q_camara_cuerpo"]
            eje = dp.q_rotate(q, [0.0, 0.0, 1.0])
            abajo = dp.q_rotate(q, [0.0, 1.0, 0.0])
            horiz = dp.q_rotate(q, [1.0, 0.0, 0.0])
            self.assertAlmostEqual(eje[0], math.cos(math.radians(30)), places=6)        # 30 grados del eje, hacia la nariz
            self.assertAlmostEqual(eje[2], lado * 0.5, places=6)                        # cam0 hacia -Z (marca), cam1 hacia +Z
            self.assertAlmostEqual(abs(horiz[1]), 1.0, places=6)                        # horizontal de la imagen a lo largo de Y
            self.assertGreater(abajo[0], 0.0)                                           # rotada: lo bajo de la imagen mira a la nariz
