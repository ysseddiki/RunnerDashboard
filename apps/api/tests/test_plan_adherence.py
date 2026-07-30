"""Tests plan_adherence matching (sans DB complète)."""

from __future__ import annotations

import unittest
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from app.services.plan_adherence import _match_score, _parse_date, _parse_distance_km, build_adherence


def _act(**kwargs):
    base = dict(
        id=1,
        name="Run",
        sport_type="Run",
        activity_type="Run",
        session_type="tempo",
        distance_m=10000.0,
        start_date=datetime(2026, 7, 20, 8, 0, tzinfo=timezone.utc),
        features_json={"trimp_edwards": 40},
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


class TestParsers(unittest.TestCase):
    def test_parse_date(self):
        self.assertEqual(_parse_date("2026-07-20"), date(2026, 7, 20))
        self.assertIsNone(_parse_date("nope"))

    def test_parse_km(self):
        self.assertEqual(_parse_distance_km("10 km facile"), 10.0)
        self.assertEqual(_parse_distance_km("8km"), 8.0)


class TestMatchScore(unittest.TestCase):
    def test_same_day_type(self):
        item = {"session_type": "tempo", "duration_or_distance": "10 km"}
        a = _act()
        score, type_match = _match_score(item, a, date(2026, 7, 20))
        self.assertGreaterEqual(score, 2)
        self.assertTrue(type_match)

    def test_wrong_day(self):
        item = {"session_type": "tempo"}
        a = _act()
        score, _ = _match_score(item, a, date(2026, 7, 10))
        self.assertEqual(score, 0)


class TestBuildAdherence(unittest.TestCase):
    @patch("app.services.plan_adherence._raw_plan")
    def test_empty_plan(self, mock_plan):
        mock_plan.return_value = {"plan": [], "updated_at": None}
        db = SimpleNamespace()
        out = build_adherence(db, 1, now=datetime(2026, 7, 25, tzinfo=timezone.utc))
        self.assertFalse(out["available"])

    @patch("app.services.plan_adherence._raw_plan")
    def test_match_and_miss(self, mock_plan):
        mock_plan.return_value = {
            "plan": [
                {
                    "date": "2026-07-20",
                    "session_type": "tempo",
                    "title": "Tempo",
                    "duration_or_distance": "10 km",
                },
                {
                    "date": "2026-07-22",
                    "session_type": "ef",
                    "title": "EF manquée",
                    "duration_or_distance": "8 km",
                },
                {
                    "date": "2026-07-28",
                    "session_type": "seuil",
                    "title": "Futur",
                    "duration_or_distance": "6 km",
                },
            ],
            "updated_at": "2026-07-19T00:00:00+00:00",
            "summary": "ok",
        }

        act = _act(id=42)
        out = build_adherence(
            SimpleNamespace(),
            1,
            now=datetime(2026, 7, 25, tzinfo=timezone.utc),
            activities=[act],
        )
        self.assertTrue(out["available"])
        self.assertEqual(out["matched"], 1)
        self.assertEqual(out["missed"], 1)
        self.assertEqual(out["upcoming"], 1)
        self.assertEqual(out["adherence_pct"], 50.0)
        statuses = {i["title"]: i["status"] for i in out["items"]}
        self.assertEqual(statuses["Tempo"], "matched")
        self.assertEqual(statuses["EF manquée"], "missed")
        self.assertEqual(statuses["Futur"], "upcoming")


if __name__ == "__main__":
    unittest.main()
