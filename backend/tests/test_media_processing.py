from pathlib import Path
from unittest import TestCase

from app.media_processing import (
    JOB_FAILED,
    JOB_PENDING,
    MEDIA_JOBS_ROOT,
    replace_video_job_payload,
    resolve_job_source_path,
    video_processing_placeholder,
)


class MediaProcessingHelpersTests(TestCase):
    def test_resolve_job_source_path_rejects_traversal(self):
        self.assertIsNone(resolve_job_source_path("../secret.mp4"))
        self.assertIsNone(resolve_job_source_path("/etc/passwd"))

    def test_resolve_job_source_path_accepts_relative_child(self):
        path = resolve_job_source_path("2026/05/source.mp4")
        self.assertEqual(path, (Path(MEDIA_JOBS_ROOT) / "2026/05/source.mp4").resolve())

    def test_replace_video_payload_uses_matching_job_id(self):
        images = [
            {"url": "2026/05/a.webp", "w": 100, "h": 100},
            video_processing_placeholder(7, JOB_PENDING),
        ]
        ready = {
            "type": "video",
            "url": "2026/05/video.mp4",
            "w": 1920,
            "h": 1080,
            "processing_status": "ready",
            "job_id": 7,
        }

        result = replace_video_job_payload(images, 7, ready)

        self.assertEqual(result[0]["url"], "2026/05/a.webp")
        self.assertEqual(result[1], ready)

    def test_replace_video_payload_preserves_failed_status(self):
        images = [video_processing_placeholder(9, JOB_PENDING)]
        failed = video_processing_placeholder(9, JOB_FAILED)
        failed["error_code"] = "ffmpeg_timeout"

        result = replace_video_job_payload(images, 9, failed)

        self.assertEqual(result[0]["processing_status"], JOB_FAILED)
        self.assertEqual(result[0]["error_code"], "ffmpeg_timeout")
