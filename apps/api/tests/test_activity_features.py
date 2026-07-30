"""Tests unitaires features (sans DB)."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.activity_features import (
    compute_features,
    is_running_eligible,
    profile_fingerprint,
)


def _stream(data: list) -> dict:
    return {"data": data, "original_size": len(data), "resolution": "high"}


def _make_activity(**kwargs):
    base = dict(
        id=1,
        sport_type="Run",
        activity_type="Run",
        session_type=None,
        distance_m=5000.0,
        moving_time_s=1800,
        average_heartrate=None,
        start_lat=48.0,
        start_lng=2.0,
        streams_json=None,
        features_json=None,
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def _steady_streams(*, n: int = 600, speed: float = 3.0, hr: float = 140.0):
    """10 min @ 1 Hz approx via time step 1s, distance accumulating."""
    time_s = list(range(n))
    distance = [i * speed for i in range(n)]
    velocity = [speed] * n
    heartrate = [hr] * n
    cadence = [85.0] * n  # RPM
    moving = [1] * n
    return {
        "time": _stream(time_s),
        "distance": _stream(distance),
        "velocity_smooth": _stream(velocity),
        "heartrate": _stream(heartrate),
        "cadence": _stream(cadence),
        "moving": _stream(moving),
    }


def _interval_streams():
    """Alternance récup lente / travail rapide."""
    time_s: list[int] = []
    distance: list[float] = []
    velocity: list[float] = []
    heartrate: list[float] = []
    moving: list[int] = []
    t = 0
    d = 0.0
    for _rep in range(5):
        for _ in range(40):  # récup
            time_s.append(t)
            distance.append(d)
            velocity.append(2.4)
            heartrate.append(130)
            moving.append(1)
            d += 2.4
            t += 1
        for _ in range(60):  # travail
            time_s.append(t)
            distance.append(d)
            velocity.append(4.2)
            heartrate.append(170)
            moving.append(1)
            d += 4.2
            t += 1
    return {
        "time": _stream(time_s),
        "distance": _stream(distance),
        "velocity_smooth": _stream(velocity),
        "heartrate": _stream(heartrate),
        "moving": _stream(moving),
    }


ZONES = {
    "available": True,
    "method": "pct_max",
    "max_hr_used": 190,
    "resting_hr_used": None,
    "zones": [
        {"id": "Z1", "label_fr": "Récupération", "hr_low": 95, "hr_high": 114},
        {"id": "Z2", "label_fr": "EF", "hr_low": 114, "hr_high": 133},
        {"id": "Z3", "label_fr": "Tempo", "hr_low": 133, "hr_high": 152},
        {"id": "Z4", "label_fr": "Seuil", "hr_low": 152, "hr_high": 171},
        {"id": "Z5", "label_fr": "VMA", "hr_low": 171, "hr_high": 190},
    ],
}


class TestRunningEligible(unittest.TestCase):
    def test_run_ok(self):
        self.assertTrue(is_running_eligible(_make_activity(sport_type="Run")))

    def test_walk_excluded(self):
        self.assertFalse(is_running_eligible(_make_activity(sport_type="Walk")))

    def test_trail_ok(self):
        self.assertTrue(is_running_eligible(_make_activity(sport_type="TrailRun")))


class TestFeaturesSteady(unittest.TestCase):
    def test_ef_with_hr_zones(self):
        act = _make_activity(
            session_type="ef",
            streams_json=_steady_streams(hr=125.0),
            average_heartrate=125.0,
        )
        feat = compute_features(act, zones=ZONES)
        self.assertEqual(feat["schema_version"], 1)
        self.assertTrue(feat["quality_flags"]["has_streams"])
        self.assertTrue(feat["quality_flags"]["has_hr"])
        self.assertIsNotNone(feat["time_in_zone"])
        self.assertIsNotNone(feat["trimp_edwards"])
        self.assertGreater(feat["trimp_edwards"], 0)
        self.assertEqual(feat["session"]["family"], "easy")
        self.assertIsNotNone(feat["splits_km"])

    def test_without_hr(self):
        streams = _steady_streams()
        del streams["heartrate"]
        act = _make_activity(session_type="ef", streams_json=streams, average_heartrate=None)
        feat = compute_features(act, zones=ZONES)
        self.assertIsNone(feat["time_in_zone"])
        self.assertIsNone(feat["trimp_edwards"])
        keys = {u["key"] for u in feat["unavailable"]}
        self.assertIn("time_in_zone", keys)


class TestFeaturesIntervals(unittest.TestCase):
    def test_fractionne_detection(self):
        act = _make_activity(
            session_type="fractionne",
            streams_json=_interval_streams(),
            average_heartrate=150.0,
            distance_m=3000.0,
        )
        feat = compute_features(act, zones=ZONES)
        self.assertEqual(feat["session"]["family"], "intervals")
        self.assertIsNotNone(feat["intervals"])
        self.assertGreaterEqual(feat["intervals"]["count"], 3)


class TestFingerprint(unittest.TestCase):
    def test_zones_fp_stable(self):
        a = profile_fingerprint(ZONES)
        b = profile_fingerprint(ZONES)
        self.assertEqual(a, b)
        self.assertEqual(profile_fingerprint({"available": False}), "no-zones")


if __name__ == "__main__":
    unittest.main()
