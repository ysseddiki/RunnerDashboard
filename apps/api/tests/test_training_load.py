"""Tests training_load (sans DB)."""

from __future__ import annotations

import unittest

from app.services.training_load import compute_ema_series, form_status


class TestFormStatus(unittest.TestCase):
    def test_thresholds(self):
        self.assertEqual(form_status(-25), "fatigue")
        self.assertEqual(form_status(-10), "productif")
        self.assertEqual(form_status(0), "neutre")
        self.assertEqual(form_status(12), "frais")


class TestEma(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(compute_ema_series([]), [])

    def test_monotonic_load(self):
        daily = [50.0] * 21
        series = compute_ema_series(daily)
        self.assertEqual(len(series), 21)
        # ATL converges faster than CTL
        self.assertGreater(series[-1]["atl"], series[5]["atl"])
        self.assertGreater(series[-1]["ctl"], 0)
        # After sustained load, TSB should be negative (ATL > CTL early) then approach 0
        self.assertIsInstance(series[-1]["tsb"], float)

    def test_rest_day_zeros(self):
        daily = [40.0, 0.0, 0.0, 40.0]
        series = compute_ema_series(daily)
        self.assertEqual(series[1]["daily_trimp"], 0.0)
        self.assertLess(series[1]["atl"], series[0]["atl"])


if __name__ == "__main__":
    unittest.main()
