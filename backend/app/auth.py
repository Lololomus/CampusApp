import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import parse_qsl

import jwt
from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

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
    return datetime.now(timezone.utc)


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


def _encode_access_token(identity: AuthIdentity) -> str:
    settings = get_settings()
    now = _utcnow()
    payload = {
        "sub": str(identity.user_id) if identity.user_id is not None else "",
        "tgid": identity.telegram_id,
        "role": identity.role,
        "sid": identity.session_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_ttl_min)).timestamp()),
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


def create_auth_session(
    db: Session,
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
    db.commit()
    db.refresh(session)

    user_role = "user"
    if user_id is not None:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        user_role = user.role if user else "user"

    identity = AuthIdentity(
        telegram_id=telegram_id,
        user_id=user_id,
        role=user_role,
        session_id=session.id,
    )
    access_token = _encode_access_token(identity)
    return access_token, raw_refresh, session


def refresh_auth_session(
    db: Session,
    raw_refresh_token: str,
) -> tuple[str, str, models.AuthSession]:
    refresh_hash = _hash_refresh_token(raw_refresh_token)
    session = (
        db.query(models.AuthSession)
        .filter(models.AuthSession.refresh_hash == refresh_hash)
        .first()
    )
    if not session:
        raise HTTPException(status_code=401, detail="Refresh token not found")

    now = _utcnow()
    if session.revoked_at is not None or session.expires_at <= now:
        raise HTTPException(status_code=401, detail="Refresh token expired")

    session.revoked_at = now
    db.commit()

    return create_auth_session(
        db=db,
        telegram_id=session.telegram_id,
        user_id=session.user_id,
        user_agent=session.user_agent,
        ip=session.ip,
    )


def revoke_auth_session(db: Session, raw_refresh_token: Optional[str]) -> None:
    if not raw_refresh_token:
        return

    refresh_hash = _hash_refresh_token(raw_refresh_token)
    session = (
        db.query(models.AuthSession)
        .filter(models.AuthSession.refresh_hash == refresh_hash)
        .first()
    )
    if session and session.revoked_at is None:
        session.revoked_at = _utcnow()
        db.commit()


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

    return AuthIdentity(
        telegram_id=telegram_id,
        user_id=user_id,
        role=payload.get("role", "user"),
        session_id=int(payload.get("sid", 0)),
    )


def require_identity(request: Request) -> AuthIdentity:
    return get_identity_from_request(request)


def require_user(
    request: Request,
    db: Session = Depends(get_db),
) -> models.User:
    identity = get_identity_from_request(request)
    user = db.query(models.User).filter(models.User.telegram_id == identity.telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_current_user(db: Session, telegram_id: int) -> models.User:
    user = db.query(models.User).filter(models.User.telegram_id == telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


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
