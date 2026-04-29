
from __future__ import annotations

import asyncio
import csv
import hashlib
import hmac
import json
import logging
import uuid
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.config import get_settings
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

MSK_TZ = ZoneInfo("Europe/Moscow")
INSUFFICIENT_DATA = "insufficient_data"
OK_STATUS = "ok"
WINDOW_NOT_MATURED = "window_not_matured"

REQUIRED_EVENT_NAMES: Tuple[str, ...] = (
    "app_open",
    "onboarding_step_completed",
    "onboarding_completed",
    "feed_open",
    "post_impression",
    "post_open",
    "post_like",
    "comment_create",
    "create_open",
    "create_submit",
    "create_success",
    "request_open",
    "request_response_create",
    "market_item_open",
    "market_favorite",
    "dating_like",
    "dating_match",
    "notification_open",
    "report_create",
    "report_reviewed",
    "ad_impression",
    "ad_click",
)

REAL_ACTIVITY_EVENT_NAMES: Tuple[str, ...] = (
    "feed_open",
    "post_open",
    "post_like",
    "comment_create",
    "create_success",
    "request_open",
    "request_response_create",
    "market_item_open",
    "market_favorite",
    "market_contact",
    "dating_like",
    "dating_match",
    "notification_open",
    "report_create",
    "ad_click",
)

EVENT_MODULES: Dict[str, str] = {
    "app_open": "app",
    "feed_open": "feed",
    "post_impression": "feed",
    "post_open": "feed",
    "post_like": "feed",
    "comment_create": "feed",
    "create_open": "content",
    "create_submit": "content",
    "create_success": "content",
    "request_open": "requests",
    "request_response_create": "requests",
    "market_item_open": "market",
    "market_favorite": "market",
    "market_contact": "market",
    "dating_like": "dating",
    "dating_match": "dating",
    "notification_open": "notifications",
    "report_create": "moderation",
    "report_reviewed": "moderation",
    "ad_impression": "ads",
    "ad_click": "ads",
}

SESSION_GAP_SECONDS = 30 * 60
SINGLE_EVENT_SESSION_SECONDS = 15

ACTION_USAGE_DEFINITIONS: Tuple[Dict[str, Any], ...] = (
    {
        "action_key": "feed_read",
        "label": "Feed readers",
        "module": "feed",
        "base_events": ("feed_open",),
        "completion_events": ("post_open",),
    },
    {
        "action_key": "feed_engage",
        "label": "Feed engaged users",
        "module": "feed",
        "base_events": ("post_open",),
        "completion_events": ("post_like", "comment_create"),
    },
    {
        "action_key": "content_create",
        "label": "Content creators",
        "module": "content",
        "base_events": ("create_open", "create_submit", "create_success"),
        "completion_events": ("create_success",),
    },
    {
        "action_key": "request_respond",
        "label": "Request responders",
        "module": "requests",
        "base_events": ("request_open",),
        "completion_events": ("request_response_create",),
    },
    {
        "action_key": "market_contact",
        "label": "Market contacts",
        "module": "market",
        "base_events": ("market_item_open",),
        "completion_events": ("market_contact", "market_favorite"),
    },
    {
        "action_key": "dating_like",
        "label": "Dating likes",
        "module": "dating",
        "base_events": ("dating_like",),
        "completion_events": ("dating_like",),
    },
    {
        "action_key": "notification_open",
        "label": "Notification opens",
        "module": "notifications",
        "base_events": ("notification_open",),
        "completion_events": ("notification_open",),
    },
    {
        "action_key": "ad_click",
        "label": "Ad clicks",
        "module": "ads",
        "base_events": ("ad_impression",),
        "completion_events": ("ad_click",),
    },
)

KPI_DEFINITIONS: Dict[str, str] = {
    "dau": "distinct users with meaningful events on report_date",
    "wau": "distinct users with meaningful events in report_date-6..report_date",
    "mau": "distinct users with meaningful events in report_date-29..report_date",
    "stickiness_pct": "dau / mau * 100",
    "activation_rate_pct": "activated_users / new_users * 100",
    "d1_retention_pct": "users_returned_d1 / cohort_new_users * 100",
    "d7_retention_pct": "users_returned_d7 / cohort_new_users * 100",
    "d30_retention_pct": "users_returned_d30 / cohort_new_users * 100",
    "feed_engagement_pct": "engaged_feed_users / feed_view_users * 100",
    "post_open_rate_pct": "post_open_users / post_impression_users * 100",
    "create_conversion_pct": "create_success_users / create_open_users * 100",
    "request_response_rate_pct": "requests_with_response / total_active_requests * 100",
    "market_favorite_rate_pct": "favorites / market_item_opens * 100",
    "match_rate_pct": "matches / dating_likes * 100",
    "notification_action_rate_pct": "notifications_acted / notifications_opened * 100",
    "moderation_sla_24h_pct": "reports_reviewed_under_24h / reports_reviewed_total * 100",
    "ads_ctr_pct": "ad_clicks / ad_impressions * 100",
}


@dataclass
class PercentMetric:
    metric_key: str
    label: str
    numerator: float
    denominator: float
    pct_value: Optional[float]
    calc_status: str


def hash_user_id(user_id: int, salt: str) -> str:
    return hmac.new(
        key=salt.encode("utf-8"),
        msg=str(user_id).encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()


def build_event_dedup_key(
    *,
    request_id: str,
    event_name: str,
    user_hash: str,
    entity_type: Optional[str],
    entity_id: Optional[int],
) -> str:
    entity_type_part = entity_type or "-"
    entity_id_part = str(entity_id) if entity_id is not None else "-"
    return f"{request_id}|{event_name}|{user_hash}|{entity_type_part}|{entity_id_part}"


def normalize_utc(value: Optional[datetime]) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def to_naive_utc(value: datetime) -> datetime:
    return normalize_utc(value).replace(tzinfo=None)


def normalize_entity_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def normalize_entity_id(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except Exception:
        return None


def normalize_properties(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def safe_percent(numerator: float, denominator: float) -> Tuple[Optional[float], str]:
    if denominator in (0, 0.0, None):
        return None, INSUFFICIENT_DATA
    return round((float(numerator) / float(denominator)) * 100.0, 4), OK_STATUS


def percentage_metric(metric_key: str, label: str, numerator: float, denominator: float) -> PercentMetric:
    pct_value, calc_status = safe_percent(numerator, denominator)
    return PercentMetric(
        metric_key=metric_key,
        label=label,
        numerator=float(numerator),
        denominator=float(denominator),
        pct_value=pct_value,
        calc_status=calc_status,
    )


def wow_change(current: Optional[float], previous: Optional[float]) -> Optional[float]:
    if current is None or previous in (None, 0, 0.0):
        return None
    return round(((current - previous) / abs(previous)) * 100.0, 4)


def event_module(event_name: Optional[str], screen: Optional[str] = None) -> str:
    if screen:
        normalized_screen = str(screen).strip().lower()
        if normalized_screen:
            for known in ("feed", "requests", "market", "dating", "notifications", "moderation", "ads"):
                if known in normalized_screen:
                    return known
            if "post" in normalized_screen:
                return "feed"
            if "create" in normalized_screen:
                return "content"
    return EVENT_MODULES.get(str(event_name or ""), "other")


def msk_day_bounds_utc(day: date) -> Tuple[datetime, datetime]:
    start_msk = datetime.combine(day, time.min, tzinfo=MSK_TZ)
    end_msk = start_msk + timedelta(days=1)
    return (
        start_msk.astimezone(timezone.utc).replace(tzinfo=None),
        end_msk.astimezone(timezone.utc).replace(tzinfo=None),
    )


async def ingest_events(db: AsyncSession, user_id: int, events: Sequence[Any]) -> Dict[str, Any]:
    settings = get_settings()
    user_hash = hash_user_id(user_id, settings.analytics_salt)

    rows: List[Dict[str, Any]] = []
    event_dates: List[date] = []
    for event in events:
        raw = event.model_dump() if hasattr(event, "model_dump") else dict(event)
        ts_utc = normalize_utc(raw.get("event_ts_utc"))
        event_date_msk = ts_utc.astimezone(MSK_TZ).date()

        request_id = str(raw.get("request_id") or uuid.uuid4())
        event_name = str(raw["event_name"])
        entity_type = normalize_entity_type(raw.get("entity_type"))
        entity_id = normalize_entity_id(raw.get("entity_id"))

        rows.append(
            {
                "event_name": event_name,
                "event_ts_utc": to_naive_utc(ts_utc),
                "event_date_msk": event_date_msk,
                "user_hash": user_hash,
                "session_id": raw.get("session_id"),
                "platform": raw.get("platform"),
                "app_version": raw.get("app_version"),
                "screen": raw.get("screen"),
                "entity_type": entity_type,
                "entity_id": entity_id,
                "properties_json": normalize_properties(raw.get("properties_json")),
                "ingest_source": raw.get("ingest_source") or "client",
                "request_id": request_id,
                "dedup_key": build_event_dedup_key(
                    request_id=request_id,
                    event_name=event_name,
                    user_hash=user_hash,
                    entity_type=entity_type,
                    entity_id=entity_id,
                ),
                "created_at": datetime.utcnow(),
            }
        )
        event_dates.append(event_date_msk)

    if not rows:
        return {"total": 0, "accepted": 0, "deduplicated": 0, "rejected": 0, "event_date_msk": None}

    stmt = (
        pg_insert(models.AnalyticsEvent)
        .values(rows)
        .on_conflict_do_nothing(index_elements=["dedup_key"])
        .returning(models.AnalyticsEvent.id)
    )
    result = await db.execute(stmt)
    inserted = len(result.scalars().all())
    await db.commit()

    unique_dates = sorted(set(event_dates))
    return {
        "total": len(rows),
        "accepted": inserted,
        "deduplicated": max(len(rows) - inserted, 0),
        "rejected": 0,
        "event_date_msk": unique_dates[0] if len(unique_dates) == 1 else None,
    }


async def record_server_event(
    db: AsyncSession,
    user_id: int,
    event_name: str,
    *,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    request_id: Optional[str] = None,
    session_id: Optional[str] = None,
    screen: Optional[str] = None,
    platform: str = "backend",
    app_version: Optional[str] = None,
    properties_json: Optional[Dict[str, Any]] = None,
    ingest_source: str = "server",
    event_ts_utc: Optional[datetime] = None,
    commit: bool = True,
) -> bool:
    settings = get_settings()
    user_hash = hash_user_id(user_id, settings.analytics_salt)
    ts_utc = normalize_utc(event_ts_utc)
    request_id_value = request_id or str(uuid.uuid4())

    row = {
        "event_name": event_name,
        "event_ts_utc": to_naive_utc(ts_utc),
        "event_date_msk": ts_utc.astimezone(MSK_TZ).date(),
        "user_hash": user_hash,
        "session_id": session_id,
        "platform": platform,
        "app_version": app_version,
        "screen": screen,
        "entity_type": normalize_entity_type(entity_type),
        "entity_id": normalize_entity_id(entity_id),
        "properties_json": normalize_properties(properties_json),
        "ingest_source": ingest_source,
        "request_id": request_id_value,
        "dedup_key": build_event_dedup_key(
            request_id=request_id_value,
            event_name=event_name,
            user_hash=user_hash,
            entity_type=normalize_entity_type(entity_type),
            entity_id=normalize_entity_id(entity_id),
        ),
        "created_at": datetime.utcnow(),
    }

    try:
        await db.execute(
            pg_insert(models.AnalyticsEvent)
            .values(row)
            .on_conflict_do_nothing(index_elements=["dedup_key"])
        )
        if commit:
            await db.commit()
        return True
    except Exception as exc:
        logger.warning("Analytics server event write failed: %s", exc)
        if commit:
            await db.rollback()
        return False

async def _load_new_users(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> Tuple[int, List[int]]:
    rows = await db.execute(
        select(models.User.id).where(
            models.User.created_at >= day_start_utc,
            models.User.created_at < day_end_utc,
        )
    )
    ids = [row[0] for row in rows.all()]
    return len(ids), ids


async def _count_events(db: AsyncSession, report_date: date, names: Sequence[str]) -> int:
    if not names:
        return 0
    value = await db.scalar(
        select(func.count(models.AnalyticsEvent.id)).where(
            models.AnalyticsEvent.event_date_msk == report_date,
            models.AnalyticsEvent.event_name.in_(list(names)),
        )
    )
    return int(value or 0)


async def count_distinct_active_users_between_dates(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    names: Sequence[str] = REAL_ACTIVITY_EVENT_NAMES,
) -> int:
    if not names or end_date < start_date:
        return 0
    value = await db.scalar(
        select(func.count(func.distinct(models.AnalyticsEvent.user_hash))).where(
            models.AnalyticsEvent.event_date_msk >= start_date,
            models.AnalyticsEvent.event_date_msk <= end_date,
            models.AnalyticsEvent.event_name.in_(list(names)),
        )
    )
    return int(value or 0)


async def _count_events_between_dates(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    names: Sequence[str],
) -> int:
    if not names or end_date < start_date:
        return 0
    value = await db.scalar(
        select(func.count(models.AnalyticsEvent.id)).where(
            models.AnalyticsEvent.event_date_msk >= start_date,
            models.AnalyticsEvent.event_date_msk <= end_date,
            models.AnalyticsEvent.event_name.in_(list(names)),
        )
    )
    return int(value or 0)


async def _count_distinct_users_for_event(
    db: AsyncSession,
    report_date: date,
    names: Sequence[str],
    *,
    allowed_user_hashes: Optional[Iterable[str]] = None,
) -> int:
    if not names:
        return 0

    filters: List[Any] = [
        models.AnalyticsEvent.event_date_msk == report_date,
        models.AnalyticsEvent.event_name.in_(list(names)),
    ]
    if allowed_user_hashes is not None:
        hashes = list(allowed_user_hashes)
        if not hashes:
            return 0
        filters.append(models.AnalyticsEvent.user_hash.in_(hashes))

    value = await db.scalar(select(func.count(func.distinct(models.AnalyticsEvent.user_hash))).where(*filters))
    return int(value or 0)


async def build_action_usage_rows(db: AsyncSession, report_date: date) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []

    for definition in ACTION_USAGE_DEFINITIONS:
        base_events = tuple(definition["base_events"])
        completion_events = tuple(definition["completion_events"])
        base_users = await _count_distinct_users_for_event(db, report_date, base_events)
        active_users = await _count_distinct_users_for_event(db, report_date, completion_events)
        events_count = await _count_events(db, report_date, completion_events)
        pct, status = safe_percent(active_users, base_users)

        rows.append(
            {
                "action_key": definition["action_key"],
                "label": definition["label"],
                "module": definition["module"],
                "base_users": base_users,
                "active_users": active_users,
                "events_count": events_count,
                "completion_pct": pct,
                "calc_status": status,
            }
        )

    return rows


async def estimate_online_time_between_dates(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    names: Sequence[str] = REAL_ACTIVITY_EVENT_NAMES,
) -> Dict[str, Any]:
    if not names or end_date < start_date:
        return {
            "users_count": 0,
            "sessions_count": 0,
            "total_active_seconds": 0,
            "avg_session_seconds": 0,
            "avg_daily_user_seconds": 0,
            "places": [],
        }

    result = await db.execute(
        select(
            models.AnalyticsEvent.user_hash,
            models.AnalyticsEvent.event_ts_utc,
            models.AnalyticsEvent.event_date_msk,
            models.AnalyticsEvent.event_name,
            models.AnalyticsEvent.screen,
        )
        .where(
            models.AnalyticsEvent.event_date_msk >= start_date,
            models.AnalyticsEvent.event_date_msk <= end_date,
            models.AnalyticsEvent.event_name.in_(list(names)),
        )
        .order_by(models.AnalyticsEvent.user_hash, models.AnalyticsEvent.event_ts_utc)
    )

    rows = result.all()
    if not rows:
        return {
            "users_count": 0,
            "sessions_count": 0,
            "total_active_seconds": 0,
            "avg_session_seconds": 0,
            "avg_daily_user_seconds": 0,
            "places": [],
        }

    users = set()
    active_user_days = set()
    sessions_count = 0
    total_active_seconds = 0
    place_map: Dict[str, Dict[str, Any]] = {}

    current_user: Optional[str] = None
    current_session_events = 0
    previous_ts: Optional[datetime] = None
    previous_module: Optional[str] = None

    def ensure_place(module: str) -> Dict[str, Any]:
        if module not in place_map:
            place_map[module] = {
                "module": module,
                "active_seconds": 0,
                "events_count": 0,
                "users": set(),
            }
        return place_map[module]

    def close_session() -> None:
        nonlocal sessions_count, total_active_seconds, current_session_events, previous_module
        if current_session_events <= 0:
            return
        sessions_count += 1
        if current_session_events == 1 and previous_module:
            place = ensure_place(previous_module)
            place["active_seconds"] += SINGLE_EVENT_SESSION_SECONDS
            total_active_seconds += SINGLE_EVENT_SESSION_SECONDS
        current_session_events = 0

    for user_hash, event_ts, event_date_msk, event_name, screen in rows:
        if event_ts is None:
            continue
        module = event_module(event_name, screen)
        users.add(user_hash)
        active_user_days.add((user_hash, event_date_msk))

        place = ensure_place(module)
        place["events_count"] += 1
        place["users"].add(user_hash)

        if current_user != user_hash:
            close_session()
            current_user = user_hash
            current_session_events = 1
            previous_ts = event_ts
            previous_module = module
            continue

        gap_seconds = int((event_ts - previous_ts).total_seconds()) if previous_ts else 0
        if gap_seconds < 0:
            gap_seconds = 0

        if gap_seconds > SESSION_GAP_SECONDS:
            close_session()
            current_session_events = 1
        else:
            duration = gap_seconds
            if duration > 0 and previous_module:
                prev_place = ensure_place(previous_module)
                prev_place["active_seconds"] += duration
                total_active_seconds += duration
            current_session_events += 1

        previous_ts = event_ts
        previous_module = module

    close_session()

    denominator_days = max(len(active_user_days), 1)
    places: List[Dict[str, Any]] = []
    for row in place_map.values():
        users_set = row.pop("users")
        active_seconds = int(row["active_seconds"])
        places.append(
            {
                "module": row["module"],
                "active_seconds": active_seconds,
                "avg_user_seconds": int(round(active_seconds / max(len(users_set), 1))),
                "events_count": int(row["events_count"]),
                "users_count": len(users_set),
            }
        )

    places.sort(key=lambda item: item["active_seconds"], reverse=True)

    return {
        "users_count": len(users),
        "sessions_count": sessions_count,
        "total_active_seconds": int(total_active_seconds),
        "avg_session_seconds": int(round(total_active_seconds / max(sessions_count, 1))),
        "avg_daily_user_seconds": int(round(total_active_seconds / denominator_days)),
        "places": places,
        "method": {
            "session_gap_seconds": SESSION_GAP_SECONDS,
            "single_event_session_seconds": SINGLE_EVENT_SESSION_SECONDS,
        },
    }


async def build_admin_usage_summary(db: AsyncSession, today_msk: date) -> Dict[str, Any]:
    dau = await count_distinct_active_users_between_dates(db, today_msk, today_msk)
    wau = await count_distinct_active_users_between_dates(db, today_msk - timedelta(days=6), today_msk)
    mau = await count_distinct_active_users_between_dates(db, today_msk - timedelta(days=29), today_msk)
    stickiness_pct, _ = safe_percent(dau, mau)

    return {
        "real_dau": dau,
        "real_wau": wau,
        "real_mau": mau,
        "stickiness_pct": stickiness_pct,
        "activity_events_today": await _count_events_between_dates(db, today_msk, today_msk, REAL_ACTIVITY_EVENT_NAMES),
        "action_usage_today": await build_action_usage_rows(db, today_msk),
        "online_time_30d": await estimate_online_time_between_dates(
            db,
            today_msk - timedelta(days=29),
            today_msk,
        ),
    }


async def _count_returned_users_for_cohort(
    db: AsyncSession,
    *,
    target_date: date,
    cohort_user_hashes: Iterable[str],
) -> int:
    hashes = list(cohort_user_hashes)
    if not hashes:
        return 0
    value = await db.scalar(
        select(func.count(func.distinct(models.AnalyticsEvent.user_hash))).where(
            models.AnalyticsEvent.event_date_msk == target_date,
            models.AnalyticsEvent.user_hash.in_(hashes),
        )
    )
    return int(value or 0)


async def _count_requests_with_response(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> int:
    value = await db.scalar(
        select(func.count(func.distinct(models.RequestResponse.request_id))).where(
            models.RequestResponse.created_at >= day_start_utc,
            models.RequestResponse.created_at < day_end_utc,
        )
    )
    return int(value or 0)


async def _count_active_requests(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> int:
    value = await db.scalar(
        select(func.count(models.Request.id)).where(
            models.Request.is_deleted == False,  # noqa: E712
            models.Request.status == "active",
            models.Request.created_at < day_end_utc,
            models.Request.expires_at >= day_start_utc,
        )
    )
    return int(value or 0)


async def _count_market_favorites(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> int:
    value = await db.scalar(
        select(func.count(models.MarketFavorite.id)).where(
            models.MarketFavorite.created_at >= day_start_utc,
            models.MarketFavorite.created_at < day_end_utc,
        )
    )
    return int(value or 0)


async def _count_market_opens_from_views(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> int:
    value = await db.scalar(
        select(func.count(models.MarketItemView.id)).where(
            models.MarketItemView.viewed_at >= day_start_utc,
            models.MarketItemView.viewed_at < day_end_utc,
        )
    )
    return int(value or 0)


async def _count_dating_likes(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> int:
    value = await db.scalar(
        select(func.count(models.DatingLike.id)).where(
            models.DatingLike.created_at >= day_start_utc,
            models.DatingLike.created_at < day_end_utc,
            models.DatingLike.is_like == True,  # noqa: E712
        )
    )
    return int(value or 0)


async def _count_matches(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> int:
    value = await db.scalar(
        select(func.count(models.Match.id)).where(
            models.Match.matched_at >= day_start_utc,
            models.Match.matched_at < day_end_utc,
        )
    )
    return int(value or 0)


async def _count_notifications_read(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> int:
    value = await db.scalar(
        select(func.count(models.Notification.id)).where(
            models.Notification.read_at.is_not(None),
            models.Notification.read_at >= day_start_utc,
            models.Notification.read_at < day_end_utc,
        )
    )
    return int(value or 0)


async def _count_notification_actions(db: AsyncSession, report_date: date) -> int:
    rows = await db.execute(
        select(models.AnalyticsEvent.properties_json).where(
            models.AnalyticsEvent.event_date_msk == report_date,
            models.AnalyticsEvent.event_name == "notification_open",
        )
    )
    acted = 0
    for props in rows.scalars().all():
        payload = props if isinstance(props, dict) else {}
        if bool(payload.get("acted") or payload.get("action_taken") or payload.get("clicked")):
            acted += 1
    return acted


async def _count_reports_reviewed(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> Tuple[int, int]:
    rows = await db.execute(
        select(models.Report.created_at, models.Report.reviewed_at).where(
            models.Report.reviewed_at.is_not(None),
            models.Report.reviewed_at >= day_start_utc,
            models.Report.reviewed_at < day_end_utc,
            models.Report.status.in_(["reviewed", "dismissed"]),
        )
    )
    total = 0
    under_24h = 0
    for created_at, reviewed_at in rows.all():
        if not reviewed_at:
            continue
        total += 1
        if created_at and (reviewed_at - created_at).total_seconds() <= 24 * 3600:
            under_24h += 1
    return total, under_24h


async def _count_reports_created(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> int:
    value = await db.scalar(
        select(func.count(models.Report.id)).where(
            models.Report.created_at >= day_start_utc,
            models.Report.created_at < day_end_utc,
        )
    )
    return int(value or 0)


async def _count_ad_impressions(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> int:
    value = await db.scalar(
        select(func.count(models.AdImpression.id)).where(
            models.AdImpression.viewed_at >= day_start_utc,
            models.AdImpression.viewed_at < day_end_utc,
        )
    )
    return int(value or 0)


async def _count_ad_clicks(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> int:
    value = await db.scalar(
        select(func.count(models.AdClick.id)).where(
            models.AdClick.clicked_at >= day_start_utc,
            models.AdClick.clicked_at < day_end_utc,
        )
    )
    return int(value or 0)


async def _load_wow_for_metrics(
    db: AsyncSession,
    report_date: date,
    metric_keys: Sequence[str],
    current_metrics: Sequence[PercentMetric],
) -> Dict[str, Optional[float]]:
    current_map = {m.metric_key: m.pct_value for m in current_metrics}
    prev_date = report_date - timedelta(days=7)

    rows = await db.execute(
        select(models.AnalyticsDailyMetric.metric_key, models.AnalyticsDailyMetric.pct_value).where(
            models.AnalyticsDailyMetric.date_msk == prev_date,
            models.AnalyticsDailyMetric.slice_name == "kpi_daily",
            models.AnalyticsDailyMetric.metric_key.in_(list(metric_keys)),
        )
    )
    prev_map = {key: value for key, value in rows.all()}
    return {key: wow_change(current_map.get(key), prev_map.get(key)) for key in metric_keys}


async def _load_event_name_counts(db: AsyncSession, report_date: date) -> Dict[str, int]:
    rows = await db.execute(
        select(models.AnalyticsEvent.event_name, func.count(models.AnalyticsEvent.id)).where(
            models.AnalyticsEvent.event_date_msk == report_date
        ).group_by(models.AnalyticsEvent.event_name)
    )
    return {name: int(count) for name, count in rows.all()}


async def _compute_late_events_rate(db: AsyncSession, day_start_utc: datetime, day_end_utc: datetime) -> Optional[float]:
    rows = await db.execute(
        select(models.AnalyticsEvent.created_at, models.AnalyticsEvent.event_ts_utc).where(
            models.AnalyticsEvent.created_at >= day_start_utc,
            models.AnalyticsEvent.created_at < day_end_utc,
        )
    )
    pairs = rows.all()
    if not pairs:
        return None

    total = 0
    late = 0
    for created_at, event_ts in pairs:
        if not created_at or not event_ts:
            continue
        total += 1
        if (created_at - event_ts).total_seconds() > 6 * 3600:
            late += 1

    if total == 0:
        return None
    return round((late / total) * 100, 4)


async def _compute_metric_drift_rate(
    db: AsyncSession,
    current_metrics: Sequence[PercentMetric],
    report_date: date,
) -> Optional[float]:
    keys = [m.metric_key for m in current_metrics]
    prev_date = report_date - timedelta(days=1)

    rows = await db.execute(
        select(models.AnalyticsDailyMetric.metric_key, models.AnalyticsDailyMetric.pct_value).where(
            models.AnalyticsDailyMetric.slice_name == "kpi_daily",
            models.AnalyticsDailyMetric.date_msk == prev_date,
            models.AnalyticsDailyMetric.metric_key.in_(keys),
        )
    )
    prev_map = {key: value for key, value in rows.all()}

    comparable = 0
    drifted = 0
    for metric in current_metrics:
        prev = prev_map.get(metric.metric_key)
        curr = metric.pct_value
        if prev in (None, 0, 0.0) or curr is None:
            continue
        comparable += 1
        if abs(curr - prev) / abs(prev) > 0.3:
            drifted += 1

    if comparable == 0:
        return None
    return round((drifted / comparable) * 100, 4)

def _to_optional_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _find_metric_value(metrics: Sequence[PercentMetric], metric_key: str) -> Optional[float]:
    for metric in metrics:
        if metric.metric_key == metric_key:
            return metric.pct_value
    return None


def _find_metric_status(metrics: Sequence[PercentMetric], metric_key: str) -> str:
    for metric in metrics:
        if metric.metric_key == metric_key:
            return metric.calc_status
    return INSUFFICIENT_DATA


def build_funnels(
    *,
    new_users_count: int,
    onboarding_step_users: int,
    onboarding_completed_users: int,
    create_open_users: int,
    create_submit_users: int,
    create_success_users: int,
    request_open_users: int,
    request_response_users: int,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []

    def add_step(funnel: str, step_order: int, step_name: str, users: int, base: Optional[int]) -> None:
        pct, status = safe_percent(users, base)
        rows.append(
            {
                "funnel": funnel,
                "step_order": step_order,
                "step_name": step_name,
                "users": users,
                "from_prev_pct": pct,
                "calc_status": status,
            }
        )

    add_step("onboarding", 1, "new_users", new_users_count, new_users_count)
    add_step("onboarding", 2, "onboarding_step_completed", onboarding_step_users, new_users_count)
    add_step("onboarding", 3, "onboarding_completed", onboarding_completed_users, onboarding_step_users)

    add_step("create", 1, "create_open", create_open_users, create_open_users)
    add_step("create", 2, "create_submit", create_submit_users, create_open_users)
    add_step("create", 3, "create_success", create_success_users, create_submit_users)

    add_step("requests", 1, "request_open", request_open_users, request_open_users)
    add_step("requests", 2, "request_response_create", request_response_users, request_open_users)

    return rows


def _build_flat_metrics(
    *,
    kpi_metrics: Sequence[PercentMetric],
    funnel_rows: Sequence[Dict[str, Any]],
    modules_rows: Sequence[Dict[str, Any]],
    quality_rows: Sequence[Dict[str, Any]],
    retention_rows: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []

    for metric in kpi_metrics:
        rows.append(
            {
                "slice_name": "kpi_daily",
                "metric_key": metric.metric_key,
                "dimension_key": "all",
                "value_num": metric.pct_value if metric.pct_value is not None else 0.0,
                "numerator": metric.numerator,
                "denominator": metric.denominator,
                "pct_value": metric.pct_value,
                "calc_status": metric.calc_status,
            }
        )

    for row in funnel_rows:
        rows.append(
            {
                "slice_name": "funnel_daily",
                "metric_key": row["step_name"],
                "dimension_key": row["funnel"],
                "value_num": float(row["users"]),
                "numerator": float(row["users"]),
                "denominator": None,
                "pct_value": row.get("from_prev_pct"),
                "calc_status": row.get("calc_status") or OK_STATUS,
            }
        )

    for row in retention_rows:
        rows.append(
            {
                "slice_name": "retention_cohort_daily",
                "metric_key": row["window"].lower() + "_retention_pct",
                "dimension_key": "all",
                "value_num": float(row["retention_pct"] or 0.0),
                "numerator": float(row["returned_users"]),
                "denominator": float(row["cohort_users"]),
                "pct_value": row.get("retention_pct"),
                "calc_status": row.get("calc_status") or OK_STATUS,
            }
        )

    for row in modules_rows:
        rows.append(
            {
                "slice_name": "module_daily",
                "metric_key": row["metric_key"],
                "dimension_key": row["module"],
                "value_num": float(row["value"] or 0.0),
                "numerator": float(row["value"] or 0.0),
                "denominator": None,
                "pct_value": None,
                "calc_status": OK_STATUS,
            }
        )

    for row in quality_rows:
        rows.append(
            {
                "slice_name": "quality_daily",
                "metric_key": row["metric_key"],
                "dimension_key": "all",
                "value_num": float(row["value_num"] or 0.0),
                "numerator": _to_optional_float(row.get("numerator")),
                "denominator": _to_optional_float(row.get("denominator")),
                "pct_value": _to_optional_float(row.get("value_num")),
                "calc_status": row.get("calc_status") or OK_STATUS,
            }
        )

    return rows


async def compute_daily_report_metrics(db: AsyncSession, report_date: date) -> Dict[str, Any]:
    day_start_utc, day_end_utc = msk_day_bounds_utc(report_date)
    today_msk = datetime.now(MSK_TZ).date()

    new_users_count, new_user_ids = await _load_new_users(db, day_start_utc, day_end_utc)
    new_user_hashes = {hash_user_id(uid, get_settings().analytics_salt) for uid in new_user_ids}

    activated_users = await _count_distinct_users_for_event(
        db,
        report_date,
        ["onboarding_completed"],
        allowed_user_hashes=new_user_hashes if new_user_hashes else None,
    )

    onboarding_step_users = await _count_distinct_users_for_event(db, report_date, ["onboarding_step_completed"])
    onboarding_completed_users = await _count_distinct_users_for_event(db, report_date, ["onboarding_completed"])

    feed_view_users = await _count_distinct_users_for_event(db, report_date, ["feed_open"])
    engaged_feed_users = await _count_distinct_users_for_event(db, report_date, ["post_open", "post_like", "comment_create"])

    post_open_users = await _count_distinct_users_for_event(db, report_date, ["post_open"])
    post_impression_users = await _count_distinct_users_for_event(db, report_date, ["post_impression"])

    create_open_users = await _count_distinct_users_for_event(db, report_date, ["create_open"])
    create_submit_users = await _count_distinct_users_for_event(db, report_date, ["create_submit"])
    create_success_users = await _count_distinct_users_for_event(db, report_date, ["create_success"])

    requests_with_response = await _count_requests_with_response(db, day_start_utc, day_end_utc)
    total_active_requests = await _count_active_requests(db, day_start_utc, day_end_utc)

    market_favorites = await _count_market_favorites(db, day_start_utc, day_end_utc)
    market_item_opens = await _count_events(db, report_date, ["market_item_open"])
    if market_item_opens == 0:
        market_item_opens = await _count_market_opens_from_views(db, day_start_utc, day_end_utc)

    dating_likes = await _count_dating_likes(db, day_start_utc, day_end_utc)
    matches = await _count_matches(db, day_start_utc, day_end_utc)

    notifications_opened = await _count_events(db, report_date, ["notification_open"])
    notifications_acted = await _count_notification_actions(db, report_date)
    if notifications_opened == 0:
        notifications_opened = await _count_notifications_read(db, day_start_utc, day_end_utc)
        notifications_acted = notifications_opened

    reports_reviewed_total, reports_reviewed_under_24h = await _count_reports_reviewed(db, day_start_utc, day_end_utc)
    reports_created = await _count_reports_created(db, day_start_utc, day_end_utc)

    ad_impressions = await _count_ad_impressions(db, day_start_utc, day_end_utc)
    ad_clicks = await _count_ad_clicks(db, day_start_utc, day_end_utc)

    retention_metrics: List[PercentMetric] = []
    retention_rows: List[Dict[str, Any]] = []
    for window in (1, 7, 30):
        target_date = report_date + timedelta(days=window)
        metric_key = f"d{window}_retention_pct"
        label = f"D{window} Retention %"

        if target_date > today_msk:
            metric = PercentMetric(metric_key=metric_key, label=label, numerator=0.0, denominator=float(new_users_count), pct_value=None, calc_status=WINDOW_NOT_MATURED)
            returned = 0
        else:
            returned = await _count_returned_users_for_cohort(db, target_date=target_date, cohort_user_hashes=new_user_hashes)
            metric = percentage_metric(metric_key, label, returned, new_users_count)

        retention_metrics.append(metric)
        retention_rows.append(
            {
                "window": f"D{window}",
                "cohort_date": report_date.isoformat(),
                "target_date": target_date.isoformat(),
                "cohort_users": new_users_count,
                "returned_users": returned,
                "retention_pct": metric.pct_value,
                "calc_status": metric.calc_status,
            }
        )

    kpi_metrics: List[PercentMetric] = [
        percentage_metric("activation_rate_pct", "Activation Rate %", activated_users, new_users_count),
        percentage_metric("feed_engagement_pct", "Feed Engagement %", engaged_feed_users, feed_view_users),
        percentage_metric("post_open_rate_pct", "Post Open Rate %", post_open_users, post_impression_users),
        percentage_metric("create_conversion_pct", "Create Conversion %", create_success_users, create_open_users),
        percentage_metric("request_response_rate_pct", "Request Response Rate %", requests_with_response, total_active_requests),
        percentage_metric("market_favorite_rate_pct", "Market Favorite Rate %", market_favorites, market_item_opens),
        percentage_metric("match_rate_pct", "Match Rate %", matches, dating_likes),
        percentage_metric("notification_action_rate_pct", "Notification Action Rate %", notifications_acted, notifications_opened),
        percentage_metric("moderation_sla_24h_pct", "Moderation SLA <=24h %", reports_reviewed_under_24h, reports_reviewed_total),
        percentage_metric("ads_ctr_pct", "Ads CTR %", ad_clicks, ad_impressions),
    ]
    kpi_metrics.extend(retention_metrics)

    wow_keys = [
        "activation_rate_pct",
        "feed_engagement_pct",
        "post_open_rate_pct",
        "create_conversion_pct",
        "request_response_rate_pct",
        "market_favorite_rate_pct",
        "match_rate_pct",
        "notification_action_rate_pct",
        "moderation_sla_24h_pct",
        "ads_ctr_pct",
    ]
    wow_map = await _load_wow_for_metrics(db, report_date, wow_keys, kpi_metrics)

    event_name_counts = await _load_event_name_counts(db, report_date)
    missing_events = [name for name in REQUIRED_EVENT_NAMES if event_name_counts.get(name, 0) == 0]
    missing_events_rate = round((len(missing_events) / len(REQUIRED_EVENT_NAMES)) * 100, 4)
    late_events_rate = await _compute_late_events_rate(db, day_start_utc, day_end_utc)
    metric_drift_rate = await _compute_metric_drift_rate(db, kpi_metrics, report_date)

    quality_rows = [
        {"metric_key": "missing_events_rate", "value_num": missing_events_rate, "numerator": len(missing_events), "denominator": len(REQUIRED_EVENT_NAMES), "calc_status": OK_STATUS},
        {"metric_key": "late_events_rate", "value_num": late_events_rate, "numerator": None, "denominator": None, "calc_status": OK_STATUS if late_events_rate is not None else INSUFFICIENT_DATA},
        {"metric_key": "metric_drift_rate", "value_num": metric_drift_rate, "numerator": None, "denominator": None, "calc_status": OK_STATUS if metric_drift_rate is not None else INSUFFICIENT_DATA},
    ]

    kpi_overview_rows: List[Dict[str, Any]] = [
        {"metric_key": "new_users", "label": "New Users", "value": new_users_count, "unit": "users", "wow_pct": None},
        {"metric_key": "activated_users", "label": "Activated Users", "value": activated_users, "unit": "users", "wow_pct": None},
    ]
    for metric in kpi_metrics:
        kpi_overview_rows.append(
            {
                "metric_key": metric.metric_key,
                "label": metric.label,
                "value": metric.pct_value,
                "unit": "%",
                "numerator": metric.numerator,
                "denominator": metric.denominator,
                "calc_status": metric.calc_status,
                "wow_pct": wow_map.get(metric.metric_key),
            }
        )

    funnel_rows = build_funnels(
        new_users_count=new_users_count,
        onboarding_step_users=onboarding_step_users,
        onboarding_completed_users=onboarding_completed_users,
        create_open_users=create_open_users,
        create_submit_users=create_submit_users,
        create_success_users=create_success_users,
        request_open_users=await _count_distinct_users_for_event(db, report_date, ["request_open"]),
        request_response_users=await _count_distinct_users_for_event(db, report_date, ["request_response_create"]),
    )

    modules_rows = [
        {"module": "feed", "metric_key": "feed_open_users", "value": feed_view_users},
        {"module": "feed", "metric_key": "engaged_feed_users", "value": engaged_feed_users},
        {"module": "feed", "metric_key": "post_open_users", "value": post_open_users},
        {"module": "feed", "metric_key": "post_impression_users", "value": post_impression_users},
        {"module": "requests", "metric_key": "total_active_requests", "value": total_active_requests},
        {"module": "requests", "metric_key": "requests_with_response", "value": requests_with_response},
        {"module": "market", "metric_key": "market_item_opens", "value": market_item_opens},
        {"module": "market", "metric_key": "market_favorites", "value": market_favorites},
        {"module": "dating", "metric_key": "dating_likes", "value": dating_likes},
        {"module": "dating", "metric_key": "dating_matches", "value": matches},
        {"module": "notifications", "metric_key": "notifications_opened", "value": notifications_opened},
        {"module": "notifications", "metric_key": "notifications_acted", "value": notifications_acted},
        {"module": "moderation", "metric_key": "reports_created", "value": reports_created},
        {"module": "moderation", "metric_key": "reports_reviewed_total", "value": reports_reviewed_total},
        {"module": "ads", "metric_key": "ad_impressions", "value": ad_impressions},
        {"module": "ads", "metric_key": "ad_clicks", "value": ad_clicks},
    ]

    ads_rows = [{"ad_impressions": ad_impressions, "ad_clicks": ad_clicks, "ads_ctr_pct": _find_metric_value(kpi_metrics, "ads_ctr_pct"), "calc_status": _find_metric_status(kpi_metrics, "ads_ctr_pct")}]
    moderation_rows = [{"reports_reviewed_total": reports_reviewed_total, "reports_reviewed_under_24h": reports_reviewed_under_24h, "moderation_sla_24h_pct": _find_metric_value(kpi_metrics, "moderation_sla_24h_pct"), "calc_status": _find_metric_status(kpi_metrics, "moderation_sla_24h_pct")}]

    anomalies: List[Dict[str, Any]] = []
    if missing_events:
        anomalies.append({"type": "missing_events", "count": len(missing_events), "events": missing_events})
    for metric in kpi_metrics:
        if metric.calc_status in {INSUFFICIENT_DATA, WINDOW_NOT_MATURED}:
            anomalies.append({"type": "metric_status", "metric_key": metric.metric_key, "calc_status": metric.calc_status})

    return {
        "kpi_overview": kpi_overview_rows,
        "funnels": funnel_rows,
        "retention": retention_rows,
        "modules": modules_rows,
        "ads": ads_rows,
        "moderation": moderation_rows,
        "quality_checks": quality_rows,
        "anomalies": anomalies,
        "flat_metrics": _build_flat_metrics(
            kpi_metrics=kpi_metrics,
            funnel_rows=funnel_rows,
            modules_rows=modules_rows,
            quality_rows=quality_rows,
            retention_rows=retention_rows,
        ),
    }


async def persist_daily_metrics(db: AsyncSession, report_date: date, flat_metrics: List[Dict[str, Any]]) -> None:
    await db.execute(delete(models.AnalyticsDailyMetric).where(models.AnalyticsDailyMetric.date_msk == report_date))

    for row in flat_metrics:
        db.add(
            models.AnalyticsDailyMetric(
                date_msk=report_date,
                slice_name=row["slice_name"],
                metric_key=row["metric_key"],
                dimension_key=row.get("dimension_key", "all"),
                value_num=float(row.get("value_num") or 0.0),
                numerator=_to_optional_float(row.get("numerator")),
                denominator=_to_optional_float(row.get("denominator")),
                pct_value=_to_optional_float(row.get("pct_value")),
                calc_status=row.get("calc_status") or OK_STATUS,
                computed_at=datetime.utcnow(),
            )
        )

    await db.commit()


def build_report_payload(report_date: date, metrics: Dict[str, Any], *, generated_by: str) -> Dict[str, Any]:
    return {
        "report_meta": {
            "date_msk": report_date.isoformat(),
            "timezone": "Europe/Moscow",
            "generated_at_utc": datetime.utcnow().replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z"),
            "generated_by": generated_by,
            "windows": ["D1", "D7", "D30"],
            "wow_enabled": True,
            "raw_retention_days": get_settings().analytics_raw_retention_days,
            "aggregates_retention_days": get_settings().analytics_agg_retention_days,
        },
        "kpi_overview": metrics["kpi_overview"],
        "funnels": metrics["funnels"],
        "retention": metrics["retention"],
        "modules": metrics["modules"],
        "ads": metrics["ads"],
        "moderation": metrics["moderation"],
        "quality_checks": metrics["quality_checks"],
        "anomalies": metrics["anomalies"],
        "definitions": {
            "event_contract": {
                "fields": ["event_name", "event_ts_utc", "event_date_msk", "user_hash", "session_id", "platform", "app_version", "screen", "entity_type", "entity_id", "properties_json", "ingest_source", "request_id"],
                "dedup_key": "request_id + event_name + user_hash + entity_type + entity_id",
                "user_hash": "HMAC_SHA256(user_id, ANALYTICS_SALT)",
            },
            "kpi_formulas": KPI_DEFINITIONS,
            "zero_denominator_rule": "denominator=0 => pct_value=null and calc_status=insufficient_data",
        },
    }


def _resolve_report_paths(report_date: date) -> Dict[str, Path]:
    root = Path(get_settings().analytics_reports_dir)
    base_dir = root / f"{report_date.year:04d}" / f"{report_date.month:02d}" / f"{report_date.day:02d}"
    date_str = report_date.isoformat()
    return {
        "base_dir": base_dir,
        "json": base_dir / f"campus_analytics_{date_str}.json",
        "kpi_csv": base_dir / "kpi_overview.csv",
        "funnels_csv": base_dir / "funnels.csv",
        "retention_csv": base_dir / "retention.csv",
        "modules_csv": base_dir / "modules.csv",
        "ads_csv": base_dir / "ads.csv",
        "moderation_csv": base_dir / "moderation.csv",
        "csv_zip": base_dir / f"campus_analytics_{date_str}_csv_bundle.zip",
    }


def _write_csv(path: Path, rows: Sequence[Dict[str, Any]], fieldnames: Sequence[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(fieldnames))
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key) for key in fieldnames})


def write_report_files(report_date: date, report_payload: Dict[str, Any]) -> Dict[str, Path]:
    paths = _resolve_report_paths(report_date)
    paths["base_dir"].mkdir(parents=True, exist_ok=True)

    with paths["json"].open("w", encoding="utf-8") as f:
        json.dump(report_payload, f, ensure_ascii=False, indent=2)

    _write_csv(paths["kpi_csv"], report_payload.get("kpi_overview", []), ["metric_key", "label", "value", "unit", "numerator", "denominator", "calc_status", "wow_pct"])
    _write_csv(paths["funnels_csv"], report_payload.get("funnels", []), ["funnel", "step_order", "step_name", "users", "from_prev_pct", "calc_status"])
    _write_csv(paths["retention_csv"], report_payload.get("retention", []), ["window", "cohort_date", "target_date", "cohort_users", "returned_users", "retention_pct", "calc_status"])
    _write_csv(paths["modules_csv"], report_payload.get("modules", []), ["module", "metric_key", "value"])
    _write_csv(paths["ads_csv"], report_payload.get("ads", []), ["ad_impressions", "ad_clicks", "ads_ctr_pct", "calc_status"])
    _write_csv(paths["moderation_csv"], report_payload.get("moderation", []), ["reports_reviewed_total", "reports_reviewed_under_24h", "moderation_sla_24h_pct", "calc_status"])

    with zipfile.ZipFile(paths["csv_zip"], "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(paths["kpi_csv"], arcname=paths["kpi_csv"].name)
        zf.write(paths["funnels_csv"], arcname=paths["funnels_csv"].name)
        zf.write(paths["retention_csv"], arcname=paths["retention_csv"].name)
        zf.write(paths["modules_csv"], arcname=paths["modules_csv"].name)
        zf.write(paths["ads_csv"], arcname=paths["ads_csv"].name)
        zf.write(paths["moderation_csv"], arcname=paths["moderation_csv"].name)

    return paths


def get_report_paths_for_date(report_date: date) -> Dict[str, Path]:
    return _resolve_report_paths(report_date)


def load_report_json(report_date: date) -> Dict[str, Any]:
    path = _resolve_report_paths(report_date)["json"]
    if not path.exists():
        raise FileNotFoundError(str(path))
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_latest_report_metadata() -> Optional[Dict[str, Any]]:
    root = Path(get_settings().analytics_reports_dir)
    if not root.exists():
        return None

    latest_date: Optional[date] = None
    latest_json: Optional[Path] = None
    for path in root.rglob("campus_analytics_*.json"):
        date_str = path.stem.replace("campus_analytics_", "")
        try:
            parsed = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            continue
        if latest_date is None or parsed > latest_date:
            latest_date = parsed
            latest_json = path

    if latest_date is None or latest_json is None:
        return None

    return {
        "date": latest_date,
        "generated_at_utc": datetime.fromtimestamp(latest_json.stat().st_mtime, tz=timezone.utc),
        "json_path": str(latest_json),
        "csv_zip_path": str(_resolve_report_paths(latest_date)["csv_zip"]),
    }


async def rebuild_daily_report(db: AsyncSession, report_date: date, *, generated_by: str = "system") -> Dict[str, Any]:
    metrics = await compute_daily_report_metrics(db, report_date)
    await persist_daily_metrics(db, report_date, metrics["flat_metrics"])
    await apply_retention_policies(db)
    report_payload = build_report_payload(report_date, metrics, generated_by=generated_by)
    paths = write_report_files(report_date, report_payload)

    return {
        "date": report_date,
        "report_path": str(paths["json"]),
        "csv_zip_path": str(paths["csv_zip"]),
        "generated_at_utc": datetime.utcnow().replace(tzinfo=timezone.utc),
    }


async def get_analytics_health(db: AsyncSession) -> Dict[str, Any]:
    latest_event_at = await db.scalar(select(func.max(models.AnalyticsEvent.event_ts_utc)))
    ingest_lag_seconds = int((datetime.utcnow() - latest_event_at).total_seconds()) if latest_event_at else None

    latest_quality_date = await db.scalar(
        select(func.max(models.AnalyticsDailyMetric.date_msk)).where(
            models.AnalyticsDailyMetric.slice_name == "quality_daily"
        )
    )

    quality_map: Dict[str, Optional[float]] = {
        "missing_events_rate": None,
        "late_events_rate": None,
        "metric_drift_rate": None,
    }
    if latest_quality_date:
        rows = await db.execute(
            select(models.AnalyticsDailyMetric.metric_key, models.AnalyticsDailyMetric.value_num).where(
                models.AnalyticsDailyMetric.slice_name == "quality_daily",
                models.AnalyticsDailyMetric.date_msk == latest_quality_date,
                models.AnalyticsDailyMetric.metric_key.in_(["missing_events_rate", "late_events_rate", "metric_drift_rate"]),
            )
        )
        for key, value in rows.all():
            quality_map[key] = float(value) if value is not None else None

    status = "ok"
    if ingest_lag_seconds is None:
        status = "warning"
    elif ingest_lag_seconds > 48 * 3600:
        status = "degraded"

    return {
        "status": status,
        "latest_event_at_utc": latest_event_at.replace(tzinfo=timezone.utc) if latest_event_at else None,
        "ingest_lag_seconds": ingest_lag_seconds,
        "missing_events_rate": quality_map["missing_events_rate"],
        "late_events_rate": quality_map["late_events_rate"],
        "metric_drift_rate": quality_map["metric_drift_rate"],
    }


async def apply_retention_policies(db: AsyncSession) -> None:
    settings = get_settings()
    raw_cutoff = datetime.utcnow() - timedelta(days=settings.analytics_raw_retention_days)
    agg_cutoff = (datetime.now(MSK_TZ) - timedelta(days=settings.analytics_agg_retention_days)).date()

    await db.execute(delete(models.AnalyticsEvent).where(models.AnalyticsEvent.event_ts_utc < raw_cutoff))
    await db.execute(delete(models.AnalyticsDailyMetric).where(models.AnalyticsDailyMetric.date_msk < agg_cutoff))
    await db.commit()


async def run_nightly_rebuild_loop(stop_event: asyncio.Event) -> None:
    settings = get_settings()
    if not settings.analytics_nightly_enabled:
        return

    while not stop_event.is_set():
        now_msk = datetime.now(MSK_TZ)
        next_run = now_msk.replace(hour=settings.analytics_nightly_hour_msk, minute=5, second=0, microsecond=0)
        if next_run <= now_msk:
            next_run += timedelta(days=1)

        wait_seconds = max((next_run - now_msk).total_seconds(), 5)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
            break
        except asyncio.TimeoutError:
            pass

        try:
            report_date = (datetime.now(MSK_TZ) - timedelta(days=1)).date()
            async with AsyncSessionLocal() as db:
                await rebuild_daily_report(db, report_date, generated_by="nightly")
            logger.info("Nightly analytics rebuild completed for %s", report_date.isoformat())
        except Exception:
            logger.exception("Nightly analytics rebuild failed")
