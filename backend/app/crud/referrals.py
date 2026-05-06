import re
import secrets
import string
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


REFERRAL_CODE_RE = re.compile(r"^[A-Za-z0-9]{6,32}$")
REFERRAL_ALPHABET = string.ascii_letters + string.digits
REFERRAL_CODE_LENGTH = 10
MOSCOW_TZ = ZoneInfo("Europe/Moscow")
NO_UNIVERSITY_LABEL = "Без вуза"
NO_INSTITUTE_LABEL = "Без факультета"


def normalize_referral_code(value) -> str | None:
    code = str(value or "").strip()
    if not REFERRAL_CODE_RE.fullmatch(code):
        return None
    return code


def _generate_referral_code() -> str:
    return "".join(secrets.choice(REFERRAL_ALPHABET) for _ in range(REFERRAL_CODE_LENGTH))


def _clean_group_value(value) -> str:
    return str(value or "").strip()


def _normalize_group_key(value) -> str:
    return re.sub(r"\s+", " ", _clean_group_value(value)).casefold()


def _university_identity(user) -> dict:
    campus_id = _clean_group_value(getattr(user, "campus_id", None))
    university = _clean_group_value(getattr(user, "university", None)) or _clean_group_value(
        getattr(user, "custom_university", None)
    )
    city = _clean_group_value(getattr(user, "city", None)) or _clean_group_value(
        getattr(user, "custom_city", None)
    )

    if campus_id:
        key = f"campus:{campus_id}"
    elif university:
        key = f"university:{_normalize_group_key(university)}"
    else:
        key = "university:unknown"
        university = NO_UNIVERSITY_LABEL

    return {
        "key": key,
        "label": university,
        "campus_id": campus_id or None,
        "university": university,
        "city": city or None,
    }


def _institute_identity(user) -> dict:
    label = _clean_group_value(getattr(user, "institute", None)) or _clean_group_value(
        getattr(user, "custom_faculty", None)
    ) or NO_INSTITUTE_LABEL

    return {
        "key": f"institute:{_normalize_group_key(label)}",
        "label": label,
    }


def _rank_group_counts(groups: dict, my_key: str | None, limit: int) -> list[dict]:
    ordered = sorted(
        groups.values(),
        key=lambda item: (-item["referrals_count"], item["label"].casefold(), item["key"]),
    )

    leaderboard = []
    for index, item in enumerate(ordered[:limit], start=1):
        leaderboard.append({
            **item,
            "rank": index,
            "is_my_group": bool(my_key and item["key"] == my_key),
        })
    return leaderboard


def build_university_leaderboard(inviter_rows, current_user, limit: int = 10) -> list[dict]:
    my_key = _university_identity(current_user)["key"]
    groups = {}

    for row in inviter_rows:
        identity = _university_identity(row)
        group = groups.setdefault(identity["key"], {
            "key": identity["key"],
            "label": identity["label"],
            "campus_id": identity["campus_id"],
            "university": identity["university"],
            "city": identity["city"],
            "referrals_count": 0,
        })
        group["referrals_count"] += int(getattr(row, "referrals_count", 1) or 1)

    return _rank_group_counts(groups, my_key, limit)


def build_institute_scope(current_user) -> dict:
    return _university_identity(current_user)


def build_institute_leaderboard(inviter_rows, current_user, limit: int = 10) -> list[dict]:
    scope = build_institute_scope(current_user)
    my_institute_key = _institute_identity(current_user)["key"]
    groups = {}

    for row in inviter_rows:
        university_identity = _university_identity(row)
        if university_identity["key"] != scope["key"]:
            continue

        institute_identity = _institute_identity(row)
        group = groups.setdefault(institute_identity["key"], {
            "key": institute_identity["key"],
            "label": institute_identity["label"],
            "campus_id": scope["campus_id"],
            "university": scope["university"],
            "city": scope["city"],
            "referrals_count": 0,
        })
        group["referrals_count"] += int(getattr(row, "referrals_count", 1) or 1)

    return _rank_group_counts(groups, my_institute_key, limit)


def get_current_referral_period(now_utc: datetime | None = None) -> tuple[datetime, datetime]:
    now_utc = now_utc or datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=timezone.utc)

    now_moscow = now_utc.astimezone(MOSCOW_TZ)
    start_moscow = (now_moscow - timedelta(days=now_moscow.weekday())).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    end_moscow = start_moscow + timedelta(days=7)

    start_utc = start_moscow.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_moscow.astimezone(timezone.utc).replace(tzinfo=None)
    return start_utc, end_utc


async def ensure_user_referral_code(db: AsyncSession, user: models.User) -> str:
    existing = normalize_referral_code(user.referral_code)
    if existing:
        return existing

    for _ in range(8):
        generated_code = _generate_referral_code()
        try:
            await db.execute(
                update(models.User)
                .where(
                    models.User.id == user.id,
                    models.User.referral_code.is_(None),
                )
                .values(referral_code=generated_code)
            )
            await db.commit()
            await db.refresh(user)
            existing = normalize_referral_code(user.referral_code)
            if existing:
                return existing
        except IntegrityError:
            await db.rollback()
            await db.refresh(user)
            existing = normalize_referral_code(user.referral_code)
            if existing:
                return existing

    raise RuntimeError("Failed to generate referral code")


async def credit_referral_for_user(
    db: AsyncSession,
    invited_user: models.User,
    raw_referral_code: str | None,
) -> bool:
    referral_code = normalize_referral_code(raw_referral_code)
    if not referral_code:
        return False

    inviter = await db.scalar(
        select(models.User).where(models.User.referral_code == referral_code)
    )
    if not inviter or inviter.id == invited_user.id:
        return False

    existing = await db.scalar(
        select(models.Referral).where(models.Referral.invited_user_id == invited_user.id)
    )
    if existing:
        return False

    db.add(models.Referral(
        inviter_user_id=inviter.id,
        invited_user_id=invited_user.id,
        referral_code_used=referral_code,
    ))

    try:
        await db.commit()
        return True
    except IntegrityError:
        await db.rollback()
        return False


async def get_referral_summary(
    db: AsyncSession,
    user: models.User,
    limit: int = 10,
) -> dict:
    referral_code = await ensure_user_referral_code(db, user)
    period_start, period_end = get_current_referral_period()
    period_filters = (
        models.Referral.credited_at >= period_start,
        models.Referral.credited_at < period_end,
    )

    my_count = await db.scalar(
        select(func.count(models.Referral.id)).where(
            models.Referral.inviter_user_id == user.id,
            *period_filters,
        )
    ) or 0

    count_expr = func.count(models.Referral.id)
    leaderboard_rows = await db.execute(
        select(
            models.User.id.label("user_id"),
            models.User.name,
            models.User.avatar,
            count_expr.label("referrals_count"),
        )
        .join(models.Referral, models.Referral.inviter_user_id == models.User.id)
        .where(*period_filters)
        .group_by(models.User.id, models.User.name, models.User.avatar)
        .order_by(count_expr.desc(), models.User.id.asc())
        .limit(limit)
    )

    leaderboard = []
    for index, row in enumerate(leaderboard_rows, start=1):
        leaderboard.append({
            "rank": index,
            "user_id": row.user_id,
            "name": row.name,
            "avatar": row.avatar,
            "referrals_count": int(row.referrals_count or 0),
            "is_me": row.user_id == user.id,
        })

    my_rank = None
    if my_count > 0:
        rank_rows = await db.execute(
            select(
                models.User.id.label("user_id"),
                count_expr.label("referrals_count"),
            )
            .join(models.Referral, models.Referral.inviter_user_id == models.User.id)
            .where(*period_filters)
            .group_by(models.User.id)
            .order_by(count_expr.desc(), models.User.id.asc())
        )
        for index, row in enumerate(rank_rows, start=1):
            if row.user_id == user.id:
                my_rank = index
                break

    inviter_rows_result = await db.execute(
        select(
            models.User.campus_id,
            models.User.university,
            models.User.custom_university,
            models.User.city,
            models.User.custom_city,
            models.User.institute,
            models.User.custom_faculty,
            count_expr.label("referrals_count"),
        )
        .join(models.Referral, models.Referral.inviter_user_id == models.User.id)
        .where(*period_filters)
        .group_by(
            models.User.campus_id,
            models.User.university,
            models.User.custom_university,
            models.User.city,
            models.User.custom_city,
            models.User.institute,
            models.User.custom_faculty,
        )
        .order_by(count_expr.desc())
    )
    inviter_rows = inviter_rows_result.all()
    university_leaderboard = build_university_leaderboard(inviter_rows, user, limit)
    institute_scope = build_institute_scope(user)
    institute_leaderboard = build_institute_leaderboard(inviter_rows, user, limit)

    return {
        "referral_code": referral_code,
        "period_start": period_start,
        "period_end": period_end,
        "my_count": int(my_count),
        "my_rank": my_rank,
        "leaderboard": leaderboard,
        "people_leaderboard": leaderboard,
        "university_leaderboard": university_leaderboard,
        "institute_leaderboard": institute_leaderboard,
        "institute_scope": institute_scope,
    }
