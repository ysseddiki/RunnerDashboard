"""Tests comparaison intelligente de deux sorties (sans DB)."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.run_comparison import (
    compare_activities,
    days_between,
    interval_label_fr,
    order_pair,
)


def _act(
    *,
    id: int,
    days_ago: int,
    distance_m: float = 10000,
    pace_sec: float = 330,
    hr: float | None = 145,
    session_type: str | None = "ef",
    elev: float = 50,
    cadence: float | None = 170,
    decoupling: float | None = 6.0,
    cv: float | None = 0.05,
    temp_c: float | None = 15.0,
) -> SimpleNamespace:
    now = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
    mps = 1000.0 / pace_sec
    weather = {"temperature_c": temp_c} if temp_c is not None else None
    return SimpleNamespace(
        id=id,
        name=f"Sortie {id}",
        sport_type="Run",
        session_type=session_type,
        start_date=now - timedelta(days=days_ago),
        distance_m=distance_m,
        moving_time_s=int(distance_m / mps) if mps else None,
        average_speed_mps=mps,
        average_heartrate=hr,
        cadence_ppm=cadence,
        total_elevation_gain_m=elev,
        features_json={"decoupling_pct": decoupling, "cv_pace": cv},
        weather_json=weather,
    )


class TestInterval(unittest.TestCase):
    def test_same_day(self):
        self.assertEqual(interval_label_fr(0), "le même jour")

    def test_days(self):
        self.assertEqual(interval_label_fr(12), "12 jours")

    def test_weeks(self):
        self.assertEqual(interval_label_fr(14), "2 semaines")


class TestOrderPair(unittest.TestCase):
    def test_orders_older_first(self):
        a = _act(id=1, days_ago=2)
        b = _act(id=2, days_ago=10)
        older, newer = order_pair(a, b)
        self.assertEqual(older.id, 2)
        self.assertEqual(newer.id, 1)
        self.assertEqual(days_between(older.start_date, newer.start_date), 8)


class TestCompare(unittest.TestCase):
    def test_pace_improvement_same_type(self):
        older = _act(id=1, days_ago=14, pace_sec=340, hr=150)
        newer = _act(id=2, days_ago=2, pace_sec=320, hr=145)
        result = compare_activities(older, newer)
        self.assertEqual(result["days_between"], 12)
        self.assertIn("12 jours", result["intro_fr"])
        self.assertEqual(result["overall_direction"], "mieux")
        pace = next(m for m in result["metrics"] if m["key"] == "pace")
        self.assertEqual(pace["direction"], "mieux")

    def test_distance_caveat(self):
        older = _act(id=1, days_ago=20, distance_m=5000, pace_sec=320)
        newer = _act(id=2, days_ago=2, distance_m=20000, pace_sec=340)
        result = compare_activities(older, newer)
        self.assertFalse(result["distances_comparable"])
        self.assertTrue(any("Distances" in c for c in result["caveats_fr"]))

    def test_different_types_no_forced_progress(self):
        older = _act(id=1, days_ago=10, session_type="ef", pace_sec=340)
        newer = _act(id=2, days_ago=1, session_type="vma", pace_sec=300)
        result = compare_activities(older, newer)
        self.assertTrue(any("Types" in c for c in result["caveats_fr"]))
        self.assertEqual(result["overall_direction"], "indetermine")

    def test_same_day_intro(self):
        older = _act(id=1, days_ago=0, pace_sec=330)
        newer = _act(id=2, days_ago=0, pace_sec=320)
        # force same calendar day with different ids
        newer.start_date = older.start_date
        result = compare_activities(older, newer)
        self.assertEqual(result["days_between"], 0)
        self.assertIn("même jour", result["intro_fr"])


if __name__ == "__main__":
    unittest.main()
