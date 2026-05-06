import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app import models, schemas
from app.crud import referrals


class ReferralCodeTests(unittest.TestCase):
    def test_normalize_referral_code_accepts_only_safe_codes(self):
        self.assertEqual(referrals.normalize_referral_code("Abc12345"), "Abc12345")
        self.assertIsNone(referrals.normalize_referral_code("abc"))
        self.assertIsNone(referrals.normalize_referral_code("abc_123"))
        self.assertIsNone(referrals.normalize_referral_code("a" * 33))

    def test_current_period_uses_moscow_monday(self):
        start, end = referrals.get_current_referral_period(datetime(2026, 5, 6, 12, 0, 0))

        self.assertEqual(start, datetime(2026, 5, 3, 21, 0, 0))
        self.assertEqual(end, datetime(2026, 5, 10, 21, 0, 0))


class ReferralGroupLeaderboardTests(unittest.TestCase):
    def test_university_leaderboard_groups_by_inviter_and_prioritizes_campus_id(self):
        current_user = SimpleNamespace(campus_id="ruk_moscow", university="РУК", city="Москва")
        rows = [
            SimpleNamespace(campus_id="ruk_moscow", university="РУК", city="Москва"),
            SimpleNamespace(campus_id="ruk_moscow", university="РосУК", city="Москва"),
            SimpleNamespace(campus_id=None, university="МГУ", city="Москва"),
        ]

        leaderboard = referrals.build_university_leaderboard(rows, current_user)

        self.assertEqual(leaderboard[0]["key"], "campus:ruk_moscow")
        self.assertEqual(leaderboard[0]["referrals_count"], 2)
        self.assertTrue(leaderboard[0]["is_my_group"])
        self.assertEqual(leaderboard[1]["key"], "university:мгу")
        self.assertEqual(leaderboard[1]["referrals_count"], 1)

    def test_institute_leaderboard_filters_inside_current_university(self):
        current_user = SimpleNamespace(
            campus_id="ruk_moscow",
            university="РУК",
            city="Москва",
            institute="ИЭФ",
        )
        rows = [
            SimpleNamespace(campus_id="ruk_moscow", university="РУК", city="Москва", institute="ИЭФ"),
            SimpleNamespace(campus_id="ruk_moscow", university="РУК", city="Москва", institute="ИЭФ"),
            SimpleNamespace(campus_id="ruk_moscow", university="РУК", city="Москва", institute="ЮФ"),
            SimpleNamespace(campus_id="mgu_moscow", university="МГУ", city="Москва", institute="ВМК"),
        ]

        leaderboard = referrals.build_institute_leaderboard(rows, current_user)

        self.assertEqual(len(leaderboard), 2)
        self.assertEqual(leaderboard[0]["label"], "ИЭФ")
        self.assertEqual(leaderboard[0]["referrals_count"], 2)
        self.assertTrue(leaderboard[0]["is_my_group"])
        self.assertEqual(leaderboard[1]["label"], "ЮФ")

    def test_institute_leaderboard_uses_custom_faculty_or_fallback(self):
        current_user = SimpleNamespace(
            campus_id=None,
            university="Свободный вуз",
            custom_university=None,
            institute=None,
            custom_faculty=None,
        )
        rows = [
            SimpleNamespace(
                campus_id=None,
                university="Свободный вуз",
                custom_university=None,
                institute=None,
                custom_faculty="Дизайн",
            ),
            SimpleNamespace(
                campus_id=None,
                university="Свободный вуз",
                custom_university=None,
                institute=None,
                custom_faculty=None,
            ),
        ]

        leaderboard = referrals.build_institute_leaderboard(rows, current_user)
        labels = {entry["label"] for entry in leaderboard}

        self.assertEqual(labels, {"Дизайн", "Без факультета"})

    def test_referral_summary_preserves_legacy_leaderboard_field(self):
        entry = schemas.ReferralLeaderboardEntry(
            rank=1,
            user_id=1,
            name="Илья",
            referrals_count=3,
            is_me=True,
        )
        summary = schemas.ReferralSummary(
            referral_code="Abc12345",
            period_start=datetime(2026, 5, 3, 21, 0, 0),
            period_end=datetime(2026, 5, 10, 21, 0, 0),
            my_count=3,
            leaderboard=[entry],
            people_leaderboard=[entry],
        )

        payload = summary.model_dump()
        self.assertEqual(payload["leaderboard"][0]["user_id"], 1)
        self.assertEqual(payload["people_leaderboard"][0]["user_id"], 1)


class CreditReferralTests(unittest.IsolatedAsyncioTestCase):
    async def test_invalid_code_is_ignored(self):
        db = SimpleNamespace(scalar=AsyncMock(), add=AsyncMock(), commit=AsyncMock())
        invited = SimpleNamespace(id=2)

        credited = await referrals.credit_referral_for_user(db, invited, "bad")

        self.assertFalse(credited)
        db.scalar.assert_not_awaited()

    async def test_self_referral_is_ignored(self):
        db = SimpleNamespace(
            scalar=AsyncMock(return_value=SimpleNamespace(id=2)),
            add=AsyncMock(),
            commit=AsyncMock(),
        )
        invited = SimpleNamespace(id=2)

        credited = await referrals.credit_referral_for_user(db, invited, "Abc12345")

        self.assertFalse(credited)
        db.add.assert_not_called()
        db.commit.assert_not_awaited()

    async def test_existing_credit_is_ignored(self):
        db = SimpleNamespace(
            scalar=AsyncMock(side_effect=[
                SimpleNamespace(id=1),
                SimpleNamespace(id=10),
            ]),
            add=AsyncMock(),
            commit=AsyncMock(),
        )
        invited = SimpleNamespace(id=2)

        credited = await referrals.credit_referral_for_user(db, invited, "Abc12345")

        self.assertFalse(credited)
        db.add.assert_not_called()
        db.commit.assert_not_awaited()

    async def test_valid_credit_creates_referral(self):
        added = []
        db = SimpleNamespace(
            scalar=AsyncMock(side_effect=[SimpleNamespace(id=1), None]),
            add=lambda value: added.append(value),
            commit=AsyncMock(),
        )
        invited = SimpleNamespace(id=2)

        credited = await referrals.credit_referral_for_user(db, invited, "Abc12345")

        self.assertTrue(credited)
        self.assertEqual(len(added), 1)
        self.assertIsInstance(added[0], models.Referral)
        self.assertEqual(added[0].inviter_user_id, 1)
        self.assertEqual(added[0].invited_user_id, 2)
        self.assertEqual(added[0].referral_code_used, "Abc12345")
        db.commit.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
