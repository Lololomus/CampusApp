from datetime import datetime, timezone
import unittest

from app.time_utils import ensure_utc, to_iso_z


class TimeUtilsTests(unittest.TestCase):
    def test_to_iso_z_none(self):
        self.assertIsNone(to_iso_z(None))

    def test_to_iso_z_with_naive_datetime(self):
        dt = datetime(2026, 2, 18, 12, 0, 0)
        self.assertEqual(to_iso_z(dt), "2026-02-18T12:00:00Z")

    def test_to_iso_z_with_aware_utc_datetime(self):
        dt = datetime(2026, 2, 18, 12, 0, 0, tzinfo=timezone.utc)
        self.assertEqual(to_iso_z(dt), "2026-02-18T12:00:00Z")

    def test_ensure_utc_converts_naive(self):
        dt = datetime(2026, 2, 18, 12, 0, 0)
        normalized = ensure_utc(dt)
        self.assertIsNotNone(normalized)
        self.assertEqual(normalized.tzinfo, timezone.utc)


if __name__ == "__main__":
    unittest.main()
