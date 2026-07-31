"""Tests résolution num_thread Ollama."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app.config import Settings


class TestOllamaNumThread(unittest.TestCase):
    def test_auto_is_nproc_minus_one(self):
        s = Settings(ollama_num_thread="auto")
        with patch("os.cpu_count", return_value=8):
            self.assertEqual(s.resolved_ollama_num_thread(), 7)

    def test_auto_min_one(self):
        s = Settings(ollama_num_thread="auto")
        with patch("os.cpu_count", return_value=1):
            self.assertEqual(s.resolved_ollama_num_thread(), 1)

    def test_fixed(self):
        s = Settings(ollama_num_thread="4")
        self.assertEqual(s.resolved_ollama_num_thread(), 4)

    def test_zero_means_default(self):
        s = Settings(ollama_num_thread="0")
        self.assertIsNone(s.resolved_ollama_num_thread())


if __name__ == "__main__":
    unittest.main()
