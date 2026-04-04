# ===== FILE: backend/app/routers/dev_auth_router.py =====
#
# ✅ Фаза 3: async/await, legacy_sync_db_dep → get_db, Session → AsyncSession

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select, delete as sa_delete, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.auth_service import create_auth_session
from app.config import get_settings
from app.database import get_db
from app.utils import delete_images

router = APIRouter(prefix="/dev/auth", tags=["dev-auth"])

DEV_SUPERADMIN_ID = 999999
DEV_AMBASSADOR_ID = 999998


DEV_PROFILE_PRESETS = {
    DEV_SUPERADMIN_ID: {
        "name": "Dev Superadmin",
        "username": "dev_superadmin",
        "role": "superadmin",
        "campus_id": "ruk_moscow",
        "university": "РУК",
        "city": "Москва",
        "institute": "Администрирование",
    },
    DEV_AMBASSADOR_ID: {
        "name": "Dev Ambassador RUK Moscow",
        "username": "dev_ambassador",
        "role": "ambassador",
        "campus_id": "ruk_moscow",
        "university": "РУК",
        "city": "Москва",
        "institute": "Экономический факультет",
    },
}


def _ensure_dev_mode():
    settings = get_settings()
    if settings.is_prod or settings.app_env.lower() != "dev" or not settings.dev_auth_enabled:
        raise HTTPException(status_code=404, detail="Not found")
    return settings


def _apply_preset_user_profile(user: models.User, preset: dict, telegram_id: int) -> None:
    user.name = preset["name"]
    user.username = preset["username"]
    user.role = preset["role"]
    user.campus_id = preset["campus_id"]
    user.university = preset["university"]
    user.city = preset["city"]
    user.institute = preset["institute"]
    user.custom_university = None
    user.custom_city = None
    user.custom_faculty = None
    user.show_profile = True
    user.show_telegram_id = False
    user.show_in_dating = False

    if user.bio is None:
        user.bio = f"Dev profile #{telegram_id}"


async def _ensure_preset_dev_user(db: AsyncSession, telegram_id: int, user: models.User | None) -> models.User | None:
    preset = DEV_PROFILE_PRESETS.get(telegram_id)
    if not preset:
        return user

    if user is None:
        user = models.User(
            telegram_id=telegram_id,
            name=preset["name"],
            username=preset["username"],
            role=preset["role"],
            campus_id=preset["campus_id"],
            university=preset["university"],
            city=preset["city"],
            institute=preset["institute"],
            bio=f"Dev profile #{telegram_id}",
            show_profile=True,
            show_telegram_id=False,
            show_in_dating=False,
        )
        db.add(user)
        await db.flush()
        return user

    _apply_preset_user_profile(user, preset, telegram_id)
    await db.flush()
    return user


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
    user = await _ensure_preset_dev_user(db, payload.telegram_id, user)

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
    photos_to_delete = []

    if user and not payload.hard:
        dating_profile_result = await db.execute(
            select(models.DatingProfile).where(models.DatingProfile.user_id == user.id)
        )
        dating_profile = dating_profile_result.scalar_one_or_none()

        if dating_profile and isinstance(dating_profile.photos, list):
            photos_to_delete = dating_profile.photos

        await db.execute(
            sa_delete(models.Match).where(
                or_(
                    models.Match.user_a_id == user.id,
                    models.Match.user_b_id == user.id,
                )
            )
        )
        await db.execute(
            sa_delete(models.DatingLike).where(
                or_(
                    models.DatingLike.who_liked_id == user.id,
                    models.DatingLike.whom_liked_id == user.id,
                )
            )
        )
        await db.execute(
            sa_delete(models.Notification).where(
                models.Notification.recipient_id == user.id,
                models.Notification.type.in_(["match", "dating_like"]),
            )
        )

        if dating_profile:
            await db.delete(dating_profile)

        user.show_in_dating = False
    elif user:
        await db.delete(user)

    if payload.hard:
        await db.execute(
            sa_delete(models.AuthSession).where(
                models.AuthSession.telegram_id == payload.telegram_id
            )
        )

    await db.commit()

    if photos_to_delete:
        delete_images(photos_to_delete, default_kind="images")

    return {"success": True, "hard": payload.hard}
