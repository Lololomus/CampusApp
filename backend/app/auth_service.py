# ===== FILE: backend/app/auth_service.py =====
#
# ✅ Фаза 3: Полный перевод на async
#    - Session → AsyncSession
#    - legacy_query_api() → select() + await db.execute()
#    - db.commit() → await db.commit()
#    - db.refresh() → await db.refresh()
#    - require_user → async def + Depends(get_db)

import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from urllib.parse import parse_qsl

import jwt
from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.config import get_settings
from app.database import get_db


@dataclass
class AuthIdentity:
    telegram_id: int
    user_id: Optional[int]
    role: str
    session_id: int


def _utcnow() -> datetime:
    # DB columns are TIMESTAMP WITHOUT TIME ZONE, so we persist naive UTC.
    return datetime.utcnow()


# ===== TELEGRAM AUTH (чистый Python, без DB — async не нужен) =====

def parse_telegram_init_data(init_data: str) -> Dict[str, str]:
    if not init_data:
        return {}
    return {k: v for k, v in parse_qsl(init_data, keep_blank_values=True)}


def verify_telegram_auth(init_data: str) -> Dict[str, str]:
    auth_data = parse_telegram_init_data(init_data)
    settings = get_settings()
    if not auth_data:
        raise HTTPException(status_code=401, detail="Invalid Telegram initData")

    if settings.app_env.lower() == "dev" and settings.bot_token == "test_token":
        if "user" not in auth_data:
            raise HTTPException(status_code=401, detail="Missing Telegram user payload")
        return auth_data

    if "hash" not in auth_data:
        raise HTTPException(status_code=401, detail="Invalid Telegram initData")

    data_copy = dict(auth_data)
    received_hash = data_copy.pop("hash")
    data_check_string = "\n".join([f"{k}={v}" for k, v in sorted(data_copy.items())])

    secret_key = hmac.new(
        key=b"WebAppData",
        msg=settings.bot_token.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    calculated_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(status_code=401, detail="Telegram signature mismatch")

    auth_date_raw = data_copy.get("auth_date")
    if not auth_date_raw or not auth_date_raw.isdigit():
        raise HTTPException(status_code=401, detail="Missing auth_date")

    auth_date = int(auth_date_raw)
    now_ts = int(time.time())
    if now_ts - auth_date > settings.auth_max_skew_seconds:
        raise HTTPException(status_code=401, detail="Telegram auth data expired")

    return data_copy


# ===== JWT (чистый Python, без DB) =====

def _encode_access_token(identity: AuthIdentity) -> str:
    settings = get_settings()
    now_ts = int(time.time())
    payload = {
        "sub": str(identity.user_id) if identity.user_id is not None else "",
        "tgid": identity.telegram_id,
        "role": identity.role,
        "sid": identity.session_id,
        "iat": now_ts,
        "exp": now_ts + settings.access_ttl_min * 60,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def decode_access_token(token: str) -> Dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid access token")


def _hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# ===== SESSION MANAGEMENT (async) =====

async def create_auth_session(
    db: AsyncSession,
    telegram_id: int,
    user_id: Optional[int],
    user_agent: Optional[str],
    ip: Optional[str],
) -> tuple[str, str, models.AuthSession]:
    settings = get_settings()
    raw_refresh = secrets.token_urlsafe(48)
    refresh_hash = _hash_refresh_token(raw_refresh)

    session = models.AuthSession(
        telegram_id=telegram_id,
        user_id=user_id,
        refresh_hash=refresh_hash,
        user_agent=user_agent,
        ip=ip,
        expires_at=_utcnow() + timedelta(days=settings.refresh_ttl_days),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    user_role = "user"
    if user_id is not None:
        result = await db.execute(
            select(models.User).where(models.User.id == user_id)
        )
        user = result.scalar_one_or_none()
        user_role = user.role if user else "user"

    identity = AuthIdentity(
        telegram_id=telegram_id,
        user_id=user_id,
        role=user_role,
        session_id=session.id,
    )
    access_token = _encode_access_token(identity)
    return access_token, raw_refresh, session


async def refresh_auth_session(
    db: AsyncSession,
    raw_refresh_token: str,
) -> tuple[str, str, models.AuthSession]:
    refresh_hash = _hash_refresh_token(raw_refresh_token)

    result = await db.execute(
        select(models.AuthSession).where(
            models.AuthSession.refresh_hash == refresh_hash
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=401, detail="Refresh token not found")

    now = _utcnow()
    if session.revoked_at is not None or session.expires_at <= now:
        raise HTTPException(status_code=401, detail="Refresh token expired")

    session.revoked_at = now
    await db.commit()

    return await create_auth_session(
        db=db,
        telegram_id=session.telegram_id,
        user_id=session.user_id,
        user_agent=session.user_agent,
        ip=session.ip,
    )


async def revoke_auth_session(db: AsyncSession, raw_refresh_token: Optional[str]) -> None:
    if not raw_refresh_token:
        return

    refresh_hash = _hash_refresh_token(raw_refresh_token)

    result = await db.execute(
        select(models.AuthSession).where(
            models.AuthSession.refresh_hash == refresh_hash
        )
    )
    session = result.scalar_one_or_none()

    if session and session.revoked_at is None:
        session.revoked_at = _utcnow()
        await db.commit()


# ===== IDENTITY EXTRACTION (чистый Python, без DB) =====

def get_identity_from_request(request: Request) -> AuthIdentity:
    payload = getattr(request.state, "auth_payload", None)
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        telegram_id = int(payload.get("tgid"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user_id_raw = payload.get("sub")
    user_id = int(user_id_raw) if str(user_id_raw).isdigit() else None
    sid_raw = payload.get("sid", 0)
    try:
        session_id = int(sid_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return AuthIdentity(
        telegram_id=telegram_id,
        user_id=user_id,
        role=payload.get("role", "user"),
        session_id=session_id,
    )


# ===== FASTAPI DEPENDENCIES =====

def require_identity(request: Request) -> AuthIdentity:
    """Не async — чистый Python, без DB."""
    return get_identity_from_request(request)


async def require_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> models.User:
    """✅ Async: select() + await db.execute()"""
    settings = get_settings()
    identity = get_identity_from_request(request)

    result = await db.execute(
        select(models.User).where(models.User.telegram_id == identity.telegram_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if settings.is_prod and settings.auth_session_binding_enabled:
        if identity.session_id <= 0:
            raise HTTPException(status_code=401, detail="Invalid token session")

        now = _utcnow()
        session_result = await db.execute(
            select(models.AuthSession).where(
                models.AuthSession.id == identity.session_id,
                models.AuthSession.telegram_id == identity.telegram_id,
                models.AuthSession.revoked_at.is_(None),
                models.AuthSession.expires_at > now,
            )
        )
        session = session_result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=401, detail="Session is not active")
        if session.user_id is not None and session.user_id != user.id:
            raise HTTPException(status_code=401, detail="Session user mismatch")

    return user


async def get_current_user(db: AsyncSession, telegram_id: int) -> models.User:
    """✅ Async"""
    result = await db.execute(
        select(models.User).where(models.User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ===== HEADER UTILS (чистый Python) =====

def extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    prefix = "bearer "
    if not authorization.lower().startswith(prefix):
        return None
    return authorization[len(prefix):].strip()


def decode_authorization_header(
    authorization: Optional[str] = Header(default=None),
) -> Optional[Dict[str, Any]]:
    token = extract_bearer_token(authorization)
    if not token:
        return None
    return decode_access_token(token)
