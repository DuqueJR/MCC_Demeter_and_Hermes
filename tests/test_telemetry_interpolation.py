import unittest

from demeter_postprocess import interpolate_telemetry


class TelemetryInterpolationTests(unittest.TestCase):
    def test_linear_values_and_circular_yaw(self):
        samples = [
            {"pi_ts": 1.0, "lilygo_ts": 1.0, "alt": 10.0, "roll": 0.0, "pitch": 0.0, "yaw": 359.0},
            {"pi_ts": 3.0, "lilygo_ts": 3.0, "alt": 30.0, "roll": 2.0, "pitch": 4.0, "yaw": 1.0},
        ]
        result = interpolate_telemetry(samples, 2.0, 2.0)
        self.assertTrue(result["valid"])
        self.assertEqual(result["alt"], 20.0)
        self.assertAlmostEqual(result["yaw"], 0.0)

    def test_no_extrapolation_or_wide_gap(self):
        samples = [
            {"pi_ts": 1.0, "lilygo_ts": 1.0, "alt": 0.0, "roll": 0.0, "pitch": 0.0, "yaw": 0.0},
            {"pi_ts": 4.0, "lilygo_ts": 4.0, "alt": 3.0, "roll": 0.0, "pitch": 0.0, "yaw": 0.0},
        ]
        self.assertFalse(interpolate_telemetry(samples, 0.5, 4.0)["valid"])
        self.assertFalse(interpolate_telemetry(samples, 2.0, 2.0)["valid"])


if __name__ == "__main__":
    unittest.main()
