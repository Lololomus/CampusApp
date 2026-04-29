import asyncio
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from app import utils as image_utils


def make_image_bytes(fmt="JPEG", size=(640, 480), mode="RGB"):
    buffer = BytesIO()
    Image.new(mode, size, color=(120, 80, 40)).save(buffer, format=fmt)
    return buffer.getvalue()


class ChunkedUpload:
    filename = "large.jpg"

    def __init__(self, chunk_count, chunk_size):
        self.remaining = chunk_count
        self.chunk = b"x" * chunk_size

    async def read(self, _size):
        if self.remaining <= 0:
            return b""
        self.remaining -= 1
        return self.chunk


class ImageProcessingTests(unittest.TestCase):
    def test_large_jpeg_is_resized_and_saved_as_webp(self):
        content = make_image_bytes(size=(3000, 1500))

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(image_utils, "UPLOADS_ROOT", Path(tmpdir)):
                meta = image_utils.process_image_sync(content)

                self.assertEqual(meta["format"], "webp")
                self.assertEqual(meta["w"], 2048)
                self.assertEqual(meta["h"], 1024)
                self.assertGreater(meta["size_bytes"], 0)

                output_path = Path(tmpdir) / "images" / meta["url"]
                self.assertTrue(output_path.exists())
                with Image.open(output_path) as saved:
                    self.assertEqual(saved.format, "WEBP")
                    self.assertEqual(saved.size, (2048, 1024))

    def test_small_png_returns_webp_metadata(self):
        content = make_image_bytes(fmt="PNG", size=(320, 240))

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(image_utils, "UPLOADS_ROOT", Path(tmpdir)):
                meta = image_utils.process_image_sync(content)

                self.assertEqual(meta["format"], "webp")
                self.assertEqual(meta["w"], 320)
                self.assertEqual(meta["h"], 240)
                self.assertGreater(meta["size_bytes"], 0)

    def test_read_upload_rejects_files_over_20mb(self):
        upload = ChunkedUpload(
            chunk_count=21,
            chunk_size=1024 * 1024,
        )

        with self.assertRaisesRegex(ValueError, ">20MB"):
            asyncio.run(image_utils._read_upload_content_limited(upload))


if __name__ == "__main__":
    unittest.main()
