"""Tests session_type_trends (sans DB)."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.session_type_trends import (
    build_from_activities,
    direction_lower_better,
    trend_for_type,
)


def _act(
    *,
    days_ago: int,
    session_type: str,
    pace_sec: float,
    hr: float | None = 140,
    decoupling: float | None = 5.0,
    cv: float | None = 0.05,
) -> SimpleNamespace:
    now = datetime(2026, 7, 30, 12, 0, tzinfo=timezone.utc)
    mps = 1000.0 / pace_sec
    return SimpleNamespace(
        sport_type="Run",
        activity_type="Run",
        session_type=session_type,
        start_date=now - timedelta(days=days_ago),
        average_speed_mps=mps,
        average_heartrate=hr,
        features_json={"decoupling_pct": decoupling, "cv_pace": cv},
    )


class TestDirection(unittest.TestCase):
    def test_pace_faster_is_mieux(self):
        self.assertEqual(direction_lower_better(300.0, 310.0), "mieux")

    def test_stable(self):
        self.assertEqual(direction_lower_better(300.0, 301.0), "stable")

    def test_slower(self):
        self.assertEqual(direction_lower_better(320.0, 300.0), "moins_bon")


class TestTrendForType(unittest.TestCase):
    def test_improvement(self):
        # recent faster than prior
        recent = [_act(days_ago=5, session_type="seuil", pace_sec=300)]
        prior = [
            _act(days_ago=40, session_type="seuil", pace_sec=320),
            _act(days_ago=50, session_type="seuil", pace_sec=318),
        ]
        t = trend_for_type(recent, prior, session_type="seuil")
        self.assertTrue(t["available"])
        self.assertEqual(t["direction"], "mieux")
        self.assertLess(t["pace_delta_pct"], 0)

    def test_undersampled(self):
        recent = [_act(days_ago=3, session_type="tempo", pace_sec=310)]
        t = trend_for_type(recent, [], session_type="tempo")
        self.assertFalse(t["available"])


class TestBuildFromActivities(unittest.TestCase):
    def test_ample(self):
        now = datetime(2026, 7, 30, 12, 0, tzinfo=timezone.utc)
        rows = [
            _act(days_ago=5, session_type="tempo", pace_sec=305),
            _act(days_ago=12, session_type="tempo", pace_sec=308),
            _act(days_ago=40, session_type="tempo", pace_sec=320),
            _act(days_ago=55, session_type="tempo", pace_sec=322),
        ]
        # Fix start_date relative to fixed now used in _act — already fixed date
        payload = build_from_activities(rows, now=now, days=84)
        self.assertTrue(payload["available"])
        tempo = next(t for t in payload["trends"] if t["session_type"] == "tempo")
        self.assertTrue(tempo["available"])
        self.assertEqual(tempo["direction"], "mieux")


if __name__ == "__main__":
    unittest.main()
