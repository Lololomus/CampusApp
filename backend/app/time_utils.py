from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def to_iso_z(dt: datetime | None) -> str | None:
    normalized = ensure_utc(dt)
    if normalized is None:
        return None
    return normalized.isoformat().replace("+00:00", "Z")


def normalize_datetime_payload(payload: Any) -> Any:
    if isinstance(payload, datetime):
        return to_iso_z(payload)
    if isinstance(payload, dict):
        return {key: normalize_datetime_payload(value) for key, value in payload.items()}
    if isinstance(payload, list):
        return [normalize_datetime_payload(value) for value in payload]
    if isinstance(payload, tuple):
        return tuple(normalize_datetime_payload(value) for value in payload)
    return payload
