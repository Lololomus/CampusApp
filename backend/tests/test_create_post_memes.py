import inspect
import unittest
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.main import create_post_endpoint, get_events_calendar, update_post_endpoint


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

    async def test_regular_user_cannot_create_official_event(self):
        request = SimpleNamespace()
        user = SimpleNamespace(id=7, university="Campus Uni", role="user")

        with patch("app.main.check_rate_limit", new=AsyncMock()):
            with self.assertRaises(Exception) as ctx:
                await create_post_endpoint(
                    request=request,
                    category="events",
                    body="Campus meetup",
                    title=None,
                    tags=None,
                    is_anonymous=False,
                    enable_anonymous_comments=False,
                    lost_or_found=None,
                    item_description=None,
                    location=None,
                    reward_type=None,
                    reward_value=None,
                    event_name="Campus meetup",
                    event_date="2026-05-10T12:00:00Z",
                    event_location="Hall",
                    event_contact=None,
                    event_type="official",
                    is_important=False,
                    scope="university",
                    target_university=None,
                    images=[],
                    video=None,
                    poll_data=None,
                    user=user,
                    db=object(),
                )

        self.assertEqual(getattr(ctx.exception, "status_code", None), 403)

    async def test_ambassador_can_create_official_event(self):
        request = SimpleNamespace()
        user = SimpleNamespace(id=7, university="Campus Uni", role="ambassador")
        db = object()

        async def create_post(db_arg, post_data, user_id, images_meta=None):
            self.assertIs(db_arg, db)
            self.assertEqual(user_id, user.id)
            self.assertEqual(post_data.category, "events")
            self.assertEqual(post_data.event_type, "official")
            return SimpleNamespace(id=77)

        with (
            patch("app.main.check_rate_limit", new=AsyncMock()),
            patch("app.main.crud.create_post", new=AsyncMock(side_effect=create_post)),
            patch("app.main.analytics_service.record_server_event", new=AsyncMock()),
            patch("app.main.get_post_endpoint", new=AsyncMock(return_value={"id": 77, "event_type": "official"})),
        ):
            response = await create_post_endpoint(
                request=request,
                category="events",
                body="Campus meetup",
                title=None,
                tags=None,
                is_anonymous=False,
                enable_anonymous_comments=False,
                lost_or_found=None,
                item_description=None,
                location=None,
                reward_type=None,
                reward_value=None,
                event_name="Campus meetup",
                event_date="2026-05-10T12:00:00Z",
                event_location="Hall",
                event_contact=None,
                event_type="official",
                is_important=False,
                scope="university",
                target_university=None,
                images=[],
                video=None,
                poll_data=None,
                user=user,
                db=db,
            )

        self.assertEqual(response, {"id": 77, "event_type": "official"})

    async def test_calendar_uses_authenticated_user_scope_not_query_params(self):
        request = SimpleNamespace()
        db = object()
        user = SimpleNamespace(
            id=7,
            campus_id="real_campus",
            university="Real Uni",
            custom_university=None,
            city="Moscow",
            custom_city=None,
        )

        with (
            patch("app.main.check_rate_limit", new=AsyncMock()),
            patch("app.main.crud.get_calendar_events", new=AsyncMock(return_value=[])) as get_events,
        ):
            response = await get_events_calendar(
                request=request,
                from_date=date(2026, 5, 1),
                to_date=date(2026, 5, 31),
                university="Spoofed Uni",
                campus_id="spoofed_campus",
                viewer_city="Spoofed City",
                user=user,
                db=db,
            )

        self.assertEqual(response, {"items": [], "total": 0})
        get_events.assert_awaited_once_with(
            db,
            from_date=date(2026, 5, 1),
            to_date=date(2026, 5, 31),
            university="Real Uni",
            campus_id="real_campus",
            viewer_city="Moscow",
            current_user_id=7,
        )

    async def test_calendar_serializes_anonymous_author_name(self):
        request = SimpleNamespace()
        db = object()
        user = SimpleNamespace(
            id=7,
            campus_id="real_campus",
            university="Real Uni",
            custom_university=None,
            city="Moscow",
            custom_city=None,
        )
        post = SimpleNamespace(
            id=44,
            author_id=9,
            author=None,
            category="events",
            title="посвят",
            body="посвят",
            tags=[],
            images=[],
            is_anonymous=True,
            event_name="посвят",
            event_date=datetime(2026, 5, 14, 3, 2),
            event_location="НГУ",
            event_contact=None,
            event_type="community",
            scope="university",
            target_university=None,
            likes_count=0,
            comments_count=0,
            created_at=None,
            updated_at=None,
        )

        with (
            patch("app.main.check_rate_limit", new=AsyncMock()),
            patch("app.main.crud.get_calendar_events", new=AsyncMock(return_value=[post])),
        ):
            response = await get_events_calendar(
                request=request,
                from_date=date(2026, 5, 1),
                to_date=date(2026, 5, 31),
                university=None,
                campus_id=None,
                viewer_city=None,
                user=user,
                db=db,
            )

        self.assertEqual(response["items"][0]["author"], {"name": "Аноним"})
        self.assertIsNone(response["items"][0]["author_id"])

    async def test_regular_user_cannot_demote_official_event(self):
        request = SimpleNamespace()
        db = object()
        user = SimpleNamespace(id=7, role="user")
        post = SimpleNamespace(id=44, author_id=7, category="events", event_type="official")

        with patch("app.main.crud.get_post", new=AsyncMock(return_value=post)):
            with self.assertRaises(Exception) as ctx:
                await update_post_endpoint(
                    post_id=44,
                    title=None,
                    body=None,
                    tags=None,
                    lost_or_found=None,
                    item_description=None,
                    location=None,
                    reward_type=None,
                    reward_value=None,
                    event_name=None,
                    event_date=None,
                    event_location=None,
                    event_contact=None,
                    event_type="community",
                    is_important=None,
                    new_images=[],
                    keep_images=None,
                    new_video=None,
                    keep_video=True,
                    user=user,
                    db=db,
                )

        self.assertEqual(getattr(ctx.exception, "status_code", None), 403)


if __name__ == "__main__":
    unittest.main()
