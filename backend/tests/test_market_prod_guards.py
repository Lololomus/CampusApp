from datetime import datetime, timedelta
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app import auth_service
from app.crud import market as market_crud
from app.services import notification_service


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class RequireUserSessionBindingTests(unittest.IsolatedAsyncioTestCase):
    async def test_prod_requires_active_session(self):
        request = SimpleNamespace(
            state=SimpleNamespace(auth_payload={"tgid": 101, "sub": "1", "sid": 77, "role": "user"})
        )
        user = SimpleNamespace(id=1, telegram_id=101)
        session = SimpleNamespace(id=77, user_id=1, telegram_id=101)

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[_FakeResult(user), _FakeResult(session)])

        with patch(
            "app.auth_service.get_settings",
            return_value=SimpleNamespace(is_prod=True, auth_session_binding_enabled=True),
        ):
            resolved = await auth_service.require_user(request, db)

        self.assertEqual(resolved.id, 1)
        self.assertEqual(db.execute.call_count, 2)

    async def test_prod_rejects_revoked_or_missing_session(self):
        request = SimpleNamespace(
            state=SimpleNamespace(auth_payload={"tgid": 101, "sub": "1", "sid": 77, "role": "user"})
        )
        user = SimpleNamespace(id=1, telegram_id=101)

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[_FakeResult(user), _FakeResult(None)])

        with patch(
            "app.auth_service.get_settings",
            return_value=SimpleNamespace(is_prod=True, auth_session_binding_enabled=True),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await auth_service.require_user(request, db)

        self.assertEqual(ctx.exception.status_code, 401)

    async def test_dev_keeps_legacy_behavior_without_session_check(self):
        request = SimpleNamespace(
            state=SimpleNamespace(auth_payload={"tgid": 101, "sub": "1", "sid": 0, "role": "user"})
        )
        user = SimpleNamespace(id=1, telegram_id=101)

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[_FakeResult(user)])

        with patch(
            "app.auth_service.get_settings",
            return_value=SimpleNamespace(is_prod=False, auth_session_binding_enabled=False),
        ):
            resolved = await auth_service.require_user(request, db)

        self.assertEqual(resolved.id, 1)
        self.assertEqual(db.execute.call_count, 1)


class MarketLocationTests(unittest.TestCase):
    def test_default_location_omits_missing_institute(self):
        seller = SimpleNamespace(university="Campus University", institute=None)

        self.assertEqual(
            market_crud._resolve_market_location(None, seller),
            "Campus University",
        )

    def test_default_location_does_not_render_none(self):
        seller = SimpleNamespace(university=None, institute=None)

        self.assertIsNone(market_crud._resolve_market_location(None, seller))
        self.assertIsNone(market_crud._resolve_market_location("None", seller))


class MarketContactVisibilityTests(unittest.TestCase):
    def test_public_telegram_contact_uses_trusted_telegram_username(self):
        self.assertEqual(
            notification_service._public_telegram_contact(
                SimpleNamespace(
                    username="fake_inside_campus",
                    telegram_username="real_tg_user",
                    show_profile=True,
                    show_telegram_id=True,
                )
            ),
            "real_tg_user",
        )

    def test_public_telegram_contact_requires_trusted_username_and_visibility(self):
        self.assertTrue(notification_service._has_public_telegram_contact(
            SimpleNamespace(telegram_username="seller_name", show_profile=True, show_telegram_id=True)
        ))
        self.assertFalse(notification_service._has_public_telegram_contact(
            SimpleNamespace(telegram_username="seller_name", show_profile=False, show_telegram_id=True)
        ))
        self.assertFalse(notification_service._has_public_telegram_contact(
            SimpleNamespace(telegram_username="seller_name", show_profile=True, show_telegram_id=False)
        ))
        self.assertFalse(notification_service._has_public_telegram_contact(
            SimpleNamespace(username="fake_inside_campus", telegram_username=None, show_profile=True, show_telegram_id=True)
        ))
        self.assertFalse(notification_service._has_public_telegram_contact(
            SimpleNamespace(telegram_username="боров", show_profile=True, show_telegram_id=True)
        ))


class MarketExpiryAndReviewWindowTests(unittest.TestCase):
    def test_compute_deal_expiry_selected(self):
        now = datetime(2026, 3, 19, 12, 0, 0)
        settings = SimpleNamespace(
            is_prod=True,
            market_expiry_worker_enabled=True,
            market_deal_selected_ttl_hours=24,
            market_service_in_progress_ttl_hours=168,
            market_deal_provider_confirmed_ttl_hours=72,
        )
        with patch("app.crud.market.get_settings", return_value=settings):
            expires_at = market_crud._compute_deal_expires_at("product", "selected", now)

        self.assertEqual(expires_at, now + timedelta(hours=24))

    def test_compute_deal_expiry_disabled_in_dev(self):
        now = datetime(2026, 3, 19, 12, 0, 0)
        settings = SimpleNamespace(
            is_prod=False,
            market_expiry_worker_enabled=False,
            market_deal_selected_ttl_hours=24,
            market_service_in_progress_ttl_hours=168,
            market_deal_provider_confirmed_ttl_hours=72,
        )
        with patch("app.crud.market.get_settings", return_value=settings):
            expires_at = market_crud._compute_deal_expires_at("product", "selected", now)
        self.assertIsNone(expires_at)

    def test_is_deal_overdue(self):
        now = datetime(2026, 3, 19, 12, 0, 0)
        overdue_deal = SimpleNamespace(status="selected", expires_at=now - timedelta(seconds=1))
        fresh_deal = SimpleNamespace(status="selected", expires_at=now + timedelta(minutes=5))

        with patch(
            "app.crud.market.get_settings",
            return_value=SimpleNamespace(is_prod=True, market_expiry_worker_enabled=True),
        ):
            self.assertTrue(market_crud._is_deal_overdue(overdue_deal, now))
            self.assertFalse(market_crud._is_deal_overdue(fresh_deal, now))

    def test_is_deal_overdue_disabled_in_dev(self):
        now = datetime(2026, 3, 19, 12, 0, 0)
        overdue_deal = SimpleNamespace(status="selected", expires_at=now - timedelta(seconds=1))
        with patch(
            "app.crud.market.get_settings",
            return_value=SimpleNamespace(is_prod=False, market_expiry_worker_enabled=False),
        ):
            self.assertFalse(market_crud._is_deal_overdue(overdue_deal, now))

    def test_review_window_anchor_prod_requires_completed_at(self):
        deal = SimpleNamespace(
            completed_at=None,
            updated_at=datetime(2026, 3, 19, 12, 0, 0),
            created_at=datetime(2026, 3, 18, 12, 0, 0),
        )
        with patch(
            "app.crud.market.get_settings",
            return_value=SimpleNamespace(is_prod=True, market_review_strict_completed_at=True),
        ):
            anchor = market_crud._resolve_review_completed_at(deal)
        self.assertIsNone(anchor)

    def test_review_window_anchor_dev_keeps_fallback(self):
        deal = SimpleNamespace(
            completed_at=None,
            updated_at=datetime(2026, 3, 19, 12, 0, 0),
            created_at=datetime(2026, 3, 18, 12, 0, 0),
        )
        with patch(
            "app.crud.market.get_settings",
            return_value=SimpleNamespace(is_prod=False, market_review_strict_completed_at=False),
        ):
            anchor = market_crud._resolve_review_completed_at(deal)
        self.assertEqual(anchor, deal.updated_at)


if __name__ == "__main__":
    unittest.main()
