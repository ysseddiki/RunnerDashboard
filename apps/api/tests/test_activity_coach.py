"""Tests hints coach activité (sans LLM)."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.activity_coach import (
    _activity_context,
    insight_hints,
    refresh_analysis_hints,
)


class TestInsightHints(unittest.TestCase):
    def test_endurance_active_not_generic(self):
        hints = insight_hints("endurance_active", "route")
        self.assertEqual(hints[0]["title"], "Focus")
        self.assertNotIn("taguez", hints[0]["text"].lower())
        self.assertNotIn("sans type", hints[1]["text"].lower())
        self.assertIn("Z2", hints[0]["text"])

    def test_untagged_asks_to_tag(self):
        hints = insight_hints(None)
        self.assertIn("taguez", hints[0]["text"].lower())

    def test_trail_nuance(self):
        hints = insight_hints("ef", "trail")
        self.assertIn("trail", hints[0]["text"].lower())

    def test_refresh_updates_hints(self):
        activity = SimpleNamespace(session_type="endurance_active", terrain="route")
        payload = {
            "summary": "ok",
            "hints": [
                {"title": "Focus", "text": "taguez le type"},
                {"title": "Lecture", "text": "Sans type"},
            ],
        }
        refreshed = refresh_analysis_hints(payload, activity)
        assert refreshed is not None
        self.assertNotIn("taguez", refreshed["hints"][0]["text"].lower())
        self.assertEqual(refreshed["session_type"], "endurance_active")


class TestActivityContext(unittest.TestCase):
    def test_includes_labels_and_pace(self):
        activity = SimpleNamespace(
            id=1,
            name="Run",
            start_date=None,
            distance_m=6160,
            moving_time_s=2149,
            average_speed_mps=2.87,
            average_heartrate=148,
            max_heartrate=160,
            cadence_ppm=170,
            total_elevation_gain_m=7,
            session_type="endurance_active",
            terrain="route",
            weather_json={"temperature_c": 24},
            features_json={"time_in_zone": {"Z2": 0.58}, "decoupling_pct": 3.0},
        )
        ctx = _activity_context(activity)
        self.assertEqual(ctx["session_type"], "endurance_active")
        self.assertIn("Endurance active", ctx["session_type_label_fr"] or "")
        self.assertEqual(ctx["terrain"], "route")
        self.assertIsNotNone(ctx["pace_label"])
        self.assertEqual(ctx["distance_km"], 6.16)
        self.assertIn("time_in_zone", ctx["features_json"] or {})


if __name__ == "__main__":
    unittest.main()
