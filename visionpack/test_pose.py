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
