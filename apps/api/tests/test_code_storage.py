"""Tests inventaire stockage code."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.services.code_storage import _human_bytes, scan_code_storage


class TestCodeStorage(unittest.TestCase):
    def test_human_bytes(self):
        self.assertEqual(_human_bytes(500), "500 o")
        self.assertIn("Ko", _human_bytes(2048))

    def test_scan_sources_vs_deps(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "apps" / "api" / "app").mkdir(parents=True)
            (root / "openspec").mkdir()
            (root / "apps" / "api" / "app" / "main.py").write_text(
                "def hello():\n    return 1\n", encoding="utf-8"
            )
            (root / "apps" / "web").mkdir(parents=True)
            (root / "apps" / "web" / "src").mkdir()
            (root / "apps" / "web" / "src" / "App.tsx").write_text(
                "export const x = 1\n", encoding="utf-8"
            )
            nm = root / "apps" / "web" / "node_modules" / "pkg"
            nm.mkdir(parents=True)
            (nm / "index.js").write_text("x".ljust(10_000), encoding="utf-8")

            report = scan_code_storage(root)
            self.assertTrue(report["available"])
            self.assertEqual(report["mode"], "monorepo")
            self.assertGreater(report["source"]["files"], 0)
            self.assertGreaterEqual(report["source"]["loc_total"], 3)
            self.assertGreater(report["dependencies"]["bytes"], 0)
            # deps ne doivent pas gonfler les sources
            self.assertLess(report["source"]["bytes"], report["dependencies"]["bytes"])
            langs = {l["id"] for l in report["languages"]}
            self.assertIn("Python", langs)
            self.assertIn("TypeScript", langs)


if __name__ == "__main__":
    unittest.main()
