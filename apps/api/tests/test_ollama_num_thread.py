"""Tests résolution num_thread Ollama."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app.config import Settings, normalize_ollama_num_thread_raw, parse_ollama_num_thread


class TestOllamaNumThread(unittest.TestCase):
    def test_auto_is_nproc_minus_one(self):
        s = Settings(ollama_num_thread="auto")
        with patch("os.cpu_count", return_value=8):
            self.assertEqual(s.resolved_ollama_num_thread(), 7)

    def test_auto_min_one(self):
        self.assertEqual(parse_ollama_num_thread("auto", cpu_count=1), 1)

    def test_fixed(self):
        s = Settings(ollama_num_thread="4")
        self.assertEqual(s.resolved_ollama_num_thread(), 4)

    def test_zero_means_default(self):
        s = Settings(ollama_num_thread="0")
        self.assertIsNone(s.resolved_ollama_num_thread())

    def test_normalize(self):
        self.assertEqual(normalize_ollama_num_thread_raw("AUTO"), "auto")
        self.assertEqual(normalize_ollama_num_thread_raw("all"), "0")
        self.assertEqual(normalize_ollama_num_thread_raw("6"), "6")


if __name__ == "__main__":
    unittest.main()
