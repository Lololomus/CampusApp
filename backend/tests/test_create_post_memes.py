import inspect
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.main import create_post_endpoint


class CreatePostMemesTests(unittest.IsolatedAsyncioTestCase):
    def test_body_form_field_is_optional_for_photo_only_posts(self):
        body_param = inspect.signature(create_post_endpoint).parameters["body"].default

        self.assertFalse(body_param.is_required())
        self.assertIsNone(body_param.default)

    async def test_photo_only_meme_accepts_missing_body_form_field(self):
        request = SimpleNamespace()
        user = SimpleNamespace(id=7, university="Campus Uni")
        db = object()
        image = SimpleNamespace(filename="meme.jpg", content_type="image/jpeg")
        image_meta = {"url": "meme.jpg", "w": 640, "h": 640}

        async def create_post(db_arg, post_data, user_id, images_meta=None):
            self.assertIs(db_arg, db)
            self.assertEqual(user_id, user.id)
            self.assertEqual(post_data.category, "memes")
            self.assertEqual(post_data.body, "")
            self.assertEqual(images_meta, [image_meta])
            return SimpleNamespace(id=42)

        with (
            patch("app.main.check_rate_limit", new=AsyncMock()),
            patch("app.main.process_uploaded_files", new=AsyncMock(return_value=[image_meta])) as process_files,
            patch("app.main.crud.create_post", new=AsyncMock(side_effect=create_post)) as create_post_mock,
            patch("app.main.analytics_service.record_server_event", new=AsyncMock()),
            patch("app.main.get_post_endpoint", new=AsyncMock(return_value={"id": 42, "category": "memes"})),
        ):
            response = await create_post_endpoint(
                request=request,
                category="memes",
                body=None,
                title=None,
                tags=None,
                is_anonymous=False,
                enable_anonymous_comments=False,
                lost_or_found=None,
                item_description=None,
                location=None,
                reward_type=None,
                reward_value=None,
                event_name=None,
                event_date=None,
                event_location=None,
                event_contact=None,
                is_important=False,
                scope="university",
                target_university=None,
                images=[image],
                video=None,
                poll_data=None,
                user=user,
                db=db,
            )

        self.assertEqual(response, {"id": 42, "category": "memes"})
        process_files.assert_awaited_once_with([image])
        create_post_mock.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
