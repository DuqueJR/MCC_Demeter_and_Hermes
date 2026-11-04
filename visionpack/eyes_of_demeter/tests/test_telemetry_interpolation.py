import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))     # visionpack/, donde vive demeter_pose
import demeter_pose as dp


def sample(t_s, q, alt):
    return {"utc_us": int(t_s * 1e6), "pi_ts": t_s, "seq": int(t_s), "flags": dp.F_EKF | dp.F_ATT | dp.F_TIME,
            "lat": 6.5, "lon": -75.8, "alt_agl": alt, "alt_msl": alt + 510, "v_ned": [0, 0, 9], "q": q,
            "giro_dps": [0, 0, 0], "sd_actitud_deg": 1, "sd_pos_m": 2, "sd_alt_m": 0.5}


class PoseInterpolationTests(unittest.TestCase):
    def test_slerp_and_linear_position(self):
        a = sample(1.0, [1.0, 0.0, 0.0, 0.0], 10.0)
        b = sample(3.0, [0.0, 0.0, 0.0, 1.0], 30.0)          # 180 grados de guinada
        p = dp.interpolate_pose([a, b], 2_000_000, 2.5)
        self.assertTrue(p["valida"])
        self.assertAlmostEqual(p["alt_agl_m"], 20.0)
        self.assertAlmostEqual(abs(p["q_cuerpo_a_ned"][0]), 0.7071, places=3)   # a mitad de camino: 90 grados

    def test_no_extrapolation_or_wide_gap(self):
        a = sample(1.0, [1.0, 0, 0, 0], 0.0)
        b = sample(4.0, [1.0, 0, 0, 0], 3.0)
        self.assertFalse(dp.interpolate_pose([a, b], 500_000, 4.0)["valida"])
        self.assertFalse(dp.interpolate_pose([a, b], 2_000_000, 2.0)["valida"])


if __name__ == "__main__":
    unittest.main()
