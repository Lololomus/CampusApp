import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app.services import analytics_service


class AnalyticsServiceTests(unittest.TestCase):
    def test_hash_user_id_is_deterministic(self):
        a = analytics_service.hash_user_id(123, "salt-1")
        b = analytics_service.hash_user_id(123, "salt-1")
        c = analytics_service.hash_user_id(124, "salt-1")

        self.assertEqual(a, b)
        self.assertNotEqual(a, c)
        self.assertEqual(len(a), 64)

    def test_dedup_key_contract(self):
        dedup = analytics_service.build_event_dedup_key(
            request_id="req-1",
            event_name="post_like",
            user_hash="abc",
            entity_type="post",
            entity_id=42,
        )
        self.assertEqual(dedup, "req-1|post_like|abc|post|42")

    def test_safe_percent_zero_denominator(self):
        pct, status = analytics_service.safe_percent(10, 0)
        self.assertIsNone(pct)
        self.assertEqual(status, analytics_service.INSUFFICIENT_DATA)

    def test_percentage_formula(self):
        metric = analytics_service.percentage_metric("ads_ctr_pct", "Ads CTR %", 15, 300)
        self.assertEqual(metric.pct_value, 5.0)
        self.assertEqual(metric.calc_status, analytics_service.OK_STATUS)

    def test_wow_change(self):
        self.assertEqual(analytics_service.wow_change(120, 100), 20.0)
        self.assertIsNone(analytics_service.wow_change(100, 0))

    def test_write_report_files_creates_json_csv_and_zip(self):
        with tempfile.TemporaryDirectory() as tmp:
            settings = SimpleNamespace(
                analytics_reports_dir=tmp,
                analytics_raw_retention_days=180,
                analytics_agg_retention_days=730,
            )
            report_date = date(2026, 3, 12)
            payload = {
                "report_meta": {"date_msk": "2026-03-12"},
                "kpi_overview": [{"metric_key": "x", "label": "X", "value": 1}],
                "funnels": [{"funnel": "create", "step_order": 1, "step_name": "open", "users": 1}],
                "retention": [{"window": "D1", "cohort_date": "2026-03-12", "target_date": "2026-03-13", "cohort_users": 1, "returned_users": 0}],
                "modules": [{"module": "ads", "metric_key": "ad_clicks", "value": 1}],
                "ads": [{"ad_impressions": 10, "ad_clicks": 1}],
                "moderation": [{"reports_reviewed_total": 2, "reports_reviewed_under_24h": 1}],
                "quality_checks": [],
                "anomalies": [],
                "definitions": {},
            }

            with patch("app.services.analytics_service.get_settings", return_value=settings):
                paths = analytics_service.write_report_files(report_date, payload)

            self.assertTrue(paths["json"].exists())
            self.assertTrue(paths["kpi_csv"].exists())
            self.assertTrue(paths["csv_zip"].exists())

            with paths["json"].open("r", encoding="utf-8") as f:
                data = json.load(f)
            self.assertEqual(data["report_meta"]["date_msk"], "2026-03-12")

            expected_folder = Path(tmp) / "2026" / "03" / "12"
            self.assertEqual(paths["base_dir"], expected_folder)


if __name__ == "__main__":
    unittest.main()
