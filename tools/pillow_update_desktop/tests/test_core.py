from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from tools.pillow_update_desktop.core import (
    build_base_folder_name,
    save_update,
    validate_payload,
)
from tools.pillow_update_desktop.model import default_payload


class TestPillowUpdateCore(unittest.TestCase):
    def setUp(self) -> None:
        self.payload = default_payload().to_dict()

    def test_validate_payload_rejects_bad_date_format(self) -> None:
        self.payload["date"] = "2026-03-15"
        errors = validate_payload(self.payload)
        self.assertTrue(any("формате DD.MM.YYYY" in error for error in errors))

    def test_validate_payload_rejects_wrong_features_count(self) -> None:
        self.payload["features"] = self.payload["features"][:2]
        errors = validate_payload(self.payload)
        self.assertTrue(any("ровно 3 пункта" in error for error in errors))

    def test_save_update_creates_json_and_png_and_unique_suffix(self) -> None:
        image = Image.new("RGB", (1080, 1080), color="#111111")

        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            first_dir = save_update(self.payload, image, project_root=project_root)
            second_dir = save_update(self.payload, image, project_root=project_root)

            self.assertTrue((first_dir / "preview.png").exists())
            self.assertTrue((first_dir / "update.json").exists())
            self.assertTrue(second_dir.name.endswith("_2"))

            saved_payload = json.loads((first_dir / "update.json").read_text(encoding="utf-8"))
            self.assertIn("saved_at", saved_payload)
            self.assertEqual(saved_payload["date"], self.payload["date"])

    def test_build_base_folder_name(self) -> None:
        name = build_base_folder_name(self.payload)
        self.assertRegex(name, r"^\d{4}-\d{2}-\d{2}_v")


if __name__ == "__main__":
    unittest.main()

