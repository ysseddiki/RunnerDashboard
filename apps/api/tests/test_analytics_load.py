"""Tests analytics helpers (sans import models)."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.activity_features import (
    EASY_SESSION_TYPES,
    QUALITY_SESSION_TYPES,
    ACR_HIGH_THRESHOLD,
    is_running_eligible,
)


def _act(**kwargs):
    base = dict(
        sport_type="Run",
        activity_type="Run",
        session_type=None,
        distance_m=5000.0,
        start_date=datetime.now(timezone.utc),
        features_json=None,
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def _trimp_of(activity):
    feat = activity.features_json if isinstance(activity.features_json, dict) else None
    if not feat or feat.get("trimp_edwards") is None:
        return None
    return float(feat["trimp_edwards"])


def _build_load(rows, now):
    available = [(a, t) for a in rows if (t := _trimp_of(a)) is not None]
    if not available:
        return {"available": False, "acr": None}
    def sum_days(days):
        start = now - timedelta(days=days)
        return sum(t for a, t in available if a.start_date and a.start_date >= start)
    t7 = sum_days(7)
    t28 = sum_days(28)
    weekly = t28 / 4.0 if t28 > 0 else 0.0
    acr = round(t7 / weekly, 2) if weekly > 0 else None
    return {
        "available": True,
        "trimp_7d": round(t7, 1),
        "trimp_28d": round(t28, 1),
        "acr": acr,
        "acr_elevated": bool(acr is not None and acr >= ACR_HIGH_THRESHOLD),
    }


def _volume_buckets(recent):
    easy = quality = untagged = 0.0
    for a in recent:
        km = (a.distance_m or 0.0) / 1000.0
        st = a.session_type
        if st in EASY_SESSION_TYPES:
            easy += km
        elif st in QUALITY_SESSION_TYPES:
            quality += km
        else:
            untagged += km
    return easy, quality, untagged


class TestAnalyticsHelpers(unittest.TestCase):
    def test_walk_excluded(self):
        self.assertFalse(is_running_eligible(_act(sport_type="Walk")))

    def test_volume_buckets(self):
        recent = [
            _act(session_type="ef", distance_m=10000),
            _act(session_type="fractionne", distance_m=5000),
            _act(session_type=None, distance_m=2000),
        ]
        easy, quality, untagged = _volume_buckets(recent)
        self.assertEqual(easy, 10.0)
        self.assertEqual(quality, 5.0)
        self.assertEqual(untagged, 2.0)

    def test_load_unavailable(self):
        now = datetime.now(timezone.utc)
        load = _build_load([_act(features_json={})], now)
        self.assertFalse(load["available"])

    def test_load_acr(self):
        now = datetime.now(timezone.utc)
        rows = [
            _act(
                start_date=now - timedelta(days=d),
                features_json={"trimp_edwards": 50},
            )
            for d in range(0, 28, 2)
        ]
        load = _build_load(rows, now)
        self.assertTrue(load["available"])
        self.assertIsNotNone(load["acr"])


if __name__ == "__main__":
    unittest.main()
