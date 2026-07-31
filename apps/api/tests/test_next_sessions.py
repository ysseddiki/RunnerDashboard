"""Tests next_sessions (sans DB)."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.next_sessions import build_prescriptions


def _act(days_ago: int, session_type: str | None = "ef", km: float = 8.0) -> SimpleNamespace:
    now = datetime(2026, 7, 30, 12, 0, tzinfo=timezone.utc)
    return SimpleNamespace(
        sport_type="Run",
        activity_type="Run",
        session_type=session_type,
        start_date=now - timedelta(days=days_ago),
        average_speed_mps=3.2,
        distance_m=km * 1000,
        average_heartrate=140,
        features_json={"trimp_edwards": 50},
    )


class TestNextSessions(unittest.TestCase):
    def test_insufficient(self):
        rows = [_act(1), _act(2)]
        out = build_prescriptions(
            rows,
            form={"available": True, "status": "neutre"},
            load={"acr_elevated": False},
            adherence=None,
            training_paces=[],
            now=datetime(2026, 7, 30, 12, 0, tzinfo=timezone.utc),
        )
        self.assertFalse(out["available"])

    def test_fatigue_no_hard_quality_early(self):
        rows = [_act(d) for d in range(1, 10)]
        out = build_prescriptions(
            rows,
            form={"available": True, "status": "fatigue"},
            load={"acr_elevated": True, "acr": 1.5},
            adherence=None,
            training_paces=[
                {"session_type": "ef", "pace_sec_per_km": 360},
                {"session_type": "tempo", "pace_sec_per_km": 300},
                {"session_type": "seuil", "pace_sec_per_km": 290},
            ],
            now=datetime(2026, 7, 30, 12, 0, tzinfo=timezone.utc),
        )
        self.assertTrue(out["available"])
        self.assertGreaterEqual(len(out["sessions"]), 3)
        start = datetime(2026, 7, 31).date()  # demain
        for s in out["sessions"]:
            from datetime import date

            d = date.fromisoformat(s["date"])
            if (d - start).days <= 2:
                self.assertNotIn(s["session_type"], {"seuil", "vma", "fractionne"})
        self.assertTrue(
            any(s["session_type"] in ("ef", "recuperation") for s in out["sessions"])
        )

    def test_target_pace_from_training(self):
        rows = [_act(d, "ef") for d in range(1, 8)]
        # no quality recently → tempo
        out = build_prescriptions(
            rows,
            form={"available": True, "status": "frais"},
            load={"acr_elevated": False},
            adherence=None,
            training_paces=[
                {"session_type": "tempo", "pace_sec_per_km": 305.0},
                {"session_type": "ef", "pace_sec_per_km": 360.0},
                {"session_type": "sortie_longue", "pace_sec_per_km": 355.0},
            ],
            now=datetime(2026, 7, 30, 12, 0, tzinfo=timezone.utc),
        )
        self.assertTrue(out["available"])
        tempos = [s for s in out["sessions"] if s["session_type"] == "tempo"]
        self.assertTrue(tempos)
        self.assertEqual(tempos[0]["target_pace_sec_per_km"], 305.0)


if __name__ == "__main__":
    unittest.main()
