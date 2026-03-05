# ===== FILE: backend/app/routers/dev_auth_router.py =====
#
# ✅ Фаза 3: async/await, legacy_sync_db_dep → get_db, Session → AsyncSession

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.auth_service import create_auth_session
from app.config import get_settings
from app.database import get_db

router = APIRouter(prefix="/dev/auth", tags=["dev-auth"])


def _ensure_dev_mode():
    settings = get_settings()
    if settings.app_env.lower() != "dev" or not settings.dev_auth_enabled:
        raise HTTPException(status_code=404, detail="Not found")
    return settings


@router.post("/login-as", response_model=schemas.AuthLoginResponse)
async def dev_login_as(
    payload: schemas.DevLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    settings = _ensure_dev_mode()
    if settings.dev_telegram_ids and payload.telegram_id not in settings.dev_telegram_ids:
        raise HTTPException(status_code=403, detail="telegram_id is not in DEV_TELEGRAM_IDS")

    result = await db.execute(
        select(models.User).where(models.User.telegram_id == payload.telegram_id)
    )
    user = result.scalar_one_or_none()

    access_token, refresh_token, _ = await create_auth_session(
        db=db,
        telegram_id=payload.telegram_id,
        user_id=user.id if user else None,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure or settings.is_prod,
        samesite=settings.cookie_samesite,
        path="/auth",
        max_age=settings.refresh_ttl_days * 24 * 60 * 60,
    )
    return schemas.AuthLoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user,
        is_registered=user is not None,
    )


@router.post("/reset-user")
async def dev_reset_user(
    payload: schemas.DevResetRequest,
    db: AsyncSession = Depends(get_db),
):
    settings = _ensure_dev_mode()
    if settings.dev_telegram_ids and payload.telegram_id not in settings.dev_telegram_ids:
        raise HTTPException(status_code=403, detail="telegram_id is not in DEV_TELEGRAM_IDS")

    result = await db.execute(
        select(models.User).where(models.User.telegram_id == payload.telegram_id)
    )
    user = result.scalar_one_or_none()
    if user:
        await db.delete(user)

    await db.execute(
        sa_delete(models.AuthSession).where(
            models.AuthSession.telegram_id == payload.telegram_id
        )
    )
    await db.commit()
    return {"success": True}
