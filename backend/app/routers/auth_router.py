# ===== FILE: backend/app/routers/auth_router.py =====
#
# ✅ Фаза 3.2: async/await, legacy_sync_db_dep → get_db, Session → AsyncSession
# ✅ Фаза 4.2: _rate_buckets (in-memory) → Redis rate limiter

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sa_update

from app import crud, models, schemas
from app.auth_service import (
    create_auth_session,
    refresh_auth_session,
    require_identity,
    revoke_auth_session,
    verify_telegram_auth,
)
from app.database import get_db
from app.rate_limiter import check_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/telegram/login", response_model=schemas.AuthLoginResponse)
async def telegram_login(
    payload: schemas.TelegramAuth,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request, "auth_login")
    auth_data = verify_telegram_auth(payload.init_data)
    user_data_raw = auth_data.get("user")
    if not user_data_raw:
        raise HTTPException(status_code=401, detail="Telegram user not found")

    import json

    try:
        tg_user = json.loads(user_data_raw)
    except (json.JSONDecodeError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid Telegram user payload")

    telegram_id = tg_user.get("id")
    if not isinstance(telegram_id, int):
        raise HTTPException(status_code=401, detail="Invalid Telegram user id")

    user = await crud.get_user_by_telegram_id(db, telegram_id)
    access_token, refresh_token, _ = await create_auth_session(
        db=db,
        telegram_id=telegram_id,
        user_id=user.id if user else None,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )

    from app.config import get_settings

    settings = get_settings()
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure or settings.is_prod,
        samesite=settings.cookie_samesite,
        path="/api/auth",
        max_age=settings.refresh_ttl_days * 24 * 60 * 60,
    )

    return schemas.AuthLoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user,
        is_registered=user is not None,
    )


@router.post("/register", response_model=schemas.UserResponse)
async def register_user(
    user_data: schemas.UserRegister,
    identity=Depends(require_identity),
    db: AsyncSession = Depends(get_db),
):
    existing_user = await crud.get_user_by_telegram_id(db, identity.telegram_id)
    if existing_user:
        raise HTTPException(status_code=409, detail="User already exists")

    create_payload = schemas.UserCreate(
        telegram_id=identity.telegram_id,
        **user_data.model_dump(),
    )
    user = await crud.create_user(db, create_payload)

    await db.execute(
        sa_update(models.AuthSession)
        .where(
            models.AuthSession.telegram_id == identity.telegram_id,
            models.AuthSession.revoked_at.is_(None),
        )
        .values(user_id=user.id)
    )
    await db.commit()

    return user


@router.post("/refresh", response_model=schemas.Token)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request, "auth_refresh")
    refresh_token_cookie = request.cookies.get("refresh_token")
    if not refresh_token_cookie:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    access_token, new_refresh_token, _ = await refresh_auth_session(db, refresh_token_cookie)

    from app.config import get_settings

    settings = get_settings()
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.cookie_secure or settings.is_prod,
        samesite=settings.cookie_samesite,
        path="/api/auth",
        max_age=settings.refresh_ttl_days * 24 * 60 * 60,
    )

    return schemas.Token(access_token=access_token, token_type="bearer")


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token_cookie = request.cookies.get("refresh_token")
    await revoke_auth_session(db, refresh_token_cookie)
    response.delete_cookie("refresh_token", path="/api/auth")
    return {"success": True}