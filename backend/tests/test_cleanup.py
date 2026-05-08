import os
import tempfile
import time
import unittest

from pathlib import Path

from app.cleanup import (
    _jsonb_to_upload_refs,
    _resolve_upload_path,
    scan_directory_for_orphans,
)
from app.utils import UPLOADS_ROOT


class CleanupMediaRefsTests(unittest.TestCase):
    def test_media_refs_keep_video_and_thumbnail_kinds(self):
        refs = _jsonb_to_upload_refs(
            [
                {
                    "type": "video",
                    "url": "2026/05/video.mp4",
                    "thumbnail_url": "2026/05/video.webp",
                },
                {
                    "url": "2026/05/image.webp",
                    "thumbnail_url": "2026/05/image_thumb.webp",
                },
            ]
        )

        self.assertEqual(
            refs,
            [
                ("2026/05/video.mp4", "videos"),
                ("2026/05/video.webp", "thumbs"),
                ("2026/05/image.webp", "images"),
                ("2026/05/image_thumb.webp", "thumbs"),
            ],
        )

    def test_resolve_upload_path_uses_default_kind_for_bare_keys(self):
        self.assertEqual(
            _resolve_upload_path("2026/05/video.mp4", default_kind="videos"),
            (UPLOADS_ROOT / "videos" / "2026/05/video.mp4").resolve(),
        )
        self.assertEqual(
            _resolve_upload_path("2026/05/thumb.webp", default_kind="thumbs"),
            (UPLOADS_ROOT / "thumbs" / "2026/05/thumb.webp").resolve(),
        )

    def test_resolve_upload_path_rejects_traversal(self):
        self.assertIsNone(_resolve_upload_path("../secret.txt", default_kind="images"))

    def test_scan_directory_skips_recent_orphans(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            old_file = root / "old.webp"
            recent_file = root / "recent.webp"
            old_file.write_bytes(b"old")
            recent_file.write_bytes(b"recent")

            old_mtime = time.time() - (25 * 60 * 60)
            os.utime(old_file, (old_mtime, old_mtime))

            orphans = scan_directory_for_orphans(
                root,
                referenced=set(),
                min_age_seconds=24 * 60 * 60,
            )

        self.assertEqual(orphans, [old_file.resolve()])


if __name__ == "__main__":
    unittest.main()
